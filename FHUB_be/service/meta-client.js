require('../config/env');
const imagekit = require('./imagekit');

class MetaError extends Error {
  constructor(message, uncertain = false) {
    super(message);
    this.name = 'MetaError';
    this.uncertain = uncertain;
  }
}

function configuration() {
  const pageId = process.env.META_PAGE_ID?.trim();
  const instagramId = process.env.META_IG_USER_ID?.trim();
  const token = process.env.META_PAGE_ACCESS_TOKEN?.trim();
  const version = process.env.META_GRAPH_VERSION?.trim() || 'v26.0';
  if (!/^v\d+\.\d+$/.test(version)) throw new MetaError('META_GRAPH_VERSION is invalid.');
  if (!pageId || !instagramId || !token) return null;
  if (!/^\d+$/.test(pageId) || !/^\d+$/.test(instagramId)) throw new MetaError('Meta Page or Instagram account ID is invalid.');
  return { pageId, instagramId, token, version };
}

async function graph(path, { method = 'GET', params = {}, publishing = false } = {}) {
  const config = configuration();
  if (!config) throw new MetaError('Meta publishing is not configured on the backend.');
  const endpoint = new URL(`https://graph.facebook.com/${config.version}/${path}`);
  const body = new URLSearchParams(params);
  if (method === 'GET') for (const [key, value] of body) endpoint.searchParams.set(key, value);
  let response;
  try {
    response = await fetch(endpoint, {
      method,
      headers: {
        Authorization: `Bearer ${config.token}`,
        ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {})
      },
      ...(method === 'POST' ? { body } : {}),
      signal: AbortSignal.timeout(20000)
    });
  } catch {
    throw new MetaError('Meta could not be reached. Check the account before retrying.', publishing);
  }
  let data;
  try { data = await response.json(); } catch { throw new MetaError('Meta returned an invalid response.', publishing); }
  if (!response.ok || data.error) {
    const code = data.error?.code;
    const subcode = data.error?.error_subcode;
    const details = [code, subcode].filter(value => Number.isInteger(value)).join('/');
    throw new MetaError(`Meta rejected the request${details ? ` (code ${details})` : ` (HTTP ${response.status})`}. Check Page permissions, token and image.`, publishing && response.status >= 500);
  }
  return data;
}

function instagramImageUrl(imageUrl) {
  if (!imagekit.isOwnUrl(imageUrl)) {
    if (!/^https:\/\/[^?#]+\.jpe?g(?:\?.*)?$/i.test(imageUrl)) throw new MetaError('Instagram needs a public JPEG image. Upload the article photo through Fashion Hub.');
    return imageUrl;
  }
  const url = new URL(imageUrl);
  url.searchParams.set('tr', 'f-jpg');
  return url.toString();
}

async function verifyConnection() {
  const config = configuration();
  if (!config) throw new MetaError('Set META_PAGE_ID, META_IG_USER_ID and META_PAGE_ACCESS_TOKEN on the backend.');
  const page = await graph(config.pageId, { params: { fields: 'id,name,instagram_business_account' } });
  const linkedId = String(page.instagram_business_account?.id || '');
  if (linkedId !== config.instagramId) throw new MetaError('This Facebook Page is not linked to the configured Instagram Professional account.');
  return { pageId: String(page.id), pageName: page.name || '', instagramId: linkedId };
}

async function publishFacebook(imageUrl, caption) {
  const { pageId } = configuration() || {};
  if (!pageId) throw new MetaError('Meta publishing is not configured on the backend.');
  const data = await graph(`${pageId}/photos`, { method: 'POST', params: { url: imageUrl, message: caption, published: 'true' }, publishing: true });
  if (!data.id) throw new MetaError('Facebook response did not include a photo ID. Check the Page before retrying.', true);
  return { id: String(data.post_id || data.id), photoId: String(data.id) };
}

async function publishInstagram(imageUrl, caption) {
  const { instagramId } = configuration() || {};
  if (!instagramId) throw new MetaError('Meta publishing is not configured on the backend.');
  const jpegUrl = instagramImageUrl(imageUrl);
  const container = await graph(`${instagramId}/media`, { method: 'POST', params: { image_url: jpegUrl, caption } });
  if (!container.id) throw new MetaError('Instagram did not return a media container.');
  for (let attempt = 0; attempt < 8; attempt++) {
    const status = await graph(String(container.id), { params: { fields: 'status_code' } });
    if (status.status_code === 'FINISHED') {
      const published = await graph(`${instagramId}/media_publish`, {
        method: 'POST', params: { creation_id: String(container.id) }, publishing: true
      });
      if (!published.id) throw new MetaError('Instagram response did not include a media ID. Check the account before retrying.', true);
      return { id: String(published.id) };
    }
    if (['ERROR', 'EXPIRED'].includes(status.status_code)) throw new MetaError('Instagram could not process the image.');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new MetaError('Instagram is still processing the image. Retry the publication later.');
}

module.exports = { MetaError, configuration, verifyConnection, instagramImageUrl, publishFacebook, publishInstagram };
