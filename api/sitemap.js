const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  const baseUrl = 'https://dhiaandave.vercel.app';
  const today = new Date().toISOString().split('T')[0];

  const pages = [
    ['/', '1.0', 'daily'],
    ['/blog', '0.9', 'weekly'],
    ['/projects', '0.9', 'weekly'],
    ['/spotify', '0.6', 'monthly'],
    ['/youtube', '0.6', 'weekly'],
    ['/duolingo', '0.6', 'daily'],
    ['/monkeytype', '0.6', 'monthly'],
    ['/contact', '0.7', 'monthly'],
    ['/minecraft', '0.3', 'monthly'],
    ['/slope2', '0.3', 'monthly'],
    ['/cloudmoon', '0.3', 'monthly'],
    ['/aliex', '0.3', 'monthly'],
    ['/jklm', '0.3', 'monthly'],
    ['/search', '0.5', 'monthly'],
    ['/sitemap', '0.6', 'monthly'],
  ];

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  for (const [loc, priority, changefreq] of pages) {
    xml += `  <url>\n    <loc>${baseUrl}${loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>\n`;
  }

  try {
    const posts = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'posts.json'), 'utf8'));
    for (const post of posts) {
      xml += `  <url>\n    <loc>${baseUrl}/post.html?id=${encodeURIComponent(post.id)}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
    }
  } catch (e) {}

  xml += '</urlset>';
  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).send(xml);
};
