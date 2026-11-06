// A small physics sim for thrown dice on the board: gravity, bounces on the ground, knocks off props,
// buildings and dolls, and dice into each other. The whole throw is worked out up front, then played back,
// so the last moments can ease each die onto the face it has to show.
//
// Each die is a ball for collisions (close enough for a d10) with its tumble driven by how it moves:
// rolling along the ground, spinning freely in the air, kicked by every hit.
import * as THREE from 'three';

const _box = new THREE.Box3(), _m = new THREE.Matrix4(), _c = new THREE.Vector3(), _s = new THREE.Vector3();

// Boxes round everything solid near `center` that sticks up off the ground. Instanced props (trees, rocks,
// bins) give one box per instance. Glows, sprites, see-through bits, huge things (the terrain) and flat
// things (spaces, paths, decals) are left out.
export function gatherColliders(scene, center, radius, groundY, skip = new Set()) {
  const out = [];
  const keep = (b) => {
    b.getSize(_s);
    if (b.isEmpty() || _s.x > 60 || _s.z > 60) return;
    if (b.max.y < groundY + 0.35) return;
    b.getCenter(_c);
    if (Math.hypot(_c.x - center.x, _c.z - center.z) - Math.hypot(_s.x, _s.z) / 2 > radius) return;
    out.push({ min: b.min.clone(), max: b.max.clone() });
  };
  scene.updateMatrixWorld();
  const walk = (o) => {
    if (skip.has(o) || !o.visible) return;
    if (o.isMesh && !o.isSkinnedMesh) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const solid = mats.every((m) => m && !(m.transparent && m.opacity < 0.9) && m.depthWrite !== false && !m.isMeshBasicMaterial);
      if (solid) {
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        if (o.isInstancedMesh) {
          for (let i = 0; i < o.count; i++) {
            o.getMatrixAt(i, _m);
            _m.premultiply(o.matrixWorld);
            keep(_box.copy(o.geometry.boundingBox).applyMatrix4(_m));
          }
        } else keep(_box.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld));
      }
    }
    for (const ch of o.children) walk(ch);
  };
  walk(scene);
  return out;
}

const G = 30; // gravity (the board is roughly 0.4 m to the unit)
const DT = 1 / 120;

// dice: [{ pos, vel, spin (angular velocity, rad/s), quat, curve (-1..1, + bends right) }]; dolls: [{ id, pos, r, h }]
// Returns { frames: per die [{ p, q }] every DT, events: [{ t, kind: 'ground'|'wall'|'doll'|'dice', id, hard }], R }.
export function simulateDice(dice, { colliders = [], dolls = [], groundY = 0, R = 0.9, maxT = 5 } = {}) {
  const up = new THREE.Vector3(0, 1, 0);
  const st = dice.map((d) => ({ p: d.pos.clone(), v: d.vel.clone(), w: d.spin.clone(), q: d.quat.clone(), curve: d.curve || 0, still: 0, frames: [], lastHit: new Map() }));
  const events = [];
  const tmp = new THREE.Vector3(), n = new THREE.Vector3(), dq = new THREE.Quaternion();
  const hit = (t, kind, s, id, speed) => {
    const key = kind + ':' + id;
    if (t - (s.lastHit.get(key) ?? -1) < 0.15) return;
    s.lastHit.set(key, t);
    events.push({ t, kind, id, die: st.indexOf(s), hard: Math.min(1, speed / 15) });
  };
  // knock: a hit sends the tumble off somewhere new
  const knock = (s, amount) => s.w.add(tmp.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(amount));
  let t = 0;
  for (; t < maxT; t += DT) {
    let allStill = true;
    for (const s of st) {
      s.v.y -= G * DT;
      // spin from a curved flick bends the path sideways (strongest in the air, fading as it slows)
      if (s.curve) {
        const sp = Math.hypot(s.v.x, s.v.z);
        if (sp > 0.5) {
          const k = s.curve * (s.p.y - R > groundY + 0.05 ? 9 : 5) * Math.min(1, sp / 10) * DT / sp;
          s.v.x += -s.v.z * k; s.v.z += s.v.x * k; // right of travel: direction × up
        }
      }
      s.p.addScaledVector(s.v, DT);
      let onGround = false;
      // the ground
      if (s.p.y - R < groundY) {
        s.p.y = groundY + R;
        if (s.v.y < -2.5) { hit(t, 'ground', s, 0, -s.v.y); s.v.y = -s.v.y * 0.42; knock(s, s.v.y * 0.6); }
        else s.v.y = 0;
        onGround = true;
      }
      // props and buildings
      for (const c of colliders) {
        tmp.copy(s.p).clamp(c.min, c.max);
        const d2 = tmp.distanceToSquared(s.p);
        if (d2 >= R * R) continue;
        let dist = Math.sqrt(d2);
        if (dist > 1e-4) n.subVectors(s.p, tmp).divideScalar(dist);
        else {
          // centre inside the box: out the nearest side
          const o = [s.p.x - c.min.x, c.max.x - s.p.x, s.p.y - c.min.y, c.max.y - s.p.y, s.p.z - c.min.z, c.max.z - s.p.z];
          const i = o.indexOf(Math.min(...o));
          n.set(i === 0 ? -1 : i === 1 ? 1 : 0, i === 2 ? -1 : i === 3 ? 1 : 0, i === 4 ? -1 : i === 5 ? 1 : 0);
          dist = -o[i];
        }
        s.p.addScaledVector(n, R - dist);
        const vn = s.v.dot(n);
        if (vn < 0) {
          s.v.addScaledVector(n, -1.3 * vn); // bounce back at 30% speed
          s.v.addScaledVector(tmp.copy(s.v).addScaledVector(n, -s.v.dot(n)), -0.3); // a scrape of friction
          if (n.y > 0.7) onGround = true; // landed on top of it
          if (-vn > 1.5) { hit(t, n.y > 0.7 ? 'ground' : 'wall', s, out(c), -vn); knock(s, -vn * 0.8); }
        } else if (n.y > 0.7) onGround = true;
      }
      // dolls: a soft upright cylinder each
      for (const d of dolls) {
        if (s.p.y - R > d.pos.y + d.h) continue;
        tmp.set(s.p.x - d.pos.x, 0, s.p.z - d.pos.z);
        const dist = tmp.length(), min = R + d.r;
        if (dist >= min) continue;
        n.copy(dist > 1e-4 ? tmp.divideScalar(dist) : tmp.set(1, 0, 0));
        s.p.addScaledVector(n, min - dist);
        const vn = s.v.dot(n);
        if (vn < 0) {
          s.v.addScaledVector(n, -1.45 * vn); // vinyl gives a bit
          s.v.multiplyScalar(0.75);
          if (-vn > 1) { hit(t, 'doll', s, d.id, -vn); knock(s, -vn); }
        }
      }
      // rolling: the tumble follows the ground speed, and the ground slows it down
      if (onGround) {
        const h = tmp.set(s.v.x, 0, s.v.z), sp = h.length();
        const slow = Math.max(0, sp - (4 + sp * 2.2) * DT);
        if (sp > 1e-4) { s.v.x *= slow / sp; s.v.z *= slow / sp; }
        n.crossVectors(up, s.v).divideScalar(R);
        n.setY(s.curve * 4 * Math.min(1, sp / 5)); // and keeps a bit of twist from the curve
        s.w.lerp(n, 1 - Math.pow(0.0005, DT));
      }
      // the tumble
      const ang = s.w.length() * DT;
      if (ang > 1e-6) { dq.setFromAxisAngle(tmp.copy(s.w).normalize(), ang); s.q.premultiply(dq); }
      const moving = s.v.length() > 0.35 || !onGround;
      s.still = moving ? 0 : s.still + DT;
      if (s.still < 0.2) allStill = false;
    }
    // dice knock into each other
    for (let i = 0; i < st.length; i++) for (let j = i + 1; j < st.length; j++) {
      const a = st[i], b = st[j];
      n.subVectors(b.p, a.p);
      const dist = n.length();
      if (dist >= 2 * R || dist < 1e-5) continue;
      n.divideScalar(dist);
      a.p.addScaledVector(n, -(2 * R - dist) / 2); b.p.addScaledVector(n, (2 * R - dist) / 2);
      const rel = tmp.subVectors(b.v, a.v).dot(n);
      if (rel < 0) {
        const j2 = -(1 + 0.7) * rel / 2;
        a.v.addScaledVector(n, -j2); b.v.addScaledVector(n, j2);
        if (-rel > 1.5) { hit(t, 'dice', a, j, -rel); knock(a, -rel); knock(b, -rel); }
      }
    }
    for (const s of st) s.frames.push({ p: s.p.clone(), q: s.q.clone() });
    if (allStill) break;
  }
  return { frames: st.map((s) => s.frames), events, R, T: t };
}

// colliders are plain objects; give each a stable id for the hit list
let ids = 0;
const idOf = new WeakMap();
function out(c) { if (!idOf.has(c)) idOf.set(c, ++ids); return idOf.get(c); }
