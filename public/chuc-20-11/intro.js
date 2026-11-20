/*
 * Màn chúc 20/11 — tạm thời, tự chứa, không đụng vào code React của web.
 * Gỡ: xoá thư mục public/chuc-20-11 + 1 dòng <script> trong index.html.
 *     (Xoá thiếu một trong hai cũng không làm hỏng web.)
 * Chỉ hiện đúng ngày 20/11/2026 theo giờ Việt Nam. Xem thử ngày khác: thêm ?chuc=1 vào URL.
 */
(function () {
  'use strict';

  var DAY = '2026-11-20';
  var SEEN_KEY = 'chuc2011-seen';
  var FONTS_URL =
    'https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300..500;1,6..72,300..500&display=swap';

  var current = document.currentScript;
  var base = current && current.src ? current.src.replace(/[^/]*$/, '') : '/chuc-20-11/';

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

  function forced() {
    try {
      return new URLSearchParams(window.location.search).get('chuc') === '1';
    } catch (e) {
      return false;
    }
  }

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

  if (!forced() && (todayInVietnam() !== DAY || alreadySeen())) return;
  if (document.getElementById('chuc2011')) return;

  var reduceMotion =
    !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Dựng khung ngay, phủ trang trước khi app kịp vẽ ----------
  var root = document.createElement('div');
  root.id = 'chuc2011';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'c20-title');
  root.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:#f4f7fb;';
  root.innerHTML =
    '<div class="c20-wrap" style="visibility:hidden">' +
    '<div class="c20-line" aria-hidden="true"></div>' +
    '<span class="c20-pt" aria-hidden="true"></span>' +
    '<span class="c20-pt" aria-hidden="true"></span>' +
    '<div class="c20-stage">' +
    '<figure class="c20-photo"><img src="' + base + 'co.webp" alt="Cô Hạnh" width="508" height="635" decoding="async"></figure>' +
    '<div class="c20-text">' +
    '<p class="c20-eyebrow"><span class="c20-date">20 · 11 · 2026</span><span class="c20-dash" aria-hidden="true"></span><span>Ngày Nhà giáo Việt Nam</span></p>' +
    '<h1 class="c20-title" id="c20-title"><span class="c20-mask"><span class="c20-title-in">Gửi <em>cô Hạnh</em>,</span></span></h1>' +
    '<p class="c20-body">Nếu em là một điểm thì cô là điểm còn lại — nhờ có cô, con đường của em mới thành hình.</p>' +
    '<p class="c20-body">Chúc cô 20/11 thật bình yên, luôn khoẻ, luôn vui và mãi giữ được niềm yêu với cái đẹp.</p>' +
    '</div>' +
    '<p class="c20-axiom">Qua hai điểm phân biệt,<br>có một và chỉ một đường thẳng.</p>' +
    '<div class="c20-foot">' +
    '<p class="c20-sign">Học trò của cô</p>' +
    '<button type="button" class="c20-enter">Vào HìnhHọcViệt<span class="c20-arrow" aria-hidden="true">→</span></button>' +
    '</div>' +
    '</div>' +
    '</div>';

  (document.body || document.documentElement).appendChild(root);

  var $ = function (sel) {
    return root.querySelector(sel);
  };
  var wrap = $('.c20-wrap');
  var line = $('.c20-line');
  var points = root.querySelectorAll('.c20-pt');
  var ptA = points[0];
  var ptB = points[1];
  var stage = $('.c20-stage');
  var photo = $('.c20-photo');
  var img = $('.c20-photo img');
  var text = $('.c20-text');
  var eyebrow = $('.c20-eyebrow');
  var titleIn = $('.c20-title-in');
  var bodies = root.querySelectorAll('.c20-body');
  var axiom = $('.c20-axiom');
  var sign = $('.c20-sign');
  var enter = $('.c20-enter');

  // Khoá app phía sau trong lúc màn chúc đang mở.
  var appRoot = document.getElementById('root');
  if (appRoot) appRoot.setAttribute('inert', '');

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
      document.fonts.load('400 72px Newsreader', 'Gửi'),
      document.fonts.load('italic 400 72px Newsreader', 'cô Hạnh'),
      document.fonts.load('400 20px Newsreader', 'Nếu em là một điểm'),
      document.fonts.load('italic 400 19px Newsreader', 'Học trò của cô'),
      document.fonts.load('500 12px "Be Vietnam Pro"', 'Ngày Nhà giáo Việt Nam'),
      document.fonts.load('400 12px "JetBrains Mono"', 'Qua hai điểm phân biệt'),
    ]).catch(function () {});
  }

  function imageReady() {
    if (img.complete && img.naturalWidth) return Promise.resolve();
    return new Promise(function (resolve) {
      img.onload = img.onerror = function () {
        resolve();
      };
    });
  }

  function wait(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  // ---------- Đường thẳng qua hai điểm: bám theo mép dưới ảnh ----------
  function layout() {
    var w = wrap.getBoundingClientRect();
    var p = photo.getBoundingClientRect();
    var t = text.getBoundingClientRect();
    var y = p.bottom - w.top;
    var ax = p.left - w.left;
    var bx = t.left - w.left;
    if (bx - ax < 40) bx = p.right - w.left; // một cột (điện thoại): điểm B ở mép phải ảnh
    line.style.top = y + 'px';
    ptA.style.top = y + 'px';
    ptB.style.top = y + 'px';
    ptA.style.left = ax + 'px';
    ptB.style.left = bx + 'px';
    line.style.transformOrigin = (ax + bx) / 2 + 'px 50%';
  }

  var ro = null;
  var rafId = 0;
  function scheduleLayout() {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(layout);
  }

  // ---------- Bàn phím: Enter / Esc để vào web, chặn phím tắt của app ----------
  function onKey(e) {
    if (e.key === 'Escape' || e.key === 'Enter') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      enter.focus();
    }
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
  }

  window.addEventListener('keydown', onKey, true);
  enter.addEventListener('click', close);

  // ---------- Chuyển động ----------
  var intro = null;

  function play() {
    layout();
    if (window.ResizeObserver) {
      ro = new ResizeObserver(scheduleLayout);
      ro.observe(stage);
      ro.observe(wrap);
    } else {
      window.addEventListener('resize', scheduleLayout);
    }

    var g = window.gsap;
    if (!g || reduceMotion) {
      root.classList.add('c20-static');
      wrap.style.visibility = 'visible';
      return;
    }

    g.set([ptA, ptB], { scale: 0 });
    g.set(line, { scaleX: 0 });
    g.set(photo, { clipPath: 'inset(100% 0% 0% 0%)' });
    g.set(img, { scale: 1.08, transformOrigin: '50% 100%' });
    g.set(eyebrow, { autoAlpha: 0, y: 10 });
    g.set(titleIn, { yPercent: 140 }); // đủ sâu để đầu dấu tiếng Việt không ló khỏi mặt nạ
    g.set(bodies, { autoAlpha: 0, y: 14 });
    g.set([axiom, sign, enter], { autoAlpha: 0, y: 8 });
    wrap.style.visibility = 'visible';

    intro = g
      .timeline({ defaults: { ease: 'power3.out' } })
      .addLabel('points', 0.25)
      .to(ptA, { scale: 1, duration: 0.5, ease: 'back.out(1.6)' }, 'points')
      .to(ptB, { scale: 1, duration: 0.5, ease: 'back.out(1.6)' }, 'points+=0.25')
      .addLabel('line', 'points+=0.6')
      .to(line, { scaleX: 1, duration: 1.2, ease: 'power3.inOut' }, 'line')
      .addLabel('photo', 'line+=0.6')
      .to(photo, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'expo.out' }, 'photo')
      .to(img, { scale: 1, duration: 1.8, ease: 'expo.out' }, 'photo')
      .addLabel('words', 'photo+=0.45')
      .to(eyebrow, { autoAlpha: 1, y: 0, duration: 0.7 }, 'words')
      .to(titleIn, { yPercent: 0, duration: 1.1, ease: 'expo.out' }, 'words+=0.1')
      .to(bodies, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.14 }, 'words+=0.45')
      .to([axiom, sign, enter], { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.08 }, 'words+=1.05');
  }

  // ---------- Đóng: mờ dần rồi gỡ sạch khỏi trang ----------
  var closing = false;

  function destroy() {
    if (ro) ro.disconnect();
    window.removeEventListener('resize', scheduleLayout);
    cancelAnimationFrame(rafId);
    if (root.parentNode) root.parentNode.removeChild(root);
    for (var i = 0; i < added.length; i++) {
      if (added[i].parentNode) added[i].parentNode.removeChild(added[i]);
    }
    added = [];
  }

  function close() {
    if (closing) return;
    closing = true;
    markSeen();
    window.removeEventListener('keydown', onKey, true);
    if (appRoot) appRoot.removeAttribute('inert');

    var g = window.gsap;
    if (g && !reduceMotion) {
      if (intro) intro.kill();
      g.timeline({ onComplete: destroy })
        .to(stage, { autoAlpha: 0, y: -10, duration: 0.45, ease: 'power2.in' }, 0)
        .to([line, ptA, ptB], { autoAlpha: 0, duration: 0.35, ease: 'power1.out' }, 0.1)
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
      closing = true;
      window.removeEventListener('keydown', onKey, true);
      if (appRoot) appRoot.removeAttribute('inert');
      destroy();
      return;
    }
    var assets = Promise.all([
      reduceMotion ? Promise.resolve() : loadScript(base + 'gsap.min.js'),
      loadCss(FONTS_URL).then(loadFonts),
      imageReady(),
    ]);
    Promise.race([assets, wait(2500)]).then(function () {
      if (!closing) play();
    });
  });
})();
