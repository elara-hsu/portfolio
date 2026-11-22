/* 動態層（首頁與系統頁共用）
 * 原則：內容一律先以終態渲染，動畫只用 transform／opacity 與數字遞增；失敗或關閉動態時畫面仍完整。
 *  - 骨架畫面：首屏決策卡與成果條在晶圓收斂前以微光骨架佔位；捲到 KPI／ROI／優先事件時先閃現骨架再揭露；
 *    系統頁切換時先顯示骨架再浮現內容。骨架與內容同尺寸疊放，不造成版面位移。
 *  - 橡皮筋：卡片、成果數字以彈簧曲線進場（先超出、再回彈）；ROI 數字隨參數變動彈跳；
 *    表格、頁籤列等水平捲動區拉過邊界時會被拉長、放手後彈回。按鈕按壓回彈寫在 motion.css。
 *  - 首屏所有動畫 3.0 秒內結束；使用者開啟「減少動態效果」時全部略過。 */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !document.body.animate) return;
  var page = document.body.getAttribute('data-page');

  // 彈簧（橡皮筋）關鍵影格：位移與縮放先超過終點，再小幅回彈兩次後停住
  function springFrames(dist, from) {
    var d = dist == null ? 18 : dist, s = from == null ? 0.94 : from;
    return [
      { opacity: 0, transform: 'translateY(' + d + 'px) scale(' + s + ')' },
      { opacity: 1, transform: 'translateY(' + (-d * 0.32).toFixed(1) + 'px) scale(1.03)', offset: 0.55 },
      { transform: 'translateY(' + (d * 0.12).toFixed(1) + 'px) scale(.99)', offset: 0.76 },
      { transform: 'translateY(' + (-d * 0.04).toFixed(1) + 'px) scale(1.004)', offset: 0.9 },
      { opacity: 1, transform: 'none' }
    ];
  }
  function spring(el, delay, dist, dur) {
    return el.animate(springFrames(dist), { duration: dur || 680, delay: delay || 0, easing: 'linear', fill: 'backwards' });
  }
  function boing(el) {           // 數字彈跳：放大→壓扁→回正
    if (!el || !el.animate) return;
    el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18, .9)', offset: .3 }, { transform: 'scale(.94, 1.06)', offset: .58 }, { transform: 'scale(1.03, .98)', offset: .8 }, { transform: 'scale(1)' }], { duration: 560, easing: 'linear' });
  }
  function grow(el, delay) {
    return el.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1.06)', offset: .7 }, { transform: 'scaleX(.98)', offset: .88 }, { transform: 'scaleX(1)' }], { duration: 760, delay: delay || 0, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' });
  }

  // 數字遞增：保留原文字格式，只替換其中的數字（含小數與千分位）
  var NUM = /\d[\d,]*(?:\.\d+)?/g;
  function countUp(el, dur, delay) {
    var final = el.textContent, html = el.innerHTML, parts = final.match(NUM);
    if (!parts) return;
    var vals = parts.map(function (p) { return { v: parseFloat(p.replace(/,/g, '')), d: (p.split('.')[1] || '').length, comma: p.indexOf(',') >= 0 }; });
    var t0 = performance.now() + (delay || 0), i;
    function render(k) {
      i = 0;
      el.textContent = final.replace(NUM, function () {
        var x = vals[i++], n = x.v * k;
        return x.d ? n.toFixed(x.d) : (x.comma ? Math.round(n).toLocaleString('en-US') : String(Math.round(n)));
      });
    }
    render(0);
    (function step(now) {
      if (window.__frozen) { el.innerHTML = html; return; }
      var p = Math.max(0, Math.min(1, (now - t0) / dur));
      render(1 - Math.pow(1 - p, 3));
      if (p < 1) requestAnimationFrame(step); else el.innerHTML = html;
    })(performance.now());
  }

  /* ---------- 骨架畫面 ---------- */
  // 在 host 上疊一層骨架（絕對定位、與內容同尺寸），從 start 顯示到 hideAt 後淡出；全程 Web Animations，可被 __seek 凍結
  function skeletonLayer(host, kind) {
    var sk = document.createElement('div');
    sk.className = 'skel-layer skel-' + kind; sk.setAttribute('aria-hidden', 'true');
    var bars = kind === 'kpi' ? '<i></i><i></i><i></i><i></i>'
      : kind === 'kpi-card' ? '<i class="w45 big"></i><i class="w60"></i><i class="w85"></i><i class="w70"></i>'
      : kind === 'card' ? '<i class="w35"></i><i class="w90 tall"></i><i class="w50"></i><i class="w95"></i><i class="w80"></i><i class="w88"></i><i class="w60"></i><i class="w92"></i><i class="w70"></i><i class="w45 pill"></i>'
      : '<i class="w30 tall"></i><i class="w55"></i><span class="skel-row"><i></i><i></i><i></i><i></i></span><i class="w95"></i><i class="w90"></i><i class="w92"></i><i class="w85"></i><i class="w88"></i><i class="w70"></i>';
    sk.innerHTML = bars; host.appendChild(sk);
    return sk;
  }
  function timedSkeleton(host, kind, hideAt) {
    if (!host) return;
    var sk = skeletonLayer(host, kind), fade = 260;
    sk.animate([{ opacity: 1 }, { opacity: 1, offset: 1 - fade / hideAt }, { opacity: 0 }], { duration: hideAt, fill: 'forwards' });
    [].forEach.call(sk.querySelectorAll('i'), function (b) {
      b.animate([{ backgroundPosition: '130% 0' }, { backgroundPosition: '-130% 0' }], { duration: 1050, iterations: Math.max(1, Math.floor((hideAt - fade) / 1050)), easing: 'ease-in-out' });
    });
    return sk;
  }

  /* ---------- 橡皮筋：水平捲動區拉過邊界時拉長、放手彈回 ---------- */
  function rubberBand(scroller) {
    var inner = scroller.firstElementChild;
    if (!inner || scroller.__rb) return;
    scroller.__rb = true;
    var pull = 0, startX = null, lastScroll = 0, idle;
    function maxScroll() { return scroller.scrollWidth - scroller.clientWidth; }
    function apply(px) { pull = px; inner.style.transform = px ? 'translateX(' + px.toFixed(1) + 'px)' : ''; }
    function release() {
      if (!pull) return;
      var from = pull; apply(0);
      inner.animate([{ transform: 'translateX(' + from + 'px)' }, { transform: 'translateX(' + (-from * 0.18).toFixed(1) + 'px)', offset: .55 }, { transform: 'translateX(' + (from * 0.05).toFixed(1) + 'px)', offset: .8 }, { transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.2,.7,.2,1)' });
    }
    function resist(over) { var lim = 80; return (over * lim) / (Math.abs(over) + lim); }   // 越拉越緊
    scroller.addEventListener('wheel', function (ev) {
      if (Math.abs(ev.deltaX) <= Math.abs(ev.deltaY) || maxScroll() <= 0) return;
      var atStart = scroller.scrollLeft <= 0 && ev.deltaX < 0, atEnd = scroller.scrollLeft >= maxScroll() - 1 && ev.deltaX > 0;
      if (!atStart && !atEnd) return;
      apply(resist((pull ? pull / 0.6 : 0) - ev.deltaX * 0.6));
      clearTimeout(idle); idle = setTimeout(release, 140);
    }, { passive: true });
    scroller.addEventListener('touchstart', function (ev) { startX = ev.touches[0].clientX; lastScroll = scroller.scrollLeft; }, { passive: true });
    scroller.addEventListener('touchmove', function (ev) {
      if (startX == null || maxScroll() <= 0) return;
      var dx = ev.touches[0].clientX - startX;
      if ((lastScroll <= 0 && scroller.scrollLeft <= 0 && dx > 0) || (lastScroll >= maxScroll() - 1 && scroller.scrollLeft >= maxScroll() - 1 && dx < 0)) apply(resist(dx));
    }, { passive: true });
    scroller.addEventListener('touchend', function () { startX = null; release(); }, { passive: true });
    scroller.addEventListener('touchcancel', function () { startX = null; release(); }, { passive: true });
  }
  function bindRubberBands(root) { [].forEach.call((root || document).querySelectorAll('.table-wrap, .filters, .sidenav, .attention'), rubberBand); }

  /* ---------- 首頁 ---------- */
  if (page === 'home') {
    // 首屏：成果條與決策卡先以骨架佔位，晶圓收斂到「1」時揭露（成果條 1.9 秒、決策卡 2.3 秒）
    var hk = document.getElementById('hero-kpi'), dec = document.getElementById('decision');
    timedSkeleton(hk, 'kpi', 2000);
    timedSkeleton(dec, 'card', 2380);
    if (hk) {
      [].forEach.call(hk.querySelectorAll(':scope > span'), function (n, i) { n.style.transformOrigin = 'center bottom'; n.animate(springFrames(10, 0.7), { duration: 620, delay: 1900 + i * 70, easing: 'linear', fill: 'backwards' }); });
      [].forEach.call(hk.querySelectorAll('b'), function (b, i) { countUp(b, 760, 1960 + i * 70); });
    }

    // 捲動進場：KPI、ROI、三件優先事件先閃現骨架 0.45 秒，再以橡皮筋曲線依序彈出；其他章節直接彈出
    var groups = [
      ['.band .sec-head', 0, false], ['#kpi-grid .kpi', 80, true], ['.roi', 0, true], ['#attention-list > *', 110, true],
      ['.sig-grid > *', 110, false], ['.chain', 0, false], ['#timeline > li', 70, false], ['.gate-grid, .trace-wrap', 120, false], ['.why-list > *', 80, false], ['.limits', 0, false]
    ];
    var seen = new WeakSet(), targets = [], hero = document.querySelector('.hero');
    groups.forEach(function (g) {
      [].forEach.call(document.querySelectorAll(g[0]), function (el, i) {
        if (seen.has(el) || (hero && hero.contains(el))) return;
        seen.add(el); el.__delay = Math.min(i * g[1], 450); el.__skel = g[2]; targets.push(el);
      });
    });
    function reveal(el) {
      var d = el.__delay || 0;
      spring(el, d);
      if (el.classList.contains('kpi')) { var b = el.querySelector('b'); if (b) countUp(b, 900, d + 120); }
      if (el.classList.contains('roi')) {
        var form = document.getElementById('roi-form');
        if (form && form.__replay) setTimeout(form.__replay, 180);
        [].forEach.call(el.querySelectorAll('.rb-fill'), function (f, i) { grow(f, 250 + i * 160); });
      }
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        var el = en.target;
        if (!el.__skel) return reveal(el);
        // 骨架：內容先隱形（保留尺寸），骨架微光 0.45 秒後換成內容並彈出
        el.classList.add('is-skel');
        var sk = skeletonLayer(el, el.classList.contains('kpi') ? 'kpi-card' : 'card');
        setTimeout(function () { el.classList.remove('is-skel'); if (sk.parentNode) sk.parentNode.removeChild(sk); reveal(el); }, 450 + (el.__delay || 0) * 0.5);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    targets.forEach(function (t) { io.observe(t); });

    // ROI：參數變動時大數字彈跳
    var form = document.getElementById('roi-form'), timer;
    if (form) form.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { boing(document.getElementById('roi-hours')); boing(document.getElementById('roi-year')); }, 60); });

    bindRubberBands();
  }

  /* ---------- 系統頁 ---------- */
  if (page === 'app') {
    var main = document.getElementById('main'), lastRoute = null, skelTimer;
    function enter() {
      var route = (location.hash.replace(/^#\/?/, '') || 'overview').split('?')[0];
      if (route === lastRoute) return;          // 同一頁內的篩選、排序不重播
      lastRoute = route;
      // 骨架：新頁內容已在 DOM（可被讀取與操作），先隱形 0.26 秒並顯示骨架，再依序彈出
      var old = main.querySelector(':scope > .skel-layer'); if (old) old.remove();
      main.classList.add('is-skel-page');
      var sk = skeletonLayer(main, 'page');
      clearTimeout(skelTimer);
      skelTimer = setTimeout(function () {
        main.classList.remove('is-skel-page'); if (sk.parentNode) sk.parentNode.removeChild(sk);
        var items = [].slice.call(main.querySelectorAll('.page-head, .kpis > *, .card, .table-wrap, .qc-sum, .toolbar, .banner')).filter(function (el) {
          return !el.parentElement.closest('.card');
        }).slice(0, 14);
        items.forEach(function (el, i) { spring(el, Math.min(i * 55, 500), 14, 620); });
        [].forEach.call(main.querySelectorAll('.kpi-value'), function (el, i) { countUp(el, 800, 150 + i * 50); });
        [].forEach.call(main.querySelectorAll('.hbar, .dbar'), function (el, i) { grow(el, 250 + Math.min(i * 30, 600)); });
        bindRubberBands(main);
      }, 260);
    }
    new MutationObserver(function (muts) {
      // 只在 app.js 換頁重繪時觸發；忽略骨架層本身的增減
      if (muts.some(function (m) { return [].some.call(m.addedNodes, function (n) { return n.nodeType === 1 && !n.classList.contains('skel-layer'); }); })) enter();
    }).observe(main, { childList: true });
    if (main.children.length) enter();
    bindRubberBands();
  }
})();
