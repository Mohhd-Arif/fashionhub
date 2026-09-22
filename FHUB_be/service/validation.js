const { ObjectId, Decimal128 } = require('mongodb');

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = message => { throw new ApiError(400, message); };
function objectId(value) {
  if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value)) fail('Invalid ID.');
  return new ObjectId(value);
}
function email(value) {
  if (typeof value !== 'string' || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) fail('Enter a valid email address.');
  return value.trim().toLowerCase();
}
function password(value) {
  if (typeof value !== 'string' || value.length < 8 || Buffer.byteLength(value) > 256) fail('Password must be at least 8 characters and no more than 256 bytes.');
  return value;
}
function decimal(value, field, maximum) {
  const str = String(value ?? '').trim();
  if (!['string', 'number'].includes(typeof value) || !/^\d{1,9}(\.\d{1,2})?$/.test(str)) fail(`${field} must be a non-negative number with at most 2 decimal places.`);
  if (Number(str) > maximum) fail(`${field} cannot exceed ${maximum}.`);
  return Number(str).toFixed(2);
}
function articleInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Article data is required.');
  if (typeof body.name !== 'string') fail('Article name is required.');
  const name = body.name.trim().replace(/\s+/g, ' ');
  if (!name || name.length > 120) fail('Name must be between 1 and 120 characters.');
  if (!Number.isInteger(body.quantity) || body.quantity < 0 || body.quantity > 1000000) fail('Quantity must be a whole number between 0 and 1,000,000.');
  if (typeof body.size !== 'string' || !body.size.trim() || body.size.trim().length > 40) fail('Size must be between 1 and 40 characters.');
  const aliases = { 'extra small':'XS', xs:'XS', small:'S', s:'S', medium:'M', m:'M', large:'L', l:'L', 'extra large':'XL', xl:'XL', xxl:'XXL', xxxl:'XXXL' };
  const size = aliases[body.size.trim().toLowerCase()] || body.size.trim();
  if (!['male', 'female'].includes(body.gender)) fail('Gender must be male or female.');
  const category = body.category || (body.gender === 'male' ? 'gents' : 'ladies');
  if (!['kids', 'gents', 'ladies'].includes(category)) fail('Collection must be kids, gents or ladies.');
  const discountVal = (body.discount === '' || body.discount === null || body.discount === undefined) ? 0 : body.discount;
  return { name, nameKey: name.toLowerCase(), quantity: body.quantity, size, gender: body.gender, category,
    price: Decimal128.fromString(decimal(body.price, 'Price', 9999999.99)),
    discount: Decimal128.fromString(decimal(discountVal, 'Discount', 100)) };
}
function imageUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) fail('Image URL must be an HTTPS URL under 2048 characters.');
  let url;
  try { url = new URL(value); } catch { fail('Enter a valid image URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password) fail('Image URLs must use HTTPS without credentials.');
  return url.href;
}
function version(value) {
  if (!Number.isInteger(value) || value < 1) fail('A valid article version is required. Refresh and try again.');
  return value;
}
module.exports = { ApiError, fail, objectId, email, password, decimal, articleInput, imageUrl, version };
