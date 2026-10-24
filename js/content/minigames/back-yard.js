// The (Back) Yard: a backyard gym, Colorbond fence, Hills Hoist, the lot. Everyone's got a barbell and
// the same notes come down the mat towards them, Guitar Hero style. Tap the matching colour as each
// one hits the line to pump out a rep. Every five in a row bumps your multiplier (up to x6); miss one or
// tap the wrong colour and you're back to x1.
import { addSky } from '../../host/sky.js';
import { gumTreeParts, Batch } from '../../host/props.js';

const LANES = [
  { id: 'g', label: 'GREEN', color: '#3fd14a', hex: 0x3fd14a },
  { id: 'r', label: 'RED', color: '#ff4040', hex: 0xff4040 },
  { id: 'y', label: 'YELLOW', color: '#ffd23f', hex: 0xffd23f },
  { id: 'b', label: 'BLUE', color: '#3da5ff', hex: 0x3da5ff },
];
const LANE_W = 1.15, HIT_Z = 2.2, SPEED = 11; // metres between lanes, where the strike line is, how fast notes come
const LEAD = 2.6; // seconds a note is on screen before it reaches the line
const BPM = 104, BEAT = 60 / BPM;
const WIN = 0.16, PERFECT = 0.065; // timing windows, seconds either side
const LAG = 0.07; // phone taps arrive about this late, so judge them against a slightly earlier clock
const STREAK_STEP = 5, MAX_MULT = 6;
const DOLL = 0.62;

export default {
  id: 'back-yard',
  name: 'The (Back) Yard',
  blurb: 'Backyard gym session. Hit the colours on the beat to pump reps. Keep the streak going to multiply.',
  howTo: 'Coloured notes slide down the mat. Tap the same colour on your phone right as each one crosses the line. Every 5 in a row raises your multiplier, up to x6. A miss or a wrong colour drops you back to x1.',
  padText: 'Tap the colour as it hits the line!',
  duration: 60,
  pad: { kind: 'buttons', buttons: LANES.map((l) => ({ id: l.id, label: l.label, color: l.color, tall: true })) },

  create(mg) {
    const { THREE, kit, scene, players, rng, renderer, sfx } = mg;
    const { sun } = addSky(scene, renderer, { elevation: 38, azimuth: 25, turbidity: 3, sunIntensity: 3.2, sky: 0xd8e8ff, ground: 0x6a6448, hemi: 0.6, env: 0.6, shadowSize: 26, fog: [0xd6e2ea, 60, 160] });
    sun.target.position.set(0, 0, -6);

    // ----- the yard -----
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), (() => { const m = kit.surf('grass', { unit: 3, tint: 0xbcd08a }).clone(); for (const k of ['map', 'normalMap', 'roughnessMap']) if (m[k]) { m[k] = m[k].clone(); m[k].repeat.set(40, 40); m[k].needsUpdate = true; } return m; })());
    lawn.rotation.x = -Math.PI / 2; lawn.receiveShadow = true; scene.add(lawn);
    // Colorbond fence, Woodland Grey, round three sides
    const cb = kit.surf('corrugated', { unit: 0.8, tint: 0x6e6e66, metalness: 0.4 });
    kit.box(40, 1.9, 0.06, cb, 0, 0, -26);
    for (const s of [-1, 1]) kit.box(0.06, 1.9, 32, cb, s * 20, 0, -10);
    for (let x = -20; x <= 20; x += 2.4) kit.box(0.08, 1.95, 0.08, 0x55554e, x, 0, -25.96);
    // next door's gum hanging over the fence, as it does
    const trees = new Batch(scene);
    trees.add('gum', () => gumTreeParts(4, 1.1), -14, 0, -30, 1.1);
    trees.add('gum', () => gumTreeParts(4, 1.1), 15, 0, -32, 1.2);
    trees.add('gum2', () => gumTreeParts(9, 1), 24, 0, -14, 1);
    trees.build();
    // the shed, with the gym's name painted on
    const shed = kit.group(-12.5, 0, -19, 0.35);
    kit.box(6, 2.8, 4.5, kit.surf('corrugated', { unit: 1.2, tint: 0xb9c2b4, metalness: 0.5 }), 0, 0, 0, shed);
    const roof = kit.box(6.4, 0.08, 5, kit.surf('corrugated', { unit: 1.2, tint: 0x9aa3a8, metalness: 0.6 }), 0, 2.8, 0, shed); roof.rotation.x = 0.08;
    kit.box(2.2, 2.2, 0.06, 0x3a3a36, 1.2, 0, 2.27, shed);
    kit.sign('THE (BACK) YARD', 5.4, 0.9, 0, 2.45, 2.3, shed, { bg: '#1b1b18', fg: '#ffd23f', font: '900 150px Impact, "Arial Black", sans-serif' });
    // Hills Hoist with the washing out
    const hoist = kit.group(11, 0, -16);
    kit.cyl(0.06, 0.06, 2.4, 0x9ea2a4, 0, 0, 0, hoist, { metalness: 0.8, roughness: 0.3 });
    const arms = kit.group(0, 2.3, 0, 0.3, 1, hoist);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; kit.rod([0, 0, 0], [Math.cos(a) * 2.2, 0.15, Math.sin(a) * 2.2], 0.03, 0x9ea2a4, arms, { metalness: 0.8 }); }
    for (const r of [0.8, 1.4, 2.0]) { const sq = [[r, 0], [0, r], [-r, 0], [0, -r], [r, 0]]; for (let i = 0; i < 4; i++) kit.rod([sq[i][0], 0.1, sq[i][1]], [sq[i + 1][0], 0.1, sq[i + 1][1]], 0.006, 0xdddddd, arms); }
    const washing = [[1.4, 0, 0xf2f2f2, 0.5, 0.7], [0.7, 0.7, 0x3a6fd8, 0.9, 0.6], [0, 1.4, 0xd8423a, 0.6, 0.9], [-1.0, 1.0, 0xf2e04a, 0.45, 0.5], [-2.0, 0, 0x2a2a2a, 0.6, 0.75]];
    for (const [x, z, c, w, h] of washing) { const m = kit.box(w, h, 0.02, kit.mat(c, { roughness: 1, side: THREE.DoubleSide }), x, 0.1 - h, z, arms); m.rotation.y = Math.atan2(x, z) + Math.PI / 2; }
    // Weber, esky, a slab of concrete, a kiddie pool
    const weber = kit.group(14, 0, -6);
    kit.ball(0.45, kit.mat(0x111111, { roughness: 0.3, metalness: 0.4 }), 0, 1.0, 0, weber);
    for (let i = 0; i < 3; i++) { const a = i * 2.1; kit.rod([Math.cos(a) * 0.3, 0.85, Math.sin(a) * 0.3], [Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5], 0.025, 0x888888, weber); }
    kit.box(0.8, 0.5, 0.5, 0x2a6fd8, 12.6, 0, -4.2, scene, { roughness: 0.4 });
    kit.box(0.84, 0.1, 0.54, 0xf2f2f2, 12.6, 0.5, -4.2, scene, { roughness: 0.4 });
    const pool = kit.cyl(1.6, 1.6, 0.35, kit.mat(0x5fb4ff, { roughness: 0.3 }), -14, 0, -6); void pool;
    const water = new THREE.Mesh(new THREE.CircleGeometry(1.5, 32), kit.mat(0x7fd8ff, { roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.85 })); water.rotation.x = -Math.PI / 2; water.position.set(-14, 0.3, -6); scene.add(water);

    // ----- the note mat: a strip of rubber gym flooring down the middle of the yard -----
    const nL = LANES.length, matW = nL * LANE_W + 0.5, matLen = SPEED * LEAD + 6;
    const mat = kit.box(matW, 0.04, matLen, kit.mat(0x1d1d1f, { roughness: 0.95 }), 0, 0, HIT_Z + 3 - matLen / 2);
    mat.castShadow = false;
    const laneX = (i) => (i - (nL - 1) / 2) * LANE_W;
    for (let i = 0; i <= nL; i++) kit.box(0.03, 0.045, matLen, 0x4a4a4e, (i - nL / 2) * LANE_W, 0, HIT_Z + 3 - matLen / 2).castShadow = false;
    const pads = LANES.map((l, i) => {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.47, 40), new THREE.MeshStandardMaterial({ color: l.hex, emissive: l.hex, emissiveIntensity: 0.5, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(laneX(i), 0.06, HIT_Z); scene.add(ring);
      return { ring, flash: 0 };
    });
    kit.box(matW, 0.05, 0.07, kit.mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.6 }), 0, 0.01, HIT_Z).castShadow = false;
    // beat lines that slide down with the music
    const beatLines = [];
    for (let i = 0; i < Math.ceil(LEAD / BEAT) + 2; i++) { const b = kit.box(matW - 0.1, 0.01, 0.03, kit.mat(0x5a5a60), 0, 0.045, 0); b.castShadow = false; beatLines.push(b); }

    // ----- the chart: the same notes for everyone -----
    const notes = [];
    const t0 = 2.2, end = mg.duration - 1.5;
    let last = -1;
    for (let b = 0; t0 + b * BEAT / 2 < end; b++) {
      const t = t0 + b * BEAT / 2, k = (t - t0) / (end - t0); // how far through the song
      const onBeat = b % 2 === 0, bar = b % 8;
      let place = false;
      if (k < 0.22) place = bar === 0 || bar === 4;
      else if (k < 0.5) place = onBeat;
      else if (k < 0.8) place = onBeat || rng() < 0.35;
      else place = onBeat || rng() < 0.6;
      if (!place) continue;
      let lane = (rng() * nL) | 0;
      if (lane === last && rng() < 0.6) lane = (lane + 1 + ((rng() * (nL - 1)) | 0)) % nL;
      last = lane;
      notes.push({ t, lane });
      if (k > 0.55 && onBeat && bar === 0 && rng() < 0.7) notes.push({ t, lane: (lane + 2) % nL }); // a double on the one
    }
    const gemGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.16, 28);
    const capGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.18, 20);
    for (const n of notes) {
      const l = LANES[n.lane];
      const g = new THREE.Group();
      const gem = new THREE.Mesh(gemGeo, new THREE.MeshPhysicalMaterial({ color: l.hex, emissive: l.hex, emissiveIntensity: 0.35, roughness: 0.25, clearcoat: 1 })); g.add(gem);
      const cap = new THREE.Mesh(capGeo, kit.mat(0xf4f4f4, { roughness: 0.3 })); cap.position.y = 0.02; g.add(cap);
      gem.castShadow = true;
      g.position.set(laneX(n.lane), 0.12, -100); g.visible = false; scene.add(g);
      n.g = g; n.hitBy = new Set();
    }

    // ----- the lifters, lined up both sides of the mat like a gym class -----
    const pops = [];
    const sprite = (w, h) => { const c = document.createElement('canvas'); c.width = 512; c.height = Math.round(512 * h / w); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); sp.scale.set(w, h, 1); sp.renderOrder = 20; return { sp, c, t }; };
    const pop = (x, y, z, text, color, size = 1) => {
      const { sp, c, t } = sprite(2.6 * size, 0.8 * size), g = c.getContext('2d');
      g.font = '900 104px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 14; g.strokeStyle = '#1a0d08'; g.strokeText(text, 256, c.height / 2 + 4, 500); g.fillStyle = color; g.fillText(text, 256, c.height / 2 + 4, 500); t.needsUpdate = true;
      sp.position.set(x, y, z); scene.add(sp); pops.push({ sp, life: 0 });
    };
    const barM = kit.mat(0xc8ccd0, { metalness: 0.95, roughness: 0.25 });
    const plateCols = [0xd8423a, 0x2a6fd8, 0xf2c200, 0x2fa04a];
    const n = players.length, perSide = Math.ceil(n / 2);
    const lifters = players.map((p, i) => {
      const side = i % 2 === 0 ? -1 : 1, k = Math.floor(i / 2);
      const x = side * (matW / 2 + 1.6 + k * 1.3), z = HIT_Z - 0.4 - k * 2.6;
      // a rubber mat and a squat rack each
      kit.box(2.6, 0.03, 2.2, kit.mat(0x2a2a2c, { roughness: 1 }), x, 0, z).castShadow = false;
      const doll = mg.makeDoll(p, { scale: DOLL });
      doll.group.position.set(x, 0.03, z); doll.group.rotation.y = -side * 0.18; scene.add(doll.group);
      // the barbell lives in the doll's body so it moves with the jiggle
      const bar = new THREE.Group(); doll.body.add(bar);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.7, 10), barM); rod.rotation.z = Math.PI / 2; rod.castShadow = true; bar.add(rod);
      const pc = plateCols[i % plateCols.length];
      for (const s of [-1, 1]) for (const [off, r] of [[1.0, 0.42], [1.12, 0.36]]) { const pl = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.1, 28), kit.mat(pc, { roughness: 0.5 })); pl.rotation.z = Math.PI / 2; pl.position.x = s * off; pl.castShadow = true; bar.add(pl); }
      const tag = sprite(1.6, 0.6); tag.sp.position.set(x + side * 1.25, 1.5, z); scene.add(tag.sp); // the multiplier, beside them
      return { p, doll, bar, x, z, side, score: 0, streak: 0, mult: 1, best: 0, lift: 0, rep: 0, sag: 0, tag, shownMult: -1,
        acc: 0.8 + rng() * 0.15, jit: 0.025 + rng() * 0.03, next: 0 };
    });
    const drawTag = (L) => {
      if (L.mult === L.shownMult) return;
      L.shownMult = L.mult;
      const g = L.tag.c.getContext('2d'), w = L.tag.c.width, h = L.tag.c.height;
      g.clearRect(0, 0, w, h);
      g.font = '900 150px Impact, "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 16; g.strokeStyle = '#1a0d08'; g.strokeText(`x${L.mult}`, w / 2, h / 2 + 6);
      g.fillStyle = L.mult >= MAX_MULT ? '#ff7a3d' : L.mult > 1 ? '#ffd23f' : '#ffffff'; g.fillText(`x${L.mult}`, w / 2, h / 2 + 6);
      L.tag.t.needsUpdate = true;
      L.tag.sp.scale.setScalar(1).multiply(new THREE.Vector3(1.6 + L.mult * 0.12, 0.6 + L.mult * 0.045, 1));
    };
    lifters.forEach(drawTag);

    let tNow = 0, beatIdx = -1;
    const judge = (L, lane, at) => {
      let best = null, bd = WIN;
      for (const nt of notes) {
        if (nt.t > at + WIN) break;
        if (nt.lane !== lane || nt.hitBy.has(L)) continue;
        const d = Math.abs(nt.t - at);
        if (d < bd) { bd = d; best = nt; }
      }
      if (!best) {
        // a tap with nothing to hit: breaks the streak
        if (L.streak > 0) { L.streak = 0; L.mult = 1; drawTag(L); pop(L.x, 2.4, L.z, 'OOPS', '#ff8a8a', 0.7); }
        L.sag = 1;
        return;
      }
      best.hitBy.add(L);
      const perfect = bd < PERFECT;
      L.streak++; L.best = Math.max(L.best, L.streak);
      L.mult = Math.min(MAX_MULT, 1 + Math.floor(L.streak / STREAK_STEP));
      L.score += (perfect ? 15 : 10) * L.mult;
      L.rep = 1;
      drawTag(L);
      if (L.streak % STREAK_STEP === 0 && L.mult <= MAX_MULT && L.streak / STREAK_STEP < MAX_MULT) { pop(L.x, 3.6, L.z, `x${L.mult}!`, '#ffd23f', 0.9); if (!L.p.bot) sfx.play('coin'); }
      pads[lane].flash = 1;
      if (!L.p.bot) sfx.play('clank');
    };

    const camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.3, 300);
    const back = (perSide - 1) * 2.6;
    camera.position.set(0, 5.6 + back * 0.25, HIT_Z + 7.8 + back * 0.3);
    camera.lookAt(0, 1.1, HIT_Z - 5.5);

    return {
      camera,
      update(dt, t, running) {
        tNow = t;
        // the beat: kick on every beat, snare on 2 and 4, hats in between
        if (running) {
          const bi = Math.floor((t - t0) / (BEAT / 2));
          while (beatIdx < bi) {
            beatIdx++;
            if (beatIdx < 0) continue;
            if (beatIdx % 2 === 0) sfx.play((beatIdx / 2) % 2 === 1 ? 'snare' : 'kick'); else sfx.play('hat');
          }
        }
        // notes slide down the mat
        for (const nt of notes) {
          const ahead = nt.t - t;
          const vis = ahead < LEAD && ahead > -0.5 && nt.hitBy.size < lifters.length;
          nt.g.visible = vis;
          if (vis) { nt.g.position.z = HIT_Z - ahead * SPEED; nt.g.scale.setScalar(ahead < 0 ? Math.max(0.2, 1 + ahead * 1.6) : 1); }
        }
        const phase = ((t - t0) / BEAT) % 1;
        beatLines.forEach((b, i) => { const ahead = (i - phase) * BEAT; b.position.z = HIT_Z - ahead * SPEED; b.visible = ahead < LEAD && ahead > -0.1; });
        for (const p of pads) { p.flash = Math.max(0, p.flash - dt * 4); p.ring.material.emissiveIntensity = 0.5 + p.flash * 2.5; p.ring.scale.setScalar(1 + p.flash * 0.25); }
        // CPUs and misses
        for (const L of lifters) {
          if (running) {
            for (const nt of notes) {
              if (nt.t > t + 0.2) break;
              if (nt.hitBy.has(L)) continue;
              if (L.p.bot && !nt.botTried?.has(L)) {
                nt.botTried = nt.botTried || new Set();
                const at = nt.t + (rng() * 2 - 1) * L.jit;
                if (t >= at) { nt.botTried.add(L); if (rng() < L.acc) judge(L, nt.lane, at); }
              }
              if (t - LAG > nt.t + WIN && !nt.hitBy.has(L)) {
                nt.hitBy.add(L);
                if (L.streak >= STREAK_STEP) pop(L.x, 2.4, L.z, 'MISS', '#ff6a5a', 0.7);
                L.streak = 0; L.mult = 1; drawTag(L); L.sag = 1;
                if (!L.p.bot) sfx.play('miss');
              }
            }
          }
          // the lift: press it up on a hit, let it sag on a miss
          L.rep = Math.max(0, L.rep - dt * 3.2);
          L.sag = Math.max(0, L.sag - dt * 2.2);
          const lift = 0.15 + Math.sin(L.rep * Math.PI) * 1.15 - L.sag * 0.35;
          L.lift += (lift - L.lift) * Math.min(1, dt * 18);
          L.doll.setArms(L.lift, Math.sin(L.sag * 9) * L.sag * 0.15);
          const hand = 0.72;
          L.bar.position.set(0, 1.7 + Math.sin(L.lift) * hand + 0.06, 0.12);
          L.bar.rotation.z = Math.sin(L.sag * 9) * L.sag * 0.15;
          L.doll.update(dt);
        }
        for (let i = pops.length - 1; i >= 0; i--) { const q = pops[i]; q.life += dt; q.sp.position.y += dt * 1.1; q.sp.material.opacity = Math.min(1, 2.4 - q.life * 2); if (q.life > 1.2) { scene.remove(q.sp); pops.splice(i, 1); } }
      },
      input(p, m) {
        const L = lifters.find((x) => x.p === p); if (!L) return;
        const lane = LANES.findIndex((l) => l.id === m.b);
        if (lane >= 0) judge(L, lane, tNow - LAG);
      },
      scores() { return Object.fromEntries(lifters.map((L) => [L.p.id, L.score])); },
    };
  },
};
