const router = require('express').Router();
const { getDatabase } = require('../config/database');
const { getStorefront, present } = require('../service/storefront');
const { serialize } = require('./articles');
const { ApiError, objectId, fail } = require('../service/validation');

router.get('/storefront', async (req, res) => {
  const storefront = present(await getStorefront());
  const selectedIds = [...new Set(storefront.featuredArticleIds || [])].slice(0, 6);
  let featured = [];
  if (selectedIds.length) {
    const ids = selectedIds.map(id => objectId(id));
    const items = await getDatabase().collection('articles').find({ _id: { $in: ids }, isDeleted: { $ne: true } }).toArray();
    featured = selectedIds.map(id => items.find(item => item._id.toString() === id)).filter(Boolean);
  }
  if (featured.length < 6) {
    const used = new Set(featured.map(item => item._id.toString()));
    const more = await getDatabase().collection('articles').find({
      ...(used.size ? { _id: { $nin: [...used].map(objectId) } } : {}),
      isDeleted: { $ne: true }
    }).sort({ createdAt: -1, _id: -1 }).limit(6 - featured.length).toArray();
    featured.push(...more);
  }
  res.json({ storefront, featured: featured.map(serialize) });
});
router.get('/articles', async (req, res) => {
  const filter = { isDeleted: { $ne: true } };
  if (req.query.category) {
    if (!['kids', 'gents', 'ladies'].includes(req.query.category)) fail('Invalid collection.');
    filter.category = req.query.category;
  }
  if (req.query.search) {
    if (typeof req.query.search !== 'string' || req.query.search.length > 120) fail('Search must be under 120 characters.');
    filter.nameKey = { $regex: req.query.search.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') };
  }
  const page = Number(req.query.page || 1), limit = 12;
  if (!Number.isInteger(page) || page < 1 || page > 100000) fail('Invalid page.');
  const sorts = { newest: { createdAt: -1, _id: -1 }, low: { price: 1, _id: -1 }, high: { price: -1, _id: -1 } };
  if (req.query.sort && !Object.hasOwn(sorts, req.query.sort)) fail('Invalid sorting option.');
  const [items, total] = await Promise.all([getDatabase().collection('articles').find(filter).sort(sorts[req.query.sort || 'newest']).skip((page - 1) * limit).limit(limit).toArray(), getDatabase().collection('articles').countDocuments(filter)]);
  res.json({ articles: items.map(serialize), total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});
router.get('/articles/:id', async (req, res) => {
  const item = await getDatabase().collection('articles').findOne({ _id: objectId(req.params.id), isDeleted: { $ne: true } });
  if (!item) throw new ApiError(404, 'Article not found.');
  res.json({ article: serialize(item) });
});
module.exports = router;
