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
      var key = mat.uuid;
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
      var mesh = new THREE.Mesh(geo, b2.mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = 'merged';
      group.add(mesh);
      made++;
    }
    return { merged: made, sources: toRemove.length };
  };
})();
