const { pool } = require('../config/db');
const { SESSION_COOKIE_NAME, sha256Buffer } = require('../utils/security');

async function optionalAuth(req, res, next) {
  const token = req.cookies?.[SESSION_COOKIE_NAME];

  if (!token) {
    req.user = null;
    req.authSession = null;
    return next();
  }

  try {
    const [rows] = await pool.execute(
      `
      SELECT
        s.sessao_usuario_id,
        s.usuario_id,
        s.expira_em,
        u.public_id,
        u.nome,
        u.sobrenome,
        u.email,
        u.papel,
        u.status
      FROM sessoes_usuarios s
      INNER JOIN usuarios u ON u.usuario_id = s.usuario_id
      WHERE s.refresh_token_hash = ?
        AND s.revogado_em IS NULL
        AND s.expira_em > UTC_TIMESTAMP()
        AND u.status = 'ativo'
      LIMIT 1
      `,
      [sha256Buffer(token)]
    );

    const session = rows[0];

    if (!session) {
      res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
      req.user = null;
      req.authSession = null;
      return next();
    }

    req.user = {
      usuarioId: session.usuario_id,
      publicId: session.public_id,
      nome: session.nome,
      sobrenome: session.sobrenome,
      email: session.email,
      papel: session.papel,
    };

    req.authSession = {
      sessaoUsuarioId: session.sessao_usuario_id,
      expiraEm: session.expira_em,
    };

    pool
      .execute(
        'UPDATE sessoes_usuarios SET ultimo_uso_em = UTC_TIMESTAMP() WHERE sessao_usuario_id = ?',
        [session.sessao_usuario_id]
      )
      .catch(() => {});

    return next();
  } catch (error) {
    return next(error);
  }
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      ok: false,
      message: 'Faça login para continuar.',
    });
  }

  return next();
}

module.exports = {
  optionalAuth,
  requireAuth,
};
