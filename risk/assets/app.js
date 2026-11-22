/*
 * app.js — 介面（唯讀）。只讀取 window.RISK_DATA，不呼叫網路、不寫入任何外部系統。
 */
(function () {
  'use strict';
  var D = window.RISK_DATA, R = window.RiskRules, I = window.I18N;
  var EVENTS = D.events, LOG = D.notificationLog;
  var FIELD_NAMES = Object.keys(EVENTS[0]);
  var LOG_KEYS = R.logDedupKeys(LOG);
  var B5_EXPORT = (D.settings.filter(function (s) { return s['項目'] === '啟用正式草稿'; })[0] || {})['值'] || '';

  var state = {
    lang: 'zh-Hant',
    view: 'overview',
    ev: { q: '', flow: '', category: '', handling: '', candidate: '', sort: '事件ID', dir: 1 },
    tr: 'all',
    lg: 'all',
    sim: { b5: false, base: 'actual', runs: [], keys: null }
  };
  try { var saved = localStorage.getItem('risk-lang'); if (saved === 'en' || saved === 'zh-Hant') state.lang = saved; } catch (e) { /* storage unavailable */ }

  /* ---------- helpers ---------- */
  function T(key, params) {
    var dict = I.UI[state.lang], v = key.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, dict);
    if (v == null) v = key;
    if (params) Object.keys(params).forEach(function (k) { v = String(v).replace('{' + k + '}', params[k]); });
    return v;
  }
  function V(value) { return state.lang === 'en' && I.VALUES[value] ? I.VALUES[value] : value; }
  function FN(name) { return state.lang === 'en' ? I.FIELDS_EN[FIELD_NAMES.indexOf(name)] || name : name; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function f(e, n) { return R.field(e, n); }
  function byId(id) { return EVENTS.filter(function (e) { return f(e, '事件ID') === id; })[0]; }
  function count(pred) { return EVENTS.filter(pred).length; }
  function safeUrl(u) { return /^https?:\/\//i.test(u) ? u : ''; }

  var ICONS = {
    overview: '<path d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z"/>',
    events: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
    triage: '<path d="M3 4h18l-7 8v6l-4 2v-8z"/>',
    simulate: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    log: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    quality: '<path d="M9 12l2 2 4-4"/><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/>',
    method: '<path d="M4 19.5V5a2 2 0 0 1 2-2h14v16H6.5A2.5 2.5 0 0 0 4 21.5zM20 19v3H6.5"/>',
    shield: '<path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
    hand: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    ext: '<path d="M14 3h7v7M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    play: '<path d="M6 4l14 8-14 8z"/>',
    reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>'
  };
  function icon(name, cls) {
    return '<svg class="icon ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + ICONS[name] + '</svg>';
  }
  var FLOW_CLASS = { '紅色': 'red', '黃色': 'yellow', '綠色': 'green', '待查證': 'pending' };
  var FLOW_ICON = { '紅色': 'alert', '黃色': 'info', '綠色': 'check', '待查證': 'hand' };
  function flowBadge(flow, score) {
    if (!flow) return '<span class="muted">—</span>';
    var c = FLOW_CLASS[flow] || 'pending';
    return '<span class="badge badge-' + c + '">' + icon(FLOW_ICON[flow] || 'info') + '<span>' + esc(V(flow)) +
      (score !== undefined && score !== '' && score !== null ? ' <b class="num">' + esc(score) + '</b>' : '') + '</span></span>';
  }
  function passMark(pass) {
    return pass ? '<span class="pm pm-pass">' + icon('check') + '<span class="sr">' + T('pass') + '</span></span>'
      : '<span class="pm pm-fail">' + icon('x') + '<span class="sr">' + T('fail') + '</span></span>';
  }
  function isDrafted(e) { return R.candidateChecks(e).qualified && LOG_KEYS.has(R.snapshotKey(e)); }

  /* ---------- tooltip ---------- */
  var tip = document.getElementById('tooltip');
  document.addEventListener('mouseover', function (ev) {
    var t = ev.target.closest && ev.target.closest('[data-tip]');
    if (!t) { tip.hidden = true; return; }
    tip.textContent = t.getAttribute('data-tip'); tip.hidden = false;
  });
  document.addEventListener('mousemove', function (ev) {
    if (tip.hidden) return;
    var x = Math.min(ev.clientX + 14, window.innerWidth - tip.offsetWidth - 8);
    tip.style.transform = 'translate(' + x + 'px,' + (ev.clientY + 16) + 'px)';
  });
  document.addEventListener('focusin', function (ev) {
    var t = ev.target.closest && ev.target.closest('[data-tip]');
    if (!t) { tip.hidden = true; return; }
    var r = t.getBoundingClientRect();
    tip.textContent = t.getAttribute('data-tip'); tip.hidden = false;
    tip.style.transform = 'translate(' + Math.max(8, r.left) + 'px,' + (r.bottom + 8) + 'px)';
  });

  /* ---------- views ---------- */
  function pageHead(title, lead) {
    return '<header class="page-head"><h1 id="page-title" tabindex="-1">' + esc(title) + '</h1><p class="lead">' + esc(lead) + '</p>' +
      (T('enNote') ? '<p class="en-note">' + icon('globe') + esc(T('enNote')) + '</p>' : '') + '</header>';
  }

  function kpi(label, value, cls, hint) {
    return '<div class="kpi ' + (cls || '') + '"><div class="kpi-label">' + (cls ? icon(cls === 'k-red' ? 'alert' : cls === 'k-yellow' ? 'info' : cls === 'k-green' ? 'check' : 'hand') : '') +
      esc(label) + '</div><div class="kpi-value num">' + esc(value) + '</div>' + (hint ? '<div class="kpi-hint">' + esc(hint) + '</div>' : '') + '</div>';
  }

  function viewOverview() {
    var flows = ['紅色', '黃色', '綠色', '待查證'];
    var then = {}, now = {};
    flows.forEach(function (fl) {
      then[fl] = count(function (e) { return f(e, '事件當時－分流結果') === fl; });
      now[fl] = count(function (e) { return f(e, '目前－分流結果') === fl; });
    });
    var cands = EVENTS.filter(function (e) { return R.candidateChecks(e).qualified; });
    var drafted = cands.filter(isDrafted).length;
    var html = pageHead(T('ovTitle'), T('ovLead'));
    html += '<section class="kpis" aria-label="KPI">' +
      kpi(T('kpiEvents'), EVENTS.length) +
      kpi(T('kpiRed'), now['紅色'], 'k-red') + kpi(T('kpiYellow'), now['黃色'], 'k-yellow') +
      kpi(T('kpiGreen'), now['綠色'], 'k-green') + kpi(T('kpiPending'), now['待查證'], 'k-pending') +
      '</section>';
    html += '<section class="kpis kpis-3">' +
      kpi(T('kpiCandidates'), cands.length, '', T('kpiCandHint')) +
      kpi(T('kpiDrafted'), drafted + ' / ' + cands.length, '', T('kpiDraftHint')) +
      kpi(T('kpiHistRed'), then['紅色'], '', T('kpiHistHint')) + '</section>';

    // dual-track chart
    var maxV = Math.max.apply(null, flows.map(function (fl) { return Math.max(then[fl], now[fl]); }));
    var rows = flows.map(function (fl) {
      var c = FLOW_CLASS[fl];
      function bar(v, kind, label) {
        var w = v ? Math.max(1.5, v / maxV * 100) : 0;
        return '<div class="dbar-row"><span class="dbar-track-label">' + esc(label) + '</span><div class="dbar-area">' +
          '<div class="dbar dbar-' + c + ' dbar-' + kind + '" style="width:' + w + '%" data-tip="' + esc(V(fl) + '｜' + label + '：' + v + ' ' + T('events')) + '" tabindex="0"></div>' +
          '<span class="dbar-val num">' + v + '</span></div></div>';
      }
      return '<div class="dgroup"><div class="dgroup-label">' + flowBadge(fl) + '</div><div>' +
        bar(then[fl], 'then', T('trackThen')) + bar(now[fl], 'now', T('trackNow')) + '</div></div>';
    }).join('');
    var legend = '<div class="legend" aria-hidden="true"><span><i class="lg lg-then"></i>' + esc(T('trackThen')) + '</span><span><i class="lg lg-now"></i>' + esc(T('trackNow')) + '</span></div>';

    // category chart
    var cats = {};
    EVENTS.forEach(function (e) { var c = f(e, '主分類'); cats[c] = (cats[c] || 0) + 1; });
    var catList = Object.keys(cats).sort(function (a, b) { return cats[b] - cats[a] || a.localeCompare(b); });
    var catMax = cats[catList[0]];
    var catRows = catList.map(function (c) {
      var inTable = R.CODE_TABLE.category.indexOf(c) !== -1;
      return '<div class="hbar-row"><span class="hbar-label" title="' + esc(V(c)) + '">' + esc(V(c)) + '</span><div class="hbar-area">' +
        '<div class="hbar ' + (inTable ? '' : 'hbar-off') + '" style="width:' + (cats[c] / catMax * 100) + '%" tabindex="0" data-tip="' + esc(V(c) + '：' + cats[c] + ' ' + T('events')) + '"></div>' +
        '<span class="hbar-val num">' + cats[c] + '</span></div></div>';
    }).join('');

    html += '<div class="grid-2">' +
      '<section class="card"><h2>' + esc(T('dualTitle')) + '</h2><p class="card-lead">' + esc(T('dualLead')) + '</p>' + legend + '<div class="dchart">' + rows + '</div></section>' +
      '<section class="card"><h2>' + esc(T('catTitle')) + '</h2><p class="card-lead">' + esc(T('catLead')) + '</p><div class="hchart">' + catRows + '</div></section>' +
      '</div>';

    // candidates table
    html += '<section class="card"><div class="card-head"><div><h2>' + esc(T('candTitle')) + '</h2><p class="card-lead">' + esc(T('candLead')) + '</p></div>' +
      '<a class="btn btn-ghost" href="#/triage">' + esc(T('viewAll')) + icon('arrow') + '</a></div>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th>' + T('colId') + '</th><th>' + T('colName') + '</th><th>' + T('colNow') + '</th><th>' + T('colHandling') + '</th><th>' + T('dedupKey') + '</th></tr></thead><tbody>' +
      cands.map(function (e) {
        var id = f(e, '事件ID');
        return '<tr class="row-link" tabindex="0" data-open="' + esc(id) + '"><td class="mono">' + esc(id) + '</td><td class="name-cell">' + esc(f(e, '事件名稱')) + '</td><td>' +
          flowBadge(f(e, '目前－分流結果'), e['目前－總分']) + '</td><td>' + esc(V(f(e, '處理狀態'))) + '</td><td>' +
          (isDrafted(e) ? '<span class="pill pill-ok">' + icon('check') + esc(state.lang === 'en' ? 'Drafted' : '已建立草稿') + '</span>' : '<span class="pill">' + esc(state.lang === 'en' ? 'Not drafted' : '尚未建立') + '</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div></section>';

    // system status
    var st = [
      [state.lang === 'en' ? 'Formal version' : '正式版本', 'S6-v1.5'],
      [state.lang === 'en' ? 'B5 formal drafts (at export)' : 'B5 啟用正式草稿（匯出時）', V(B5_EXPORT)],
      [state.lang === 'en' ? 'Per-run cap' : '單次草稿上限', '5'],
      [state.lang === 'en' ? 'Sending' : '寄信方式', state.lang === 'en' ? 'Gmail drafts only, never auto-send' : '僅建立 Gmail 草稿，不自動寄信'],
      [state.lang === 'en' ? 'Formal daily trigger' : '正式每日觸發', 'runS65DailyDraftCheck｜18:00～19:00'],
      [state.lang === 'en' ? 'Active triggers' : '實際啟用中的觸發器', state.lang === 'en' ? 'Check on the Apps Script Triggers page' : '須至 Apps Script「觸發條件」頁面核對'],
      [state.lang === 'en' ? 'This website' : '本網站', state.lang === 'en' ? 'Read-only; no Gmail, no Sheets writes' : '唯讀；不連 Gmail、不寫入試算表']
    ];
    html += '<section class="card"><h2>' + esc(T('statusTitle')) + '</h2><dl class="kv">' +
      st.map(function (r) { return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('') + '</dl></section>';
    return html;
  }

  function uniq(name) {
    var s = {}; EVENTS.forEach(function (e) { s[f(e, name)] = 1; }); return Object.keys(s).filter(Boolean).sort();
  }
  function selectHtml(id, label, options, value) {
    return '<label class="field"><span>' + esc(label) + '</span><select id="' + id + '"><option value="">' + esc(T('all')) + '</option>' +
      options.map(function (o) { return '<option value="' + esc(o) + '"' + (o === value ? ' selected' : '') + '>' + esc(V(o)) + '</option>'; }).join('') + '</select></label>';
  }

  function viewEvents() {
    var s = state.ev;
    var html = pageHead(T('evTitle'), T('evLead'));
    html += '<div class="toolbar"><label class="field field-search"><span class="sr">' + esc(T('search')) + '</span>' + icon('search') +
      '<input id="ev-q" type="search" placeholder="' + esc(T('search')) + '" value="' + esc(s.q) + '" autocomplete="off"></label>' +
      selectHtml('ev-flow', T('filterFlow'), ['紅色', '黃色', '綠色', '待查證'], s.flow) +
      selectHtml('ev-category', T('filterCategory'), uniq('主分類'), s.category) +
      selectHtml('ev-handling', T('filterHandling'), uniq('處理狀態'), s.handling) +
      selectHtml('ev-candidate', T('filterCandidate'), ['是', '否'], s.candidate) +
      '<button class="btn btn-ghost" id="ev-clear" type="button">' + esc(T('clear')) + '</button></div>';
    html += '<div id="ev-results"></div>';
    return html;
  }
  function renderEventRows() {
    var s = state.ev, q = s.q.trim().toLowerCase();
    var list = EVENTS.filter(function (e) {
      if (s.flow && f(e, '目前－分流結果') !== s.flow) return false;
      if (s.category && f(e, '主分類') !== s.category) return false;
      if (s.handling && f(e, '處理狀態') !== s.handling) return false;
      if (s.candidate && f(e, 'Gmail候選') !== s.candidate) return false;
      if (q) {
        var hay = [f(e, '事件ID'), f(e, '事件名稱'), f(e, '來源機構'), f(e, '國家／區域'), f(e, '影響環節'), V(f(e, '主分類'))].join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
    var numeric = { '事件當時－總分': 1, '目前－總分': 1 };
    list.sort(function (a, b) {
      var x = a[s.sort], y = b[s.sort];
      if (numeric[s.sort]) { x = x === '' ? -1 : Number(x); y = y === '' ? -1 : Number(y); return (x - y) * s.dir; }
      return String(x).localeCompare(String(y)) * s.dir;
    });
    var cols = [['事件ID', T('colId')], ['事件名稱', T('colName')], ['事件日期', T('colDate')], ['主分類', T('colCategory')],
      ['事件當時－總分', T('colThen')], ['目前－總分', T('colNow')], ['處理狀態', T('colHandling')], ['Gmail候選', T('colCandidate')]];
    var head = cols.map(function (c) {
      var active = s.sort === c[0];
      return '<th aria-sort="' + (active ? (s.dir > 0 ? 'ascending' : 'descending') : 'none') + '"><button type="button" class="th-sort" data-sort="' + esc(c[0]) + '" title="' + esc(T('sortBy')) + '">' +
        esc(c[1]) + '<span class="sort-ind" aria-hidden="true">' + (active ? (s.dir > 0 ? '▲' : '▼') : '') + '</span></button></th>';
    }).join('');
    var body = list.map(function (e) {
      var id = f(e, '事件ID');
      return '<tr class="row-link" tabindex="0" data-open="' + esc(id) + '"><td class="mono">' + esc(id) + '</td><td class="name-cell">' + esc(f(e, '事件名稱')) +
        '</td><td class="nowrap num">' + esc(f(e, '事件日期')) + '</td><td>' + esc(V(f(e, '主分類'))) + '</td><td>' + flowBadge(f(e, '事件當時－分流結果'), e['事件當時－總分']) +
        '</td><td>' + flowBadge(f(e, '目前－分流結果'), e['目前－總分']) + '</td><td>' + esc(V(f(e, '處理狀態'))) + '</td><td>' + esc(V(f(e, 'Gmail候選'))) + '</td></tr>';
    }).join('');
    document.getElementById('ev-results').innerHTML =
      '<p class="count" role="status" aria-atomic="true">' + esc(T('resultsCount', { n: list.length, total: EVENTS.length })) + '</p>' +
      (list.length ? '<div class="table-wrap"><table class="table table-events"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>'
        : '<div class="empty">' + esc(T('noResults')) + '</div>');
  }

  /* ---------- detail ---------- */
  function scoreBlock(e, prefix) {
    var t = R.computeTrack(e, prefix);
    if (!t.complete) return '<p class="muted">' + esc(T('scoreIncomplete')) + '</p>';
    var maxes = [40, 30, 20, 10];
    var dims = state.lang === 'en' ? I.DIM_EN : R.DIMENSIONS;
    return '<div class="score-grid">' + t.raw.map(function (v, i) {
      return '<div class="score-row"><span class="score-name">' + esc(dims[i]) + ' <span class="muted num">' + v + '×' + R.WEIGHTS[i] + '</span></span>' +
        '<div class="score-track" style="width:' + maxes[i] / 40 * 100 + '%"><div class="score-fill" style="width:' + (t.weighted[i] / maxes[i] * 100) + '%" data-tip="' +
        esc(dims[i] + '：' + t.weighted[i] + ' / ' + maxes[i]) + '"></div></div><span class="num score-val">' + t.weighted[i] + '<span class="muted">/' + maxes[i] + '</span></span></div>';
    }).join('') + '</div><div class="score-total"><span>' + esc(T('total')) + '</span><b class="num">' + t.total + '</b>' + flowBadge(t.storedFlow) + '</div>';
  }
  function fieldList(e, names) {
    return '<dl class="fields">' + names.map(function (n) {
      var v = f(e, n), out;
      if (n === '來源網址' && safeUrl(v)) out = '<a href="' + esc(v) + '" target="_blank" rel="noopener noreferrer">' + esc(v) + icon('ext') + '</a>';
      else out = v === '' ? '<span class="muted">—</span>' : esc(V(v));
      return '<div><dt>' + esc(FN(n)) + '</dt><dd>' + out + '</dd></div>';
    }).join('') + '</dl>';
  }
  function openDetail(id) {
    var e = byId(id); if (!e) return;
    var c = R.candidateChecks(e);
    var dlg = document.getElementById('detail');
    var candHtml = '<ul class="checklist">' + c.checks.map(function (ch) {
      return '<li>' + passMark(ch.pass) + '<span>' + esc(T('c_' + ch.key)) + '</span></li>';
    }).join('') + '</ul>';
    if (c.qualified) {
      var key = R.snapshotKey(e), done = LOG_KEYS.has(key);
      candHtml += '<div class="keybox"><div class="kv-label">' + esc(T('dedupKey')) + '</div><code>' + esc(key) + '</code><p class="' + (done ? 'ok' : '') + '">' +
        icon(done ? 'check' : 'info') + esc(done ? T('draftedYes') : T('draftedNo')) + '</p></div>';
    } else {
      candHtml += '<p class="muted">' + esc(T('notApplicable')) + '：' + esc(c.reasons.map(V).join('、')) + '</p>';
    }
    var g = function (from, to) { return FIELD_NAMES.slice(FIELD_NAMES.indexOf(from), FIELD_NAMES.indexOf(to) + 1); };
    dlg.querySelector('.dlg-body').innerHTML =
      '<header class="dlg-head"><div><p class="mono muted">' + esc(id) + '</p><h2 id="detail-title">' + esc(f(e, '事件名稱')) + '</h2>' +
      '<div class="badges">' + flowBadge(f(e, '目前－分流結果'), e['目前－總分']) + '<span class="pill">' + esc(V(f(e, '主分類'))) + '</span><span class="pill">' + esc(V(f(e, '處理狀態'))) + '</span></div></div>' +
      '<button class="btn btn-icon" type="button" data-close aria-label="' + esc(T('detailClose')) + '">' + icon('x') + '</button></header>' +
      '<section class="dsec"><h3>' + esc(T('secCand')) + '</h3>' + candHtml + '</section>' +
      '<div class="grid-2 tight"><section class="dsec"><h3>' + esc(T('secThen')) + '</h3>' + scoreBlock(e, '事件當時') + '</section>' +
      '<section class="dsec"><h3>' + esc(T('secNow')) + '</h3>' + scoreBlock(e, '目前') + '</section></div>' +
      '<section class="dsec"><h3>' + esc(T('secBasic')) + '</h3>' + fieldList(e, g('事件ID', '營運解讀')) + '</section>' +
      '<section class="dsec"><h3>' + esc(T('secSource')) + '</h3>' + fieldList(e, g('來源機構', '查詢日期')) + '</section>' +
      '<section class="dsec"><h3>' + esc(T('secThen')) + '</h3>' + fieldList(e, g('事件當時－影響程度(1-5)', '事件當時－分流結果').concat(['事件當時－分數說明'])) + '</section>' +
      '<section class="dsec"><h3>' + esc(T('secHandling')) + '</h3>' + fieldList(e, g('建議通知部門', '到期日').concat(['備註'])) + '</section>' +
      '<section class="dsec"><h3>' + esc(T('secNow')) + '</h3>' + fieldList(e, g('目前狀態查證', '目前－分數說明')) + '</section>';
    dlg.dataset.returnFocus = id;
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    dlg.querySelector('[data-close]').focus();
  }

  /* ---------- triage ---------- */
  function viewTriage() {
    var html = pageHead(T('trTitle'), T('trLead'));
    var opts = [['all', T('trAll')], ['qualified', T('trQualified')], ['excluded', T('trExcluded')]];
    html += '<div class="toolbar" role="group" aria-label="' + esc(T('trShow')) + '">' + opts.map(function (o) {
      return '<button type="button" class="seg' + (state.tr === o[0] ? ' on' : '') + '" aria-pressed="' + (state.tr === o[0]) + '" data-tr="' + o[0] + '">' + esc(o[1]) + '</button>';
    }).join('') + '</div>';
    var keys = ['verified', 'score', 'red', 'candidate', 'url'];
    var rows = EVENTS.map(function (e) { return { e: e, c: R.candidateChecks(e) }; }).filter(function (r) {
      return state.tr === 'all' || (state.tr === 'qualified') === r.c.qualified;
    });
    html += '<div class="table-wrap"><table class="table table-triage"><thead><tr><th>' + T('colId') + '</th><th>' + T('colName') + '</th>' +
      keys.map(function (k) { return '<th class="c">' + esc(T('c_' + k)) + '</th>'; }).join('') + '<th>' + T('trResult') + '</th><th>' + T('trReasons') + '</th></tr></thead><tbody>' +
      rows.map(function (r) {
        var id = f(r.e, '事件ID');
        return '<tr class="row-link' + (r.c.qualified ? ' row-hl' : '') + '" tabindex="0" data-open="' + esc(id) + '"><td class="mono">' + esc(id) + '</td><td class="name-cell">' + esc(f(r.e, '事件名稱')) + '</td>' +
          r.c.checks.map(function (ch) { return '<td class="c">' + passMark(ch.pass) + '</td>'; }).join('') +
          '<td>' + (r.c.qualified ? '<span class="pill pill-red">' + icon('alert') + esc(T('trQualifiedLabel')) + '</span>' : '<span class="pill">' + esc(T('trExcludedLabel')) + '</span>') + '</td>' +
          '<td class="small">' + esc(r.c.reasons.map(V).join('、')) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    return html;
  }

  /* ---------- simulate ---------- */
  function simBaseKeys() { return state.sim.base === 'actual' ? new Set(LOG_KEYS) : new Set(); }
  function viewSimulate() {
    var s = state.sim;
    if (!s.keys) s.keys = simBaseKeys();
    var html = pageHead(T('smTitle'), T('smLead'));
    html += '<div class="banner banner-sim" role="note">' + icon('shield') + '<span>' + esc(T('smBanner')) + '</span></div>';
    html += '<div class="grid-sim"><section class="card"><fieldset class="radios"><legend>' + esc(T('smB5')) + '</legend>' +
      '<label><input type="radio" name="sm-b5" value="0"' + (!s.b5 ? ' checked' : '') + '> ' + esc(T('smB5Off')) + '</label>' +
      '<label><input type="radio" name="sm-b5" value="1"' + (s.b5 ? ' checked' : '') + '> ' + esc(T('smB5On')) + '</label>' +
      '<p class="hint">' + esc(T('smB5Note', { v: V(B5_EXPORT) })) + '</p></fieldset>' +
      '<fieldset class="radios"><legend>' + esc(T('smBase')) + '</legend>' +
      '<label><input type="radio" name="sm-base" value="actual"' + (s.base === 'actual' ? ' checked' : '') + '> ' + esc(T('smBaseActual')) + '</label>' +
      '<label><input type="radio" name="sm-base" value="empty"' + (s.base === 'empty' ? ' checked' : '') + '> ' + esc(T('smBaseEmpty')) + '</label></fieldset>' +
      '<div class="actions"><button type="button" class="btn btn-primary" id="sm-run">' + icon('play') + esc(T('smRun')) + '</button>' +
      '<button type="button" class="btn btn-ghost" id="sm-reset">' + icon('reset') + esc(T('smReset')) + '</button></div></section>' +
      '<section class="card"><h2>' + esc(T('smLimitTitle')) + '</h2><ul class="checklist">' +
      ['smRule1', 'smRule2', 'smRule3', 'smRule4'].map(function (k) { return '<li>' + passMark(true) + '<span>' + esc(T(k)) + '</span></li>'; }).join('') + '</ul></section></div>';
    html += '<div id="sm-runs" aria-live="polite">' + renderRuns() + '</div>';
    return html;
  }
  function renderRuns() {
    var runs = state.sim.runs;
    if (!runs.length) return '<div class="empty">' + esc(T('smNoRuns')) + '</div>';
    return runs.slice().reverse().map(function (r, idx) {
      var n = runs.length - idx;
      var stats = '<div class="sim-stats">' +
        '<div><span>' + esc(T('smQualified')) + '</span><b class="num">' + r.qualified.length + '</b></div>' +
        '<div><span>' + esc(T('smDuplicate')) + '</span><b class="num">' + r.duplicates.length + '</b></div>' +
        '<div><span>' + esc(T('smCreated')) + '</span><b class="num">' + r.created.length + '</b><em>' + esc(T('smCap', { n: R.MAX_DRAFTS_PER_RUN })) + '</em></div>' +
        '<div><span>' + esc(T('smDeferred')) + '</span><b class="num">' + (r.b5Enabled ? r.deferred.length : 0) + '</b></div></div>';
      var list = '';
      if (!r.b5Enabled) list = '<p class="muted">' + icon('info') + esc(T('smPreviewOnly')) + (r.qualified.length ? '：' + esc(r.qualified.map(function (q) { return f(q.event, '事件ID'); }).join('、')) : '') + '</p>';
      else if (r.created.length) list = '<ul class="sim-list">' + r.created.map(function (q) {
        var id = f(q.event, '事件ID');
        return '<li><span class="mono">' + esc(id) + '</span><span class="name-cell">' + esc(f(q.event, '事件名稱')) + '</span>' + flowBadge(f(q.event, '目前－分流結果'), q.event['目前－總分']) +
          '<button type="button" class="btn btn-ghost btn-sm" data-preview="' + esc(id) + '">' + icon('eye') + esc(T('smPreview')) + '</button></li>';
      }).join('') + '</ul>';
      if (r.b5Enabled && r.deferred.length) list += '<p class="muted small">' + esc(T('smDeferred')) + '：' + esc(r.deferred.map(function (q) { return f(q.event, '事件ID'); }).join('、')) + '</p>';
      return '<section class="card sim-run"><h2>' + esc(T('smRunN', { n: n })) + ' <span class="pill">B5＝' + esc(V(r.b5Enabled ? '是' : '否')) + '</span></h2>' + stats + list + '</section>';
    }).join('');
  }
  function openPreview(id) {
    var e = byId(id), key = R.snapshotKey(e);
    var dlg = document.getElementById('preview');
    dlg.querySelector('.dlg-body').innerHTML = '<header class="dlg-head"><div><p class="mono muted">' + esc(id) + '</p><h2 id="preview-title">' + esc(T('smPreview')) + '</h2></div>' +
      '<button class="btn btn-icon" type="button" data-close aria-label="' + esc(T('detailClose')) + '">' + icon('x') + '</button></header>' +
      '<div class="banner banner-sim">' + icon('shield') + '<span>' + esc(T('smBanner')) + '</span></div>' +
      '<dl class="kv mail"><div><dt>' + esc(T('smTo')) + '</dt><dd class="mono">risk-alert@example.com</dd></div><div><dt>' + esc(T('smSubject')) + '</dt><dd>' + esc(R.draftSubject(e)) + '</dd></div></dl>' +
      '<pre class="mail-body">' + esc(R.draftBody(e, key)) + '</pre>';
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    dlg.querySelector('[data-close]').focus();
  }

  /* ---------- log ---------- */
  function viewLog() {
    var html = pageHead(T('lgTitle'), T('lgLead'));
    var opts = [['all', T('lgAll')], ['formal', T('lgFormal')], ['test', T('lgTest')]];
    html += '<div class="toolbar" role="group">' + opts.map(function (o) {
      return '<button type="button" class="seg' + (state.lg === o[0] ? ' on' : '') + '" aria-pressed="' + (state.lg === o[0]) + '" data-lg="' + o[0] + '">' + esc(o[1]) + '</button>';
    }).join('') + '</div>';
    html += '<div class="notes"><p>' + icon('info') + esc(T('lgNoteFormal')) + '</p><p>' + icon('info') + esc(T('lgNoteTest')) + '</p></div>';
    var rows = LOG.filter(function (r) { return state.lg === 'all' || (state.lg === 'formal') === R.isFormalLog(r); });
    html += '<div class="table-wrap"><table class="table table-log"><thead><tr><th>' + T('colTime') + '</th><th>' + T('colType') + '</th><th>' + T('colId') + '</th><th>' + T('colName') + '</th><th>' + T('colScore') +
      '</th><th>' + T('colResult') + '</th><th>' + T('colVersion') + '</th><th>' + T('colTo') + '</th><th>' + T('colNote') + '</th></tr></thead><tbody>' +
      rows.map(function (r) {
        var formal = R.isFormalLog(r), id = String(r['事件ID']);
        return '<tr' + (formal ? ' class="row-hl"' : '') + '><td class="nowrap num">' + esc(r['時間戳記']) + '</td><td>' + (formal ? '<span class="pill pill-red">' + esc(T('lgFormal')) + '</span>' : '<span class="pill">' + esc(state.lang === 'en' ? 'Test' : '測試') + '</span>') +
          '</td><td class="mono">' + (byId(id) ? '<a href="#/events" data-open="' + esc(id) + '">' + esc(id) + '</a>' : esc(id)) + '</td><td class="name-cell">' + esc(r['事件名稱']) + '</td><td class="num">' + esc(r['目前總分']) +
          '</td><td>' + esc(V(r['結果'])) + '</td><td class="mono small">' + esc(r['程式版本']) + '</td><td class="mono small">' + esc(r['收件者']) + '</td><td class="small note-cell">' + esc(r['說明']) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    return html;
  }

  /* ---------- quality ---------- */
  function viewQuality() {
    var html = pageHead(T('qcTitle'), T('qcLead'));
    var checks = R.qualityChecks(EVENTS, LOG);
    var label = { pass: T('qcPass'), fail: T('qcFail'), warn: T('qcWarn'), info: T('qcInfo'), manual: T('qcManual') };
    var ic = { pass: 'check', fail: 'x', warn: 'alert', info: 'info', manual: 'hand' };
    var tally = {}; checks.forEach(function (c) { tally[c.status] = (tally[c.status] || 0) + 1; });
    html += '<div class="qc-summary">' + ['pass', 'warn', 'manual', 'fail'].map(function (k) {
      return '<div class="qc-sum qc-' + k + '">' + icon(ic[k]) + '<span>' + esc(label[k]) + '</span><b class="num">' + (tally[k] || 0) + '</b></div>';
    }).join('') + '</div>';
    html += '<div class="table-wrap"><table class="table"><thead><tr><th>' + T('qcItem') + '</th><th>' + T('qcResult') + '</th><th>' + T('qcStatus') + '</th><th>' + T('qcDetail') + '</th></tr></thead><tbody>' +
      checks.map(function (c) {
        var q = T('q')[c.id];
        return '<tr><td>' + esc(q[0]) + '</td><td class="num">' + (c.count === null ? '—' : c.count) + '</td><td><span class="qc-badge qc-' + c.status + '">' + icon(ic[c.status]) + esc(label[c.status]) + '</span></td><td class="small">' + esc(q[1]) +
          (c.ids.length ? '<div class="ids">' + esc(T('affected')) + '：' + c.ids.map(function (id) { return byId(id) ? '<a href="#/quality" data-open="' + esc(id) + '" class="mono">' + esc(id) + '</a>' : esc(id); }).join(' ') + '</div>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    return html;
  }

  /* ---------- method ---------- */
  function viewMethod() {
    var en = state.lang === 'en';
    var html = pageHead(T('mtTitle'), T('mtLead'));
    var dims = en ? I.DIM_EN : R.DIMENSIONS;
    html += '<div class="grid-2"><section class="card"><h2>' + esc(T('mtFormula')) + '</h2><p class="formula num">' + dims.map(function (d, i) { return esc(d) + '×' + R.WEIGHTS[i]; }).join(' ＋ ') + ' ＝ 100</p>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th>' + T('mtDim') + '</th><th>' + T('mtLevel') + '</th><th>' + T('mtWeight') + '</th><th>' + T('mtMax') + '</th></tr></thead><tbody>' +
      dims.map(function (d, i) { return '<tr><td>' + esc(d) + '</td><td class="num">1–5</td><td class="num">×' + R.WEIGHTS[i] + '</td><td class="num">' + 5 * R.WEIGHTS[i] + '</td></tr>'; }).join('') +
      '</tbody></table></div></section>' +
      '<section class="card"><h2>' + esc(T('mtThreshold')) + '</h2><div class="thresholds">' +
      '<div>' + flowBadge('紅色') + '<b class="num">80–100</b><span>' + esc(en ? 'Eligible for Gmail draft after passing the verification gate' : '通過查證閘門後可成為 Gmail 候選') + '</span></div>' +
      '<div>' + flowBadge('黃色') + '<b class="num">40–79</b><span>' + esc(en ? 'Track, add data, re-assess' : '追蹤、補資料或安排再評估') + '</span></div>' +
      '<div>' + flowBadge('綠色') + '<b class="num">0–39</b><span>' + esc(en ? 'Keep observing; never a formal alert' : '保留觀察，不進入正式通知') + '</span></div>' +
      '<div>' + flowBadge('待查證') + '<b>—</b><span>' + esc(en ? 'Insufficient evidence; never sent regardless of score' : '證據不足，無論分數高低均不得寄送') + '</span></div></div>' +
      '<h3>' + esc(T('mtDedup')) + '</h3><p class="small">' + esc(T('mtDedupText')) + '</p><code class="block">CURRENT|EVT-028|86|2168296ca0283d9f</code></section></div>';

    // rating definitions from 評分與代碼
    var sc = R.DIMENSIONS.map(function (d) { return D.scoringCodes.filter(function (r) { return r[0] === d; })[0] || [d]; });
    html += '<section class="card"><h2>' + esc(T('mtLevels')) + '</h2><div class="table-wrap"><table class="table"><thead><tr><th>' + T('mtDim') + '</th>' +
      [1, 2, 3, 4, 5].map(function (n) { return '<th>' + n + (en ? '' : '分') + '</th>'; }).join('') + '</tr></thead><tbody>' +
      sc.map(function (r, i) { return '<tr><td>' + esc(dims[i]) + '</td>' + r.slice(1).map(function (c) { return '<td class="small">' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') +
      '</tbody></table></div>' + (en ? '<p class="en-note">' + icon('globe') + 'Definitions shown in the original Traditional Chinese.</p>' : '') + '</section>';

    // architecture
    var steps = en ? ['Public primary sources', 'Collect, verify, dedupe, record', 'Google Sheets event database', 'Dual-track 4-dimension weighted scoring', 'Current red + verified + candidate + URL', 'Apps Script S6-v1.5 (daily 18:00–19:00, max 5)', 'Gmail draft only + notification log', 'Human review decides whether to send']
      : ['公開一手來源', '事件蒐集、查證、去重與建檔', 'Google Sheets 事件資料庫', '雙軌四構面加權評分', '目前紅色＋已查證＋Gmail候選＋來源網址', 'Apps Script S6-v1.5（每日 18:00～19:00，最多 5 封）', '只建立 Gmail 草稿＋通知紀錄', '人工覆核、決定是否寄送'];
    html += '<section class="card"><h2>' + esc(T('mtArch')) + '</h2><ol class="flow">' + steps.map(function (s, i) {
      return '<li class="' + (i === 6 ? 'flow-safe' : i === 7 ? 'flow-human' : '') + '"><span class="flow-n num">' + (i + 1) + '</span>' + esc(s) + '</li>';
    }).join('') + '</ol><p class="hint">' + icon('info') + esc(en ? 'This website reads a de-identified static copy of step 3 only. It has no connection to steps 6–8.' : '本網站只讀取第 3 步的去識別化靜態副本，與第 6～8 步沒有任何連線。') + '</p></section>';

    html += '<div class="grid-2"><section class="card"><h2>' + esc(T('mtSafety')) + '</h2><ul class="checklist">' +
      (en ? ['Gmail drafts only; no sendEmail / draft.send in the formal code', 'B5 = No: preview only, no drafts, no log rows', 'At most 5 drafts per run; the rest carry over', 'Snapshot dedup key checked again right before each draft', 'LockService prevents concurrent runs', 'Unverified or grade-D sources never trigger a formal alert']
        : ['只建立 Gmail 草稿；正式程式沒有 sendEmail／draft.send', 'B5＝否：只預覽，不建草稿、不新增紀錄', '每次最多 5 封，其餘留待下次', '建立前再次比對快照防重複鍵', 'LockService 避免同時執行', '未查證或來源等級 D 不得正式通知'])
        .map(function (s) { return '<li>' + passMark(true) + '<span>' + esc(s) + '</span></li>'; }).join('') + '</ul>' +
      '<h3>' + esc(T('mtTrigger')) + '</h3><p class="small">' + esc(T('mtTriggerText')) + '</p></section>' +
      '<section class="card"><h2>' + esc(T('mtDemo')) + '</h2><p class="small">' + esc(T('mtDemoText')) + '</p><ul class="todo">' +
      T('mtDemoList').map(function (s) { return '<li>' + icon('hand') + '<span>' + esc(s) + '</span></li>'; }).join('') + '</ul>' +
      '<h3>' + esc(T('mtPhase2')) + '</h3><p class="small">' + esc(T('mtPhase2Text')) + '</p></section></div>';

    // SOP
    html += '<section class="card"><h2>' + esc(T('mtSop')) + '</h2>' + (en ? '<p class="en-note">' + icon('globe') + 'SOP shown in the original Traditional Chinese.</p>' : '') +
      '<div class="table-wrap"><table class="table"><thead><tr>' + ['步驟', '階段', '核心作業', '產出／通過條件', '目前狀態', '需人工確認的情況'].map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      D.sop.map(function (s) {
        return '<tr><td class="mono">' + esc(s['步驟']) + '</td><td class="nowrap">' + esc(s['階段']) + '</td><td class="small">' + esc(s['核心作業']) + '</td><td class="small">' + esc(s['產出／通過條件']) + '</td><td class="small nowrap">' + esc(s['目前狀態']) + '</td><td class="small">' + esc(s['需人工確認的情況']) + '</td></tr>';
      }).join('') + '</tbody></table></div><p class="hint">' + icon('info') + esc(en ? 'SOP statuses are as recorded in the exported sheet; the handoff document records S8 as formally enabled and accepted on 2026-09-27.' : 'SOP 狀態為匯出工作表中的原始紀錄；依交接文件，S8 已於 2026-09-27 正式啟用並驗收通過。') + '</p></section>';
    return html;
  }

  /* ---------- shell & routing ---------- */
  var VIEWS = { overview: viewOverview, events: viewEvents, triage: viewTriage, simulate: viewSimulate, log: viewLog, quality: viewQuality, method: viewMethod };
  function renderChrome() {
    document.documentElement.lang = state.lang === 'en' ? 'en' : 'zh-Hant-TW';
    document.title = T('appTitle');
    var at = T('appTitle').split(/\s*[｜|]\s*/);
    document.getElementById('app-title').innerHTML = at.length === 2 ? '<span>' + at[0] + '</span><i class="brand-sep" aria-hidden="true">|</i><span>' + at[1] + '</span>' : T('appTitle');
    document.getElementById('app-sub').textContent = T('appSub');
    document.getElementById('lang-label').textContent = T('language');
    document.getElementById('lang').value = state.lang;
    var hl = document.getElementById('home-link-text'); if (hl) hl.textContent = state.lang === 'en' ? 'Overview (ZH)' : '決策總覽';
    var NAV_EN = { events: 'Events', map: 'Risk map (ZH)', triage: 'Triage', method: 'Method', simulate: 'Draft simulation', log: 'Notification log' },
      NAV_ZH = { events: '事件情報', map: '風險版圖', triage: '候選判定', method: '方法與治理', simulate: '草稿模擬', log: '通知紀錄' };
    [].forEach.call(document.querySelectorAll('#site-nav a[data-nav]'), function (a) { var k = a.getAttribute('data-nav'); if (NAV_ZH[k]) a.textContent = state.lang === 'en' ? NAV_EN[k] : NAV_ZH[k]; });
    var nt = document.getElementById('nav-toggle-text'); if (nt) nt.textContent = state.lang === 'en' ? 'Menu' : '選單';
    var sn = document.getElementById('site-nav'); if (sn) sn.setAttribute('aria-label', state.lang === 'en' ? 'Main navigation' : '主要導覽'); var hlk = document.getElementById('home-link'); if (hlk) hlk.setAttribute('aria-label', state.lang === 'en' ? 'Back to executive overview (Chinese)' : '回到決策總覽');
    document.getElementById('data-badge').textContent = T('dataBadge', { date: D.meta.exportedAt });
    document.getElementById('safety-text').textContent = T('safetyRibbon');
    document.getElementById('safety-link').textContent = T('safetyMore');
    document.getElementById('skip').textContent = T('skip');
    document.getElementById('footer').textContent = T('footer');
    document.getElementById('nav').innerHTML = Object.keys(VIEWS).map(function (k) {
      return '<a href="#/' + k + '"' + (state.view === k ? ' aria-current="page"' : '') + '>' + icon(k) + '<span>' + esc(T('nav.' + k)) + '</span></a>';
    }).join('');
  }
  function render(focusTitle) {
    renderChrome();
    var main = document.getElementById('main');
    main.innerHTML = VIEWS[state.view]();
    if (state.view === 'events') renderEventRows();
    if (focusTitle) { var h = document.getElementById('page-title'); if (h) h.focus({ preventScroll: true }); window.scrollTo(0, 0); }
  }
  function route() {
    var v = (location.hash.replace(/^#\/?/, '') || 'overview').split('?')[0];
    state.view = VIEWS[v] ? v : 'overview';
    render(true);
  }

  /* ---------- events ---------- */
  document.getElementById('lang').addEventListener('change', function (ev) {
    state.lang = ev.target.value;
    try { localStorage.setItem('risk-lang', state.lang); } catch (e) { /* ignore */ }
    render(false);
  });
  document.addEventListener('click', function (ev) {
    var t = ev.target;
    var open = t.closest('[data-open]');
    if (open) { ev.preventDefault(); openDetail(open.getAttribute('data-open')); return; }
    var close = t.closest('[data-close]');
    if (close) { close.closest('dialog').close(); return; }
    if (t.tagName === 'DIALOG') { t.close(); return; }
    var sort = t.closest('[data-sort]');
    if (sort) { var k = sort.getAttribute('data-sort'); if (state.ev.sort === k) state.ev.dir *= -1; else { state.ev.sort = k; state.ev.dir = 1; } renderEventRows(); var b = document.querySelector('[data-sort="' + k + '"]'); if (b) b.focus(); return; }
    var tr = t.closest('[data-tr]'); if (tr) { state.tr = tr.getAttribute('data-tr'); render(false); return; }
    var lg = t.closest('[data-lg]'); if (lg) { state.lg = lg.getAttribute('data-lg'); render(false); return; }
    var pv = t.closest('[data-preview]'); if (pv) { openPreview(pv.getAttribute('data-preview')); return; }
    if (t.closest('#ev-clear')) { state.ev = { q: '', flow: '', category: '', handling: '', candidate: '', sort: '事件ID', dir: 1 }; render(false); return; }
    if (t.closest('#sm-run')) {
      var r = R.simulateRun(EVENTS, state.sim.keys, state.sim.b5);
      state.sim.keys = r.keysAfter; state.sim.runs.push(r);
      document.getElementById('sm-runs').innerHTML = renderRuns(); return;
    }
    if (t.closest('#sm-reset')) { state.sim.runs = []; state.sim.keys = simBaseKeys(); document.getElementById('sm-runs').innerHTML = renderRuns(); return; }
  });
  document.addEventListener('keydown', function (ev) {
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches && ev.target.matches('tr[data-open]')) {
      ev.preventDefault(); openDetail(ev.target.getAttribute('data-open'));
    }
  });
  document.addEventListener('input', function (ev) {
    if (ev.target.id === 'ev-q') { state.ev.q = ev.target.value; renderEventRows(); }
  });
  document.addEventListener('change', function (ev) {
    var id = ev.target.id;
    var map = { 'ev-flow': 'flow', 'ev-category': 'category', 'ev-handling': 'handling', 'ev-candidate': 'candidate' };
    if (map[id]) { state.ev[map[id]] = ev.target.value; renderEventRows(); return; }
    if (ev.target.name === 'sm-b5') { state.sim.b5 = ev.target.value === '1'; return; }
    if (ev.target.name === 'sm-base') { state.sim.base = ev.target.value; state.sim.runs = []; state.sim.keys = simBaseKeys(); document.getElementById('sm-runs').innerHTML = renderRuns(); }
  });
  Array.prototype.forEach.call(document.querySelectorAll('dialog'), function (dlg) {
    dlg.addEventListener('close', function () {
      var id = dlg.dataset.returnFocus;
      var el = id && document.querySelector('tr[data-open="' + id + '"]');
      if (el) el.focus();
    });
  });
  window.addEventListener('hashchange', route);
  route();
})();
