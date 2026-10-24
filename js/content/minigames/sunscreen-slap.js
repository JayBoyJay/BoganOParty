// Sunscreen Slap: big Trev fell asleep face down at the beach and he's going pink. Everyone is tiny,
// standing on his back with a bottle of sunscreen. Hold RUB and run about to spread your colour of
// sunscreen. SLAP smacks down a big dollop and knocks anyone nearby flying. You can rub over other
// people's sunscreen. Every few seconds a patch starts to burn: whoever has the most of it covered
// when the timer runs out gets a bonus. Score is how much of his back is yours, plus bonuses.
import { addSky } from '../../host/sky.js';

const RX = 6.6, RZ = 3.8, RY = 1.3, CY = 0.25; // Trev's back is the top of this ellipsoid
const SHORTS_X = 4.5; // boardies start here
const GW = 128, GD = 74, CELL = 4; // the sunscreen grid and its canvas pixels per cell
const DOLL = 0.42;
const SPEED = 3.0, RUB_SPEED = 2.4;
const RUB_R = 0.42, SLAP_R = 1.15, SLAP_CD = 2.6, SLAP_PUSH = 5.5;
const PATCH_R = 0.95, PATCH_T = 5, PATCH_EVERY = [5, 7.5], PATCH_BONUS = 10;
const BTN = { RUB: 1, SLAP: 2 };

export default {
  id: 'sunscreen-slap',
  name: 'Sunscreen Slap',
  blurb: "Trev's asleep face down at the beach and going red. Cover more of his back in your sunscreen than anyone else.",
  howTo: "You're tiny and you're standing on Trev's back. Move with the stick and hold RUB to spread your sunscreen as you go. SLAP drops a big dollop and knocks anyone close by out of the way (it needs a couple of seconds to reload). You can rub over other people's sunscreen. When a red patch starts burning, get your sunscreen on it: whoever covers most of it before the timer runs out gets a bonus. Score is how much of the back is yours.",
  padText: 'Move, hold RUB, SLAP!',
  duration: 60,
  pad: { kind: 'stick', buttons: [{ bit: BTN.RUB, label: '🧴 RUB', tone: 'go' }, { bit: BTN.SLAP, label: '👋 SLAP' }] },

  create(mg) {
    const { THREE, kit, scene, players, rng, renderer, sfx } = mg;
    const n = players.length;

    // ----- the beach -----
    const { sun } = addSky(scene, renderer, { elevation: 62, azimuth: 30, turbidity: 2.5, sunIntensity: 2.4, sky: 0xcfe6ff, ground: 0xb89a6a, hemi: 0.45, env: 0.4, shadowSize: 24, fog: [0xd8eaf8, 50, 140] });
    sun.target.position.set(0, 0, 0);
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), kit.surf('sand', { unit: 3, tint: 0xf0dca8 })); sand.rotation.x = -Math.PI / 2; sand.receiveShadow = true; scene.add(sand);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(90, 30), new THREE.MeshStandardMaterial({ color: 0x2a9ac8, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.92 }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(0, 0.04, -24); scene.add(sea);
    const foam = new THREE.Mesh(new THREE.PlaneGeometry(90, 0.8), kit.mat(0xffffff, { transparent: true, opacity: 0.7 })); foam.rotation.x = -Math.PI / 2; foam.position.set(0, 0.05, -9.2); scene.add(foam);
    // the towel he's lying on
    const towelC = document.createElement('canvas'); towelC.width = 64; towelC.height = 256;
    { const g = towelC.getContext('2d'); ['#e8402a', '#ffd23f', '#2a8ad8', '#ffffff'].forEach((c, k) => { for (let y = k * 16; y < 256; y += 64) { g.fillStyle = c; g.fillRect(0, y, 64, 16); } }); }
    const towelT = new THREE.CanvasTexture(towelC); towelT.colorSpace = THREE.SRGBColorSpace;
    const towel = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 26), new THREE.MeshStandardMaterial({ map: towelT, roughness: 0.95 }));
    towel.rotation.set(-Math.PI / 2, 0, Math.PI / 2); towel.position.set(1.5, 0.02, 0); towel.receiveShadow = true; scene.add(towel);
    // a beach umbrella, flags, an esky and a boogie board
    { const u = kit.group(-10.5, 0, -5.5, 0.3); kit.cyl(0.06, 0.06, 4.2, 0xdddddd, 0, 0, 0, u); const top = kit.cone(2.6, 1, 0xffffff, 0, 4.1, 0, u); top.material = new THREE.MeshStandardMaterial({ color: 0xff6a3a, roughness: 0.8, side: THREE.DoubleSide }); }
    for (const x of [-14, 14]) { const f = kit.group(x, 0, -8); kit.cyl(0.05, 0.05, 3.2, 0xdddddd, 0, 0, 0, f); kit.box(0.9, 0.3, 0.02, 0xff2a2a, 0.45, 2.85, 0, f); kit.box(0.9, 0.3, 0.02, 0xffd23f, 0.45, 2.55, 0, f); }
    { const e = kit.group(11, 0, 4, -0.4); kit.box(1.4, 0.9, 0.9, 0x2a6ac8, 0, 0, 0, e); kit.box(1.46, 0.14, 0.96, 0xffffff, 0, 0.9, 0, e); }
    { const b = kit.box(1, 0.08, 2.4, 0xffd23f, -11, 0.04, 4.5); b.rotation.y = 0.5; }

    // ----- Trev -----
    const skinCol = new THREE.Color(0xe8a888);
    const W = RX * 2, D = RZ * 2;
    const canvas = document.createElement('canvas'); canvas.width = GW * CELL; canvas.height = GD * CELL;
    const cg = canvas.getContext('2d');
    const backTex = new THREE.CanvasTexture(canvas); backTex.colorSpace = THREE.SRGBColorSpace;
    const backGeo = new THREE.SphereGeometry(1, 72, 40);
    { const pos = backGeo.attributes.position, uv = backGeo.attributes.uv;
      for (let i = 0; i < pos.count; i++) { const x = pos.getX(i) * RX, y = pos.getY(i) * RY, z = pos.getZ(i) * RZ; pos.setXYZ(i, x, y + CY, z); uv.setXY(i, (x + RX) / W, 1 - (z + RZ) / D); }
      pos.needsUpdate = true; backGeo.computeVertexNormals(); }
    const back = new THREE.Mesh(backGeo, new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.55 })); back.castShadow = true; back.receiveShadow = true; scene.add(back);
    const skin = kit.mat(skinCol, { roughness: 0.55 });
    const surfY = (x, z) => { const q = 1 - (x / RX) ** 2 - (z / RZ) ** 2; return q > 0 ? CY + RY * Math.sqrt(q) : CY; };
    // a sideways cylinder (limbs and the like), centred on x, y, z
    const limb = (rt, rb, len, m, x, y, z, parent = scene) => { const c = kit.cyl(rt, rb, len, m, x, y - len / 2, z, parent); c.rotation.z = Math.PI / 2; c.castShadow = true; return c; };
    // head, face down in the towel, with a bucket hat pulled over the top of it
    const trev = kit.group(-RX - 1.0, 0, 0);
    { const h = kit.ball(1.35, skin, 0, 1.0, 0, trev); h.scale.set(1.05, 0.9, 1); h.castShadow = true;
      const hair = kit.ball(1.3, 0x5a3a20, -0.25, 1.15, 0, trev); hair.scale.set(1, 0.85, 0.98);
      limb(1.05, 1.3, 0.9, 0xe8e0c0, -0.85, 1.05, 0, trev);
      limb(1.75, 1.75, 0.06, 0xe8e0c0, -0.4, 1.05, 0, trev);
      for (const s of [-1, 1]) { const ear = kit.ball(0.3, skin, 0.15, 0.95, s * 1.33, trev); ear.scale.set(0.6, 1, 0.4); } }
    // arms down his sides, legs off the end
    for (const s of [-1, 1]) {
      limb(0.6, 0.55, 5.4, skin, -3.1, 0.6, s * (RZ + 0.7));
      limb(0.52, 0.45, 4.4, skin, 1.8, 0.5, s * (RZ + 0.75));
      const hand = kit.ball(0.55, skin, 4.4, 0.35, s * (RZ + 0.75)); hand.scale.set(1.2, 0.6, 1);
      limb(1.0, 0.75, 8, skin, RX + 5.2, 0.85, s * 1.55);
    }
    // boardies over his bum and the tops of his legs
    const shortsC = document.createElement('canvas'); shortsC.width = shortsC.height = 128;
    { const g = shortsC.getContext('2d'); g.fillStyle = '#1a6ab8'; g.fillRect(0, 0, 128, 128); for (let k = 0; k < 14; k++) { const x = (k * 37) % 128, y = (k * 53) % 128; g.fillStyle = k % 2 ? '#ffd23f' : '#ff7a3a'; for (let p = 0; p < 5; p++) { g.beginPath(); g.ellipse(x + Math.cos(p * 1.26) * 8, y + Math.sin(p * 1.26) * 8, 6, 3, p * 1.26, 0, 7); g.fill(); } g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); } }
    const shortsT = new THREE.CanvasTexture(shortsC); shortsT.colorSpace = THREE.SRGBColorSpace; shortsT.wrapS = shortsT.wrapT = THREE.RepeatWrapping; shortsT.repeat.set(3, 2);
    const shortsMat = new THREE.MeshStandardMaterial({ map: shortsT, roughness: 0.8 });
    for (const s of [-1, 1]) limb(1.25, 1.15, 2.4, shortsMat, RX + 0.6, 0.9, s * 1.55);

    // ----- the sunscreen grid -----
    // owner per cell: -1 bare skin, -2 not on the back (or on his boardies), else a punter index
    const owner = new Int8Array(GW * GD);
    const cellX = (i) => -RX + (i + 0.5) * (W / GW), cellZ = (j) => -RZ + (j + 0.5) * (D / GD);
    let valid = 0;
    for (let j = 0; j < GD; j++) for (let i = 0; i < GW; i++) {
      const x = cellX(i), z = cellZ(j), on = (x / RX) ** 2 + (z / RZ) ** 2 < 0.94;
      owner[j * GW + i] = on && x < SHORTS_X ? -1 : -2; if (on && x < SHORTS_X) valid++;
    }
    const counts = new Array(n).fill(0);
    const creamCss = players.map((p) => { const c = new THREE.Color(p.color).lerp(new THREE.Color(0xffffff), 0.18); return `#${c.getHexString()}`; });
    const burnAt = (t) => { const k = Math.min(1, t / 45); return `rgb(${236 - k * 16 | 0},${170 - k * 95 | 0},${135 - k * 80 | 0})`; };
    let burnK = 0;
    const paintCell = (i, j) => {
      const o = owner[j * GW + i];
      if (o === -2) {
        const x = cellX(i);
        cg.fillStyle = x >= SHORTS_X ? '#1a6ab8' : '#e8b898';
      } else if (o === -1) cg.fillStyle = burnAt(burnK);
      else cg.fillStyle = creamCss[o];
      cg.fillRect(i * CELL, j * CELL, CELL, CELL);
      if (o >= 0 && ((i * 7 + j * 13) % 5) === 0) { cg.fillStyle = 'rgba(255,255,255,0.45)'; cg.fillRect(i * CELL + 1, j * CELL + 1, 2, 1); }
    };
    const repaintAll = () => {
      for (let j = 0; j < GD; j++) for (let i = 0; i < GW; i++) paintCell(i, j);
      // a spine down the middle and shoulder blades, drawn faintly over the top
      cg.strokeStyle = 'rgba(120,60,40,0.18)'; cg.lineWidth = 3;
      cg.beginPath(); cg.moveTo(0, GD * CELL / 2); cg.lineTo(SHORTS_X / W * GW * CELL + GW * CELL / 2, GD * CELL / 2); cg.stroke();
      for (const s of [-1, 1]) { cg.beginPath(); cg.ellipse(GW * CELL * 0.22, GD * CELL * (0.5 + s * 0.22), 46, 26, 0, 0, 7); cg.stroke(); }
      backTex.needsUpdate = true;
    };
    repaintAll();
    const dirty = new Set();
    const splat = (k, x, z, r, ragged) => {
      const i0 = Math.max(0, Math.floor((x - r + RX) / W * GW)), i1 = Math.min(GW - 1, Math.ceil((x + r + RX) / W * GW));
      const j0 = Math.max(0, Math.floor((z - r + RZ) / D * GD)), j1 = Math.min(GD - 1, Math.ceil((z + r + RZ) / D * GD));
      const wob = ragged ? [0, 1, 2, 3, 4].map(() => rng() * 6.28) : null;
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const idx = j * GW + i, o = owner[idx]; if (o === -2 || o === k) continue;
        const dx = cellX(i) - x, dz = cellZ(j) - z;
        let rr = r; if (wob) { const a = Math.atan2(dz, dx); rr = r * (0.85 + 0.1 * Math.sin(a * 3 + wob[0]) + 0.08 * Math.sin(a * 5 + wob[1])); }
        if (dx * dx + dz * dz > rr * rr) continue;
        if (o >= 0) counts[o]--; owner[idx] = k; counts[k]++; dirty.add(idx);
      }
    };

    // ----- the punters -----
    const pops = [];
    const pop = (x, y, z, text, color, size = 1, stay = 1) => {
      const c = document.createElement('canvas'); c.width = 768; c.height = 160;
      const g = c.getContext('2d'); g.font = '900 100px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 14; g.strokeStyle = '#3a1a10'; g.strokeText(text, 384, 84, 750); g.fillStyle = color; g.fillText(text, 384, 84, 750);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); sp.scale.set(4.8 * size, 1 * size, 1); sp.renderOrder = 1000;
      sp.position.set(x, y, z); scene.add(sp); pops.push({ sp, life: 0, stay }); return sp;
    };
    const bottleGeo = new THREE.CylinderGeometry(0.07, 0.09, 0.32, 12);
    const rubbers = players.map((p, k) => {
      const a = (k / n) * Math.PI * 2 + 0.4;
      const x = Math.cos(a) * 2.6 - 0.6, z = Math.sin(a) * 1.6;
      const doll = mg.makeDoll(p, { scale: DOLL });
      doll.group.position.set(x, surfY(x, z), z); scene.add(doll.group);
      const bottle = new THREE.Mesh(bottleGeo, kit.mat(new THREE.Color(p.color).lerp(new THREE.Color(0xffffff), 0.3), { roughness: 0.4 }));
      bottle.position.set(0.32, 0.55, 0.12); doll.group.add(bottle);
      kit.cyl(0.04, 0.04, 0.08, 0xffffff, 0, 0.18, 0, bottle);
      return { p, k, doll, bottle, x, z, vx: 0, vz: 0, face: 0, cd: 0.5, stun: 0, rubbing: false, bonus: 0,
        input: { x: 0, y: 0, held: 0 },
        bot: p.bot ? { tx: x, tz: z, retarget: 0, slapIn: 2 + rng() * 3, aim: 0.5 + rng() * 0.4 } : null };
    });
    const slap = (R) => {
      if (R.cd > 0 || R.stun > 0) return;
      R.cd = SLAP_CD; splat(R.k, R.x, R.z, SLAP_R, true);
      sfx.play('bonk'); R.doll.bounce(1.4); R.doll.setArms(1.4, 0); R.armT = 0.3;
      for (const o of rubbers) {
        if (o === R) continue;
        const dx = o.x - R.x, dz = o.z - R.z, d = Math.hypot(dx, dz);
        if (d < SLAP_R + 0.3) { const s = SLAP_PUSH / Math.max(0.3, d); o.vx += dx * s * 0.5 + (d < 0.01 ? 3 : 0); o.vz += dz * s * 0.5; o.stun = 0.45; o.doll.flinch(); }
      }
      if (rng() < 0.3) { const words = ['OI!', 'STRUTH!', 'OW!', 'CRIKEY!']; pop(trev.position.x + 2, 3.6, 0, words[rng() * words.length | 0], '#ffffff', 0.7, 0.6); }
    };

    // ----- burning patches -----
    const patchRing = new THREE.Mesh(new THREE.RingGeometry(PATCH_R - 0.12, PATCH_R, 40), new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthTest: false }));
    patchRing.rotation.x = -Math.PI / 2; patchRing.renderOrder = 10; patchRing.visible = false; scene.add(patchRing);
    const timerRing = new THREE.Mesh(new THREE.RingGeometry(PATCH_R + 0.05, PATCH_R + 0.22, 40, 1, 0, Math.PI * 2), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthTest: false }));
    timerRing.rotation.x = -Math.PI / 2; timerRing.renderOrder = 11; timerRing.visible = false; scene.add(timerRing);
    let patch = null, nextPatch = 4.5;
    const patchCells = (px, pz) => { const out = []; for (let j = 0; j < GD; j++) { const dz = cellZ(j) - pz; if (Math.abs(dz) > PATCH_R) continue; for (let i = 0; i < GW; i++) { const dx = cellX(i) - px; if (dx * dx + dz * dz <= PATCH_R * PATCH_R && owner[j * GW + i] !== -2) out.push(j * GW + i); } } return out; };
    const startPatch = () => {
      let px = 0, pz = 0;
      for (let tries = 0; tries < 30; tries++) { px = -RX + 1.4 + rng() * (SHORTS_X - 1 + RX - 1.4); pz = (rng() * 2 - 1) * RZ * 0.6; if ((px / RX) ** 2 + (pz / RZ) ** 2 < 0.62) break; }
      const cells = patchCells(px, pz);
      // the burn wipes what's there
      for (const idx of cells) { const o = owner[idx]; if (o >= 0) { counts[o]--; owner[idx] = -1; dirty.add(idx); } }
      patch = { x: px, z: pz, t: PATCH_T, cells };
      const y = surfY(px, pz) + 0.06;
      patchRing.position.set(px, y, pz); timerRing.position.set(px, y + 0.01, pz); patchRing.visible = timerRing.visible = true;
      sfx.play('tick'); pop(px, y + 1.7, pz, 'BURNING!', '#ff5a3a', 0.6, 0.8);
    };
    const endPatch = () => {
      const tally = new Array(n).fill(0);
      for (const idx of patch.cells) { const o = owner[idx]; if (o >= 0) tally[o]++; }
      const top = Math.max(...tally), y = surfY(patch.x, patch.z) + 1.5;
      if (top >= patch.cells.length * 0.15) {
        const winners = rubbers.filter((R) => tally[R.k] === top);
        for (const R of winners) { R.bonus += PATCH_BONUS; R.doll.bounce(1.2); }
        pop(patch.x, y, patch.z, `${winners.map((R) => R.p.name).join(' & ')} +${PATCH_BONUS}`, '#5cff9d', 0.65, 1.1); sfx.play('coin');
      } else { pop(patch.x, y, patch.z, 'OUCH!', '#ff5a5a', 0.9, 1); sfx.play('lose'); }
      patch = null; patchRing.visible = timerRing.visible = false;
      nextPatch = PATCH_EVERY[0] + rng() * (PATCH_EVERY[1] - PATCH_EVERY[0]);
    };

    // ----- a score bar along the top -----
    const barC = document.createElement('canvas'); barC.width = 1024; barC.height = 96;
    const barT = new THREE.CanvasTexture(barC); barT.colorSpace = THREE.SRGBColorSpace;
    const bar = new THREE.Sprite(new THREE.SpriteMaterial({ map: barT, depthTest: false, transparent: true })); bar.scale.set(11, 1.03, 1); bar.renderOrder = 900;
    bar.position.set(0.4, 0.6, -7.6); scene.add(bar);
    const drawBar = () => {
      const g = barC.getContext('2d'); g.clearRect(0, 0, 1024, 96);
      g.fillStyle = 'rgba(30,20,14,0.75)'; g.beginPath(); g.roundRect(4, 8, 1016, 80, 40); g.fill();
      let x = 24; const w = 976;
      g.fillStyle = burnAt(burnK); g.beginPath(); g.roundRect(24, 22, w, 52, 26); g.fill();
      g.save(); g.beginPath(); g.roundRect(24, 22, w, 52, 26); g.clip();
      for (const R of rubbers) { const f = counts[R.k] / valid; g.fillStyle = R.p.color; g.fillRect(x, 22, f * w, 52); if (f > 0.06) { g.fillStyle = '#1a1008'; g.font = '900 30px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(`${Math.round(f * 100)}%`, x + f * w / 2, 49); } x += f * w; }
      g.restore(); barT.needsUpdate = true;
    };

    const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.3, 200);
    camera.position.set(0.4, 13.5, 10.5);
    camera.lookAt(0.4, 0.6, 0.2);

    let tAll = 0, barT0 = 0, burnT = 0;
    return {
      camera,
      update(dt, t, running) {
        tAll += dt;
        if (running) {
          burnT += dt;
          // sunburn creeps on the bare bits
          const bk = Math.floor(burnT / 3) * 3; if (bk !== burnK) { burnK = bk; repaintAll(); dirty.clear(); }
          if (patch) { patch.t -= dt; if (patch.t <= 0) endPatch(); }
          else if ((nextPatch -= dt) <= 0 && mg.timeLeft() > PATCH_T + 0.5) startPatch();
        }
        for (const R of rubbers) {
          let ix = 0, iz = 0, rub = false;
          if (R.bot && running) {
            const B = R.bot; B.retarget -= dt;
            if (patch) { B.tx = patch.x + Math.sin(tAll * 3 + R.k) * PATCH_R * 0.6; B.tz = patch.z + Math.cos(tAll * 2.4 + R.k) * PATCH_R * 0.6; }
            else if (B.retarget <= 0 || Math.hypot(B.tx - R.x, B.tz - R.z) < 0.3) {
              // head for somewhere that isn't ours yet
              let best = null, bs = -1;
              for (let k = 0; k < 8; k++) { const i = rng() * GW | 0, j = rng() * GD | 0, o = owner[j * GW + i]; if (o === -2) continue; const s = (o === R.k ? 0 : o === -1 ? 1 : 1.3) - Math.hypot(cellX(i) - R.x, cellZ(j) - R.z) * 0.12 + rng() * 0.3; if (s > bs) { bs = s; best = [cellX(i), cellZ(j)]; } }
              if (best) { B.tx = best[0]; B.tz = best[1]; } B.retarget = 1.2 + rng() * 1.6;
            }
            const dx = B.tx - R.x, dz = B.tz - R.z, d = Math.hypot(dx, dz);
            if (d > 0.1) { ix = dx / d * B.aim; iz = dz / d * B.aim; }
            rub = true;
            if ((B.slapIn -= dt) <= 0) { slap(R); B.slapIn = SLAP_CD + rng() * 3; }
          } else if (!R.bot) { ix = R.input.x; iz = -R.input.y; rub = !!(R.input.held & BTN.RUB); }
          if (!running) { ix = iz = 0; rub = false; }
          if (R.stun > 0) { R.stun -= dt; ix = iz = 0; }
          R.cd = Math.max(0, R.cd - dt);
          const sp = rub ? RUB_SPEED : SPEED, m = Math.min(1, Math.hypot(ix, iz));
          const tvx = m > 0.05 ? ix / Math.max(m, 1e-3) * m * sp : 0, tvz = m > 0.05 ? iz / Math.max(m, 1e-3) * m * sp : 0;
          const k = 1 - Math.exp(-dt * (R.stun > 0 ? 1.5 : 10));
          R.vx += (tvx - R.vx) * k; R.vz += (tvz - R.vz) * k;
          R.x += R.vx * dt; R.z += R.vz * dt;
          // stay on his back (and off his boardies)
          const e = (R.x / (RX * 0.93)) ** 2 + (R.z / (RZ * 0.9)) ** 2; if (e > 1) { const s = 1 / Math.sqrt(e); R.x *= s; R.z *= s; R.vx *= 0.3; R.vz *= 0.3; }
          if (R.x > SHORTS_X - 0.2) { R.x = SHORTS_X - 0.2; R.vx = Math.min(0, R.vx); }
          if (Math.hypot(R.vx, R.vz) > 0.3) R.face = Math.atan2(R.vx, R.vz);
          R.rubbing = rub && running && Math.hypot(R.vx, R.vz) > 0.2;
          if (rub && running) splat(R.k, R.x, R.z, RUB_R, false);
          R.doll.group.position.set(R.x, surfY(R.x, R.z), R.z);
          const cur = R.doll.group.rotation.y; let dr = R.face - cur; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); R.doll.group.rotation.y = cur + dr * Math.min(1, dt * 10);
          R.bottle.rotation.x = R.rubbing ? Math.PI * 0.75 + Math.sin(tAll * 18) * 0.2 : 0;
          if (R.armT > 0) R.armT -= dt; else R.doll.setArms(R.rubbing ? 0.5 + Math.sin(tAll * 14 + R.k) * 0.3 : 0, 0);
          R.doll.update(dt);
        }
        // little punters bump each other
        for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
          const A = rubbers[a], B = rubbers[b], dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz);
          if (d < 0.5 && d > 1e-4) { const push = (0.5 - d) / 2; A.x -= dx / d * push; A.z -= dz / d * push; B.x += dx / d * push; B.z += dz / d * push; }
        }
        if (dirty.size) {
          for (const idx of dirty) paintCell(idx % GW, idx / GW | 0);
          dirty.clear(); backTex.needsUpdate = true;
        }
        if (patch) {
          const f = Math.max(0, patch.t / PATCH_T);
          timerRing.geometry.dispose(); timerRing.geometry = new THREE.RingGeometry(PATCH_R + 0.05, PATCH_R + 0.22, 40, 1, Math.PI / 2, Math.PI * 2 * f);
          patchRing.material.opacity = 0.55 + Math.sin(tAll * 10) * 0.35;
        }
        if ((barT0 -= dt) <= 0) { barT0 = 0.15; drawBar(); }
        sea.position.y = 0.04 + Math.sin(tAll * 0.8) * 0.02; foam.position.z = -9.2 + Math.sin(tAll * 0.8) * 0.4;
        for (let i = pops.length - 1; i >= 0; i--) { const q = pops[i]; q.life += dt; q.sp.material.opacity = Math.min(1, q.life * 5, q.stay - q.life + 1); q.sp.position.y += dt * 0.5; if (q.life > q.stay + 1) { scene.remove(q.sp); pops.splice(i, 1); } }
      },
      input(p, m) {
        const R = rubbers.find((x) => x.p === p);
        if (!R || m.b !== 'stick') return;
        const held = Number(m.h) || 0, newly = held & ~R.input.held;
        R.input.x = Math.max(-1, Math.min(1, Number(m.x) || 0)); R.input.y = Math.max(-1, Math.min(1, Number(m.y) || 0)); R.input.held = held;
        if (newly & BTN.SLAP) slap(R);
      },
      scores() { return Object.fromEntries(rubbers.map((R) => [R.p.id, counts[R.k] / valid * 100 + R.bonus])); },
    };
  },
};
