window.WL = window.WL || {};
var J = window.WL;
J.U = J.U || {}; if (!J.U.damp) J.U.damp = function(a,b,l,dt){ return a+(b-a)*(1-Math.exp(-l*dt)); };
/* ═══════════════════════════════════════════════
   weapon.js — 太玄之刃（本命佩刀）
   银白冷月金属 / 锻造纹理 / 古符 / 鎏金云纹护手 / 缠绳黑檀柄
   材质全部 PBR，无贴图依赖，程序生成
   ═══════════════════════════════════════════════ */
J.Weapon = (function () {

  var BLADE_LEN = 1.30;      // 刃长
  var HILT_LEN = 0.30;       // 柄长

  /* ── 噪声 ── */
  function h2(x, y) { var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); }
  function vn(x, y) {
    var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    return (h2(ix, iy) * (1 - fx) + h2(ix + 1, iy) * fx) * (1 - fy) +
      (h2(ix, iy + 1) * (1 - fx) + h2(ix + 1, iy + 1) * fx) * fy;
  }
  function fbm(x, y, o) { var v = 0, a = 0.5, f = 1; for (var i = 0; i < (o || 4); i++) { v += a * vn(x * f, y * f); f *= 2.03; a *= 0.5; } return v; }

  /* ══ 环境反射贴图：让金属真的有"金属感" ══ */
  function envTexture() {
    var W = 512, H = 256;
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var g = cv.getContext('2d');
    // 天顶 → 地平线 → 地面
    var sky = g.createLinearGradient(0, 0, 0, H * 0.62);
    sky.addColorStop(0, '#cfd9e4');
    sky.addColorStop(0.45, '#a8b8c8');
    sky.addColorStop(0.8, '#8c9aa8');
    sky.addColorStop(1, '#6a747e');
    g.fillStyle = sky; g.fillRect(0, 0, W, H * 0.62);
    // 地面
    var gnd = g.createLinearGradient(0, H * 0.62, 0, H);
    gnd.addColorStop(0, '#3a3630');
    gnd.addColorStop(1, '#1a1815');
    g.fillStyle = gnd; g.fillRect(0, H * 0.62, W, H * 0.38);
    // 太阳光斑（给刀身高光用）
    var sun = g.createRadialGradient(W * 0.72, H * 0.26, 0, W * 0.72, H * 0.26, W * 0.22);
    sun.addColorStop(0, 'rgba(255,246,225,1)');
    sun.addColorStop(0.35, 'rgba(255,238,205,0.55)');
    sun.addColorStop(1, 'rgba(255,230,190,0)');
    g.fillStyle = sun; g.fillRect(0, 0, W, H);
    // 冷色补光
    var cool = g.createRadialGradient(W * 0.22, H * 0.34, 0, W * 0.22, H * 0.34, W * 0.3);
    cool.addColorStop(0, 'rgba(150,180,220,0.5)');
    cool.addColorStop(1, 'rgba(150,180,220,0)');
    g.fillStyle = cool; g.fillRect(0, 0, W, H);

    var tex = new THREE.CanvasTexture(cv);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /* ══ 刀身锻造纹理（粗糙度 + 符文）══ */
  function bladeRoughTex() {
    var S = 512, cv = document.createElement('canvas');
    cv.width = S; cv.height = S;
    var g = cv.getContext('2d');
    // 基础：冷白金属，中低粗糙
    g.fillStyle = '#3c3c3c'; g.fillRect(0, 0, S, S);   // 粗糙度基准（越暗越光滑）

    // 锻造折叠纹：沿长度方向的层叠
    for (var i = 0; i < 90; i++) {
      var y = Math.random() * S;
      var w = 1 + Math.random() * 3.2;
      var a = 0.06 + Math.random() * 0.16;
      g.strokeStyle = 'rgba(150,150,150,' + a + ')';
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(0, y);
      for (var x = 0; x <= S; x += 32) {
        g.lineTo(x, y + Math.sin(x * 0.02 + i) * 3.5 + (vn(x * 0.05, i) - 0.5) * 4);
      }
      g.stroke();
    }
    // 细密研磨痕
    for (var j = 0; j < 900; j++) {
      var sx = Math.random() * S, sy = Math.random() * S;
      g.strokeStyle = 'rgba(200,200,200,' + (0.02 + Math.random() * 0.05) + ')';
      g.lineWidth = 0.6;
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + 6 + Math.random() * 26, sy + (Math.random() - 0.5) * 2); g.stroke();
    }
    // 磨损：边缘略粗糙
    g.globalAlpha = 0.5;
    for (var k = 0; k < 120; k++) {
      var bx = Math.random() * S, by = Math.random() * S, br = 4 + Math.random() * 26;
      var grd = g.createRadialGradient(bx, by, 0, bx, by, br);
      grd.addColorStop(0, 'rgba(120,120,120,0.28)');
      grd.addColorStop(1, 'rgba(120,120,120,0)');
      g.fillStyle = grd; g.beginPath(); g.arc(bx, by, br, 0, 7); g.fill();
    }
    g.globalAlpha = 1;

    var t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  /* 符文发光层 */
  function runeTexture() {
    var S = 512, cv = document.createElement('canvas');
    cv.width = S; cv.height = S;
    var g = cv.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
    g.strokeStyle = 'rgba(170,150,255,0.95)';
    g.lineWidth = 2.2;
    g.lineCap = 'round';
    // 沿刀身的古符：几何线条组合
    for (var i = 0; i < 9; i++) {
      var cy = 26 + i * 54;
      var cx = S * 0.5;
      g.save();
      g.translate(cx, cy);
      g.beginPath();
      var seg = 3 + Math.floor(Math.random() * 3);
      for (var s = 0; s < seg; s++) {
        var a0 = Math.random() * 6.283, r0 = 6 + Math.random() * 12;
        g.moveTo(0, 0);
        g.lineTo(Math.cos(a0) * r0, Math.sin(a0) * r0);
      }
      g.stroke();
      // 小圆点
      g.beginPath(); g.arc(0, 0, 1.6, 0, 7); g.fillStyle = 'rgba(200,180,255,1)'; g.fill();
      g.restore();
    }
    var t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, 3);
    return t;
  }

  /* 黑檀木纹 */
  function ebonyTex() {
    var S = 256, cv = document.createElement('canvas');
    cv.width = S; cv.height = S;
    var g = cv.getContext('2d');
    g.fillStyle = '#1c1613'; g.fillRect(0, 0, S, S);
    for (var i = 0; i < 60; i++) {
      var y = Math.random() * S;
      g.strokeStyle = 'rgba(' + (40 + Math.random() * 40) + ',' + (28 + Math.random() * 26) + ',' + (22 + Math.random() * 20) + ',' + (0.25 + Math.random() * 0.4) + ')';
      g.lineWidth = 0.8 + Math.random() * 2.4;
      g.beginPath();
      g.moveTo(0, y);
      for (var x = 0; x <= S; x += 16) g.lineTo(x, y + Math.sin(x * 0.03 + i) * 2.2);
      g.stroke();
    }
    var t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, 3);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  /* 缠绳纹理 */
  function wrapTex() {
    var S = 128, cv = document.createElement('canvas');
    cv.width = S; cv.height = S;
    var g = cv.getContext('2d');
    g.fillStyle = '#241d18'; g.fillRect(0, 0, S, S);
    // 斜向缠绕
    g.strokeStyle = '#3a2f26'; g.lineWidth = 7;
    for (var i = -S; i < S * 2; i += 13) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i + S * 0.5, S); g.stroke();
    }
    g.strokeStyle = 'rgba(90,74,58,0.55)'; g.lineWidth = 2;
    for (var j = -S; j < S * 2; j += 13) {
      g.beginPath(); g.moveTo(j + 3, 0); g.lineTo(j + S * 0.5 + 3, S); g.stroke();
    }
    var t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, 5);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  /* ══ 刀身截面（刃口 +Z，刀背 -Z）══ */
  function section(w, th) {
    return [
      [0, w],                 // 刃口
      [th * 0.62, w * 0.55],
      [th, -w * 0.30],
      [th * 0.30, -w],        // 刀背
      [-th * 0.30, -w],
      [-th, -w * 0.30],
      [-th * 0.62, w * 0.55]
    ];
  }

  function spine(t) {
    var y = t * BLADE_LEN;
    var x = Math.pow(t, 1.7) * 0.36;       // 弯曲
    var tip = Math.pow(t, 3.2) * 0.10;     // 刀尖上扬
    return [x, y, tip];
  }
  function widthAt(t) {
    var base = 0.0245 * (0.74 + 0.42 * Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.85));
    var taper = Math.pow(1 - t, 0.72) * 0.92 + 0.06;   // 尖端收窄
    return base * taper + 0.0016;
  }
  function thickAt(t) { return 0.0062 * Math.pow(1 - t, 0.55) + 0.0011; }

  function buildBladeGeo(SEG) {
    var pos = [], uv = [], idx = [];
    var N = 7;
    for (var i = 0; i <= SEG; i++) {
      var t = i / SEG;
      var sp = spine(t), w = widthAt(t), th = thickAt(t);
      var sec = section(w, th);
      for (var j = 0; j < N; j++) {
        pos.push(sp[0] + sec[j][0], sp[1], sec[j][1] + sp[2]);
        uv.push(j / (N - 1), t);
      }
    }
    for (var i2 = 0; i2 < SEG; i2++) {
      for (var j2 = 0; j2 < N; j2++) {
        var a = i2 * N + j2, b = i2 * N + (j2 + 1) % N;
        var c = (i2 + 1) * N + (j2 + 1) % N, d = (i2 + 1) * N + j2;
        idx.push(a, b, c, a, c, d);
      }
    }
    for (var j3 = 1; j3 < N - 1; j3++) idx.push(0, j3, j3 + 1);
    var base2 = SEG * N;
    for (var j4 = 1; j4 < N - 1; j4++) idx.push(base2, base2 + j4 + 1, base2 + j4);

    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  /* ══ 组装 ══ */
  var API = {};

  API.create = function () {
    var root = new THREE.Group();
    var parts = new THREE.Group();
    root.add(parts);

    var env = envTexture();

    /* ── 刀身：银白冷月金属 ── */
    var roughT = bladeRoughTex();
    var runeT = runeTexture();
    var bladeMat = new THREE.MeshStandardMaterial({
      color: 0xb4bfca,
      metalness: 1.0,
      roughness: 0.34,
      roughnessMap: roughT,
      envMap: env,
      envMapIntensity: 0.85,
      emissive: 0x3a2a5a,
      emissiveMap: runeT,
      emissiveIntensity: 0.30
    });
    var blade = new THREE.Mesh(buildBladeGeo(34), bladeMat);
    blade.position.y = 0.02;
    blade.castShadow = true;
    parts.add(blade);

    /* 刃口高光条 */
    (function edgeLine() {
      var S = 34, pos = [], uv = [], idx = [];
      for (var i = 0; i <= S; i++) {
        var t = i / S, sp = spine(t), w = widthAt(t);
        pos.push(sp[0], sp[1] + 0.02, w + sp[2] - 0.0015);
        pos.push(sp[0], sp[1] + 0.02, w + sp[2] + 0.004);
        uv.push(0, t); uv.push(1, t);
        if (i < S) { var a = i * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
      }
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals();
      var m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.9,
        side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending
      }));
      m.renderOrder = 8;
      parts.add(m);
      API._edge = m;
    })();

    /* ── 鎏金材质 ── */
    var goldMat = new THREE.MeshStandardMaterial({
      color: 0xd9b46a, metalness: 1.0, roughness: 0.24,
      envMap: env, envMapIntensity: 1.1,
      emissive: 0x2a1c06, emissiveIntensity: 0.35
    });
    var goldDark = new THREE.MeshStandardMaterial({
      color: 0x8a6a34, metalness: 1.0, roughness: 0.42,
      envMap: env, envMapIntensity: 0.9
    });

    /* ── 蓝紫灵玉 ── */
    var gemMat = new THREE.MeshPhysicalMaterial({
      color: 0x7a5cff, metalness: 0.1, roughness: 0.05,
      transmission: 0.65, thickness: 0.5, ior: 2.2,
      emissive: 0x5a3cff, emissiveIntensity: 2.4,
      envMap: env, envMapIntensity: 1.6,
      clearcoat: 1.0, clearcoatRoughness: 0.05
    });

    /* ── 刀柄：黑檀 + 缠绳 ── */
    var woodMat = new THREE.MeshStandardMaterial({
      map: ebonyTex(), color: 0x8a7a68, metalness: 0.12, roughness: 0.62,
      envMap: env, envMapIntensity: 0.45
    });
    var wrapMat = new THREE.MeshStandardMaterial({
      map: wrapTex(), color: 0x9a8a76, metalness: 0.05, roughness: 0.85,
      envMap: env, envMapIntensity: 0.3
    });

    var hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.0135, 0.0165, HILT_LEN, 12), woodMat);
    hilt.position.y = -HILT_LEN / 2;
    hilt.castShadow = true;
    parts.add(hilt);

    // 缠绳层（略粗）
    var wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.0158, 0.0182, HILT_LEN * 0.66, 12), wrapMat);
    wrap.position.y = -HILT_LEN * 0.52;
    parts.add(wrap);

    /* 鎏金箍环 */
    for (var i = 0; i < 3; i++) {
      var ring = new THREE.Mesh(new THREE.TorusGeometry(0.0168, 0.0028, 8, 16), goldMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -0.03 - i * 0.085;
      ring.castShadow = true;
      parts.add(ring);
    }

    /* ── 尾端：玉饰 + 金环 ── */
    var pommel = new THREE.Group();
    pommel.position.y = -HILT_LEN - 0.008;
    var capRing = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.0048, 8, 18), goldMat);
    capRing.rotation.x = Math.PI / 2;
    pommel.add(capRing);
    var capDisk = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.017, 0.012, 14), goldMat);
    pommel.add(capDisk);
    var jade = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 10), gemMat);
    jade.position.y = -0.026;
    jade.scale.set(1, 1.5, 0.8);
    pommel.add(jade);
    parts.add(pommel);

    /* ── 护手：鎏金云纹 + 火焰纹 ── */
    var guard = new THREE.Group();
    guard.position.y = 0.014;

    // 主盘
    var disk = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.040, 0.010, 18), goldMat);
    disk.castShadow = true;
    guard.add(disk);
    // 外圈
    var outerRing = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.0052, 8, 24), goldMat);
    outerRing.rotation.x = Math.PI / 2;
    guard.add(outerRing);
    var innerRing = new THREE.Mesh(new THREE.TorusGeometry(0.030, 0.0028, 8, 20), goldDark);
    innerRing.rotation.x = Math.PI / 2;
    guard.add(innerRing);

    // 云纹：沿圆周的卷云片
    for (var c = 0; c < 6; c++) {
      var a = c / 6 * Math.PI * 2;
      var cloud = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), goldMat);
      cloud.scale.set(0.017, 0.005, 0.010);
      cloud.position.set(Math.cos(a) * 0.035, c % 2 ? 0.007 : -0.007, Math.sin(a) * 0.035);
      cloud.rotation.y = -a;
      cloud.rotation.z = (c % 2 ? 1 : -1) * 0.35;
      guard.add(cloud);
    }
    // 火焰纹：两侧挑出的尖叶
    for (var f = -1; f <= 1; f += 2) {
      for (var q = 0; q < 2; q++) {
        var flame = new THREE.Mesh(new THREE.ConeGeometry(0.009, 0.040, 5), goldMat);
        flame.position.set(f * (0.052 + q * 0.008), q ? 0.008 : -0.008, 0);
        flame.rotation.z = f * (q ? 1.15 : -1.05);
        flame.rotation.x = 0.2;
        guard.add(flame);
      }
    }
    // 中心蓝紫灵玉
    var gem = new THREE.Mesh(new THREE.SphereGeometry(0.0145, 14, 12), gemMat);
    gem.position.y = 0.004;
    gem.scale.set(1, 1, 1.45);
    guard.add(gem);
    var halo = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0x8a6cff, transparent: true, opacity: 0.20, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.position.y = 0.004;
    guard.add(halo);
    parts.add(guard);

    /* ── 灵气：沿刀身流动的一层薄纱 ── */
    var aura = (function () {
      var S = 22, count = 3, grp = new THREE.Group();
      var mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 }, uPower: { value: 1 },
          uCore: { value: new THREE.Color(0xcfd8ff) },
          uTint: { value: new THREE.Color(0x9a7cff) }
        },
        vertexShader: [
          'varying vec2 vUv; varying vec3 vN; varying vec3 vV;',
          'void main(){',
          '  vUv = uv;',
          '  vec4 wp = modelMatrix * vec4(position,1.0);',
          '  vN = normalize(mat3(modelMatrix) * normal);',
          '  vV = normalize(cameraPosition - wp.xyz);',
          '  gl_Position = projectionMatrix * viewMatrix * wp;',
          '}'
        ].join('\n'),
        fragmentShader: [
          'uniform float uTime, uPower; uniform vec3 uCore, uTint;',
          'varying vec2 vUv; varying vec3 vN; varying vec3 vV;',
          'void main(){',
          '  float t = vUv.y;',
          '  float band = fract(t * 2.2 - uTime * 0.55);',
          '  float wave = smoothstep(0.0, 0.35, band) * smoothstep(1.0, 0.55, band);',
          '  float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);',
          '  vec3 col = mix(uTint, uCore, wave);',
          '  float a = (wave * 0.22 + fres * 0.30) * uPower * smoothstep(0.0, 0.12, t);',
          '  gl_FragColor = vec4(col, a);',
          '}'
        ].join('\n')
      });
      for (var i = 0; i < count; i++) {
        var wobble = 0.006 + i * 0.004;
        var geo = buildBladeGeo(20);
        // 沿法线外扩一点点
        var p = geo.attributes.position;
        for (var v = 0; v < p.count; v++) {
          var w = widthAt(p.getY(v) / BLADE_LEN || 0);
          var x = p.getX(v), z = p.getZ(v);
          var len = Math.hypot(x, z) || 1;
          p.setXYZ(v, x + x / len * wobble, p.getY(v) + 0.02, z + z / len * wobble);
        }
        geo.computeVertexNormals();
        var m = new THREE.Mesh(geo, mat);
        m.renderOrder = 6;
        grp.add(m);
      }
      grp.userData.mat = mat;
      parts.add(grp);
      return grp;
    })();

    /* 光源 */
    var light = new THREE.PointLight(0xa8b8ff, 0.55, 4.5, 2);
    light.position.set(0.1, 0.9, 0.1);
    root.add(light);

    var obj = {
      root: root, parts: parts, blade: blade, bladeMat: bladeMat,
      gemMat: gemMat, aura: aura, light: light,
      stage: 1,
      glow: 1,
      /* 太玄之刃三阶觉醒：封刃 → 鸣刃 → 太玄觉醒 */
      setStage: function (n) {
        this.stage = n;
        var cfg = [null,
          { core: 0xcfd8ff, tint: 0x8a7cf0, emis: 0.30, aura: 0.75, light: 0x9aa8d0, li: 0.45 },
          { core: 0xdcd0ff, tint: 0xa07cff, emis: 0.75, aura: 1.30, light: 0xb090ff, li: 0.85 },
          { core: 0xf0e6ff, tint: 0xc09aff, emis: 1.35, aura: 2.10, light: 0xd0a8ff, li: 1.45 }
        ][n] || null;
        if (!cfg) return;
        aura.userData.mat.uniforms.uCore.value.setHex(cfg.core);
        aura.userData.mat.uniforms.uTint.value.setHex(cfg.tint);
        bladeMat.emissiveIntensity = cfg.emis;
        obj._auraBase = cfg.aura;
        light.color.setHex(cfg.light);
        obj._lightBase = cfg.li;
        /* 灵玉随阶变亮 */
        gemMat.emissive.setHex(n >= 2 ? 0x7a52ff : 0x5a3cff);
      },
      update: function (dt, t, glowTarget) {
        this.glow = J.U.damp(this.glow, glowTarget === undefined ? 1 : glowTarget, 6, dt);
        aura.userData.mat.uniforms.uTime.value = t;
        aura.userData.mat.uniforms.uPower.value = (this._auraBase || 0.75) * (0.75 + this.glow * 0.5);
        bladeMat.emissiveIntensity = 0.35 + this.glow * 0.55;
        gemMat.emissiveIntensity = 1.8 + this.glow * 1.4;
        light.intensity = (this._lightBase || 0.45) * (0.7 + this.glow * 0.5) + 0.10 * Math.sin(t * 1.8);
        halo.material.opacity = 0.14 + this.glow * 0.12 + Math.sin(t * 2.2) * 0.02;
      }
    };
    return obj;
  };

  return API;
})();
