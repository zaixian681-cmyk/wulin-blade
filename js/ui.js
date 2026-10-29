/* ============================================================
   ui.js — 移动端操控与 HUD
   ============================================================ */
window.WL = window.WL || {};
(function () {
  var J = WL;
  var UI = J.UI = {};

  function el(id) { return document.getElementById(id); }

  UI.init = function () {
    var stick = el('stick'), knob = el('knob');
    var activeId = null, anchorX = 0, anchorY = 0, R = 46;

    UI.touchActive = false;

    function stageRect() { return document.getElementById('stage').getBoundingClientRect(); }

    /* 手指按下处作为摇杆中心（浮动摇杆，最跟手） */
    function begin(px, py, id) {
      var st = stageRect();
      var rot = J.Stage.rot;
      // 把摇杆图形移动到手指位置（容器坐标）
      var c = J.toStage(px, py);
      stick.style.left = (c.x - 66) + 'px';
      stick.style.top = (c.y - 66) + 'px';
      stick.style.bottom = 'auto';
      stick.style.opacity = '1';
      anchorX = px; anchorY = py;
      activeId = id;
      UI.touchActive = true;
      var w = stick.offsetWidth || 132;
      R = w * 0.42;
      knob.style.transform = 'translate(0,0)';
      J.IN.move.x = 0; J.IN.move.y = 0; J.IN.run = false;
    }

    function update(px, py) {
      if (activeId === null) return;
      var st = stageRect();
      var rot = J.Stage.rot;
      // 屏幕位移 → 容器位移
      var d = J.deltaStage(px - anchorX, py - anchorY);
      var dx = d.x, dy = d.y;
      var len = Math.hypot(dx, dy);
      if (len > R) { dx = dx / len * R; dy = dy / len * R; len = R; }
      knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      J.IN.move.x = dx / R;
      J.IN.move.y = -dy / R;         // 容器向上 = 前进
      J.IN.run = Math.hypot(J.IN.move.x, J.IN.move.y) > 0.72;
    }

    function finish() {
      activeId = null;
      UI.touchActive = false;
      knob.style.transform = 'translate(0,0)';
      J.IN.move.x = 0; J.IN.move.y = 0; J.IN.run = false;
      J.IN.forceZero = true;          // 让主循环下一帧再确认一次归零
      stick.style.opacity = '0.45';
      stick.style.left = '22px';
      stick.style.top = 'auto';
      stick.style.bottom = '26px';
    }

    /* 左半屏任意位置按下都能起摇杆 */
    var stage = el('stage');
    stage.addEventListener('touchstart', function (e) {
      var t = e.changedTouches[0];
      if (t.target.closest('.btn') || t.target.closest('#flipBtn') || t.target.closest('#qBtn')) return;
      var st = stageRect();
      var r = J.toStage(t.clientX, t.clientY);
      if (r.x > J.Stage.W * 0.48) return;      // 右半屏留给视角
      if (activeId !== null) return;
      begin(t.clientX, t.clientY, t.identifier);
      e.preventDefault();
    }, { passive: false });

    window.addEventListener('touchmove', function (e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (t.identifier === activeId) { update(t.clientX, t.clientY); e.preventDefault(); }
      }
    }, { passive: false });

    function upHandler(e) {
      if (activeId === null) return;
      var ts = e.changedTouches || [];
      for (var i = 0; i < ts.length; i++) if (ts[i].identifier === activeId) { finish(); return; }
    }
    window.addEventListener('touchend', upHandler, { passive: true });
    window.addEventListener('touchcancel', function () { if (activeId !== null) finish(); }, { passive: true });
    window.addEventListener('blur', function () { if (activeId !== null) finish(); });
    document.addEventListener('visibilitychange', function () { if (document.hidden && activeId !== null) finish(); });

    // 鼠标调试
    var md = false;
    stage.addEventListener('mousedown', function (e) {
      if (e.target.closest('.btn')) return;
      var r = J.toStage(e.clientX, e.clientY);
      if (r.x > J.Stage.W * 0.48) return;
      md = true; begin(e.clientX, e.clientY, 1);
    });
    window.addEventListener('mousemove', function (e) { if (md) update(e.clientX, e.clientY); });
    window.addEventListener('mouseup', function () { if (md) { md = false; finish(); } });

    /* 视角拖动（右半屏空白） */
    var camId = null, lastX = 0, lastY = 0;
    var stage = el('stage');
    stage.addEventListener('touchstart', function (e) {
      var t = e.changedTouches[0];
      if (t.target.closest('.btn') || t.target.closest('#stick')) return;
      camId = t.identifier; lastX = t.clientX; lastY = t.clientY;
    }, { passive: true });
    stage.addEventListener('touchmove', function (e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (t.identifier !== camId) continue;
        var sd = J.deltaStage(t.clientX - lastX, t.clientY - lastY);
        lastX = t.clientX; lastY = t.clientY;
        J.IN.camYaw -= sd.x * 0.006;
        J.IN.camPitch = J.clamp(J.IN.camPitch + sd.y * 0.004, -0.3, 1.0);
      }
    }, { passive: true });
    stage.addEventListener('touchend', function () { camId = null; });

    /* 按钮 */
    function bind(id, onDown, onUp) {
      var b = el(id);
      if (!b) return;
      b.addEventListener('touchstart', function (e) { e.preventDefault(); b.classList.add('on'); onDown && onDown(); }, { passive: false });
      b.addEventListener('touchend', function (e) { e.preventDefault(); b.classList.remove('on'); onUp && onUp(); }, { passive: false });
      b.addEventListener('touchcancel', function () { b.classList.remove('on'); onUp && onUp(); });
    }
    bind('btnAtk', function () { J.CB.onAttackPressed(false); });
    bind('btnHeavy', function () { J.CB.onAttackPressed(true); });
    bind('btnDodge', function () { J.CB.onDodge(); });
    var qb = el('qBtn');
    if (qb) qb.addEventListener('click', function () { J.GAME.cycleQuality(); });
    var fb = el('flipBtn');
    if (fb) fb.addEventListener('click', function () { window.__flip && window.__flip(); });
    bind('btnBlock', function () { J.IN.block = true; }, function () { J.IN.block = false; });
    bind('btnSwap', function () { J.CB.onSwap(); });
    bind('btnExec', function () { J.CB.tryExecute(); });
    bind('btnSkill', function () { J.CB.castSkill(); });
    bind('btnJam', function () { /* 跳跃：Phase 2 */ });

    // 键盘（桌面调试）
    window.addEventListener('keydown', function (e) {
      if (e.repeat) return;
      if (e.key === 'j' || e.key === 'J') J.CB.onAttackPressed(false);
      if (e.key === 'k' || e.key === 'K') J.CB.onAttackPressed(true);
      if (e.key === ' ') J.CB.onDodge();
      if (e.key === 'l' || e.key === 'L') J.IN.block = true;
      if (e.key === 'q' || e.key === 'Q') J.CB.onSwap();
      if (e.key === 'e' || e.key === 'E') J.CB.tryExecute();
      if (e.key === 'r' || e.key === 'R') J.CB.castSkill();
      if (e.key === 'f' || e.key === 'F') J.INTERACT();
    });
    window.addEventListener('keyup', function (e) {
      if (e.key === 'l' || e.key === 'L') J.IN.block = false;
    });
  };

  UI.toast = function (text, ms) {
    var t = el('toast');
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(UI._tt);
    UI._tt = setTimeout(function () { t.classList.remove('show'); }, ms || 2200);
  };

  UI.dialog = function (name, text, onClose) {
    var d = el('dialog');
    el('dlgName').textContent = name;
    el('dlgText').textContent = text;
    d.classList.add('show');
    UI._dlgCb = onClose;
    el('dlgNext').onclick = function () {
      d.classList.remove('show');
      if (UI._dlgCb) { var f = UI._dlgCb; UI._dlgCb = null; f(); }
    };
  };

  var C = null;
  function cache() {
    C = {
      hp: el('hpFill'), st: el('stFill'), wn: el('weaponName'), wk: el('weaponKind'),
      exec: el('btnExec'), skill: el('btnSkill'), bar: el('foeBar'), fname: el('foeName'), fhp: el('foeHp'), fbrk: el('foeBreak')
    };
  }
  UI.updateHUD = function () {
    if (!C) cache();
    var H = J.H;
    C.hp.style.width = Math.max(0, H.hp / H.hpMax * 100) + '%';
    C.st.style.width = Math.max(0, H.stam / H.stamMax * 100) + '%';
    C.wn.textContent = J.CB.DATA[H.weapon].label;
    C.wk.textContent = J.CB.DATA[H.weapon].name;
    // 处决提示
    var tn = J.F.nearestTo(H.pos, 3.0);
    var canExec = tn && !tn.dead && tn.broken;
    C.exec.classList.toggle('ready', !!canExec);
    var cd = J.CB.skillCd ? J.CB.skillCd[H.weapon] : 0;
    if (C.skill) {
      C.skill.classList.toggle('cd', cd > 0);
      C.skill.textContent = cd > 0 ? cd.toFixed(1) : '技';
    }
    // 目标血条
    var target = tn && !tn.dead ? tn : null;
    if (target) {
      C.bar.classList.add('show');
      C.fname.textContent = target.def.name;
      C.fhp.style.width = (target.hp / target.hpMax * 100) + '%';
      C.fbrk.style.width = Math.min(100, target.break / target.breakMax * 100) + '%';
      C.fbrk.classList.toggle('full', target.broken);
    } else {
      C.bar.classList.remove('show');
    }
  };
})();

/* ============================================================
   npc.js — NPC 与对话任务
   ============================================================ */
(function () {
  var J = WL;
  var N = J.NPC = { list: [] };

  function makeNPC(x, z, color, name) {
    var g = new THREE.Group();
    var mat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.9 });
    var skin = new THREE.MeshStandardMaterial({ color: 0xcfa98c, roughness: 0.8 });
    var body = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.34, 1.1, 8), mat);
    body.position.y = 0.55; body.castShadow = true; g.add(body);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.135, 10, 8), skin);
    head.position.y = 1.32; g.add(head);
    var hair = new THREE.Mesh(new THREE.SphereGeometry(0.145, 10, 8), new THREE.MeshStandardMaterial({ color: 0x141216, roughness: 0.7 }));
    hair.position.set(0, 1.34, -0.01); g.add(hair);
    var y = J.T.heightAt(x, z);
    g.position.set(x, y, z);
    var npc = { group: g, x: x, z: z, name: name, yaw: J.rand(0, 6.28) };
    g.rotation.y = npc.yaw;
    J.S.add(g);
    N.list.push(npc);
    return npc;
  }

  N.build = function () {
    J.W.npcSpots.forEach(function (s) {
      var colors = { innkeeper: 0x8a6a4a, tea: 0x6a7a5a, smith: 0x44373a, villager: 0x7a6a56, vendor: 0x6a5470 };
      makeNPC(s.x, s.z, colors[s.role] || 0x7a6a56, s.name);
    });
  };

  N.nearest = function (pos, maxD) {
    var best = null, bd = maxD || 3;
    for (var i = 0; i < N.list.length; i++) {
      var n = N.list[i];
      var d = Math.hypot(n.x - pos.x, n.z - pos.z);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  };
})();
