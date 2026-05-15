const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const rateLimit = require('express-rate-limit');
const { pool } = require('../config/db');
const asyncHandler = require('../utils/async-handler');
const { sendError, sendOk } = require('../utils/response');
const {
  createOpaqueToken,
  sha256Buffer,
  normalizeEmail,
  isValidEmail,
  sanitizePlainText,
} = require('../utils/security');
const { issueSession, revokeSession, clearSessionCookie } = require('../services/session.service');
const { requireAuth } = require('../middlewares/auth.middleware');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  ipv6Subnet: 56,
  message: {
    ok: false,
    message: 'Muitas tentativas em pouco tempo. Tente novamente mais tarde.',
  },
});

function publicUser(user) {
  const nomeCompleto = [user.nome, user.sobrenome].filter(Boolean).join(' ').trim();
  return {
    publicId: user.public_id || user.publicId,
    nome: user.nome,
    sobrenome: user.sobrenome || '',
    nomeCompleto: nomeCompleto || user.nome,
    email: user.email,
    papel: user.papel || 'cliente',
  };
}

router.post(
  '/cadastro',
  authLimiter,
  asyncHandler(async (req, res) => {
    const nome = sanitizePlainText(req.body?.nome, 120);
    const sobrenome = sanitizePlainText(req.body?.sobrenome, 120);
    const email = normalizeEmail(req.body?.email);
    const senha = String(req.body?.senha || '');
    const aceiteTermos = Boolean(req.body?.aceiteTermos);
    const newsletter = Boolean(req.body?.newsletter);
    const lembrar = req.body?.lembrar !== false;

    if (nome.length < 2) {
      return sendError(res, 400, 'Informe um nome válido.');
    }

    if (!isValidEmail(email)) {
      return sendError(res, 400, 'Informe um e-mail válido.');
    }

    if (senha.length < 8) {
      return sendError(res, 400, 'A senha precisa ter pelo menos 8 caracteres.');
    }

    if (!aceiteTermos) {
      return sendError(res, 400, 'Aceite os termos para continuar.');
    }

    const [existing] = await pool.execute(
      'SELECT usuario_id FROM usuarios WHERE email = ? LIMIT 1',
      [email]
    );

    if (existing.length) {
      return sendError(res, 409, 'Já existe uma conta cadastrada com este e-mail.');
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const senhaHash = await bcrypt.hash(senha, 12);
      const publicId = crypto.randomUUID();

      const [result] = await connection.execute(
        `
        INSERT INTO usuarios (
          public_id,
          nome,
          sobrenome,
          email,
          senha_hash,
          papel,
          status,
          email_verificado_em,
          marketing_opt_in
        ) VALUES (?, ?, ?, ?, ?, 'cliente', 'ativo', UTC_TIMESTAMP(), ?)
        `,
        [publicId, nome, sobrenome || null, email, senhaHash, newsletter]
      );

      const usuarioId = result.insertId;

      if (newsletter) {
        await connection.execute(
          `
          INSERT INTO newsletter_inscricoes (
            usuario_id,
            email,
            origem,
            status,
            confirmado_em
          ) VALUES (?, ?, 'cadastro', 'inscrito', UTC_TIMESTAMP())
          ON DUPLICATE KEY UPDATE
            usuario_id = VALUES(usuario_id),
            status = 'inscrito',
            confirmado_em = COALESCE(confirmado_em, UTC_TIMESTAMP()),
            atualizado_em = CURRENT_TIMESTAMP
          `,
          [usuarioId, email]
        );
      }

      await connection.commit();

      await issueSession({
        usuarioId,
        req,
        res,
        remember: lembrar,
      });

      return sendOk(
        res,
        {
          message: 'Conta criada com sucesso.',
          usuario: publicUser({
            public_id: publicId,
            nome,
            sobrenome,
            email,
            papel: 'cliente',
          }),
        },
        201
      );
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  })
);

router.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const senha = String(req.body?.senha || '');
    const lembrar = req.body?.lembrar !== false;

    if (!isValidEmail(email) || !senha) {
      return sendError(res, 400, 'Informe e-mail e senha.');
    }

    const [rows] = await pool.execute(
      `
      SELECT
        usuario_id,
        public_id,
        nome,
        sobrenome,
        email,
        senha_hash,
        papel,
        status,
        falhas_login,
        bloqueado_ate
      FROM usuarios
      WHERE email = ?
      LIMIT 1
      `,
      [email]
    );

    const user = rows[0];

    if (!user) {
      return sendError(res, 401, 'E-mail ou senha incorretos.');
    }

    if (user.status !== 'ativo') {
      return sendError(res, 403, 'Esta conta não está disponível para login.');
    }

    if (user.bloqueado_ate && new Date(user.bloqueado_ate).getTime() > Date.now()) {
      return sendError(res, 429, 'Conta temporariamente bloqueada por tentativas inválidas.');
    }

    const passwordMatches = await bcrypt.compare(senha, user.senha_hash);

    if (!passwordMatches) {
      const nextFailures = Math.min(Number(user.falhas_login || 0) + 1, 100);
      const blockedUntil = nextFailures >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;

      await pool.execute(
        `
        UPDATE usuarios
        SET falhas_login = ?,
            bloqueado_ate = ?
        WHERE usuario_id = ?
        `,
        [nextFailures, blockedUntil, user.usuario_id]
      );

      return sendError(res, 401, 'E-mail ou senha incorretos.');
    }

    await pool.execute(
      `
      UPDATE usuarios
      SET falhas_login = 0,
          bloqueado_ate = NULL,
          ultimo_login_em = UTC_TIMESTAMP()
      WHERE usuario_id = ?
      `,
      [user.usuario_id]
    );

    await issueSession({
      usuarioId: user.usuario_id,
      req,
      res,
      remember: lembrar,
    });

    return sendOk(res, {
      message: 'Login realizado com sucesso.',
      usuario: publicUser(user),
    });
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    return sendOk(res, {
      usuario: publicUser({
        publicId: req.user.publicId,
        nome: req.user.nome,
        sobrenome: req.user.sobrenome,
        email: req.user.email,
        papel: req.user.papel,
      }),
    });
  })
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    if (req.authSession?.sessaoUsuarioId) {
      await revokeSession(req.authSession.sessaoUsuarioId);
    }

    clearSessionCookie(res);
    return sendOk(res, { message: 'Sessão encerrada.' });
  })
);

router.post(
  '/recuperacao/iniciar',
  authLimiter,
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body?.email);

    if (!isValidEmail(email)) {
      return sendError(res, 400, 'Informe um e-mail válido.');
    }

    const [rows] = await pool.execute(
      'SELECT usuario_id FROM usuarios WHERE email = ? AND status = ? LIMIT 1',
      [email, 'ativo']
    );

    let tokenLocal = null;

    if (rows.length) {
      const token = createOpaqueToken(32);
      const expiraEm = new Date(Date.now() + 30 * 60 * 1000);

      await pool.execute(
        `
        INSERT INTO tokens_redefinicao_senha (
          usuario_id,
          token_hash,
          expira_em
        ) VALUES (?, ?, ?)
        `,
        [rows[0].usuario_id, sha256Buffer(token), expiraEm]
      );

      if (String(process.env.NODE_ENV || 'development') !== 'production') {
        tokenLocal = token;
      }
    }

    return sendOk(res, {
      message:
        'Se o e-mail estiver cadastrado, as instruções de recuperação serão disponibilizadas.',
      ...(tokenLocal ? { tokenLocal } : {}),
    });
  })
);

router.post(
  '/recuperacao/redefinir',
  authLimiter,
  asyncHandler(async (req, res) => {
    const token = String(req.body?.token || '').trim();
    const novaSenha = String(req.body?.novaSenha || '');

    if (token.length < 32) {
      return sendError(res, 400, 'Token de recuperação inválido.');
    }

    if (novaSenha.length < 8) {
      return sendError(res, 400, 'A nova senha precisa ter pelo menos 8 caracteres.');
    }

    const [rows] = await pool.execute(
      `
      SELECT
        tr.token_redefinicao_senha_id,
        tr.usuario_id
      FROM tokens_redefinicao_senha tr
      WHERE tr.token_hash = ?
        AND tr.usado_em IS NULL
        AND tr.expira_em > UTC_TIMESTAMP()
      LIMIT 1
      `,
      [sha256Buffer(token)]
    );

    const reset = rows[0];

    if (!reset) {
      return sendError(res, 400, 'O link de recuperação expirou ou é inválido.');
    }

    const senhaHash = await bcrypt.hash(novaSenha, 12);
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      await connection.execute(
        'UPDATE usuarios SET senha_hash = ?, falhas_login = 0, bloqueado_ate = NULL WHERE usuario_id = ?',
        [senhaHash, reset.usuario_id]
      );

      await connection.execute(
        'UPDATE tokens_redefinicao_senha SET usado_em = UTC_TIMESTAMP() WHERE token_redefinicao_senha_id = ?',
        [reset.token_redefinicao_senha_id]
      );

      await connection.execute(
        `
        UPDATE sessoes_usuarios
        SET revogado_em = UTC_TIMESTAMP()
        WHERE usuario_id = ?
          AND revogado_em IS NULL
        `,
        [reset.usuario_id]
      );

      await connection.commit();
      clearSessionCookie(res);

      return sendOk(res, {
        message: 'Senha redefinida com sucesso.',
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  })
);

module.exports = router;
