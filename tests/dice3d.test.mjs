import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { d10Geometry, restQuaternion, d10Values } from '../js/dice3d.js';

test('d10: flat kites, opposite faces add to 11, every value can land on top', () => {
  const g = d10Geometry(1);
  const pos = g.getAttribute('position');
  const faces = g.groups.map((gr) => {
    const v = (i) => new THREE.Vector3().fromBufferAttribute(pos, gr.start + i);
    const n1 = new THREE.Vector3().subVectors(v(1), v(0)).cross(new THREE.Vector3().subVectors(v(2), v(0))).normalize();
    const n2 = new THREE.Vector3().subVectors(v(4), v(3)).cross(new THREE.Vector3().subVectors(v(5), v(3))).normalize();
    assert.ok(n1.dot(n2) > 0.9999, 'kite is flat');
    const c = v(0).add(v(1)).add(v(2)).add(v(5));
    assert.ok(n1.dot(c) > 0, 'faces outwards');
    return n1;
  });
  const VALUES = d10Values();
  assert.deepEqual([...VALUES].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  faces.forEach((n, i) => {
    const j = faces.findIndex((m) => m.dot(n) < -0.9999);
    assert.ok(j >= 0, 'has an opposite face');
    assert.equal(VALUES[i] + VALUES[j], 11);
  });
  for (let v = 1; v <= 10; v++) {
    const q = restQuaternion(v, new THREE.Vector3(1, 0, -1));
    const up = faces[VALUES.indexOf(v)].clone().applyQuaternion(q);
    assert.ok(up.y > 0.9999, `value ${v} faces up`);
  }
});
