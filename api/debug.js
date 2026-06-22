export default function handler(req, res) {
  const agent = req.headers['user-agent'] || '';
  const isBot = /bot|crawl|spider|google|bing|yahoo|duckduck|baidu|yandex|slurp|facebook|twitter|whatsapp|embedly|slack|discord/i.test(agent);
  res.setHeader('Cache-Control', 'no-cache');
  res.status(200).json({
    success: true,
    timestamp: new Date().toISOString(),
    url: req.url,
    headers: {
      'user-agent': agent,
      'referer': req.headers['referer'] || null,
      'accept': req.headers['accept'] || null,
      'accept-language': req.headers['accept-language'] || null,
      'x-forwarded-for': req.headers['x-forwarded-for'] || null,
      'x-vercel-id': req.headers['x-vercel-id'] || null
    },
    bot: isBot
  });
}
