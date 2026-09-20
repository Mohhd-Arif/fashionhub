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
  if (!Array.isArray(body.slides) || body.slides.length !== 3) fail('Keep one slide for kids, gents and ladies.');
  result.slides = [];
  for (const id of ['kids', 'gents', 'ladies']) {
    const slide = body.slides.find(s => s?.id === id), old = previous.slides.find(s => s.id === id);
    if (!slide) fail(`The ${id} slide is required.`);
    const item = { id };
    for (const key of ['label', 'eyebrow', 'title', 'badge', 'message', 'buttonLabel']) item[key] = text(slide[key], `${id} ${key}`, key === 'title' ? 100 : 120);
    item.description = text(slide.description, `${id} description`, 800);
    item.image = image(slide.image, old.image);
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
