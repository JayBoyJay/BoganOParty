// Bottle-O Run: the bottle shop shuts in a minute and everyone's got a shopping list. Push your
// trolley round the shop, roll into the right bays to grab the four things on your list (your list
// is on the TV), then get to the checkout. First one through the checkout wins. Watch out for other
// shoppers, the mopped floor out the back and the can pyramid, which you will knock over.
import { addSky } from '../../host/sky.js';

const BAYS = [
  { id: 'beer', label: 'BEER', color: '#ffb800', x: -8.5, z: -7.6, face: 1 },
  { id: 'cider', label: 'CIDER', color: '#7ac83a', x: 0, z: -7.6, face: 1 },
  { id: 'ice', label: 'ICE', color: '#8ad8ff', x: 8.5, z: -7.6, face: 1 },
  { id: 'wine', label: 'WINE', color: '#a8203a', x: -7.4, z: -3, face: -2 },
  { id: 'goon', label: 'GOON', color: '#c88aff', x: -4.6, z: 0.3, face: 2 },
  { id: 'rum', label: 'RUM', color: '#c8641a', x: -1.4, z: -3, face: -2 },
  { id: 'chips', label: 'CHIPS', color: '#ff3a3a', x: 1.4, z: 0.3, face: 2 },
  { id: 'spirits', label: 'SPIRITS', color: '#3a8aff', x: 4.6, z: -3, face: -2 },
  { id: 'snacks', label: 'SNACKS', color: '#ffd23f', x: 7.4, z: 0.3, face: 2 },
];
const LIST = 4;
const ISLANDS = [-6, 0, 6], ISLAND_W = 1.4, ISLAND_Z = [-5, 2];
const ROOM = { x0: -12.3, x1: 12.3, z0: -8.3, z1: 6.6 };
const CHECKOUT = { x: 9.3, z: 3.7, r: 1.2 };
const BAY_R = 1.15;
const PYRAMID = { x: -2.6, z: 4.4, r: 0.7 }, WET = { x: 3.8, z: -6.4, r: 1.6 };
const ACC = 14, MAXV = 6, DASH = 6.5, DASH_CD = 2.4, R = 0.55;
const DOLL = 0.62;
const BTN = { DASH: 1 };

export default {
  id: 'bottle-o-run',
  name: 'Bottle-O Run',
  blurb: 'The bottle-o shuts in a minute. Trolley dash for the four things on your list, then hit the checkout.',
  howTo: "Your shopping list is on the TV. Steer your trolley with the stick and roll into the right coloured bays to grab each thing on your list. Once you've got all four, get to the checkout. First through wins. DASH gives you a burst of speed. Mind the other shoppers, the wet floor (slippery!) and the can pyramid.",
  padText: 'Steer with the stick, DASH!',
  duration: 60,
  pad: { kind: 'stick', buttons: [{ bit: BTN.DASH, label: '💨 DASH', tone: 'go' }] },

  create(mg) {
    const { THREE, kit, scene, players, rng, renderer, sfx } = mg;
    const n = players.length;

    // ----- the shop -----
    const { sun } = addSky(scene, renderer, { elevation: 70, azimuth: 20, turbidity: 3, sunIntensity: 1.6, sky: 0xf0f0ff, ground: 0x8a8a8a, hemi: 0.75, env: 0.6, shadowSize: 30, fog: [0xe8e8f0, 60, 160] });
    sun.target.position.set(0, 0, 0);
    const outside = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), kit.surf('asphalt', { unit: 4 })); outside.rotation.x = -Math.PI / 2; outside.position.y = -0.01; outside.receiveShadow = true; scene.add(outside);
    // chequered lino
    const floorC = document.createElement('canvas'); floorC.width = floorC.height = 128;
    { const g = floorC.getContext('2d'); for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { g.fillStyle = (x + y) % 2 ? '#d8d2c4' : '#efeadf'; g.fillRect(x * 64, y * 64, 64, 64); } }
    const floorT = new THREE.CanvasTexture(floorC); floorT.colorSpace = THREE.SRGBColorSpace; floorT.wrapS = floorT.wrapT = THREE.RepeatWrapping; floorT.repeat.set(13, 8); floorT.magFilter = THREE.NearestFilter;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(26, 16), new THREE.MeshStandardMaterial({ map: floorT, roughness: 0.4 })); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0.01, -0.85); floor.receiveShadow = true; scene.add(floor);
    // walls: low ones at the sides and back so the camera can see in
    const wallM = kit.surf('render', { arg: 0xe8e0d0, unit: 3 });
    kit.box(26.4, 3.2, 0.3, wallM, 0, 0, ROOM.z0 - 0.75);
    for (const s of [-1, 1]) kit.box(0.3, 1.2, 16, wallM, s * (ROOM.x1 + 0.55), 0, -0.85);
    // fridges along the back wall
    const fridgeGlass = kit.mat(0x9ad0e8, { transparent: true, opacity: 0.45, roughness: 0.1, metalness: 0.2 });
    for (let x = -11.5; x <= 11.5; x += 2.3) {
      const f = kit.group(x, 0, ROOM.z0 - 0.15);
      kit.box(2.2, 2.6, 0.9, 0xf0f0f0, 0, 0, -0.1, f);
      for (let s = 0; s < 4; s++) for (let k = 0; k < 6; k++) kit.box(0.24, 0.42, 0.24, [0xffb800, 0x2a6ad8, 0x3aa83a, 0xc8102e, 0xffffff][(s * 3 + k + (x * 7 | 0)) % 5], -0.85 + k * 0.34, 0.12 + s * 0.6, 0.1, f);
      kit.box(2.1, 2.4, 0.04, fridgeGlass, 0, 0.1, 0.38, f);
    }
    // the islands of shelves, stacked with bottles and cartons
    const bottleGeo = new THREE.CylinderGeometry(0.07, 0.08, 0.36, 8);
    const bottleMats = [0x3a6a2a, 0x6a2a1a, 0xc8a050, 0x2a2a2a, 0xa8c8a0, 0x8a1a2a].map((c) => kit.mat(c, { roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.9 }));
    for (const cx of ISLANDS) {
      const isl = kit.group(cx, 0, (ISLAND_Z[0] + ISLAND_Z[1]) / 2);
      const len = ISLAND_Z[1] - ISLAND_Z[0];
      kit.box(ISLAND_W, 1.6, len, kit.surf('planks', { unit: 1.2, tint: 0xb89068 }), 0, 0, 0, isl);
      for (const s of [-1, 1]) for (let shelf = 0; shelf < 3; shelf++) {
        const inst = new THREE.InstancedMesh(bottleGeo, bottleMats[(shelf + (s > 0 ? 3 : 0) + (cx + 6) / 6) % bottleMats.length], 26);
        for (let k = 0; k < 26; k++) { const m = new THREE.Matrix4().makeTranslation(s * (ISLAND_W / 2 + 0.06), 0.3 + shelf * 0.5, -len / 2 + 0.2 + k * (len - 0.4) / 25); inst.setMatrixAt(k, m); }
        isl.add(inst);
      }
    }
    // the bays: a coloured patch on the floor, a sign hanging over it
    for (const B of BAYS) {
      const pad = new THREE.Mesh(new THREE.CircleGeometry(BAY_R, 36), new THREE.MeshBasicMaterial({ color: new THREE.Color(B.color), transparent: true, opacity: 0.42 }));
      pad.rotation.x = -Math.PI / 2; pad.position.set(B.x, 0.03, B.z); scene.add(pad);
      const ring = new THREE.Mesh(new THREE.RingGeometry(BAY_R - 0.08, BAY_R, 36), new THREE.MeshBasicMaterial({ color: new THREE.Color(B.color) })); ring.rotation.x = -Math.PI / 2; ring.position.set(B.x, 0.035, B.z); scene.add(ring);
      const c = document.createElement('canvas'); c.width = 320; c.height = 110; const g = c.getContext('2d');
      g.fillStyle = B.color; g.beginPath(); g.roundRect(4, 4, 312, 102, 20); g.fill(); g.lineWidth = 6; g.strokeStyle = '#ffffff'; g.stroke();
      g.fillStyle = '#ffffff'; g.font = '900 68px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,0.45)'; g.strokeText(B.label, 160, 58, 290); g.fillText(B.label, 160, 58, 290);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t })); sp.scale.set(2.1, 0.72, 1);
      sp.position.set(B.x, 2.2, B.z + (B.face === 1 ? 0.4 : 0)); scene.add(sp);
      B.sprite = sp;
    }
    // the checkout, with the bloke behind it
    const counter = kit.group(11.1, 0, CHECKOUT.z);
    kit.box(1, 1.05, 3.4, 0x3a3a4a, 0, 0, 0, counter); kit.box(1.1, 0.06, 3.5, 0x8a8a9a, 0, 1.05, 0, counter); kit.box(0.4, 0.4, 0.5, 0x222222, 0, 1.1, -0.8, counter);
    kit.sign('CHECKOUT', 3, 0.7, -0.6, 2.7, 0, counter, { bg: '#1a1a1a', fg: '#5cff9d', font: '900 120px system-ui' });
    { const mat = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.1), new THREE.MeshBasicMaterial({ map: (() => { const c = document.createElement('canvas'); c.width = 512; c.height = 140; const g = c.getContext('2d'); g.fillStyle = '#c8102e'; g.fillRect(0, 0, 512, 140); g.fillStyle = '#fff'; g.font = '900 96px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('BOTTLE-O', 256, 74); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })() })); mat.rotation.x = -Math.PI / 2; mat.position.set(-3, 0.03, 6.1); scene.add(mat); }
    const till = new THREE.Mesh(new THREE.RingGeometry(CHECKOUT.r - 0.1, CHECKOUT.r, 40), new THREE.MeshBasicMaterial({ color: 0x5cff9d })); till.rotation.x = -Math.PI / 2; till.position.set(CHECKOUT.x, 0.04, CHECKOUT.z); scene.add(till);
    const tillPad = new THREE.Mesh(new THREE.CircleGeometry(CHECKOUT.r - 0.1, 40), new THREE.MeshBasicMaterial({ color: 0x5cff9d, transparent: true, opacity: 0.25 })); tillPad.rotation.x = -Math.PI / 2; tillPad.position.set(CHECKOUT.x, 0.035, CHECKOUT.z); scene.add(tillPad);
    const clerk = mg.makeDoll({ id: 'clerk', name: 'Clerk', color: '#c8102e', body: 'bloke', hair: 0x2a1a10 }, { scale: DOLL * 1.05, tag: false });
    clerk.group.position.set(11.95, 0, CHECKOUT.z + 0.4); clerk.group.rotation.y = -Math.PI / 2; scene.add(clerk.group);
    // the can pyramid
    const canGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.24, 12);
    const canMat = kit.mat(0xe8c020, { metalness: 0.7, roughness: 0.3 }), canMat2 = kit.mat(0x2a5ad8, { metalness: 0.7, roughness: 0.3 });
    const cans = [];
    for (let row = 0; row < 5; row++) for (let k = 0; k <= 4 - row; k++) for (let d = 0; d <= 4 - row; d++) {
      const m = new THREE.Mesh(canGeo, (row + k) % 2 ? canMat : canMat2); m.castShadow = true;
      const home = new THREE.Vector3(PYRAMID.x + (k - (4 - row) / 2) * 0.23, 0.12 + row * 0.24, PYRAMID.z + (d - (4 - row) / 2) * 0.23);
      m.position.copy(home); scene.add(m); cans.push({ m, home, v: new THREE.Vector3(), spin: new THREE.Vector3() });
    }
    let pyramidDown = 0;
    const knockPyramid = (vx, vz) => {
      pyramidDown = 9; sfx.play('clank'); sfx.play('bigboom');
      for (const c of cans) { c.v.set(vx * 0.4 + (rng() - 0.5) * 5, 2 + rng() * 4, vz * 0.4 + (rng() - 0.5) * 5); c.spin.set(rng() * 12, rng() * 12, rng() * 12); }
    };
    // the wet floor out the back, with its yellow sign
    const wet = new THREE.Mesh(new THREE.CircleGeometry(WET.r, 40), new THREE.MeshStandardMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.45, roughness: 0.02, metalness: 0.3 })); wet.rotation.x = -Math.PI / 2; wet.position.set(WET.x, 0.04, WET.z); scene.add(wet);
    { const s = kit.group(WET.x + WET.r - 0.2, 0, WET.z + 0.2, 0.4); for (const a of [-0.25, 0.25]) { const p = kit.box(0.5, 0.8, 0.03, 0xffd200, 0, 0, 0, s); p.rotation.x = a; p.position.z = a * 0.6; } }

    // ----- shoppers who are in no hurry at all -----
    const makeTrolley = (parent) => {
      const g = new THREE.Group(); parent.add(g);
      const wire = kit.mat(0xb8bcc4, { metalness: 0.8, roughness: 0.3 });
      const basket = kit.box(0.8, 0.5, 1.0, kit.mat(0xc8ccd4, { metalness: 0.7, roughness: 0.3, transparent: true, opacity: 0.55 }), 0, 0.45, 0.15, g); basket.castShadow = true;
      kit.box(0.82, 0.04, 1.02, wire, 0, 0.95, 0.15, g); kit.box(0.82, 0.04, 0.04, wire, 0, 1.1, -0.42, g);
      for (const s of [-1, 1]) { kit.box(0.04, 0.3, 0.04, wire, s * 0.38, 0.88, -0.4, g); for (const z of [-0.25, 0.55]) kit.cyl(0.07, 0.07, 0.06, 0x222222, s * 0.33, 0.04, z, g).rotation.z = Math.PI / 2; }
      kit.box(0.7, 0.03, 0.9, wire, 0, 0.15, 0.15, g);
      return g;
    };
    const npcs = [
      { path: [[-9.5, 4], [-9.5, -5.8], [-3, -5.8], [-3, 4]], speed: 1.2, who: { id: 'npc1', name: 'Nan', color: '#c8a0d8', body: 'smooth', hair: 0xdddddd } },
      { path: [[3, -5.8], [3, 4], [9.8, 3], [9.8, -5.8]], speed: 1.4, who: { id: 'npc2', name: 'Tradie', color: '#ff8a00', body: 'bloke', hair: 0x6a4a2a } },
    ].map((N) => {
      const grp = new THREE.Group(); scene.add(grp);
      const doll = mg.makeDoll(N.who, { scale: DOLL, tag: false }); doll.group.position.set(0, 0, -0.75); grp.add(doll.group);
      makeTrolley(grp);
      grp.position.set(N.path[0][0], 0, N.path[0][1]);
      return { ...N, grp, doll, leg: 1, x: N.path[0][0], z: N.path[0][1], h: 0, wait: 0 };
    });

    // ----- the players -----
    const pops = [];
    const pop = (x, y, z, text, color, size = 1, stay = 1) => {
      const c = document.createElement('canvas'); c.width = 768; c.height = 160;
      const g = c.getContext('2d'); g.font = '900 104px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 16; g.strokeStyle = '#1a1a1a'; g.strokeText(text, 384, 84, 750); g.fillStyle = color; g.fillText(text, 384, 84, 750);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); sp.scale.set(4.8 * size, 1 * size, 1); sp.renderOrder = 1000;
      sp.position.set(x, y, z); scene.add(sp); pops.push({ sp, life: 0, stay }); return sp;
    };
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = rng() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const itemGeo = new THREE.BoxGeometry(0.28, 0.32, 0.28);
    const shoppers = players.map((p, k) => {
      const grp = new THREE.Group(); scene.add(grp);
      const doll = mg.makeDoll(p, { scale: DOLL }); doll.group.position.set(0, 0, -0.75); grp.add(doll.group);
      const trolley = makeTrolley(grp);
      const x = -10.5 + (k % 2) * 1.6, z = 5.6 - (k >> 1) * 1.5;
      grp.position.set(x, 0, z); grp.rotation.y = Math.PI / 2;
      // their list card along the top of the screen
      const c = document.createElement('canvas'); c.width = 360; c.height = 250;
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const card = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); card.renderOrder = 900; card.scale.set(3.6, 2.5, 1);
      card.position.set(-9.6 + (k + 0.5) * (19.2 / n), 3.9, ROOM.z0 - 1.2); scene.add(card);
      return { p, k, grp, doll, trolley, x, z, vx: 0, vz: 0, h: Math.PI / 2, list: shuffle(BAYS.map((b) => b.id)).slice(0, LIST), got: [], done: null, place: 0, dashCd: 0, stun: 0, slip: 0, c, t, card,
        input: { x: 0, y: 0, held: 0 },
        bot: p.bot ? { skill: 0.5 + rng() * 0.25, dashIn: 2 + rng() * 3, wob: rng() * 6 } : null };
    });
    const drawCard = (S) => {
      const g = S.c.getContext('2d'); g.clearRect(0, 0, 360, 250);
      g.fillStyle = 'rgba(255,255,248,0.95)'; g.beginPath(); g.roundRect(4, 4, 352, 242, 18); g.fill(); g.lineWidth = 8; g.strokeStyle = S.p.color; g.stroke();
      g.fillStyle = '#1a1a1a'; g.font = '900 38px system-ui'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(S.done ? `${S.p.name}: #${S.place}` : S.p.name, 22, 36, 320);
      S.list.forEach((id, i) => {
        const B = BAYS.find((b) => b.id === id), have = S.got.includes(id), y = 84 + i * 42;
        g.fillStyle = B.color; g.beginPath(); g.roundRect(22, y - 15, 30, 30, 6); g.fill();
        g.fillStyle = have ? '#9a9a9a' : '#1a1a1a'; g.font = '800 32px system-ui'; g.fillText(B.label, 66, y + 1, 220);
        if (have) { g.strokeStyle = '#c8102e'; g.lineWidth = 4; g.beginPath(); g.moveTo(62, y + 2); g.lineTo(66 + g.measureText(B.label).width + 6, y + 2); g.stroke(); g.fillStyle = '#2a9a3a'; g.font = '900 34px system-ui'; g.fillText('✓', 310, y + 1); }
      });
      if (S.got.length === LIST && !S.done) { g.fillStyle = '#2a9a3a'; g.font = '900 24px system-ui'; g.fillText('CHECKOUT!', 220, 36); }
      S.t.needsUpdate = true;
    };
    shoppers.forEach(drawCard);
    let finishers = 0;
    const dash = (S) => {
      if (S.dashCd > 0 || S.stun > 0 || S.done) return;
      S.dashCd = DASH_CD; S.vx += Math.sin(S.h) * DASH; S.vz += Math.cos(S.h) * DASH; sfx.play('whoosh'); S.doll.bounce(1);
    };

    // ----- solid things -----
    const boxes = [
      ...ISLANDS.map((x) => ({ x0: x - ISLAND_W / 2, x1: x + ISLAND_W / 2, z0: ISLAND_Z[0], z1: ISLAND_Z[1] })),
      { x0: 10.6, x1: 11.6, z0: CHECKOUT.z - 1.7, z1: CHECKOUT.z + 1.7 },
    ];
    const collide = (o, r) => {
      if (o.x < ROOM.x0 + r) { o.x = ROOM.x0 + r; o.vx = Math.abs(o.vx) * 0.3; }
      if (o.x > ROOM.x1 - r) { o.x = ROOM.x1 - r; o.vx = -Math.abs(o.vx) * 0.3; }
      if (o.z < ROOM.z0 + r) { o.z = ROOM.z0 + r; o.vz = Math.abs(o.vz) * 0.3; }
      if (o.z > ROOM.z1 - r) { o.z = ROOM.z1 - r; o.vz = -Math.abs(o.vz) * 0.3; }
      let hit = 0;
      for (const b of boxes) {
        const cx = Math.max(b.x0, Math.min(b.x1, o.x)), cz = Math.max(b.z0, Math.min(b.z1, o.z));
        const dx = o.x - cx, dz = o.z - cz, d = Math.hypot(dx, dz);
        if (d < r) {
          if (d < 1e-4) { o.z = b.z1 + r; continue; }
          const nx = dx / d, nz = dz / d, vn = o.vx * nx + o.vz * nz;
          o.x = cx + nx * r; o.z = cz + nz * r;
          if (vn < 0) { hit = Math.max(hit, -vn); o.vx -= vn * nx * 1.3; o.vz -= vn * nz * 1.3; }
        }
      }
      return hit;
    };

    // ----- bots: straight at it if the way's clear, otherwise round by the front or back aisle -----
    const AISLES = [3.9, -6.4];
    const blocked = (ax, az, bx, bz) => {
      for (let s = 0; s <= 1; s += 0.05) { const x = ax + (bx - ax) * s, z = az + (bz - az) * s; for (const b of boxes) if (x > b.x0 - 0.6 && x < b.x1 + 0.6 && z > b.z0 - 0.6 && z < b.z1 + 0.6) return true; }
      return false;
    };
    const route = (S, tx, tz) => {
      if (!blocked(S.x, S.z, tx, tz)) return [tx, tz];
      const ai = Math.abs(S.z - AISLES[0]) + Math.abs(tz - AISLES[0]) < Math.abs(S.z - AISLES[1]) + Math.abs(tz - AISLES[1]) ? 0 : 1;
      const az = AISLES[ai];
      if (Math.abs(S.z - az) > 0.6 && !blocked(S.x, S.z, S.x, az)) return [S.x, az];
      // along the aisle to above the target
      if (!blocked(S.x, S.z, tx, az)) return [tx, az];
      // stuck behind something odd: nudge towards the aisle centre line
      return [S.x + (tx > S.x ? 1 : -1), az];
    };
    const botTarget = (S) => {
      if (S.got.length === LIST) return [CHECKOUT.x, CHECKOUT.z];
      let best = null, bd = 1e9;
      for (const id of S.list) { if (S.got.includes(id)) continue; const B = BAYS.find((b) => b.id === id); const d = Math.hypot(B.x - S.x, B.z - S.z) + (blocked(S.x, S.z, B.x, B.z) ? 6 : 0); if (d < bd) { bd = d; best = [B.x, B.z]; } }
      return best;
    };

    const camera = new THREE.PerspectiveCamera(44, 16 / 9, 0.3, 200);
    camera.position.set(0, 20.5, 13.5);
    camera.lookAt(0, 0, -1.2);

    let tAll = 0, finishAt = null;
    return {
      camera,
      update(dt, t, running) {
        tAll += dt;
        // ----- shoppers -----
        for (const S of shoppers) {
          let ix = 0, iz = 0;
          if (running && !S.done) {
            if (S.bot) {
              const tgt = botTarget(S);
              if (tgt) {
                const [wx, wz] = route(S, tgt[0], tgt[1]);
                const dx = wx - S.x, dz = wz - S.z, d = Math.hypot(dx, dz);
                if (d > 0.05) { const k = Math.min(1, d / 1.4) * S.bot.skill; ix = dx / d * k + Math.sin(tAll * 1.3 + S.bot.wob) * 0.12; iz = dz / d * k + Math.cos(tAll * 1.1 + S.bot.wob) * 0.12; }
                if ((S.bot.dashIn -= dt) <= 0) { if (d > 4 && !blocked(S.x, S.z, S.x + Math.sin(S.h) * 3, S.z + Math.cos(S.h) * 3)) dash(S); S.bot.dashIn = 1.5 + rng() * 3; }
              }
            } else { ix = S.input.x; iz = -S.input.y; }
          }
          if (S.stun > 0) { S.stun -= dt; ix = iz = 0; }
          S.dashCd = Math.max(0, S.dashCd - dt);
          const onWet = Math.hypot(S.x - WET.x, S.z - WET.z) < WET.r;
          const grip = onWet ? 0.12 : 1;
          const m = Math.min(1, Math.hypot(ix, iz));
          if (m > 0.05) { S.vx += ix / Math.hypot(ix, iz) * m * ACC * grip * dt; S.vz += iz / Math.hypot(ix, iz) * m * ACC * grip * dt; }
          const fr = Math.exp(-dt * (onWet ? 0.15 : m > 0.05 ? 1.6 : 4.5));
          S.vx *= fr; S.vz *= fr;
          const sp = Math.hypot(S.vx, S.vz), cap = MAXV + (S.dashCd > DASH_CD - 0.5 ? DASH : 0);
          if (sp > cap) { S.vx *= cap / sp; S.vz *= cap / sp; }
          S.x += S.vx * dt; S.z += S.vz * dt;
          const hit = collide(S, R);
          if (hit > 4 && S.stun <= 0) { S.stun = 0.35; sfx.play('clank'); S.doll.flinch(); }
          if (onWet && sp > 2.5 && S.slip <= 0 && !S.done) { S.slip = 1.4; sfx.play('squeak'); pop(S.x, 2.8, S.z, 'WHOA!', '#bfe0ff', 0.5, 0.5); }
          if (S.slip > 0) { S.slip -= dt; S.h += dt * 9 * Math.min(1, S.slip); }
          else if (sp > 0.4) { let dh = Math.atan2(S.vx, S.vz) - S.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); S.h += dh * Math.min(1, dt * 9); }
          // the can pyramid
          if (pyramidDown <= 0 && Math.hypot(S.x - PYRAMID.x, S.z - PYRAMID.z) < PYRAMID.r + R) {
            if (sp > 1.5) { knockPyramid(S.vx, S.vz); S.stun = 0.9; S.vx *= -0.3; S.vz *= -0.3; S.doll.flinch(); pop(PYRAMID.x, 3, PYRAMID.z, 'CLEAN UP AISLE 3!', '#ffd23f', 0.6, 1); }
            else { const dx = S.x - PYRAMID.x, dz = S.z - PYRAMID.z, d = Math.hypot(dx, dz) || 1; S.x = PYRAMID.x + dx / d * (PYRAMID.r + R); S.z = PYRAMID.z + dz / d * (PYRAMID.r + R); }
          }
          // bays and the checkout
          if (running && !S.done) {
            for (const id of S.list) {
              if (S.got.includes(id)) continue;
              const B = BAYS.find((b) => b.id === id);
              if (Math.hypot(S.x - B.x, S.z - B.z) < BAY_R) {
                S.got.push(id); sfx.play('coin'); drawCard(S); S.doll.bounce(1);
                const item = new THREE.Mesh(itemGeo, kit.mat(new THREE.Color(B.color), { roughness: 0.5 })); const i = S.got.length - 1;
                item.position.set(-0.18 + (i % 2) * 0.36, 0.42 + (i >> 1) * 0.3, 0 + (i % 3) * 0.2); item.castShadow = true; S.trolley.add(item);
                pop(B.x, 2.6, B.z, `+${B.label}`, B.color, 0.55, 0.6);
              }
            }
            if (S.got.length === LIST && Math.hypot(S.x - CHECKOUT.x, S.z - CHECKOUT.z) < CHECKOUT.r) {
              S.done = tAll; S.place = ++finishers; drawCard(S); sfx.play(S.place === 1 ? 'hallelujah' : 'cheers'); S.doll.bounce(1.5);
              pop(CHECKOUT.x, 3.2, CHECKOUT.z, S.place === 1 ? `${S.p.name} WINS!` : `#${S.place} ${S.p.name}`, S.place === 1 ? '#ffd23f' : '#ffffff', 0.7, 1.4);
              if (finishers === n) finishAt = tAll;
            }
          }
          if (S.done) { // park them by the till in a neat line
            const tx = 7.6 - (S.place - 1) * 1.3, tz = 6.0;
            S.x += (tx - S.x) * Math.min(1, dt * 2); S.z += (tz - S.z) * Math.min(1, dt * 2); S.h += (Math.PI - S.h) * Math.min(1, dt * 3); S.vx = S.vz = 0;
          }
        }
        // trolleys bump each other
        for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
          const A = shoppers[a], B = shoppers[b]; if (A.done || B.done) continue;
          const dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz);
          if (d < R * 2 && d > 1e-4) { const nx = dx / d, nz = dz / d, p = (R * 2 - d) / 2; A.x -= nx * p; A.z -= nz * p; B.x += nx * p; B.z += nz * p; const rv = (B.vx - A.vx) * nx + (B.vz - A.vz) * nz; if (rv < 0) { A.vx += rv * nx * 0.8; A.vz += rv * nz * 0.8; B.vx -= rv * nx * 0.8; B.vz -= rv * nz * 0.8; if (rv < -3) sfx.play('clank'); } }
        }
        // the slow shoppers
        for (const N of npcs) {
          const [tx, tz] = N.path[N.leg], dx = tx - N.x, dz = tz - N.z, d = Math.hypot(dx, dz);
          if (N.wait > 0) N.wait -= dt;
          else if (d < 0.1) { N.leg = (N.leg + 1) % N.path.length; N.wait = 0.8 + rng() * 1.5; }
          else { N.x += dx / d * N.speed * dt; N.z += dz / d * N.speed * dt; let dh = Math.atan2(dx, dz) - N.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); N.h += dh * Math.min(1, dt * 4); }
          N.grp.position.set(N.x, 0, N.z); N.grp.rotation.y = N.h; N.doll.update(dt);
          for (const S of shoppers) {
            if (S.done) continue;
            const ex = S.x - N.x, ez = S.z - N.z, e = Math.hypot(ex, ez);
            if (e < R * 2.1 && e > 1e-4) { const nx = ex / e, nz = ez / e; S.x = N.x + nx * R * 2.1; S.z = N.z + nz * R * 2.1; const vn = S.vx * nx + S.vz * nz; if (vn < 0) { S.vx -= vn * nx * 1.6; S.vz -= vn * nz * 1.6; if (vn < -3) { sfx.play('bonk'); S.stun = 0.4; S.doll.flinch(); if (rng() < 0.5) pop(N.x, 2.8, N.z, N.who.name === 'Nan' ? 'WATCH IT LOVE!' : 'OI!', '#ffffff', 0.55, 0.6); } } }
          }
        }
        for (const S of shoppers) {
          S.grp.position.set(S.x, 0, S.z); S.grp.rotation.y = S.h;
          S.doll.setArms(0.25, 0); S.doll.update(dt);
        }
        // the cans: fly, settle, and get stacked back up
        if (pyramidDown > 0) {
          pyramidDown -= dt;
          for (const c of cans) {
            if (pyramidDown > 1) { c.v.y -= 9.8 * dt; c.m.position.addScaledVector(c.v, dt); if (c.m.position.y < 0.11) { c.m.position.y = 0.11; c.v.y = Math.abs(c.v.y) * 0.3; c.v.x *= 0.8; c.v.z *= 0.8; c.spin.multiplyScalar(0.8); } c.m.rotation.x += c.spin.x * dt; c.m.rotation.z += c.spin.z * dt; }
            else { c.m.position.lerp(c.home, Math.min(1, dt * 6)); c.m.rotation.set(0, 0, 0); }
          }
        }
        clerk.update(dt);
        for (let i = pops.length - 1; i >= 0; i--) { const q = pops[i]; q.life += dt; q.sp.material.opacity = Math.max(0, Math.min(1, q.life * 5, q.stay - q.life + 1)); q.sp.position.y += dt * 0.5; if (q.life > q.stay + 1) { scene.remove(q.sp); pops.splice(i, 1); } }
      },
      input(p, m) {
        const S = shoppers.find((x) => x.p === p);
        if (!S || m.b !== 'stick') return;
        const held = Number(m.h) || 0, newly = held & ~S.input.held;
        S.input.x = Math.max(-1, Math.min(1, Number(m.x) || 0)); S.input.y = Math.max(-1, Math.min(1, Number(m.y) || 0)); S.input.held = held;
        if (newly & BTN.DASH) dash(S);
      },
      scores() { return Object.fromEntries(shoppers.map((S) => [S.p.id, S.done ? 100 - 10 * (S.place - 1) : S.got.length * 15])); },
      done: () => finishAt != null && tAll - finishAt > 2.5,
    };
  },
};
