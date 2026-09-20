const router = require('express').Router();
const multer = require('multer');
const { ObjectId } = require('mongodb');
const { getDatabase } = require('../config/database');
const { requireUser, requireAdmin } = require('../service/auth');
const { ApiError, version, fail } = require('../service/validation');
const { getStorefront, present, validateStorefront } = require('../service/storefront');
const { saveImages, removeImages } = require('../service/images');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 4, fields: 1, fieldSize: 32 * 1024, parts: 5 } }).fields(['kids', 'gents', 'ladies', 'story'].map(name => ({ name, maxCount: 1 })));

router.use(requireUser, requireAdmin);
router.get('/', async (req, res) => res.json({ storefront: present(await getStorefront()) }));
router.patch('/', upload, async (req, res) => {
  let body = req.body;
  if (req.is('multipart/form-data')) { try { body = JSON.parse(req.body.storefront); } catch { fail('The storefront field must contain valid JSON.'); } }
  const expected = version(body?.version), previous = await getStorefront();
  if (expected !== previous.version) throw new ApiError(409, 'Storefront changed elsewhere. Reload the editor before saving.');
  const settings = await validateStorefront(body, previous);
  const uploaded = [];
  try {
    for (const key of ['kids', 'gents', 'ladies', 'story']) {
      if (req.files?.[key]?.[0]) {
        const saved = await saveImages(req.files[key], new ObjectId());
        uploaded.push(...saved);
        if (key === 'story') settings.storyImage = saved[0];
        else settings.slides.find(s => s.id === key).image = saved[0];
      }
    }
    const update = { ...settings, version: previous.version + 1, updatedAt: new Date() };
    if (previous._id) {
      const result = await getDatabase().collection('storefront').updateOne({ _id: 'main', version: expected }, { $set: update });
      if (!result.modifiedCount) throw new ApiError(409, 'Storefront changed elsewhere. Reload the editor before saving.');
    } else {
      try { await getDatabase().collection('storefront').insertOne({ _id: 'main', ...update }); }
      catch (error) { if (error.code === 11000) throw new ApiError(409, 'Storefront changed elsewhere. Reload the editor before saving.'); throw error; }
    }
    const before = [previous.storyImage, ...previous.slides.map(s => s.image)];
    const after = [settings.storyImage, ...settings.slides.map(s => s.image)];
    await removeImages(before.filter(i => i.type === 'gridfs' && !after.some(j => j.type === 'gridfs' && j.fileId.equals(i.fileId))));
    res.json({ storefront: present(update) });
  } catch (error) {
    // Only clean up files that are not referenced by a committed update.
    const current = await getStorefront();
    const refs = [current.storyImage, ...current.slides.map(s => s.image)].filter(i => i?.type === 'gridfs').map(i => i.fileId.toString());
    await removeImages(uploaded.filter(i => !refs.includes(i.fileId.toString())));
    throw error;
  }
});
module.exports = router;
