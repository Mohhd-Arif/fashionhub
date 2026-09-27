const { getDatabase } = require('../config/database');
const meta = require('./meta-client');

const platforms = ['facebook', 'instagram'];
const collection = () => getDatabase().collection('socialPublications');

function caption(article) {
  const price = Number(article.price?.toString() || 0);
  const discount = Number(article.discount?.toString() || 0);
  const salePrice = price * (1 - discount / 100);
  const money = value => `INR ${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const category = { kids: 'Kids', gents: 'Gents', ladies: 'Ladies', accessories: 'Accessories' }[article.category] || 'Fashion';
  return [
    article.name,
    `${category} - Size ${article.size}`,
    discount > 0 ? `${money(salePrice)} (${discount}% off; regular ${money(price)})` : money(price),
    'Available at Fashion Hub. Message us to check stock or visit the store.',
    '#FashionHub #NewArrival'
  ].join('\n');
}

function publicStatus(document) {
  if (!document) return null;
  return Object.fromEntries(platforms.map(platform => [platform, {
    status: document[platform]?.status || 'pending',
    id: document[platform]?.id || null,
    error: document[platform]?.error || null,
    publishedAt: document[platform]?.publishedAt || null
  }]));
}

async function getPublication(articleId) {
  const stale = new Date(Date.now() - 2 * 60 * 1000);
  for (const platform of platforms) {
    await collection().updateOne({ _id: articleId, [`${platform}.status`]: 'processing', [`${platform}.startedAt`]: { $lt: stale } }, {
      $set: { [`${platform}.status`]: 'needs_review', [`${platform}.error`]: 'Publishing was interrupted. Check the account before retrying.' }
    });
  }
  return publicStatus(await collection().findOne({ _id: articleId }));
}

async function ensurePublication(article) {
  const imageUrl = article.images?.find(image => image?.type === 'url' && image.url)?.url || null;
  const initialStatus = imageUrl ? 'pending' : 'needs_image';
  await collection().updateOne({ _id: article._id }, {
    $setOnInsert: {
      articleName: article.name,
      imageUrl,
      caption: caption(article),
      createdAt: new Date(),
      facebook: { status: initialStatus },
      instagram: { status: initialStatus }
    }
  }, { upsert: true });
}

async function publishArticle(articleId, requested = platforms, { confirmNoPost = false } = {}) {
  const db = getDatabase();
  const article = await db.collection('articles').findOne({ _id: articleId, isDeleted: { $ne: true } });
  if (!article) throw new Error('Article not found for social publishing.');
  await ensurePublication(article);
  const imageUrl = article.images?.find(image => image?.type === 'url' && image.url)?.url || null;
  let ready = false;
  try { ready = Boolean(meta.configuration()); } catch { /* Surface invalid setup as not configured. */ }
  const message = caption(article);
  await collection().updateOne({ _id: articleId }, { $set: { articleName: article.name, imageUrl, caption: message } });
  for (const platform of requested) {
    if (!platforms.includes(platform)) continue;
    if (confirmNoPost) await collection().updateOne({ _id: articleId, [`${platform}.status`]: 'needs_review' }, {
      $set: { [`${platform}.status`]: 'failed', [`${platform}.error`]: null }
    });
    const current = await collection().findOne({ _id: articleId }, { projection: { [platform]: 1 } });
    if (['published', 'needs_review', 'processing'].includes(current?.[platform]?.status)) continue;
    if (!imageUrl || !ready) {
      await collection().updateOne({ _id: articleId, [`${platform}.status`]: { $ne: 'published' } }, {
        $set: { [`${platform}.status`]: imageUrl ? 'not_configured' : 'needs_image', [`${platform}.error`]: imageUrl ? 'Add Meta credentials on the backend.' : 'Add an article image before publishing.' }
      });
      continue;
    }
    const claimed = await collection().findOneAndUpdate({
      _id: articleId, [`${platform}.status`]: { $in: ['pending', 'failed', 'not_configured', 'needs_image'] }
    }, {
      $set: { [`${platform}.status`]: 'processing', [`${platform}.error`]: null, [`${platform}.startedAt`]: new Date() },
      $inc: { [`${platform}.attempts`]: 1 }
    }, { returnDocument: 'after' });
    if (!claimed) continue;
    try {
      const result = platform === 'facebook'
        ? await meta.publishFacebook(imageUrl, message)
        : await meta.publishInstagram(imageUrl, message);
      await collection().updateOne({ _id: articleId }, { $set: {
        [`${platform}.status`]: 'published', [`${platform}.id`]: result.id,
        [`${platform}.error`]: null, [`${platform}.publishedAt`]: new Date()
      } });
    } catch (error) {
      const uncertain = error instanceof meta.MetaError && error.uncertain;
      await collection().updateOne({ _id: articleId }, { $set: {
        [`${platform}.status`]: uncertain ? 'needs_review' : 'failed',
        [`${platform}.error`]: error instanceof meta.MetaError ? error.message : 'Publishing failed. Check the Meta account and retry.'
      } });
    }
  }
  return getPublication(articleId);
}

module.exports = { caption, publicStatus, getPublication, ensurePublication, publishArticle };
