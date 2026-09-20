const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
// Every test run uses an isolated database, never the configured store database.
const testDatabase = `fhub_test_${randomBytes(8).toString('hex')}`;
process.env.MONGODB_DB = testDatabase;
const request = require('supertest');
const sharp = require('sharp');
const app = require('../index');
const { connectDatabase, closeDatabase } = require('../config/database');
const { ensureIndexes } = require('../config/indexes');
const { hashPassword } = require('../service/auth');
let db, admin;
const article = { name: 'Everyday shirt', quantity: 4, size: 'extra small', price: '1299.95', discount: '12.50', gender: 'female', images: [] };
const write = req => req.set('X-Requested-With', 'FashionHub');

before(async () => {
  db = await connectDatabase();
  assert.equal(db.databaseName, testDatabase);
  await ensureIndexes(db);
  await db.collection('users').insertOne({ email: 'admin@example.test', passwordHash: await hashPassword('Test-password-123!'), usertype: 'admin', createdAt: new Date() });
  admin = request.agent(app);
});
after(async () => {
  try {
    if (db && db.databaseName === testDatabase && /^fhub_test_[a-f\d]{16}$/.test(testDatabase)) {
      for (const name of ['users', 'sessions', 'articles', 'articleImages.files', 'articleImages.chunks', 'imageCleanup', 'storefront']) await db.collection(name).deleteMany({});
    }
  }
  finally { await closeDatabase(); }
});

test('authentication, role boundaries and session revocation', async () => {
  await request(app).get('/api/admin/articles').expect(401);
  await request(app).post('/api/auth/login').send({}).expect(403);
  await write(request(app).post('/api/auth/login')).set('Origin', 'https://untrusted.example').send({}).expect(403);
  const login = await write(admin.post('/api/auth/login')).send({ email: 'ADMIN@example.test', password: 'Test-password-123!' }).expect(200);
  assert.equal(login.body.user.usertype, 'admin');
  assert.equal(login.body.user.passwordHash, undefined);
  assert.match(login.headers['set-cookie'][0], /HttpOnly/);
  assert.match(login.headers['set-cookie'][0], /SameSite=Strict/);
  assert.equal((await admin.get('/api/auth/me').expect(200)).body.user.email, 'admin@example.test');
  await write(request(app).post('/api/auth/register')).send({ email: 'evil@example.test', password: 'Test-password-123!', usertype: 'admin' }).expect(403);
  const user = request.agent(app);
  await write(user.post('/api/auth/register')).send({ email: 'USER@example.test', password: 'Test-password-123!' }).expect(201);
  await user.get('/api/admin/articles').expect(403);
  await write(user.post('/api/admin/articles')).send(article).expect(403);
  const stored = await db.collection('users').findOne({ email: 'user@example.test' });
  assert.notEqual(stored.passwordHash, 'Test-password-123!');
  assert.equal(stored.password, undefined);
  assert.equal(stored.usertype, 'user');
  await write(request(app).post('/api/auth/register')).send({ email: 'user@example.test', password: 'Test-password-123!' }).expect(409);
  await write(request(app).post('/api/auth/login')).send({ email: 'admin@example.test', password: 'wrong' }).expect(401);
  await write(request(app).post('/api/auth/login')).send({ email: { $ne: null }, password: 'wrong' }).expect(400);
  const cookie = login.headers['set-cookie'][0].split(';')[0];
  await write(admin.post('/api/auth/logout')).expect(204);
  await request(app).get('/api/auth/me').set('Cookie', cookie).expect(401);
  await write(admin.post('/api/auth/login')).send({ email: 'admin@example.test', password: 'Test-password-123!' }).expect(200);
  await write(user.post('/api/auth/logout')).expect(204);
});

test('article validation, unique names, Decimal128, filters and optimistic updates', async () => {
  for (const invalid of [{ quantity: -1 }, { quantity: 1.5 }, { size: '' }, { discount: 101 }, { discount: 'male' }, { price: '2.001' }, { gender: 'other' }, { name: ' ' }]) {
    await write(admin.post('/api/admin/articles')).send({ ...article, ...invalid }).expect(400);
  }
  const created = (await write(admin.post('/api/admin/articles')).send(article).expect(201)).body.article;
  assert.equal(created.size, 'XS');
  assert.equal(created.price, '1299.95');
  assert.equal(created.discount, '12.50');
  assert.equal(created.version, 1);
  const stored = await db.collection('articles').findOne({ nameKey: 'everyday shirt' });
  assert.equal((await request(app).get('/api/articles?category=ladies').expect(200)).body.total, 1);
  assert.equal(stored.price._bsontype, 'Decimal128');
  await write(admin.post('/api/admin/articles')).send({ ...article, name: ' EVERYDAY   SHIRT ' }).expect(409);
  assert.equal((await admin.get('/api/admin/articles?search=shirt&gender=female&stock=low').expect(200)).body.total, 1);
  assert.equal((await admin.get('/api/admin/articles?search=.*').expect(200)).body.total, 0);
  await admin.get('/api/admin/articles?page=-1').expect(400);
  await admin.get('/api/admin/articles/bad-id').expect(400);
  const updated = (await write(admin.patch(`/api/admin/articles/${created.id}`)).send({ ...article, name: 'Updated shirt', size: '38 / custom', quantity: 0, version: 1 }).expect(200)).body.article;
  assert.equal(updated.size, '38 / custom');
  assert.equal(updated.version, 2);
  await write(admin.patch(`/api/admin/articles/${created.id}`)).send({ ...article, version: 1 }).expect(409);
  await write(admin.delete(`/api/admin/articles/${created.id}`)).send({ version: 1 }).expect(409);
  const summary = (await admin.get('/api/admin/articles/summary').expect(200)).body.summary;
  assert.equal(summary.outOfStock, 1);
  await write(admin.delete(`/api/admin/articles/${created.id}`)).send({ version: 2 }).expect(204);
  await admin.get(`/api/admin/articles/${created.id}`).expect(404);
});

test('admin-only storefront edits, featured articles, image uploads and live public content', async () => {
  await request(app).get('/api/admin/storefront').expect(401);
  const original = (await request(app).get('/api/storefront').expect(200)).body.storefront;
  assert.equal(original.slides.length, 3);
  const png = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#aabbcc' } }).png().toBuffer();
  const kid = (await write(admin.post('/api/admin/articles')).send({ ...article, name: 'Kids featured tee', category: 'kids' }).expect(201)).body.article;
  const body = { ...original, announcement: 'Our new kids collection is here', slides: original.slides.map(s => s.id === 'kids' ? { ...s, articleId: kid.id } : s) };
  const updated = (await write(admin.patch('/api/admin/storefront')).field('storefront', JSON.stringify(body)).attach('kids', png, 'kids.png').expect(200)).body.storefront;
  assert.equal(updated.version, 2);
  assert.equal(updated.slides[0].image.type, 'gridfs');
  await request(app).get(updated.slides[0].image.url).expect(200);
  const live = (await request(app).get('/api/storefront').expect(200)).body;
  assert.equal(live.storefront.announcement, body.announcement);
  assert.equal(live.featured[0].id, kid.id);
  await write(admin.patch('/api/admin/storefront')).send(body).expect(409);
  await write(admin.patch('/api/admin/storefront')).send({ ...updated, phone: 'javascript:alert(1)' }).expect(400);
  await write(admin.delete(`/api/admin/articles/${kid.id}`)).send({ version: 1 }).expect(204);
  const cleared = (await request(app).get('/api/storefront').expect(200)).body;
  assert.equal(cleared.storefront.slides[0].articleId, '');
  assert.equal(cleared.storefront.version, 3);
  const replaced = { ...cleared.storefront, slides: cleared.storefront.slides.map(s => s.id === 'kids' ? { ...s, image: { type: 'url', url: 'https://example.com/kids.jpg' } } : s) };
  await write(admin.patch('/api/admin/storefront')).send(replaced).expect(200);
  await request(app).get(updated.slides[0].image.url).expect(404);
});

test('real image upload, streaming, replacement, failed upload rollback and cleanup', async () => {
  const png = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#aabbcc' } }).png().toBuffer();
  await write(admin.post('/api/admin/articles')).field('article', JSON.stringify({ ...article, name: 'Invalid file' })).attach('images', Buffer.from('<svg></svg>'), 'fake.png').expect(400);
  await write(admin.post('/api/admin/articles')).field('article', JSON.stringify({ ...article, name: 'Rollback files' })).attach('images', png, 'valid.png').attach('images', Buffer.from('not an image'), 'invalid.png').expect(400);
  assert.equal(await db.collection('articleImages.files').countDocuments(), 0);
  assert.equal(await db.collection('articleImages.chunks').countDocuments(), 0);
  await write(admin.post('/api/admin/articles')).send({ ...article, images: ['javascript:alert(1)'] }).expect(400);
  const created = (await write(admin.post('/api/admin/articles')).field('article', JSON.stringify(article)).attach('images', png, 'shirt.png').expect(201)).body.article;
  assert.equal(created.images[0].type, 'gridfs');
  const imageResponse = await request(app).get(created.images[0].url).expect(200);
  assert.match(imageResponse.headers['content-type'], /image\/webp/);
  const metadata = await sharp(imageResponse.body).metadata();
  assert.equal(metadata.format, 'webp');
  await write(admin.post('/api/admin/articles')).send({ ...article, name: 'Cannot steal image', images: created.images }).expect(400);
  await write(admin.post('/api/admin/articles')).field('article', JSON.stringify(article)).attach('images', png, 'duplicate.png').expect(409);
  assert.equal(await db.collection('articleImages.files').countDocuments(), 1);
  const edited = (await write(admin.patch(`/api/admin/articles/${created.id}`)).send({ ...article, version: 1, images: ['https://example.com/image.webp'] }).expect(200)).body.article;
  assert.equal(edited.images[0].type, 'url');
  await request(app).get(created.images[0].url).expect(404);
  assert.equal(await db.collection('articleImages.files').countDocuments(), 0);
  const withImage = (await write(admin.patch(`/api/admin/articles/${created.id}`)).field('article', JSON.stringify({ ...article, version: 2, images: [] })).attach('images', png, 'new.png').expect(200)).body.article;
  await write(admin.delete(`/api/admin/articles/${created.id}`)).send({ version: 3 }).expect(204);
  await request(app).get(withImage.images[0].url).expect(404);
  assert.equal(await db.collection('articleImages.files').countDocuments(), 0);
  assert.equal(await db.collection('articleImages.chunks').countDocuments(), 0);
});
