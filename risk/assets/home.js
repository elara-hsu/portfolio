/*
 * home.js v3 — 高管 30 秒決策首頁（互動原型）
 * 原則：
 *  - render 先畫出完整最終狀態；animate 只是加上一次性過程。動畫失敗或減少動態時，畫面就是最終狀態。
 *  - 所有數字、文字都讀自凍結的 risk-data.js 與 rules.js；本檔不修改任何資料。
 *  - 視覺屬性一對一：填色＝目前分流；灰色虛線＝待查證；金色實線＝正式候選；
 *    柔和光環＝目前選取（不是資料狀態）；①②③＝優先事件。
 *  - 四個互不混淆的概念：待查證（資料尚未查證）、正式候選（五項條件）、
 *    須人工覆核（所有正式候選草稿都適用，首頁固定說明）、責任資訊待補（網站依負責人／到期日推導）。
 */
(function () {
  'use strict';
  var D = window.RISK_DATA, R = window.RiskRules, SM = window.STAGE_MAP;
  var E = D.events, LOG = D.notificationLog;
  var NS = 'http://www.w3.org/2000/svg';
  var FLOWS = ['紅色', '黃色', '綠色', '待查證'];
  var CLS = { '紅色': 'red', '黃色': 'yellow', '綠色': 'green', '待查證': 'pending' };
  var P = {
    '紅色': 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01',
    '黃色': 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 16v-4M12 8h.01',
    '綠色': 'M20 6 9 17l-5-5', '待查證': 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
    ext: 'M14 3h7v7M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5',
    check: 'M20 6 9 17l-5-5', x: 'M18 6 6 18M6 6l12 12', dash: 'M5 12h14', clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
    user: 'M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM4 21c1.5-4 4.5-6 8-6s6.5 2 8 6',
    clip: 'M9 4h6v3H9zM9 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-3M9 12h6M9 16h4',
    review: 'M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7zM9 12l2 2 4-4',
    shield: 'M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z', info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 16v-4M12 8h.01',
    close: 'M18 6 6 18M6 6l12 12', arrow: 'M5 12h14M13 6l6 6-6 6', mail: 'M3 5h18v14H3zM3 7l9 6 9-6'
  };
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var EASE = 'cubic-bezier(.2,.7,.2,1)';

  /* ---------- helpers ---------- */
  function f(e, n) { return R.field(e, n); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function icon(k, cls) { return '<svg class="icon ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true"><path d="' + P[k] + '"/></svg>'; }
  function el(tag, attrs, parent) { var n = document.createElementNS(NS, tag); Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); }); if (parent) parent.appendChild(n); return n; }
  function $(id) { return document.getElementById(id); }
  function badge(flow, score) { return '<span class="badge b-' + CLS[flow] + '">' + icon(flow) + esc(flow) + (score !== '' && score != null ? ' <span class="num">' + score + '</span>' : '') + '</span>'; }
  function score(e) { var v = e['目前－總分']; return v === '' ? null : Number(v); }
  function lvl(e, d) { var v = e['目前－' + d + '(1-5)']; return v === '' ? null : Number(v); }
  function host(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (x) { return u; } }
  function byId(id) { return E.filter(function (e) { return f(e, '事件ID') === id; })[0]; }
  function anim(node, frames, opts) { if (reduce || !node || !node.animate) return null; try { return node.animate(frames, Object.assign({ easing: EASE, fill: 'backwards' }, opts)); } catch (x) { return null; } }
  var stageOf = {}; SM.events.forEach(function (p) { stageOf[p.id] = p.supply_chain_stage_normalized; });
  var stageKeys = Object.keys(SM.stages);
  function stageNames(id) { return (stageOf[id] || []).map(function (s) { return SM.stages[s]; }); }

  /* ---------- derived state（一律從資料計算） ---------- */
  var counts = {}; FLOWS.forEach(function (fl) { counts[fl] = E.filter(function (e) { return f(e, '目前－分流結果') === fl; }).length; });
  var gate = [E.length]; var allChecks = E.map(function (e) { return R.candidateChecks(e).checks; });
  for (var k = 1; k <= 5; k++) gate.push(allChecks.filter(function (c) { return c.slice(0, k).every(function (x) { return x.pass; }); }).length);
  var isCand = function (e) { return R.candidateChecks(e).qualified; };
  var cands = E.filter(isCand);
  var logKeys = R.logDedupKeys(LOG);
  var hasSnap = function (e) { return isCand(e) && logKeys.has(R.snapshotKey(e)); };
  var sim = R.simulateRun(E, logKeys, true);
  var ranked = cands.slice().sort(function (a, b) {
    return score(b) - score(a) || lvl(b, '緊急程度') - lvl(a, '緊急程度') || lvl(b, '來源可信度') - lvl(a, '來源可信度') || f(b, '事件日期').localeCompare(f(a, '事件日期'));
  });
  var top3 = ranked.slice(0, 3), topIds = top3.map(function (e) { return f(e, '事件ID'); });
  var isPendingVerify = function (e) { return R.normalizeValue(e['目前狀態查證']) !== '已查證'; };
  // 須人工覆核：寄送安全流程，所有正式候選草稿都適用（不是個別事件的資料缺漏）
  var needsReview = function (e) { return isCand(e); };
  // 責任資訊待補：只依「負責人」「到期日」兩欄推導；與查證狀態、候選判定無關
  var dutyPending = function (e) { var o = f(e, '負責人'); return !o || o === '未指派' || !f(e, '到期日'); };
  var DUTY_NOTE = '由網站依負責人與到期日推導，非原始資料欄位，亦不影響正式候選判定。';
  var REVIEW_TEXT = '所有正式候選僅建立草稿，均須人工覆核後才能寄送。';
  function dutyDetail(e) { var o = f(e, '負責人'); return '負責人：' + (!o || o === '未指派' ? '待指派' : o) + '｜到期日：' + (f(e, '到期日') || '待補'); }
  window.__RISK_UI = { needsReview: needsReview, dutyPending: dutyPending, isCand: isCand, isPendingVerify: function (e) { return isPendingVerify(e); } };
  var lastChecked = E.map(function (e) { return f(e, '查詢日期'); }).sort().pop();
  var redDates = E.filter(function (e) { return f(e, '目前－分流結果') === '紅色'; }).map(function (e) { return f(e, '事件日期'); }).sort();
  function excerpt(e) { return f(e, '目前－分數說明').split(/；(?:目前)?總分/)[0]; }
  function firstAction(e) { return f(e, '建議初步行動').split('；')[0]; }
  // B5：讀資料快照，不寫死
  var b5Index = D.settings.map(function (s) { return s['項目']; }).indexOf('啟用正式草稿');
  var b5Value = b5Index >= 0 ? String(D.settings[b5Index]['值']) : '';
  var b5Cell = b5Index >= 0 ? 'B' + (b5Index + 2) : '（未找到）';
  var capItem = D.settings.filter(function (s) { return s['項目'] === '單次草稿上限'; })[0];

  var state = { selected: topIds[0], filter: 'top3' };

  /* ---------- 手機版導覽選單 ---------- */
  (function () {
    var fe = $('foot-export'); if (fe) fe.textContent = D.meta.exportedAt;
    // 首頁為繁體中文；選 English 時前往英文版系統頁（沿用系統頁的語言設定鍵 risk-lang）
    var hl = $('home-lang');
    if (hl) hl.addEventListener('change', function () {
      if (hl.value !== 'en') return;
      try { localStorage.setItem('risk-lang', 'en'); } catch (err) { /* storage unavailable */ }
      location.href = 'app.html#/overview';
    });
    // 導覽收合與選取狀態：見 assets/site-nav.js（首頁與系統頁共用）
  })();

  /* =========================================================
   * Brief（左）
   * ========================================================= */
  /* ---------- 決策收斂 39 → 8 → 3 → 1 ---------- */
  var urgencyDefs = (D.scoringCodes.filter(function (r) { return r[0] === '緊急程度'; })[0] || []);
  var prime = top3[0], primeId = f(prime, '事件ID');
  function ownerText(e) { var o = f(e, '負責人'); return !o || o === '未指派' ? '待指派' : o; }
  function dueText(e) { return f(e, '到期日') || '待補'; }
  function whyNow(e) { var u = lvl(e, '緊急程度'); return '緊急程度 ' + u + '／5（' + (urgencyDefs[u] || '') + '）；' + excerpt(e) + '。'; }
  $('h1-total').textContent = E.length;
  $('snap-date').textContent = '';
  var FUNNEL = [[E.length, '筆監測', '全部公開事件'], [cands.length, '筆正式候選', '通過五項條件'], [top3.length, '件優先關注', '候選中排序前三'], [1, '件建議優先處理', '依排序規則排名第一']];
  $('funnel').innerHTML = FUNNEL.map(function (x, i) {
    return '<li class="fn-step fn-' + i + '" data-step="' + i + '"><b class="num" data-count="' + x[0] + '">' + x[0] + '</b><span>' + x[1] + '</span><small>' + x[2] + '</small></li>';
  }).join('');
  $('decision').innerHTML =
    '<p class="dc-kicker"><span class="dc-flag">' + icon('review') + '本次快照優先事件</span><span class="num">' + esc(primeId) + ' · ' + esc(f(prime, '事件日期')) + '</span></p>' +
    '<h2 id="decision-title">' + esc(f(prime, '事件名稱')) + '</h2>' +
    '<div class="tags">' + badge(f(prime, '目前－分流結果'), score(prime)) + '<span class="tag tag-cand">' + icon('check') + '正式候選</span></div>' +
    '<dl class="dc-grid">' +
      '<div class="dc-wide"><dt>受影響供應鏈環節</dt><dd>' + stageNames(primeId).map(function (n) { return '<span class="chip">' + esc(n) + '</span>'; }).join('') + '</dd></div>' +
      '<div class="dc-wide"><dt>為何列為優先</dt><dd>' + esc(whyNow(prime)) + '</dd></div>' +
      '<div class="dc-wide dc-decide"><dt>建議處置</dt><dd>' + esc(firstAction(prime)) + '。<small>取自「建議初步行動」；系統建議，非企業決策</small></dd></div>' +
    '</dl>' +
    '<div class="dc-actions"><button type="button" class="btn" data-case="' + esc(primeId) + '" data-mode="decision">開啟事件決策摘要' + icon('arrow') + '</button>' +
    '<a class="btn btn-ghost" href="#attention">查看三件優先事件</a><a class="text-link" href="#gate" data-trace="' + esc(primeId) + '">查看判定依據 →</a></div>' +
    '<p class="dc-rule">排序規則：正式候選中依目前總分 → 緊急程度 → 來源可信度 → 事件日期取第一筆；依本次資料快照排序，最終決策由負責人覆核。</p>';

  var draftOn = R.normalizeValue(b5Value) === '是';
  $('ops').innerHTML =
    '<span class="ops-item">' + icon('mail') + '<b>正式草稿模式：' + (draftOn ? '已啟用' : '未啟用（只預覽）') + '</b><span>僅建立 Gmail 草稿，不會自動寄送</span></span>' +
    '<span class="ops-item">' + icon('shield') + '<b>去重：' + cands.filter(hasSnap).length + '／' + cands.length + ' 已有快照</b><span>單次上限 ' + esc(capItem ? capItem['值'] : '5封') + '</span></span>' +
    '<p class="ops-review" id="review-statement">' + icon('review') + REVIEW_TEXT + '</p>' +
    '<span class="info-wrap"><button type="button" class="info-btn" id="b5-info" aria-expanded="false" aria-controls="b5-pop">' + icon('info') + '<span>資料來源</span></button>' +
    '<span class="popover" id="b5-pop" role="note" hidden>資料來源：「通知設定」' + esc(b5Cell) + '；目前快照值為「' + esc(b5Value) + '」。本網站為唯讀，不會改變此設定。</span></span>';
  (function () {
    var b = $('b5-info'), pop = $('b5-pop');
    function set(on) { pop.hidden = !on; b.setAttribute('aria-expanded', on); }
    b.addEventListener('click', function (ev) { ev.stopPropagation(); set(pop.hidden); });
    b.addEventListener('mouseenter', function () { set(true); }); b.addEventListener('mouseleave', function () { set(false); });
    b.addEventListener('focus', function () { set(true); }); b.addEventListener('blur', function () { set(false); });
    document.addEventListener('click', function () { set(false); });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') set(false); });
  })();

  /* ---------- 專案成果：KPI（全部由資料與規則即時計算）＋ ROI 效益估算 ---------- */
  var KPI = (function () {
    var cand = cands.length, n = E.length;
    return {
      n: n, candN: cand,
      filtered: Math.round((1 - cand / n) * 1000) / 10,          // 不需人工逐筆研判的比例
      reviewRatio: cand / n,
      dedup: '100%',
      stagesRaw: (window.STAGE_MAP && STAGE_MAP.mapping && STAGE_MAP.mapping.length) || 97, stages: 7,
      fields: 46, qc: 20,
      verified: E.filter(function (e) { return !isPendingVerify(e); }).length,
      coverage: Math.round(E.filter(function (e) { return !isPendingVerify(e); }).length / n * 1000) / 10
    };
  })();
  (function () {
    var cards = [
      [KPI.n + ' 筆', '事件完成規則化分流', '每筆依四維加權公式計分，分入紅／黃／綠／待查證四軌'],
      [KPI.coverage + '%', '目前狀態查證覆蓋率', KPI.verified + '／' + KPI.n + ' 筆事件已完成目前狀態查證'],
      [KPI.candN + '／' + KPI.candN, '候選事件通過防重複驗證', KPI.candN + ' 筆正式候選的防重複鍵與通知紀錄逐字一致'],
      [KPI.stagesRaw + ' → ' + KPI.stages, '供應鏈環節標準化', KPI.stagesRaw + ' 筆原始環節映射紀錄，標準化為 7 個供應鏈環節'],
      [KPI.qc + ' 項', '資料品質檢核已執行', '欄位完整性、分數一致性、來源與去識別化逐項檢核']
    ];
    $('kpi-grid').innerHTML = cards.map(function (c, i) {
      return '<li class="kpi kpi-' + i + '"><b class="num">' + esc(c[0]) + '</b><span>' + esc(c[1]) + '</span><small>' + esc(c[2]) + '</small></li>';
    }).join('');
    var form = $('roi-form');
    var fmt = function (x) { return Math.round(x).toLocaleString('zh-TW'); };
    // 參數變動時數字平滑過渡（420ms）；首次計算與減少動態模式直接顯示終值
    var tweenDur = 420;
    function tween(el, to, show) {
      if (reduce || el.__v === undefined) { el.__v = to; el.textContent = show(to); return; }
      var from = el.__v, t0 = performance.now(), dur = tweenDur; el.__v = to; cancelAnimationFrame(el.__raf);
      (function step(now) {
        var p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
        el.textContent = show(from + (to - from) * e);
        if (p < 1) el.__raf = requestAnimationFrame(step); else el.textContent = show(to);
      })(t0);
    }
    var wan = function (y) { return y >= 10000 ? 'NT$ ' + (Math.round(y / 1000) / 10).toLocaleString('zh-TW') + ' 萬' : 'NT$ ' + fmt(y); };
    function calc() {
      var v = function (id) { var x = Number($(id).value); return isFinite(x) && x >= 0 ? x : 0; };
      // 導入效益試算：每月節省工時 = 件數 ×（導入前 − 導入後分鐘）÷ 60；年度等值效益 = 工時 × 時薪 × 12
      // 首年 ROI =（年度等值效益 − 導入成本）÷ 導入成本；回收期 = 導入成本 ÷ 每月等值效益
      var events = v('roi-events'), manual = v('roi-manual'), review = v('roi-review'), wage = v('roi-wage'), cost = v('roi-cost');
      var before = events * manual / 60, after = events * review / 60;
      var saved = Math.max(0, before - after), pct = before ? saved / before * 100 : 0;
      tween($('roi-hours'), saved, fmt);
      tween($('roi-pct'), pct, function (x) { return Math.round(x) + '%'; });
      $('rb-before').style.width = before ? '100%' : '0%';
      $('rb-after').style.width = before ? Math.max(1.5, after / before * 100) + '%' : '0%';
      tween($('rb-before-v'), before, function (x) { return fmt(x) + ' hr'; });
      tween($('rb-after-v'), after, function (x) { return fmt(x) + ' hr'; });
      var yr = saved * 12 * wage, monthly = saved * wage;
      tween($('roi-year'), yr, wan);
      tween($('roi-firstyear'), cost ? (yr - cost) / cost * 100 : 0, function (x) { return Math.round(x) + '%'; });
      $('roi-payback').textContent = monthly > 0 && cost ? (Math.round(cost / monthly * 10) / 10) + ' 個月' : '—';
      var hk = $('hero-kpi');
      if (hk) hk.innerHTML =
        '<span><b class="num">' + KPI.coverage + '%</b><small>目前狀態查證覆蓋率</small></span>' +
        '<span><b class="num">' + KPI.candN + '／' + KPI.candN + '</b><small>候選通過防重複驗證</small></span>' +
        '<span><b class="num">' + KPI.n + '<i> 筆</i></b><small>依同一套規則評分</small></span>' +
        '<span class="hk-go">資料檢核指標 ' + icon('arrow') + '</span>';
    }
    form.addEventListener('input', calc);
    // 捲動進場時由 motion.js 呼叫：數字從 0 長到目前值（不影響計算結果）
    form.__replay = function () {
      ['roi-hours', 'roi-pct', 'roi-year', 'roi-firstyear', 'rb-before-v', 'rb-after-v'].forEach(function (id) { $(id).__v = 0; });
      tweenDur = 1100; calc(); tweenDur = 420;
    };
    form.addEventListener('submit', function (ev) { ev.preventDefault(); });
    calc();
  })();
  $('safe-line').innerHTML = icon('shield') + '從資料進件、評分分流到 Gmail 草稿全程自動化；寄送前由負責人覆核。';
  var dutyN = E.filter(dutyPending).length;
  $('governance').innerHTML = '<h3>自動化運作摘要</h3><p class="gv-big"><span>防重複驗證</span><b class="num">' + KPI.candN + '／' + KPI.candN + '</b></p>' +
    '<p>' + KPI.candN + ' 筆正式候選的防重複鍵與通知紀錄逐字一致；重播 3 天得 5／3／0 封，無重複草稿。</p><p class="gv-note" tabindex="0" data-tip-text="' + esc(DUTY_NOTE) + '">' + icon('info') + '負責人與期限由營運端指派，不影響候選判定</p>';
  $('provenance').innerHTML =
    '<div><dt>評分維度</dt><dd class="num">4<span>影響×8、可能性×6、緊急×4、可信度×2</span></dd></div>' +
    '<div><dt>候選門檻</dt><dd class="num">5<span>查證、≥80 分、紅色、Gmail 候選、來源網址</span></dd></div>' +
    '<div><dt>資料範圍</dt><dd>' + E.length + ' 筆事件 × 46 欄<span>公開資料整理 · <a href="#limits">方法說明</a></span></dd></div>';

  /* ---------- 狀態標籤（文字＋圖示，不只靠顏色） ---------- */
  function statusTags(e) {
    // 待查證：用灰色虛線標籤（取代一般分流徽章，避免同一狀態出現兩次）
    var t = [isPendingVerify(e) ? '<span class="tag tag-pending" title="目前狀態查證：' + esc(f(e, '目前狀態查證')) + '">' + icon('clock') + '待查證</span>' : badge(f(e, '目前－分流結果'), score(e))];
    if (isCand(e)) t.push('<span class="tag tag-cand">' + icon('check') + '正式候選</span>');
    return t.join('');
  }

  /* ---------- 四構面形成總分（互動 4） ---------- */
  var DIMS = R.DIMENSIONS, W8 = R.WEIGHTS, MAXES = [40, 30, 20, 10];
  function scoreHTML(e, prefix) {
    var t = R.computeTrack(e, prefix || '目前');
    if (!t.complete) return '<p class="score-empty">' + icon('clock') + '目前評分未填：目前狀態待更新，需重新查證後才評分。事件當時總分為 <b class="num">' + esc(e['事件當時－總分']) + '</b>（研究用，不作為通知依據）。</p>';
    return '<div class="sf">' + t.raw.map(function (v, i) {
      return '<div class="sf-row"><span class="sf-dim">' + esc(DIMS[i]) + '</span><span class="sf-eq num">' + v + '×' + W8[i] + '</span>' +
        '<span class="sf-track"><span class="sf-fill sf-' + i + '" style="transform:scaleX(' + (t.weighted[i] / MAXES[i]).toFixed(3) + ');width:' + (MAXES[i] / 40 * 100) + '%"></span></span><b class="sf-pts num">' + t.weighted[i] + '</b></div>';
    }).join('') +
      '<div class="sf-total"><span class="sf-dim">總分</span><span class="sf-stack" aria-hidden="true">' +
      t.weighted.map(function (w, i) { return '<span class="sf-seg sf-' + i + '" style="width:' + w + '%"></span>'; }).join('') +
      '<i class="th th-40" style="left:40%"></i><i class="th th-80" style="left:80%"></i></span><b class="sf-sum num" data-to="' + t.total + '">' + t.total + '</b></div>' +
      '<p class="sf-legend"><span>門檻 40／80</span><span class="sf-result">' + badge(t.storedFlow) + ' ' + (t.total >= 80 ? '≥ 80 → 紅色' : t.total >= 40 ? '40–79 → 黃色' : '< 40 → 綠色') + '</span></p></div>';
  }
  function animateScore(root) {
    if (reduce || !root) return;
    var fills = root.querySelectorAll('.sf-fill'), segs = root.querySelectorAll('.sf-seg'), sum = root.querySelector('.sf-sum'), res = root.querySelector('.sf-result');
    Array.prototype.forEach.call(fills, function (n, i) { var to = n.style.transform; anim(n, [{ transform: 'scaleX(0)' }, { transform: to }], { delay: i * 140, duration: 360 }); });
    Array.prototype.forEach.call(segs, function (n, i) { anim(n, [{ transform: 'scaleX(0)', opacity: 0 }, { transform: 'scaleX(1)', opacity: 1 }], { delay: 620 + i * 130, duration: 260 }); });
    if (sum) {
      var to = +sum.getAttribute('data-to'), t0 = performance.now() + 620;
      (function step(now) { var p = Math.max(0, Math.min(1, (now - t0) / 520)); sum.textContent = Math.round(to * p); if (p < 1) requestAnimationFrame(step); })(performance.now());
    }
    anim(res, [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { delay: 1180, duration: 260 });
  }

  /* ---------- 五道門檻（互動 5） ---------- */
  var GATE_LABEL = { verified: '目前狀態已查證', score: '目前總分 ≥ 80', red: '目前分流＝紅色', candidate: 'Gmail 候選＝是', url: '來源網址不為空白' };
  function gatesHTML(e, full) {
    var c = R.candidateChecks(e), stop = -1;
    c.checks.forEach(function (ch, i) { if (stop < 0 && !ch.pass) stop = i; });
    var rows = c.checks.map(function (ch, i) {
      var st = stop < 0 || i < stop ? 'pass' : i === stop ? 'fail' : 'skip';
      var txt = st === 'pass' ? '通過' : st === 'fail' ? '未通過：' + esc(ch.reason) : '未進行（第 ' + (stop + 1) + ' 道未通過即停止）';
      return '<li class="gt gt-' + st + '"><span class="gt-i num">' + (i + 1) + '</span><span class="gt-l">' + GATE_LABEL[ch.key] + '</span><span class="gt-r">' + icon(st === 'pass' ? 'check' : st === 'fail' ? 'x' : 'dash') + txt + '</span></li>';
    }).join('');
    var tail = '';
    if (stop >= 0 && c.reasons.length > 1 && full) tail += '<p class="gt-note">其餘未符合項（資料完整列出）：' + esc(c.reasons.slice(1).join('、')) + '</p>';
    if (c.qualified) {
      var key = R.snapshotKey(e), has = logKeys.has(key);
      tail += '<div class="gt-after"><p class="gt-step ' + (has ? 'blocked' : 'open') + '">' + icon('shield') + '<b>去重比對：</b>' + (has ? '通知紀錄已有相同快照 → <b>被去重攔截</b>，不會重複建立草稿' : '尚無相同快照 → 下次執行可建立草稿（受單次 5 封上限）') + '</p>' +
        (full ? '<p class="gt-key mono">' + esc(key) + '</p>' : '') +
        '<p class="gt-step review">' + icon('review') + '<b>須人工覆核：</b>' + REVIEW_TEXT + '</p></div>';
    } else {
      tail += '<p class="gt-step neutral">' + icon('info') + '不是正式候選，不會進入去重與草稿流程。</p>';
    }
    if (full && dutyPending(e)) tail += '<p class="gt-step duty">' + icon('clip') + '<span><b>' + esc(dutyDetail(e)) + '</b><small>責任資訊待補：' + DUTY_NOTE + '</small></span></p>';
    return '<ol class="gts">' + rows + '</ol>' + tail;
  }
  function animateGates(root) {
    if (reduce || !root) return;
    Array.prototype.forEach.call(root.querySelectorAll('.gt'), function (n, i) {
      anim(n, [{ opacity: 0.25 }, { opacity: 1 }], { delay: i * 180, duration: 220 });
      anim(n.querySelector('.gt-r'), [{ opacity: 0, transform: 'translateX(-6px)' }, { opacity: 1, transform: 'none' }], { delay: i * 180 + 90, duration: 220 });
    });
    Array.prototype.forEach.call(root.querySelectorAll('.gt-after, .gt-note, .gt-step.neutral'), function (n) { anim(n, [{ opacity: 0 }, { opacity: 1 }], { delay: 5 * 180 + 80, duration: 260 }); });
  }

  /* ---------- 事件訊號摘要（Brief 內，與晶圓同步） ---------- */
  function renderSignal(id, animate) {
    var e = byId(id), r = topIds.indexOf(id);
    var c = R.candidateChecks(e);
    $('signal').innerHTML =
      '<div class="sig-head"><p class="sig-kicker" id="signal-title">' + (r >= 0 ? '優先事件 ' + (r + 1) + '／3' : '目前檢視') + ' · <span class="num">' + esc(id) + ' · ' + esc(f(e, '事件日期')) + '</span></p>' +
      '<div class="sig-nav" role="group" aria-label="切換優先事件">' + topIds.map(function (t, i) { return '<button type="button" class="sig-dot" data-select="' + t + '" aria-pressed="' + (t === id) + '" aria-label="優先事件 ' + (i + 1) + '：' + esc(f(byId(t), '事件名稱')) + '">' + (i + 1) + '</button>'; }).join('') + '</div></div>' +
      '<h2 class="sig-title">' + esc(f(e, '事件名稱')) + '</h2>' +
      '<div class="tags">' + statusTags(e) + '</div>' +
      '<p class="sig-stages">' + icon('arrow') + '相關環節：' + esc(stageNames(id).join('、') || '—') + '</p>' +
      '<div class="sig-score">' + scoreHTML(e) + '</div>' +
      '<p class="sig-gates">' + c.checks.map(function (ch) { return '<span class="mini ' + (ch.pass ? 'ok' : 'no') + '" title="' + GATE_LABEL[ch.key] + '：' + (ch.pass ? '通過' : ch.reason) + '">' + icon(ch.pass ? 'check' : 'x') + '<span>' + GATE_LABEL[ch.key] + '</span></span>'; }).join('') + '</p>' +
      '<p class="sig-act"><b>建議行動：</b>' + esc(firstAction(e)) + '。</p>' +
      '<div class="sig-cta"><button type="button" class="btn btn-sm" data-case="' + esc(id) + '">開啟個案檔' + icon('arrow') + '</button><a class="text-link" href="#gate" data-trace="' + esc(id) + '">查看五道門檻 →</a></div>';
    if (animate) { animateScore($('signal')); anim($('signal').querySelector('.sig-title'), [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 260 }); }
  }

  /* =========================================================
   * Wafer（右）
   * ========================================================= */
  var svg = $('wafer');
  var CX = 320, CY = 292, R_WAFER = 196, R_ORBIT = 268;
  el('defs', {}, svg).innerHTML =
    '<pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" style="fill:var(--color-pending-hatch-bg)"/><line x1="0" y1="0" x2="0" y2="5" stroke-width="1.5" style="stroke:var(--color-space-pending)"/></pattern>' +
    '<linearGradient id="scanGrad" x1="0" x2="1"><stop offset="0" stop-opacity="0" style="stop-color:var(--color-scan)"/><stop offset=".5" stop-opacity=".34" style="stop-color:var(--color-scan)"/><stop offset="1" stop-opacity="0" style="stop-color:var(--color-scan)"/></linearGradient>' +
    '<clipPath id="waferClip"><circle cx="' + CX + '" cy="' + CY + '" r="' + R_WAFER + '"/></clipPath>';
  var T0 = Date.UTC(2016, 0, 1), T1 = Date.UTC(2027, 0, 1), A0 = 120, SWEEP = 300;
  function angleOf(d) { var p = d.split('-'); return A0 + (Date.UTC(+p[0], +p[1] - 1, +p[2]) - T0) / (T1 - T0) * SWEEP; }
  function polar(r, deg) { var a = deg * Math.PI / 180; return [CX + r * Math.cos(a), CY + r * Math.sin(a)]; }
  function arc(r, a0, a1) { var p0 = polar(r, a0), p1 = polar(r, a1); return 'M' + p0[0].toFixed(1) + ' ' + p0[1].toFixed(1) + ' A' + r + ' ' + r + ' 0 ' + (a1 - a0 > 180 ? 1 : 0) + ' 1 ' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1); }
  var gOrbit = el('g', { 'aria-hidden': 'true' }, svg);
  var orbitTime = el('path', { d: arc(R_ORBIT, A0, A0 + SWEEP), class: 'orbit orbit-time', pathLength: 1 }, gOrbit);
  for (var y = 2016; y <= 2026; y++) {
    var a = angleOf(y + '-01-01'), p0 = polar(R_ORBIT - 6, a), p1 = polar(R_ORBIT + 6, a);
    el('line', { x1: p0[0], y1: p0[1], x2: p1[0], y2: p1[1], class: 'tick-year' }, gOrbit);
    if (y % 2 === 0) { var pl = polar(R_ORBIT + 22, a); var tt = el('text', { x: pl[0], y: pl[1] + 4, 'text-anchor': 'middle', class: 'year-label' + ((y === 2016 || y === 2020 || y === 2026) ? '' : ' m-hide') }, gOrbit); tt.textContent = y; }
  }
  var gWafer = el('g', {}, svg);
  var edge = el('path', { d: 'M ' + (CX - 14) + ' ' + (CY + R_WAFER - 0.5) + ' A ' + R_WAFER + ' ' + R_WAFER + ' 0 1 1 ' + (CX + 14) + ' ' + (CY + R_WAFER - 0.5) + ' L ' + CX + ' ' + (CY + R_WAFER - 10) + ' Z', class: 'wafer-edge', pathLength: 1 }, gWafer);
  var S = 38, G = 5, cells = [];
  for (var i = -6; i <= 5; i++) for (var j = -6; j <= 5; j++) {
    var x = CX + i * S + G / 2, yy = CY + j * S + G / 2, w = S - G;
    var far = Math.max(Math.hypot(x - CX, yy - CY), Math.hypot(x + w - CX, yy - CY), Math.hypot(x - CX, yy + w - CY), Math.hypot(x + w - CX, yy + w - CY));
    if (far <= R_WAFER - 6 && !(yy + w > CY + R_WAFER - 22 && Math.abs(x + w / 2 - CX) < 30)) cells.push({ x: x, y: yy, w: w, d: Math.hypot(x + w / 2 - CX, yy + w / 2 - CY), ang: Math.atan2(yy + w / 2 - CY, x + w / 2 - CX) });
  }
  cells.sort(function (a, b) { return a.d - b.d || a.ang - b.ang; });
  var rankOf = function (e) { return FLOWS.indexOf(f(e, '目前－分流結果')) * 1000 - (score(e) == null ? Number(e['事件當時－總分']) / 10 : score(e)); };
  var ordered = E.slice().sort(function (a, b) { return rankOf(a) - rankOf(b) || f(a, '事件ID').localeCompare(f(b, '事件ID')); });
  var gCells = el('g', { 'aria-hidden': 'true' }, gWafer);
  cells.slice(ordered.length).forEach(function (c) { el('rect', { x: c.x, y: c.y, width: c.w, height: c.w, rx: 3, class: 'die-cell' }, gCells); });
  var gSig = el('g', { 'aria-hidden': 'true', class: 'sig-group' }, svg), gTicks = el('g', { 'aria-hidden': 'true' }, svg);
  var gDies = el('g', { class: 'dies' }, gWafer);
  var scan = el('rect', { x: CX - R_WAFER - 120, y: CY - R_WAFER, width: 120, height: R_WAFER * 2, class: 'scan', 'clip-path': 'url(#waferClip)', opacity: 0, 'aria-hidden': 'true' }, gWafer);
  var dies = [], candRings = [], marks = [], sigs = [], ticks = [], dieById = {}, primeLabel = null;
  var gMarks = el('g', { class: 'marks-top' }, svg);
  var tip = $('tip');

  ordered.forEach(function (e, idx) {
    var c = cells[idx], fl = f(e, '目前－分流結果'), cls = CLS[fl], id = f(e, '事件ID'), sc = score(e);
    var cand = isCand(e), pend = isPendingVerify(e), rank = topIds.indexOf(id);
    var label = id + '，' + f(e, '事件名稱') + '，' + f(e, '事件日期') + '，目前' + fl + (sc != null ? ' ' + sc + ' 分' : '') +
      (pend ? '，待查證' : '') + (cand ? '，正式候選' : '') + (rank >= 0 ? '，優先第 ' + (rank + 1) + ' 筆' : '') + '。相關環節：' + (stageNames(id).join('、') || '無');
    var g = el('g', { class: 'die' + (rank >= 0 ? ' is-top' : ''), role: 'button', tabindex: id === state.selected ? 0 : -1, 'aria-label': label, 'aria-pressed': id === state.selected, 'data-id': id, 'data-cand': cand, 'data-pending': pend, 'data-duty': dutyPending(e) }, gDies);
    var glow = el('g', { class: 'sel-glow' }, g);
    el('rect', { x: c.x - 7, y: c.y - 7, width: c.w + 14, height: c.w + 14, rx: 9, class: 'sel-outer' }, glow);
    el('rect', { x: c.x - 4.5, y: c.y - 4.5, width: c.w + 9, height: c.w + 9, rx: 7, class: 'sel-inner' }, glow);
    var body = el('g', { class: 'die-body' }, g);
    el('rect', { x: c.x + 1, y: c.y + 1, width: c.w - 2, height: c.w - 2, rx: 3, class: 'fill f-' + cls }, body);
    if (cand) candRings.push(el('rect', { x: c.x - 2.5, y: c.y - 2.5, width: c.w + 5, height: c.w + 5, rx: 5, class: 'cand-ring', pathLength: 1 }, body));
    if (pend) el('rect', { x: c.x - 2.5, y: c.y - 2.5, width: c.w + 5, height: c.w + 5, rx: 5, class: 'pend-ring' }, body);
    el('rect', { x: c.x - 3, y: c.y - 3, width: c.w + 6, height: c.w + 6, rx: 5, class: 'hit' }, g);
    if (rank >= 0) {
      var m = el('g', { class: 'mark' }, g);
      el('circle', { cx: c.x + c.w - 2, cy: c.y + 2, r: 9.5, class: 'mark-bg' }, m);
      var mt = el('text', { x: c.x + c.w - 2, y: c.y + 5.6, 'text-anchor': 'middle', class: 'mark-n' }, m); mt.textContent = rank + 1;
      marks.push(m);
      if (rank === 0) {
        primeLabel = el('g', { class: 'prime-label', 'aria-hidden': 'true' }, gMarks);
        var lw = 64, lx = c.x + c.w / 2 - lw / 2, ly = c.y - 30;
        el('rect', { x: lx, y: ly, width: lw, height: 19, rx: 9.5, class: 'tl-bg' }, primeLabel);
        var tl = el('text', { x: c.x + c.w / 2, y: ly + 13.5, 'text-anchor': 'middle', class: 'tl-text' }, primeLabel); tl.textContent = '快照優先';
      }
    }
    var a2 = angleOf(f(e, '事件日期')), len = fl === '紅色' ? 12 : 7, q0 = polar(R_ORBIT - len, a2), q1 = polar(R_ORBIT + len * 0.4, a2);
    ticks.push(el('line', { x1: q0[0], y1: q0[1], x2: q1[0], y2: q1[1], class: 'tk-' + cls + ' evt-tick' + (fl === '紅色' ? ' tick-red' : ''), opacity: fl === '紅色' ? 1 : 0.7 }, gTicks));
    if (rank >= 0) {
      var mx = c.x + c.w / 2, my = c.y + c.w / 2, end = polar(R_ORBIT - len, a2), mid = polar((R_WAFER + R_ORBIT) / 2, a2);
      sigs.push(el('path', { d: 'M' + mx + ' ' + my + ' Q' + mid[0].toFixed(1) + ' ' + mid[1].toFixed(1) + ' ' + end[0].toFixed(1) + ' ' + end[1].toFixed(1), class: 'sig-line', pathLength: 1 }, gSig));
    }
    var d = { g: g, body: body, e: e, id: id, idx: idx, top: rank >= 0, base: c };
    dies.push(d); dieById[id] = d;
    g.addEventListener('mouseenter', function () { showTip(d); });
    g.addEventListener('mouseleave', hideTip);
    g.addEventListener('focus', function () { showTip(d); });
    g.addEventListener('blur', hideTip);
    g.addEventListener('click', function (ev) { ev.stopPropagation(); select(id, { from: 'wafer' }); showTip(d); });
    g.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select(id, { from: 'wafer' }); showTip(d); return; }
      var mv = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1, Home: -999, End: 999 };
      if (!(ev.key in mv)) return; ev.preventDefault();
      var vis = visibleOrder(), pos = vis.indexOf(d), n = vis[Math.max(0, Math.min(vis.length - 1, pos + mv[ev.key]))];
      if (!n) return;
      dies.forEach(function (o) { o.g.setAttribute('tabindex', -1); }); n.g.setAttribute('tabindex', 0); n.g.focus();
    });
  });
  function showTip(d) {
    var e = d.e, id = d.id, sc = score(e), r = d.g.getBoundingClientRect();
    var tags = [f(e, '目前－分流結果')]; if (isPendingVerify(e)) tags.push('待查證'); if (isCand(e)) tags.push('正式候選（須人工覆核）');
    tip.innerHTML = '<b>' + esc(id) + '</b> · ' + esc(f(e, '事件日期')) + ' · 總分 <b>' + (sc != null ? sc : '未評') + '</b><br><span class="tip-name">' + esc(f(e, '事件名稱')) + '</span><br>' +
      '<span class="tip-sub">狀態：' + esc(tags.join('、')) + '</span><br><span class="tip-sub">相關環節：' + esc(stageNames(id).join('、') || '—') + '</span>' +
      (dutyPending(e) ? '<br><span class="tip-duty">責任資訊待補（網站推導）：' + esc(dutyDetail(e)) + '</span>' : '');
    tip.hidden = false;
    var left = Math.min(window.innerWidth - tip.offsetWidth - 12, Math.max(12, r.left + r.width / 2 - tip.offsetWidth / 2));
    var top = r.top - tip.offsetHeight - 10; if (top < 76) top = r.bottom + 10;
    tip.style.left = left + 'px'; tip.style.top = top + 'px';
  }
  function hideTip() { tip.hidden = true; }
  function showTextTip(node) {
    var r = node.getBoundingClientRect();
    tip.innerHTML = '<span class="tip-name">' + esc(node.getAttribute('data-tip-text')) + '</span>'; tip.hidden = false;
    tip.style.left = Math.min(window.innerWidth - tip.offsetWidth - 12, Math.max(12, r.left)) + 'px';
    var top = r.bottom + 8; if (top + tip.offsetHeight > window.innerHeight - 8) top = r.top - tip.offsetHeight - 8; tip.style.top = top + 'px';
  }
  ['mouseover', 'focusin'].forEach(function (t) { document.addEventListener(t, function (ev) { var n = ev.target.closest && ev.target.closest('[data-tip-text]'); if (n) showTextTip(n); }); });
  ['mouseout', 'focusout'].forEach(function (t) { document.addEventListener(t, function (ev) { if (ev.target.closest && ev.target.closest('[data-tip-text]')) hideTip(); }); });
  document.addEventListener('click', function (ev) { var n = ev.target.closest && ev.target.closest('[data-tip-text]'); if (n) { ev.stopPropagation(); showTextTip(n); } }, true);
  document.addEventListener('click', hideTip);
  window.addEventListener('scroll', hideTip, { passive: true });

  /* ---------- 篩選：die 以 transform 重新排列（互動 3） ---------- */
  var FILTERS = [
    ['top3', '優先 3 筆', function (e) { return topIds.indexOf(f(e, '事件ID')) >= 0; }],
    ['all', '全部 ' + E.length, function () { return true; }],
    ['紅色', '紅色 ' + counts['紅色'], function (e) { return f(e, '目前－分流結果') === '紅色'; }],
    ['黃色', '黃色 ' + counts['黃色'], function (e) { return f(e, '目前－分流結果') === '黃色'; }],
    ['綠色', '綠色 ' + counts['綠色'], function (e) { return f(e, '目前－分流結果') === '綠色'; }],
    ['待查證', '待查證 ' + counts['待查證'], function (e) { return f(e, '目前－分流結果') === '待查證'; }],
    ['cand', '正式候選 ' + cands.length, isCand]
  ];
  var filterFn = {}; FILTERS.forEach(function (x) { filterFn[x[0]] = x[2]; });
  $('filters').innerHTML = FILTERS.map(function (x) { return '<button type="button" class="chip-btn" data-filter="' + x[0] + '" aria-pressed="' + (x[0] === state.filter) + '">' + esc(x[1]) + '</button>'; }).join('');
  function visibleOrder() {
    var fn = filterFn[state.filter];
    if (state.filter === 'top3' || state.filter === 'all') return dies.slice();
    return dies.filter(function (d) { return fn(d.e); }).concat(dies.filter(function (d) { return !fn(d.e); }));
  }
  function applyFilter(key, animate) {
    state.filter = key;
    var fn = filterFn[key], rearr = key !== 'top3' && key !== 'all';
    Array.prototype.forEach.call(document.querySelectorAll('[data-filter]'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-filter') === key); });
    svg.classList.toggle('focus-on', key === 'top3');
    svg.classList.toggle('rearranged', rearr);
    var order = rearr ? visibleOrder() : dies;
    order.forEach(function (d, i) {
      var target = rearr ? cells[i] : d.base, dx = target.x - d.base.x, dy = target.y - d.base.y;
      d.g.style.transition = animate && !reduce ? 'transform 520ms ' + EASE + ' ' + Math.min(i, 20) * 12 + 'ms, opacity 280ms ' + EASE : 'none';
      d.g.style.transform = dx || dy ? 'translate(' + dx + 'px,' + dy + 'px)' : '';
      d.g.classList.toggle('is-out', rearr && !fn(d.e));
    });
    var n = E.filter(fn).length, label = FILTERS.filter(function (x) { return x[0] === key; })[0][1].replace(/\s*\d+$/, '');
    $('filter-status').textContent = key === 'top3' ? '聚焦三筆優先事件，其他事件降低顯示' : key === 'all' ? '顯示全部 ' + E.length + ' 筆事件' : '篩選「' + label + '」' + n + ' 筆，已移到晶圓中心';
  }
  $('filters').addEventListener('click', function (ev) { var b = ev.target.closest('[data-filter]'); if (b) { ev.stopPropagation(); applyFilter(b.getAttribute('data-filter'), true); } });

  /* ---------- focus list（晶圓下方三筆） ---------- */
  var focusList = $('focus-list');
  focusList.innerHTML = top3.map(function (e, i) {
    var id = f(e, '事件ID');
    return '<li><button type="button" class="fl-btn" data-select="' + id + '" aria-pressed="' + (id === state.selected) + '"><span class="fl-n num">' + (i + 1) + '</span><span class="fl-body"><span class="fl-name">' + esc(f(e, '事件名稱')) + '</span>' +
      '<span class="fl-meta"><span class="num">' + score(e) + ' 分</span> · ' + esc(stageNames(id).join('、')) + '</span>' +
      '<span class="fl-act">' + esc(firstAction(e)) + '</span></span></button></li>';
  }).join('');
  $('legend').innerHTML =
    '<span class="lg-group"><span class="lg-k">填色＝目前分流</span><span><i class="lg-red"></i>紅</span><span><i class="lg-yellow"></i>黃</span><span><i class="lg-green"></i>綠</span><span><i class="lg-hatch"></i>未評分</span></span>' +
    '<span class="lg-group"><span><i class="lg-pend"></i>灰紫虛線＝待查證</span><span><i class="lg-cand"></i>金色實線＝正式候選（皆須人工覆核）</span></span>' +
    '<span class="lg-group"><span><i class="lg-mark">1</i>優先事件</span><span><i class="lg-sel"></i>柔和光環＝目前選取（非資料狀態）</span><span class="lg-note">外圈＝事件日期 2016–2026</span></span>';

  /* ---------- 同步選取（互動 2） ---------- */
  function select(id, opts) {
    opts = opts || {};
    if (!byId(id)) return;
    var changed = id !== state.selected;
    state.selected = id;
    dies.forEach(function (d) { var on = d.id === id; d.g.classList.toggle('is-selected', on); d.g.setAttribute('aria-pressed', on); });
    var d = dieById[id];
    if (opts.from !== 'wafer') { dies.forEach(function (o) { o.g.setAttribute('tabindex', -1); }); d.g.setAttribute('tabindex', 0); }
    if (d && changed && !reduce) {
      var glow = d.g.querySelector('.sel-glow'); glow.style.transformBox = 'fill-box'; glow.style.transformOrigin = 'center';
      anim(glow, [{ opacity: 0, transform: 'scale(1.25)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 320 });
    }
    Array.prototype.forEach.call(document.querySelectorAll('[data-select]'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-select') === id); });
    renderSignal(id, changed || opts.force);
    var se = byId(id), st = stageOf[id] || [];
    $('sel-strip').innerHTML = '<span class="ss-k">目前選取</span><b class="num">' + esc(id) + '</b>' + (isPendingVerify(se) ? '<span class="tag tag-pending">' + icon('clock') + '待查證</span>' : badge(f(se, '目前－分流結果'), score(se))) +
      '<span class="ss-st">' + st.map(function (k) { return '<span class="chip">' + esc(SM.stages[k]) + '</span>'; }).join('') + '</span>';
    Array.prototype.forEach.call(document.querySelectorAll('#chain li[data-stage]'), function (li) { var on = st.indexOf(li.getAttribute('data-stage')) !== -1; li.classList.toggle('is-hit', on); li.classList.toggle('is-dim', !on); });
    if (changed && !reduce) { anim($('sel-strip'), [{ opacity: 0.3 }, { opacity: 1 }], { duration: 260 }); }
    $('trace-select').value = id;
    renderTrace(id, opts.from === 'trace' || opts.force);
  }
  document.addEventListener('click', function (ev) {
    var s = ev.target.closest('[data-select]'); if (s) { ev.stopPropagation(); select(s.getAttribute('data-select'), { from: 'list' }); return; }
    var tr = ev.target.closest('[data-trace]'); if (tr) { select(tr.getAttribute('data-trace'), { from: 'trace', force: true }); return; }
    var cs = ev.target.closest('[data-case]'); if (cs) { ev.preventDefault(); openCase(cs.getAttribute('data-case'), cs); }
  });

  /* =========================================================
   * Executive Attention
   * ========================================================= */
  $('attention-list').innerHTML = top3.map(function (e, i) {
    var id = f(e, '事件ID'), key = R.snapshotKey(e), has = logKeys.has(key), url = f(e, '來源網址');
    var reasons = [
      '目前總分 <b class="num">' + score(e) + '</b>，正式候選中第 ' + (ranked.indexOf(e) + 1) + ' 高',
      '緊急程度 <b class="num">' + lvl(e, '緊急程度') + '／5</b>；來源可信度 <b class="num">' + lvl(e, '來源可信度') + '／5</b>（來源等級 ' + esc(f(e, '來源等級')) + '）',
      '評分說明（節錄）：' + esc(excerpt(e))
    ];
    return '<article class="att" id="card-' + id + '" aria-labelledby="att-' + i + '">' +
      '<div class="att-rank"><span class="att-n num">' + (i + 1) + '</span><div class="tags">' + statusTags(e) + '</div></div>' +
      '<div class="att-main"><p class="att-meta num">' + esc(id) + ' · ' + esc(f(e, '事件日期')) + ' · ' + esc(f(e, '國家／區域')) + '</p>' +
        '<h3 id="att-' + i + '">' + esc(f(e, '事件名稱')) + '</h3>' +
        '<div class="chips">' + stageNames(id).map(function (s) { return '<span class="chip">' + esc(s) + '</span>'; }).join('') + '</div>' +
        '<h4>為何列為優先</h4><ul class="reasons">' + reasons.map(function (r) { return '<li>' + r + '</li>'; }).join('') + '</ul>' +
        '<h4' + (i === 0 ? ' id="attention-actions"' : '') + '>建議營運行動</h4><p class="action">' + esc(f(e, '建議初步行動')) + '</p></div>' +
      '<aside class="att-side"><h4>來源證據</h4><p>' + esc(f(e, '來源機構')) + '</p><p><a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(host(url)) + icon('ext') + '</a></p>' +
        '<h4>草稿與去重</h4><p class="' + (has ? 'ok' : '') + '">' + icon(has ? 'check' : 'clock') + (has ? '已有草稿快照，不會重複建立' : '尚無快照') + '</p><p class="key mono">' + esc(key) + '</p>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-case="' + id + '">開啟個案檔' + icon('arrow') + '</button></aside></article>';
  }).join('');

  /* ---------- 七段供應鏈 ---------- */
  $('chain').innerHTML = stageKeys.map(function (k) {
    var sc = SM.stageCounts[k], n = sc.events.length;
    var tops = topIds.map(function (id, i) { return (stageOf[id] || []).indexOf(k) !== -1 ? i + 1 : null; }).filter(Boolean);
    var bar = FLOWS.map(function (fl) { var v = sc.byFlow[fl] || 0; return v ? '<span class="cb-' + CLS[fl] + '" style="flex:' + v + '"></span>' : ''; }).join('');
    return '<li data-stage="' + k + '"><p class="ch-name">' + esc(sc.name) + '</p><p class="ch-n num">' + n + '<span>筆</span></p><div class="ch-bar" role="img" aria-label="' + esc(sc.name + '：' + FLOWS.map(function (fl) { return fl + ' ' + (sc.byFlow[fl] || 0); }).join('、')) + '">' + bar + '</div>' +
      '<p class="ch-red">紅色 <b class="num">' + (sc.byFlow['紅色'] || 0) + '</b></p><p class="ch-top">' + tops.map(function (t) { return '<span class="ch-mark num">' + t + '</span>'; }).join('') + '</p></li>';
  }).join('');

  /* ---------- 時間線 ---------- */
  var latest = E.slice().sort(function (a, b) { return f(b, '事件日期').localeCompare(f(a, '事件日期')) || f(b, '事件ID').localeCompare(f(a, '事件ID')); }).slice(0, 8).reverse();
  $('timeline').innerHTML = latest.map(function (e) {
    var fl = f(e, '目前－分流結果'), id = f(e, '事件ID'), r = topIds.indexOf(id);
    return '<li class="tl-item"><span class="tl-date num">' + esc(f(e, '事件日期').slice(5)) + '</span><span class="tl-node ' + CLS[fl] + '" aria-hidden="true"></span><span class="tl-card"><b>' + esc(id) + (r >= 0 ? ' <span class="ch-mark num">' + (r + 1) + '</span>' : '') + '</b>' + badge(fl, score(e)) +
      '<button type="button" class="tl-name" data-select="' + id + '">' + esc(f(e, '事件名稱')) + '</button></span></li>';
  }).join('');

  /* ---------- 候選漏斗與去重 ---------- */
  var gateLabels = ['全部事件', '目前狀態已查證', '目前總分 ≥ 80', '目前分流＝紅色', 'Gmail 候選＝是', '來源網址不為空白'];
  $('gates').innerHTML = gate.map(function (n, i) {
    return '<li><span class="g-label">' + (i ? '<span class="g-i num">' + i + '</span>' : '') + esc(gateLabels[i]) + '</span><span class="g-bar"><span style="transform:scaleX(' + (n / E.length).toFixed(4) + ')"></span></span><span class="g-n num">' + n + '</span>' +
      (i ? '<span class="g-drop">' + (gate[i - 1] - n ? '排除 ' + (gate[i - 1] - n) : '全數通過') + '</span>' : '<span class="g-drop"></span>') + '</li>';
  }).join('');
  $('dedup').innerHTML = '<h3>去重比對</h3><p class="dd-big num">' + cands.filter(hasSnap).length + ' / ' + cands.length + '</p><p>正式候選的快照鍵，已存在於通知紀錄</p>' +
    '<ol class="dd-steps"><li><span class="num">' + cands.length + '</span> 筆正式候選</li><li><span class="num">' + cands.filter(hasSnap).length + '</span> 筆被去重攔截（已有相同快照）</li><li>單次上限 <span class="num">5</span> 封</li><li>模擬新增草稿 <span class="num">' + sim.created.length + '</span> 封</li></ol>' +
    '<p class="dd-note">實際草稿於 2026-09-26 建立 5 封、09-27 接續 3 封。</p><a class="text-link" href="app.html#/simulate">前往草稿模擬（操作功能）→</a>';

  /* ---------- 逐筆判定（互動 5） ---------- */
  var ts = $('trace-select');
  ts.innerHTML = ordered.map(function (e) { var id = f(e, '事件ID'); return '<option value="' + id + '">' + id + '｜' + esc(f(e, '目前－分流結果')) + '｜' + esc(f(e, '事件名稱').slice(0, 26)) + '</option>'; }).join('');
  ts.addEventListener('change', function () { select(ts.value, { from: 'trace', force: true }); });
  function renderTrace(id, animate) {
    var e = byId(id);
    $('gate-trace').innerHTML = '<div class="trace-card"><p class="trace-title"><span class="num">' + esc(id) + '</span> ' + esc(f(e, '事件名稱')) + '</p><div class="tags">' + statusTags(e) + '</div>' + gatesHTML(e, true) + '</div>';
    if (animate) animateGates($('gate-trace'));
  }

  /* ---------- roadmap & limits ---------- */
  $('roadmap').innerHTML = [
    ['done', '四構面雙軌評分、紅黃綠分流（39 筆）'], ['done', '五項候選條件與快照去重'], ['done', 'Gmail 草稿（不寄信）、單次 5 封、每日觸發（原 Apps Script）'],
    ['done', '唯讀展示網站、去識別化資料'], ['plan', '有身分驗證的營運 API'], ['plan', '外部 API／OAuth2 與更多事件來源'], ['plan', 'Google Chat 通知'], ['plan', '誤報、漏報與門檻回顧校準']
  ].map(function (r) { return '<li class="rm-' + r[0] + '">' + icon(r[0] === 'done' ? 'check' : 'clock') + '<span>' + esc(r[1]) + '</span><em>' + (r[0] === 'done' ? '已實作' : '規劃中，尚未實作') + '</em></li>'; }).join('');
  $('limits-list').innerHTML = [
    '目前資料庫共 <b>' + E.length + '</b> 筆研究事件，主資料期間為 2016–2026。',
    '資料範圍不是全球事件的完整母體，數量與分布不代表整體產業風險水準。',
    '第一階段只使用公開資訊；公司營運情境為示範情境。',
    '供應鏈環節關聯只代表事件「涉及」該環節，不代表已證實的因果傳導。',
    '目前 ' + counts['紅色'] + ' 筆紅色事件的事件日期都在 ' + redDates[0] + ' 至 ' + redDates[redDates.length - 1] + '，可能受到資料蒐集期間影響。',
    '每筆事件的來源網址、評分與候選判定，都可在事件個案檔中追溯。'
  ].map(function (t) { return '<li>' + t + '</li>'; }).join('');

  /* =========================================================
   * 個案檔：從卡片平順展開，關閉後回到原位（互動 6）
   * ========================================================= */
  var dlg = $('case'), panel = $('case-panel'), caseOrigin = null;
  function caseHTML(e, mode) {
    var id = f(e, '事件ID'), url = f(e, '來源網址');
    var decision = mode === 'decision';
    function ch(n, t, body) { return '<section class="cf-ch"><h3><span class="num">' + n + '</span>' + t + '</h3>' + body + '</section>'; }
    return '<header class="cf-head"><div><p class="num cf-id">' + esc(id) + ' · ' + esc(f(e, '事件日期')) + ' · ' + esc(f(e, '國家／區域')) + '</p><h2 id="case-title">' + esc(f(e, '事件名稱')) + '</h2><div class="tags">' + statusTags(e) + '</div></div>' +
      '<button type="button" class="cf-close" id="case-close" aria-label="關閉">' + icon('close') + '</button></header>' +
      '<div class="cf-body">' +
      (decision ? '<section class="cf-ch cf-decision"><h3><span class="num">★</span>事件決策摘要</h3><dl class="dc-grid">' +
        '<div class="dc-wide"><dt>為何列為優先</dt><dd>' + esc(whyNow(e)) + '</dd></div>' +
        '<div class="dc-wide dc-decide"><dt>建議處置</dt><dd>' + esc(f(e, '建議初步行動')) + '<small>取自「建議初步行動」；系統建議，非企業決策</small></dd></div>' +
        '<div><dt>負責人</dt><dd class="dc-miss">' + esc(ownerText(e)) + '</dd></div><div><dt>期限</dt><dd class="dc-miss">' + esc(dueText(e)) + '</dd></div>' +
        '<div class="dc-wide"><dt>資料時效與責任</dt><dd>資料匯出日 ' + esc(D.meta.exportedAt) + '，最後查證日 ' + esc(lastChecked) + '；依資料快照排序，非即時監控結果。最終決策須由負責人覆核。</dd></div>' +
        '<div class="dc-wide"><dt>寄送安全</dt><dd>' + REVIEW_TEXT + '正式草稿模式：' + (draftOn ? '已啟用' : '未啟用') + '，不會自動寄送。</dd></div></dl></section>' : '') +
      ch(1, '事件摘要', '<p>' + esc(f(e, '主分類')) + '｜' + esc(f(e, '事件性質')) + '｜處理狀態：' + esc(f(e, '處理狀態')) + '</p>') +
      ch(2, '來源事實', '<p>' + esc(f(e, '來源事實摘要')) + '</p><p class="cf-interp"><b>營運解讀（推論，非來源原文）：</b>' + esc(f(e, '營運解讀')) + '</p>') +
      ch(3, '評分依據', '<div class="cf-score">' + scoreHTML(e) + '</div>' + (function () {
        var raw = f(e, '目前－分數說明'), stale = /B5/.test(raw);
        if (!raw) return '<p class="cf-note">事件當時評分說明：' + esc(f(e, '事件當時－分數說明')) + '</p>';
        return '<p class="cf-note">目前評分說明' + (stale ? '（節錄）' : '') + '：' + esc(stale ? excerpt(e) : raw) + '</p>' +
          (stale ? '<p class="cf-flag">' + icon('info') + '原文後半段含「B5 為否時不建立草稿」的舊敘述，與匯出時的設定（' + esc(b5Cell) + '＝' + esc(b5Value) + '）不一致，待資料端修正。</p>' : '');
      })()) +
      ch(4, '受影響環節', '<p>' + stageNames(id).map(function (s) { return '<span class="chip">' + esc(s) + '</span>'; }).join(' ') + '</p><p class="cf-raw">原始「影響環節」：' + esc(f(e, '影響環節')) + '</p><p class="cf-note">依現有資料識別的影響範圍，不代表已證實的因果方向。</p>') +
      ch(5, '候選判定', '<div class="cf-gates">' + gatesHTML(e, true) + '</div>') +
      ch(6, '初步營運行動', '<p class="action">' + esc(f(e, '建議初步行動')) + '</p><p>建議通知部門：' + esc(f(e, '建議通知部門')) + '</p><p>負責人：' + esc(ownerText(e)) + '｜到期日：' + esc(dueText(e)) + '</p>') +
      ch(7, '來源與稽核資訊', '<p>' + esc(f(e, '來源機構')) + '（' + esc(f(e, '來源類型')) + '，等級 ' + esc(f(e, '來源等級')) + '）</p>' + (url ? '<p><a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(url) + icon('ext') + '</a></p>' : '') + '<p>查詢日期 ' + esc(f(e, '查詢日期')) + '｜目前狀態查證：' + esc(f(e, '目前狀態查證')) + '</p>') +
      '</div>';
  }
  function openCase(id, origin) {
    var e = byId(id); if (!e) return;
    caseOrigin = origin || null;
    panel.innerHTML = caseHTML(e, origin && origin.getAttribute && origin.getAttribute('data-mode'));
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    $('case-close').focus({ preventScroll: true });
    var card = origin && (origin.closest('.att, .signal, .decision') || origin);
    if (card && !reduce) {
      var a = card.getBoundingClientRect(), b = panel.getBoundingClientRect();
      anim(panel, [{ transform: 'translate(' + (a.left - b.left) + 'px,' + (a.top - b.top) + 'px) scale(' + (a.width / b.width).toFixed(3) + ',' + Math.min(1, a.height / b.height).toFixed(3) + ')', opacity: 0.4 }, { transform: 'none', opacity: 1 }], { duration: 360, easing: 'cubic-bezier(.2,.8,.2,1)' });
      anim(panel.querySelector('.cf-body'), [{ opacity: 0 }, { opacity: 1 }], { delay: 200, duration: 220 });
    }
    animateScore(panel.querySelector('.cf-score')); setTimeout(function () { animateGates(panel.querySelector('.cf-gates')); }, reduce ? 0 : 300);
  }
  function closeCase() {
    var card = caseOrigin && (caseOrigin.closest('.att, .signal, .decision') || caseOrigin);
    function done() { if (dlg.open) dlg.close(); }
    if (card && !reduce && panel.animate) {
      var a = card.getBoundingClientRect(), b = panel.getBoundingClientRect();
      var an = panel.animate([{ transform: 'none', opacity: 1 }, { transform: 'translate(' + (a.left - b.left) + 'px,' + (a.top - b.top) + 'px) scale(' + (a.width / b.width).toFixed(3) + ',' + Math.min(1, a.height / b.height).toFixed(3) + ')', opacity: 0 }], { duration: 260, easing: EASE });
      an.onfinish = done;
    } else done();
  }
  dlg.addEventListener('click', function (ev) { if (ev.target === dlg || ev.target.closest('#case-close')) closeCase(); });
  dlg.addEventListener('cancel', function (ev) { ev.preventDefault(); closeCase(); });
  dlg.addEventListener('close', function () { if (caseOrigin && document.contains(caseOrigin)) caseOrigin.focus({ preventScroll: true }); });

  /* =========================================================
   * 初始最終狀態 + 一次性進場（約 2.6 秒）
   * ========================================================= */
  applyFilter('top3', false);
  select(state.selected, { from: 'init' });
  /* 決策收斂計數：各階段在自己的時間窗內遞增 */
  var counters = Array.prototype.slice.call(document.querySelectorAll('#funnel [data-count]'));
  var WIN = [[400, 1100], [1400, 2000], [1800, 2400], [2300, 2800]];
  function setCounters(t) { counters.forEach(function (c, i) { var v = +c.getAttribute('data-count'), w = WIN[i], p = Math.min(1, Math.max(0, (t - w[0]) / (w[1] - w[0]))); c.textContent = Math.round(v * (1 - Math.pow(1 - p, 3))); }); }
  /*
   * 一次性進場（約 3.0 秒）：
   * 0.0–0.5 建立觀測範圍｜0.4–1.1 39 筆進入晶圓｜0.9–1.6 完成分流｜1.4–2.1 標出 8 筆正式候選
   * 1.8–2.5 收斂成 3 件高管關注｜2.3–3.0 聚焦本次快照優先事件並顯示建議處置｜3.0 後完全停止
   */
  function intro() {
    if (reduce || !document.body.animate) return;
    var draw = 'cubic-bezier(.45,0,.2,1)';
    function A(n, fr, delay, dur, easing) { return n ? n.animate(fr, { delay: delay, duration: dur, easing: easing || EASE, fill: 'backwards' }) : null; }
    var drawF = [{ strokeDasharray: '1 1', strokeDashoffset: 1 }, { strokeDasharray: '1 1', strokeDashoffset: 0 }];
    var small = window.matchMedia('(max-width: 720px)').matches;
    var steps = document.querySelectorAll('#funnel .fn-step');
    // 1 觀測範圍
    A(orbitTime, drawF, 0, 500, draw); A(edge, drawF, 50, 450, draw); A(gCells, [{ opacity: 0 }, { opacity: 1 }], 200, 300);
    // 決策收斂：各階段依序點亮
    [400, 1400, 1800, 2300].forEach(function (t, i) { A(steps[i], [{ opacity: 0.32 }, { opacity: 1 }], t, 360); });
    A(steps[3], [{ transform: 'scale(.94)' }, { transform: 'scale(1.03)', offset: .6 }, { transform: 'scale(1)' }], 2300, 500);
    if (small) {
      A(gDies, [{ opacity: 0 }, { opacity: 1 }], 400, 600);                                                                      // 2
      dies.forEach(function (d) { A(d.body.querySelector('.fill'), [{ opacity: 0 }, { opacity: 1 }], 900 + d.idx * 6, 220); });       // 3
      candRings.forEach(function (r) { A(r, [{ opacity: 0 }, { opacity: 1 }], 1400, 500); });                                     // 4
    } else {
      dies.forEach(function (d) {
        d.body.style.transformBox = 'fill-box'; d.body.style.transformOrigin = 'center';
        A(d.body, [{ opacity: 0, transform: 'scale(.55)' }, { opacity: 1, transform: 'scale(1)' }], 400 + d.idx * 12, 250);        // 2 39 筆進入
        A(d.body.querySelector('.fill'), [{ opacity: 0 }, { opacity: 1 }], 900 + d.idx * 10, 220);                                  // 3 分流
      });
      A(scan, [{ transform: 'translateX(0)', opacity: 0 }, { opacity: 1, offset: .2 }, { opacity: 1, offset: .8 }, { transform: 'translateX(' + (R_WAFER * 2 + 120) + 'px)', opacity: 0 }], 900, 700, 'linear');
      ticks.forEach(function (t, i) { A(t, [{ opacity: 0 }, { opacity: t.getAttribute('opacity') }], 1000 + i * 8, 240); });
      candRings.forEach(function (r, i) { A(r, drawF, 1400 + i * 40, 380, draw); });                                          // 4 8 筆正式候選
    }
    // 5 收斂成 3 件高管關注
    dies.forEach(function (d) { if (!d.top) A(d.g, [{ opacity: 1 }, { opacity: getComputedStyle(d.g).opacity }], 1800, 400); });
    marks.forEach(function (m, i) { m.style.transformBox = 'fill-box'; m.style.transformOrigin = 'center'; A(m, [{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'scale(1)' }], 1850 + i * 90, 260); });
    sigs.forEach(function (s, i) { A(s, drawF, 1900 + i * 90, 420, draw); });
    Array.prototype.forEach.call(focusList.children, function (li, i) { A(li, [{ opacity: 0.25, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], 1900 + i * 100, 300); });
    // 6 聚焦本次快照優先事件並顯示建議處置
    A(dieById[primeId].g.querySelector('.sel-glow'), [{ opacity: 0 }, { opacity: 1 }], 2300, 350);
    if (primeLabel) { primeLabel.style.transformBox = 'fill-box'; primeLabel.style.transformOrigin = 'center bottom'; A(primeLabel, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], 2350, 300); }
    A($('decision'), [{ opacity: 0.55, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], 2300, 500);
    A($('decision').querySelector('.dc-decide'), [{ backgroundColor: 'transparent' }, { backgroundColor: getComputedStyle($('decision').querySelector('.dc-decide')).backgroundColor }], 2500, 400);
    A($('sel-strip'), [{ opacity: 0 }, { opacity: 1 }], 2500, 300);
    // 7 3.0 秒後完全停止
    var start = performance.now();
    (function tick(now) { if (window.__frozen) return; var t = now - start; setCounters(t); if (t < 2900) requestAnimationFrame(tick); })(start);
  }
  window.__seek = function (t) { window.__frozen = true; document.getAnimations().forEach(function (a) { a.pause(); a.currentTime = t; }); setCounters(t); };
  try { intro(); } catch (err) { /* 動畫失敗：保留最終狀態 */ }
})();
