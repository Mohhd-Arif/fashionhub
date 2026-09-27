require('../config/env');

const DEFAULT_URL_ENDPOINT = 'https://ik.imagekit.io/webfashionhub';
const UPLOAD_URL = 'https://upload.imagekit.io/api/v1/files/upload';
const FILES_URL = 'https://api.imagekit.io/v1/files';

class ImageKitError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ImageKitError';
  }
}

function urlEndpoint() {
  const value = (process.env.IMAGEKIT_URL_ENDPOINT || DEFAULT_URL_ENDPOINT).replace(/\/+$/, '');
  let parsed;
  try { parsed = new URL(value); } catch { throw new ImageKitError('IMAGEKIT_URL_ENDPOINT is invalid.'); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new ImageKitError('IMAGEKIT_URL_ENDPOINT must be a public HTTPS URL.');
  }
  return value;
}

function authHeader() {
  const key = process.env.IMAGEKIT_PRIVATE_KEY?.trim();
  if (!key) throw new ImageKitError('Image uploads are not configured. Set IMAGEKIT_PRIVATE_KEY on the backend.');
  return `Basic ${Buffer.from(`${key}:`).toString('base64')}`;
}

function isOwnUrl(value) {
  try {
    const target = new URL(value), endpoint = new URL(urlEndpoint());
    return target.protocol === 'https:' && target.origin === endpoint.origin &&
      (target.pathname === endpoint.pathname || target.pathname.startsWith(`${endpoint.pathname}/`));
  } catch { return false; }
}

async function uploadImage(buffer, { fileName, folder, overwrite = false }, fetchImpl = globalThis.fetch) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new ImageKitError('Image data is empty.');
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: 'image/webp' }), fileName);
  form.append('fileName', fileName);
  form.append('folder', folder);
  form.append('useUniqueFileName', 'false');
  form.append('overwriteFile', String(overwrite));
  form.append('isPrivateFile', 'false');
  let response;
  try {
    response = await fetchImpl(UPLOAD_URL, {
      method: 'POST', headers: { Authorization: authHeader() }, body: form,
      signal: AbortSignal.timeout(30000)
    });
  } catch (error) {
    if (error instanceof ImageKitError) throw error;
    throw new ImageKitError('ImageKit upload could not be reached. Try again.');
  }
  if (!response.ok) throw new ImageKitError(`ImageKit rejected the upload (HTTP ${response.status}). Check the backend key and account settings.`);
  let result;
  try { result = await response.json(); } catch { throw new ImageKitError('ImageKit returned an invalid upload response.'); }
  if (typeof result.fileId !== 'string' || !isOwnUrl(result.url)) {
    throw new ImageKitError('ImageKit returned a URL outside the configured account. Check IMAGEKIT_URL_ENDPOINT.');
  }
  return { type: 'url', url: result.url, imagekitFileId: result.fileId };
}

async function deleteImage(fileId, fetchImpl = globalThis.fetch) {
  if (typeof fileId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(fileId)) throw new ImageKitError('Invalid ImageKit file ID.');
  let response;
  try {
    response = await fetchImpl(`${FILES_URL}/${encodeURIComponent(fileId)}`, {
      method: 'DELETE', headers: { Authorization: authHeader() }, signal: AbortSignal.timeout(30000)
    });
  } catch (error) {
    if (error instanceof ImageKitError) throw error;
    throw new ImageKitError('ImageKit cleanup could not be reached.');
  }
  if (!response.ok && response.status !== 404) throw new ImageKitError(`ImageKit could not remove an unused image (HTTP ${response.status}).`);
}

module.exports = { ImageKitError, urlEndpoint, isOwnUrl, uploadImage, deleteImage };
