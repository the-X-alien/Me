// Small ad/tracker/popup domain list (subset of common open-source domain lists such as
// Peter Lowe's ad server list). Matches the host and any subdomain.
const DOMAINS = `doubleclick.net googlesyndication.com googleadservices.com google-analytics.com googletagmanager.com
googletagservices.com adservice.google.com pagead2.googlesyndication.com adsystem.com adnxs.com adsrvr.org
amazon-adsystem.com taboola.com outbrain.com criteo.com criteo.net rubiconproject.com pubmatic.com openx.net
casalemedia.com indexww.com smartadserver.com advertising.com adform.net bidswitch.net 33across.com
scorecardresearch.com quantserve.com quantcount.com chartbeat.com chartbeat.net hotjar.com hotjar.io
mixpanel.com segment.io segment.com fullstory.com mouseflow.com crazyegg.com clarity.ms
facebook.net connect.facebook.net analytics.twitter.com ads-twitter.com ads.linkedin.com px.ads.linkedin.com
ads.tiktok.com analytics.tiktok.com snap.licdn.com sc-static.net moatads.com adsafeprotected.com
doubleverify.com serving-sys.com sizmek.com mathtag.com bluekai.com demdex.net krxd.net exelator.com
everesttech.net agkn.com rlcdn.com adroll.com perfectaudience.com yieldmo.com sharethrough.com
media.net contextweb.com lijit.com sovrn.com teads.tv zedo.com revcontent.com mgid.com
propellerads.com popads.net popcash.net popunder.net exoclick.com exosrv.com juicyads.com trafficjunky.net
adsterra.com highperformanceformat.com profitablegatecpm.com clickadu.com hilltopads.net adcash.com
onclickads.net onclkds.com ad-maven.com admaven.com richpush.co pushwoosh.com notix.io
yandex.ru/ads an.yandex.ru mc.yandex.ru adskeeper.com zemanta.com tapad.com turn.com
amplitude.com heap.io heapanalytics.com newrelic.com nr-data.net optimizely.com branch.io app-measurement.com
bat.bing.com ads.yahoo.com analytics.yahoo.com adtech.com advertising.yahoo.com
ads.pinterest.com ct.pinterest.com log.pinterest.com ads.reddit.com events.reddit.com
imrworldwide.com nielsen.com permutive.com id5-sync.com liveramp.com pippio.com
ads.youtube.com adsense.com 2mdn.net atdmt.com spotxchange.com springserve.com
tribalfusion.com undertone.com conversantmedia.com vidible.tv innovid.com
trackcmp.net cloudfront-labs.amazonaws.com sentry.io browser-intake-datadoghq.com`
  .split(/\s+/).filter(d => d && !d.includes('/'));

function isBlockedHost(host) {
  host = String(host || '').toLowerCase().replace(/\.$/, '');
  return DOMAINS.some(d => host === d || host.endsWith('.' + d));
}
function isBlockedUrl(u, base) {
  try { return isBlockedHost(new URL(u, base).hostname); } catch { return false; }
}

// Cosmetic selectors for common ad containers
const COSMETIC = [
  '[id^="google_ads"]','[id^="div-gpt-ad"]','ins.adsbygoogle','[class*="adsbygoogle"]',
  '.ad-banner','.ad-container','.ad-slot','.advert','.advertisement','.ads-container',
  '[id*="taboola"]','[class*="taboola"]','[id*="outbrain"]','[class*="outbrain"]',
  '[aria-label="advertisement" i]','[data-ad-slot]','[data-ad-client]'
];

module.exports = { DOMAINS, isBlockedHost, isBlockedUrl, COSMETIC };
