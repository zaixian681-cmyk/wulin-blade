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
    var activeId = null, R = 46, ccx = 0, ccy = 0;

    // 摇杆中心（容器坐标，随旋转一起变）
    function center() {
      ccx = stick.offsetLeft + stick.offsetWidth / 2;
      ccy = stick.offsetTop + stick.offsetHeight / 2;
      R = stick.offsetWidth * 0.42;
    }

    function applyPoint(clientX, clientY) {
      var p = J.toStage(clientX, clientY);      // 屏幕 → 容器坐标
      var dx = p.x - ccx, dy = p.y - ccy;
      var d = Math.hypot(dx, dy);
      if (d > R) { dx = dx / d * R; dy = dy / d * R; d = R; }
      knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      J.IN.move.x = dx / R;
      J.IN.move.y = -dy / R;      // 屏幕向上 = 前进
      J.IN.run = Math.hypot(J.IN.move.x, J.IN.move.y) > 0.68;
    }

    function start(e) {
      var t = e.changedTouches ? e.changedTouches[0] : e;
      center();
      activeId = t.identifier;
      applyPoint(t.clientX, t.clientY);
    }
    function move(e) {
      var ts = e.changedTouches || [e];
      for (var i = 0; i < ts.length; i++) {
        if (ts[i].identifier !== activeId) continue;
        applyPoint(ts[i].clientX, ts[i].clientY);
      }
      e.preventDefault();
    }
    function end(e) {
      activeId = null;
      knob.style.transform = 'translate(0,0)';
      J.IN.move.x = 0; J.IN.move.y = 0; J.IN.run = false;
    }
    stick.addEventListener('touchstart', start, { passive: false });
    stick.addEventListener('touchmove', move, { passive: false });
    stick.addEventListener('touchend', end);
    stick.addEventListener('touchcancel', end);
    // 鼠标调试
    var md = false;
    stick.addEventListener('mousedown', function (e) { md = true; var t = e; t.identifier = 1; start(e); });
    window.addEventListener('mousemove', function (e) { if (md) { var t = e; t.identifier = 1; move(e); } });
    window.addEventListener('mouseup', function () { if (md) { md = false; end(); } });
    window.addEventListener('resize', function () { center(); });

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
    var fb = el('flipBtn');
    if (fb) fb.addEventListener('click', function () { window.__flip && window.__flip(); });
    bind('btnBlock', function () { J.IN.block = true; }, function () { J.IN.block = false; });
    bind('btnSwap', function () { J.CB.onSwap(); });
    bind('btnExec', function () { J.CB.tryExecute(); });
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

  UI.updateHUD = function () {
    var H = J.H;
    el('hpFill').style.width = Math.max(0, H.hp / H.hpMax * 100) + '%';
    el('stFill').style.width = Math.max(0, H.stam / H.stamMax * 100) + '%';
    el('weaponName').textContent = J.CB.DATA[H.weapon].label;
    el('weaponKind').textContent = J.CB.DATA[H.weapon].name;
    // 处决提示
    var tn = J.F.nearestTo(H.pos, 3.0);
    var canExec = tn && !tn.dead && tn.broken;
    el('btnExec').classList.toggle('ready', !!canExec);
    // 目标血条
    var target = tn && !tn.dead ? tn : null;
    var bar = el('foeBar');
    if (target) {
      bar.classList.add('show');
      el('foeName').textContent = target.def.name;
      el('foeHp').style.width = (target.hp / target.hpMax * 100) + '%';
      var bk = el('foeBreak');
      bk.style.width = Math.min(100, target.break / target.breakMax * 100) + '%';
      bk.classList.toggle('full', target.broken);
    } else {
      bar.classList.remove('show');
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
