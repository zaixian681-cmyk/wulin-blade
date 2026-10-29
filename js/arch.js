/* ============================================================
   arch.js — 中式建筑构件库（灰瓦木楼 / 牌坊 / 石桥 / 灯笼酒旗）
   ============================================================ */
window.WL = window.WL || {};
(function () {
  var J = WL, TX = WL.TX;
  var A = J.A = {};
  var M = {};

  /* ---------------- 材质 ---------------- */
  A.mats = function () {
    if (M.roof) return M;
    M.roof = J.texMat(TX.tRoof, 0xffffff, 0.72, 0.08, 1.6);
    M.roofRed = J.texMat(TX.tRoof, 0xb59a92, 0.78, 0.05, 1.6);
    M.wall = J.texMat(TX.tPlaster, 0xffffff, 0.95, 0.0, 2.4);
    M.wallDark = J.texMat(TX.tPlaster, 0xb9b3a2, 0.95, 0.0, 2.4);
    M.wood = J.texMat(TX.tWood, 0xffffff, 0.86, 0.0, 1.5);
    M.woodDark = J.texMat(TX.tWoodDark, 0xffffff, 0.88, 0.0, 1.5);
    M.stone = J.texMat(TX.tStone, 0xffffff, 0.95, 0.0, 2.2);
    M.rock = J.texMat(TX.tRock, 0xffffff, 0.98, 0.0, 3.0);
    M.metal = new THREE.MeshStandardMaterial({ color: 0x8d939a, roughness: 0.42, metalness: 0.85 });
    M.gold = new THREE.MeshStandardMaterial({ color: 0xb08840, roughness: 0.42, metalness: 0.7 });
    M.lamp = new THREE.MeshStandardMaterial({ color: 0xd8442e, roughness: 0.7, emissive: 0xff5a28, emissiveIntensity: 0.85 });
    M.lampWarm = new THREE.MeshBasicMaterial({ color: 0xffcf8a });
    M.win = latticeMat();
    return M;
  };

  function latticeMat() {
    var S = 128, c = document.createElement('canvas');
    c.width = c.height = S;
    var g = c.getContext('2d');
    g.fillStyle = '#241a12'; g.fillRect(0, 0, S, S);
    // 窗纸
    g.fillStyle = '#cbbd9e'; g.fillRect(8, 8, S - 16, S - 16);
    g.fillStyle = 'rgba(120,104,78,0.25)';
    for (var i = 0; i < 40; i++) g.fillRect(8, 8 + Math.random() * (S - 16), S - 16, 1 + Math.random() * 2);
    // 棂条
    g.strokeStyle = '#3a2718'; g.lineWidth = 5;
    for (var k = 0; k <= 4; k++) {
      var p = 8 + k * (S - 16) / 4;
      g.beginPath(); g.moveTo(p, 8); g.lineTo(p, S - 8); g.stroke();
      g.beginPath(); g.moveTo(8, p); g.lineTo(S - 8, p); g.stroke();
    }
    g.strokeStyle = '#2b1c11'; g.lineWidth = 9; g.strokeRect(4, 4, S - 8, S - 8);
    var t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.8, metalness: 0 });
  }

  /* ---------------- 屋顶几何（带瓦面 UV） ---------------- */
  var roofCache = {};
  A.roofGeo = function (w, d, h, over) {
    var key = [w.toFixed(2), d.toFixed(2), h.toFixed(2), over.toFixed(2)].join('_');
    if (roofCache[key]) return roofCache[key];
    var wH = w / 2, dH = d / 2;
    var pos = [], uvs = [], idx = [];
    var ROWS = 6, COLS = 8;
    function slope(side) {
      var base = pos.length / 3;
      var span = (side < 2 ? wH : dH) + over;
      for (var r = 0; r <= ROWS; r++) {
        var t = r / ROWS;
        for (var c = 0; c <= COLS; c++) {
          var u = -1 + 2 * c / COLS;
          var x, z, y;
          var rise = h * Math.pow(t, 0.72);
          // 檐角起翘：越靠角、越靠檐，翘得越高
          var up = Math.pow(1 - t, 2.6) * u * u * Math.min(wH, dH) * 0.42;
          if (side === 0) { x = u * (wH + over) * (1 - t * 0.16); z = (dH + over) * (1 - t); }
          else if (side === 1) { x = -u * (wH + over) * (1 - t * 0.16); z = -(dH + over) * (1 - t); }
          else if (side === 2) { x = (wH + over) * (1 - t); z = -u * (dH + over) * (1 - t * 0.16); }
          else { x = -(wH + over) * (1 - t); z = u * (dH + over) * (1 - t * 0.16); }
          y = rise + up;
          pos.push(x, y, z);
          uvs.push(u * span * 0.55, t * (side < 2 ? dH + over : wH + over) * 0.55);
        }
      }
      var line = COLS + 1;
      for (var rr = 0; rr < ROWS; rr++) {
        for (var cc = 0; cc < COLS; cc++) {
          var a = base + rr * line + cc, b = a + 1, c2 = a + line, d2 = c2 + 1;
          if (side === 0 || side === 2) idx.push(a, b, c2, b, d2, c2);
          else idx.push(a, c2, b, b, c2, d2);
        }
      }
    }
    slope(0); slope(1); slope(2); slope(3);
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    roofCache[key] = g;
    return g;
  };

  /* ---------------- 通用小件 ---------------- */
  function box(w, h, d, mat) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  A.box = box;

  function cyl(rt, rb, h, mat, seg) {
    var m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 8), mat);
    m.castShadow = true;
    return m;
  }

  /* 灯笼 */
  A.lantern = function (scale) {
    scale = scale || 1;
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.SphereGeometry(0.26 * scale, 10, 8), M.lamp);
    body.scale.y = 1.25;
    g.add(body);
    var capT = cyl(0.09 * scale, 0.1 * scale, 0.06 * scale, M.woodDark, 6); capT.position.y = 0.33 * scale; g.add(capT);
    var capB = capT.clone(); capB.position.y = -0.33 * scale; g.add(capB);
    var str = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 4), M.woodDark);
    str.position.y = 0.6 * scale; g.add(str);
    return g;
  };

  /* 酒旗 / 布幡 */
  A.banner = function (text, w, h, bg, fg) {
    var tex = new THREE.CanvasTexture(TX.sign(text, bg || '#a8332a', fg || '#f7edd6', true));
    tex.colorSpace = THREE.SRGBColorSpace;
    var geo = new THREE.PlaneGeometry(w, h, 6, 8);
    var mat = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.92, metalness: 0 });
    var m = new THREE.Mesh(geo, mat);
    m.userData.wave = true;
    m.userData.dynamic = true;
    return m;
  };

  /* 牌匾 */
  A.plaque = function (text, w) {
    var tex = new THREE.CanvasTexture(TX.plaque(text));
    tex.colorSpace = THREE.SRGBColorSpace;
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, w * 0.3125, 0.08),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, metalness: 0.1 }));
    m.castShadow = true;
    return m;
  };

  /* 木质围栏 */
  A.railing = function (len, h) {
    h = h || 0.72;
    var g = new THREE.Group();
    var top = box(len, 0.08, 0.08, M.wood); top.position.y = h; g.add(top);
    var mid = box(len, 0.05, 0.05, M.wood); mid.position.y = h * 0.55; g.add(mid);
    var n = Math.max(2, Math.round(len / 0.55));
    for (var i = 0; i <= n; i++) {
      var p = box(0.06, h, 0.06, M.woodDark);
      p.position.set(-len / 2 + i * len / n, h / 2, 0);
      g.add(p);
    }
    return g;
  };

  /* ---------------- 主体建筑 ---------------- */
  /* cfg:
     w,d,h          宽 深 层高
     floors         楼层数
     style          'shop' | 'house' | 'hall' | 'temple'
     face           'z+'（正面朝 +Z）等，由调用方旋转
     open           首层是否敞开（可进入）
     sign/label     招牌文字
     plaque         牌匾文字
     roofH          屋顶高
  */
  A.building = function (cfg) {
    A.mats();
    var w = cfg.w || 9, d = cfg.d || 8, h = cfg.h || 3.6;
    var floors = cfg.floors || 1;
    var style = cfg.style || 'house';
    var g = new THREE.Group();
    var colliders = [];
    var H = h * floors;

    /* 石台基 */
    var baseH = cfg.baseH === undefined ? 0.34 : cfg.baseH;
    var base = box(w + 0.9, baseH, d + 0.9, M.stone);
    base.position.y = baseH / 2 - 0.06;
    base.receiveShadow = true;
    g.add(base);
    // 石阶
    if (cfg.steps !== false) {
      var st = box(Math.min(2.6, w * 0.4), 0.17, 0.7, M.stone);
      st.position.set(0, 0.0, d / 2 + 0.75);
      g.add(st);
    }

    /* 主体墙 */
    var wallMat = style === 'temple' || style === 'hall' ? M.wall : M.wall;
    var body = box(w, H, d, wallMat);
    body.position.y = baseH + H / 2;
    g.add(body);

    /* 木构：柱 + 枋 */
    var colR = 0.14;
    var nx = Math.max(1, Math.round(w / 3.0));
    for (var i = 0; i <= nx; i++) {
      var cx = -w / 2 + i * w / nx;
      [d / 2, -d / 2].forEach(function (cz) {
        var c = cyl(colR, colR * 1.12, H, M.woodDark, 6);
        c.position.set(cx, baseH + H / 2, cz + (cz > 0 ? 0.03 : -0.03));
        g.add(c);
      });
    }
    // 每层腰枋 + 楼板线
    for (var f = 1; f <= floors; f++) {
      var beam = box(w + 0.36, 0.22, d + 0.36, M.woodDark);
      beam.position.y = baseH + f * h - 0.11;
      g.add(beam);
    }

    /* 首层立面 */
    var faceZ = d / 2 + 0.02;
    if (cfg.open) {
      // 敞开的铺面：檐下柜台、货架、内部空间
      var counter = box(w * 0.72, 0.95, 0.55, M.woodDark);
      counter.position.set(0, baseH + 0.48, faceZ + 0.3);
      g.add(counter);
      var shelf = box(w * 0.66, 1.5, 0.3, M.wood);
      shelf.position.set(0, baseH + 1.2, -d / 2 + 0.35);
      g.add(shelf);
    } else {
      // 门
      var dw = Math.min(1.9, w * 0.28), dh = Math.min(2.35, h * 0.78);
      var door = box(dw, dh, 0.12, M.woodDark);
      door.position.set(0, baseH + dh / 2, faceZ);
      g.add(door);
      // 门钉/门环
      var ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 6, 12), M.gold);
      ring.position.set(dw * 0.22, baseH + dh * 0.55, faceZ + 0.08);
      g.add(ring);
      // 两侧窗
      var winW = Math.min(2.0, (w - dw) / 2 - 0.8);
      if (winW > 0.7) {
        [-1, 1].forEach(function (sgn) {
          var win = new THREE.Mesh(new THREE.PlaneGeometry(winW, dh * 0.82), M.win);
          win.position.set(sgn * (dw / 2 + winW / 2 + 0.25), baseH + dh * 0.55, faceZ + 0.04);
          g.add(win);
          var frame = box(winW + 0.18, dh * 0.82 + 0.18, 0.1, M.wood);
          frame.position.copy(win.position); frame.position.z -= 0.05;
          g.add(frame);
        });
      }
    }

    /* 上层窗 */
    for (var fl = 1; fl < floors; fl++) {
      var y0 = baseH + fl * h;
      var wn = Math.max(2, Math.round(w / 2.6));
      for (var k = 0; k < wn; k++) {
        var wx = -w / 2 + (k + 0.5) * w / wn;
        var wm = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(1.3, w / wn - 0.5), h * 0.6), M.win);
        wm.position.set(wx, y0 + h * 0.52, faceZ + 0.04);
        g.add(wm);
        var fr = box(Math.min(1.3, w / wn - 0.5) + 0.14, h * 0.6 + 0.14, 0.08, M.wood);
        fr.position.copy(wm.position); fr.position.z -= 0.05;
        g.add(fr);
      }
      // 挑檐腰檐
      var mid = new THREE.Mesh(A.roofGeo(w + 1.5, d + 1.5, h * 0.34, 1.15), cfg.redRoof ? M.roofRed : M.roof);
      mid.position.y = y0 + 0.02;
      mid.castShadow = true;
      g.add(mid);
      // 栏杆（阳台）
      if (cfg.balcony !== false) {
        var rail = A.railing(w * 0.9);
        rail.position.set(0, y0 + 0.06, d / 2 + 0.9);
        g.add(rail);
      }
    }

    /* 主屋顶 */
    var roofH = cfg.roofH || Math.max(1.9, Math.min(w, d) * 0.36);
    var roof = new THREE.Mesh(A.roofGeo(w, d, roofH, 1.15), cfg.redRoof ? M.roofRed : M.roof);
    roof.position.y = baseH + H;
    roof.castShadow = true; roof.receiveShadow = true;
    g.add(roof);

    /* 正脊 + 鸱吻 */
    var ridge = box(w * 0.7, 0.26, 0.34, M.woodDark);
    ridge.position.y = baseH + H + roofH * 0.98;
    g.add(ridge);
    var fin = cyl(0.06, 0.11, 0.55, M.gold, 6);
    fin.position.y = baseH + H + roofH + 0.22;
    g.add(fin);

    /* 斗拱（檐下小方块） */
    var dgN = Math.max(3, Math.round(w / 1.6));
    for (var dgi = 0; dgi < dgN; dgi++) {
      var dx2 = -w / 2 + (dgi + 0.5) * w / dgN;
      var dg = box(0.3, 0.2, 0.42, M.woodDark);
      dg.position.set(dx2, baseH + H - 0.06, d / 2 + 0.12);
      g.add(dg);
    }

    /* 檐下灯笼 */
    if (cfg.lanterns !== false) {
      var ln = cfg.lanterns || 2;
      for (var li = 0; li < ln; li++) {
        var lx = ln === 1 ? 0 : -w * 0.32 + li * (w * 0.64 / (ln - 1));
        var lm = A.lantern(1);
        lm.position.set(lx, baseH + H - 0.75, d / 2 + 0.95);
        g.add(lm);
      }
    }

    /* 招牌 / 牌匾 */
    if (cfg.label) {
      var bh = A.banner(cfg.label, 0.72, 2.1, cfg.labelBg || '#a8332a');
      bh.position.set(w / 2 + 0.95, baseH + H * 0.55, d / 2 + 0.75);
      bh.rotation.y = -0.12;
      g.add(bh);
      var pole = cyl(0.05, 0.05, H * 0.9, M.woodDark, 5);
      pole.position.set(w / 2 + 0.95, baseH + H * 0.5, d / 2 + 0.75);
      g.add(pole);
    }
    if (cfg.plaque) {
      var pq = A.plaque(cfg.plaque, Math.min(2.6, w * 0.42));
      pq.position.set(0, baseH + h * 0.98, faceZ + 0.18);
      g.add(pq);
    }

    /* 碰撞体 */
    colliders.push({ x: 0, z: 0, hw: w / 2 + 0.2, hd: d / 2 + 0.2 });
    return { group: g, colliders: colliders, w: w, d: d, h: H + baseH, baseH: baseH };
  };

  /* ---------------- 牌坊 / 山门 ---------------- */
  A.gate = function (cfg) {
    A.mats();
    var w = cfg.w || 7, h = cfg.h || 5.2;
    var g = new THREE.Group();
    var colliders = [];
    var base = box(w + 1.2, 0.4, 1.6, M.stone);
    base.position.y = 0.2; g.add(base);
    var pw = 0.34;
    [-1, 1].forEach(function (s) {
      var p = box(pw, h, pw, M.woodDark);
      p.position.set(s * w / 2, h / 2 + 0.4, 0);
      g.add(p);
      colliders.push({ x: s * w / 2, z: 0, hw: 0.35, hd: 0.35 });
      var plinth = box(0.7, 0.5, 0.7, M.stone);
      plinth.position.set(s * w / 2, 0.25, 0);
      g.add(plinth);
    });
    // 额枋
    var beam = box(w + 1.0, 0.42, 0.5, M.woodDark);
    beam.position.y = h + 0.5; g.add(beam);
    // 檐
    var roof = new THREE.Mesh(A.roofGeo(w + 1.6, 1.9, 1.25, 0.9), cfg.redRoof ? M.roofRed : M.roof);
    roof.position.y = h + 0.72; roof.castShadow = true; g.add(roof);
    // 匾额
    if (cfg.text) {
      var pq = A.plaque(cfg.text, Math.min(w * 0.62, 3.4));
      pq.position.set(0, h + 0.5, 0.32);
      g.add(pq);
    }
    return { group: g, colliders: colliders, w: w };
  };

  /* ---------------- 石拱桥 ---------------- */
  A.bridge = function (cfg) {
    A.mats();
    var len = cfg.len || 18, w = cfg.w || 4.2, rise = cfg.rise || 2.2;
    var g = new THREE.Group();
    var SEG = 14;
    var pos = [], uv = [], idx = [];
    for (var i = 0; i <= SEG; i++) {
      var t = i / SEG, x = -len / 2 + len * t;
      var y = Math.sin(t * Math.PI) * rise;
      pos.push(x, y, -w / 2, x, y, w / 2);
      uv.push(t * len / 2, 0, t * len / 2, w / 2);
      if (i < SEG) { var a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    var gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    gg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    gg.setIndex(idx);
    gg.computeVertexNormals();
    var deck = new THREE.Mesh(gg, M.stone);
    deck.rotation.x = Math.PI;      // 翻转使法线朝上
    deck.castShadow = true; deck.receiveShadow = true;
    var deckWrap = new THREE.Group();
    deckWrap.add(deck);
    g.add(deckWrap);
    // 桥面厚度
    var deck2 = deck.clone();
    deck2.position.y = -0.5;
    g.add(deck2);
    // 栏杆
    [-1, 1].forEach(function (s) {
      for (var k = 0; k <= 8; k++) {
        var t2 = k / 8, x2 = -len / 2 + len * t2;
        var y2 = Math.sin(t2 * Math.PI) * rise;
        var post = box(0.16, 0.85, 0.16, M.stone);
        post.position.set(x2, y2 + 0.42, s * (w / 2 - 0.1));
        g.add(post);
      }
      // 扶手
      for (var k2 = 0; k2 < 8; k2++) {
        var ta = k2 / 8, tb = (k2 + 1) / 8;
        var xa = -len / 2 + len * ta, xb = -len / 2 + len * tb;
        var ya = Math.sin(ta * Math.PI) * rise + 0.85, yb = Math.sin(tb * Math.PI) * rise + 0.85;
        var seg = box(Math.hypot(xb - xa, yb - ya) + 0.02, 0.12, 0.22, M.stone);
        seg.position.set((xa + xb) / 2, (ya + yb) / 2, s * (w / 2 - 0.1));
        seg.rotation.z = Math.atan2(yb - ya, xb - xa);
        g.add(seg);
      }
    });
    return { group: g, halfLen: len / 2, width: w, rise: rise };
  };

  /* ---------------- 石阶（沿地形铺设） ---------------- */
  A.stairs = function (x, z0, z1, width, steps) {
    var g = new THREE.Group();
    for (var i = 0; i < steps; i++) {
      var t = i / steps;
      var z = WL.lerp(z0, z1, t);
      var y = WL.T.heightAt(x, z);
      var s = box(width, 0.22, Math.abs(z1 - z0) / steps + 0.06, M.stone);
      s.position.set(x, y + 0.05, z);
      s.receiveShadow = true;
      g.add(s);
    }
    return g;
  };

  /* ---------------- 杂项道具 ---------------- */
  A.jar = function (r) {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.SphereGeometry(r || 0.32, 10, 8), M.woodDark);
    body.scale.y = 1.15;
    body.position.y = r ? r : 0.32;
    g.add(body);
    var neck = cyl((r || 0.32) * 0.45, (r || 0.32) * 0.55, 0.14, M.woodDark, 8);
    neck.position.y = (r || 0.32) * 1.95;
    g.add(neck);
    return g;
  };
  A.crate = function (s) {
    s = s || 0.6;
    var m = box(s, s * 0.85, s, M.wood);
    m.position.y = s * 0.42;
    var grp = new THREE.Group(); grp.add(m);
    return grp;
  };
  A.bench = function (len) {
    var g = new THREE.Group();
    var top = box(len || 1.6, 0.1, 0.42, M.wood);
    top.position.y = 0.45; g.add(top);
    [-1, 1].forEach(function (s) {
      var leg = box(0.12, 0.45, 0.36, M.woodDark);
      leg.position.set(s * (len || 1.6) * 0.36, 0.22, 0);
      g.add(leg);
    });
    return g;
  };
  A.stoneLamp = function () {
    var g = new THREE.Group();
    var b = cyl(0.16, 0.22, 0.9, M.stone, 6); b.position.y = 0.45; g.add(b);
    var cage = box(0.42, 0.42, 0.42, M.stone); cage.position.y = 1.1; g.add(cage);
    var light = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 5), M.lampWarm);
    light.position.y = 1.1; g.add(light);
    var cap = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.28, 4), M.stone);
    cap.position.y = 1.44; cap.rotation.y = Math.PI / 4; g.add(cap);
    return g;
  };
  A.cart = function () {
    var g = new THREE.Group();
    var body = box(1.5, 0.4, 0.9, M.wood); body.position.y = 0.75; g.add(body);
    var basket = box(1.3, 0.28, 0.7, M.woodDark); basket.position.y = 0.98; g.add(basket);
    [-1, 1].forEach(function (s) {
      var wh = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 10), M.woodDark);
      wh.rotation.z = Math.PI / 2;
      wh.position.set(s * 0.72, 0.42, 0);
      g.add(wh);
    });
    // 伞
    var pole = cyl(0.04, 0.04, 1.5, M.woodDark, 5); pole.position.y = 1.5; g.add(pole);
    var canopy = new THREE.Mesh(new THREE.ConeGeometry(1.25, 0.5, 10, 1, true), new THREE.MeshStandardMaterial({ color: 0xb8564a, roughness: 0.9, side: THREE.DoubleSide }));
    canopy.position.y = 2.2; g.add(canopy);
    return g;
  };
})();
