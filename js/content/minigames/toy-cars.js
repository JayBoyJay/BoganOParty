// Toy Cars: Hot Wheels-style orange track laid right through the house: round the coffee table in the
// lounge, through the kitchen under the table and chairs, past the dog's bowl in the dining room and
// back. Three laps. Cars drive themselves flat out; tilt your phone like a steering wheel to steer.
// Each car has the player's doll head poking out of the driver's seat.
// Drive through a ? box to grab a power-up, used straight away: TURBO (a burst of speed), SNAIL (everyone
// ahead of you crawls for a couple of seconds) or LEGO (a brick dropped behind you: hit it and you spin out).
// Whoever's further back is more likely to get the good stuff.
// Physics runs in track coordinates (s along the centre line, u across it) like Marble Mayhem: the
// track turns under you, so you have to steer through the bends or scrape the rail and lose speed.
import { mergeGeometries } from '../../../vendor/BufferGeometryUtils.js';

const LAPS = 3;
const HW = 4.6; // half width of the track
const CAR_L = 1.7, CAR_W = 0.95;
const VMAX = 17, ACC = 9;
const TURBO = { t: 2.6, k: 1.55 }, SNAIL = { t: 2.4, k: 0.5 }, SPIN_T = 1.1, BOX_BACK = 3; // power-ups
const TURN = 2.4; // radians a second at full lock
const AFTER_WIN = 10;

// the centre line, laid out around a house (x east, z south), metres at 10x toy scale
const PATH = [
  [-40, 22], [-41, 0], [-40, -18], [-33, -32], [-18, -37], [0, -36], [14, -37], [26, -40], [40, -38], [50, -30],
  [50, -18], [42, -10], [44, 0], [48, 12], [46, 26], [36, 34], [20, 32], [8, 34], [0, 33], [-12, 34], [-26, 38], [-36, 34],
];

export default {
  id: 'toy-cars',
  name: 'Toy Cars',
  blurb: 'Orange track through the whole house. Three laps. Mind the rails.',
  howTo: 'Your car drives itself flat out. Hold your phone like a steering wheel and tilt to steer. Scrape the rails and you slow down. Drive through the ? boxes for power-ups: TURBO speeds you up, SNAIL slows everyone ahead of you, LEGO drops a brick behind you that spins out whoever hits it. First to finish three laps wins.',
  padText: 'Tilt to steer!',
  duration: 80,
  pad: { kind: 'tilt' },

  create(mg) {
    const { THREE, kit, scene, players, rng } = mg;

    // ----- the track: a smooth closed curve, sampled -----
    const curve = new THREE.CatmullRomCurve3(PATH.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal');
    const N = 900, pts = curve.getSpacedPoints(N);
    pts.pop(); // closed: the last point repeats the first
    const L = curve.getLength(), DS = L / N;
    const tan = pts.map((p, i) => pts[(i + 1) % N].clone().sub(pts[(i - 1 + N) % N]).normalize());
    const nrm = tan.map((t) => new THREE.Vector3(-t.z, 0, t.x)); // +u is to the right of travel
    const yawAt = tan.map((t) => Math.atan2(t.x, t.z));
    // curvature: how fast the track turns, per metre
    const kap = yawAt.map((y, i) => { let d = yawAt[(i + 1) % N] - yawAt[(i - 1 + N) % N]; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d / (2 * DS); });
    const idx = (s) => ((Math.floor(s / DS) % N) + N) % N;
    const lerpAt = (arr, s) => { const f = s / DS, i = Math.floor(f), k = f - i; const a = arr[((i % N) + N) % N], b = arr[(((i + 1) % N) + N) % N]; return a + (b - a) * k; };
    const posAt = (s, u, out = new THREE.Vector3()) => {
      const f = s / DS, i = Math.floor(f), k = f - i, a = ((i % N) + N) % N, b = (a + 1) % N;
      out.copy(pts[a]).lerp(pts[b], k);
      const nx = nrm[a].x + (nrm[b].x - nrm[a].x) * k, nz = nrm[a].z + (nrm[b].z - nrm[a].z) * k;
      return out.set(out.x + nx * u, 0, out.z + nz * u);
    };
    const yawS = (s) => { const i = idx(s), j = (i + 1) % N, k = s / DS - Math.floor(s / DS); let d = yawAt[j] - yawAt[i]; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return yawAt[i] + d * k; };

    // ----- the house -----
    scene.background = new THREE.Color(0x2a2a30);
    {
      const pm = new THREE.PMREMGenerator(mg.renderer), env = new THREE.Scene();
      env.add(new THREE.Mesh(new THREE.BoxGeometry(40, 20, 40), new THREE.MeshBasicMaterial({ color: 0xa8a090, side: THREE.BackSide })));
      const win = new THREE.Mesh(new THREE.PlaneGeometry(14, 8), new THREE.MeshBasicMaterial({ color: 0xffffff })); win.position.set(0, 4, -19.9); env.add(win);
      scene.environment = pm.fromScene(env, 0.04).texture; scene.environmentIntensity = 0.7; pm.dispose();
    }
    scene.add(new THREE.HemisphereLight(0xfff6ea, 0x6a5a48, 1.0));
    const sun = new THREE.DirectionalLight(0xfff0dc, 2.6);
    sun.position.set(-50, 90, 40); sun.target.position.set(0, 0, 0); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
    Object.assign(sun.shadow.camera, { left: -75, right: 75, top: 60, bottom: -60, near: 10, far: 260 });
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.05;
    scene.add(sun, sun.target);
    const floorPlane = (w, d, x, z, material) => { const g = new THREE.PlaneGeometry(w, d); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * d); const m = new THREE.Mesh(g, material); m.rotation.x = -Math.PI / 2; m.position.set(x, -0.02, z); m.receiveShadow = true; scene.add(m); return m; };
    const tiles = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#e9e4da'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#d9d1c2'; g.fillRect(0, 0, 128, 128); g.fillRect(128, 128, 128, 128); g.strokeStyle = '#b8b0a2'; g.lineWidth = 4; for (let i = 0; i <= 256; i += 128) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.moveTo(0, i); g.lineTo(256, i); g.stroke(); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(1 / 8, 1 / 8); t.anisotropy = 8; return t; })();
    floorPlane(64, 92, -32, 0, kit.surf('planks', { unit: 9, tint: 0xd8b890 })); // lounge: floorboards
    floorPlane(64, 46, 32, -23, new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.35 })); // kitchen: tiles
    floorPlane(64, 46, 32, 23, kit.surf('carpet', { unit: 14 })); // dining: the 70s carpet
    floorPlane(300, 300, 0, 0, kit.surf('grass', { unit: 30 })).position.y = -0.2; // the yard outside
    // a rug in the lounge, under the coffee table
    floorPlane(26, 34, -22, 2, kit.surf('velour', { arg: 0x8a2f2a, unit: 6 })).position.y = 0;
    // cutaway walls (like a doll's house), with doorways where the track goes through
    const paper = kit.surf('render', { arg: 0xe8dcc2, unit: 12 });
    const WH = 9, wall = (x0, z0, x1, z1, gaps = []) => {
      // gaps: [from, to] along the wall
      const len = Math.hypot(x1 - x0, z1 - z0), dx = (x1 - x0) / len, dz = (z1 - z0) / len;
      let at = 0; const cuts = [...gaps, [len, len]];
      for (const [a, b] of cuts) {
        if (a > at) { const m = (at + a) / 2; const w = kit.box(dx ? a - at : 1.2, WH, dz ? a - at : 1.2, paper, x0 + dx * m, 0, z0 + dz * m); w.castShadow = true; kit.box(dx ? a - at : 1.3, 0.12, dz ? a - at : 1.3, 0xf4f0e8, x0 + dx * m, WH, z0 + dz * m); }
        at = b;
      }
    };
    wall(-64, -46, 64, -46); wall(-64, 46, 64, 46); wall(-64, -46, -64, 46); wall(64, -46, 64, 46);
    wall(0, -46, 0, 0, [[2, 18]]); wall(0, 0, 0, 46, [[26, 42]]); wall(0, 0, 64, 0, [[36, 56]]);

    // furniture at toy scale (10x)
    const wood = kit.surf('planks', { unit: 6, tint: 0x9a6a44 }), dark = kit.mat(0x3a2a20, { roughness: 0.6 });
    const velour = kit.surf('velour', { unit: 4 });
    // lounge: the mustard couch, the coffee table, the telly
    kit.box(10, 4.5, 26, velour, -58, 0, -2); kit.box(4, 5, 26, velour, -61.5, 4.5, -2); for (const z of [-15, 11]) kit.box(10, 6.5, 2.5, velour, -58, 0, z);
    const ct = kit.group(-22, 0, 2);
    kit.box(14, 0.8, 22, wood, 0, 4.2, 0, ct);
    for (const x of [-6, 6]) for (const z of [-10, 10]) kit.box(0.9, 4.2, 0.9, dark, x, 0, z, ct);
    kit.box(4, 0.3, 4, 0xd8c4a0, 2, 5.0, 3, ct).rotation.y = 0.4; // pizza box
    // giant VB cans and a thong, off the track
    const greenCan = kit.mat(0x1f6a2a, { metalness: 0.8, roughness: 0.3 }), redCan = kit.mat(0xb8201c, { metalness: 0.8, roughness: 0.3 });
    for (const [x, z, c, down] of [[-50, 30, greenCan, 0], [-30, -20, redCan, 1], [-12, 18, greenCan, 0], [20, 22, greenCan, 1], [56, 38, redCan, 0]]) {
      const can = kit.cyl(0.66, 0.66, 2.4, c, x, 0, z, scene, {}, 24);
      if (down) { can.rotation.z = Math.PI / 2; can.position.y = 0.66; }
    }
    const thong = kit.group(-52, 0, -36, 0.6);
    kit.box(3.2, 0.3, 8, 0x2a5ad8, 0, 0, 0, thong); kit.box(0.3, 0.8, 3, 0xffffff, 0, 0.3, -1.4, thong);
    // kitchen: benches along the walls, the fridge, the table and chairs (the track goes underneath)
    kit.box(7, 9, 30, 0xeeeeee, 60.5, 0, -30); kit.box(7.4, 0.6, 30, 0x6a6a70, 60.5, 9, -30, scene, { roughness: 0.3 });
    kit.box(8, 18, 7, 0xd8dce0, 58, 0, -8, scene, { metalness: 0.5, roughness: 0.3 }); // fridge
    const tb = kit.group(24, 0, -17);
    kit.box(18, 0.8, 12, wood, 0, 7.5, 0, tb); for (const x of [-8, 8]) for (const z of [-5, 5]) kit.box(0.9, 7.5, 0.9, dark, x, 0, z, tb);
    for (const [x, z] of [[-4, -9], [4, -9], [-4, 9], [4, 9]]) { const ch = kit.group(x, 0, z, 0, 1, tb); kit.box(4.6, 0.5, 4.6, wood, 0, 4.5, 0, ch); for (const a of [-2, 2]) for (const b of [-2, 2]) kit.box(0.5, 4.5, 0.5, dark, a, 0, b, ch); kit.box(4.6, 5, 0.4, wood, 0, 5, z > 0 ? 2.1 : -2.1, ch); }
    // dining: a dog bed with the dog asleep in it, his bowl, a Lego pile, a footy
    kit.cyl(7, 7.5, 1.6, 0x6a4a3a, 22, 0, 18, scene, { roughness: 1 }); kit.torus(6.5, 1.2, 0x8a6a5a, 22, 1.6, 18).rotation.x = Math.PI / 2;
    const dog = kit.group(22, 1.5, 18, 0.8);
    kit.ball(3, 0xc89a5a, 0, 2, 0, dog).scale.set(1.6, 0.8, 1); kit.ball(1.6, 0xc89a5a, 3.6, 2.4, 1.2, dog); kit.ball(0.6, 0x2a1a10, 5.0, 2.4, 1.4, dog);
    for (const s of [-1, 1]) kit.ball(0.7, 0x8a5a2a, 3.2, 3.4, 1.2 + s * 1.1, dog).scale.set(0.6, 1.4, 0.6);
    kit.cyl(2.2, 1.8, 1.2, 0xc8201c, 34, 0, 18, scene, { metalness: 0.3, roughness: 0.4 });
    for (let i = 0; i < 14; i++) kit.box(2, 1.2, 1, [0xd8201c, 0x1a5ad8, 0xffd23f, 0x2aa84a][i % 4], 12 + rng() * 10, 0, 8 + rng() * 6).rotation.y = rng() * 3;
    const footy = kit.ball(2.2, 0xb84a1a, 56, 1.6, 30); footy.scale.set(1.5, 1, 1); footy.rotation.y = 0.7;

    // ----- the track itself: orange plastic with grooves, side rails, start/finish -----
    const trackTex = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#ff6a10'; g.fillRect(0, 0, 128, 64); g.fillStyle = 'rgba(0,0,0,0.12)'; for (const x of [40, 88]) g.fillRect(x - 3, 0, 6, 64); g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(0, 0, 128, 3); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; })();
    const ribbon = (u0, u1, y0, y1, material, rails = false) => {
      const pos = [], uv = [], ind = [];
      for (let i = 0; i <= N; i++) {
        const a = i % N, s = i * DS;
        for (const [u, y] of rails ? [[u0, y0], [u0, y1], [u1, y1], [u1, y0]] : [[u0, y0], [u1, y0]]) { const p = posAt(s, u); pos.push(p.x, y, p.z); uv.push((u - u0) / (u1 - u0 || 1), s / 6); }
        if (i < N) { const k = rails ? 4 : 2, b = i * k; for (let j = 0; j < k - 1; j++) ind.push(b + j, b + k + j, b + j + 1, b + j + 1, b + k + j, b + k + j + 1); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(ind); g.computeVertexNormals();
      const m = new THREE.Mesh(g, material); m.receiveShadow = true; m.castShadow = rails; scene.add(m); return m;
    };
    const plastic = new THREE.MeshPhysicalMaterial({ map: trackTex, roughness: 0.32, clearcoat: 0.6, side: THREE.DoubleSide });
    ribbon(-HW - 0.25, HW + 0.25, 0.12, 0.12, plastic);
    const railMat = new THREE.MeshPhysicalMaterial({ color: 0xff7a1a, roughness: 0.3, clearcoat: 0.6, side: THREE.DoubleSide });
    ribbon(-HW - 0.45, -HW - 0.2, 0.0, 0.75, railMat, true);
    ribbon(HW + 0.2, HW + 0.45, 0.0, 0.75, railMat, true);
    // start/finish: a chequered strip and an arch made from a ruler and two blocks
    {
      const c = document.createElement('canvas'); c.width = 128; c.height = 32; const g = c.getContext('2d');
      for (let x = 0; x < 8; x++) for (let y = 0; y < 2; y++) { g.fillStyle = (x + y) % 2 ? '#111' : '#fff'; g.fillRect(x * 16, y * 16, 16, 16); }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      // a group facing back down the track: local X runs across it, local +Z towards the cars coming in
      const p = posAt(0, 0), at = kit.group(p.x, 0, p.z, yawS(0) + Math.PI);
      const line = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2 + 0.5, 1.2), new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 }));
      line.rotation.x = -Math.PI / 2; line.position.y = 0.14; at.add(line);
      for (const s of [-1, 1]) kit.box(1.6, 5, 1.6, s > 0 ? 0x1a5ad8 : 0xd8201c, s * (HW + 1.6), 0, 0, at);
      kit.box(HW * 2 + 5, 0.4, 1.4, 0xf2e2a0, 0, 5, 0, at); // a wooden ruler across the top
      kit.sign('FINISH', 6, 1.1, 0, 5.9, 0.75, at, { bg: '#111', fg: '#fff' });
    }

    // ----- the cars -----
    const n = players.length;
    const carBody = (() => {
      // a chunky die-cast body: lower hull, cabin, bonnet scoop
      const hull = new THREE.BoxGeometry(CAR_W, 0.42, CAR_L, 2, 1, 4); hull.translate(0, 0.38, 0);
      const p = hull.attributes.position; for (let i = 0; i < p.count; i++) { const z = p.getZ(i); if (Math.abs(z) > CAR_L * 0.4 && p.getY(i) > 0.5) p.setY(i, p.getY(i) - 0.12); }
      hull.computeVertexNormals();
      return hull;
    })();
    const wheelGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.2, 16); wheelGeo.rotateZ(Math.PI / 2);
    const tyre = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.8 }), chrome = new THREE.MeshStandardMaterial({ color: 0xd0d4d8, metalness: 1, roughness: 0.2 });
    const glass = new THREE.MeshPhysicalMaterial({ color: 0x1a2a3a, roughness: 0.05, metalness: 0.3, clearcoat: 1 });
    const cars = players.map((p, i) => {
      const g = new THREE.Group(); scene.add(g);
      const paint = new THREE.MeshPhysicalMaterial({ color: p.color, roughness: 0.25, metalness: 0.4, clearcoat: 1, clearcoatRoughness: 0.08 });
      const body = new THREE.Mesh(carBody, paint); body.castShadow = true; g.add(body);
      const screen = new THREE.Mesh(new THREE.BoxGeometry(CAR_W * 0.8, 0.28, 0.08), glass); screen.position.set(0, 0.7, 0.22); screen.rotation.x = -0.5; g.add(screen);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, CAR_L * 1.001), new THREE.MeshStandardMaterial({ color: 0xffffff })); stripe.position.y = 0.6; g.add(stripe);
      const wheels = [];
      for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) { const w = new THREE.Group(); w.position.set(x * CAR_W * 0.52, 0.22, z * CAR_L * 0.32); const t = new THREE.Mesh(wheelGeo, tyre); t.castShadow = true; w.add(t); const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.22, 10).rotateZ(Math.PI / 2), chrome); w.add(hub); g.add(w); wheels.push(w); }
      kit.box(CAR_W * 0.9, 0.06, 0.12, chrome, 0, 0.45, -CAR_L / 2, g); // bumper
      // the driver: the player's doll head poking out of the cockpit
      const doll = mg.makeDoll(p, { tag: false });
      const head = doll.head; head.removeFromParent();
      doll.hat?.removeFromParent(); // size the head without the hat, then put the hat back on
      const box = new THREE.Box3().setFromObject(head), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
      if (doll.hat) head.add(doll.hat);
      head.position.sub(c);
      const holder = new THREE.Group(); holder.add(head); holder.scale.setScalar(0.62 / Math.max(sz.x, sz.y)); holder.position.set(0, 0.88, -0.15); g.add(holder);
      // a flag on a stick with their colour, so they can be picked out from up high
      const flagC = document.createElement('canvas'); flagC.width = 256; flagC.height = 64;
      { const fg = flagC.getContext('2d'); fg.fillStyle = p.color; fg.beginPath(); fg.roundRect(4, 4, 248, 56, 18); fg.fill(); fg.font = '900 40px system-ui, sans-serif'; fg.textAlign = 'center'; fg.textBaseline = 'middle'; fg.fillStyle = '#111'; fg.fillText(p.name, 128, 34, 236); }
      const ft = new THREE.CanvasTexture(flagC); ft.colorSpace = THREE.SRGBColorSpace;
      const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: ft, depthTest: false, transparent: true })); tag.scale.set(2.6, 0.65, 1); tag.renderOrder = 10; scene.add(tag);
      // grid: two by two behind the line
      const row = Math.floor(i / 2), col = i % 2;
      return { p, g, wheels, tag, s: -2.4 - row * 2.6, u: (col ? 1 : -1) * HW * 0.45, a: 0, v: 0, steer: 0, want: 0, finished: false, place: 0, scrape: 0, spin: 0, boost: 0, slow: 0, spinOut: 0, fx: null,
        bot: p.bot ? { look: 7 + rng() * 5, err: (rng() - 0.5) * 2.4, skill: 0.75 + rng() * 0.2, wob: rng() * 9 } : null };
    });
    // ----- power-ups: rows of ? boxes across the track, a few spots round the lap -----
    const boxTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 128, 128); gr.addColorStop(0, '#ffe35a'); gr.addColorStop(1, '#ff8a1a');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#fff'; g.lineWidth = 10; g.strokeRect(5, 5, 118, 118);
      g.fillStyle = '#fff'; g.font = '900 92px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 8; g.strokeStyle = '#a84a00'; g.strokeText('?', 64, 70); g.fillText('?', 64, 70);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    const boxMat = new THREE.MeshStandardMaterial({ map: boxTex, emissive: 0xffa020, emissiveMap: boxTex, emissiveIntensity: 0.6, roughness: 0.3, transparent: true, opacity: 0.92 });
    const boxGeo = new THREE.BoxGeometry(1.4, 1.4, 1.4);
    const boxes = [];
    for (const f of [0.18, 0.47, 0.76]) for (const u of [-0.62, -0.2, 0.2, 0.62]) {
      const m = new THREE.Mesh(boxGeo, boxMat); m.castShadow = true; scene.add(m);
      const bs = L * f + (u * 3), bu = u * HW; posAt(bs, bu, m.position); m.position.y = 1.0;
      boxes.push({ s: bs, u: bu, m, back: 0 });
    }
    const brickMat = new THREE.MeshStandardMaterial({ color: 0xe8241c, roughness: 0.35 });
    const brickGeo = (() => { const parts = [new THREE.BoxGeometry(1.0, 0.45, 0.5)]; for (const x of [-0.25, 0.25]) for (const z of [-0.12, 0.12]) { const st = new THREE.CylinderGeometry(0.1, 0.1, 0.12, 14); st.translate(x * 1.5, 0.28, z * 1.6); parts.push(st); } return mergeGeometries(parts.map((g) => g.toNonIndexed())); })();
    const bricks = [];
    // a burst of flame out the back for TURBO, and a sulky purple cloud for SNAIL: both glow past the bloom threshold
    const glowTex = (inner, outer) => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, inner); gr.addColorStop(1, outer); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
    const fireMat = new THREE.SpriteMaterial({ map: glowTex('rgba(255,240,180,1)', 'rgba(255,90,0,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }); fireMat.color.setScalar(3.5);
    const snailMat = new THREE.SpriteMaterial({ map: glowTex('rgba(200,120,255,0.9)', 'rgba(120,40,200,0)'), transparent: true, depthWrite: false }); snailMat.color.setScalar(1.6);
    for (const c of cars) {
      c.fx = { fire: new THREE.Sprite(fireMat), snail: new THREE.Sprite(snailMat) };
      c.fx.fire.position.set(0, 0.45, -CAR_L / 2 - 0.4); c.fx.fire.scale.set(0.9, 0.9, 1); c.g.add(c.fx.fire);
      c.fx.snail.position.set(0, 1.9, 0); c.fx.snail.scale.set(2.2, 1.4, 1); c.g.add(c.fx.snail);
      c.fx.fire.visible = c.fx.snail.visible = false;
    }
    const pops = [];
    const pop = (c, text, color) => {
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const g = cv.getContext('2d');
      g.font = '900 84px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 12; g.strokeStyle = '#111'; g.strokeText(text, 256, 66, 500); g.fillStyle = color; g.fillText(text, 256, 66, 500);
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); sp.scale.set(5, 1.25, 1); sp.renderOrder = 20; scene.add(sp);
      pops.push({ sp, c, life: 0 });
    };
    const wrap = (s) => ((s % L) + L) % L;
    const grab = (c) => {
      // the further back you are, the better your luck
      const order = [...cars].sort((a, b) => b.s - a.s), rank = order.indexOf(c) / Math.max(1, cars.length - 1); // 0 leader .. 1 last
      const r = rng(), turbo = 0.25 + rank * 0.35, snail = 0.15 + rank * 0.35;
      if (r < turbo) { c.boost = TURBO.t; pop(c, 'TURBO!', '#ffb030'); if (!c.p.bot) mg.sfx.play('whoosh'); }
      else if (r < turbo + snail) {
        const ahead = cars.filter((o) => o !== c && !o.finished && o.s > c.s);
        for (const o of ahead) { o.slow = SNAIL.t; pop(o, 'SNAIL\'D', '#c88aff'); }
        pop(c, ahead.length ? 'SNAIL!' : 'SNAIL (no one ahead)', '#c88aff'); mg.sfx.play('deflate');
      } else {
        const m = new THREE.Mesh(brickGeo, brickMat); m.castShadow = true; scene.add(m);
        bricks.push({ s: c.s - CAR_L * 1.4, u: c.u, m, owner: c, life: 0 });
        pop(c, 'LEGO!', '#ff5a4a'); if (!c.p.bot) mg.sfx.play('clank');
      }
    };

    let finishOrder = 0, winAt = null, now = 0;
    const tmp = new THREE.Vector3();

    const camera = new THREE.PerspectiveCamera(42, 16 / 9, 1, 600);
    const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
    let camInit = false;

    return {
      camera,
      update(dt, t, running) {
        now = t;
        for (const c of cars) {
          // steering: phone tilt, or the CPU aiming a little way down the track
          if (c.bot && running) {
            const ahead = c.s + c.bot.look, target = Math.sin(t * 0.7 + c.bot.wob) * HW * 0.35 + c.bot.err;
            const dyaw = (() => { let d = yawS(ahead) - yawS(c.s); while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; })();
            const desiredA = Math.atan2(target - c.u, c.bot.look) * 0.8;
            c.want = Math.max(-1, Math.min(1, ((desiredA - c.a) * 2.2 + dyaw * 1.4) * c.bot.skill));
          }
          c.steer += (c.want - c.steer) * Math.min(1, dt * 10);
          const go = running && !c.finished ? 1 : c.finished ? 0.35 : 0;
          if (c.boost > 0) c.boost -= dt; if (c.slow > 0) c.slow -= dt; if (c.spinOut > 0) c.spinOut -= dt;
          const top = VMAX * go * (c.boost > 0 ? TURBO.k : 1) * (c.slow > 0 ? SNAIL.k : 1) * (c.spinOut > 0 ? 0.25 : 1);
          c.v += ((go ? top : 0) - c.v) * Math.min(1, dt * ACC / VMAX * (go ? (c.boost > 0 ? 3 : c.v > top ? 3 : 1.2) : 2.5));
          if (c.scrape > 0) c.scrape -= dt;
          // the track turns under you (curvature), you turn the car (steering)
          const k = lerpAt(kap, ((c.s % L) + L) % L);
          c.a += (c.steer * TURN * Math.min(1, c.v / 5) - k * c.v * Math.cos(c.a)) * dt;
          c.a = Math.max(-1.2, Math.min(1.2, c.a));
          c.s += c.v * Math.cos(c.a) * dt / Math.max(0.4, 1 - k * c.u);
          c.u += c.v * Math.sin(c.a) * dt;
          const lim = HW - CAR_W * 0.55;
          if (Math.abs(c.u) > lim) {
            c.u = Math.sign(c.u) * lim; c.a *= -0.25; c.v *= 0.9;
            if (c.scrape <= 0) { c.scrape = 0.35; if (!c.p.bot) mg.sfx.play('bonk'); }
          }
          if (running && !c.finished && c.s >= LAPS * L) {
            c.finished = true; c.place = ++finishOrder; if (winAt == null) winAt = t;
            mg.sfx.play(c.place === 1 ? 'hallelujah' : 'coin');
          }
        }
        // ? boxes and LEGO bricks
        for (const b of boxes) {
          if (b.back > 0) { b.back -= dt; b.m.visible = b.back <= 0; b.m.scale.setScalar(b.back <= 0 ? 0.2 : 1); continue; }
          b.m.rotation.set(0.5, now * 1.6, 0.3); b.m.position.y = 1.3 + Math.sin(now * 3 + b.u) * 0.15;
          b.m.scale.setScalar(Math.min(1, b.m.scale.x + dt * 3));
          if (!running) continue;
          const c = cars.find((q) => !q.finished && Math.abs(wrap(q.s) - b.s) < 1.0 && Math.abs(q.u - b.u) < 1.15);
          if (c) { b.back = BOX_BACK; b.m.visible = false; grab(c); }
        }
        for (let i = bricks.length - 1; i >= 0; i--) {
          const B = bricks[i]; B.life += dt;
          posAt(wrap(B.s), B.u, B.m.position); B.m.position.y = 0.12; B.m.rotation.y = yawS(wrap(B.s)) + 0.4;
          const hit = cars.find((q) => (q !== B.owner || B.life > 1.5) && Math.abs(wrap(q.s) - wrap(B.s)) < CAR_L * 0.7 && Math.abs(q.u - B.u) < 0.8);
          if (hit || B.life > 25) {
            if (hit) { hit.spinOut = SPIN_T; hit.v *= 0.5; pop(hit, 'OUCH! LEGO', '#ff5a4a'); mg.sfx.play('bonk'); }
            scene.remove(B.m); bricks.splice(i, 1);
          }
        }
        for (let i = pops.length - 1; i >= 0; i--) { const q = pops[i]; q.life += dt; q.sp.position.copy(q.c.g.position); q.sp.position.y = 3.6 + q.life * 1.5; q.sp.material.opacity = Math.min(1, 2.2 - q.life * 1.6); if (q.life > 1.3) { scene.remove(q.sp); pops.splice(i, 1); } }
        // bumping: cars push each other apart across the track and trade a bit of speed
        for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) {
          const a = cars[i], b = cars[j], ds = b.s - a.s, du = b.u - a.u;
          if (Math.abs(ds) < CAR_L && Math.abs(du) < CAR_W) {
            const pushU = (CAR_W - Math.abs(du)) / 2 * Math.sign(du || 1), pushS = (CAR_L - Math.abs(ds)) / 2 * Math.sign(ds || 1);
            if (Math.abs(du) / CAR_W > Math.abs(ds) / CAR_L) { a.u -= pushU; b.u += pushU; a.a -= 0.08 * Math.sign(du || 1); b.a += 0.08 * Math.sign(du || 1); }
            else { a.s -= pushS; b.s += pushS; const back = ds > 0 ? a : b; back.v *= 0.93; }
          }
        }
        // place the cars
        for (const c of cars) {
          posAt(((c.s % L) + L) % L, c.u, tmp);
          c.g.position.set(tmp.x, 0.12, tmp.z);
          c.g.rotation.y = yawS(((c.s % L) + L) % L) + c.a + (c.spinOut > 0 ? (1 - c.spinOut / SPIN_T) * Math.PI * 4 : 0);
          c.fx.fire.visible = c.boost > 0; if (c.boost > 0) c.fx.fire.scale.setScalar(0.8 + Math.sin(now * 40) * 0.25);
          c.fx.snail.visible = c.slow > 0;
          c.g.rotation.z = -c.steer * 0.06 * Math.min(1, c.v / 8); // body roll
          c.spin += c.v * dt / 0.22;
          c.wheels.forEach((w, i) => { w.rotation.x = c.spin; if (i < 2) w.rotation.y = c.steer * 0.4; });
          c.tag.position.set(tmp.x, 2.6, tmp.z);
        }
        // camera: high and behind the pack, Micro Machines style, pulled back to fit everyone in
        const lead = cars.reduce((a, b) => (b.s > a.s ? b : a));
        const c0 = new THREE.Vector3(); let spread = 0;
        for (const c of cars) c0.add(c.g.position);
        c0.divideScalar(cars.length);
        for (const c of cars) spread = Math.max(spread, c.g.position.distanceTo(c0));
        const focus = c0.clone().lerp(lead.g.position, 0.35);
        const H = Math.max(26, Math.min(70, 22 + spread * 1.5));
        const back = new THREE.Vector3(Math.sin(yawS(((lead.s % L) + L) % L)), 0, Math.cos(yawS(((lead.s % L) + L) % L))).multiplyScalar(-H * 0.35);
        const want = focus.clone().add(back).add(new THREE.Vector3(0, H, H * 0.35));
        if (!camInit) { camPos.copy(want); camLook.copy(focus); camInit = true; }
        const kc = 1 - Math.exp(-dt * 2.2);
        camPos.lerp(want, kc); camLook.lerp(focus, kc * 1.5);
        camera.position.copy(camPos); camera.lookAt(camLook);
      },
      input(p, m) { const c = cars.find((x) => x.p === p); if (c && m.b === 'tilt' && Number.isFinite(m.v)) c.want = Math.max(-1, Math.min(1, m.v / 35)); },
      // live position: finishers by place, the rest by distance; also shows laps
      scores() {
        const st = [...cars].sort((a, b) => (a.finished && b.finished ? a.place - b.place : a.finished ? -1 : b.finished ? 1 : b.s - a.s));
        return Object.fromEntries(st.map((c, i) => [c.p.id, st.length - i]));
      },
      done: () => cars.every((c) => c.finished) || (winAt != null && now - winAt > AFTER_WIN),
    };
  },
};
