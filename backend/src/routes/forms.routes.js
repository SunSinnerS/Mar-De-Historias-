const express = require('express');
const { pool } = require('../config/db');
const asyncHandler = require('../utils/async-handler');
const { sendError, sendOk } = require('../utils/response');
const {
  normalizeEmail,
  isValidEmail,
  sanitizePlainText,
} = require('../utils/security');

const router = express.Router();

const subjectMap = {
  pedido: 'pedido',
  troca: 'trocas_devolucoes',
  trocas_devolucoes: 'trocas_devolucoes',
  pagamento: 'pedido',
  titulo: 'titulo_faltante',
  titulo_faltante: 'titulo_faltante',
  site: 'feedback_site',
  feedback_site: 'feedback_site',
  trabalhe_conosco: 'trabalhe_conosco',
  outro: 'outro',
};

router.post(
  '/newsletter',
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const origem = sanitizePlainText(req.body?.origem || 'footer', 120);

    if (!isValidEmail(email)) {
      return sendError(res, 400, 'Digite um e-mail válido.');
    }

    await pool.execute(
      `
      INSERT INTO newsletter_inscricoes (
        usuario_id,
        email,
        origem,
        status,
        confirmado_em
      ) VALUES (?, ?, ?, 'inscrito', UTC_TIMESTAMP())
      ON DUPLICATE KEY UPDATE
        usuario_id = COALESCE(VALUES(usuario_id), usuario_id),
        origem = VALUES(origem),
        status = 'inscrito',
        confirmado_em = COALESCE(confirmado_em, UTC_TIMESTAMP()),
        descadastrado_em = NULL,
        atualizado_em = CURRENT_TIMESTAMP
      `,
      [req.user?.usuarioId || null, email, origem]
    );

    return sendOk(
      res,
      {
        message: 'Inscrição registrada na newsletter.',
      },
      201
    );
  })
);

router.post(
  '/contato',
  asyncHandler(async (req, res) => {
    const nome = sanitizePlainText(req.body?.nome, 180);
    const email = normalizeEmail(req.body?.email);
    const assuntoEntrada = sanitizePlainText(req.body?.assunto, 60);
    const assunto = subjectMap[assuntoEntrada] || 'outro';
    const mensagem = sanitizePlainText(req.body?.mensagem, 4000);

    if (nome.length < 2) {
      return sendError(res, 400, 'Informe um nome válido.');
    }

    if (!isValidEmail(email)) {
      return sendError(res, 400, 'Digite um e-mail válido.');
    }

    if (!mensagem || mensagem.length < 12) {
      return sendError(res, 400, 'Escreva uma mensagem com pelo menos 12 caracteres.');
    }

    await pool.execute(
      `
      INSERT INTO mensagens_contato (
        usuario_id,
        nome,
        email,
        assunto,
        mensagem
      ) VALUES (?, ?, ?, ?, ?)
      `,
      [req.user?.usuarioId || null, nome, email, assunto, mensagem]
    );

    return sendOk(
      res,
      {
        message: 'Mensagem enviada com sucesso.',
      },
      201
    );
  })
);

router.post(
  '/titulos-solicitados',
  asyncHandler(async (req, res) => {
    const tituloSolicitado = sanitizePlainText(req.body?.tituloSolicitado, 220);
    const autorSugerido = sanitizePlainText(req.body?.autorSugerido, 180);
    const observacoes = sanitizePlainText(req.body?.observacoes, 600);
    const nomeSolicitante = sanitizePlainText(req.body?.nomeSolicitante, 180);
    const email = normalizeEmail(req.body?.email);

    if (tituloSolicitado.length < 2) {
      return sendError(res, 400, 'Informe o título solicitado.');
    }

    if (email && !isValidEmail(email)) {
      return sendError(res, 400, 'Informe um e-mail válido.');
    }

    await pool.execute(
      `
      INSERT INTO solicitacoes_titulos (
        usuario_id,
        nome_solicitante,
        email,
        titulo_solicitado,
        autor_sugerido,
        observacoes
      ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        req.user?.usuarioId || null,
        nomeSolicitante || null,
        email || null,
        tituloSolicitado,
        autorSugerido || null,
        observacoes || null,
      ]
    );

    return sendOk(
      res,
      {
        message: 'Solicitação de título registrada.',
      },
      201
    );
  })
);

module.exports = router;
