(function () {
  'use strict';
  var root = document.documentElement;
  function mq(q) { return window.matchMedia ? window.matchMedia(q) : { matches: false }; }
  var reduce = mq('(prefers-reduced-motion: reduce)').matches;

  /* Text types out like an RPG text box. Returns a function that finishes it at once. */
  function typeOut(p, done) {
    var full = p.textContent.replace(/\s+/g, ' ').trim();
    var finished = false, timer = null, wait = null, i = 0;
    function finish() {
      if (finished) return;
      finished = true;
      clearTimeout(wait);
      clearInterval(timer);
      p.textContent = full;
      if (done) done();
    }
    finish.active = function () { return !finished; };
    if (reduce) { finish(); return finish; }
    var shown = document.createElement('span');
    var rest = document.createElement('span');
    rest.className = 'rest';
    p.textContent = '';
    p.appendChild(shown);
    p.appendChild(rest);
    rest.textContent = full;
    wait = setTimeout(function () {
      timer = setInterval(function () {
        i += 1;
        shown.textContent = full.slice(0, i);
        rest.textContent = full.slice(i);
        if (i >= full.length) finish();
      }, 34);
    }, 300);
    return finish;
  }

  /* =====================================================================
     Game: a side-on walk through a small world drawn in perspective.
     The ground is a top-down texture drawn one screen row at a time
     (far rows squeezed, near rows stretched). Everything standing on it
     is a flat sprite in a depth lane, so nearer lanes scroll faster.
     ===================================================================== */
  var Game = (function () {
    var el = document.getElementById('game');
    var cv = document.getElementById('scene');
    var ctx = cv && cv.getContext ? cv.getContext('2d') : null;
    if (!el || !ctx) return null;

    /* K: rows between horizon and road. D0: road's distance from the camera. */
    var K = 56, D0 = 160, DNEAR = 24, DFAR = 420, PAD = 1100, SPAD = 320, MPAD = 320;
    var WORLD = 2860, SPAWN = 120, SEA0 = 730, SEA1 = 1170, FLY0 = 650, FLY1 = 1250;
    var LANES = { mid: .5, build: .8, curb: .9, fore: 1.6, near: 2.4 };
    var LIT = '#FCFCFC', HOT = '#F83800';
    var STOPS = [
      { id: 'about',   x: 230,  label: 'Faroz',      name: 'About' },
      { id: 'edu1',    x: 480,  label: 'Education',  name: 'Stage 1, Universitas Esa Unggul' },
      { id: 'edu2',    x: 1420, label: 'Education',  name: 'Stage 2, Nanjing Xiaozhuang University' },
      { id: 'p1',      x: 1660, label: 'Main quest', name: 'FitnessCoach' },
      { id: 'p2',      x: 1880, label: 'Quest 2',    name: 'Property marketplace' },
      { id: 'p3',      x: 2100, label: 'Quest 3',    name: 'Secure admin dashboard' },
      { id: 'p4',      x: 2320, label: 'Quest 4',    name: 'Hidayah' },
      { id: 'skills',  x: 2540, label: 'Inventory',  name: 'Skills' },
      { id: 'contact', x: 2740, label: 'Faroz',      name: 'Contact' }
    ];

    /* Day and night are palette swaps, the way 8-bit games did it. */
    var DAY = {
      k: '#000000', white: '#FCFCFC', cream: '#FCE0A8', creamD: '#F0D0B0', brick: '#F87858', brickD: '#A81000',
      stone: '#BCBCBC', stoneD: '#7C7C7C', red: '#F83800', redD: '#A81000', blue: '#0058F8', blueD: '#0000BC',
      green: '#00A844', teal: '#008888', tealD: '#004058', gold: '#F8B800', wood: '#AC7C00', woodD: '#503000',
      glass: '#3CBCFC', glassL: '#A4E4FC', leaf: '#00A800', leafL: '#58D854', leafD: '#005800',
      trunk: '#AC7C00', trunkD: '#503000', aut: '#F8B800', autL: '#F8D878', autD: '#E45C10',
      skin: '#FCA044', pack: '#0058F8', pants: '#0000BC',
      skyTop: '#3CBCFC', skyLow: '#A4E4FC', sun: '#F8D878', sunC: '#FCFCFC', cloud: '#FCFCFC', cloudS: '#B8B8F8',
      mount: '#3CBCFC', far: '#6888FC', farLit: '#A4E4FC',
      grass: '#58D854', grassD: '#00A800', grassL: '#B8F818', flA: '#FCFCFC', flB: '#F8B800', flC: '#F878F8',
      path: '#FCE0A8', pathD: '#F0D0B0', pathE: '#AC7C00', plaza: '#BCBCBC', plazaD: '#7C7C7C',
      tarmac: '#7C7C7C', dash: '#FCFCFC', sea: '#0078F8', seaL: '#3CBCFC', foam: '#FCFCFC', sand: '#FCE0A8', lamp: '#FCFCFC'
    };
    var NIGHT = {
      k: '#000000', white: '#BCBCBC', cream: '#AC7C00', creamD: '#503000', brick: '#A81000', brickD: '#503000',
      stone: '#7C7C7C', stoneD: '#004058', red: '#A81000', redD: '#881400', blue: '#0000BC', blueD: '#004058',
      green: '#005800', teal: '#004058', tealD: '#000000', gold: '#F8B800', wood: '#503000', woodD: '#000000',
      glass: '#F8D878', glassL: '#FCE0A8', leaf: '#005800', leafL: '#007800', leafD: '#004058',
      trunk: '#503000', trunkD: '#000000', aut: '#AC7C00', autL: '#F8B800', autD: '#881400',
      skin: '#FCA044', pack: '#0058F8', pants: '#6888FC',
      skyTop: '#000000', skyLow: '#0000BC', sun: '#FCFCFC', sunC: '#BCBCBC', cloud: '#4428BC', cloudS: '#0000BC',
      mount: '#004058', far: '#000000', farLit: '#F8D878',
      grass: '#005800', grassD: '#007800', grassL: '#004058', flA: '#BCBCBC', flB: '#AC7C00', flC: '#940084',
      path: '#AC7C00', pathD: '#503000', pathE: '#000000', plaza: '#7C7C7C', plazaD: '#004058',
      tarmac: '#004058', dash: '#BCBCBC', sea: '#0000BC', seaL: '#0058F8', foam: '#6888FC', sand: '#AC7C00', lamp: '#F8D878'
    };

    var dark = mq('(prefers-color-scheme: dark)');
    var P = DAY, S = {}, items = [], tex = null, skyS = null, mountS = null, dith = null, stars = [], clouds = [];
    var W = 320, H = 200, scale = 3, cx = 160, roadY = 120, yh = 64;
    var x = SPAWN, dir = 1, held = 0, auto = null, autoSpeed = 150, targetStop = -1, active = -1;
    var moving = false, walked = 0, started = false, built = false, greeted = false;
    var raf = 0, last = 0, lastDraw = 0, dirty = true, bangUntil = 0, typing = null, seen = [];

    /* ---------- drawing helpers ---------- */
    function rng(seed) { return function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
    function mk(w, h, fn) {
      var c = document.createElement('canvas');
      c.width = w; c.height = h;
      var g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      fn(g, w, h);
      return c;
    }
    function R(g, x0, y0, w, h, c) { g.fillStyle = c; g.fillRect(x0, y0, w, h); }
    function B(g, x0, y0, w, h, c) { R(g, x0, y0, w, h, P.k); R(g, x0 + 1, y0 + 1, w - 2, h - 2, c); }
    /* Pixel text: draw with the pixel font, then keep only solid pixels so edges stay crisp. */
    var tcv = document.createElement('canvas'), tg = tcv.getContext('2d');
    function T(g, s, x0, y0, c) {
      var w = s.length * 8 + 2, d, i, j;
      tcv.width = w; tcv.height = 12;
      tg.fillStyle = '#000';
      tg.font = '8px "Press Start 2P", monospace';
      tg.textBaseline = 'alphabetic';
      tg.fillText(s, 0, 9);
      d = tg.getImageData(0, 0, w, 12).data;
      g.fillStyle = c;
      for (j = 0; j < 12; j++) for (i = 0; i < w; i++) if (d[(j * w + i) * 4 + 3] > 110) g.fillRect(x0 + i, y0 + j - 2, 1, 1);
    }
    function sign(g, s, mid, y0, bg, ink) {
      var w = s.length * 8 + 5, x0 = Math.round(mid - w / 2);
      B(g, x0, y0, w, 13, bg);
      T(g, s, x0 + 3, y0 + 3, ink);
    }
    /* Adds a 1px black outline around whatever is drawn (needs a 1px empty margin). */
    function outlined(c) {
      var w = c.width, h = c.height, g = c.getContext('2d'), d = g.getImageData(0, 0, w, h).data, i, j;
      function a(i2, j2) { return i2 >= 0 && j2 >= 0 && i2 < w && j2 < h && d[(j2 * w + i2) * 4 + 3] > 0; }
      g.fillStyle = P.k;
      for (j = 0; j < h; j++) for (i = 0; i < w; i++) if (!a(i, j) && (a(i - 1, j) || a(i + 1, j) || a(i, j - 1) || a(i, j + 1))) g.fillRect(i, j, 1, 1);
      return c;
    }
    function PM(rows, pal) {
      return mk(rows[0].length, rows.length, function (g) {
        for (var j = 0; j < rows.length; j++) for (var i = 0; i < rows[j].length; i++) {
          var ch = rows[j].charAt(i);
          if (pal[ch]) R(g, i, j, 1, 1, pal[ch]);
        }
      });
    }
    function flip(c) { return mk(c.width, c.height, function (g) { g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(c, 0, 0); }); }
    function win2(g, x0, y0, w, h, cross) {
      B(g, x0, y0, w, h, P.glass);
      R(g, x0 + 1, y0 + 1, w - 2, 1, P.glassL);
      if (cross) { R(g, x0 + (w >> 1), y0 + 1, 1, h - 2, P.k); R(g, x0 + 1, y0 + (h >> 1), w - 2, 1, P.k); }
    }
    function gable(g, x0, y0, w, h, c, cd) {
      for (var i = 0; i < h; i++) {
        var ins = Math.round((h - 1 - i) * (w / 2 - 3) / (h - 1)), ww = w - ins * 2;
        R(g, x0 + ins, y0 + i, ww, 1, P.k);
        if (i > 0 && i < h - 1 && ww > 4) R(g, x0 + ins + 2, y0 + i, ww - 4, 1, i % 4 === 3 ? cd : c);
      }
    }
    function rects(g, list, c) { for (var i = 0; i < list.length; i++) R(g, list[i][0], list[i][1], list[i][2], list[i][3], c); }

    /* ---------- sprites ---------- */
    function buildSprites() {
      var cp = { K: P.k, H: P.k, h: '#7C7C7C', S: P.skin, E: P.k, O: HOT, o: '#A81000', B: P.pack, P: P.pants, W: LIT };
      var head = [
        '....KKKKKK......',
        '...KHHHHHHK.....',
        '..KHhhHHHHHK....',
        '..KHHHHHHHHHK...',
        '..KHHHSSSSSSK...',
        '..KHHSSSSESSK...',
        '..KHHSSSSSSSK...',
        '...KHSSSSSSK....',
        '....KKSSSSK.....',
        '...KOOOOOOOK....',
        '.KKBKOOOOOOK....'
      ];
      var armA = ['.KBBKOOOOOOOK...', '.KBBKOOOOOSSK...'];
      var armB = ['.KBBKOOOOOOOK...', '.KBBKOOOOOOSSK..'];
      var hips = ['.KBBKOOOOOOK....', '.KBBKoooooK.....', '..KKKPPPPPK.....'];
      var legs0 = ['....KPPPPPK.....', '....KPPKPPK.....', '....KPPKPPK.....', '....KPPKPPK.....', '....KPPKPPK.....', '...KWWWKWWWK....', '...KKKKKKKKK....', '................'];
      var legs1 = ['....KPPPPPK.....', '...KPPPKPPPK....', '..KPPPK.KPPPK...', '..KPPK...KPPK...', '.KPPK.....KPPK..', '.KWWWK....KWWWK.', '.KKKKK....KKKKK.', '................'];
      var legs2 = ['....KPPPPPK.....', '....KPPPPPK.....', '.....KPPPK......', '.....KPPPK......', '....KPPKPPK.....', '....KWWKWWWK....', '....KKKKKKKK....', '................'];
      S.idle = PM(head.concat(armA, hips, legs0), cp);
      S.w1 = PM(head.concat(armB, hips, legs1), cp);
      S.w2 = PM(head.concat(armA, hips, legs2), cp);
      S.idleL = flip(S.idle); S.w1L = flip(S.w1); S.w2L = flip(S.w2);

      S.bang = mk(9, 13, function (g) {
        R(g, 0, 0, 9, 10, '#000'); R(g, 1, 1, 7, 8, LIT);
        R(g, 3, 10, 3, 1, '#000'); R(g, 4, 11, 1, 1, '#000'); R(g, 4, 9, 1, 2, LIT);
        R(g, 4, 2, 1, 4, '#000'); R(g, 4, 7, 1, 1, '#000');
      });

      S.plane = outlined(mk(50, 22, function (g) {
        var i;
        rects(g, [[6, 9, 34, 7], [40, 10, 3, 5], [43, 11, 2, 3]], LIT);
        rects(g, [[3, 2, 4, 3], [4, 5, 6, 4]], P.blue);
        R(g, 2, 10, 5, 2, P.stone);
        R(g, 6, 13, 38, 1, P.blue);
        R(g, 8, 15, 30, 1, P.stone);
        for (i = 12; i < 36; i += 4) R(g, i, 10, 2, 2, P.glass);
        R(g, 39, 10, 3, 2, P.glass);
        rects(g, [[18, 15, 13, 2], [20, 17, 10, 2], [23, 19, 6, 1]], P.stoneD);
        R(g, 21, 16, 5, 3, P.stone);
      }));
      S.planeL = flip(S.plane);

      /* About: a small house */
      S.home = mk(76, 70, function (g) {
        B(g, 53, 2, 10, 16, P.brick); R(g, 52, 1, 12, 3, P.k);
        gable(g, 1, 5, 74, 22, P.red, P.redD);
        B(g, 7, 26, 62, 44, P.cream); R(g, 8, 27, 60, 2, P.creamD);
        sign(g, 'ABOUT', 38, 31, LIT, '#000');
        B(g, 14, 48, 15, 22, P.wood); R(g, 15, 49, 13, 2, P.woodD); R(g, 25, 59, 2, 2, P.gold);
        win2(g, 38, 47, 22, 15, true);
        R(g, 36, 62, 26, 5, P.k); R(g, 37, 63, 24, 3, P.wood);
        rects(g, [[39, 60, 2, 2], [49, 60, 2, 2], [58, 60, 2, 2]], HOT);
        rects(g, [[44, 60, 2, 2], [54, 60, 2, 2]], P.gold);
      });

      /* Stage 1: campus in Jakarta, with the Indonesian flag */
      S.esa = mk(112, 80, function (g) {
        var xs = [9, 23, 37, 65, 79, 93], i;
        R(g, 55, 1, 1, 18, P.k); B(g, 56, 1, 13, 8, LIT); R(g, 57, 2, 11, 3, HOT);
        B(g, 2, 18, 108, 7, P.blue);
        B(g, 4, 24, 104, 56, P.white);
        sign(g, 'ESA UNGGUL', 56, 28, P.blue, LIT);
        for (i = 0; i < 6; i++) { win2(g, xs[i], 45, 10, 10); win2(g, xs[i], 60, 10, 10); }
        B(g, 46, 54, 20, 5, P.blue);
        B(g, 49, 58, 14, 22, P.glass); R(g, 55, 59, 2, 20, P.k); R(g, 50, 59, 5, 1, P.glassL); R(g, 57, 59, 5, 1, P.glassL);
        R(g, 44, 78, 24, 2, P.stoneD);
      });

      /* Stage 2: a gate building with a tiled roof in Nanjing */
      S.nxu = mk(116, 84, function (g) {
        var i, y, ins;
        B(g, 34, 12, 48, 5, P.teal); R(g, 31, 10, 4, 6, P.k); R(g, 81, 10, 4, 6, P.k);
        for (i = 0; i < 20; i++) {
          y = 16 + i; ins = Math.round(30 - i * 1.4);
          R(g, ins, y, 116 - ins * 2, 1, P.k);
          R(g, ins + 2, y, 112 - ins * 2, 1, i % 3 === 2 ? P.tealD : P.teal);
        }
        R(g, 0, 36, 116, 3, P.k); R(g, 2, 37, 112, 1, P.gold);
        rects(g, [[0, 33, 3, 3], [113, 33, 3, 3], [0, 31, 2, 2], [114, 31, 2, 2]], P.k);
        B(g, 8, 39, 100, 5, P.blue);
        for (i = 0; i < 16; i++) R(g, 11 + i * 6, 40, 3, 3, i % 2 ? P.green : P.gold);
        B(g, 10, 43, 96, 41, P.stone);
        for (y = 49; y < 84; y += 6) R(g, 11, y, 94, 1, P.stoneD);
        [14, 38, 72, 96].forEach(function (v) { B(g, v, 43, 7, 41, P.red); });
        B(g, 47, 58, 22, 26, P.redD); R(g, 57, 59, 2, 24, P.k);
        for (y = 62; y < 82; y += 5) { R(g, 51, y, 2, 2, P.gold); R(g, 63, y, 2, 2, P.gold); }
        sign(g, 'NXU', 58, 44, P.blueD, P.gold);
        win2(g, 24, 60, 11, 13, true); win2(g, 82, 60, 11, 13, true);
        rects(g, [[23, 47, 5, 6], [89, 47, 5, 6]], P.k);
        rects(g, [[24, 48, 3, 4], [90, 48, 3, 4]], HOT);
      });

      /* Main quest: a gym */
      S.gym = mk(118, 78, function (g) {
        var i;
        R(g, 22, 15, 2, 6, P.k); R(g, 94, 15, 2, 6, P.k);
        sign(g, 'FITNESSCOACH', 59, 3, P.gold, '#000');
        B(g, 4, 20, 110, 58, P.brick); R(g, 5, 21, 108, 2, P.brickD); R(g, 5, 70, 108, 7, P.brickD);
        B(g, 9, 30, 62, 8, LIT);
        for (i = 0; i < 8; i++) R(g, 10 + i * 8, 31, 4, 6, HOT);
        B(g, 11, 37, 58, 30, P.glass);
        for (i = 1; i < 4; i++) R(g, 11 + i * 14, 38, 1, 28, P.k);
        rects(g, [[14, 40, 3, 1], [13, 41, 3, 1], [28, 40, 3, 1], [27, 41, 3, 1], [42, 40, 3, 1], [41, 41, 3, 1]], P.glassL);
        rects(g, [[78, 30, 3, 8], [81, 28, 3, 12], [84, 33, 12, 2], [96, 28, 3, 12], [99, 30, 3, 8]], P.k);
        B(g, 78, 46, 26, 32, P.blueD); B(g, 81, 49, 9, 26, P.glass); B(g, 92, 49, 9, 26, P.glass);
      });

      /* Quest 2: a house with a for-sale board */
      S.house = mk(96, 78, function (g) {
        gable(g, 1, 6, 94, 30, P.blue, P.blueD);
        B(g, 42, 18, 12, 11, P.glass); R(g, 47, 19, 2, 9, P.k); R(g, 43, 23, 10, 1, P.k);
        B(g, 8, 35, 80, 43, P.white); R(g, 9, 36, 78, 2, P.stone);
        sign(g, 'PROPERTY', 48, 40, LIT, '#000');
        B(g, 40, 56, 16, 22, P.red); R(g, 52, 67, 2, 2, P.gold);
        win2(g, 14, 57, 18, 14, true); win2(g, 64, 57, 18, 14, true);
      });

      /* Quest 3: a stone keep with a shield and keyhole */
      S.fort = mk(118, 80, function (g) {
        var v, y;
        for (v = 6; v < 106; v += 16) B(g, v, 14, 10, 10, P.stone);
        B(g, 6, 22, 106, 58, P.stone);
        for (y = 30; y < 80; y += 8) R(g, 7, y, 104, 1, P.stoneD);
        for (y = 22; y < 78; y += 16) for (v = 14; v < 108; v += 20) { R(g, v, y + 1, 1, 7, P.stoneD); R(g, v + 10, y + 9, 1, 7, P.stoneD); }
        sign(g, 'SECURE ADMIN', 59, 26, LIT, '#000');
        rects(g, [[50, 42, 18, 13], [52, 55, 14, 2], [54, 57, 10, 2], [57, 59, 4, 1]], P.k);
        rects(g, [[51, 43, 16, 12], [53, 55, 12, 1], [55, 56, 8, 1], [57, 57, 4, 1]], P.gold);
        R(g, 57, 46, 4, 3, P.k); R(g, 58, 49, 2, 4, P.k);
        B(g, 46, 62, 26, 18, P.stoneD);
        rects(g, [[49, 65, 2, 2], [67, 65, 2, 2], [49, 75, 2, 2], [67, 75, 2, 2]], P.k);
        B(g, 56, 68, 6, 6, P.gold);
        B(g, 16, 48, 9, 18, P.glass); R(g, 20, 49, 1, 16, P.k);
        B(g, 93, 48, 9, 18, P.glass); R(g, 97, 49, 1, 16, P.k);
      });

      /* Skills: an item shop */
      /* Hidayah: a game hall whose front window is a screen showing a tiny RPG scene */
      S.arcade = mk(104, 76, function (g) {
        var i;
        R(g, 26, 15, 2, 6, P.k); R(g, 76, 15, 2, 6, P.k);
        sign(g, 'HIDAYAH', 52, 3, LIT, '#000');
        B(g, 4, 20, 96, 6, P.blue);
        B(g, 6, 25, 92, 51, P.cream);
        B(g, 11, 31, 54, 34, P.k);
        R(g, 13, 33, 50, 30, P.green);
        R(g, 13, 53, 50, 5, P.gold);
        for (i = 0; i < 3; i++) { R(g, 16 + i * 7, 36, 2, 1, HOT); R(g, 19 + i * 7, 36, 2, 1, HOT); R(g, 16 + i * 7, 37, 5, 2, HOT); R(g, 17 + i * 7, 39, 3, 1, HOT); R(g, 18 + i * 7, 40, 1, 1, HOT); }
        R(g, 27, 45, 4, 3, P.k); R(g, 27, 48, 4, 4, HOT); R(g, 27, 52, 1, 3, P.blue); R(g, 30, 52, 1, 3, P.blue);
        R(g, 44, 47, 10, 7, P.k); R(g, 45, 48, 4, 5, LIT); R(g, 50, 48, 3, 5, LIT);
        B(g, 72, 44, 22, 32, P.wood); B(g, 76, 48, 14, 10, P.glass); R(g, 90, 62, 2, 2, P.gold);
      });
      S.shop = mk(98, 74, function (g) {
        var i;
        R(g, 24, 15, 2, 6, P.k); R(g, 72, 15, 2, 6, P.k);
        sign(g, 'SKILLS', 49, 3, LIT, '#000');
        B(g, 4, 20, 90, 6, P.wood);
        B(g, 6, 25, 86, 49, P.cream);
        B(g, 7, 30, 84, 9, LIT);
        for (i = 0; i < 8; i++) R(g, 8 + i * 10, 31, 5, 7, P.green);
        B(g, 12, 44, 42, 22, P.glass); R(g, 13, 58, 40, 1, P.k);
        [[17, HOT], [26, P.blue], [35, P.gold], [44, P.green]].forEach(function (q) {
          R(g, q[0] + 1, 50, 2, 2, P.k); R(g, q[0], 52, 4, 6, P.k); R(g, q[0] + 1, 53, 2, 4, q[1]);
        });
        B(g, 62, 44, 22, 30, P.wood); B(g, 66, 48, 14, 10, P.glass); R(g, 80, 62, 2, 2, P.gold);
      });

      /* Contact: a small post office */
      S.post = mk(82, 68, function (g) {
        gable(g, 1, 5, 80, 22, P.red, P.redD);
        B(g, 8, 26, 66, 42, P.white); R(g, 9, 27, 64, 2, P.stone);
        sign(g, 'CONTACT', 41, 31, LIT, '#000');
        B(g, 16, 48, 16, 20, P.blue); R(g, 28, 58, 2, 2, P.gold);
        B(g, 44, 49, 22, 14, LIT);
        for (var i = 0; i < 5; i++) { R(g, 45 + i * 2, 50 + i, 2, 1, '#000'); R(g, 63 - i * 2, 50 + i, 2, 1, '#000'); }
      });

      S.palm = outlined(mk(40, 57, function (g) {
        for (var i = 0; i < 34; i++) R(g, 18 + (i < 12 ? 1 : 0), 21 + i, 4, 1, i % 5 === 0 ? P.trunkD : P.trunk);
        rects(g, [[10, 9, 10, 3], [6, 11, 6, 3], [3, 14, 5, 3], [2, 17, 3, 4], [20, 9, 10, 3], [28, 11, 6, 3], [32, 14, 5, 3], [35, 17, 3, 4],
                  [11, 16, 8, 3], [8, 19, 5, 3], [6, 22, 4, 4], [21, 16, 8, 3], [27, 19, 5, 3], [30, 22, 4, 4], [16, 4, 8, 6], [14, 7, 12, 5]], P.leaf);
        rects(g, [[11, 9, 8, 1], [21, 9, 8, 1], [17, 4, 6, 1], [7, 11, 4, 1], [29, 11, 4, 1], [12, 16, 6, 1], [22, 16, 6, 1]], P.leafL);
        rects(g, [[16, 19, 3, 3], [21, 20, 3, 3]], P.trunkD);
      }));
      function tree(c, cl, cd) {
        return outlined(mk(36, 51, function (g) {
          rects(g, [[11, 1, 14, 4], [7, 4, 22, 5], [4, 8, 28, 10], [6, 18, 24, 5], [10, 23, 16, 4]], c);
          rects(g, [[12, 2, 8, 2], [8, 6, 8, 2], [6, 10, 5, 3], [20, 4, 5, 2]], cl);
          rects(g, [[20, 19, 9, 3], [24, 13, 7, 5], [13, 23, 12, 3]], cd);
          R(g, 16, 27, 4, 22, P.trunk); R(g, 16, 27, 1, 22, P.trunkD); R(g, 14, 47, 8, 2, P.trunk);
        }));
      }
      S.treeG = tree(P.leaf, P.leafL, P.leafD);
      S.treeA = tree(P.aut, P.autL, P.autD);
      S.bush = outlined(mk(30, 18, function (g) {
        rects(g, [[7, 1, 14, 4], [3, 4, 24, 5], [1, 8, 28, 9]], P.leaf);
        rects(g, [[9, 2, 6, 1], [5, 5, 5, 2], [17, 4, 4, 1]], P.leafL);
        R(g, 14, 12, 13, 3, P.leafD);
        R(g, 6, 9, 2, 2, P.flC); R(g, 21, 7, 2, 2, P.flA); R(g, 12, 13, 2, 2, P.flB);
      }));
      S.tuft = outlined(mk(26, 16, function (g) {
        rects(g, [[2, 7, 2, 8], [8, 6, 2, 9], [14, 5, 2, 10], [20, 8, 2, 7]], P.leaf);
        rects(g, [[5, 4, 2, 11], [11, 1, 2, 14], [17, 3, 2, 12], [23, 9, 2, 6]], P.leafL);
        R(g, 11, 1, 2, 2, P.flB); R(g, 5, 4, 2, 2, P.flA);
      }));
      S.lamp = mk(12, 42, function (g) {
        R(g, 5, 9, 2, 31, P.k); R(g, 3, 40, 6, 2, P.k);
        B(g, 1, 1, 10, 9, P.lamp); R(g, 0, 0, 12, 2, P.k);
      });
      function board(s, bg, ink) {
        var w = s.length * 8 + 5;
        return mk(w, 30, function (g) {
          R(g, 5, 12, 2, 18, P.k); R(g, w - 7, 12, 2, 18, P.k);
          B(g, 0, 0, w, 13, bg); T(g, s, 3, 3, ink);
        });
      }
      S.sJkt = board('JAKARTA', LIT, '#000');
      S.sNkg = board('NANJING', LIT, '#000');
      S.sAir = board('AIRPORT', P.blue, LIT);
      S.sSale = mk(37, 26, function (g) { R(g, 17, 12, 2, 14, P.k); B(g, 0, 0, 37, 13, HOT); T(g, 'SALE', 3, 3, LIT); });
      S.mail = mk(12, 26, function (g) {
        R(g, 5, 16, 2, 10, P.k); B(g, 0, 2, 12, 15, HOT); R(g, 0, 0, 12, 3, P.k);
        R(g, 3, 7, 6, 2, '#000'); R(g, 3, 11, 6, 1, LIT);
      });
      S.boat = outlined(mk(28, 24, function (g) {
        rects(g, [[3, 17, 22, 3], [5, 20, 18, 2]], P.wood);
        R(g, 13, 2, 1, 15, P.woodD);
        for (var i = 0; i < 12; i++) R(g, 14, 3 + i, 2 + ((i * .8) | 0), 1, LIT);
        for (i = 0; i < 8; i++) R(g, 12 - ((i * .7) | 0), 7 + i, 1 + ((i * .7) | 0), 1, LIT);
      }));
      S.sun = mk(18, 18, function (g) {
        var rows = [[6, 6], [4, 10], [3, 12], [2, 14], [1, 16], [1, 16], [0, 18], [0, 18], [0, 18], [0, 18], [0, 18], [0, 18], [1, 16], [1, 16], [2, 14], [3, 12], [4, 10], [6, 6]];
        for (var j = 0; j < 18; j++) R(g, rows[j][0], j, rows[j][1], 1, P.sun);
        if (P === NIGHT) rects(g, [[5, 4, 3, 2], [10, 8, 4, 3], [5, 11, 2, 2], [11, 13, 2, 1]], P.sunC);
        else rects(g, [[4, 4, 5, 2], [4, 6, 2, 3]], P.sunC);
      });
      function cloud(w) {
        return mk(w, 14, function (g) {
          R(g, (w * .3) | 0, 0, (w * .36) | 0, 4, P.cloud);
          R(g, (w * .12) | 0, 3, (w * .72) | 0, 5, P.cloud);
          R(g, 0, 7, w, 5, P.cloud);
          R(g, 2, 12, w - 4, 2, P.cloudS);
          R(g, (w * .2) | 0, 10, (w * .5) | 0, 2, P.cloudS);
        });
      }
      clouds = [
        { x: 30, y: .08, s: 3, img: cloud(34) }, { x: 140, y: .5, s: 2, img: cloud(26) }, { x: 250, y: .2, s: 2.6, img: cloud(40) },
        { x: 380, y: .65, s: 1.6, img: cloud(24) }, { x: 470, y: .34, s: 2.2, img: cloud(30) }
      ];
    }

    /* ---------- the world ---------- */
    function buildWorld() {
      var i, v;
      items = [];
      function put(lane, wx, img, oy) { items.push({ f: LANES[lane], b: Math.round(K * LANES[lane]), x: wx, img: img, oy: oy || 0 }); }
      put('build', 230, S.home); put('build', 480, S.esa); put('build', 1420, S.nxu); put('build', 1660, S.gym);
      put('build', 1880, S.house); put('build', 2100, S.fort); put('build', 2320, S.arcade); put('build', 2540, S.shop); put('build', 2740, S.post);
      [40, 350, 605].forEach(function (q) { put('build', q, S.palm); });
      [1300, 1540, 1772, 1990, 2212, 2432, 2644, 2836].forEach(function (q, n) { put('build', q, n % 3 === 1 ? S.treeG : S.treeA); });
      [-420, -300, -170, -60, 60, 150, 300, 410, 560, 660].forEach(function (q) { put('mid', q, S.palm); });
      for (i = 0; i < 22; i++) put('mid', 1230 + i * 112, i % 2 ? S.treeA : S.treeG);
      put('mid', 940, S.boat, 4);
      put('curb', 70, S.sJkt); put('curb', 596, S.sAir); put('curb', 1306, S.sNkg);
      [160, 345, 560, 1500, 1730, 1950, 2170, 2400, 2620, 2810].forEach(function (q) { put('curb', q, S.lamp); });
      put('curb', 1938, S.sSale); put('curb', 2694, S.mail);
      [10, 170, 380, 575, 1265, 1540, 1770, 1990, 2210, 2432, 2640, 2830].forEach(function (q) { put('fore', q, S.bush); });
      [-80, 90, 300, 520, 1350, 1600, 1850, 2080, 2300, 2520, 2700, 2920].forEach(function (q) { put('near', q, S.tuft); });
      items.sort(function (a, b) { return a.f - b.f; });

      /* Ground seen from above: across = position along the road, down = distance from the camera. */
      tex = mk(WORLD + PAD * 2, DFAR - DNEAR, function (g, w, h) {
        var r = rng(11), k, c;
        function band(x0, x1, d0, d1, col) { R(g, Math.round(x0 + PAD), Math.round(d0 - DNEAR), Math.round(x1 - x0), Math.round(d1 - d0), col); }
        R(g, 0, 0, w, h, P.grass);
        /* Jakarta side: rice paddies in the distance */
        for (v = -PAD; v < SEA0 - 40; v += 96) for (k = 248; k < DFAR; k += 58) {
          c = r();
          band(v + 3, v + 93, k + 3, k + 55, c < .4 ? P.grassL : (c < .7 ? P.seaL : P.grass));
          for (i = k + 9; i < k + 54; i += 7) band(v + 7, v + 89, i, i + 1, P.grassD);
        }
        /* Nanjing side: streets in the distance */
        for (v = SEA1 + 60; v < WORLD + PAD; v += 132) band(v, v + 9, 240, DFAR, P.plazaD);
        band(SEA1 + 60, WORLD + PAD, 296, 306, P.plazaD);
        band(SEA1 + 60, WORLD + PAD, 366, 376, P.plazaD);
        for (i = 0; i < 5600; i++) {
          v = (r() * w) | 0; k = (r() * h) | 0; c = r();
          R(g, v, k, c < .8 ? 2 : 1, 1, c < .8 ? P.grassD : (c < .87 ? P.flA : (c < .94 ? P.flB : P.flC)));
        }
        /* the road */
        band(-PAD, WORLD + PAD, 148, 172, P.path);
        band(-PAD, WORLD + PAD, 148, 149, P.pathE);
        band(-PAD, WORLD + PAD, 171, 172, P.pathE);
        band(-PAD, WORLD + PAD, 160, 161, P.pathD);
        for (v = -PAD; v < WORLD + PAD; v += 16) { band(v, v + 1, 149, 160, P.pathD); band(v + 8, v + 9, 161, 171, P.pathD); }
        /* paved squares in front of each stop */
        STOPS.forEach(function (s) {
          band(s.x - 60, s.x + 60, 172, 232, P.plaza);
          for (var q = 0; q <= 120; q += 15) { band(s.x - 60 + q, s.x - 59 + q, 172, 232, P.plazaD); if (q <= 60) band(s.x - 60, s.x + 60, 172 + q, 173 + q, P.plazaD); }
        });
        /* runways at both coasts */
        [[FLY0 - 50, SEA0 - 8], [SEA1 + 8, FLY1 + 50]].forEach(function (q) {
          band(q[0], q[1], 136, 184, P.tarmac);
          band(q[0], q[1], 138, 139, P.dash); band(q[0], q[1], 181, 182, P.dash);
          for (var u = q[0] + 6; u < q[1] - 12; u += 22) band(u, u + 12, 159, 161, P.dash);
        });
        /* the sea between Indonesia and China */
        band(SEA0 - 12, SEA1 + 12, DNEAR, DFAR, P.sand);
        band(SEA0, SEA1, DNEAR, DFAR, P.sea);
        for (i = 0; i < 1000; i++) {
          v = SEA0 + 2 + r() * (SEA1 - SEA0 - 12); k = DNEAR + r() * (DFAR - DNEAR - 1);
          band(v, v + 3 + ((r() * 6) | 0), k, k + 1, r() < .18 ? P.foam : P.seaL);
        }
        for (k = DNEAR; k < DFAR; k += 6) {
          c = ((k / 6) | 0) % 2 * 2;
          band(SEA0, SEA0 + 2 + c, k, k + 3, P.foam); band(SEA1 - 2 - c, SEA1, k, k + 3, P.foam);
        }
      });

      /* Far skylines: Jakarta with its monument, Nanjing with a pagoda and a tall tower */
      skyS = mk(SPAD + Math.round(WORLD * .2) + 340, 64, function (g, w, h) {
        var r = rng(5), uj = SPAD + 60, un = SPAD + 380, u, bw, bh, t;
        function city(u0, u1, maxh) {
          for (u = u0; u < u1;) {
            bw = 5 + ((r() * 8) | 0); bh = 8 + ((r() * maxh) | 0);
            R(g, u, h - bh, bw, bh, P.far);
            for (t = 0; t < bh / 5; t++) if (r() < .55) R(g, u + 1 + ((r() * (bw - 2)) | 0), h - bh + 2 + ((r() * Math.max(1, bh - 5)) | 0), 1, 1, P.farLit);
            u += bw + ((r() * 3) | 0);
          }
        }
        city(uj - 72, uj + 72, 20);
        rects(g, [[uj - 10, h - 9, 21, 9], [uj - 4, h - 13, 9, 4], [uj - 1, h - 42, 3, 30]], P.far);
        R(g, uj - 2, h - 46, 5, 4, P.gold);
        city(un - 84, un + 92, 24);
        rects(g, [[un + 20, h - 50, 7, 50], [un + 22, h - 56, 3, 6], [un + 23, h - 61, 1, 5]], P.far);
        for (t = 0; t < 6; t++) { R(g, un - 44 + t, h - 6 - t * 6, 14 - t * 2, 6, P.far); R(g, un - 46 + t, h - 6 - t * 6, 18 - t * 2, 2, P.far); }
        R(g, un - 38, h - 40, 2, 4, P.far);
      });
      mountS = mk(MPAD + Math.round(WORLD * .06) + 340, 44, function (g, w, h) {
        function hill(uc, half, ht, round) {
          for (var j = 0; j < ht; j++) {
            var kk = (j + 1) / ht, hw = Math.round(half * (round ? Math.sqrt(kk) : kk));
            R(g, uc - hw, h - ht + j, hw * 2, 1, P.mount);
          }
        }
        hill(MPAD + 2, 44, 30, false); hill(MPAD + 44, 38, 22, false);
        hill(MPAD + 118, 78, 24, true);
      });

      var dc = mk(2, 2, function (g) { R(g, 0, 0, 2, 2, P.skyTop); R(g, 0, 0, 1, 1, P.skyLow); R(g, 1, 1, 1, 1, P.skyLow); });
      dith = ctx.createPattern(dc, 'repeat');
      var sr = rng(3);
      stars = [];
      for (i = 0; i < 70; i++) stars.push([sr(), sr(), sr() < .35]);
    }

    function build() {
      P = dark.matches ? NIGHT : DAY;
      S = {};
      buildSprites();
      buildWorld();
      built = true;
      dirty = true;
    }

    /* ---------- layout: how big one game pixel is, and where the road sits ---------- */
    function layout() {
      var vw = el.clientWidth, vh = el.clientHeight;
      if (!vw || !vh) return;
      scale = Math.max(2, Math.min(Math.floor(vh / 215), Math.floor(vw / 240)));
      W = Math.min(640, Math.ceil(vw / scale));
      H = Math.ceil(vh / scale);
      if (cv.width !== W) cv.width = W;
      if (cv.height !== H) cv.height = H;
      cv.style.width = W * scale + 'px';
      cv.style.height = H * scale + 'px';
      /* keep these in step with the .g-dialog rules in the stylesheet */
      var side = vh < 520 && vw > vh;
      var frac = vw < 720 && vh >= vw ? .56 : .46;
      cx = side ? Math.round(W * .26) : (W >> 1);
      roadY = Math.round((side ? vh * .74 : vh - 16 - vh * frac - 26) / scale);
      roadY = Math.max(K + 36, Math.min(H - 12, roadY));
      yh = roadY - K;
      dirty = true;
      more();
    }

    /* ---------- drawing a frame ---------- */
    function drawItems(g, cam, lo, hi) {
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (it.f < lo || it.f >= hi) continue;
        var ix = Math.round(cx + (it.x - cam) * it.f - it.img.width / 2);
        if (ix > W || ix + it.img.width < 0) continue;
        g.drawImage(it.img, ix, yh + it.b - it.img.height + it.oy);
      }
    }
    function shadow(g, x0, w) { g.globalAlpha = .3; R(g, x0, roadY - 1, w, 2, '#000'); g.globalAlpha = 1; }
    function draw(now) {
      var g = ctx, i, y, d, sc, c, px;
      if (!built) { R(g, 0, 0, W, H, dark.matches ? '#000000' : '#A4E4FC'); return; }
      var t = reduce ? 0 : now / 1000;
      var cam = Math.max(60, Math.min(WORLD - 60, x));
      g.imageSmoothingEnabled = false;

      /* sky */
      var yb = yh - 46;
      R(g, 0, 0, W, yh + 2, P.skyLow);
      if (yb > 2) { R(g, 0, 0, W, yb - 2, P.skyTop); g.fillStyle = dith; g.fillRect(0, yb - 2, W, 2); }
      if (P === NIGHT) for (i = 0; i < stars.length; i++) R(g, (stars[i][0] * W) | 0, (stars[i][1] * Math.max(8, yh - 26)) | 0, 1, 1, stars[i][2] ? '#7C7C7C' : LIT);
      g.drawImage(S.sun, W - 36, Math.max(6, Math.min(28, yh - 84)));
      for (i = 0; i < clouds.length; i++) {
        c = clouds[i];
        px = (((c.x + t * c.s - cam * .03) % (W + 90)) + W + 90) % (W + 90) - 60;
        g.drawImage(c.img, Math.round(px), Math.round(4 + c.y * Math.max(12, yh - 64)));
      }

      /* ground, one screen row at a time */
      var th = tex.height;
      for (y = yh + 1; y < H; y++) {
        d = D0 * K / (y - yh);
        if (d > DFAR) d = DFAR; else if (d < DNEAR) d = DNEAR;
        sc = D0 / d;
        g.drawImage(tex, PAD + cam - cx / sc, Math.min(th - 1, (d - DNEAR) | 0), W / sc, 1, 0, y, W, 1);
      }

      g.drawImage(mountS, cx - MPAD - Math.round(cam * .06), yh + 3 - mountS.height);
      g.drawImage(skyS, cx - SPAD - Math.round(cam * .2), yh + 11 - skyS.height);
      drawItems(g, cam, 0, 1);

      /* the plane waits on a runway, or carries the walker over the sea */
      var sx = Math.round(cx + (x - cam));
      if (x > FLY0 && x < FLY1) {
        var alt = Math.round(Math.sin(Math.PI * (x - FLY0) / (FLY1 - FLY0)) * 54);
        shadow(g, sx - 16 + (alt >> 3), 32 - (alt >> 2));
        g.drawImage(dir < 0 ? S.planeL : S.plane, sx - 25, roadY - alt - 21);
      } else {
        var psx = Math.round(cx + ((x <= FLY0 ? FLY0 : FLY1) - cam));
        shadow(g, psx - 16, 32);
        g.drawImage(S.plane, psx - 25, roadY - 21);
        var fr = moving ? ((walked / 9) | 0) % 2 ? 'w2' : 'w1' : 'idle';
        shadow(g, sx - 5, 10);
        g.drawImage(S[fr + (dir < 0 ? 'L' : '')], sx - 8, roadY - 23 - (fr === 'w2' ? 1 : 0));
        if (now < bangUntil) g.drawImage(S.bang, sx - 4, roadY - 38);
      }

      drawItems(g, cam, 1, 99);
    }

    /* ---------- text box ---------- */
    var dlg = document.getElementById('g-dialog'), body = document.getElementById('g-body');
    var nextBtn = document.getElementById('g-next'), backBtn = document.getElementById('g-back'), pipList = document.getElementById('g-pips');
    var pips = [];
    /* Each stop shows the same content as the page view, copied from it. */
    var content = STOPS.map(function (s, i) {
      var box = document.createElement('div'), src = document.querySelectorAll('#page [data-stop="' + s.id + '"]'), j, k, n, ids;
      box.className = 'g-stop';
      for (j = 0; j < src.length; j++) {
        n = src[j].cloneNode(true);
        n.removeAttribute('id');
        n.removeAttribute('data-stop');
        ids = n.querySelectorAll('[id]');
        for (k = 0; k < ids.length; k++) ids[k].removeAttribute('id');
        box.appendChild(n);
      }
      var li = document.createElement('li'), b = document.createElement('button');
      b.type = 'button';
      b.className = 'pip';
      b.setAttribute('aria-label', 'Go to ' + s.name);
      b.addEventListener('click', function () { goTo(i); });
      li.appendChild(b);
      pipList.appendChild(li);
      pips.push(b);
      return box;
    });

    function refX() { return auto !== null ? auto : x; }
    function idxRight(v) { for (var i = 0; i < STOPS.length; i++) if (STOPS[i].x > v + 20) return i; return -1; }
    function idxLeft(v) { for (var i = STOPS.length - 1; i >= 0; i--) if (STOPS[i].x < v - 20) return i; return -1; }
    function nearStop(v, r) { for (var i = 0; i < STOPS.length; i++) if (Math.abs(STOPS[i].x - v) <= (r || 22)) return i; return -1; }
    function more() { dlg.classList.toggle('has-more', active >= 0 && body.scrollHeight - body.scrollTop - body.clientHeight > 8); }
    function sync() {
      var here = active >= 0 ? active : targetStop, i;
      for (i = 0; i < pips.length; i++) {
        pips[i].setAttribute('aria-current', i === here ? 'true' : 'false');
        pips[i].classList.toggle('seen', !!seen[i]);
      }
      nextBtn.disabled = idxRight(refX()) < 0;
      backBtn.disabled = idxLeft(refX()) < 0;
    }
    function label(i) {
      if (i < 0) { dlg.removeAttribute('data-label'); dlg.classList.remove('is-main'); return; }
      dlg.setAttribute('data-label', STOPS[i].label);
      dlg.classList.toggle('is-main', STOPS[i].id === 'p1');
    }
    function showStop(i) {
      active = i;
      seen[i] = true;
      label(i);
      body.textContent = '';
      body.appendChild(content[i]);
      body.scrollTop = 0;
      more();
      if (i === 0 && !greeted) {
        greeted = true;
        var p = content[0].querySelector('.lead');
        if (p) typing = typeOut(p);
      }
      sync();
      dirty = true;
    }
    function leave() {
      if (typing && typing.active()) typing();
      active = -1;
      body.textContent = '';
      dlg.classList.remove('has-more');
      label(targetStop);
      sync();
    }
    function goTo(i) {
      if (!started) return;
      if (typing && typing.active()) typing();
      if (active === i && Math.abs(x - STOPS[i].x) < 1) return;
      targetStop = i;
      auto = STOPS[i].x;
      held = 0;
      var a = Math.min(x, auto), b = Math.max(x, auto);
      var air = Math.max(0, Math.min(b, FLY1) - Math.max(a, FLY0));
      autoSpeed = Math.max(150, Math.min(640, (b - a - air) / 1.7));
      if (reduce) x = auto;
      leave();
    }
    function next() {
      if (typing && typing.active()) { typing(); return; }
      var i = idxRight(refX());
      if (i >= 0) goTo(i);
    }
    function back() {
      var i = idxLeft(refX());
      if (i >= 0) goTo(i);
    }

    /* ---------- movement ---------- */
    function step(dt, now) {
      var want = 0, was = moving, i;
      if (auto !== null) {
        if (Math.abs(auto - x) < .5) {
          x = auto;
          auto = null;
          if (targetStop >= 0) { i = targetStop; targetStop = -1; showStop(i); bangUntil = now + 650; }
        } else want = auto > x ? 1 : -1;
      } else if (held) {
        want = held;
        if (active >= 0 && Math.abs(STOPS[active].x - x) > 24) leave();
      }
      moving = want !== 0;
      if (moving) {
        dir = want;
        var sp = x > FLY0 && x < FLY1 ? 330 : (auto !== null ? autoSpeed : 84);
        var nx = x + want * sp * dt;
        if (auto !== null && (auto - x) * (auto - nx) <= 0) nx = auto;
        nx = Math.max(40, Math.min(WORLD - 40, nx));
        walked += Math.abs(nx - x);
        x = nx;
      } else {
        if (was) sync();
        if (auto === null && started) {
          if (x > FLY0 && x < FLY1) { auto = dir > 0 ? FLY1 + 14 : FLY0 - 14; targetStop = -1; autoSpeed = 150; }   /* never leave the plane hanging */
          else if (active < 0) {
            /* stopped in front of a building: step up to its door, then open its text box */
            i = nearStop(x, 48);
            if (i >= 0) {
              if (Math.abs(STOPS[i].x - x) < 1) showStop(i);
              else { targetStop = i; auto = STOPS[i].x; autoSpeed = 84; label(i); sync(); }
            }
          }
        }
      }
    }
    function frame(now) {
      raf = requestAnimationFrame(frame);
      var dt = Math.min(.05, (now - last) / 1000);
      last = now;
      step(dt, now);
      if (moving || dirty || now - lastDraw > 120) { dirty = false; lastDraw = now; draw(now); }
    }
    function resume() {
      layout();
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
    }
    function pause() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      held = 0;
    }
    function start() {
      if (started) return;
      started = true;
      root.setAttribute('data-mode', 'play');
      body.textContent = '';
      sync();
      nextBtn.focus();
      goTo(0);
    }

    /* ---------- input ---------- */
    function playing() { return root.getAttribute('data-mode') === 'play'; }
    document.addEventListener('keydown', function (e) {
      var m = root.getAttribute('data-mode'), k = e.key, tag = e.target && e.target.tagName;
      if (m === 'page' || !m || e.altKey || e.ctrlKey || e.metaKey) return;
      var onControl = tag === 'BUTTON' || tag === 'A';
      if (m === 'title') {
        if ((k === 'Enter' || k === ' ') && !onControl) { e.preventDefault(); start(); }
        return;
      }
      if (k === 'ArrowRight' || k === 'd' || k === 'D') { held = 1; auto = null; targetStop = -1; e.preventDefault(); }
      else if (k === 'ArrowLeft' || k === 'a' || k === 'A') { held = -1; auto = null; targetStop = -1; e.preventDefault(); }
      else if (k === 'ArrowDown' || k === 'ArrowUp') { body.scrollTop += k === 'ArrowDown' ? 64 : -64; e.preventDefault(); }
      else if ((k === 'Enter' || k === ' ') && !onControl) { e.preventDefault(); next(); }
    });
    body.addEventListener('scroll', more, { passive: true });
    document.addEventListener('keyup', function (e) {
      var k = e.key;
      if ((k === 'ArrowRight' || k === 'd' || k === 'D') && held === 1) held = 0;
      if ((k === 'ArrowLeft' || k === 'a' || k === 'A') && held === -1) held = 0;
    });
    window.addEventListener('blur', function () { held = 0; });
    /* Click or tap the scene: walk to that spot, or to the building that was tapped. */
    cv.addEventListener('click', function (e) {
      if (!playing()) { start(); return; }
      var r = cv.getBoundingClientRect();
      var px = (e.clientX - r.left) / scale, py = (e.clientY - r.top) / scale;
      var cam = Math.max(60, Math.min(WORLD - 60, x));
      var wx = cam + (px - cx) / (py < roadY - 6 ? LANES.build : 1);
      var best = -1, bd = 70, i;
      for (i = 0; i < STOPS.length; i++) if (Math.abs(STOPS[i].x - wx) < bd) { bd = Math.abs(STOPS[i].x - wx); best = i; }
      if (best >= 0) { goTo(best); return; }
      if (typing && typing.active()) typing();
      targetStop = -1;
      auto = Math.max(40, Math.min(WORLD - 40, cam + (px - cx)));
      autoSpeed = 150;
      held = 0;
      if (active >= 0) leave(); else label(-1);
    });
    nextBtn.addEventListener('click', next);
    backBtn.addEventListener('click', back);
    document.getElementById('g-start').addEventListener('click', start);

    var rz = 0;
    window.addEventListener('resize', function () {
      cancelAnimationFrame(rz);
      rz = requestAnimationFrame(function () { if (root.getAttribute('data-mode') !== 'page') layout(); });
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) pause(); else if (root.getAttribute('data-mode') !== 'page') resume();
    });
    function repaint() { if (built) build(); }
    if (dark.addEventListener) dark.addEventListener('change', repaint); else if (dark.addListener) dark.addListener(repaint);

    /* Sprites carry pixel-font labels, so build once the font is ready. */
    if (document.fonts && document.fonts.load) {
      document.fonts.load('8px "Press Start 2P"').then(build, build);
      setTimeout(function () { if (!built) build(); }, 1500);
    } else build();

    return { start: start, resume: resume, pause: pause, started: function () { return started; } };
  })();

  /* =====================================================================
     Page view
     ===================================================================== */
  var introDone = false;
  function startIntro() {
    if (introDone) return;
    introDone = true;
    var intro = document.getElementById('intro');
    var box = intro ? intro.closest('.dialog') : null;
    if (!intro || !box) return;
    var fin = typeOut(intro, function () { box.classList.add('done'); });
    box.addEventListener('click', fin);
    document.addEventListener('keydown', fin, { once: true });
  }

  var menuBtn = document.querySelector('.menu-btn');
  var links = document.getElementById('nav-links');
  function closeMenu() { links.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); }
  menuBtn.addEventListener('click', function () {
    var open = links.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  links.addEventListener('click', function (e) { if (e.target.closest('a')) closeMenu(); });
  document.addEventListener('click', function (e) { if (!e.target.closest('.nav')) closeMenu(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
  window.addEventListener('resize', function () { if (window.innerWidth > 959) closeMenu(); });

  /* "Back to top": #top is a sticky header, so a plain anchor barely scrolls. Scroll to the top in JS, smoothly. */
  Array.prototype.forEach.call(document.querySelectorAll('a[href="#top"]'), function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      closeMenu();
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      if (window.history && history.replaceState) history.replaceState(null, '', location.pathname + location.search);
    });
  });

  /* The menu cursor follows the section on screen */
  if ('IntersectionObserver' in window) {
    var navA = links.querySelectorAll('a');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        navA.forEach(function (a) {
          a.setAttribute('aria-current', a.getAttribute('href') === '#' + en.target.id ? 'true' : 'false');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['about', 'projects', 'skills', 'contact'].forEach(function (id) {
      var sec = document.getElementById(id);
      if (sec) io.observe(sec);
    });
  }

  /* =====================================================================
     Switching between the game and the page
     ===================================================================== */
  function setMode(m, keepScroll) {
    if (!Game) m = 'page';
    root.setAttribute('data-mode', m);
    if (m === 'page') {
      if (Game) Game.pause();
      startIntro();
      if (!keepScroll) window.scrollTo(0, 0);
    } else Game.resume();
  }
  document.getElementById('to-page').addEventListener('click', function () { setMode('page'); });
  document.getElementById('g-skip').addEventListener('click', function () { setMode('page'); });
  document.getElementById('to-game').addEventListener('click', function () { setMode(Game && Game.started() ? 'play' : 'title'); });
  if (!Game) document.getElementById('to-game').hidden = true;
  setMode(root.getAttribute('data-mode') === 'page' ? 'page' : 'title', true);
})();
