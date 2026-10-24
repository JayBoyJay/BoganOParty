// Bottle-O Run: the bottle shop shuts in a minute and everyone's got a shopping list. Push your
// trolley round the shop, roll into the right bays to grab the four things on your list (your list
// is on the TV), then get to the checkout. First one through the checkout wins. Watch out for other
// shoppers, the mopped floor out the back and the can pyramid, which you will knock over.
import { addSky } from '../../host/sky.js';
import { makeDecor } from '../../host/decor.js';

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
  duration: 75,
  pad: { kind: 'stick', buttons: [{ bit: BTN.DASH, label: '💨 DASH', tone: 'go' }] },

  create(mg) {
    const { THREE, kit, scene, players, rng, renderer, sfx } = mg;
    const n = players.length;

    // ----- the shop -----
    const { sun } = addSky(scene, renderer, { elevation: 70, azimuth: 20, turbidity: 3, sunIntensity: 1.6, sky: 0xf0f0ff, ground: 0x8a8a8a, hemi: 0.75, env: 0.6, shadowSize: 30, fog: [0xe8e8f0, 60, 160] });
    sun.target.position.set(0, 0, 0);
    const outside = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), kit.surf('asphalt', { unit: 4 })); outside.rotation.x = -Math.PI / 2; outside.position.y = -0.01; outside.receiveShadow = true; scene.add(outside);
    // the car park out the front: a footpath, a kerb and painted bays
    kit.box(30, 0.08, 2.4, kit.surf('concrete', { unit: 1.5, tint: 0xc8c4bc }), 0, 0, ROOM.z1 + 1.6);
    for (let x = -14; x <= 14; x += 2.8) kit.box(0.1, 0.012, 4.2, 0xf2f2f2, x, 0, ROOM.z1 + 5.2);
    for (const x of [-11.2, -5.6, 2.8, 8.4]) { const car = kit.group(x + 1.4, 0, ROOM.z1 + 5.4); kit.box(1.7, 0.7, 3.8, [0xc8102e, 0xf2f2f2, 0x2a5ad8, 0x2a2a2a][(x / 2.8 + 8) % 4 | 0], 0, 0.25, 0, car); kit.box(1.5, 0.5, 2.0, 0x22303a, 0, 0.95, -0.2, car); }
    // chequered lino
    const floorC = document.createElement('canvas'); floorC.width = floorC.height = 128;
    { const g = floorC.getContext('2d'); for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { g.fillStyle = (x + y) % 2 ? '#d8d2c4' : '#efeadf'; g.fillRect(x * 64, y * 64, 64, 64); } }
    const floorT = new THREE.CanvasTexture(floorC); floorT.colorSpace = THREE.SRGBColorSpace; floorT.wrapS = floorT.wrapT = THREE.RepeatWrapping; floorT.repeat.set(13, 8); floorT.magFilter = THREE.NearestFilter;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(26, 16), new THREE.MeshStandardMaterial({ map: floorT, roughness: 0.4 })); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0.01, -0.85); floor.receiveShadow = true; scene.add(floor);
    // walls: a tall back wall of cool rooms, low side walls with a timber cap so the camera can see in
    const D = makeDecor(kit);
    const wallM = kit.surf('render', { arg: 0xe6dccb, unit: 3 });
    kit.box(26.4, 3.4, 0.3, wallM, 0, 0, ROOM.z0 - 0.95);
    kit.box(26.4, 0.5, 0.36, 0xc8102e, 0, 2.9, ROOM.z0 - 0.75); // the red Bottle-O band over the fridges
    for (const s of [-1, 1]) {
      kit.box(0.3, 1.2, 16, wallM, s * (ROOM.x1 + 0.55), 0, -0.85);
      kit.box(0.42, 0.08, 16.1, kit.surf('planks', { unit: 1.2, tint: 0x8a5a36 }), s * (ROOM.x1 + 0.55), 1.2, -0.85);
    }
    kit.box(26.4, 0.1, 0.32, 0x3a3a3a, 0, 0, ROOM.z0 - 0.8); // skirting

    // instanced stock: one draw for every bottle in the shop, one for the labels, one for the cans
    const stock = { bottle: [], label: [], can: [], carton: [] };
    const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1);
    const put = (list, x, y, z, color, ry = 0, sc = 1) => { Q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry); V.set(x, y, z); S.setScalar(sc); list.push([new THREE.Matrix4().compose(V, Q, S), new THREE.Color(color)]); };
    const GLASS = [0x2f5a24, 0x5a2a14, 0x6a4a18, 0x1c1c1c, 0x8aa888, 0x5a0f22, 0xd8d0b8];
    const LABELS = [0xf2e6c8, 0xe8c040, 0xffffff, 0xc8102e, 0x1a2a5a, 0x2a2a2a, 0xd88a2a];
    const CANS = [0x1e5a2a, 0xc8102e, 0x2a5ad8, 0xe8c020, 0xf2f2f2, 0x1a1a1a, 0xff7a1a];
    const pick = (a) => a[(rng() * a.length) | 0];
    // a run of one product across a shelf, so it reads as facings of the same thing, not confetti
    const facing = (x0, x1, y, z, kind, rot = 0) => {
      const glass = pick(GLASS), lab = pick(LABELS), can = pick(CANS), sc = kind === 'bottle' ? 0.85 + rng() * 0.3 : 1;
      const step = kind === 'bottle' ? 0.11 : kind === 'can' ? 0.085 : 0.3;
      for (let x = x0 + step / 2; x < x1 - step / 2 + 1e-3; x += step) {
        const [px, pz] = rot ? [z, x] : [x, z];
        if (kind === 'bottle') { put(stock.bottle, px, y, pz, glass, 0, sc); put(stock.label, px, y + 0.06 * sc, pz, lab, 0, sc); }
        else if (kind === 'can') { put(stock.can, px, y, pz, can); put(stock.can, px, y + 0.125, pz, can); }
        else put(stock.carton, px, y, pz, pick(CANS), rot ? Math.PI / 2 : 0);
      }
    };

    // the cool rooms along the back: steel frames, glass doors, lit shelves of cans and bottles
    {
      const frame = kit.mat(0x8a9098, { metalness: 0.85, roughness: 0.3 });
      const glass = new THREE.MeshPhysicalMaterial({ color: 0xdff2ff, transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0, clearcoat: 1 });
      const back = new THREE.MeshStandardMaterial({ color: 0xf4f8ff, emissive: 0xdff0ff, emissiveIntensity: 0.9, roughness: 0.6 });
      const z = ROOM.z0 - 0.35;
      const shell = kit.mat(0x2a2d32, { roughness: 0.6 });
      kit.box(25, 0.14, 0.9, shell, 0, 2.5, z - 0.25); kit.box(25, 0.14, 0.9, shell, 0, 0, z - 0.25); // a hollow cabinet: top and plinth
      for (const e of [-1, 1]) kit.box(0.12, 2.64, 0.9, shell, e * 12.56, 0, z - 0.25);
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(25, 2.3), back); glow.position.set(0, 1.25, z - 0.62); scene.add(glow);
      for (let x = -12.5; x <= 12.5 + 1e-3; x += 1.25) {
        kit.box(0.06, 2.5, 0.08, frame, x, 0.05, z + 0.18); // mullion
        if (x < 12.4) { kit.box(0.03, 0.5, 0.04, frame, x + 1.1, 1.0, z + 0.26); } // door handle
      }
      kit.box(25.1, 0.08, 0.1, frame, 0, 2.5, z + 0.18); kit.box(25.1, 0.12, 0.1, frame, 0, 0.0, z + 0.18);
      const doors = new THREE.Mesh(new THREE.PlaneGeometry(25, 2.4), glass); doors.position.set(0, 1.27, z + 0.2); scene.add(doors);
      for (let l = 0; l < 4; l++) {
        const y = 0.16 + l * 0.58;
        kit.box(25, 0.025, 0.55, kit.mat(0xc8ccd2, { metalness: 0.6, roughness: 0.4 }), 0, y - 0.025, z - 0.3);
        for (let x = -12.5; x < 12.4; x += 1.25) facing(x + 0.04, x + 1.21, y, z - 0.1, l % 2 ? 'bottle' : 'can');
      }
    }

    // the islands: gondola shelving both sides, carton stacks on the bottom shelf, slab end caps
    for (const cx of ISLANDS) {
      const len = ISLAND_Z[1] - ISLAND_Z[0], cz = (ISLAND_Z[0] + ISLAND_Z[1]) / 2;
      const isl = kit.group(cx, 0, cz);
      const steel = kit.mat(0xe4e6ea, { metalness: 0.3, roughness: 0.45 });
      D.bx(isl, 0.08, 1.75, len - 0.1, kit.mat(0xd8dade, { roughness: 0.7 }), 0, 0, 0, 0.01); // pegboard spine
      for (let k = 0; k <= 4; k++) D.bx(isl, 0.1, 1.85, 0.06, steel, 0, 0, -len / 2 + 0.05 + k * (len - 0.1) / 4, 0.01); // uprights
      for (const s of [-1, 1]) {
        D.bx(isl, 0.62, 0.14, len - 0.1, kit.mat(0x2a2c30), s * 0.36, 0, 0, 0.01); // kick plate
        for (let l = 0; l < 4; l++) {
          const y = 0.14 + l * 0.42;
          D.bx(isl, 0.6, 0.03, len - 0.12, steel, s * 0.38, y, 0, 0.005);
          D.bx(isl, 0.012, 0.05, len - 0.12, kit.mat(0xf4d43a), s * 0.685, y - 0.02, 0, 0.003); // price strip
          const yy = y + 0.03;
          for (let seg = 0; seg < 4; seg++) {
            const z0 = cz - len / 2 + 0.1 + seg * (len - 0.2) / 4, z1 = z0 + (len - 0.2) / 4 - 0.04;
            if (l === 0) facing(z0, z1, yy, cx + s * 0.38, 'carton', 1);
            else for (const dd of [0.2, 0.42]) facing(z0, z1, yy, cx + s * dd, l === 3 ? 'can' : 'bottle', 1);
          }
        }
      }
      D.bx(isl, 1.38, 0.05, len - 0.04, steel, 0, 1.82, 0, 0.01); // top shelf, stacked with spare cartons
      for (let seg = 0; seg < 6; seg++) facing(cz - len / 2 + 0.15 + seg * (len - 0.3) / 6, cz - len / 2 + 0.15 + (seg + 1) * (len - 0.3) / 6 - 0.05, 1.87, cx + (seg % 2 ? 0.3 : -0.3), 'carton', 1);
      isl.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      // end caps: a stack of slabs at each end
      for (const e of [-1, 1]) for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) {
        const sl = D.slab({ color: [0x1e5a2a, 0xc8102e, 0x1a2a5a][(ISLANDS.indexOf(cx) + r) % 3], label: ['VB', 'XXXX', 'BUNDY', 'CARLTON'][(r + c) % 4] });
        sl.position.set(cx + (c - 0.5) * 0.62, r * 0.26, cz + e * (len / 2 + 0.24)); sl.rotation.y = Math.PI / 2; scene.add(sl);
      }
    }

    // turn the stock lists into instanced meshes
    {
      const bottleGeo = new THREE.LatheGeometry([[0, 0], [0.042, 0], [0.044, 0.012], [0.044, 0.19], [0.032, 0.24], [0.017, 0.28], [0.017, 0.33], [0.02, 0.34], [0, 0.34]].map(([x, y]) => new THREE.Vector2(x, y)), 12);
      const labelGeo = new THREE.CylinderGeometry(0.0455, 0.0455, 0.08, 12); labelGeo.translate(0, 0.04, 0);
      const canGeo = new THREE.CylinderGeometry(0.033, 0.033, 0.122, 12); canGeo.translate(0, 0.061, 0);
      const cartonGeo = new THREE.BoxGeometry(0.28, 0.24, 0.36); cartonGeo.translate(0, 0.12, 0);
      const mats = {
        bottle: new THREE.MeshPhysicalMaterial({ roughness: 0.08, clearcoat: 1, metalness: 0.05 }),
        label: new THREE.MeshStandardMaterial({ roughness: 0.75 }),
        can: new THREE.MeshStandardMaterial({ metalness: 0.75, roughness: 0.28 }),
        carton: new THREE.MeshStandardMaterial({ roughness: 0.8 }),
      };
      for (const [k, geo] of [['bottle', bottleGeo], ['label', labelGeo], ['can', canGeo], ['carton', cartonGeo]]) {
        const list = stock[k]; if (!list.length) continue;
        const im = new THREE.InstancedMesh(geo, mats[k], list.length);
        list.forEach(([m, c], i) => { im.setMatrixAt(i, m); im.setColorAt(i, c); });
        im.castShadow = k === 'carton'; im.receiveShadow = true; scene.add(im);
      }
    }

    // promo bits: a SPECIALS board on the back band, posters on the side walls
    kit.sign('BOTTLE-O  ·  COLD BEER  ·  SPECIALS  ·  OPEN TILL 10', 20, 0.42, 0, 3.15, ROOM.z0 - 0.56, scene, { bg: null, fg: '#ffffff', font: '900 120px system-ui' });
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
    D.bx(counter, 1, 1.0, 3.4, kit.surf('planks', { unit: 1, tint: 0x6a4028 }), 0, 0, 0, 0.03); // timber-front counter
    D.bx(counter, 1.14, 0.06, 3.54, kit.mat(0x2a2c30, { roughness: 0.3 }), 0, 1.0, 0, 0.02);
    D.bx(counter, 0.5, 0.03, 1.4, kit.mat(0x111111, { roughness: 0.9 }), -0.1, 1.06, 0.7, 0.01); // the belt
    { const reg = D.crt({ rot: -Math.PI / 2 }); reg.scale.setScalar(0.7); reg.position.set(0.15, 1.06, -0.6); counter.add(reg); }
    D.bx(counter, 0.42, 0.06, 0.3, kit.mat(0x2a2a2a), -0.05, 1.06, -0.15, 0.01); // card reader
    // scratchies and the smokes cabinet behind
    { const t = D.canvasTex(256, 128, (g) => { const cs = ['#ffd23f', '#5cff9d', '#ff4f8b', '#3da5ff']; for (let i = 0; i < 8; i++) { g.fillStyle = cs[i % 4]; g.fillRect((i % 4) * 64 + 3, (i >> 2) * 64 + 3, 58, 58); g.fillStyle = '#1a1a1a'; g.font = '900 16px system-ui'; g.fillText('$' + [2, 5, 10, 3][i % 4], (i % 4) * 64 + 14, (i >> 2) * 64 + 36); } });
      D.panel(counter, 0.9, 0.45, t, -0.51, 0.75, 0.6, { ry: -Math.PI / 2 }); }
    { const cab = kit.group(12.25, 0, CHECKOUT.z); D.bx(cab, 0.4, 2.2, 3.2, kit.mat(0x1a1a1c), 0, 0, 0, 0.02);
      const t = D.canvasTex(256, 192, (g) => { g.fillStyle = '#0d0d0f'; g.fillRect(0, 0, 256, 192); for (let r = 0; r < 6; r++) for (let c = 0; c < 10; c++) { g.fillStyle = ['#c8c8c8', '#6a6a6a', '#2a5a8a', '#8a2a2a'][(r + c) % 4]; g.fillRect(6 + c * 25, 6 + r * 31, 21, 26); } });
      D.panel(cab, 3.1, 1.4, t, -0.21, 1.4, 0, { ry: -Math.PI / 2, glow: 0.25 }); }
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
