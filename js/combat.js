/* ============================================================
   combat.js — 战斗状态机 / 连招 / 弹反 / 破防处决 / 打击反馈
   ============================================================ */
window.WL = window.WL || {};
(function () {
  var J = WL;
  var CB = J.CB = {};

  /* ---------------- 武器与连招数据 ---------------- */
  var DATA = CB.DATA = {
    dao: {
      name: '长刀', label: '断岳刀',
      dmg: 30, crit: 0.20, critMul: 1.9, break: 26, reach: 3.5, arc: 1.42,
      stamCost: 9,
      combo: [
        { id: 'd1', name: '横斩', wind: 0.10, act: 0.12, rec: 0.20, dmg: 1.0, brk: 1.0, lunge: 0.55, pose: swing({ a0: -1.35, a1: 0.85, t0: -0.5, t1: 0.55, lift: 0.22 }) },
        { id: 'd2', name: '反手斩', wind: 0.09, act: 0.12, rec: 0.22, dmg: 1.1, brk: 1.05, lunge: 0.5, pose: swing({ a0: 0.95, a1: -1.25, t0: 0.55, t1: -0.5, lift: 0.18 }) },
        { id: 'd3', name: '回身劈', wind: 0.14, act: 0.14, rec: 0.30, dmg: 1.55, brk: 1.5, lunge: 0.9, pose: chop({ a0: 1.15, a1: -1.5, t0: 0.7, t1: -0.25 }) },
        { id: 'd4', name: '崩山斩', wind: 0.12, act: 0.13, rec: 0.26, dmg: 1.35, brk: 1.3, lunge: 0.7, pose: swing({ a0: -1.1, a1: 1.0, t0: -0.4, t1: 0.65, lift: 0.3 }) }
      ]
    },
    jian: {
      name: '长剑', label: '霜隐剑',
      dmg: 20, crit: 0.26, critMul: 1.75, break: 14, reach: 3.8, arc: 0.95,
      stamCost: 7,
      combo: [
        { id: 'j1', name: '直刺', wind: 0.07, act: 0.09, rec: 0.14, dmg: 0.95, brk: 0.7, lunge: 0.85, pose: thrust({ from: 0.9, to: -1.35 }) },
        { id: 'j2', name: '撩剑', wind: 0.06, act: 0.09, rec: 0.14, dmg: 0.85, brk: 0.7, lunge: 0.5, pose: swing({ a0: -1.2, a1: 0.7, t0: -0.3, t1: 0.42, lift: 0.12 }) },
        { id: 'j3', name: '连刺', wind: 0.06, act: 0.1, rec: 0.16, dmg: 1.0, brk: 0.8, lunge: 0.9, pose: thrust({ from: 0.7, to: -1.4 }) },
        { id: 'j4', name: '挑剑', wind: 0.08, act: 0.1, rec: 0.18, dmg: 1.15, brk: 1.0, lunge: 0.6, pose: chop({ a0: -0.4, a1: 1.35, t0: 0.1, t1: -0.1 }) },
        { id: 'j5', name: '旋剑斩', wind: 0.09, act: 0.12, rec: 0.22, dmg: 1.3, brk: 1.1, lunge: 0.7, pose: swing({ a0: 1.1, a1: -1.3, t0: 0.6, t1: -0.55, lift: 0.2 }) }
      ]
    }
  };

  /* ---------------- 技能表 ---------------- */
  var SKILLS = CB.SKILLS = {
    dao: {
      id: 'bengshan', name: '崩山斩', cd: 5.2, cost: 26, dur: 0.95,
      dmgMul: 2.6, brkMul: 3.0, radius: 5.2, forward: 1.4,
      color: 0xffd8a0, wave: 0xfff2d0, flash: 'rgba(255,225,180,0.35)'
    },
    jian: {
      id: 'liuxing', name: '流星追月', cd: 4.2, cost: 20, dur: 1.05,
      dmgMul: 2.0, brkMul: 2.0, radius: 4.4, forward: 4.6,
      color: 0x9fd8ff, wave: 0xdfefff, flash: 'rgba(190,230,255,0.32)'
    }
  };

  /* ---- 动作曲线：返回 poseFn(t in 0..1, phase) ---- */
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function swing(p) {
    return function (t) {
      var e = easeOut(t);
      var a = J.lerp(p.a0, p.a1, e);
      var tw = J.lerp(p.t0, p.t1, e);
      return {
        armR: [a, -0.22 - p.lift, 0],
        elbowR: -0.55 + e * 0.35,
        armL: [0.35 - e * 0.35, 0.5],
        torso: [tw, 0.06 + e * 0.1, -tw * 0.35],
        hipsY: tw * 0.55,
        weapon: [0.15, 0.35 - e * 0.2],
        lean: e * 0.06
      };
    };
  }
  function chop(p) {
    return function (t) {
      var e = t < 0.6 ? easeInOut(t / 0.6) : 1;
      var a = J.lerp(p.a0, p.a1, e);
      var tw = J.lerp(p.t0, p.t1, e);
      return {
        armR: [a, -0.35, 0],
        elbowR: -0.9 + e * 0.55,
        armL: [0.2, 0.6],
        torso: [tw * 0.6, 0.22 * Math.sin(e * Math.PI), 0],
        hipsY: tw * 0.3,
        weapon: [0.35 - e * 0.5, 0.2],
        lean: 0.1 * Math.sin(e * Math.PI)
      };
    };
  }
  function thrust(p) {
    return function (t) {
      var e = easeOut(t);
      var a = J.lerp(p.from, p.to, e);
      return {
        armR: [a, -0.12, 0],
        elbowR: -1.0 + e * 0.85,
        armL: [0.4 - e * 0.6, 0.45],
        torso: [-0.12 + e * 0.3, 0.1, 0],
        hipsY: 0.12 * e,
        weapon: [1.35, 0.1],
        lean: 0.05 * e
      };
    };
  }

  /* 自动吸附：选最近的敌人 */
  CB.pickTarget = function (maxD) {
    var H = J.H;
    var best = null, bd = maxD || 8.5;
    var list = J.F.list || [];
    for (var i = 0; i < list.length; i++) {
      var f = list[i];
      if (f.dead) continue;
      var dx = f.pos.x - H.pos.x, dz = f.pos.z - H.pos.z;
      var d = Math.hypot(dx, dz);
      if (d > bd) continue;
      // 只吸附前方的目标（背后不打）
      var ang = Math.atan2(dx, dz);
      var diff = Math.abs(((ang - H.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (diff > 2.0) continue;
      if (d < bd) { bd = d; best = f; }
    }
    S.lock = best;
    return best;
  };

  /* ---------------- 状态 ---------------- */
  var S = CB.S = {
    atk: null,
    comboIdx: 0,
    comboTimer: 0,
    blockHeld: false,
    blockT: 0,
    parryT: 0,
    iframe: 0,
    dodgeT: 0,
    dodgeDir: new THREE.Vector3(),
    hitStop: 0,
    execTarget: null,
    execT: 0,
    cooldown: 0,
    log: []
  };

  CB.init = function (fx) { CB.fx = fx; };

  /* ---------------- 输入 ---------------- */
  CB.onAttackPressed = function (heavy) {
    if (J.H.state === 'dead' || J.H.state === 'exec') return;
    if (J.H.state === 'dodge' && S.dodgeT > 0.12) return;
    // 连招窗口内则排队
    if (S.atk) {
      if (S.atk.t < S.atk.total * 0.72) { S.atk.queued = heavy ? 'heavy' : 'light'; return true; }
      return false;
    }
    startAttack(heavy);
    return true;
  };

  CB.onDodge = function () {
    var H = J.H;
    if (S.atk || H.state === 'dead' || H.state === 'exec') return false;
    if (H.stam < 22) return false;
    H.stam -= 22;
    H.state = 'dodge';
    S.dodgeT = 0.42;
    S.iframe = 0.3;
    var m = J.IN.move;
    var len = Math.hypot(m.x, m.y);
    var cy = J.IN.camYaw;
    if (len < 0.15) {
      // 没有方向输入：向后闪（背离朝向）
      S.dodgeDir.set(-Math.sin(H.yaw), 0, -Math.cos(H.yaw));
    } else {
      // 与移动同一套相机相对换算
      var wx = Math.sin(cy) * m.y - Math.cos(cy) * m.x;
      var wz = Math.cos(cy) * m.y + Math.sin(cy) * m.x;
      S.dodgeDir.set(wx / len, 0, wz / len);
    }
    return true;
  };

  /* ---------------- 技能 ---------------- */
  CB.skillCd = { dao: 0, jian: 0 };
  CB.castSkill = function () {
    var H = J.H;
    if (H.state === 'dead' || H.state === 'exec' || S.atk) return false;
    var sk = SKILLS[H.weapon];
    if (!sk) return false;
    if (CB.skillCd[H.weapon] > 0) { CB.fx.text('冷却中', H.pos, '#9fb4c8'); return false; }
    if (H.stam < sk.cost) { CB.fx.text('体力不足', H.pos, '#ff9a9a'); return false; }

    H.stam -= sk.cost;
    CB.skillCd[H.weapon] = sk.cd;

    // 吸附目标
    var tgt = CB.pickTarget(9);
    if (tgt) {
      H.yaw = Math.atan2(tgt.pos.x - H.pos.x, tgt.pos.z - H.pos.z);
      var dx = tgt.pos.x - H.pos.x, dz = tgt.pos.z - H.pos.z;
      var d = Math.hypot(dx, dz);
      // 面向目标
    }
    S.skill = {
      sk: sk, t: 0, hitDone: false,
      dir: new THREE.Vector3(Math.sin(H.yaw), 0, Math.cos(H.yaw)),
      target: tgt
    };
    H.state = 'skill';
    S.comboIdx = 0;
    S.comboTimer = 0;

    var fwd = S.skill.dir;
    if (sk.id === 'bengshan') {
      // 崩山斩：跃起下劈，地面冲击环 + 巨斩月牙
      CB.fx.groundRing(H.pos, 0xffd8a0, 9, 0.75);
      CB.fx.dust(H.pos, 22, 0xd8c9a8);
      J.CAM.shake(0.22);
      if (J.Slash) { J.Slash.begin(); J.Slash.setColor(0xfff0d0, 0xffb060); }
    } else {
      // 流星追月：多段突进
      if (J.Slash) { J.Slash.begin(); J.Slash.setColor(0xeaf7ff, 0x7fc4ff); }
    }
    return true;
  };

  CB.onSwap = function () {
    var H = J.H;
    if (S.atk || H.state === 'exec') return;
    H.setWeapon(H.weapon === 'dao' ? 'jian' : 'dao');
    S.comboIdx = 0;
    CB.fx.text('换 ' + DATA[H.weapon].label, H.pos, '#cfe6ff');
  };

  CB.tryExecute = function () {
    var H = J.H;
    var target = null, best = 1e9;
    (J.F.list || []).forEach(function (f) {
      if (f.dead || !f.broken) return;
      var d = Math.hypot(f.pos.x - H.pos.x, f.pos.z - H.pos.z);
      if (d < 3.0 && d < best) { best = d; target = f; }
    });
    if (!target) return false;
    S.execTarget = target;
    S.execT = 0;
    H.state = 'exec';
    H.yaw = Math.atan2(target.pos.x - H.pos.x, target.pos.z - H.pos.z);
    target.executed = true;
    return true;
  };

  /* ---------------- 攻击 ---------------- */
  function startAttack(heavy) {
    var H = J.H;
    var w = DATA[H.weapon];
    // 自动吸附：攻击瞬间转身面向最近目标，并自动贴近
    var tgt = CB.pickTarget(8.0);
    if (tgt) {
      var dx = tgt.pos.x - H.pos.x, dz = tgt.pos.z - H.pos.z;
      var d = Math.hypot(dx, dz) || 1;
      H.yaw = Math.atan2(dx, dz);
      if (d > w.reach * 0.75) {
        var step = Math.min(d - w.reach * 0.65, 1.6);
        H.pos.x += dx / d * step;
        H.pos.z += dz / d * step;
      }
    }
    if (H.stam < w.stamCost) { CB.fx.text('力竭', H.pos, '#ff9a9a'); return; }
    H.stam -= w.stamCost;
    if (S.comboTimer <= 0) S.comboIdx = 0;
    var idx = Math.min(S.comboIdx, w.combo.length - 1);
    var c = w.combo[idx];
    var total = c.wind + c.act + c.rec;
    S.atk = {
      c: c, w: w, t: 0, total: total,
      wind: c.wind, act: c.act, rec: c.rec,
      hitSet: {}, didHit: false, queued: null, heavy: !!heavy,
      dmgMul: c.dmg * (heavy ? 1.5 : 1.0),
      brkMul: c.brk * (heavy ? 1.6 : 1.0)
    };
    H.state = 'attack';
    // 突进
    if (c.lunge) {
      var fwd = new THREE.Vector3(Math.sin(H.yaw), 0, Math.cos(H.yaw));
      var res = H.resolveCollision(H.pos.x + fwd.x * c.lunge * 0.55, H.pos.z + fwd.z * c.lunge * 0.55);
      H.pos.x = res[0]; H.pos.z = res[1];
    }
    // 旧版刀光：清空轨迹并按武器配色
    if (J.Slash) {
      J.Slash.begin();
      if (H.weapon === 'dao') J.Slash.setColor(0xfff3e0, 0xffc177);
      else J.Slash.setColor(0xeaf6ff, 0x7fc4ff);
    }
    S.comboIdx = idx + 1;
    if (S.comboIdx >= w.combo.length) S.comboIdx = w.combo.length;  // 等待重置
    S.comboTimer = 0.9;
    CB.fx.slash(H, idx);
  }

  /* ---------------- 主更新 ---------------- */
  var _bp = null;
  function bladeSample(active) {
    if (!J.Slash) return;
    if (!_bp) _bp = { root: new THREE.Vector3(), tip: new THREE.Vector3(), rootOuter: new THREE.Vector3(), tipOuter: new THREE.Vector3() };
    var p = J.H.bladePoints && J.H.bladePoints(_bp);
    if (!p) return;
    if (active) J.Slash.push(p.root, p.tip, p.rootOuter, p.tipOuter);
  }

  CB.update = function (dt) {
    var H = J.H;
    S.comboTimer = Math.max(0, S.comboTimer - dt);
    CB.skillCd.dao = Math.max(0, CB.skillCd.dao - dt);
    CB.skillCd.jian = Math.max(0, CB.skillCd.jian - dt);
    if (S.comboTimer === 0) S.comboIdx = 0;
    S.iframe = Math.max(0, S.iframe - dt);
    S.hitStop = Math.max(0, S.hitStop - dt);

    // 体力
    if (H.state !== 'dodge' && H.state !== 'attack') {
      H.stam = Math.min(H.stamMax, H.stam + dt * (S.blockHeld ? 14 : 30));
    }

    // 格挡
    S.blockHeld = J.IN.block;
    if (S.blockHeld && !S.atk && H.state !== 'dodge' && H.state !== 'exec' && H.state !== 'dead') {
      H.state = 'block';
      S.blockT += dt;
      H.stam = Math.max(0, H.stam - dt * 6);
    } else if (H.state === 'block') {
      H.state = 'idle';
      S.blockT = 0;
    }

    /* 攻击推进 */
    if (S.atk) {
      var a = S.atk;
      a.t += dt;
      var ph = a.t / a.total;
      // 姿态
      if (a.t <= a.wind) {
        var tw = a.t / a.wind;
        var p1 = a.c.pose(0);
        H.pose = p1;   // 预备动作
      } else if (a.t <= a.wind + a.act) {
        var t2 = (a.t - a.wind) / a.act;
        H.pose = a.c.pose(t2);
        // 刀光轨迹
        bladeSample(true);
        // 命中判定
        doHitCheck(a, t2);
      } else {
        var t3 = Math.min(1, (a.t - a.wind - a.act) / Math.max(0.001, a.rec));
        H.pose = a.c.pose(1 - t3 * 0.6);
      }
      if (a.t >= a.total) {
        H.pose = null;
        var q = a.queued;
        S.atk = null;
        H.state = 'idle';
        if (q) {
          // 输入缓冲：攻击结束立即接下一招（不跨帧，避免丢失）
          startAttack(q === 'heavy');
        }
      }
    } else {
      H.pose = null;
    }

    /* 闪避 */
    if (H.state === 'dodge') {
      S.dodgeT -= dt;
      var sp = 9.5 * Math.max(0, S.dodgeT / 0.42);
      var res = H.resolveCollision(H.pos.x + S.dodgeDir.x * sp * dt, H.pos.z + S.dodgeDir.z * sp * dt);
      H.pos.x = res[0]; H.pos.z = res[1];
      H.mesh.rotation.z = -S.dodgeDir.x * 0.25;
      if (S.dodgeT <= 0) { H.mesh.rotation.z = 0; H.state = 'idle'; }
    }

    /* 处决 */
    if (H.state === 'exec') {
      S.execT += dt;
      var tg = S.execTarget;
      if (tg && S.execT < 0.45) {
        var dx = tg.pos.x - H.pos.x, dz = tg.pos.z - H.pos.z;
        H.pos.x += dx * dt * 6; H.pos.z += dz * dt * 6;
      }
      H.pose = {
        armR: [-1.7 + S.execT * 3.4, -0.1, 0], elbowR: -0.4,
        armL: [-1.2, 0.25], torso: [0.12, -0.15, 0], hipsY: 0.2, weapon: [1.1, 0.1], lean: 0.1
      };
      if (S.execT > 0.42 && tg && !tg.execDead) {
        tg.execDead = true;
        tg.die(true);
        CB.fx.execFlash(tg.pos);
        J.CAM.shake(0.35);
        S.hitStop = 0.09;
      }
      if (S.execT > 1.15) {
        H.pose = null;
        S.execTarget = null;
        H.state = 'idle';
      }
    }

    /* 技能推进 */
    if (S.skill && H.state === 'skill') {
      var sk2 = S.skill, skdef = sk2.sk;
      sk2.t += dt;
      var k = sk2.t / skdef.dur;
      if (skdef.id === 'bengshan') {
        // 前半段抬手蓄力，0.35 处下劈并触发冲击波
        if (k < 0.4) {
          H.pose = { armR: [1.6 - k * 2, -0.2, 0], elbowR: -0.5, armL: [-1.2, 0.3], torso: [-0.5, -0.35, 0], hipsY: 0.2, weapon: [0.3, 0.1], lean: -0.1 };
        } else {
          H.pose = { armR: [-1.4 + k, -0.3, 0], elbowR: -0.3, armL: [0.5, 0.4], torso: [0.4, 0.4, 0], hipsY: -0.2, weapon: [1.0, 0.1], lean: 0.16 };
        }
        if (!sk2.hitDone && k >= 0.4) {
          sk2.hitDone = true;
          // 巨斩：向前推出能量月牙 + 光柱 + 闪屏
          var p0 = new THREE.Vector3(J.H.pos.x, J.H.pos.y, J.H.pos.z);
          CB.fx.energyWave(p0, sk2.dir, 0xffe9c0, 1.9);
          CB.fx.beam(new THREE.Vector3(p0.x + sk2.dir.x * 1.6, p0.y, p0.z + sk2.dir.z * 1.6), 0xffe2b0, 8, 0.7);
          CB.fx.groundRing(p0, 0xffd8a0, 12, 0.6);
          CB.fx.dust(p0, 26, 0xd8c9a8);
          CB.fx.screenFlash(skdef.flash, 0.3);
          J.CAM.shake(0.45);
          S.hitStop = 0.08;
          skillDamage(skdef, p0, 3.2);
        }
      } else {
        // 流星追月：向前突进 + 连续三段斩
        if (k < 0.75) {
          J.H.pos.x += sk2.dir.x * 9 * dt;
          J.H.pos.z += sk2.dir.z * 9 * dt;
          H.pose = { armR: [-0.6, -0.15, 0], elbowR: -1.2, armL: [0.8, 0.3], torso: [0.35, 0.15, 0], hipsY: 0.12, weapon: [1.3, 0.1], lean: 0.18 };
          if (J.Slash) {
            var bp = J.H.bladePoints && J.H.bladePoints({ root: new THREE.Vector3(), tip: new THREE.Vector3(), rootOuter: new THREE.Vector3(), tipOuter: new THREE.Vector3() });
            if (bp) J.Slash.push(bp.root, bp.tip, bp.rootOuter, bp.tipOuter);
          }
        } else {
          H.pose = { armR: [-1.1, -0.3, 0], elbowR: -0.4, armL: [0.4, 0.4], torso: [-0.3, 0.2, 0], hipsY: -0.1, weapon: [1.0, 0.1], lean: 0.05 };
        }
        if (!sk2.hitDone && k >= 0.18) {
          sk2.hitDone = true;
          var p1 = new THREE.Vector3(J.H.pos.x, J.H.pos.y, J.H.pos.z);
          CB.fx.energyWave(p1, sk2.dir, 0xbfe8ff, 1.2);
          CB.fx.screenFlash(skdef.flash, 0.25);
          J.CAM.shake(0.28);
          skillDamage(skdef, p1, 2.6);
        }
      }
      if (k >= 1) {
        S.skill = null;
        H.pose = null;
        H.state = 'idle';
      }
    }

    /* 受击恢复 */
    if (H.state === 'hit') {
      S.hitRecover = (S.hitRecover || 0) - dt;
      if (S.hitRecover <= 0) H.state = 'idle';
    }

    /* 死亡 */
    if (H.hp <= 0 && H.state !== 'dead') {
      H.state = 'dead';
      H.mesh.rotation.x = -1.45;
      J.UI.toast('你倒下了……');
      setTimeout(function () { J.GAME.respawn(); }, 2200);
    }
  };

  function skillDamage(sk, center, mul) {
    var H = J.H;
    var w = DATA[H.weapon];
    (J.F.list || []).forEach(function (f) {
      if (f.dead) return;
      var d = Math.hypot(f.pos.x - center.x, f.pos.z - center.z);
      if (d > sk.radius) return;
      var isCrit = Math.random() < w.crit + 0.25;
      var dmg = w.dmg * sk.dmgMul * (isCrit ? w.critMul : 1) * J.rand(0.95, 1.05);
      f.hit(dmg, { crit: isCrit, breakDmg: w.break * sk.brkMul, from: center, heavy: true });
      CB.fx.hitSpark(f.pos, true);
      CB.fx.text(Math.round(dmg) + (isCrit ? '!' : ''), f.pos, isCrit ? '#ffd166' : '#ffffff', isCrit);
    });
  }

  /* ---------------- 命中检测 ---------------- */
  function doHitCheck(a, t) {
    if (a.didHit && t < 0.85) return;
    var H = J.H;
    var w = a.w;
    var fx = Math.sin(H.yaw), fz = Math.cos(H.yaw);
    var hitAny = false;
    (J.F.list || []).forEach(function (f) {
      if (f.dead || a.hitSet[f.id]) return;
      var dx = f.pos.x - H.pos.x, dz = f.pos.z - H.pos.z;
      var dist = Math.hypot(dx, dz);
      if (dist > w.reach + (f.radius || 0.45) + 0.35) return;
      var ang = Math.atan2(dx, dz);
      var diff = Math.abs(((ang - H.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (diff > w.arc) return;
      a.hitSet[f.id] = true;
      hitAny = true;
      var isCrit = Math.random() < w.crit;
      var dmg = a.w.dmg * a.dmgMul * (isCrit ? w.critMul : 1) * J.rand(0.94, 1.06);
      var brk = w.break * a.brkMul;
      f.hit(dmg, { crit: isCrit, breakDmg: brk, from: H.pos, heavy: a.heavy });
      CB.fx.hitSpark(f.pos, isCrit);
      CB.fx.text(Math.round(dmg) + (isCrit ? '!' : ''), f.pos, isCrit ? '#ffd166' : '#ffffff', isCrit);
      S.hitStop = Math.max(S.hitStop, isCrit ? 0.055 : 0.032);
      J.CAM.shake(isCrit ? 0.16 : 0.07);
    });
    if (hitAny) a.didHit = true;
  }

  /* ---------------- 玩家受击 ---------------- */
  CB.playerHit = function (dmg, fromPos, isHeavy) {
    var H = J.H;
    H._noHitT = 0;
    if (H.state === 'dead') return;
    if (S.iframe > 0) return;

    // 弹反判定：格挡中且按下 0.22s 内
    if (S.blockHeld && S.blockT < 0.22) {
      S.blockT = 0.6;
      H.stam = Math.min(H.stamMax, H.stam + 12);
      S.hitStop = 0.1;
      J.CAM.shake(0.2);
      CB.fx.parryFlash(H.pos);
      CB.fx.text('弹反！', H.pos, '#9fe8ff');
      // 反弹伤害与硬直
      var attacker = J.F.nearestTo(fromPos, 3.2);
      if (attacker) attacker.stagger(1.1);
      S.comboTimer = 1.2;
      S.comboIdx = 0;
      return;
    }
    if (S.blockHeld) {
      var cost = dmg * 0.55;
      H.stam -= cost * 1.4;
      if (H.stam <= 0) {
        H.stam = 0;
        H.hp -= dmg * 0.35;
        H.state = 'hit'; S.hitRecover = 0.55;
        CB.fx.text('破防', H.pos, '#ff6b6b');
      } else {
        CB.fx.text('格挡 -' + Math.round(cost), H.pos, '#bcd8ff');
        J.CAM.shake(0.08);
      }
      return;
    }
    H.hp -= dmg;
    S.comboIdx = 0;
    S.comboTimer = 0;
    H.state = 'hit';
    S.hitRecover = isHeavy ? 0.55 : 0.34;
    J.CAM.shake(isHeavy ? 0.28 : 0.14);
    CB.fx.text('-' + Math.round(dmg), H.pos, '#ff8080');
    // 击退
    var dx = H.pos.x - fromPos.x, dz = H.pos.z - fromPos.z;
    var l = Math.hypot(dx, dz) || 1;
    var res = H.resolveCollision(H.pos.x + dx / l * 0.5, H.pos.z + dz / l * 0.5);
    H.pos.x = res[0]; H.pos.z = res[1];
  };
})();
