// Reusable scenery for the maps: houses, pubs, poles, tanks, windmills, cars, trees, bushes, rocks.
// Trees, bushes and rocks are batched into instanced meshes so a map can have hundreds of them.
import * as THREE from 'three';
import { mergeGeometries } from '../../vendor/BufferGeometryUtils.js';
import { surf, mat } from './kit.js';

const TAU = Math.PI * 2;

// ---------- buildings ----------
// A miner's cottage: walls, a corrugated gable roof, a bullnose verandah, door, windows, chimney.
export function cottage(k, x, z, rot = 0, { wall = 'weatherboard', color = 0xe8e2d0, roof = 0x9aa3a8, trim = 0x2f5d3a, w = 8, d = 7, h = 3.2 } = {}, parent = k.root) {
  const g = k.group(x, parent === k.root ? k.heightAt(x, z) : 0, z, rot, 1, parent);
  const wm = wall === 'brick' ? surf('brick', { unit: 2.5 }) : wall === 'corrugated' ? surf('corrugated', { unit: 2, tint: color, metalness: 0.5 }) : wall === 'render' ? surf('render', { arg: color, unit: 3 }) : surf('weatherboard', { arg: color, unit: 2.5 });
  k.box(w, 0.4, d, surf('sandstone', { unit: 2 }), 0, 0, 0, g); // stone footing
  k.box(w, h, d, wm, 0, 0.4, 0, g);
  // gable roof: two sloping sheets of corrugated iron
  const roofM = surf('corrugated', { unit: 1.5, tint: roof, metalness: 0.6 });
  const pitch = 0.6, half = d / 2 + 0.4, run = half / Math.cos(pitch);
  for (const s of [-1, 1]) {
    const r = k.box(w + 0.8, 0.08, run, roofM, 0, 0, 0, g);
    r.position.set(0, h + 0.4 + Math.tan(pitch) * half / 2, s * half / 2);
    r.rotation.x = s * pitch;
  }
  // gable ends
  const tri = [[-d / 2, 0], [d / 2, 0], [0, Math.tan(pitch) * d / 2]];
  for (const s of [-1, 1]) { const e = k.extrude(tri, 0.1, wm, g); e.rotation.y = Math.PI / 2; e.position.set(s * (w / 2 - 0.05), h + 0.4, 0); }
  // chimney
  k.box(0.8, 2.6, 0.8, surf('brick', { unit: 2.5 }), w / 2 - 1.4, h + 0.4, -d / 4, g);
  // front: door and two windows
  k.box(1.0, 2.1, 0.1, trim, 0, 0.4, d / 2 + 0.02, g);
  k.window(1.0, 1.4, -w / 4 - 0.4, 2.2, d / 2 + 0.03, g);
  k.window(1.0, 1.4, w / 4 + 0.4, 2.2, d / 2 + 0.03, g);
  // verandah: posts and a curved (bullnose) iron roof
  const vd = 2.2;
  k.box(w, 0.2, vd, surf('planks', { unit: 2 }), 0, 0.2, d / 2 + vd / 2, g);
  for (let i = 0; i <= 3; i++) k.cyl(0.08, 0.08, 2.6, trim, -w / 2 + 0.2 + i * (w - 0.4) / 3, 0.4, d / 2 + vd - 0.1, g, {}, 8);
  const bull = new THREE.Mesh(new THREE.CylinderGeometry(vd, vd, w + 0.2, 20, 1, true, 0, Math.PI / 2), surf('corrugated', { unit: 1.5, tint: roof, metalness: 0.6, side: THREE.DoubleSide }));
  bull.rotation.z = Math.PI / 2; bull.position.set(0, 3.0 - 0.05, d / 2); bull.scale.set(0.45, 1, 1);
  bull.castShadow = true;
  g.add(bull);
  return g;
}

// A big two-storey corner pub with a double verandah and cast-iron lace.
export function pub(k, x, z, rot, { name, color = 0xe6d6b0, trim = 0x23503a, roof = 0x8a8f92, w = 20, d = 12, signBg = '#5b1f1a', signFg = '#f4e2b0' } = {}, parent = k.root) {
  const g = k.group(x, parent === k.root ? k.heightAt(x, z) : 0, z, rot, 1, parent);
  const wallM = surf('render', { arg: color, unit: 4 });
  const H = 9;
  k.box(w, H, d, wallM, 0, 0, 0, g);
  k.box(w + 0.4, 0.5, d + 0.4, color, 0, H, 0, g); // cornice
  k.box(w * 0.5, 1.6, 0.4, wallM, 0, H + 0.5, d / 2 - 0.2, g); // parapet
  k.box(w, 0.08, d, surf('corrugated', { unit: 1.5, tint: roof, metalness: 0.6 }), 0, H - 0.1, 0, g);
  for (let fl = 0; fl < 2; fl++) for (let i = 0; i < 6; i++) {
    const wx = -w / 2 + 1.8 + i * (w - 3.6) / 5;
    if (fl === 0 && (i === 2 || i === 3)) k.box(1.6, 2.6, 0.1, 0x3a2516, wx, 0.1, d / 2 + 0.02, g); // doors
    else k.window(1.1, 1.9, wx, fl ? 6.4 : 2.2, d / 2 + 0.03, g, trim);
  }
  // double verandah with lace frieze and balustrade
  const vd = 3.2, lace = surf('lace', { unit: 1.6, tint: 0xf2efe2 });
  k.box(w, 0.25, vd, surf('planks', { unit: 2 }), 0, 4.4, d / 2 + vd / 2, g);
  k.box(w, 0.15, vd, surf('corrugated', { unit: 1.5, tint: roof, metalness: 0.6 }), 0, 8.6, d / 2 + vd / 2, g);
  const posts = 8;
  for (let i = 0; i < posts; i++) {
    const px = -w / 2 + 0.3 + i * (w - 0.6) / (posts - 1);
    k.cyl(0.1, 0.1, 8.6, trim, px, 0, d / 2 + vd - 0.15, g, { metalness: 0.4, roughness: 0.4 }, 10);
  }
  for (const y of [3.6, 7.8]) { const l = k.plane(w - 0.4, 0.7, lace, 0, y, d / 2 + vd - 0.12, g); l.castShadow = true; }
  const bal = k.plane(w - 0.4, 1.0, lace, 0, 5.2, d / 2 + vd - 0.12, g); bal.castShadow = true;
  k.box(w, 0.1, 0.12, trim, 0, 5.7, d / 2 + vd - 0.12, g);
  if (name) k.sign(name, w * 0.45, 1.3, 0, H + 1.35, d / 2 + 0.02, g, { bg: signBg, fg: signFg, font: '900 90px Georgia, serif' });
  return g;
}

// A country main-street shop: rendered parapet facade with the shop's name, big display windows,
// a recessed door, and a posted street verandah over the footpath. Front faces +z.
export function shopfront(k, x, z, rot, { name = '', color = 0xe2d2b0, trim = 0x2d4a3a, roof = 0x8d8f8c, w = 9, d = 9, h = 5, signBg = '#2d4a3a', signFg = '#f4e2b0', glow = null, window = 0xffe6b0 } = {}, parent = k.root) {
  const g = k.group(x, parent === k.root ? k.heightAt(x, z) : 0, z, rot, 1, parent);
  const wallM = surf('render', { arg: color, unit: 3 });
  k.box(w, h, d, wallM, 0, 0, 0, g);
  k.box(w, 0.08, d - 0.6, surf('corrugated', { unit: 1.5, tint: roof, metalness: 0.6 }), 0, h - 0.4, -0.3, g);
  // stepped parapet with a cornice and a little pediment in the middle
  k.box(w, 1.6, 0.35, wallM, 0, h, d / 2 - 0.17, g);
  k.box(w + 0.2, 0.22, 0.5, color, 0, h + 1.5, d / 2 - 0.15, g);
  k.extrude([[-1.4, 0], [1.4, 0], [0, 0.8]], 0.35, wallM, g).position.set(0, h + 1.7, d / 2 - 0.17);
  for (const sx of [-1, 1]) k.box(0.4, h + 1.8, 0.45, color, sx * (w / 2 - 0.2), 0, d / 2 - 0.1, g); // pilasters
  if (name) k.sign(name, w - 1.4, 0.95, 0, h + 0.75, d / 2 + 0.02, g, { bg: signBg, fg: signFg, glow, font: '900 110px Georgia, serif' });
  // shop windows lit warm from inside, with a timber stall-board under them
  const lit = new THREE.MeshStandardMaterial({ color: window, emissive: window, emissiveIntensity: 0.35, roughness: 0.15, metalness: 0.2 });
  for (const sx of [-1, 1]) {
    const ww = w / 2 - 1.5;
    k.box(ww, 0.7, 0.2, trim, sx * (ww / 2 + 0.9), 0, d / 2 + 0.05, g);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(ww, 2.2), lit); pane.position.set(sx * (ww / 2 + 0.9), 1.85, d / 2 + 0.03); g.add(pane);
    k.box(ww, 0.1, 0.16, trim, sx * (ww / 2 + 0.9), 2.95, d / 2 + 0.06, g);
    for (let i = 1; i < 3; i++) k.box(0.07, 2.2, 0.12, trim, sx * (0.9 + ww * i / 3), 0.75, d / 2 + 0.06, g);
  }
  k.box(1.3, 2.4, 0.12, 0x3a2516, 0, 0, d / 2 - 0.2, g); // recessed door
  k.box(1.5, 0.15, 0.6, trim, 0, 2.4, d / 2 - 0.05, g);
  // street verandah over the footpath: posts at the kerb, a flat iron roof with a fascia
  const vd = 3, vh = 3.4;
  k.box(w, 0.12, vd, surf('concrete', { unit: 2 }), 0, 0, d / 2 + vd / 2, g); // footpath
  const roofV = k.box(w + 0.1, 0.1, vd + 0.2, surf('corrugated', { unit: 1.5, tint: roof, metalness: 0.6 }), 0, vh, d / 2 + vd / 2, g);
  roofV.rotation.x = 0.08;
  k.box(w + 0.1, 0.35, 0.08, trim, 0, vh - 0.25, d / 2 + vd + 0.05, g);
  for (let i = 0; i < 3; i++) k.cyl(0.07, 0.07, vh, trim, -w / 2 + 0.3 + i * (w - 0.6) / 2, 0, d / 2 + vd - 0.1, g, { metalness: 0.4, roughness: 0.4 }, 8);
  return g;
}

// Office tower for city skylines.
export function tower(k, x, z, { w = 10, d = 10, h = 40, color = 0x6c8094, rot = 0 } = {}, parent = k.root) {
  const g = k.group(x, parent === k.root ? k.heightAt(x, z) : 0, z, rot, 1, parent);
  k.box(w, h, d, surf('windows', { arg: color, unit: 15, metalness: 0.55 }), 0, 0, 0, g);
  k.box(w * 0.7, 2, d * 0.7, 0x55595e, 0, h, 0, g);
  return g;
}

// Corrugated rain-water tank on a stand.
export function waterTank(k, x, z, parent = k.root) {
  const g = k.group(x, parent === k.root ? k.heightAt(x, z) : 0, z, 0, 1, parent);
  for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.beam([px, 0, pz], [px * 0.9, 3, pz * 0.9], 0.18, surf('planks', { unit: 2 }), g);
  k.box(2.6, 0.2, 2.6, surf('planks', { unit: 2 }), 0, 3, 0, g);
  k.cyl(1.4, 1.4, 2.6, surf('corrugated', { unit: 0.9, metalness: 0.6 }), 0, 3.2, 0, g, {}, 28);
  k.cone(1.5, 0.5, surf('corrugated', { unit: 0.9, metalness: 0.6 }), 0, 5.8, 0, g, {}, 28);
  return g;
}

// Southern Cross windmill: lattice tower, fan and tail.
export function windmill(k, x, z, parent = k.root) {
  const g = k.group(x, parent === k.root ? k.heightAt(x, z) : 0, z, Math.random() * TAU, 1, parent);
  const H = 11, steel = surf('steel', { unit: 1, metalness: 0.7 });
  for (const [px, pz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) k.beam([px, 0, pz], [px * 0.12, H, pz * 0.12], 0.12, steel, g);
  for (let y = 2; y < H; y += 2.2) { const s = 1.6 * (1 - y / H * 0.88); for (const [a, b] of [[[-s, y, -s], [s, y, -s]], [[s, y, -s], [s, y, s]], [[s, y, s], [-s, y, s]], [[-s, y, s], [-s, y, -s]]]) k.beam(a, b, 0.07, steel, g); }
  const head = k.group(0, H + 0.3, 0, 0, 1, g);
  const fan = k.group(0, 0, 0.6, 0, 1, head);
  for (let i = 0; i < 18; i++) { const b = k.box(0.3, 2.4, 0.03, 0xd7d7d2, 0, 0.4, 0, fan, { metalness: 0.6, roughness: 0.4 }); b.parent.remove(b); const piv = new THREE.Group(); piv.rotation.z = i / 18 * TAU; b.position.y = 1.6; b.rotation.y = 0.5; piv.add(b); fan.add(piv); }
  k.torus(2.8, 0.05, 0xb0b0aa, 0, 0, 0, fan, { metalness: 0.6 });
  k.box(0.08, 0.08, 3.2, steel, 0, -0.04, -1.6, head);
  const tail = k.box(2.2, 1.6, 0.03, 0xc9ccc8, 0, -0.6, -3.2, head, { metalness: 0.5 }); tail.rotation.y = Math.PI / 2;
  k.sign('SOUTHERN CROSS', 2.0, 0.4, 0.02, 0.2, -3.2, head, { bg: '#c9ccc8', fg: '#b3261e', font: '900 60px system-ui' }).rotation.y = Math.PI / 2;
  g.userData.spin = fan;
  return g;
}

// Timber power pole with a cross-arm; returns the top so callers can string wires between poles.
export function powerPole(k, x, z, parent = k.root) {
  const y0 = k.heightAt(x, z), H = 9;
  const g = k.group(x, y0, z, 0, 1, parent);
  k.cyl(0.14, 0.18, H, surf('planks', { unit: 2 }), 0, 0, 0, g, {}, 8);
  k.box(2.4, 0.16, 0.16, surf('planks', { unit: 2 }), 0, H - 0.6, 0, g);
  for (const px of [-1, 0, 1]) k.cyl(0.05, 0.05, 0.25, 0x6a8a7a, px, H - 0.44, 0, g, { roughness: 0.2 }, 6);
  return [x, y0 + H - 0.2, z];
}
export function wires(k, tops, parent = k.root) {
  for (let i = 1; i < tops.length; i++) for (const off of [-1, 1]) {
    const a = new THREE.Vector3(...tops[i - 1]), b = new THREE.Vector3(...tops[i]);
    const pts = [];
    for (let t = 0; t <= 8; t++) { const p = a.clone().lerp(b, t / 8); p.y -= Math.sin(t / 8 * Math.PI) * 0.6; p.x += off * 0.9 * 0; pts.push(p); }
    const curve = new THREE.CatmullRomCurve3(pts);
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.025, 4), mat(0x1a1a1a));
    m.position.x = off * 0.9;
    parent.add(m);
  }
}

// A car or ute from a side profile. style: 'sedan' | 'ute' | 'coupe'
export function car(k, x, z, rot, { color = 0xb3261e, style = 'sedan', metal = true } = {}, parent = k.root) {
  const g = k.group(x, parent === k.root ? k.heightAt(x, z) : 0, z, rot, 1, parent);
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: metal ? 0.6 : 0.1, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 });
  const prof = {
    sedan: [[-2.3, 0.35], [2.3, 0.35], [2.35, 0.9], [1.4, 1.05], [0.8, 1.6], [-0.9, 1.6], [-1.6, 1.05], [-2.35, 1.0]],
    ute: [[-2.6, 0.35], [2.4, 0.35], [2.45, 0.95], [1.5, 1.05], [0.9, 1.65], [-0.2, 1.65], [-0.35, 1.1], [-2.6, 1.1]],
    coupe: [[-2.4, 0.3], [2.4, 0.3], [2.5, 0.75], [1.3, 0.95], [0.5, 1.45], [-0.9, 1.4], [-2.4, 0.95]],
  }[style];
  const body = k.extrude(prof, 1.75, paint, g, {}, 0.08);
  body.castShadow = true;
  // windows: a slightly smaller dark copy of the cabin
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0c1218, metalness: 0.2, roughness: 0.05, clearcoat: 1 });
  const cab = style === 'ute' ? [[1.42, 1.08], [0.86, 1.6], [-0.15, 1.6], [-0.3, 1.1]] : style === 'coupe' ? [[1.25, 0.98], [0.48, 1.4], [-0.85, 1.36], [-1.5, 0.98]] : [[1.35, 1.08], [0.78, 1.56], [-0.86, 1.56], [-1.55, 1.08]];
  k.extrude(cab, 1.8, glass, g);
  for (const [wx, wz] of [[-1.5, -0.88], [1.5, -0.88], [-1.5, 0.88], [1.5, 0.88]]) {
    const tyre = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.13, 10, 20), mat(0x151515, { roughness: 0.9 }));
    tyre.position.set(wx, 0.45, wz); g.add(tyre); tyre.castShadow = true;
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.22, 16), mat(0xb8bcc0, { metalness: 0.9, roughness: 0.25 }));
    rim.rotation.x = Math.PI / 2; rim.position.set(wx, 0.45, wz); g.add(rim);
  }
  k.box(0.1, 0.18, 1.5, 0xfff6d0, 2.42, 0.62, 0, g, { emissive: 0xfff2c0, emissiveIntensity: 0.4 }); // headlights
  k.box(0.08, 0.16, 1.5, 0xaa0000, -2.4, 0.7, 0, g, { emissive: 0x880000, emissiveIntensity: 0.5 }); // tail lights
  if (style === 'ute') { k.box(2.2, 0.1, 1.7, 0x222222, -1.45, 0.95, 0, g); k.box(1.2, 0.7, 1.9, 0x1b1b1b, 2.6, 0.4, 0, g, { metalness: 0.8 }); } // tray + bullbar
  return g;
}

// ---------- vegetation and rocks (instanced) ----------
// Collect positions, then build() makes one instanced mesh per part.
export class Batch {
  constructor(scene) { this.scene = scene; this.kinds = new Map(); }
  add(kind, make, x, y, z, s = 1, rotY = Math.random() * TAU) {
    if (!this.kinds.has(kind)) this.kinds.set(kind, { parts: make(), list: [] });
    this.kinds.get(kind).list.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0)), new THREE.Vector3(s, s, s)));
  }
  build() {
    for (const { parts, list } of this.kinds.values()) for (const { geo, material, shadow = true } of parts) {
      const m = new THREE.InstancedMesh(geo, material, list.length);
      list.forEach((mx, i) => m.setMatrixAt(i, mx));
      m.castShadow = shadow; m.receiveShadow = true;
      this.scene.add(m);
    }
  }
}

function tapered(a, b, r0, r1) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const g = new THREE.CylinderGeometry(r1, r0, va.distanceTo(vb), 7, 1);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, uv.getY(i) * va.distanceTo(vb) / 2);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize()));
  g.translate(...va.clone().add(vb).multiplyScalar(0.5).toArray());
  return g;
}
// crossed leaf cards around a point, so a canopy looks full from any side
function leafCluster(cx, cy, cz, size, rng) {
  const out = [];
  for (let i = 0; i < 3; i++) {
    const p = new THREE.PlaneGeometry(size, size * 0.8);
    p.rotateY(i / 3 * Math.PI + rng() * 0.3); p.rotateX((rng() - 0.5) * 0.6);
    p.translate(cx, cy, cz);
    out.push(p);
  }
  const top = new THREE.PlaneGeometry(size, size); top.rotateX(-Math.PI / 2); top.translate(cx, cy + size * 0.15, cz);
  out.push(top);
  return out;
}

// A eucalypt: pale trunk that forks into branches, with drooping leaf clumps.
export function gumTreeParts(seed = 1, tall = 1) {
  let a = seed * 9973;
  const rng = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
  const wood = [], leaves = [], core = [];
  const H = (7 + rng() * 3) * tall;
  wood.push(tapered([0, 0, 0], [0.2, H * 0.45, 0], 0.55, 0.38));
  const branches = 4 + Math.floor(rng() * 3);
  for (let i = 0; i < branches; i++) {
    const ang = i / branches * TAU + rng(), out = 2 + rng() * 2.5, up = H * (0.75 + rng() * 0.35);
    const mid = [Math.cos(ang) * out * 0.5, H * 0.6, Math.sin(ang) * out * 0.5];
    const tip = [Math.cos(ang) * out, up, Math.sin(ang) * out];
    wood.push(tapered([0.2, H * 0.43, 0], mid, 0.32, 0.2), tapered(mid, tip, 0.2, 0.08));
    for (let j = 0; j < 3; j++) {
      const cx = tip[0] + (rng() - 0.5) * 2, cy = tip[1] + (rng() - 0.3) * 1.5, cz = tip[2] + (rng() - 0.5) * 2, size = 2.6 + rng() * 1.5;
      leaves.push(...leafCluster(cx, cy, cz, size, rng));
      const puff = new THREE.IcosahedronGeometry(size * 0.26, 1); puff.scale(1, 0.7, 1); puff.translate(cx, cy, cz); core.push(puff);
    }
  }
  return [
    { geo: mergeGeometries(wood), material: surf('bark', { unit: 1 }) },
    { geo: mergeGeometries(leaves), material: surf('leaves', { unit: 2.5 }) },
    { geo: mergeGeometries(core), material: mat(0x4f6a4a, { roughness: 0.95 }) },
  ];
}

// A flowering cherry (sakura): dark trunk, wide low branches, clouds of pink blossom.
export function cherryTreeParts(seed = 1) {
  let a = seed * 6007;
  const rng = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
  const wood = [], bloom = [], core = [];
  const H = 4.5 + rng() * 1.5;
  wood.push(tapered([0, 0, 0], [0.3, H * 0.5, 0], 0.4, 0.3));
  const branches = 5 + Math.floor(rng() * 3);
  for (let i = 0; i < branches; i++) {
    const ang = i / branches * TAU + rng() * 0.6, out = 2.5 + rng() * 2.5, up = H * (0.8 + rng() * 0.3);
    const mid = [Math.cos(ang) * out * 0.55, H * 0.68, Math.sin(ang) * out * 0.55];
    const tip = [Math.cos(ang) * out, up, Math.sin(ang) * out];
    wood.push(tapered([0.3, H * 0.48, 0], mid, 0.24, 0.15), tapered(mid, tip, 0.15, 0.06));
    for (let j = 0; j < 4; j++) {
      const cx = tip[0] * (0.6 + rng() * 0.5) + (rng() - 0.5), cy = tip[1] + (rng() - 0.2) * 1.4, cz = tip[2] * (0.6 + rng() * 0.5) + (rng() - 0.5), size = 2.2 + rng() * 1.4;
      // solid, lumpy clouds of blossom (flat cards read as cardboard from the low cameras)
      for (let q = 0; q < 3; q++) {
        const r = size * (0.26 + rng() * 0.12), puff = new THREE.IcosahedronGeometry(r, 2), P = puff.attributes.position, ph = rng() * 9;
        for (let k = 0; k < P.count; k++) { const x = P.getX(k), y = P.getY(k), z = P.getZ(k), f = 1 + 0.16 * Math.sin(x * 5 / r + ph) * Math.sin(y * 4 / r + z * 3 / r); P.setXYZ(k, x * f, y * f * 0.72, z * f); }
        puff.computeVertexNormals();
        puff.translate(cx + (rng() - 0.5) * size * 0.45, cy + (rng() - 0.5) * size * 0.2, cz + (rng() - 0.5) * size * 0.45); bloom.push(puff);
      }
      const puff = new THREE.IcosahedronGeometry(size * 0.22, 1); puff.translate(cx, cy - size * 0.1, cz); core.push(puff);
    }
  }
  return [
    { geo: mergeGeometries(wood), material: surf('cherrybark', { unit: 1.2 }) },
    { geo: mergeGeometries(bloom), material: surf('blossom', { unit: 1.4 }) },
    { geo: mergeGeometries(core), material: mat(0xd88aa8, { roughness: 0.9 }) },
  ];
}

// Old man saltbush: a dense, rounded, silvery blue-grey mound, a few lumpy domes pushed together.
// Solid geometry (with a fine leafy bump map) reads as a bush from the board camera; cards looked like paper.
export function saltbushParts(seed = 1) {
  let a = seed * 7919;
  const rng = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
  const lumps = [];
  const n = 4 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    const r = 0.45 + rng() * 0.3, ang = rng() * TAU, d = i ? 0.35 + rng() * 0.35 : 0;
    const geo = new THREE.IcosahedronGeometry(r, 3);
    const P = geo.attributes.position, ph = rng() * 10;
    const colors = new Float32Array(P.count * 3);
    for (let j = 0; j < P.count; j++) {
      const x = P.getX(j), y = P.getY(j), z = P.getZ(j);
      // knobbly outline: a few sine bumps at two scales
      const k = 1 + 0.12 * Math.sin(x * 9 + ph) * Math.sin(z * 8 - ph) + 0.06 * Math.sin((x + y + z) * 23 + ph);
      P.setXYZ(j, x * k, Math.max(-0.05, y * k * 0.78), z * k);
      // silver on top where the sun bleaches it, darker grey-green underneath
      const t = Math.max(0, Math.min(1, (y / r + 0.4)));
      const speck = 0.92 + 0.16 * Math.abs(Math.sin(x * 37 + z * 29 + ph));
      colors[j * 3] = (0.40 + t * 0.30) * speck; colors[j * 3 + 1] = (0.46 + t * 0.30) * speck; colors[j * 3 + 2] = (0.40 + t * 0.26) * speck;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const uv = geo.attributes.uv; for (let j = 0; j < uv.count; j++) uv.setXY(j, P.getX(j) * 1.6 + P.getY(j), P.getZ(j) * 1.6 + P.getY(j));
    geo.translate(Math.cos(ang) * d, r * 0.62, Math.sin(ang) * d);
    lumps.push(geo);
  }
  const leafy = surf('saltbush', { unit: 1.2 });
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, normalMap: leafy.normalMap, normalScale: new THREE.Vector2(2.2, 2.2), color: 0xd8e0d0 });
  return [{ geo: mergeGeometries(lumps), material: m }];
}

export function rockParts(seed = 1, material = null) {
  let a = seed * 4241;
  const rng = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
  const g = new THREE.DodecahedronGeometry(1, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const s = 0.75 + rng() * 0.4; p.setXYZ(i, p.getX(i) * s * 1.3, p.getY(i) * s * 0.6, p.getZ(i) * s); }
  g.computeVertexNormals();
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i), p.getY(i) + p.getZ(i));
  g.translate(0, 0.2, 0);
  return [{ geo: g, material: material || surf('sandstone', { unit: 1.5, tint: 0xc77a50 }) }];
}
