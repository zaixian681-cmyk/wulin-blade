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
      dmg: 30, crit: 0.20, critMul: 1.9, break: 26, reach: 2.7, arc: 1.25,
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
      dmg: 20, crit: 0.26, critMul: 1.75, break: 14, reach: 2.9, arc: 0.8,
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
    var dxm = m.x;
    if (Math.abs(dxm) < 0.15) dxm = -H.face;   // 原地闪避：向后撤
    S.dodgeDir.set(dxm > 0 ? 1 : -1, 0, 0);
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
      var d = Math.abs(f.pos.x - H.pos.x);
      if (d < 3.2 && d < best) { best = d; target = f; }
    });
    if (!target) return false;
    S.execTarget = target;
    S.execT = 0;
    H.state = 'exec';
    H.face = target.pos.x > H.pos.x ? 1 : -1;
    H.yaw = H.face > 0 ? Math.PI / 2 : -Math.PI / 2;
    target.executed = true;
    return true;
  };

  /* ---------------- 攻击 ---------------- */
  function startAttack(heavy) {
    var H = J.H;
    var w = DATA[H.weapon];
    // 横版软锁定：朝最近目标转身
    var tgt = J.F.nearestTo(H.pos, w.reach + 2.2);
    if (tgt) {
      var dx = tgt.pos.x - H.pos.x;
      if (Math.abs(dx) > 0.15) H.face = dx > 0 ? 1 : -1;
      H.yaw = H.face > 0 ? Math.PI / 2 : -Math.PI / 2;
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
      H.pos.x = Math.max(J.ST.X0 + 3, Math.min(J.ST.X1 - 3, H.pos.x + c.lunge * 0.55 * H.face));
    }
    S.comboIdx = idx + 1;
    if (S.comboIdx >= w.combo.length) S.comboIdx = w.combo.length;  // 等待重置
    S.comboTimer = 0.9;
    CB.fx.slash(H, idx);
  }

  /* ---------------- 主更新 ---------------- */
  CB.update = function (dt) {
    var H = J.H;
    S.comboTimer = Math.max(0, S.comboTimer - dt);
    if (S.comboTimer === 0) S.comboIdx = 0;
    S.iframe = Math.max(0, S.iframe - dt);
    S.hitStop = Math.max(0, S.hitStop - dt);

    // 体力
    if (H.state !== 'dodge' && H.state !== 'attack') {
      H.stam = Math.min(H.stamMax, H.stam + dt * (S.blockHeld ? 9 : 16));
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
      var sp = 10.5 * Math.max(0, S.dodgeT / 0.42);
      H.pos.x = Math.max(J.ST.X0 + 3, Math.min(J.ST.X1 - 3, H.pos.x + S.dodgeDir.x * sp * dt));
      H.mesh.rotation.z = -S.dodgeDir.x * 0.22;
      if (S.dodgeT <= 0) { H.mesh.rotation.z = 0; H.state = 'idle'; }
    }

    /* 处决 */
    if (H.state === 'exec') {
      S.execT += dt;
      var tg = S.execTarget;
      if (tg && S.execT < 0.45) {
        var dxe = tg.pos.x - H.pos.x;
        H.pos.x += dxe * Math.min(1, dt * 7);
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

  /* ---------------- 命中检测 ---------------- */
  function doHitCheck(a, t) {
    if (a.didHit && t < 0.85) return;
    var H = J.H;
    var w = a.w;
    var hitAny = false;
    (J.F.list || []).forEach(function (f) {
      if (f.dead || a.hitSet[f.id]) return;
      var dx = f.pos.x - H.pos.x;
      var dy = Math.abs(f.pos.y - H.pos.y);
      var adx = Math.abs(dx);
      if (dy > 1.9) return;                       // 高低差太大
      if (adx > w.reach + (f.radius || 0.45) + 0.35) return;
      if (dx * H.face < -0.7) return;             // 在背后
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
    var dx2 = H.pos.x - fromPos.x;
    var l2 = Math.abs(dx2) || 1;
    H.pos.x = Math.max(J.ST.X0 + 3, Math.min(J.ST.X1 - 3, H.pos.x + (dx2 / l2) * 0.45));
  };
})();
