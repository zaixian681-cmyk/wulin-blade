/* ============================================================
   hero.js — 主角「现与在」模型 / 程序化动画 / 移动
   ============================================================ */
window.WL = window.WL || {};
(function () {
  var J = WL;
  var H = J.H = {};

  H.pos = new THREE.Vector3(-78, 0, 0);
  H.face = 1;              // 1 朝右, -1 朝左
  H.vy = 0;
  H.onGround = true;
  H.jumpVel = 7.4;
  H.vel = new THREE.Vector3();
  H.yaw = Math.PI;
  H.hp = 260; H.hpMax = 260;
  H.stam = 100; H.stamMax = 100;
  H.speedWalk = 2.6; H.speedRun = 5.6;
  H.radius = 0.42;
  H.state = 'idle';
  H.weapon = 'dao';

  /* ---------------- 模型 ---------------- */
  function build() {
    var g = new THREE.Group();
    var M = {
      robe: new THREE.MeshStandardMaterial({ color: 0x1a1c22, roughness: 0.86, metalness: 0.03 }),
      robeIn: new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.9 }),
      sash: new THREE.MeshStandardMaterial({ color: 0x7d2a26, roughness: 0.8 }),
      leather: new THREE.MeshStandardMaterial({ color: 0x33241a, roughness: 0.75 }),
      metal: new THREE.MeshStandardMaterial({ color: 0x9aa2a8, roughness: 0.35, metalness: 0.9 }),
      skin: new THREE.MeshStandardMaterial({ color: 0xc9a184, roughness: 0.72 }),
      hair: new THREE.MeshStandardMaterial({ color: 0x0d0d10, roughness: 0.55 })
    };
    H.M = M;

    var root = new THREE.Group();
    g.add(root);
    H.rootNode = root;

    /* 髋 */
    var hips = new THREE.Group(); hips.position.y = 0.92; root.add(hips);
    H.hips = hips;

    /* 裙摆（下裳）：用 lathe 做开衩长袍 */
    var skirtProfile = [];
    for (var i = 0; i <= 6; i++) {
      var t = i / 6;
      skirtProfile.push(new THREE.Vector2(0.30 + t * 0.18, -t * 0.95));
    }
    var skirt = new THREE.Mesh(new THREE.LatheGeometry(skirtProfile, 10), M.robe);
    skirt.castShadow = true;
    hips.add(skirt);
    // 腰封
    var sash = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.33, 0.18, 10), M.sash);
    sash.position.y = 0.06; hips.add(sash);
    var tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 0.04), M.sash);
    tail.position.set(0.12, -0.32, -0.26); tail.rotation.x = 0.12;
    hips.add(tail);

    /* 躯干 */
    var torso = new THREE.Group(); torso.position.y = 0.02; hips.add(torso);
    H.torso = torso;
    var chest = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.28, 0.62, 10), M.robe);
    chest.position.y = 0.34; chest.castShadow = true; torso.add(chest);
    // 交领
    var collar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.16, 10, 1, true), M.robeIn);
    collar.position.y = 0.62; torso.add(collar);
    var vRow = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.02), M.robeIn);
    vRow.position.set(0, 0.44, 0.235); vRow.rotation.z = 0.22; torso.add(vRow);
    var vRow2 = vRow.clone(); vRow2.rotation.z = -0.22; torso.add(vRow2);
    // 护肩
    [-1, 1].forEach(function (s) {
      var pad = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), M.leather);
      pad.scale.set(1.15, 0.7, 1.1);
      pad.position.set(s * 0.27, 0.6, 0);
      torso.add(pad);
    });
    // 背后刀鞘
    var sheath = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 1.15, 6), M.leather);
    sheath.position.set(0.06, 0.36, -0.2);
    sheath.rotation.z = 0.42; sheath.rotation.x = 0.18;
    torso.add(sheath);

    /* 头 */
    var neck = new THREE.Group(); neck.position.y = 0.68; torso.add(neck);
    H.neck = neck;
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.145, 14, 10), M.skin);
    head.scale.set(0.94, 1.06, 0.96);
    head.position.y = 0.14; neck.add(head);
    // 头发
    var hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.155, 14, 10), M.hair);
    hairCap.scale.set(1, 1.02, 1.02);
    hairCap.position.set(0, 0.16, -0.012);
    neck.add(hairCap);
    // 发髻
    var bun = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), M.hair);
    bun.position.set(0, 0.29, -0.06); neck.add(bun);
    var pin = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.26, 4), M.metal);
    pin.rotation.z = Math.PI / 2; pin.position.set(0, 0.31, -0.06); neck.add(pin);
    // 长发（背后）
    var hairLong = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.07), M.hair);
    hairLong.position.set(0, -0.18, -0.12); hairLong.rotation.x = -0.12;
    neck.add(hairLong);
    // 刘海
    var bang = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.09, 0.05), M.hair);
    bang.position.set(0, 0.2, 0.13); neck.add(bang);

    /* 手臂 */
    function arm(side) {
      var sho = new THREE.Group();
      sho.position.set(side * 0.27, 0.56, 0);
      torso.add(sho);
      var upper = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.36, 8), M.robe);
      upper.position.y = -0.18; upper.castShadow = true; sho.add(upper);
      var elbow = new THREE.Group(); elbow.position.y = -0.36; sho.add(elbow);
      var fore = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.05, 0.34, 8), M.robeIn);
      fore.position.y = -0.17; fore.castShadow = true; elbow.add(fore);
      var bracer = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.062, 0.14, 8), M.leather);
      bracer.position.y = -0.28; elbow.add(bracer);
      var hand = new THREE.Group(); hand.position.y = -0.36; elbow.add(hand);
      var palm = new THREE.Mesh(new THREE.SphereGeometry(0.052, 8, 6), M.skin);
      palm.scale.set(1, 1.2, 0.8); hand.add(palm);
      return { shoulder: sho, elbow: elbow, hand: hand };
    }
    H.armR = arm(1);
    H.armL = arm(-1);

    /* 腿（裙下，只有小腿露出） */
    function leg(side) {
      var hip = new THREE.Group();
      hip.position.set(side * 0.12, -0.02, 0);
      hips.add(hip);
      var thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.075, 0.44, 7), M.robeIn);
      thigh.position.y = -0.22; hip.add(thigh);
      var knee = new THREE.Group(); knee.position.y = -0.44; hip.add(knee);
      var shin = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.055, 0.42, 7), M.leather);
      shin.position.y = -0.21; shin.castShadow = true; knee.add(shin);
      var foot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.09, 0.3), M.leather);
      foot.position.set(0, -0.44, 0.07); knee.add(foot);
      return { hip: hip, knee: knee };
    }
    H.legR = leg(1);
    H.legL = leg(-1);

    /* 武器 */
    H.weaponRoot = new THREE.Group();
    H.armR.hand.add(H.weaponRoot);
    H.weaponRoot.position.set(0, -0.05, 0.02);
    H.weapons = {};
    H.weapons.dao = makeDao(M);
    H.weapons.jian = makeJian(M);
    H.weapons.dao.visible = true;
    H.weapons.jian.visible = false;
    H.weaponRoot.add(H.weapons.dao);
    H.weaponRoot.add(H.weapons.jian);

    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; } });
    return g;
  }

  function bladeGeometry(len, width, curve, taper) {
    // 用 extrude 做带弧度的刀身
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

  function makeDao(M) {
    var g = new THREE.Group();
    var blade = new THREE.Mesh(bladeGeometry(0.92, 0.115, 0.1, 0.25),
      new THREE.MeshStandardMaterial({ color: 0xc8ced2, roughness: 0.22, metalness: 0.95 }));
    // 弧度：沿 Y 轴轻微弯曲
    var pos = blade.geometry.attributes.position;
    for (var i = 0; i < pos.count; i++) {
      var y = pos.getY(i);
      pos.setZ(i, pos.getZ(i) + Math.sin(y / 0.92 * Math.PI * 0.5) * 0.10);
    }
    blade.geometry.computeVertexNormals();
    blade.position.y = 0.16;
    g.add(blade);
    var guard = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.022, 10), M.metal);
    guard.position.y = 0.155; g.add(guard);
    var grip = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.24, 8), M.leather);
    grip.position.y = 0.02; g.add(grip);
    var pommel = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), M.metal);
    pommel.position.y = -0.11; g.add(pommel);
    return g;
  }

  function makeJian(M) {
    var g = new THREE.Group();
    var blade = new THREE.Mesh(bladeGeometry(1.0, 0.062, 0, 0.55),
      new THREE.MeshStandardMaterial({ color: 0xd4dade, roughness: 0.16, metalness: 0.96 }));
    blade.position.y = 0.19;
    g.add(blade);
    var guard = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.045), M.metal);
    guard.position.y = 0.18; g.add(guard);
    var grip = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.026, 0.2, 8), M.leather);
    grip.position.y = 0.06; g.add(grip);
    var pommel = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.026, 0.05, 8), M.metal);
    pommel.position.y = -0.05; g.add(pommel);
    return g;
  }

  H.spawn = function (scene, x, z) {
    H.mesh = build();
    scene.add(H.mesh);
    H.pos.set(x, J.ST.groundY(x), 0);
    H.mesh.position.copy(H.pos);
    H.mesh.rotation.y = H.yaw;
    return H.mesh;
  };

  /* ---------------- 移动（横版） ---------------- */
  function clampX(x) {
    return Math.max(J.ST.X0 + 3, Math.min(J.ST.X1 - 3, x));
  }
  H.resolveCollision = function (nx, nz) { return [clampX(nx), 0]; };

  H.snapGround = function () {
    var gy = J.ST.groundY(H.pos.x);
    if (H.onGround) {
      H.pos.y = J.damp(H.pos.y, gy, 22, 1 / 60);
      if (Math.abs(H.pos.y - gy) < 0.02) H.pos.y = gy;
    }
    H.pos.z = 0;
    return gy;
  };

  H.jump = function () {
    if (!H.onGround) return false;
    H.vy = H.jumpVel;
    H.onGround = false;
    return true;
  };

  H.move = function (dt, dirX, dirY, running) {
    var sp = running ? H.speedRun : H.speedWalk;
    if (Math.abs(dirX) > 0.08) {
      H.pos.x = clampX(H.pos.x + dirX * sp * dt);
      H.face = dirX > 0 ? 1 : -1;
      H.speedNow = sp * Math.abs(dirX);
    } else {
      H.speedNow = 0;
    }
    H.yaw = H.face > 0 ? Math.PI / 2 : -Math.PI / 2;
    return Math.abs(dirX);
  };

  /* 重力与落地 */
  H.physics = function (dt) {
    var gy = J.ST.groundY(H.pos.x);
    if (!H.onGround) {
      H.vy -= 21 * dt;
      H.pos.y += H.vy * dt;
      if (H.pos.y <= gy) { H.pos.y = gy; H.vy = 0; H.onGround = true; H.landT = 0.12; }
    } else {
      H.pos.y = gy;
    }
    H.landT = Math.max(0, (H.landT || 0) - dt);
  };

  /* ---------------- 程序化动画 ---------------- */
  var animT = 0, walkPhase = 0;
  H.updateAnim = function (dt, moving, speed) {
    animT += dt;
    var run = J.clamp(speed / H.speedRun, 0, 1);
    walkPhase += dt * (2.6 + run * 5.2);

    var r = H.rootNode, hips = H.hips, torso = H.torso, neck = H.neck;
    var armR = H.armR, armL = H.armL, legR = H.legR, legL = H.legL;

    // 呼吸 / 待机
    var breathe = Math.sin(animT * 1.8) * 0.012;
    torso.position.y = 0.02 + breathe;
    neck.rotation.x = Math.sin(animT * 1.4) * 0.02;

    // 走动摆动
    var sw = Math.sin(walkPhase), sw2 = Math.sin(walkPhase * 2);
    var stride = 0.34 + run * 0.42;
    legR.hip.rotation.x = sw * stride * 0.9;
    legL.hip.rotation.x = -sw * stride * 0.9;
    legR.knee.rotation.x = Math.max(0, -sw) * 0.7 + 0.05;
    legL.knee.rotation.x = Math.max(0, sw) * 0.7 + 0.05;

    hips.position.y = 0.92 + Math.abs(sw2) * 0.035 * (0.4 + run);
    hips.rotation.y = sw * 0.06 * (1 - run * 0.4);
    torso.rotation.y = -sw * 0.08;
    torso.rotation.x = run * 0.14;
    torso.rotation.z = sw * 0.02;

    // 手臂：走动摆 + 持刀姿势
    var baseArmR = -0.5 + run * 0.25;   // 持刀手抬起
    var baseArmL = run * 0.55 - 0.15;
    armR.shoulder.rotation.x = baseArmR - sw * 0.32 * (0.3 + run * 0.7);
    armR.shoulder.rotation.z = -0.32;
    armR.elbow.rotation.x = -0.55 - run * 0.5;
    armL.shoulder.rotation.x = baseArmL + sw * 0.5 * (0.3 + run * 0.7);
    armL.shoulder.rotation.z = 0.22;
    armL.elbow.rotation.x = -0.35 - run * 0.6;

    // 裙摆随速度展开
    H.hips.children[0].scale.set(1 + run * 0.06, 1, 1 + run * 0.06);

    // 攻击覆盖（由 combat 写入 pose）
    if (H.pose) applyPose(H.pose);
  };

  function applyPose(p) {
    var armR = H.armR, armL = H.armL, torso = H.torso, hips = H.hips;
    if (p.armR) {
      armR.shoulder.rotation.x = p.armR[0];
      armR.shoulder.rotation.z = p.armR[1];
      armR.shoulder.rotation.y = p.armR[2] || 0;
    }
    if (p.elbowR !== undefined) armR.elbow.rotation.x = p.elbowR;
    if (p.armL) {
      armL.shoulder.rotation.x = p.armL[0];
      armL.shoulder.rotation.z = p.armL[1];
    }
    if (p.torso) {
      torso.rotation.y = p.torso[0];
      torso.rotation.x = p.torso[1];
      torso.rotation.z = p.torso[2] || 0;
    }
    if (p.hipsY !== undefined) hips.rotation.y = p.hipsY;
    if (p.lean !== undefined) H.rootNode.rotation.x = p.lean;
    if (p.weapon) {
      H.weaponRoot.rotation.x = p.weapon[0];
      H.weaponRoot.rotation.z = p.weapon[1];
    }
  }
  H.applyPose = applyPose;

  H.setWeapon = function (w) {
    H.weapon = w;
    H.weapons.dao.visible = (w === 'dao');
    H.weapons.jian.visible = (w === 'jian');
  };

  H.hurt = function (dmg) {
    H.hp = Math.max(0, H.hp - dmg);
  };
})();
