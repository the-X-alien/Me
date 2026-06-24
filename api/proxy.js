module.exports = async (req, res) => {
  const raw = req.query.url;
  if (!raw) return res.status(400).send('Missing ?url=');

  let targetUrl;
  try {
    const t = raw.trim();
    if (/^https?:\/\//i.test(t)) targetUrl = t;
    else if (/^[\w-]+\.[a-z]{2,}/i.test(t)) targetUrl = 'https://' + t;
    else targetUrl = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(t);
    new URL(targetUrl);
  } catch {
    return res.status(400).send('Invalid URL');
  }

  // Forward extra query params (form submissions)
  const extra = Object.fromEntries(Object.entries(req.query).filter(([k]) => k !== 'url'));
  const extraStr = new URLSearchParams(extra).toString();
  if (extraStr) targetUrl += (targetUrl.includes('?') ? '&' : '?') + extraStr;

  try {
    const resp = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0',
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

    // Use full path as base href so relative links resolve correctly (e.g. ?query, ../path)
    const baseHref = baseUrl.origin + baseUrl.pathname;

    // Remove any existing <base> tags — only the first <base> in <head> is honored
    body = body.replace(/<base[^>]*>/gi, '');

    // Inject ours right after <head> so it wins
    body = body.replace(/<head[^>]*>/i, (match) => match + `<base href="${baseHref}">`);

    // Rewrite <a href> and <area href> through proxy
    body = body.replace(
      /(<(?:a|area)\s[^>]*href\s*=\s*["'])([^"']+)(["'][^>]*>)/gi,
      (m, pre, url, post) => {
        try {
          const abs = new URL(url, baseHref).href;
          if (abs.startsWith('http')) {
            return pre + proxyBase + encodeURIComponent(abs) + post;
          }
        } catch {}
        return m;
      }
    );

    // Rewrite forms: put target URL in hidden input instead of action query string.
    // GET forms REPLACE the action's query string with form fields — so the url param would be lost.
    body = body.replace(
      /(<form[^>]*?)(?:\saction\s*=\s*["'])([^"']*)(["'])([^>]*>)/gi,
      (m, before, actionUrl, quote, after) => {
        try {
          const abs = new URL(actionUrl, baseHref).href;
          if (abs.startsWith('http')) {
            // Convert POST to GET so form data arrives as query params
            const cleaned = after.replace(/\smethod\s*=\s*["']post["']/gi, ' method="GET"');
            return `${before} action="/api/proxy"${cleaned}<input type="hidden" name="url" value="${encodeURIComponent(abs)}">`;
          }
        } catch {}
        return m;
      }
    );

    // Strip CSP meta tags
    body = body.replace(/<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi, '');

    // Strip iframes/objects
    body = body.replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '<p style="color:gray;font-style:italic">[iframe blocked]</p>');
    body = body.replace(/<object[^>]*>[\s\S]*?<\/object>/gi, '<p style="color:gray;font-style:italic">[object blocked]</p>');

    res.setHeader('Content-Type', contentType);
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.status(200).send(body);
  } catch (err) {
    res.status(502).send('Proxy error: ' + err.message);
  }
};
