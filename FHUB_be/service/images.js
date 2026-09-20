const { GridFSBucket, ObjectId } = require('mongodb');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const sharp = require('sharp');
const { getDatabase } = require('../config/database');
const { ApiError, imageUrl, fail } = require('./validation');
const bucket = () => new GridFSBucket(getDatabase(), { bucketName: 'articleImages' });

function retainedImages(input, previous = []) {
  if (input === undefined) return previous;
  if (!Array.isArray(input) || input.length > 6) fail('Use at most 6 images per article.');
  return input.map(image => {
    if (typeof image === 'string') return { type: 'url', url: imageUrl(image) };
    if (image?.type === 'url') return { type: 'url', url: imageUrl(image.url) };
    if (image?.type === 'gridfs' && typeof image.fileId === 'string') {
      const existing = previous.find(p => p.type === 'gridfs' && p.fileId.toString() === image.fileId);
      if (existing) return existing;
    }
    fail('Only existing images from this article or HTTPS image URLs are allowed.');
  });
}
async function saveImages(files, articleId) {
  const saved = [];
  try {
    for (const file of files) {
      let data;
      try {
        const processor = sharp(file.buffer, { limitInputPixels: 25000000, failOn: 'warning' });
        const metadata = await processor.metadata();
        if (!['jpeg', 'png', 'webp'].includes(metadata.format)) throw new Error('Unsupported image');
        data = await processor.rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
      } catch { throw new ApiError(400, 'Images must be valid JPEG, PNG or WebP files (up to 25 megapixels).'); }
      const upload = bucket().openUploadStream(`${articleId}-${new ObjectId()}.webp`, { metadata: { contentType: 'image/webp', articleId } });
      try { await pipeline(Readable.from(data), upload); }
      catch (error) { await upload.abort().catch(() => {}); throw error; }
      saved.push({ type: 'gridfs', fileId: upload.id, contentType: 'image/webp' });
    }
    return saved;
  } catch (error) { await removeImages(saved); throw error; }
}
async function removeImages(images) {
  for (const image of images.filter(i => i.type === 'gridfs')) {
    try { await bucket().delete(new ObjectId(image.fileId)); }
    catch {
      // Durable retry on the next cleanup cycle; never hide an already-committed article update.
      await getDatabase().collection('imageCleanup').updateOne({ _id: new ObjectId(image.fileId) }, { $set: { queuedAt: new Date() } }, { upsert: true });
    }
  }
}
async function retryImageCleanup() {
  for await (const item of getDatabase().collection('imageCleanup').find().limit(100)) {
    const exists = await getDatabase().collection('articleImages.files').findOne({ _id: item._id });
    if (exists) await bucket().delete(item._id);
    else await getDatabase().collection('articleImages.chunks').deleteMany({ files_id: item._id });
    await getDatabase().collection('imageCleanup').deleteOne({ _id: item._id });
  }
}
module.exports = { bucket, retainedImages, saveImages, removeImages, retryImageCleanup };
