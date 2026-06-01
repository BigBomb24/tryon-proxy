// Image proxy — fetches Shopify product images server-side to avoid CORS issues
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'No URL provided' });

  try {
    const decoded = decodeURIComponent(url);

    // Only allow Shopify CDN URLs for security
    const allowed = ['cdn.shopify.com', 'cdn.shopifycdn.com'];
    const hostname = new URL(decoded).hostname;
    if (!allowed.some(d => hostname.endsWith(d))) {
      return res.status(403).json({ error: 'Only Shopify CDN images are allowed' });
    }

    const imgRes = await fetch(decoded, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TryOnBot/1.0)' }
    });

    if (!imgRes.ok) return res.status(imgRes.status).json({ error: 'Failed to fetch image' });

    const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
    const buffer = await imgRes.arrayBuffer();

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.status(200).send(Buffer.from(buffer));

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
