/* ============================================================
   town.js — 青溪镇：街市、客栈茶馆、石桥、竹林
   ============================================================ */
window.WL = window.WL || {};
(function () {
  var J = WL, A = J.A, T = J.T, TX = J.TX;
  var W = J.W = { colliders: [], npcSpots: [], foeSpots: [], markers: [], bridges: [] };

  W.addCollider = function (cx, cz, hw, hd, tag) {
    W.colliders.push({ x: cx, z: cz, hw: hw, hd: hd, tag: tag || '' });
  };

  /* 沿中心线生成一条路面 ribbon */
  function ribbon(scene, centerFn, halfW, mat, yOff, z0, z1, step) {
    step = step || 3;
    var pos = [], uv = [], idx = [];
    var n = Math.max(2, Math.round((z1 - z0) / step));
    for (var i = 0; i <= n; i++) {
      var z = z0 + (z1 - z0) * i / n;
      var cx = centerFn(z);
      var y = T.heightAt(cx, z) + (yOff === undefined ? 0.02 : yOff);
      pos.push(cx - halfW, y, z, cx + halfW, y, z);
      uv.push(0, z / 2.2, 1, z / 2.2);
      if (i < n) { var a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    var m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    scene.add(m);

    // 两侧石牙子（遮住路面与草地的接缝）
    [-1, 1].forEach(function (sd) {
      var cp = [], cuv = [], cidx = [];
      for (var k = 0; k <= n; k++) {
        var zz = z0 + (z1 - z0) * k / n;
        var cxx = centerFn(zz);
        var yy = T.heightAt(cxx, zz) + (yOff === undefined ? 0.02 : yOff);
        var ex = cxx + sd * halfW;
        cp.push(ex, yy + 0.03, zz, ex, yy - 0.55, zz);
        cuv.push(zz / 1.6, 0, zz / 1.6, 0.35);
        if (k < n) { var b = k * 2; cidx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
      }
      var cg = new THREE.BufferGeometry();
      cg.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3));
      cg.setAttribute('uv', new THREE.Float32BufferAttribute(cuv, 2));
      cg.setIndex(cidx);
      cg.computeVertexNormals();
      var cm = new THREE.Mesh(cg, mat);
      cm.material.side = THREE.DoubleSide;
      cm.receiveShadow = true;
      scene.add(cm);
    });
    return m;
  }

  /* 找到朝向街道的一侧地面高度（取四点最低） */
  function groundY(x, z, w, d, rot) {
    var c = Math.cos(rot), s = Math.sin(rot);
    var hw = w / 2, hd = d / 2;
    var pts = [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]];
    var mn = 1e9;
    for (var i = 0; i < pts.length; i++) {
      var px = x + pts[i][0] * c - pts[i][1] * s;
      var pz = z + pts[i][0] * s + pts[i][1] * c;
      mn = Math.min(mn, T.heightAt(px, pz));
    }
    return mn;
  }

  function place(scene, build, x, z, rot, tag, enterable) {
    var w = build.w || 9, d = build.d || 8;
    var y = groundY(x, z, w, d, rot);
    build.group.position.set(x, y, z);
    build.group.rotation.y = rot;
    scene.add(build.group);
    // 碰撞：旋转后交换宽深
    var swapped = Math.abs(Math.sin(rot)) > 0.5;
    for (var i = 0; i < build.colliders.length; i++) {
      var c = build.colliders[i];
      var cx = x + c.x * Math.cos(rot) + c.z * Math.sin(rot);
      var cz = z - c.x * Math.sin(rot) + c.z * Math.cos(rot);
      var hw = swapped ? c.hd : c.hw, hd = swapped ? c.hw : c.hd;
      W.addCollider(cx, cz, hw, hd, tag || 'b');
    }
    return { y: y, enterable: !!enterable };
  }

  /* ============ 主建设 ============ */
  W.build = function (scene) {
    A.mats();
    var streetMat = J.texMat(TX.tStone, 0xffffff, 0.92, 0.02, 2.0);
    var y0 = 0;

    /* ---- 主街：西岸 ---- */
    var westX = function (z) { return T.riverX(z) - 19; };
    ribbon(scene, westX, 9.0, streetMat, 0.05, -132, 150, 2.5);
    /* ---- 主街：东岸 ---- */
    var eastX = function (z) { return T.riverX(z) + 19; };
    ribbon(scene, eastX, 8.5, streetMat, 0.05, -110, 140, 2.5);

    /* ---- 建筑前铺地（与街面同高，消除草地接缝） ---- */
    ribbon(scene, function (z) { return T.riverX(z) - 34; }, 7.5, streetMat, 0.05, -132, 150, 2.5);
    ribbon(scene, function (z) { return T.riverX(z) + 34; }, 7.0, streetMat, 0.05, -110, 140, 2.5);

    /* ---- 河岸步道 ---- */
    ribbon(scene, function (z) { return T.riverX(z) - 12.6; }, 1.5, streetMat, 0.04, -120, 140, 3);
    ribbon(scene, function (z) { return T.riverX(z) + 12.6; }, 1.5, streetMat, 0.04, -120, 140, 3);

    /* ---- 横巷 ---- */
    [-96, -48, 4, 52, 100].forEach(function (z) {
      ribbon(scene, function (zz) { return westX(zz); }, 2.0,
        streetMat, 0.05, z - 1.2, z + 1.2, 1.2);
      // 用横向 ribbon 撑开：直接铺一块矩形
      var g = new THREE.Mesh(new THREE.PlaneGeometry(30, 3.4), streetMat);
      g.rotation.x = -Math.PI / 2;
      g.position.set(westX(z) - 12, T.heightAt(westX(z) - 12, z) + 0.05, z);
      g.receiveShadow = true;
      scene.add(g);
    });

    /* ---- 西岸建筑：面朝东（+X），rot = +90°，即 PI/2 ---- */
    var rowW = [
      { z: 132, w: 10, d: 8, f: 1, style: 'house', label: '酒' },
      { z: 118, w: 12, d: 9, f: 2, style: 'house', label: '米行' },
      { z: 100, w: 9, d: 8, f: 2, style: 'house' },
      { z: 84, w: 13, d: 9, f: 1, style: 'shop', open: true, label: '布庄' },
      { z: 66, w: 10, d: 8, f: 2, style: 'house', plaque: '听雨轩' },
      { z: 46, w: 14, d: 10, f: 2, style: 'shop', open: true, label: '茶', plaque: '青溪茶寮', lanterns: 3 },
      { z: 24, w: 10, d: 8, f: 2, style: 'house' },
      { z: 4, w: 12, d: 9, f: 1, style: 'shop', open: true, label: '肉铺' },
      { z: -18, w: 11, d: 8, f: 2, style: 'house' },
      { z: -40, w: 15, d: 11, f: 2, style: 'shop', open: true, label: '客栈', plaque: '青溪客栈', lanterns: 3 },
      { z: -64, w: 10, d: 8, f: 1, style: 'house' },
      { z: -84, w: 12, d: 9, f: 1, style: 'shop', open: true, label: '铁', plaque: '铁匠铺' },
      { z: -108, w: 10, d: 8, f: 2, style: 'house' }
    ];
    rowW.forEach(function (b) {
      var x = T.riverX(b.z) - 34;
      var cfg = { w: b.w, d: b.d, h: 3.5, floors: b.f, style: b.style, open: !!b.open, label: b.label, plaque: b.plaque, lanterns: b.lanterns === undefined ? (b.open ? 2 : 1) : b.lanterns, redRoof: !!b.redRoof };
      var res = A.building(cfg);
      place(scene, res, x, b.z, Math.PI / 2, 'shop', b.open);
      W.markers.push({ x: x + 2, z: b.z, label: b.plaque || b.label || '' });
    });

    /* ---- 东岸建筑：面朝西（-X），rot = -90° ---- */
    var rowE = [
      { z: 120, w: 10, d: 8, f: 2, style: 'house' },
      { z: 100, w: 12, d: 9, f: 1, style: 'shop', open: true, label: '药' },
      { z: 78, w: 10, d: 8, f: 2, style: 'house', plaque: '清风居' },
      { z: 58, w: 13, d: 9, f: 2, style: 'house' },
      { z: 36, w: 11, d: 8, f: 1, style: 'shop', open: true, label: '面' },
      { z: 14, w: 12, d: 9, f: 2, style: 'house' },
      { z: -8, w: 10, d: 8, f: 2, style: 'house', label: '当' },
      { z: -32, w: 14, d: 10, f: 1, style: 'shop', open: true, label: '茶', plaque: '临水茶轩', lanterns: 3 },
      { z: -58, w: 10, d: 8, f: 2, style: 'house' },
      { z: -84, w: 12, d: 9, f: 2, style: 'house' }
    ];
    rowE.forEach(function (b) {
      var x = T.riverX(b.z) + 34;
      var cfg = { w: b.w, d: b.d, h: 3.5, floors: b.f, style: b.style, open: !!b.open, label: b.label, plaque: b.plaque, lanterns: b.open ? 2 : 1 };
      var res = A.building(cfg);
      place(scene, res, x, b.z, -Math.PI / 2, 'shop', b.open);
      W.markers.push({ x: x - 2, z: b.z, label: b.plaque || b.label || '' });
    });

    /* ---- 石拱桥两座 ---- */
    [12, -92].forEach(function (z) {
      var bx = T.riverX(z);
      var br = A.bridge({ len: 34, w: 4.4, rise: 2.6 });
      var by = Math.max(T.heightAt(bx - 15, z), T.heightAt(bx + 15, z)) - 0.5;
      br.group.position.set(bx, by, z);
      br.group.rotation.y = Math.PI / 2;
      scene.add(br.group);
      W.bridges.push({ x: bx, z: z, y: by, len: 34, w: 4.4, rise: 2.6, axis: 'x' });
    });

    /* ---- 牌坊 ---- */
    var gz = 138;
    var gate = A.gate({ w: 9, h: 5.6, text: '青溪镇' });
    var gx = T.riverX(gz) - 27;
    gate.group.position.set(gx, T.heightAt(gx, gz), gz);
    scene.add(gate.group);
    gate.colliders.forEach(function (c) { W.addCollider(gx + c.x, gz + c.z, c.hw, c.hd, 'gate'); });

    /* ---- 街边道具 ---- */
    var props = new THREE.Group();
    for (var i = 0; i < 26; i++) {
      var z = J.rand(-120, 140);
      var side = i % 2 ? 1 : -1;
      var x = T.riverX(z) + side * (27 + J.rand(-4, 5));
      if (Math.abs(x - (T.riverX(z) - 42)) < 8 || Math.abs(x - (T.riverX(z) + 42)) < 8) continue;
      var y = T.heightAt(x, z);
      var kind = i % 5;
      var p;
      if (kind === 0) p = A.jar(J.rand(0.26, 0.36));
      else if (kind === 1) p = A.crate(J.rand(0.45, 0.7));
      else if (kind === 2) p = A.stoneLamp();
      else if (kind === 3) p = A.cart();
      else p = A.bench(1.6);
      p.position.set(x, y, z);
      p.rotation.y = J.rand(0, 6.28);
      props.add(p);
      if (kind === 1 || kind === 3) W.addCollider(x, z, 0.8, 0.8, 'prop');
    }
    scene.add(props);

    /* ---- NPC 站位 ---- */
    W.npcSpots = [
      { x: T.riverX(-40) - 34, z: -40, name: '掌柜', role: 'innkeeper' },
      { x: T.riverX(46) - 34, z: 46, name: '茶博士', role: 'tea' },
      { x: T.riverX(-84) - 34, z: -84, name: '铁匠', role: 'smith' },
      { x: T.riverX(20) - 24, z: 20, name: '村民', role: 'villager' },
      { x: T.riverX(70) + 24, z: 70, name: '村民', role: 'villager' },
      { x: T.riverX(-20) + 26, z: -20, name: '卖药人', role: 'vendor' }
    ];
    W.foeSpots = [
      { x: T.riverX(96) - 22, z: 96, type: 'blade' },
      { x: T.riverX(88) - 18, z: 88, type: 'guard' },
      { x: T.riverX(-64) + 22, z: -64, type: 'blade' },
      { x: T.riverX(-70) + 26, z: -70, type: 'assassin' },
      { x: T.riverX(-120) + 20, z: -120, type: 'blade' }
    ];
    return W;
  };

  /* ============ 植被 ============ */
  W.vegetation = function (scene) {
    var bambooGeo = new THREE.CylinderGeometry(0.09, 0.12, 7.5, 5, 1, true);
    bambooGeo.translate(0, 3.75, 0);
    var bambooMat = new THREE.MeshStandardMaterial({ color: 0x6d8a3e, roughness: 0.8, metalness: 0 });
    var leafMat = new THREE.MeshStandardMaterial({ map: TX.tLeaf, transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 0.9, color: 0x9fbf7a });
    var pineGeo = new THREE.ConeGeometry(1.5, 4.4, 7, 1);
    pineGeo.translate(0, 4.0, 0);
    var pineMat = new THREE.MeshStandardMaterial({ color: 0x2f4a2c, roughness: 1, flatShading: true });
    var trunkGeo = new THREE.CylinderGeometry(0.16, 0.3, 3.4, 5);
    trunkGeo.translate(0, 1.7, 0);
    var trunkMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1e, roughness: 1 });

    var bambooPos = [], pinePos = [], trunkPos = [], leafPos = [];
    var tries = 0;
    while ((bambooPos.length < 900 || pinePos.length < 420) && tries < 12000) {
      tries++;
      var x = J.rand(-260, 260), z = J.rand(-260, 260);
      var h = T.heightAt(x, z);
      var d = Math.abs(x - T.riverX(z));
      if (d < 62) continue;                 // 镇内不种
      var sl = T.slopeAt(x, z);
      if (sl > 1.5) continue;
      if (h < 0.4) continue;
      var dens = T.fbm(x * 0.02, z * 0.02, 3);
      var isBamboo = dens > 0.5;
      if (isBamboo && bambooPos.length < 900) bambooPos.push([x, h, z, J.rand(0.7, 1.15)]);
      else if (!isBamboo && pinePos.length < 420) pinePos.push([x, h, z, J.rand(0.7, 1.15)]);
    }
    function inst(geo, mat, arr, withTrunk) {
      var im = new THREE.InstancedMesh(geo, mat, arr.length);
      var m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
      for (var i = 0; i < arr.length; i++) {
        var a = arr[i];
        p.set(a[0], a[1] - 0.2, a[2]);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), J.rand(0, 6.28));
        s.set(a[3], a[3] * J.rand(0.9, 1.2), a[3]);
        m4.compose(p, q, s);
        im.setMatrixAt(i, m4);
      }
      im.castShadow = true;
      im.receiveShadow = true;
      scene.add(im);
      return im;
    }
    inst(bambooGeo, bambooMat, bambooPos);
    inst(pineGeo, pineMat, pinePos);
    inst(trunkGeo, trunkMat, bambooPos.concat(pinePos.slice(0, 0)));

    // 竹叶丛
    var leafGeo = new THREE.PlaneGeometry(2.6, 2.6);
    var lm = new THREE.InstancedMesh(leafGeo, leafMat, bambooPos.length * 2);
    var m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    var k = 0;
    for (var i2 = 0; i2 < bambooPos.length; i2++) {
      for (var t = 0; t < 2; t++) {
        var a2 = bambooPos[i2];
        p.set(a2[0], a2[1] + 4.6 + t * 1.9, a2[2]);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), J.rand(0, 6.28));
        s.set(a2[3] * J.rand(0.8, 1.2), a2[3] * J.rand(0.8, 1.2), 1);
        m4.compose(p, q, s);
        lm.setMatrixAt(k++, m4);
      }
    }
    scene.add(lm);

    // 灌木球
    var bushGeo = new THREE.IcosahedronGeometry(1.0, 1);
    var bushMat = new THREE.MeshStandardMaterial({ color: 0x466132, roughness: 1, flatShading: true });
    var bushArr = [];
    for (var b = 0; b < 260; b++) {
      var bx = J.rand(-240, 240), bz = J.rand(-240, 240);
      if (Math.abs(bx - T.riverX(bz)) < 60) continue;
      var bh = T.heightAt(bx, bz);
      if (bh < 0.5 || T.slopeAt(bx, bz) > 1.2) continue;
      bushArr.push([bx, bh, bz, J.rand(0.7, 1.9)]);
    }
    inst(bushGeo, bushMat, bushArr);
    W.vegetationCount = bambooPos.length + pinePos.length + bushArr.length;
  };
})();

/* ============ 石驳岸：沿河砌石护岸 ============ */
(function () {
  var J = WL, A = J.A, T = J.T;
  J.W.embankment = function (scene) {
    A.mats();
    var mat = J.texMat(J.TX.tStone, 0xd8d4c8, 0.95, 0.0, 1.6);
    var N = 130, z0 = -128, z1 = 148;
    for (var side = -1; side <= 1; side += 2) {
      var pos = [], uv = [], idx = [], k = 0;
      for (var i = 0; i <= N; i++) {
        var z = z0 + (z1 - z0) * i / N;
        var rx = T.riverX(z);
        var wx = rx + side * 11.4;         // 临水面
        var top = T.heightAt(rx + side * 12.5, z);
        var bot = T.WATER_Y - 0.9;
        pos.push(wx, bot, z, wx, top, z);
        uv.push(z / 1.8, 0, z / 1.8, (top - bot) / 1.8);
        if (i < N) { var a = k; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); k += 2; }
      }
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      var mat2 = mat.clone();
      mat2.side = THREE.DoubleSide;
      var m = new THREE.Mesh(g, mat2);
      m.receiveShadow = true;
      scene.add(m);
      // 压顶石
      var capPos = [], capIdx = [], ck = 0;
      for (var j = 0; j <= N; j++) {
        var z2 = z0 + (z1 - z0) * j / N;
        var rx2 = T.riverX(z2);
        var wx2 = rx2 + side * 11.4;
        var tx = rx2 + side * 12.9;
        var ty = T.heightAt(tx, z2) + 0.12;
        capPos.push(wx2, ty, z2, tx, ty, z2);
        if (j < N) { var b = ck; capIdx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); ck += 2; }
      }
      var cg = new THREE.BufferGeometry();
      cg.setAttribute('position', new THREE.Float32BufferAttribute(capPos, 3));
      cg.setIndex(capIdx);
      cg.computeVertexNormals();
      var cm = new THREE.Mesh(cg, mat2);
      cm.receiveShadow = true;
      scene.add(cm);
    }
  };
})();
