const { getDatabase } = require('../config/database');
const { ApiError, objectId, fail } = require('./validation');

const documentId = 'topArticles';
const state = () => getDatabase().collection('articleRanking');

async function getTopIds() {
  const entry = await state().findOne({ _id: documentId });
  return entry?.ids || [];
}

async function setTopPosition(id, position) {
  objectId(id);
  if (position !== null && (!Number.isInteger(position) || position < 1)) fail('Top position must be a positive whole number.');
  const article = await getDatabase().collection('articles').findOne({ _id: objectId(id), isDeleted: { $ne: true } });
  if (!article) throw new ApiError(404, 'Article not found.');

  for (let attempt = 0; attempt < 8; attempt++) {
    const current = await state().findOne({ _id: documentId });
    const ids = [...(current?.ids || [])];
    const oldIndex = ids.indexOf(id);
    if (position === null) {
      if (oldIndex !== -1) ids.splice(oldIndex, 1);
    } else if (oldIndex !== -1) {
      const targetIndex = Math.min(position - 1, ids.length - 1);
      [ids[oldIndex], ids[targetIndex]] = [ids[targetIndex], ids[oldIndex]];
    } else {
      ids.splice(Math.min(position - 1, ids.length), 0, id);
    }
    const result = await state().updateOne(
      { _id: documentId, version: current?.version || 0 },
      { $set: { ids, updatedAt: new Date() }, $inc: { version: 1 } },
      { upsert: !current }
    ).catch(error => { if (error.code === 11000) return null; throw error; });
    if (result?.modifiedCount || result?.upsertedCount) return ids;
  }
  throw new ApiError(409, 'Top articles changed elsewhere. Refresh and try again.');
}

async function removeTopArticle(id) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const current = await state().findOne({ _id: documentId });
    if (!current?.ids?.includes(id)) return;
    const ids = current.ids.filter(item => item !== id);
    const result = await state().updateOne({ _id: documentId, version: current.version },
      { $set: { ids, updatedAt: new Date() }, $inc: { version: 1 } });
    if (result.modifiedCount) return;
  }
  throw new ApiError(409, 'Top articles changed elsewhere. Refresh and try again.');
}

module.exports = { getTopIds, setTopPosition, removeTopArticle };
