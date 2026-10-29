/* ============================================================
   fx.js — 打击特效 / 飘字 / 刀光 / 镜头
   ============================================================ */
window.WL = window.WL || {};
(function () {
  var J = WL;
  var FX = J.FX = {};
  var scene, texts = [], pool = [];

  FX.init = function (s) {
    scene = s;
    // 飘字池
    for (var i = 0; i < 16; i++) {
      var cv = document.createElement('canvas');
      cv.width = 256; cv.height = 128;
      var tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
      sp.scale.set(1.8, 0.9, 1);
      sp.visible = false;
      sp.renderOrder = 999;
      scene.add(sp);
      pool.push({ sp: sp, cv: cv, tex: tex, life: 0 });
    }
  };

  FX.text = function (str, pos, color, big) {
    var e = null;
    for (var i = 0; i < pool.length; i++) if (pool[i].life <= 0) { e = pool[i]; break; }
    if (!e) e = pool[0];
    var g = e.cv.getContext('2d');
    g.clearRect(0, 0, 256, 128);
    g.font = 'bold ' + (big ? 76 : 62) + 'px "PingFang SC","Noto Sans CJK SC",sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 10; g.strokeStyle = 'rgba(0,0,0,0.65)';
    g.strokeText(str, 128, 64);
    g.fillStyle = color || '#fff';
    g.fillText(str, 128, 64);
    e.tex.needsUpdate = true;
    e.sp.position.set(pos.x + J.rand(-0.3, 0.3), pos.y + 1.9, pos.z + J.rand(-0.3, 0.3));
    e.sp.visible = true;
    e.life = 1.0;
    e.sp.scale.set(big ? 2.6 : 1.9, big ? 1.3 : 0.95, 1);
    e.big = big;
  };

  /* 刀光：一道弧形 ribbon */
  FX.slash = function (hero, idx) {
    var geo = new THREE.RingGeometry(0.7, 2.5, 18, 1, -0.9, 1.8);
    var mat = new THREE.MeshBasicMaterial({
      color: hero.weapon === 'dao' ? 0xfff0cf : 0xdfefff,
      transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false
    });
    var m = new THREE.Mesh(geo, mat);
    m.position.copy(hero.pos);
    m.position.y += 1.25;
    m.rotation.y = hero.yaw + Math.PI / 2;
    m.rotation.x = Math.PI / 2 - 0.35;
    m.renderOrder = 20;
    scene.add(m);
    var life = 0.16;
    var t = 0;
    m.userData.upd = function (dt) {
      t += dt;
      mat.opacity = 0.72 * (1 - t / life);
      m.scale.setScalar(1 + t * 2.2);
      if (t > life) { scene.remove(m); geo.dispose(); mat.dispose(); return false; }
      return true;
    };
    FX.tick = FX.tick || [];
    FX.tick.push(m.userData.upd);
  };

  /* 敌人挥击刀光 */
  FX.swipe = function (pos, yaw) {
    var geo = new THREE.RingGeometry(0.5, 1.9, 12, 1, -0.7, 1.4);
    var mat = new THREE.MeshBasicMaterial({ color: 0xff8a6a, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false });
    var m = new THREE.Mesh(geo, mat);
    m.position.set(pos.x, pos.y + 1.1, pos.z);
    m.rotation.x = Math.PI / 2 - 0.4;
    m.rotation.y = yaw + Math.PI / 2;
    m.renderOrder = 19;
    scene.add(m);
    var t = 0;
    FX.tick = FX.tick || [];
    FX.tick.push(function (dt) {
      t += dt;
      mat.opacity = 0.5 * (1 - t / 0.18);
      if (t > 0.18) { scene.remove(m); geo.dispose(); mat.dispose(); return false; }
      return true;
    });
  };

  /* 命中火花 */
  FX.hitSpark = function (pos, crit) {
    var N = crit ? 16 : 9;
    var geo = new THREE.BufferGeometry();
    var arr = new Float32Array(N * 3);
    var vel = [];
    for (var i = 0; i < N; i++) {
      arr[i * 3] = pos.x; arr[i * 3 + 1] = pos.y + 1.1; arr[i * 3 + 2] = pos.z;
      vel.push(new THREE.Vector3(J.rand(-1, 1) * 4, J.rand(0.5, 4), J.rand(-1, 1) * 4));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    var mat = new THREE.PointsMaterial({ color: crit ? 0xffd166 : 0xffe6c0, size: 0.16, transparent: true, opacity: 1, depthWrite: false });
    var pts = new THREE.Points(geo, mat);
    scene.add(pts);
    var t = 0;
    FX.tick = FX.tick || [];
    FX.tick.push(function (dt) {
      t += dt;
      var p = geo.attributes.position;
      for (var i = 0; i < N; i++) {
        vel[i].y -= 9 * dt;
        p.setXYZ(i, p.getX(i) + vel[i].x * dt, p.getY(i) + vel[i].y * dt, p.getZ(i) + vel[i].z * dt);
      }
      p.needsUpdate = true;
      mat.opacity = Math.max(0, 1 - t / 0.45);
      if (t > 0.45) { scene.remove(pts); geo.dispose(); mat.dispose(); return false; }
      return true;
    });
  };

  FX.burst = function (pos, color) {
    FX.hitSpark(pos, true);
  };

  FX.parryFlash = function (pos) {
    var geo = new THREE.RingGeometry(0.3, 0.6, 20);
    var mat = new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, side: THREE.DoubleSide, depthWrite: false });
    var m = new THREE.Mesh(geo, mat);
    m.position.set(pos.x, pos.y + 1.2, pos.z);
    m.rotation.x = -Math.PI / 2;
    scene.add(m);
    var t = 0;
    FX.tick = FX.tick || [];
    FX.tick.push(function (dt) {
      t += dt;
      m.scale.setScalar(1 + t * 9);
      mat.opacity = 1 - t / 0.45;
      if (t > 0.45) { scene.remove(m); geo.dispose(); mat.dispose(); return false; }
      return true;
    });
  };

  FX.execFlash = function (pos) {
    var light = new THREE.PointLight(0xffbb66, 8, 12);
    light.position.set(pos.x, pos.y + 1.4, pos.z);
    scene.add(light);
    var t = 0;
    FX.tick = FX.tick || [];
    FX.tick.push(function (dt) {
      t += dt;
      light.intensity = Math.max(0, 8 * (1 - t / 0.4));
      if (t > 0.4) { scene.remove(light); return false; }
      return true;
    });
  };

  FX.update = function (dt) {
    // 飘字
    for (var i = 0; i < pool.length; i++) {
      var e = pool[i];
      if (e.life <= 0) continue;
      e.life -= dt;
      e.sp.position.y += dt * (e.big ? 1.5 : 1.1);
      e.sp.material.opacity = Math.max(0, e.life * 1.6);
      if (e.life <= 0) e.sp.visible = false;
    }
    // 特效队列
    if (FX.tick) {
      for (var k = FX.tick.length - 1; k >= 0; k--) {
        if (!FX.tick[k](dt)) FX.tick.splice(k, 1);
      }
    }
  };
})();

/* ============================================================
   摄像机：第三人称跟随 + 碰撞 + 抖动
   ============================================================ */
(function () {
  var J = WL;
  var CAM = J.CAM = {};
  CAM.yaw = Math.PI;
  CAM.pitch = 0.26;
  CAM.dist = 5.4;
  CAM.shakeAmt = 0;
  CAM.pos = new THREE.Vector3();
  CAM.look = new THREE.Vector3();

  CAM.shake = function (a) { CAM.shakeAmt = Math.min(0.7, CAM.shakeAmt + a); };

  CAM.update = function (dt, hero) {
    var targetYaw = J.IN.camYaw;
    CAM.yaw = J.lerp(CAM.yaw, targetYaw, Math.min(1, dt * 8));
    CAM.pitch = J.clamp(J.lerp(CAM.pitch, J.IN.camPitch, Math.min(1, dt * 8)), -0.35, 1.05);

    var focus = new THREE.Vector3(hero.pos.x, hero.pos.y + 1.5, hero.pos.z);
    var cp = Math.cos(CAM.pitch), sp = Math.sin(CAM.pitch);
    var off = new THREE.Vector3(
      -Math.sin(CAM.yaw) * cp * CAM.dist,
      sp * CAM.dist + 0.4,
      -Math.cos(CAM.yaw) * cp * CAM.dist
    );
    var want = focus.clone().add(off);

    // 视线遮挡：地形 + 建筑
    var dir = want.clone().sub(focus);
    var len = dir.length(); dir.normalize();
    var dist = CAM.dist;
    for (var s = 0.25; s <= 1.0; s += 0.06) {
      var p = focus.clone().addScaledVector(dir, len * s);
      var h = J.T.heightAt(p.x, p.z) + 0.55;
      var blocked = p.y < h;
      if (!blocked && J.W.colliders) {
        var cs = J.W.colliders;
        for (var ci = 0; ci < cs.length; ci++) {
          var c = cs[ci];
          if (p.y < 3.4 && Math.abs(p.x - c.x) < c.hw + 0.35 && Math.abs(p.z - c.z) < c.hd + 0.35) { blocked = true; break; }
        }
      }
      if (blocked) { dist = Math.max(1.9, len * s - 0.5); break; }
    }
    want = focus.clone().addScaledVector(dir, dist);

    var hGround = J.T.heightAt(want.x, want.z) + 0.75;
    if (want.y < hGround) want.y = hGround;

    CAM.pos.x = J.damp(CAM.pos.x || want.x, want.x, 12, dt);
    CAM.pos.y = J.damp(CAM.pos.y || want.y, want.y, 12, dt);
    CAM.pos.z = J.damp(CAM.pos.z || want.z, want.z, 12, dt);

    var cam = J.C;
    cam.position.copy(CAM.pos);
    if (CAM.shakeAmt > 0.001) {
      cam.position.x += J.rand(-1, 1) * CAM.shakeAmt * 0.35;
      cam.position.y += J.rand(-1, 1) * CAM.shakeAmt * 0.35;
      cam.position.z += J.rand(-1, 1) * CAM.shakeAmt * 0.35;
      CAM.shakeAmt *= Math.pow(0.0025, dt);
      if (CAM.shakeAmt < 0.002) CAM.shakeAmt = 0;
    }
    cam.lookAt(focus.x, focus.y + 0.35, focus.z);

    // 阴影跟随
    J.updateShadow(hero.pos.x, hero.pos.z);
  };
})();

/* ============================================================
   技能特效：能量月牙 / 光柱 / 地面冲击环 / 尘土 / 闪屏
   ============================================================ */
(function () {
  var J = WL, FX = J.FX;

  function additive(color, opacity) {
    return new THREE.MeshBasicMaterial({
      color: color, transparent: true, opacity: opacity === undefined ? 0.85 : opacity,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false
    });
  }

  /* 月牙能量波：向前飞出的巨大弧光 */
  FX.energyWave = function (pos, dir, color, size) {
    size = size || 1;
    var geo = new THREE.RingGeometry(0.55, 1.6, 26, 1, Math.PI * 0.62, Math.PI * 0.76);
    var mat = additive(color || 0xbfe8ff, 0.95);
    var m = new THREE.Mesh(geo, mat);
    m.position.copy(pos); m.position.y += 1.25;
    m.rotation.y = Math.atan2(dir.x, dir.z) - Math.PI / 2;
    m.rotation.x = -Math.PI / 2 + 0.42;
    m.scale.setScalar(size);
    m.renderOrder = 40;
    J.S.add(m);

    // 核心亮线
    var geo2 = new THREE.RingGeometry(0.9, 1.05, 26, 1, Math.PI * 0.66, Math.PI * 0.68);
    var m2 = new THREE.Mesh(geo2, additive(0xffffff, 1));
    m2.position.copy(m.position); m2.rotation.copy(m.rotation); m2.scale.setScalar(size);
    m2.renderOrder = 41;
    J.S.add(m2);

    var t = 0, life = 0.42, speed = 16 * size;
    FX.tick = FX.tick || [];
    FX.tick.push(function (dt) {
      t += dt;
      var k = t / life;
      m.position.x += dir.x * speed * dt;
      m.position.z += dir.z * speed * dt;
      m2.position.copy(m.position);
      m.scale.setScalar(size * (1 + k * 1.5));
      m2.scale.setScalar(size * (1 + k * 1.4));
      mat.opacity = Math.max(0, 0.95 * (1 - k));
      m2.material.opacity = Math.max(0, 1 - k * 1.4);
      if (t > life) { J.S.remove(m); J.S.remove(m2); geo.dispose(); geo2.dispose(); return false; }
      return true;
    });
  };

  /* 竖直光柱（大斩/落雷） */
  FX.beam = function (pos, color, height, radius) {
    height = height || 9; radius = radius || 0.55;
    var geo = new THREE.CylinderGeometry(radius * 0.35, radius, height, 12, 1, true);
    var mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, fog: false,
      uniforms: { uColor: { value: new THREE.Color(color || 0xcfeaff) }, uT: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: [
        'uniform vec3 uColor; uniform float uT; varying vec2 vUv;',
        'void main(){',
        ' float edge = pow(1.0-abs(vUv.y-0.5)*2.0, 1.4);',
        ' float core = pow(1.0-abs(vUv.x-0.5)*2.0, 3.0);',
        ' float a = (0.35+0.65*core) * edge * (1.0-uT*0.85);',
        ' gl_FragColor = vec4(uColor*(1.0+core), a);',
        '}'
      ].join('\n')
    });
    var m = new THREE.Mesh(geo, mat);
    m.position.set(pos.x, pos.y + height / 2, pos.z);
    m.renderOrder = 42;
    J.S.add(m);
    var t = 0, life = 0.5;
    FX.tick = FX.tick || [];
    FX.tick.push(function (dt) {
      t += dt;
      mat.uniforms.uT.value = t / life;
      m.scale.x = m.scale.z = 1 + (t / life) * 1.8;
      if (t > life) { J.S.remove(m); geo.dispose(); mat.dispose(); return false; }
      return true;
    });
  };

  /* 地面冲击环 */
  FX.groundRing = function (pos, color, maxR, dur) {
    maxR = maxR || 7; dur = dur || 0.55;
    var geo = new THREE.RingGeometry(0.6, 1.0, 36);
    var mat = additive(color || 0xffe2a8, 0.9);
    var m = new THREE.Mesh(geo, mat);
    m.position.set(pos.x, pos.y + 0.06, pos.z);
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = 38;
    J.S.add(m);
    var t = 0;
    FX.tick = FX.tick || [];
    FX.tick.push(function (dt) {
      t += dt;
      var k = t / dur;
      m.scale.setScalar(1 + k * maxR);
      mat.opacity = Math.max(0, 0.9 * (1 - k));
      if (t > dur) { J.S.remove(m); geo.dispose(); mat.dispose(); return false; }
      return true;
    });
  };

  /* 尘土/碎屑 */
  FX.dust = function (pos, n, color) {
    n = n || 18;
    var g = new THREE.BufferGeometry();
    var arr = new Float32Array(n * 3), vel = [];
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.283, r = Math.random() * 0.6;
      arr[i * 3] = pos.x + Math.cos(a) * r;
      arr[i * 3 + 1] = pos.y + Math.random() * 0.3;
      arr[i * 3 + 2] = pos.z + Math.sin(a) * r;
      vel.push(new THREE.Vector3(Math.cos(a) * J.rand(2, 7), J.rand(0.5, 2.6), Math.sin(a) * J.rand(2, 7)));
    }
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    var mat = new THREE.PointsMaterial({ color: color || 0xcbbfa4, size: 0.28, transparent: true, opacity: 0.9, depthWrite: false });
    var p = new THREE.Points(g, mat);
    J.S.add(p);
    var t = 0;
    FX.tick = FX.tick || [];
    FX.tick.push(function (dt) {
      t += dt;
      var at = g.attributes.position;
      for (var i2 = 0; i2 < n; i2++) {
        vel[i2].y -= 5 * dt;
        at.setXYZ(i2, at.getX(i2) + vel[i2].x * dt, Math.max(pos.y + 0.05, at.getY(i2) + vel[i2].y * dt), at.getZ(i2) + vel[i2].z * dt);
      }
      at.needsUpdate = true;
      mat.opacity = Math.max(0, 0.9 * (1 - t / 0.7));
      if (t > 0.7) { J.S.remove(p); g.dispose(); mat.dispose(); return false; }
      return true;
    });
  };

  /* 全屏闪光（DOM，便宜） */
  FX.screenFlash = function (color, dur) {
    var el = document.getElementById('flash');
    if (!el) return;
    el.style.background = color || 'rgba(200,235,255,0.55)';
    el.style.transition = 'none';
    el.style.opacity = '1';
    requestAnimationFrame(function () {
      el.style.transition = 'opacity ' + (dur || 0.32) + 's ease-out';
      el.style.opacity = '0';
    });
  };
})();
