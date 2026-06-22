module.exports = (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.status(200).send(`User-agent: *
Allow: /
Crawl-delay: 1

Sitemap: https://dhiaandave.vercel.app/sitemap.xml
`);
};
