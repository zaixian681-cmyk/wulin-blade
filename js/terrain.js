/* ============================================================
   terrain.js — 青溪镇地形：河道、街市台地、竹山、崖台
   ============================================================ */
window.WL = window.WL || {};
(function () {
  var T = WL.T = {};

  function hash(x, y) { var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); }
  function vn(x, y) {
    var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    var ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    return (hash(ix, iy) * (1 - ux) + hash(ix + 1, iy) * ux) * (1 - uy) +
      (hash(ix, iy + 1) * (1 - ux) + hash(ix + 1, iy + 1) * ux) * uy;
  }
  function fbm(x, y, o) { var v = 0, a = 0.5, f = 1; for (var i = 0; i < (o || 4); i++) { v += a * vn(x * f, y * f); f *= 2.03; a *= 0.5; } return v; }
  function ss(a, b, x) { var t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  T.fbm = fbm; T.ss = ss; T.vn = vn;

  T.riverX = function (z) { return Math.sin(z * 0.012) * 9 + Math.sin(z * 0.031 + 1.2) * 3.2; };
  T.WATER_Y = -0.9;

  /* 特色地貌 */
  T.SPURS = [
    { x: -74, z: -196, r: 46, h: 40, flat: 13 },   // 悬崖古寺所在岩台
    { x: 158, z: 46, r: 92, h: 52, flat: 0 },      // 东侧竹山
    { x: -40, z: 226, r: 74, h: 76, flat: 26 },    // 血刃门山门所在
    { x: 210, z: -150, r: 70, h: 62, flat: 0 },
    { x: -210, z: -60, r: 80, h: 58, flat: 0 },
    { x: 60, z: -280, r: 110, h: 88, flat: 0 }
  ];

  T.heightAt = function (x, z) {
    var rx = T.riverX(z);
    var d = Math.abs(x - rx);
    var h = 0;

    /* 河床 → 河岸 → 街市台地 */
    var chan = ss(13, 5, d);
    h -= chan * 4.6;
    var bank = ss(5, 13, d);
    h += bank * 1.15;

    /* 街市台地：两岸各留 46m 平地 */
    var terraceZone = ss(13, 20, d) * (1 - ss(58, 80, d));
    var terH = 1.15 + Math.floor((d - 13) / 7) * 0.12;      // 极缓的三级石阶
    h = WL.lerp(h, terH, terraceZone * 0.92);

    /* 城镇范围以外，地势爬升 */
    var rise = ss(110, 230, d);
    h += Math.pow(rise, 1.7) * 24;
    var far = ss(230, 420, d);
    h += Math.pow(far, 1.35) * 70;

    /* 大尺度起伏（山脊） */
    var big = fbm(x * 0.0075, z * 0.0075, 4);
    h += (big - 0.46) * 26 * ss(80, 170, d);
    h += (fbm(x * 0.03, z * 0.03, 3) - 0.5) * (0.9 + 6 * ss(80, 170, d));

    /* 岩台 / 山峰 */
    for (var i = 0; i < T.SPURS.length; i++) {
      var s = T.SPURS[i];
      var dd = Math.hypot(x - s.x, z - s.z);
      if (dd > s.r * 1.02) continue;
      var e = dd / s.r;
      var prof = Math.pow(Math.max(0, 1 - Math.min(1, e)), 1.7);
      var top = s.flat > 0 ? ss(0.62, 0.42, e) * s.flat : 0;
      var ridge = (1 - Math.abs(fbm(x * 0.02 + i * 3, z * 0.02 - i * 5, 4) * 2 - 1));
      var add = s.h * prof + top + (ridge - 0.55) * 9 * prof;
      if (add > h) h = add;
    }

    /* 北侧断崖：一条东西向的陡壁，留出峡谷口 */
    var cliffZ = -150;
    var cliff = ss(cliffZ - 10, cliffZ + 14, z) * 0;   // 占位：保持自然
    h += 0;

    /* 河岸外侧的竹林缓坡稍微压低，方便走动 */
    return h;
  };

  T.slopeAt = function (x, z) {
    var e = 1.6;
    var hx = T.heightAt(x + e, z) - T.heightAt(x - e, z);
    var hz = T.heightAt(x, z + e) - T.heightAt(x, z - e);
    return Math.hypot(hx, hz) / (2 * e);
  };

  /* ---------------- 地形网格 ---------------- */
  T.build = function (scene) {
    var N = 180, R = 340;
    // 非均匀网格：中心细、外围粗
    function axis(i) {
      var t = (i / N) * 2 - 1;
      var s = t < 0 ? -1 : 1;
      return s * Math.pow(Math.abs(t), 1.9) * R;
    }
    var n = N + 1;
    var pos = new Float32Array(n * n * 3);
    var uv = new Float32Array(n * n * 2);
    var col = new Float32Array(n * n * 3);
    var hs = new Float32Array(n * n);
    var i, j;

    for (j = 0; j < n; j++) {
      for (i = 0; i < n; i++) {
        var x = axis(i), z = axis(j);
        var h = T.heightAt(x, z);
        var k = j * n + i;
        hs[k] = h;
        pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
        uv[k * 2] = x / 3.4; uv[k * 2 + 1] = z / 3.4;
      }
    }
    var cGrass = new THREE.Color(0x7d8f52), cGrass2 = new THREE.Color(0x4f6535);
    var cRock = new THREE.Color(0x8b877c), cRockD = new THREE.Color(0x5c5a52);
    var cMud = new THREE.Color(0x8a7d61), cPave = new THREE.Color(0x9a978d);
    var tmp = new THREE.Color();
    for (j = 0; j < n; j++) {
      for (i = 0; i < n; i++) {
        var idx = j * n + i;
        var h0 = hs[idx];
        var iL = Math.max(0, i - 1), iR = Math.min(n - 1, i + 1);
        var jD = Math.max(0, j - 1), jU = Math.min(n - 1, j + 1);
        var dx = Math.max(0.5, axis(iR) - axis(iL)), dz = Math.max(0.5, axis(jU) - axis(jD));
        var sl = Math.min(2, Math.hypot((hs[j * n + iR] - hs[j * n + iL]) / dx, (hs[jU * n + i] - hs[jD * n + i]) / dz));
        var x2 = pos[idx * 3], z2 = pos[idx * 3 + 2];
        var d2 = Math.abs(x2 - T.riverX(z2));
        var nn = fbm(x2 * 0.05, z2 * 0.05, 3);

        tmp.copy(cRock).lerp(cRockD, ss(0.35, 1.1, sl));
        var veg = (1 - ss(0.42, 0.95, sl));
        tmp.lerp(cGrass, veg * 0.95);
        tmp.lerp(cGrass2, veg * ss(0.45, 0.8, nn));
        // 河滩湿泥
        tmp.lerp(cMud, ss(17, 8, d2) * 0.85);
        // 镇内铺地（石板/夯土，不再是草地）
        var inTown = ss(64, 52, d2) * ss(160, 140, Math.abs(z2)) * (1 - ss(11, 9, d2));
        if (inTown > 0.01) {
          tmp.lerp(cPave, inTown * 0.92);
        }
        tmp.multiplyScalar(0.86 + nn * 0.3);
        col[idx * 3] = tmp.r; col[idx * 3 + 1] = tmp.g; col[idx * 3 + 2] = tmp.b;
      }
    }
    var ind = [];
    for (j = 0; j < N; j++) {
      for (i = 0; i < N; i++) {
        var a = j * n + i, b = a + 1, c = a + n, d = a + n + 1;
        ind.push(a, c, b, b, c, d);
      }
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(ind);
    g.computeVertexNormals();

    var mat = new THREE.MeshStandardMaterial({
      map: WL.TX.tGrass, vertexColors: true, roughness: 1, metalness: 0
    });
    mat.map.wrapS = mat.map.wrapT = THREE.RepeatWrapping;
    var mesh = new THREE.Mesh(g, mat);
    mesh.receiveShadow = true;
    mesh.name = 'terrain';
    scene.add(mesh);
    T.mesh = mesh;
    return mesh;
  };

  /* ---------------- 河水 ---------------- */
  T.buildWater = function (scene) {
    var pts = [];
    var z0 = -330, z1 = 330, N = 140;
    var pos = [], uv = [], idx = [];
    for (var i = 0; i <= N; i++) {
      var z = z0 + (z1 - z0) * i / N;
      var rx = T.riverX(z);
      var w = 10.5 + Math.sin(z * 0.02) * 1.6;
      pos.push(rx - w, T.WATER_Y, z, rx + w, T.WATER_Y, z);
      uv.push(0, i / N, 1, i / N);
      if (i < N) { var a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    var mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { t: { value: 0 } },
      vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
      fragmentShader: [
        'uniform float t; varying vec2 vUv; varying vec3 vW;',
        'float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
        'float nz(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);',
        ' return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}',
        'void main(){',
        ' float r1 = nz(vec2(vUv.x*26.0, vUv.y*150.0 - t*1.1));',
        ' float r2 = nz(vec2(vUv.x*60.0, vUv.y*320.0 + t*0.8));',
        ' float ripple = r1*0.6 + r2*0.4;',
        ' float edge = smoothstep(0.0,0.16,vUv.x)*smoothstep(1.0,0.84,vUv.x);',
        ' vec3 deep = vec3(0.055,0.135,0.155);',
        ' vec3 shallow = vec3(0.20,0.34,0.33);',
        ' vec3 c = mix(shallow, deep, smoothstep(0.1,0.7,abs(vUv.x-0.5)*2.0));',
        ' c += vec3(0.42,0.55,0.58) * pow(ripple,2.6)*0.34;',
        ' c += vec3(1.0)*pow(ripple,9.0)*0.5;',
        ' gl_FragColor = vec4(c, (0.72+0.2*ripple)*edge);',
        '}'
      ].join('\n')
    });
    var m = new THREE.Mesh(g, mat);
    m.renderOrder = 1;
    scene.add(m);
    T.waterMat = mat;
    return m;
  };
})();

/* ============ 远山剪影（两层，制造纵深） ============ */
(function () {
  var T = WL.T;
  T.farRidge = function (scene) {
    var layers = [
      { r: 520, h: 150, col: 0x6f8899, y: -40, seed: 3.1 },
      { r: 760, h: 210, col: 0x8fa5b2, y: -55, seed: 7.7 }
    ];
    layers.forEach(function (L) {
      var N = 128, pos = [], idx = [];
      for (var i = 0; i <= N; i++) {
        var a = i / N * Math.PI * 2;
        var x = Math.cos(a) * L.r, z = Math.sin(a) * L.r;
        var ridge = T.fbm(Math.cos(a) * 3.4 + L.seed, Math.sin(a) * 3.4 + L.seed, 4);
        var peak = Math.pow(ridge, 1.4) * L.h;
        pos.push(x, L.y, z, x, L.y + peak, z);
        if (i < N) { var b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
      }
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      var m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: L.col, side: THREE.DoubleSide, fog: false, transparent: true, opacity: 0.9 }));
      m.renderOrder = -1;
      scene.add(m);
    });
  };
})();
