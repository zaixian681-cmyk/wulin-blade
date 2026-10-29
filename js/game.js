/* ============================================================
   game.js — 主循环 / 存档 / 任务
   ============================================================ */
window.WL = window.WL || {};
(function () {
  var J = WL;
  var G = J.GAME = {};
  var clock, acc = 0, frames = 0, fpsT = 0;

  J.PROG = {
    kills: 0,
    quest: 'q1',
    questState: { q1: 'active' },
    gold: 0,
    save: function () {
      try {
        localStorage.setItem('wl_save_v3', JSON.stringify({
          x: J.H.pos.x, z: J.H.pos.z, yaw: J.H.yaw,
          weapon: J.H.weapon, hp: J.H.hp, kills: J.PROG.kills,
          quest: J.PROG.quest, gold: J.PROG.gold
        }));
      } catch (e) { }
    },
    load: function () {
      try {
        var s = JSON.parse(localStorage.getItem('wl_save_v3') || 'null');
        return s;
      } catch (e) { return null; }
    },
    onKill: function (f) {
      J.PROG.kills++;
      J.PROG.gold += 5;
      J.UI.toast('击败 ' + f.def.name + '　+5 两');
      if (J.PROG.kills >= 3 && J.PROG.questState.q1 === 'active') {
        J.PROG.questState.q1 = 'done';
        J.UI.toast('任务完成：肃清青溪街头', 3000);
      }
      J.PROG.save();
    }
  };

  G.init = function () {
    var canvas = document.getElementById('gl');
    J.initRenderer(canvas);
    J.TX.init(J.R);
    J.buildScene();

    J.C = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.08, 1500);
    J.C.position.set(0, 6, 130);

    J.T.build(J.S);
    J.T.buildWater(J.S);
    J.T.farRidge(J.S);
    J.W.build(J.S);
    J.W.embankment(J.S);
    J.W.vegetation(J.S);
    J.A.mats();
    // 合并静态网格，降低 draw call
    var mg = J.mergeStatic(J.S);
    console.log('merged', mg);
    J.FX.init(J.S);
    J.CB.init(J.FX);

    // 主角
    var save = J.PROG.load();
    var sx = J.T.riverX(120) - 19, sz = 120;
    if (save && isFinite(save.x) && isFinite(save.z) && !inSolid(save.x, save.z) &&
        Math.abs(save.x - J.T.riverX(save.z)) < 45) { sx = save.x; sz = save.z; }
    J.H.spawn(J.S, sx, sz);
    if (save) {
      J.H.setWeapon(save.weapon || 'dao');
      J.H.hp = save.hp || J.H.hpMax;
      J.PROG.kills = save.kills || 0;
      J.PROG.gold = save.gold || 0;
      J.IN.camYaw = save.yaw !== undefined ? save.yaw : Math.PI;
    }

    // 敌人
    J.W.foeSpots.forEach(function (s) { J.F.spawn(J.S, s.x, s.z, s.type); });
    // NPC
    J.NPC.build();

    J.UI.init();
    var hint = document.getElementById('hint');
    if (hint) setTimeout(function () { hint.style.display = 'none'; }, 600);
    J.UI.toast('《武林 · 血刃江湖》　青溪镇', 3200);
    setTimeout(function () { J.UI.toast('左摇杆移动　右侧斩/重/闪/御　「换兵」切换长刀与长剑', 5200); }, 3600);

    clock = new THREE.Clock();
    window.addEventListener('resize', onResize);
    onResize();
    loop();
  };

  function inSolid(x, z) {
    for (var i = 0; i < J.W.colliders.length; i++) {
      var c = J.W.colliders[i];
      if (Math.abs(x - c.x) < c.hw + 0.6 && Math.abs(z - c.z) < c.hd + 0.6) return true;
    }
    return false;
  }

  J.INTERACT = function () {
    var npc = J.NPC.nearest(J.H.pos, 3.2);
    if (npc) {
      var lines = {
        '掌柜': '客官里边请。近来镇上不太平，街头那几个带刀的，是影门的人。',
        '茶博士': '喝口茶再走。东头竹林里常有刀客出没，小心些。',
        '铁匠': '刀要常磨。你若替我清掉街上的匪人，我免费替你开锋。',
        '卖药人': '金疮药、续命丹，客官不来点？'
      };
      var txt = lines[npc.name] || '这年头，能活下来就是本事。';
      if (J.PROG.questState.q1 === 'active' && npc.name === '铁匠') {
        txt += '（任务：肃清青溪街头 3 名匪人　' + Math.min(3, J.PROG.kills) + '/3）';
      }
      J.UI.dialog(npc.name, txt);
      return;
    }
    var foe = J.F.nearestTo(J.H.pos, 3.0);
    if (foe && foe.broken) J.CB.tryExecute();
  };

  var forcedPortrait = false;
  function onResize() {
    var w = window.innerWidth, h = window.innerHeight;
    J.R.setSize(w, h, false);
    J.C.aspect = w / h;
    // 宽屏用更平缓的视野，保证横向能看到更多场景
    J.C.fov = w / h > 1.7 ? 56 : 62;
    J.C.updateProjectionMatrix();
    var hint = document.getElementById('hint');
    if (hint) hint.style.display = 'none';
    // 横屏提示
    var rot = document.getElementById('rotate');
    if (rot) {
      var portrait = h > w;
      rot.classList.toggle('show', portrait && !forcedPortrait);
    }
  }
  window.__forcePortrait = function () { forcedPortrait = true; var r = document.getElementById('rotate'); if (r) r.classList.remove('show'); };

  var slowT = 0, simT = 0, frameCount = 0;
  function loop() {
    requestAnimationFrame(loop);
    var dt = Math.min(clock.getDelta(), 0.05);
    G.tick(dt);
  }

  /* 单步推进（测试与低帧率补偿都走这里） */
  G.tick = function (dt) {
    simT += dt; frameCount++;
    var t = simT;

    J.IN.tick(dt);

    // 命中顿帧
    var scale = 1;
    if (J.CB.S.hitStop > 0) scale = 0.25;
    var sdt = dt * scale;

    if (J.H.state !== 'dead') {
      var m = J.IN.move;
      var moving = Math.hypot(m.x, m.y) > 0.08;
      var camYaw = J.IN.camYaw;
      // 摇杆方向转换到世界坐标（相对相机）
      var wx = m.x * Math.cos(camYaw) + m.y * Math.sin(camYaw);
      var wz = -m.x * Math.sin(camYaw) + m.y * Math.cos(camYaw);
      var canMove = (J.H.state === 'idle' || J.H.state === 'run' || J.H.state === 'move' || J.H.state === 'block');
      if (moving && canMove) {
        J.H.move(sdt, wx, wz, !!J.IN.run);
        J.H.state = J.IN.run ? 'run' : 'move';
      } else if (canMove) {
        J.H.state = 'idle';
      }
      J.H.snapGround();
    } else {
      J.H.snapGround();
    }

    J.CB.update(sdt);
    J.F.update(sdt, J.H);
    J.H.updateAnim(dt, J.H.speedNow > 0.1, J.H.speedNow || 0);
    J.H.mesh.position.copy(J.H.pos);
    J.H.mesh.rotation.y = J.H.yaw;

    // 布料/旗帜摆动
    var banners = J.S.children.filter(function (o) { return o.userData && o.userData.wave; });
    for (var i = 0; i < banners.length; i++) {
      var b = banners[i], pos = b.geometry.attributes.position;
      for (var v = 0; v < pos.count; v++) {
        if (pos.getZ(v) !== 0) continue;
        var u = (pos.getX(v) / b.geometry.parameters.width + 0.5);
        pos.setZ(v, Math.sin(t * 2.6 + u * 5 + i) * 0.1 * u);
      }
      pos.needsUpdate = true;
    }

    J.CAM.update(dt, J.H);
    J.FX.update(dt);
    J.UI.updateHUD();
    if (J.T.waterMat) J.T.waterMat.uniforms.t.value = t;

    J.R.render(J.S, J.C);

    frames++; fpsT += dt;
    if (fpsT > 0.6) {
      var fps = frames / fpsT;
      document.getElementById('fps').textContent = fps.toFixed(0) + ' fps · ' + J.R.info.render.calls + ' draw';
      frames = 0; fpsT = 0;
    }
    if (Math.floor(t) % 6 === 0) J.PROG.save();
  }

  G.respawn = function () {
    var x = J.T.riverX(120) - 19, z = 120;
    J.H.pos.set(x, J.T.heightAt(x, z), z);
    J.H.hp = J.H.hpMax;
    J.H.stam = J.H.stamMax;
    J.H.state = 'idle';
    J.H.mesh.rotation.x = 0;
    J.UI.toast('你被救回客栈……');
  };

  window.addEventListener('load', function () {
    try { G.init(); } catch (e) {
      console.error(e);
      var el = document.getElementById('err');
      el.style.display = 'block';
      el.textContent = '启动失败：' + e.message;
    }
  });
})();
