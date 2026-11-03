// Ute Tetris (id kept as esky-tetris so old saves and links still work): everyone's packing the back of
// their ute for a camping trip, with the same pile of gear coming in the same order: bags of ice, jerry
// cans, slabs, firewood, a swag, the esky, the spare, a camp chair, the wheelbarrow, the barbie and Nan's
// old couch. Move it, spin it, drop it. Nothing comes back out, and anything sticking up past the top
// of the headboard means you can't strap the load down and you're done packing. Most things on the
// back with the straps on wins.
import { addSky } from '../../host/sky.js';

const COLS = 10, ROWS = 6, CELL = 0.3;
const D = 0.8; // how deep the gear is, front to back of the tray
const FALL0 = 0.9, FALL1 = 0.45; // seconds per row, at the start and at the end
const REPEAT0 = 0.28, REPEAT = 0.11; // holding the stick over: first auto-shuffle, then every this often
const BTN = { SPIN: 1, DROP: 2 };
// cells are [x, y] with y up, as the gear sits the right way up
const ITEMS = [
  { id: 'ice', cells: [[0, 0]], w: 2.5 },
  { id: 'jerry', cells: [[0, 0], [0, 1]], w: 2.5 },
  { id: 'slab', cells: [[0, 0], [1, 0]], w: 3 },
  { id: 'firewood', cells: [[0, 0], [1, 0], [2, 0]], w: 2 },
  { id: 'swag', cells: [[0, 0], [1, 0], [2, 0], [3, 0]], w: 1.5 },
  { id: 'esky', cells: [[0, 0], [1, 0], [0, 1], [1, 1]], w: 2 },
  { id: 'tyre', cells: [[0, 0], [1, 0], [0, 1], [1, 1]], w: 1.2 },
  { id: 'chair', cells: [[0, 0], [1, 0], [0, 1]], w: 2 },
  { id: 'barrow', cells: [[0, 0], [0, 1], [1, 1], [2, 1]], w: 1.2 },
  { id: 'bbq', cells: [[1, 0], [0, 1], [1, 1], [2, 1]], w: 1.2 },
  { id: 'couch', cells: [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1]], w: 0.8 },
];

const rotateCells = (cells, r) => {
  let c = cells.map(([x, y]) => [x, y]);
  for (let i = 0; i < r; i++) c = c.map(([x, y]) => [y, -x]);
  const mx = Math.min(...c.map((p) => p[0])), my = Math.min(...c.map((p) => p[1]));
  return c.map(([x, y]) => [x - mx, y - my]);
};

export default {
  id: 'esky-tetris',
  name: 'Ute Tetris',
  blurb: "Same gear for everyone, one ute each. Get the most on the back and still strap it down.",
  howTo: "You're packing the back of the ute for a camping trip. Everyone gets the same gear in the same order. Push the stick left and right to move it (hold it over to keep going), SPIN to turn it, DROP to drop it straight down. Nothing comes back off. If anything sticks up past the top of the headboard you can't strap the load down and you're done. Most things on the back wins.",
  padText: 'Stick to move, SPIN, DROP',
  duration: 75,
  pad: { kind: 'stick', buttons: [{ bit: BTN.SPIN, label: '🔄 SPIN', tone: 'go' }, { bit: BTN.DROP, label: '⬇ DROP' }] },

  create(mg) {
    const { THREE, kit, scene, players, rng, renderer, sfx } = mg;
    const n = players.length;
    const U = CELL;
    const EW = COLS * U, EH = ROWS * U, T = 0.08; // tray inside width and load height, side thickness
    const OY = 1.0; // tray floor above the ground
    const ZF = D / 2 + 0.06, ZB = -D / 2 - 0.08; // tailgate and headboard
    const rows = n > 3 ? 2 : 1, perRow = Math.ceil(n / rows);
    const PITCH = EW + 1.15, DECK = 4.2, DECKZ = -3.6; // the back row parks up on the car park's top deck

    // ----- Friday arvo before the long weekend -----
    const { sun } = addSky(scene, renderer, { elevation: 42, azimuth: 25, turbidity: 3, sunIntensity: 2.5, sky: 0xd8e8ff, ground: 0x6b6a52, hemi: 0.5, env: 0.5, shadowSize: 24, fog: [0xd8e2ea, 45, 140] });
    sun.target.position.set(0, 1, -1);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 50), kit.surf('concrete', { unit: 3, tint: 0xd0c8b8 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    if (rows === 1) {
      kit.box(44, 3.4, 0.3, kit.surf('brick', { unit: 2.4, tint: 0xd8a888 }), 0, 0, -5.2);
      kit.box(10, 2.7, 0.1, kit.surf('corrugated', { unit: 0.6, tint: 0xe8e4dc, metalness: 0.4 }), 0, 0, -5.0); // roller door
      kit.sign('ROAD TRIP!', 5, 0.7, 0, 3.0, -5.0, undefined, { bg: '#1e5aa8', fg: '#ffffff' });
    } else {
      // a two-level car park: concrete deck on columns, yellow and black edge
      const conc = kit.surf('concrete', { unit: 2.5, tint: 0xc4c0b6 });
      const deckW = perRow * PITCH + 10;
      kit.box(deckW, 0.4, 12, conc, 0, DECK - 0.4, DECKZ - 4.4);
      const stripeC = document.createElement('canvas'); stripeC.width = 256; stripeC.height = 32;
      { const sg = stripeC.getContext('2d'); sg.fillStyle = '#f2c21a'; sg.fillRect(0, 0, 256, 32); sg.fillStyle = '#1a1a1a'; for (let i = -1; i < 10; i++) { sg.beginPath(); sg.moveTo(i * 32, 32); sg.lineTo(i * 32 + 16, 32); sg.lineTo(i * 32 + 32, 0); sg.lineTo(i * 32 + 16, 0); sg.fill(); } }
      const stripeT = new THREE.CanvasTexture(stripeC); stripeT.colorSpace = THREE.SRGBColorSpace; stripeT.wrapS = THREE.RepeatWrapping; stripeT.repeat.set(deckW / 2, 1);
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(deckW, 0.4), new THREE.MeshStandardMaterial({ map: stripeT, roughness: 0.7 })); stripe.position.set(0, DECK - 0.2, DECKZ + 1.6 + 0.005); scene.add(stripe);
      kit.box(deckW, 3.6, 0.3, kit.surf('brick', { unit: 2.4, tint: 0xd8a888 }), 0, DECK, DECKZ - 4.0);
      kit.sign('ROAD TRIP!', 5, 0.7, 0, DECK + 2.9, DECKZ - 3.84, undefined, { bg: '#1e5aa8', fg: '#ffffff' });
    }

    // ----- materials -----
    const M = {
      white: kit.mat(0xf2f2ee, { roughness: 0.35 }), blue: kit.mat(0x1e5aa8, { roughness: 0.35 }),
      black: kit.mat(0x1a1a1a, { roughness: 0.55 }), rubber: kit.mat(0x141414, { roughness: 0.95 }),
      steel: kit.mat(0xb8bcc0, { metalness: 0.9, roughness: 0.3 }), alloy: kit.mat(0xc9ced2, { metalness: 0.75, roughness: 0.38 }),
      chrome: kit.mat(0xe6e8ea, { metalness: 1, roughness: 0.12 }), grey: kit.mat(0x3a3d40, { metalness: 0.5, roughness: 0.5 }),
      glass: kit.mat(0x101820, { metalness: 0.4, roughness: 0.06 }),
      red: kit.mat(0xb8221c, { roughness: 0.4 }), redDark: kit.mat(0x7a1410, { roughness: 0.5 }),
      tail: kit.mat(0xc01010, { emissive: 0x900000, emissiveIntensity: 0.6, roughness: 0.2 }), amber: kit.mat(0xffa020, { emissive: 0x804000, emissiveIntensity: 0.5, roughness: 0.2 }),
      ice: kit.mat(0xd6eefc, { roughness: 0.18, metalness: 0.05, transparent: true, opacity: 0.92 }),
      canvas: kit.mat(0x5d6b3c, { roughness: 0.95 }), canvasDark: kit.mat(0x46512c, { roughness: 0.95 }), leather: kit.mat(0x5a3518, { roughness: 0.7 }),
      bark: kit.mat(0x5a4330, { roughness: 0.95 }),
      chairFab: kit.mat(0x2a5aa8, { roughness: 0.85 }), green: kit.mat(0x2f7a3a, { metalness: 0.35, roughness: 0.45 }),
      bbq: kit.mat(0x2a2c2e, { metalness: 0.4, roughness: 0.45 }), steelHood: kit.mat(0xa8aeb4, { metalness: 0.95, roughness: 0.22 }),
      velour: kit.surf('velour', { arg: 0x9a3328, unit: 0.5 }), velourDark: kit.surf('velour', { arg: 0x7a2420, unit: 0.5 }),
      wood: kit.mat(0x6a4426, { roughness: 0.7 }),
    };
    const canvasTex = (w, h, paint) => { const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
    const decal = (tex, w, h, x, y, z, parent) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, transparent: true })); m.position.set(x, y, z); parent.add(m); return m; };
    const TX = {
      ice: canvasTex(128, 64, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 8, w, h - 16); g.fillStyle = '#1e6ac8'; g.font = '900 40px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ICE', w / 2, h / 2 + 2); }),
      slab: canvasTex(256, 128, (g, w, h) => {
        g.fillStyle = '#e8b21a'; g.fillRect(0, 0, w, h); g.fillStyle = '#b8261e'; g.fillRect(0, 0, w, 26); g.fillRect(0, h - 26, w, 26);
        g.fillStyle = '#1a1208'; g.font = '900 44px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('BOGAN BITTER', w / 2, h / 2, w - 16);
        g.fillStyle = '#fff'; g.font = '800 18px system-ui'; g.fillText('30 CANS · 375 mL', w / 2, 13); g.fillText('KEEP COLD', w / 2, h - 13);
      }),
      esky: canvasTex(128, 48, (g, w, h) => { g.fillStyle = '#1e5aa8'; g.beginPath(); g.roundRect(4, 4, w - 8, h - 8, 10); g.fill(); g.fillStyle = '#fff'; g.font = 'italic 900 30px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ESKY', w / 2, h / 2 + 1); }),
      rings: canvasTex(128, 128, (g, w) => {
        g.fillStyle = '#d8b07a'; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill();
        g.strokeStyle = 'rgba(120,70,30,0.55)'; for (let r = 6; r < 60; r += 7) { g.lineWidth = 1.5 + (r % 3); g.beginPath(); g.arc(64 + Math.sin(r) * 2, 64, r, 0, 7); g.stroke(); }
        g.strokeStyle = 'rgba(80,40,10,0.7)'; g.lineWidth = 3; g.beginPath(); g.moveTo(64, 64); g.lineTo(120, 40); g.stroke();
        g.strokeStyle = '#4a3020'; g.lineWidth = 6; g.beginPath(); g.arc(64, 64, 61, 0, 7); g.stroke();
      }),
      rollEnd: canvasTex(128, 128, (g) => {
        g.fillStyle = '#46512c'; g.beginPath(); g.arc(64, 64, 63, 0, 7); g.fill();
        g.strokeStyle = '#2e361c'; g.lineWidth = 4; g.beginPath(); for (let a = 0; a < 26; a += 0.1) { const r = 4 + a * 2.2; g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } g.stroke();
      }),
    };
    const shade = (o) => { o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };
    const rodZ = (x, y, z0, z1, r, mat, parent) => kit.rod([x, y, z0], [x, y, z1], r, mat, parent);
    const cylX = (r, len, mat, x, y, z, parent, seg = 20) => { const m = kit.cyl(r, r, len, mat, 0, 0, 0, parent, undefined, seg); m.rotation.z = Math.PI / 2; m.position.set(x, y, z); return m; };
    const cylZ = (r, len, mat, x, y, z, parent, seg = 20) => { const m = kit.cyl(r, r, len, mat, 0, 0, 0, parent, undefined, seg); m.rotation.x = Math.PI / 2; m.position.set(x, y, z); return m; };

    // ----- the gear: each one built the right way up, in a box w x h cells from (0, 0) -----
    const BUILD = {
      ice(g) {
        kit.box(0.84 * U, 0.78 * U, D * 0.62, M.ice, 0.5 * U, 0.02 * U, 0, g);
        kit.cone(0.12 * U, 0.16 * U, M.ice, 0.5 * U, 0.8 * U, 0, g);
        decal(TX.ice, 0.8 * U, 0.4 * U, 0.5 * U, 0.42 * U, D * 0.31 + 0.004, g);
      },
      jerry(g) {
        kit.box(0.78 * U, 1.66 * U, D * 0.5, M.red, 0.5 * U, 0.02 * U, 0, g);
        kit.beam([0.2 * U, 0.25 * U, D * 0.25 + 0.006], [0.8 * U, 1.45 * U, D * 0.25 + 0.006], 0.025, M.redDark, g);
        kit.beam([0.8 * U, 0.25 * U, D * 0.25 + 0.006], [0.2 * U, 1.45 * U, D * 0.25 + 0.006], 0.025, M.redDark, g);
        for (const hx of [0.2, 0.5, 0.8]) kit.box(0.08 * U, 0.2 * U, D * 0.36, M.redDark, hx * U, 1.68 * U, 0, g);
        kit.box(0.7 * U, 0.06 * U, D * 0.36, M.redDark, 0.5 * U, 1.86 * U, 0, g);
        const sp = kit.cyl(0.07 * U, 0.09 * U, 0.2 * U, M.black, 0.75 * U, 1.66 * U, D * 0.15, g); sp.rotation.z = -0.5;
      },
      slab(g) {
        kit.box(1.92 * U, 0.9 * U, D * 0.78, kit.mat(0xe8b21a, { roughness: 0.6 }), U, 0.02 * U, 0, g);
        decal(TX.slab, 1.9 * U, 0.88 * U, U, 0.47 * U, D * 0.39 + 0.004, g);
      },
      firewood(g) {
        const logs = [[0.5, 0.42, 0.4], [1.5, 0.44, 0.42], [2.5, 0.42, 0.4], [1.0, 0.8, 0.22], [2.0, 0.78, 0.22]];
        for (const [x, y, r] of logs) {
          cylZ(r * U, D * 0.82, M.bark, x * U, y * U, 0, g, 9);
          const ring = new THREE.Mesh(new THREE.CircleGeometry(r * U * 0.96, 18), new THREE.MeshStandardMaterial({ map: TX.rings, roughness: 0.9 }));
          ring.position.set(x * U, y * U, D * 0.41 + 0.003); g.add(ring);
        }
      },
      swag(g) {
        cylX(0.46 * U, 3.9 * U, M.canvas, 2 * U, 0.48 * U, 0, g, 24);
        for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.CircleGeometry(0.46 * U, 24), new THREE.MeshStandardMaterial({ map: TX.rollEnd, roughness: 0.95 })); e.position.set(2 * U + s * 1.952 * U, 0.48 * U, 0); e.rotation.y = s * Math.PI / 2; g.add(e); }
        for (const sx of [0.85, 3.15]) { cylX(0.485 * U, 0.16 * U, M.leather, sx * U, 0.48 * U, 0, g); kit.box(0.2 * U, 0.16 * U, 0.03, M.chrome, sx * U, 0.86 * U, 0.12, g); }
      },
      esky(g) {
        kit.box(1.9 * U, 0.2 * U, D * 0.86, M.blue, U, 0.02 * U, 0, g);
        kit.box(1.86 * U, 1.3 * U, D * 0.82, M.white, U, 0.2 * U, 0, g);
        kit.box(1.96 * U, 0.42 * U, D * 0.9, M.blue, U, 1.5 * U, 0, g);
        kit.box(1.5 * U, 0.08 * U, D * 0.6, M.blue, U, 1.92 * U, 0, g);
        for (const s of [-1, 1]) kit.box(0.08 * U, 0.22 * U, D * 0.5, M.black, U + s * 0.97 * U, 1.08 * U, 0, g);
        decal(TX.esky, 0.9 * U, 0.34 * U, U, 0.95 * U, D * 0.41 + 0.004, g);
        cylZ(0.06 * U, 0.08, M.black, 1.7 * U, 0.4 * U, D * 0.41, g, 10);
      },
      tyre(g) {
        const tr = new THREE.Mesh(new THREE.TorusGeometry(0.7 * U, 0.27 * U, 14, 40), M.rubber); tr.position.set(U, U, 0); tr.scale.z = 2.2; g.add(tr);
        // tread blocks round the outside
        for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2; const b = kit.box(0.12 * U, 0.08 * U, 0.34 * U * 2.2, M.rubber, 0, 0, 0, g); b.position.set(U + Math.cos(a) * 0.96 * U, U + Math.sin(a) * 0.96 * U, 0); b.rotation.z = a + Math.PI / 2; }
        cylZ(0.5 * U, 0.42 * U, M.alloy, U, U, 0, g, 28);
        cylZ(0.17 * U, 0.46 * U, M.chrome, U, U, 0, g, 16);
        for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; cylZ(0.05 * U, 0.48 * U, M.grey, U + Math.cos(a) * 0.3 * U, U + Math.sin(a) * 0.3 * U, 0, g, 8); }
      },
      chair(g) {
        // a folding camp chair, side on: crossed legs, sling seat, tall back
        for (const z of [-D * 0.36, D * 0.36]) {
          kit.rod([0.15 * U, 0.02 * U, z], [1.85 * U, 0.82 * U, z], 0.018, M.grey, g);
          kit.rod([1.85 * U, 0.02 * U, z], [0.15 * U, 0.82 * U, z], 0.018, M.grey, g);
          kit.rod([0.2 * U, 0.8 * U, z], [0.38 * U, 1.92 * U, z], 0.018, M.grey, g);
          kit.rod([0.3 * U, 1.3 * U, z * 1.1], [0.95 * U, 1.3 * U, z * 1.1], 0.016, M.grey, g);
          kit.box(0.6 * U, 0.08 * U, 0.08, M.black, 0.65 * U, 1.3 * U, z * 1.1, g);
        }
        kit.box(1.75 * U, 0.1 * U, D * 0.72, M.chairFab, U, 0.78 * U, 0, g);
        const back = kit.box(0.1 * U, 1.1 * U, D * 0.72, M.chairFab, 0, 0, 0, g); back.position.set(0.3 * U, 1.38 * U, 0); back.rotation.z = -0.16;
        cylZ(0.12 * U, 0.12, kit.mat(0xd02020), 0.95 * U, 1.18 * U, D * 0.42, g, 12); // a stubby holder in the arm
      },
      barrow(g) {
        // side on: wheel at the front, galvanised tray, handles out the back
        const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.33 * U, 0.12 * U, 12, 28), M.rubber); wheel.position.set(0.5 * U, 0.46 * U, 0); wheel.scale.z = 1.6; g.add(wheel);
        cylZ(0.24 * U, 0.12, kit.mat(0xd02a20, { roughness: 0.4 }), 0.5 * U, 0.46 * U, 0, g, 16);
        kit.extrude([[0.08 * U, 1.96 * U], [2.4 * U, 1.96 * U], [2.0 * U, 1.12 * U], [0.6 * U, 1.12 * U]], D * 0.66, M.green, g, {}, 0.01);
        kit.box(2.36 * U, 0.06 * U, D * 0.7, kit.mat(0x26602e, { metalness: 0.35, roughness: 0.45 }), 1.24 * U, 1.94 * U, 0, g);
        for (const z of [-D * 0.24, D * 0.24]) {
          kit.rod([0.5 * U, 0.46 * U, z], [2.2 * U, 1.12 * U, z], 0.02, M.grey, g);
          kit.rod([2.2 * U, 1.12 * U, z], [2.98 * U, 1.42 * U, z], 0.02, M.grey, g);
          kit.box(0.42 * U, 0.12 * U, 0.06, M.black, 2.78 * U, 1.28 * U, z, g).rotation.z = 0.36;
          kit.rod([1.9 * U, 1.12 * U, z], [1.98 * U, 1.02 * U, z], 0.02, M.grey, g);
        }
      },
      bbq(g) {
        // a hooded gas barbie on a cabinet, side shelves out wide
        kit.box(0.9 * U, 0.96 * U, D * 0.7, M.bbq, 1.5 * U, 0.04 * U, 0, g);
        kit.box(0.04 * U, 0.6 * U, 0.02, M.chrome, 1.72 * U, 0.22 * U, D * 0.35 + 0.01, g);
        for (const x of [1.15, 1.85]) cylZ(0.07 * U, D * 0.6, M.black, x * U, 0.05 * U, 0, g, 10);
        kit.box(1.2 * U, 0.42 * U, D * 0.76, M.bbq, 1.5 * U, U, 0, g);
        const hood = cylX(0.38 * U, 1.18 * U, M.steelHood, 1.5 * U, 1.42 * U, 0, g, 24); hood.scale.set(1, 1, D * 0.75 / (0.76 * U)); hood.position.y = 1.42 * U;
        cylX(0.04 * U, 0.9 * U, M.chrome, 1.5 * U, 1.62 * U, D * 0.4, g, 8);
        for (const k of [1.25, 1.5, 1.75]) cylZ(0.06 * U, 0.03, M.black, k * U, 1.2 * U, D * 0.38 + 0.015, g, 10);
        for (const sx of [0.47, 2.53]) kit.box(0.92 * U, 0.08 * U, D * 0.66, M.grey, sx * U, 1.08 * U, 0, g);
        // sauce on one shelf, a tinny on the other
        kit.lathe([[0, 0], [0.12 * U, 0], [0.13 * U, 0.45 * U], [0.05 * U, 0.62 * U], [0.04 * U, 0.75 * U], [0, 0.75 * U]].map(([r, y]) => [r, y]), kit.mat(0xc81e1a, { roughness: 0.3 }), g, undefined, 16).position.set(0.4 * U, 1.16 * U, 0);
        kit.cyl(0.13 * U, 0.13 * U, 0.42 * U, kit.mat(0x2a7ac8, { metalness: 0.8, roughness: 0.3 }), 2.55 * U, 1.16 * U, 0, g, 16);
      },
      couch(g) {
        // Nan's old couch, front on: velour, big arms, three cushions
        kit.box(2.96 * U, 0.12 * U, D * 0.88, M.wood, 1.5 * U, 0, 0, g);
        kit.box(2.9 * U, 0.42 * U, D * 0.86, M.velourDark, 1.5 * U, 0.12 * U, 0, g);
        for (const cx of [1.18, 1.5, 1.82]) kit.box(0.31 * U, 0.38 * U, D * 0.84, M.velour, cx * U, 0.54 * U, 0.01, g);
        for (const ax of [0.46, 2.54]) { kit.box(0.84 * U, 1.42 * U, D * 0.88, M.velourDark, ax * U, 0.12 * U, 0, g); cylZ(0.42 * U, D * 0.9, M.velour, ax * U, 1.54 * U, 0, g, 20).scale.set(1, 1, 1); }
        for (const lx of [0.15, 2.85]) kit.box(0.1 * U, 0.12 * U, 0.1, M.wood, lx * U, -0.02 * U, D * 0.36, g);
      },
    };
    const sizeOf = (cells) => [Math.max(...cells.map((c) => c[0])) + 1, Math.max(...cells.map((c) => c[1])) + 1];
    // a piece: an outer group placed at the grid cell, an inner one turned and shifted so the box stays at (0, 0)
    const pieceMesh = (it) => {
      const outer = new THREE.Group(), inner = new THREE.Group(); outer.add(inner);
      BUILD[it.id](inner); shade(inner);
      return { outer, inner, size: sizeOf(it.cells) };
    };
    const turnMesh = (pm, r) => {
      const [w, h] = pm.size;
      pm.inner.rotation.z = -r * Math.PI / 2;
      // corners of the w x h box after r quarter turns of (x, y) -> (y, -x)
      let pts = [[0, 0], [w, 0], [0, h], [w, h]];
      for (let i = 0; i < r; i++) pts = pts.map(([x, y]) => [y, -x]);
      pm.inner.position.set(-Math.min(...pts.map((p) => p[0])) * U, -Math.min(...pts.map((p) => p[1])) * U, 0);
    };

    // ----- the gear, in the same order for everyone -----
    const bag = [];
    { const tot = ITEMS.reduce((s, it) => s + it.w, 0); for (let i = 0; i < 80; i++) { let r = rng() * tot; bag.push(ITEMS.find((it) => (r -= it.w) < 0) || ITEMS[0]); } }

    // ----- the utes, seen from behind with the tailgate down -----
    const pops = [];
    const pop = (x, y, z, text, color, size = 1) => {
      const c = document.createElement('canvas'); c.width = 512; c.height = 160;
      const g = c.getContext('2d'); g.font = '900 88px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 14; g.strokeStyle = '#1a0d08'; g.strokeText(text, 256, 84, 500); g.fillStyle = color; g.fillText(text, 256, 84, 500);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); sp.scale.set(2.8 * size, 0.88 * size, 1); sp.renderOrder = 20;
      sp.position.set(x, y, z); scene.add(sp); pops.push({ sp, life: 0 });
      return sp;
    };
    const buildUte = (p, g) => {
      const paint = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(p.color), metalness: 0.5, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08 });
      const TL = ZF - ZB, zc = (ZF + ZB) / 2, W = EW + T * 2;
      // the tray: floor, drop sides with ribs, under-tray box
      kit.box(W, 0.06, TL, M.alloy, EW / 2, -0.06, zc, g);
      for (let i = 0; i < 8; i++) kit.box(0.02, 0.012, TL, M.steel, (i + 0.5) * EW / 8, 0, zc, g);
      for (const sx of [-T / 2, EW + T / 2]) {
        kit.box(T, 0.36, TL, M.alloy, sx, 0, zc, g);
        for (const ry of [0.1, 0.22]) kit.box(T + 0.02, 0.025, TL, M.steel, sx, ry, zc, g);
      }
      kit.box(W + 0.04, 0.26, TL + 0.04, M.black, EW / 2, -0.32, zc, g);
      // tailgate dropped down, hanging off its hinges
      kit.box(W, 0.36, 0.04, M.alloy, EW / 2, -0.42, ZF + 0.04, g);
      for (const ry of [-0.32, -0.2]) kit.box(W, 0.025, 0.05, M.steel, EW / 2, ry, ZF + 0.04, g);
      // tail lights tucked under the tray corners, bumper, tow bar
      for (const sx of [0.1, EW - 0.1]) { kit.box(0.22, 0.2, 0.06, M.tail, sx, -0.36, ZF + 0.02, g); kit.box(0.22, 0.08, 0.06, M.amber, sx, -0.44, ZF + 0.02, g); }
      kit.box(EW * 0.9, 0.14, 0.18, M.black, EW / 2, -0.82, ZF - 0.14, g);
      kit.box(0.12, 0.08, 0.3, M.black, EW / 2, -0.88, ZF + 0.05, g);
      kit.ball(0.05, M.chrome, EW / 2, -0.74, ZF + 0.18, g);
      // a rego plate with your name on it
      const plateT = canvasTex(512, 160, (pg, w, h) => {
        pg.fillStyle = '#f6f3e6'; pg.beginPath(); pg.roundRect(4, 4, w - 8, h - 8, 18); pg.fill();
        pg.lineWidth = 10; pg.strokeStyle = p.color; pg.stroke();
        pg.fillStyle = '#111'; pg.font = '900 78px system-ui'; pg.textAlign = 'center'; pg.textBaseline = 'middle'; pg.fillText(p.name.toUpperCase(), w / 2, h / 2 + 10, w - 40);
        pg.font = '800 22px system-ui'; pg.fillStyle = '#555'; pg.fillText('BOGAN STATE', w / 2, 22);
      });
      decal(plateT, 1.0, 0.31, EW / 2, -0.25, ZF + 0.065, g).material.transparent = false; // on the dropped tailgate
      // chassis, mud flaps and the back wheels
      for (const sx of [0.55, EW - 0.55]) kit.box(0.1, 0.14, 2.6, M.black, sx, -0.6, -0.9, g);
      kit.box(EW - 0.4, 0.1, 0.1, M.black, EW / 2, -0.62, ZB + 0.3, g);
      const wy = -OY + 0.38;
      for (const sx of [0.42, EW - 0.42]) {
        const tyre = cylX(0.38, 0.32, M.rubber, sx, wy, ZB + 0.15, g, 24);
        tyre.castShadow = true;
        kit.box(0.42, 0.42, 0.02, M.black, sx, wy - 0.3, ZF - 0.06, g);
      }
      cylX(0.06, EW - 1.0, M.grey, EW / 2, wy, ZB + 0.15, g, 10);
      kit.ball(0.16, M.grey, EW / 2, wy, ZB + 0.15, g); // diff
      // the cab, in your colour, with the back window
      const cw = W + 0.12, cab = [[-cw / 2, -0.55], [cw / 2, -0.55], [cw / 2, 0.45], [cw / 2 - 0.22, 1.1], [-cw / 2 + 0.22, 1.1], [-cw / 2, 0.45]];
      const cabM = kit.extrude(cab, 1.5, paint, g, {}, 0.05); cabM.position.set(EW / 2, 0, ZB - 0.85);
      decal(canvasTex(8, 8, (cg) => { cg.fillStyle = '#0d141c'; cg.fillRect(0, 0, 8, 8); }), cw - 0.7, 0.5, EW / 2, 0.75, ZB - 0.85 + 0.75 + 0.06, g);
      for (const s of [-1, 1]) { kit.box(0.08, 0.18, 0.12, M.black, EW / 2 + s * (cw / 2 + 0.14), 0.42, ZB - 1.3, g); kit.box(0.04, 0.16, 0.1, M.glass, EW / 2 + s * (cw / 2 + 0.14), 0.43, ZB - 1.24, g); }
      // headboard: a black tube frame with a mesh guard over the window; its top bar is the limit
      for (const sx of [-T / 2, EW + T / 2]) kit.box(0.07, EH + 0.04, 0.07, M.black, sx, 0, ZB, g);
      kit.box(EW + 0.18, 0.08, 0.08, M.black, EW / 2, EH, ZB, g);
      kit.box(EW + 0.1, 0.05, 0.06, M.black, EW / 2, EH * 0.55, ZB, g);
      for (let i = 1; i < 14; i++) kit.box(0.015, EH * 0.55, 0.015, M.black, i * EW / 14, 0, ZB, g);
      // the red line: nothing past here or the straps won't go on
      const lim = new THREE.Mesh(new THREE.PlaneGeometry(EW + 0.2, 0.03), new THREE.MeshBasicMaterial({ color: 0xff3a3a })); lim.position.set(EW / 2, EH, ZF + 0.03); g.add(lim);
      for (const sx of [-0.18, EW + 0.18]) { const tick = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), new THREE.MeshBasicMaterial({ color: 0xff3a3a })); tick.rotation.z = Math.PI / 4; tick.position.set(sx, EH, ZF + 0.03); g.add(tick); }
      // tie-down hooks on the sides, for later
      for (const sx of [-T - 0.02, EW + T + 0.02]) for (const hz of [ZB + 0.18, ZF - 0.18]) kit.torus(0.035, 0.012, M.chrome, sx, 0.3, hz, g);
      shade(g);
      g.traverse((o) => { if (o.material === M.ice) o.castShadow = false; });
    };

    const slotX = (k, inRow) => (k - (inRow - 1) / 2) * PITCH - EW / 2;
    const packers = players.map((p, i) => {
      const row = rows === 2 && i >= perRow ? 1 : 0, k = row ? i - perRow : i, inRow = row ? n - perRow : perRow;
      const ox = slotX(k, inRow), oy = OY + (row ? DECK : 0), oz = row ? DECKZ : 0;
      const g = kit.group(ox, oy, oz);
      buildUte(p, g);
      const ghost = new THREE.Group(); g.add(ghost);
      const ghostMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.26, depthWrite: false });
      return { p, g, ox, oy, oz, ghost, ghostMat, grid: Array.from({ length: ROWS + 4 }, () => new Array(COLS).fill(0)), next: 0, cur: null, items: 0, done: false, fallT: 0, strapT: 0, straps: null, dir: 0, repT: 0, held: 0,
        bot: p.bot ? { plan: null, stepT: 0, speed: 0.13 + rng() * 0.12, slip: 0.1 + rng() * 0.2 } : null };
    });
    const ghostGeo = new THREE.PlaneGeometry(CELL * 0.9, CELL * 0.9);

    const fits = (P, cells, x, y) => cells.every(([cx, cy]) => { const gx = x + cx, gy = y + cy; return gx >= 0 && gx < COLS && gy >= 0 && (gy >= ROWS + 4 || !P.grid[gy][gx]); });
    const spawn = (P) => {
      const it = bag[P.next++ % bag.length];
      const cells = rotateCells(it.cells, 0), w = sizeOf(cells)[0];
      const cur = { it, r: 0, cells, x: Math.floor((COLS - w) / 2), y: ROWS + 1, pm: null };
      if (!fits(P, cells, cur.x, cur.y)) { finish(P); return; }
      cur.pm = pieceMesh(it); P.g.add(cur.pm.outer);
      P.ghost.clear(); for (let i = 0; i < cells.length; i++) P.ghost.add(new THREE.Mesh(ghostGeo, P.ghostMat));
      P.cur = cur; redraw(P); P.fallT = 0; P.bot && (P.bot.plan = null);
    };
    const redraw = (P) => {
      const c = P.cur; if (!c) return;
      turnMesh(c.pm, c.r);
      c.pm.outer.position.set(c.x * CELL, c.y * CELL, 0);
      // where it would land
      let gy = c.y; while (fits(P, c.cells, c.x, gy - 1)) gy--;
      c.cells.forEach(([x, y], i) => P.ghost.children[i].position.set((c.x + x + 0.5) * CELL, (gy + y + 0.5) * CELL, ZF + 0.02));
    };
    const pileTop = (P) => { for (let gy = ROWS + 3; gy >= 0; gy--) if (P.grid[gy].some((v) => v)) return gy + 1; return 0; };
    // done well: two orange ratchet straps come down over the load
    const strapUp = (P) => {
      const top = Math.max(1, Math.min(ROWS, pileTop(P))) * CELL + 0.02, sm = kit.mat(0xff7a10, { roughness: 0.8 });
      const s = new THREE.Group(); P.g.add(s);
      for (const z of [-D * 0.22, D * 0.22]) {
        kit.box(EW + 0.06, 0.02, 0.07, sm, EW / 2, top, z, s);
        for (const sx of [-0.03, EW + 0.03]) kit.box(0.02, top - 0.3, 0.07, sm, sx, 0.3, z, s);
        kit.box(0.14, 0.08, 0.1, M.chrome, EW - 0.03, top * 0.5 + 0.15, z, s);
      }
      s.position.y = 1.5; P.straps = s;
    };
    const finish = (P, why) => {
      if (P.done) return;
      if (!why) strapUp(P);
      pop(P.ox + EW / 2, P.oy + EH + 1.0, P.oz + 0.6, why || `${P.items} PACKED`, why ? '#ff8a5a' : P.p.color, 0.8);
    };
    const lock = (P) => {
      const c = P.cur;
      const over = c.cells.some(([x, y]) => c.y + y >= ROWS);
      for (const [x, y] of c.cells) if (c.y + y < ROWS + 4) P.grid[c.y + y][c.x + x] = 1;
      P.cur = null; P.ghost.clear();
      if (over) {
        c.pm.outer.traverse((o) => { if (o.material && o.material.color) { o.material = o.material.clone(); o.material.color.multiplyScalar(0.55); } });
        c.pm.outer.rotation.z = 0.06; // and it's sitting crooked
        finish(P, "CAN'T STRAP IT"); sfx.play('lose'); return;
      }
      P.items++; sfx.play('thud');
      spawn(P);
    };
    const move = (P, dx) => { const c = P.cur; if (c && fits(P, c.cells, c.x + dx, c.y)) { c.x += dx; redraw(P); sfx.play('tick'); } };
    const spin = (P) => {
      const c = P.cur; if (!c) return;
      const r = (c.r + 1) % 4, cells = rotateCells(c.it.cells, r);
      for (const kick of [0, -1, 1, -2]) if (fits(P, cells, c.x + kick, c.y)) { c.r = r; c.cells = cells; c.x += kick; redraw(P); sfx.play('tick'); return; }
    };
    const drop = (P) => { const c = P.cur; if (!c) return; while (fits(P, c.cells, c.x, c.y - 1)) c.y--; c.pm.outer.position.y = c.y * CELL; lock(P); };

    // CPU packing: try every spin and spot, keep the one that leaves the flattest, lowest, hole-free pile
    const plan = (P) => {
      const c = P.cur; let best = null;
      for (let r = 0; r < 4; r++) {
        const cells = rotateCells(c.it.cells, r), w = sizeOf(cells)[0];
        for (let x = 0; x + w <= COLS; x++) {
          let y = ROWS + 1; if (!fits(P, cells, x, y)) continue;
          while (fits(P, cells, x, y - 1)) y--;
          const grid = P.grid.map((row) => row.slice());
          let over = false;
          for (const [cx, cy] of cells) { if (y + cy >= ROWS) over = true; if (y + cy < ROWS + 4) grid[y + cy][x + cx] = 1; }
          const hts = Array.from({ length: COLS }, (_, gx) => { for (let gy = ROWS + 3; gy >= 0; gy--) if (grid[gy][gx]) return gy + 1; return 0; });
          let holes = 0; for (let gx = 0; gx < COLS; gx++) for (let gy = 0; gy < hts[gx]; gy++) if (!grid[gy][gx]) holes++;
          const bump = hts.slice(1).reduce((s, h, k) => s + Math.abs(h - hts[k]), 0);
          const score = -(over ? 1000 : 0) - holes * 7 - bump * 1.2 - Math.max(...hts) * 2 - y * 0.5 + rng() * P.bot.slip * 4;
          if (!best || score > best.score) best = { r, x, score };
        }
      }
      return best;
    };

    // camera: straight on from a little above, pulled back just far enough to fit every ute and the gear
    // coming in, clear of the timer at the top and the scoreboard down the right
    const camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.2, 300);
    {
      const pts = [];
      for (const P of packers) for (const x of [P.ox - 0.45, P.ox + EW + 0.45]) for (const [y, z] of [[P.oy - OY, P.oz + ZF + 0.3], [P.oy + EH + 4 * CELL + 0.45, P.oz]]) pts.push(new THREE.Vector3(x, y, z));
      const box = new THREE.Box3().setFromPoints(pts), aim = box.getCenter(new THREE.Vector3());
      const dir = new THREE.Vector3(0, rows === 2 ? 0.3 : 0.2, 1).normalize(), v = new THREE.Vector3();
      const L = -0.95, R = 0.74, B = -0.94, TOP = 0.84; // the screen box to fill, in -1..1
      const at = (d) => { camera.position.copy(aim).addScaledVector(dir, d); camera.lookAt(aim); camera.updateMatrixWorld(); };
      const ext = () => { let x0 = 9, x1 = -9, y0 = 9, y1 = -9; for (const q of pts) { v.copy(q).project(camera); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); } return { x0, x1, y0, y1 }; };
      for (let pass = 0; pass < 3; pass++) {
        let lo = 2, hi = 200;
        for (let i = 0; i < 40; i++) { const d = (lo + hi) / 2; at(d); const e = ext(); if (e.x1 - e.x0 <= R - L && e.y1 - e.y0 <= TOP - B) hi = d; else lo = d; }
        at(hi);
        // slide the view so the fitted box sits in the middle of the free part of the screen
        const e = ext(), dist = camera.position.distanceTo(aim);
        const hh = Math.tan(THREE.MathUtils.degToRad(18)) * dist, hw = hh * camera.aspect;
        const sx = ((e.x0 + e.x1) / 2 - (L + R) / 2) * hw, sy = ((e.y0 + e.y1) / 2 - (B + TOP) / 2) * hh;
        const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
        aim.addScaledVector(right, sx).addScaledVector(up, sy);
      }
    }

    let tAll = 0, run = 0, finishAt = null, started = false;
    return {
      camera,
      update(dt, t, running) {
        tAll += dt;
        if (running) {
          run += dt;
          if (!started) { started = true; for (const P of packers) spawn(P); }
        }
        const fall = FALL0 + (FALL1 - FALL0) * Math.min(1, run / mg.duration);
        for (const P of packers) {
          if (P.done) { if (P.straps) { P.strapT = Math.min(1, P.strapT + dt * 2.2); P.straps.position.y = 1.5 * (1 - P.strapT) * (1 - P.strapT); } continue; }
          if (!running || !P.cur) continue;
          if (P.bot) {
            const B = P.bot; B.stepT -= dt;
            if (!B.plan) B.plan = plan(P);
            if (B.stepT <= 0 && B.plan) {
              B.stepT = B.speed;
              const c = P.cur;
              if (c.r !== B.plan.r) spin(P);
              else if (c.x < B.plan.x) move(P, 1);
              else if (c.x > B.plan.x) move(P, -1);
              else { drop(P); B.stepT = B.speed * 2; }
              if (!P.cur) continue;
            }
          }
          // the stick held over keeps shuffling the piece along
          if (P.dir) { P.repT -= dt; if (P.repT <= 0) { P.repT = REPEAT; move(P, P.dir); if (!P.cur) continue; } }
          P.fallT += dt;
          if (P.fallT >= fall) {
            P.fallT = 0;
            const c = P.cur;
            if (fits(P, c.cells, c.x, c.y - 1)) { c.y--; redraw(P); } else lock(P);
          }
        }
        if (running && run > mg.duration - 0.5) for (const P of packers) if (!P.done) finish(P);
        if (finishAt == null && started && packers.every((P) => P.done)) { finishAt = tAll; sfx.play('hallelujah'); }
        for (const q of pops) { q.life += dt; q.sp.material.opacity = Math.min(1, q.life * 4); }
      },
      input(p, m) {
        const P = packers.find((x) => x.p === p); if (!P || m.b !== 'stick') return;
        const x = Number(m.x) || 0, held = Number(m.h) || 0, newly = held & ~P.held;
        // a push past halfway moves once straight away, then repeats while it's held there
        const dir = x > 0.5 ? 1 : x < -0.5 ? -1 : 0;
        const changed = dir !== P.dir;
        P.dir = dir; P.held = held;
        if (P.done || !P.cur) return;
        if (changed && dir) { P.repT = REPEAT0; move(P, dir); }
        if (P.cur && (newly & BTN.SPIN)) spin(P);
        if (P.cur && (newly & BTN.DROP)) drop(P);
      },
      scores() { return Object.fromEntries(packers.map((P) => [P.p.id, P.items])); },
      done: () => finishAt != null && tAll - finishAt > 3,
    };
  },
};
