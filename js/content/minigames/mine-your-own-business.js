// Mine Your Own Business: everyone's on a jackhammer at the top of a Broken Hill cross-section and
// the lump of lead is way down at the bottom. The hammer digs down on its own (mash HAMMER to dig
// faster); steer left and right. Hard rock stops you dead, so go round it. Dinosaur bones slow you
// down. Fall into someone else's hole, or a cave, and you drop for free. Opals in the dirt hold
// power-ups: dynamite, a diamond bit that cuts rock, a turbo, and a rockfall that drops a boulder
// under everyone else. Gas pockets go off in your face. First to the lump of lead wins; the rest
// place by how deep they got.
// Split screen: every digger (bots too) gets their own pane following them down, laid out in even
// rows (4 is 2 x 2, 7 is 3 + 2 + 2) with the scoreboard in a strip down the right. When someone
// strikes lead, or time's up, it goes back to one camera.
import { addSky } from '../../host/sky.js';
import { RoundedBoxGeometry } from '../../../vendor/RoundedBoxGeometry.js';

const CS = 1.3; // metres per cell
const ROWS = 78;
const DIG = { dirt: 1, clay: 1.7, bones: 4, gas: 1, opal: 1, rock: Infinity }; // how hard each is to dig
const RATE = 1.5, MASH = 0.55, MASH_MAX = 3.2; // cells a second through dirt; each tap adds, it wears off
const SIDE_T = 0.16, FALL_T = 0.06;
const BTN = { HAMMER: 1, POWER: 2 };
const POWERS = {
  dynamite: { emoji: '🧨', name: 'DYNAMITE' },
  diamond: { emoji: '💎', name: 'DIAMOND BIT' },
  turbo: { emoji: '⚡', name: 'TURBO' },
  rockfall: { emoji: '🪨', name: 'ROCKFALL' },
};
const DOLL = 0.44;

export default {
  id: 'mine-your-own-business',
  name: 'Mine Your Own Business',
  blurb: 'Jackhammer down to the lump of lead. Rock blocks you, bones slow you, other people\'s holes are free. One winner.',
  howTo: 'Your jackhammer digs down by itself. Drag the stick left and right to dig sideways round hard rock. Mash HAMMER to dig faster. Dig into an opal for a power-up, then tap POWER. Fall down someone else\'s hole for a free ride. First to touch the lump of lead wins.',
  padText: 'Dig to the lump of lead!',
  duration: 90,
  pad: { kind: 'stick', buttons: [{ bit: BTN.HAMMER, label: '🔨 HAMMER', tone: 'go' }, { bit: BTN.POWER, label: '⚡ POWER' }] },

  create(mg) {
    const { THREE, kit, scene, players, rng, renderer, sfx } = mg;
    const n = players.length;
    const COLS = Math.max(16, Math.min(26, n * 3 + 8));
    const cx = (c) => (c - (COLS - 1) / 2) * CS, cy = (r) => -(r + 0.5) * CS;

    // ----- the ground: built in bands, then rocks, bones, caves, opals and gas dropped in -----
    const grid = []; // grid[r][c] = 'air' | 'dirt' | 'clay' | 'rock' | 'bones' | 'gas' | 'opal' | 'lead'
    for (let r = 0; r < ROWS; r++) grid.push(new Array(COLS).fill(r > 8 && r < 22 ? 'clay' : 'dirt'));
    const set = (r, c, v) => { if (r >= 0 && r < ROWS && c >= 0 && c < COLS) grid[r][c] = v; };
    const get = (r, c) => (r < 0 ? 'air' : r >= ROWS || c < 0 || c >= COLS ? 'rock' : grid[r][c]);
    // rock shelves with gaps, getting longer the deeper you go
    for (let r = 6; r < ROWS - 6; r += 3 + ((rng() * 3) | 0)) {
      const k = r / ROWS, len = 2 + ((rng() * (2 + k * 6)) | 0);
      for (let s = 0; s < 1 + ((rng() * (1 + k * 2.5)) | 0); s++) {
        const c0 = (rng() * (COLS - len)) | 0;
        for (let c = c0; c < c0 + len; c++) { set(r, c, 'rock'); if (rng() < 0.35) set(r + 1, c, 'rock'); }
      }
    }
    // lone boulders
    for (let i = 0; i < COLS * 2; i++) { const r = 4 + ((rng() * (ROWS - 10)) | 0), c = (rng() * COLS) | 0; set(r, c, 'rock'); if (rng() < 0.5) set(r, c + 1, 'rock'); }
    // dinosaur skeletons: a spine with ribs hanging off it
    const skeletons = [];
    for (let i = 0; i < 3 + Math.floor(COLS / 10); i++) {
      const r = 12 + ((rng() * (ROWS - 22)) | 0), c0 = 1 + ((rng() * (COLS - 9)) | 0), len = 5 + ((rng() * 3) | 0);
      for (let c = c0; c < c0 + len; c++) { set(r, c, 'bones'); if ((c - c0) % 2 === 1 && c < c0 + len - 1) set(r + 1, c, 'bones'); }
      set(r - 1, c0 + len - 1, 'bones'); set(r, c0 + len, 'bones'); // the skull end
      skeletons.push({ r, c0, len });
    }
    // caves: drop through them for free
    for (let i = 0; i < 3 + Math.floor(COLS / 8); i++) {
      const r = 8 + ((rng() * (ROWS - 18)) | 0), c0 = (rng() * (COLS - 5)) | 0, w = 3 + ((rng() * 4) | 0), h = 2 + ((rng() * 2) | 0);
      for (let rr = r; rr < r + h; rr++) for (let c = c0; c < c0 + w; c++) set(rr, c, 'air');
    }
    // opals (power-ups) and gas pockets
    for (let i = 0; i < COLS * 1.3; i++) { const r = 3 + ((rng() * (ROWS - 10)) | 0), c = (rng() * COLS) | 0; if (get(r, c) === 'dirt' || get(r, c) === 'clay') set(r, c, 'opal'); }
    for (let i = 0; i < COLS * 0.5; i++) { const r = 10 + ((rng() * (ROWS - 16)) | 0), c = (rng() * COLS) | 0; if (get(r, c) === 'dirt' || get(r, c) === 'clay') set(r, c, 'gas'); }
    // the top rows stay plain so everyone gets going, and the bottom is the cavern with the lead in it
    for (let r = 0; r < 3; r++) for (let c = 0; c < COLS; c++) if (grid[r][c] !== 'dirt') grid[r][c] = 'dirt';
    const CAVE = ROWS - 4;
    for (let r = CAVE; r < ROWS; r++) for (let c = 0; c < COLS; c++) grid[r][c] = r === ROWS - 1 ? 'rock' : 'air';
    for (let c = 0; c < COLS; c++) if (grid[CAVE - 1][c] === 'air') grid[CAVE - 1][c] = 'dirt';
    const leadC = 2 + ((rng() * (COLS - 4)) | 0), leadR = ROWS - 2;
    grid[leadR][leadC] = 'lead';

    // ----- sky and the surface: Broken Hill, a headframe and red dirt -----
    const { sun } = addSky(scene, renderer, { elevation: 40, azimuth: 20, turbidity: 3, sunIntensity: 3, sky: 0xd8e8ff, ground: 0x8a5a3a, hemi: 0.75, env: 0.7, shadowSize: 30 });
    void sun;
    const W = COLS * CS;
    const surface = kit.box(W + 60, 0.4, 30, kit.surf('redDirt', { unit: 4 }), 0, -0.4, -14.6);
    surface.receiveShadow = true;
    for (const s of [-1, 1]) kit.box(30, ROWS * CS + 2, 4, kit.surf('redDirt', { unit: 4, tint: 0x9a6a4a }), s * (W / 2 + 15), -ROWS * CS - 1.8, -1.4); // solid ground either side
    kit.box(W + 60, 12, 6, kit.surf('slag', { unit: 2, tint: 0x6a6a70 }), 0, -ROWS * CS - 12, -2); // bedrock
    // a headframe over the shaft, like the ones on the Line of Lode
    {
      const g = kit.group(W / 2 + 4, 0, -4), steel = kit.mat(0x7a2a1a, { metalness: 0.5, roughness: 0.6 });
      for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) kit.beam([x, 0, z], [x * 0.4, 14, z * 0.4], 0.35, steel, g);
      kit.beam([-2.2, 7, 2.2], [2.2, 7, 2.2], 0.3, steel, g); kit.beam([-2.2, 7, -2.2], [2.2, 7, -2.2], 0.3, steel, g);
      const wheel = kit.torus(1.4, 0.12, 0x3a3a3a, 0, 14.3, 0, g); wheel.rotation.y = Math.PI / 2;
      kit.beam([5, 0, 0], [0, 13, 0], 0.4, steel, g);
    }
    kit.sign('LINE OF LODE', 6, 1.1, -W / 2 - 4, 3.2, -2, scene, { bg: '#5b1f1a', fg: '#f4e2b0' });
    kit.box(0.2, 3, 0.2, 0x5a3a24, -W / 2 - 6.4, 0, -2.05); kit.box(0.2, 3, 0.2, 0x5a3a24, -W / 2 - 1.6, 0, -2.05);

    // ----- drawing the cells -----
    // lumpy, bevelled cells so the ground reads as packed clods, not tiles. Each instance gets a quarter
    // turn and a flip, so the one lump pattern doesn't repeat down the face
    const cellGeo = (() => {
      const g = new RoundedBoxGeometry(CS, CS, CS, 3, CS * 0.12), P = g.attributes.position, v = new THREE.Vector3();
      for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i); const k = 1 + 0.05 * Math.sin(v.x * 7.1 + v.y * 5.3) * Math.cos(v.y * 6.7 - v.z * 4.1); P.setXYZ(i, v.x * k, v.y * k, v.z * (v.z > 0 ? k : 1)); }
      g.computeVertexNormals(); return g;
    })();
    // Broken Hill in section: red topsoil, ochre, pale clay, red-brown, grey-purple shale, then dark lode country
    const STRATA = [[0, 0xe07448], [6, 0xe89a52], [9, 0xf0c48a], [22, 0xc0643e], [40, 0x8e6450], [56, 0x6a5a5a], [ROWS, 0x463c40]].map(([r, c]) => [r, new THREE.Color(c)]);
    const strata = (r, c, out) => {
      const rr = r + Math.sin(c * 0.55 + 1.7) * 1.4 + Math.sin(c * 0.21) * 1.1; // wavy bedding
      let k = 0; while (k < STRATA.length - 2 && rr >= STRATA[k + 1][0]) k++;
      const [r0, c0] = STRATA[k], [r1, c1] = STRATA[k + 1], f = Math.min(1, Math.max(0, (rr - r0) / (r1 - r0)));
      return out.copy(c0).lerp(c1, f * f * 0.6).offsetHSL(0, 0, (rng() - 0.5) * 0.06);
    };
    const boulderGeo = new THREE.DodecahedronGeometry(CS * 0.62, 1);
    const soil = kit.surf('gravel', { unit: CS * 1.4, tint: 0xffffff }); // pale, so the strata colours come through
    const boneTint = new THREE.Color(0xf4e4c4), gasTint = new THREE.Color(0x9ab85a);
    const kinds = {
      dirt: { geo: cellGeo, mat: soil },
      clay: { geo: cellGeo, mat: soil },
      rock: { geo: boulderGeo, mat: kit.surf('slag', { unit: 1.2, tint: 0x9a9aa0 }) },
      bones: { geo: cellGeo, mat: soil },
      gas: { geo: cellGeo, mat: soil },
      opal: { geo: cellGeo, mat: soil },
    };
    const meshes = {}, slot = []; // slot[r][c] = { kind, i }
    for (let r = 0; r < ROWS; r++) slot.push(new Array(COLS).fill(null));
    for (const [k, def] of Object.entries(kinds)) {
      const list = [];
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (grid[r][c] === k) list.push([r, c]);
      const m = new THREE.InstancedMesh(def.geo, def.mat, Math.max(1, list.length));
      m.receiveShadow = true; m.castShadow = k === 'rock';
      const M = new THREE.Matrix4(), col = new THREE.Color();
      list.forEach(([r, c], i) => {
        if (k === 'rock') M.makeRotationFromEuler(new THREE.Euler(rng() * 3, rng() * 3, rng() * 3)).setPosition(cx(c), cy(r), 0); else M.makeRotationFromEuler(new THREE.Euler(0, 0, ((rng() * 4) | 0) * Math.PI / 2)).setPosition(cx(c), cy(r), 0);
        m.setMatrixAt(i, M);
        // deeper is darker and redder
        const d = r / ROWS; if (k === 'rock') col.setRGB(1 - d * 0.35 + (rng() - 0.5) * 0.08, 1 - d * 0.45 + (rng() - 0.5) * 0.08, 1 - d * 0.5 + (rng() - 0.5) * 0.08);
        else { strata(r, c, col); if (k === 'bones') col.lerp(boneTint, 0.35); if (k === 'gas') col.lerp(gasTint, 0.4); void d; }
        m.setColorAt(i, col);
        slot[r][c] = { kind: k, i };
      });
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      scene.add(m); meshes[k] = m;
    }
    // the back wall you see once a cell's dug out
    const back = new THREE.Mesh(new THREE.PlaneGeometry(W, ROWS * CS), kit.surf('redDirt', { unit: 3, tint: 0x5a3424 }).clone());
    for (const k of ['map', 'normalMap', 'roughnessMap']) if (back.material[k]) { back.material[k] = back.material[k].clone(); back.material[k].repeat.set(W / 3, ROWS * CS / 3); back.material[k].needsUpdate = true; }
    back.position.set(0, -ROWS * CS / 2, -CS / 2 - 0.01); back.receiveShadow = true; scene.add(back);
    // bones, opals and gas get something to look at in front of their cell
    const extras = new Map(); // "r,c" -> mesh
    const boneM = kit.mat(0xf0e6d0, { roughness: 0.6 }), opalM = new THREE.MeshPhysicalMaterial({ color: 0x8af0ff, emissive: 0x30c0a0, emissiveIntensity: 1.1, roughness: 0.1, iridescence: 1, iridescenceIOR: 1.8, clearcoat: 1 });
    const gasM = new THREE.MeshBasicMaterial({ color: 0x9aff5a, transparent: true, opacity: 0.35, depthWrite: false });
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const k = grid[r][c], g = new THREE.Group();
      g.position.set(cx(c), cy(r), CS / 2 + 0.01);
      if (k === 'bones') {
        const along = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, CS * 1.02, 8), boneM); along.rotation.z = Math.PI / 2; g.add(along);
        for (const s of [-1, 1]) { const knob = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), boneM); knob.position.x = s * CS * 0.45; g.add(knob); }
        if ((r + c) % 2) { const rib = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.07, 6, 16, Math.PI), boneM); rib.rotation.z = Math.PI; rib.position.y = -0.05; g.add(rib); }
      } else if (k === 'opal') {
        const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.4, 0), opalM); gem.scale.y = 1.4; g.add(gem);
      } else if (k === 'gas') {
        for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.16 + i * 0.05, 10, 8), gasM); b.position.set((i - 1) * 0.3, (i % 2) * 0.2 - 0.1, 0); g.add(b); }
      } else if (k === 'lead') {
        // the lump of lead: a big dull grey nugget, lit up like a trophy
        const lump = new THREE.Mesh(new THREE.DodecahedronGeometry(CS * 0.7, 1), kit.mat(0x5a6068, { metalness: 0.7, roughness: 0.45, emissive: 0x202830, emissiveIntensity: 0.4 }));
        lump.scale.set(1.3, 0.9, 1); lump.position.z = -CS / 2; lump.castShadow = true; g.add(lump);
        const glow = new THREE.PointLight(0xc8e0ff, 30, 12); glow.position.set(0, 1.2, 0.5); g.add(glow);
        const sign = kit.sign('LUMP OF LEAD', 3.2, 0.6, 0, 2.6, 0, g, { bg: '#ffd23f', fg: '#1a0d06' });
        void sign;
      } else continue;
      scene.add(g); extras.set(`${r},${c}`, g);
    }
    // the cavern: stalactites and a lantern or two
    for (let c = 0; c < COLS; c += 2) { const st = kit.cone(0.25, 0.6 + rng() * 0.8, kit.surf('redDirt', { unit: 2, tint: 0x8a5a44 }), cx(c) + (rng() - 0.5), 0, 0); st.rotation.x = Math.PI; st.position.y = cy(CAVE) + CS / 2 - 0.4; st.position.z = -0.2; }
    for (let i = 0; i < 3; i++) { const l = new THREE.PointLight(0xffb060, 18, 14); l.position.set(cx(((i + 0.5) / 3) * COLS), cy(CAVE + 1), 1.5); scene.add(l); }
    const hide = (r, c) => {
      const s = slot[r]?.[c]; if (!s) return;
      meshes[s.kind].setMatrixAt(s.i, new THREE.Matrix4().makeScale(0, 0, 0)); meshes[s.kind].instanceMatrix.needsUpdate = true;
      slot[r][c] = null;
      const e = extras.get(`${r},${c}`); if (e) { scene.remove(e); extras.delete(`${r},${c}`); }
    };
    const show = (r, c, kind) => {
      // a boulder dropped into the grid (rockfall)
      const b = new THREE.Mesh(boulderGeo, kinds.rock.mat); b.position.set(cx(c), cy(r), 0); b.rotation.set(rng() * 3, rng() * 3, 0); b.castShadow = true; scene.add(b);
      extras.set(`${r},${c}`, b); grid[r][c] = kind;
    };

    // ----- particles: dirt spraying off the bit -----
    const chips = [];
    const chipGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    const chipMats = [kit.mat(0xa4562e), kit.mat(0x7a3e22), kit.mat(0xc8a080)];
    const spray = (x, y, k = 4, mat = null) => { for (let i = 0; i < k && chips.length < 240; i++) { const m = new THREE.Mesh(chipGeo, mat || chipMats[(rng() * 3) | 0]); m.position.set(x, y, 0.8); scene.add(m); chips.push({ m, vx: (rng() - 0.5) * 5, vy: 1 + rng() * 4, t: 0 }); } };
    const pops = [];
    const pop = (x, y, text, color, size = 1) => {
      const c = document.createElement('canvas'); c.width = 512; c.height = 140;
      const g = c.getContext('2d'); g.font = '900 84px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 14; g.strokeStyle = '#1a0d08'; g.strokeText(text, 256, 74, 500); g.fillStyle = color; g.fillText(text, 256, 74, 500);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); sp.scale.set(4.2 * size, 1.15 * size, 1); sp.renderOrder = 20;
      sp.position.set(x, y, 2); scene.add(sp); pops.push({ sp, life: 0 });
    };
    const booms = [];
    const boom = (x, y, color, size) => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 })); m.position.set(x, y, 0.8); scene.add(m); booms.push({ m, t: 0, size }); };
    let shake = 0;

    // ----- the diggers -----
    const makeHammer = (color) => {
      const g = new THREE.Group(), steel = kit.mat(0x9aa0a6, { metalness: 0.9, roughness: 0.3 }), paint = kit.mat(new THREE.Color(color).getHex(), { roughness: 0.4 });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.55, 14), paint); body.position.y = 0.42; g.add(body);
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.62, 8), kit.mat(0x222222)); bar.rotation.z = Math.PI / 2; bar.position.y = 0.72; g.add(bar);
      for (const s of [-1, 1]) { const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 8), kit.mat(0x1a1a1a)); grip.rotation.z = Math.PI / 2; grip.position.set(s * 0.32, 0.72, 0); g.add(grip); }
      const bit = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.38, 8), steel); bit.rotation.x = Math.PI; bit.position.y = 0.05; g.add(bit);
      const pegs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.12), steel); pegs.position.y = 0.2; g.add(pegs); // foot pegs
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      return g;
    };
    const starts = players.map((_, i) => Math.round(((i + 0.5) / n) * (COLS - 1)));
    const diggers = players.map((p, i) => {
      const root = new THREE.Group(); scene.add(root);
      const hammer = makeHammer(p.color); root.add(hammer);
      const doll = mg.makeDoll(p, { scale: DOLL }); doll.group.position.y = 0.2; root.add(doll.group);
      // a hard hat with a lamp on it
      const hat = new THREE.Group(); doll.head.add(hat); hat.position.y = 0.32;
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.46, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), kit.mat(0xffd23f, { roughness: 0.4 })); hat.add(dome);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.05, 20), kit.mat(0xffd23f, { roughness: 0.4 })); hat.add(brim);
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 10), kit.mat(0xffffff, { emissive: 0xfff2c0, emissiveIntensity: 3 })); lamp.rotation.x = Math.PI / 2; lamp.position.set(0, 0.2, 0.45); hat.add(lamp);
      const light = new THREE.PointLight(0xfff0c8, 9, 5); light.position.set(0, 1.2, 1.2); root.add(light);
      const c = starts[i];
      return { p, root, doll, hammer, c, r: -1, x: cx(c), y: 0, prog: 0, side: 0, moveT: 0, from: null, to: null, mash: 0, held: 0, input: { x: 0, held: 0 },
        power: null, turbo: 0, diamond: 0, stun: 0, depth: 0, won: false, falling: false, buzz: rng() * 10,
        bot: p.bot ? { rate: 4 + rng() * 3, tap: 0, dir: 0, think: 0, powT: 1 + rng() * 2 } : null };
    });
    let winner = null, endT = null, tAll = 0;

    const dig = (d, r, c) => {
      const k = get(r, c);
      if (k === 'air') return;
      if (k === 'opal' && !d.power) {
        const keys = Object.keys(POWERS), w = { dynamite: 1, diamond: 1, turbo: 1.2, rockfall: 0.8 };
        let x = rng() * Object.values(w).reduce((a, b) => a + b, 0); d.power = keys.find((id) => (x -= w[id]) <= 0) || 'turbo';
        pop(d.x, d.y + 2, `${POWERS[d.power].emoji} ${POWERS[d.power].name}`, '#7fe0ff', 0.75); sfx.play('item');
      }
      if (k === 'gas') {
        // a pocket of gas: boom, and up you go
        for (let rr = r - 1; rr <= r + 1; rr++) for (let cc = c - 1; cc <= c + 1; cc++) if (get(rr, cc) !== 'rock' && get(rr, cc) !== 'lead' && rr >= 0) { hide(rr, cc); grid[rr][cc] = 'air'; }
        boom(cx(c), cy(r), 0x9aff5a, 1.6); sfx.play('boom'); shake = 0.5;
        d.stun = 1.1; d.r = Math.max(-1, d.r - 3); d.y = d.r < 0 ? 0 : cy(d.r) - CS / 2; d.doll.flinch();
        while (d.r >= 0 && get(d.r, d.c) !== 'air') { hide(d.r, d.c); grid[d.r][d.c] = 'air'; }
        pop(d.x, d.y + 2, 'GAS!', '#9aff5a', 0.8);
        return;
      }
      hide(r, c); grid[r][c] = 'air';
      spray(cx(c), cy(r) + CS / 2, k === 'bones' ? 6 : 4, k === 'bones' ? boneM : null);
    };
    const usePower = (d) => {
      if (!d.power || d.won) return;
      const k = d.power; d.power = null;
      sfx.play(k === 'dynamite' ? 'bigboom' : 'event');
      if (k === 'turbo') { d.turbo = 5; pop(d.x, d.y + 2, 'TURBO!', '#ffd23f', 0.8); }
      else if (k === 'diamond') { d.diamond = 7; pop(d.x, d.y + 2, 'DIAMOND BIT!', '#7fe0ff', 0.8); }
      else if (k === 'dynamite') {
        const r0 = Math.max(0, d.r), c0 = d.c;
        for (let rr = r0 - 1; rr <= r0 + 4; rr++) for (let cc = c0 - 2; cc <= c0 + 2; cc++) { if (rr < 0 || rr >= ROWS - 1 || cc < 0 || cc >= COLS) continue; const g = get(rr, cc); if (g === 'lead' || g === 'air') continue; if (Math.abs(cc - c0) + Math.max(0, rr - r0 - 2) > 3) continue; hide(rr, cc); grid[rr][cc] = 'air'; }
        boom(d.x, d.y - 1.5, 0xffa040, 3); shake = 1;
        pop(d.x, d.y + 2, 'KABOOM!', '#ff8a3a');
      } else if (k === 'rockfall') {
        // a boulder lands right under everyone else
        for (const o of diggers) { if (o === d || o.won) continue; const rr = o.r + 1; if (rr >= 0 && rr < ROWS - 1 && get(rr, o.c) !== 'lead') { hide(rr, o.c); show(rr, o.c, 'rock'); pop(o.x, o.y + 2, 'ROCKFALL!', '#c8c8c8', 0.7); } }
        sfx.play('thud');
      }
    };
    const hardness = (d, k) => (k === 'rock' ? (d.diamond > 0 ? 2.5 : Infinity) : DIG[k] || 1);

    // ----- CPU: dig straight down unless something's in the way; head for the lead in the cavern -----
    const botInput = (d, dt) => {
      const b = d.bot;
      b.tap -= dt; let held = 0;
      if (b.tap <= 0) { b.tap = 1 / b.rate; held |= BTN.HAMMER; }
      b.powT -= dt;
      const below = get(d.r + 1, d.c);
      if (d.power && b.powT <= 0) {
        if ((d.power === 'dynamite' || d.power === 'diamond') && below === 'rock') held |= BTN.POWER;
        else if (d.power === 'turbo' || d.power === 'rockfall') held |= BTN.POWER;
        if (held & BTN.POWER) b.powT = 1 + rng() * 2;
      }
      b.think -= dt;
      if (d.r >= CAVE - 1 && below !== 'air') { b.dir = Math.sign(leadC - d.c); return { x: b.dir, held }; }
      if (b.think <= 0) {
        b.think = 0.15;
        const slow = (k) => k === 'rock' && d.diamond <= 0 ? 99 : k === 'bones' ? 3 : k === 'clay' ? 0.6 : k === 'air' ? -1 : 0;
        if (slow(below) <= 0.6) b.dir = 0;
        else {
          // look along this row for the nearest spot with an easier way down
          let best = 0, bs = slow(below) * 2;
          for (const dir of [-1, 1]) for (let k = 1; k < 7; k++) {
            const side = get(d.r, d.c + dir * k); if (side === 'rock' && d.diamond <= 0 || d.c + dir * k < 0 || d.c + dir * k >= COLS) break;
            const s = slow(get(d.r + 1, d.c + dir * k)) * 2 + k * 0.6 + slow(side) * 0.5;
            if (s < bs) { bs = s; best = dir; }
          }
          // never just sit on a rock: pick a way and stick with it
          if (!best && below === 'rock' && d.diamond <= 0) best = b.dir || (rng() < 0.5 ? -1 : 1);
          if (best && (d.c + best < 0 || d.c + best >= COLS || get(d.r, d.c + best) === 'rock')) best = -best;
          b.dir = best;
        }
      }
      return { x: b.dir, held };
    };

    const camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.5, 500);
    const camY = { v: 0 };
    const dist = (W / 2 + 2) / Math.tan(Math.atan(Math.tan(THREE.MathUtils.degToRad(18)) * 16 / 9));

    // ----- split screen: a camera per digger -----
    const split = n >= 2;
    const PANE_H = 15; // metres of ground a pane shows top to bottom
    const paneDist = PANE_H / 2 / Math.tan(THREE.MathUtils.degToRad(18));
    for (const d of diggers) { d.cam = new THREE.PerspectiveCamera(36, 1, 0.5, 200); d.camX = d.x; d.camY = 0; }
    // a bobbing arrow over whoever the pane belongs to, so you can find yourself among the neighbours
    const marker = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.6, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    marker.rotation.x = Math.PI; marker.visible = false; scene.add(marker);
    // rows of panes with no empty cells, the players spread evenly over the rows, picking the row count
    // whose panes come closest to a slightly-wide shape (digging is mostly down, so not too letterboxed)
    const evenRows = (k, AW, AH) => {
      let best = null;
      for (let rows = 1; rows <= k; rows++) {
        const counts = Array.from({ length: rows }, (_, r) => Math.floor(k / rows) + (r < k % rows ? 1 : 0));
        const score = counts.reduce((a, c) => a + c * Math.abs(Math.log((AW / c) / (AH / rows) / 1.2)), 0) / k;
        if (!best || score < best.score) best = { counts, score };
      }
      return best.counts;
    };
    let panes = null, sidebarW = 0, sideT = 0, started = false;
    const layout = () => {
      const Wpx = innerWidth, Hpx = innerHeight, AW = Wpx - sidebarW, rows = evenRows(n, AW, Hpx);
      const out = []; let i = 0;
      rows.forEach((count, row) => { for (let k = 0; k < count; k++, i++) out.push({ d: diggers[i], rect: { x: (k * AW / count) / Wpx, y: row / rows.length, w: AW / count / Wpx, h: 1 / rows.length } }); });
      return out;
    };
    const aimPane = (pn, dt) => {
      const { d, rect } = pn, cam = d.cam, aspect = (rect.w * innerWidth) / (rect.h * innerHeight);
      const visW = PANE_H * aspect, half = W / 2 + 3;
      // keep the digger a bit above the middle so you can see what's coming; don't show past the edges
      const tx = visW / 2 >= half ? 0 : Math.max(-half + visW / 2, Math.min(half - visW / 2, d.x));
      const ty = Math.max(-ROWS * CS + PANE_H * 0.42, Math.min(1.5, d.y - PANE_H * 0.12));
      const k = Math.min(1, dt * (d.falling ? 8 : 4));
      d.camX += (tx - d.camX) * k; d.camY += (ty - d.camY) * k;
      if (cam.aspect !== aspect) { cam.aspect = aspect; cam.updateProjectionMatrix(); }
      cam.position.set(d.camX + (Math.random() - 0.5) * shake * 0.6, d.camY + 1 + (Math.random() - 0.5) * shake * 0.6, paneDist);
      cam.lookAt(d.camX, d.camY, 0);
    };
    // pane frames and name tags, over the canvas but under the minigame's own HUD
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;pointer-events:none;';
    document.body.insertBefore(overlay, document.getElementById('minigame'));
    const side = document.createElement('div');
    side.style.cssText = 'position:absolute;top:0;right:0;bottom:0;background:linear-gradient(180deg,#3a1c10,#1a0c06);display:none;';
    overlay.appendChild(side);
    const frames = diggers.map((d) => {
      const el = document.createElement('div');
      el.style.cssText = `position:absolute;box-sizing:border-box;border:3px solid ${d.p.color};display:none;`;
      el.innerHTML = `<span style="position:absolute;left:0.5rem;bottom:0.5rem;padding:0.2rem 0.7rem;border-radius:0.5rem;background:rgba(10,10,20,0.75);color:#fff;font-weight:900;font-size:clamp(0.8rem,1.6vw,1.4rem);white-space:nowrap;border-left:0.35rem solid ${d.p.color};"></span>`;
      overlay.appendChild(el);
      return el;
    });
    const drawOverlay = (dt) => {
      // the strip on the right is as wide as the scoreboard the runner puts top right
      if ((sideT -= dt) <= 0) {
        sideT = 0.5;
        const board = document.querySelector('.mg-board'), br = board?.getBoundingClientRect();
        sidebarW = br?.width ? Math.ceil(br.width + 2 * (innerWidth - br.right)) : 0;
      }
      side.style.display = panes ? '' : 'none';
      side.style.width = sidebarW + 'px';
      diggers.forEach((d, i) => {
        const el = frames[i], pn = panes?.[i];
        el.style.display = pn ? '' : 'none';
        if (!pn) return;
        const r = pn.rect;
        el.style.left = r.x * 100 + '%'; el.style.top = r.y * 100 + '%'; el.style.width = r.w * 100 + '%'; el.style.height = r.h * 100 + '%';
        const text = `${d.p.name} · ${Math.round(d.depth * CS)}m${d.power ? ' ' + POWERS[d.power].emoji : ''}`;
        if (el.firstChild.textContent !== text) el.firstChild.textContent = text;
      });
    };

    return {
      camera,
      update(dt, t, running) {
        tAll += dt;
        for (const d of diggers) {
          d.turbo = Math.max(0, d.turbo - dt); d.diamond = Math.max(0, d.diamond - dt); d.stun = Math.max(0, d.stun - dt);
          d.mash = Math.max(0, d.mash - dt * 2.2);
          let inp = { x: 0, held: 0 };
          if (running && !winner) inp = d.bot ? botInput(d, dt) : d.input;
          const newly = inp.held & ~d.held; d.held = inp.held;
          if (newly & BTN.HAMMER) d.mash = Math.min(MASH_MAX, d.mash + MASH);
          if (newly & BTN.POWER) usePower(d);
          if (d.bot) d.held = 0; // CPU taps are one frame long
          // moving between cells
          if (d.moveT > 0) {
            d.moveT -= dt;
            const k = 1 - Math.max(0, d.moveT) / d.moveDur;
            d.x = d.from[0] + (d.to[0] - d.from[0]) * k; d.y = d.from[1] + (d.to[1] - d.from[1]) * k;
          } else if (running && !winner && d.stun <= 0) {
            const below = get(d.r + 1, d.c);
            const goTo = (r, c, dur) => { d.from = [d.x, d.y]; d.r = r; d.c = c; d.to = [cx(c), r < 0 ? 0 : cy(r) - CS / 2]; d.moveT = d.moveDur = dur; d.prog = 0; };
            if (below === 'lead' || (d.r >= 0 && (get(d.r, d.c - 1) === 'lead' || get(d.r, d.c + 1) === 'lead'))) {
              winner = d; d.won = true; endT = tAll; sfx.play('hallelujah'); pop(0, d.y + 4, `${d.p.name.toUpperCase()} STRUCK LEAD!`, '#ffd23f', 1.6);
            } else if (below === 'air') { goTo(d.r + 1, d.c, FALL_T); d.falling = true; }
            else {
              d.falling = false;
              const want = Math.abs(inp.x) > 0.4 ? Math.sign(inp.x) : 0;
              const speed = RATE * (1 + d.mash * 0.45) * (d.turbo > 0 ? 2 : 1);
              if (want) {
                const nc = d.c + want, side = d.r < 0 ? 'air' : get(d.r, nc);
                if (nc >= 0 && nc < COLS) {
                  if (side === 'air' || side === 'lead') { if (side === 'air') goTo(d.r, nc, SIDE_T); }
                  else if (hardness(d, side) < Infinity) {
                    d.side += dt * speed / hardness(d, side) * 0.9;
                    if (d.side >= 1) { d.side = 0; dig(d, d.r, nc); if (d.stun <= 0 && get(d.r, nc) === 'air') goTo(d.r, nc, SIDE_T); }
                  }
                }
              } else d.side = 0;
              // boxed in by rock on three sides: after a few seconds the rock underneath gives way
              const boxed = below === 'rock' && d.diamond <= 0 && d.r >= 0 && hardness(d, get(d.r, d.c - 1)) === Infinity && hardness(d, get(d.r, d.c + 1)) === Infinity;
              d.stuck = boxed ? (d.stuck || 0) + dt : 0;
              if (d.stuck > 3 && d.r + 1 < ROWS - 1) { d.stuck = 0; hide(d.r + 1, d.c); grid[d.r + 1][d.c] = 'air'; spray(d.x, d.y, 10); sfx.play('thud'); pop(d.x, d.y + 2, 'IT CRACKED!', '#ffd23f', 0.7); }
              if (!want && d.moveT <= 0) {
                const h = hardness(d, below);
                if (h < Infinity) {
                  d.prog += dt * speed / h;
                  if (d.prog >= 1) { dig(d, d.r + 1, d.c); if (d.stun <= 0 && get(d.r + 1, d.c) === 'air') goTo(d.r + 1, d.c, 0.08); }
                  if (!d.p.bot && Math.floor(tAll * 12) !== Math.floor((tAll - dt) * 12) && below === 'bones') sfx.play('tick');
                }
              }
            }
          }
          d.depth = Math.max(d.depth, d.r + 1);
          // the look: hammering judders, falling flails
          d.buzz += dt;
          const working = running && !winner && d.moveT <= 0 && !d.falling && d.stun <= 0;
          const jud = working ? Math.sin(d.buzz * 70) * 0.05 * (1 + d.mash * 0.3) : 0;
          d.root.position.set(d.x, d.y + jud, 0.15);
          d.doll.setArms(d.falling ? 1.4 : 0.05, d.falling ? Math.sin(d.buzz * 20) * 0.4 : 0);
          d.doll.group.rotation.z = d.stun > 0 ? Math.sin(d.buzz * 30) * 0.3 : 0;
          d.hammer.rotation.z = d.side > 0 ? Math.sign(d.input.x || d.bot?.dir || 0) * -0.4 : 0;
          d.doll.update(dt);
          if (working && rng() < dt * 8) spray(d.x, d.y, 1);
        }
        // camera: follow the pack down, keeping the deepest digger on screen
        // (once someone's struck lead it's all about them)
        const ys = winner ? [winner.y] : diggers.map((d) => d.y), lo = Math.min(...ys), hi = Math.max(...ys);
        const visH = 2 * dist * Math.tan(THREE.MathUtils.degToRad(18));
        const want = Math.max(lo + visH * 0.32, Math.min((lo + hi) / 2, hi - visH * 0.25));
        camY.v += (Math.max(-ROWS * CS + visH * 0.42, Math.min(1.5, want)) - camY.v) * Math.min(1, dt * 2.5);
        camera.position.set((Math.random() - 0.5) * shake, camY.v + 1.5 + (Math.random() - 0.5) * shake, dist);
        camera.lookAt(0, camY.v, 0);
        if (running) started = true;
        panes = split && !winner && !(started && !running) ? layout() : null; // time's up: one camera for the results
        if (panes) for (const pn of panes) aimPane(pn, dt);
        drawOverlay(dt);
        shake = Math.max(0, shake - dt * 2);
        for (let i = chips.length - 1; i >= 0; i--) { const c = chips[i]; c.t += dt; c.vy -= 14 * dt; c.m.position.x += c.vx * dt; c.m.position.y += c.vy * dt; c.m.rotation.x += dt * 9; if (c.t > 0.8) { scene.remove(c.m); chips.splice(i, 1); } }
        for (let i = booms.length - 1; i >= 0; i--) { const b = booms[i]; b.t += dt; b.m.scale.setScalar(b.size * (0.5 + b.t * 6)); b.m.material.opacity = Math.max(0, 0.9 - b.t * 2); if (b.t > 0.6) { scene.remove(b.m); booms.splice(i, 1); } }
        for (let i = pops.length - 1; i >= 0; i--) { const q = pops[i]; q.life += dt; q.sp.position.y += dt * 1.2; q.sp.material.opacity = Math.min(1, 2.6 - q.life * 1.5); if (q.life > 1.8) { scene.remove(q.sp); pops.splice(i, 1); } }
        for (const e of extras.values()) if (e.children[0]?.material === opalM) e.rotation.y += dt * 2;
      },
      draw(r, target) {
        if (!panes) { r.shadowMap.autoUpdate = true; r.render(scene, camera); return; }
        // a render target's viewport is in its own pixels; the screen's is in CSS pixels
        const size = target ? { x: target.width, y: target.height } : r.getSize(new THREE.Vector2());
        const setRect = (x, y, w, h, on) => {
          if (target) { target.viewport.set(x, y, w, h); target.scissor.set(x, y, w, h); target.scissorTest = on; r.setRenderTarget(target); }
          else { r.setViewport(x, y, w, h); r.setScissor(x, y, w, h); r.setScissorTest(on); }
        };
        // shadows once a frame, not once per pane
        r.shadowMap.autoUpdate = false; r.shadowMap.needsUpdate = true;
        for (const { d, rect } of panes) {
          const x = Math.round(rect.x * size.x), y = Math.round((1 - rect.y - rect.h) * size.y);
          setRect(x, y, Math.round((rect.x + rect.w) * size.x) - x, Math.round((1 - rect.y) * size.y) - y, true);
          marker.visible = true; marker.material.color.set(d.p.color);
          marker.position.set(d.x, d.y + 2.1 + Math.sin(tAll * 5) * 0.12, 0.6);
          r.render(scene, d.cam);
        }
        marker.visible = false;
        setRect(0, 0, size.x, size.y, false);
      },
      dispose() { overlay.remove(); renderer.shadowMap.autoUpdate = true; },
      input(p, m) {
        const d = diggers.find((x) => x.p === p);
        if (!d || m.b !== 'stick') return;
        d.input.x = Math.max(-1, Math.min(1, Number(m.x) || 0));
        d.input.held = Number(m.h) || 0;
      },
      // one winner; everyone else places by how deep they got (in metres)
      scores() { return Object.fromEntries(diggers.map((d) => [d.p.id, d.won ? 1000 : Math.round(d.depth * CS)])); },
      done: () => winner != null && tAll - endT > 3,
    };
  },
};
