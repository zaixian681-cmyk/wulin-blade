/* ============================================================
   hero.js — 主角「太玄」：沿用旧版人物模型 + 本作动画与移动
   ============================================================ */
window.WL = window.WL || {};
(function () {
  var J = WL;
  var H = J.H = {};

  H.pos = new THREE.Vector3(-13, 1, 120);
  H.yaw = Math.PI;
  H.hp = 260; H.hpMax = 260;
  H.stam = 100; H.stamMax = 100;
  H.speedWalk = 2.7; H.speedRun = 5.7;
  H.radius = 0.42;
  H.state = 'idle';
  H.weapon = 'dao';

  /* ---------------- 模型（旧版「太玄」） ---------------- */
  function build() {
    var L = WL.buildHero();          // 旧版模型：root / spin / squash / 关节
    H.legacy = L;

    H.rootNode = L.root;
    H.spin = L.spin;
    H.squash = L.squash;
    H.hips = L.hips;
    H.torso = L.torso;
    H.chest = L.chest;
    H.head = L.head;
    H.skirt = L.skirt;
    H.longHair = L.longHair || [];
    H.tassels = L.tassels || [];

    // 统一关节命名（便于动画与姿态复用）
    H.armR = { shoulder: L.armR.sh, upper: L.armR.up, elbow: L.armR.el, fore: L.armR.fore, hand: L.armR.hand };
    H.armL = { shoulder: L.armL.sh, upper: L.armL.up, elbow: L.armL.el, fore: L.armL.fore, hand: L.armL.hand };
    H.legR = { hip: L.legR.hip, knee: L.legR.knee, foot: L.legR.foot };
    H.legL = { hip: L.legL.hip, knee: L.legL.knee, foot: L.legL.foot };

    // 记录初始姿态，动画在其基础上叠加
    H.rest = {
      armR: { x: H.armR.shoulder.rotation.x, y: H.armR.shoulder.rotation.y, z: H.armR.shoulder.rotation.z },
      armL: { x: H.armL.shoulder.rotation.x, y: H.armL.shoulder.rotation.y, z: H.armL.shoulder.rotation.z },
      elR: H.armR.elbow.rotation.x,
      elL: H.armL.elbow.rotation.x,
      torso: { x: H.torso.rotation.x, y: H.torso.rotation.y },
      hips: { y: H.hips.rotation.y },
      head: { x: H.head.rotation.x }
    };

    /* 武器挂点：holder 在右手；里面再加一层 pivot 供姿态微调 */
    H.weaponRoot = L.weaponHolder || (function () {
      var g = new THREE.Group();
      g.position.set(0, -0.05, 0.01);
      L.armR.hand.add(g);
      return g;
    })();
    H.weaponPivot = new THREE.Group();
    H.weaponRoot.add(H.weaponPivot);

    H.weapons = {};

    /* 长刀：旧版「太玄之刃」 */
    try {
      var daoObj = WL.Weapon.create();
      daoObj.root.scale.setScalar(0.92);
      daoObj.root.rotation.set(-1.05, 0, 0.12);
      daoObj.root.position.y = -0.03;
      H.weapons.dao = daoObj.root;
      H.daoObj = daoObj;
      H.weaponPivot.add(daoObj.root);
    } catch (e) {
      H.weapons.dao = makeDao();
      H.weaponPivot.add(H.weapons.dao);
    }

    /* 长剑：本作程序化剑 */
    H.weapons.jian = makeJian();
    H.weapons.jian.visible = false;
    H.weaponPivot.add(H.weapons.jian);

    // 显示用刀
    if (H.weapons.dao) H.weapons.dao.visible = true;

    return L.root;
  }

  function bladeGeometry(len, width, taper) {
    var pts = [];
    var N = 12;
    for (var i = 0; i <= N; i++) {
      var t = i / N;
      pts.push(new THREE.Vector2(-width * (1 - t * taper) / 2, t * len));
    }
    for (var j = N; j >= 0; j--) {
      var t2 = j / N;
      pts.push(new THREE.Vector2(width * (1 - t2 * taper) / 2, t2 * len));
    }
    var shape = new THREE.Shape(pts);
    var geo = new THREE.ExtrudeGeometry(shape, { depth: 0.014, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.004, bevelSegments: 1, steps: 1 });
    geo.translate(0, 0, -0.007);
    return geo;
  }

  function makeDao() {
    var g = new THREE.Group();
    var blade = new THREE.Mesh(bladeGeometry(0.95, 0.12, 0.25),
      new THREE.MeshStandardMaterial({ color: 0xc8ced2, roughness: 0.22, metalness: 0.95 }));
    blade.position.y = 0.16;
    g.add(blade);
    var guard = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.022, 10), new THREE.MeshStandardMaterial({ color: 0x9aa2a8, roughness: 0.35, metalness: 0.9 }));
    guard.position.y = 0.155; g.add(guard);
    var grip = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.24, 8), new THREE.MeshStandardMaterial({ color: 0x33241a, roughness: 0.85 }));
    grip.position.y = 0.02; g.add(grip);
    return g;
  }

  function makeJian() {
    var g = new THREE.Group();
    var mat = new THREE.MeshStandardMaterial({ color: 0xd4dade, roughness: 0.16, metalness: 0.96 });
    var blade = new THREE.Mesh(bladeGeometry(1.0, 0.062, 0.55), mat);
    blade.position.y = 0.19;
    g.add(blade);
    var guard = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.045), new THREE.MeshStandardMaterial({ color: 0x9aa2a8, roughness: 0.35, metalness: 0.9 }));
    guard.position.y = 0.18; g.add(guard);
    var grip = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.026, 0.2, 8), new THREE.MeshStandardMaterial({ color: 0x33241a, roughness: 0.85 }));
    grip.position.y = 0.06; g.add(grip);
    g.rotation.x = -1.15;
    return g;
  }

  H.spawn = function (scene, x, z) {
    H.mesh = build();
    // 合并人物静态网格，降低 draw call
    try { if (WL.optimizeHeroModel) WL.optimizeHeroModel(H.mesh); } catch (e) { }
    scene.add(H.mesh);
    H.pos.set(x, J.T.heightAt(x, z), z);
    H.mesh.position.copy(H.pos);
    H.mesh.rotation.y = H.yaw;
    return H.mesh;
  };

  /* ---------------- 移动与碰撞 ---------------- */
  function resolveCollision(nx, nz) {
    var r = H.radius;
    var cs = J.W.colliders;
    for (var i = 0; i < cs.length; i++) {
      var c = cs[i];
      var minx = c.x - c.hw - r, maxx = c.x + c.hw + r;
      var minz = c.z - c.hd - r, maxz = c.z + c.hd + r;
      if (nx > minx && nx < maxx && nz > minz && nz < maxz) {
        var dl = nx - minx, dr = maxx - nx, dn = nz - minz, df = maxz - nz;
        var m = Math.min(dl, dr, dn, df);
        if (m === dl) nx = minx;
        else if (m === dr) nx = maxx;
        else if (m === dn) nz = minz;
        else nz = maxz;
      }
    }
    return [nx, nz];
  }
  H.resolveCollision = resolveCollision;

  H.snapGround = function () {
    var h = J.T.heightAt(H.pos.x, H.pos.z);
    for (var i = 0; i < J.W.bridges.length; i++) {
      var b = J.W.bridges[i];
      var dx = Math.abs(H.pos.x - b.x), dz = Math.abs(H.pos.z - b.z);
      if (dx < b.len / 2 && dz < b.w / 2 + 0.4) {
        var t = 1 - (dx / (b.len / 2));
        var by = b.y + Math.sin(Math.max(0, Math.min(1, t)) * Math.PI) * b.rise + 0.06;
        h = Math.max(h, by);
      }
    }
    H.pos.y = J.damp(H.pos.y, h, 18, 1 / 60);
    if (Math.abs(H.pos.y - h) > 4) H.pos.y = h;
    return h;
  };

  H.move = function (dt, dirX, dirY, running) {
    var sp = running ? H.speedRun : H.speedWalk;
    var len = Math.hypot(dirX, dirY);
    if (len > 1) { dirX /= len; dirY /= len; len = 1; }
    if (len > 0.05) {
      var nx = H.pos.x + dirX * sp * dt;
      var nz = H.pos.z + dirY * sp * dt;
      var res = resolveCollision(nx, nz);
      H.pos.x = res[0]; H.pos.z = res[1];
      var target = Math.atan2(dirX, dirY);
      var diff = ((target - H.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      H.yaw += diff * Math.min(1, dt * 14);
    }
    H.speedNow = sp * len;
    return len;
  };

  /* ---------------- 程序化动画 ---------------- */
  var animT = 0, walkPhase = 0;
  H.updateAnim = function (dt, moving, speed) {
    animT += dt;
    var run = J.clamp(speed / H.speedRun, 0, 1);
    walkPhase += dt * (2.4 + run * 5.0);

    var sw = Math.sin(walkPhase), sw2 = Math.sin(walkPhase * 2);
    var R = H.rest;

    // 呼吸
    H.chest.position.y = H.chest.position.y * 0 + (0.28 + Math.sin(animT * 1.7) * 0.004);
    H.head.rotation.x = R.head.x + Math.sin(animT * 1.3) * 0.02;

    // 步伐
    var stride = 0.30 + run * 0.46;
    H.legR.hip.rotation.x = sw * stride;
    H.legL.hip.rotation.x = -sw * stride;
    H.legR.knee.rotation.x = Math.max(0, -sw) * 0.55;
    H.legL.knee.rotation.x = Math.max(0, sw) * 0.55;

    // 身体起伏与转动
    H.hips.position.y = 0.86 + Math.abs(sw2) * 0.028 * (0.4 + run);
    H.hips.rotation.y = R.hips.y + sw * 0.05;
    H.torso.rotation.y = sw * 0.07;
    H.torso.rotation.x = run * 0.12;
    H.torso.rotation.z = sw * 0.02;

    // 手臂
    var baseR = -0.35 + run * 0.1;
    var baseL = -0.1 + run * 0.5;
    H.armR.shoulder.rotation.x = baseR - sw * 0.28 * (0.3 + run * 0.7);
    H.armR.shoulder.rotation.z = -0.18;
    H.armR.elbow.rotation.x = -0.45 - run * 0.4;
    H.armL.shoulder.rotation.x = baseL + sw * 0.45 * (0.3 + run * 0.7);
    H.armL.shoulder.rotation.z = 0.16;
    H.armL.elbow.rotation.x = -0.35 - run * 0.45;

    // 长发飘动
    for (var i = 0; i < H.longHair.length; i++) {
      var h = H.longHair[i];
      h.rotation.x = 0.06 + Math.sin(animT * 2.2 + i * 0.6) * (0.05 + run * 0.12);
    }

    // 攻击姿态覆盖
    if (H.pose) applyPose(H.pose);
  };

  function applyPose(p) {
    if (p.armR) {
      H.armR.shoulder.rotation.x = p.armR[0];
      H.armR.shoulder.rotation.z = p.armR[1];
      H.armR.shoulder.rotation.y = p.armR[2] || 0;
    }
    if (p.elbowR !== undefined) H.armR.elbow.rotation.x = p.elbowR;
    if (p.armL) {
      H.armL.shoulder.rotation.x = p.armL[0];
      H.armL.shoulder.rotation.z = p.armL[1];
    }
    if (p.torso) {
      H.torso.rotation.y = p.torso[0];
      H.torso.rotation.x = p.torso[1];
      H.torso.rotation.z = p.torso[2] || 0;
    }
    if (p.hipsY !== undefined) H.hips.rotation.y = p.hipsY;
    if (p.lean !== undefined) H.spin.rotation.x = p.lean;
    if (p.weapon && H.weaponPivot) {
      H.weaponPivot.rotation.x = p.weapon[0] * 0.35;
      H.weaponPivot.rotation.z = p.weapon[1] * 0.35;
    }
  }
  H.applyPose = applyPose;

  H.setWeapon = function (w) {
    H.weapon = w;
    if (H.weapons.dao) H.weapons.dao.visible = (w === 'dao');
    if (H.weapons.jian) H.weapons.jian.visible = (w === 'jian');
  };

  H.hurt = function (dmg) {
    H.hp = Math.max(0, H.hp - dmg);
  };
})();
