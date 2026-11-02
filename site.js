// Feran Studio — site behaviour
// Change this once your domain email is live.
var STUDIO_EMAIL = 'hello@feranstudio.com';
// Paste your Google Analytics 4 Measurement ID here (looks like G-XXXXXXXXXX).
var GA_ID = '';

(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- mobile menu
  var toggle = document.querySelector('.nav-toggle');
  var links = document.getElementById('nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.textContent = open ? 'Close' : 'Menu';
    });
  }

  // ---- current page in nav
  var page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  document.querySelectorAll('.nav-links a').forEach(function (a) {
    if ((a.getAttribute('href') || '').toLowerCase() === page) a.setAttribute('aria-current', 'page');
  });

  // ---- email + copy
  document.querySelectorAll('[data-email]').forEach(function (el) { el.textContent = STUDIO_EMAIL; });
  document.querySelectorAll('[data-copy-email]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var reset = function () { setTimeout(function () { btn.textContent = 'Copy'; }, 1800); };
      var fallback = function () {
        var t = btn.parentElement.querySelector('[data-email]'); if (!t) return;
        var r = document.createRange(); r.selectNodeContents(t);
        var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
        btn.textContent = 'Selected'; reset();
      };
      try { navigator.clipboard.writeText(STUDIO_EMAIL).then(function () { btn.textContent = 'Copied'; reset(); }, fallback); }
      catch (e) { fallback(); }
    });
  });
  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  // ---- videos: play only while visible
  var vids = document.querySelectorAll('video[data-autoplay]');
  if ('IntersectionObserver' in window) {
    var vio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting && !reduce) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        else v.pause();
      });
    }, { threshold: 0.25 });
    vids.forEach(function (v) { v.muted = true; vio.observe(v); });
  }

  // ---- sound toggles on reels
  document.querySelectorAll('[data-sound]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var v = btn.closest('figure').querySelector('video');
      var on = btn.getAttribute('aria-pressed') !== 'true';
      document.querySelectorAll('[data-sound]').forEach(function (b) {
        b.setAttribute('aria-pressed', 'false');
        var ov = b.closest('figure').querySelector('video'); ov.muted = true;
      });
      if (on) { v.muted = false; v.currentTime = 0; var p = v.play(); if (p && p.catch) p.catch(function () {}); }
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  });

  // ---- scroll-through screenshots: auto-run on touch screens when in view
  var touch = window.matchMedia('(hover: none)').matches;
  if (touch && 'IntersectionObserver' in window && !reduce) {
    var sio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { e.target.classList.toggle('auto', e.isIntersecting); });
    }, { threshold: 0.6 });
    document.querySelectorAll('.shot').forEach(function (s) { sio.observe(s); });
  }

  // ---- GSAP enhancements (optional: the page works fully without them)
  if (window.gsap && window.ScrollTrigger && !reduce) {
    gsap.registerPlugin(ScrollTrigger);

    // pinned horizontal gallery on wide screens
    var track = document.querySelector('.htrack');
    var hwork = document.querySelector('.hwork');
    if (track && hwork && window.innerWidth > 900 && window.innerHeight > 520) {
      track.classList.add('pinned');
      hwork.classList.add('is-pinned');
      var bar = hwork.querySelector('.progress i');
      var hdr = document.querySelector('.site-header');
      var hh = function () { return hdr ? hdr.offsetHeight : 0; };
      // size each website so the whole screen, title and tags fit in the space left
      var fit = function () {
        hwork.style.setProperty('--hh', hh() + 'px');
        var meta = track.querySelector('.panel-meta');
        var bar2 = track.querySelector('.browser-bar');
        var extra = (bar2 ? bar2.offsetHeight : 40) + (meta ? meta.offsetHeight : 50) + 16 + 4;
        var avail = track.clientHeight - parseFloat(getComputedStyle(track).paddingTop || 0);
        var w = Math.max(320, Math.min(window.innerWidth * 0.78, 1100, (avail - extra) * 1.6));
        track.style.setProperty('--pw', Math.floor(w) + 'px');
      };
      fit();
      ScrollTrigger.addEventListener('refreshInit', fit);
      var dist = function () { return track.scrollWidth - document.documentElement.clientWidth; };
      gsap.to(track, {
        x: function () { return -dist(); }, ease: 'none',
        scrollTrigger: {
          trigger: hwork, start: function () { return 'top ' + hh() + 'px'; }, end: function () { return '+=' + dist(); },
          pin: true, scrub: 0.6, invalidateOnRefresh: true,
          onUpdate: function (self) { if (bar) bar.style.width = (self.progress * 100) + '%'; }
        }
      });
    }

    // gentle image settle as sections enter
    gsap.utils.toArray('[data-settle]').forEach(function (el) {
      gsap.fromTo(el, { scale: 1.06, y: 30 }, { scale: 1, y: 0, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'top 40%', scrub: true } });
    });

    // reels fan drifts with scroll
    gsap.utils.toArray('.reel').forEach(function (el, i) {
      gsap.to(el, { y: (i - 1) * -40, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    });
  }


  // ---- Demo websites: screens that scroll like someone is browsing
  (function () {
    var screens = document.querySelectorAll('[data-autoscroll]');
    if (!screens.length) return;
    var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var ease = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
    screens.forEach(function (box) {
      var img = box.querySelector('img'); if (!img || still) return;
      var speed = parseFloat(box.getAttribute('data-speed') || '1');
      var y = 0, from = 0, to = 0, t0 = 0, dur = 0, wait = 0, phase = 'pause', visible = false, hover = false, raf = 0;
      var max = function () { return Math.max(0, img.getBoundingClientRect().height - box.clientHeight); };
      var next = function (now) {
        var m = max(), stepH = box.clientHeight * (0.55 + Math.random() * 0.25);
        if (y >= m - 2) { from = y; to = 0; dur = 2200 / speed; }
        else { from = y; to = Math.min(m, y + stepH); dur = (900 + Math.random() * 500) / speed; }
        t0 = now; phase = 'move';
      };
      var tick = function (now) {
        raf = 0;
        if (!visible) return;
        if (!hover) {
          if (phase === 'pause') { if (now >= wait) next(now); }
          else {
            var k = Math.min(1, (now - t0) / dur); y = from + (to - from) * ease(k);
            img.style.transform = 'translate3d(0,' + (-y).toFixed(1) + 'px,0)';
            if (k >= 1) { phase = 'pause'; wait = now + (to === 0 ? 1600 : 900 + Math.random() * 900); }
          }
        } else { wait = now + 600; }
        raf = requestAnimationFrame(tick);
      };
      box.addEventListener('mouseenter', function () { hover = true; });
      box.addEventListener('mouseleave', function () { hover = false; });
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (es) {
          es.forEach(function (e) { visible = e.isIntersecting; if (visible && !raf) { wait = performance.now() + 700; phase = 'pause'; raf = requestAnimationFrame(tick); } });
        }, { threshold: 0.25 }).observe(box);
      } else { visible = true; raf = requestAnimationFrame(tick); }
    });
  })();

  // ---- Demo filter
  (function () {
    var bar = document.querySelector('.demo-filter'); if (!bar) return;
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var f = b.getAttribute('data-filter');
      bar.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
      document.querySelectorAll('.demo').forEach(function (d) { d.hidden = !(f === 'all' || d.getAttribute('data-cat') === f); });
    });
  })();

  // ---- Prefill contact form from a demo
  (function () {
    var msg = document.getElementById('f-msg'); if (!msg) return;
    try {
      var d = new URLSearchParams(location.search).get('demo');
      var names = { sharpline: 'Sharpline (barbershop)', ember: 'Ember & Oak (restaurant)', aurelle: 'Aurelle (Shopify store)', bluewave: 'Bluewave Dental (clinic)', velvet: 'Velvet Rose (salon & spa)', lumen: 'Lumen (WooCommerce store)', ironline: 'Ironline (gym)', kofi: 'Kofi Roasters (Wix store)', hartcole: 'Hart & Cole (law firm)' };
      if (d && names[d] && !msg.value) msg.value = 'Hi Feran Studio, I would like a website like your ' + names[d] + ' demo for my business. ';
    } catch (e) {}
  })();

  // ---- From Sketch to Live opening
  var intro = document.querySelector('.intro');
  if (intro) {
    var wall = intro.querySelector('.wall');
    var main = intro.querySelector('.tile-main');
    var k0 = 2.6;
    var clamp = function (v) { return Math.max(0, Math.min(1, v)); };
    var ease = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
    var measure = function () {
      var cw = main.offsetWidth, ch = main.offsetHeight;
      var stage = intro.querySelector('.stage');
      k0 = Math.min((stage.clientWidth * 0.9) / cw, (stage.clientHeight * 0.74) / ch);
      k0 = Math.max(1, k0);
    };
    var set = function (p2, p3, p4) {
      intro.style.setProperty('--p2', p2.toFixed(4));
      intro.style.setProperty('--p3', p3.toFixed(4));
      intro.style.setProperty('--p4', p4.toFixed(4));
      intro.style.setProperty('--k', (k0 + (1 - k0) * ease(p3)).toFixed(4));
    };
    measure();
    if (reduce) {
      intro.classList.add('static'); set(1, 1, 1);
    } else {
      var ticking = false;
      var update = function () {
        ticking = false;
        var r = intro.getBoundingClientRect();
        var total = intro.offsetHeight - window.innerHeight;
        var p = clamp(-r.top / (total || 1));
        set(clamp((p - 0.04) / 0.36), clamp((p - 0.44) / 0.34), clamp((p - 0.76) / 0.18));
      };
      var onScroll = function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', function () { measure(); update(); });
      update();
    }
  }

  // ---- back to top
  document.querySelectorAll('[data-top]').forEach(function (b) {
    b.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); });
  });

  // ---- newsletter (Netlify Forms when live)
  var news = document.getElementById('news-form');
  if (news) {
    news.addEventListener('submit', function (e) {
      var liveSite = /feranstudio\.com$/.test(location.hostname) || /netlify\.app$/.test(location.hostname);
      if (!news.checkValidity()) return;
      e.preventDefault();
      var msg = document.getElementById('news-done');
      if (liveSite) {
        fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(new FormData(news)).toString() })
          .then(function () { msg.textContent = 'You’re on the list. Thank you.'; msg.hidden = false; news.reset(); })
          .catch(function () { msg.textContent = 'That didn’t go through. Please try again.'; msg.hidden = false; });
      } else { msg.textContent = 'Preview only: sign-ups start once the site is live.'; msg.hidden = false; }
    });
  }

  // ---- cookie consent + Google Analytics (loads only after "Accept")
  var CONSENT_KEY = 'fs-consent';
  var getConsent = function () { try { return localStorage.getItem(CONSENT_KEY); } catch (e) { return null; } };
  var setConsent = function (v) { try { localStorage.setItem(CONSENT_KEY, v); } catch (e) {} };
  var gaLoaded = false;
  var loadGA = function () {
    if (gaLoaded || !GA_ID) return; gaLoaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { dataLayer.push(arguments); };
    gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'granted' });
    gtag('js', new Date()); gtag('config', GA_ID, { anonymize_ip: true });
    var sc = document.createElement('script'); sc.async = true; sc.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID; document.head.appendChild(sc);
  };
  var banner = document.getElementById('cookie');
  if (banner) {
    var c = getConsent();
    if (c === 'accept') loadGA(); else if (!c) banner.hidden = false;
    banner.querySelectorAll('[data-cookie]').forEach(function (b) {
      b.addEventListener('click', function () {
        var v = b.getAttribute('data-cookie'); setConsent(v); banner.hidden = true;
        if (v === 'accept') loadGA();
      });
    });
    document.querySelectorAll('[data-cookie-settings]').forEach(function (b) {
      b.addEventListener('click', function () { banner.hidden = false; var f = banner.querySelector('button'); if (f) f.focus(); });
    });
  }

  // ---- contact form: Netlify Forms when live, preview message elsewhere
  var form = document.getElementById('contact-form');
  if (form) {
    var live = /feranstudio\.com$/.test(location.hostname) || /netlify\.app$/.test(location.hostname);
    form.addEventListener('submit', function (e) {
      if (!form.checkValidity() || live) return;
      e.preventDefault();
      document.getElementById('done-name').textContent = (document.getElementById('f-name').value.split(' ')[0]) || 'there';
      var done = document.getElementById('form-done'); done.hidden = false;
      done.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }
})();
