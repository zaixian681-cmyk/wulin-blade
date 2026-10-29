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
    var face = hero.face || 1;
    // 横版：镜头在 +Z 侧，跟随主角，朝向前方留出视野
    var targetX = hero.pos.x + face * 2.6;
    var targetY = hero.pos.y + 2.3 + (hero.vy > 0 ? 0.3 : 0);

    CAM.pos.x = J.damp(CAM.pos.x || targetX, targetX, 6, dt);
    CAM.pos.y = J.damp(CAM.pos.y || targetY, targetY, 6, dt);
    CAM.pos.z = J.ST.CAM_Z;

    var cam = J.C;
    cam.position.set(CAM.pos.x, CAM.pos.y, CAM.pos.z);
    if (CAM.shakeAmt > 0.001) {
      cam.position.x += J.rand(-1, 1) * CAM.shakeAmt * 0.35;
      cam.position.y += J.rand(-1, 1) * CAM.shakeAmt * 0.3;
      CAM.shakeAmt *= Math.pow(0.0025, dt);
      if (CAM.shakeAmt < 0.002) CAM.shakeAmt = 0;
    }
    cam.lookAt(CAM.pos.x, hero.pos.y + 1.95, 0);

    J.updateShadow(hero.pos.x, 0);
  };
})();
