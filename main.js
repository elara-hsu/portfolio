(function () {
  'use strict';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };

  /* ---------- 1. 載入骨架 ---------- */
  var booted = false;
  function endBoot() {
    if (booted) return; booted = true;
    document.body.classList.remove('is-booting');
    setTimeout(observeAll, 150);
  }
  var heroImg = document.querySelector('.photo-frame img');
  if (heroImg && !heroImg.complete) { heroImg.addEventListener('load', endBoot); heroImg.addEventListener('error', endBoot); }
  else setTimeout(endBoot, 300);
  setTimeout(endBoot, 3000);

  $$('.media img').forEach(function (img) {
    var box = img.closest('.media');
    var done = function () { box.classList.add('loaded'); };
    if (img.complete && img.naturalWidth) done(); else { img.addEventListener('load', done); img.addEventListener('error', done); }
  });

  /* ---------- 2. 進場：整個區塊裡的元素一起彈進來 ---------- */
  var groups = $$('.hero, .section-head, .project, .ending');
  var io = !reduce && 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.12 }) : null;
  function observeAll() { groups.forEach(function (g) { if (io) io.observe(g); else g.classList.add('in'); }); }

  /* ---------- 3. 捲動視差：照片、標籤、大字、截圖各自不同速度 ---------- */
  var layers = $$('[data-speed]').map(function (el) {
    return { el: el, speed: parseFloat(el.dataset.speed), y: 0, ready: !el.classList.contains('fx') };
  });
  layers.forEach(function (L) {
    if (!L.ready) L.el.addEventListener('transitionend', function h(e) {
      if (e.propertyName !== 'transform') return;
      L.ready = true; L.el.style.transition = 'opacity .8s'; L.el.removeEventListener('transitionend', h);
    });
  });
  var bar = document.querySelector('.progress span'), topbar = document.querySelector('.topbar');
  var small = matchMedia('(max-width: 760px)');
  function frame() {
    var vh = innerHeight, sy = scrollY, h = document.documentElement.scrollHeight - vh;
    bar.style.transform = 'scaleX(' + (h > 0 ? sy / h : 0) + ')';
    topbar.classList.toggle('scrolled', sy > 10);
    if (!reduce) {
      var k = small.matches ? 0.4 : 1;
      layers.forEach(function (L) {
        if (!L.ready) return;
        var r = L.el.getBoundingClientRect();
        if (r.bottom < -300 || r.top > vh + 300) return;
        var center = r.top + r.height / 2 - L.y - vh / 2;
        L.y = lerp(L.y, -center * L.speed * k, 0.1);
        L.el.style.transform = 'translate3d(0,' + L.y.toFixed(2) + 'px,0)';
      });
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ---------- 4. 拉扯：照片、標籤、截圖可以拉，放開彈回 ---------- */
  var lastDragMoved = false;
  if (!reduce) {
    $$('[data-pull]').forEach(function (el) {
      var sx, sy, down = false, moved = false;
      el.addEventListener('pointerdown', function (e) {
        if (e.button !== 0) return;
        down = true; moved = false; sx = e.clientX; sy = e.clientY;
      });
      el.addEventListener('pointermove', function (e) {
        if (!down) return;
        var dx = e.clientX - sx, dy = e.clientY - sy;
        if (!moved) {
          if (Math.hypot(dx, dy) < 6) return;
          // 手機上垂直滑動留給捲動
          if (e.pointerType !== 'mouse' && Math.abs(dy) > Math.abs(dx)) { down = false; return; }
          moved = true; el.classList.add('dragging');
          try { el.setPointerCapture(e.pointerId); } catch (_) {}
        }
        // 越拉越緊的阻力，加上往拉的方向伸長
        var rx = dx / (1 + Math.abs(dx) / 140), ry = dy / (1 + Math.abs(dy) / 140);
        var d = Math.min(Math.hypot(dx, dy) / 700, 0.12);
        var ang = Math.atan2(dy, dx) * 180 / Math.PI;
        el.style.transform = 'translate(' + rx.toFixed(1) + 'px,' + ry.toFixed(1) + 'px) rotate(' + ang.toFixed(1) + 'deg) scale(' + (1 + d).toFixed(3) + ',' + (1 - d * 0.6).toFixed(3) + ') rotate(' + (-ang).toFixed(1) + 'deg)';
      });
      function up() {
        if (!down) return; down = false;
        lastDragMoved = moved;
        el.classList.remove('dragging');
        el.style.transform = '';
        setTimeout(function () { lastDragMoved = false; }, 50);
      }
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('lostpointercapture', up);
    });
  }

  /* ---------- 5. 導航目前位置 ---------- */
  var navLinks = $$('.topbar nav a');
  var sections = navLinks.map(function (a) { return document.querySelector(a.getAttribute('href')); });
  function markNav() {
    var cur = -1;
    sections.forEach(function (s, i) { if (s && s.getBoundingClientRect().top < innerHeight * 0.45) cur = i; });
    navLinks.forEach(function (a, i) { a.classList.toggle('is-active', i === cur); });
  }
  addEventListener('scroll', markNav, { passive: true }); markNav();

  /* ---------- 6. 截圖放大 ---------- */
  var lb = document.querySelector('.lightbox'), lbImg = lb.querySelector('img'), lbCap = lb.querySelector('p');
  $$('.shot').forEach(function (s) {
    s.addEventListener('click', function () {
      if (lastDragMoved) return;
      var img = s.querySelector('img');
      lbImg.src = img.dataset.full || img.currentSrc || img.src; lbCap.textContent = img.alt; lb.hidden = false;
      requestAnimationFrame(function () { lb.classList.add('open'); });
    });
  });
  function closeLb() { lb.classList.remove('open'); setTimeout(function () { lb.hidden = true; }, 350); }
  lb.addEventListener('click', function (e) { if (e.target !== lbImg) closeLb(); });
  addEventListener('keydown', function (e) { if (e.key === 'Escape' && !lb.hidden) closeLb(); });

  /* ---------- 7. 名片翻面 ---------- */
  var card = document.querySelector('.bizcard');
  if (card) {
    card.addEventListener('click', function (e) {
      if (e.target.closest('a, button')) return;
      if (matchMedia('(hover: hover)').matches) return; // 電腦上滑鼠移過去就會翻
      card.classList.toggle('flipped');
    });
    card.addEventListener('keydown', function (e) {
      if ((e.key === 'Enter' || e.key === ' ') && e.target === card) { e.preventDefault(); card.classList.toggle('flipped'); }
    });
  }

  /* ---------- 8. 複製信箱 ---------- */
  var toast = document.querySelector('.toast'), tt;
  function say(m) { toast.textContent = m; toast.classList.add('show'); clearTimeout(tt); tt = setTimeout(function () { toast.classList.remove('show'); }, 2200); }
  // 點一下信箱：先選取整串（一定成功），再試著自動複製；複製失敗就安靜地停在選取狀態
  function selectText(el) {
    try { var r = document.createRange(); r.selectNodeContents(el); var s = getSelection(); s.removeAllRanges(); s.addRange(r); } catch (_) {}
  }
  function legacyCopy() { try { return document.execCommand('copy'); } catch (_) { return false; } }
  $$('.mail-addr').forEach(function (el) {
    el.setAttribute('title', '點一下複製信箱');
    el.addEventListener('click', function (e) {
      e.stopPropagation(); // 不要觸發名片翻面
      selectText(el);
      var v = el.textContent.trim();
      var ok = function () { el.classList.add('copied'); say('已複製信箱'); setTimeout(function () { el.classList.remove('copied'); }, 1600); };
      var fallback = function () { selectText(el); if (legacyCopy()) ok(); };
      try {
        if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(v).then(ok, fallback);
        else fallback();
      } catch (_) { fallback(); }
    });
  });
})();
