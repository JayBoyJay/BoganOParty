// Detailed props for minigame sets. Everything is built from bevelled shapes rather than raw boxes,
// so edges catch the light, and each prop comes back as a Group sitting on y = 0, facing +z.
// Usage: const d = makeDecor(kit); scene.add(d.officeChair({ color: 0x223355 }));
import * as THREE from 'three';
import { RoundedBoxGeometry } from '../../vendor/RoundedBoxGeometry.js';
import { textTexture } from './kit.js';

const geoCache = new Map();
const rbox = (w, h, d, r = 0.03, seg = 2) => {
  const key = `rb:${w}:${h}:${d}:${r}:${seg}`;
  if (!geoCache.has(key)) geoCache.set(key, new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001)));
  return geoCache.get(key);
};
const shade = (m) => { m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return m; };

export function makeDecor(kit) {
  const { mat, surf } = kit;
  const M = (color, opts) => mat(color, opts);
  // a bevelled box, its base at y
  const bx = (g, w, h, d, m, x = 0, y = 0, z = 0, r = 0.03) => { const mesh = new THREE.Mesh(rbox(w, h, d, r), typeof m === 'number' ? M(m) : m); mesh.position.set(x, y + h / 2, z); g.add(mesh); return mesh; };
  const cyl = (g, rt, rb, h, m, x = 0, y = 0, z = 0, seg = 18) => { const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), typeof m === 'number' ? M(m) : m); mesh.position.set(x, y + h / 2, z); g.add(mesh); return mesh; };
  const ball = (g, r, m, x = 0, y = 0, z = 0) => { const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), typeof m === 'number' ? M(m) : m); mesh.position.set(x, y, z); g.add(mesh); return mesh; };
  const tube = (g, pts, r, m) => { const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))); const mesh = new THREE.Mesh(new THREE.TubeGeometry(c, Math.max(8, pts.length * 6), r, 8), typeof m === 'number' ? M(m) : m); g.add(mesh); return mesh; };
  const canvasTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  const panel = (g, w, h, tex, x, y, z, opts = {}) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: opts.roughness ?? 0.6, emissive: opts.glow ? 0xffffff : 0x000000, emissiveMap: opts.glow ? tex : null, emissiveIntensity: opts.glow || 0, transparent: !!opts.transparent })); m.position.set(x, y, z); if (opts.ry) m.rotation.y = opts.ry; g.add(m); return m; };

  const chrome = M(0xc8ccd0, { metalness: 0.9, roughness: 0.25 });
  const blackPlastic = M(0x1c1d20, { roughness: 0.45 });

  let chilla = null; // one logo texture for every esky
  const d = {
    rbox, bx, cyl, ball, tube, canvasTex, panel, shade,

    // ---------- office / LAN party ----------
    officeChair({ color = 0x233a5c, rot = 0 } = {}) {
      const g = new THREE.Group(); g.rotation.y = rot;
      const fab = M(color, { roughness: 0.9 });
      // five-star base on castors
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2, leg = bx(g, 0.05, 0.05, 0.32, blackPlastic, 0, 0.07, 0, 0.02);
        leg.position.set(Math.cos(a) * 0.15, 0.1, Math.sin(a) * 0.15); leg.rotation.y = -a + Math.PI / 2;
        ball(g, 0.035, blackPlastic, Math.cos(a) * 0.3, 0.035, Math.sin(a) * 0.3);
      }
      cyl(g, 0.025, 0.03, 0.32, chrome, 0, 0.1, 0);
      bx(g, 0.5, 0.09, 0.48, fab, 0, 0.42, 0, 0.04);
      const back = bx(g, 0.46, 0.55, 0.07, fab, 0, 0.55, -0.24, 0.04); back.rotation.x = -0.12;
      bx(g, 0.06, 0.25, 0.04, blackPlastic, 0, 0.45, -0.25, 0.015);
      for (const s of [-1, 1]) { bx(g, 0.04, 0.2, 0.04, blackPlastic, s * 0.25, 0.5, 0, 0.015); bx(g, 0.07, 0.035, 0.26, blackPlastic, s * 0.25, 0.7, 0.01, 0.015); }
      return shade(g);
    },
    // a chunky beige CRT, the LAN-party classic
    crt({ screen = null, rot = 0 } = {}) {
      const g = new THREE.Group(); g.rotation.y = rot;
      const beige = M(0xd9d0b4, { roughness: 0.55 });
      bx(g, 0.3, 0.05, 0.28, beige, 0, 0, 0, 0.02);
      cyl(g, 0.06, 0.08, 0.05, beige, 0, 0.04, 0);
      bx(g, 0.52, 0.44, 0.22, beige, 0, 0.08, 0.06, 0.035); // front bezel
      const tail = bx(g, 0.4, 0.34, 0.3, beige, 0, 0.12, -0.18, 0.06); tail.scale.set(1, 1, 1);
      bx(g, 0.28, 0.22, 0.12, beige, 0, 0.18, -0.36, 0.04);
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.32), new THREE.MeshStandardMaterial({ map: screen, color: screen ? 0xffffff : 0x0a1a10, emissive: 0xffffff, emissiveMap: screen, emissiveIntensity: screen ? 1.1 : 0, roughness: 0.15 }));
      glass.position.set(0, 0.3, 0.172); g.add(glass);
      ball(g, 0.008, M(0x5cff7a, { emissive: 0x5cff7a, emissiveIntensity: 3 }), 0.2, 0.11, 0.172);
      return shade(g);
    },
    keyboard({ rot = 0, color = 0xd9d0b4 } = {}) {
      const g = new THREE.Group(); g.rotation.y = rot;
      bx(g, 0.46, 0.025, 0.16, color, 0, 0, 0, 0.01);
      const keyTex = canvasTex(256, 96, (x, w, h) => { x.fillStyle = '#cfc6aa'; x.fillRect(0, 0, w, h); x.fillStyle = '#e9e2cc'; for (let r = 0; r < 5; r++) for (let c = 0; c < 15; c++) x.fillRect(4 + c * 16.6, 4 + r * 18, 14, 15); x.fillRect(60, 76, 120, 15); });
      panel(g, 0.44, 0.14, keyTex, 0, 0.027, 0).rotation.x = -Math.PI / 2;
      const mouse = ball(g, 0.03, color, 0.32, 0.015, 0.02); mouse.scale.set(0.75, 0.5, 1.15);
      tube(g, [[0.32, 0.02, -0.02], [0.3, 0.01, -0.12], [0.22, 0.01, -0.2]], 0.004, blackPlastic);
      return shade(g);
    },
    pizzaBox({ open = false, rot = 0 } = {}) {
      const g = new THREE.Group(); g.rotation.y = rot;
      const card = M(0xc8a070, { roughness: 0.95 });
      bx(g, 0.42, 0.05, 0.42, card, 0, 0, 0, 0.005);
      if (open) {
        const lid = bx(g, 0.42, 0.012, 0.42, card, 0, 0, 0, 0.004); lid.position.set(0, 0.05 + 0.2, -0.21); lid.rotation.x = Math.PI / 2 - 0.2; lid.position.z = -0.24; lid.position.y = 0.24;
        const pz = cyl(g, 0.18, 0.18, 0.015, M(0xe8a040, { roughness: 0.8 }), 0, 0.05, 0, 28);
        for (let k = 0; k < 6; k++) { const a = k * 1.05 + 0.3; cyl(g, 0.025, 0.025, 0.006, M(0xb02a1a), Math.cos(a) * 0.1, 0.066, Math.sin(a) * 0.1, 12); }
        pz.scale.set(1, 1, 1);
      } else {
        const lab = canvasTex(128, 128, (x) => { x.fillStyle = '#c8a070'; x.fillRect(0, 0, 128, 128); x.fillStyle = '#b02a1a'; x.font = '900 30px Georgia, serif'; x.textAlign = 'center'; x.fillText('PIZZA', 64, 60); x.font = '700 14px Georgia, serif'; x.fillText('hot & fresh', 64, 84); });
        panel(g, 0.4, 0.4, lab, 0, 0.052, 0).rotation.x = -Math.PI / 2;
      }
      return shade(g);
    },
    can({ color = 0x1a8a3a, label = null } = {}) {
      const g = new THREE.Group();
      const tex = canvasTex(128, 128, (x) => { x.fillStyle = '#' + new THREE.Color(color).getHexString(); x.fillRect(0, 0, 128, 128); x.fillStyle = '#ffffff'; x.font = '900 34px Impact, sans-serif'; x.textAlign = 'center'; x.fillText(label || 'ZAP', 64, 78); });
      cyl(g, 0.033, 0.033, 0.12, new THREE.MeshStandardMaterial({ map: tex, metalness: 0.6, roughness: 0.3 }), 0, 0, 0, 16);
      cyl(g, 0.028, 0.033, 0.012, chrome, 0, 0.12, 0, 16);
      return shade(g);
    },
    beanbag({ color = 0x8a2a4a } = {}) {
      const g = new THREE.Group();
      const m = M(color, { roughness: 0.75 });
      const b = ball(g, 0.5, m, 0, 0.3, 0); b.scale.set(1.1, 0.62, 1.05);
      const top = ball(g, 0.36, m, 0, 0.42, -0.18); top.scale.set(1, 0.9, 0.7);
      return shade(g);
    },
    pottedPlant({ size = 1 } = {}) {
      const g = new THREE.Group(); g.scale.setScalar(size);
      cyl(g, 0.2, 0.15, 0.36, M(0xd8d2c8, { roughness: 0.5 }), 0, 0, 0, 20);
      cyl(g, 0.185, 0.185, 0.02, M(0x3a2a1a, { roughness: 1 }), 0, 0.33, 0, 20);
      const leaf = M(0x3f8a3a, { roughness: 0.7, side: THREE.DoubleSide });
      for (let k = 0; k < 11; k++) {
        const a = k * 2.4, l = 0.45 + (k % 3) * 0.15;
        const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(0.09, l * 0.5, 0, l); sh.quadraticCurveTo(-0.09, l * 0.5, 0, 0);
        const m = new THREE.Mesh(new THREE.ShapeGeometry(sh, 6), leaf);
        m.position.set(0, 0.34, 0); m.rotation.set(0, a, 0); m.rotateX(-0.35 - (k % 4) * 0.12);
        g.add(m);
      }
      return shade(g);
    },
    bin({ color = 0x3a4a5a } = {}) {
      const g = new THREE.Group();
      cyl(g, 0.17, 0.14, 0.42, M(color, { roughness: 0.4, metalness: 0.3 }), 0, 0, 0, 20);
      const paper = ball(g, 0.06, M(0xf2f0e8, { roughness: 1 }), 0.04, 0.43, 0); paper.scale.set(1, 0.8, 1.1);
      return shade(g);
    },
    // a ceiling fluoro panel that actually lights the room below
    fluoro(w = 1.2, d = 0.6) {
      const g = new THREE.Group();
      bx(g, w + 0.06, 0.05, d + 0.06, M(0xe8e8e4), 0, 0, 0, 0.01);
      const lens = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf4f8ff, emissiveIntensity: 3.2 }));
      lens.rotation.x = Math.PI / 2; lens.position.y = -0.001; g.add(lens);
      return g;
    },
    poster(w, h, draw, { frame = 0x222222 } = {}) {
      const g = new THREE.Group();
      bx(g, w + 0.06, h + 0.06, 0.025, M(frame, { roughness: 0.4 }), 0, -0.03, 0, 0.008);
      panel(g, w, h, canvasTex(Math.round(256 * w / h), 256, draw), 0, h / 2, 0.016, { roughness: 0.35 });
      return shade(g);
    },
    // a window with half-drawn venetian blinds and daylight behind
    blindWindow(w = 1.6, h = 1.2) {
      const g = new THREE.Group();
      const frame = M(0xf0eee8, { roughness: 0.4 });
      bx(g, w + 0.14, 0.07, 0.12, frame, 0, -0.07, 0.02); bx(g, w + 0.14, 0.07, 0.12, frame, 0, h, 0.02);
      for (const s of [-1, 1]) bx(g, 0.07, h, 0.12, frame, s * (w / 2 + 0.035), 0, 0.02);
      const sky = canvasTex(64, 64, (x) => { const gr = x.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, '#bfe0ff'); gr.addColorStop(1, '#eaf6ff'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); });
      panel(g, w, h, sky, 0, h / 2, -0.02, { glow: 1.6 });
      const slat = M(0xf4f2ea, { roughness: 0.5 });
      for (let k = 0; k < Math.round(h * 0.6 / 0.05); k++) { const s = bx(g, w - 0.02, 0.006, 0.05, slat, 0, h - 0.04 - k * 0.05, 0.05, 0.002); s.rotation.x = 0.5; }
      bx(g, w + 0.04, 0.05, 0.08, slat, 0, h - 0.03, 0.06, 0.01);
      return g;
    },
    whiteboard(w = 2.2, h = 1.1, scribble = null) {
      const g = new THREE.Group();
      bx(g, w + 0.06, h + 0.06, 0.04, chrome, 0, 0, 0, 0.01);
      panel(g, w, h, canvasTex(Math.round(320 * w / h), 320, (x, W, H) => { x.fillStyle = '#f6f7f8'; x.fillRect(0, 0, W, H); scribble?.(x, W, H); }), 0, h / 2 + 0.03, 0.022, { roughness: 0.15 });
      bx(g, w * 0.6, 0.03, 0.08, chrome, 0, -0.01, 0.05, 0.01);
      for (const [k, c] of [[0, 0x1a1a1a], [1, 0xc02020], [2, 0x2040c0]]) { const p = cyl(g, 0.012, 0.012, 0.12, M(c), -0.2 + k * 0.08, 0.035, 0.06, 8); p.rotation.z = Math.PI / 2; }
      return shade(g);
    },
    // a desk with rounded edges, a modesty panel, and cable tray
    desk(w = 1.6, dpt = 0.8, { top = 0xc8b08a, legs = 0x2a2c30 } = {}) {
      const g = new THREE.Group();
      bx(g, w, 0.04, dpt, kit.surf('planks', { unit: 1.5, tint: top }), 0, 0.72, 0, 0.012);
      const leg = M(legs, { metalness: 0.6, roughness: 0.35 });
      for (const s of [-1, 1]) { bx(g, 0.05, 0.7, dpt - 0.1, leg, s * (w / 2 - 0.06), 0.02, 0, 0.015); bx(g, 0.07, 0.02, dpt - 0.04, leg, s * (w / 2 - 0.06), 0, 0, 0.008); }
      bx(g, w - 0.16, 0.36, 0.02, M(0x8a8478, { roughness: 0.8 }), 0, 0.34, -dpt / 2 + 0.06, 0.008);
      return shade(g);
    },
    serverRack({ leds = [] } = {}) {
      const g = new THREE.Group();
      const body = M(0x15171b, { roughness: 0.35, metalness: 0.5 });
      bx(g, 0.62, 2.1, 0.9, body, 0, 0, 0, 0.02);
      const mesh = canvasTex(64, 256, (x) => { x.fillStyle = '#0c0d10'; x.fillRect(0, 0, 64, 256); x.fillStyle = '#2a2e36'; for (let r = 0; r < 64; r++) for (let c = 0; c < 16; c++) if ((r + c) % 2) x.fillRect(c * 4, r * 4, 2, 2); });
      panel(g, 0.54, 1.96, mesh, 0, 1.06, 0.452, { roughness: 0.4 });
      for (let u = 0; u < 12; u++) {
        bx(g, 0.5, 0.06, 0.02, M(0x2a2e36, { metalness: 0.6, roughness: 0.3 }), 0, 0.12 + u * 0.16, 0.46, 0.006);
        for (let l = 0; l < 3; l++) {
          const led = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.018, 0.01), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: Math.random() < 0.7 ? 0x3aff6a : 0xffa02a, emissiveIntensity: 3.5 }));
          led.position.set(0.15 + l * 0.04, 0.15 + u * 0.16, 0.475); g.add(led); leds.push(led);
        }
      }
      return shade(g);
    },
    // a cable snaking across the floor between two points
    floorCable(a, b, color = 0x2a5aa8, seed = 1) {
      const g = new THREE.Group();
      const pts = [];
      for (let k = 0; k <= 6; k++) { const t = k / 6; pts.push([a[0] + (b[0] - a[0]) * t + Math.sin(seed + k * 1.7) * 0.25 * Math.sin(t * Math.PI), 0.012, a[1] + (b[1] - a[1]) * t + Math.cos(seed + k * 2.1) * 0.25 * Math.sin(t * Math.PI)]); }
      tube(g, pts, 0.012, M(color, { roughness: 0.5 }));
      return g;
    },

    // ---------- outdoors / Aussie ----------
    // a proper esky: rounded tub, white lid with hinges, side handles and a drain plug
    esky({ color = 0x2a6fd0, w = 0.8, h = 0.5, dp = 0.48, logo = true } = {}) {
      const g = new THREE.Group();
      const tubM = M(color, { roughness: 0.38 });
      bx(g, w, h * 0.82, dp, tubM, 0, 0, 0, 0.06);
      bx(g, w * 0.96, h * 0.04, dp * 0.95, M(new THREE.Color(color).multiplyScalar(0.7).getHex(), { roughness: 0.5 }), 0, h * 0.8, 0, 0.01);
      bx(g, w + 0.02, h * 0.18, dp + 0.02, M(0xf6f6f2, { roughness: 0.3 }), 0, h * 0.82, 0, 0.06);
      bx(g, w * 0.5, 0.03, 0.08, M(0xf6f6f2, { roughness: 0.3 }), 0, h, 0, 0.015); // lid grip
      for (const s of [-1, 1]) { const hd = bx(g, 0.04, 0.06, dp * 0.5, M(0xf6f6f2, { roughness: 0.3 }), s * (w / 2 + 0.02), h * 0.55, 0, 0.02); hd.rotation.z = 0; }
      for (const s of [-1, 1]) cyl(g, 0.015, 0.015, 0.08, M(0xcfcfc8), s * w * 0.3, h * 0.84, -dp / 2 - 0.005, 8).rotation.x = Math.PI / 2;
      cyl(g, 0.025, 0.025, 0.02, M(0xf6f6f2), w * 0.35, 0.06, dp / 2, 10).rotation.x = Math.PI / 2;
      if (logo) {
        const t = chilla || (chilla = canvasTex(256, 80, (x) => { x.fillStyle = '#ffffff'; x.font = '900 italic 56px Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('CHILLA', 128, 42); }));
        panel(g, w * 0.55, w * 0.17, t, 0, h * 0.45, dp / 2 + 0.003, { transparent: true });
      }
      return shade(g);
    },
    // a stack of beer slabs (cartons), shrink-wrapped
    slab({ color = 0x1e5a2a, label = 'DRAUGHT' } = {}) {
      const g = new THREE.Group();
      const t = canvasTex(256, 128, (x) => { x.fillStyle = '#' + new THREE.Color(color).getHexString(); x.fillRect(0, 0, 256, 128); x.fillStyle = '#f4d43a'; x.fillRect(0, 88, 256, 14); x.fillStyle = '#ffffff'; x.font = '900 46px Impact, sans-serif'; x.textAlign = 'center'; x.fillText(label, 128, 66); x.font = '700 18px system-ui'; x.fillText('24 x 375ml CANS', 128, 122); });
      const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 });
      bx(g, 0.6, 0.26, 0.4, m, 0, 0, 0, 0.015);
      return shade(g);
    },
    hayBale({ round = false } = {}) {
      const g = new THREE.Group();
      const hay = surf('saltbush', { unit: 0.6, tint: 0xe8c878 });
      const hm = M(0xd8b860, { roughness: 1 });
      if (round) { const r = cyl(g, 0.6, 0.6, 1.1, hm, 0, 0, 0, 24); r.rotation.z = Math.PI / 2; r.position.y = 0.6; }
      else { bx(g, 1.0, 0.45, 0.5, hm, 0, 0, 0, 0.08); for (const s of [-0.25, 0.25]) bx(g, 1.02, 0.47, 0.025, M(0xb04a2a), s, 0, 0, 0.01).rotation.y = Math.PI / 2; }
      void hay;
      return shade(g);
    },
    // a garden hedge with lumpy leafy top instead of a box
    hedge(len = 4, h = 1.1, dp = 0.9, rng = Math.random) {
      const g = new THREE.Group();
      const leafM = surf('leaves', { unit: 1.2, tint: 0x4a7a32 });
      const dark = M(0x23401a, { roughness: 1 });
      bx(g, len, h * 0.85, dp * 0.86, dark, 0, 0, 0, 0.2);
      for (let x = -len / 2 + 0.25; x <= len / 2 - 0.2; x += 0.42) {
        for (const [yy, zz, r] of [[h * 0.8, 0, 0.38], [h * 0.45, dp * 0.3, 0.34], [h * 0.45, -dp * 0.3, 0.34]]) {
          const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r * (0.85 + rng() * 0.3), 1), leafM);
          b.position.set(x + (rng() - 0.5) * 0.15, yy, zz); b.rotation.set(rng() * 3, rng() * 3, rng() * 3); g.add(b);
        }
      }
      return shade(g);
    },
    picketFence(len = 4, { color = 0xf4f2ea, h = 0.9 } = {}) {
      const g = new THREE.Group();
      const m = M(color, { roughness: 0.6 });
      for (let x = -len / 2; x <= len / 2 + 0.001; x += 0.16) {
        const p = bx(g, 0.08, h, 0.025, m, x, 0, 0, 0.01);
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.057, 0.08, 4), m); tip.rotation.y = Math.PI / 4; tip.position.set(x, h + 0.04, 0); g.add(tip);
        void p;
      }
      for (const y of [0.2, h - 0.2]) bx(g, len + 0.1, 0.07, 0.03, m, 0, y, -0.03, 0.01);
      return shade(g);
    },
    // a stack of tyres
    tyres(count = 3) {
      const g = new THREE.Group();
      const rub = M(0x1a1a1a, { roughness: 0.85 });
      for (let k = 0; k < count; k++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.12, 12, 28), rub); t.rotation.x = Math.PI / 2; t.position.y = 0.12 + k * 0.23; t.rotation.z = k * 0.4; g.add(t); }
      return shade(g);
    },
    // a stubby / long-neck bottle
    bottle({ color = 0x5a3a12, h = 0.3, label = 0xe8d8a8 } = {}) {
      const g = new THREE.Group();
      const glass = new THREE.MeshPhysicalMaterial({ color, roughness: 0.08, metalness: 0, transmission: 0.2, clearcoat: 1 });
      const pts = [[0, 0], [0.04, 0], [0.042, 0.01], [0.042, h * 0.55], [0.03, h * 0.7], [0.016, h * 0.82], [0.016, h * 0.97], [0.019, h], [0, h]].map(([x, y]) => new THREE.Vector2(x, y));
      g.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 16), glass));
      cyl(g, 0.0425, 0.0425, h * 0.25, M(label, { roughness: 0.7 }), 0, h * 0.2, 0, 16);
      cyl(g, 0.02, 0.02, 0.012, M(0xd8b030, { metalness: 0.8, roughness: 0.3 }), 0, h - 0.004, 0, 12);
      return shade(g);
    },
    // a shop gondola shelf unit, filled with a maker for each slot
    shelf({ w = 2, h = 1.8, dp = 0.5, levels = 4, color = 0xe8e8ea, fill = null } = {}) {
      const g = new THREE.Group();
      const m = M(color, { roughness: 0.5, metalness: 0.2 });
      bx(g, w, h, 0.04, m, 0, 0, -dp / 2 + 0.02, 0.01);
      for (const s of [-1, 1]) bx(g, 0.04, h, dp, m, s * (w / 2 - 0.02), 0, 0, 0.01);
      bx(g, w, 0.12, dp, M(0x2a2c30), 0, 0, 0, 0.01);
      for (let l = 0; l < levels; l++) {
        const y = 0.12 + l * ((h - 0.2) / levels);
        bx(g, w - 0.04, 0.025, dp - 0.02, m, 0, y, 0, 0.005);
        bx(g, w - 0.04, 0.04, 0.012, M(0xf4d43a), 0, y - 0.015, dp / 2 - 0.004, 0.004);
        if (fill) fill(g, l, y + 0.025, w - 0.1, dp - 0.06);
      }
      return shade(g);
    },
    textTexture,
  };
  return d;
}
