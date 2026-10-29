// Ute Muster: everyone's got a ute with a hay bale, an esky, a bar fridge and a swag on the back
// (tailgate's long gone). Drive it across the paddock to the muster yard. Hit the humps flat out and
// your load goes flying; plant your foot and it slides off the back. Every bit of cargo you get there
// with is worth 15, and the first utes in get a bonus on top.
import { addSky } from '../../host/sky.js';
import { gumTreeParts, Batch } from '../../host/props.js';

const LEN = 230, HALF_W = 13; // the paddock: z from 0 down to -LEN, x within ±HALF_W
const VMAX = 17, ACC = 7, BRAKE = 14, STEER = 1.5, UTE_R = 1.3, G = 9.8;
const TRAY = { cz: 1.05, hl: 1.15, hw: 0.82, rail: 0.32 }; // tray centre (ute-local z) and half sizes
const CARGO = [
  { id: 'hay', label: 'HAY BALE', color: 0xe8c860, size: [0.9, 0.5, 0.55], mu: 0.8, at: [-0.38, -0.65] },
  { id: 'esky', label: 'ESKY', color: 0x2a6ad8, size: [0.7, 0.45, 0.45], mu: 0.6, at: [0.4, -0.7] },
  { id: 'fridge', label: 'BAR FRIDGE', color: 0xf2f2f2, size: [0.55, 0.85, 0.55], mu: 0.55, at: [-0.4, 0.25] },
  { id: 'swag', label: 'SWAG', color: 0x3a6a3a, size: [0.85, 0.36, 0.36], mu: 0.45, at: [0.38, 0.3] },
];
const ITEM_PTS = 15, PLACE_PTS = [40, 30, 20, 10];
const MOUNDS = [-38, -84, -128, -172, -205], CREEK = -150, GRID = -60;
const DOLL = 0.48;
const BTN = { HORN: 1 };

export default {
  id: 'ute-muster',
  name: 'Ute Muster',
  blurb: "Get your ute and everything on the back of it across a bumpy paddock. Hay, esky, fridge, swag. Don't lose the esky.",
  howTo: "Push the stick up to go, down to brake, left and right to steer. Your hay bale, esky, bar fridge and swag are loose on the back and there's no tailgate. Floor it and they slide off the back; hit a hump flat out and they fly off. Every bit of cargo you get to the muster yard is worth 15 points, and the first utes in get a bonus. Mind the gum trees. HORN does nothing useful.",
  padText: 'Up to go, down to brake, steer',
  duration: 62,
  pad: { kind: 'stick', buttons: [{ bit: BTN.HORN, label: '📯 HORN' }] },

  create(mg) {
    const { THREE, kit, scene, players, rng, renderer, sfx } = mg;
    const n = players.length;

    // ----- the paddock -----
    const { sun } = addSky(scene, renderer, { elevation: 38, azimuth: 150, turbidity: 4, sunIntensity: 3, sky: 0xcfe0f0, ground: 0x8a7a50, hemi: 0.55, env: 0.5, shadowSize: 40, fog: [0xe0d8c8, 70, 200] });
    const hAt = (x, z) => {
      let h = 0.32 * Math.sin(x * 0.35 + z * 0.08) * Math.sin(z * 0.23 + 1.3) + 0.22 * Math.sin(z * 0.5 + x * 0.12) + 0.12 * Math.sin(x * 0.9 + z * 0.7);
      for (const m of MOUNDS) h += 1.35 * Math.exp(-(((z - m) / 2.6) ** 2));
      h -= 1.6 * Math.exp(-(((z - CREEK) / 4.5) ** 2));
      if (Math.abs(z - GRID) < 1.6) h += 0.07 * Math.sin(z * 14);
      return h;
    };
    const SEGX = 52, SEGZ = 400, PW = HALF_W * 2 + 24, PL = LEN + 60;
    const pg = new THREE.PlaneGeometry(PW, PL, SEGX, SEGZ); pg.rotateX(-Math.PI / 2); pg.translate(0, 0, -LEN / 2);
    { const pos = pg.attributes.position, uv = pg.attributes.uv; for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); pos.setY(i, hAt(x, z)); uv.setXY(i, x, z); } pos.needsUpdate = true; pg.computeVertexNormals(); }
    const groundMat = kit.surf('grass', { unit: 3, tint: 0xc8b070 });
    const paddock = new THREE.Mesh(pg, groundMat); paddock.receiveShadow = true; scene.add(paddock);
    const far = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), kit.surf('grass', { unit: 6, tint: 0xb8a060 })); far.rotation.x = -Math.PI / 2; far.position.set(0, -0.6, -LEN / 2); scene.add(far);
    sun.target.position.set(0, 0, -20);
    // creek water
    const creek = new THREE.Mesh(new THREE.PlaneGeometry(PW, 6), new THREE.MeshStandardMaterial({ color: 0x4a8ab8, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.85 }));
    creek.rotation.x = -Math.PI / 2; creek.position.set(0, -0.85, CREEK); scene.add(creek);
    // fences down both sides
    for (const s of [-1, 1]) for (let z = 4; z > -LEN - 12; z -= 4) { const y = hAt(s * (HALF_W + 1), z); kit.cyl(0.08, 0.1, 1.3, 0x7a6248, s * (HALF_W + 1), y, z); if (z > -LEN - 10) for (const wy of [0.6, 1.1]) { const w = kit.box(0.03, 0.03, 4, 0x9a9a9a, s * (HALF_W + 1), y + wy, z - 2); w.castShadow = false; } }
    // the cattle grid and the start and finish
    for (let k = -5; k <= 5; k++) kit.box(HALF_W * 2, 0.06, 0.1, kit.mat(0x8a8a8a, { metalness: 0.7 }), 0, hAt(0, GRID + k * 0.3) + 0.04, GRID + k * 0.3).castShadow = false;
    const gate = (z, text, bg) => { for (const s of [-1, 1]) kit.cyl(0.18, 0.2, 5, 0x6a4a2a, s * (HALF_W - 1), hAt(s * (HALF_W - 1), z), z); kit.sign(text, HALF_W * 1.4, 1.4, 0, hAt(0, z) + 4.2, z, undefined, { bg, fg: '#ffffff', font: '900 120px system-ui' }); };
    gate(-LEN, 'MUSTER YARD', '#2a5a2a');
    { const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d'); for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { g.fillStyle = (x + y) % 2 ? '#111' : '#fff'; g.fillRect(x * 32, y * 32, 32, 32); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(HALF_W, 1); t.magFilter = THREE.NearestFilter;
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(HALF_W * 2, 1), new THREE.MeshBasicMaterial({ map: t })); fl.rotation.x = -Math.PI / 2; fl.position.set(0, hAt(0, -LEN) + 0.08, -LEN); scene.add(fl); }
    // a sign before each hump
    for (const m of MOUNDS) kit.sign('BUMP', 1.4, 0.6, HALF_W - 0.2, hAt(HALF_W - 0.2, m + 9) + 1.4, m + 9, undefined, { bg: '#ffd200', fg: '#111111', font: '900 100px system-ui' });
    // cattle in the yard at the end, a shed, and gum trees about the place
    { const shed = kit.group(-HALF_W - 9, hAt(-HALF_W - 9, -LEN + 5), -LEN + 5); kit.box(10, 4, 7, kit.surf('corrugated', { unit: 0.9, tint: 0xb8b8b0, metalness: 0.5 }), 0, 0, 0, shed); }
    for (let k = 0; k < 7; k++) { const cx = -8 + rng() * 16, cz = -LEN - 6 - rng() * 8, cow = kit.group(cx, hAt(cx, cz), cz, rng() * 6); kit.box(1.5, 0.8, 0.6, k % 2 ? 0x2a1a10 : 0x8a4a20, 0, 0.6, 0, cow); kit.box(0.5, 0.45, 0.45, k % 2 ? 0x2a1a10 : 0xf0e8d8, 0.9, 1.0, 0, cow); for (const [lx, lz] of [[-0.55, -0.2], [-0.55, 0.2], [0.55, -0.2], [0.55, 0.2]]) kit.box(0.12, 0.6, 0.12, 0x2a1a10, lx, 0, lz, cow); }
    const trees = new Batch(scene), solid = [];
    for (let k = 0; k < 11; k++) {
      const z = -22 - (k + rng() * 0.8) * ((LEN - 34) / 11);
      if (MOUNDS.some((m) => Math.abs(m - z) < 6) || Math.abs(z - CREEK) < 8 || Math.abs(z - GRID) < 4) continue;
      const x = (rng() * 2 - 1) * (HALF_W - 2.5);
      trees.add('gum' + (k % 3), () => gumTreeParts(k % 3 + 4, 0.9), x, hAt(x, z) - 0.1, z, 0.45 + rng() * 0.15);
      solid.push({ x, z, r: 0.55 });
    }
    for (let k = 0; k < 18; k++) { const s = rng() < 0.5 ? -1 : 1, x = s * (HALF_W + 10 + rng() * 14), z = 10 - rng() * (LEN + 20); trees.add('gum' + (k % 3), () => gumTreeParts(k % 3 + 4, 0.9), x, hAt(x, z) - 0.1, z, 0.9 + rng() * 0.4); }
    trees.build();

    // ----- the utes -----
    const pops = [];
    const pop = (x, y, z, text, color, size = 1, stay = 1) => {
      const c = document.createElement('canvas'); c.width = 768; c.height = 160;
      const g = c.getContext('2d'); g.font = '900 104px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 16; g.strokeStyle = '#1a1208'; g.strokeText(text, 384, 84, 750); g.fillStyle = color; g.fillText(text, 384, 84, 750);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); sp.scale.set(4.8 * size, 1 * size, 1); sp.renderOrder = 1000;
      sp.position.set(x, y, z); scene.add(sp); pops.push({ sp, life: 0, stay }); return sp;
    };
    const glass = kit.mat(0x223344, { roughness: 0.1, metalness: 0.5 });
    const tyre = kit.mat(0x1a1a1a, { roughness: 0.9 });
    const makeCargo = (C, parent) => {
      const g = new THREE.Group(); parent.add(g);
      const [w, h, d] = C.size;
      if (C.id === 'swag') { const m = kit.cyl(h / 2, h / 2, w, C.color, 0, -w / 2 + h / 2, 0, g); m.rotation.z = Math.PI / 2; m.position.y = h / 2; for (const s of [-0.25, 0.25]) { const strap = kit.cyl(h / 2 + 0.02, h / 2 + 0.02, 0.05, 0x5a3a1a, 0, -0.025, 0, g); strap.rotation.z = Math.PI / 2; strap.position.set(s, h / 2, 0); } }
      else if (C.id === 'esky') { kit.box(w, h * 0.8, d, C.color, 0, 0, 0, g); kit.box(w + 0.03, h * 0.2, d + 0.03, 0xffffff, 0, h * 0.8, 0, g); }
      else if (C.id === 'fridge') { kit.box(w, h, d, C.color, 0, 0, 0, g, { roughness: 0.3 }); kit.box(0.04, h * 0.4, 0.04, 0x888888, w / 2 - 0.08, h * 0.45, d / 2 + 0.02, g); kit.box(w * 0.9, 0.01, 0.01, 0x9a9a9a, 0, h * 0.72, d / 2 + 0.01, g); }
      else { kit.box(w, h, d, C.color, 0, 0, 0, g); for (const s of [-0.22, 0.22]) kit.box(0.03, h + 0.02, d + 0.02, 0xc84a2a, s, -0.01, 0, g); }
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      return g;
    };
    const utes = players.map((p, k) => {
      const grp = new THREE.Group(); scene.add(grp);
      const body = new THREE.Group(); grp.add(body); // tilts with the ground
      const paint = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(p.color), metalness: 0.5, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.1 });
      kit.box(2.0, 0.45, 4.6, paint, 0, 0.45, 0.1, body).castShadow = true; // chassis
      kit.box(1.95, 0.95, 1.7, paint, 0, 0.9, -1.0, body).castShadow = true; // cab
      kit.box(1.8, 0.55, 0.05, glass, 0, 1.2, -1.86, body); kit.box(1.8, 0.5, 0.05, glass, 0, 1.2, -0.14, body); for (const s of [-1, 1]) kit.box(0.05, 0.5, 1.2, glass, s * 0.98, 1.22, -1.0, body);
      kit.box(1.98, 0.35, 0.6, paint, 0, 0.75, -2.0, body); // bonnet
      kit.box(1.9, 0.08, 0.08, 0x9a9a9a, 0, 0.62, -2.3, body, { metalness: 0.8 }); kit.box(2.1, 0.25, 0.25, 0x222222, 0, 0.35, -2.4, body); // bullbar
      const trayG = new THREE.Group(); trayG.position.set(0, 0.9, TRAY.cz); body.add(trayG);
      kit.box(TRAY.hw * 2 + 0.1, 0.06, TRAY.hl * 2, 0x5a5a5a, 0, -0.06, 0, trayG, { metalness: 0.6, roughness: 0.5 });
      for (const s of [-1, 1]) kit.box(0.06, TRAY.rail, TRAY.hl * 2, paint, s * (TRAY.hw + 0.05), 0, 0, trayG);
      kit.box(TRAY.hw * 2 + 0.1, 0.5, 0.06, 0x2a2a2a, 0, 0, -TRAY.hl - 0.03, trayG); // headboard
      const wheels = [];
      for (const [wx, wz] of [[-1, -1.5], [1, -1.5], [-1, 1.55], [1, 1.55]]) { const w = kit.cyl(0.42, 0.42, 0.32, tyre, wx * 0.98, -0.16, wz, body); w.rotation.z = Math.PI / 2; w.position.y = 0.42; wheels.push(w); }
      const doll = mg.makeDoll(p, { scale: DOLL, tag: false }); doll.group.position.set(-0.4, 0.55, -0.95); doll.group.rotation.y = Math.PI; body.add(doll.group);
      const x = -HALF_W + 2.5 + (k + 0.5) * ((HALF_W * 2 - 5) / n), z = 0;
      const cargo = CARGO.map((C) => ({ C, g: makeCargo(C, trayG), x: C.at[0], z: C.at[1], vx: 0, vz: 0, ly: 0, vy: 0, on: true, air: false, lost: null, spin: 0 }));
      // a little card above the ute showing what's still on the back
      const c = document.createElement('canvas'); c.width = 256; c.height = 108; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const card = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); card.scale.set(2.6, 1.1, 1); card.renderOrder = 800; scene.add(card);
      return { p, k, grp, body, trayG, wheels, doll, cargo, card, c, t, x, z, h: 0, v: 0, ySus: hAt(x, z), vySus: 0, pitch: 0, roll: 0, prevTrayVy: 0, trayVy: 0, trayAy: 0, prevH: 0, done: null, place: 0, honk: 0,
        input: { x: 0, y: 0, held: 0 },
        bot: p.bot ? { skill: 0.72 + rng() * 0.2, care: 0.35 + rng() * 0.4, lane: x, wob: rng() * 6 } : null };
    });
    const drawCard = (U) => {
      const g = U.c.getContext('2d'); g.clearRect(0, 0, 256, 108);
      g.fillStyle = 'rgba(20,14,8,0.8)'; g.beginPath(); g.roundRect(2, 2, 252, 104, 16); g.fill(); g.strokeStyle = U.p.color; g.lineWidth = 5; g.stroke();
      g.fillStyle = '#ffffff'; g.font = '800 34px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(U.p.name, 128, 80, 236);
      U.cargo.forEach((K, i) => { g.fillStyle = K.lost ? 'rgba(255,255,255,0.12)' : `#${new THREE.Color(K.C.color).getHexString()}`; g.beginPath(); g.roundRect(14 + i * 60, 14, 48, 36, 8); g.fill(); if (K.lost) { g.strokeStyle = '#ff5a5a'; g.lineWidth = 5; g.beginPath(); g.moveTo(18 + i * 60, 18); g.lineTo(58 + i * 60, 46); g.stroke(); } });
      U.t.needsUpdate = true;
    };
    utes.forEach(drawCard);
    const lost = [];
    let finishers = 0;
    const loseCargo = (U, K) => {
      K.on = false; K.lost = true; drawCard(U);
      // hand it over to the world, carrying the ute's speed
      const wp = new THREE.Vector3(); K.g.getWorldPosition(wp);
      const q = new THREE.Quaternion(); K.g.getWorldQuaternion(q);
      U.trayG.remove(K.g); scene.add(K.g); K.g.position.copy(wp); K.g.quaternion.copy(q);
      const fx = -Math.sin(U.h), fz = -Math.cos(U.h), rx = Math.cos(U.h), rz = -Math.sin(U.h);
      lost.push({ g: K.g, vx: fx * U.v + rx * K.vx - fx * K.vz, vz: fz * U.v + rz * K.vx - fz * K.vz, vy: Math.max(K.vy, 1.5), spin: new THREE.Vector3(rng() * 6 - 3, rng() * 4 - 2, rng() * 6 - 3), half: K.C.size[1] / 2, rest: false });
      sfx.play('boom'); pop(wp.x, wp.y + 2.5, wp.z, `${U.p.name} LOST THE ${K.C.label}!`, '#ff8a5a', 0.6, 0.9);
    };

    // ----- camera chases the pack -----
    const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.3, 400);
    let camZ = 16, camLook = -6;
    camera.position.set(0, 9, camZ); camera.lookAt(0, 0, camLook);

    let tAll = 0, finishAt = null;
    return {
      camera,
      update(dt, t, running) {
        tAll += dt;
        for (const U of utes) {
          // ----- driving -----
          let steer = 0, thr = 0;
          if (running && !U.done) {
            if (U.bot) {
              const B = U.bot;
              let tx = B.lane + Math.sin(tAll * 0.4 + B.wob) * 1.5;
              for (const s of solid) { const ahead = U.z - s.z; if (ahead > 0 && ahead < 16 && Math.abs(s.x - U.x) < 2.6) { const side = Math.abs(s.x) > HALF_W - 5.5 ? -Math.sign(s.x) : U.x >= s.x ? 1 : -1; tx = s.x + side * 3.4; break; } }
              tx = Math.max(-HALF_W + 2, Math.min(HALF_W - 2, tx));
              // aim the nose at a point down the paddock
              const want = Math.atan2(-(tx - U.x), 12); let dh = want - U.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); steer = Math.max(-1, Math.min(1, -dh * 3));
              const bumpAhead = MOUNDS.some((m) => U.z - m > -2 && U.z - m < 14) || (U.z - CREEK > -4 && U.z - CREEK < 16);
              const want_v = bumpAhead ? VMAX * (1 - B.care) * 0.9 : VMAX * B.skill;
              thr = U.v < want_v - 0.5 ? (U.v < 6 ? 0.5 : 0.8) : U.v > want_v + 1 ? -0.6 : 0.1;
              // wedged against something: back out and try again
              if (B.reverse > 0) { B.reverse -= dt; thr = -0.8; steer = -steer; }
              else if (Math.abs(U.v) < 1 && tAll > 4) { B.stuck = (B.stuck || 0) + dt; if (B.stuck > 1.2) { B.stuck = 0; B.reverse = 0.9; } } else B.stuck = 0;
            } else { steer = U.input.x; thr = U.input.y; }
          }
          if (U.done) thr = U.v > 0.5 ? -0.8 : 0;
          if (thr >= 0) U.v += thr * ACC * dt * (1 - Math.max(0, U.v) / (VMAX * 1.05));
          else U.v += thr * (U.v > 0 ? BRAKE : ACC * 0.5) * dt;
          // slope slows you going up, speeds you going down
          const fx = -Math.sin(U.h), fz = -Math.cos(U.h);
          const slope = (hAt(U.x + fx * 1.5, U.z + fz * 1.5) - hAt(U.x - fx * 1.5, U.z - fz * 1.5)) / 3;
          U.v -= slope * G * 0.6 * dt; U.v *= Math.exp(-dt * 0.15); U.v = Math.max(-5, Math.min(VMAX, U.v));
          const prevH = U.h;
          U.h -= steer * STEER * Math.min(1, Math.abs(U.v) / 5) * Math.sign(U.v || 1) * dt;
          U.x += -Math.sin(U.h) * U.v * dt; U.z += -Math.cos(U.h) * U.v * dt;
          const omega = (U.h - prevH) / Math.max(dt, 1e-4);
          // fences, trees, and the start line behind
          if (Math.abs(U.x) > HALF_W - 1.1) { U.x = Math.sign(U.x) * (HALF_W - 1.1); U.v *= 0.9; U.h += (0 - U.h) * Math.min(1, dt * 2); }
          if (U.z > 3) { U.z = 3; U.v = Math.max(0, U.v); }
          let crash = 0;
          for (const s of solid) { const dx = U.x - s.x, dz = U.z - s.z, d = Math.hypot(dx, dz); if (d < UTE_R + s.r) { const nx = dx / (d || 1), nz = dz / (d || 1); U.x = s.x + nx * (UTE_R + s.r); U.z = s.z + nz * (UTE_R + s.r); crash = Math.max(crash, Math.abs(U.v)); U.v *= -0.25; } }
          if (crash > 4) { sfx.play('bigboom'); U.doll.flinch(); pop(U.x, hAt(U.x, U.z) + 3.5, U.z, 'TREE!', '#ffffff', 0.6, 0.5); }
          // suspension: the body springs after the ground, which is what throws the cargo about
          const ground = hAt(U.x, U.z);
          const ay = 140 * (ground - U.ySus) - 14 * U.vySus;
          U.vySus += ay * dt; U.ySus += U.vySus * dt; if (U.ySus < ground - 0.15) { U.ySus = ground - 0.15; U.vySus = Math.max(U.vySus, 0); }
          U.trayAy = (U.vySus - U.prevTrayVy) / Math.max(dt, 1e-4); U.prevTrayVy = U.vySus;
          const hf = hAt(U.x + fx * 1.6, U.z + fz * 1.6), hb = hAt(U.x - fx * 1.6, U.z - fz * 1.6);
          const rxv = Math.cos(U.h), rzv = -Math.sin(U.h);
          const hr = hAt(U.x + rxv, U.z + rzv), hl = hAt(U.x - rxv, U.z - rzv);
          U.pitch += (Math.atan2(hf - hb, 3.2) - U.pitch) * Math.min(1, dt * 10); U.roll += (Math.atan2(hl - hr, 2) - U.roll) * Math.min(1, dt * 10);
          U.grp.position.set(U.x, U.ySus, U.z); U.grp.rotation.y = U.h;
          U.body.rotation.set(U.pitch, 0, -U.roll);
          for (const w of U.wheels) w.rotation.x += U.v * dt / 0.42;
          // ----- the cargo on the back -----
          const aLong = (thr >= 0 ? thr * ACC * (1 - Math.max(0, U.v) / (VMAX * 1.05)) : thr * BRAKE) - slope * G * 0.6;
          const aLat = U.v * omega;
          for (const K of U.cargo) {
            if (!K.on) continue;
            const [w, h, d] = K.C.size;
            // tray-frame pushes: speeding up shoves it back (+z), turning shoves it out, slopes tip it
            let ax = aLat * 1.0 + G * Math.sin(U.roll) * 1.0, az = aLong + G * Math.sin(U.pitch);
            if (crash > 4) { K.vz -= crash * 0.6; K.vy = Math.max(K.vy, crash * 0.25); K.air = true; }
            if (!K.air) {
              if (U.trayAy < -G * 1.05 && U.vySus > 0.6) { K.air = true; K.vy = U.vySus * (1.1 + rng() * 0.3); K.ly = 0.001; }
            }
            if (K.air) {
              K.vy -= G * dt; K.ly += (K.vy - U.vySus) * dt;
              K.spin += dt * 3;
              if (K.ly <= 0) { K.ly = 0; K.air = false; K.vy = 0; if (Math.abs(K.vx) + Math.abs(K.vz) > 0.5 || rng() < 0.4) sfx.play('thud'); K.spin = 0; }
            }
            K.vx += ax * dt; K.vz += az * dt;
            if (!K.air) {
              // friction on the tray
              const s = Math.hypot(K.vx, K.vz), f = K.C.mu * G * dt;
              if (s <= f && Math.hypot(ax, az) < K.C.mu * G) { K.vx = 0; K.vz = 0; }
              else if (s > 0) { const k2 = Math.max(0, s - f) / s; K.vx *= k2; K.vz *= k2; }
            }
            K.x += K.vx * dt; K.z += K.vz * dt;
            // headboard at the front, rails at the sides (unless it's up and over), open at the back
            const hx = TRAY.hw - w / 2, hz = TRAY.hl - d / 2;
            if (K.z < -hz) { K.z = -hz; K.vz = Math.max(0, K.vz) * 0.2; }
            if (Math.abs(K.x) > hx) {
              if (K.ly < TRAY.rail * 0.8) { K.x = Math.sign(K.x) * hx; K.vx *= -0.2; }
              else if (Math.abs(K.x) > TRAY.hw + 0.1) { loseCargo(U, K); continue; }
            }
            if (K.z > TRAY.hl + d * 0.1) { loseCargo(U, K); continue; }
            K.g.position.set(K.x, Math.max(0, K.ly), K.z);
            K.g.rotation.set(K.air ? Math.sin(K.spin) * 0.35 : 0, 0, K.air ? Math.cos(K.spin * 1.3) * 0.25 : 0);
          }
          // a bit of separation so the load doesn't pass through itself
          for (let a = 0; a < U.cargo.length; a++) for (let b = a + 1; b < U.cargo.length; b++) {
            const A = U.cargo[a], B = U.cargo[b]; if (!A.on || !B.on) continue;
            const dx = B.x - A.x, dz = B.z - A.z, need = 0.42;
            if (Math.abs(dx) < need && Math.abs(dz) < need) { if (Math.abs(dx) > Math.abs(dz)) { const p = (need - Math.abs(dx)) / 2 * Math.sign(dx || 1); A.x -= p; B.x += p; } else { const p = (need - Math.abs(dz)) / 2 * Math.sign(dz || 1); A.z -= p; B.z += p; } }
          }
          // across the line
          if (!U.done && U.z <= -LEN) {
            U.done = tAll; U.place = ++finishers; sfx.play(U.place === 1 ? 'hallelujah' : 'cheers'); U.doll.bounce(1.4);
            const kept = U.cargo.filter((K) => K.on).length;
            pop(U.x, hAt(U.x, U.z) + 4, U.z, `#${U.place} ${U.p.name}: ${kept}/4 ON`, U.place === 1 ? '#ffd23f' : '#ffffff', 0.7, 1.4);
            if (finishers === n) finishAt = tAll;
          }
          if (U.input.held & BTN.HORN) { if (U.honk <= 0) { sfx.play('squeak'); U.honk = 0.5; } }
          U.honk -= dt;
          U.card.position.set(U.x, U.ySus + 3.6, U.z);
          U.doll.update(dt);
        }
        // utes shove each other
        for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
          const A = utes[a], B = utes[b], dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz);
          if (d < UTE_R * 2 && d > 1e-4) { const p = (UTE_R * 2 - d) / 2, nx = dx / d, nz = dz / d; A.x -= nx * p; A.z -= nz * p; B.x += nx * p; B.z += nz * p; const avg = (A.v + B.v) / 2; A.v = A.v * 0.7 + avg * 0.3; B.v = B.v * 0.7 + avg * 0.3; }
        }
        // lost cargo tumbles and lies where it fell
        for (const L of lost) {
          if (L.rest) continue;
          L.vy -= G * dt; L.g.position.x += L.vx * dt; L.g.position.y += L.vy * dt; L.g.position.z += L.vz * dt;
          L.g.rotation.x += L.spin.x * dt; L.g.rotation.y += L.spin.y * dt; L.g.rotation.z += L.spin.z * dt;
          const gy = hAt(L.g.position.x, L.g.position.z);
          if (L.g.position.y < gy) { L.g.position.y = gy; L.vy = Math.abs(L.vy) * 0.3; L.vx *= 0.6; L.vz *= 0.6; L.spin.multiplyScalar(0.6); if (Math.abs(L.vy) < 0.5 && Math.hypot(L.vx, L.vz) < 0.4) { L.rest = true; L.g.rotation.x = Math.round(L.g.rotation.x / (Math.PI / 2)) * Math.PI / 2; L.g.rotation.z = Math.round(L.g.rotation.z / (Math.PI / 2)) * Math.PI / 2; } }
        }
        // camera: between the leader and the last ute, pulled back to fit them in
        const zs = utes.map((U) => U.z), lead = Math.min(...zs), last = Math.max(...zs), xs = utes.map((U) => U.x);
        const mid = (lead + last) / 2, spread = last - lead;
        const back = 12 + Math.min(16, spread * 0.25);
        camZ += (last + back - camZ) * Math.min(1, dt * 2.5); camLook += (mid - 7 - camLook) * Math.min(1, dt * 2.5);
        const cx = (Math.min(...xs) + Math.max(...xs)) / 2 * 0.4;
        camera.position.set(camera.position.x + (cx - camera.position.x) * Math.min(1, dt * 2), hAt(0, camZ) + 10 + Math.min(20, spread * 0.45), camZ);
        camera.lookAt(cx, hAt(0, camLook), camLook);
        for (let i = pops.length - 1; i >= 0; i--) { const q = pops[i]; q.life += dt; q.sp.material.opacity = Math.max(0, Math.min(1, q.life * 5, q.stay - q.life + 1)); q.sp.position.y += dt * 0.5; if (q.life > q.stay + 1) { scene.remove(q.sp); pops.splice(i, 1); } }
      },
      input(p, m) {
        const U = utes.find((x) => x.p === p);
        if (!U || m.b !== 'stick') return;
        U.input.x = Math.max(-1, Math.min(1, Number(m.x) || 0)); U.input.y = Math.max(-1, Math.min(1, Number(m.y) || 0)); U.input.held = Number(m.h) || 0;
      },
      scores() {
        return Object.fromEntries(utes.map((U) => {
          const kept = U.cargo.filter((K) => K.on).length;
          return [U.p.id, kept * ITEM_PTS + (U.done ? PLACE_PTS[U.place - 1] || 0 : Math.max(0, Math.min(1, -U.z / LEN)) * 8)];
        }));
      },
      done: () => finishAt != null && tAll - finishAt > 2.5,
    };
  },
};
