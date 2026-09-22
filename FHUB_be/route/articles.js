const router = require('express').Router();
const multer = require('multer');
const { ObjectId } = require('mongodb');
const { getDatabase } = require('../config/database');
const { requireUser, requireAdmin } = require('../service/auth');
const { ApiError, articleInput, objectId, version, fail } = require('../service/validation');
const images = require('../service/images');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 6, fields: 10, fieldSize: 512 * 1024, parts: 20 } }).array('images', 6);
const collection = () => getDatabase().collection('articles');
function serialize(article) {
  return { id: article._id.toString(), name: article.name, quantity: article.quantity, size: article.size,
    price: article.price.toString(), discount: article.discount.toString(), gender: article.gender, category: article.category || (article.gender === 'male' ? 'gents' : 'ladies'), version: article.version,
    images: (article.images || []).map(image => image.type === 'gridfs' ? { type: 'gridfs', fileId: image.fileId.toString(), url: `/api/images/${image.fileId}` } : image),
    createdAt: article.createdAt, updatedAt: article.updatedAt };
}
function input(req) {
  if (req.is('multipart/form-data')) {
    try { return JSON.parse(req.body.article); } catch { fail('The article field must contain valid JSON.'); }
  }
  return req.body;
}
router.use(requireUser, requireAdmin);
router.get('/summary', async (req, res) => {
  const [summary] = await collection().aggregate([{ $group: { _id: null, articles: { $sum: 1 }, units: { $sum: '$quantity' },
    lowStock: { $sum: { $cond: [{ $and: [{ $gt: ['$quantity', 0] }, { $lte: ['$quantity', 5] }] }, 1, 0] } },
    outOfStock: { $sum: { $cond: [{ $eq: ['$quantity', 0] }, 1, 0] } } } }]).toArray();
  res.json({ summary: summary ? { articles: summary.articles, units: summary.units, lowStock: summary.lowStock, outOfStock: summary.outOfStock } : { articles: 0, units: 0, lowStock: 0, outOfStock: 0 } });
});
router.get('/', async (req, res) => {
  const page = Number(req.query.page || 1), limit = Number(req.query.limit || 12);
  if (!Number.isInteger(page) || page < 1 || page > 100000 || !Number.isInteger(limit) || limit < 1 || limit > 100) fail('Invalid pagination.');
  const filter = {};
  if (req.query.search !== undefined) {
    if (typeof req.query.search !== 'string' || req.query.search.length > 120) fail('Search is too long.');
    filter.nameKey = { $regex: req.query.search.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') };
  }
  if (req.query.gender) {
    if (!['male', 'female'].includes(req.query.gender)) fail('Invalid gender filter.');
    filter.gender = req.query.gender;
  }
  if (req.query.category) {
    if (!['kids', 'gents', 'ladies'].includes(req.query.category)) fail('Invalid collection filter.');
    filter.category = req.query.category;
  }
  if (req.query.stock) {
    if (!['in', 'low', 'out'].includes(req.query.stock)) fail('Invalid stock filter.');
    filter.quantity = req.query.stock === 'out' ? 0 : req.query.stock === 'low' ? { $gt: 0, $lte: 5 } : { $gt: 0 };
  }
  const [items, total] = await Promise.all([collection().find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).toArray(), collection().countDocuments(filter)]);
  res.json({ articles: items.map(serialize), total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});
router.get('/:id', async (req, res) => {
  const article = await collection().findOne({ _id: objectId(req.params.id) });
  if (!article) throw new ApiError(404, 'Article not found.');
  res.json({ article: serialize(article) });
});
router.post('/', upload, async (req, res) => {
  const body = input(req), fields = articleInput(body), _id = new ObjectId();
  const retained = images.retainedImages(body.images, []);
  if (retained.length + (req.files?.length || 0) > 6) fail('Use at most 6 images per article.');
  const saved = await images.saveImages(req.files || [], _id);
  const article = { _id, ...fields, images: [...retained, ...saved], version: 1, createdAt: new Date(), updatedAt: new Date(), createdBy: req.user._id };
  try { await collection().insertOne(article); }
  catch (error) { await images.removeImages(saved); throw error; }
  res.status(201).json({ article: serialize(article) });
});
router.patch('/:id', upload, async (req, res) => {
  const _id = objectId(req.params.id), body = input(req), fields = articleInput(body), expectedVersion = version(body.version);
  const previous = await collection().findOne({ _id });
  if (!previous) throw new ApiError(404, 'Article not found.');
  if (previous.version !== expectedVersion) throw new ApiError(409, 'This article changed elsewhere. Close the editor, refresh and try again.');
  const retained = images.retainedImages(body.images, previous.images);
  if (retained.length + (req.files?.length || 0) > 6) fail('Use at most 6 images per article.');
  const saved = await images.saveImages(req.files || [], _id);
  let updated;
  try {
    updated = await collection().findOneAndUpdate({ _id, version: expectedVersion }, { $set: { ...fields, images: [...retained, ...saved], updatedAt: new Date() }, $inc: { version: 1 } }, { returnDocument: 'after' });
    if (!updated) throw new ApiError(409, 'This article changed elsewhere. Refresh and try again.');
  } catch (error) { await images.removeImages(saved); throw error; }
  await images.removeImages(previous.images.filter(i => i.type === 'gridfs' && !retained.some(r => r.type === 'gridfs' && (r.fileId?.toString() === i.fileId?.toString()))));
  res.json({ article: serialize(updated) });
});
router.delete('/:id', async (req, res) => {
  const _id = objectId(req.params.id), expectedVersion = version(req.body?.version);
  const deleted = await collection().findOneAndDelete({ _id, version: expectedVersion });
  if (!deleted) {
    if (!await collection().findOne({ _id })) throw new ApiError(404, 'Article not found.');
    throw new ApiError(409, 'This article changed elsewhere. Refresh before deleting.');
  }
  await getDatabase().collection('storefront').updateOne({ 'slides.articleId': _id.toString() }, { $set: { 'slides.$[slide].articleId': '' }, $inc: { version: 1 } }, { arrayFilters: [{ 'slide.articleId': _id.toString() }] });
  await images.removeImages(deleted.images);
  res.status(204).end();
});
module.exports = router;
module.exports.serialize = serialize;
