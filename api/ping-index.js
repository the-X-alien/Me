const https = require('https');

module.exports = async (req, res) => {
  const sitemapUrl = 'https://dhiaandave.vercel.app/sitemap.xml';
  const results = [];

  try {
    await new Promise((resolve, reject) => {
      https.get(`https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`, (r) => {
        results.push({ target: 'Google', status: r.statusCode });
        resolve();
      }).on('error', (e) => { results.push({ target: 'Google', error: e.message }); resolve(); });
    });
  } catch (e) {
    results.push({ target: 'Google', error: e.message });
  }

  try {
    const body = JSON.stringify({ host: 'dhiaandave.vercel.app', key: 'seo-verification', urlList: [sitemapUrl] });
    await new Promise((resolve, reject) => {
      const req2 = https.request({ hostname: 'api.indexnow.org', path: '/indexnow', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, (r) => {
        results.push({ target: 'IndexNow', status: r.statusCode });
        resolve();
      });
      req2.on('error', (e) => { results.push({ target: 'IndexNow', error: e.message }); resolve(); });
      req2.write(body);
      req2.end();
    });
  } catch (e) {
    results.push({ target: 'IndexNow', error: e.message });
  }

  res.status(200).json({ ok: true, results, timestamp: new Date().toISOString() });
};
