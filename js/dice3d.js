// A ten-sided die (pentagonal trapezohedron) with numbered kite faces, shared by the TV and the phones.
// The phone shows it to flick up the screen; the TV throws the same die onto the board.
import * as THREE from 'three';

const SIDES = 10;
// Values on the five upper kites, then the five lower ones (opposite faces add up to 11, like a real d10).
// The lower kites take 11 minus the upper kite opposite them, worked out below.
const UPPER = [1, 7, 3, 9, 5];

// Ring radius 1, ring height ±e; the apex height h keeps every kite flat:
// h = e (1 + cos36) / (1 - cos36).
const E = 0.105;
const C36 = Math.cos(Math.PI / 5);
const H = E * (1 + C36) / (1 - C36);

let shape = null; // geometry data for a unit die, built once
function buildShape() {
  if (shape) return shape;
  const top = new THREE.Vector3(0, H, 0), bot = new THREE.Vector3(0, -H, 0);
  const U = [], L = [];
  for (let k = 0; k < 5; k++) {
    const a = k * Math.PI * 2 / 5, b = a + Math.PI / 5;
    U.push(new THREE.Vector3(Math.cos(a), E, Math.sin(a)));
    L.push(new THREE.Vector3(Math.cos(b), -E, Math.sin(b)));
  }
  // every kite: apex A (the point numbers face towards), sides S1 S2, near point N
  const kites = [];
  for (let k = 0; k < 5; k++) kites.push({ A: top, S1: U[(k + 1) % 5], N: L[k], S2: U[k], value: UPPER[k] });
  for (let k = 0; k < 5; k++) kites.push({ A: bot, S1: L[k], N: U[(k + 1) % 5], S2: L[(k + 1) % 5], value: 0 });
  // all kites are the same shape, so one UV layout fits them all: lay the first one flat
  const k0 = kites[0];
  const flat = (k) => {
    const v = k.A.clone().sub(k.N).normalize();
    const n = new THREE.Vector3().subVectors(k.S1, k.A).cross(new THREE.Vector3().subVectors(k.S2, k.A)).normalize();
    if (n.dot(k.A.clone().add(k.N)) < 0) n.negate();
    const u = new THREE.Vector3().crossVectors(v, n).normalize();
    return { u, v, n };
  };
  const f0 = flat(k0);
  const p2 = (p, f, o) => { const d = p.clone().sub(o); return [d.dot(f.u), d.dot(f.v)]; };
  const pts = [k0.A, k0.S1, k0.N, k0.S2].map((p) => p2(p, f0, k0.N));
  const minX = Math.min(...pts.map((q) => q[0])), maxX = Math.max(...pts.map((q) => q[0]));
  const minY = Math.min(...pts.map((q) => q[1])), maxY = Math.max(...pts.map((q) => q[1]));
  const span = Math.max(maxX - minX, maxY - minY) * 1.04;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const uv = (q) => [0.5 + (q[0] - cx) / span, 0.5 + (q[1] - cy) / span];
  // where the number goes: across the wide part, a touch towards the near point
  const sideMid = [(pts[1][0] + pts[3][0]) / 2, (pts[1][1] + pts[3][1]) / 2];
  const numAt = uv([sideMid[0] * 0.8 + pts[2][0] * 0.2, sideMid[1] * 0.8 + pts[2][1] * 0.2]);
  const sideLen = Math.hypot(pts[1][0] - pts[3][0], pts[1][1] - pts[3][1]) / span;

  const pos = [], uvs = [], groups = [], faces = [];
  kites.forEach((k, i) => {
    const f = flat(k);
    // two triangles, wound so the outside faces out
    // UVs from this kite's own flat layout, so no face gets a mirrored number
    const T = [k.A, k.S1, k.N, k.S2].map((pt) => uv(p2(pt, f, k.N)));
    const tri = [[k.A, T[0]], [k.S1, T[1]], [k.N, T[2]], [k.A, T[0]], [k.N, T[2]], [k.S2, T[3]]];
    const nTest = new THREE.Vector3().subVectors(k.S1, k.A).cross(new THREE.Vector3().subVectors(k.N, k.A));
    if (nTest.dot(f.n) < 0) { [tri[1], tri[2]] = [tri[2], tri[1]]; [tri[4], tri[5]] = [tri[5], tri[4]]; }
    groups.push([pos.length / 3, 6, i]);
    for (const [p, t] of tri) { pos.push(p.x, p.y, p.z); uvs.push(t[0], t[1]); }
    faces.push({ value: k.value, normal: f.n.clone(), up: f.v.clone() });
  });
  for (const f of faces) if (!f.value) f.value = 11 - faces.find((o) => o.normal.dot(f.normal) < -0.999).value;
  const inradius = faces[0].normal.dot(k0.A);
  shape = { pos, uvs, groups, faces, numAt, sideLen, inradius };
  return shape;
}

// size = distance from the centre to an apex
export function d10Geometry(size = 1) {
  const s = buildShape();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(s.pos.map((x) => x * size / H), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(s.uvs, 2));
  for (const [start, count, m] of s.groups) g.addGroup(start, count, m);
  g.computeVertexNormals(); // non-indexed, so each kite stays flat
  return g;
}

const texCache = new Map();
function faceTexture(color, value) {
  const key = color + ':' + value;
  if (texCache.has(key)) return texCache.get(key);
  const s = buildShape();
  const W = 256;
  const c = document.createElement('canvas'); c.width = c.height = W;
  const g = c.getContext('2d');
  const base = new THREE.Color(color);
  const light = base.clone().lerp(new THREE.Color('#ffffff'), 0.28), dark = base.clone().lerp(new THREE.Color('#000000'), 0.18);
  const grd = g.createLinearGradient(0, 0, 0, W);
  grd.addColorStop(0, '#' + light.getHexString()); grd.addColorStop(1, '#' + dark.getHexString());
  g.fillStyle = grd; g.fillRect(0, 0, W, W);
  const x = s.numAt[0] * W, y = (1 - s.numAt[1]) * W;
  const fs = s.sideLen * W * (value === 10 ? 0.4 : 0.5);
  g.font = `900 ${fs}px system-ui, Arial, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round'; g.lineWidth = fs * 0.16; g.strokeStyle = 'rgba(20,8,4,0.85)';
  g.strokeText(String(value), x, y);
  g.fillStyle = '#fffaf0'; g.fillText(String(value), x, y);
  // 6 and 9 look the same upside down: underline them
  if (value === 6 || value === 9) { g.fillRect(x - fs * 0.24, y + fs * 0.42, fs * 0.48, fs * 0.09); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}

// A die mesh in a player's colour. mesh.userData.rest = how high its centre sits when lying on a face.
export function makeD10(color = '#ff4f8b', size = 1) {
  const s = buildShape();
  const mats = s.faces.map((f) => new THREE.MeshStandardMaterial({ map: faceTexture(color, f.value), roughness: 0.32, metalness: 0.05 }));
  const mesh = new THREE.Mesh(d10Geometry(size), mats);
  mesh.userData.rest = s.inradius * size / H;
  mesh.userData.size = size;
  return mesh;
}

// The rotation that leaves `value` on top, its number reading upright for someone looking along `facing`
// (the direction the top of the number should point, e.g. away from the camera).
export function restQuaternion(value, facing = new THREE.Vector3(0, 0, -1)) {
  const f = buildShape().faces.find((x) => x.value === value) || buildShape().faces[0];
  const q = new THREE.Quaternion().setFromUnitVectors(f.normal, new THREE.Vector3(0, 1, 0));
  const up = f.up.clone().applyQuaternion(q).setY(0).normalize();
  const want = facing.clone().setY(0).normalize();
  const yaw = Math.atan2(up.x, up.z) - Math.atan2(want.x, want.z);
  return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -yaw).multiply(q);
}

export const D10_SIDES = SIDES;
// the value on each face, in the geometry's group order
export const d10Values = () => buildShape().faces.map((f) => f.value);
