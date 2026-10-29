/* ============================================================
   stage.js — 横版关卡：一层层景深的水乡长街
   X 横向（关卡方向）  Y 竖直  Z 景深（仅用于画面分层）
   ============================================================ */
window.WL = window.WL || {};
(function () {
  var J = WL, A = J.A, TX = J.TX;
  var S = J.ST = {};

  S.X0 = -95; S.X1 = 95;
  S.Z_WALK = 0;          // 行走平面（角色所在）
  S.CAM_Z = 11.0;          // 摄像机在 +Z 一侧
  S.RIVER_Z = -17;

  /* ---------- 地面高度（含台阶） ---------- */
  S.groundY = function (x) {
    var y = 0;
    // 缓坡
    y += Math.sin(x * 0.05) * 0.18;
    // 三处石阶
    var steps = [[-58, -50, 1.1], [4, 12, -0.9], [56, 64, 1.3]];
    for (var i = 0; i < steps.length; i++) {
      var a = steps[i][0], b = steps[i][1], h = steps[i][2];
      if (x >= b) y += h;
      else if (x > a) {
        var t = (x - a) / (b - a);
        y += h * (Math.floor(t * 6) / 6);
      }
    }
    return y;
  };
  S.steps = [[-58, -50, 1.1], [4, 12, -0.9], [56, 64, 1.3]];

  /* ---------- 材质 ---------- */
  function stoneMat() { return J.texMat(TX.tStone, 0xffffff, 0.92, 0.02, 2.0); }

  /* ---------- 长条面片（沿 X 延伸） ---------- */
  function strip(scene, x0, x1, z0, z1, yFn, mat, uvScale) {
    var N = Math.max(2, Math.round((x1 - x0) / 1.5));
    var pos = [], uv = [], idx = [];
    for (var i = 0; i <= N; i++) {
      var x = x0 + (x1 - x0) * i / N;
      var y = yFn ? yFn(x) : 0;
      pos.push(x, y, z0, x, y, z1);
      uv.push(x / (uvScale || 2), 0, x / (uvScale || 2), (z1 - z0) / (uvScale || 2));
      if (i < N) { var a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    var m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    scene.add(m);
    return m;
  }

  /* ---------- 竖直墙面（沿 X） ---------- */
  function wallStrip(scene, x0, x1, z, yBot, yTop, mat) {
    var N = Math.max(2, Math.round((x1 - x0) / 2));
    var pos = [], uv = [], idx = [];
    for (var i = 0; i <= N; i++) {
      var x = x0 + (x1 - x0) * i / N;
      var yb = typeof yBot === 'function' ? yBot(x) : yBot;
      var yt = typeof yTop === 'function' ? yTop(x) : yTop;
      pos.push(x, yb, z, x, yt, z);
      uv.push(x / 2.2, 0, x / 2.2, (yt - yb) / 2.2);
      if (i < N) { var a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    var m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    m.material.side = THREE.DoubleSide;
    scene.add(m);
    return m;
  }

  /* ---------- 主构建 ---------- */
  S.build = function (scene) {
    A.mats();
    var sm = stoneMat();

    /* 行走街面 */
    strip(scene, S.X0, S.X1, -4.6, 4.6, function (x) { return S.groundY(x); }, sm, 2.2);
    /* 近处下沉的暗色前景（压边，不遮挡角色） */
    var lipMat = J.texMat(TX.tStone, 0x55524b, 0.98, 0, 2.8);
    strip(scene, S.X0 - 40, S.X1 + 40, 4.6, 14, function () { return S.groundY(0) - 1.1; }, lipMat, 2.8);
    wallStrip(scene, S.X0 - 40, S.X1 + 40, 4.6, function () { return S.groundY(0) - 1.1; }, function () { return S.groundY(0) - 0.45; }, lipMat);
    /* 街沿石牙子（靠河侧） */
    wallStrip(scene, S.X0, S.X1, -4.6, function (x) { return S.groundY(x); }, function (x) { return S.groundY(x) - 0.9; }, sm);
    /* 靠建筑侧的低台 */


    /* 河边石栏 */
    buildRail(scene, -3.9, function (x) { return S.groundY(x); });

    /* 河水（远景条带） */
    var water = new THREE.Mesh(new THREE.PlaneGeometry(S.X1 - S.X0 + 60, 20, 1, 1),
      new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        uniforms: { t: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: [
          'uniform float t; varying vec2 vUv;',
          'float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
          'float nz(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);',
          ' return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}',
          'void main(){',
          ' float r = nz(vec2(vUv.x*90.0, vUv.y*10.0 - t*0.9))*0.6 + nz(vec2(vUv.x*180.0, vUv.y*20.0 + t*0.6))*0.4;',
          ' vec3 c = mix(vec3(0.10,0.24,0.26), vec3(0.26,0.42,0.42), vUv.y);',
          ' c += vec3(0.6,0.72,0.75) * pow(r, 3.0) * 0.35;',
          ' gl_FragColor = vec4(c, 0.94);',
          '}'
        ].join('\n')
      }));
    water.rotation.x = -Math.PI / 2;
    water.position.set((S.X0 + S.X1) / 2, -1.35, S.RIVER_Z);
    scene.add(water);
    S.waterMat = water.material;

    /* 对岸驳岸 */
    wallStrip(scene, S.X0 - 20, S.X1 + 20, S.RIVER_Z - 10, -2.6, 0.4, sm);

    /* ---- 建筑：沿街连续排列（面向镜头 +Z） ---- */
    buildStreetRow(scene, -12.5, 0);
    buildFarRow(scene, -34, 1);

    /* ---- 远景：山、塔、雾 ---- */
    buildMountains(scene);

    /* ---- 前景框景（靠近镜头的剪影） ---- */
    buildForeground(scene);

    /* 敌人与 NPC 站位（横版：给定 x 即可） */
    S.foeSpawns = [
      { x: 26, type: 'blade' }, { x: 34, type: 'guard' },
      { x: -18, type: 'blade' }, { x: -28, type: 'assassin' },
      { x: 62, type: 'blade' }, { x: -62, type: 'guard' }
    ];
    S.npcSpawns = [
      { x: -6, name: '掌柜', role: 'innkeeper' },
      { x: 18, name: '茶博士', role: 'tea' },
      { x: -40, name: '铁匠', role: 'smith' }
    ];
    S.spawnX = -78;
  };

  /* ---------- 河边栏杆 ---------- */
  function buildRail(scene, z, yFn) {
    var g = new THREE.Group();
    var mat = A.mats().woodDark;
    var stone = A.mats().stone;
    var n = Math.floor((S.X1 - S.X0) / 2.2);
    for (var i = 0; i <= n; i++) {
      var x = S.X0 + i * 2.2;
      var y = yFn(x);
      var post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 0.14), stone);
      post.position.set(x, y + 0.27, z);
      post.castShadow = true;
      g.add(post);
    }
    // 横扶手
    var N = 48, pos = [], uv = [], idx = [];
    for (var k = 0; k <= N; k++) {
      var x2 = S.X0 + (S.X1 - S.X0) * k / N;
      var y2 = yFn(x2) + 0.58;
      pos.push(x2, y2 - 0.06, z, x2, y2 + 0.06, z);
      uv.push(x2, 0, x2, 1);
      if (k < N) { var a = k * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    var bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    bg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    bg.setIndex(idx);
    bg.computeVertexNormals();
    var bar = new THREE.Mesh(bg, stone);
    bar.material.side = THREE.DoubleSide;
    g.add(bar);
    scene.add(g);
  }

  /* ---------- 沿街一排铺面 ---------- */
  function buildStreetRow(scene, z, row) {
    var x = S.X0 - 6;
    var i = 0;
    var names = ['酒', '米行', '布庄', '茶', '药', '当', '面', '铁'];
    while (x < S.X1 + 6) {
      var w = 9 + (i % 3) * 2;
      var d = 9;
      var floors = (i % 4 === 1) ? 2 : (i % 3 === 0 ? 2 : 1);
      var open = (i % 3 === 1);
      var cfg = {
        w: w, d: d, h: 3.4, floors: floors, open: open,
        label: open ? names[i % names.length] : null,
        plaque: (i % 5 === 2) ? ['听雨轩', '清风居', '临水茶轩', '悦来客栈'][i % 4] : null,
        lanterns: open ? 2 : 1,
        redRoof: (i % 7 === 3)
      };
      var b = A.building(cfg);
      var gy = S.groundY(x + w / 2) + 0.12;
      b.group.position.set(x + w / 2, gy, z - d / 2 - 4);
      scene.add(b.group);
      x += w + 6.0;
      i++;
    }
  }

  /* ---------- 后排更高的楼（层次） ---------- */
  function buildFarRow(scene, z, row) {
    var x = S.X0 - 20;
    var i = 0;
    while (x < S.X1 + 20) {
      var w = 14 + (i % 3) * 5;
      if (i % 4 === 2) {
        // 塔楼
        var b = A.building({ w: 10, d: 10, h: 3.6, floors: 3, plaque: null, lanterns: 0, redRoof: true });
        b.group.position.set(x + 5, S.groundY(x) + 0.2, z);
        scene.add(b.group);
        x += 16;
      } else {
        var b2 = A.building({ w: w, d: 10, h: 3.6, floors: (i % 2 ? 3 : 2), lanterns: 0 });
        b2.group.position.set(x + w / 2, S.groundY(x) + 0.2, z);
        scene.add(b2.group);
        x += w + 6;
      }
      i++;
    }
    // 后排地台
    var sm = stoneMat();
    strip(scene, S.X0 - 40, S.X1 + 40, z - 14, z + 8, function () { return 0.15; }, sm, 3);
  }

  /* ---------- 远山 + 塔剪影 ---------- */
  function buildMountains(scene) {
    var layers = [
      { z: -70, h: 26, col: 0x8fa4ae, hgt: 0.7 },
      { z: -110, h: 44, col: 0x9db2bc, hgt: 0.85 },
      { z: -165, h: 68, col: 0xaec0c8, hgt: 1 }
    ];
    layers.forEach(function (L, li) {
      var N = 90, pos = [], idx = [];
      var span = 520;
      for (var i = 0; i <= N; i++) {
        var x = -span / 2 + span * i / N;
        var r = J.TX ? 0 : 0;
        var n1 = Math.sin(x * 0.013 + li * 2.3) * 0.5 + 0.5;
        var n2 = Math.sin(x * 0.041 + li * 5.1) * 0.5 + 0.5;
        var n3 = Math.sin(x * 0.007 + li * 1.7) * 0.5 + 0.5;
        var peak = (n1 * 0.55 + n2 * 0.2 + n3 * 0.9) * L.h;
        pos.push(x, -4, 0, x, peak, 0);
        if (i < N) { var a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      }
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      var m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: L.col, side: THREE.DoubleSide, fog: false }));
      m.position.set(0, 0, L.z);
      m.renderOrder = -5 + li;
      scene.add(m);
    });

  }

  /* ---------- 前景框（暗色剪影，制造纵深） ---------- */
  function buildForeground(scene) {
    var M = A.mats();
    var g = new THREE.Group();
    // 每隔一段一根灯笼杆 + 幌子
    for (var x = S.X0 + 8; x < S.X1; x += 26) {
      var y = S.groundY(x) + 0.05;
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 6.4, 6), M.woodDark);
      pole.position.set(x, y + 3.2, 8.5);
      pole.castShadow = true;
      g.add(pole);
      var arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 5), M.woodDark);
      arm.rotation.z = Math.PI / 2;
      arm.position.set(x + 0.7, y + 6.1, 8.5);
      g.add(arm);
      var lamp = A.lantern(1.35);
      lamp.position.set(x + 1.4, y + 5.3, 8.5);
      g.add(lamp);
    }
    // 底部暗角（近景压边，只占画面最下沿）
    var fg = new THREE.Mesh(new THREE.BoxGeometry(340, 1.2, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x1d1e1a, roughness: 1 }));
    fg.position.set(0, -2.35, 10.5);
    g.add(fg);
    scene.add(g);
  }
})();
