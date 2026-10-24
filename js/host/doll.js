// The players: inflatable blow-up dolls with the player's photo on the face.
// Each player can send up to four photos (neutral, happy, sad, angry) and the face swaps to match
// what's happening. Without a photo for a mood, a drawn cartoon face stands in.
import * as THREE from 'three';

export const MOODS = ['neutral', 'happy', 'sad', 'angry'];
export const BODIES = [
  { id: 'bloke', label: 'Bloke', emoji: '🩳' },
  { id: 'sheila', label: 'Sheila', emoji: '👙' },
  { id: 'smooth', label: 'Smooth', emoji: '✨', sub: 'No bits' },
  { id: 'both', label: 'Both', emoji: '🎉', sub: 'All the bits' },
];
// Dress-ups, picked on the phone. Outfits are printed on the vinyl; hats are proper 3D bits on the head.
export const OUTFITS = [
  { id: 'nude', label: 'Nude', emoji: '🍑', sub: 'Just vinyl' },
  { id: 'smugglers', label: 'Smugglers', emoji: '🩲', sub: 'Green & gold' },
  { id: 'singlet', label: 'Singlet', emoji: '🎽', sub: 'Stubbies, thongs' },
  { id: 'footy', label: 'Footy', emoji: '🏉', sub: 'Guernsey' },
  { id: 'hivis', label: 'Hi-vis', emoji: '🦺', sub: 'Tradie' },
  { id: 'flanno', label: 'Flanno', emoji: '🧥', sub: 'Trackies, uggs' },
  { id: 'cricket', label: 'Cricket', emoji: '🏏', sub: 'Whites' },
  { id: 'bikini', label: 'Bikini', emoji: '👙', sub: 'Green & gold' },
  { id: 'lifesaver', label: 'Lifesaver', emoji: '🛟', sub: 'Red & yellow' },
];
export const HATS = [
  { id: 'none', label: 'Nothing', emoji: '🚫' },
  { id: 'akubra', label: 'Akubra', emoji: '🤠' },
  { id: 'corks', label: 'Cork hat', emoji: '🍾', sub: 'Keeps flies off' },
  { id: 'trucker', label: 'Trucker', emoji: '🧢' },
  { id: 'bucket', label: 'Bucket hat', emoji: '👒' },
  { id: 'lifesaver', label: 'Surf cap', emoji: '🏄' },
  { id: 'beanie', label: 'Beanie', emoji: '🧶' },
  { id: 'baggygreen', label: 'Baggy green', emoji: '🏏' },
  { id: 'hardhat', label: 'Hard hat', emoji: '⛑️' },
  { id: 'nedkelly', label: 'Ned Kelly', emoji: '🪖', sub: 'Such is life' },
];
export const defaultOutfit = (body) => (body === 'bloke' || body === 'both' ? 'smugglers' : 'nude');
export const PLAYER_COLORS = ['#ff4f8b', '#3da5ff', '#ffd23f', '#5cff9d', '#b06bff', '#ff8a3d', '#3de1ff', '#ff5a5a'];

// ---------- faces ----------
function drawCartoon(g, mood, skin) {
  const S = 256;
  g.fillStyle = skin; g.fillRect(0, 0, S, S);
  g.lineCap = 'round'; g.lineWidth = 9; g.strokeStyle = '#2a1a22'; g.fillStyle = '#2a1a22';
  const eye = (x) => { g.beginPath(); g.ellipse(x, 104, 15, mood === 'happy' ? 8 : 19, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(x + 5, 96, 5, 0, 7); g.fill(); g.fillStyle = '#2a1a22'; };
  eye(92); eye(164);
  // lashes, because it's a doll
  for (const x of [92, 164]) for (const dx of [-12, 0, 12]) { g.lineWidth = 4; g.beginPath(); g.moveTo(x + dx, 84); g.lineTo(x + dx * 1.4, 72); g.stroke(); }
  g.lineWidth = 9;
  if (mood === 'angry') { g.beginPath(); g.moveTo(70, 70); g.lineTo(112, 86); g.moveTo(186, 70); g.lineTo(144, 86); g.stroke(); }
  if (mood === 'sad') { g.beginPath(); g.moveTo(72, 82); g.lineTo(110, 72); g.moveTo(184, 82); g.lineTo(146, 72); g.stroke(); }
  // cheeks
  g.fillStyle = 'rgba(255,80,120,0.35)'; g.beginPath(); g.arc(64, 150, 20, 0, 7); g.arc(192, 150, 20, 0, 7); g.fill();
  g.fillStyle = '#c2185b'; g.strokeStyle = '#c2185b';
  if (mood === 'neutral') { g.beginPath(); g.ellipse(128, 178, 24, 28, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#4a0d22'; g.beginPath(); g.ellipse(128, 178, 13, 16, 0, 0, Math.PI * 2); g.fill(); }
  if (mood === 'happy') { g.beginPath(); g.arc(128, 156, 44, 0.15 * Math.PI, 0.85 * Math.PI); g.closePath(); g.fill(); }
  if (mood === 'sad') { g.lineWidth = 10; g.beginPath(); g.arc(128, 214, 34, 1.2 * Math.PI, 1.8 * Math.PI); g.stroke(); g.fillStyle = '#5ab4ff'; g.beginPath(); g.ellipse(170, 136, 7, 12, 0, 0, 7); g.fill(); }
  if (mood === 'angry') { g.fillStyle = '#fff'; g.fillRect(96, 168, 64, 22); g.lineWidth = 6; g.strokeRect(96, 168, 64, 22); g.beginPath(); for (let x = 112; x < 160; x += 16) { g.moveTo(x, 168); g.lineTo(x, 190); } g.stroke(); }
}

// paints a face onto a 256px canvas: the cartoon with printed hair, then the photo over it once loaded
function paintFace(c, mood, photo, skin, hair, onPhoto) {
  const g = c.getContext('2d');
  drawCartoon(g, mood, skin);
  // printed hair with a fringe, like the cheap ones (a photo covers it)
  g.fillStyle = '#' + new THREE.Color(hair).getHexString();
  g.beginPath(); g.moveTo(0, 0); g.lineTo(256, 0); g.lineTo(256, 170);
  g.quadraticCurveTo(236, 90, 196, 74);
  for (let x = 196; x > 60; x -= 34) g.quadraticCurveTo(x - 17, 92, x - 34, 70); // a fringe of curls
  g.quadraticCurveTo(20, 90, 0, 170); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.ellipse(100, 30, 50, 12, -0.2, 0, 7); g.fill(); // shine on the moulded hair
  if (photo) {
    const img = new Image();
    img.onload = () => {
      g.fillStyle = skin; g.fillRect(0, 0, 256, 256);
      g.save(); g.beginPath(); g.arc(128, 128, 120, 0, Math.PI * 2); g.clip();
      g.drawImage(img, 0, 0, 256, 256);
      g.restore();
      onPhoto?.();
    };
    img.src = photo;
  }
}
const skinOf = (player) => player.skin || '#' + new THREE.Color('#ffcdb8').lerp(new THREE.Color(player.color || '#ff9fb8'), 0.22).getHexString();

const faceCache = new Map(); // `${pid}:${mood}:${photoKey}` -> texture
function faceTexture(pid, mood, photo, skin, hair = 0x3a2418) {
  const key = `${pid}:${mood}:${photo ? photo.length + photo.slice(-24) : 'cartoon'}:${skin}:${hair}`;
  if (faceCache.has(key)) return faceCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  paintFace(c, mood, photo, skin, hair, () => { tex.needsUpdate = true; });
  faceCache.set(key, tex);
  return tex;
}

// A player's doll face as a 256px canvas (photo if they sent one, otherwise the cartoon), for
// minigames that put faces on other things. onPhoto runs when a photo finishes loading onto it.
export function faceCanvas(player, mood = 'neutral', onPhoto) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ph = player.photos || {};
  paintFace(c, mood, ph[mood] || ph.neutral || null, skinOf(player), player.hair ?? 0x3a2418, onPhoto ? () => onPhoto(c) : null);
  return c;
}

// small square image for the HUD and phones (photo or cartoon)
export function faceDataUrl(player, mood = 'neutral') {
  const photo = player.photos?.[mood] || player.photos?.neutral;
  if (photo) return photo;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.scale(0.5, 0.5);
  drawCartoon(g, mood, '#ffd3c4');
  return c.toDataURL('image/png');
}

// ---------- body ----------
// Built like the real thing: two flat sheets of vinyl cut to the doll's outline, heat-welded round
// the edge and blown up. The shape is a 2D outline (a signed distance field); the inflated depth at
// each point comes from solving a Poisson equation inside the outline, which gives round sausage
// limbs and a flatter, pillowy torso. A flat welded seam runs round the whole silhouette.

const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
const ellipse = (x, y, cx, cy, rx, ry) => (Math.hypot((x - cx) / rx, (y - cy) / ry) - 1) * Math.min(rx, ry);
function limb(x, y, ax, ay, bx, by, ra, rb) {
  const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - ax - dx * t, y - ay - dy * t) - (ra + (rb - ra) * t);
}

// The outline, front view: x across, y up, feet at 0. Arms out and down, legs apart, the classic pose.
const SHOULDER = [0.34, 1.7], ARM_DROP = 0.4; // arms hang this far below horizontal (radians) in the model
function bodySdf(kind) {
  const bloke = kind === 'bloke', sheila = kind === 'sheila' || kind === 'both';
  const chest = bloke ? 0.42 : 0.39, hips = bloke ? 0.35 : 0.42, waist = bloke ? 0.33 : 0.29;
  const hx = Math.cos(ARM_DROP) * 0.72, hy = -Math.sin(ARM_DROP) * 0.72;
  return (x, y) => {
    const ax = Math.abs(x); // left and right are mirror images
    let d = ellipse(ax, y, 0, 1.55, chest, 0.3);
    d = smin(d, ellipse(ax, y, 0, 1.24, waist, 0.3), 0.18);
    d = smin(d, ellipse(ax, y, 0, 0.97, hips, 0.22), 0.18);
    d = smin(d, limb(ax, y, 0, 1.78, 0, 2.02, 0.12, 0.1), 0.08); // neck
    d = smin(d, limb(ax, y, SHOULDER[0], SHOULDER[1], SHOULDER[0] + hx, SHOULDER[1] + hy, 0.125, 0.095), 0.12); // arm
    d = smin(d, ellipse(ax, y, SHOULDER[0] + hx + 0.06, SHOULDER[1] + hy - 0.02, 0.13, 0.11), 0.06); // mitten hand
    d = smin(d, limb(ax, y, SHOULDER[0] + hx - 0.02, SHOULDER[1] + hy + 0.06, SHOULDER[0] + hx + 0.04, SHOULDER[1] + hy + 0.14, 0.045, 0.04), 0.03); // thumb
    d = smin(d, limb(ax, y, 0.19, 0.95, 0.3, 0.18, 0.16, 0.105), 0.14); // leg
    d = smin(d, ellipse(ax, y, 0.33, 0.08, 0.12, 0.09), 0.08); // foot
    if (sheila) d = smin(d, ellipse(ax, y, 0.3, 1.55, 0.12, 0.13), 0.1); // a fuller bust in outline
    return d;
  };
}
const headSdf = () => (x, y) => smin(ellipse(x, y, 0, 0, 0.39, 0.45), ellipse(Math.abs(x), y, 0.38, -0.02, 0.06, 0.1), 0.05); // with ears

// Front and back bumps added on top of the inflation: chest, bulge, bum.
function bumpsFor(kind) {
  const b = [];
  if (kind === 'sheila' || kind === 'both') for (const s of [-1, 1]) b.push({ x: s * 0.18, y: 1.52, r: 0.15, h: 0.2, side: 1 });
  if (kind === 'bloke' || kind === 'both') b.push({ x: 0, y: 0.88, r: 0.085, h: 0.08, side: 1 });
  for (const s of [-1, 1]) b.push({ x: s * 0.15, y: 0.94, r: 0.15, h: 0.07, side: -1 });
  return b;
}

// Inflate an outline into a closed pillow. Returns geometry with group 0 = front, 1 = back, the seam
// flange as a separate geometry, and a depth sampler.
function inflate(sdf, { x0, x1, y0, y1, step, depth = (r) => r, bumps = [] }) {
  const nx = Math.round((x1 - x0) / step) + 1, ny = Math.round((y1 - y0) / step) + 1;
  const N = nx * ny, S = new Float32Array(N), H = new Float32Array(N);
  const id = (i, j) => j * nx + i;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) S[id(i, j)] = sdf(x0 + i * step, y0 + j * step);
  // Poisson: laplacian(h) = -1 inside, h = 0 outside; solved by over-relaxed Gauss-Seidel
  for (let k = 0; k < N; k++) H[k] = S[k] < 0 ? S[k] * S[k] / 2 : 0;
  const s2 = step * step;
  for (let it = 0; it < 260; it++) {
    for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
      const k = id(i, j);
      if (S[k] >= 0) continue;
      const v = (H[k - 1] + H[k + 1] + H[k - nx] + H[k + nx] + s2) / 4;
      H[k] += 1.85 * (v - H[k]);
    }
  }
  const zAt = (k, side) => {
    if (S[k] >= 0) return 0;
    let z = depth(Math.sqrt(2 * H[k]));
    const x = x0 + (k % nx) * step, y = y0 + Math.floor(k / nx) * step;
    for (const b of bumps) if (b.side === side) { const q = ((x - b.x) ** 2 + (y - b.y) ** 2) / (b.r * b.r); if (q < 4) z += b.h * Math.exp(-q * 1.6) * Math.min(1, -S[k] / 0.05); }
    return z * side;
  };
  // vertices: inside nodes, plus outside nodes next to the outline snapped onto it (so the edge is smooth)
  const grad = (x, y) => { const e = 0.004, gx = sdf(x + e, y) - sdf(x - e, y), gy = sdf(x, y + e) - sdf(x, y - e), l = Math.hypot(gx, gy) || 1; return [gx / l, gy / l]; };
  const used = new Uint8Array(N);
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const c = [id(i, j), id(i + 1, j), id(i, j + 1), id(i + 1, j + 1)];
    if (c.some((k) => S[k] < 0)) for (const k of c) used[k] = 1;
  }
  const pos = [], uv = [], idx = [], map = [new Int32Array(N).fill(-1), new Int32Array(N).fill(-1)];
  const W = x1 - x0, Ht = y1 - y0;
  for (const [si, side] of [[0, 1], [1, -1]]) {
    for (let k = 0; k < N; k++) {
      if (!used[k]) continue;
      let x = x0 + (k % nx) * step, y = y0 + Math.floor(k / nx) * step;
      if (S[k] >= 0) { const [gx, gy] = grad(x, y); x -= gx * S[k]; y -= gy * S[k]; }
      map[si][k] = pos.length / 3;
      pos.push(x, y, zAt(k, side));
      uv.push(side > 0 ? (x - x0) / W : 1 - (x - x0) / W, (y - y0) / Ht);
    }
  }
  const groups = [];
  for (const [si, side] of [[0, 1], [1, -1]]) {
    const start = idx.length;
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = id(i, j), b = id(i + 1, j), c = id(i, j + 1), d = id(i + 1, j + 1);
      const tri = (p, q, r) => {
        if (S[p] >= 0 && S[q] >= 0 && S[r] >= 0) return;
        const m = map[si];
        if (side > 0) idx.push(m[p], m[q], m[r]); else idx.push(m[p], m[r], m[q]);
      };
      if (!used[a] || !used[b] || !used[c] || !used[d]) continue;
      tri(a, b, d); tri(a, d, c);
    }
    groups.push([start, idx.length - start]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  groups.forEach(([s, c], m) => geo.addGroup(s, c, m));
  geo.computeVertexNormals();

  // the welded seam: marching squares round the outline, each segment pushed out into a flat fin
  const fin = [], FW = 0.035;
  const lerpP = (ka, kb, ia, ja, ib, jb) => { const t = S[ka] / (S[ka] - S[kb]); return [x0 + (ia + (ib - ia) * t) * step, y0 + (ja + (jb - ja) * t) * step]; };
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const ks = [id(i, j), id(i + 1, j), id(i + 1, j + 1), id(i, j + 1)], ij = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]];
    const pts = [];
    for (let e = 0; e < 4; e++) { const a = ks[e], b = ks[(e + 1) % 4]; if ((S[a] < 0) !== (S[b] < 0)) pts.push(lerpP(a, b, ...ij[e], ...ij[(e + 1) % 4])); }
    for (let p = 0; p + 1 < pts.length; p += 2) {
      const [ax, ay] = pts[p], [bx, by] = pts[p + 1];
      const [gax, gay] = grad(ax, ay), [gbx, gby] = grad(bx, by);
      for (const z of [0.004, -0.004]) fin.push(ax, ay, z, bx, by, z, bx + gbx * FW, by + gby * FW, z * 0.4, ax, ay, z, bx + gbx * FW, by + gby * FW, z * 0.4, ax + gax * FW, ay + gay * FW, z * 0.4);
    }
  }
  const seam = new THREE.BufferGeometry();
  seam.setAttribute('position', new THREE.Float32BufferAttribute(fin, 3));
  seam.computeVertexNormals();
  const sample = (x, y, side) => { const i = Math.round((x - x0) / step), j = Math.round((y - y0) / step); return zAt(id(i, j), side); };
  return { geo, seam, sample, bounds: { x0, y0, W, H: Ht } };
}

const BODY_BOUNDS = { x0: -1.3, x1: 1.3, y0: -0.04, y1: 2.08 };
const shapes = new Map();
function bodyShape(kind) {
  if (!shapes.has(kind)) shapes.set(kind, inflate(bodySdf(kind), { ...BODY_BOUNDS, step: 0.02, bumps: bumpsFor(kind), depth: (r) => r * (1.05 - 0.25 * Math.min(1, Math.max(0, (r - 0.1) / 0.25))) }));
  return shapes.get(kind);
}
function headShape() {
  if (!shapes.has('head')) shapes.set('head', inflate(headSdf(), { x0: -0.5, x1: 0.5, y0: -0.52, y1: 0.52, step: 0.014, depth: (r) => r * 1.05 }));
  return shapes.get('head');
}

// ---------- the printed vinyl ----------
const TW = 1024, TH = Math.round(TW * (BODY_BOUNDS.y1 - BODY_BOUNDS.y0) / (BODY_BOUNDS.x1 - BODY_BOUNDS.x0));
const px = (x, y) => [(x - BODY_BOUNDS.x0) / (BODY_BOUNDS.x1 - BODY_BOUNDS.x0) * TW, (1 - (y - BODY_BOUNDS.y0) / (BODY_BOUNDS.y1 - BODY_BOUNDS.y0)) * TH];
const PU = TW / (BODY_BOUNDS.x1 - BODY_BOUNDS.x0); // canvas pixels per metre

function smugglers(g, back) {
  // budgie smugglers in green and gold
  g.fillStyle = '#00843d';
  g.beginPath();
  for (const [x, y] of [[-0.44, 1.07], [0.44, 1.07], [0.4, 0.93], back ? [0.1, 0.8] : [0.13, 0.78], [0, back ? 0.82 : 0.76], back ? [-0.1, 0.8] : [-0.13, 0.78], [-0.4, 0.93]]) g.lineTo(...px(x, y));
  g.closePath(); g.fill();
  g.strokeStyle = '#ffcd00'; g.lineWidth = 0.025 * PU;
  g.beginPath(); g.moveTo(...px(-0.44, 1.06)); g.lineTo(...px(0.44, 1.06)); g.stroke();
}
// Where each part of the doll is, for printing clothes on: masks of the torso, arms, legs and feet.
function parts(kind) {
  const bloke = kind === 'bloke', sheila = kind === 'sheila' || kind === 'both';
  const chest = bloke ? 0.42 : 0.39, hips = bloke ? 0.35 : 0.42, waist = bloke ? 0.33 : 0.29;
  const hx = Math.cos(ARM_DROP) * 0.72, hy = -Math.sin(ARM_DROP) * 0.72;
  const along = (ax, y, a, b, c, d) => { const dx = c - a, dy = d - b; return ((ax - a) * dx + (y - b) * dy) / (dx * dx + dy * dy); };
  return {
    torso: (ax, y) => {
      let d = ellipse(ax, y, 0, 1.55, chest, 0.3);
      d = smin(d, ellipse(ax, y, 0, 1.24, waist, 0.3), 0.18);
      d = smin(d, ellipse(ax, y, 0, 0.97, hips, 0.22), 0.18);
      if (sheila) d = smin(d, ellipse(ax, y, 0.3, 1.55, 0.12, 0.13), 0.1);
      return d < 0.03;
    },
    // t runs 0 at the shoulder to 1 at the wrist
    arm: (ax, y, upto) => limb(ax, y, SHOULDER[0], SHOULDER[1], SHOULDER[0] + hx, SHOULDER[1] + hy, 0.125, 0.095) < 0.05 && along(ax, y, SHOULDER[0], SHOULDER[1], SHOULDER[0] + hx, SHOULDER[1] + hy) <= upto,
    leg: (ax, y) => limb(ax, y, 0.19, 0.95, 0.3, 0.18, 0.16, 0.105) < 0.06,
    foot: (ax, y) => ellipse(ax, y, 0.33, 0.08, 0.12, 0.09) < 0.05,
  };
}
const MW = 256, MH = Math.round(MW * TH / TW), masks = new Map();
function mask(key, pred) {
  if (masks.has(key)) return masks.get(key);
  const c = document.createElement('canvas'); c.width = MW; c.height = MH;
  const g = c.getContext('2d'), img = g.createImageData(MW, MH);
  for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) {
    const x = BODY_BOUNDS.x0 + (i + 0.5) / MW * (BODY_BOUNDS.x1 - BODY_BOUNDS.x0), y = BODY_BOUNDS.y1 - (j + 0.5) / MH * (BODY_BOUNDS.y1 - BODY_BOUNDS.y0);
    if (pred(Math.abs(x), y, x)) img.data[(j * MW + i) * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  masks.set(key, c);
  return c;
}
let scratch = null;
// print one piece of clothing: paint (a colour or a drawing function) cut to the shape pred
function piece(g, key, pred, paint) {
  if (!scratch) { scratch = document.createElement('canvas'); scratch.width = TW; scratch.height = TH; }
  const t = scratch.getContext('2d');
  t.globalCompositeOperation = 'source-over'; t.clearRect(0, 0, TW, TH);
  if (typeof paint === 'string') { t.fillStyle = paint; t.fillRect(0, 0, TW, TH); } else paint(t);
  t.globalCompositeOperation = 'destination-in'; t.imageSmoothingEnabled = true;
  t.drawImage(mask(key, pred), 0, 0, TW, TH);
  t.globalCompositeOperation = 'source-over';
  g.drawImage(scratch, 0, 0);
}
const hoops = (a, b, w, y0 = 0) => (t) => { t.fillStyle = a; t.fillRect(0, 0, TW, TH); t.fillStyle = b; for (let y = y0; y < 2.1; y += w * 2) { const [, p0] = px(0, y + w), [, p1] = px(0, y); t.fillRect(0, p0, TW, p1 - p0); } };
const check = (base, dark, line) => (t) => {
  t.fillStyle = base; t.fillRect(0, 0, TW, TH);
  const s = 0.11 * PU;
  t.fillStyle = dark; for (let x = 0; x < TW; x += s * 2) t.fillRect(x, 0, s, TH);
  t.globalAlpha = 0.55; for (let y = 0; y < TH; y += s * 2) t.fillRect(0, y, TW, s);
  t.globalAlpha = 1; t.fillStyle = line; for (let x = s * 0.5; x < TW; x += s * 2) t.fillRect(x, 0, 2, TH); for (let y = s * 0.5; y < TH; y += s * 2) t.fillRect(0, y, TW, 2);
};
function paintOutfit(g, kind, back, outfit, color, num) {
  const P = parts(kind), K = (n) => `${kind}:${n}`;
  const neck = (ax, y, r = 0.15) => ellipse(ax, y, 0, 1.87, r, back ? 0.07 : 0.13) < 0;
  // a top from the hem up; sleeve is how far down the arm it reaches (0 = none), armhole cuts a singlet
  const top = (name, paint, { hem = 1.02, sleeve = 0, armhole = false, neckR = 0.15 } = {}) => piece(g, K(`top${name}${back}`), (ax, y) =>
    (P.torso(ax, y) && y >= hem && y < 1.9 && !neck(ax, y, neckR) && !(armhole && ellipse(ax, y, 0.43, 1.66, 0.15, 0.24) < 0)) || (sleeve > 0 && P.arm(ax, y, sleeve)), paint);
  // shorts or strides: down the legs to legTo
  const bottom = (name, paint, { waist = 1.07, legTo = 0.7 } = {}) => piece(g, K(`bot${name}`), (ax, y) => (P.torso(ax, y) && y >= 0.7 && y <= waist) || (P.leg(ax, y) && y >= legTo && y <= waist), paint);
  const socks = (name, paint, lo, hi) => piece(g, K(`sock${name}`), (ax, y) => P.leg(ax, y) && y >= lo && y <= hi, paint);
  const shoes = (name, paint, cuff) => piece(g, K(`shoe${name}`), (ax, y) => P.foot(ax, y) || (P.leg(ax, y) && y <= cuff), paint);
  const line = (col, w, ...pts) => { g.strokeStyle = col; g.lineWidth = w * PU; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(...px(x, y)) : g.moveTo(...px(x, y)))); g.stroke(); };
  const band = (y, h, col, x = 0.6) => { const [x0, y0] = px(-x, y + h / 2); g.fillStyle = col; g.fillRect(x0, y0, 2 * x * PU, h * PU); };
  switch (outfit) {
    case 'smugglers': smugglers(g, back); break;
    case 'singlet':
      bottom('stubbies', '#a88f5c', { legTo: 0.72 });
      line('#7d6a42', 0.012, [-0.45, 1.06], [0.45, 1.06]);
      top('singlet', '#22346e', { armhole: true, neckR: 0.17 });
      for (const sx of [-1, 1]) line('#1a2958', 0.01, [sx * 0.18, 1.86], [sx * 0.28, 1.58]);
      // thongs: a sole and the toe strap
      if (!back) for (const sx of [-1, 1]) { line('#1d6fd6', 0.035, [sx * 0.24, 0.0], [sx * 0.43, 0.0]); line('#1d6fd6', 0.018, [sx * 0.26, 0.11], [sx * 0.33, 0.04], [sx * 0.41, 0.11]); }
      else for (const sx of [-1, 1]) line('#1d6fd6', 0.035, [sx * 0.24, 0.0], [sx * 0.43, 0.0]);
      break;
    case 'footy':
      bottom('footy', '#f4f4f0', { legTo: 0.7 });
      socks('footy', hoops(color, '#ffffff', 0.05), 0.18, 0.46);
      shoes('boots', '#151515', 0.18);
      top('footy', hoops(color, '#ffffff', 0.09, 1.0), { armhole: true, neckR: 0.13 });
      line(color, 0.03, ...[...Array(13)].map((_, i) => { const a = Math.PI * (1 + i / 12); return [Math.cos(a) * 0.13, 1.87 + Math.sin(a) * (back ? 0.07 : 0.13)]; }));
      if (back) { const [cx, cy] = px(0, 1.4); g.font = `900 ${0.3 * PU}px Impact, system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 8; g.strokeStyle = '#151515'; g.strokeText(String(num), cx, cy); g.fillStyle = '#ffffff'; g.fillText(String(num), cx, cy); }
      break;
    case 'hivis':
      bottom('navy', '#25304d', { legTo: 0.68 });
      socks('work', '#8b8b86', 0.2, 0.4);
      shoes('steelcaps', '#5b3a1f', 0.22);
      top('hivis', '#ff7410', { sleeve: 0.38, neckR: 0.13 });
      for (const y of [1.2, 1.36]) { band(y, 0.05, '#d9dee2'); band(y, 0.012, '#9aa2a8'); }
      for (const sx of [-1, 1]) line('#d9dee2', 0.045, [sx * 0.17, 1.84], [sx * 0.17, 1.4]);
      line('#d9dee2', 0.03, ...(back ? [[-0.17, 1.62], [0.17, 1.42]] : [[-0.17, 1.62], [0.17, 1.62]]));
      break;
    case 'flanno':
      bottom('trackies', '#8d9096', { legTo: 0.15 });
      for (const sx of [-1, 1]) line('#6f7277', 0.012, [sx * 0.21, 0.95], [sx * 0.31, 0.2]);
      shoes('uggs', '#c79b6b', 0.36);
      piece(g, K('uggcuff'), (ax, y) => P.leg(ax, y) && y > 0.31 && y <= 0.36, '#efe2cc');
      top('flanno', check('#b8262a', '#2a1414', '#e8c2a0'), { sleeve: 0.86, neckR: 0.13 });
      if (!back) { line('#f1e9d8', 0.008, [0, 1.74], [0, 1.03]); for (let y = 1.68; y > 1.05; y -= 0.13) { g.fillStyle = '#f1e9d8'; g.beginPath(); g.arc(...px(0.03, y), 0.012 * PU, 0, 7); g.fill(); } }
      break;
    case 'cricket':
      bottom('whites', '#f2eedf', { legTo: 0.15 });
      shoes('spikes', '#ffffff', 0.13);
      top('whites', '#f6f3e6', { sleeve: 0.45, neckR: 0.12 });
      if (!back) line('#1f6b3a', 0.022, [-0.13, 1.86], [0, 1.68], [0.13, 1.86]);
      else { const [cx, cy] = px(0, 1.55); g.font = `800 ${0.07 * PU}px system-ui, sans-serif`; g.textAlign = 'center'; g.fillStyle = '#1f6b3a'; g.fillText('AUSTRALIA', cx, cy); g.font = `900 ${0.2 * PU}px system-ui, sans-serif`; g.fillText(String(num), cx, cy + 0.2 * PU); }
      break;
    case 'bikini': {
      g.fillStyle = '#ffcd00';
      g.beginPath();
      for (const [x, y] of [[-0.42, 1.0], [0.42, 1.0], [0.36, 0.9], back ? [0.08, 0.8] : [0.07, 0.79], [0, back ? 0.82 : 0.77], back ? [-0.08, 0.8] : [-0.07, 0.79], [-0.36, 0.9]]) g.lineTo(...px(x, y));
      g.closePath(); g.fill();
      line('#00843d', 0.02, [-0.42, 0.99], [0.42, 0.99]);
      const by = kind === 'sheila' || kind === 'both' ? 1.53 : 1.56, br = kind === 'sheila' || kind === 'both' ? 0.13 : 0.085;
      line('#00843d', 0.016, [-0.5, by - 0.07], [0.5, by - 0.07]);
      if (!back) for (const sx of [-1, 1]) {
        g.fillStyle = '#00843d'; g.beginPath(); g.moveTo(...px(sx * 0.18, by + br * 1.15)); g.lineTo(...px(sx * (0.18 + br), by - br * 0.6)); g.lineTo(...px(sx * (0.18 - br), by - br * 0.6)); g.closePath(); g.fill();
        line('#ffcd00', 0.01, [sx * (0.18 - br), by - br * 0.6], [sx * (0.18 + br), by - br * 0.6]);
        line('#00843d', 0.012, [sx * 0.18, by + br * 1.15], [sx * 0.1, 1.86]);
      } else for (const sx of [-1, 1]) line('#00843d', 0.012, [sx * 0.12, by - 0.07], [sx * 0.1, 1.86]);
      break;
    }
    case 'lifesaver':
      bottom('boardies', '#d6202a', { legTo: 0.55, waist: 1.08 });
      for (const sx of [-1, 1]) line('#ffd200', 0.025, [sx * 0.33, 1.0], [sx * 0.39, 0.55]);
      top('patrol', (t) => { t.fillStyle = '#d6202a'; t.fillRect(0, 0, TW, TH); t.fillStyle = '#ffd200'; t.fillRect(0, 0, TW, px(0, 1.36)[1]); }, { sleeve: 0.42, neckR: 0.13 });
      if (back) { const [cx, cy] = px(0, 1.56); g.font = `900 ${0.1 * PU}px system-ui, sans-serif`; g.textAlign = 'center'; g.fillStyle = '#d6202a'; g.fillText('PATROL', cx, cy); }
      break;
    default: break; // nude
  }
}
function paintBody(kind, skin, back, look = {}) {
  const c = document.createElement('canvas');
  c.width = TW; c.height = TH;
  const g = c.getContext('2d');
  g.fillStyle = skin; g.fillRect(0, 0, TW, TH);
  // faint mottling: cheap vinyl is never one even colour
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '120,60,60'},0.025)`; g.beginPath(); g.arc(Math.random() * TW, Math.random() * TH, 10 + Math.random() * 40, 0, 7); g.fill(); }
  const dot = (x, y, r, col) => { g.fillStyle = col; g.beginPath(); g.arc(...px(x, y), r * PU, 0, 7); g.fill(); };
  if (!back) {
    if (kind === 'sheila' || kind === 'both') for (const s of [-1, 1]) { dot(s * 0.18, 1.53, 0.045, 'rgba(214,110,120,0.55)'); dot(s * 0.18, 1.53, 0.02, '#c2566a'); }
    else for (const s of [-1, 1]) dot(s * 0.17, 1.56, 0.018, 'rgba(194,86,106,0.7)');
    g.fillStyle = 'rgba(90,40,40,0.55)'; g.beginPath(); g.ellipse(...px(0, 1.17), 0.012 * PU, 0.022 * PU, 0, 0, 7); g.fill(); // belly button
  } else {
    g.strokeStyle = 'rgba(110,50,50,0.5)'; g.lineWidth = 0.012 * PU; g.lineCap = 'round';
    g.beginPath(); g.moveTo(...px(0, 1.02)); g.lineTo(...px(0, 0.86)); g.stroke();
    // the warning label on the back, as printed on every one of these
    const [lx, ly] = px(-0.2, 1.62);
    g.fillStyle = '#f7f4ea'; g.fillRect(lx, ly, 0.4 * PU, 0.17 * PU);
    g.strokeStyle = '#c0392b'; g.lineWidth = 3; g.strokeRect(lx + 4, ly + 4, 0.4 * PU - 8, 0.17 * PU - 8);
    g.fillStyle = '#222'; g.textAlign = 'center'; g.font = '700 14px system-ui, sans-serif';
    ['DO NOT OVER-INFLATE', 'NOT A FLOTATION DEVICE', 'KEEP AWAY FROM CIGGIES'].forEach((t, i) => g.fillText(t, lx + 0.2 * PU, ly + 22 + i * 18));
  }
  paintOutfit(g, kind, back, look.outfit || defaultOutfit(kind), look.color || '#ff4f8b', look.num || 7);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// creases and wrinkles in the vinyl, as a normal map (the same for every doll of a body type)
const creaseCache = new Map();
function creaseMap(kind) {
  if (creaseCache.has(kind)) return creaseCache.get(kind);
  const w = 512, h = Math.round(512 * TH / TW), sc = w / TW;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
  g.lineCap = 'round';
  const P = (x, y) => px(x, y).map((v) => v * sc);
  const crease = (pts, width, dark = true) => { g.strokeStyle = dark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.35)'; g.lineWidth = width; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(...P(...p)) : g.moveTo(...P(...p)))); g.stroke(); };
  for (const s of [-1, 1]) {
    // armpits pull the vinyl into fans of wrinkles
    for (let i = 0; i < 5; i++) crease([[s * 0.36, 1.58 + i * 0.03], [s * (0.5 + i * 0.03), 1.6 + i * 0.035]], 2);
    // crotch and hip creases
    for (let i = 0; i < 3; i++) crease([[s * 0.05, 0.8 + i * 0.04], [s * (0.24 + i * 0.03), 0.9 + i * 0.05]], 2);
    // bunching at the elbows, wrists, knees and ankles
    for (const [x, y, ang] of [[0.68, 1.43, ARM_DROP], [0.95, 1.33, ARM_DROP], [0.25, 0.55, 0.14], [0.29, 0.2, 0.14]]) for (let i = -1; i <= 1; i++) {
      const ox = Math.sin(ang) * i * 0.03, oy = Math.cos(ang) * i * 0.03, dx = Math.sin(ang) * 0.1, dy = Math.cos(ang) * 0.1;
      crease([[s * (x + ox - dy), y + oy + dx], [s * (x + ox + dy), y + oy - dx]], 1.6);
    }
    crease([[s * 0.04, 1.8], [s * 0.1, 1.86]], 2);
  }
  // fine random wrinkles all over
  for (let i = 0; i < 160; i++) {
    const x = (Math.random() - 0.5) * 2.4, y = Math.random() * 2, a = Math.random() * Math.PI, l = 0.02 + Math.random() * 0.05;
    crease([[x, y], [x + Math.cos(a) * l, y + Math.sin(a) * l]], 1, Math.random() < 0.6);
  }
  // soften the creases (one blur pass over the whole sheet), then turn heights into normals
  const soft = document.createElement('canvas'); soft.width = w; soft.height = h;
  const sg = soft.getContext('2d', { willReadFrequently: true });
  sg.filter = 'blur(1.5px)'; sg.drawImage(c, 0, 0);
  const src = sg.getImageData(0, 0, w, h).data, out = g.createImageData(w, h), o = out.data;
  const hgt = (x, y) => src[((Math.min(h - 1, Math.max(0, y)) * w) + Math.min(w - 1, Math.max(0, x))) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (hgt(x + 1, y) - hgt(x - 1, y)) * 3, dy = (hgt(x, y + 1) - hgt(x, y - 1)) * 3;
    const l = Math.hypot(dx, dy, 1), k = (y * w + x) * 4;
    o[k] = (-dx / l * 0.5 + 0.5) * 255; o[k + 1] = (dy / l * 0.5 + 0.5) * 255; o[k + 2] = (1 / l * 0.5 + 0.5) * 255; o[k + 3] = 255;
  }
  g.putImageData(out, 0, 0);
  const t = new THREE.CanvasTexture(c);
  creaseCache.set(kind, t);
  return t;
}

// ---------- the jiggle ----------
// The body bends, squashes, flaps its arms and wobbles its soft bits in the vertex shader, driven by
// springs in update(). Up to four jiggly blobs per doll.
const JIGGLE_GLSL = /* glsl */`
vec3 p = transformed;
for (int i = 0; i < 4; i++) {
  vec4 c = uJigC[i];
  if (c.w > 0.0) { vec3 d = position - c.xyz; p += uJigO[i] * exp(-dot(d, d) / (c.w * c.w)); }
}
float side = sign(p.x);
float aw = smoothstep(0.36, 0.62, abs(position.x)) * smoothstep(1.2, 1.35, position.y);
if (aw > 0.0) {
  float a = (side < 0.0 ? uArm.x : uArm.y) * aw;
  vec2 sh = vec2(side * ${SHOULDER[0].toFixed(2)}, ${SHOULDER[1].toFixed(2)});
  vec2 q = p.xy - sh;
  p.xy = sh + vec2(cos(a) * q.x - sin(a) * q.y, sin(a) * q.x + cos(a) * q.y);
}
float hy = max(p.y, 0.0) / 2.0;
p.xz += uBend.xz * hy * hy;
p.y *= uBend.y; p.xz *= inversesqrt(uBend.y);
transformed = p;
`;
function jiggly(material, U) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = 'uniform vec4 uJigC[4];\nuniform vec3 uJigO[4];\nuniform vec2 uArm;\nuniform vec3 uBend;\n' +
      shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + JIGGLE_GLSL);
  };
  material.customProgramCacheKey = () => 'jiggly-doll';
  return material;
}
// how far the bend moves a point at height y (matches the shader, so the head stays on the neck)
const bendAt = (y) => (y / 2) * (y / 2);

class Spring {
  constructor(k, c, n = 1) { this.k = k; this.c = c; this.x = new Float32Array(n); this.v = new Float32Array(n); }
  step(dt, force) { for (let i = 0; i < this.x.length; i++) { this.v[i] += (-this.k * this.x[i] - this.c * this.v[i] + (force[i] || 0)) * dt; this.x[i] += this.v[i] * dt; } }
  kick(...v) { v.forEach((a, i) => { this.v[i] += a; }); }
}

function vinyl(color, extra = {}) {
  // glossy PVC: a hard clear coat over a slightly soft, sheeny base
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.38, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.4, sheenRoughness: 0.45, sheenColor: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.5), specularIntensity: 0.8, ...extra });
}

export class Doll {
  constructor(player, opts = {}) {
    const tag = opts.tag ?? true;
    this.player = player;
    const kind = player.body || 'smooth';
    this.group = new THREE.Group();
    this.group.userData.doll = this; // so tools can find the doll from the scene
    this.scaler = new THREE.Group(); // overall size (bigger on the board so faces read on the TV)
    this.scaler.scale.setScalar(opts.scale || 1);
    this.group.add(this.scaler);
    this.body = new THREE.Group(); // spins and flinches; group stays put for game logic
    this.scaler.add(this.body);
    this.skinCss = skinOf(player);
    const skinCol = new THREE.Color(this.skinCss);

    this.U = {
      uJigC: { value: [0, 1, 2, 3].map(() => new THREE.Vector4()) },
      uJigO: { value: [0, 1, 2, 3].map(() => new THREE.Vector3()) },
      uArm: { value: new THREE.Vector2() },
      uBend: { value: new THREE.Vector3(0, 1, 0) },
    };
    const look = { outfit: OUTFITS.some((o) => o.id === player.outfit) ? player.outfit : defaultOutfit(kind), color: player.color, num: [...String(player.id || player.name || '')].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 997, 7) % 44 + 1 };
    const shape = bodyShape(kind);
    const normalMap = creaseMap(kind);
    const mk = (back) => jiggly(vinyl(0xffffff, { map: paintBody(kind, this.skinCss, back, look), normalMap, normalScale: new THREE.Vector2(0.35, 0.35) }), this.U);
    this.skinMat = mk(false);
    const torso = new THREE.Mesh(shape.geo, [this.skinMat, mk(true)]);
    torso.castShadow = true; torso.receiveShadow = true;
    torso.customDepthMaterial = jiggly(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), this.U);
    this.body.add(torso);
    const seamMat = jiggly(vinyl(skinCol.clone().multiplyScalar(0.92), { side: THREE.DoubleSide, transparent: true, opacity: 0.92 }), this.U);
    this.body.add(new THREE.Mesh(shape.seam, seamMat));

    // the jiggly bits, as [x, y, z, radius] centres for the shader; each gets its own spring
    const jig = [];
    if (kind === 'sheila' || kind === 'both') for (const s of [-1, 1]) jig.push([s * 0.18, 1.52, shape.sample(s * 0.18, 1.52, 1) - 0.05, 0.16]);
    if (kind === 'bloke' || kind === 'both') jig.push([0, 0.86, shape.sample(0, 0.86, 1), 0.1]);
    jig.push([0, 0.95, shape.sample(0, 0.95, -1), 0.2]); // bum
    if (jig.length < 4) jig.push([0, 1.25, shape.sample(0, 1.25, 1), 0.22]); // belly
    jig.slice(0, 4).forEach((c, i) => this.U.uJigC.value[i].set(...c));
    this.jigN = Math.min(4, jig.length);
    this.jigSprings = jig.slice(0, 4).map((c, i) => new Spring(c[3] > 0.15 && c[1] < 1.2 ? 70 : 95, c[3] > 0.15 && c[1] < 1.2 ? 4 : 2, 3));

    // the valve on its back, where you blow it up
    const valveMat = vinyl(skinCol.clone().multiplyScalar(0.85));
    const vz = shape.sample(0, 1.3, -1);
    const valve = new THREE.Group();
    valve.position.set(0, 1.3, vz);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.07, 14), valveMat); stem.rotation.x = Math.PI / 2; stem.position.z = -0.03; valve.add(stem);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 14), valveMat); cap.rotation.x = Math.PI / 2; cap.position.set(0.03, -0.06, -0.02); valve.add(cap);
    this.body.add(valve);

    // the head is its own inflated piece, welded on at the neck, so it can wobble about
    this.neck = new THREE.Group();
    this.neck.position.y = 1.98;
    this.body.add(this.neck);
    this.head = new THREE.Group();
    this.head.position.y = 0.44;
    this.neck.add(this.head);
    const hs = headShape();
    this.faceMat = new THREE.MeshPhysicalMaterial({ roughness: 0.4, clearcoat: 0.8, clearcoatRoughness: 0.1 });
    const hairMat = vinyl(player.hair || 0x3a2418, { roughness: 0.3 });
    const headMesh = new THREE.Mesh(hs.geo, [this.faceMat, hairMat]);
    headMesh.castShadow = true;
    this.head.add(headMesh);
    this.head.add(new THREE.Mesh(hs.seam, vinyl(skinCol.clone().multiplyScalar(0.92), { side: THREE.DoubleSide })));
    const hat = makeHat(player.hat, player.color || '#ff4f8b');
    if (hat) { hat.traverse((o) => { if (o.isMesh) o.castShadow = true; }); this.head.add(hat); this.hat = hat; }
    this.headSpring = new Spring(55, 3.5, 2);
    this.bendSpring = new Spring(45, 4.5, 2);
    this.squashSpring = new Spring(140, 7, 1);
    this.armSpring = new Spring(40, 2.6, 2);
    this.armBase = [0, 0];

    // colour ring and name tag
    if (tag) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.8, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(player.color || '#ff9fb8'), transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04;
      this.group.add(ring);
      this.tag = makeTag(player.name, player.color);
      this.tag.position.y = 2.95 * (opts.scale || 1) + 0.55;
      this.group.add(this.tag);
    }
    this.mood = 'neutral';
    this.refreshFace();
    this.setArms();
    this.t = Math.random() * 10;
    this.flinchT = 0;
    this.prevPos = null; this.prevVel = new THREE.Vector3();
  }

  setPhotos(photos) { this.player.photos = photos; this.refreshFace(); }

  setMood(mood) {
    this.mood = MOODS.includes(mood) ? mood : 'neutral';
    this.refreshFace();
    // a little bounce of joy, or a shake of rage
    if (this.mood === 'happy') this.bounce(1);
    if (this.mood === 'angry') { this.bendSpring.kick(1.2, 0); this.headSpring.kick(0, 4); }
  }

  refreshFace() {
    const ph = this.player.photos || {};
    this.faceMat.map = faceTexture(this.player.id, this.mood, ph[this.mood] || ph.neutral || null, this.skinCss, this.player.hair);
    this.faceMat.needsUpdate = true;
  }

  // lift: 0 = arms straight out, + = up (radians); tilt: + = left arm up, right arm down (a plane's bank)
  setArms(lift = -0.4, tilt = 0) { this.armBase = [-(lift + ARM_DROP) - tilt, (lift + ARM_DROP) - tilt]; }

  flinch() {
    this.flinchT = 0.5;
    this.bendSpring.kick((Math.random() - 0.5) * 3, -2);
    this.squashSpring.kick(-1.5);
    this.headSpring.kick(3, (Math.random() - 0.5) * 6);
    this.armSpring.kick(4, 4);
    this.jigSprings.forEach((s) => s.kick(0, 1.5, 0.5));
  }

  // a jolt straight up, as if it landed or got excited
  bounce(k = 1) {
    this.squashSpring.kick(-1.2 * k);
    this.armSpring.kick(3 * k, 3 * k);
    this.jigSprings.forEach((s) => s.kick(0, -2 * k, 0));
    this.headSpring.kick(1.5 * k, 0);
  }

  update(dt) {
    if (dt <= 0) return;
    this.t += dt;
    // how the doll is being moved around, in its own frame
    const wp = this.group.getWorldPosition(_v1);
    const acc = _v2.set(0, 0, 0);
    if (this.prevPos) {
      const vel = _v3.copy(wp).sub(this.prevPos).divideScalar(dt);
      acc.copy(vel).sub(this.prevVel).divideScalar(dt);
      this.prevVel.copy(vel);
      if (acc.length() > 400) acc.setLength(400); // teleports and resets
    } else this.prevPos = new THREE.Vector3();
    this.prevPos.copy(wp);
    acc.applyQuaternion(_q.copy(this.group.getWorldQuaternion(_q)).invert());
    acc.divideScalar(this.scaler.scale.x || 1);
    // inflatables never stand still: a breath of wind now and then
    const gust = Math.sin(this.t * 0.7) * Math.sin(this.t * 1.9 + 2) * 1.2;
    const sub = Math.max(1, Math.ceil(dt / 0.01)), h = dt / sub;
    for (let i = 0; i < sub; i++) {
      this.bendSpring.step(h, [-acc.x * 0.04 + gust * 0.5, -acc.z * 0.04]);
      this.squashSpring.step(h, [-acc.y * 0.15]);
      this.armSpring.step(h, [-acc.y * 0.18 + acc.x * 0.06 + gust * 1.5, -acc.y * 0.18 - acc.x * 0.06 + gust * 1.5]);
      this.headSpring.step(h, [acc.z * 0.2 + this.bendSpring.v[1] * 6, -acc.x * 0.2 - this.bendSpring.v[0] * 6 + gust * 1.2]);
      for (const s of this.jigSprings) s.step(h, [-acc.x * 0.07 - this.bendSpring.v[0] * 3, -acc.y * 0.12 + Math.sin(this.t * 3.1) * 0.3, -acc.z * 0.07 - this.bendSpring.v[1] * 3]);
    }
    const bx = THREE.MathUtils.clamp(this.bendSpring.x[0], -0.5, 0.5), bz = THREE.MathUtils.clamp(this.bendSpring.x[1], -0.5, 0.5);
    const squash = THREE.MathUtils.clamp(1 + this.squashSpring.x[0] + Math.sin(this.t * 2.6) * 0.008, 0.75, 1.25);
    this.U.uBend.value.set(bx, squash, bz);
    const arm = (i) => THREE.MathUtils.clamp(this.armSpring.x[i], -0.45, 0.6);
    this.U.uArm.value.set(this.armBase[0] - arm(0), this.armBase[1] + arm(1));
    this.jigSprings.forEach((s, i) => this.U.uJigO.value[i].set(...[0, 1, 2].map((j) => THREE.MathUtils.clamp(s.x[j], -0.14, 0.14))));
    // the head rides the top of the bent neck
    const ny = 1.98 * squash;
    this.neck.position.set(bx * bendAt(ny), ny, bz * bendAt(ny));
    this.neck.rotation.set(bz * 0.5 + this.headSpring.x[0] * 0.5, 0, -bx * 0.5 - this.headSpring.x[1] * 0.5);
    this.body.rotation.z = this.flinchT > 0 ? Math.sin(this.flinchT * 40) * 0.12 : 0;
    if (this.flinchT > 0) this.flinchT -= dt;
    // landing from a hop squashes it
    if (this.prevVel.y < -2 && acc.y > 60) this.bounce(Math.min(1.5, acc.y / 200));
  }
}
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _q = new THREE.Quaternion();

// ---------- hats ----------
// Built in head space: the head is about 0.39 wide and 0.31 deep each way, top at y 0.45, face toward +z.
const hatMats = new Map();
function cloth(color, o = {}) {
  const k = color + JSON.stringify(o);
  if (!hatMats.has(k)) hatMats.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o }));
  return hatMats.get(k);
}
const dome = (r, col, { sy = 0.8, theta = Math.PI / 2, phi0 = 0, phiL = Math.PI * 2 } = {}) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 12, phi0, phiL, 0, theta), typeof col === 'string' || typeof col === 'number' ? cloth(col) : col);
  m.scale.y = sy; return m;
};
const lathe = (pts, mat) => // profiles run anticlockwise (outside going up) or the faces end up inside out
   new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 36), mat);
const peak = (r, mat, z, y, tilt = 0.18) => { // a half-disc cap peak sticking out the front
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.018, 24, 1, false, -Math.PI / 2, Math.PI), mat);
  m.position.set(0, y, z); m.rotation.x = tilt; return m;
};
function makeHat(id, color) {
  if (!id || id === 'none' || !HATS.some((h) => h.id === id)) return null;
  const g = new THREE.Group();
  const add = (m, x = 0, y = 0, z = 0) => { m.position.set(x, y + m.position.y, z + m.position.z); g.add(m); return m; };
  switch (id) {
    case 'akubra': case 'corks': {
      const felt = cloth(id === 'corks' ? 0xa48458 : 0x8a6038, { roughness: 0.95 });
      // crown with the classic pinched dent on top, a wide brim that curls up a touch at the edge
      add(lathe([[0, -0.01], [0.35, -0.01], [0.37, 0], [0.35, 0.1], [0.31, 0.26], [0.25, 0.31], [0.12, 0.25], [0, 0.27]], felt), 0, 0.23);
      add(lathe([[0.34, 0.02], [0.5, 0.0], [0.64, 0.035], [0.67, 0.06], [0.66, 0.065], [0.6, 0.03], [0.5, 0.015], [0.34, 0.035]], felt), 0, 0.22);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.357, 0.37, 0.055, 36, 1, true), cloth(0x2e2016)), 0, 0.28);
      if (id === 'corks') for (let i = 0; i < 9; i++) { // corks dangle all the way round, front ones in your eyes
        const a = (i / 9) * Math.PI * 2 + 0.2, r = 0.6, x = Math.sin(a) * r, z = Math.cos(a) * r, len = 0.1 + (i % 3) * 0.03;
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, len, 4), cloth(0x222222)), x, 0.24 - len / 2, z);
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.07, 10), cloth(0xc49a62, { roughness: 1 })), x, 0.24 - len - 0.03, z);
      }
      break;
    }
    case 'trucker': {
      add(dome(0.375, 0xf2f2ee, { sy: 0.82 }), 0, 0.15);
      add(dome(0.38, color, { sy: 0.82, phi0: Math.PI / 2 - 0.85, phiL: 1.7, theta: Math.PI / 2 }), 0, 0.15); // foam front panel
      add(peak(0.3, cloth(color), 0.27, 0.16, 0.12));
      add(new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), cloth(color)), 0, 0.15 + 0.375 * 0.82);
      break;
    }
    case 'bucket': {
      const towel = cloth(0xe8dcc0, { roughness: 1 });
      add(lathe([[0, -0.01], [0.36, -0.01], [0.52, -0.12], [0.54, -0.115], [0.53, -0.1], [0.37, 0.02], [0.27, 0.27], [0, 0.28]], towel), 0, 0.22);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.356, 0.366, 0.045, 36, 1, true), cloth(color)), 0, 0.26);
      break;
    }
    case 'lifesaver': {
      for (let i = 0; i < 4; i++) add(dome(0.38, i % 2 ? 0xffd200 : 0xd6202a, { sy: 1.0, theta: Math.PI / 2 + 0.1, phi0: (i * Math.PI) / 2 + Math.PI / 4, phiL: Math.PI / 2 }), 0, 0.13);
      for (const sx of [-1, 1]) add(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.42, 4), cloth(0xd6202a)), sx * 0.3, -0.1, 0.05).rotation.z = sx * 0.35;
      break;
    }
    case 'beanie': {
      const c = document.createElement('canvas'); c.width = 64; c.height = 8;
      const t = c.getContext('2d'); t.fillStyle = '#fff'; t.fillRect(0, 0, 64, 8); t.fillStyle = '#bbb'; for (let x = 0; x < 64; x += 4) t.fillRect(x, 0, 2, 8);
      const rib = new THREE.CanvasTexture(c); rib.wrapS = rib.wrapT = THREE.RepeatWrapping; rib.repeat.set(5, 1); rib.colorSpace = THREE.SRGBColorSpace;
      add(dome(0.385, new THREE.MeshStandardMaterial({ color, roughness: 1, map: rib }), { sy: 1.0 }), 0, 0.12);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.13, 36, 1, true), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, map: rib, side: THREE.DoubleSide })), 0, 0.16);
      add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 2), cloth(0xffffff, { roughness: 1 })), 0, 0.53);
      break;
    }
    case 'baggygreen': {
      const wool = cloth(0x0c4426, { roughness: 1 });
      add(dome(0.375, wool, { sy: 0.72 }), 0, 0.18);
      add(peak(0.2, wool, 0.28, 0.19, 0.3));
      const crest = add(new THREE.Mesh(new THREE.CircleGeometry(0.055, 16), cloth(0xe2b13c, { roughness: 0.4, metalness: 0.5 })), 0, 0.33, 0.3);
      crest.rotation.x = -0.55;
      add(new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), wool), 0, 0.18 + 0.375 * 0.72);
      break;
    }
    case 'hardhat': {
      const shell = new THREE.MeshPhysicalMaterial({ color: 0xffc400, roughness: 0.3, clearcoat: 0.6 });
      add(dome(0.38, shell, { sy: 0.82 }), 0, 0.17);
      add(lathe([[0.37, 0.0], [0.45, -0.02], [0.46, -0.005], [0.37, 0.02]], shell), 0, 0.17);
      add(peak(0.26, shell, 0.3, 0.16, 0.12));
      const ridge = add(new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.03, 6, 20, Math.PI), shell), 0, 0.17);
      ridge.rotation.y = Math.PI / 2; ridge.scale.y = 0.95;
      break;
    }
    case 'nedkelly': {
      // the iron helmet: a bucket of plough steel with the eye slit, rivets round the top
      const steel = new THREE.MeshStandardMaterial({ color: 0x7c8086, roughness: 0.55, metalness: 0.75 });
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.48, 0.98, 36, 1, true), steel), 0, 0.0);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.03, 36), steel), 0, 0.49);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.476, 0.476, 0.07, 24, 1, true, -0.75, 1.5), new THREE.MeshBasicMaterial({ color: 0x050505 })), 0, 0.06);
      for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; add(new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), steel), Math.sin(a) * 0.475, 0.42, Math.cos(a) * 0.475); }
      break;
    }
  }
  g.scale.z = id === 'nedkelly' ? 0.85 : 0.88; // the head is flatter front to back than side to side
  return g;
}

function makeTag(name, color) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 112;
  const g = c.getContext('2d');
  g.font = '900 64px system-ui, sans-serif';
  const w = Math.min(500, g.measureText(name).width + 60);
  g.fillStyle = 'rgba(10,8,20,0.75)';
  g.beginPath(); g.roundRect((512 - w) / 2, 8, w, 96, 48); g.fill();
  g.strokeStyle = color || '#fff'; g.lineWidth = 6; g.stroke();
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(name, 256, 58, 470);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(2.6, 0.57, 1);
  s.renderOrder = 10;
  return s;
}
