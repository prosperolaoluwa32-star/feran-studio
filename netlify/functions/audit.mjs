// Feran Studio — Website Audit engine (Netlify Function)
// GET /.netlify/functions/audit?url=example.com
// Fetches the public page, inspects its HTML and returns measured facts.
import dns from 'node:dns/promises';
import net from 'node:net';

const UA = 'Mozilla/5.0 (compatible; FeranStudioAudit/1.0; +https://feranstudio.com/audit.html)';
const MAX_BYTES = 3 * 1024 * 1024;
const PAGE_TIMEOUT = 7000;
const SIDE_TIMEOUT = 2500;

const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*' }
});

// ---------- safety: never fetch private / internal addresses ----------
function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return isPrivateIp(v.slice(7));
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe8') || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb');
}
async function assertPublic(urlObj) {
  if (!['http:', 'https:'].includes(urlObj.protocol)) throw new Error('Only http and https websites can be checked.');
  if (process.env.AUDIT_ALLOW_LOCAL === '1') return;
  if (urlObj.port && !['80', '443', ''].includes(urlObj.port)) throw new Error('That address uses an unusual port and cannot be checked.');
  const host = urlObj.hostname;
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) throw new Error('That address is not a public website.');
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (!addrs.length || addrs.some(a => isPrivateIp(a.address))) throw new Error('That address is not a public website.');
}

async function timedFetch(url, ms, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctrl.signal, headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,*/*;q=0.8', ...(opts.headers || {}) } }); }
  finally { clearTimeout(t); }
}

async function readCapped(res) {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_BYTES) { try { await reader.cancel(); } catch (e) {} break; }
    chunks.push(value);
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(Buffer.concat(chunks.map(c => Buffer.from(c))));
}

// follow redirects manually so every hop is checked
async function fetchPage(startUrl) {
  let url = startUrl; const hops = [];
  const t0 = Date.now();
  for (let i = 0; i < 6; i++) {
    const u = new URL(url);
    await assertPublic(u);
    const s = Date.now();
    const res = await timedFetch(u.href, PAGE_TIMEOUT, { redirect: 'manual' });
    const ttfb = Date.now() - s;
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      hops.push({ from: u.href, status: res.status });
      url = new URL(res.headers.get('location'), u).href;
      continue;
    }
    const html = await readCapped(res);
    return { res, html, finalUrl: u.href, ttfb, total: Date.now() - t0, hops };
  }
  throw new Error('The website redirects too many times.');
}

// ---------- tiny HTML helpers (no dependencies) ----------
const attr = (tag, name) => { const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i')); return m ? (m[2] ?? m[3] ?? m[4] ?? '') : null; };
const tags = (html, name) => html.match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) || [];
const decode = s => (s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const metaContent = (html, key) => {
  for (const t of tags(html, 'meta')) {
    const n = (attr(t, 'name') || attr(t, 'property') || '').toLowerCase();
    if (n === key) return decode(attr(t, 'content') || '');
  }
  return null;
};
const has = (s, re) => re.test(s);

function registrable(host) {
  const parts = host.replace(/^www\./, '').split('.');
  if (parts.length > 2 && parts[parts.length - 1].length === 2 && ['co', 'com', 'org', 'net', 'gov', 'ac', 'edu', 'ng'].includes(parts[parts.length - 2])) return parts.slice(-3).join('.');
  return parts.slice(-2).join('.');
}

async function rdap(host) {
  try {
    const res = await timedFetch(`https://rdap.org/domain/${registrable(host)}`, SIDE_TIMEOUT, { headers: { accept: 'application/rdap+json' } });
    if (!res.ok) return null;
    const d = await res.json();
    const ev = a => (d.events || []).find(e => e.eventAction === a)?.eventDate || null;
    let registrar = null;
    for (const e of d.entities || []) {
      if ((e.roles || []).includes('registrar')) {
        const fn = (e.vcardArray?.[1] || []).find(v => v[0] === 'fn');
        registrar = fn ? fn[3] : (e.handle || null);
      }
    }
    return { domain: registrable(host), created: ev('registration'), updated: ev('last changed'), expires: ev('expiration'), registrar, nameservers: (d.nameservers || []).map(n => (n.ldhName || '').toLowerCase()).filter(Boolean).slice(0, 4) };
  } catch (e) { return null; }
}

async function exists(url) {
  try {
    const res = await timedFetch(url, SIDE_TIMEOUT, { redirect: 'follow' });
    const ct = res.headers.get('content-type') || '';
    const ok = res.ok && !ct.includes('text/html');
    try { await res.body?.cancel(); } catch (e) {}
    return ok;
  } catch (e) { return false; }
}

function inspect(html, finalUrl) {
  const u = new URL(finalUrl);
  const lower = html.toLowerCase();
  const noScript = html.replace(/<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[\s\S]*?<\/style>/gi, ' ').replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ');
  const text = decode(noScript.replace(/<[^>]+>/g, ' '));
  const textL = text.toLowerCase();

  const titleM = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleM ? decode(titleM[1]) : null;
  const h1s = (html.match(/<h1\b[\s\S]*?<\/h1>/gi) || []).map(h => decode(h.replace(/<[^>]+>/g, ' '))).filter(Boolean);

  const imgs = tags(html, 'img');
  const imgAltMissing = imgs.filter(t => attr(t, 'alt') === null).length;
  const imgDims = imgs.filter(t => attr(t, 'width') && attr(t, 'height')).length;
  const imgLazy = imgs.filter(t => (attr(t, 'loading') || '').toLowerCase() === 'lazy').length;

  const links = tags(html, 'a').map(t => attr(t, 'href') || '').filter(Boolean);
  const linkL = links.map(l => l.toLowerCase());
  const scripts = tags(html, 'script');
  const srcs = scripts.map(t => (attr(t, 'src') || '').toLowerCase()).filter(Boolean);
  const allRefs = (lower.match(/(?:src|href)\s*=\s*["']([^"']+)["']/g) || []).join(' ');

  const linkTags = tags(html, 'link');
  const rel = (r) => linkTags.find(t => (attr(t, 'rel') || '').toLowerCase().split(/\s+/).includes(r));

  // structured data
  const ld = [];
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    const types = m[1].match(/"@type"\s*:\s*(\[[^\]]*\]|"[^"]*")/g) || [];
    types.forEach(t => (t.replace(/"@type"\s*:/, '').match(/"([A-Za-z]+)"/g) || []).forEach(x => ld.push(x.replace(/"/g, ''))));
  }
  const microdata = (html.match(/itemtype\s*=\s*["']https?:\/\/schema\.org\/([A-Za-z]+)/gi) || []).map(m => m.split('/').pop());
  const schemaTypes = [...new Set([...ld, ...microdata])].filter(t => t !== '@type');

  const analytics = [];
  const A = [['Google Analytics', /googletagmanager\.com\/gtag|google-analytics\.com|gtag\(/], ['Google Tag Manager', /googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]+/], ['Meta Pixel', /connect\.facebook\.net|fbq\(/], ['TikTok Pixel', /analytics\.tiktok\.com|ttq\./], ['Microsoft Clarity', /clarity\.ms/], ['Hotjar', /hotjar\.com/], ['Klaviyo', /klaviyo/], ['Shopify Analytics', /shopify\.analytics|trekkie/], ['Plausible', /plausible\.io/], ['Mailchimp', /list-manage\.com|mailchimp/]];
  for (const [n, re] of A) if (re.test(html)) analytics.push(n);

  let platform = 'Custom or other';
  const generator = (metaContent(html, 'generator') || '').toLowerCase();
  const markup = scripts.join(' ') + ' ' + linkTags.join(' ') + ' ' + allRefs + ' ' + generator + ' ' + (html.match(/<(html|body)\b[^>]*>/gi) || []).join(' ');
  const P = [['Shopify', /cdn\.shopify\.com|shopify\.theme|myshopify\.com|shopify/i], ['Wix', /static\.wixstatic\.com|parastorage\.com|wix\.com website builder|_wix/i], ['Squarespace', /static1\.squarespace|squarespace-cdn|squarespace/i], ['Webflow', /webflow\.js|website-files\.com|data-wf-page|data-wf-site|webflow/i], ['WordPress', /wp-content|wp-includes|wp-json|wordpress/i], ['GoDaddy Website Builder', /img1\.wsimg\.com|godaddy/i], ['Weebly', /editmysite|weebly/i], ['Framer', /framerusercontent|framer\.com/i], ['BigCommerce', /bigcommerce/i], ['Duda', /multiscreensite|dudamobile/i]];
  for (const [n, re] of P) if (re.test(markup)) { platform = n; break; }
  if (platform === 'WordPress' && /woocommerce/i.test(html)) platform = 'WordPress + WooCommerce';

  const socials = [];
  const S = [['Instagram', /instagram\.com\//], ['Facebook', /facebook\.com\//], ['TikTok', /tiktok\.com\//], ['LinkedIn', /linkedin\.com\//], ['X / Twitter', /(twitter|x)\.com\//], ['YouTube', /youtube\.com\//], ['Pinterest', /pinterest\.com\//]];
  for (const [n, re] of S) if (linkL.some(l => re.test(l))) socials.push(n);

  const findAny = (list) => list.filter(([, re]) => re.test(allRefs) || linkL.some(l => re.test(l))).map(([n]) => n);
  const booking = findAny([['Calendly', /calendly\.com/], ['Booksy', /booksy\.com/], ['Vagaro', /vagaro\.com/], ['Square Appointments', /squareup\.com\/appointments|book\.squareup/], ['Fresha', /fresha\.com/], ['GlossGenius', /glossgenius/], ['Acuity', /acuityscheduling/], ['StyleSeat', /styleseat\.com/], ['Schedulicity', /schedulicity/], ['Setmore', /setmore\.com/], ['Mindbody', /mindbodyonline/]]);
  const reservations = findAny([['OpenTable', /opentable\.com/], ['Resy', /resy\.com/], ['Tock', /exploretock\.com/], ['Yelp Reservations', /yelp\.com\/reservations/], ['SevenRooms', /sevenrooms\.com/]]);
  const ordering = findAny([['DoorDash', /doordash\.com/], ['Uber Eats', /ubereats\.com/], ['Grubhub', /grubhub\.com/], ['Toast', /toasttab\.com/], ['ChowNow', /chownow\.com/], ['Square Online', /square\.site/], ['Slice', /slicelife\.com/], ['Clover', /clover\.com/]]);
  const reviewPlatforms = findAny([['Google reviews', /g\.page|google\.com\/maps|maps\.app\.goo\.gl|search\.google\.com\/local/], ['Yelp', /yelp\.com\/biz/], ['Trustpilot', /trustpilot\.com/], ['Judge.me', /judge\.me/], ['Yotpo', /yotpo/], ['Okendo', /okendo/], ['Tripadvisor', /tripadvisor\./]]);

  const yearM = [...text.matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/gi)].map(m => Number(m[1]));
  const copyrightYear = yearM.length ? Math.max(...yearM) : null;

  const policy = (re) => linkL.some(l => re.test(l)) || re.test(textL);
  const mixed = u.protocol === 'https:' && /(?:src)\s*=\s*["']http:\/\//i.test(html);

  return {
    title, titleLength: title ? title.length : 0,
    metaDescription: metaContent(html, 'description'),
    h1Count: h1s.length, h1Text: h1s[0] || null,
    imageCount: imgs.length, imgAltMissing, imgDims, imgLazy,
    viewport: !!metaContent(html, 'viewport'),
    lang: (html.match(/<html[^>]*\blang\s*=\s*["']?([a-zA-Z-]+)/i) || [])[1] || null,
    canonical: rel('canonical') ? attr(rel('canonical'), 'href') : null,
    ogTitle: metaContent(html, 'og:title'), ogImage: metaContent(html, 'og:image'),
    favicon: !!(rel('icon') || rel('shortcut') || rel('apple-touch-icon')),
    schemaTypes,
    noindex: /noindex/i.test(metaContent(html, 'robots') || ''),
    scriptCount: scripts.length, externalScripts: srcs.length,
    analytics, platform, socials,
    wordCount: text ? text.split(/\s+/).filter(w => /[a-z]/i.test(w)).length : 0,
    linkCount: links.length,
    telLinks: linkL.filter(l => l.startsWith('tel:')).length,
    mailLinks: linkL.filter(l => l.startsWith('mailto:')).length,
    whatsapp: linkL.some(l => /wa\.me|whatsapp\.com|api\.whatsapp/.test(l)),
    forms: tags(html, 'form').length,
    inputs: tags(html, 'input').filter(t => !/hidden|submit/i.test(attr(t, 'type') || '')).length,
    buttons: tags(html, 'button').length,
    ctas: ['book', 'order', 'buy', 'shop now', 'add to cart', 'get a quote', 'contact us', 'call', 'schedule', 'reserve', 'get started', 'sign up', 'subscribe'].filter(w => textL.includes(w)),
    addToCart: /add to cart|add to bag|addtocart|\/cart\/add/.test(lower),
    checkout: linkL.some(l => /\/cart\b|\/checkout|\/basket/.test(l)) || /buy now|add to cart/.test(textL),
    prices: /[$£€₦]\s?\d/.test(text),
    menu: linkL.some(l => /\/menu|menu\.pdf|menus?\b/.test(l) && !l.startsWith('#')) || /(our|view|see|full|food|drinks?|dinner|lunch|brunch) menu/.test(textL),
    hours: /\b(hours|opening|open (daily|mon|tue|monday|7 days))\b|mon(day)?\s*[-–]\s*(fri|sat|sun)/i.test(text) || schemaTypes.some(t => /OpeningHours/.test(t)) || /openinghours/i.test(html),
    address: /\b\d{2,5}\s+[a-z0-9 .'-]+\s(st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane|way|suite)\b/i.test(text) || /PostalAddress|streetAddress/i.test(html),
    map: /google\.com\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google/.test(allRefs + linkL.join(' ')),
    servicesPrices: /\$\s?\d+/.test(text) && /(cut|fade|trim|shave|braid|color|style|nails|lash|massage|facial)/i.test(text),
    testimonials: /testimonial|review|what (our )?(clients|customers) say|★|5 stars|rated/i.test(text),
    reviewPlatforms, booking, reservations, ordering,
    policies: { privacy: policy(/privacy/), terms: policy(/terms|conditions/), refund: policy(/refund|return/), shipping: policy(/shipping|delivery/) },
    newsletter: /newsletter|subscribe|sign up for|join our (list|mailing)/i.test(textL),
    liveChat: /tawk\.to|intercom|crisp\.chat|drift\.com|tidio|livechat|zendesk|hubspot/i.test(html),
    copyrightYear, mixedContent: mixed
  };
}

export default async (req) => {
  const params = new URL(req.url).searchParams;
  let raw = (params.get('url') || '').trim();
  if (!raw) return json(400, { error: 'Please enter a website address.' });
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
  let start;
  try { start = new URL(raw); } catch (e) { return json(400, { error: 'That doesn’t look like a website address. Try something like yourbusiness.com' }); }
  if (!start.hostname.includes('.') && process.env.AUDIT_ALLOW_LOCAL !== '1') return json(400, { error: 'That doesn’t look like a website address. Try something like yourbusiness.com' });

  let page;
  try {
    page = await fetchPage(start.href);
  } catch (e) {
    // retry over http if https failed (some small sites have no SSL)
    if (start.protocol === 'https:' && !/public website|port|redirects/.test(e.message)) {
      try { start.protocol = 'http:'; page = await fetchPage(start.href); } catch (e2) { page = null; }
    }
    if (!page) {
      const msg = /public website|port|redirects|http and https/.test(e.message) ? e.message : 'We couldn’t reach that website. Check the address and try again. The site may be down or blocking automated checks.';
      return json(422, { error: msg });
    }
  }

  const { res, html, finalUrl, ttfb, total, hops } = page;
  if (res.status >= 400) return json(422, { error: `That website returned an error (${res.status}). It may be down or blocking automated checks.` });
  const ct = res.headers.get('content-type') || '';
  if (!/html/i.test(ct) && !/<html/i.test(html.slice(0, 2000))) return json(422, { error: 'That address doesn’t return a web page.' });

  const origin = new URL(finalUrl).origin;
  const [robotsTxt, sitemap, domain] = await Promise.all([
    exists(origin + '/robots.txt'), exists(origin + '/sitemap.xml'), rdap(new URL(finalUrl).hostname)
  ]);

  return json(200, {
    input: raw, finalUrl, status: res.status, https: finalUrl.startsWith('https:'),
    redirects: hops.length, ttfb, totalTime: total, bytes: Buffer.byteLength(html),
    server: res.headers.get('server') || null,
    compression: res.headers.get('content-encoding') || null,
    robotsTxt, sitemap, domain,
    fetchedAt: new Date().toISOString(),
    ...inspect(html, finalUrl)
  });
};
