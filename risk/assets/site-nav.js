/* 全站主要導覽（首頁與系統頁共用）
 * 1. 選取狀態：依目前頁面與位置更新 aria-current，不再寫死在「決策總覽」。
 *    - 首頁：預設「決策總覽」；捲到風險版圖（#signal-band）時改為「風險版圖」。
 *    - 系統頁：依網址 #/路由對應頁籤，切換路由（hashchange）時即時更新。
 * 2. 手機版選單收合（Esc 關閉、點選連結後收起）。 */
(function () {
  'use strict';
  var nav = document.getElementById('site-nav');
  if (!nav) return;
  var links = [].slice.call(nav.querySelectorAll('a[data-nav]'));
  var page = document.body.getAttribute('data-page');
  // 系統頁路由 → 頁籤；系統總覽歸在「事件情報」，資料品質歸在「方法與治理」
  var ROUTE_TAB = { overview: 'events', events: 'events', triage: 'triage', simulate: 'simulate', log: 'log', quality: 'method', method: 'method' };
  var current = null;

  function setActive(key) {
    if (key === current) return;
    current = key;
    links.forEach(function (a) {
      if (a.getAttribute('data-nav') === key) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    document.documentElement.setAttribute('data-nav-active', key);
    placeInk();
  }

  // 橡皮筋頁籤：選取底色以彈簧曲線滑到新頁籤（首次定位不動畫；直向選單與減少動態時不使用）
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ink = null, inkReady = false;
  function placeInk() {
    if (reduceMotion) return;
    if (!ink) { ink = document.createElement('span'); ink.className = 'nav-ink'; ink.setAttribute('aria-hidden', 'true'); nav.insertBefore(ink, nav.firstChild); }
    var a = nav.querySelector('a[aria-current=page]');
    var row = getComputedStyle(nav).flexDirection !== 'column' && nav.offsetParent !== null;
    if (!a || !row) { nav.classList.remove('has-ink'); inkReady = false; return; }
    if (!inkReady) ink.style.transition = 'none';
    ink.style.width = a.offsetWidth + 'px'; ink.style.height = a.offsetHeight + 'px';
    ink.style.transform = 'translate(' + a.offsetLeft + 'px,' + a.offsetTop + 'px)';
    nav.classList.add('has-ink');
    if (!inkReady) { ink.getBoundingClientRect(); ink.style.transition = ''; inkReady = true; }
  }
  window.addEventListener('resize', function () { inkReady = false; placeInk(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { inkReady = false; placeInk(); });

  if (page === 'app') {
    var fromHash = function () {
      var route = (location.hash.replace(/^#\/?/, '') || 'overview').split('?')[0];
      setActive(ROUTE_TAB[route] || 'events');
    };
    window.addEventListener('hashchange', fromHash);
    fromHash();
  } else {
    var band = document.getElementById('signal-band');
    var topH = function () { var t = document.querySelector('.top'); return t ? t.getBoundingClientRect().height : 0; };
    var fromScroll = function () {
      if (!band) return setActive('home');
      var r = band.getBoundingClientRect(), line = topH() + (window.innerHeight - topH()) * 0.35;
      setActive(r.top <= line && r.bottom > line ? 'map' : 'home');
    };
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return; ticking = true;
      window.requestAnimationFrame(function () { ticking = false; fromScroll(); });
    }, { passive: true });
    window.addEventListener('resize', fromScroll);
    window.addEventListener('hashchange', fromScroll);
    // 點同頁錨點時立即更新，不必等捲動結束
    links.forEach(function (a) {
      var href = a.getAttribute('href') || '';
      if (href.charAt(0) === '#') a.addEventListener('click', function () { setActive(a.getAttribute('data-nav')); });
    });
    fromScroll();
  }

  // 手機版選單
  var t = document.getElementById('nav-toggle');
  if (t) {
    var close = function (focusBack) { nav.classList.remove('is-open'); t.setAttribute('aria-expanded', 'false'); if (focusBack) t.focus(); };
    t.addEventListener('click', function (ev) { ev.stopPropagation(); var on = t.getAttribute('aria-expanded') !== 'true'; t.setAttribute('aria-expanded', String(on)); nav.classList.toggle('is-open', on); });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && nav.classList.contains('is-open')) close(true); });
    links.forEach(function (a) { a.addEventListener('click', function () { if (nav.classList.contains('is-open')) close(false); }); });
  }
})();
