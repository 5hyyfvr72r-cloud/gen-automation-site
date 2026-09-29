/* site.js: Gen Automation's shared page behavior. Load at the end of <body>,
   after scrollcraft.js (if the page uses it). Top bar state, current-page
   link, mobile drawer, footer year, scroll reveal, spotlight re-aim, demo
   links. */

(function () {
  // Top bar gets its ground once the page scrolls.
  var bar = document.querySelector('.site-bar');
  if (!bar) return;
  function sync() { bar.classList.toggle('is-scrolled', window.scrollY > 20); }
  window.addEventListener('scroll', sync, { passive: true });
  sync();
})();

(function () {
  // Mark the current page's nav links (top bar and drawer).
  function norm(p) { return (p.replace(/index\.html$/, '').replace(/\/+$/, '') || '/'); }
  var here = norm(location.pathname);
  Array.prototype.forEach.call(document.querySelectorAll('[data-nav]'), function (a) {
    if (norm(a.getAttribute('href')) === here) a.setAttribute('aria-current', 'page');
  });
})();

(function () {
  // Footer year.
  Array.prototype.forEach.call(document.querySelectorAll('[data-year]'), function (el) {
    el.textContent = new Date().getFullYear();
  });
})();

(function () {
  // Mobile drawer.
  var toggle = document.getElementById('menuToggle');
  var menu = document.getElementById('siteMenu');
  var scrim = document.getElementById('siteMenuScrim');
  if (!toggle || !menu || !scrim) return;

  menu.setAttribute('inert', '');

  function open() {
    menu.classList.add('is-open');
    scrim.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
    menu.removeAttribute('inert');
    document.body.style.overflow = 'hidden';
  }
  function close() {
    menu.classList.remove('is-open');
    scrim.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    menu.setAttribute('inert', '');
    document.body.style.overflow = '';
  }

  toggle.addEventListener('click', function () {
    if (menu.classList.contains('is-open')) close(); else open();
  });
  scrim.addEventListener('click', close);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menu.classList.contains('is-open')) close();
  });
  Array.prototype.forEach.call(menu.querySelectorAll('a'), function (link) {
    link.addEventListener('click', close);
  });
  // Widening past the breakpoint with the drawer open would strand it.
  window.matchMedia('(min-width: 901px)').addEventListener('change', function (e) {
    if (e.matches && menu.classList.contains('is-open')) close();
  });
})();

(function () {
  // Loom walkthroughs. Paste each Loom share URL here; empty ones stay hidden.
  // A slot [data-loom="key"] gets its embed only when its row is opened.
  var LOOMS = {
    outbound: 'https://www.loom.com/share/9621d9c0748d416da0ffc590b3ede4e3',
    speed:    'https://www.loom.com/share/4427cce2db1b4d709d308279f4154713',
    quote:    'https://www.loom.com/share/8a831d1ba2e2429786664765f82ae5c6'
  };
  function embedUrl(url) { return url.replace('/share/', '/embed/').split('?')[0]; }
  Array.prototype.forEach.call(document.querySelectorAll('[data-loom]'), function (slot) {
    var url = LOOMS[slot.getAttribute('data-loom')];
    if (!url) return;
    slot.hidden = false;
    function load() {
      if (slot.querySelector('iframe')) return;
      var f = document.createElement('iframe');
      f.src = embedUrl(url);
      f.title = slot.getAttribute('data-title') || 'Walkthrough video';
      f.allow = 'fullscreen';
      f.setAttribute('allowfullscreen', '');
      f.loading = 'lazy';
      slot.appendChild(f);
    }
    var row = slot.closest('details');
    if (!row) { load(); return; }
    if (row.open) load();
    row.addEventListener('toggle', function () { if (row.open) load(); });
  });
})();

(function () {
  // The engine re-aims each spotlight only on pointermove, so scrolling with
  // a still mouse carries the glow off with the page. Re-aim on scroll too.
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  var spots = document.querySelectorAll('[data-sc-spotlight]');
  if (!spots.length) return;
  var x = null, y = null, queued = false;
  function clamp01(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }
  addEventListener('pointermove', function (e) {
    if (e.pointerType === 'mouse') { x = e.clientX; y = e.clientY; }
  }, { passive: true });
  function aim() {
    queued = false;
    if (x === null) return;
    for (var i = 0; i < spots.length; i++) {
      var r = spots[i].getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) continue;
      spots[i].style.setProperty('--sc-mx', clamp01((x - r.left) / r.width).toFixed(3));
      spots[i].style.setProperty('--sc-my', clamp01((y - r.top) / r.height).toFixed(3));
    }
  }
  addEventListener('scroll', function () {
    if (!queued) { queued = true; requestAnimationFrame(aim); }
  }, { passive: true });
})();

(function () {
  // Scroll-linked reveal. Each [data-reveal] fades, rises and settles as it
  // crosses the lower part of the viewport. Anything on the first screen is
  // shown whole on load; elements too close to the page bottom finish at max
  // scroll. Nothing is pre-hidden in CSS, so without JS (or with reduced
  // motion) everything simply shows.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var els = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));
  if (!els.length) return;

  var RISE = 52, SCALE = 0.965, WINDOW = 0.36, LEAD = 0.12, SIBLING_DELAY = 70;

  var items = els.map(function (el) {
    var it = { el: el, units: null };
    if (el.getAttribute('data-reveal') === 'words') {
      var words = el.textContent.trim().split(/\s+/);
      el.textContent = '';
      it.units = words.map(function (w, i) {
        var s = document.createElement('span');
        s.textContent = w;
        s.style.display = 'inline-block';
        el.appendChild(s);
        if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
        return s;
      });
    }
    return it;
  });

  var vh, maxScroll;
  function measure() {
    vh = window.innerHeight;
    maxScroll = Math.max(document.documentElement.scrollHeight - vh, 0);
    var y = window.scrollY, prevTop = null, run = 0;
    items.forEach(function (it) {
      it.el.style.transform = 'none';
      var top = it.el.getBoundingClientRect().top + y;
      // Items sharing a row stagger slightly.
      run = (prevTop !== null && Math.abs(top - prevTop) < 4) ? run + 1 : 0;
      prevTop = top;
      var start = vh * (1 + LEAD) - run * SIBLING_DELAY;
      var end = start - vh * WINDOW;
      var lowest = top - maxScroll;
      if (lowest > end) { end = lowest; start = Math.max(end + vh * 0.15, Math.min(start, end + vh * WINDOW)); }
      if (top < vh) { end = Math.max(end, top); start = end + vh * WINDOW; }
      it.top = top; it.start = start; it.end = end;
    });
  }

  function smooth(t) { return t * t * (3 - 2 * t); }
  function clamp01(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }

  var queued = false;
  function update() {
    queued = false;
    var y = window.scrollY;
    items.forEach(function (it) {
      var p = clamp01((it.start - (it.top - y)) / Math.max(it.start - it.end, 1));
      if (it.units) {
        var n = it.units.length;
        it.el.style.opacity = '1';
        it.el.style.transform = 'none';
        it.units.forEach(function (u, i) {
          var from = (i / n) * 0.5;
          var up = smooth(clamp01((p - from) / 0.5));
          u.style.opacity = up.toFixed(3);
          u.style.transform = 'translate3d(0,' + ((1 - up) * 0.6).toFixed(3) + 'em,0)';
        });
      } else {
        var v = smooth(p);
        it.el.style.opacity = v.toFixed(3);
        it.el.style.transform = v >= 1 ? 'none'
          : 'translate3d(0,' + ((1 - v) * RISE).toFixed(2) + 'px,0) scale(' + (SCALE + (1 - SCALE) * v).toFixed(4) + ')';
      }
    });
  }
  function queue() { if (!queued) { queued = true; requestAnimationFrame(update); } }

  measure(); update();
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', function () { measure(); queue(); });
  window.addEventListener('load', function () { measure(); queue(); });
  // The engine sizes pinned acts after this runs; re-measure when height changes.
  if ('ResizeObserver' in window) new ResizeObserver(function () { measure(); queue(); }).observe(document.body);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { measure(); queue(); });
})();
