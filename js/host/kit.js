// Modelling kit the maps use to build their landmarks out of shapes and procedural textures.
// Every landmark can be swapped for a real .glb model later: give the landmark a `glb` path in
// the map file and the board loads that instead (see boardview.js).
import * as THREE from 'three';
import { TEX } from './textures.js';

const mats = new Map();
// A plain material. Pass a THREE.Material to use it as is.
export function mat(color, opts = {}) {
  if (color && color.isMaterial) return color;
  const key = color + JSON.stringify(opts);
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.05, ...opts }));
  return mats.get(key);
}

// A textured material for geometry with world-unit UVs (the kit's shapes have them):
// `unit` is how many metres one tile of the texture covers.
export function surf(name, { arg, unit = 4, tint = 0xffffff, normalScale = 1, ...opts } = {}) {
  const key = `surf:${name}:${arg}:${unit}:${tint}:${normalScale}:${JSON.stringify(opts)}`;
  if (mats.has(key)) return mats.get(key);
  const set = TEX[name](arg);
  const t = (tx) => { if (!tx) return null; const c = tx.clone(); c.repeat.set(1 / unit, 1 / unit); c.needsUpdate = true; return c; };
  const m = new THREE.MeshStandardMaterial({
    map: t(set.map), normalMap: t(set.normalMap), roughnessMap: t(set.roughnessMap), normalScale: new THREE.Vector2(normalScale, normalScale),
    color: tint, roughness: 1, metalness: 0, ...opts,
  });
  if (opts.transparent || name === 'leaves' || name === 'saltbush' || name === 'lace' || name === 'blossom') { m.alphaTest = 0.5; m.transparent = false; m.side = THREE.DoubleSide; }
  mats.set(key, m);
  return m;
}

// Box UVs in metres, so textures keep their size whatever the box size.
export function boxGeo(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; // +x -x +y -y +z -z
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0], uv.getY(k) * dims[f][1]); }
  return g;
}
function cylGeo(rt, rb, h, seg) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  const uv = g.attributes.uv, circ = Math.PI * (rt + rb);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * circ, uv.getY(i) * h);
  return g;
}

function place(mesh, x = 0, y = 0, z = 0, parent) {
  mesh.position.set(x, y, z);
  mesh.castShadow = true; mesh.receiveShadow = true;
  if (parent) parent.add(mesh);
  return mesh;
}

// Text on a canvas, for signs and billboards.
export function textTexture(text, { w = 512, h = 128, bg = '#222', fg = '#fff', font = '900 72px system-ui, sans-serif', glow = null } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (glow) { g.shadowColor = glow; g.shadowBlur = 24; }
  g.fillStyle = fg;
  const lines = String(text).split('\n');
  const lh = h / lines.length;
  // shrink the font until the widest line fits
  const widest = Math.max(...lines.map((l) => g.measureText(l).width));
  if (widest > w * 0.94) g.font = font.replace(/(\d+)px/, (_, n) => Math.floor(n * w * 0.94 / widest) + 'px');
  lines.forEach((l, i) => g.fillText(l, w / 2, lh * (i + 0.5)));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function makeKit(root, { heightAt = () => 0 } = {}) {
  const k = {
    THREE, root, mat, surf, textTexture, heightAt,
    group(x = 0, y = 0, z = 0, rotY = 0, scale = 1, parent = root) {
      const g = new THREE.Group();
      g.position.set(x, y, z); g.rotation.y = rotY; g.scale.setScalar(scale);
      parent.add(g);
      return g;
    },
    // shapes sit on y (their base), centred on x/z. color can be a hex or a material.
    box(w, h, d, color, x, y, z, parent = root, opts) { return place(new THREE.Mesh(boxGeo(w, h, d), mat(color, opts)), x, y + h / 2, z, parent); },
    cyl(rt, rb, h, color, x, y, z, parent = root, opts, seg = 20) { return place(new THREE.Mesh(cylGeo(rt, rb, h, seg), mat(color, opts)), x, y + h / 2, z, parent); },
    cone(r, h, color, x, y, z, parent = root, opts, seg = 20) { return place(new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat(color, opts)), x, y + h / 2, z, parent); },
    ball(r, color, x, y, z, parent = root, opts) { return place(new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20), mat(color, opts)), x, y, z, parent); },
    torus(r, tube, color, x, y, z, parent = root, opts) { return place(new THREE.Mesh(new THREE.TorusGeometry(r, tube, 12, 48), mat(color, opts)), x, y, z, parent); },
    // a beam between two 3D points
    beam(a, b, thick, color, parent = root, opts) {
      const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
      const len = va.distanceTo(vb);
      const m = new THREE.Mesh(boxGeo(thick, len, thick), mat(color, opts));
      m.position.copy(va).add(vb).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
      m.castShadow = true;
      parent.add(m);
      return m;
    },
    // a round rod between two points (pipes, cables, posts)
    rod(a, b, r, color, parent = root, opts) {
      const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, va.distanceTo(vb), 8), mat(color, opts));
      m.position.copy(va).add(vb).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
      m.castShadow = true;
      parent.add(m);
      return m;
    },
    // extrude a 2D outline (in the x/y plane) by depth along z
    extrude(points, depth, color, parent = root, opts = {}, bevel = 0) {
      const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
      const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 16 });
      g.translate(0, 0, -depth / 2);
      const m = new THREE.Mesh(g, mat(color, opts));
      m.castShadow = true; m.receiveShadow = true;
      parent.add(m);
      return m;
    },
    lathe(profile, color, parent = root, opts, seg = 32) {
      const m = new THREE.Mesh(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg), mat(color, opts));
      m.castShadow = true; m.receiveShadow = true;
      parent.add(m);
      return m;
    },
    plane(w, h, color, x, y, z, parent = root, opts) {
      const g = new THREE.PlaneGeometry(w, h);
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h);
      return place(new THREE.Mesh(g, mat(color, opts)), x, y, z, parent);
    },
    sign(text, w, h, x, y, z, parent = root, style = {}) {
      const tex = textTexture(text, { w: 1024, h: Math.round(1024 * h / w), ...style, font: style.font || `900 ${Math.round(1024 * h / w * 0.62)}px system-ui, sans-serif` });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, emissive: style.glow ? 0xffffff : 0x000000, emissiveMap: style.glow ? tex : null, emissiveIntensity: style.glow ? 2.2 : 0, roughness: 0.6, transparent: !style.bg, side: THREE.DoubleSide }));
      m.position.set(x, y, z);
      parent.add(m);
      return m;
    },
    // dark glass window with a painted frame and cross bars, centred on (x, y), in a wall facing +z
    window(w, h, x, y, z, parent = root, frame = 0xf2efe6) {
      const g = k.group(x, y, z, 0, 1, parent);
      k.box(w + 0.18, h + 0.18, 0.06, frame, 0, -(h + 0.18) / 2, 0, g);
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat(0x1a242c, { roughness: 0.05, metalness: 0.7 }));
      glass.position.set(0, 0, 0.035);
      g.add(glass);
      k.box(w, 0.06, 0.08, frame, 0, -0.03, 0.03, g);
      k.box(0.06, h, 0.08, frame, 0, -h / 2, 0.03, g);
      return g;
    },
    // scatter in a ring around the board, sitting on the ground
    scatter(count, rMin, rMax, make, rng = Math.random) {
      for (let i = 0; i < count; i++) {
        const a = rng() * Math.PI * 2, r = rMin + rng() * (rMax - rMin);
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        const h = k.heightAt(x, z);
        if (h < -0.3) continue; // under water
        make(x, z, rng, h);
      }
    },
    // flat label for a landmark, readable from the board camera
    label(text, x, y, z, parent = root) {
      const tex = textTexture(text, { w: 512, h: 96, bg: 'rgba(0,0,0,0.55)', font: '800 54px system-ui, sans-serif' });
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
      s.scale.set(8, 1.5, 1);
      s.position.set(x, y, z);
      parent.add(s);
      return s;
    },
  };
  return k;
}
