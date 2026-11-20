/*
 * Màn chúc 20/11 — tạm thời, tự chứa, không đụng vào code React của web.
 * Gỡ: xoá thư mục public/chuc-20-11 + 1 dòng <script> trong index.html.
 *     (Xoá thiếu một trong hai cũng không làm hỏng web.)
 * Chỉ hiện đúng ngày 20/11/2026 theo giờ Việt Nam. Xem thử ngày khác: thêm ?chuc=1 vào URL.
 * Kiểm tra từng khung hình (không nhạc): ?chuc=1&chuc_t=7.9
 *
 * Nhạc: "Gentle" — Solo Piano (Pixabay, Pixabay Content License), đã cắt và hạ âm lượng.
 */
(function () {
  'use strict';

  var DAY = '2026-11-20';
  var SEEN_KEY = 'chuc2011-seen';
  var FONTS_URL =
    'https://fonts.googleapis.com/css2?family=Phudu:wght@900&family=Be+Vietnam+Pro:wght@400;600;700&family=JetBrains+Mono:wght@500&display=swap';

  // Mốc thời gian (giây, tính từ lúc bấm mở), đặt theo phách nhạc (~103 BPM, phách 0.58 s).
  var PH = {
    explode: [0.09, 1.05], // số 20.11 bung thành đám hạt
    form1: [1.0, 2.43], // hạt hội tụ thành CHÚC MỪNG
    form2: [3.62, 4.85], // chuyển thành NGÀY NHÀ GIÁO / VIỆT NAM
    dust: [6.54, 8.1], // tan thành bụi sáng lơ lửng
    wire: 8.6, // khối đa diện nét mảnh quanh ảnh
  };
  var END = 14.6;

  var current = document.currentScript;
  var base = current && current.src ? current.src.replace(/[^/]*$/, '') : '/chuc-20-11/';

  // ---------- Cổng ngày ----------
  function todayInVietnam() {
    try {
      var parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(new Date());
      var v = {};
      for (var i = 0; i < parts.length; i++) v[parts[i].type] = parts[i].value;
      return v.year + '-' + v.month + '-' + v.day;
    } catch (e) {
      return '';
    }
  }

  var params;
  try {
    params = new URLSearchParams(window.location.search);
  } catch (e) {
    params = { get: function () { return null; } };
  }
  var forced = params.get('chuc') === '1';
  var debugT = forced && params.get('chuc_t') !== null ? parseFloat(params.get('chuc_t')) || 0 : null;

  function alreadySeen() {
    try {
      return window.sessionStorage.getItem(SEEN_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function markSeen() {
    try {
      window.sessionStorage.setItem(SEEN_KEY, '1');
    } catch (e) {
      /* trình duyệt chặn storage: bỏ qua */
    }
  }

  if (!forced && (todayInVietnam() !== DAY || alreadySeen())) return;
  if (document.getElementById('chuc2011')) return;

  var reduceMotion =
    !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Dựng DOM ----------
  function chars(text) {
    return Array.from(text)
      .map(function (c) {
        return '<span class="k-ch">' + c + '</span>';
      })
      .join('');
  }

  function words(text) {
    return text
      .split(' ')
      .map(function (w) {
        return '<span class="k-word">' + chars(w) + '</span>';
      })
      .join(' ');
  }

  var slices = '';
  for (var si = 0; si < 6; si++) {
    slices +=
      '<span class="k-slice" style="top:' + ((si * 100) / 6).toFixed(4) + '%;' +
      "background-image:url('" + base + "co.webp');background-position:0 " + si * 20 + '%"></span>';
  }

  var ICON_PLAY = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 1v10l9-5z" fill="currentColor"/></svg>';
  var ICON_SOUND =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<g class="k-on"><path d="M4 9.5v5h3.5L12 18V6L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18 6.5a7.5 7.5 0 0 1 0 11"/></g>' +
    '<g class="k-off"><path d="M4 9.5v5h3.5L12 18V6L7.5 9.5z"/><path d="M16 10l4 4M20 10l-4 4"/></g></svg>';

  var root = document.createElement('div');
  root.id = 'chuc2011';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'k-title');
  root.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:#0b1326;';
  root.innerHTML =
    '<div class="k-all" style="visibility:hidden">' +
    '<canvas class="k-fx" aria-hidden="true"></canvas>' +
    // Poster cuối
    '<section class="k-final">' +
    '<div class="k-final-in">' +
    '<figure class="k-photo" role="img" aria-label="Ảnh cô Hạnh">' + slices + '</figure>' +
    '<div class="k-copy">' +
    '<p class="k-eyebrow">20.11.2026 — Ngày Nhà giáo Việt Nam</p>' +
    '<h1 class="k-title" id="k-title"><span class="k-line">' + words('Chúc cô') + '</span><span class="k-line k-name">' + words('Hẹnh') + ' <span class="k-date">' + words('20/11') + '</span></span></h1>' +
    '<ul class="k-wishes">' +
    '<li>thật <b>vui vẻ</b>,</li>' +
    '<li>thật nhiều <b>sức khỏe</b>,</li>' +
    '<li>thật nhiều <b>cảm hứng</b>.</li>' +
    '</ul>' +
    '<p class="k-thanks">Thén kìu tích chờ for everything</p>' +
    '<div class="k-actions">' +
    '<button type="button" class="k-enter">Vào HìnhHọcViệt <span aria-hidden="true">→</span></button>' +
    '<button type="button" class="k-replay">Xem lại</button>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '</section>' +
    // Màn mở
    '<section class="k-gate">' +
    '<p class="k-gate-label">Ngày Nhà giáo Việt Nam</p>' +
    '<p class="k-gate-num" aria-label="20.11">20.11</p>' +
    '<button type="button" class="k-open">' + ICON_PLAY + '<span>Mở lời chúc</span></button>' +
    '<p class="k-gate-hint">Có nhạc nền nhẹ — nhớ bật loa nhé</p>' +
    '<button type="button" class="k-skip">Vào thẳng web</button>' +
    '</section>' +
    '<button type="button" class="k-sound" aria-label="Tắt nhạc" aria-pressed="false">' + ICON_SOUND + '</button>' +
    '</div>';

  (document.body || document.documentElement).appendChild(root);

  var $ = function (sel) {
    return root.querySelector(sel);
  };
  var $$ = function (sel) {
    return Array.prototype.slice.call(root.querySelectorAll(sel));
  };

  var all = $('.k-all');
  var canvas = $('.k-fx');
  var ctx = canvas.getContext ? canvas.getContext('2d') : null;
  var gate = $('.k-gate');
  var gateLabel = $('.k-gate-label');
  var gateNum = $('.k-gate-num');
  var openBtn = $('.k-open');
  var gateHint = $('.k-gate-hint');
  var skipBtn = $('.k-skip');
  var photo = $('.k-photo');
  var sliceEls = $$('.k-slice');
  var eyebrow = $('.k-eyebrow');
  var titleChars = $$('.k-title .k-ch');
  var wishLis = $$('.k-wishes li');
  var thanks = $('.k-thanks');
  var actions = $$('.k-actions button');
  var enterBtn = $('.k-enter');
  var replayBtn = $('.k-replay');
  var soundBtn = $('.k-sound');

  // Khoá app phía sau trong lúc màn chúc đang mở.
  var appRoot = document.getElementById('root');
  if (appRoot) appRoot.setAttribute('inert', '');

  // ---------- Nhạc ----------
  var audio = null;
  var audioOk = debugT === null && typeof Audio !== 'undefined';
  if (audioOk) {
    audio = new Audio();
    audio.preload = 'auto';
    audio.src = base + 'nhac.mp3';
    audio.addEventListener('error', function () {
      audioOk = false;
      soundBtn.hidden = true;
    });
  } else {
    soundBtn.hidden = true;
  }

  function playAudio(from) {
    if (!audioOk || !audio) return;
    try {
      audio.currentTime = from || 0;
    } catch (e) {
      /* chưa tải đủ để tua */
    }
    audio.volume = 1;
    var p = audio.play();
    if (p && p.catch) p.catch(function () {});
  }

  // ---------- Tải tài nguyên (mọi thứ thêm vào <head> đều được gỡ khi đóng) ----------
  var added = [];

  function addToHead(el) {
    document.head.appendChild(el);
    added.push(el);
    return el;
  }

  function loadCss(href) {
    return new Promise(function (resolve) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.onload = function () {
        resolve(true);
      };
      link.onerror = function () {
        resolve(false);
      };
      addToHead(link);
    });
  }

  function loadScript(src) {
    return new Promise(function (resolve) {
      if (window.gsap) return resolve();
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = s.onerror = function () {
        resolve();
      };
      addToHead(s);
    });
  }

  function loadFonts() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all([
      document.fonts.load('900 120px Phudu', 'CHÚC MỪNG NGÀY NHÀ GIÁO VIỆT NAM CHÚC CÔ HẸNH 20/11 20.11'),
      document.fonts.load('400 24px "Be Vietnam Pro"', '20/11 thật nhiều vui vẻ sức khỏe cảm hứng Thén kìu tích chờ for everything'),
      document.fonts.load('600 15px "Be Vietnam Pro"', 'Vào HìnhHọcViệt Xem lại'),
      document.fonts.load('700 24px "Be Vietnam Pro"', 'vui vẻ sức khỏe cảm hứng Mở lời chúc'),
      document.fonts.load('500 12px "JetBrains Mono"', 'NGÀY NHÀ GIÁO VIỆT NAM 20.11.2026'),
    ]).catch(function () {});
  }

  function imageReady() {
    return new Promise(function (resolve) {
      var im = new Image();
      im.onload = im.onerror = function () {
        resolve();
      };
      im.src = base + 'co.webp';
    });
  }

  function wait(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  // ---------- Hạt: vị trí là hàm của thời gian timeline (tua được, luôn khớp nhạc) ----------
  function rng(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  function easeOut(t) {
    return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }

  function easeIO(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  // Tiến độ riêng của từng hạt trong một pha [a, b] (d: độ trễ 0..1, frac: phần thời gian dành cho trễ).
  function prog(T, a, b, d, frac) {
    var span = b - a;
    return clamp01((T - (a + d * span * frac)) / (span * (1 - frac)));
  }

  function mod(a, n) {
    return ((a % n) + n) % n;
  }

  var cw = 0;
  var ch = 0;
  var dpr = 1;
  var N = 0;
  var P = [];
  var shapes = { gate: null, w1: null, w2: null };
  var bx;
  var by;
  var ba;
  var bs;

  function sizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cw = window.innerWidth;
    ch = window.innerHeight;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
  }

  function initParticles() {
    N = Math.round(Math.max(2000, Math.min(4200, (cw * ch) / 300)));
    var r = rng(7);
    P = [];
    for (var i = 0; i < N; i++) {
      P.push({
        z: r(),
        gold: r() < 0.14,
        keep: r() < 0.3,
        d0: r(),
        d1: r(),
        d2: r(),
        d3: r(),
        arc: (r() - 0.5) * 2,
        ph: r() * 6.2832,
        sp: 0.5 + r() * 0.9,
        bx: r(),
        by: r(),
        ang: r() * 6.2832,
        rad: r(),
      });
    }
    bx = new Float32Array(N);
    by = new Float32Array(N);
    ba = new Float32Array(N);
    bs = new Float32Array(N);
  }

  var off = document.createElement('canvas');
  var octx = off.getContext ? off.getContext('2d', { willReadFrequently: true }) : null;
  var FONT = '"Phudu", "Be Vietnam Pro", sans-serif';

  function fitSize(lines, maxW, maxH, lh) {
    octx.font = '900 100px ' + FONT;
    var w = 1;
    for (var k = 0; k < lines.length; k++) w = Math.max(w, octx.measureText(lines[k]).width);
    return Math.min((maxW / w) * 100, maxH / (lines.length * lh));
  }

  // Vẽ chữ lên canvas ẩn, lấy mẫu điểm trong nét chữ → toạ độ đích cho N hạt.
  function textShape(lines, cx, cy, fs, lh, seed) {
    var W = Math.max(1, Math.ceil(cw));
    var H = Math.max(1, Math.ceil(ch));
    off.width = W;
    off.height = H;
    octx.clearRect(0, 0, W, H);
    octx.fillStyle = '#fff';
    octx.font = '900 ' + fs + 'px ' + FONT;
    octx.textAlign = 'center';
    octx.textBaseline = 'alphabetic';
    for (var k = 0; k < lines.length; k++) {
      var m = octx.measureText(lines[k]);
      var lineCy = cy + (k - (lines.length - 1) / 2) * fs * lh;
      octx.fillText(lines[k], cx, lineCy + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
    }
    var data = octx.getImageData(0, 0, W, H).data;
    var filled = 0;
    for (var y = 0; y < H; y += 2) {
      for (var x = 0; x < W; x += 2) if (data[(y * W + x) * 4 + 3] > 128) filled++;
    }
    var step = Math.max(2, Math.sqrt((filled * 4) / N) * 0.9);
    var r = rng(seed);
    var pts = [];
    for (var y2 = step / 2; y2 < H; y2 += step) {
      for (var x2 = step / 2; x2 < W; x2 += step) {
        if (data[((y2 | 0) * W + (x2 | 0)) * 4 + 3] > 128) {
          pts.push(x2 + (r() - 0.5) * step * 0.6, y2 + (r() - 0.5) * step * 0.6);
        }
      }
    }
    var M = pts.length / 2;
    var out = new Float32Array(N * 2);
    if (!M) {
      for (var q = 0; q < N; q++) {
        out[2 * q] = cx;
        out[2 * q + 1] = cy;
      }
      return out;
    }
    var idx = [];
    for (var a = 0; a < M; a++) idx.push(a);
    for (var b = M - 1; b > 0; b--) {
      var j = Math.floor(r() * (b + 1));
      var tmp = idx[b];
      idx[b] = idx[j];
      idx[j] = tmp;
    }
    for (var i = 0; i < N; i++) {
      var pi = idx[i % M];
      var jit = i >= M ? step * 0.7 : 0;
      out[2 * i] = pts[2 * pi] + (r() - 0.5) * jit;
      out[2 * i + 1] = pts[2 * pi + 1] + (r() - 0.5) * jit;
    }
    return out;
  }

  function computeShapes() {
    if (!octx || !N) return;
    var gr = gateNum.getBoundingClientRect();
    var gfs = parseFloat(getComputedStyle(gateNum).fontSize) || 200;
    shapes.gate = textShape(['20.11'], gr.left + gr.width / 2, gr.top + gr.height / 2, gfs, 1, 3);
    var portrait = cw / ch < 0.8; // màn dọc: tách dòng cho chữ hạt to hơn
    var l1 = portrait ? ['CHÚC', 'MỪNG'] : ['CHÚC MỪNG'];
    shapes.w1 = textShape(l1, cw / 2, ch / 2, fitSize(l1, cw * 0.84, ch * (portrait ? 0.42 : 0.34), 1.04), 1.04, 5);
    var l2 = portrait ? ['NGÀY', 'NHÀ GIÁO', 'VIỆT NAM'] : ['NGÀY NHÀ GIÁO', 'VIỆT NAM'];
    var fs2 = fitSize(l2, cw * 0.86, ch * (portrait ? 0.56 : 0.5), 1.06);
    shapes.w2 = textShape(l2, cw / 2, ch / 2, fs2, 1.06, 9);
  }

  // ---------- Khối hai mươi mặt nét mảnh (gợi chất "Hình học 3D") ----------
  var PHI = (1 + Math.sqrt(5)) / 2;
  var IV = [
    [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
    [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
    [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
  ];
  var IE = [];
  for (var ia = 0; ia < 12; ia++) {
    for (var ib = ia + 1; ib < 12; ib++) {
      var dx0 = IV[ia][0] - IV[ib][0];
      var dy0 = IV[ia][1] - IV[ib][1];
      var dz0 = IV[ia][2] - IV[ib][2];
      if (Math.abs(Math.sqrt(dx0 * dx0 + dy0 * dy0 + dz0 * dz0) - 2) < 0.01) IE.push([ia, ib]);
    }
  }
  var IR = Math.sqrt(1 + PHI * PHI);
  var wx = new Float32Array(12);
  var wy = new Float32Array(12);

  function drawWire(T) {
    var k = (T - PH.wire) / 1.8;
    if (k <= 0) return;
    if (k > 1) k = 1;
    var r = photo.getBoundingClientRect();
    if (!r.width) return;
    var cx = r.left + r.width / 2;
    var cy = r.top + r.height / 2;
    var R = r.height * (cw < 761 || ch < 560 ? 0.6 : 0.74); // màn hẹp/thấp: thu nhỏ để nét không cắt qua chữ
    var ay = T * 0.18;
    var ax = 0.42 + T * 0.07;
    var cyA = Math.cos(ay), syA = Math.sin(ay), cxA = Math.cos(ax), sxA = Math.sin(ax);
    for (var v = 0; v < 12; v++) {
      var x = IV[v][0] / IR, y = IV[v][1] / IR, z = IV[v][2] / IR;
      var x1 = x * cyA + z * syA;
      var z1 = -x * syA + z * cyA;
      var y1 = y * cxA - z1 * sxA;
      var z2 = y * sxA + z1 * cxA;
      var f = 3.4 / (3.4 - z2);
      wx[v] = cx + x1 * R * f;
      wy[v] = cy + y1 * R * f;
    }
    ctx.globalAlpha = 0.2 * easeOut(k);
    ctx.strokeStyle = '#f4f2ec';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var e = 0; e < IE.length; e++) {
      var t = clamp01(k * 1.6 - (e / IE.length) * 0.6);
      if (t <= 0) continue;
      var a = IE[e][0], b = IE[e][1];
      ctx.moveTo(wx[a], wy[a]);
      ctx.lineTo(wx[a] + (wx[b] - wx[a]) * t, wy[a] + (wy[b] - wy[a]) * t);
    }
    ctx.stroke();
    ctx.globalAlpha = 0.6 * easeOut(k);
    ctx.fillStyle = '#e8c47a';
    for (var w = 0; w < 12; w++) ctx.fillRect(wx[w] - 1.5, wy[w] - 1.5, 3, 3);
  }

  function computeParticles(T, gw, playing) {
    var gate = shapes.gate, w1 = shapes.w1, w2 = shapes.w2;
    if (!gate) return;
    var cx = cw / 2, cy = ch / 2;
    var R = Math.sqrt(cw * cw + ch * ch) * 0.5;
    var DW = cw + 60, DH = ch + 60;
    for (var i = 0; i < N; i++) {
      var p = P[i];
      var gx = gate[2 * i], gy = gate[2 * i + 1];
      // Mở đầu: hạt từ xa tụ về thành 20.11 (theo đồng hồ thật, trước khi bấm)
      var eI = playing ? 1 : easeOut(prog(gw, 0.15, 2.4, p.d0, 0.6));
      var rr = 0.55 + p.rad * 0.85;
      var x = cx + Math.cos(p.ang) * rr * R * 1.15;
      var y = cy + Math.sin(p.ang) * rr * R * 0.9;
      x += (gx - x) * eI;
      y += (gy - y) * eI;
      var size = 1.7 + 1.1 * p.z;
      var alpha = (0.66 + 0.34 * p.z) * (0.15 + 0.85 * eI);
      var e4 = 0;
      if (playing) {
        // 1. Bung ra
        var sr = 0.16 + p.rad * 0.92;
        var sx = cx + Math.cos(p.ang) * sr * R;
        var sy = cy + Math.sin(p.ang) * sr * R * 0.78;
        var e1 = easeOut(prog(T, PH.explode[0], PH.explode[1], p.d0, 0.25));
        x += (sx - x) * e1;
        y += (sy - y) * e1;
        // 2. Hội tụ thành CHÚC MỪNG (đường cong)
        var e2 = easeIO(prog(T, PH.form1[0], PH.form1[1], p.d1, 0.42));
        if (e2 > 0) {
          var tx = w1[2 * i], ty = w1[2 * i + 1];
          var dx = tx - x, dy = ty - y;
          var len = Math.sqrt(dx * dx + dy * dy) || 1;
          var o = Math.sin(Math.PI * e2) * p.arc * 110;
          x += dx * e2 - (dy / len) * o;
          y += dy * e2 + (dx / len) * o;
        }
        // 3. Chuyển sang NGÀY NHÀ GIÁO / VIỆT NAM
        var e3 = easeIO(prog(T, PH.form2[0], PH.form2[1], p.d2, 0.36));
        if (e3 > 0) {
          var tx2 = w2[2 * i], ty2 = w2[2 * i + 1];
          var dx2 = tx2 - x, dy2 = ty2 - y;
          var len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2) || 1;
          var o2 = Math.sin(Math.PI * e3) * p.arc * 80;
          x += dx2 * e3 - (dy2 / len2) * o2;
          y += dy2 * e3 + (dx2 / len2) * o2;
        }
        // 4. Tan thành bụi sáng trôi chậm
        e4 = easeIO(prog(T, PH.dust[0], PH.dust[1], p.d3, 0.42));
        if (e4 > 0) {
          var ux = mod(p.bx * DW + Math.sin(T * 0.23 * p.sp + p.ph) * 24 * (0.5 + p.z) + T * 4 * (p.sp - 0.95), DW) - 30;
          var uy = mod(p.by * DH - T * (5 + 9 * p.z) * p.sp, DH) - 30;
          x += (ux - x) * e4;
          y += (uy - y) * e4;
          alpha += ((p.keep ? 0.22 + 0.4 * p.z : 0) - alpha) * e4;
          size += (0.9 + 1.5 * p.z - size) * e4;
        }
        // Hạt đang bay lớn hơn một chút (cảm giác chiều sâu)
        var flying = Math.max(e1 - e2, 0) * (1 - e4);
        size *= 1 + flying * 0.9 * p.z;
      }
      var tt = playing ? T : gw;
      x += Math.sin(tt * 1.9 + p.ph) * 0.6;
      y += Math.cos(tt * 1.6 + p.ph) * 0.6;
      // Cả khối chữ hạt nghiêng nhẹ quanh trục đứng (phối cảnh thật), tắt dần khi tan thành bụi.
      var th = 0.2 * Math.sin(tt * 0.55) * (1 - e4);
      if (th) {
        var dxp = x - cx;
        var f = 1100 / (1100 - dxp * Math.sin(th));
        x = cx + dxp * Math.cos(th) * f;
        y = cy + (y - cy) * f;
        size *= f;
      }
      bx[i] = x;
      by[i] = y;
      ba[i] = alpha;
      bs[i] = size;
    }
  }

  function drawParticles() {
    for (var pass = 0; pass < 2; pass++) {
      ctx.fillStyle = pass ? '#e8c47a' : '#f4f2ec';
      for (var i = 0; i < N; i++) {
        if (P[i].gold !== !!pass) continue;
        var a = ba[i];
        if (a <= 0.01) continue;
        var s = bs[i];
        ctx.globalAlpha = a;
        ctx.fillRect(bx[i] - s / 2, by[i] - s / 2, s, s);
      }
    }
  }

  // ---------- Đồng hồ & vòng vẽ ----------
  var g = null;
  var tl = null;
  var state = 'loading'; // loading | gate | play | final | closing
  var gateStart = 0;
  var endWall = 0;

  function nowS() {
    return (window.performance && performance.now ? performance.now() : Date.now()) / 1000;
  }

  function clockT() {
    if (!tl) return 0;
    var t = tl.time();
    if (endWall && debugT === null && t >= END - 0.001) return END + (nowS() - endWall);
    return t;
  }

  function render() {
    if (!ctx || state === 'loading') return;
    var playing = state !== 'gate';
    var T = playing ? clockT() : 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    if (playing) drawWire(T);
    computeParticles(T, nowS() - gateStart, playing);
    drawParticles();
    ctx.globalAlpha = 1;
  }

  // ---------- Timeline chữ & ảnh (hạt chạy theo cùng đồng hồ này) ----------
  function buildTimeline() {
    g.set(titleChars, { autoAlpha: 0, yPercent: 30, filter: 'blur(16px)' });
    g.set(eyebrow, { autoAlpha: 0, y: 10 });
    sliceEls.forEach(function (el, i) {
      g.set(el, { autoAlpha: 0, xPercent: i % 2 ? 34 : -34 });
    });
    g.set(wishLis, { autoAlpha: 0, y: 16, filter: 'blur(8px)' });
    g.set([thanks].concat(actions), { autoAlpha: 0, y: 14 });
    g.set(soundBtn, { autoAlpha: 0 });

    tl = g
      .timeline({
        paused: true,
        defaults: { ease: 'expo.out' },
        onComplete: function () {
          endWall = nowS();
        },
      })
      .to(openBtn, { autoAlpha: 0, y: 10, duration: 0.4, ease: 'power2.out' }, 0)
      .to([gateLabel, gateHint, skipBtn], { autoAlpha: 0, duration: 0.4, ease: 'power1.out' }, 0)
      .set(gate, { autoAlpha: 0 }, 0.45)
      .to(soundBtn, { autoAlpha: 1, duration: 0.6, ease: 'power1.out' }, 0.5)
      .to(titleChars, { autoAlpha: 1, yPercent: 0, filter: 'blur(0px)', duration: 1.3, stagger: 0.06 }, 7.12)
      .to(eyebrow, { autoAlpha: 1, y: 0, duration: 0.9 }, 7.7)
      .to(sliceEls, { autoAlpha: 1, xPercent: 0, duration: 1.4, stagger: 0.07 }, 8.31)
      .to(wishLis[0], { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 1.1 }, 9.49)
      .to(wishLis[1], { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 1.1 }, 10.68)
      .to(wishLis[2], { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 1.1 }, 11.84)
      .to(thanks, { autoAlpha: 1, y: 0, duration: 1.0 }, 13.02)
      .to(actions, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.08 }, 13.6)
      .call(reachFinal, null, 14.0)
      .to({}, { duration: 0.01 }, END);
  }

  function gateIntro() {
    gateStart = nowS();
    if (!g || reduceMotion) return;
    g.from([gateLabel, openBtn, gateHint, skipBtn], {
      autoAlpha: 0,
      y: 12,
      duration: 0.9,
      stagger: 0.08,
      delay: 1.2,
      ease: 'power3.out',
    });
  }

  // ---------- Điều khiển ----------
  function reachFinal() {
    if (state === 'closing') return;
    state = 'final';
    try {
      enterBtn.focus({ preventScroll: true });
    } catch (e) {
      enterBtn.focus();
    }
  }

  function showFinalStatic() {
    gate.style.display = 'none';
    soundBtn.style.visibility = 'visible';
    reachFinal();
  }

  function open() {
    if (state !== 'gate') return;
    state = 'play';
    markSeen();
    playAudio(0);
    if (tl) {
      endWall = 0;
      tl.play(0);
    } else {
      showFinalStatic();
    }
  }

  function replay() {
    if (state === 'closing') return;
    playAudio(0);
    if (!tl) return;
    state = 'play';
    endWall = 0;
    tl.play(0);
  }

  function skipToEnd() {
    if (tl && state === 'play') tl.progress(1);
  }

  // Giữ nhạc khớp hình nếu nhạc bắt đầu trễ (tải chậm).
  if (audio) {
    audio.addEventListener('playing', function () {
      if (!tl || state !== 'play') return;
      var t = tl.time();
      if (Math.abs(audio.currentTime - t) > 0.15 && t < (audio.duration || 60) - 1) {
        try {
          audio.currentTime = t;
        } catch (e) {
          /* bỏ qua */
        }
      }
    });
  }

  // Ẩn tab thì tạm dừng nhạc, quay lại thì phát tiếp.
  var resumeAudio = false;
  function onVisibility() {
    if (!audio) return;
    if (document.hidden) {
      resumeAudio = !audio.paused;
      audio.pause();
    } else if (resumeAudio && state !== 'closing') {
      resumeAudio = false;
      var p = audio.play();
      if (p && p.catch) p.catch(function () {});
    }
  }
  document.addEventListener('visibilitychange', onVisibility);

  function toggleSound() {
    if (!audio) return;
    audio.muted = !audio.muted;
    soundBtn.setAttribute('aria-pressed', audio.muted ? 'true' : 'false');
    soundBtn.setAttribute('aria-label', audio.muted ? 'Bật nhạc' : 'Tắt nhạc');
    if (!audio.muted && audio.paused && state !== 'closing') {
      var p = audio.play();
      if (p && p.catch) p.catch(function () {});
    }
  }

  function visibleButtons() {
    return $$('button').filter(function (b) {
      return !b.hidden && b.offsetParent !== null && getComputedStyle(b).visibility !== 'hidden';
    });
  }

  function onKey(e) {
    var k = e.key;
    var onButton =
      document.activeElement && document.activeElement.tagName === 'BUTTON' && root.contains(document.activeElement);
    if (k === 'Escape') {
      e.preventDefault();
      if (state === 'gate' || state === 'final') close();
      else if (state === 'play') skipToEnd();
    } else if (k === 'Enter' && !onButton) {
      e.preventDefault();
      if (state === 'gate') open();
      else if (state === 'final') close();
    } else if (k === 'Tab') {
      e.preventDefault();
      var list = visibleButtons();
      if (list.length) {
        var i = list.indexOf(document.activeElement);
        var next = e.shiftKey ? (i <= 0 ? list.length - 1 : i - 1) : i + 1 >= list.length ? 0 : i + 1;
        list[next].focus();
      }
    }
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
  }

  window.addEventListener('keydown', onKey, true);
  openBtn.addEventListener('click', open);
  skipBtn.addEventListener('click', function () {
    markSeen();
    close();
  });
  enterBtn.addEventListener('click', close);
  replayBtn.addEventListener('click', replay);
  soundBtn.addEventListener('click', toggleSound);
  window.addEventListener('resize', onResize);

  var resizeRaf = 0;
  function onResize() {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(function () {
      if (!ctx || !N) return;
      sizeCanvas();
      computeShapes();
    });
  }

  // ---------- Đóng: mờ dần rồi gỡ sạch khỏi trang ----------
  function destroy() {
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVisibility);
    if (g) g.ticker.remove(render);
    if (tl) tl.kill();
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      try {
        audio.load();
      } catch (e) {
        /* bỏ qua */
      }
    }
    if (root.parentNode) root.parentNode.removeChild(root);
    for (var i = 0; i < added.length; i++) {
      if (added[i].parentNode) added[i].parentNode.removeChild(added[i]);
    }
    added = [];
    if (window.__chuc2011) {
      try {
        delete window.__chuc2011;
      } catch (e) {
        window.__chuc2011 = undefined;
      }
    }
  }

  function close() {
    if (state === 'closing') return;
    state = 'closing';
    window.removeEventListener('keydown', onKey, true);
    if (appRoot) appRoot.removeAttribute('inert');
    if (tl) tl.pause();
    if (g && !reduceMotion) {
      if (audio && !audio.paused) g.to(audio, { volume: 0, duration: 0.8, ease: 'power1.in' });
      g.timeline({ onComplete: destroy })
        .to(all, { autoAlpha: 0, scale: 1.03, duration: 0.7, ease: 'power2.in' }, 0)
        .to(root, { autoAlpha: 0, duration: 0.55, ease: 'power2.inOut' }, 0.3);
    } else {
      root.style.transition = 'opacity 0.4s ease';
      root.style.opacity = '0';
      setTimeout(destroy, 420);
    }
  }

  // ---------- Bắt đầu ----------
  loadCss(base + 'intro.css').then(function (ok) {
    if (!ok) {
      // Thiếu CSS (vd. thư mục bị xoá dở): bỏ màn chúc, trả web lại nguyên vẹn.
      state = 'closing';
      window.removeEventListener('keydown', onKey, true);
      if (appRoot) appRoot.removeAttribute('inert');
      destroy();
      return;
    }
    var fontsReady = loadCss(FONTS_URL).then(loadFonts);
    var assets = Promise.all([loadScript(base + 'gsap.min.js'), fontsReady, imageReady()]);
    Promise.race([assets, wait(3000)]).then(function () {
      if (state === 'closing') return;
      g = window.gsap || null;
      var anim = !!(g && ctx && octx && !reduceMotion);
      if (anim) {
        root.classList.add('k-anim');
        sizeCanvas();
        initParticles();
        buildTimeline();
      }
      all.style.visibility = 'visible';
      if (anim) {
        computeShapes();
        // Font về muộn (mạng chậm): lấy mẫu chữ lại cho đúng nét.
        fontsReady.then(function () {
          if (state !== 'closing') computeShapes();
        });
        g.ticker.add(render);
      }
      state = 'gate';
      if (forced) {
        // Chỉ khi xem thử bằng ?chuc=1: để kiểm tra nhạc & timeline từ console.
        window.__chuc2011 = {
          audio: audio,
          tl: tl,
          state: function () {
            return state;
          },
        };
      }
      if (debugT !== null && tl) {
        // Chế độ kiểm tra: bỏ màn mở, tua tới giây t, không nhạc.
        state = 'play';
        tl.pause(debugT);
        render();
        return;
      }
      gateIntro();
    });
  });
})();
