/* ============================================================
   foe.js — 敌人：刀客 / 守卫 / 刺客，AI 与受击、破防
   ============================================================ */
window.WL = window.WL || {};
(function () {
  var J = WL;
  var F = J.F = { list: [], idSeq: 0 };

  var TYPES = F.TYPES = {
    blade: {
      name: '江湖刀客', hp: 120, dmg: 14, speed: 3.1, radius: 0.45, reach: 2.2, arc: 0.9,
      breakMax: 100, block: 0, aggro: 16,
      colors: { robe: 0x3b2b2b, trim: 0x7d2a26, skin: 0xc9a184 }
    },
    guard: {
      name: '巡逻守卫', hp: 190, dmg: 18, speed: 2.3, radius: 0.5, reach: 2.4, arc: 1.0,
      breakMax: 150, block: 0.55, aggro: 14,
      colors: { robe: 0x2c3440, trim: 0x5c6a7a, skin: 0xc9a184 }
    },
    assassin: {
      name: '影门刺客', hp: 95, dmg: 20, speed: 4.2, radius: 0.4, reach: 2.1, arc: 0.75,
      breakMax: 80, block: 0.15, aggro: 20,
      colors: { robe: 0x1c1c22, trim: 0x4a3a5a, skin: 0xb8977e }
    }
  };

  function buildModel(t) {
    var g = new THREE.Group();
    var M = {
      robe: new THREE.MeshStandardMaterial({ color: t.colors.robe, roughness: 0.88 }),
      trim: new THREE.MeshStandardMaterial({ color: t.colors.trim, roughness: 0.8 }),
      skin: new THREE.MeshStandardMaterial({ color: t.colors.skin, roughness: 0.75 }),
      hair: new THREE.MeshStandardMaterial({ color: 0x121214, roughness: 0.6 }),
      steel: new THREE.MeshStandardMaterial({ color: 0xa8b0b6, roughness: 0.3, metalness: 0.9 })
    };
    var root = new THREE.Group(); g.add(root);
    var hips = new THREE.Group(); hips.position.y = 0.9; root.add(hips);
    var skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.34, 0.82, 8), M.robe);
    skirt.position.y = -0.4; skirt.castShadow = true; hips.add(skirt);
    var torso = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.56, 8), M.robe);
    torso.position.y = 0.3; torso.castShadow = true; hips.add(torso);
    var belt = new THREE.Mesh(new THREE.CylinderGeometry(0.265, 0.265, 0.1, 8), M.trim);
    belt.position.y = 0.06; hips.add(belt);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.135, 10, 8), M.skin);
    head.position.y = 0.72; hips.add(head);
    var hair = new THREE.Mesh(new THREE.SphereGeometry(0.142, 10, 8), M.hair);
    hair.position.set(0, 0.745, -0.01); hair.scale.set(1, 0.95, 1); hips.add(hair);
    var hat = null;
    if (t.name === '巡逻守卫') {
      hat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.12, 8), M.trim);
      hat.position.y = 0.86; hips.add(hat);
    }
    // 手臂
    function arm(side, holding) {
      var sho = new THREE.Group(); sho.position.set(side * 0.25, 0.5, 0); hips.add(sho);
      var up = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.34, 6), M.robe);
      up.position.y = -0.17; sho.add(up);
      var el = new THREE.Group(); el.position.y = -0.34; sho.add(el);
      var fo = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.05, 0.32, 6), M.skin);
      fo.position.y = -0.16; el.add(fo);
      var hand = new THREE.Group(); hand.position.y = -0.33; el.add(hand);
      if (holding) {
        var w = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.0, 0.012), M.steel);
        w.position.y = 0.35; hand.add(w);
        var grip = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.2, 6), M.trim);
        grip.position.y = -0.06; hand.add(grip);
      }
      return { sho: sho, el: el, hand: hand };
    }
    var armR = arm(1, true), armL = arm(-1, t.name === '巡逻守卫');
    if (t.name === '巡逻守卫') {
      var sh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.5), M.trim);
      sh.position.set(-0.34, 0.28, 0.05);
      hips.add(sh);
    }
    var legR = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.5, 6), M.robe);
    legR.position.set(0.11, -0.85, 0); hips.add(legR);
    var legL = legR.clone(); legL.position.x = -0.11; hips.add(legL);

    g.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
    return { group: g, hips: hips, armR: armR, armL: armL, legR: legR, legL: legL, mats: M };
  }

  F.spawn = function (scene, x, z, typeName) {
    var t = TYPES[typeName] || TYPES.blade;
    var m = buildModel(t);
    var f = {
      id: ++F.idSeq, type: typeName, def: t,
      pos: new THREE.Vector3(x, J.ST.groundY(x), 0),
      home: new THREE.Vector3(x, J.ST.groundY(x), 0),
      yaw: J.rand(0, 6.28),
      hp: t.hp, hpMax: t.hp,
      break: 0, breakMax: t.breakMax,
      state: 'idle', t: 0, atkCd: J.rand(0.6, 1.8),
      radius: t.radius,
      model: m, dead: false, broken: false, executed: false,
      phase: J.rand(0, 6.28), hitFlash: 0
    };
    m.group.position.copy(f.pos);
    scene.add(m.group);
    f.hit = function (dmg, opt) { F.hitFoe(f, dmg, opt); };
    f.die = function (exec) { F.dieFoe(f, exec); };
    f.stagger = function (sec) {
      f.state = 'stagger'; f.t2 = sec || 0.6;
      f.model.group.rotation.y = 0;
      J.FX.text('硬直', f.pos, '#9fe8ff');
    };
    F.list.push(f);
    return f;
  };

  /* ---------------- 更新 ---------------- */
  F.update = function (dt, player) {
    for (var i = F.list.length - 1; i >= 0; i--) {
      var f = F.list[i];
      updateOne(f, dt, player);
      if (f.removeTimer !== undefined) {
        f.removeTimer -= dt;
        if (f.removeTimer <= 0) {
          J.S.remove(f.model.group);
          F.list.splice(i, 1);
        }
      }
    }
  };

  function updateOne(f, dt, P) {
    if (f.dead) {
      f.model.group.rotation.z = J.damp(f.model.group.rotation.z, 1.45 * (f.deadDir || 1), 6, dt);
      f.model.group.position.y = J.damp(f.model.group.position.y, f.pos.y - 0.1, 6, dt);
      if (f.removeTimer === undefined) f.removeTimer = f.executed ? 4 : 5;
      return;
    }
    var dx = P.pos.x - f.pos.x, dz = 0;
    var dist = Math.abs(dx);
    var face = dx >= 0 ? 1 : -1;
    var t = f.def;
    f.t += dt;
    f.hitFlash = Math.max(0, f.hitFlash - dt * 4);
    if (f.state === 'stagger') {
      f.t2 = (f.t2 || 0) - dt;
      f.model.group.rotation.x = Math.sin(f.t2 * 20) * 0.05;
      if (f.t2 <= 0) { f.state = 'chase'; f.model.group.rotation.x = 0; }
      return;
    }

    if (f.state === 'broken') {
      f.brokenT = (f.brokenT || 0) - dt;
      f.model.group.rotation.x = J.damp(f.model.group.rotation.x, -0.35, 8, dt);
      if (f.brokenT <= 0) {
        f.broken = false;
        f.break = 0;
        f.state = 'chase';
        f.model.group.rotation.x = 0;
      }
      return;
    }

    if (f.state === 'attack') {
      f.atkT += dt;
      var a = f.atkData;
      var ph = f.atkT / a.total;
      // 动作
      var arm = f.model.armR;
      if (f.atkT < a.wind) {
        var k = f.atkT / a.wind;
        arm.sho.rotation.x = J.lerp(-0.4, -1.9, k);
        f.model.hips.rotation.y = J.lerp(0, -0.4, k);
        // 蓄力提示
        f.telegraph = 1;
      } else if (f.atkT < a.wind + a.act) {
        var k2 = (f.atkT - a.wind) / a.act;
        arm.sho.rotation.x = J.lerp(-1.9, 0.6, k2);
        f.model.hips.rotation.y = J.lerp(-0.4, 0.45, k2);
        f.telegraph = 0;
        if (!f.didHit && k2 > 0.35) {
          f.didHit = true;
          if (dist < t.reach + 0.5 && (P.pos.x - f.pos.x) * face > -0.5 && Math.abs(P.pos.y - f.pos.y) < 1.9) {
            J.CB.playerHit(t.dmg, f.pos, false);
          }
          J.FX.swipe(f.pos, f.yaw);
        }
      } else {
        var k3 = (f.atkT - a.wind - a.act) / a.rec;
        arm.sho.rotation.x = J.lerp(0.6, -0.4, k3);
        f.model.hips.rotation.y = J.lerp(0.45, 0, k3);
      }
      if (f.atkT >= a.total) {
        f.state = 'chase';
        f.atkCd = J.rand(0.5, 1.4) * (f.type === 'assassin' ? 0.6 : 1);
        f.model.hips.rotation.y = 0;
      }
      return;
    }

    // 追击 / 巡逻
    if (dist < t.aggro) {
      f.state = 'chase';
      f.yaw = face > 0 ? Math.PI / 2 : -Math.PI / 2;
      if (dist > t.reach * 0.85) {
        var sp = t.speed * (dist > 6 ? 1 : 0.7);
        f.pos.x += face * sp * dt;
        // 走路动画
        f.phase += dt * 8;
        f.model.legR.rotation.x = Math.sin(f.phase) * 0.5;
        f.model.legL.rotation.x = -Math.sin(f.phase) * 0.5;
      } else {
        f.atkCd -= dt;
        if (f.atkCd <= 0) {
          f.state = 'attack';
          f.atkT = 0;
          f.didHit = false;
          f.atkData = { wind: f.type === 'assassin' ? 0.22 : 0.42, act: 0.16, rec: f.type === 'assassin' ? 0.2 : 0.34, total: 0 };
          f.atkData.total = f.atkData.wind + f.atkData.act + f.atkData.rec;
          f.atkCd = J.rand(1.2, 2.4);
        }
      }
    } else {
      // 巡逻回到原位
      f.state = 'idle';
      var hx = f.home.x - f.pos.x;
      var hd = Math.abs(hx);
      if (hd > 2) { f.pos.x += (hx / hd) * 1.4 * dt; f.yaw = hx > 0 ? Math.PI / 2 : -Math.PI / 2; }
      f.phase += dt * 1.5;
    }

    f.pos.y = J.ST.groundY(f.pos.x);
    f.model.group.position.set(f.pos.x, f.pos.y, 0);
    f.model.group.rotation.y = f.yaw;

    // 受击闪白
    var m = f.model.mats.robe;
    if (f.hitFlash > 0) m.emissive.setRGB(f.hitFlash * 0.5, f.hitFlash * 0.15, f.hitFlash * 0.1);
    else m.emissive.setRGB(0, 0, 0);

    // 蓄力红光
    if (f.telegraph > 0) {
      m.emissive.setRGB(0.55, 0.1, 0.05);
      f.telegraph = Math.max(0, f.telegraph - dt * 2);
    }

    // 破防光环
    if (f.broken) m.emissive.setRGB(0.35, 0.28, 0.05);
  }

  /* ---------------- 受击 ---------------- */
  F.hitFoe = function (f, dmg, opt) {
    if (f.dead) return;
    opt = opt || {};
    f.hp -= dmg;
    f.hitFlash = 1;
    // 破防值
    if (f.def.block > 0 && f.state !== 'attack' && Math.random() < f.def.block) {
      f.break += (opt.breakDmg || 10) * 1.6;
    } else {
      f.break += (opt.breakDmg || 10);
    }
    if (f.break >= f.breakMax && !f.broken && f.hp > 0) {
      f.broken = true;
      f.state = 'broken';
      f.brokenT = 3.2;
      f.break = f.breakMax;
      J.FX.text('破防', f.pos, '#ffd166');
      J.FX.burst(f.pos, 0xffd166);
    }
    if (f.hp <= 0) {
      f.hp = 0;
      f.die(false);
    } else if (!f.broken) {
      // 硬直
      if (Math.random() < 0.45) { f.state = 'stagger'; f.t2 = 0.28; }
    }
  };

  /* ---------------- 死亡 ---------------- */
  F.nearestTo = function (pos, maxDist) {
    var best = null, bd = maxDist === undefined ? 1e9 : maxDist;
    for (var i = 0; i < F.list.length; i++) {
      var f = F.list[i];
      if (f.dead) continue;
      var d = Math.abs(f.pos.x - pos.x);
      if (d < bd) { bd = d; best = f; }
    }
    return best;
  };

  F.dieFoe = function (f, executed) {
    if (f.dead) return;
    f.dead = true;
    f.state = 'dead';
    f.executed = !!executed;
    f.removeTimer = executed ? 4 : 5;
    f.model.group.rotation.z = 0;
    J.FX.burst(f.pos, 0xaa3333);
    J.PROG && J.PROG.onKill(f);
  };
})();