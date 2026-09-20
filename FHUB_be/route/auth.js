const router = require('express').Router();
const { rateLimit } = require('express-rate-limit');
const { getDatabase } = require('../config/database');
const validate = require('../service/validation');
const auth = require('../service/auth');
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Please try again in 15 minutes.' } });

router.post('/register', limiter, async (req, res) => {
  const email = validate.email(req.body?.email);
  const password = validate.password(req.body?.password);
  if (req.body.usertype !== undefined && req.body.usertype !== 'user') throw new validate.ApiError(403, 'Admin accounts cannot be created through registration.');
  const user = { email, passwordHash: await auth.hashPassword(password), usertype: 'user', createdAt: new Date() };
  const result = await getDatabase().collection('users').insertOne(user);
  user._id = result.insertedId;
  await auth.createSession(req, res, user);
  res.status(201).json({ user: auth.publicUser(user) });
});
router.post('/login', limiter, async (req, res) => {
  const email = validate.email(req.body?.email);
  if (typeof req.body?.password !== 'string' || Buffer.byteLength(req.body.password) > 256) throw new validate.ApiError(400, 'Enter a valid password.');
  const user = await getDatabase().collection('users').findOne({ email });
  if (!await auth.verifyPassword(req.body.password, user?.passwordHash)) throw new validate.ApiError(401, 'Email or password is incorrect.');
  await auth.createSession(req, res, user);
  res.json({ user: auth.publicUser(user) });
});
router.get('/me', auth.requireUser, (req, res) => res.json({ user: auth.publicUser(req.user) }));
router.post('/logout', async (req, res) => { await auth.logout(req, res); res.status(204).end(); });
module.exports = router;
