const { isBlockedUrl, COSMETIC } = require('./blocklist');

module.exports = async (req, res) => {
  const raw = req.query.url;
  if (!raw) return res.status(400).send('Missing ?url=');

  // Ad/popup blocker can be toggled off per request with &adblock=0
  const adblockOn = req.query.adblock !== '0';

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

  // Forward extra query params (form submissions), except our own control params
  const extra = Object.fromEntries(Object.entries(req.query).filter(([k]) => k !== 'url' && k !== 'adblock'));
  const extraStr = new URLSearchParams(extra).toString();
  if (extraStr) targetUrl += (targetUrl.includes('?') ? '&' : '?') + extraStr;

  // Absolute URL of this proxy endpoint. Rewritten links must be absolute: the
  // injected <base href> points at the TARGET site, so a root-relative
  // "/api/proxy?url=..." would resolve to https://target-site/api/proxy... and 404.
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'dhiaandave.vercel.app';
  const proxyOrigin = proto + '://' + String(host).split(',')[0].trim();
  const proxyBase = proxyOrigin + '/api/proxy?url=';

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

    // Use full path as base href so relative links resolve correctly (e.g. ?query, ../path)
    const baseHref = baseUrl.origin + baseUrl.pathname;

    // Remove any existing <base> tags — only the first <base> in <head> is honored
    body = body.replace(/<base[^>]*>/gi, '');

    let blockedCount = 0;
    let headInject = `<base href="${baseHref}">`;

    if (adblockOn) {
      const { DOMAINS } = require('./blocklist');
      const blockerScript = `<script>(function(){
var D=${JSON.stringify(DOMAINS)},n=0;
function bad(u){try{var h=new URL(u,document.baseURI).hostname.toLowerCase();return D.some(function(d){return h===d||h.endsWith('.'+d)})}catch(e){return false}}
function hit(){n++;try{parent.postMessage({blocked:n},'*')}catch(e){}}
window.open=function(){hit();return null};
var of=window.fetch;if(of)window.fetch=function(u){var s=typeof u==='string'?u:(u&&u.url);if(bad(s)){hit();return Promise.reject(new TypeError('blocked'))}return of.apply(this,arguments)};
var ox=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){if(bad(u)){hit();this.send=function(){};return}return ox.apply(this,arguments)};
if(navigator.sendBeacon){var ob=navigator.sendBeacon.bind(navigator);navigator.sendBeacon=function(u){if(bad(u)){hit();return true}return ob.apply(navigator,arguments)}}
new MutationObserver(function(ms){ms.forEach(function(m){m.addedNodes.forEach(function(el){if(el.nodeType===1&&/^(SCRIPT|IFRAME|IMG|LINK)$/.test(el.tagName)){var u=el.src||el.href;if(u&&bad(u)){el.remove();hit()}}})})}).observe(document,{childList:true,subtree:true});
var st=document.createElement('style');st.textContent=${JSON.stringify(COSMETIC.join(',') + '{display:none!important}')};
document.documentElement.appendChild(st);
})();<\/script>`;
      headInject += blockerScript;

      // Ad/tracker blocking: drop resource tags that point at blocked hosts
      const dropIfBlocked = (re, attr) => {
        body = body.replace(re, (m) => {
          const mm = m.match(new RegExp('\\s' + attr + '\\s*=\\s*["\']?([^"\'\\s>]+)', 'i'));
          if (mm && isBlockedUrl(mm[1], baseHref)) { blockedCount++; return ''; }
          return m;
        });
      };
      body = body.replace(/<script\b[^>]*\bsrc\s*=[^>]*>\s*<\/script>/gi, (m) => {
        const mm = m.match(/\ssrc\s*=\s*["']?([^"'\s>]+)/i);
        if (mm && isBlockedUrl(mm[1], baseHref)) { blockedCount++; return ''; }
        return m;
      });
      dropIfBlocked(/<img\b[^>]*>/gi, 'src');
      dropIfBlocked(/<link\b[^>]*>/gi, 'href');
      dropIfBlocked(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, 'src');
      // Inline scripts that load known ad/popup networks
      body = body.replace(/<script\b(?![^>]*\bsrc\b)[^>]*>[\s\S]*?<\/script>/gi, (m) => {
        if (!m.includes('function bad(u)') && /googlesyndication|doubleclick\.net|adsbygoogle|popunder|propellerads|exoclick|adsterra|popads|taboola|outbrain/i.test(m)) { blockedCount++; return ''; }
        return m;
      });
    }

    // Inject base href (and blocker script when enabled) right after <head> so it wins
    body = body.replace(/<head[^>]*>/i, (match) => match + headInject);

    // Rewrite <a href> and <area href> through proxy (absolute URLs — see proxyBase note)
    body = body.replace(
      /(<(?:a|area)\s[^>]*href\s*=\s*["'])([^"']+)(["'][^>]*>)/gi,
      (m, pre, url, post) => {
        if (url.startsWith('#')) return m; // in-page anchor: leave alone
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
            return `${before} action="${proxyOrigin}/api/proxy"${cleaned}<input type="hidden" name="url" value="${encodeURIComponent(abs)}">`;
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

    // Inject navigation script so users can click links / submit forms inside the srcdoc iframe.
    // Rewritten links point at this proxy; unwrap them so the app navigates to the REAL url
    // (keeps the URL bar and tab history clean, and avoids proxying through ourselves).
    const navScript = `<script>
function realUrl(h){try{var u=new URL(h);if(u.pathname==='/api/proxy'){var v=u.searchParams.get('url');if(v)return v}}catch(e){}return h}
document.addEventListener('click',function(e){var a=e.target.closest('a');if(a&&a.href&&/^https?:/i.test(a.href)){e.preventDefault();parent.postMessage({nav:realUrl(a.href),newtab:a.target==='_blank'||e.ctrlKey||e.metaKey},'*')}});
document.addEventListener('submit',function(e){e.preventDefault();var f=e.target,d=new FormData(f),u=f.action||'';try{var a=new URL(u);if(a.pathname==='/api/proxy'){var t=d.get('url');if(t){u=t;d.delete('url')}}}catch(err){}var q=new URLSearchParams(d).toString();if(q)u+=(u.includes('?')?'&':'?')+q;parent.postMessage({nav:u},'*')});
<\/script>`;
    body = body.replace('</body>', navScript + '</body>');

    res.setHeader('Content-Type', contentType);
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-Blocked-Count', String(blockedCount));
    res.setHeader('Access-Control-Expose-Headers', 'X-Blocked-Count');
    res.status(200).send(body);
  } catch (err) {
    res.status(502).send('Proxy error: ' + err.message);
  }
};
