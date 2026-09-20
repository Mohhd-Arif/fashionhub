const { randomBytes, scrypt, timingSafeEqual, createHash } = require('node:crypto');
const { promisify } = require('node:util');
const { getDatabase } = require('../config/database');
const { ApiError } = require('./validation');
const derive = promisify(scrypt);
const COOKIE = 'fhub_session';
const duration = 8 * 60 * 60 * 1000;
const hashToken = token => createHash('sha256').update(token).digest('hex');
const cookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/' });

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await derive(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt:${salt}:${hash.toString('hex')}`;
}
async function verifyPassword(password, stored) {
  const [, salt, hash] = (stored || '').split(':');
  const expected = hash && /^[a-f\d]{128}$/.test(hash) ? Buffer.from(hash, 'hex') : Buffer.alloc(64);
  const actual = await derive(password, salt || 'missing-user-fixed-salt', 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return timingSafeEqual(actual, expected) && Boolean(hash);
}
function tokenFrom(req) {
  const match = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(`${COOKIE}=`));
  const token = match?.slice(COOKIE.length + 1);
  return token && /^[a-f\d]{64}$/.test(token) ? token : null;
}
function publicUser(user) { return { id: user._id.toString(), email: user.email, usertype: user.usertype }; }
async function createSession(req, res, user) {
  const old = tokenFrom(req);
  if (old) await getDatabase().collection('sessions').deleteOne({ tokenHash: hashToken(old) });
  const token = randomBytes(32).toString('hex');
  await getDatabase().collection('sessions').insertOne({ tokenHash: hashToken(token), userId: user._id, expiresAt: new Date(Date.now() + duration) });
  res.cookie(COOKIE, token, { ...cookieOptions(), maxAge: duration });
}
async function logout(req, res) {
  const token = tokenFrom(req);
  if (token) await getDatabase().collection('sessions').deleteOne({ tokenHash: hashToken(token) });
  res.clearCookie(COOKIE, cookieOptions());
}
async function requireUser(req, res, next) {
  const token = tokenFrom(req);
  if (!token) throw new ApiError(401, 'Please sign in to continue.');
  const session = await getDatabase().collection('sessions').findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } });
  if (!session) throw new ApiError(401, 'Your session has expired. Please sign in again.');
  const user = await getDatabase().collection('users').findOne({ _id: session.userId }, { projection: { passwordHash: 0 } });
  if (!user) throw new ApiError(401, 'Please sign in again.');
  req.user = user;
  next();
}
function requireAdmin(req, res, next) {
  if (req.user?.usertype !== 'admin') throw new ApiError(403, 'Administrator access is required.');
  next();
}
function protectWrites(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  // Custom headers cannot be sent by cross-origin forms; no cross-origin CORS is enabled.
  if (req.get('X-Requested-With') !== 'FashionHub') throw new ApiError(403, 'Missing request protection header.');
  const allowed = (process.env.APP_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:8000,http://127.0.0.1:8000').split(',').map(s => s.trim());
  if (req.get('Origin') && !allowed.includes(req.get('Origin'))) throw new ApiError(403, 'This request origin is not allowed.');
  next();
}
module.exports = { hashPassword, verifyPassword, publicUser, createSession, logout, requireUser, requireAdmin, protectWrites };
