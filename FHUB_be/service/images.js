const { GridFSBucket, ObjectId } = require('mongodb');
const { randomUUID } = require('node:crypto');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const sharp = require('sharp');
const { getDatabase } = require('../config/database');
const { ApiError, imageUrl, fail } = require('./validation');
const imagekit = require('./imagekit');

const bucket = () => new GridFSBucket(getDatabase(), { bucketName: 'articleImages' });

function sameImage(a, b) {
  if (!a || !b || a.type !== b.type) return false;
  if (a.type === 'gridfs') return a.fileId?.toString() === b.fileId?.toString();
  return a.url === b.url;
}

function retainedImages(input, previous = []) {
  if (input === undefined) return previous;
  if (!Array.isArray(input) || input.length > 6) fail('Use at most 6 images per article.');
  return input.map(image => {
    if (typeof image === 'string' || image?.type === 'url') {
      const url = imageUrl(typeof image === 'string' ? image : image.url);
      return previous.find(item => item.type === 'url' && item.url === url) || { type: 'url', url };
    }
    if (image?.type === 'gridfs' && typeof image.fileId === 'string') {
      const existing = previous.find(item => item.type === 'gridfs' && item.fileId.toString() === image.fileId);
      if (existing) return existing;
    }
    fail('Only existing images from this article or HTTPS image URLs are allowed.');
  });
}

async function prepareImage(file) {
  try {
    const processor = sharp(file.buffer, { limitInputPixels: 25000000, failOn: 'warning' });
    const metadata = await processor.metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format)) throw new Error('Unsupported image');
    return await processor.rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
  } catch { throw new ApiError(400, 'Images must be valid JPEG, PNG or WebP files (up to 25 megapixels).'); }
}

async function saveImages(files, ownerId, scope = 'articles') {
  if (!['articles', 'storefront'].includes(scope)) throw new Error('Invalid image scope.');
  const saved = [];
  try {
    for (const file of files) {
      const data = await prepareImage(file);
      saved.push(await imagekit.uploadImage(data, {
        fileName: `${ownerId}-${randomUUID()}.webp`, folder: `/fashionhub/${scope}`
      }));
    }
    return saved;
  } catch (error) {
    await removeImages(saved);
    throw error;
  }
}

// Read compatibility and isolated test fixtures only. New admin uploads use saveImages above.
async function saveLegacyImages(files, ownerId) {
  const saved = [];
  try {
    for (const file of files) {
      const data = await prepareImage(file);
      const upload = bucket().openUploadStream(`${ownerId}-${new ObjectId()}.webp`, { metadata: { contentType: 'image/webp', articleId: ownerId } });
      try { await pipeline(Readable.from(data), upload); }
      catch (error) { await upload.abort().catch(() => {}); throw error; }
      saved.push({ type: 'gridfs', fileId: upload.id, contentType: 'image/webp' });
    }
    return saved;
  } catch (error) { await removeImages(saved); throw error; }
}

async function isReferenced(url) {
  if (!url) return false;
  const db = getDatabase();
  const [article, storefront] = await Promise.all([
    db.collection('articles').findOne({ 'images.url': url }, { projection: { _id: 1 } }),
    db.collection('storefront').findOne({ $or: [{ 'slides.image.url': url }, { 'storyImage.url': url }] }, { projection: { _id: 1 } })
  ]);
  return Boolean(article || storefront);
}

async function removeImages(images) {
  for (const image of images.filter(Boolean)) {
    if (image.type === 'gridfs') {
      try { await bucket().delete(new ObjectId(image.fileId)); }
      catch {
        await getDatabase().collection('imageCleanup').updateOne({ _id: new ObjectId(image.fileId) }, { $set: { queuedAt: new Date() } }, { upsert: true });
      }
    } else if (image.type === 'url' && image.imagekitFileId) {
      if (await isReferenced(image.url)) continue;
      try { await imagekit.deleteImage(image.imagekitFileId); }
      catch {
        await getDatabase().collection('imageCleanup').updateOne(
          { _id: `imagekit:${image.imagekitFileId}` },
          { $set: { provider: 'imagekit', fileId: image.imagekitFileId, url: image.url, queuedAt: new Date() } },
          { upsert: true }
        );
      }
    }
  }
}

async function retryImageCleanup() {
  const db = getDatabase();
  for await (const item of db.collection('imageCleanup').find().limit(100)) {
    if (item.provider === 'imagekit') {
      if (!await isReferenced(item.url)) await imagekit.deleteImage(item.fileId);
    } else {
      const exists = await db.collection('articleImages.files').findOne({ _id: item._id });
      if (exists) await bucket().delete(item._id);
      else await db.collection('articleImages.chunks').deleteMany({ files_id: item._id });
    }
    await db.collection('imageCleanup').deleteOne({ _id: item._id });
  }
}

module.exports = { bucket, sameImage, retainedImages, saveImages, saveLegacyImages, removeImages, retryImageCleanup };
