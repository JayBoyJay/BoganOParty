// Broken Hill, NSW: the Silver City. Red dirt, the Line of Lode slag heap through the middle of town
// with the Miners Memorial on top, a poppet head over the shaft, pubs with deep verandahs and
// cast-iron lace, tin-roofed miners' cottages, and a detour out to Silverton and the Interceptor.
import { cottage, pub, shopfront, waterTank, windmill, powerPole, wires, car, gumTreeParts, saltbushParts, rockParts } from '../../host/props.js';
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
    // a lump of galena (lead ore, what Broken Hill was built on): bright, blocky silver-grey cubes
    // growing out of a dark lump of rock, with a few rusty quartz specks
    build(k) {
      const THREE = k.THREE;
      const g = new THREE.Group();
      // the rock it's growing out of
      const geo = new THREE.IcosahedronGeometry(0.75, 4);
      const n = new ImprovedNoise(), P = geo.attributes.position;
      const colors = new Float32Array(P.count * 3);
      for (let i = 0; i < P.count; i++) {
        const v = new THREE.Vector3(P.getX(i), P.getY(i), P.getZ(i));
        const d = 1 + n.noise(v.x * 1.8, v.y * 1.8, v.z * 1.8) * 0.3 + n.noise(v.x * 6, v.y * 6, v.z * 6) * 0.06;
        v.multiplyScalar(Math.round(d * 7) / 7 * 0.5 + d * 0.5); v.y *= 0.7;
        P.setXYZ(i, v.x, v.y, v.z);
        const rust = Math.max(0, n.noise(v.x * 3 + 7, v.y * 3, v.z * 3) * 2.2 - 0.3);
        colors[i * 3] = 0.24 + rust * 0.42; colors[i * 3 + 1] = 0.22 + rust * 0.2; colors[i * 3 + 2] = 0.22 + rust * 0.08;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geo.computeVertexNormals();
      const rock = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, roughnessMap: k.surf('slag', { unit: 0.6 }).roughnessMap }));
      rock.castShadow = true;
      g.add(rock);
      // galena cubes: mirror-bright faces, slightly stepped like real crystals
      const galena = new THREE.MeshPhysicalMaterial({ color: 0xaeb4bc, metalness: 1, roughness: 0.16, clearcoat: 0.6, clearcoatRoughness: 0.1 });
      const cube = (s, x, y, z, rx, ry, rz) => {
        const c = new THREE.Group(); c.position.set(x, y, z); c.rotation.set(rx, ry, rz); g.add(c);
        const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), galena); m.castShadow = true; c.add(m);
        const step = new THREE.Mesh(new THREE.BoxGeometry(s * 0.62, s * 0.62, s * 0.62), galena);
        step.position.set(s * 0.32, s * 0.32, s * 0.12); c.add(step); // a smaller cube grown on the corner
        return c;
      };
      cube(0.62, 0.1, 0.42, 0.05, 0.3, 0.5, 0.15);
      cube(0.42, -0.42, 0.28, 0.2, -0.2, 0.9, 0.35);
      cube(0.34, 0.45, 0.2, -0.3, 0.5, 0.2, -0.3);
      cube(0.26, -0.15, 0.32, -0.45, 0.8, -0.4, 0.2);
      cube(0.22, 0.38, 0.12, 0.42, -0.4, 0.3, 0.6);
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
      // Miners Memorial: a long, slim corten-steel box cantilevered off the end of the heap on a concrete
      // pier, with a slot of light down its side where the names are
      const mem = k.group(0, 8.4, 0, 0.25, 1, g);
      const corten = k.surf('rust', { unit: 2.5, metalness: 0.35 });
      k.box(3.2, 1.2, 3.2, k.surf('concrete', { unit: 2 }), -2.5, -1.0, 0, mem); // pier
      k.box(15, 2.6, 2.6, corten, 2.5, 0, 0, mem);
      k.box(15.1, 0.18, 2.7, k.mat(0x2b1408, { roughness: 0.9 }), 2.5, 2.6, 0, mem); // dark roof line
      const glow = new k.THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffc070, emissiveIntensity: 0.9 });
      for (const sz of [-1.31, 1.31]) {
        const slot = new k.THREE.Mesh(new k.THREE.PlaneGeometry(12.5, 0.32), glow);
        slot.position.set(3.3, 1.5, sz); slot.rotation.y = sz > 0 ? 0 : Math.PI; mem.add(slot);
        for (let i = 0; i < 14; i++) k.box(0.1, 0.36, 0.06, 0x3a1c0c, -2.8 + i * 0.95, 1.32, sz * 1.01, mem); // fins over the slot
      }
      k.box(0.12, 2.3, 2.3, 0x0d0705, 10.0, 0.15, 0, mem); // open end
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
    { name: 'Argent St', x: -12, z: -44, flat: 18, build(k, g) {
      // the main street behind the top of the board: Trades Hall, Bell's Milk Bar and a couple of shops
      const th = k.group(-11, 0, 0, 0, 1, g);
      const brick = k.surf('brick', { unit: 2.5 }), stone = k.surf('sandstone', { unit: 2 });
      k.box(12, 9, 9, brick, 0, 0, 0, th);
      k.box(12.4, 0.5, 9.4, 0xe6dcc6, 0, 9, 0, th);
      for (let fl = 0; fl < 2; fl++) for (let i = 0; i < 4; i++) k.window(1.1, 2.0, -4.2 + i * 2.8, fl ? 6.6 : 2.4, 4.53, th, 0xe6dcc6);
      k.box(3, 3.4, 0.6, stone, 0, 0, 4.6, th); // portico
      k.box(1.5, 2.6, 0.1, 0x3a2516, 0, 0, 4.92, th);
      // clock tower with a little cupola
      k.box(3.4, 5, 3.4, brick, 0, 9.5, 2.6, th);
      k.box(3.8, 0.4, 3.8, 0xe6dcc6, 0, 14.5, 2.6, th);
      const face = k.cyl(1.1, 1.1, 0.12, 0xf6f1e4, 0, 12.2, 4.32, th, {}, 32); face.rotation.x = Math.PI / 2;
      for (const [len, a] of [[0.8, 0.5], [0.6, 2.2]]) { const hand = k.box(0.08, len, 0.04, 0x111111, 0, 12.2 + 0, 4.4, th); hand.geometry.translate(0, len / 2 - 0.05, 0); hand.position.y = 12.8; hand.rotation.z = a; }
      k.lathe([[0, 0], [1.8, 0], [1.6, 0.4], [1.1, 1.4], [0.3, 2.2], [0.08, 3], [0, 3.1]], k.mat(0x7a8a7a, { metalness: 0.7, roughness: 0.35 }), th).position.set(0, 14.9, 2.6);
      k.sign('TRADES HALL', 7, 0.9, 0, 9.9, 4.72, th, { bg: '#e6dcc6', fg: '#5b1f1a', font: '900 120px Georgia, serif' });
      // Bell's Milk Bar: mint and pink, neon sign
      shopfront(k, 1, 0, 0, { name: "BELL'S MILK BAR", color: 0xbfe3cf, trim: 0xd94f7a, roof: 0xb8bcc0, signBg: '#fbe3ea', signFg: '#d94f7a', glow: null, window: 0xfff0d8 }, g);
      shopfront(k, 10.5, 0, 0, { name: 'NEWSAGENCY', color: 0xe8d6a8, trim: 0x23426b, w: 8, signBg: '#23426b', signFg: '#ffe6a0' }, g);
      shopfront(k, -24, 0, 0, { name: 'SILVER CITY PAWN', color: 0xd7b8a0, trim: 0x5b1f1a, w: 10, h: 5.5, signBg: '#5b1f1a', signFg: '#f4e2b0' }, g);
      car(k, 5, 9.4, 0.04, { color: 0x1c3f7a, style: 'ute' }, g);
      car(k, -16, 9.6, Math.PI - 0.03, { color: 0xe8e4da, style: 'sedan' }, g);
      k.label('Argent St', -11, 19, 2, g);
    } },
    { name: 'Sturt Park', x: -27, z: 4, flat: 8, build(k, g) {
      // the park's lawn, a ring path and the Titanic Memorial bandstand (for the bandsmen of the Titanic)
      const lawn = new k.THREE.Mesh(new k.THREE.CircleGeometry(7.3, 48), k.surf('grass', { unit: 3 }));
      const luv = lawn.geometry.attributes.uv, lp = lawn.geometry.attributes.position;
      for (let i = 0; i < luv.count; i++) luv.setXY(i, lp.getX(i), lp.getY(i));
      lawn.rotation.x = -Math.PI / 2; lawn.position.y = 0.06; lawn.receiveShadow = true; g.add(lawn);
      const ring = k.torus(5.2, 0.45, k.surf('gravel', { unit: 1.5, tint: 0xe8c9a0 }), 0, 0.05, 0, g); ring.rotation.x = Math.PI / 2; ring.scale.z = 0.12;
      const iron = k.mat(0x2d5e3e, { metalness: 0.5, roughness: 0.45 }), cream = k.mat(0xf2ead6, { roughness: 0.6 });
      k.cyl(2.9, 3.1, 0.9, k.surf('sandstone', { unit: 1.5 }), 0, 0.05, 0, g, {}, 8);
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2 + Math.PI / 8, x = Math.cos(a) * 2.6, z = Math.sin(a) * 2.6;
        k.cyl(0.09, 0.11, 3, iron, x, 0.95, z, g, {}, 10);
        // a lace bracket under the eaves
        const br = k.box(0.05, 0.5, 0.5, iron, x * 0.95, 3.4, z * 0.95, g); br.rotation.y = -a; br.rotation.x = 0.8;
      }
      k.cyl(3.2, 3.2, 0.3, cream, 0, 3.95, 0, g, {}, 8);
      // ogee roof in green-painted iron, a cream band and a finial
      k.lathe([[0, 0], [3.4, 0], [3.1, 0.35], [2.2, 0.8], [1.2, 1.6], [0.6, 2.4], [0.2, 2.9], [0, 3.0]], iron, g, {}, 8).position.y = 4.25;
      k.cyl(0.06, 0.06, 1.2, k.mat(0xd9b25a, { metalness: 1, roughness: 0.3 }), 0, 7.2, 0, g, {}, 6);
      k.ball(0.18, k.mat(0xd9b25a, { metalness: 1, roughness: 0.3 }), 0, 8.4, 0, g);
      // benches and lamp posts round the path
      for (let i = 0; i < 4; i++) {
        const a = i / 4 * Math.PI * 2 + 0.4, b = k.group(Math.cos(a) * 6.2, 0, Math.sin(a) * 6.2, -a + Math.PI / 2, 1, g);
        k.box(1.8, 0.08, 0.5, k.surf('planks', { unit: 1 }), 0, 0.45, 0, b); k.box(1.8, 0.45, 0.06, k.surf('planks', { unit: 1 }), 0, 0.55, -0.24, b);
        for (const sx of [-0.8, 0.8]) k.box(0.06, 0.45, 0.5, iron, sx, 0, 0, b);
        const la = a + Math.PI / 4, lx = Math.cos(la) * 6.4, lz = Math.sin(la) * 6.4;
        k.cyl(0.06, 0.09, 3.2, iron, lx, 0, lz, g, {}, 8);
        k.ball(0.28, k.mat(0xfff4d6, { emissive: 0xffe6a8, emissiveIntensity: 0.8 }), lx, 3.4, lz, g);
      }
      k.label('Sturt Park', 0, 11, 0, g);
    } },
    { name: 'Haul truck', x: 8, z: 19, rot: 0.35, flat: 6, build(k, g) {
      // a retired mine haul truck on show by the road: yellow dump body, tiny cab, tyres taller than you
      const THREE = k.THREE;
      const yellow = new THREE.MeshPhysicalMaterial({ color: 0xf0b018, roughness: 0.42, metalness: 0.25, clearcoat: 0.4, clearcoatRoughness: 0.4 });
      const dark = k.mat(0x2a2622, { metalness: 0.6, roughness: 0.55 });
      const t = k.group(0, 0, 0, 0, 0.9, g);
      k.box(9.2, 1, 3.8, dark, 0, 1.7, 0, t); // chassis
      // dump body: side profile extruded across, sloping up to a canopy over the cab
      const body = k.extrude([[-4.8, 0], [2.4, 0], [3.2, 0.6], [3.2, 3.6], [4.8, 3.9], [4.8, 4.3], [-4.8, 3.2], [-5.3, 2.4]], 5, yellow, t, {}, 0.06);
      body.position.set(-0.6, 2.7, 0); body.rotation.z = 0.06;
      for (let i = 0; i < 5; i++) k.box(0.18, 2.8, 5.1, yellow, -4 + i * 1.6, 3.0, 0, t); // body ribs
      // deck, cab and radiator at the front (+x)
      k.box(2.6, 0.25, 5.2, dark, 3.9, 3.0, 0, t);
      k.box(1.8, 1.8, 1.8, yellow, 3.8, 3.25, -1.5, t);
      k.box(1.2, 1.0, 0.04, k.mat(0x1a242c, { metalness: 0.6, roughness: 0.08 }), 4.2, 4.2, -0.58, t);
      k.box(0.3, 2.2, 3.2, dark, 5.1, 1.0, 0, t); // grille
      for (let i = 0; i < 9; i++) k.box(0.05, 1.9, 0.08, 0x111111, 5.27, 1.15, -1.4 + i * 0.35, t);
      k.box(0.3, 0.25, 0.5, 0xfff6d0, 5.25, 2.9, 1.2, t, { emissive: 0xfff2c0, emissiveIntensity: 0.4 });
      k.box(0.3, 0.25, 0.5, 0xfff6d0, 5.25, 2.9, -1.2, t, { emissive: 0xfff2c0, emissiveIntensity: 0.4 });
      // ladder up to the deck
      for (const z of [0.4, 0.9]) k.beam([5.4, 0.2, z], [4.9, 3.0, z], 0.06, dark, t);
      for (let i = 0; i < 6; i++) k.rod([5.35 - i * 0.08, 0.5 + i * 0.45, 0.4], [5.35 - i * 0.08, 0.5 + i * 0.45, 0.9], 0.03, dark, t);
      // tyres: fat tread, chunky hub
      const tyreM = k.mat(0x1b1b1b, { roughness: 0.95 }), hubM = k.mat(0xf0b018, { metalness: 0.3, roughness: 0.5 });
      for (const x of [-2.8, 3.0]) for (const z of [-2.2, 2.2]) {
        const tyre = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.62, 14, 32), tyreM); tyre.position.set(x, 1.75, z * 1.05); tyre.scale.z = 1.25; tyre.castShadow = true; t.add(tyre);
        for (let i = 0; i < 16; i++) { const lug = k.box(0.5, 0.18, 0.95, tyreM, 0, 0, 0, t); lug.position.set(x + Math.cos(i / 16 * Math.PI * 2) * 1.75, 1.75 + Math.sin(i / 16 * Math.PI * 2) * 1.75, z * 1.05); lug.rotation.z = i / 16 * Math.PI * 2 + Math.PI / 2; }
        const hub = k.cyl(0.7, 0.7, 0.5, hubM, x, 1.75, z * 1.18, t, {}, 16); hub.rotation.x = Math.PI / 2; hub.position.y = 1.75;
      }
    } },
    { name: 'Palace Hotel', x: -47, z: 27, rot: 0.95, flat: 16, build(k, g) {
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
    { name: 'Living Desert Sculptures', x: 42, z: 37, flat: 14, build(k, g) {
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
    { name: 'Broken Hill Regional Art Gallery', x: -50, z: -24, rot: 1.25, flat: 12, build(k, g) {
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
