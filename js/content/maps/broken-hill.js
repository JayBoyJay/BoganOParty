// Broken Hill, NSW: the Silver City. Red dirt, the Line of Lode slag heap through the middle of town
// with the Miners Memorial on top, a poppet head over the shaft, pubs with deep verandahs and
// cast-iron lace, tin-roofed miners' cottages, and a detour out to Silverton and the Interceptor.
import { cottage, pub, waterTank, windmill, powerPole, wires, car, gumTreeParts, saltbushParts, rockParts } from '../../host/props.js';
import { ImprovedNoise } from '../../../vendor/ImprovedNoise.js';

// a lumpy mound with world-unit UVs: the slag heap and the Living Desert hill
function mound(k, rx, h, rz, seed, material, terraces = 0) {
  const THREE = k.THREE;
  const g = new THREE.SphereGeometry(1, 96, 40, 0, Math.PI * 2, 0, Math.PI / 2);
  const n = new ImprovedNoise(), P = g.attributes.position, UV = g.attributes.uv;
  for (let i = 0; i < P.count; i++) {
    let x = P.getX(i) * rx, y = P.getY(i) * h, z = P.getZ(i) * rz;
    const bump = 1 + n.noise(x * 0.12 + seed, y * 0.12, z * 0.12) * 0.22 + n.noise(x * 0.5, y * 0.5 + seed, z * 0.5) * 0.05;
    x *= bump; z *= bump; y *= bump;
    if (terraces) { const step = h / terraces; const t = Math.floor(y / step) * step; y = t + Math.pow((y - t) / step, 3) * step; }
    P.setXYZ(i, x, Math.max(0, y), z);
    UV.setXY(i, (x + z) / 3, y / 3);
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, material);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

export default {
  id: 'broken-hill',
  name: 'Broken Hill',
  blurb: 'Silver City. Red dirt, slag heaps and a pub on every corner.',
  item: {
    id: 'lead', name: 'Lump of Lead', plural: 'Lumps of Lead', emoji: '🪨', price: 20,
    // a raw lump of galena: dull blue-grey metal with white oxide crust in the cracks
    build(k) {
      const THREE = k.THREE;
      const g = new THREE.Group();
      const geo = new THREE.IcosahedronGeometry(0.9, 5);
      const n = new ImprovedNoise(), P = geo.attributes.position;
      const colors = new Float32Array(P.count * 3);
      for (let i = 0; i < P.count; i++) {
        const v = new THREE.Vector3(P.getX(i), P.getY(i), P.getZ(i));
        const d = 1 + n.noise(v.x * 1.6, v.y * 1.6, v.z * 1.6) * 0.35 + n.noise(v.x * 5, v.y * 5, v.z * 5) * 0.08;
        // flatten into chunky facets, like a broken lump
        const f = Math.round(d * 6) / 6 * 0.6 + d * 0.4;
        v.multiplyScalar(f); v.y *= 0.8;
        P.setXYZ(i, v.x, v.y, v.z);
        const ox = Math.max(0, n.noise(v.x * 3 + 7, v.y * 3, v.z * 3) * 2 - 0.2);
        colors[i * 3] = 0.2 + ox * 0.45; colors[i * 3 + 1] = 0.21 + ox * 0.43; colors[i * 3 + 2] = 0.24 + ox * 0.38;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ vertexColors: true, metalness: 0.6, roughness: 0.6, clearcoat: 0.1, roughnessMap: k.surf('slag', { unit: 0.6 }).roughnessMap }));
      m.castShadow = true;
      g.add(m);
      return g;
    },
  },
  look: {
    sky: { elevation: 20, azimuth: 235, turbidity: 9, rayleigh: 2.6, mie: 0.008 }, // late-afternoon outback glow
    fog: 0xe0a272, ground: 0x9a4a28, sun: 0xffd9a8, sunIntensity: 3.4, skyLight: 0xffd2b0, envIntensity: 0.55,
    groundTex: 'redDirt', pathTex: 'gravel', path: 0xe8c9a0, plinthTex: 'concrete', hills: 3, ranges: 30,
  },
  board: {
    loop: {
      name: 'Argent St', count: 40,
      points: [[0, 30], [-24, 26], [-38, 8], [-34, -16], [-14, -30], [10, -30], [30, -20], [38, 0], [30, 20], [14, 30]],
      pattern: 'BBRBEBBRBBEBRB',
    },
    shops: [7, 27],
    branches: [
      { name: 'Through the mine', sub: 'Short cut, lots of red', from: 4, to: 14, points: [[-10, 4], [-6, -8]], count: 5, pattern: 'RERRB' },
      { name: 'Out to Silverton', sub: 'The long way, lots of events', from: 22, to: 30, points: [[28, -46], [54, -40], [60, -14]], count: 9, pattern: 'BEBEBEBEB', shops: [4] },
    ],
  },
  landmarks: [
    { name: 'Line of Lode', x: 14, z: 4, flat: 14, build(k, g) {
      // the slag heap: dark, terraced mullock with rusty streaks
      g.add(mound(k, 12, 9, 8, 3, k.surf('slag', { unit: 3 }), 4));
      // Miners Memorial: a long corten-steel box cantilevered off the top of the heap
      const mem = k.group(0, 8.6, 0, 0.25, 1, g);
      k.box(4, 0.8, 4, k.surf('concrete', { unit: 2 }), -3, -0.6, 0, mem);
      k.box(14, 3.2, 3.2, k.surf('rust', { unit: 3, metalness: 0.4 }), 1.5, 0, 0, mem);
      k.box(0.3, 2.2, 3.3, 0x111111, 8.4, 0.5, 0, mem); // open end
      for (let i = 0; i < 6; i++) k.box(1.6, 0.25, 3.3, 0x1a0f0a, -3 + i * 2.2, 1.4, 0, mem); // slots in the side
      // the Broken Earth restaurant: glass and steel
      const caf = k.group(-6, 8.2, -2, 0.25, 1, g);
      k.box(7, 0.4, 5, k.surf('concrete', { unit: 2 }), 0, -0.4, 0, caf);
      k.box(7, 3, 5, k.mat(0x223038, { metalness: 0.7, roughness: 0.08, transparent: true, opacity: 0.75 }), 0, 0, 0, caf);
      k.box(7.6, 0.35, 5.6, k.surf('steel', { unit: 1, metalness: 0.7 }), 0, 3, 0, caf);
      k.label('Miners Memorial', 0, 17, 0, g);
    } },
    { name: 'Headframe', x: -1, z: -15, flat: 9, build(k, g) {
      // poppet head: four lattice legs braced every few metres, platform, two sheave wheels, and
      // a back-leg strut out to the winder house
      const H = 18, steel = k.surf('steel', { unit: 1.2, metalness: 0.75, tint: 0x9a5a40 });
      const legs = [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]];
      const top = (x, z) => [x * 0.35, H, z * 0.35];
      for (const [x, z] of legs) k.beam([x, 0, z], top(x, z), 0.4, steel, g);
      for (let y = 2.5, i = 0; y < H - 1; y += 2.5, i++) {
        const s = 1 - y / H * 0.65, pts = legs.map(([x, z]) => [x * s, y, z * s]);
        for (let j = 0; j < 4; j++) {
          const a = pts[j === 0 ? 0 : j === 1 ? 1 : j === 2 ? 3 : 2], b = pts[j === 0 ? 1 : j === 1 ? 3 : j === 2 ? 2 : 0];
          k.beam(a, b, 0.18, steel, g);
          const s2 = 1 - (y + 2.5) / H * 0.65, up = [b[0] / s * s2, y + 2.5, b[2] / s * s2];
          if (y + 2.5 < H) k.beam(a, up, 0.1, steel, g); // X bracing
        }
      }
      k.box(4.4, 0.3, 4.4, k.surf('planks', { unit: 2 }), 0, H, 0, g);
      for (const [x, z] of [[-2.1, -2.1], [2.1, -2.1], [-2.1, 2.1], [2.1, 2.1]]) k.cyl(0.05, 0.05, 1.1, 0xd9d4c8, x, H + 0.3, z, g, {}, 6);
      const wheels = [];
      for (const z of [-0.8, 0.8]) {
        const w = k.group(0, H + 2.6, z, 0, 1, g);
        const rim = k.torus(2.1, 0.13, 0x2a2622, 0, 0, 0, w, { metalness: 0.8, roughness: 0.5 });
        for (let i = 0; i < 8; i++) { const sp = k.box(0.08, 4.1, 0.08, 0x2a2622, 0, -2.05, 0, w, { metalness: 0.8 }); sp.rotation.z = i / 8 * Math.PI; sp.position.set(0, 0, 0); }
        k.cyl(0.3, 0.3, 0.4, 0x2a2622, 0, -0.2, 0, w).rotation.x = Math.PI / 2;
        w.rotation.y = Math.PI / 2;
        wheels.push(w);
      }
      g.userData.update = (dt) => wheels.forEach((w) => { w.rotation.z += dt * 0.8; });
      k.beam([0, 0, 12], [0, H * 0.8, 1], 0.6, steel, g); // back leg
      // winder house with cables up to the wheels
      const wh = k.group(0, 0, 15, 0, 1, g);
      k.box(8, 5, 6, k.surf('corrugated', { unit: 2, tint: 0xb8a48a, metalness: 0.5 }), 0, 0, 0, wh);
      k.box(8.6, 0.15, 6.6, k.surf('corrugated', { unit: 1.5, tint: 0x8c6a50, metalness: 0.5 }), 0, 5, 0, wh);
      for (const z of [-0.8, 0.8]) k.rod([z, H + 4.6, 0], [z, 4.5, 13], 0.035, 0x111111, g);
      k.label('Poppet head', 0, H + 7, 0, g);
    } },
    { name: 'Palace Hotel', x: -50, z: 24, rot: 0.95, flat: 16, build(k, g) {
      pub(k, 0, 0, 0, { name: 'PALACE HOTEL', color: 0xe9dbb8, trim: 0x2d5e3e, roof: 0x8d8f8c }, g);
      car(k, -4, 11, 0.05, { color: 0xe8e4da, style: 'ute' }, g);
      car(k, 4, 11.5, -0.03, { color: 0x7a1414, style: 'sedan' }, g);
    } },
    { name: 'Silverton', x: 74, z: -32, rot: -1.2, flat: 18, build(k, g) {
      cottage(k, 0, 0, 0, { wall: 'render', color: 0xcaa27a, roof: 0x8a8f92, trim: 0x5a3a24, w: 14, d: 9, h: 3.8 }, g);
      k.sign('SILVERTON HOTEL', 9, 1.1, 0, 5.3, 4.62, g, { bg: '#3a2a1c', fg: '#ecd9b0', font: '900 100px Georgia, serif' });
      // the black pursuit special, blower poking out of the bonnet
      const mm = car(k, 0, 12, 0.25, { color: 0x080808, style: 'coupe' }, g);
      k.box(0.7, 0.5, 0.6, 0xb8bcc0, 1.2, 1.0, 0, mm, { metalness: 1, roughness: 0.2 });
      k.box(0.5, 0.35, 0.45, 0x111111, 1.2, 1.5, 0, mm);
      for (const z of [-0.95, 0.95]) k.rod([-1.6, 0.5, z], [1.4, 0.5, z], 0.08, 0xb8bcc0, mm, { metalness: 1, roughness: 0.2 });
      waterTank(k, -9, -4, g);
    } },
    { name: 'Living Desert Sculptures', x: 46, z: 42, flat: 14, build(k, g) {
      g.add(mound(k, 11, 4, 11, 9, k.surf('redDirt', { unit: 4 }), 0));
      const stone = k.surf('sandstone', { unit: 1.5 });
      const shapes = [
        (s) => k.lathe([[0, 0], [0.8, 0], [0.6, 1.5], [0.9, 3], [0.4, 4.2], [0, 4.4]], stone, s),
        (s) => k.extrude([[-1, 0], [1, 0], [0.6, 2.5], [1.2, 4], [-0.4, 3.6], [-0.8, 2]], 0.9, stone, s, {}, 0.12),
        (s) => k.extrude([[-0.7, 0], [0.7, 0], [0.7, 3.6], [0, 4.4], [-0.7, 3.6]], 0.7, stone, s, {}, 0.1),
        (s) => k.lathe([[0, 0], [1.1, 0], [1.2, 0.8], [0.5, 1.6], [0.9, 2.6], [0, 3.4]], stone, s),
      ];
      [[-4, 0], [0, -3.5], [4, 1], [1, 4], [-2.5, 3.5], [3.5, -3]].forEach(([x, z], i) => {
        const s = k.group(x, 3.6, z, i * 1.3, 1, g);
        shapes[i % shapes.length](s);
      });
      k.label('Living Desert', 0, 12, 0, g);
    } },
    { name: 'Broken Hill Regional Art Gallery', x: -56, z: -22, rot: 1.6, flat: 12, build(k, g) {
      const wall = k.surf('brick', { unit: 2.5 });
      k.box(16, 7, 10, wall, 0, 0, 0, g);
      k.box(16.6, 0.6, 10.6, 0xe6dcc6, 0, 7, 0, g);
      for (let i = 0; i < 5; i++) k.window(1.2, 2.4, -6 + i * 3, 3.6, 5.03, g, 0xe6dcc6);
      k.sign('ART GALLERY', 8, 1, 0, 8.3, 5.31, g, { bg: '#1f3b5b', fg: '#fff' });
    } },
  ],
  scatter(k, rng) {
    // miners' cottages around the edge of town
    const palette = [[0xe8e2d0, 0x9aa3a8, 0x2f5d3a], [0xd8c49a, 0x8d4b32, 0x3a2516], [0xc9d6d0, 0x9aa3a8, 0x7a1f1f], [0xf0e6c8, 0x6f7a7f, 0x28456b]];
    let placed = 0;
    for (let tries = 0; tries < 400 && placed < 22; tries++) {
      const a = rng() * Math.PI * 2, r = 52 + rng() * 55, x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (!k.isClear(x, z, 7)) continue;
      const [color, roof, trim] = palette[Math.floor(rng() * palette.length)];
      cottage(k, x, z, -a - Math.PI / 2 + (rng() - 0.5) * 0.3, { wall: rng() < 0.25 ? 'corrugated' : rng() < 0.4 ? 'brick' : 'weatherboard', color, roof, trim });
      if (rng() < 0.35) waterTank(k, x + Math.cos(a) * 6, z + Math.sin(a) * 6);
      if (rng() < 0.3) car(k, x - Math.sin(a) * 6, z + Math.cos(a) * 6, -a, { color: [0xe8e4da, 0x1c3f7a, 0x7a1414, 0x2c2c2c][Math.floor(rng() * 4)], style: rng() < 0.6 ? 'ute' : 'sedan' });
      placed++;
    }
    // windmills and a run of power poles out on the flats
    for (const [x, z] of [[-90, 40], [95, 55], [-30, 95]]) if (k.isClear(x, z, 4)) windmill(k, x, z);
    const tops = [];
    for (let i = 0; i < 14; i++) { const a = 0.4 + i * 0.13, x = Math.cos(a) * 120, z = Math.sin(a) * 120; tops.push(powerPole(k, x, z)); }
    wires(k, tops);
    // saltbush, rocks and the odd river red gum
    const b = k.batch;
    for (let i = 0; i < 420; i++) {
      const a = rng() * Math.PI * 2, r = 8 + rng() * 170, x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (!k.isClear(x, z, 1.5)) continue;
      const y = k.heightAt(x, z);
      if (rng() < 0.7) b.add('saltbush' + (i % 3), () => saltbushParts(i % 3 + 1), x, y, z, 0.7 + rng() * 0.8);
      else b.add('rock' + (i % 3), () => rockParts(i % 3 + 1), x, y - 0.1, z, 0.4 + rng() * 1.1);
    }
    for (let i = 0; i < 45; i++) {
      const a = rng() * Math.PI * 2, r = 45 + rng() * 120, x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (!k.isClear(x, z, 4)) continue;
      b.add('gum' + (i % 3), () => gumTreeParts(i % 3 + 1, 1.1), x, k.heightAt(x, z) - 0.2, z, 0.8 + rng() * 0.5);
    }
  },
  events: [
    { text: 'Found a fiver at the servo!', coins: 5, mood: 'happy' },
    { text: 'Bought a round at the Palace. Shout!', coins: -6, mood: 'sad' },
    { text: 'Dust storm! Lost your bearings.', coins: -2, mood: 'angry' },
    { text: 'Struck silver in the backyard!', coins: 8, mood: 'happy' },
    { text: 'Ran over a roo. Bullbar held up.', hp: -15, mood: 'sad' },
    { text: 'Two-up win at the RSL!', coins: 6, mood: 'happy' },
  ],
};
