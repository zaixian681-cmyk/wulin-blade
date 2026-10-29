/* ============================================================
   textures.js — 程序化 PBR 贴图（无外部素材，全部 canvas 生成）
   ============================================================ */
window.WL = window.WL || {};
(function () {
  var TX = WL.TX = {};

  function cv(size) {
    var c = document.createElement('canvas');
    c.width = c.height = size;
    return c;
  }
  function tex(canvas, repeat, colorSpace) {
    var t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (repeat) t.repeat.set(repeat, repeat);
    t.colorSpace = colorSpace === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }
  TX.tex = tex;

  function noiseFill(g, S, base, amp, scale) {
    var img = g.getImageData(0, 0, S, S), d = img.data;
    for (var i = 0; i < d.length; i += 4) {
      var n = (Math.random() - 0.5) * amp;
      d[i] = Math.max(0, Math.min(255, d[i] + n));
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
    }
    g.putImageData(img, 0, 0);
  }

  /* ---------- 青石板路面 ---------- */
  TX.stonePath = function (S) {
    S = S || 512;
    var c = cv(S), g = c.getContext('2d');
    g.fillStyle = '#8e8e86'; g.fillRect(0, 0, S, S);
    var rowH = S / 8;
    for (var r = 0; r < 9; r++) {
      var y = r * rowH, off = (r % 2) * rowH * 0.7;
      for (var x = -rowH; x < S + rowH; x += rowH * 1.35) {
        var w = rowH * (1.15 + Math.random() * 0.35), h = rowH * 0.92;
        var v = 118 + Math.random() * 46;
        g.fillStyle = 'rgb(' + (v | 0) + ',' + ((v + 2) | 0) + ',' + ((v - 6) | 0) + ')';
        g.beginPath();
        var px = x + off + 1, py = y + 1;
        g.moveTo(px + 2, py);
        g.lineTo(px + w - 2, py + Math.random() * 2);
        g.lineTo(px + w, py + h - 2);
        g.lineTo(px + 1, py + h);
        g.closePath(); g.fill();
        // 边角磨损
        g.strokeStyle = 'rgba(60,60,58,0.35)'; g.lineWidth = 1; g.stroke();
      }
    }
    // 缝隙积土
    g.globalAlpha = 0.25;
    for (var i = 0; i < 900; i++) {
      g.fillStyle = Math.random() > 0.5 ? '#5a5a4a' : '#9aa08a';
      g.fillRect(Math.random() * S, Math.random() * S, 1 + Math.random() * 3, 1 + Math.random() * 2);
    }
    g.globalAlpha = 1;
    noiseFill(g, S, 0, 18);
    return c;
  };

  /* ---------- 灰瓦（筒瓦排列） ---------- */
  TX.roofTile = function (S) {
    S = S || 512;
    var c = cv(S), g = c.getContext('2d');
    g.fillStyle = '#2b3136'; g.fillRect(0, 0, S, S);
    var cols = 16, cw = S / cols;
    for (var i = 0; i < cols; i++) {
      var x = i * cw;
      var grd = g.createLinearGradient(x, 0, x + cw, 0);
      grd.addColorStop(0, '#20262b');
      grd.addColorStop(0.32, '#4a545c');
      grd.addColorStop(0.55, '#39424a');
      grd.addColorStop(1, '#1b2126');
      g.fillStyle = grd;
      g.fillRect(x, 0, cw, S);
      // 瓦楞分隔
      g.fillStyle = 'rgba(10,12,14,0.55)';
      g.fillRect(x + cw - 1.5, 0, 1.5, S);
    }
    // 横向瓦缝
    for (var y = 0; y < S; y += S / 10) {
      g.fillStyle = 'rgba(8,10,12,0.35)';
      g.fillRect(0, y, S, 1.6);
      g.fillStyle = 'rgba(150,160,170,0.10)';
      g.fillRect(0, y + 2, S, 1);
    }
    // 苔痕与雨渍
    for (var k = 0; k < 70; k++) {
      g.globalAlpha = 0.10 + Math.random() * 0.16;
      g.fillStyle = Math.random() > 0.4 ? '#5d6b45' : '#8a8f86';
      var w = 10 + Math.random() * 50;
      g.beginPath(); g.ellipse(Math.random() * S, Math.random() * S, w, w * 0.35, 0, 0, 7); g.fill();
    }
    g.globalAlpha = 1;
    noiseFill(g, S, 0, 12);
    return c;
  };

  /* ---------- 白墙（粉墙黛瓦的白） ---------- */
  TX.plaster = function (S) {
    S = S || 512;
    var c = cv(S), g = c.getContext('2d');
    g.fillStyle = '#d9d3c4'; g.fillRect(0, 0, S, S);
    for (var i = 0; i < 120; i++) {
      g.globalAlpha = 0.05 + Math.random() * 0.12;
      g.fillStyle = Math.random() > 0.5 ? '#a9a390' : '#eee9dc';
      var w = 20 + Math.random() * 140;
      g.beginPath(); g.ellipse(Math.random() * S, Math.random() * S, w, w * (0.3 + Math.random() * 0.5), Math.random() * 3, 0, 7); g.fill();
    }
    // 底部水渍（江南墙根发黑）
    var grd = g.createLinearGradient(0, S, 0, S * 0.62);
    grd.addColorStop(0, 'rgba(70,72,64,0.55)');
    grd.addColorStop(1, 'rgba(70,72,64,0)');
    g.globalAlpha = 1; g.fillStyle = grd; g.fillRect(0, S * 0.62, S, S * 0.38);
    noiseFill(g, S, 0, 14);
    return c;
  };

  /* ---------- 木纹 ---------- */
  TX.wood = function (S, dark) {
    S = S || 256;
    var c = cv(S), g = c.getContext('2d');
    g.fillStyle = dark ? '#3a2318' : '#6b4a30'; g.fillRect(0, 0, S, S);
    for (var i = 0; i < 160; i++) {
      var x = Math.random() * S;
      g.strokeStyle = 'rgba(' + (30 + Math.random() * 40 | 0) + ',' + (18 + Math.random() * 24 | 0) + ',' + (10 + Math.random() * 16 | 0) + ',' + (0.12 + Math.random() * 0.25) + ')';
      g.lineWidth = 0.6 + Math.random() * 2.2;
      g.beginPath();
      g.moveTo(x, 0);
      for (var y = 0; y <= S; y += 16) g.lineTo(x + Math.sin(y * 0.02 + i) * 3, y);
      g.stroke();
    }
    noiseFill(g, S, 0, 10);
    return c;
  };

  /* ---------- 石材 / 岩壁 ---------- */
  TX.rock = function (S) {
    S = S || 512;
    var c = cv(S), g = c.getContext('2d');
    g.fillStyle = '#7c7a72'; g.fillRect(0, 0, S, S);
    // 层理
    for (var i = 0; i < 26; i++) {
      var y = Math.random() * S, h = 3 + Math.random() * 26;
      g.fillStyle = 'rgba(' + (60 + Math.random() * 70 | 0) + ',' + (58 + Math.random() * 66 | 0) + ',' + (52 + Math.random() * 60 | 0) + ',0.45)';
      g.beginPath();
      g.moveTo(0, y);
      for (var x = 0; x <= S; x += 32) g.lineTo(x, y + Math.sin(x * 0.01 + i) * 8);
      for (var x2 = S; x2 >= 0; x2 -= 32) g.lineTo(x2, y + h + Math.sin(x2 * 0.014 + i) * 8);
      g.closePath(); g.fill();
    }
    // 裂纹
    for (var k = 0; k < 40; k++) {
      g.strokeStyle = 'rgba(40,40,38,0.5)'; g.lineWidth = 0.8 + Math.random();
      g.beginPath();
      var x3 = Math.random() * S, y3 = Math.random() * S;
      g.moveTo(x3, y3);
      for (var s = 0; s < 6; s++) { x3 += (Math.random() - 0.5) * 60; y3 += Math.random() * 40; g.lineTo(x3, y3); }
      g.stroke();
    }
    noiseFill(g, S, 0, 22);
    return c;
  };

  /* ---------- 地表细节（中性灰，颜色由顶点色决定） ---------- */
  TX.grass = function (S) {
    S = S || 512;
    var c = cv(S), g = c.getContext('2d');
    g.fillStyle = '#9a9a92'; g.fillRect(0, 0, S, S);
    // 细碎颗粒
    for (var i = 0; i < 9000; i++) {
      var v = 120 + Math.random() * 90 | 0;
      g.fillStyle = 'rgba(' + v + ',' + v + ',' + (v - 6) + ',' + (0.25 + Math.random() * 0.4) + ')';
      g.fillRect(Math.random() * S, Math.random() * S, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
    // 大块斑驳（泥土/苔痕）
    for (var k = 0; k < 90; k++) {
      g.globalAlpha = 0.10 + Math.random() * 0.12;
      g.fillStyle = Math.random() > 0.5 ? '#7d7a6c' : '#b3b0a2';
      g.beginPath(); g.ellipse(Math.random() * S, Math.random() * S, 16 + Math.random() * 90, 12 + Math.random() * 60, Math.random() * 3, 0, 7); g.fill();
    }
    // 碎草丝
    for (var j = 0; j < 2200; j++) {
      g.globalAlpha = 0.5;
      g.strokeStyle = 'rgba(150,150,140,0.5)';
      g.lineWidth = 1;
      var x = Math.random() * S, y = Math.random() * S;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 3, y - 3 - Math.random() * 5); g.stroke();
    }
    g.globalAlpha = 1;
    return c;
  };

  /* ---------- 竹林叶面（给竹叶 sprite 用） ---------- */
  TX.bambooLeaf = function () {
    var S = 128, c = cv(S), g = c.getContext('2d');
    g.clearRect(0, 0, S, S);
    for (var i = 0; i < 26; i++) {
      var x = S * (0.15 + Math.random() * 0.7), y = S * (0.1 + Math.random() * 0.8);
      var len = S * (0.18 + Math.random() * 0.22);
      var ang = Math.random() * Math.PI * 2;
      g.save(); g.translate(x, y); g.rotate(ang);
      var v = 40 + Math.random() * 50;
      g.fillStyle = 'rgba(' + (34 + v * 0.4 | 0) + ',' + (86 + v | 0) + ',' + (40 + v * 0.3 | 0) + ',0.95)';
      g.beginPath(); g.ellipse(0, 0, len, len * 0.16, 0, 0, 7); g.fill();
      g.restore();
    }
    return c;
  };

  /* ---------- 云 ---------- */
  TX.cloud = function (S, oct, sharp) {
    S = S || 256; oct = oct || 5; sharp = sharp === undefined ? 1.2 : sharp;
    var c = cv(S), g = c.getContext('2d');
    var img = g.createImageData(S, S), d = img.data;
    function hash(x, y) { var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); }
    function vn(x, y) {
      var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
      var ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
      return (hash(ix, iy) * (1 - ux) + hash(ix + 1, iy) * ux) * (1 - uy) +
        (hash(ix, iy + 1) * (1 - ux) + hash(ix + 1, iy + 1) * ux) * uy;
    }
    function fbm(x, y, o) { var v = 0, a = 0.5, f = 1; for (var i = 0; i < o; i++) { v += a * vn(x * f, y * f); f *= 2.03; a *= 0.5; } return v; }
    for (var y = 0; y < S; y++) {
      for (var x = 0; x < S; x++) {
        var n = fbm(x / S * 5, y / S * 5, oct);
        var a = Math.pow(Math.min(1, Math.max(0, (n - 0.40) * 2.7)), sharp);
        var dx = (x / S - 0.5) * 2, dy = (y / S - 0.5) * 2;
        a *= Math.pow(Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy)), 1.5);
        var k = (y * S + x) * 4;
        d[k] = 255; d[k + 1] = 255; d[k + 2] = 255; d[k + 3] = Math.min(255, a * 255);
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  };

  /* ---------- 竖挂招牌 / 酒旗 ---------- */
  TX.sign = function (text, bg, fg, vertical) {
    var w = vertical ? 96 : 256, h = vertical ? 96 * 3 : 96;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d');
    g.fillStyle = bg || '#a8332a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(240,228,200,0.75)'; g.lineWidth = 4; g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = fg || '#f7edd6';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold ' + Math.round(w * 0.55) + 'px "STKaiti","KaiTi",serif';
    if (vertical) {
      for (var i = 0; i < text.length; i++) g.fillText(text[i], w / 2, h * (0.5 + (i - (text.length - 1) / 2) * 0.31));
    } else {
      g.fillText(text, w / 2, h / 2 + 2);
    }
    return c;
  };

  /* ---------- 木牌匾 ---------- */
  TX.plaque = function (text) {
    var w = 512, h = 160;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d');
    g.fillStyle = '#241a12'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#8a6a3a'; g.lineWidth = 8; g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = '#e8cf9a';
    g.font = 'bold ' + Math.round(h * 0.52) + 'px "STKaiti","KaiTi",serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 4);
    return c;
  };

  /* ---------- 一次性构建常用贴图 ---------- */
  TX.init = function (renderer) {
    TX.tStone = tex(TX.stonePath(512), 1);
    TX.tRoof = tex(TX.roofTile(512), 1);
    TX.tPlaster = tex(TX.plaster(512), 1);
    TX.tWood = tex(TX.wood(256, false), 1);
    TX.tWoodDark = tex(TX.wood(256, true), 1);
    TX.tRock = tex(TX.rock(512), 1);
    TX.tGrass = tex(TX.grass(512), 1);
    TX.tCloud = tex(TX.cloud(256, 6), 1);
    TX.tCloud2 = tex(TX.cloud(256, 5, 0.9), 1);
    TX.tLeaf = tex(TX.bambooLeaf(), 1);
    var an = renderer ? renderer.capabilities.getMaxAnisotropy() : 4;
    [TX.tStone, TX.tRoof, TX.tPlaster, TX.tWood, TX.tRock, TX.tGrass].forEach(function (t) { t.anisotropy = Math.min(an, 8); });
  };
})();
