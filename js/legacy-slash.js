window.WL = window.WL || {};
var J = window.WL;
/* ═══════════════════════════════════════════════
   slash.js — 刀光系统
   沿刀锋轨迹生成渐隐光带：冷白刃芯 + 青色外焰 + 风压纹理
   ═══════════════════════════════════════════════ */
J.Slash = (function () {

  var N = 20;          // 轨迹采样帧数
  var instances = [];

  var vertShader = [
    'varying vec2 vUv; varying vec3 vW;',
    'void main(){',
    '  vUv = uv;',
    '  vec4 w = modelMatrix * vec4(position,1.0);',
    '  vW = w.xyz;',
    '  gl_Position = projectionMatrix * viewMatrix * w;',
    '}'
  ].join('\n');

  var fragShader = [
    'uniform float uFade;',
    'uniform float uTime;',
    'uniform vec3  uCore;',
    'uniform vec3  uEdge;',
    'varying vec2 vUv; varying vec3 vW;',

    'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);',
    '  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}',

    'void main(){',
    '  float across = vUv.x;',      // 0=刀根 1=刀尖
    '  float age    = vUv.y;',      // 0=最新 1=最旧

    /* 月牙：#只在刀尖侧发光，根部渐隐 */
    '  float blade  = smoothstep(0.10, 0.90, across);',
    '  float tipBoost = pow(smoothstep(0.55, 1.0, across), 1.6);',

    /* 沿轨迹的能量流动 */
    '  float nA = noise(vec2(across*4.0 + uTime*1.8, age*8.0 - uTime*3.2));',
    '  float nB = noise(vec2(across*11.0 - uTime*2.4, age*16.0));',
    '  float energy = 0.72 + 0.28*nA + 0.12*nB;',

    /* 时间衰减：越旧越淡，尾端化开 */
    '  float life = pow(1.0 - age, 1.45);',

    /* 刃芯：极窄的一条纯白高光，勾勒刀锋 */
    '  float edgeLine = smoothstep(0.90, 0.995, across) * smoothstep(0.0, 0.10, age) * smoothstep(0.0, 0.04, 1.0-age);',

    /* 横向柔化，避免硬直边 */
    '  float soft = smoothstep(0.02, 0.55, across);',

    '  vec3 col = mix(uEdge, uCore, tipBoost);',
    '  col += vec3(1.0, 1.0, 1.0) * edgeLine * 1.8;',
    '  col += uEdge * nB * 0.20 * life;',

    '  float a = life * uFade * soft * blade * energy * 0.78;',
    '  a += edgeLine * life * uFade * 0.85;',
    '  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));',
    '}'
  ].join('\n');

  function _write(cur, rootV, tipV, opacity) {
    cur.active = true;
    if (cur.fade < opacity) cur.fade = opacity;
    cur.pts.unshift([rootV.x, rootV.y, rootV.z, tipV.x, tipV.y, tipV.z]);
    while (cur.pts.length > N) cur.pts.pop();
    var arr = cur.mesh.geometry.attributes.position.array;
    for (var i = 0; i < N; i++) {
      var p = cur.pts[i] || cur.pts[cur.pts.length - 1];
      if (!p) p = [0, 0, 0, 0, 0, 0];
      arr[i * 6] = p[0]; arr[i * 6 + 1] = p[1]; arr[i * 6 + 2] = p[2];
      arr[i * 6 + 3] = p[3]; arr[i * 6 + 4] = p[4]; arr[i * 6 + 5] = p[5];
    }
    cur.mesh.geometry.attributes.position.needsUpdate = true;
  }

  function create() {
    var geo = new THREE.BufferGeometry();
    var pos = new Float32Array(N * 2 * 3);
    var uv = new Float32Array(N * 2 * 2);
    var idx = [];
    for (var i = 0; i < N; i++) {
      uv[i * 4] = 0; uv[i * 4 + 1] = i / (N - 1);
      uv[i * 4 + 2] = 1; uv[i * 4 + 3] = i / (N - 1);
      if (i < N - 1) { var a = i * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);

    var mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uFade: { value: 0 },
        uTime: { value: 0 },
        uCore: { value: new THREE.Color(0xffffff) },
        uEdge: { value: new THREE.Color(0x9fd4ff) }
      },
      vertexShader: vertShader,
      fragmentShader: fragShader
    });

    var mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 30;
    J.S.add(mesh);

    return { mesh: mesh, mat: mat, pts: [], fade: 0, active: false };
  }

  var S = {
    init: function () {
      instances = [];
      S.a = create();
      S.a.decay = 4.2;
      S.b = create();
      instances.push(S.a, S.b);
      S.idx = 0;
    },

    /* 每帧推入刀刃两端的世界坐标（内芯 + 外晕两层） */
    push: function (rootV, tipV, rootOuter, tipOuter) {
      _write(S.a, rootV, tipV, 1);
      if (rootOuter && tipOuter) _write(S.b, rootOuter, tipOuter, 0.55);
    },

    /* 开始一次新的挥砍（清空轨迹，避免上一刀的光带残留） */
    begin: function () {
      for (var i = 0; i < instances.length; i++) {
        instances[i].pts.length = 0;
        instances[i].fade = 0;
        instances[i].active = true;
      }
    },

    setColor: function (core, edge) {
      S.a.mat.uniforms.uCore.value.setHex(core || 0xffffff);
      S.a.mat.uniforms.uEdge.value.setHex(edge || 0x9fd4ff);
      S.b.mat.uniforms.uCore.value.setHex(edge || 0x9fd4ff);
      S.b.mat.uniforms.uEdge.value.setHex(edge || 0x9fd4ff);
    },

    update: function (dt, t) {
      for (var i = 0; i < instances.length; i++) {
        var s = instances[i];
        if (!s.active) continue;
        s.mat.uniforms.uTime.value = t;
        s.mat.uniforms.uFade.value = s.fade;
        s.fade -= dt * (s === S.a ? 4.2 : 2.4);
        if (s.fade <= 0) {
          s.fade = 0;
          s.active = false;
          s.pts.length = 0;
          s.mat.uniforms.uFade.value = 0;
        }
      }
    }
  };

  return S;
})();
