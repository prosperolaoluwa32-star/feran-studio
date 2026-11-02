// Feran Studio — Free Website Audit (client)
// Optional: paste a Google PageSpeed Insights API key for faster, more reliable speed tests.
var PSI_KEY = '';
// Show the full report only after the visitor leaves their email (true) or show everything (false).
var AUDIT_GATE = true;

(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  var LIVE = /feranstudio\.com$/.test(location.hostname) || /netlify\.app$/.test(location.hostname);
  var YEAR = new Date().getFullYear();

  var TYPES = {
    store: { label: 'Online store', goal: 'sales', who: 'shoppers' },
    restaurant: { label: 'Restaurant or café', goal: 'orders and reservations', who: 'diners' },
    salon: { label: 'Barber, salon or spa', goal: 'bookings', who: 'clients' },
    services: { label: 'Service business or professional', goal: 'enquiries', who: 'prospects' },
    other: { label: 'Other business', goal: 'customers', who: 'visitors' }
  };
  var CATS = [
    { id: 'seo', name: 'SEO', w: 0.2 },
    { id: 'performance', name: 'Performance', w: 0.18 },
    { id: 'conversion', name: 'Conversion', w: 0.24 },
    { id: 'trust', name: 'Trust', w: 0.16 },
    { id: 'marketing', name: 'Marketing', w: 0.12 },
    { id: 'design', name: 'Mobile & design', w: 0.1 }
  ];
  var SEVW = { high: 3, medium: 2, low: 1 };
  var VAL = { pass: 1, review: 0.45, fail: 0 };

  // ---------- the checks ----------
  function buildChecks(f, type, psi) {
    var T = TYPES[type]; var C = [];
    var add = function (o) { C.push(o); };
    var anyContact = f.telLinks || f.mailLinks || f.forms || f.whatsapp || (f.booking || []).length;

    // SEO
    add({ id: 'title', cat: 'seo', sev: f.title ? 'low' : 'high', label: 'Page title',
      status: !f.title ? 'fail' : (f.titleLength < 30 || f.titleLength > 60 ? 'review' : 'pass'),
      observed: f.title ? f.titleLength + ' characters' : 'Missing',
      title: !f.title ? 'No page title' : 'Page title length is off',
      impact: 'The title is the blue headline people click in Google. ' + (!f.title ? 'Without one, Google invents it.' : 'Titles outside 30–60 characters get cut off or look thin in results.'),
      fix: 'Write a 50–60 character title with your main service and location, e.g. “Barber in Miami | Fades & Beard Trims | Your Shop”.',
      how: ['Open the page and right-click → View page source', 'Search for <title>', 'Count the characters inside it'] });
    add({ id: 'meta', cat: 'seo', sev: f.metaDescription ? 'medium' : 'high', label: 'Meta description',
      status: !f.metaDescription ? 'fail' : (f.metaDescription.length < 70 || f.metaDescription.length > 165 ? 'review' : 'pass'),
      observed: f.metaDescription ? f.metaDescription.length + ' characters' : 'Missing',
      title: !f.metaDescription ? 'Missing meta description' : 'Meta description needs tuning',
      impact: 'This is the sales pitch under your link in Google. When it’s missing, Google pulls random text and fewer people click.',
      fix: 'Add a 140–160 character description that says what you offer, who it’s for, and a reason to click.',
      how: ['View page source', 'Search for name="description"', 'Check the text inside content=""'] });
    add({ id: 'h1', cat: 'seo', sev: 'medium', label: 'Main heading (H1)',
      status: f.h1Count === 1 ? 'pass' : (f.h1Count === 0 ? 'fail' : 'review'), observed: f.h1Count + (f.h1Count === 1 ? ' heading' : ' headings'),
      title: f.h1Count === 0 ? 'No main heading on the page' : 'More than one main heading',
      impact: 'The main heading tells visitors and Google what the page is about in one line.',
      fix: 'Use exactly one H1 that states your core offer clearly.', how: ['View page source', 'Search for <h1', 'Count the matches'] });
    var altRatio = f.imageCount ? f.imgAltMissing / f.imageCount : 0;
    add({ id: 'alt', cat: 'seo', sev: 'medium', label: 'Image alt text',
      status: !f.imageCount || f.imgAltMissing === 0 ? 'pass' : (altRatio > 0.3 ? 'fail' : 'review'),
      observed: f.imageCount ? f.imgAltMissing + ' of ' + f.imageCount + ' missing' : 'No images',
      title: 'Images are missing descriptions', impact: 'Google can’t “see” images without alt text, so your photos don’t help you rank, and screen-reader users miss them.',
      fix: 'Add a short, descriptive alt text to every meaningful image.', how: ['View page source', 'Search for <img', 'Check each one has alt="…"'] });
    var wantSchema = { store: /Product|Offer|Store/, restaurant: /Restaurant|FoodEstablishment|LocalBusiness/, salon: /HairSalon|BeautySalon|DaySpa|HealthAndBeautyBusiness|LocalBusiness/, services: /Organization|LocalBusiness|ProfessionalService|Service/, other: /Organization|LocalBusiness/ }[type];
    var types = (f.schemaTypes || []).join(', ');
    add({ id: 'schema', cat: 'seo', sev: 'medium', label: 'Structured data',
      status: !f.schemaTypes.length ? 'review' : (wantSchema.test(types) ? 'pass' : 'review'),
      observed: f.schemaTypes.length ? f.schemaTypes.slice(0, 4).join(', ') : 'None detected',
      title: !f.schemaTypes.length ? 'Google can’t read your business details' : 'Structured data doesn’t describe your business type',
      impact: 'Structured data lets Google show your hours, ratings, prices and location directly in search and Maps. It also helps AI assistants recommend you.',
      fix: 'Add ' + ({ store: 'Product and Offer', restaurant: 'Restaurant (with hours, menu and address)', salon: 'HairSalon or BeautySalon (with hours, services and address)', services: 'Organization or ProfessionalService', other: 'LocalBusiness or Organization' })[type] + ' schema markup.',
      how: ['Paste your URL into search.google.com/test/rich-results', 'See which items Google detects'] });
    add({ id: 'sitemap', cat: 'seo', sev: 'medium', label: 'XML sitemap', status: f.sitemap ? 'pass' : 'review', observed: f.sitemap ? 'Found' : 'Not found at /sitemap.xml',
      title: 'No sitemap for Google', impact: 'A sitemap tells Google every page you have. Without it, new pages can take much longer to appear in search.',
      fix: 'Generate a sitemap.xml and submit it in Google Search Console.', how: ['Visit yourdomain.com/sitemap.xml in a browser'] });
    add({ id: 'index', cat: 'seo', sev: 'high', label: 'Search indexing', status: f.noindex ? 'fail' : 'pass', observed: f.noindex ? 'Page tells Google not to index it' : 'Allowed',
      title: 'Your page is hidden from Google', impact: 'A “noindex” tag removes the page from Google entirely. No amount of marketing will make it show up in search.',
      fix: 'Remove the noindex robots tag (often a leftover “discourage search engines” setting).', how: ['View page source', 'Search for noindex'] });
    add({ id: 'content', cat: 'seo', sev: 'medium', label: 'Content depth', status: f.wordCount >= 300 ? 'pass' : 'review', observed: f.wordCount + ' words',
      title: 'Very little text on the page', impact: 'Thin pages give Google and customers little to go on, so you rank for fewer searches and visitors leave unsure what you offer.',
      fix: 'Add clear sections on your services, who you serve, your location, and answers to common questions.', how: ['Select all text on the page and paste it into a word counter'] });

    // Performance
    var ttfbS = f.ttfb < 600 ? 'pass' : (f.ttfb < 1500 ? 'review' : 'fail');
    add({ id: 'ttfb', cat: 'performance', sev: 'high', label: 'Server response', status: ttfbS, observed: f.ttfb + ' ms',
      title: 'Slow server response', impact: 'Every extra second before your page starts loading loses visitors, especially on phones. Most people leave if a page takes more than 3 seconds.',
      fix: 'Move to faster hosting or a CDN, turn on caching, and remove heavy plugins. Aim for under 600 ms.',
      how: ['Open Chrome DevTools → Network', 'Reload with cache disabled', 'Check the “Waiting (TTFB)” time on the first request'] });
    if (psi && psi.perf != null) add({ id: 'psi', cat: 'performance', sev: 'high', label: 'Mobile speed score (Google)', status: psi.perf >= 90 ? 'pass' : (psi.perf >= 50 ? 'review' : 'fail'),
      observed: psi.perf + '/100' + (psi.lcp ? ' · LCP ' + psi.lcp : ''),
      title: 'Slow on mobile phones', impact: 'Google measured this page on a phone. Slow mobile pages rank lower and lose most of their visitors before they see your offer.',
      fix: 'Compress and resize images, defer non-essential scripts, and use modern image formats (WebP/AVIF).', how: ['Run your URL at pagespeed.web.dev', 'Look at the Mobile score and “Opportunities”'] });
    var mb = f.bytes / 1048576;
    add({ id: 'weight', cat: 'performance', sev: 'medium', label: 'Page size (HTML)', status: mb < 0.6 ? 'pass' : (mb < 1.5 ? 'review' : 'fail'), observed: (f.bytes / 1024).toFixed(0) + ' KB',
      title: 'Heavy page code', impact: 'Bloated page code takes longer to download and process, especially on mobile data.', fix: 'Remove unused sections, inline styles and page-builder bloat.', how: ['Open DevTools → Network', 'Check the size of the first document request'] });
    add({ id: 'scripts', cat: 'performance', sev: 'medium', label: 'Scripts on page', status: f.scriptCount <= 20 ? 'pass' : (f.scriptCount <= 40 ? 'review' : 'fail'), observed: String(f.scriptCount),
      title: 'Too many scripts', impact: 'Each script competes for the phone’s processor, making buttons slow to respond and pages slow to become usable.',
      fix: 'Remove unused apps and plugins, and defer scripts that aren’t needed on first load.', how: ['View page source', 'Search for <script and count matches'] });
    add({ id: 'lazy', cat: 'performance', sev: 'low', label: 'Lazy-loaded images', status: f.imageCount <= 4 || f.imgLazy / f.imageCount >= 0.3 ? 'pass' : 'review', observed: f.imgLazy + ' of ' + f.imageCount,
      title: 'Images all load at once', impact: 'Loading every image upfront slows down the first screen visitors actually see.', fix: 'Add loading="lazy" to images below the first screen.', how: ['View page source', 'Search for loading="lazy"'] });

    // Mobile & design
    add({ id: 'viewport', cat: 'design', sev: 'high', label: 'Mobile-friendly setup', status: f.viewport ? 'pass' : 'fail', observed: f.viewport ? 'Set' : 'Missing',
      title: 'Not set up for phones', impact: 'Without a mobile viewport, your site shows as a tiny desktop page on phones, where most of your ' + T.who + ' are.',
      fix: 'Add a responsive viewport tag and make sure the layout adapts to small screens.', how: ['Open the site on your phone', 'Check if you need to pinch-zoom to read'] });
    add({ id: 'dims', cat: 'design', sev: 'medium', label: 'Image dimensions', status: !f.imageCount || f.imgDims / f.imageCount >= 0.6 ? 'pass' : 'review', observed: f.imgDims + ' of ' + f.imageCount + ' declared',
      title: 'Page jumps while loading', impact: 'Images without set sizes push content around as they load, which feels broken and causes mis-taps.',
      fix: 'Give every image a width and height (or a CSS aspect-ratio).', how: ['View page source', 'Check <img tags for width and height'] });
    if (psi && psi.a11y != null) add({ id: 'a11y', cat: 'design', sev: 'medium', label: 'Accessibility score (Google)', status: psi.a11y >= 90 ? 'pass' : (psi.a11y >= 70 ? 'review' : 'fail'), observed: psi.a11y + '/100',
      title: 'Hard to use for some visitors', impact: 'Low contrast, tiny tap targets or unlabeled buttons frustrate everyone and exclude people with disabilities.', fix: 'Fix contrast, label buttons and form fields, and enlarge tap targets.', how: ['Run your URL at pagespeed.web.dev', 'Open the Accessibility section'] });
    var stale = f.copyrightYear && f.copyrightYear < YEAR - 1;
    add({ id: 'fresh', cat: 'design', sev: 'medium', label: 'Site looks up to date', status: !f.copyrightYear ? 'review' : (stale ? 'review' : 'pass'), observed: f.copyrightYear ? '© ' + f.copyrightYear : 'No date found',
      title: stale ? 'Website looks abandoned' : 'No sign the site is maintained', impact: 'An old copyright year makes visitors wonder if you’re still open, and that doubt costs ' + T.goal + '.',
      fix: 'Update the footer year automatically and refresh outdated photos and offers.', how: ['Scroll to the footer', 'Check the © year'] });
    add({ id: 'favicon', cat: 'design', sev: 'low', label: 'Browser tab icon', status: f.favicon ? 'pass' : 'review', observed: f.favicon ? 'Present' : 'Missing',
      title: 'No browser tab icon', impact: 'A missing tab icon looks unfinished and makes your site harder to find among open tabs and in Google’s mobile results.', fix: 'Add a favicon using your logo.', how: ['Look at the browser tab for your logo'] });

    // Trust
    add({ id: 'https', cat: 'trust', sev: 'high', label: 'Secure connection (HTTPS)', status: f.https ? 'pass' : 'fail', observed: f.https ? 'Active' : 'Not secure',
      title: 'Browsers mark your site “Not secure”', impact: 'Visitors see a warning before they even see your business. Many leave immediately, and Google ranks insecure sites lower.',
      fix: 'Install a free SSL certificate and redirect all traffic to https.', how: ['Look for the padlock in the address bar'] });
    if (f.mixedContent) add({ id: 'mixed', cat: 'trust', sev: 'medium', label: 'Mixed content', status: 'fail', observed: 'Insecure files on a secure page',
      title: 'Insecure files break the padlock', impact: 'Loading images or scripts over http on an https page can trigger browser warnings or block content.', fix: 'Load every file over https.', how: ['Open DevTools → Console', 'Look for “Mixed Content” warnings'] });
    add({ id: 'contact', cat: 'trust', sev: 'high', label: 'Easy ways to contact you', status: anyContact ? 'pass' : 'fail',
      observed: [f.telLinks ? 'phone' : '', f.mailLinks ? 'email' : '', f.forms ? 'form' : '', f.whatsapp ? 'WhatsApp' : ''].filter(Boolean).join(', ') || 'None found',
      title: 'Hard to get in touch', impact: 'If ' + T.who + ' can’t reach you in one tap, they contact the next business on Google instead.',
      fix: 'Add a tap-to-call number, a short contact form and a WhatsApp button on every page.', how: ['Try to contact the business from the homepage in one tap'] });
    var proof = f.testimonials || (f.reviewPlatforms || []).length;
    add({ id: 'proof', cat: 'trust', sev: 'high', label: 'Reviews & testimonials', status: proof ? 'pass' : 'fail', observed: proof ? ((f.reviewPlatforms || []).join(', ') || 'Testimonials on page') : 'None found',
      title: 'No reviews or social proof', impact: 'Most people check reviews before buying or booking. A page with no proof feels risky, so they choose a competitor who shows it.',
      fix: 'Show 3–5 real reviews with names, and link to your Google or Yelp reviews.', how: ['Scan the homepage for reviews, ratings or testimonials'] });
    var pol = f.policies || {};
    var polNeed = type === 'store' ? ['privacy', 'terms', 'refund', 'shipping'] : ['privacy', 'terms'];
    var polMissing = polNeed.filter(function (k) { return !pol[k]; });
    add({ id: 'policies', cat: 'trust', sev: type === 'store' ? 'high' : 'medium', label: 'Policies', status: !polMissing.length ? 'pass' : (type === 'store' && (polMissing.indexOf('refund') > -1 || polMissing.indexOf('shipping') > -1) ? 'fail' : 'review'),
      observed: polMissing.length ? 'Missing: ' + polMissing.join(', ') : 'Found',
      title: type === 'store' ? 'Missing refund or shipping policies' : 'Missing privacy or terms pages', impact: type === 'store' ? 'Shoppers look for returns and shipping info before paying. When it’s missing, they abandon the cart.' : 'Missing legal pages look unprofessional and are required if you collect any customer details.',
      fix: 'Publish ' + polMissing.join(', ') + ' pages and link them in the footer.', how: ['Check the footer for policy links'] });

    // Conversion
    add({ id: 'cta', cat: 'conversion', sev: 'high', label: 'Clear call to action', status: (f.ctas || []).length >= 2 ? 'pass' : ((f.ctas || []).length ? 'review' : 'fail'), observed: (f.ctas || []).slice(0, 4).join(', ') || 'None found',
      title: 'No clear next step for visitors', impact: 'If the page doesn’t tell people exactly what to do next (book, order, call, buy), most of them do nothing.',
      fix: 'Put one strong button in the first screen, like “Book now”, “Order online” or “Get a quote”, and repeat it down the page.', how: ['Look at the first screen on your phone', 'Is there an obvious button?'] });
    add({ id: 'tel', cat: 'conversion', sev: type === 'restaurant' || type === 'salon' ? 'high' : 'medium', label: 'Tap-to-call', status: f.telLinks ? 'pass' : 'review', observed: f.telLinks ? 'Present' : 'Not found',
      title: 'Phone number isn’t tappable', impact: 'Mobile visitors expect to tap your number to call. If they have to copy it, many won’t.', fix: 'Link your phone number with tel: so it calls in one tap.', how: ['Open the site on your phone and tap the number'] });
    if (type === 'store') {
      add({ id: 'cart', cat: 'conversion', sev: 'high', label: 'Add to cart / checkout', status: f.addToCart || f.checkout ? 'pass' : 'fail', observed: f.addToCart || f.checkout ? 'Found' : 'Not found on this page',
        title: 'No way to buy from this page', impact: 'Shoppers who can’t add to cart from the page they land on often leave without buying.', fix: 'Add prominent “Add to cart” and “Buy now” buttons to product sections and featured items.', how: ['Look for an Add to cart button on the page'] });
      add({ id: 'prices', cat: 'conversion', sev: 'medium', label: 'Prices shown', status: f.prices ? 'pass' : 'review', observed: f.prices ? 'Yes' : 'No prices found',
        title: 'Prices are hidden', impact: 'Hidden prices create friction and send shoppers to competitors who show them.', fix: 'Show prices on featured products.', how: ['Scan the page for prices'] });
    }
    if (type === 'restaurant') {
      add({ id: 'menu', cat: 'conversion', sev: 'high', label: 'Online menu', status: f.menu ? 'pass' : 'fail', observed: f.menu ? 'Found' : 'Not found',
        title: 'Menu is hard to find', impact: 'The menu is the #1 thing diners look for. If it isn’t one tap away, they pick another restaurant.', fix: 'Add a clear “Menu” button in the header with a fast, mobile-friendly menu page (not a PDF).', how: ['Look for a Menu link in the header'] });
      add({ id: 'order', cat: 'conversion', sev: 'medium', label: 'Online ordering', status: (f.ordering || []).length ? 'pass' : 'review', observed: (f.ordering || []).join(', ') || 'Not found',
        title: 'No online ordering', impact: 'Diners who want delivery or pickup will order from a competitor in a few taps.', fix: 'Add an “Order online” button linked to your ordering system.', how: ['Look for an Order online button'] });
      add({ id: 'reserve', cat: 'conversion', sev: 'medium', label: 'Reservations', status: (f.reservations || []).length || (f.booking || []).length ? 'pass' : 'review', observed: (f.reservations || []).concat(f.booking || []).join(', ') || 'Not found',
        title: 'No online reservations', impact: 'Many diners won’t call to book. Without online reservations you lose tables to restaurants that take them.', fix: 'Connect OpenTable, Resy or Tock and add a “Reserve a table” button.', how: ['Look for a Reserve button'] });
    }
    if (type === 'salon') {
      add({ id: 'booking', cat: 'conversion', sev: 'high', label: 'Online booking', status: (f.booking || []).length ? 'pass' : 'fail', observed: (f.booking || []).join(', ') || 'Not found',
        title: 'Clients can’t book online', impact: 'Most clients prefer booking at night or between tasks. Without online booking, they book with the shop that offers it.', fix: 'Connect Booksy, Square, Vagaro or Fresha and put “Book now” at the top of every page.', how: ['Try to book an appointment from the homepage'] });
      add({ id: 'svcprice', cat: 'conversion', sev: 'medium', label: 'Services & prices', status: f.servicesPrices || f.prices ? 'pass' : 'review', observed: f.servicesPrices || f.prices ? 'Shown' : 'Not found',
        title: 'Services and prices aren’t listed', impact: 'Clients want to know what you offer and roughly what it costs before they book.', fix: 'Add a simple services list with starting prices.', how: ['Look for a services or price list'] });
    }
    if (type === 'services' || type === 'other') {
      add({ id: 'lead', cat: 'conversion', sev: 'high', label: 'Lead capture (form or booking)', status: f.forms || (f.booking || []).length ? 'pass' : 'fail', observed: [(f.forms ? f.forms + ' form' + (f.forms > 1 ? 's' : '') : ''), (f.booking || []).join(', ')].filter(Boolean).join(', ') || 'None found',
        title: 'No way to capture leads', impact: 'Interested prospects need a quick way to request a quote or book a call. Without it, they leave and forget you.', fix: 'Add a short enquiry form and a booking link (e.g. Calendly) on the homepage.', how: ['Look for a form or booking button on the page'] });
    }
    if (type === 'restaurant' || type === 'salon') {
      add({ id: 'hours', cat: 'conversion', sev: 'high', label: 'Opening hours', status: f.hours ? 'pass' : 'fail', observed: f.hours ? 'Found' : 'Not found',
        title: 'Opening hours aren’t shown', impact: 'If people can’t tell when you’re open, they assume you’re closed and go elsewhere.', fix: 'Show your hours clearly on the homepage and in your Google Business Profile.', how: ['Scan the homepage for opening hours'] });
      add({ id: 'location', cat: 'conversion', sev: 'high', label: 'Address & directions', status: f.address || f.map ? 'pass' : 'fail', observed: [f.address ? 'address' : '', f.map ? 'map link' : ''].filter(Boolean).join(', ') || 'Not found',
        title: 'Hard to find your location', impact: 'Local customers need your address and a one-tap directions link. Without it, they go to a competitor they can find.', fix: 'Add your full address and a Google Maps directions link.', how: ['Look for an address or map link'] });
    }
    add({ id: 'chat', cat: 'conversion', sev: 'low', label: 'Instant messaging', status: f.whatsapp || f.liveChat ? 'pass' : 'review', observed: f.whatsapp ? 'WhatsApp' : (f.liveChat ? 'Live chat' : 'Not found'),
      title: 'No quick chat option', impact: 'Many customers prefer a quick message over a phone call or form.', fix: 'Add a WhatsApp or live chat button.', how: ['Look for a chat bubble or WhatsApp button'] });

    // Marketing
    add({ id: 'analytics', cat: 'marketing', sev: 'high', label: 'Analytics tracking', status: (f.analytics || []).length ? 'pass' : 'fail', observed: (f.analytics || []).join(', ') || 'Not detected',
      title: 'You can’t see where customers come from', impact: 'Without analytics you’re guessing: you can’t tell which ads, posts or pages bring ' + T.goal + ', or where people drop off.',
      fix: 'Install Google Analytics 4 and set up goals for calls, bookings, orders or form submissions.', how: ['View page source', 'Search for gtag or googletagmanager'] });
    var pixels = (f.analytics || []).filter(function (a) { return /Meta|TikTok/.test(a); });
    add({ id: 'pixels', cat: 'marketing', sev: type === 'store' ? 'high' : 'medium', label: 'Ad tracking pixels', status: pixels.length ? 'pass' : 'review', observed: pixels.join(', ') || 'Not detected',
      title: 'Ads can’t retarget your visitors', impact: 'Without the Meta or TikTok pixel, you can’t show ads to people who already visited, and those ads usually convert best.', fix: 'Install the Meta Pixel and TikTok Pixel, even before you run ads.', how: ['View page source', 'Search for fbq or ttq'] });
    add({ id: 'social', cat: 'marketing', sev: 'medium', label: 'Social media links', status: (f.socials || []).length >= 2 ? 'pass' : ((f.socials || []).length ? 'review' : 'fail'), observed: (f.socials || []).join(', ') || 'None',
      title: 'Social profiles aren’t linked', impact: 'Visitors check your Instagram or Facebook to see if you’re real and active. Missing links lose that trust.', fix: 'Link your active social profiles in the header or footer.', how: ['Look for social icons in the footer'] });
    add({ id: 'capture', cat: 'marketing', sev: type === 'store' ? 'high' : 'low', label: 'Email sign-up', status: f.newsletter ? 'pass' : 'review', observed: f.newsletter ? 'Found' : 'Not found',
      title: 'No way to stay in touch', impact: 'Most visitors aren’t ready to buy on their first visit. An email sign-up lets you bring them back with offers.', fix: 'Add a simple sign-up with a reason to join (e.g. 10% off, VIP updates).', how: ['Look for a newsletter or sign-up box'] });
    add({ id: 'og', cat: 'marketing', sev: 'low', label: 'Social share preview', status: f.ogTitle && f.ogImage ? 'pass' : 'review', observed: f.ogTitle && f.ogImage ? 'Present' : 'Missing',
      title: 'Links look plain when shared', impact: 'When your link is shared on WhatsApp, Facebook or iMessage, there’s no attractive image or title, so fewer people tap it.', fix: 'Add Open Graph title, description and image tags.', how: ['Paste your link into a WhatsApp chat and check the preview'] });

    return C;
  }

  function score(checks, psi) {
    var cs = {};
    CATS.forEach(function (c) {
      var list = checks.filter(function (k) { return k.cat === c.id; });
      var w = 0, v = 0;
      list.forEach(function (k) { w += SEVW[k.sev]; v += SEVW[k.sev] * VAL[k.status]; });
      var s = w ? (v / w) * 100 : 70;
      if (c.id === 'seo' && psi && psi.seo != null) s = s * 0.6 + psi.seo * 0.4;
      cs[c.id] = Math.round(s);
    });
    var overall = Math.round(CATS.reduce(function (a, c) { return a + cs[c.id] * c.w; }, 0));
    return { cats: cs, overall: overall };
  }

  function verdict(n) { return n >= 85 ? 'Strong' : n >= 70 ? 'Good, with gaps' : n >= 50 ? 'Needs work' : 'Critical'; }
  function tone(n) { return n >= 80 ? 'good' : n >= 55 ? 'mid' : 'bad'; }
  function domainOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } }
  function fmtDate(d) { try { return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return d; } }
  function age(d) { var m = Math.floor((Date.now() - new Date(d)) / (30.44 * 864e5)); return m < 12 ? m + ' mo' : (m / 12).toFixed(1).replace('.0', '') + ' yrs'; }

  function ring(n, label) {
    var r = 30, c = 2 * Math.PI * r, off = c * (1 - n / 100);
    return '<div class="ring ring-' + tone(n) + '"><svg viewBox="0 0 72 72" aria-hidden="true"><circle cx="36" cy="36" r="' + r + '" class="ring-bg"/><circle cx="36" cy="36" r="' + r + '" class="ring-fg" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"/></svg><b>' + n + '</b><span>' + esc(label) + '</span></div>';
  }

  function diagnosis(checks, sc, type, f) {
    var T = TYPES[type];
    var strengths = checks.filter(function (k) { return k.status === 'pass' && k.sev !== 'low'; }).slice(0, 3).map(function (k) { return k.label.toLowerCase(); });
    var issues = ranked(checks).slice(0, 3).map(function (k) { return k.title.charAt(0).toLowerCase() + k.title.slice(1); });
    var s = '';
    if (strengths.length) s += 'The site gets some important things right, including ' + listJoin(strengths) + '. ';
    if (issues.length) s += 'But ' + listJoin(issues) + (issues.length > 1 ? ' are' : ' is') + ' likely costing you ' + T.goal + '. ';
    s += sc.overall >= 85 ? 'Fixing the remaining items will help you stay ahead of competitors.' : 'Each of these is fixable, and most fixes take days, not months.';
    return s;
  }
  function listJoin(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
  function ranked(checks) {
    var order = { fail: 0, review: 1 };
    return checks.filter(function (k) { return k.status !== 'pass'; }).sort(function (a, b) {
      return (SEVW[b.sev] - SEVW[a.sev]) || (order[a.status] - order[b.status]);
    });
  }
  var CATNAME = {}; CATS.forEach(function (c) { CATNAME[c.id] = c.name; });

  // ---------- render ----------
  function render(f, type, psi, opts) {
    opts = opts || {};
    var checks = buildChecks(f, type, psi);
    var sc = score(checks, psi);
    var issues = ranked(checks);
    var passed = checks.filter(function (k) { return k.status === 'pass'; });
    var dom = domainOf(f.finalUrl);
    var when = new Date(f.fetchedAt || Date.now());
    var T = TYPES[type];

    var h = '';
    if (opts.example) h += '<p class="example-flag">Example report · a fictional business, to show what you’ll receive</p>';
    h += '<header class="rp-head"><div class="rp-brand"><span>FERAN STUDIO</span><small>Website health report</small></div><small class="rp-meta">' + esc(T.label) + ' · ' + esc(dom) + '</small></header>';
    h += '<p class="eyebrow">Website health report for</p><h2 class="rp-domain">' + esc(dom) + '</h2>';
    h += '<p class="rp-sub"><a href="' + esc(f.finalUrl) + '" target="_blank" rel="noopener nofollow">' + esc(f.finalUrl) + '</a><br>Generated ' + esc(fmtDate(when)) + ' · Evidence captured from the public page</p>';
    h += '<div class="rings">' + ring(sc.overall, 'Overall') + CATS.map(function (c) { return ring(sc.cats[c.id], c.name); }).join('') + '</div>';
    h += '<div class="rp-bar"><div><b>' + passed.length + '</b><span>checks passed</span></div><div><b>' + issues.length + '</b><span>need attention</span></div><p>Scores reflect what we could measure on your public page at scan time. They’re not estimates of your revenue or traffic.</p></div>';

    h += '<section class="rp-sec"><p class="eyebrow">Executive diagnosis</p><h3 class="rp-verdict rp-' + tone(sc.overall) + '">' + verdict(sc.overall) + '</h3><p class="rp-lead">' + esc(diagnosis(checks, sc, type, f)) + '</p>';
    h += '<ol class="toplist">' + issues.slice(0, 5).map(function (k) { return '<li><span>' + esc(k.title) + '</span><em>' + esc(k.observed) + '</em></li>'; }).join('') + '</ol></section>';

    // gated section
    var gated = '';
    gated += '<section class="rp-sec"><p class="eyebrow">Measured snapshot</p><h3 class="rp-h">What the scan actually found</h3><div class="snap">' +
      [[(f.bytes / 1024).toFixed(0) + ' KB', 'HTML inspected'], [f.ttfb + ' ms', 'Server response'], [psi && psi.perf != null ? psi.perf + '/100' : '—', 'Google mobile speed'], [f.imageCount, 'Images'], [f.linkCount, 'Links'], [f.forms, 'Forms']]
        .map(function (x) { return '<div><b>' + esc(x[0]) + '</b><span>' + esc(x[1]) + '</span></div>'; }).join('') + '</div>';
    if (psi && psi.lcp) gated += '<p class="rp-note">Google mobile test: Largest Contentful Paint ' + esc(psi.lcp) + (psi.cls ? ' · Layout shift ' + esc(psi.cls) : '') + (psi.tbt ? ' · Blocking time ' + esc(psi.tbt) : '') + '.</p>';
    gated += '</section>';

    gated += '<section class="rp-sec"><p class="eyebrow">Detailed diagnosis</p><h3 class="rp-h">What’s holding your ' + esc(T.goal) + ' back</h3>';
    gated += issues.map(function (k, i) {
      return '<article class="issue"><header><span class="iss-n">' + String(i + 1).padStart(2, '0') + ' · ' + esc(CATNAME[k.cat]) + '</span><span class="sev sev-' + k.sev + '">' + k.sev + '</span></header>' +
        '<h4>' + esc(k.title) + '</h4><p>' + esc(k.impact) + '</p><div class="fixbox"><b>What to change</b><p>' + esc(k.fix) + '</p></div>' +
        '<dl class="evid"><dt>Check</dt><dd>' + esc(k.label) + ' — ' + (k.status === 'fail' ? 'Fail' : 'Review') + '</dd><dt>Observed</dt><dd>' + esc(k.observed) + '</dd><dt>Verify it yourself</dt><dd>' + k.how.map(esc).join(' → ') + '</dd></dl></article>';
    }).join('') + '</section>';

    gated += '<section class="rp-sec"><p class="eyebrow">Technical inspection</p><h3 class="rp-h">Every check we ran</h3><div class="tbl-wrap"><table class="rp-table"><thead><tr><th>Check</th><th>Area</th><th>Result</th><th>Status</th></tr></thead><tbody>' +
      checks.map(function (k) { return '<tr><td>' + esc(k.label) + '</td><td>' + esc(CATNAME[k.cat]) + '</td><td>' + esc(k.observed) + '</td><td><span class="st st-' + k.status + '">' + ({ pass: 'Pass', review: 'Review', fail: 'Fail' })[k.status] + '</span></td></tr>'; }).join('') +
      '</tbody></table></div></section>';

    gated += '<section class="rp-sec rp-two"><div><p class="eyebrow">Platform</p><h3 class="rp-h">Built with</h3><p class="rp-big">' + esc(f.platform) + '</p><p class="rp-note">' + esc(platformNote(f.platform)) + '</p></div>';
    if (f.domain && (f.domain.created || f.domain.registrar)) {
      gated += '<div><p class="eyebrow">Domain records</p><h3 class="rp-h">' + esc(f.domain.domain) + '</h3><dl class="evid">' +
        (f.domain.created ? '<dt>Registered</dt><dd>' + esc(fmtDate(f.domain.created)) + ' (' + age(f.domain.created) + ')</dd>' : '') +
        (f.domain.expires ? '<dt>Expires</dt><dd>' + esc(fmtDate(f.domain.expires)) + '</dd>' : '') +
        (f.domain.registrar ? '<dt>Registrar</dt><dd>' + esc(f.domain.registrar) + '</dd>' : '') +
        '</dl><p class="rp-note">From the public domain registry. Verify with any WHOIS lookup.</p></div>';
    } else gated += '<div><p class="eyebrow">Domain records</p><p class="rp-note">The public registry didn’t return details for this domain.</p></div>';
    gated += '</section>';

    if (psi && psi.shot) gated += '<section class="rp-sec"><p class="eyebrow">Captured evidence</p><h3 class="rp-h">What visitors see on a phone</h3><figure class="shotbox"><img src="' + psi.shot + '" alt="Mobile screenshot of ' + esc(dom) + '"><figcaption>' + esc(f.finalUrl) + ' · captured ' + esc(when.toLocaleString()) + '</figcaption></figure></section>';

    gated += '<section class="rp-sec rp-two"><div><p class="eyebrow">Strengths</p><h3 class="rp-h">What’s working</h3><ul class="good-list">' + passed.slice(0, 8).map(function (k) { return '<li>' + esc(k.label) + ': ' + esc(k.observed) + '</li>'; }).join('') + '</ul></div>';
    gated += '<div><p class="eyebrow">Priority plan</p><h3 class="rp-h">Fix in this order</h3><ol class="plan">' + issues.slice(0, 8).map(function (k) { return '<li>' + esc(k.fix) + '</li>'; }).join('') + '</ol></div></section>';

    gated += '<section class="rp-cta"><p class="eyebrow">Report prepared by Feran Studio</p><h3 class="display">Want these fixed <em class="grad-text">for you?</em></h3><p>We fix websites on every platform, from Shopify and WordPress to Wix, Webflow and custom code. Most of the issues above can be fixed within days.</p>' +
      '<div class="actions"><a class="btn btn-light" href="https://calendly.com/feranstudio-co/30min" target="_blank" rel="noopener">Book a free call to go through this report <span class="arrow" aria-hidden="true">→</span></a><a class="btn btn-line" href="https://wa.me/13056472998?text=' + encodeURIComponent('Hi Feran Studio, I just ran a website audit for ' + dom + ' (score ' + sc.overall + '/100). Can you help me fix it?') + '" target="_blank" rel="noopener">WhatsApp us</a>' +
      (LIVE ? '<button class="btn btn-line" type="button" data-print>Save as PDF</button>' : '') + '</div><p class="rp-note">Website Rescue from $250 · SEO &amp; Google setup from $600 · <a href="pricing.html">See pricing</a></p></section>';

    var out = $('#report');
    var showAll = !AUDIT_GATE || opts.example || unlocked;
    out.innerHTML = '<div class="report">' + h + '<div class="gated' + (showAll ? '' : ' locked') + '" id="gated">' + gated + '</div>' + (showAll ? '' : gateHtml(dom, sc.overall, type)) + '</div>';
    out.hidden = false;
    var aw = $('#audit-what'); if (aw) aw.hidden = true;
    lastRun = { f: f, type: type, psi: psi, score: sc.overall };
    var p = out.querySelector('[data-print]'); if (p) p.addEventListener('click', function () { window.print(); });
    wireGate();
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function platformNote(p) {
    var n = {
      'Shopify': 'Shopify is a strong store platform. Most issues here come from theme settings, too many apps, or missing content, not the platform itself.',
      'WordPress': 'WordPress is flexible but slows down with heavy themes and plugins. Hosting quality makes a big difference.',
      'WordPress + WooCommerce': 'WooCommerce stores need good hosting and caching to stay fast as products and plugins grow.',
      'Wix': 'Wix is easy to edit but can be slow on mobile. Image optimisation and fewer apps help.',
      'Squarespace': 'Squarespace looks polished out of the box. SEO settings and page speed need manual attention.',
      'Webflow': 'Webflow produces clean, fast sites. Check image sizes and third-party scripts.',
      'GoDaddy Website Builder': 'GoDaddy’s builder is limited for SEO and speed. Businesses often outgrow it quickly.'
    };
    return n[p] || 'We couldn’t identify a common website builder, so this is likely custom-built or uses a less common platform.';
  }

  // ---------- email gate ----------
  var unlocked = false; var lastRun = null;
  try { unlocked = sessionStorage.getItem('fs-audit-unlocked') === '1'; } catch (e) {}
  function gateHtml(dom, sc, type) {
    return '<div class="gate" id="gate"><p class="eyebrow">Your full report is ready</p><h3 class="display">See every issue and <em class="grad-text">how to fix it.</em></h3><p>Enter your email to unlock the detailed diagnosis, technical checks, mobile screenshot and your priority plan.</p>' +
      '<form class="gate-form" id="gate-form"><div class="field"><label for="g-name">Your name</label><input id="g-name" name="name" required autocomplete="name"></div><div class="field"><label for="g-email">Email</label><input id="g-email" name="email" type="email" required autocomplete="email"></div>' +
      '<button class="btn btn-light" type="submit">Unlock my full report <span class="arrow" aria-hidden="true">→</span></button><p class="rp-note">We’ll only use your email to follow up about your website. No spam.</p></form></div>';
  }
  function wireGate() {
    var form = $('#gate-form'); if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      var data = new URLSearchParams();
      data.append('form-name', 'audit-lead');
      data.append('name', $('#g-name').value); data.append('email', $('#g-email').value);
      data.append('website', lastRun ? lastRun.f.finalUrl : ''); data.append('business_type', lastRun ? TYPES[lastRun.type].label : '');
      data.append('score', lastRun ? String(lastRun.score) : '');
      var done = function () {
        unlocked = true; try { sessionStorage.setItem('fs-audit-unlocked', '1'); } catch (e2) {}
        $('#gated').classList.remove('locked'); var g = $('#gate'); if (g) g.remove();
      };
      if (LIVE) fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: data.toString() }).then(done, done);
      else done();
    });
  }

  // ---------- run ----------
  function psiRun(url) {
    var q = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=' + encodeURIComponent(url) + '&strategy=mobile&category=performance&category=seo&category=accessibility&category=best-practices' + (PSI_KEY ? '&key=' + PSI_KEY : '');
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 55000);
    return fetch(q, ctrl ? { signal: ctrl.signal } : {}).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      clearTimeout(timer); if (!j || !j.lighthouseResult) return null;
      var L = j.lighthouseResult, cat = L.categories || {}, a = L.audits || {};
      var sc = function (k) { return cat[k] && cat[k].score != null ? Math.round(cat[k].score * 100) : null; };
      return { perf: sc('performance'), seo: sc('seo'), a11y: sc('accessibility'), bp: sc('best-practices'),
        lcp: a['largest-contentful-paint'] && a['largest-contentful-paint'].displayValue, cls: a['cumulative-layout-shift'] && a['cumulative-layout-shift'].displayValue,
        tbt: a['total-blocking-time'] && a['total-blocking-time'].displayValue,
        shot: a['final-screenshot'] && a['final-screenshot'].details && a['final-screenshot'].details.data };
    }).catch(function () { clearTimeout(timer); return null; });
  }

  var STEPS = ['Fetching your homepage', 'Checking SEO and Google visibility', 'Testing mobile speed with Google', 'Looking for trust signals and reviews', 'Checking how easy it is to buy, book or contact you', 'Reviewing analytics and marketing setup', 'Writing your report'];
  var stepTimer = null;
  function progress(on) {
    var box = $('#progress'); box.hidden = !on;
    clearInterval(stepTimer);
    if (!on) return;
    var i = 0; var li = $('#steps'); li.innerHTML = STEPS.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
    var items = li.querySelectorAll('li'); items[0].className = 'now';
    stepTimer = setInterval(function () { if (i < items.length - 1) { items[i].className = 'done'; i++; items[i].className = 'now'; } }, 3800);
  }

  var form = $('#audit-form');
  var btn = form && form.querySelector('button[type=submit]');
  if (form) form.addEventListener('submit', function (e) {
    e.preventDefault();
    var raw = $('#a-url').value.trim(); var type = $('#a-type').value;
    var err = $('#audit-error'); err.hidden = true;
    if (!raw) { err.textContent = 'Enter your website address, like yourbusiness.com'; err.hidden = false; return; }
    var url = /^https?:\/\//i.test(raw) ? raw : 'https://' + raw;
    $('#report').hidden = true; progress(true); btn.disabled = true;
    var fn = fetch('/.netlify/functions/audit?url=' + encodeURIComponent(url)).then(function (r) {
      return r.json().catch(function () { return { error: 'The audit service is unavailable right now.' }; }).then(function (j) { if (!r.ok) throw new Error(j.error || 'Something went wrong.'); return j; });
    });
    var ps = psiRun(url);
    fn.then(function (f) {
      // give Google's speed test up to ~45s more, then continue without it
      return Promise.race([ps, new Promise(function (res) { setTimeout(function () { res(null); }, 45000); })]).then(function (psi) { return [f, psi]; });
    }).then(function (x) {
      progress(false); btn.disabled = false; render(x[0], type, x[1]);
    }).catch(function (ex) {
      progress(false); btn.disabled = false;
      err.textContent = LIVE ? ex.message : 'The live scanner runs once the site is on feranstudio.com. Here’s an example report instead.';
      err.hidden = false;
      if (!LIVE) render(EXAMPLE, 'salon', EXAMPLE_PSI, { example: true });
    });
  });
  try { var pre = new URLSearchParams(location.search).get('u'); if (pre && $('#a-url')) { $('#a-url').value = pre; } } catch (e) {}
  var ex = $('#example-btn');
  if (ex) ex.addEventListener('click', function () { render(EXAMPLE, 'salon', EXAMPLE_PSI, { example: true }); });

  // ---------- example data (fictional business) ----------
  var EXAMPLE = {
    finalUrl: 'https://www.sharpline-barbers.com/', fetchedAt: new Date().toISOString(), https: true, ttfb: 1420, bytes: 412000,
    title: 'Home', titleLength: 4, metaDescription: null, h1Count: 0, imageCount: 26, imgAltMissing: 17, imgDims: 3, imgLazy: 0,
    viewport: true, lang: 'en', canonical: null, ogTitle: 'Home', ogImage: null, favicon: true, schemaTypes: [], noindex: false,
    scriptCount: 34, externalScripts: 22, analytics: [], platform: 'Wix', socials: ['Instagram'], wordCount: 186, linkCount: 38,
    telLinks: 0, mailLinks: 1, whatsapp: false, forms: 0, buttons: 4, ctas: ['call'], addToCart: false, checkout: false, prices: false,
    menu: false, hours: true, address: true, map: false, servicesPrices: false, testimonials: false, reviewPlatforms: [], booking: [],
    reservations: [], ordering: [], policies: { privacy: false, terms: false, refund: false, shipping: false }, newsletter: false,
    liveChat: false, copyrightYear: YEAR - 3, mixedContent: false, robotsTxt: true, sitemap: true,
    domain: { domain: 'sharpline-barbers.com', created: new Date(Date.now() - 6.2 * 365 * 864e5).toISOString(), expires: new Date(Date.now() + 140 * 864e5).toISOString(), registrar: 'Example Registrar, Inc.' }
  };
  var EXAMPLE_PSI = { perf: 38, seo: 75, a11y: 71, bp: 78, lcp: '6.8 s', cls: '0.24', tbt: '1,240 ms', shot: null };
})();
