const router = require('express').Router();
const multer = require('multer');
const { ObjectId } = require('mongodb');
const { getDatabase } = require('../config/database');
const { requireUser, requireAdmin } = require('../service/auth');
const { ApiError, articleInput, objectId, version, fail } = require('../service/validation');
const images = require('../service/images');
const topArticles = require('../service/top-articles');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 6, fields: 10, fieldSize: 512 * 1024, parts: 20 } }).array('images', 6);
const collection = () => getDatabase().collection('articles');
function serialize(article, topPosition = null) {
  return { id: article._id.toString(), name: article.name, quantity: article.quantity, size: article.size,
    price: article.price.toString(), discount: article.discount.toString(), gender: article.gender, category: article.category || (article.gender === 'male' ? 'gents' : 'ladies'), version: article.version,
    images: (article.images || []).map(image => image.type === 'gridfs' ? { type: 'gridfs', fileId: image.fileId.toString(), url: `/api/images/${image.fileId}` } : image),
    createdAt: article.createdAt, updatedAt: article.updatedAt, topPosition,
    isDeleted: Boolean(article.isDeleted), deletedAt: article.deletedAt || null };
}
function input(req) {
  if (req.is('multipart/form-data')) {
    try { return JSON.parse(req.body.article); } catch { fail('The article field must contain valid JSON.'); }
  }
  return req.body;
}
router.use(requireUser, requireAdmin);
router.patch('/:id/top', async (req, res) => {
  const position = req.body?.position;
  if (position !== null && (!Number.isInteger(position) || position < 1)) fail('Top position must be a positive whole number, or null to remove.');
  const ids = await topArticles.setTopPosition(req.params.id, position);
  res.json({ position: ids.indexOf(req.params.id) + 1 || null, total: ids.length });
});
router.get('/summary', async (req, res) => {
  const [summary] = await collection().aggregate([
    {
      $facet: {
        active: [
          { $match: { isDeleted: { $ne: true } } },
          { $group: {
              _id: null,
              articles: { $sum: 1 },
              units: { $sum: '$quantity' },
              lowStock: { $sum: { $cond: [{ $and: [{ $gt: ['$quantity', 0] }, { $lte: ['$quantity', 5] }] }, 1, 0] } },
              outOfStock: { $sum: { $cond: [{ $eq: ['$quantity', 0] }, 1, 0] } }
          } }
        ],
        deleted: [
          { $match: { isDeleted: true } },
          { $count: 'count' }
        ]
      }
    }
  ]).toArray();
  const activeStats = summary?.active[0] || { articles: 0, units: 0, lowStock: 0, outOfStock: 0 };
  const deletedCount = summary?.deleted[0]?.count || 0;
  res.json({
    summary: {
      articles: activeStats.articles,
      units: activeStats.units,
      lowStock: activeStats.lowStock,
      outOfStock: activeStats.outOfStock,
      deleted: deletedCount
    }
  });
});
router.get('/', async (req, res) => {
  const page = Number(req.query.page || 1), limit = Number(req.query.limit || 12);
  if (!Number.isInteger(page) || page < 1 || page > 100000 || !Number.isInteger(limit) || limit < 1 || limit > 100) fail('Invalid pagination.');
  if (req.query.top && req.query.top !== 'only') fail('Invalid top articles filter.');
  const topOnly = req.query.top === 'only';
  const topIds = await topArticles.getTopIds();
  const filter = {};
  if (topOnly) {
    filter.isDeleted = { $ne: true };
    filter._id = { $in: topIds.map(objectId) };
  } else if (req.query.status === 'deleted') {
    filter.isDeleted = true;
  } else if (req.query.status === 'all') {
    // Show all
  } else {
    filter.isDeleted = { $ne: true };
  }
  if (req.query.search !== undefined) {
    if (typeof req.query.search !== 'string' || req.query.search.length > 120) fail('Search is too long.');
    filter.nameKey = { $regex: req.query.search.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') };
  }
  if (req.query.gender) {
    if (!['male', 'female', 'unisex'].includes(req.query.gender)) fail('Invalid gender filter.');
    filter.gender = req.query.gender;
  }
  if (req.query.category) {
    if (!['kids', 'gents', 'ladies', 'accessories'].includes(req.query.category)) fail('Invalid collection filter.');
    filter.category = req.query.category;
  }
  if (req.query.stock) {
    if (!['in', 'low', 'out'].includes(req.query.stock)) fail('Invalid stock filter.');
    filter.quantity = req.query.stock === 'out' ? 0 : req.query.stock === 'low' ? { $gt: 0, $lte: 5 } : { $gt: 0 };
  }
  const itemsQuery = topOnly
    ? collection().aggregate([{ $match: filter }, { $addFields: { rankIndex: { $indexOfArray: [topIds.map(objectId), '$_id'] } } }, { $sort: { rankIndex: 1 } }, { $skip: (page - 1) * limit }, { $limit: limit }])
    : collection().find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit);
  const [items, total] = await Promise.all([itemsQuery.toArray(), collection().countDocuments(filter)]);
  res.json({ articles: items.map(item => serialize(item, topIds.indexOf(item._id.toString()) + 1 || null)), total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});
router.get('/:id', async (req, res) => {
  const filter = { _id: objectId(req.params.id) };
  if (req.query.includeDeleted !== 'true') {
    filter.isDeleted = { $ne: true };
  }
  const article = await collection().findOne(filter);
  if (!article) throw new ApiError(404, 'Article not found.');
  const topIds = await topArticles.getTopIds();
  res.json({ article: serialize(article, topIds.indexOf(article._id.toString()) + 1 || null) });
});
router.post('/:id/restore', async (req, res) => {
  const _id = objectId(req.params.id);
  const previous = await collection().findOne({ _id });
  if (!previous) throw new ApiError(404, 'Article not found.');
  if (!previous.isDeleted) throw new ApiError(400, 'Article is not marked as deleted.');
  const conflict = await collection().findOne({ nameKey: previous.nameKey, isDeleted: { $ne: true } });
  if (conflict) throw new ApiError(409, 'An active article with this name already exists. Please rename it before restoring.');
  const updated = await collection().findOneAndUpdate(
    { _id },
    { $set: { isDeleted: false, deletedAt: null }, $inc: { version: 1 } },
    { returnDocument: 'after' }
  );
  res.json({ article: serialize(updated) });
});
router.post('/', upload, async (req, res) => {
  const body = input(req), fields = articleInput(body), _id = new ObjectId();
  const retained = images.retainedImages(body.images, []);
  if (retained.length + (req.files?.length || 0) > 6) fail('Use at most 6 images per article.');
  const saved = await images.saveImages(req.files || [], _id);
  const article = { _id, ...fields, images: [...retained, ...saved], version: 1, isDeleted: false, createdAt: new Date(), updatedAt: new Date(), createdBy: req.user._id };
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
  const previous = await collection().findOne({ _id });
  if (!previous) throw new ApiError(404, 'Article not found.');
  if (previous.version !== expectedVersion) throw new ApiError(409, 'This article changed elsewhere. Refresh before deleting.');
  if (previous.isDeleted) return res.status(204).end();
  
  await collection().updateOne(
    { _id, version: expectedVersion },
    { $set: { isDeleted: true, deletedAt: new Date() }, $inc: { version: 1 } }
  );
  await getDatabase().collection('storefront').updateOne({ 'slides.articleId': _id.toString() }, { $set: { 'slides.$[slide].articleId': '' }, $inc: { version: 1 } }, { arrayFilters: [{ 'slide.articleId': _id.toString() }] });
  await getDatabase().collection('storefront').updateOne({ featuredArticleIds: _id.toString() }, { $pull: { featuredArticleIds: _id.toString() }, $inc: { version: 1 } });
  await topArticles.removeTopArticle(_id.toString());
  res.status(204).end();
});
module.exports = router;
module.exports.serialize = serialize;
