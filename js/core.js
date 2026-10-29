/* ============================================================
   core.js — 渲染器 / 场景 / 天空 / 光照 / 雾 / 输入
   ============================================================ */
window.WL = window.WL || {};
(function () {
  var J = WL;

  J.ver = 1;
  J.PI2 = Math.PI * 2;
  J.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  J.lerp = function (a, b, t) { return a + (b - a) * t; };
  J.damp = function (a, b, l, dt) { return J.lerp(a, b, 1 - Math.exp(-l * dt)); };
  J.rand = function (a, b) { return a + Math.random() * (b - a); };
  J.rndInt = function (a, b) { return a + Math.floor(Math.random() * (b - a + 1)); };

  J.errors = [];
  window.addEventListener('error', function (e) {
    J.errors.push((e.message || '') + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno);
    var el = document.getElementById('err');
    if (el) { el.style.display = 'block'; el.textContent = J.errors.slice(-3).join('\n'); }
  });

  /* ---------------- 渲染器 ---------------- */
  J.initRenderer = function (canvas) {
    var r = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
    J.dprMax = Math.min(window.devicePixelRatio || 1, 1.6);
    J.dpr = J.dprMax;
    r.setPixelRatio(J.dpr);
    r.setSize(window.innerWidth, window.innerHeight, false);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.shadowMap.autoUpdate = true;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.18;
    J.R = r;
    return r;
  };

  /* ---------------- 场景 & 天空 ---------------- */
  J.FOG_COL = new THREE.Color(0xa8bcc4);
  J.buildScene = function () {
    var sc = new THREE.Scene();
    sc.fog = new THREE.FogExp2(0xbccdd2, 0.0052);
    J.S = sc;

    // 天空穹顶（三色渐变 + 太阳辉光）
    var sky = new THREE.Mesh(
      new THREE.SphereGeometry(600, 32, 20),
      new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false,
        uniforms: {
          cTop: { value: new THREE.Color(0x5d86a8) },
          cMid: { value: new THREE.Color(0xa9c2cf) },
          cHor: { value: new THREE.Color(0xe2ddcd) },
          sunDir: { value: new THREE.Vector3(-0.42, 0.42, -0.8).normalize() },
          cSun: { value: new THREE.Color(0xfff2d6) }
        },
        vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: [
          'uniform vec3 cTop,cMid,cHor,cSun,sunDir; varying vec3 vP;',
          'void main(){',
          ' float h = clamp(vP.y*1.1, 0.0, 1.0);',
          ' vec3 c = mix(cHor, cMid, smoothstep(0.0,0.32,h));',
          ' c = mix(c, cTop, smoothstep(0.28,0.92,h));',
          ' float d = max(dot(vP, sunDir), 0.0);',
          ' c += cSun * pow(d, 8.0) * 0.5;',
          ' c += cSun * pow(d, 120.0) * 1.4;',
          ' gl_FragColor = vec4(c, 1.0);',
          '}'
        ].join('\n')
      })
    );
    sky.frustumCulled = false;
    sc.add(sky);
    J.sky = sky;

    // 光：暖阳 + 天光 + 冷补光
    var sun = new THREE.DirectionalLight(0xffe9c2, 3.6);
    sun.position.set(-210, 190, 60);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    var s = sun.shadow.camera;
    s.left = -90; s.right = 90; s.top = 90; s.bottom = -90; s.near = 1; s.far = 460;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.06;
    sc.add(sun); sc.add(sun.target);
    J.sun = sun;

    sc.add(new THREE.HemisphereLight(0xbcd6e8, 0x6b6350, 1.15));
    var fill = new THREE.DirectionalLight(0x9cc0dc, 0.65);
    fill.position.set(160, 90, 200);
    sc.add(fill);

    return sc;
  };

  /* 阴影跟随玩家（保证近处阴影清晰） */
  J.updateShadow = function (px, pz) {
    var sun = J.sun;
    sun.position.set(px - 210, 190, pz + 60);
    sun.target.position.set(px, 0, pz);
    sun.target.updateMatrixWorld();
  };

  /* ---------------- 材质工具 ---------------- */
  J.mat = function (o) {
    var m = new THREE.MeshStandardMaterial(o);
    return m;
  };
  /* 贴图材质：repeat 以米为单位（每 2m 一循环） */
  J.texMat = function (tex, color, rough, metal, rep) {
    var t = tex.clone();
    t.needsUpdate = true;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    rep = rep || 2.2;
    t.repeat.set(1 / rep, 1 / rep);
    return new THREE.MeshStandardMaterial({
      map: t, color: color === undefined ? 0xffffff : color,
      roughness: rough === undefined ? 0.9 : rough,
      metalness: metal || 0
    });
  };

  /* ---------------- 输入 ---------------- */
  J.IN = {
    move: { x: 0, y: 0 },        // 摇杆 -1..1
    attack: false, heavy: false, dodge: false, block: false,
    exec: false, swap: false, jump: false,
    camYaw: 0, camPitch: 0.22,
    _buf: {},
    press: function (k) { this._buf[k] = 0.22; },
    consume: function (k) {
      if (this._buf[k] > 0) { this._buf[k] = 0; return true; }
      return false;
    },
    tick: function (dt) {
      for (var k in this._buf) if (this._buf[k] > 0) this._buf[k] -= dt;
    }
  };
})();
