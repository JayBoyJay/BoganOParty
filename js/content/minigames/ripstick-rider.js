// Ripstick Rider: everyone's on a ripstick (the two-wheeled caster board you wiggle to ride) down a
// suburban street, footpaths and road. Sway your phone side to side to keep it going, like twisting
// your hips: the faster you sway, the faster you go, and leaning more one way drifts you that way.
// Cracks, potholes, dogs, cats and oncoming cars: hit one and you're off. Fall too far behind and the
// swooping magpie gets you. Bump people out of the way, or PUSH them into things. Pick up a foam
// sword for a much bigger shove. Last rider standing wins; anyone still riding at 1:30 ties.
import { addSky } from '../../host/sky.js';
import { cottage, car as carProp, gumTreeParts } from '../../host/props.js';

const DOLL = 0.62;
const ROAD = 4, VERGE = 5.2, PATH = 7.4, FENCE = 7.7; // half-widths: road edge (kerb), grass verge, footpath, front fences
const VMAX = 7.2, LAT = 3.4, R = 0.42; // top speed, sideways speed per unit of lean, rider radius
const LEASH = 19; // the magpie never sits further back than this behind the leader
const SEG = 14, NSEG = 10; // scenery repeats every SEG metres, NSEG of them
const PUSH_R = 1.9, SWORD_R = 2.7, PUSH_K = 6.5, SWORD_K = 12, PUSH_CD = 1.0, SWORD_HITS = 3;
const CAR_V = 3; // oncoming cars, m/s

export default {
  id: 'ripstick-rider',
  name: 'Ripstick Rider',
  blurb: 'Wiggle down the street on a ripstick. Dodge the cracks, the pets and the traffic. Last one riding wins.',
  howTo: 'Hold your phone like a steering wheel and keep swaying it side to side to ride: faster sway, faster board. Lean more one way to drift that way. Tap PUSH to shove whoever is next to you. Grab a foam sword for a massive shove. Hit anything and you are out.',
  padText: 'Keep swaying! PUSH to shove',
  duration: 90,
  pad: { kind: 'tilt', buttons: [{ id: 'push', label: '👐 PUSH', tone: 'go', wide: true }] },

  create(mg) {
    const { THREE, kit, scene, players, rng, renderer, sfx } = mg;

    // ----- an Adelaide street on a summer arvo -----
    const { sun } = addSky(scene, renderer, { elevation: 48, azimuth: 200, turbidity: 3, sunIntensity: 3.1, sky: 0xd6e8ff, ground: 0x6b6a52, hemi: 0.6, env: 0.6, shadowSize: 30, fog: [0xcfe0ee, 50, 120] });
    const sunOff = sun.position.clone();

    const LEN = 1200;
    const strip = (x0, x1, m, y = 0) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, LEN), m); p.rotation.x = -Math.PI / 2; p.position.set((x0 + x1) / 2, y, LEN / 2 - 60); p.receiveShadow = true; scene.add(p); return p; };
    const tiled = (name, unit, w, opts = {}) => {
      const m = kit.surf(name, { unit, ...opts }).clone();
      for (const key of ['map', 'normalMap', 'roughnessMap']) { if (!m[key]) continue; m[key] = m[key].clone(); m[key].repeat.set(w / unit, LEN / unit); m[key].needsUpdate = true; }
      return m;
    };
    strip(-ROAD, ROAD, tiled('asphalt', 4, ROAD * 2));
    for (const s of [-1, 1]) {
      const [a, b] = s < 0 ? [-VERGE, -ROAD] : [ROAD, VERGE];
      strip(a, b, tiled('grass', 3, VERGE - ROAD, { tint: 0xb6c78a }), 0.03);
      const [c, d] = s < 0 ? [-PATH, -VERGE] : [VERGE, PATH];
      strip(c, d, tiled('concrete', 2.2, PATH - VERGE, { tint: 0xd8d2c6 }), 0.05);
      const [e, f] = s < 0 ? [-40, -PATH] : [PATH, 40];
      strip(e, f, tiled('grass', 4, 40 - PATH, { tint: 0xa8c070 }), 0.02);
      // kerb and gutter
      kit.box(0.25, 0.15, LEN, kit.surf('concrete', { unit: 1, tint: 0xbab4a8 }), s * (ROAD + 0.12), 0, LEN / 2 - 60).castShadow = false;
      kit.box(0.5, 0.012, LEN, kit.mat(0x8f8c86, { roughness: 0.9 }), s * (ROAD - 0.25), 0, LEN / 2 - 60).castShadow = false;
      // expansion joints across the footpath
      const joints = new THREE.InstancedMesh(new THREE.BoxGeometry(PATH - VERGE, 0.01, 0.04), kit.mat(0x8a857c), Math.ceil(LEN / 1.8));
      for (let i = 0; i < joints.count; i++) joints.setMatrixAt(i, new THREE.Matrix4().makeTranslation(s * (PATH + VERGE) / 2, 0.056, -60 + i * 1.8));
      scene.add(joints);
    }
    // dashed centre line
    const dash = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.14, 3), kit.mat(0xf2f0e6, { roughness: 0.7 }), Math.ceil(LEN / 9));
    for (let i = 0; i < dash.count; i++) { const m = new THREE.Matrix4().makeRotationX(-Math.PI / 2); m.setPosition(0, 0.012, -60 + i * 9); dash.setMatrixAt(i, m); }
    dash.receiveShadow = true; scene.add(dash);

    // houses, fences, letterboxes, bins and gums: SEG-metre blocks that leapfrog forward as we ride
    const segs = [];
    const fenceM = kit.surf('brick', { unit: 2.2, tint: 0xe6c9b0 }), paling = kit.surf('planks', { unit: 1.6, tint: 0xb89a74 });
    const houseCols = [0xe8e2d0, 0xd9c7a4, 0xc9d6d0, 0xf0dcc8, 0xd6c1b8, 0xcfd3c2];
    const roofCols = [0x9aa3a8, 0x7d2b22, 0x3c4a52, 0xa8aaa0, 0x5a3c2c];
    const binLid = [0xc0262d, 0xf2c200, 0x2f8a3a];
    const gums = [];
    for (let i = 0; i < NSEG; i++) {
      const g = new THREE.Group(); g.position.z = -30 + i * SEG; scene.add(g);
      for (const s of [-1, 1]) {
        const brick = rng() < 0.5;
        cottage(kit, s * (FENCE + 9.5), 0, -s * Math.PI / 2, { wall: brick ? 'brick' : 'weatherboard', color: houseCols[(rng() * houseCols.length) | 0], roof: roofCols[(rng() * roofCols.length) | 0], w: 9, d: 7 }, g);
        // low front fence with a gap for the driveway
        kit.box(0.25, 0.85, SEG - 3.6, rng() < 0.6 ? fenceM : paling, s * FENCE, 0, -1.8, g);
        kit.box(0.35, 1.0, 0.35, fenceM, s * FENCE, 0, SEG / 2 - 3.5, g);
        kit.box(0.35, 1.0, 0.35, fenceM, s * FENCE, 0, -SEG / 2, g);
        // driveway
        kit.box(3, 0.02, 9, kit.surf('concrete', { unit: 2, tint: 0xc9c2b4 }), s * (FENCE + 4.5), 0, SEG / 2 - 1.8, g).castShadow = false;
        // letterbox on a post
        kit.box(0.08, 1.0, 0.08, 0x6b5a48, s * (FENCE + 0.35), 0, SEG / 2 - 4.2, g);
        kit.box(0.42, 0.3, 0.28, rng() < 0.5 ? 0xb8262a : 0x2c4f7a, s * (FENCE + 0.35), 1.0, SEG / 2 - 4.2, g);
        // wheelie bins out for collection
        if (rng() < 0.7) for (const [j, lid] of [[0, binLid[(rng() * 3) | 0]], [1, 0xc0262d]]) {
          const b = kit.box(0.6, 1.0, 0.7, 0x2e3a2e, s * (FENCE + 1.2), 0, SEG / 2 - 2.4 + j * 0.75, g, { roughness: 0.6 });
          kit.box(0.66, 0.06, 0.78, lid, 0, 0.53, 0, b, { roughness: 0.5 });
        }
        gums.push({ g, x: s * (FENCE + 2.6 + rng() * 1.2), z: -SEG / 2 + 2 + rng() * 4, s: 0.5 + rng() * 0.2 });
      }
      segs.push(g);
    }
    // front-yard gums: instanced, moved with their segment
    const gumParts = gumTreeParts(7, 0.8);
    const gumMeshes = gumParts.map(({ geo, material }) => { const m = new THREE.InstancedMesh(geo, material, gums.length); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; scene.add(m); return m; });
    const placeGums = () => { const M = new THREE.Matrix4(), Q = new THREE.Quaternion(); gums.forEach((t, i) => { Q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), i * 1.7); M.compose(new THREE.Vector3(t.x, 0, t.g.position.z + t.z), Q, new THREE.Vector3(t.s, t.s, t.s)); for (const m of gumMeshes) m.setMatrixAt(i, M); }); for (const m of gumMeshes) m.instanceMatrix.needsUpdate = true; };
    placeGums();

    // ----- pop-up text -----
    const pops = [];
    const pop = (pos, text, color) => {
      const c = document.createElement('canvas'); c.width = 512; c.height = 160;
      const g = c.getContext('2d'); g.font = '900 96px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 14; g.strokeStyle = '#1a0d08'; g.strokeText(text, 256, 84, 500); g.fillStyle = color; g.fillText(text, 256, 84, 500);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); sp.scale.set(3.4, 1.06, 1); sp.renderOrder = 20;
      sp.position.copy(pos); scene.add(sp); pops.push({ sp, life: 0 });
    };

    // ----- the riders -----
    const deckM = (c) => kit.mat(c, { roughness: 0.45 });
    const makeBoard = (color) => {
      const b = new THREE.Group();
      for (const s of [-1, 1]) {
        const deck = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 24), deckM(color));
        deck.scale.set(1.2, 1, 1.45); deck.position.set(0, 0.14, s * 0.23); deck.castShadow = true; b.add(deck);
        const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.01, 24), kit.mat(0x1d1d1d, { roughness: 1 }));
        grip.scale.copy(deck.scale); grip.position.set(0, 0.165, s * 0.23); b.add(grip);
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.045, 16), kit.mat(0x8affd8, { roughness: 0.3, emissive: 0x1a6650, emissiveIntensity: 0.4 }));
        wheel.rotation.z = Math.PI / 2; wheel.position.set(0, 0.055, s * 0.3); b.add(wheel);
        kit.box(0.05, 0.08, 0.05, 0x9a9a9a, 0, 0.08, s * 0.3, b, { metalness: 0.9, roughness: 0.3 });
      }
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 10), kit.mat(0xb8bcc0, { metalness: 0.9, roughness: 0.25 }));
      bar.rotation.x = Math.PI / 2; bar.position.y = 0.13; b.add(bar);
      return b;
    };
    const makeSword = () => {
      const s = new THREE.Group();
      const noodle = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 1.25, 12), kit.mat(0xff3db8, { roughness: 0.85 }));
      noodle.position.y = 0.72; s.add(noodle);
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.07, 0.12), kit.mat(0x3de1ff, { roughness: 0.8 })); guard.position.y = 0.1; s.add(guard);
      const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 10), kit.mat(0x2a2a2a, { roughness: 0.8 })); hilt.position.y = -0.02; s.add(hilt);
      for (const m of [noodle, guard, hilt]) m.castShadow = true;
      return s;
    };
    const n = players.length;
    const riders = players.map((p, i) => {
      const root = new THREE.Group(); scene.add(root);
      const board = makeBoard(new THREE.Color(p.color).getHex()); board.scale.setScalar(1.4); root.add(board);
      const doll = mg.makeDoll(p, { scale: DOLL });
      doll.group.position.y = 0.24; root.add(doll.group);
      const x = n === 1 ? 0 : -6 + (12 * i) / (n - 1) + (rng() - 0.5) * 0.4;
      return { p, root, board, doll, x, z: 0, v: 3.5, kx: 0, a: 0, aPrev: 0, sway: 2, want: 0, out: false, outAt: 0, cd: 0, sword: 0, swordMesh: null, swing: 0,
        fly: null, phase: rng() * 6, om: 4.6 + rng() * 1.0, aim: x, think: 0, lazy: 0, pushT: 0 };
    });
    let order = 0;

    // ----- things in the way -----
    const obstacles = [];
    const crackM = kit.mat(0x2a2622, { roughness: 1 });
    const addCrack = (x, z, w) => {
      const g = new THREE.Group(); g.position.set(x, 0.05, z); scene.add(g);
      const onRoad = Math.abs(x) < ROAD;
      if (onRoad) {
        // a pothole: dark ragged patch with a lip of broken bitumen
        const hole = new THREE.Mesh(new THREE.CircleGeometry(0.5, 14), kit.mat(0x1c1a18, { roughness: 1 })); hole.rotation.x = -Math.PI / 2; hole.scale.set(w, 0.8, 1); g.add(hole);
        for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; kit.box(0.18, 0.05, 0.12, 0x45423e, Math.cos(a) * w * 0.5, -0.04, Math.sin(a) * 0.4, g); }
      } else {
        // a footpath slab heaved up by a tree root, with a jagged crack
        const slab = kit.box(w, 0.12, 0.9, kit.surf('concrete', { unit: 2.2, tint: 0xcdc6b8 }), 0, -0.02, 0, g);
        slab.rotation.x = 0.12;
        for (let i = 0; i < 6; i++) { const c = kit.box(w / 6 + 0.05, 0.02, 0.05, crackM, -w / 2 + (i + 0.5) * w / 6, 0.1, -0.4 + (i % 2 ? 0.08 : -0.05), g); c.rotation.y = (i % 2 ? 0.4 : -0.4); }
        const root = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, w * 0.9, 8), kit.surf('bark', { unit: 1 })); root.rotation.z = Math.PI / 2; root.position.set(0, 0.02, -0.5); g.add(root);
      }
      obstacles.push({ kind: 'crack', g, x, z, hw: w / 2, hd: 0.42 });
    };
    const makeDog = () => {
      const g = new THREE.Group();
      const fur = kit.mat([0xc89a5c, 0x2a2420, 0xe6ddd0, 0x8a5a34][(rng() * 4) | 0], { roughness: 0.9 });
      kit.box(0.34, 0.3, 0.75, fur, 0, 0.32, 0, g);
      const head = kit.box(0.28, 0.28, 0.3, fur, 0, 0.55, 0.45, g);
      kit.box(0.16, 0.13, 0.18, fur, 0, -0.04, 0.2, head);
      kit.box(0.07, 0.06, 0.05, 0x111111, 0, 0.04, 0.3, head);
      for (const s of [-1, 1]) { const e = kit.box(0.08, 0.18, 0.05, fur, s * 0.12, 0.22, -0.02, head); e.rotation.z = s * 0.3; }
      const legs = [];
      for (const [lx, lz] of [[-0.12, 0.27], [0.12, 0.27], [-0.12, -0.27], [0.12, -0.27]]) legs.push(kit.box(0.08, 0.32, 0.08, fur, lx, 0, lz, g));
      const tail = kit.box(0.06, 0.06, 0.3, fur, 0, 0.5, -0.45, g); tail.rotation.x = 0.7;
      return { g, legs, tail, r: 0.45, sound: 'bark' };
    };
    const makeCat = () => {
      const g = new THREE.Group();
      const fur = kit.mat([0xe08a3c, 0x3a3a3a, 0x9a9a92, 0xf0ece4][(rng() * 4) | 0], { roughness: 0.9 });
      kit.box(0.22, 0.2, 0.48, fur, 0, 0.2, 0, g);
      const head = kit.box(0.2, 0.18, 0.18, fur, 0, 0.36, 0.28, g);
      for (const s of [-1, 1]) kit.cone(0.05, 0.1, fur, s * 0.06, 0.17, 0, head, {}, 4);
      for (const s of [-1, 1]) kit.box(0.03, 0.03, 0.01, 0x9adf3a, s * 0.05, 0.08, 0.095, head, { emissive: 0x4a8a10, emissiveIntensity: 0.6 });
      const legs = [];
      for (const [lx, lz] of [[-0.07, 0.17], [0.07, 0.17], [-0.07, -0.17], [0.07, -0.17]]) legs.push(kit.box(0.05, 0.2, 0.05, fur, lx, 0, lz, g));
      const tail = kit.box(0.04, 0.04, 0.4, fur, 0, 0.36, -0.36, g); tail.rotation.x = -0.9;
      return { g, legs, tail, r: 0.32, sound: 'meow' };
    };
    const addPet = (z) => {
      const dog = rng() < 0.6, pet = dog ? makeDog() : makeCat();
      const side = rng() < 0.5 ? -1 : 1;
      // some stroll across the street, some sit on the footpath and refuse to move
      const crossing = rng() < 0.6;
      const x = crossing ? side * (PATH + 0.5) : side * (VERGE + 0.4 + rng() * (PATH - VERGE - 0.8));
      pet.g.position.set(x, 0.05, z); scene.add(pet.g);
      obstacles.push({ kind: 'pet', ...pet, x, z, vx: crossing ? -side * (dog ? 1.9 : 1.4) : 0, wait: crossing ? 0 : 1e9, t: rng() * 5, barked: false });
    };
    const carCols = [0xb3261e, 0xf2f2ee, 0x1e3a6e, 0x2b2b2b, 0x9aa0a6, 0x2f6b3a];
    const addCar = (z) => {
      // oncoming: they drive on the left, which from where we're riding is the right-hand lane... mostly
      const lane = rng() < 0.75 ? 2 : -2;
      const g = carProp(kit, lane, z, -Math.PI / 2, { color: carCols[(rng() * carCols.length) | 0], style: rng() < 0.35 ? 'ute' : 'sedan' });
      g.position.y = 0;
      const lights = g.children.filter((c) => c.material?.emissive && c.position.x > 2);
      obstacles.push({ kind: 'car', g, x: lane, z, hw: 1.0, hd: 2.45, honked: false, lights });
    };
    const swords = [];
    const addSword = (x, z) => {
      const g = new THREE.Group(); g.position.set(x, 0.3, z); scene.add(g);
      const s = makeSword(); s.rotation.z = 0.5; g.add(s);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.6, 32), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = -0.24; g.add(ring);
      swords.push({ g, x, z });
    };
    const lanePick = () => {
      const r = rng();
      if (r < 0.42) return (rng() < 0.5 ? -1 : 1) * (VERGE + 0.25 + rng() * (PATH - VERGE - 0.5)); // footpath
      return (rng() * 2 - 1) * (ROAD - 0.6);
    };
    let nextZ = 18;
    const spawnAhead = (lead, t) => {
      while (nextZ < lead + 46) {
        const r = rng();
        if (r < 0.42) addCrack(lanePick(), nextZ, 0.9 + rng() * 0.9);
        else if (r < 0.66) addPet(nextZ);
        else if (r < 0.9) addCar(nextZ + 30);
        else if (swords.length < 2) addSword(lanePick(), nextZ);
        nextZ += Math.max(3.2, 7.5 - t * 0.05) * (0.7 + rng() * 0.6);
      }
    };

    // ----- the magpie: swooping season. Fall behind and you're got. -----
    const magpie = new THREE.Group(); scene.add(magpie);
    const blk = kit.mat(0x141414, { roughness: 0.5 }), wht = kit.mat(0xf4f4f0, { roughness: 0.6 });
    const mBody = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 14), blk); mBody.scale.set(0.8, 0.7, 1.5); magpie.add(mBody);
    const mNape = new THREE.Mesh(new THREE.SphereGeometry(0.33, 16, 12), wht); mNape.position.set(0, 0.25, 0.45); magpie.add(mNape);
    const mHead = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), blk); mHead.position.set(0, 0.2, 0.75); magpie.add(mHead);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.45, 10), kit.mat(0x9fa4a8, { roughness: 0.4 })); beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.15, 1.12); magpie.add(beak);
    for (const s of [-1, 1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), kit.mat(0xd04020, { emissive: 0x801000, emissiveIntensity: 0.8 })); eye.position.set(s * 0.18, 0.28, 0.92); magpie.add(eye); }
    const wings = [-1, 1].map((s) => {
      const piv = new THREE.Group(); piv.position.set(s * 0.3, 0.1, 0); magpie.add(piv);
      const w = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.8), blk); w.position.x = s * 0.8; piv.add(w);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.065, 0.3), wht); bar.position.set(s * 0.5, 0, 0.15); piv.add(bar);
      return { piv, s };
    });
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.7), blk); tail.position.set(0, 0, -0.95); magpie.add(tail);
    magpie.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    magpie.scale.setScalar(1.25);
    let zBack = -7, mx = 0;

    const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.5, 260);
    const camF = { z: 0 };
    const tmp = new THREE.Vector3();

    const knockOut = (r, why) => {
      if (r.out) return;
      r.out = true; r.outAt = ++order;
      r.fly = { vx: r.kx * 0.5 + (rng() - 0.5) * 2, vy: why === 'magpie' ? 5 : 4.2, vz: why === 'car' ? -6 : r.v * 0.6, spin: (rng() < 0.5 ? -1 : 1) * (5 + rng() * 4), y: 0, t: 0, why };
      r.doll.flinch();
      sfx.play(why === 'car' ? 'thud' : why === 'magpie' ? 'squeak' : 'bonk');
      tmp.set(r.x, 3.2, r.z);
      pop(tmp, { crack: 'TRIPPED!', pet: 'WOOF!', car: 'BEEEEP!', magpie: 'SWOOPED!' }[why] || 'OUT!', '#ff4a3a');
    };
    const shove = (r) => {
      if (r.out || r.cd > 0) return;
      r.cd = PUSH_CD; r.swing = 1;
      const reach = r.sword ? SWORD_R : PUSH_R;
      let best = null, bd = reach;
      for (const o of riders) { if (o === r || o.out) continue; const d = Math.hypot(o.x - r.x, o.z - r.z); if (d < bd) { bd = d; best = o; } }
      if (!r.p.bot) sfx.play('whoosh');
      if (!best) return;
      const dx = best.x - r.x, dz = best.z - r.z, d = Math.hypot(dx, dz) || 1;
      const k = r.sword ? SWORD_K : PUSH_K;
      best.kx += (dx / d) * k + Math.sign(dx || 1) * k * 0.25;
      best.v = Math.max(0.5, best.v + (dz / d) * k * 0.35);
      best.doll.flinch();
      r.kx -= (dx / d) * k * 0.15;
      sfx.play(r.sword ? 'boing' : 'bonk');
      if (r.sword) { r.sword--; tmp.set(best.x, 2.8, best.z); pop(tmp, 'BONK!', '#ff3db8'); if (!r.sword) { r.swordMesh.removeFromParent(); r.swordMesh = null; } }
    };

    let tAll = 0, endAt = null;
    const alive = () => riders.filter((r) => !r.out);

    return {
      camera,
      update(dt, t, running) {
        tAll += dt;
        const live = alive();
        const lead = live.length ? Math.max(...live.map((r) => r.z)) : (riders[0]?.z || 0);
        if (running) {
          spawnAhead(lead, t);
          // the magpie: a steady pace that creeps up, and never more than LEASH behind the leader
          zBack = Math.max(zBack + (2.4 + t * 0.042) * dt, lead - LEASH);
        }
        // ----- riders -----
        for (const r of riders) {
          if (r.fly) {
            const f = r.fly; f.t += dt;
            if (f.y > 0 || f.vy > 0) { f.vy -= 14 * dt; f.y = Math.max(0, f.y + f.vy * dt); r.x += f.vx * dt; r.z += f.vz * dt; r.doll.body.rotation.z += f.spin * dt; }
            else { f.vx *= 0.9; f.vz *= 0.9; r.doll.body.rotation.z += (Math.PI / 2 * Math.sign(f.spin) - r.doll.body.rotation.z) * Math.min(1, dt * 6); }
            r.doll.group.position.y = 0.24 + f.y; r.board.position.y = Math.max(0, f.y * 0.4); r.board.rotation.x += dt * 8 * (f.y > 0 ? 1 : 0);
            r.root.position.set(r.x, 0, r.z);
            r.doll.update(dt);
            continue;
          }
          if (running && r.p.bot) {
            // CPU: pick the clearest line a little ahead, sway in rhythm, and bias the lean to drift there
            r.think -= dt;
            if (r.think <= 0) {
              r.think = 0.18 + rng() * 0.2;
              const cands = [-6.6, -5.9, -3, -1.6, 0, 1.6, 3, 5.9, 6.6];
              let best = r.aim, bs = -1e9;
              for (const cx of cands) {
                let s = -Math.abs(cx - r.x) * 0.35 + (rng() - 0.5) * 0.8;
                if (Math.abs(cx) > ROAD && Math.abs(cx) < VERGE) s -= 2;
                for (const o of obstacles) {
                  const ahead = o.z - r.z - (o.kind === 'car' ? 0 : 0);
                  const reach = o.kind === 'car' ? 22 : 11;
                  if (ahead < -1 || ahead > reach) continue;
                  const ox = o.kind === 'pet' ? o.x + o.vx * Math.max(0, ahead) / Math.max(2, r.v) : o.x;
                  const hw = (o.hw || o.r) + 0.9;
                  if (Math.abs(cx - ox) < hw) s -= 12 * (1 - ahead / (reach + 2));
                }
                for (const sw of swords) if (Math.abs(sw.x - cx) < 0.8 && sw.z - r.z > 0 && sw.z - r.z < 10) s += 2;
                if (s > bs) { bs = s; best = cx; }
              }
              r.aim = best;
              if (rng() < 0.02) r.lazy = 0.6 + rng() * 0.8; // the odd lapse in rhythm
            }
            r.lazy = Math.max(0, r.lazy - dt);
            r.phase += r.om * dt * (r.lazy > 0 ? 0.45 : 1);
            const bias = Math.max(-0.6, Math.min(0.6, (r.aim - r.x) * 0.45));
            r.want = Math.sin(r.phase) * 0.78 + bias;
            r.pushT -= dt;
            if (r.pushT <= 0) {
              r.pushT = 0.4;
              const near = riders.some((o) => o !== r && !o.out && Math.hypot(o.x - r.x, o.z - r.z) < (r.sword ? SWORD_R : PUSH_R) * 0.9);
              if (near && rng() < (r.sword ? 0.7 : 0.35)) shove(r);
            }
          }
          if (!running) r.want = 0;
          r.a += (r.want - r.a) * Math.min(1, dt * (r.p.bot ? 14 : 20));
          // ripstick drive: how hard you're wiggling (smoothed rate of change of lean)
          const rate = Math.abs(r.a - r.aPrev) / Math.max(dt, 1e-3); r.aPrev = r.a;
          r.sway += (Math.min(rate, 8) - r.sway) * Math.min(1, dt * 1.8);
          const onGrass = Math.abs(r.x) > ROAD + 0.1 && Math.abs(r.x) < VERGE;
          const target = running ? Math.min(VMAX, 0.5 + r.sway * 2.15) * (onGrass ? 0.72 : 1) : 0;
          r.v += (target - r.v) * Math.min(1, dt * (target > r.v ? 1.1 : 0.7));
          r.cd = Math.max(0, r.cd - dt);
          r.kx *= Math.exp(-dt * 3.2);
          if (running) {
            r.x += (r.a * LAT + r.kx) * dt;
            r.z += r.v * dt;
          }
          if (Math.abs(r.x) > FENCE - 0.35) { r.x = Math.sign(r.x) * (FENCE - 0.35); r.kx = -Math.sign(r.x) * 2; r.v *= 0.7; if (running && !r.p.bot) sfx.play('bonk'); }
          // the look: board weaves with the lean, hips twist, arms out for balance
          r.root.position.set(r.x, 0, r.z);
          r.board.rotation.y = -r.a * 0.55;
          r.board.rotation.z = r.a * 0.12;
          r.doll.body.rotation.y = -r.a * 0.32;
          r.doll.body.rotation.z = -r.a * 0.1;
          r.swing = Math.max(0, r.swing - dt * 3.5);
          r.doll.setArms(0.15 + r.swing * 0.9, r.a * 0.5);
          if (r.swordMesh) r.swordMesh.rotation.z = -0.4 - r.swing * 2.2;
          r.doll.update(dt);
        }
        if (running) {
          // ----- riders bump each other -----
          for (let i = 0; i < riders.length; i++) for (let j = i + 1; j < riders.length; j++) {
            const a = riders[i], b = riders[j]; if (a.out || b.out) continue;
            const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
            if (d < R * 2 && d > 1e-4) {
              const o = (R * 2 - d) / 2, nx = dx / d, nz = dz / d;
              a.x -= nx * o; b.x += nx * o; a.z -= nz * o; b.z += nz * o;
              a.kx -= nx * 2.4; b.kx += nx * 2.4;
              if (!a.p.bot || !b.p.bot) sfx.play('squeak');
            }
          }
          // ----- obstacles move, riders hit them -----
          for (let i = obstacles.length - 1; i >= 0; i--) {
            const o = obstacles[i];
            if (o.kind === 'car') {
              o.z -= CAR_V * dt; o.g.position.z = o.z;
              if (!o.honked && live.some((r) => o.z - r.z < 16 && o.z > r.z)) { o.honked = true; sfx.play('horn'); }
            } else if (o.kind === 'pet') {
              o.t += dt;
              if (o.vx) { o.x += o.vx * dt; o.g.rotation.y = Math.sign(o.vx) * Math.PI / 2; o.legs.forEach((l, k) => { l.rotation.x = Math.sin(o.t * 14 + k * Math.PI) * 0.6; }); if (Math.abs(o.x) > PATH + 1) o.vx = 0; }
              else o.g.rotation.y = Math.sin(o.t * 0.7) * 0.6;
              o.tail.rotation.y = Math.sin(o.t * 12) * 0.6;
              o.g.position.x = o.x;
              if (!o.barked && live.some((r) => Math.abs(o.z - r.z) < 6)) { o.barked = true; sfx.play(o.sound); }
            }
            for (const r of riders) {
              if (r.out) continue;
              let hit;
              if (o.kind === 'pet') hit = Math.hypot(o.x - r.x, o.z - r.z) < o.r + R * 0.7;
              else hit = Math.abs(o.x - r.x) < o.hw + R * 0.6 && Math.abs(o.z - r.z) < o.hd + R * 0.5;
              if (hit) knockOut(r, o.kind);
            }
            if (o.z < zBack - 12) { scene.remove(o.g); obstacles.splice(i, 1); }
          }
          for (let i = swords.length - 1; i >= 0; i--) {
            const s = swords[i];
            s.g.rotation.y += dt * 2.4; s.g.position.y = 0.35 + Math.sin(tAll * 3) * 0.08;
            const got = riders.find((r) => !r.out && Math.hypot(r.x - s.x, r.z - s.z) < 0.85);
            if (got) {
              got.sword = SWORD_HITS;
              if (!got.swordMesh) { got.swordMesh = makeSword(); got.swordMesh.scale.setScalar(0.85); got.swordMesh.position.set(0.55, 0.85, 0.15); got.doll.body.add(got.swordMesh); }
              sfx.play('item'); tmp.set(got.x, 3, got.z); pop(tmp, 'FOAM SWORD!', '#ffd23f');
            }
            if (got || s.z < zBack - 5) { scene.remove(s.g); swords.splice(i, 1); }
          }
          for (const r of riders) if (!r.out && r.z < zBack + 0.4) knockOut(r, 'magpie');
          if (endAt == null && (n > 1 ? alive().length <= 1 : alive().length === 0)) endAt = t;
        }
        // ----- the magpie swoops at whoever is last -----
        const last = alive().sort((a, b) => a.z - b.z)[0];
        mx += ((last ? last.x : 0) - mx) * Math.min(1, dt * 1.5);
        const near = last ? Math.max(0, 1 - (last.z - zBack) / 6) : 0;
        magpie.position.set(mx, 3.2 - near * 1.6 + Math.sin(tAll * 4) * 0.3, zBack - 0.6);
        magpie.rotation.x = 0.15 + near * 0.35;
        for (const w of wings) w.piv.rotation.z = w.s * Math.sin(tAll * 16) * 0.7;
        // ----- scenery leapfrogs, the sun's shadows follow -----
        let moved = false;
        for (const g of segs) while (g.position.z < camF.z - 95) { g.position.z += SEG * NSEG; moved = true; }
        if (moved) placeGums();
        // ----- camera: up high in front of the pack, looking back down the street at the riders -----
        // a long lens from well up the street, so what's coming shows at the bottom of the screen
        camF.z += (lead - camF.z) * Math.min(1, dt * 2.5);
        camera.position.set(0, 14, camF.z + 30);
        camera.lookAt(0, 0, camF.z - 3);
        sun.position.copy(sunOff).add(tmp.set(0, 0, camF.z)); sun.target.position.set(0, 0, camF.z);
        for (let i = pops.length - 1; i >= 0; i--) {
          const q = pops[i]; q.life += dt; q.sp.position.y += dt * 1.2;
          q.sp.material.opacity = Math.min(1, 2.4 - q.life * 2);
          if (q.life > 1.2) { scene.remove(q.sp); pops.splice(i, 1); }
        }
      },
      input(p, m) {
        const r = riders.find((x) => x.p === p);
        if (!r || r.out) return;
        if (m.b === 'tilt' && Number.isFinite(m.v)) r.want = Math.max(-1, Math.min(1, m.v / 40));
        else if (m.b === 'push') shove(r);
      },
      // out: the order they came off (1 = first). Still riding: everyone ties on 100
      scores() { return Object.fromEntries(riders.map((r) => [r.p.id, r.out ? r.outAt : 100])); },
      done: () => endAt != null && tAll > 0 && riders.every((r) => !r.fly || r.fly.t > 1.4),
    };
  },
};
