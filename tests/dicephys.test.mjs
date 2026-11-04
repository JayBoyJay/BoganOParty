import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { simulateDice } from '../js/host/dicephys.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const die = (x, vz) => ({ pos: V(x, 8, 15), vel: V(0, 2, -vz), spin: V(-6, 0, 1), quat: new THREE.Quaternion() });

test('dice: a harder throw goes further, and they come to rest on the ground', () => {
  const soft = simulateDice([die(0, 10)], { groundY: 0.4, R: 0.85 });
  const hard = simulateDice([die(0, 18)], { groundY: 0.4, R: 0.85 });
  const end = (r) => r.frames[0].at(-1).p;
  assert.ok(end(hard).z < end(soft).z - 8, `hard ${end(hard).z} vs soft ${end(soft).z}`);
  for (const r of [soft, hard]) {
    assert.ok(r.T < 5, 'settles');
    assert.ok(Math.abs(end(r).y - 1.25) < 0.01, 'resting on the ground');
  }
});

test('dice: bounce off a wall without going through it', () => {
  const wall = { min: V(-5, 0, -4), max: V(5, 4, -3) };
  const r = simulateDice([die(0, 18)], { groundY: 0.4, R: 0.85, colliders: [wall] });
  assert.ok(r.events.some((e) => e.kind === 'wall'), 'hit the wall');
  for (const f of r.frames[0]) assert.ok(f.p.z > wall.max.z + 0.84 || f.p.y - 0.85 > wall.max.y - 0.01, `inside the wall at ${f.p.toArray()}`);
  assert.ok(r.frames[0].at(-1).p.z > wall.max.z, 'stopped in front of it');
});

test('dice: knock a doll and each other, never overlapping', () => {
  const hitDoll = simulateDice([die(0.5, 9)], { groundY: 0.4, R: 0.85, dolls: [{ id: 'jay', pos: V(0, 0.4, 0), r: 0.75, h: 3.6 }] });
  assert.ok(hitDoll.events.some((e) => e.kind === 'doll' && e.id === 'jay'), 'hit the doll');
  const a = die(-1.2, 12), b = die(1.2, 12);
  a.vel.x = 1.5; b.vel.x = -1.5;
  const r = simulateDice([a, b], { groundY: 0.4, R: 0.85 });
  assert.ok(r.events.some((e) => e.kind === 'dice'), 'hit each other');
  for (let i = 0; i < r.frames[0].length; i++) assert.ok(r.frames[0][i].p.distanceTo(r.frames[1][i].p) > 1.68, 'dice overlap');
});
