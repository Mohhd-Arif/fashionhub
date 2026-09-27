const { ObjectId } = require('mongodb');
const { bucket } = require('./images');
const imagekit = require('./imagekit');

function legacyReferences(document, collection) {
  if (collection === 'articles') {
    return (document.images || []).flatMap((image, index) => image?.type === 'gridfs'
      ? [{ path: `images.${index}`, image, scope: 'articles' }] : []);
  }
  return [
    ...(document.storyImage?.type === 'gridfs' ? [{ path: 'storyImage', image: document.storyImage, scope: 'storefront' }] : []),
    ...(document.slides || []).flatMap((slide, index) => slide.image?.type === 'gridfs'
      ? [{ path: `slides.${index}.image`, image: slide.image, scope: 'storefront' }] : [])
  ];
}

function legacyId(image) {
  const value = image.fileId?.toString();
  if (!/^[a-f\d]{24}$/i.test(value || '')) throw new Error('A legacy image has an invalid GridFS file ID.');
  return new ObjectId(value);
}

async function readLegacyFile(fileId) {
  const chunks = [];
  let size = 0;
  for await (const chunk of bucket().openDownloadStream(fileId)) {
    size += chunk.length;
    if (size > 10 * 1024 * 1024) throw new Error(`Legacy image ${fileId} is unexpectedly large.`);
    chunks.push(chunk);
  }
  if (!size) throw new Error(`Legacy image ${fileId} is empty.`);
  return Buffer.concat(chunks);
}

async function verifyPublicImage(url, fetchImpl = globalThis.fetch) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetchImpl(url, { method: 'HEAD', signal: AbortSignal.timeout(10000) });
      if (response.ok && response.headers.get('content-type')?.startsWith('image/')) return;
    } catch { /* ImageKit's CDN can take a moment to make a new file available. */ }
    if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('ImageKit image URL could not be verified; the MongoDB reference was left unchanged.');
}

async function imageForLegacyId(db, fileId, scope, options = {}) {
  const journal = db.collection('imageMigrations');
  const existing = await journal.findOne({ _id: fileId });
  if (existing?.image) {
    await verifyPublicImage(existing.image.url, options.fetchImpl);
    return existing.image;
  }
  const buffer = await readLegacyFile(fileId);
  const image = await imagekit.uploadImage(buffer, {
    fileName: `${fileId}.webp`, folder: `/fashionhub/migrated/${scope}`, overwrite: true
  }, options.fetchImpl);
  await verifyPublicImage(image.url, options.fetchImpl);
  await journal.updateOne({ _id: fileId }, {
    $set: { image, uploadedAt: new Date(), bytes: buffer.length }
  }, { upsert: true });
  return image;
}

async function hasLegacyReference(db, fileId) {
  const ids = [fileId, fileId.toString()];
  const [article, storefront] = await Promise.all([
    db.collection('articles').findOne({ 'images.fileId': { $in: ids } }, { projection: { _id: 1 } }),
    db.collection('storefront').findOne({ $or: [
      { 'storyImage.fileId': { $in: ids } }, { 'slides.image.fileId': { $in: ids } }
    ] }, { projection: { _id: 1 } })
  ]);
  return Boolean(article || storefront);
}

async function cleanupMigratedLegacy(db) {
  let removed = 0;
  const journal = db.collection('imageMigrations');
  for await (const item of journal.find({ legacyRemovedAt: { $exists: false } })) {
    if (await hasLegacyReference(db, item._id)) continue;
    const file = await db.collection('articleImages.files').findOne({ _id: item._id }, { projection: { _id: 1 } });
    if (file) await bucket().delete(item._id);
    else await db.collection('articleImages.chunks').deleteMany({ files_id: item._id });
    await journal.updateOne({ _id: item._id }, { $set: { legacyRemovedAt: new Date() } });
    removed++;
  }
  return removed;
}

async function migrateReference(db, collectionName, documentId, reference, options = {}) {
  const fileId = legacyId(reference.image);
  const image = await imageForLegacyId(db, fileId, reference.scope, options);
  const collection = db.collection(collectionName);
  const result = await collection.updateOne({
    _id: documentId,
    [`${reference.path}.type`]: 'gridfs',
    [`${reference.path}.fileId`]: reference.image.fileId
  }, {
    $set: { [reference.path]: image, updatedAt: new Date() },
    $inc: { version: 1 }
  });
  return Boolean(result.modifiedCount);
}

async function scanLegacyImages(db) {
  const references = [];
  for (const name of ['articles', 'storefront']) {
    for await (const document of db.collection(name).find({}, { projection: name === 'articles' ? { images: 1 } : { slides: 1, storyImage: 1 } })) {
      for (const reference of legacyReferences(document, name)) {
        references.push({ collection: name, documentId: document._id, ...reference });
      }
    }
  }
  return references;
}

module.exports = { legacyReferences, scanLegacyImages, migrateReference, cleanupMigratedLegacy, verifyPublicImage };
