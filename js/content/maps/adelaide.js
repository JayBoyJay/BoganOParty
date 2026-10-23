// Adelaide, SA: the City of Churches (and the Crazy Horse). Adelaide Oval, the Malls Balls on
// Rundle Mall, the Torrens with Popeye boats, the CBD skyline, and a tram detour down to Glenelg.
import { cottage, pub, tower, car, gumTreeParts, rockParts } from '../../host/props.js';
import { surf } from '../../host/kit.js';

// Norfolk Island pine, as planted along the Glenelg foreshore
function pineParts(k) {
  const THREE = k.THREE;
  const tiers = [];
  for (let i = 0; i < 7; i++) { const c = new THREE.ConeGeometry(3.2 - i * 0.38, 2.2, 10, 1, true); c.translate(0, 4 + i * 1.5, 0); tiers.push(c); }
  return [
    { geo: new THREE.CylinderGeometry(0.15, 0.35, 14, 8).translate(0, 7, 0), material: surf('bark', { unit: 1, tint: 0x8a7a68 }) },
    { geo: mergeCones(THREE, tiers), material: surf('leaves', { unit: 1.5, tint: 0x5f8a5a }) },
  ];
}
function mergeCones(THREE, list) {
  const pos = [], nor = [], uv = [];
  for (const g of list) {
    const ng = g.toNonIndexed();
    pos.push(...ng.attributes.position.array); nor.push(...ng.attributes.normal.array); uv.push(...ng.attributes.uv.array);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return out;
}

const HORSE = [[-4.5, 0], [-3.8, 3.2], [-4.6, 5.6], [-4.2, 6.2], [-3, 5], [-2.8, 4], [2.4, 4], [3.2, 5.6], [3.6, 8.4], [4.4, 9.4], [6.2, 8.6], [6.4, 7.8], [4.8, 7.6], [4.2, 5.6], [3.6, 3.2], [4.2, 0], [3.2, 0], [2.6, 2.6], [-2.4, 2.6], [-3.2, 0]];

export default {
  id: 'adelaide',
  name: 'Adelaide',
  blurb: 'City of Churches. Malls Balls, the Oval, and a ticket to the Crazy Horse.',
  item: {
    id: 'ticket', name: 'Crazy Horse Ticket', plural: 'Crazy Horse Tickets', emoji: '🎟️', price: 20,
    // a foil-edged admission ticket with a perforated stub
    build(k) {
      const THREE = k.THREE;
      const g = new THREE.Group();
      const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
      const x = c.getContext('2d');
      const grad = x.createLinearGradient(0, 0, 1024, 512); grad.addColorStop(0, '#1b0b1f'); grad.addColorStop(1, '#4a0f3a');
      x.fillStyle = grad; x.fillRect(0, 0, 1024, 512);
      x.strokeStyle = '#ffd36b'; x.lineWidth = 14; x.strokeRect(20, 20, 984, 472);
      x.setLineDash([10, 14]); x.lineWidth = 6; x.beginPath(); x.moveTo(760, 30); x.lineTo(760, 482); x.stroke(); x.setLineDash([]);
      x.fillStyle = '#ff4fb0'; x.shadowColor = '#ff4fb0'; x.shadowBlur = 30; x.font = '900 120px Georgia, serif'; x.textAlign = 'center'; x.fillText('CRAZY', 390, 190); x.fillText('HORSE', 390, 320);
      x.shadowBlur = 0; x.fillStyle = '#ffd36b'; x.font = '800 40px system-ui'; x.fillText('ADMIT ONE · HINDLEY ST', 390, 420);
      x.save(); x.translate(890, 256); x.rotate(-Math.PI / 2); x.font = '900 64px system-ui'; x.fillText('Nº 0069', 0, 20); x.restore();
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      const face = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.35, clearcoat: 0.8, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.25 });
      const edge = new THREE.MeshStandardMaterial({ color: 0xffd36b, metalness: 1, roughness: 0.25 });
      const m = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 0.04), [edge, edge, edge, edge, face, face]);
      m.castShadow = true;
      m.rotation.z = 0.12;
      g.add(m);
      return g;
    },
  },
  look: {
    sky: { elevation: 48, azimuth: 150, turbidity: 2.2, rayleigh: 1.1, mie: 0.004 }, // clear midday
    fog: 0xc8dcef, ground: 0x4f7a32, sun: 0xfff6e8, sunIntensity: 3.2, skyLight: 0xcfe4ff, envIntensity: 0.7,
    groundTex: 'grass', pathTex: 'pavers', plinthTex: 'concrete', hills: 2, ranges: 45, sea: -84, // Gulf St Vincent past Glenelg
  },
  board: {
    loop: { name: 'North Terrace', count: 42, points: [[0, 32], [-26, 28], [-40, 10], [-38, -14], [-18, -32], [8, -32], [32, -22], [40, 2], [30, 24], [14, 32]], pattern: 'BBRBBEBRBEBB' },
    shops: [8, 30],
    branches: [
      { name: 'Down Rundle Mall', sub: 'Short cut with a shop', from: 3, to: 13, points: [[-8, 10], [-12, -10]], count: 5, pattern: 'EBEBE', shops: [2] },
      { name: 'Tram to Glenelg', sub: 'The long way, mostly blue', from: 16, to: 24, points: [[-10, -52], [24, -54], [48, -36]], count: 9, pattern: 'BBEBBBEBB' },
    ],
  },
  landmarks: [
    { name: 'Adelaide Oval', x: 16, z: 6, flat: 17, build(k, g) {
      const THREE = k.THREE;
      // the ground: mown stripes, the wicket square, a white boundary rope
      const field = new THREE.Mesh(new THREE.CircleGeometry(1, 64), k.surf('oval', { unit: 12 }));
      const uv = field.geometry.attributes.uv, pp = field.geometry.attributes.position;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, pp.getX(i) * 10.5, pp.getY(i) * 8.5);
      field.scale.set(10.5, 8.5, 1); field.rotation.x = -Math.PI / 2; field.position.y = 0.03; field.receiveShadow = true;
      g.add(field);
      k.box(0.8, 0.02, 3.2, 0xc9b48a, 0, 0.03, 0, g, { roughness: 1 });
      const rope = k.torus(1, 0.02, 0xffffff, 0, 0.08, 0, g); rope.rotation.x = Math.PI / 2; rope.scale.set(9.8, 7.9, 1);
      // stands: three tiers of seats in a ring, a back wall and white sail roofs
      const seats = k.surf('seats', { arg: 0x1d3d7a, unit: 2 }), wall = k.surf('concrete', { unit: 3, tint: 0x9a9c9e });
      const roof = new THREE.MeshPhysicalMaterial({ color: 0xe4e6e8, roughness: 0.45, side: THREE.DoubleSide });
      const N = 28;
      for (let i = 0; i < N; i++) {
        const a = i / N * Math.PI * 2;
        if (i === 7) continue; // gap for the heritage scoreboard
        const seg = k.group(Math.cos(a) * 12.4, 0, Math.sin(a) * 10.4, -a + Math.PI / 2, 1, g);
        const big = i % 7 > 2 && i % 7 < 6;
        for (let t = 0; t < (big ? 4 : 3); t++) { const st = k.box(2.9 + t * 0.3, 1.1, 1.3, seats, 0, t * 1.1, t * 1.15, seg); st.rotation.x = 0; }
        k.box(3.9, (big ? 4 : 3) * 1.1 + 0.6, 0.4, wall, 0, 0, (big ? 4 : 3) * 1.15 + 0.4, seg);
        const sail = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 3.9, 12, 1, true, Math.PI / 2 - 0.55, 1.1), roof);
        sail.rotation.z = Math.PI / 2; sail.position.set(0, (big ? 4 : 3) * 1.1 + 2.2 - 3.4, 2.0); sail.scale.set(1, 0.6, 1.25); sail.castShadow = true;
        seg.add(sail);
      }
      // the 1911 scoreboard, green with a white clock tower
      const sb = k.group(Math.cos(7 / N * Math.PI * 2) * 13, 0, Math.sin(7 / N * Math.PI * 2) * 11, -(7 / N * Math.PI * 2) + Math.PI / 2, 1, g);
      k.box(6, 6, 1.6, 0x1f4d34, 0, 0, 0, sb);
      k.box(1.6, 2.4, 1.6, 0xf4f1e8, 0, 6, 0, sb);
      k.cone(1.2, 1.4, 0x1f4d34, 0, 8.4, 0, sb, {}, 4);
      k.sign('ADELAIDE OVAL', 5, 0.9, 0, 5.2, -0.82, sb, { bg: '#1f4d34', fg: '#ffffff' }).rotation.y = Math.PI;
      // light towers
      for (const a of [0.6, 2.5, 3.8, 5.6]) {
        const lx = Math.cos(a) * 15.5, lz = Math.sin(a) * 13;
        k.cyl(0.25, 0.4, 20, k.surf('steel', { unit: 1, metalness: 0.7 }), lx, 0, lz, g, {}, 10);
        const bank = k.box(2.6, 1.6, 0.4, 0xfffff0, lx, 19.5, lz, g, { emissive: 0xffffff, emissiveIntensity: 1.2 });
        bank.lookAt(g.position.x, 0, g.position.z);
      }
      k.label('Adelaide Oval', 0, 22, 0, g);
    } },
    { name: 'Malls Balls', x: -21, z: 3, flat: 6, build(k, g) {
      k.cyl(3.2, 3.4, 0.25, k.surf('pavers', { unit: 1.5 }), 0, 0, 0, g, {}, 40);
      k.cyl(1.2, 1.5, 0.6, k.surf('concrete', { unit: 1 }), 0, 0.25, 0, g, {}, 32);
      const chrome = k.mat(0xeef2f6, { metalness: 1, roughness: 0.04 });
      k.ball(1.85, chrome, 0, 2.7, 0, g);
      k.ball(1.85, chrome, 0, 6.35, 0, g);
      // the bronze Rundle Mall pigs having a sniff around
      const bronze = k.mat(0x8a5a2b, { metalness: 0.9, roughness: 0.35 });
      [[2.6, 1.4, 0.4], [-2.4, 1.8, 2.6], [1.2, -2.8, 4.3]].forEach(([x, z, r]) => {
        const p = k.group(x, 0.25, z, r, 1, g);
        const body = k.ball(0.5, bronze, 0, 0.55, 0, p); body.scale.set(1.4, 0.9, 0.9);
        const head = k.ball(0.3, bronze, 0.75, 0.6, 0, p); head.scale.set(1.1, 0.9, 0.9);
        k.cyl(0.13, 0.15, 0.15, bronze, 1.05, 0.48, 0, p).rotation.z = Math.PI / 2;
        for (const [lx, lz] of [[-0.4, -0.25], [-0.4, 0.25], [0.4, -0.25], [0.4, 0.25]]) k.cyl(0.08, 0.07, 0.35, bronze, lx, 0, lz, p);
      });
      k.label('Rundle Mall', 0, 10, 0, g);
    } },
    { name: 'Crazy Horse', x: -56, z: 14, rot: 1.3, flat: 14, build(k, g) {
      const THREE = k.THREE;
      k.box(14, 9, 10, k.surf('render', { arg: 0x2a1a2e, unit: 3 }), 0, 0, 0, g);
      k.box(14.4, 0.5, 10.4, 0x140a16, 0, 9, 0, g);
      k.sign('CRAZY HORSE', 12, 2.4, 0, 6.8, 5.05, g, { bg: null, fg: '#ff4fb0', glow: '#ff4fb0', font: '900 210px Georgia, serif' });
      k.sign('★ GENTLEMEN\'S CLUB ★', 8, 0.8, 0, 5.1, 5.05, g, { bg: null, fg: '#7fe8ff', glow: '#7fe8ff' });
      // neon outline round the facade
      const neon = k.mat(0xff4fb0, { emissive: 0xff4fb0, emissiveIntensity: 3 });
      k.box(13.6, 0.08, 0.08, neon, 0, 8.6, 5.06, g); k.box(0.08, 8.4, 0.08, neon, -6.8, 0.2, 5.06, g); k.box(0.08, 8.4, 0.08, neon, 6.8, 0.2, 5.06, g);
      // entrance, awning, rope and bollards
      k.box(3, 3.2, 0.15, 0x0b0b0b, 0, 0, 5.02, g);
      const awn = k.box(5, 0.2, 2.4, 0x1b0b1f, 0, 3.6, 6.2, g);
      for (const x of [-2.4, 2.4]) k.cyl(0.08, 0.08, 1, k.mat(0xd4a64a, { metalness: 1, roughness: 0.25 }), x, 0, 7.6, g);
      const rope = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(-2.4, 0.95, 7.6), new THREE.Vector3(0, 0.5, 7.6), new THREE.Vector3(2.4, 0.95, 7.6)), 12, 0.05, 6), k.mat(0x9a0f2e, { roughness: 0.6 }));
      g.add(rope);
      const pink = new THREE.PointLight(0xff4fb0, 60, 18); pink.position.set(0, 6, 8); g.add(pink);
      // the rest of Hindley St
      pub(k, -16, 1, 0, { name: 'THE ROYAL', color: 0xd9cbb0, trim: 0x6b1d1d, w: 14, d: 10 }, g);
      cottage(k, 14, 1, 0, { wall: 'brick', roof: 0x6f7a7f, w: 10, d: 9, h: 6 }, g);
      k.label('Hindley St', 0, 14, 0, g);
    } },
    { name: 'Glenelg', x: 18, z: -70, flat: 26, build(k, g) {
      const THREE = k.THREE;
      k.box(70, 0.25, 34, k.surf('sand', { unit: 5 }), 0, -0.2, -2, g);
      k.box(1400, 0.25, 12, k.surf('sand', { unit: 5 }), 0, -0.2, -14, g); // the strip of beach along the coast
      const water = new THREE.Mesh(new THREE.PlaneGeometry(1400, 600, 1, 1), new THREE.MeshPhysicalMaterial({ color: 0x1f6f9a, roughness: 0.06, metalness: 0.1, clearcoat: 1, normalMap: k.surf('water', { unit: 6 }).normalMap.clone(), normalScale: new THREE.Vector2(0.6, 0.6) }));
      water.material.normalMap.repeat.set(100, 44); water.material.normalMap.wrapS = water.material.normalMap.wrapT = THREE.RepeatWrapping;
      water.rotation.x = -Math.PI / 2; water.position.set(0, -0.3, -315);
      g.add(water);
      g.userData.update = (dt) => { water.material.normalMap.offset.x += dt * 0.01; water.material.normalMap.offset.y += dt * 0.006; };
      // the jetty
      k.box(2.6, 0.3, 46, k.surf('planks', { unit: 2 }), 0, 1.3, -32, g);
      for (let z = -54; z < -10; z += 3) for (const x of [-1.1, 1.1]) k.cyl(0.16, 0.16, 2.0, k.surf('planks', { unit: 1 }), x, -0.4, z, g, {}, 8);
      for (let z = -54; z < -10; z += 3) for (const x of [-1.25, 1.25]) k.cyl(0.04, 0.04, 1, 0xdedede, x, 1.6, z, g, {}, 6);
      // an H-class tram at Moseley Square: cream and brown with a clerestory roof
      const tram = k.group(-18, 0, 8, 0.1, 1, g);
      k.box(13, 0.4, 2.7, 0x222222, 0, 0.6, 0, tram, { metalness: 0.7 });
      k.box(13, 1.4, 2.7, 0x6b3a1e, 0, 1.0, 0, tram, { roughness: 0.4 });
      k.box(13, 1.4, 2.7, 0xece0c2, 0, 2.4, 0, tram, { roughness: 0.4 });
      for (let i = 0; i < 9; i++) for (const z of [-1.36, 1.36]) { const w = k.box(1.0, 1.0, 0.04, 0x1a242c, -5.6 + i * 1.4, 2.6, z, tram, { metalness: 0.6, roughness: 0.05 }); }
      k.box(13.2, 0.25, 2.9, 0x6b3a1e, 0, 3.8, 0, tram);
      k.box(11, 0.5, 1.6, 0xece0c2, 0, 4.05, 0, tram);
      k.rod([0, 4.5, 0], [-2, 6.5, 0], 0.04, 0x222222, tram);
      k.sign('GLENELG', 2.4, 0.5, 6.52, 3.2, 0, tram, { bg: '#111', fg: '#ffd36b' }).rotation.y = Math.PI / 2;
      // kiosk on the square
      cottage(k, 14, 10, 0, { wall: 'render', color: 0xf2ead8, roof: 0xa23b2a, w: 8, d: 6, h: 3 }, g);
      k.label('Glenelg', 0, 9, 0, g);
    } },
    { name: 'River Torrens', x: -6, z: 50, flat: 30, build(k, g) {
      const THREE = k.THREE;
      k.box(80, 0.6, 9, k.surf('sandstone', { unit: 2 }), 0, -0.55, 0, g);
      const water = new THREE.Mesh(new THREE.PlaneGeometry(80, 7.6), new THREE.MeshPhysicalMaterial({ color: 0x2c6a6a, roughness: 0.05, clearcoat: 1, normalMap: k.surf('water', { unit: 4 }).normalMap.clone(), normalScale: new THREE.Vector2(0.5, 0.5) }));
      water.material.normalMap.repeat.set(20, 2); water.material.normalMap.wrapS = water.material.normalMap.wrapT = THREE.RepeatWrapping;
      water.rotation.x = -Math.PI / 2; water.position.y = 0.02; g.add(water);
      // a Popeye boat chugging up and down
      const boat = k.group(-8, 0.1, 0, 0, 1, g);
      k.extrude([[-2.4, 0], [2.0, 0], [2.6, 0.7], [-2.6, 0.7]], 1.8, 0xf2c230, boat, { roughness: 0.4 }, 0.08);
      k.box(3, 0.08, 1.9, 0xffffff, -0.3, 1.9, 0, boat);
      for (const [x, z] of [[-1.6, -0.85], [1.0, -0.85], [-1.6, 0.85], [1.0, 0.85]]) k.cyl(0.04, 0.04, 1.2, 0xffffff, x, 0.7, z, boat);
      k.sign('POPEYE', 1.6, 0.4, 0, 0.45, 0.97, boat, { bg: '#f2c230', fg: '#1d3d7a' });
      let t = 0;
      g.userData.update = (dt) => { t += dt; boat.position.x = Math.sin(t * 0.08) * 30; boat.rotation.y = Math.cos(t * 0.08) > 0 ? 0 : Math.PI; boat.position.y = 0.1 + Math.sin(t * 2) * 0.04; water.material.normalMap.offset.x += dt * 0.02; };
    } },
    { name: 'Big Rocking Horse', x: 58, z: 30, rot: -0.8, flat: 10, build(k, g) {
      const wood = k.surf('planks', { unit: 1.5, tint: 0xc08a5a });
      const horse = k.extrude(HORSE, 2.4, wood, g, {}, 0.2);
      horse.position.y = 2.4;
      // curved rockers: a slice of a big ring under each side
      const R = 16, arc = 0.66;
      for (const z of [-1.6, 1.6]) {
        const r = new k.THREE.Mesh(new k.THREE.TorusGeometry(R, 0.4, 8, 48, arc), wood);
        r.rotation.z = -Math.PI / 2 - arc / 2; r.position.set(0, R + 0.4, z); r.castShadow = true;
        g.add(r);
      }
      for (const [x, z] of [[-3.8, -1.6], [3.6, -1.6], [-3.8, 1.6], [3.6, 1.6]]) k.beam([x, 1.8, z], [x * 0.9, 2.6, z * 0.6], 0.5, wood, g);
      k.box(3.4, 0.4, 2.8, 0x5a1a1a, -0.4, 6.4, 0, g); // saddle
      k.label('Big Rocking Horse', 0, 14, 0, g);
    } },
  ],
  scatter(k, rng) {
    // the CBD skyline off to the west of the board (the sea is south, past Glenelg)
    for (let i = 0; i < 16; i++) {
      const a = -3.5 + rng() * 0.8, r = 105 + rng() * 40, x = Math.cos(a) * r, z = Math.sin(a) * r;
      tower(k, x, z, { w: 9 + rng() * 8, d: 9 + rng() * 8, h: 25 + rng() * 55, color: [0x6c8094, 0x8a8f96, 0x51606e, 0xa8a090][i % 4], rot: rng() * 0.4 });
    }
    // suburban villas: red brick, terracotta roofs
    let placed = 0;
    for (let tries = 0; tries < 400 && placed < 18; tries++) {
      const a = rng() * Math.PI * 2, r = 55 + rng() * 45, x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (z < -45 || !k.isClear(x, z, 7)) continue;
      cottage(k, x, z, -a - Math.PI / 2, { wall: rng() < 0.6 ? 'brick' : 'render', color: 0xf0e6d0, roof: rng() < 0.6 ? 0xa23b2a : 0x6f7a7f, trim: 0xf2efe6 });
      if (rng() < 0.4) car(k, x - Math.sin(a) * 6, z + Math.cos(a) * 6, -a, { color: [0xf0f0f0, 0x1c3f7a, 0x7a1414, 0x2c2c2c, 0xb8bcc0][Math.floor(rng() * 5)], style: rng() < 0.3 ? 'ute' : 'sedan' });
      placed++;
    }
    const b = k.batch;
    for (let i = 0; i < 80; i++) {
      const a = rng() * Math.PI * 2, r = 30 + rng() * 140, x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (z < -48 && z > -110 && Math.abs(x - 18) < 50) continue; // keep the beach clear
      if (z < -80 || !k.isClear(x, z, 4)) continue;
      b.add('gum' + (i % 3), () => gumTreeParts(i % 3 + 4, 1.25), x, k.heightAt(x, z) - 0.2, z, 0.8 + rng() * 0.5);
    }
    for (const x of [-34, -26, 32, 40, 48, 56]) b.add('pine', () => pineParts(k), x, 0, -68, 0.9 + rng() * 0.2);
    for (let i = 0; i < 60; i++) {
      const a = rng() * Math.PI * 2, r = 20 + rng() * 150, x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (z > -80 && k.isClear(x, z, 1)) b.add('rock' + (i % 2), () => rockParts(i % 2 + 5, surf('sandstone', { unit: 1.5, tint: 0xb8b0a0 })), x, k.heightAt(x, z) - 0.1, z, 0.3 + rng() * 0.7);
    }
  },
  events: [
    { text: 'FruChocs on the house!', coins: 4, mood: 'happy' },
    { text: 'Parking fine on North Tce.', coins: -5, mood: 'angry' },
    { text: 'Pie floater at the Pie Cart. Worth it.', hp: 10, mood: 'happy' },
    { text: 'Crows lost again.', coins: -3, mood: 'sad' },
    { text: 'Won the meat tray at the local!', coins: 7, mood: 'happy' },
    { text: 'Magpie swooped you on the Torrens.', hp: -15, mood: 'angry' },
  ],
};
