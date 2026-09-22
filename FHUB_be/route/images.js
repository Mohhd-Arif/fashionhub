const router = require('express').Router();
const { getDatabase } = require('../config/database');
const { objectId, ApiError } = require('../service/validation');
const { bucket } = require('../service/images');

router.get('/:id', async (req, res, next) => {
  const _id = objectId(req.params.id);
  const article = await getDatabase().collection('articles').findOne({ 'images.fileId': { $in: [_id, req.params.id] } }, { projection: { _id: 1 } });
  const storefront = article ? null : await getDatabase().collection('storefront').findOne({ $or: [{ 'slides.image.fileId': { $in: [_id, req.params.id] } }, { 'storyImage.fileId': { $in: [_id, req.params.id] } }] }, { projection: { _id: 1 } });
  if (!article && !storefront) throw new ApiError(404, 'Image not found.');
  const file = await getDatabase().collection('articleImages.files').findOne({ _id });
  if (!file) throw new ApiError(404, 'Image not found.');
  res.set({
    'Content-Type': 'image/webp',
    'Content-Length': String(file.length),
    'Cache-Control': 'public, max-age=86400',
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'Access-Control-Allow-Origin': '*'
  });
  const stream = bucket().openDownloadStream(_id);
  stream.on('error', error => res.headersSent ? res.destroy() : next(error));
  res.on('close', () => stream.destroy());
  stream.pipe(res);
});
module.exports = router;
