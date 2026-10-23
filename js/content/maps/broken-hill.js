// Broken Hill, NSW: the Silver City. Red dirt, the Line of Lode slag heap through the middle of town,
// the Miners Memorial on top, pubs with deep verandahs, and a detour out to Silverton.
export default {
  id: 'broken-hill',
  name: 'Broken Hill',
  blurb: 'Silver City. Red dirt, slag heaps and a pub on every corner.',
  item: {
    id: 'lead', name: 'Lump of Lead', plural: 'Lumps of Lead', emoji: '🪨', price: 20,
    build(k) {
      const g = new k.THREE.Group();
      const geo = new k.THREE.IcosahedronGeometry(0.9, 1);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { const s = 0.75 + ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1 * 0.45; p.setXYZ(i, p.getX(i) * s, p.getY(i) * s * 0.8, p.getZ(i) * s); }
      geo.computeVertexNormals();
      g.add(new k.THREE.Mesh(geo, k.mat(0x7d8590, { metalness: 0.9, roughness: 0.35, flatShading: true })));
      return g;
    },
  },
  look: { sky: 0xf0a05a, fog: 0xe8a070, ground: 0xb5512b, path: 0xe6c79c, sun: 0xfff1d6 },
  board: {
    loop: {
      points: [[0, 30], [-24, 26], [-38, 8], [-34, -16], [-14, -30], [10, -30], [30, -20], [38, 0], [30, 20], [14, 30]],
      name: 'Argent St', count: 40,
      pattern: 'BBRBEBBRBBEBRB',
    },
    shops: [7, 27],
    branches: [
      // straight through the mine: short, nasty
      { name: 'Through the mine', sub: 'Short cut, lots of red', from: 4, to: 14, points: [[-10, 4], [-6, -8]], count: 5, pattern: 'RERRB' },
      // out to Silverton: long way round, lots of events
      { name: 'Out to Silverton', sub: 'The long way, lots of events', from: 22, to: 30, points: [[28, -46], [54, -40], [60, -14]], count: 9, pattern: 'BEBEBEBEB', shops: [4] },
    ],
  },
  landmarks: [
    { name: 'Line of Lode', x: 14, z: 4, scale: 1, build(k, g) {
      // the slag heap, with the Miners Memorial perched on top
      k.cone(11, 9, 0x5a3324, 0, 0, 0, g, {}, 9);
      k.cone(7, 6, 0x6c3d2a, 5, 0, 5, g, {}, 8);
      k.box(8, 3, 3, 0x8c4a2f, 0, 9, 0, g, { roughness: 0.6, metalness: 0.4 });
      k.box(2, 3.2, 3.2, 0x2b2b2b, 2.6, 9, 0, g);
      k.label('Miners Memorial', 0, 15, 0, g);
    } },
    { name: 'Headframe', x: -1, z: -15, scale: 1, build(k, g) {
      // poppet head over the shaft: a steel lattice tower with the winding wheel on top
      const H = 16, c = 0x3d4a52;
      for (const [x, z] of [[-2, -2], [2, -2], [-1, 2], [1, 2]]) k.beam([x, 0, z], [x * 0.4, H, z * 0.4], 0.35, c, g);
      for (let y = 3; y < H; y += 3) { const s = 1 - y / H * 0.6; k.box(4.2 * s, 0.25, 0.25, c, 0, y, -2 * s, g); k.box(2.2 * s, 0.25, 0.25, c, 0, y, 2 * s, g); }
      k.beam([0, 0, 6], [0, H * 0.85, 0.6], 0.5, c, g);
      const wheel = k.torus(2, 0.2, 0x1e2428, 0, H + 1.2, 0, g, { metalness: 0.7 });
      wheel.rotation.y = Math.PI / 2;
      g.userData.spin = wheel;
    } },
    { name: 'Palace Hotel', x: -46, z: 22, rot: 0.9, scale: 1, build(k, g) {
      k.box(18, 10, 10, 0xd7b98a, 0, 0, 0, g);
      k.box(19, 0.5, 3, 0x8a6a3c, 0, 4.6, 6, g);
      k.box(19, 0.5, 3, 0x8a6a3c, 0, 9.4, 6, g);
      for (let x = -9; x <= 9; x += 3) { k.cyl(0.15, 0.15, 9.6, 0xf2efe6, x, 0, 7.3, g); }
      for (let x = -7.5; x <= 7.5; x += 3) k.box(1.4, 2.4, 0.2, 0x3a2a1a, x, 1, 5.05, g);
      k.sign('PALACE HOTEL', 12, 2, 0, 11.5, 5.2, g, { bg: '#5b1f1a', fg: '#f4e2b0' });
    } },
    { name: 'Silverton & the Interceptor', x: 74, z: -32, rot: -1.2, scale: 1, build(k, g) {
      k.box(12, 6, 8, 0xc69a6a, 0, 0, 0, g);
      k.box(13, 0.4, 3, 0x6b5136, 0, 3.6, 5, g);
      k.sign('SILVERTON HOTEL', 10, 1.6, 0, 6.8, 4.1, g, { bg: '#2f2a24', fg: '#e8d7b0' });
      // a black V8 pursuit special parked out front
      const car = k.group(0, 0, 10, 0.3, 1, g);
      k.box(5, 1.1, 2.2, 0x111111, 0, 0.5, 0, car, { metalness: 0.6, roughness: 0.3 });
      k.box(2.4, 0.8, 2, 0x111111, -0.4, 1.6, 0, car, { metalness: 0.6, roughness: 0.3 });
      k.box(0.8, 0.6, 0.8, 0x777777, 0.8, 1.6, 0, car, { metalness: 0.9 });
      for (const [x, z] of [[-1.7, -1.1], [1.7, -1.1], [-1.7, 1.1], [1.7, 1.1]]) { const w = k.cyl(0.5, 0.5, 0.4, 0x0a0a0a, x, 0.3, z, car); w.rotation.x = Math.PI / 2; w.position.y = 0.5; }
    } },
    { name: 'Living Desert Sculptures', x: 44, z: 40, scale: 1, build(k, g) {
      k.cone(10, 3, 0xa04a26, 0, 0, 0, g, {}, 10);
      [[-4, 0, 3.5], [0, -3, 4.5], [4, 1, 3.8], [1, 4, 5]].forEach(([x, z, h], i) => { const s = k.box(1.2, h, 0.9, 0xd9c7a8, x, 2.4, z, g); s.rotation.y = i; });
      k.label('Living Desert', 0, 10, 0, g);
    } },
    { name: 'Big Picture gallery', x: -54, z: -20, rot: 1.6, scale: 1, build(k, g) {
      k.box(14, 7, 9, 0xe8e0d0, 0, 0, 0, g);
      k.sign('BIG PICTURE', 10, 1.8, 0, 8, 4.6, g, { bg: '#1f3b5b', fg: '#fff' });
    } },
  ],
  // what to sprinkle around the outback
  scatter(k, rng) {
    k.scatter(70, 48, 95, (x, z, r) => k.ball(0.8 + r() * 0.9, 0x7c8a5a, x, 0.5, z), rng); // saltbush
    k.scatter(40, 45, 95, (x, z, r) => k.box(1 + r() * 2, 0.6 + r(), 1 + r() * 2, 0x8c3e1f, x, 0, z), rng); // rocks
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
