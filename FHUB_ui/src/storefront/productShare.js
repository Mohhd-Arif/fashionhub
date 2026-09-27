const formatPrice = value => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2,
}).format(value);

export function productShareText(article) {
  const discount = Math.min(100, Math.max(0, Number(article.discount) || 0));
  const price = Number(article.price) || 0;
  return [
    'Fashion Hub',
    article.name,
    article.size && `Size: ${article.size}`,
    `Price: ${formatPrice(price * (1 - discount / 100))}`,
    discount > 0 && `Was ${formatPrice(price)} | ${discount}% off`,
  ].filter(Boolean).join('\n');
}

export function productWhatsAppUrl(article, origin, phone) {
  const imageUrls = [...new Set((article.images || []).flatMap(image => {
    try {
      const url = new URL(image.url, origin);
      return image.url && ['https:', 'http:'].includes(url.protocol) ? [url.href] : [];
    } catch { return []; }
  }))];
  const lines = [
    'Hi Fashion Hub, I am interested in this product:',
    productShareText(article),
    imageUrls.length > 0 && `\nProduct photos:\n${imageUrls.join('\n')}`,
  ].filter(Boolean);
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(lines.join('\n'))}`;
}
