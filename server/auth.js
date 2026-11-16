import crypto from 'node:crypto';

export const COOKIE_NAME = 'sid';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const SCRYPT_KEYLEN = 64;
const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{3,32}$/;
const PASSWORD_MIN = 6;
const PASSWORD_MAX = 72;

export class AuthError extends Error {
  constructor(message, status = 401, code = 'AUTH_REQUIRED') {
    super(message);
    this.name = 'AuthError';
    this.status = status;
    this.code = code;
  }
}

export function validateUsername(value) {
  const username = String(value ?? '').trim();
  if (!USERNAME_PATTERN.test(username)) {
    throw new AuthError('用户名需为 3–32 位字母、数字、下划线、点或短横线', 400, 'INVALID_USERNAME');
  }
  return username;
}

export function validatePassword(value) {
  const password = String(value ?? '');
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    throw new AuthError(`密码长度需为 ${PASSWORD_MIN}–${PASSWORD_MAX} 位`, 400, 'INVALID_PASSWORD');
  }
  return password;
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export function verifyPassword(password, stored) {
  const [scheme, saltPart, hashPart] = String(stored ?? '').split('$');
  if (scheme !== 'scrypt' || !saltPart || !hashPart) return false;
  const expected = Buffer.from(hashPart, 'base64url');
  const actual = crypto.scryptSync(password, Buffer.from(saltPart, 'base64url'), expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function publicUser(row) {
  return { id: Number(row.id), username: row.username, createdAt: row.created_at };
}

export function findUserByName(db, username) {
  return db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username) ?? null;
}

export function registerUser(db, username, password) {
  const name = validateUsername(username);
  const secret = validatePassword(password);
  if (findUserByName(db, name)) {
    throw new AuthError('该用户名已被注册', 409, 'USERNAME_TAKEN');
  }
  const now = new Date().toISOString();
  const info = db
    .prepare('INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)')
    .run(name, hashPassword(secret), now);
  return publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(Number(info.lastInsertRowid)));
}

export function authenticateUser(db, username, password) {
  const row = findUserByName(db, String(username ?? '').trim());
  // Run the hash comparison even when the user is missing to keep timing flat.
  const stored = row?.password_hash ?? 'scrypt$AAAA$AAAA';
  const ok = verifyPassword(String(password ?? ''), stored);
  if (!row || !ok) {
    throw new AuthError('用户名或密码不正确', 401, 'INVALID_CREDENTIALS');
  }
  return publicUser(row);
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createSession(db, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .run(tokenHash(token), userId, new Date(now).toISOString(), new Date(now + SESSION_TTL_MS).toISOString());
  return token;
}

export function readSession(db, token) {
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT s.token_hash, s.expires_at, u.id, u.username, u.created_at
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ?`,
    )
    .get(tokenHash(token));
  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(row.token_hash);
    return null;
  }
  return { id: Number(row.id), username: row.username, createdAt: row.created_at };
}

export function destroySession(db, token) {
  if (!token) return;
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash(token));
}

export function parseCookies(header) {
  const jar = new Map();
  for (const part of String(header ?? '').split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    if (!key) continue;
    const value = part.slice(index + 1).trim();
    try {
      jar.set(key, decodeURIComponent(value));
    } catch {
      jar.set(key, value);
    }
  }
  return jar;
}

function cookieAttributes() {
  const attributes = ['Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (process.env.COOKIE_SECURE === '1') attributes.push('Secure');
  return attributes;
}

export function sessionCookie(token) {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  return [`${COOKIE_NAME}=${encodeURIComponent(token)}`, ...cookieAttributes(), `Max-Age=${maxAge}`].join('; ');
}

export function clearedCookie() {
  return [`${COOKIE_NAME}=`, ...cookieAttributes(), 'Max-Age=0'].join('; ');
}

export function attachUser(db) {
  return (req, res, next) => {
    const token = parseCookies(req.headers.cookie).get(COOKIE_NAME);
    req.sessionToken = token ?? null;
    req.user = token ? readSession(db, token) : null;
    next();
  };
}

export function requireUser(req, res, next) {
  if (req.user) {
    next();
    return;
  }
  next(new AuthError('请先登录后再操作', 401, 'AUTH_REQUIRED'));
}
