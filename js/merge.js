/* ============================================================
   merge.js — 静态网格合并（大幅降低 draw call）
   ============================================================ */
window.WL = window.WL || {};
(function () {
  var J = WL;

  /* 收集 group 下所有普通 Mesh，按材质归并 */
  J.mergeStatic = function (group) {
    var buckets = {}, order = [];
    var toRemove = [];
    group.updateMatrixWorld(true);

    group.traverse(function (o) {
      if (!o.isMesh || o.isInstancedMesh || o.isSprite) return;
      if (o.userData.dynamic) return;
      if (o.userData.noMerge) return;
      var g = o.geometry;
      if (!g || !g.attributes.position) return;
      var mat = o.material;
      if (Array.isArray(mat)) return;
      if (mat.transparent) return;          // 透明物体保持独立（排序需求）
      if (mat.isShaderMaterial) return;      // 自定义着色器（天空/水面）
      if (o === J.sky) return;
      // 按材质 + 空间分块，保证视锥剔除有效（否则一整块永远都在渲染）
      var wx = o.matrixWorld.elements[12], wz = o.matrixWorld.elements[14];
      var chunk = Math.floor(wx / 120) + '_' + Math.floor(wz / 120);
      var key = mat.uuid + '|' + chunk;
      if (!buckets[key]) {
        buckets[key] = { mat: mat, pos: [], norm: [], uv: [], col: [], idx: [], count: 0, hasCol: false };
        order.push(key);
      }
      var b = buckets[key];
      var m = o.matrixWorld;
      var nm = new THREE.Matrix3().getNormalMatrix(m);
      var p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv, c = g.attributes.color;
      if (c) b.hasCol = true;
      var base = b.count;
      var v = new THREE.Vector3();
      for (var i = 0; i < p.count; i++) {
        v.set(p.getX(i), p.getY(i), p.getZ(i)).applyMatrix4(m);
        b.pos.push(v.x, v.y, v.z);
        if (n) { v.set(n.getX(i), n.getY(i), n.getZ(i)).applyMatrix3(nm).normalize(); b.norm.push(v.x, v.y, v.z); }
        else b.norm.push(0, 1, 0);
        if (u) b.uv.push(u.getX(i), u.getY(i)); else b.uv.push(0, 0);
        if (c) b.col.push(c.getX(i), c.getY(i), c.getZ(i)); else b.col.push(1, 1, 1);
      }
      var idx = g.index;
      if (idx) for (var k = 0; k < idx.count; k++) b.idx.push(idx.getX(k) + base);
      else for (var k2 = 0; k2 < p.count; k2++) b.idx.push(k2 + base);
      b.count += p.count;
      toRemove.push(o);
    });

    // 移除原网格
    for (var i = 0; i < toRemove.length; i++) {
      var o2 = toRemove[i];
      if (o2.parent) o2.parent.remove(o2);
    }

    var made = 0;
    for (var oi = 0; oi < order.length; oi++) {
      var b2 = buckets[order[oi]];
      if (b2.count < 3) continue;
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(b2.pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(b2.norm, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(b2.uv, 2));
      if (b2.hasCol) geo.setAttribute('color', new THREE.Float32BufferAttribute(b2.col, 3));
      geo.setIndex(b2.idx);
      geo.computeBoundingSphere();
      geo.computeBoundingBox();
      var mesh = new THREE.Mesh(geo, b2.mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = 'merged';
      mesh.frustumCulled = true;
      group.add(mesh);
      made++;
    }
    return { merged: made, sources: toRemove.length };
  };
})();

/* 按「关节组」合并：只合并同一父节点下的直接子 mesh，不会破坏骨骼式动画 */
(function () {
  var J = WL;
  function mergeNode(node) {
    var byMat = {}, list = [];
    for (var i = 0; i < node.children.length; i++) {
      var c = node.children[i];
      if (!c.isMesh || c.isInstancedMesh || !c.material) continue;
      if (c.userData && (c.userData.dynamic || c.userData.noMerge)) continue;
      var key = c.material.uuid;
      (byMat[key] || (byMat[key] = { mat: c.material, arr: [] })).arr.push(c);
      list.push(c);
    }
    for (var k in byMat) {
      var g = byMat[k];
      if (g.arr.length < 2) continue;
      var pos = [], nor = [], uv = [], idx = [], base = 0;
      for (var a = 0; a < g.arr.length; a++) {
        var m = g.arr[a];
        m.updateMatrix();
        var geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry;
        var p = geo.attributes.position, n = geo.attributes.normal, u = geo.attributes.uv;
        var v = new THREE.Vector3();
        for (var vi = 0; vi < p.count; vi++) {
          v.set(p.getX(vi), p.getY(vi), p.getZ(vi)).applyMatrix4(m.matrix);
          pos.push(v.x, v.y, v.z);
          if (n) { v.set(n.getX(vi), n.getY(vi), n.getZ(vi)).transformDirection(m.matrix); nor.push(v.x, v.y, v.z); }
          else nor.push(0, 1, 0);
          if (u) uv.push(u.getX(vi), u.getY(vi)); else uv.push(0, 0);
        }
        for (var ii = 0; ii < p.count; ii++) idx.push(base + ii);
        base += p.count;
      }
      var ng = new THREE.BufferGeometry();
      ng.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      ng.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      ng.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      ng.setIndex(idx);
      ng.computeBoundingSphere();
      var nm = new THREE.Mesh(ng, g.mat);
      nm.castShadow = true;
      node.add(nm);
      for (var r = 0; r < g.arr.length; r++) node.remove(g.arr[r]);
    }
    // 递归
    for (var ci = node.children.length - 1; ci >= 0; ci--) {
      var ch = node.children[ci];
      if (ch.children && ch.children.length) mergeNode(ch);
    }
  }
  J.mergePerJoint = function (root) { try { mergeNode(root); } catch (e) { } };
})();
