// Procedural textures (colour + normal + roughness) painted on canvases, so the game ships with
// no image files. Each texture is made once and cached. Swap any of them for a photo texture later
// by putting an image in assets/textures/ and loading it in place of the generator.
import * as THREE from 'three';

const SIZE = 256;
const cache = new Map();

// ---------- noise ----------
function hash(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y, s, period) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const w = (i) => ((i % period) + period) % period;
  const a = hash(w(xi), w(yi), s), b = hash(w(xi + 1), w(yi), s), c = hash(w(xi), w(yi + 1), s), d = hash(w(xi + 1), w(yi + 1), s);
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// tileable fractal noise in 0..1 at texture coords (0..1)
export function fbm(u, v, { scale = 8, octaves = 5, seed = 1, gain = 0.5 } = {}) {
  let sum = 0, amp = 1, norm = 0, f = scale;
  for (let o = 0; o < octaves; o++) { sum += vnoise(u * f, v * f, seed + o * 17, f) * amp; norm += amp; amp *= gain; f *= 2; }
  return sum / norm;
}
const rnd = (s) => { let a = s >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const mix = (a, b, t) => a + (b - a) * t;
const col = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];

// paint(x, y) -> { c: [r,g,b], h: height 0..1, r: roughness 0..1 } for every pixel, then build textures
function build(key, paint, { size = SIZE, normalStrength = 2, repeat = 1, alpha = false } = {}) {
  if (cache.has(key)) return cache.get(key);
  const n = size;
  const cc = document.createElement('canvas'); cc.width = cc.height = n;
  const ctx = cc.getContext('2d');
  const img = ctx.createImageData(n, n);
  const H = new Float32Array(n * n), R = new Uint8ClampedArray(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const p = paint(x / n, y / n, x, y);
    const i = (y * n + x);
    img.data[i * 4] = p.c[0]; img.data[i * 4 + 1] = p.c[1]; img.data[i * 4 + 2] = p.c[2]; img.data[i * 4 + 3] = alpha ? (p.a ?? 255) : 255;
    H[i] = p.h ?? 0.5; R[i] = Math.round((p.r ?? 0.85) * 255);
  }
  ctx.putImageData(img, 0, 0);
  // normal map from the height field (wraps, so it tiles)
  const nc = document.createElement('canvas'); nc.width = nc.height = n;
  const nctx = nc.getContext('2d'), nimg = nctx.createImageData(n, n);
  const rc = document.createElement('canvas'); rc.width = rc.height = n;
  const rctx = rc.getContext('2d'), rimg = rctx.createImageData(n, n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const h = (xx, yy) => H[((yy + n) % n) * n + ((xx + n) % n)];
    const dx = (h(x + 1, y) - h(x - 1, y)) * normalStrength, dy = (h(x, y + 1) - h(x, y - 1)) * normalStrength;
    const len = Math.hypot(dx, dy, 1);
    const i = (y * n + x) * 4;
    nimg.data[i] = (-dx / len * 0.5 + 0.5) * 255; nimg.data[i + 1] = (dy / len * 0.5 + 0.5) * 255; nimg.data[i + 2] = (1 / len * 0.5 + 0.5) * 255; nimg.data[i + 3] = 255;
    const r = R[y * n + x]; rimg.data[i] = r; rimg.data[i + 1] = r; rimg.data[i + 2] = r; rimg.data[i + 3] = 255;
  }
  nctx.putImageData(nimg, 0, 0);
  rctx.putImageData(rimg, 0, 0);
  const tex = (c, srgb) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(repeat, repeat); return t; };
  const out = { map: tex(cc, true), normalMap: tex(nc, false), roughnessMap: tex(rc, false) };
  cache.set(key, out);
  return out;
}

// A material from a texture set. repeat is in tiles across the surface.
export function texMat(set, { repeat = [1, 1], color = 0xffffff, normalScale = 1, ...opts } = {}) {
  const clone = (t) => { if (!t) return null; const c = t.clone(); c.repeat.set(repeat[0], repeat[1]); c.needsUpdate = true; return c; };
  return new THREE.MeshStandardMaterial({
    map: clone(set.map), normalMap: clone(set.normalMap), roughnessMap: clone(set.roughnessMap),
    normalScale: new THREE.Vector2(normalScale, normalScale), color, roughness: 1, metalness: 0, ...opts,
  });
}

// ---------- the library ----------
export const TEX = {
  // outback red dirt with pebbles and a few cracks
  redDirt: () => build('redDirt', (u, v) => {
    const n = fbm(u, v, { scale: 6, seed: 3 }), d = fbm(u, v, { scale: 32, seed: 9, octaves: 3 });
    const peb = fbm(u, v, { scale: 64, seed: 21, octaves: 2 });
    const stone = peb > 0.68 ? (peb - 0.68) * 3 : 0;
    const base = [mix(150, 190, n), mix(62, 88, n), mix(32, 44, n)];
    const c = base.map((x, i) => x * (0.85 + d * 0.3) + stone * [90, 70, 60][i]);
    return { c, h: n * 0.4 + d * 0.3 + stone, r: 0.95 - stone * 0.3 };
  }, { size: 512, normalStrength: 6 }),
  grass: () => build('grass', (u, v, x, y) => {
    const n = fbm(u, v, { scale: 5, seed: 4 }), blade = fbm(u * 1.0, v * 6, { scale: 48, seed: 12, octaves: 2 });
    const dry = fbm(u, v, { scale: 3, seed: 40 });
    const c = [mix(78, 150, dry * dry), mix(112, 138, n), mix(46, 70, dry)].map((x) => x * (0.72 + blade * 0.45));
    return { c, h: blade, r: 0.9 };
  }, { size: 512, normalStrength: 5 }),
  sand: () => build('sand', (u, v) => {
    const n = fbm(u, v, { scale: 10, seed: 5 }), ripple = Math.sin((v + fbm(u, v, { scale: 4, seed: 6 }) * 0.2) * 90) * 0.5 + 0.5;
    return { c: [mix(214, 236, n), mix(190, 214, n), mix(140, 166, n)].map((x) => x * (0.94 + ripple * 0.06)), h: ripple * 0.3 + n * 0.3, r: 0.95 };
  }, { size: 512, normalStrength: 3 }),
  gravel: () => build('gravel', (u, v) => {
    const n = fbm(u, v, { scale: 48, seed: 7, octaves: 3 }), m = fbm(u, v, { scale: 6, seed: 8 });
    const g = mix(150, 205, n) * (0.9 + m * 0.2);
    return { c: [g * 1.02, g * 0.92, g * 0.78], h: n, r: 0.95 };
  }, { normalStrength: 6 }),
  asphalt: () => build('asphalt', (u, v) => {
    const n = fbm(u, v, { scale: 64, seed: 10, octaves: 3 }), m = fbm(u, v, { scale: 5, seed: 11 });
    const g = mix(42, 70, n) * (0.85 + m * 0.3);
    return { c: [g, g, g * 1.04], h: n, r: 0.9 };
  }, { normalStrength: 3 }),
  sandstone: () => build('sandstone', (u, v) => {
    const n = fbm(u, v, { scale: 5, seed: 13 }), strata = Math.sin(v * 60 + fbm(u, v, { scale: 3, seed: 14 }) * 8) * 0.5 + 0.5;
    return { c: [mix(196, 226, n), mix(160, 190, strata), mix(118, 140, n)], h: strata * 0.3 + n * 0.4, r: 0.9 };
  }, { normalStrength: 3 }),
  slag: () => build('slag', (u, v) => {
    const n = fbm(u, v, { scale: 20, seed: 15, octaves: 4 }), rust = fbm(u, v, { scale: 4, seed: 16 });
    return { c: [mix(50, 120, rust) * (0.7 + n * 0.5), mix(36, 60, rust) * (0.7 + n * 0.5), 30 * (0.7 + n * 0.5)], h: n, r: 0.95 };
  }, { normalStrength: 8 }),
  rust: () => build('rust', (u, v) => {
    const n = fbm(u, v, { scale: 8, seed: 17 }), s = fbm(u, v, { scale: 40, seed: 18, octaves: 3 });
    return { c: [mix(110, 160, n), mix(46, 72, n * s), mix(20, 30, s)], h: s * 0.5, r: mix(0.6, 0.95, s) };
  }, { normalStrength: 2 }),
  steel: () => build('steel', (u, v) => {
    const n = fbm(u, v, { scale: 12, seed: 19 }), rust = Math.max(0, fbm(u, v, { scale: 6, seed: 20 }) - 0.55) * 3;
    return { c: [mix(70, 140, rust) + n * 20, mix(74, 60, rust) + n * 20, mix(80, 30, rust) + n * 20], h: n * 0.2 + rust * 0.3, r: 0.45 + rust * 0.4 };
  }),
  // corrugated iron: vertical ribs, galvanised with rust streaks
  corrugated: () => build('corrugated', (u, v) => {
    const rib = Math.sin(u * Math.PI * 2 * 24) * 0.5 + 0.5;
    const streak = Math.max(0, fbm(u * 4, v * 0.6, { scale: 6, seed: 22 }) - 0.5) * 2;
    const n = fbm(u, v, { scale: 10, seed: 23 });
    const g = mix(150, 190, n) * (0.85 + rib * 0.2);
    return { c: [mix(g, 140, streak), mix(g, 80, streak), mix(g * 1.03, 50, streak)], h: rib, r: 0.45 + streak * 0.4 };
  }, { normalStrength: 10 }),
  brick: () => build('brick', (u, v, x, y) => {
    const rows = 16, cols = 8;
    const row = Math.floor(v * rows), off = row % 2 ? 0.5 : 0;
    const bu = (u * cols + off) % 1, bv = (v * rows) % 1;
    const mortar = bu < 0.05 || bv < 0.1;
    const id = Math.floor(u * cols + off) + row * 31;
    const tone = hash(id, row, 5) * 0.3, n = fbm(u, v, { scale: 32, seed: 24, octaves: 3 });
    const c = mortar ? [190, 180, 165].map((x) => x * (0.85 + n * 0.2)) : [mix(150, 190, tone), mix(70, 95, tone), mix(50, 66, tone)].map((x) => x * (0.85 + n * 0.3));
    return { c, h: mortar ? 0 : 0.6 + n * 0.2, r: 0.9 };
  }, { normalStrength: 6 }),
  // painted render (stucco) in a given colour
  render: (hex = 0xe8dcc2) => build('render' + hex, (u, v) => {
    const n = fbm(u, v, { scale: 24, seed: 25, octaves: 4 }), dirt = Math.max(0, fbm(u, v, { scale: 3, seed: 26 }) - 0.5);
    const b = col(hex);
    return { c: b.map((x) => x * (0.92 + n * 0.1) * (1 - dirt * 0.4) * (1 - Math.pow(v, 6) * 0.25)), h: n * 0.3, r: 0.9 };
  }, { normalStrength: 2 }),
  weatherboard: (hex = 0xe8e2d0) => build('weatherboard' + hex, (u, v) => {
    const board = (v * 14) % 1, n = fbm(u, v, { scale: 16, seed: 27 });
    const shade = board > 0.88 ? 0.7 : 1 - board * 0.08;
    return { c: col(hex).map((x) => x * shade * (0.93 + n * 0.1)), h: board, r: 0.8 };
  }, { normalStrength: 6 }),
  planks: () => build('planks', (u, v) => {
    const plank = Math.floor(u * 6), seam = (u * 6) % 1 < 0.04;
    const grain = fbm(u * 3, v * 0.3, { scale: 16, seed: 28 + plank, octaves: 4 });
    const tone = hash(plank, 1, 3) * 0.25;
    const c = seam ? [40, 30, 22] : [mix(120, 160, grain) * (1 - tone), mix(86, 112, grain) * (1 - tone), mix(58, 74, grain) * (1 - tone)];
    return { c, h: seam ? 0 : 0.5 + grain * 0.2, r: 0.85 };
  }, { normalStrength: 4 }),
  bark: () => build('bark', (u, v) => {
    // ghost-gum bark: pale and smooth with grey patches
    const n = fbm(u, v * 0.3, { scale: 6, seed: 29 }), p = fbm(u, v, { scale: 10, seed: 30 });
    const patch = p > 0.55 ? 1 : 0;
    const c = patch ? [150, 140, 125] : [mix(220, 240, n), mix(214, 230, n), mix(200, 214, n)];
    return { c, h: patch * 0.3 + n * 0.2, r: 0.8 };
  }, { normalStrength: 3 }),
  // gum leaves for canopies: dull blue-green clumps with gaps (alpha)
  leaves: () => build('leaves', (u, v) => {
    const n = fbm(u, v, { scale: 14, seed: 31, octaves: 4 });
    const a = n > 0.42 ? 255 : 0;
    const c = [mix(70, 120, n), mix(96, 140, n), mix(70, 100, n)];
    return { c, h: n, r: 0.8, a };
  }, { alpha: true, normalStrength: 3 }),
  // cherry blossom clumps for sakura canopies: five-petal flowers crowded together, gaps between (alpha)
  blossom: () => build('blossom', (u, v) => {
    const N = 9, n = fbm(u, v, { scale: 8, seed: 57, octaves: 3 });
    let best = 0, centre = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const cx = Math.floor(u * N) + i, cy = Math.floor(v * N) + j, wx = (cx + N) % N, wy = (cy + N) % N;
      for (let k = 0; k < 3; k++) {
        const fx = (cx + hash(wx, wy, 60 + k)) / N, fy = (cy + hash(wx, wy, 70 + k)) / N, rot = hash(wx, wy, 80 + k) * 6.3;
        const dx = (u - fx) * N, dy = (v - fy) * N, d = Math.hypot(dx, dy), th = Math.atan2(dy, dx) + rot;
        const r = 0.36 * (0.62 + 0.38 * Math.abs(Math.cos(th * 2.5)));
        if (d < r && 1 - d / r > best) { best = 1 - d / r; centre = d < 0.07 ? 1 : 0; }
      }
    }
    const shade = 0.78 + n * 0.3;
    const c = centre ? [200, 70, 110] : [mix(236, 255, best), mix(150, 210, best), mix(178, 225, best)].map((x) => x * shade);
    return { c, h: best, r: 0.7, a: best > 0 || n > 0.62 ? 255 : 0 };
  }, { alpha: true, normalStrength: 3 }),
  // 70s shag carpet: burnt orange and brown with a swirl, fibres catching the light
  carpet: () => build('carpet', (u, v) => {
    const n = fbm(u, v, { scale: 128, seed: 90, octaves: 2 }), w = fbm(u, v, { scale: 6, seed: 91, octaves: 3 });
    const swirl = Math.sin((u + w * 0.5) * Math.PI * 8) * Math.sin((v + w * 0.4) * Math.PI * 8) > 0.35;
    const b = swirl ? [150, 82, 34] : [104, 64, 36];
    return { c: b.map((x) => x * (0.7 + n * 0.55)), h: n, r: 0.97 };
  }, { normalStrength: 5 }),
  // couch velour: mustard with a woven texture and a darker floral pattern
  velour: (hex = 0xb68a2e) => build('velour' + hex, (u, v, x, y) => {
    const weave = ((x + y) % 4 < 2 ? 0.94 : 1.04), n = fbm(u, v, { scale: 24, seed: 92, octaves: 3 });
    const cu = (u * 6) % 1 - 0.5, cv = (v * 6 + (Math.floor(u * 6) % 2) * 0.5) % 1 - 0.5;
    const r = Math.hypot(cu, cv), th = Math.atan2(cv, cu), petal = r < 0.32 * (0.55 + 0.45 * Math.abs(Math.cos(th * 3))) && r > 0.06;
    return { c: col(hex).map((x) => x * weave * (0.85 + n * 0.25) * (petal ? 0.72 : 1)), h: petal ? 0.3 : 0.6, r: 0.9 };
  }, { normalStrength: 2 }),
  // 70s wallpaper: brown and cream stripes with an orange medallion
  wallpaper: () => build('wallpaper', (u, v) => {
    const s = (u * 8) % 1, cu = s - 0.5, cv = (v * 8) % 1 - 0.5, r = Math.hypot(cu * 1.2, cv), n = fbm(u, v, { scale: 32, seed: 93, octaves: 3 });
    const c = r < 0.22 ? (r < 0.12 ? [214, 120, 40] : [120, 70, 30]) : s < 0.18 || s > 0.82 ? [92, 60, 38] : [214, 190, 150];
    return { c: c.map((x) => x * (0.88 + n * 0.16) * (1 - Math.pow(1 - v, 8) * 0.3)), h: 0.5, r: 0.85 };
  }, { normalStrength: 1 }),
  // cherry bark: dark red-brown with horizontal lenticel stripes
  cherrybark: () => build('cherrybark', (u, v) => {
    const n = fbm(u, v, { scale: 8, seed: 59 }), band = Math.abs(Math.sin(v * Math.PI * 18 + n * 3)) > 0.93;
    const c = band ? [120, 92, 80] : [mix(58, 86, n), mix(36, 52, n), mix(32, 44, n)];
    return { c, h: band ? 0.2 : 0.5 + n * 0.3, r: 0.85 };
  }, { normalStrength: 3 }),
  saltbush: () => build('saltbush', (u, v) => {
    const n = fbm(u, v, { scale: 20, seed: 32, octaves: 4 });
    return { c: [mix(110, 160, n), mix(124, 168, n), mix(100, 140, n)], h: n, r: 0.95, a: n > 0.38 ? 255 : 0 };
  }, { alpha: true, normalStrength: 4 }),
  concrete: () => build('concrete', (u, v) => {
    const n = fbm(u, v, { scale: 16, seed: 33 }), s = fbm(u, v, { scale: 64, seed: 34, octaves: 2 });
    const g = mix(165, 195, n) * (0.95 + s * 0.1);
    return { c: [g, g * 0.98, g * 0.95], h: s * 0.3, r: 0.9 };
  }, { normalStrength: 2 }),
  pavers: () => build('pavers', (u, v) => {
    const a = (u * 8) % 1, b = (v * 8) % 1, joint = a < 0.04 || b < 0.04;
    const id = Math.floor(u * 8) + Math.floor(v * 8) * 8, tone = hash(id, 2, 7) * 0.2, n = fbm(u, v, { scale: 32, seed: 35, octaves: 3 });
    const c = joint ? [90, 85, 80] : [mix(170, 200, tone), mix(160, 186, tone), mix(146, 168, tone)].map((x) => x * (0.92 + n * 0.12));
    return { c, h: joint ? 0 : 0.5, r: 0.85 };
  }, { normalStrength: 5 }),
  // big irregular grey stone slabs, as on shrine paths in Kyoto
  flagstone: () => build('flagstone', (u, v) => {
    // Voronoi slabs: distance to the nearest and second-nearest jittered cell centre
    const N = 4; let d1 = 9, d2 = 9, id = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const cx = Math.floor(u * N) + i, cy = Math.floor(v * N) + j, w = (k) => ((k % N) + N) % N;
      const px = (cx + 0.15 + hash(w(cx), w(cy), 51) * 0.7) / N, py = (cy + 0.15 + hash(w(cx), w(cy), 52) * 0.7) / N;
      const d = Math.hypot(u - px, v - py);
      if (d < d1) { d2 = d1; d1 = d; id = hash(w(cx), w(cy), 53); } else if (d < d2) d2 = d;
    }
    const edge = (d2 - d1) * N, joint = edge < 0.06, n = fbm(u, v, { scale: 24, seed: 54, octaves: 4 });
    const g = mix(120, 168, id) * (0.85 + n * 0.3);
    const moss = !joint && edge < 0.12 && fbm(u, v, { scale: 12, seed: 55 }) > 0.55;
    return { c: joint ? [52, 54, 46] : moss ? [86, 104, 60] : [g, g * 0.99, g * 0.95], h: joint ? 0 : Math.min(1, edge * 3) * 0.6 + n * 0.2, r: joint ? 1 : 0.8 };
  }, { size: 512, normalStrength: 6 }),
  // Japanese kawara roof: rows of grey glazed half-round tiles
  kawara: () => build('kawara', (u, v) => {
    const a = (u * 10) % 1, b = (v * 6) % 1, n = fbm(u, v, { scale: 32, seed: 56, octaves: 3 });
    const round = Math.sin(a * Math.PI), lip = b > 0.86;
    const g = (lip ? 70 : 88 + round * 40) * (0.9 + n * 0.2);
    return { c: [g * 0.92, g * 0.95, g], h: round * 0.7 + (lip ? 0.3 : 0), r: 0.45 };
  }, { normalStrength: 5 }),
  // stadium seating: rows of coloured seats
  seats: (hex = 0x1d3d7a) => build('seats' + hex, (u, v) => {
    const row = (v * 16) % 1, seat = (u * 32) % 1;
    const isSeat = row > 0.45 && seat > 0.12 && seat < 0.88;
    const crowd = hash(Math.floor(u * 32), Math.floor(v * 16), 9);
    const person = isSeat && crowd > 0.55;
    const shirt = [[40, 60, 140], [200, 30, 50], [240, 210, 60], [230, 230, 230], [30, 30, 30]][Math.floor(crowd * 97) % 5];
    const c = person ? shirt : isSeat ? col(hex) : [150, 150, 150];
    return { c, h: isSeat ? 0.7 : row < 0.45 ? 0.2 : 0.5, r: 0.7 };
  }, { normalStrength: 4 }),
  // mown oval: alternating stripes of green
  oval: () => build('oval', (u, v) => {
    const stripe = Math.floor(u * 12) % 2, n = fbm(u, v, { scale: 32, seed: 36, octaves: 3 });
    const g = stripe ? 1 : 0.86;
    return { c: [70 * g * (0.9 + n * 0.2), 150 * g * (0.9 + n * 0.2), 60 * g], h: n * 0.2, r: 0.85 };
  }, { normalStrength: 2 }),
  // office tower facade: a grid of windows, some lit
  windows: (hex = 0x6c8094) => build('windows' + hex, (u, v) => {
    // one tile = 6 bays x 4 floors; tinted glass that picks up the sky through the env map
    const wx = (u * 6) % 1, wy = (v * 4) % 1;
    const glass = wx > 0.08 && wx < 0.92 && wy > 0.22 && wy < 0.92;
    const mullion = Math.abs(wx - 0.5) < 0.02;
    const blind = hash(Math.floor(u * 6), Math.floor(v * 4), 11);
    const g = 0.8 + blind * 0.35;
    const c = glass && !mullion ? [52 * g, 70 * g, 88 * g] : col(hex);
    return { c, h: glass ? 0.1 : 0.7, r: glass && !mullion ? 0.08 : 0.75 };
  }, { normalStrength: 2 }),
  water: () => build('water', (u, v) => {
    const n = fbm(u, v, { scale: 6, seed: 37, octaves: 5 });
    return { c: [mix(30, 60, n), mix(100, 140, n), mix(150, 180, n)], h: n, r: 0.05 };
  }, { normalStrength: 4 }),
  // cast-iron verandah lace (Broken Hill and Adelaide pubs): alpha pattern
  lace: () => build('lace', (u, v) => {
    const x = (u * 4) % 1 - 0.5, y = v - 0.5;
    const ring = Math.abs(Math.hypot(x * 1.6, y) - 0.3) < 0.04 || Math.abs(Math.hypot(x * 1.6, y) - 0.15) < 0.035;
    const frame = v < 0.08 || v > 0.92 || Math.abs(x) > 0.47;
    const scroll = Math.abs(Math.sin((x + y) * 18)) < 0.15 && Math.hypot(x, y) < 0.45;
    const on = ring || frame || scroll;
    return { c: [228, 228, 214], h: on ? 0.6 : 0, r: 0.5, a: on ? 255 : 0 };
  }, { alpha: true, size: 256 }),
};
