// Adelaide, SA: the City of Churches (and the Crazy Horse). Adelaide Oval, the Malls Balls on
// Rundle Mall, the Torrens with Popeye boats, and a tram detour down to Glenelg.
export default {
  id: 'adelaide',
  name: 'Adelaide',
  blurb: 'City of Churches. Malls Balls, the Oval, and a ticket to the Crazy Horse.',
  item: {
    id: 'ticket', name: 'Crazy Horse Ticket', plural: 'Crazy Horse Tickets', emoji: '🎟️', price: 20,
    build(k) {
      const g = new k.THREE.Group();
      const tex = k.textTexture('CRAZY HORSE\nADMIT ONE', { w: 512, h: 256, bg: '#ffcc33', fg: '#c2185b', font: '900 64px system-ui, sans-serif' });
      const m = new k.THREE.Mesh(new k.THREE.BoxGeometry(2.2, 1.1, 0.06), [k.mat(0xe0a800), k.mat(0xe0a800), k.mat(0xe0a800), k.mat(0xe0a800),
        new k.THREE.MeshStandardMaterial({ map: tex, metalness: 0.3, roughness: 0.4 }), new k.THREE.MeshStandardMaterial({ map: tex, metalness: 0.3, roughness: 0.4 })]);
      g.add(m);
      return g;
    },
  },
  look: { sky: 0x8fc8ff, fog: 0xbfe0ff, ground: 0x5f9a3c, path: 0xd9d3c4, sun: 0xffffff },
  board: {
    loop: {
      points: [[0, 32], [-26, 28], [-40, 10], [-38, -14], [-18, -32], [8, -32], [32, -22], [40, 2], [30, 24], [14, 32]],
      name: 'North Terrace', count: 42,
      pattern: 'BBRBBEBRBEBB',
    },
    shops: [8, 30],
    branches: [
      // straight down Rundle Mall: short, full of shops and events
      { name: 'Down Rundle Mall', sub: 'Short cut with a shop', from: 3, to: 13, points: [[-8, 10], [-12, -10]], count: 5, pattern: 'EBEBE', shops: [2] },
      // tram to Glenelg and back: the long way, mostly blue
      { name: 'Tram to Glenelg', sub: 'The long way, mostly blue', from: 16, to: 24, points: [[-10, -52], [24, -54], [48, -36]], count: 9, pattern: 'BBEBBBEBB' },
    ],
  },
  landmarks: [
    { name: 'Adelaide Oval', x: 16, z: 6, scale: 1, build(k, g) {
      k.cyl(12, 12, 0.2, 0x3f8f2e, 0, 0, 0, g, {}, 40);
      // stands: a ring of segments with white sail roofs
      for (let i = 0; i < 16; i++) {
        const a = i / 16 * Math.PI * 2;
        const s = k.group(Math.cos(a) * 13.5, 0, Math.sin(a) * 13.5, -a + Math.PI / 2, 1, g);
        k.box(5.4, 4 + (i % 4 === 0 ? 3 : 0), 3, 0x9aa3ad, 0, 0, 0, s);
        const roof = k.box(5.8, 0.25, 4.5, 0xf7f7f7, 0, 6.5 + (i % 4 === 0 ? 3 : 0), -0.8, s);
        roof.rotation.x = -0.25;
      }
      k.box(5, 3, 0.6, 0x1c3d24, 0, 7, -14.5, g);
      k.sign('SCOREBOARD', 4.6, 1.2, 0, 9.1, -14.15, g, { bg: '#1c3d24', fg: '#fff' });
      k.label('Adelaide Oval', 0, 14, 0, g);
    } },
    { name: 'Malls Balls', x: -20, z: 2, scale: 1, build(k, g) {
      k.cyl(2.4, 2.6, 0.6, 0x9a9a9a, 0, 0, 0, g);
      k.ball(1.9, 0xd8dde3, 0, 2.5, 0, g, { metalness: 1, roughness: 0.12 });
      k.ball(1.9, 0xd8dde3, 0, 6.3, 0, g, { metalness: 1, roughness: 0.12 });
      k.label('Rundle Mall', 0, 10, 0, g);
    } },
    { name: 'Crazy Horse', x: -54, z: 16, rot: 1.3, scale: 1, build(k, g) {
      k.box(14, 8, 9, 0x1b1024, 0, 0, 0, g);
      k.sign('CRAZY HORSE', 12, 2.6, 0, 9.6, 4.6, g, { bg: '#1b1024', fg: '#ff3fa4', glow: '#ff3fa4', font: '900 80px system-ui, sans-serif' });
      k.box(2.2, 3.6, 0.2, 0xff3fa4, 0, 0, 4.55, g, { emissive: 0xff3fa4, emissiveIntensity: 0.6 });
      k.label('Hindley St', 0, 14, 0, g);
    } },
    { name: 'Glenelg Jetty', x: 18, z: -66, scale: 1, build(k, g) {
      k.box(60, 0.3, 30, 0xe9d8a6, 0, -0.1, 4, g); // beach
      k.box(80, 0.2, 30, 0x2f86c9, 0, -0.15, -22, g, { roughness: 0.2, metalness: 0.2 }); // gulf
      k.box(2.4, 0.4, 26, 0x8a6d4a, 0, 1.2, -18, g);
      for (let z = -30; z < -6; z += 3) { k.cyl(0.18, 0.18, 1.4, 0x5a4630, -1, 0, z, g); k.cyl(0.18, 0.18, 1.4, 0x5a4630, 1, 0, z, g); }
      // the tram at Moseley Square
      const tram = k.group(-16, 0, 6, 0, 1, g);
      k.box(9, 2.6, 2.6, 0x3b3f8c, 0, 0.6, 0, tram);
      k.box(9.2, 0.6, 2.8, 0xe8e8e8, 0, 2.7, 0, tram);
      k.label('Glenelg', 0, 7, 0, g);
    } },
    { name: 'River Torrens', x: 0, z: 46, scale: 1, build(k, g) {
      k.box(90, 0.1, 6, 0x3f7fb8, 0, 0.02, 0, g, { roughness: 0.15 });
      const boat = k.group(-8, 0.2, 0, 0, 1, g);
      k.box(4, 0.8, 1.6, 0xf2c230, 0, 0, 0, boat);
      k.box(2.2, 1.2, 1.4, 0xffffff, -0.4, 0.8, 0, boat);
      g.userData.bob = boat;
    } },
    { name: 'Big Rocking Horse', x: 56, z: 30, rot: -0.8, scale: 1, build(k, g) {
      const rocker = k.box(14, 0.6, 1.2, 0x8b5a2b, 0, 0, 0, g);
      rocker.rotation.z = 0.05;
      k.box(9, 4, 3, 0x9c6a3a, 0, 5, 0, g);
      k.box(2.2, 4, 2.2, 0x9c6a3a, 4.6, 8, 0, g);
      k.box(4, 2, 2, 0x9c6a3a, 6.4, 10.5, 0, g);
      for (const x of [-3.5, 3.5]) for (const z of [-1, 1]) k.beam([x * 1.2, 0.6, z], [x, 5, z], 0.8, 0x9c6a3a, g);
      k.label('Big Rocking Horse', 0, 15, 0, g);
    } },
    { name: 'Mount Lofty', x: 125, z: 10, scale: 1, build(k, g) {
      k.cone(50, 26, 0x3f6b2c, 0, 0, 0, g, {}, 12);
      k.cone(40, 20, 0x4f7a34, 50, 0, 10, g, {}, 12);
      k.cone(36, 18, 0x4a7530, -50, 0, 12, g, {}, 12);
    } },
  ],
  scatter(k, rng) {
    k.scatter(60, 50, 95, (x, z, r) => {
      if (z < -40) return; // keep the beach clear
      k.cyl(0.25, 0.35, 3, 0x6b4a2e, x, 0, z);
      k.ball(1.6 + r(), 0x3d7a2f, x, 3.8, z);
    }, rng); // gum trees
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
