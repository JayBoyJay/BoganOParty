// Just a Trim: everyone's got a hedge out the front and a pole trimmer. Walk along your hedge (that
// happens on its own) and slide your phone up and down to set the height of the blade: everything above
// it comes off. Trim the top of the hedge into the shape on the sign (the Opera House, Uluru, a roo...).
// You can't stick it back on, so go easy. Closest to the shape wins.
import { addSky } from '../../host/sky.js';

const HW = 4.6, HD = 0.95; // hedge width and depth
const HMAX = 2.6, BASE = 0.45, TOP = 2.4; // uncut height; the shape spans BASE..TOP
const NC = 116; // columns across each hedge
const PASS = 24; // seconds to walk the length of the hedge
const RATE = 3.2; // how fast the blade can move up and down, m/s
const BLADE = 0.12; // blade width
const DOLL = 0.62;
const DOTS = 200; // most dots in the line to follow on each hedge
// ----- the shapes -----
// Each shape is the top edge of a silhouette, as a height (0 = ground, 1 = the top of the shape's
// range) for every point u along the hedge (0 = left end, 1 = right end). The hedge is only ever cut
// from above, so a shape can't have overhangs; it's built by stacking simple pieces and keeping the
// highest one at each point. `art` draws the bits you can't trim (windows, ribs, an eye) on the sign.
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const ease = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
const box = (u, a, b, h) => (u >= a && u <= b ? h : 0);
// a rounded-top block: flat at h in the middle, corners of radius r (in u) rounded off
const slab = (u, a, b, h, r, lo = 0) => {
  if (u < a || u > b) return 0;
  const d = Math.min(u - a, b - u);
  return d >= r ? h : lo + (h - lo) * Math.sqrt(1 - ((r - d) / r) ** 2);
};
// the top of a superellipse: p = 2 is a half ellipse, bigger p is boxier
const dome = (u, c, r, h, lo = 0, p = 2) => { const s = Math.abs(u - c) / r; return s < 1 ? lo + (h - lo) * (1 - s ** p) ** (1 / p) : 0; };
const spike = (u, c, w, h, lo) => { const s = Math.abs(u - c) / w; return s < 1 ? lo + (h - lo) * (1 - s) : 0; };
// a smooth line through points [u, h], with no overshoot between them (monotone cubic)
const curve = (pts) => {
  const n = pts.length, d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((pts[i + 1][1] - pts[i][1]) / (pts[i + 1][0] - pts[i][0]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : 2 / (1 / d[i - 1] + 1 / d[i]);
  return (u) => {
    if (u <= pts[0][0]) return pts[0][1];
    if (u >= pts[n - 1][0]) return pts[n - 1][1];
    let i = 0; while (u > pts[i + 1][0]) i++;
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], hh = x1 - x0, t = (u - x0) / hh;
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * hh * m[i] + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * hh * m[i + 1];
  };
};
// one Opera House shell: a hooked front rising to the tip, then a long curved back
const shell = (u, tip, h, front, back, lo) => {
  if (u >= tip - front && u <= tip) return lo + (h - lo) * ((u - tip + front) / front) ** 2.2;
  if (u > tip && u <= tip + back) return lo + (h - lo) * (1 - (u - tip) / back) ** 0.55;
  return 0;
};
const bottle = (u, c, lo) => {
  const d = Math.abs(u - c);
  if (d < 0.022) return 0.9 - (d > 0.017 ? 0.03 : 0); // neck, with the lip of the cap
  if (d < 0.066) return 0.5 + 0.22 * (1 - ease((d - 0.022) / 0.044)); // shoulders
  return lo;
};

// a roo mid-hop, facing right: long tail, big round rump, ears up, snout out front
const kangaroo = curve([[0, 0.04], [0.02, 0.06], [0.1, 0.12], [0.2, 0.22], [0.28, 0.36], [0.34, 0.54], [0.4, 0.66], [0.46, 0.71], [0.52, 0.7],
  [0.58, 0.63], [0.62, 0.56], [0.65, 0.54], [0.68, 0.6], [0.7, 0.66], [0.722, 0.95], [0.745, 0.69], [0.77, 0.67], [0.81, 0.63], [0.85, 0.58],
  [0.875, 0.54], [0.882, 0.46], [0.895, 0.43], [0.912, 0.41], [0.92, 0.3], [0.935, 0.08], [1, 0.04]]);
const ute = curve([[0.44, 0.68], [0.47, 0.72], [0.5, 0.74], [0.6, 0.74], [0.64, 0.71], [0.7, 0.55], [0.73, 0.5], [0.85, 0.48], [0.93, 0.45]]);

const SHAPES = [
  {
    name: 'THE OPERA HOUSE',
    f: (u) => Math.max(box(u, 0, 1, 0.06), box(u, 0.03, 0.97, 0.12),
      shell(u, 0.08, 0.5, 0.035, 0.13, 0.12), shell(u, 0.17, 0.75, 0.04, 0.16, 0.12), shell(u, 0.28, 0.97, 0.045, 0.18, 0.12),
      shell(u, 0.55, 0.42, 0.03, 0.11, 0.12), shell(u, 0.63, 0.6, 0.035, 0.13, 0.12), shell(u, 0.72, 0.78, 0.04, 0.15, 0.12),
      shell(u, 0.895, 0.36, 0.025, 0.06, 0.12)),
    art(g, X, Y) { // the ribs on each shell
      g.strokeStyle = 'rgba(230,245,210,0.45)'; g.lineWidth = 3;
      for (const [tip, h, back] of [[0.08, 0.5, 0.13], [0.17, 0.75, 0.16], [0.28, 0.97, 0.18], [0.55, 0.42, 0.11], [0.63, 0.6, 0.13], [0.72, 0.78, 0.15], [0.895, 0.36, 0.06]]) {
        for (let k = 1; k <= 3; k++) { g.beginPath(); g.moveTo(X(tip), Y(h)); g.quadraticCurveTo(X(tip + back * 0.3 * k / 3), Y(h * 0.6), X(tip + back * (0.25 + k * 0.22)), Y(0.13)); g.stroke(); }
      }
    },
  },
  {
    name: 'ULURU',
    f: (u) => Math.max(0.05, dome(u - 0.012 * Math.sin(u * 9), 0.5, 0.44, 0.7, 0.05, 2.6) * (1 + 0.12 * (0.5 - u))
      - 0.035 * Math.exp(-(((u - 0.3) / 0.012) ** 2)) - 0.03 * Math.exp(-(((u - 0.62) / 0.01) ** 2)) - 0.025 * Math.exp(-(((u - 0.45) / 0.008) ** 2))),
    art(g, X, Y) { // the streaks down the rock
      g.strokeStyle = 'rgba(20,40,12,0.35)'; g.lineWidth = 3;
      for (const u of [0.16, 0.22, 0.3, 0.38, 0.45, 0.53, 0.62, 0.7, 0.78, 0.86]) { g.beginPath(); g.moveTo(X(u), Y(0.62)); g.quadraticCurveTo(X(u + 0.01), Y(0.35), X(u - 0.005), Y(0.07)); g.stroke(); }
    },
  },
  {
    name: 'A KANGAROO',
    f: kangaroo,
    art(g, X, Y) { g.fillStyle = '#f4ead2'; g.beginPath(); g.arc(X(0.78), Y(0.6), 6, 0, Math.PI * 2); g.fill(); }, // an eye
  },
  {
    name: 'THE HARBOUR BRIDGE',
    f: (u) => Math.max(box(u, 0, 1, 0.3), slab(u, 0.04, 0.16, 0.66, 0.006), box(u, 0.06, 0.14, 0.72), slab(u, 0.84, 0.96, 0.66, 0.006), box(u, 0.86, 0.94, 0.72),
      u > 0.16 && u < 0.84 ? 0.4 + 0.56 * (1 - ((u - 0.5) / 0.4) ** 2) : 0),
    art(g, X, Y) { // the truss in the arch
      g.strokeStyle = 'rgba(230,245,210,0.5)'; g.lineWidth = 3;
      const top = (u) => 0.4 + 0.56 * (1 - ((u - 0.5) / 0.4) ** 2), bot = (u) => 0.3 + 0.48 * (1 - ((u - 0.5) / 0.36) ** 2);
      g.beginPath(); for (let i = 0; i <= 40; i++) { const u = 0.16 + i / 40 * 0.68; g[i ? 'lineTo' : 'moveTo'](X(u), Y(Math.max(0.3, bot(u)))); } g.stroke();
      for (let i = 0; i < 16; i++) { const a = 0.18 + i * 0.04, b = a + 0.04; g.beginPath(); g.moveTo(X(a), Y(Math.max(0.3, bot(a)))); g.lineTo(X(b), Y(top(b) - 0.02)); g.moveTo(X(b), Y(Math.max(0.3, bot(b)))); g.lineTo(X(b), Y(top(b) - 0.02)); g.stroke(); }
      g.fillStyle = 'rgba(20,40,12,0.35)'; for (const c of [0.1, 0.9]) g.fillRect(X(c - 0.025), Y(0.6), X(0.05) - X(0), Y(0.38) - Y(0.6));
    },
  },
  {
    name: 'THE UTE',
    f: (u) => Math.max(box(u, 0, 1, 0.04), slab(u, 0.03, 0.44, 0.4, 0.008), slab(u, 0.14, 0.34, 0.56, 0.012, 0.4), box(u, 0.21, 0.27, 0.6), // the tray, with an esky in it
      u >= 0.44 && u <= 0.93 ? ute(u) : 0, slab(u, 0.925, 0.965, 0.54, 0.006)), // the cab, the bonnet and a roo bar
    art(g, X, Y) {
      g.fillStyle = 'rgba(230,245,210,0.55)'; // windows
      g.beginPath(); g.moveTo(X(0.5), Y(0.7)); g.lineTo(X(0.59), Y(0.7)); g.lineTo(X(0.66), Y(0.55)); g.lineTo(X(0.5), Y(0.55)); g.fill();
      g.fillRect(X(0.14), Y(0.5), X(0.2) - X(0), 5); // the esky lid
      g.fillStyle = '#1d2a18'; for (const c of [0.16, 0.8]) { g.beginPath(); g.arc(X(c), Y(0.12), 30, 0, Math.PI * 2); g.fill(); } // wheels
    },
  },
  {
    name: 'THE BIG PINEAPPLE',
    f: (u) => Math.max(0.04, dome(u, 0.5, 0.24, 0.6, 0.04, 2.3),
      spike(u, 0.39, 0.04, 0.72, 0.5), spike(u, 0.445, 0.04, 0.88, 0.55), spike(u, 0.5, 0.045, 1, 0.58), spike(u, 0.555, 0.04, 0.88, 0.55), spike(u, 0.61, 0.04, 0.72, 0.5)),
    art(g, X, Y) { // the diamond pattern
      g.save(); g.beginPath(); for (let i = 0; i <= 60; i++) { const u = 0.27 + i / 60 * 0.46; g[i ? 'lineTo' : 'moveTo'](X(u), Y(dome(u, 0.5, 0.24, 0.6, 0.04, 2.3) - 0.02)); } g.lineTo(X(0.73), Y(0.04)); g.lineTo(X(0.27), Y(0.04)); g.clip();
      g.strokeStyle = 'rgba(240,200,80,0.55)'; g.lineWidth = 3;
      for (let k = -8; k <= 8; k++) { g.beginPath(); g.moveTo(X(0.5 + k * 0.05), Y(0.04)); g.lineTo(X(0.5 + k * 0.05 + 0.3), Y(0.64)); g.moveTo(X(0.5 + k * 0.05), Y(0.04)); g.lineTo(X(0.5 + k * 0.05 - 0.3), Y(0.64)); g.stroke(); }
      g.restore();
    },
  },
  {
    name: 'AN ESKY AND TWO STUBBIES',
    f: (u) => Math.max(0.04, slab(u, 0.06, 0.4, 0.42, 0.01), slab(u, 0.05, 0.41, 0.48, 0.02, 0.42), slab(u, 0.18, 0.28, 0.55, 0.012, 0.48), bottle(u, 0.6, 0.04), bottle(u, 0.82, 0.04)),
    art(g, X, Y) {
      g.fillStyle = 'rgba(230,245,210,0.5)'; g.fillRect(X(0.06), Y(0.43), X(0.4) - X(0.06), 6); // the lid line
      for (const c of [0.6, 0.82]) g.fillRect(X(c - 0.05), Y(0.38), X(0.1) - X(0), Y(0.2) - Y(0.38)); // the labels
    },
  },
];

// a hedge's leaves: a canvas of overlapping little privet leaves
function leafCanvas() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#1f3d16'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 5200; i++) {
    const x = Math.random() * 512, y = Math.random() * 512, l = 5 + Math.random() * 7, a = Math.random() * Math.PI;
    const k = Math.random();
    g.fillStyle = `hsl(${95 + Math.random() * 25}, ${45 + Math.random() * 20}%, ${14 + k * 26}%)`;
    g.beginPath(); g.ellipse(x, y, l, l * 0.5, a, 0, Math.PI * 2); g.fill();
    if (k > 0.75) { g.fillStyle = 'rgba(220,255,180,0.25)'; g.beginPath(); g.ellipse(x - 1, y - 1, l * 0.5, l * 0.2, a, 0, Math.PI * 2); g.fill(); }
  }
  return c;
}

export default {
  id: 'just-a-trim',
  name: 'Just a Trim',
  blurb: 'Pole trimmer, one hedge each, one shape to copy. Closest to the shape wins.',
  howTo: 'You walk along your hedge by yourself. Slide your thumb up and down your phone to raise and lower the trimmer: anything above the blade gets cut off. Trim the top of the hedge to match the dotted line. Cut too low and it does not grow back!',
  padText: 'Slide to set the blade height',
  duration: 34,
  pad: { kind: 'slider', thumb: '✂️', start: 1, hint: 'Top = blade up high (no cut)' },

  create(mg) {
    const { THREE, kit, scene, players, rng, renderer, sfx } = mg;
    const shape = SHAPES[(rng() * SHAPES.length) | 0];
    // the shape's height in metres at u, from a table so the scoring loop stays cheap
    const TABLE = 1000, tab = new Float32Array(TABLE + 1).map((_, i) => BASE + clamp01(shape.f(i / TABLE)) * (TOP - BASE));
    const target = (u) => { const x = clamp01(u) * TABLE, i = Math.min(TABLE - 1, x | 0); return tab[i] + (tab[i + 1] - tab[i]) * (x - i); };
    const { sun } = addSky(scene, renderer, { elevation: 40, azimuth: 30, turbidity: 3, sunIntensity: 3.1, sky: 0xd8e8ff, ground: 0x6a6448, hemi: 0.6, env: 0.6, shadowSize: 24, fog: [0xd6e2ea, 60, 160] });
    sun.target.position.set(0, 0, -2);

    const n = players.length, rows = n > 4 ? 2 : 1, perRow = Math.ceil(n / rows);
    const GAP = 1.0, rowW = perRow * HW + (perRow - 1) * GAP;

    // ----- a front yard: lawn, a brick veneer house behind, the hedges along a garden bed -----
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(120, 80), (() => { const m = kit.surf('grass', { unit: 3, tint: 0xbcd08a }).clone(); for (const k of ['map', 'normalMap', 'roughnessMap']) if (m[k]) { m[k] = m[k].clone(); m[k].repeat.set(40, 27); m[k].needsUpdate = true; } return m; })());
    lawn.rotation.x = -Math.PI / 2; lawn.receiveShadow = true; scene.add(lawn);
    const house = kit.group(0, 0, -9 - (rows - 1) * 4);
    kit.box(rowW + 14, 3.2, 8, kit.surf('brick', { unit: 2.5, tint: 0xd8a888 }), 0, 0, -4, house);
    const roof = kit.box(rowW + 15, 0.12, 6, kit.surf('kawara', { unit: 1.4, tint: 0x8a3a2a }), 0, 3.2, -2.2, house); roof.rotation.x = 0.42;
    for (let i = -2; i <= 2; i++) if (i) kit.window(1.8, 1.3, i * (rowW + 10) / 5, 2.4, 0.02, house);
    kit.box(1.1, 2.2, 0.1, 0x5a3a24, 0, 0, 0.03, house);
    // the shape, on a sign painted by someone who means business
    const signC = document.createElement('canvas'); signC.width = 1024; signC.height = 420;
    {
      const g = signC.getContext('2d');
      g.fillStyle = '#f4ead2'; g.fillRect(0, 0, 1024, 420); g.strokeStyle = '#5b1f1a'; g.lineWidth = 16; g.strokeRect(8, 8, 1008, 404);
      g.fillStyle = '#5b1f1a'; g.font = '900 84px Impact, "Arial Black", sans-serif'; g.textAlign = 'center'; g.fillText(`TODAY: ${shape.name}`, 512, 96, 960);
      const X = (u) => 112 + u * 800, Y = (h) => 380 - (BASE + h * (TOP - BASE) - 0.25) / (HMAX - 0.25) * 260;
      const outline = () => { g.beginPath(); g.moveTo(X(0), 380); for (let i = 0; i <= 400; i++) g.lineTo(X(i / 400), Y(clamp01(shape.f(i / 400)))); g.lineTo(X(1), 380); g.closePath(); };
      outline(); g.fillStyle = '#2f6b26'; g.fill();
      if (shape.art) { g.save(); outline(); g.clip(); shape.art(g, X, Y); g.restore(); }
      outline(); g.strokeStyle = '#173a12'; g.lineWidth = 5; g.lineJoin = 'round'; g.stroke();
    }
    const signT = new THREE.CanvasTexture(signC); signT.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 2.2), new THREE.MeshStandardMaterial({ map: signT, roughness: 0.7 }));
    sign.position.set(0, 5.15, 0.3); house.add(sign);
    kit.box(5.6, 0.12, 0.12, 0x5a3a24, 0, 3.95, 0.25, house);

    const leafTex = new THREE.CanvasTexture(leafCanvas()); leafTex.colorSpace = THREE.SRGBColorSpace; leafTex.wrapS = leafTex.wrapT = THREE.RepeatWrapping;
    const leafM = new THREE.MeshStandardMaterial({ map: leafTex, roughness: 0.9, side: THREE.DoubleSide });
    const cutM = new THREE.MeshStandardMaterial({ map: leafTex, color: 0xc8e0a0, roughness: 0.9 });
    const mulch = kit.surf('redDirt', { unit: 1.5, tint: 0x7a5034 });
    const dotGeo = new THREE.SphereGeometry(0.038, 8, 6), dotM = new THREE.MeshBasicMaterial({ color: 0xffffff });

    // a hedge as one mesh: a front face, a back face and a top, with a column of vertices every slice so
    // the top can be cut down column by column
    const makeHedge = (ox, oy, oz) => {
      const cols = NC + 1, verts = cols * 6; // per column: front-bottom, front-top, back-bottom, back-top, top-front, top-back
      const pos = new Float32Array(verts * 3), uv = new Float32Array(verts * 2), idx = [];
      const h = new Float32Array(cols).fill(HMAX), jit = new Float32Array(cols).map(() => (Math.random() - 0.5) * 0.06);
      const bulge = new Float32Array(cols).map((_, i) => Math.sin(i * 0.7) * 0.02 + (Math.random() - 0.5) * 0.04);
      const write = () => {
        for (let i = 0; i < cols; i++) {
          const x = -HW / 2 + (i / NC) * HW, top = h[i] + jit[i] * (h[i] >= HMAX - 0.01 ? 1 : 0.25), f = HD / 2 + bulge[i], b = -HD / 2 - bulge[i];
          const v = [[x, 0, f], [x, top, f], [x, 0, b], [x, top, b], [x, top, f - 0.02], [x, top + 0.015, b + 0.02]];
          v.forEach((p, k) => { pos.set(p, (i * 6 + k) * 3); });
          const u = (x + ox) / 1.4;
          uv.set([u, 0, u, top / 1.4, -u, 0, -u, top / 1.4, u, 0, u, HD / 1.4], i * 12);
        }
      };
      for (let i = 0; i < NC; i++) {
        const a = i * 6, b = (i + 1) * 6;
        idx.push(a, b, a + 1, b, b + 1, a + 1); // front
        idx.push(a + 2, a + 3, b + 2, b + 2, a + 3, b + 3); // back
        idx.push(a + 4, b + 4, a + 5, b + 4, b + 5, a + 5); // top
      }
      write();
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx);
      geo.addGroup(0, NC * 12, 0); geo.addGroup(NC * 12, NC * 6, 1);
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, [leafM, cutM]); mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.position.set(ox, oy, oz); scene.add(mesh);
      // end caps, which shrink when the end columns get cut
      const caps = [0, NC].map((i) => { const cap = new THREE.Mesh(new THREE.PlaneGeometry(HD, 1), leafM); cap.rotation.y = Math.PI / 2; cap.position.set(ox - HW / 2 + (i / NC) * HW, oy, oz); scene.add(cap); return { cap, i }; });
      const fitCaps = () => { for (const { cap, i } of caps) { cap.scale.y = h[i]; cap.position.y = oy + h[i] / 2; } };
      fitCaps();
      // garden bed of mulch with a sleeper edge
      kit.box(HW + 0.6, 0.08, HD + 0.8, mulch, ox, oy, oz).castShadow = false;
      kit.box(HW + 0.7, 0.16, 0.12, kit.surf('planks', { unit: 1.2, tint: 0x7a5a3a }), ox, oy, oz + HD / 2 + 0.42);
      // the dotted line to follow
      // spaced evenly along the outline, so the steep sides of a shape get dots too
      const line = [];
      for (let i = 0; i <= 400; i++) line.push([i / 400 * HW, target(i / 400)]);
      const along = [0];
      for (let i = 1; i < line.length; i++) along.push(along[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
      const nDots = Math.min(DOTS, Math.round(along[along.length - 1] / 0.085)), dots = new THREE.InstancedMesh(dotGeo, dotM, nDots);
      for (let i = 0, j = 0; i < nDots; i++) {
        const d = (i + 0.5) / nDots * along[along.length - 1];
        while (along[j + 1] < d) j++;
        const k = (d - along[j]) / (along[j + 1] - along[j] || 1);
        const x = line[j][0] + (line[j + 1][0] - line[j][0]) * k, y = line[j][1] + (line[j + 1][1] - line[j][1]) * k;
        dots.setMatrixAt(i, new THREE.Matrix4().makeTranslation(ox - HW / 2 + x, oy + y, oz + HD / 2 + 0.12));
      }
      scene.add(dots);
      return { mesh, geo, h, write: () => { write(); fitCaps(); }, dots };
    };

    // ----- the gardeners -----
    const pops = [];
    const pop = (x, y, z, text, color, size = 1) => {
      const c = document.createElement('canvas'); c.width = 512; c.height = 160;
      const g = c.getContext('2d'); g.font = '900 100px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 14; g.strokeStyle = '#1a0d08'; g.strokeText(text, 256, 84, 500); g.fillStyle = color; g.fillText(text, 256, 84, 500);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); sp.scale.set(3.2 * size, 1 * size, 1); sp.renderOrder = 20;
      sp.position.set(x, y, z); scene.add(sp); pops.push({ sp, life: 0, stay: size > 1.1 });
    };
    const clips = [];
    const clipGeo = new THREE.BoxGeometry(0.06, 0.02, 0.04), clipM = kit.mat(0x4f8a2a, { roughness: 0.9 });
    const poleM = kit.mat(0xc8ccd0, { metalness: 0.8, roughness: 0.3 });
    const gardeners = players.map((p, i) => {
      const row = rows === 2 && i >= perRow ? 1 : 0, k = row ? i - perRow : i, inRow = row ? n - perRow : perRow;
      const w = inRow * HW + (inRow - 1) * GAP;
      const ox = -w / 2 + HW / 2 + k * (HW + GAP), oy = row * 1.3, oz = -row * 4.2;
      if (row) kit.box(HW + GAP, 1.3, 3.6, kit.surf('sandstone', { unit: 1.5 }), ox, 0, oz + 0.6); // the back row is up on a terrace
      const hedge = makeHedge(ox, oy, oz);
      const doll = mg.makeDoll(p, { scale: DOLL });
      const fz = oz + HD / 2 + 1.05;
      doll.group.position.set(ox - HW / 2 - 0.4, oy, fz); scene.add(doll.group);
      // a pole hedge trimmer: a long pole and a toothed blade with an orange motor
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 8), poleM); pole.castShadow = true; scene.add(pole);
      const head = new THREE.Group(); scene.add(head);
      const motor = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.28), kit.mat(0xff7a1a, { roughness: 0.45 })); motor.position.z = 0.16; head.add(motor);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(BLADE * 1.6, 0.03, 0.05), kit.mat(0xd8dde0, { metalness: 0.9, roughness: 0.2 })); blade.rotation.y = 0; head.add(blade);
      for (let t = 0; t < 9; t++) { const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.05, 4), kit.mat(0xd8dde0, { metalness: 0.9 })); tooth.rotation.x = -Math.PI / 2; tooth.position.set(-BLADE * 0.8 + t * BLADE * 0.2, 0, -0.04); head.add(tooth); }
      head.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      return { p, hedge, doll, ox, oy, oz, fz, pole, head, u: -0.06, y: HMAX + 0.3, want: HMAX + 0.3, done: false, shown: false, buzz: 0,
        aimJit: 0, aimT: 0, skill: 0.04 + rng() * 0.08, lagT: 0.1 + rng() * 0.1 };
    });

    const accuracy = (G, upto = 1) => {
      let err = 0, c = 0;
      const last = Math.min(NC, Math.floor(upto * NC));
      for (let i = 0; i <= last; i++) { err += Math.max(0, Math.abs(G.hedge.h[i] - target(i / NC)) - 0.06); c++; } // a few centimetres either way is spot on
      return c ? Math.max(0, 100 * (1 - err / c / 0.6)) : 0;
    };

    const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.3, 300);
    const span = Math.max(rowW + 1.6, 9);
    const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(20)) * 16 / 9);
    const dist = span / 2 / Math.tan(hfov / 2);
    camera.position.set(0, 3.0 + rows * 1.2, dist + 1.2);
    camera.lookAt(0, 1.7 + (rows - 1) * 0.9, -1 - (rows - 1) * 1.6);
    let walking = 0, finishAt = null, tAll = 0;

    return {
      camera,
      update(dt, t, running) {
        tAll += dt;
        if (running) walking += dt;
        let anyCut = false;
        for (const G of gardeners) {
          // walk along the hedge
          if (running && !G.done) { G.u = Math.min(1.04, -0.06 + walking / PASS * 1.1); if (G.u >= 1.04) { G.done = true; } }
          if (G.p.bot && running && !G.done) {
            // CPU: aim a bit ahead along the line, with a wobbly hand and slow reactions
            G.aimT -= dt; if (G.aimT <= 0) { G.aimT = 0.3 + rng() * 0.4; G.aimJit = (rng() * 2 - 1) * G.skill; }
            const ahead = Math.min(1, Math.max(0, G.u + G.lagT * 1.1 / PASS + 0.02));
            const tu = (u) => (u < 0 || u > 1 ? HMAX + 0.3 : target(u));
            G.want = Math.min(tu(ahead), tu(Math.max(0, G.u)) + 0.04) + G.aimJit;
          }
          if (G.done) G.want = HMAX + 0.4;
          const dy = G.want - G.y; G.y += Math.sign(dy) * Math.min(Math.abs(dy), RATE * dt);
          const bx = G.ox - HW / 2 + G.u * HW;
          // cut every column under the blade
          let cut = false;
          const i0 = Math.max(0, Math.floor((G.u * HW - BLADE / 2) / HW * NC)), i1 = Math.min(NC, Math.ceil((G.u * HW + BLADE / 2) / HW * NC));
          for (let i = i0; i <= i1; i++) {
            if (G.y < G.hedge.h[i] - 0.005) {
              const drop = G.hedge.h[i] - Math.max(0.3, G.y);
              G.hedge.h[i] = Math.max(0.3, G.y); cut = true;
              if (drop > 0.02 && clips.length < 260 && rng() < 0.5) {
                const m = new THREE.Mesh(clipGeo, clipM); m.position.set(G.ox - HW / 2 + i / NC * HW, G.oy + G.y + 0.05, G.oz + (rng() - 0.3) * HD); scene.add(m);
                clips.push({ m, vy: rng() * 1.2, vx: (rng() - 0.5) * 0.8, vz: 0.6 + rng() * 1.2, life: 0, spin: rng() * 10, y0: G.oy });
              }
            }
          }
          if (cut) { G.hedge.write(); G.hedge.geo.attributes.position.needsUpdate = true; G.hedge.geo.attributes.uv.needsUpdate = true; G.hedge.geo.computeVertexNormals(); if (!G.p.bot) anyCut = true; }
          G.buzz += dt;
          // the gardener: walks along in front, holds the pole up to the blade
          const walkX = bx - 0.25;
          G.doll.group.position.set(walkX, G.oy + (running && !G.done ? Math.abs(Math.sin(tAll * 7)) * 0.05 : 0), G.fz);
          const hands = new THREE.Vector3(walkX + 0.35, G.oy + 1.5, G.fz - 0.1);
          const bladeP = new THREE.Vector3(bx, G.oy + G.y, G.oz + HD / 2 + 0.05);
          G.head.position.copy(bladeP); G.head.rotation.x = cut ? Math.sin(G.buzz * 60) * 0.03 : 0;
          const mid = hands.clone().add(bladeP).multiplyScalar(0.5), len = hands.distanceTo(bladeP) + 0.6;
          G.pole.position.copy(mid); G.pole.scale.set(1, len, 1);
          G.pole.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), bladeP.clone().sub(hands).normalize());
          G.doll.setArms(Math.max(-0.1, Math.min(1.4, (G.y - 1.2) * 0.7)), 0.2);
          G.doll.update(dt);
          if (G.done && !G.shown && finishAt != null) { G.shown = true; pop(G.ox, G.oy + HMAX + 1.1, G.oz, `${Math.round(accuracy(G))}%`, G.p.color, 1.3); }
        }
        if (anyCut && Math.floor(tAll * 10) !== Math.floor((tAll - dt) * 10)) sfx.play('trim');
        if (finishAt == null && gardeners.every((G) => G.done)) { finishAt = tAll; sfx.play('hallelujah'); }
        for (let i = clips.length - 1; i >= 0; i--) {
          const c = clips[i]; c.life += dt; c.vy -= 6 * dt;
          c.m.position.x += c.vx * dt; c.m.position.z += c.vz * dt; c.m.position.y = Math.max(c.y0 + 0.08, c.m.position.y + c.vy * dt); c.m.rotation.x += c.spin * dt * (c.m.position.y > c.y0 + 0.09 ? 1 : 0);
          if (c.life > 4) { scene.remove(c.m); clips.splice(i, 1); }
        }
        for (let i = pops.length - 1; i >= 0; i--) { const q = pops[i]; q.life += dt; if (q.stay) { q.sp.material.opacity = Math.min(1, q.life * 4); continue; } q.sp.position.y += dt * 1.1; q.sp.material.opacity = Math.min(1, 2.4 - q.life * 2); if (q.life > 1.2) { scene.remove(q.sp); pops.splice(i, 1); } }
      },
      input(p, m) {
        const G = gardeners.find((x) => x.p === p);
        if (G && m.b === 'slide' && Number.isFinite(m.v)) G.want = 0.3 + Math.max(0, Math.min(1, m.v)) * (HMAX + 0.4 - 0.3);
      },
      // how close to the shape, as a percentage, over the bit trimmed so far
      scores() { return Object.fromEntries(gardeners.map((G) => [G.p.id, Math.round(accuracy(G, G.done ? 1 : Math.max(0, G.u)) * 10) / 10])); },
      done: () => finishAt != null && tAll - finishAt > 3,
    };
  },
};
