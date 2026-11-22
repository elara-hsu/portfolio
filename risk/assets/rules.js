/*
 * rules.js — 半導體風險監控系統：業務規則（唯讀）
 *
 * 所有規則一比一對照 Apps Script S6-v1.5：
 *   - 評分：影響×8＋可能性×6＋緊急×4＋可信度×2（最高 100）
 *   - 分流：紅 80–100、黃 40–79、綠 0–39；目前狀態未查證 → 待查證
 *   - 正式候選：createCurrentQualifiedDrafts() 的五項條件（目前總分 ≥ 80）
 *   - 防重複鍵：CURRENT|事件ID|目前總分|SHA-256 前 16 碼
 *
 * 本檔只做計算，不呼叫任何網路、Gmail 或 Google 試算表。
 */
(function (root) {
  'use strict';

  var WEIGHTS = [8, 6, 4, 2];
  var MAX_DRAFTS_PER_RUN = 5;
  var DIMENSIONS = ['影響程度', '持續／發生可能性', '緊急程度', '來源可信度'];
  var WEIGHTED_NAMES = ['影響分', '可能性分', '緊急分', '可信度分'];
  var CODE_TABLE = {
    category: ['政策法規', '供應中斷', '生產設施', '自然與資源', '物流交付', '市場財務'],
    nature: ['威脅', '機會', '混合'],
    handling: ['待處理', '追蹤中', '持續觀察', '已結案'],
    verification: ['已查證', '部分查證', '待查證'],
    grade: ['A', 'B', 'C', 'D']
  };

  /* ---------- 與 Apps Script 相同的正規化 ---------- */
  function normalizeValue(v) {
    return String(v == null ? '' : v).replace(/\s+/g, '').trim();
  }
  function field(e, name) {
    var v = e[name];
    return String(v == null ? '' : v).trim();
  }

  /* ---------- 評分 ---------- */
  // prefix: '事件當時' 或 '目前'
  function rawScores(e, prefix) {
    return DIMENSIONS.map(function (d) {
      var v = e[prefix + '－' + d + '(1-5)'];
      return v === '' || v == null ? null : Number(v);
    });
  }
  function isValidLevel(v) {
    return v !== null && Number.isInteger(v) && v >= 1 && v <= 5;
  }
  function computeTrack(e, prefix) {
    var raw = rawScores(e, prefix);
    var complete = raw.every(isValidLevel);
    var weighted = raw.map(function (v, i) { return isValidLevel(v) ? v * WEIGHTS[i] : null; });
    var total = complete ? weighted.reduce(function (a, b) { return a + b; }, 0) : null;
    return {
      raw: raw,
      weighted: weighted,
      complete: complete,
      total: total,
      flow: total === null ? null : flowFromScore(total),
      storedWeighted: WEIGHTED_NAMES.map(function (n) { var v = e[prefix + '－' + n]; return v === '' ? null : v; }),
      storedTotal: e[prefix + '－總分'] === '' ? null : e[prefix + '－總分'],
      storedFlow: field(e, prefix + '－分流結果')
    };
  }
  function flowFromScore(total) {
    if (total >= 80) return '紅色';
    if (total >= 40) return '黃色';
    return '綠色';
  }
  // 目前分流：目前狀態未達「已查證」時，查證閘門優先 → 待查證
  function expectedCurrentFlow(e) {
    if (normalizeValue(e['目前狀態查證']) !== '已查證') return '待查證';
    var t = computeTrack(e, '目前');
    return t.flow;
  }

  /* ---------- 正式候選（createCurrentQualifiedDrafts 五項條件） ---------- */
  function candidateChecks(e) {
    var totalText = field(e, '目前－總分');
    var total = Number(String(totalText).replace(/,/g, '').trim());
    var checks = [
      { key: 'verified', pass: normalizeValue(e['目前狀態查證']) === '已查證', reason: '目前狀態尚未查證' },
      { key: 'score', pass: totalText !== '' && Number.isFinite(total) && total >= 80, reason: '目前總分未達80分' },
      { key: 'red', pass: normalizeValue(e['目前－分流結果']) === '紅色', reason: '目前分流結果不是紅色' },
      { key: 'candidate', pass: normalizeValue(e['Gmail候選']) === '是', reason: 'Gmail候選不是「是」' },
      { key: 'url', pass: field(e, '來源網址') !== '', reason: '缺少來源網址' }
    ];
    return {
      checks: checks,
      qualified: checks.every(function (c) { return c.pass; }),
      reasons: checks.filter(function (c) { return !c.pass; }).map(function (c) { return c.reason; }),
      total: total
    };
  }

  /* ---------- SHA-256（純 JavaScript，同步；file:// 也能使用） ---------- */
  var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  function utf8Bytes(str) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
    var out = [], s = unescape(encodeURIComponent(str));
    for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
    return out;
  }
  function sha256Hex(str) {
    var bytes = utf8Bytes(String(str));
    var len = bytes.length;
    var withPad = ((len + 9 + 63) >> 6) << 6;
    var m = new Uint8Array(withPad);
    m.set(bytes);
    m[len] = 0x80;
    var bitLen = len * 8;
    m[withPad - 4] = (bitLen >>> 24) & 255;
    m[withPad - 3] = (bitLen >>> 16) & 255;
    m[withPad - 2] = (bitLen >>> 8) & 255;
    m[withPad - 1] = bitLen & 255;
    m[withPad - 5] = Math.floor(bitLen / 4294967296) & 255;
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var W = new Array(64);
    function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }
    for (var off = 0; off < withPad; off += 64) {
      for (var t = 0; t < 16; t++) {
        W[t] = (m[off + t * 4] << 24) | (m[off + t * 4 + 1] << 16) | (m[off + t * 4 + 2] << 8) | m[off + t * 4 + 3];
      }
      for (t = 16; t < 64; t++) {
        var s0 = rotr(W[t - 15], 7) ^ rotr(W[t - 15], 18) ^ (W[t - 15] >>> 3);
        var s1 = rotr(W[t - 2], 17) ^ rotr(W[t - 2], 19) ^ (W[t - 2] >>> 10);
        W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (t = 0; t < 64; t++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var t1 = (h + S1 + ch + K[t] + W[t]) | 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return H.map(function (x) { return ('00000000' + (x >>> 0).toString(16)).slice(-8); }).join('');
  }

  /* ---------- 防重複鍵（與 Apps Script 相同組成） ---------- */
  function snapshotKey(e) {
    var c = candidateChecks(e);
    var currentTotal = c.total;
    var snapshotText = [
      field(e, '事件ID'),
      currentTotal,
      field(e, '目前－分流結果'),
      field(e, 'Gmail候選'),
      field(e, '來源網址'),
      field(e, '目前－分數說明')
    ].join('|');
    return 'CURRENT|' + field(e, '事件ID') + '|' + currentTotal + '|' + sha256Hex(snapshotText).substring(0, 16);
  }
  // 與 readS64DDedupKeys_ 相同：從「說明」欄讀取「防重複鍵：CURRENT|…」
  function logDedupKeys(log) {
    var keys = new Set();
    log.forEach(function (row) {
      var m = String(row['說明'] || '').match(/防重複鍵：(CURRENT\|[^\r\n]+)/);
      if (m) keys.add(m[1].trim());
    });
    return keys;
  }
  function isFormalLog(row) {
    return String(row['結果'] || '') === '目前狀態正式草稿已建立';
  }

  /* ---------- 草稿模擬（只在記憶體中，不會呼叫 Gmail） ---------- */
  function draftSubject(e) {
    var c = candidateChecks(e);
    return '[目前狀態正式草稿勿寄][半導體營運預警][' + field(e, '目前－分流結果') + ' ' + c.total + '分] ' +
      field(e, '事件ID') + '｜' + field(e, '事件名稱');
  }
  function draftBody(e, key) {
    var c = candidateChecks(e);
    function or(v) { return field(e, v) || '未填寫'; }
    return [
      '【本信為正式資料草稿，請人工確認後再決定是否寄出】', '',
      '事件ID：' + field(e, '事件ID'), '事件名稱：' + field(e, '事件名稱'), '事件日期：' + field(e, '事件日期'),
      '國家／區域：' + field(e, '國家／區域'), '主分類：' + field(e, '主分類'), '',
      '目前總分：' + c.total, '目前分流結果：' + field(e, '目前－分流結果'), '',
      '影響環節：', or('影響環節'), '', '來源事實摘要：', or('來源事實摘要'), '',
      '營運解讀：', or('營運解讀'), '', '建議通知部門：', or('建議通知部門'), '',
      '建議初步行動：', or('建議初步行動'), '', '目前分數說明：', or('目前－分數說明'), '',
      '來源機構：' + or('來源機構'), '原始網址：' + field(e, '來源網址'), '',
      '安全說明：本程式只建立 Gmail 草稿，不會自動寄送。', '防重複鍵：' + key
    ].join('\n');
  }
  /**
   * 模擬一次 createCurrentQualifiedDrafts()。
   * b5Enabled=false → 只預覽；true → 最多 5 封「模擬草稿」。
   * 回傳結果，不修改傳入的 existingKeys。
   */
  function simulateRun(events, existingKeys, b5Enabled) {
    var keys = new Set(existingKeys);
    var qualified = [], duplicates = [], excluded = [];
    events.forEach(function (e) {
      if (!field(e, '事件ID')) return;
      var c = candidateChecks(e);
      if (!c.qualified) { excluded.push({ id: field(e, '事件ID'), reasons: c.reasons }); return; }
      var key = snapshotKey(e);
      if (keys.has(key)) { duplicates.push(field(e, '事件ID')); return; }
      qualified.push({ event: e, key: key });
    });
    var created = [], deferred = [];
    if (b5Enabled) {
      qualified.forEach(function (q) {
        if (created.length >= MAX_DRAFTS_PER_RUN) { deferred.push(q); return; }
        created.push(q); keys.add(q.key);
      });
    }
    return { b5Enabled: b5Enabled, total: events.length, qualified: qualified, duplicates: duplicates,
      excluded: excluded, created: created, deferred: b5Enabled ? deferred : qualified, keysAfter: keys };
  }

  /* ---------- 資料品質檢查 ---------- */
  function qualityChecks(events, log) {
    var R = [];
    function add(id, status, count, ids) { R.push({ id: id, status: status, count: count, ids: ids || [] }); }
    function pick(pred) { return events.filter(pred).map(function (e) { return field(e, '事件ID') || '(空白ID)'; }); }

    add('eventCount', 'info', events.length);
    var noId = events.filter(function (e) { return !field(e, '事件ID'); });
    add('missingId', noId.length ? 'fail' : 'pass', noId.length);
    var seen = {}, dup = [];
    events.forEach(function (e) { var id = field(e, '事件ID'); if (!id) return; if (seen[id]) dup.push(id); seen[id] = 1; });
    add('duplicateId', dup.length ? 'fail' : 'pass', dup.length, dup);
    var noUrl = pick(function (e) { return !field(e, '來源網址'); });
    add('missingUrl', noUrl.length ? 'fail' : 'pass', noUrl.length, noUrl);
    var unver = pick(function (e) { return normalizeValue(e['查證狀態']) !== '已查證'; });
    add('notVerified', unver.length ? 'fail' : 'pass', unver.length, unver);
    var incomplete = pick(function (e) { return !computeTrack(e, '事件當時').complete; });
    add('eventScoresIncomplete', incomplete.length ? 'fail' : 'pass', incomplete.length, incomplete);
    var flowBlank = pick(function (e) { return !field(e, '事件當時－分流結果'); });
    add('eventFlowBlank', flowBlank.length ? 'fail' : 'pass', flowBlank.length, flowBlank);
    var curVerBlank = pick(function (e) { return !field(e, '目前狀態查證'); });
    add('currentVerificationBlank', curVerBlank.length ? 'fail' : 'pass', curVerBlank.length, curVerBlank);
    var verIncomplete = pick(function (e) {
      return normalizeValue(e['目前狀態查證']) === '已查證' && !computeTrack(e, '目前').complete;
    });
    add('currentScoresIncomplete', verIncomplete.length ? 'fail' : 'pass', verIncomplete.length, verIncomplete);
    var invalidTotal = pick(function (e) {
      var t = field(e, '目前－總分');
      return t !== '' && !Number.isFinite(Number(t.replace(/,/g, '')));
    });
    add('invalidCurrentTotal', invalidTotal.length ? 'fail' : 'pass', invalidTotal.length, invalidTotal);

    // 加權分數與總分重算（兩軌）
    var scoreMismatch = pick(function (e) {
      return ['事件當時', '目前'].some(function (p) {
        var t = computeTrack(e, p);
        if (!t.complete) return false;
        var wOk = t.weighted.every(function (w, i) { return Number(t.storedWeighted[i]) === w; });
        return !wOk || Number(t.storedTotal) !== t.total;
      });
    });
    add('scoreRecompute', scoreMismatch.length ? 'fail' : 'pass', scoreMismatch.length, scoreMismatch);
    // 分流與門檻一致（兩軌；目前未查證須為待查證）
    var flowMismatch = pick(function (e) {
      var et = computeTrack(e, '事件當時');
      var bad = et.complete && et.flow !== et.storedFlow;
      return bad || expectedCurrentFlow(e) !== field(e, '目前－分流結果');
    });
    add('flowThreshold', flowMismatch.length ? 'fail' : 'pass', flowMismatch.length, flowMismatch);
    // Gmail 候選邏輯：候選必須同時為目前紅色、已查證且未結案
    var candLogic = pick(function (e) {
      var should = normalizeValue(e['目前狀態查證']) === '已查證' &&
        normalizeValue(e['目前－分流結果']) === '紅色' && normalizeValue(e['處理狀態']) !== '已結案';
      return should !== (normalizeValue(e['Gmail候選']) === '是');
    });
    add('candidateLogic', candLogic.length ? 'fail' : 'pass', candLogic.length, candLogic);
    var gradeD = pick(function (e) { return candidateChecks(e).qualified && field(e, '來源等級') === 'D'; });
    add('gradeDCandidate', gradeD.length ? 'fail' : 'pass', gradeD.length, gradeD);
    // 通知紀錄的事件ID須存在於資料庫（TEST- 開頭為早期模擬資料）
    var ids = {}; events.forEach(function (e) { ids[field(e, '事件ID')] = 1; });
    var orphan = log.filter(function (r) { var id = String(r['事件ID']); return /^EVT-/.test(id) && !ids[id]; })
      .map(function (r) { return r['事件ID']; });
    add('logIdsExist', orphan.length ? 'fail' : 'pass', orphan.length, orphan);
    var mock = log.filter(function (r) { return /^TEST-/.test(String(r['事件ID'])); }).length;
    add('logMockIds', 'info', mock);
    // 代碼表外的值（照原樣保留，只提示）
    var offCat = pick(function (e) { return CODE_TABLE.category.indexOf(field(e, '主分類')) === -1; });
    add('offCodeCategory', offCat.length ? 'warn' : 'pass', offCat.length, offCat);
    var offNature = pick(function (e) { return CODE_TABLE.nature.indexOf(field(e, '事件性質')) === -1; });
    add('offCodeNature', offNature.length ? 'warn' : 'pass', offNature.length, offNature);
    var offHandling = pick(function (e) { return CODE_TABLE.handling.indexOf(field(e, '處理狀態')) === -1; });
    add('offCodeHandling', offHandling.length ? 'warn' : 'pass', offHandling.length, offHandling);
    // 觸發器數量無法由靜態資料檢查
    add('triggerCount', 'manual', null);
    return R;
  }

  var api = {
    WEIGHTS: WEIGHTS, MAX_DRAFTS_PER_RUN: MAX_DRAFTS_PER_RUN, DIMENSIONS: DIMENSIONS, CODE_TABLE: CODE_TABLE,
    normalizeValue: normalizeValue, field: field, computeTrack: computeTrack, flowFromScore: flowFromScore,
    expectedCurrentFlow: expectedCurrentFlow, candidateChecks: candidateChecks, sha256Hex: sha256Hex,
    snapshotKey: snapshotKey, logDedupKeys: logDedupKeys, isFormalLog: isFormalLog,
    draftSubject: draftSubject, draftBody: draftBody, simulateRun: simulateRun, qualityChecks: qualityChecks
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.RiskRules = api;
})(typeof window !== 'undefined' ? window : globalThis);
