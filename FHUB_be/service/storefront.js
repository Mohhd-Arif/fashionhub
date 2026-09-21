const defaults = require('../config/storefront-defaults');
const { getDatabase } = require('../config/database');
const { fail, objectId } = require('./validation');
const { retainedImages } = require('./images');
async function getStorefront() {
  return await getDatabase().collection('storefront').findOne({ _id: 'main' }) || structuredClone(defaults);
}
function present(settings) {
  const image = value => value?.type === 'gridfs' ? { type: 'gridfs', fileId: value.fileId.toString(), url: `/api/images/${value.fileId}` } : value;
  const { _id, ...result } = settings;
  return { ...result, storyImage: image(settings.storyImage), slides: settings.slides.map(slide => ({ ...slide, image: image(slide.image) })) };
}
function text(value, field, max = 200, optional = false) {
  if (typeof value !== 'string' || value.trim().length > max || (!optional && !value.trim())) fail(`${field} must be ${optional ? '0' : '1'}–${max} characters.`);
  return value.trim();
}
function image(value, previous) {
  if (value?.type === 'asset' && previous?.type === 'asset' && value.url === previous.url) return previous;
  return retainedImages([value], previous ? [previous] : [])[0];
}
function focus(value, fallback = '50% 50%') {
  const keyword = new Set(['left top', 'center top', 'right top', 'left center', 'center center', 'right center', 'left bottom', 'center bottom', 'right bottom']);
  if (keyword.has(value)) return value;
  if (typeof value !== 'string') return fallback || '50% 50%';
  const match = value.trim().match(/^(\d{1,3}(?:\.\d+)?)%\s+(\d{1,3}(?:\.\d+)?)%$/);
  if (!match) return fallback || '50% 50%';
  const x = Number(match[1]), y = Number(match[2]);
  if (x < 0 || x > 100 || y < 0 || y > 100) return fallback || '50% 50%';
  return `${x.toFixed(1)}% ${y.toFixed(1)}%`;
}

function crop(value, fallback = { x: 0, y: 0, width: 100, height: 100 }) {
  const base = fallback && typeof fallback === 'object' ? fallback : { x: 0, y: 0, width: 100, height: 100 };
  if (!value || typeof value !== 'object') return base;
  const x = Number(value.x), y = Number(value.y), width = Number(value.width), height = Number(value.height);
  if (![x, y, width, height].every(Number.isFinite)) return base;
  const safeWidth = Math.min(100, Math.max(12, width));
  const safeHeight = Math.min(100, Math.max(12, height));
  const safeX = Math.min(100 - safeWidth, Math.max(0, x));
  const safeY = Math.min(100 - safeHeight, Math.max(0, y));
  return { x: Number(safeX.toFixed(2)), y: Number(safeY.toFixed(2)), width: Number(safeWidth.toFixed(2)), height: Number(safeHeight.toFixed(2)) };
}
async function validateStorefront(body, previous) {
  if (!body || typeof body !== 'object') fail('Storefront settings are required.');
  const result = {};
  for (const key of ['storeName', 'announcement', 'collectionHeading', 'catalogueHeading', 'storyHeading', 'contactHeading', 'footerTagline']) result[key] = text(body[key], key, key === 'storeName' ? 60 : 200);
  for (const key of ['collectionDescription', 'catalogueDescription', 'storyDescription', 'contactDescription']) result[key] = text(body[key], key, 1500);
  for (const key of ['address', 'hours']) result[key] = text(body[key], key, 300, true);
  result.phone = text(body.phone, 'Phone', 25, true);
  if (result.phone && !/^\+?[\d\s()-]{7,25}$/.test(result.phone)) fail('Enter a valid phone number.');
  if (typeof body.showStory !== 'boolean') fail('showStory must be a boolean.');
  result.showStory = body.showStory;
  result.storyImage = image(body.storyImage, previous.storyImage);
  result.storyFocus = focus(body.storyFocus, previous.storyFocus);
  result.storyCrop = crop(body.storyCrop, previous.storyCrop);
  if (!Array.isArray(body.slides) || body.slides.length !== 3) fail('Keep one slide for kids, gents and ladies.');
  result.slides = [];
  for (const id of ['kids', 'gents', 'ladies']) {
    const slide = body.slides.find(s => s?.id === id), old = previous.slides.find(s => s.id === id);
    if (!slide) fail(`The ${id} slide is required.`);
    const item = { id };
    for (const key of ['label', 'eyebrow', 'title', 'badge', 'message', 'buttonLabel']) item[key] = text(slide[key], `${id} ${key}`, key === 'title' ? 100 : 120);
    item.description = text(slide.description, `${id} description`, 800);
    item.image = image(slide.image, old.image);
    item.imageFocus = focus(slide.imageFocus, old.imageFocus);
    item.imageCrop = crop(slide.imageCrop, old.imageCrop);
    item.articleId = text(slide.articleId, 'Featured article ID', 24, true);
    if (item.articleId) {
      const linked = await getDatabase().collection('articles').findOne({ _id: objectId(item.articleId) });
      if (!linked) fail('Choose an existing featured article.');
      if ((linked.category || (linked.gender === 'male' ? 'gents' : 'ladies')) !== id) fail('Featured article must belong to its slide collection.');
    }
    result.slides.push(item);
  }
  return result;
}
module.exports = { getStorefront, present, validateStorefront };
