window.WL = window.WL || {};
var J = window.WL;
J.U = J.U || {}; if (!J.U.damp) J.U.damp = function(a,b,l,dt){ return a+(b-a)*(1-Math.exp(-l*dt)); };
/* ═══════════════════════════════════════════════
   hero.js — 女主角「太玄」
   银白高髻 / 金绸遮眼 / 金纹玄衣 / 白纱长裙 / 白尾
   ═══════════════════════════════════════════════ */
J.Hero = (function () {

  /* ── 贴图：金线玄缎（黑底 + 金云纹） ── */
  function brocadeTex() {
    var c = document.createElement('canvas'); c.width = c.height = 256;
    var x = c.getContext('2d');
    x.fillStyle = '#12100f'; x.fillRect(0, 0, 256, 256);
    // 细微织物噪点
    for (var i = 0; i < 1400; i++) {
      x.fillStyle = 'rgba(255,255,255,' + (Math.random() * 0.03) + ')';
      x.fillRect(Math.random() * 256, Math.random() * 256, 1, 1);
    }
    x.strokeStyle = '#c9a24e'; x.lineWidth = 1.6; x.globalAlpha = 0.85;
    // 云纹：同心圆弧 + 卷草
    for (var row = 0; row < 3; row++) {
      for (var col = 0; col < 2; col++) {
        var cx = 64 + col * 128, cy = 42 + row * 88;
        for (var r = 0; r < 3; r++) {
          x.beginPath();
          x.arc(cx, cy, 9 + r * 7, Math.PI * (0.15 + r * 0.1), Math.PI * (1.35 - r * 0.1));
          x.stroke();
        }
        x.beginPath();
        x.moveTo(cx - 26, cy + 6);
        x.quadraticCurveTo(cx - 8, cy + 22, cx + 14, cy + 10);
        x.stroke();
        x.beginPath();
        x.moveTo(cx + 18, cy - 4);
        x.quadraticCurveTo(cx + 30, cy + 12, cx + 40, cy + 2);
        x.stroke();
      }
    }
    x.globalAlpha = 0.5; x.lineWidth = 0.9;
    for (var v = 0; v < 4; v++) {
      x.beginPath(); x.moveTo(v * 64 + 10, 0); x.bezierCurveTo(v * 64 + 36, 80, v * 64 - 6, 170, v * 64 + 22, 256); x.stroke();
    }
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 2);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  /* ── 贴图：面部 ── */
  function faceTex() {
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var x = c.getContext('2d');
    x.fillStyle = '#f6e3d8'; x.fillRect(0, 0, 128, 128);
    // 腮红
    var g = x.createRadialGradient(40, 82, 2, 40, 82, 16);
    g.addColorStop(0, 'rgba(226,150,150,.42)'); g.addColorStop(1, 'rgba(226,150,150,0)');
    x.fillStyle = g; x.beginPath(); x.arc(40, 82, 16, 0, 7); x.fill();
    var g2 = x.createRadialGradient(88, 82, 2, 88, 82, 16);
    g2.addColorStop(0, 'rgba(226,150,150,.42)'); g2.addColorStop(1, 'rgba(226,150,150,0)');
    x.fillStyle = g2; x.beginPath(); x.arc(88, 82, 16, 0, 7); x.fill();
    // 唇
    x.fillStyle = '#c9645f';
    x.beginPath(); x.ellipse(64, 100, 7.5, 4.2, 0, 0, 7); x.fill();
    x.fillStyle = 'rgba(255,255,255,.35)';
    x.beginPath(); x.ellipse(64, 98.5, 4, 1.4, 0, 0, 7); x.fill();
    // 鼻
    x.fillStyle = 'rgba(190,150,140,.35)';
    x.beginPath(); x.ellipse(64, 88, 2.6, 2, 0, 0, 7); x.fill();

    /* 边缘羽化：让脸"融"进头部，而不是一块贴纸 */
    x.globalCompositeOperation = 'destination-in';
    var g3 = x.createRadialGradient(64, 66, 18, 64, 66, 66);
    g3.addColorStop(0, 'rgba(0,0,0,1)');
    g3.addColorStop(0.62, 'rgba(0,0,0,1)');
    g3.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g3; x.fillRect(0, 0, 128, 128);
    x.globalCompositeOperation = 'source-over';

    var t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  /* ── 材质库 ── */
  var M = {};

  /* 边缘光：让角色从背景中脱离出来（水墨剪影的关键） */
  function rim(mat, col, power) {
    mat.onBeforeCompile = function (sh) {
      sh.uniforms.uRimColor = { value: new THREE.Color(col === undefined ? 0xbcd2ea : col) };
      sh.uniforms.uRimPow = { value: power === undefined ? 0.85 : power };
      sh.fragmentShader = 'uniform vec3 uRimColor; uniform float uRimPow;\n' + sh.fragmentShader.replace(
        '#include <dithering_fragment>',
        ['#include <dithering_fragment>',
         'vec3 _vd = normalize(vViewPosition);',
         'float _rim = pow(1.0 - abs(dot(normalize(normal), _vd)), 2.3);',
         'gl_FragColor.rgb += uRimColor * _rim * uRimPow;'
        ].join('\n')
      );
    };
    mat.needsUpdate = true;
    return mat;
  }

  function initMats() {
    var broc = brocadeTex();
    M.robe = rim(new THREE.MeshStandardMaterial({ map: broc, color: 0x1a1817, roughness: 0.58, metalness: 0.34, emissive: 0x0d0a06, emissiveIntensity: 0.45 }), 0xcfe0f5, 0.55);
    M.robe2 = rim(new THREE.MeshStandardMaterial({ color: 0x141212, roughness: 0.7, metalness: 0.2 }), 0xcfe0f5, 0.5);
    M.gold = rim(new THREE.MeshStandardMaterial({ color: 0xd4b070, metalness: 0.92, roughness: 0.3, emissive: 0x5a4018, emissiveIntensity: 0.3 }), 0xffe6b0, 0.35);
    M.skin = rim(new THREE.MeshStandardMaterial({ color: 0xe8cdb8, roughness: 0.62, metalness: 0.0 }), 0xffd8c0, 0.28);
    M.hair = rim(new THREE.MeshStandardMaterial({ color: 0xb8b2cc, roughness: 0.42, metalness: 0.12, emissive: 0x24213a, emissiveIntensity: 0.22 }), 0xd6ddf0, 0.45);
    M.hairD = rim(new THREE.MeshStandardMaterial({ color: 0x8f89a8, roughness: 0.5, metalness: 0.1, emissive: 0x1c1a2c, emissiveIntensity: 0.2 }), 0xc8d2e8, 0.4);
    M.veil = new THREE.MeshStandardMaterial({ color: 0xd8c894, metalness: 0.6, roughness: 0.34, emissive: 0x4a3818, emissiveIntensity: 0.35, side: THREE.DoubleSide });
    M.face = new THREE.MeshStandardMaterial({ map: faceTex(), roughness: 0.72, transparent: true, depthWrite: false });
    M.silk = rim(new THREE.MeshStandardMaterial({ color: 0xa8acbe, roughness: 0.54, metalness: 0.06, transparent: true, opacity: 0.82, side: THREE.DoubleSide, emissive: 0x181c28, emissiveIntensity: 0.18 }), 0xb8c8e0, 0.4);
    M.silkIn = rim(new THREE.MeshStandardMaterial({ color: 0x54506b, roughness: 0.58, transparent: true, opacity: 0.94, side: THREE.DoubleSide, emissive: 0x161424, emissiveIntensity: 0.18 }), 0x8a80b0, 0.3);
    M.gem = new THREE.MeshStandardMaterial({ color: 0x7d6ae8, emissive: 0x5442c8, emissiveIntensity: 1.15, roughness: 0.22 });
    M.tail = rim(new THREE.MeshStandardMaterial({ color: 0xc8c4da, roughness: 0.72, metalness: 0.02, emissive: 0x252236, emissiveIntensity: 0.18, transparent: true, opacity: 0.93 }), 0xc8d4e8, 0.35);
  }

  function box(w, h, d, mat, x, y, z) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  function sph(r, mat, x, y, z, sx, sy, sz) {
    var m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat);
    m.position.set(x || 0, y || 0, z || 0);
    m.scale.set(sx || 1, sy || 1, sz || 1);
    m.castShadow = true;
    return m;
  }
  function cyl(r1, r2, h, mat, seg) {
    var m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg || 8), mat);
    m.castShadow = true;
    return m;
  }

  /* ═══ 构建角色 ═══ */
  J.buildHero = function () {
    initMats();
    var root = new THREE.Group();
    var spin = new THREE.Group(); root.add(spin);
    var squash = new THREE.Group(); spin.add(squash);
    squash.position.y = 0;

    var H = { root: root, spin: spin, squash: squash, parts: {} };

    /* ── 髋 ── */
    var hips = new THREE.Group(); hips.position.y = 0.86; squash.add(hips);
    H.hips = hips;
    var pelvis = box(0.24, 0.18, 0.17, M.robe2, 0, -0.03, 0);
    hips.add(pelvis);

    /* 腰封：金色 + 紫玉挂饰 */
    var belt = box(0.255, 0.075, 0.185, M.gold, 0, 0.055, 0);
    hips.add(belt);
    var belt2 = box(0.16, 0.055, 0.19, M.robe2, 0, 0.055, 0.002);
    hips.add(belt2);
    // 腰坠
    var pendant = new THREE.Group(); pendant.position.set(0.1, 0.02, 0.09); hips.add(pendant);
    var chain = box(0.008, 0.11, 0.008, M.gold, 0, -0.055, 0); pendant.add(chain);
    var jade = sph(0.019, M.gem, 0, -0.115, 0, 1, 1.5, 0.6); pendant.add(jade);
    H.pendant = pendant;

    /* ── 上身 ── */
    var torso = new THREE.Group(); hips.add(torso);
    H.torso = torso;
    // 腰腹（细）
    var waist = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.108, 0.17, 10), M.robe);
    waist.scale.z = 0.82; waist.position.y = 0.14; waist.castShadow = true; torso.add(waist);
    // 胸
    var chest = new THREE.Group(); chest.position.y = 0.28; torso.add(chest);
    H.chest = chest;
    var ch = box(0.226, 0.195, 0.152, M.robe, 0, 0.045, 0); chest.add(ch);
    // 胸型与肩部斜面
    chest.add(sph(0.062, M.robe, -0.058, 0.062, 0.070, 1.0, 0.85, 0.75));
    chest.add(sph(0.062, M.robe, 0.058, 0.062, 0.070, 1.0, 0.85, 0.75));
    var shL = box(0.10, 0.075, 0.16, M.robe, -0.115, 0.145, 0); shL.rotation.z = 0.30; chest.add(shL);
    var shR = box(0.10, 0.075, 0.16, M.robe, 0.115, 0.145, 0); shR.rotation.z = -0.30; chest.add(shR);
    // 胸口金属纹饰
    var chestTrim = box(0.20, 0.03, 0.19, M.gold, 0, 0.16, 0); chest.add(chestTrim);
    // 高领
    var collar = cyl(0.062, 0.075, 0.10, M.robe, 10); collar.position.y = 0.19; chest.add(collar);
    var collarTrim = cyl(0.066, 0.068, 0.016, M.gold, 10); collarTrim.position.y = 0.238; chest.add(collarTrim);
    // 前襟金边（V 字）
    for (var s = -1; s <= 1; s += 2) {
      var lap = box(0.018, 0.20, 0.012, M.gold, s * 0.045, 0.06, 0.088);
      lap.rotation.z = s * 0.30; chest.add(lap);
    }

    /* ── 头 ── */
    var head = new THREE.Group(); head.position.y = 0.255; chest.add(head);
    H.head = head;
    var skull = sph(0.098, M.skin, 0, 0.088, 0, 1, 1.10, 0.96); head.add(skull);
    // 面部平面
    (function () {
      var geo = new THREE.SphereGeometry(0.100, 22, 18, Math.PI - 0.72, 1.44, 0.70, 1.30);
      var m = new THREE.Mesh(geo, M.face);
      m.position.set(0, 0.088, 0);
      m.scale.set(1, 1.06, 1);
      m.renderOrder = 3;
      head.add(m);
    })();
    // 下巴
    var chin = sph(0.062, M.skin, 0, 0.02, 0.012, 1, 0.8, 0.95); head.add(chin);
    // 耳
    head.add(sph(0.022, M.skin, -0.098, 0.08, 0.005, 0.6, 1.1, 0.8));
    head.add(sph(0.022, M.skin, 0.098, 0.08, 0.005, 0.6, 1.1, 0.8));
    // 颈
    var neck = cyl(0.036, 0.042, 0.075, M.skin, 8); neck.position.y = -0.02; chest.add(neck);

    /* 金色眼罩绸带（缠眼） */
    var veil = new THREE.Group(); veil.position.set(0, 0.086, 0); head.add(veil);
    var band = box(0.155, 0.036, 0.13, M.veil, 0, 0, 0.012); veil.add(band);
    // 斜绕的窄带
    var band2 = box(0.16, 0.012, 0.132, M.veil, 0, -0.022, 0.012);
    band2.rotation.z = 0.10; veil.add(band2);
    var band3 = box(0.155, 0.009, 0.13, M.veil, 0, 0.022, 0.012);
    band3.rotation.z = -0.07; veil.add(band3);
    // 绕到脑后
    var bandBack = box(0.148, 0.030, 0.030, M.veil, 0, 0, -0.075); veil.add(bandBack);
    // 侧面飘带（垂在耳后）
    var veilTailL = box(0.026, 0.30, 0.008, M.veil, -0.085, -0.16, -0.02);
    veilTailL.rotation.z = 0.12; veil.add(veilTailL);
    var veilTailR = box(0.026, 0.26, 0.008, M.veil, 0.085, -0.14, -0.02);
    veilTailR.rotation.z = -0.12; veil.add(veilTailR);
    H.veilTails = [veilTailL, veilTailR];

    /* ── 头发：银白 ── */
    var hairG = new THREE.Group(); head.add(hairG);
    H.hair = hairG;
    // 头盖
    hairG.add(sph(0.099, M.hair, 0, 0.101, -0.022, 1.00, 0.94, 0.95));
    // 后脑发块
    var backHair = sph(0.090, M.hair, 0, 0.058, -0.052, 0.98, 1.02, 0.78); hairG.add(backHair);
    // 刘海（分片）
    for (var f = -2; f <= 2; f++) {
      var strand = box(0.036, 0.085, 0.020, M.hair, f * 0.036, 0.135, 0.078);
      strand.rotation.z = f * 0.12; strand.rotation.x = -0.18;
      hairG.add(strand);
    }
    // 额前碎发（增加发丝层次）
    for (var ms = 0; ms < 7; ms++) {
      var mx = (ms - 3) * 0.026;
      var ml = 0.10 + Math.random() * 0.09;
      var strand3 = box(0.019, ml, 0.012, ms % 2 ? M.hair : M.hairD, mx, 0.108 - ml * 0.42, 0.088);
      strand3.rotation.z = (ms - 3) * 0.10;
      strand3.rotation.x = -0.24;
      hairG.add(strand3);
    }

    // 两侧鬓发
    for (var sd = -1; sd <= 1; sd += 2) {
      var side = box(0.030, 0.26, 0.045, M.hairD, sd * 0.098, 0.0, 0.015);
      side.rotation.z = sd * 0.05;
      hairG.add(side);
      var side2 = box(0.024, 0.20, 0.036, M.hair, sd * 0.105, -0.11, -0.01);
      side2.rotation.z = sd * 0.08;
      hairG.add(side2);
    }
    // 及腰长发：18 缕环绕后脑，宽窄不一
    H.longHair = [];
    var HAIRN = 18;
    for (var hi = 0; hi < HAIRN; hi++) {
      var u = hi / (HAIRN - 1);              // 0..1
      var angH = -Math.PI * 0.78 + u * Math.PI * 1.56;   // 环绕后脑
      var radH = 0.082 + Math.sin(u * Math.PI) * 0.012;
      var hx2 = Math.sin(angH) * radH;
      var hz2 = -Math.cos(angH) * radH * 0.92;
      var hl = 0.44 + Math.sin(u * Math.PI) * 0.16 + Math.random() * 0.05;
      var wid = 0.020 + Math.random() * 0.012;
      var strand2 = box(wid, hl, 0.026, hi % 3 === 0 ? M.hairD : M.hair,
        hx2, 0.075 - hl / 2, hz2);
      strand2.rotation.x = 0.06 + Math.abs(u - 0.5) * 0.10;
      strand2.rotation.z = (u - 0.5) * 0.24;
      hairG.add(strand2);
      H.longHair.push(strand2);
    }

    // 额前碎发（增加发丝层次）
    for (var ms = 0; ms < 7; ms++) {
      var mx = (ms - 3) * 0.026;
      var ml = 0.10 + Math.random() * 0.09;
      var strand3 = box(0.019, ml, 0.012, ms % 2 ? M.hair : M.hairD, mx, 0.108 - ml * 0.42, 0.088);
      strand3.rotation.z = (ms - 3) * 0.10;
      strand3.rotation.x = -0.24;
      hairG.add(strand3);
    }

    // 两侧鬓发
    for (var sd = -1; sd <= 1; sd += 2) {
      var side = box(0.030, 0.26, 0.045, M.hairD, sd * 0.098, 0.0, 0.015);
      side.rotation.z = sd * 0.05;
      hairG.add(side);
      var side2 = box(0.024, 0.20, 0.036, M.hair, sd * 0.105, -0.11, -0.01);
      side2.rotation.z = sd * 0.08;
      hairG.add(side2);
    }
    // 及腰长发：7 缕垂在背后
    H.longHair = [];
    for (var hi = 0; hi < 7; hi++) {
      var hx2 = (hi - 3) * 0.030;
      var hl = 0.58 + Math.abs(hi - 3) * -0.04 + Math.random() * 0.06;
      var strand2 = box(0.030, hl, 0.048, hi % 2 ? M.hair : M.hairD, hx2, -hl / 2 - 0.02, -0.085 - Math.abs(hi - 3) * 0.008);
      strand2.rotation.x = 0.05 + Math.abs(hi - 3) * 0.02;
      strand2.rotation.z = (hi - 3) * 0.035;
      hairG.add(strand2);
      H.longHair.push(strand2);
    }

    // 高发髻（大）
    var bun = new THREE.Group(); bun.position.set(0, 0.172, -0.012); hairG.add(bun);
    H.bun = bun;
    bun.add(sph(0.048, M.hair, 0, 0, 0, 1.06, 0.88, 1.02));
    bun.add(sph(0.032, M.hair, 0, 0.044, -0.004, 1, 0.80, 1));
    // 束发金环
    var bunRing = new THREE.Mesh(new THREE.TorusGeometry(0.040, 0.0052, 6, 16), M.gold);
    bunRing.rotation.x = Math.PI / 2; bunRing.position.y = -0.028;
    bun.add(bunRing);
    // 发冠：银色莲瓣
    var crown = new THREE.Group(); crown.position.set(0, 0.072, 0); bun.add(crown);
    for (var pI = 0; pI < 6; pI++) {
      var ang = pI / 6 * Math.PI * 2;
      var pet = box(0.024, 0.075, 0.012, M.hairD, Math.cos(ang) * 0.048, 0.045, Math.sin(ang) * 0.040);
      pet.rotation.z = -Math.cos(ang) * 0.5; pet.rotation.x = Math.sin(ang) * 0.5;
      crown.add(pet);
    }
    var crownGem = sph(0.02, M.gem, 0, 0.10, 0.01, 1, 1.3, 0.8); crown.add(crownGem);
    // 发冠羽毛（向外散的细片）
    for (var fe = 0; fe < 5; fe++) {
      var fa = -0.9 + fe * 0.45;
      var feather = box(0.008, 0.13, 0.004, M.hairD, Math.sin(fa) * 0.075, 0.11, Math.cos(fa) * 0.02 - 0.02);
      feather.rotation.z = fa * 0.8; feather.rotation.x = -0.2;
      crown.add(feather);
    }

    /* 金簪 + 蓝紫流苏（两侧垂下） */
    H.tassels = [];
    for (var ts = -1; ts <= 1; ts += 2) {
      var pinG = new THREE.Group(); pinG.position.set(ts * 0.085, 0.09, -0.01); head.add(pinG);
      var pin = cyl(0.006, 0.006, 0.22, M.gold, 6); pin.rotation.z = Math.PI / 2 * 0.92 * ts; pinG.add(pin);
      var knob = sph(0.014, M.gold, ts * 0.10, 0.01, 0); pinG.add(knob);
      // 流苏
      var tas = new THREE.Group(); tas.position.set(ts * 0.10, 0.0, 0); pinG.add(tas);
      var cord = box(0.006, 0.10, 0.006, M.gold, 0, -0.05, 0); tas.add(cord);
      var beadMat = new THREE.MeshStandardMaterial({ color: ts < 0 ? 0x9a8cff : 0x7f9dff, emissive: 0x4a3fcc, emissiveIntensity: 1.2, roughness: 0.3 });
      for (var bd = 0; bd < 3; bd++) {
        var bead = sph(0.010, beadMat, 0, -0.105 - bd * 0.026, 0); tas.add(bead);
      }
      for (var st = 0; st < 4; st++) {
        var strandb = box(0.003, 0.075 + Math.random() * 0.04, 0.003, beadMat, (st - 1.5) * 0.008, -0.19, 0);
        tas.add(strandb);
      }
      H.tassels.push(tas);
    }

    /* ── 手臂 ── */
    function makeArm(side) {
      var sh = new THREE.Group();
      sh.position.set(side * 0.155, 0.13, 0);
      chest.add(sh);
      // 肩部金饰
      var pad = sph(0.058, M.gold, side * 0.012, 0.012, 0, 1.1, 0.75, 1.0);
      sh.add(pad);
      var padEdge = box(0.085, 0.016, 0.085, M.gold, side * 0.012, 0.035, 0);
      sh.add(padEdge);
      // 上臂（黑衣）
      var up = new THREE.Group(); sh.add(up);
      var upM = cyl(0.043, 0.036, 0.235, M.robe, 8); upM.position.y = -0.117; up.add(upM);
      // 肘
      var el = new THREE.Group(); el.position.y = -0.235; up.add(el);
      el.add(sph(0.036, M.robe2, 0, 0, 0));
      // 前臂：金臂甲
      var fore = new THREE.Group(); el.add(fore);
      var foreM = cyl(0.034, 0.028, 0.215, M.robe2, 8); foreM.position.y = -0.107; fore.add(foreM);
      // 金臂甲片
      for (var ap = 0; ap < 3; ap++) {
        var plate = box(0.048, 0.055, 0.050, M.gold, 0, -0.045 - ap * 0.062, 0);
        fore.add(plate);
      }
      var cuffR = new THREE.Mesh(new THREE.TorusGeometry(0.033, 0.007, 6, 12), M.gold);
      cuffR.rotation.x = Math.PI / 2; cuffR.position.y = -0.20; fore.add(cuffR);
      // 手
      var hand = new THREE.Group(); hand.position.y = -0.215; fore.add(hand);
      hand.add(box(0.052, 0.062, 0.032, M.skin, 0, -0.028, 0));
      // 金色长护指
      for (var fg = 0; fg < 3; fg++) {
        var fin = cyl(0.004, 0.007, 0.075, M.gold, 6);
        fin.position.set((fg - 1) * 0.016, -0.075, 0.004);
        fin.rotation.x = 0.16;
        hand.add(fin);
      }
      return { sh: sh, up: up, el: el, fore: fore, hand: hand };
    }
    H.armR = makeArm(1);
    H.armL = makeArm(-1);

    /* ── 腿 ── */
    function makeLeg(side) {
      var hip = new THREE.Group(); hip.position.set(side * 0.072, -0.06, 0); hips.add(hip);
      var thigh = cyl(0.058, 0.046, 0.36, M.robe2, 8); thigh.position.y = -0.18; hip.add(thigh);
      var knee = new THREE.Group(); knee.position.y = -0.36; hip.add(knee);
      knee.add(sph(0.045, M.robe2, 0, 0, 0, 1, 0.8, 1));
      var shin = cyl(0.045, 0.034, 0.34, M.robe2, 8); shin.position.y = -0.17; knee.add(shin);
      // 靴
      var foot = new THREE.Group(); foot.position.y = -0.345; knee.add(foot);
      foot.add(box(0.078, 0.055, 0.135, M.robe2, 0, -0.026, 0.022));
      foot.add(box(0.082, 0.020, 0.14, M.gold, 0, -0.052, 0.022));
      // 脚踝金环
      var ank = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.006, 6, 10), M.gold);
      ank.rotation.x = Math.PI / 2; ank.position.y = -0.008; foot.add(ank);
      return { hip: hip, knee: knee, foot: foot };
    }
    H.legR = makeLeg(1);
    H.legL = makeLeg(-1);

    /* ── 白纱长裙（分层，前开叉） ── */
    var skirt = new THREE.Group(); skirt.position.y = 0.86; squash.add(skirt);
    H.skirt = skirt;
    function skirtLayer(rTop, rBot, h, y, mat, seg, openFront) {
      var g = new THREE.CylinderGeometry(rTop, rBot, h, seg || 16, 1, openFront);
      var m = new THREE.Mesh(g, mat);
      m.position.y = y; m.castShadow = true; m.receiveShadow = true;
      return m;
    }
    // 内层：浅紫衬裙（窄筒，藏在小腿周围）
    var inner = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.20, 0.80, 14, 1, true), M.silkIn);
    inner.position.y = -0.40; inner.castShadow = true; skirt.add(inner);

    // 外层：12 片弧形布片，正面开叉
    var panels = [];
    var NP = 12;
    var gap = 0.95;                       // 正面开叉弧度
    var arc = (Math.PI * 2 - gap) / NP;   // 每片弧度
    for (var pi2 = 0; pi2 < NP; pi2++) {
      var a0 = Math.PI + gap / 2 + pi2 * arc;
      var geo = new THREE.CylinderGeometry(0.118, 0.208, 0.68, 4, 1, true, a0, arc * 0.99);
      var m = new THREE.Mesh(geo, M.silk);
      m.scale.z = 0.74;                       // 压扁成椭圆，贴合人体
      m.position.y = -0.34;
      m.castShadow = true; m.receiveShadow = true;
      skirt.add(m);
      panels.push({ m: m, base: 0, ph: pi2 * 0.7, a: a0 + arc / 2, y: m.position.y });
    }
    // 后摆拖地（更长的一层）
    for (var bkk = 0; bkk < 4; bkk++) {
      var b0 = Math.PI + gap / 2 + (NP - 4) * arc + bkk * arc;
      var g2 = new THREE.CylinderGeometry(0.176, 0.235, 0.24, 3, 1, true, b0, arc * 0.95);
      var m2 = new THREE.Mesh(g2, M.silk);
      m2.position.y = -0.78;
      skirt.add(m2);
      panels.push({ m: m2, base: 0, ph: bkk * 1.3, a: b0, y: -0.90 });
    }
    // 内层短裙（到大腿，形成层次）
    var shortSkirt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.126, 0.156, 0.40, 20, 1, true),
      M.silkIn
    );
    shortSkirt.scale.z = 0.78;
    shortSkirt.position.y = -0.18;
    shortSkirt.castShadow = true;
    skirt.add(shortSkirt);

    // 裙腰金边
    var skirtTrim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.010, 6, 18), M.gold);
    skirtTrim.rotation.x = Math.PI / 2; skirtTrim.position.y = 0.01; skirt.add(skirtTrim);
    H.skirtPanels = panels;
    H.skirts = [inner];

    /* ── 白纱披帛（绕肩的两条长纱） ── */
    H.sashes = [];
    for (var sa = -1; sa <= 1; sa += 2) {
      var sash = new THREE.Group(); chest.add(sash);
      var sashM = box(0.055, 0.62, 0.012, M.silk, sa * 0.16, -0.30, -0.06);
      sashM.rotation.z = sa * 0.12;
      sash.add(sashM);
      sash.position.set(0, 0.12, 0);
      H.sashes.push(sashM);
    }

    /* ── 白尾（蓬松，从腰后下方伸出，向上卷） ── */
    /* 光源：角色身上一点冷光，凸显玉刀 */
    var charLight = new THREE.PointLight(0xb9c8ff, 0.55, 3.4, 2);
    charLight.position.set(0, 1.1, 0.2);
    root.add(charLight);
    H.charLight = charLight;

    /* 影子贴片（软阴影，补阴影相机精度） */
    var shTex = (function () {
      var c = document.createElement('canvas'); c.width = c.height = 64;
      var x = c.getContext('2d');
      var g = x.createRadialGradient(32, 32, 2, 32, 32, 30);
      g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(0.55, 'rgba(0,0,0,.22)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.beginPath(); x.arc(32, 32, 31, 0, 7); x.fill();
      var t = new THREE.CanvasTexture(c);
      return t;
    })();
    var blob = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9),
      new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false, opacity: 0.85 }));
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.015;
    blob.renderOrder = 1;
    root.add(blob);
    H.blob = blob;

    /* 右手持刀 */
    var holder = new THREE.Group();
    holder.position.set(0, -0.05, 0.01);
    holder.rotation.set(0.35, 0, 0.2);
    H.armR.hand.add(holder);
    H.weaponHolder = holder;

    return H;
  };

  /* ═══ 模型合并优化 ═══
     同一父节点下、同材质的静态 mesh 合并成一个，大幅降低 draw call */
  function mergeMeshList(list) {
    var pos = [], nor = [], uv = [];
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      var geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      m.updateMatrix();
      geo.applyMatrix4(m.matrix);
      var p = geo.attributes.position;
      var n = geo.attributes.normal;
      var u = geo.attributes.uv;
      for (var a = 0; a < p.array.length; a++) pos.push(p.array[a]);
      if (n) for (var b = 0; b < n.array.length; b++) nor.push(n.array[b]);
      if (u) for (var c = 0; c < u.array.length; c++) uv.push(u.array[c]);
      else for (var c2 = 0; c2 < p.count * 2; c2++) uv.push(0);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    if (nor.length) g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    if (!nor.length) g.computeVertexNormals();
    return g;
  }

  function optimizeNode(node) {
    /* 先把子分组各自优化 */
    var kids = node.children.slice();
    for (var i = 0; i < kids.length; i++) {
      if (kids[i].isGroup || (kids[i].children && kids[i].children.length)) optimizeNode(kids[i]);
    }
    /* 收集直接子 mesh，按材质分组 */
    var byMat = {}, meshes = [];
    for (var j = 0; j < node.children.length; j++) {
      var c = node.children[j];
      if (!c.isMesh || !c.material) continue;
      if (c.userData && c.userData.noMerge) continue;
      var key = c.material.uuid;
      if (!byMat[key]) byMat[key] = { mat: c.material, list: [] };
      byMat[key].list.push(c);
      meshes.push(c);
    }
    for (var k in byMat) {
      var grp = byMat[k];
      if (grp.list.length < 2) continue;
      var geo = mergeMeshList(grp.list);
      var nm = new THREE.Mesh(geo, grp.mat);
      nm.castShadow = true;
      nm.receiveShadow = true;
      node.add(nm);
      for (var r = 0; r < grp.list.length; r++) node.remove(grp.list[r]);
    }
  }

  J.optimizeHeroModel = function (root) {
    optimizeNode(root);
    var cnt = 0;
    root.traverse(function (o) { if (o.isMesh) cnt++; });
    return cnt;
  };

  return { build: J.buildHero };
})();
