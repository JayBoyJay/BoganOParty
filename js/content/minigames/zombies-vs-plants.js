// Zombies vs Plants: a shooting gallery in a suburban veggie patch at dusk. Blow-up zombie dolls pop
// up behind the tomato bed, the hedge and the back fence, and everyone shoots at them with a spud gun.
// The phone is held sideways and works like a map of the TV: touch a spot and the shot lands on that
// spot on the TV. A miss jams the gun for a second. The players' own dolls pop up too: shoot one of
// your mates and your gun's jammed for five seconds. Further back is harder, and worth more.
import { addSky } from '../../host/sky.js';
import { Batch, gumTreeParts } from '../../host/props.js';

const MISS_COOL = 1; // seconds the gun is jammed after a miss
const MATE_COOL = 5; // ...and after shooting a mate
// the three rows: where the dolls pop up, what hides them, and what a zombie there is worth
const ROWS = [
  { z: -3.4, xs: [-6, -3, 0, 3, 6], pts: 1, up: [2.3, 3.3] },
  { z: -10.5, xs: [-8.1, -5.4, -2.7, 0, 2.7, 5.4, 8.1], pts: 2, up: [1.9, 2.8] },
  { z: -18.6, xs: [-10, -7, -4, -1, 2, 5, 8, 11], pts: 3, up: [1.5, 2.3], base: 0.45 },
];
const ZOMBIE_SKINS = ['#8fbf6a', '#7fae5a', '#9cc47e', '#a8b86a', '#86b48a'];
const RISE = 0.32;

// a zombie face, drawn once per skin and handed to the doll as if it were a photo
function zombieFace(skin, seed) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = skin; g.fillRect(0, 0, 256, 256);
  // mottled rot
  for (let i = 0; i < 40; i++) { const a = (i * 97 + seed * 31) % 256, b = (i * 53 + seed * 71) % 256; g.fillStyle = `rgba(40,70,20,${0.06 + (i % 5) * 0.02})`; g.beginPath(); g.arc(a, b, 10 + (i % 7) * 4, 0, 7); g.fill(); }
  // sunken eyes, one bigger than the other
  for (const [x, r] of [[88, 30 + (seed % 3) * 3], [170, 24]]) {
    g.fillStyle = '#2a3a1a'; g.beginPath(); g.arc(x, 104, r + 8, 0, 7); g.fill();
    g.fillStyle = '#f4f0c8'; g.beginPath(); g.arc(x, 104, r, 0, 7); g.fill();
    g.fillStyle = '#c0182a'; g.beginPath(); g.arc(x + (seed % 2 ? 6 : -4), 108, r * 0.32, 0, 7); g.fill();
  }
  // brows
  g.strokeStyle = '#1a2a10'; g.lineWidth = 10; g.lineCap = 'round';
  g.beginPath(); g.moveTo(52, 64); g.lineTo(116, 78); g.stroke();
  g.beginPath(); g.moveTo(144, 80); g.lineTo(204, 68); g.stroke();
  // a gormless mouth with a few teeth
  g.fillStyle = '#2a0a0a'; g.beginPath(); g.ellipse(128, 186, 54, 26, 0.08, 0, 7); g.fill();
  g.fillStyle = '#e8e0b0';
  for (const tx of [96, 120, 150]) g.fillRect(tx, 162, 14, 18);
  g.fillRect(110, 196, 12, 14);
  // stitches across the cheek
  g.strokeStyle = '#3a1a10'; g.lineWidth = 4;
  g.beginPath(); g.moveTo(186, 150); g.lineTo(236, 190); g.stroke();
  for (let k = 0; k < 5; k++) { const x = 192 + k * 10, y = 155 + k * 8; g.beginPath(); g.moveTo(x - 6, y + 7); g.lineTo(x + 6, y - 7); g.stroke(); }
  return c.toDataURL('image/png');
}

export default {
  id: 'zombies-vs-plants',
  name: 'Zombies vs Plants',
  blurb: "Blow-up zombies are coming through the veggie patch. Spud gun 'em. Don't shoot your mates.",
  howTo: "Hold your phone sideways: your screen is the TV. Touch the spot where a zombie is and your spud lands right there. Miss and your gun jams for a second. Your mates pop up too: shoot one and you're jammed for 5 seconds. Zombies at the back fence are worth 3, the hedge 2, the tomato bed 1.",
  padText: 'Your screen is the TV. Touch a zombie to shoot it.',
  duration: 90,
  pad: { kind: 'touchpad' },

  create(mg) {
    const { THREE, kit, scene, players, rng, sfx, renderer } = mg;
    const n = players.length;

    // ----- the backyard at dusk -----
    addSky(scene, renderer, { elevation: 8, azimuth: 150, turbidity: 6, rayleigh: 2.4, sunIntensity: 2.2, sun: 0xffb070, sky: 0x9a8ac8, ground: 0x5a5030, hemi: 0.85, env: 0.5, shadowSize: 34, fog: [0x8a7a9a, 80, 220] });
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), (() => { const m = kit.surf('grass', { unit: 3, tint: 0xb8cc84 }).clone(); for (const k of ['map', 'normalMap', 'roughnessMap']) if (m[k]) { m[k] = m[k].clone(); m[k].repeat.set(46, 46); m[k].needsUpdate = true; } return m; })());
    lawn.rotation.x = -Math.PI / 2; lawn.receiveShadow = true; scene.add(lawn);
    const cover = []; // what a spud can hit before it reaches a doll
    const keep = (m) => { cover.push(m); return m; };

    // row 1: the tomato bed, sleepers and big leafy plants on stakes, plus a pumpkin or two
    const sleeper = kit.surf('planks', { unit: 1.2, tint: 0x8a6a4a });
    keep(kit.box(16, 0.42, 0.22, sleeper, 0, 0, ROWS[0].z + 0.55));
    keep(kit.box(16, 0.42, 1.0, kit.surf('gravel', { unit: 1, tint: 0x5a3a24 }), 0, 0, ROWS[0].z + 0.05)).position.y = 0.2;
    const leaf = kit.surf('leaves', { unit: 1.2, tint: 0x5f9a3a });
    for (let x = -7.4; x <= 7.5; x += 1.05) {
      const h = 0.7 + rng() * 0.25;
      kit.cyl(0.025, 0.025, h + 0.3, 0x8a6a40, x, 0, ROWS[0].z + 0.35);
      const bush = keep(kit.ball(0.5, leaf, x + (rng() - 0.5) * 0.2, h * 0.72, ROWS[0].z + 0.35));
      bush.scale.set(1.05, 0.95, 0.8);
      for (let k = 0; k < 3; k++) kit.ball(0.07, 0xd8301e, x + (rng() - 0.5) * 0.6, h * (0.45 + rng() * 0.45), ROWS[0].z + 0.62, undefined, { roughness: 0.35 });
    }
    for (const x of [-7.9, 7.9]) { const pk = kit.ball(0.42, 0xe07a1e, x, 0.36, ROWS[0].z + 0.85, undefined, { roughness: 0.6 }); pk.scale.y = 0.75; }
    kit.sign('SPUD-GUN RANGE', 3.4, 0.55, -5.2, 1.35, ROWS[0].z + 0.8, scene, { bg: '#f2e6c8', fg: '#7a1a0a', font: '900 120px Impact, "Arial Black", sans-serif' }).rotation.z = -0.04;
    kit.box(0.08, 1.1, 0.08, 0x6a4a2a, -5.2, 0, ROWS[0].z + 0.78);

    // row 2: a clipped hedge
    const hedge = kit.surf('leaves', { unit: 1.6, tint: 0x3f6e2c });
    keep(kit.box(19, 1.25, 1.1, 0x2f5a22, 0, 0, ROWS[1].z + 0.75));
    for (let x = -9; x <= 9; x += 0.9) keep(kit.ball(0.62, hedge, x, 1.15, ROWS[1].z + 0.75)).scale.set(1, 0.55, 1);

    // row 3: the back fence (Colorbond, of course), a shed, and next door's gums
    const cb = kit.surf('corrugated', { unit: 0.8, tint: 0x5e665c, metalness: 0.4 });
    keep(kit.box(30, 1.9, 0.06, cb, 0, 0, ROWS[2].z + 0.6));
    for (let x = -15; x <= 15; x += 2.4) kit.box(0.08, 1.95, 0.08, 0x45453e, x, 0, ROWS[2].z + 0.64);
    const shed = kit.group(-16.8, 0, -16, 0.3);
    kit.box(5, 2.6, 4, kit.surf('corrugated', { unit: 1.2, tint: 0xb9c2b4, metalness: 0.5 }), 0, 0, 0, shed);
    kit.box(5.4, 0.08, 4.4, kit.surf('corrugated', { unit: 1.2, tint: 0x9aa3a8, metalness: 0.6 }), 0, 2.6, 0, shed).rotation.x = 0.08;
    const trees = new Batch(scene);
    trees.add('gum', () => gumTreeParts(5, 1.1), -9, 0, -25, 1.1);
    trees.add('gum2', () => gumTreeParts(11, 1), 12, 0, -27, 1.2);
    trees.add('gum3', () => gumTreeParts(3, 0.9), 22, 0, -12, 1);
    trees.build();
    // a dunny-light glow behind the fence, and the back of the house we're shooting from
    const lamp = new THREE.PointLight(0xffc070, 30, 22, 1.6); lamp.position.set(9, 3.2, -16); scene.add(lamp);
    kit.box(0.16, 3.1, 0.16, 0x3a3a3a, 9, 0, -18.3); kit.ball(0.22, 0xffe0a0, 9, 3.2, -18.3, undefined, { emissive: 0xffc070, emissiveIntensity: 2 });

    // ----- the dolls -----
    // measure one doll so hits can be tested against a box instead of the bumpy vinyl
    const probe = mg.makeDoll({ id: 'probe', name: '', color: '#888888', body: 'smooth' }, { tag: false });
    const local = new THREE.Box3().setFromObject(probe.group);
    const halfW = (local.max.x - local.min.x) * 0.36, top = local.max.y, depth = 0.4;

    const targets = [];
    const zombieFaces = ZOMBIE_SKINS.map((s, i) => zombieFace(s, i));
    const ZOMBIES = Math.max(10, n * 3 + 4);
    for (let i = 0; i < ZOMBIES; i++) {
      const zp = { id: `zombie${i}`, name: '', color: '#3a5a2a', body: ['smooth', 'bloke', 'sheila', 'both'][i % 4], skin: ZOMBIE_SKINS[i % ZOMBIE_SKINS.length], hair: 0x2a3a1a, photos: { neutral: zombieFaces[i % zombieFaces.length] } };
      const doll = mg.makeDoll(zp, { tag: false });
      doll.setArms(0.05, (rng() - 0.5) * 0.4); // arms out, the way zombies do
      doll.group.visible = false; scene.add(doll.group);
      targets.push({ kind: 'zombie', doll, state: 'down', t: 0 });
    }
    for (const p of players) {
      const doll = mg.makeDoll(p, { tag: true });
      doll.group.visible = false; scene.add(doll.group);
      targets.push({ kind: 'mate', p, doll, state: 'down', t: 0 });
    }
    const slotBusy = new Set();
    const popUp = (tg) => {
      const free = [];
      ROWS.forEach((row, r) => row.xs.forEach((x, k) => { if (!slotBusy.has(`${r}:${k}`)) free.push([r, k]); }));
      if (!free.length) return false;
      // zombies favour the near rows a bit; mates turn up anywhere
      const pool = tg.kind === 'zombie' ? free.filter(([r]) => rng() < [1, 0.85, 0.65][r]) : free;
      const [r, k] = (pool.length ? pool : free)[(rng() * (pool.length || free.length)) | 0];
      const row = ROWS[r];
      slotBusy.add(`${r}:${k}`);
      Object.assign(tg, { state: 'rise', t: 0, row: r, slot: `${r}:${k}`, x: row.xs[k] + (rng() - 0.5) * 0.5, base: row.base || 0, stay: row.up[0] + rng() * (row.up[1] - row.up[0]) * (tg.kind === 'mate' ? 1.1 : 1), drift: (rng() - 0.5) * 0.5, fall: 0 });
      tg.doll.group.visible = true;
      tg.doll.group.rotation.set(0, (rng() - 0.5) * 0.3, 0);
      tg.doll.group.scale.set(1, 1, 1);
      tg.doll.group.position.set(tg.x, -top, row.z);
      return true;
    };
    const putDown = (tg) => { tg.state = 'sink'; tg.t = 0; };
    const free = (tg) => { tg.state = 'down'; tg.doll.group.visible = false; slotBusy.delete(tg.slot); };
    const hittable = (tg) => (tg.state === 'rise' && tg.t > RISE * 0.4) || tg.state === 'up';

    // ----- crosshairs, one per player, stuck to the camera glass -----
    const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.3, 300);
    camera.position.set(0, 4.2, 8.2);
    camera.lookAt(0, 1.5, -9);
    scene.add(camera);
    const xh = players.map((p, i) => {
      const c = document.createElement('canvas'); c.width = 256; c.height = 256;
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
      sp.renderOrder = 999; camera.add(sp);
      return { p, c, tex, sp, x: 0.2 + 0.6 * (n > 1 ? i / (n - 1) : 0.5), y: 0.62, cool: 0, coolMax: 1, drawn: '', flash: 0, score: 0, hits: 0, mates: 0, misses: 0,
        bot: p.bot ? { aimT: 0, target: null, wait: 0.4 + rng() * 0.5, skill: 0.55 + rng() * 0.35, tx: 0.5, ty: 0.6 } : null };
    });
    const drawXh = (h) => {
      const key = `${h.cool > 0 ? Math.ceil(h.cool * 10) : 'ok'}:${h.flash > 0}`;
      if (key === h.drawn) return;
      h.drawn = key;
      const g = h.c.getContext('2d'); g.clearRect(0, 0, 256, 256);
      const jam = h.cool > 0, col = jam ? '#9a9a9a' : h.p.color;
      g.lineWidth = 12; g.strokeStyle = 'rgba(0,0,0,0.55)'; g.beginPath(); g.arc(128, 112, 62, 0, 7); g.stroke();
      g.lineWidth = 8; g.strokeStyle = col; g.beginPath(); g.arc(128, 112, 62, 0, 7); g.stroke();
      if (jam) { g.lineWidth = 12; g.strokeStyle = '#ff4a3a'; g.beginPath(); g.arc(128, 112, 62, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (h.cool / h.coolMax)); g.stroke(); }
      g.strokeStyle = col; g.lineWidth = 7;
      for (const [a, b, c2, d] of [[128, 30, 128, 80], [128, 144, 128, 194], [46, 112, 96, 112], [160, 112, 210, 112]]) { g.beginPath(); g.moveTo(a, b); g.lineTo(c2, d); g.stroke(); }
      g.fillStyle = col; g.beginPath(); g.arc(128, 112, 7, 0, 7); g.fill();
      g.font = '900 34px system-ui, sans-serif'; g.textAlign = 'center'; g.lineWidth = 8; g.strokeStyle = '#000';
      const label = jam ? `JAMMED ${h.cool.toFixed(1)}` : h.p.name.slice(0, 10);
      g.strokeText(label, 128, 238); g.fillStyle = jam ? '#ff8a7a' : '#fff'; g.fillText(label, 128, 238);
      h.tex.needsUpdate = true;
    };
    // the crosshair sits on a plane 1 unit in front of the lens, where the screen maps straight across
    const placeXh = (h) => {
      const hh = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), hw = hh * camera.aspect;
      h.sp.position.set((h.x * 2 - 1) * hw, (1 - h.y * 2) * hh, -1);
      const s = hh * 0.26 * (1 + h.flash * 0.6);
      h.sp.scale.set(s, s, 1);
    };

    // ----- effects: spud splats and score pops -----
    const fx = [];
    const textSprite = (text, color, size = 1) => {
      const c = document.createElement('canvas'); c.width = 512; c.height = 128;
      const g = c.getContext('2d'); g.font = '900 92px Impact, "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 14; g.strokeStyle = '#1a0a04'; g.strokeText(text, 256, 66, 500); g.fillStyle = color; g.fillText(text, 256, 66, 500);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); sp.scale.set(2.6 * size, 0.65 * size, 1); sp.renderOrder = 900;
      return sp;
    };
    const say = (text, color, at, size = 1, life = 1.1) => { const sp = textSprite(text, color, size); sp.position.copy(at); scene.add(sp); fx.push({ o: sp, life, max: life, rise: 1.2 }); };
    const spudGeo = new THREE.SphereGeometry(0.13, 10, 8), spudMat = kit.mat(0xc8a060, { roughness: 0.9 });
    const splat = (at, big) => {
      for (let k = 0; k < (big ? 7 : 4); k++) {
        const m = new THREE.Mesh(spudGeo, spudMat); m.position.copy(at); m.scale.setScalar(0.4 + rng() * 0.5); scene.add(m);
        fx.push({ o: m, life: 0.7, max: 0.7, v: new THREE.Vector3((rng() - 0.5) * 4, 1.5 + rng() * 3, (rng() - 0.5) * 2 + 1) });
      }
    };

    // ----- shooting -----
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), box = new THREE.Box3(), hitAt = new THREE.Vector3();
    const shoot = (h, x, y) => {
      h.x = x; h.y = y;
      if (h.cool > 0) { sfx.play('tick'); return; }
      sfx.play('shot'); h.flash = 1;
      ndc.set(x * 2 - 1, 1 - y * 2);
      camera.updateMatrixWorld();
      ray.setFromCamera(ndc, camera);
      const wall = ray.intersectObjects(cover, false)[0];
      let best = null, bestD = wall ? wall.distance : Infinity;
      for (const tg of targets) {
        if (!hittable(tg)) continue;
        const g = tg.doll.group.position;
        box.min.set(g.x - halfW, g.y + 0.1, g.z - depth); box.max.set(g.x + halfW, g.y + top, g.z + depth);
        if (ray.ray.intersectBox(box, hitAt)) { const d = hitAt.distanceTo(camera.position); if (d < bestD) { bestD = d; best = tg; } }
      }
      if (!best) {
        h.misses++; h.cool = h.coolMax = MISS_COOL;
        const at = wall ? wall.point : ray.ray.at(30, new THREE.Vector3());
        splat(at, false);
        return;
      }
      const at = ray.ray.at(bestD, new THREE.Vector3());
      splat(at, true);
      if (best.kind === 'zombie') {
        const pts = ROWS[best.row].pts;
        h.score += pts; h.hits++;
        best.state = 'hit'; best.t = 0; best.by = h;
        best.doll.flinch();
        sfx.play('deflate');
        say(`+${pts}`, h.p.color, at.clone().add(new THREE.Vector3(0, 0.5, 0)), 0.8 + best.row * 0.25);
      } else {
        // shot a mate: they flinch, you're jammed
        h.mates++; h.cool = h.coolMax = MATE_COOL;
        best.doll.flinch();
        sfx.play('oi');
        say(`OI! ${h.p.name} shot ${best.p.name}`, '#ff6a5a', at.clone().add(new THREE.Vector3(0, 0.9, 0)), 1.2 + best.row * 0.3, 1.8);
        putDown(best);
      }
    };

    // ----- bots: pick a zombie, swing the crosshair over, fire; sometimes too keen -----
    const project = (tg) => {
      const v = tg.doll.group.position.clone(); v.y += top * 0.8 + tg.base * 0.3;
      v.project(camera);
      return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 };
    };
    const botThink = (h, dt) => {
      const b = h.bot;
      if (h.cool > 0) return;
      if (!b.target || !hittable(b.target) || b.target.kind !== 'zombie') {
        const live = targets.filter((tg) => hittable(tg) && tg.kind === 'zombie');
        if (!live.length) return;
        b.target = live[(rng() * live.length) | 0]; b.aimT = 0;
        b.wait = (0.35 + rng() * 0.6) / b.skill;
      }
      const at = project(b.target);
      const k = 1 - Math.exp(-dt * 6 * b.skill);
      h.x += (at.x - h.x) * k; h.y += (at.y - h.y) * k;
      b.aimT += dt;
      if (b.aimT > b.wait) {
        const wob = (1 - b.skill) * 0.09;
        shoot(h, at.x + (rng() - 0.5) * wob, at.y + (rng() - 0.5) * wob * 1.5);
        b.target = null;
      }
    };

    // ----- the clock -----
    let spawnT = 0.6, mateT = 3 + rng() * 2;
    const live = () => targets.filter((tg) => tg.kind === 'zombie' && tg.state !== 'down').length;
    return {
      camera,
      update(dt, t, running) {
        // rise, stay, sink, or deflate
        for (const tg of targets) {
          if (tg.state === 'down') continue;
          tg.t += dt;
          const g = tg.doll.group;
          if (tg.state === 'rise') { const k = Math.min(1, tg.t / RISE); g.position.y = tg.base - top * (1 - k) * (1 - k); if (k >= 1) { tg.state = 'up'; tg.t = 0; } }
          else if (tg.state === 'up') {
            g.position.y = tg.base;
            if (tg.kind === 'zombie') { g.position.x += tg.drift * dt; g.rotation.z = Math.sin(tg.t * 3 + tg.x) * 0.06; }
            if (tg.t > tg.stay) putDown(tg);
          } else if (tg.state === 'sink') { g.position.y = tg.base - top * Math.min(1, tg.t / 0.35); if (tg.t > 0.35) free(tg); }
          else if (tg.state === 'hit') {
            // a spud in the guts: it tips back and goes down flat, the way a punctured doll does
            const k = Math.min(1, tg.t / 0.6);
            g.rotation.x = -k * 1.2;
            g.scale.set(1 + k * 0.15, 1 - k * 0.7, 1);
            g.position.y = tg.base - k * 0.4;
            if (tg.t > 0.9) free(tg);
          }
          tg.doll.update(dt);
        }
        if (running) {
          const left = mg.timeLeft(), heat = 1 - left / mg.duration; // it gets busier as it goes
          spawnT -= dt;
          const want = Math.round(2 + n * 0.6 + heat * 3);
          if (spawnT <= 0 && live() < want) {
            const idle = targets.filter((tg) => tg.kind === 'zombie' && tg.state === 'down');
            if (idle.length) popUp(idle[(rng() * idle.length) | 0]);
            spawnT = (0.55 + rng() * 0.6) * (1 - heat * 0.4);
          }
          mateT -= dt;
          if (mateT <= 0) {
            const idle = targets.filter((tg) => tg.kind === 'mate' && tg.state === 'down');
            if (idle.length) popUp(idle[(rng() * idle.length) | 0]);
            mateT = 2.6 + rng() * 2.6;
          }
          for (const h of xh) if (h.bot) botThink(h, dt);
        }
        for (const h of xh) {
          h.cool = Math.max(0, h.cool - dt);
          h.flash = Math.max(0, h.flash - dt * 6);
          drawXh(h); placeXh(h);
        }
        for (let i = fx.length - 1; i >= 0; i--) {
          const f = fx[i]; f.life -= dt;
          if (f.v) { f.v.y -= 12 * dt; f.o.position.addScaledVector(f.v, dt); }
          else { f.o.position.y += f.rise * dt; f.o.material.opacity = Math.min(1, f.life / (f.max * 0.4)); }
          if (f.life <= 0) { scene.remove(f.o); fx.splice(i, 1); }
        }
      },
      input(p, m) {
        const h = xh.find((q) => q.p === p);
        if (!h || !Number.isFinite(m.x) || !Number.isFinite(m.y)) return;
        const x = Math.max(0, Math.min(1, m.x)), y = Math.max(0, Math.min(1, m.y));
        if (m.b === 'aim') { h.x = x; h.y = y; }
        else if (m.b === 'shot') shoot(h, x, y);
      },
      scores() { return Object.fromEntries(xh.map((h) => [h.p.id, h.score])); },
    };
  },
};
