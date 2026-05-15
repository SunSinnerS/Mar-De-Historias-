const { pool } = require('../config/db');
const {
  SESSION_COOKIE_NAME,
  createOpaqueToken,
  sha256Buffer,
  hmacBuffer,
  getSessionDays,
  secureCookieEnabled,
} = require('../utils/security');

function getExpiryDate() {
  const days = getSessionDays();
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function issueSession({ usuarioId, req, res, remember = true }) {
  const token = createOpaqueToken(32);
  const expiresAt = getExpiryDate();
  const ipHash = hmacBuffer(req.ip || '');
  const userAgentHash = hmacBuffer(req.get('user-agent') || '');

  await pool.execute(
    `
    INSERT INTO sessoes_usuarios (
      usuario_id,
      refresh_token_hash,
      ip_hash,
      user_agent_hash,
      expira_em
    ) VALUES (?, ?, ?, ?, ?)
    `,
    [usuarioId, sha256Buffer(token), ipHash, userAgentHash, expiresAt]
  );

  const maxAge = remember ? getSessionDays() * 24 * 60 * 60 * 1000 : undefined;

  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: secureCookieEnabled(),
    path: '/',
    ...(maxAge ? { maxAge } : {}),
  });
}

async function revokeSession(sessionId) {
  if (!sessionId) return;

  await pool.execute(
    `
    UPDATE sessoes_usuarios
    SET revogado_em = UTC_TIMESTAMP()
    WHERE sessao_usuario_id = ?
      AND revogado_em IS NULL
    `,
    [sessionId]
  );
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE_NAME, {
    path: '/',
    sameSite: 'lax',
    secure: secureCookieEnabled(),
  });
}

module.exports = {
  issueSession,
  revokeSession,
  clearSessionCookie,
};
