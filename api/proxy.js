module.exports = async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send('Missing ?url= parameter');

  let targetUrl;
  try {
    const trimmed = url.trim();
    if (/^https?:\/\//i.test(trimmed)) targetUrl = trimmed;
    else if (/^[\w-]+\.\w+/i.test(trimmed)) targetUrl = 'https://' + trimmed;
    else targetUrl = 'https://www.google.com/search?q=' + encodeURIComponent(trimmed);
    new URL(targetUrl);
  } catch {
    return res.status(400).send('Invalid URL');
  }

  try {
    const resp = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'follow',
    });

    const contentType = resp.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain') && !contentType.includes('application/xhtml')) {
      return res.status(400).send('Cannot proxy non-HTML content: ' + contentType);
    }

    let body = await resp.text();

    const base = new URL(targetUrl);
    const baseTag = `<base href="${base.origin}/">`;

    if (body.includes('</head>')) {
      body = body.replace('</head>', baseTag + '</head>');
    } else if (body.includes('<head>')) {
      body = body.replace('<head>', '<head>' + baseTag);
    } else {
      body = baseTag + body;
    }

    body = body.replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '');
    body = body.replace(/<object[^>]*>[\s\S]*?<\/object>/gi, '');

    res.setHeader('Content-Type', contentType);
    res.setHeader('X-Robots-Tag', 'noindex');
    res.setHeader('X-Frame-Options', '');
    res.removeHeader('X-Frame-Options');
    res.status(200).send(body);
  } catch (err) {
    res.status(502).send('Proxy error: ' + err.message);
  }
};
