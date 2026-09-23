async function ensureIndexes(db) {
  try {
    const indexes = await db.collection('articles').indexes();
    const nameKeyIndex = indexes.find(i => i.name === 'nameKey_1');
    if (nameKeyIndex && !nameKeyIndex.partialFilterExpression) {
      await db.collection('articles').dropIndex('nameKey_1');
    }
  } catch {}

  await Promise.all([
    db.collection('users').createIndex({ email: 1 }, { unique: true }),
    db.collection('articles').createIndex({ nameKey: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } }),
    db.collection('articles').createIndex({ createdAt: -1, _id: -1 }),
    db.collection('sessions').createIndex({ tokenHash: 1 }, { unique: true }),
    db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]);
}
module.exports = { ensureIndexes };


