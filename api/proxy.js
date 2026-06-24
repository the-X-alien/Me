module.exports = async (req, res) => {
  const raw = req.query.url;
  if (!raw) return res.status(400).send('Missing ?url=');

  let targetUrl;
  try {
    const t = raw.trim();
    if (/^https?:\/\//i.test(t)) targetUrl = t;
    else if (/^[\w-]+\.[a-z]{2,}/i.test(t)) targetUrl = 'https://' + t;
    else targetUrl = 'https://www.google.com/search?q=' + encodeURIComponent(t);
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
    if (!contentType.includes('html') && !contentType.includes('text/plain') && !contentType.includes('xml')) {
      return res.status(400).send('Only HTML pages can be proxied (got: ' + contentType + ')');
    }

    let body = await resp.text();
    const baseUrl = new URL(targetUrl);
    const proxyBase = '/api/proxy?url=';
    const proxyEnc = (u) => proxyBase + encodeURIComponent(u);

    // Rewrite <a href>, <form action>, <area href> through proxy
    body = body.replace(
      /(<(?:a|area)\s[^>]*href\s*=\s*["'])([^"']+)(["'][^>]*>)/gi,
      (m, pre, url, post) => {
        try {
          const abs = new URL(url, baseUrl.origin).href;
          if (abs.startsWith(baseUrl.origin) || abs.startsWith('http')) {
            return pre + proxyEnc(abs) + post;
          }
        } catch {}
        return m;
      }
    );

    body = body.replace(
      /(<form\s[^>]*action\s*=\s*["'])([^"']+)(["'][^>]*>)/gi,
      (m, pre, url, post) => {
        try {
          const abs = new URL(url, baseUrl.origin).href;
          if (abs.startsWith(baseUrl.origin) || abs.startsWith('http')) {
            return pre + proxyEnc(abs) + post;
          }
        } catch {}
        return m;
      }
    );

    // Inject <base> so relative resources still load
    body = body.replace('</head>', `<base href="${baseUrl.origin}/"></head>`);

    // Strip content security policy that might block us
    body = body.replace(/<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi, '');

    // Strip iframes that would fail
    body = body.replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '<p style="color:gray;font-style:italic">[iframe blocked]</p>');
    body = body.replace(/<object[^>]*>[\s\S]*?<\/object>/gi, '<p style="color:gray;font-style:italic">[object blocked]</p>');

    res.setHeader('Content-Type', contentType);
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.status(200).send(body);
  } catch (err) {
    res.status(502).send('Proxy error: ' + err.message);
  }
};
