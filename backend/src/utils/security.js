const crypto = require('node:crypto');

const SESSION_COOKIE_NAME = 'lmh_session';

function getSessionDays() {
  const parsed = Number(process.env.SESSION_DAYS || 7);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 7;
}

function secureCookieEnabled() {
  return String(process.env.COOKIE_SECURE || 'false').toLowerCase() === 'true';
}

function createOpaqueToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

function sha256Buffer(value = '') {
  return crypto.createHash('sha256').update(String(value)).digest();
}

function hmacBuffer(value = '') {
  const secret = process.env.APP_HASH_SECRET || 'lmh-dev-hash-secret';
  return crypto.createHmac('sha256', secret).update(String(value || '')).digest();
}

function getEncryptionKey() {
  const hex = String(process.env.FIELD_ENCRYPTION_KEY || '').trim();
  const key = Buffer.from(hex, 'hex');

  if (key.length !== 32) {
    throw new Error('FIELD_ENCRYPTION_KEY precisa conter 64 caracteres hexadecimais.');
  }

  return key;
}

function encryptSensitiveText(value = '') {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return { ciphertext: null, iv: null, authTag: null };
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(normalized, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return { ciphertext, iv, authTag };
}

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function isValidEmail(value = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function sanitizePlainText(value = '', maxLength = 600) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function digitsOnly(value = '') {
  return String(value || '').replace(/\D/g, '');
}

function parseMoney(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Number(value.toFixed(2)) : NaN;
  }

  const normalized = String(value || '')
    .replace(/[^\d,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : NaN;
}

function moneyEquals(a, b) {
  return Math.abs(Number(a || 0) - Number(b || 0)) < 0.01;
}

module.exports = {
  SESSION_COOKIE_NAME,
  getSessionDays,
  secureCookieEnabled,
  createOpaqueToken,
  sha256Buffer,
  hmacBuffer,
  encryptSensitiveText,
  normalizeEmail,
  isValidEmail,
  sanitizePlainText,
  digitsOnly,
  parseMoney,
  moneyEquals,
};
