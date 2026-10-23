// Little modelling kit the maps use to build their landmarks out of simple shapes.
// Every landmark is a placeholder that can be swapped for a real .glb model later: give the
// landmark a `glb` path in the map file and the renderer loads that instead (see render.js).
import * as THREE from 'three';

const mats = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.05, ...opts }));
  return mats.get(key);
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
  lines.forEach((l, i) => g.fillText(l, w / 2, lh * (i + 0.5)));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function makeKit(root) {
  const k = {
    THREE,
    root,
    mat,
    textTexture,
    group(x = 0, y = 0, z = 0, rotY = 0, scale = 1, parent = root) {
      const g = new THREE.Group();
      g.position.set(x, y, z); g.rotation.y = rotY; g.scale.setScalar(scale);
      parent.add(g);
      return g;
    },
    box(w, h, d, color, x, y, z, parent = root, opts) { return place(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts)), x, y + h / 2, z, parent); },
    cyl(rt, rb, h, color, x, y, z, parent = root, opts, seg = 16) { return place(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color, opts)), x, y + h / 2, z, parent); },
    cone(r, h, color, x, y, z, parent = root, opts, seg = 16) { return place(new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat(color, opts)), x, y + h / 2, z, parent); },
    ball(r, color, x, y, z, parent = root, opts) { return place(new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), mat(color, opts)), x, y, z, parent); },
    torus(r, tube, color, x, y, z, parent = root, opts) { return place(new THREE.Mesh(new THREE.TorusGeometry(r, tube, 10, 32), mat(color, opts)), x, y, z, parent); },
    // a beam between two 3D points
    beam(a, b, thick, color, parent = root, opts) {
      const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
      const len = va.distanceTo(vb);
      const m = new THREE.Mesh(new THREE.BoxGeometry(thick, len, thick), mat(color, opts));
      m.position.copy(va).add(vb).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
      m.castShadow = true;
      parent.add(m);
      return m;
    },
    sign(text, w, h, x, y, z, parent = root, style = {}) {
      const tex = textTexture(text, { w: 512, h: Math.round(512 * h / w), ...style });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, emissive: style.glow ? 0xffffff : 0x000000, emissiveMap: style.glow ? tex : null, emissiveIntensity: style.glow ? 0.9 : 0, side: THREE.DoubleSide }));
      m.position.set(x, y, z);
      parent.add(m);
      return m;
    },
    // scatter small things (bushes, rocks) in a ring, avoiding the board
    scatter(count, rMin, rMax, make, rng = Math.random) {
      for (let i = 0; i < count; i++) {
        const a = rng() * Math.PI * 2, r = rMin + rng() * (rMax - rMin);
        make(Math.cos(a) * r, Math.sin(a) * r, rng);
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
