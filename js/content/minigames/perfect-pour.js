// Perfect Pour: everyone's behind the bar at the Bogan Arms with a tap and an empty schooner. You get one
// pour. Slide up on your phone to open the tap, slide back down to shut it, and that's your go. Pour hard
// and it's all froth, pour soft and it takes forever and comes out flat. The aim is beer right up to the
// rim with a finger of head on top, after it's settled. Closest to the perfect pour wins.

const BAR = 1.1; // bar height
const GH = 0.72, R0 = 0.155, R1 = 0.24; // the schooner: height, inside radius at the bottom and the rim
const QMAX = 0.34; // glass heights per second, tap wide open
const FX = 2.4; // foam takes up this much more room than the beer it's made of
const K = 0.15; // how fast the head settles back into beer
const DOME = 1.04; // a head can sit a little proud of the rim before it runs down the side
const HEAD = 0.1; // the perfect head, as a share of the glass
const SETTLE = 2.5; // seconds the glass sits before it's judged
const DOLL = 0.78;

const foamFrac = (v, age) => Math.min(0.95, 0.03 + 0.42 * v * v + (age < 0.4 ? 0.35 * (1 - age / 0.4) : 0)); // a tap spits froth when it first opens

// how good a pour is, out of 100, and what the publican would say about it
function judge(S) {
  if (!S.started) return { score: 0, say: "DIDN'T POUR" };
  const lvl = S.beer + S.foam, e1 = Math.max(0, Math.abs(lvl - 1) - 0.012), e2 = Math.max(0, Math.abs(S.foam - HEAD) - 0.03);
  const score = Math.max(0, Math.min(100, 100 - 260 * e1 - 200 * e2 - 300 * S.spill));
  const say = S.spill > 0.02 ? 'OVERFLOW!' : lvl < 0.9 ? 'SHORT POUR' : S.foam > 0.22 ? 'ALL FROTH' : S.foam < 0.045 ? 'FLAT AS' : score >= 92 ? 'PERFECT POUR!' : score >= 75 ? 'NOT BAD' : 'BIT ROUGH';
  return { score, say };
}

// glazed green pub tiles for the front of the bar
function tileCanvas() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#c9c2a8'; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 2; x++) {
    const gr = g.createLinearGradient(0, y * 64, 0, y * 64 + 62);
    const l = 22 + Math.random() * 6;
    gr.addColorStop(0, `hsl(150, 45%, ${l + 10}%)`); gr.addColorStop(1, `hsl(152, 50%, ${l}%)`);
    g.fillStyle = gr; g.fillRect(x * 128 + 2, y * 64 + 2, 124, 60);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x * 128 + 6, y * 64 + 5, 116, 6);
  }
  return c;
}

export default {
  id: 'perfect-pour',
  name: 'Perfect Pour',
  blurb: 'One schooner, one pour. Fill it to the rim with a proper head. Closest to perfect wins.',
  howTo: 'Slide up on your phone to open the tap and slide back down to shut it. You only get one go: once the tap is shut, that is your beer. Open it right up and you get all froth. Go easy and it is flat. Aim for beer to the rim with a finger of head on top, after it settles.',
  padText: 'Slide up to pour, down to stop',
  duration: 40,
  pad: { kind: 'slider', thumb: '🍺', start: 0, hint: 'Up = tap open. Back down = done' },

  create(mg) {
    const { THREE, kit, scene, players, rng, sfx } = mg;
    const n = players.length;
    const SP = n > 4 ? 1.3 : 1.7; // space between taps; closer together with a full bar
    const W = n * SP;

    // ----- the front bar of the Bogan Arms -----
    scene.background = new THREE.Color(0x1a100a);
    mg.env((env) => {
      env.add(new THREE.Mesh(new THREE.BoxGeometry(40, 20, 40), new THREE.MeshBasicMaterial({ color: 0x5a4030, side: THREE.BackSide })));
      for (let i = -2; i <= 2; i++) { const l = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.2), new THREE.MeshBasicMaterial({ color: 0xfff0d0 })); l.position.set(i * 7, 9.5, 0); l.rotation.x = Math.PI / 2; env.add(l); }
      const front = new THREE.Mesh(new THREE.PlaneGeometry(30, 8), new THREE.MeshBasicMaterial({ color: 0xc8b8a0 })); front.position.set(0, 4, 19.9); front.rotation.y = Math.PI; env.add(front);
    }, 0.04);
    scene.environmentIntensity = 0.9;
    scene.add(new THREE.HemisphereLight(0xffe2c0, 0x3a2418, 0.9));
    const key = new THREE.DirectionalLight(0xffe8cc, 2.2);
    key.position.set(-3, 9, 8); key.target.position.set(0, BAR, -0.5); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -W / 2 - 3, right: W / 2 + 3, top: 5, bottom: -3, near: 1, far: 30 });
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03;
    scene.add(key, key.target);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W + 30, 30), kit.surf('planks', { unit: 2.2, tint: 0x8a5a38 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    // the bar: tiled front, a polished jarrah top, and a brass foot rail
    const tileT = new THREE.CanvasTexture(tileCanvas()); tileT.colorSpace = THREE.SRGBColorSpace; tileT.wrapS = tileT.wrapT = THREE.RepeatWrapping; tileT.repeat.set((W + 2) / 0.6, BAR / 0.6);
    kit.box(W + 2, BAR - 0.06, 0.9, new THREE.MeshStandardMaterial({ map: tileT, roughness: 0.18, metalness: 0 }), 0, 0, -0.3);
    kit.box(W + 2.3, 0.07, 1.15, kit.surf('planks', { unit: 1.6, tint: 0x6a2c16 }), 0, BAR - 0.07, -0.25, undefined, { roughness: 0.25 });
    kit.box(W + 2.2, 0.08, 0.04, 0x4a2412, 0, BAR - 0.13, 0.33);
    const brass = kit.mat(0xd9a640, { metalness: 0.9, roughness: 0.25 });
    kit.rod([-W / 2 - 1, 0.22, 0.42], [W / 2 + 1, 0.22, 0.42], 0.035, brass);
    for (let x = -W / 2 - 0.6; x <= W / 2 + 0.6; x += 1.4) kit.rod([x, 0, 0.3], [x, 0.22, 0.42], 0.02, brass);
    // the back bar: brick, a long mirror, shelves of bottles, the neon
    const BACK = -2.6;
    kit.box(W + 8, 7, 0.2, kit.surf('brick', { unit: 2.4, tint: 0xb87a5a }), 0, 0, BACK);
    kit.box(W + 1, 1.05, 0.6, kit.surf('planks', { unit: 1.6, tint: 0x4a2412 }), 0, 0, BACK + 0.35);
    const mirror = kit.box(W + 0.6, 0.9, 0.02, 0x8a8478, 0, 1.5, BACK + 0.12, undefined, { metalness: 1, roughness: 0.08 });
    mirror.receiveShadow = false;
    const shelfM = kit.mat(0x4a2412, { roughness: 0.5 });
    const bottleCols = [0x2a5a2a, 0x6a3a10, 0xc8d8c0, 0x8a1a1a, 0x1a2a4a, 0xd8a040];
    for (const sy of [1.25, 1.95]) {
      kit.box(W + 0.6, 0.05, 0.3, shelfM, 0, sy, BACK + 0.28);
      for (let x = -W / 2; x < W / 2; x += 0.16 + rng() * 0.1) {
        const h = 0.26 + rng() * 0.12, r = 0.035 + rng() * 0.015;
        const b = kit.lathe([[0.001, 0], [r, 0], [r, h * 0.62], [r * 0.4, h * 0.8], [r * 0.32, h], [0.001, h]], bottleCols[(rng() * bottleCols.length) | 0], undefined, { roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.85 }, 12);
        b.position.set(x, sy + 0.05, BACK + 0.25 + (rng() - 0.5) * 0.08);
      }
    }
    kit.sign('PERFECT POUR', 3.6, 0.6, 0, 3.15, BACK + 0.14, undefined, { bg: null, fg: '#ff6a3a', glow: '#ff3a1a', font: '900 160px "Brush Script MT", "Segoe Script", cursive' });
    kit.sign('BOGAN ARMS HOTEL  ·  COLD BEER', Math.min(W + 2, 9), 0.42, 0, 3.75, BACK + 0.14, undefined, { bg: '#1e3d2a', fg: '#f0d890' });
    const neon = new THREE.PointLight(0xff5a2a, 4, 6, 1.6); neon.position.set(0, 3.1, BACK + 0.8); scene.add(neon);

    // ----- the taps, the glasses and the bar staff -----
    const glassM = new THREE.MeshStandardMaterial({ color: 0xeef6ff, transparent: true, opacity: 0.2, roughness: 0.04, metalness: 0, depthWrite: false, side: THREE.DoubleSide });
    const rimM = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, roughness: 0.05, depthWrite: false });
    const beerM = new THREE.MeshStandardMaterial({ color: 0xd8861a, emissive: 0x6a3004, emissiveIntensity: 0.55, roughness: 0.12, transparent: true, opacity: 0.9 });
    const foamM = new THREE.MeshStandardMaterial({ color: 0xfaf3e2, roughness: 0.85 });
    const chrome = kit.mat(0xe0e4e8, { metalness: 1, roughness: 0.12 });
    const bubGeo = new THREE.SphereGeometry(0.008, 6, 4), bubM = new THREE.MeshBasicMaterial({ color: 0xffe8b0 });
    const rIn = (y) => R0 + (R1 - R0) * Math.max(0, Math.min(1, y / GH)); // the inside radius at height y
    const NB = 16;

    const pops = [];
    const pop = (x, y, z, text, color, size = 1, stay = false) => {
      const c = document.createElement('canvas'); c.width = 512; c.height = 160;
      const g = c.getContext('2d'); g.font = '900 100px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 14; g.strokeStyle = '#1a0d08'; g.strokeText(text, 256, 84, 490); g.fillStyle = color; g.fillText(text, 256, 84, 490);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); sp.scale.set(1.6 * size, 0.5 * size, 1); sp.renderOrder = 20;
      sp.position.set(x, y, z); scene.add(sp); pops.push({ sp, life: 0, stay });
    };

    const stations = players.map((p, i) => {
      const x = -W / 2 + SP / 2 + i * SP;
      const g = kit.group(x, BAR, 0);
      // drip tray and a beer mat in the player's colour
      kit.box(0.62, 0.025, 0.42, 0x1a1a1a, 0, 0, 0, g, { roughness: 0.6 });
      kit.box(0.58, 0.012, 0.38, 0x8a8f94, 0, 0.025, 0, g, { metalness: 0.9, roughness: 0.35 });
      kit.cyl(0.13, 0.13, 0.008, p.color, 0.42, 0, 0.18, g, { roughness: 0.8 });
      // the font: a chrome tower with the tap arm out over the glass
      const SPOUT = GH + 0.26;
      kit.cyl(0.07, 0.09, SPOUT + 0.12, chrome, 0, 0, -0.32, g);
      kit.ball(0.09, chrome, 0, SPOUT + 0.12, -0.32, g);
      kit.rod([0, SPOUT + 0.06, -0.32], [0, SPOUT + 0.06, 0], 0.035, chrome, g);
      kit.cyl(0.02, 0.028, 0.08, chrome, 0, SPOUT - 0.02, 0, g);
      // the tap handle, a tall one with the brewery's name on it; it pulls forward to pour
      const handle = kit.group(0, SPOUT + 0.1, 0, 0, 1, g);
      kit.cyl(0.018, 0.018, 0.08, 0x111111, 0, 0, 0, handle);
      kit.box(0.08, 0.28, 0.05, p.color, 0, 0.08, 0, handle, { roughness: 0.4 });
      kit.ball(0.05, 0xf0e6d0, 0, 0.38, 0, handle);
      // the schooner, its beer, its head and its bubbles
      const glassG = kit.group(0, 0.03, 0, 0, 1, g);
      const glass = kit.lathe([[0.001, 0], [R0 + 0.01, 0], [R0 + 0.012, 0.05], [R0 + 0.012, 0.07], [R1 + 0.012, GH], [R1, GH]], glassM, glassG, undefined, 40);
      glass.renderOrder = 3; glass.castShadow = false;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(R1 + 0.006, 0.006, 6, 40), rimM); rim.rotation.x = Math.PI / 2; rim.position.y = GH; rim.renderOrder = 4; glassG.add(rim);
      const base = kit.cyl(R0 + 0.012, R0 + 0.012, 0.05, glassM, 0, 0, 0, glassG); base.renderOrder = 3;
      const beer = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 32), beerM); beer.visible = false; glassG.add(beer);
      const foam = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 32), foamM); foam.visible = false; glassG.add(foam);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 8, 0, Math.PI * 2, 0, Math.PI / 2), foamM); cap.visible = false; glassG.add(cap);
      const bubbles = new THREE.InstancedMesh(bubGeo, bubM, NB); bubbles.count = 0; glassG.add(bubbles);
      const bub = Array.from({ length: NB }, () => ({ a: rng() * 6.28, r: rng() * 0.8, y: rng(), s: 0.15 + rng() * 0.2 }));
      // foam running down the outside, and a puddle in the tray
      const drip = new THREE.Mesh(new THREE.CylinderGeometry(R1 + 0.018, R0 + 0.02, GH, 32, 1, true), new THREE.MeshStandardMaterial({ color: 0xfaf3e2, transparent: true, opacity: 0, roughness: 0.8, depthWrite: false }));
      drip.position.y = GH / 2 + 0.03; drip.renderOrder = 5; g.add(drip);
      const puddle = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshStandardMaterial({ color: 0xc88a2a, roughness: 0.1, transparent: true, opacity: 0.8 }));
      puddle.rotation.x = -Math.PI / 2; puddle.position.y = 0.04; puddle.scale.setScalar(0.001); g.add(puddle);
      // the stream from the spout
      const stream = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 10), beerM); stream.visible = false; g.add(stream);
      // a pendant light over each tap
      const shade = kit.cone(0.22, 0.2, 0x1e3d2a, 0, 2.45 - BAR, -0.2, g, { side: THREE.DoubleSide, roughness: 0.5 });
      shade.rotation.x = Math.PI; shade.position.y = 2.55 - BAR;
      const bulb = kit.ball(0.06, 0xfff2d0, 0, 2.43 - BAR, -0.2, g, { emissive: 0xffd890, emissiveIntensity: 3 });
      bulb.castShadow = false;
      kit.rod([0, 2.6 - BAR, -0.2], [0, 4.4 - BAR, -0.2], 0.008, 0x111111, g);
      const lamp = new THREE.PointLight(0xffd8a0, 2.2, 3.2, 1.6); lamp.position.set(0, 2.3 - BAR, -0.1); g.add(lamp);
      // the bartender, behind the bar beside the tap
      const doll = mg.makeDoll(p, { scale: DOLL });
      doll.group.position.set(x + 0.5, 0, -1.05); doll.group.rotation.y = -0.25; scene.add(doll.group);
      return { p, x, g, handle, beer, foam, cap, bubbles, bub, drip, puddle, stream, doll, spout: SPOUT,
        v: 0, want: 0, beerH: 0, foamH: 0, beerLvl: 0, foamLvl: 0, spill: 0, started: false, locked: false, shut: 0, age: 0, lockT: 0, judged: null, pourT: 0,
        bot: p.bot ? { wait: 0.6 + rng() * 5, v1: 0.5 + rng() * 0.4, sw: 0.5 + rng() * 0.25, v2: 0.18 + rng() * 0.16, stop: 0.97 + (rng() - 0.45) * 0.1, lag: 0 } : null };
    });

    const state = (S) => ({ started: S.started, beer: S.beerLvl, foam: S.foamLvl, spill: S.spill });
    const lock = (S, why) => {
      if (S.locked) return;
      S.locked = true; S.lockT = 0; S.want = 0;
      if (why) pop(S.x, BAR - 0.3, 0.6, why, '#ffffff', 0.9);
    };

    // drawing the beer and the head in the glass
    const fit = (mesh, y0, y1) => {
      if (y1 - y0 < 0.002) { mesh.visible = false; return; }
      mesh.visible = true;
      const ra = rIn(y0), rb = rIn(y1);
      mesh.geometry.dispose(); mesh.geometry = new THREE.CylinderGeometry(rb, ra, y1 - y0, 32);
      mesh.scale.set(1, 1, 1); mesh.position.y = 0.05 + (y0 + y1) / 2;
    };

    const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 80);
    const span = Math.max(W + 0.7, 5.6);
    const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(15)) * 16 / 9);
    const dist = span / 2 / Math.tan(hfov / 2);
    camera.position.set(0, 2.5 + dist * 0.06, dist - 0.6);
    camera.lookAt(0, 1.5, -0.4);

    let run = 0, tAll = 0, finishAt = null, pourSnd = 0;
    return {
      camera,
      update(dt, t, running) {
        tAll += dt;
        if (running) run += dt;
        const lastCall = running && run > mg.duration - SETTLE - 1.2;
        let anyPour = false;
        for (const S of stations) {
          if (S.bot && running && !S.locked) {
            // CPU: wait a bit, open it up, ease off near the top, shut it where it reckons is right
            const B = S.bot, lvl = S.beerLvl + S.foamLvl;
            B.wait -= dt;
            if (B.wait <= 0) {
              B.lag -= dt;
              if (B.lag <= 0) { B.lag = 0.18 + rng() * 0.2; S.want = lvl < B.sw ? B.v1 : lvl < B.stop ? B.v2 : 0; }
            }
          }
          // the tap handle follows the slider a touch slowly, like a real one
          const target = S.locked ? 0 : S.want;
          S.v += (target - S.v) * Math.min(1, dt * 14);
          if (S.v < 0.01 && target === 0) S.v = 0;
          if (!running && !S.locked) S.v = 0;
          const v = S.v;
          if (v > 0.02) {
            if (!S.started) S.started = true;
            if (S.shut > 0) S.age = 0;
            S.shut = 0; anyPour = true; S.pourT += dt;
            const f = foamFrac(v, S.age); S.age += dt;
            const q = QMAX * v * dt;
            S.beerLvl += q * (1 - f); S.foamLvl += q * f * FX;
          } else if (S.started && !S.locked) {
            S.shut += dt;
            if (S.shut > 0.4 && S.pourT > 0.25) lock(S); // that's your one pour
          }
          if (lastCall && S.started && !S.locked) lock(S, 'TIME!');
          // the head settles back into beer
          const d = K * S.foamLvl * dt; S.foamLvl -= d; S.beerLvl += d / FX;
          // too much and it runs over the rim
          const lvl = S.beerLvl + S.foamLvl;
          if (lvl > DOME) {
            const e = lvl - DOME;
            if (S.foamLvl > e) S.foamLvl -= e; else { S.beerLvl -= e - S.foamLvl; S.foamLvl = 0; }
            S.spill += e;
          }
          // judging, once it's had time to settle
          if (S.locked && !S.judged) {
            S.lockT += dt;
            if (S.lockT >= SETTLE) {
              S.judged = judge(state(S));
              const s = Math.round(S.judged.score);
              pop(S.x, BAR - 0.3, 0.6, `${s}`, S.p.color, 1.5, true);
              pop(S.x, BAR - 0.68, 0.6, S.judged.say, '#ffffff', 0.9, true);
              sfx.play(s >= 92 ? 'cheers' : s >= 60 ? 'coin' : 'lose');
              if (s >= 92) S.doll.bounce(); else if (s < 50) S.doll.flinch();
            }
          }

          // ----- drawing -----
          const bH = Math.min(1, S.beerLvl), fTop = Math.min(1, S.beerLvl + S.foamLvl);
          fit(S.beer, 0, bH * GH);
          fit(S.foam, bH * GH, fTop * GH);
          const proud = Math.max(0, S.beerLvl + S.foamLvl - 1) * GH;
          S.cap.visible = S.foamLvl > 0.01 || proud > 0.002;
          if (S.cap.visible) {
            const top = fTop * GH;
            S.cap.material = S.foamLvl > 0.01 ? foamM : beerM;
            S.cap.scale.set(rIn(top), Math.max(0.006, proud + 0.008), rIn(top)); S.cap.position.y = 0.05 + top - 0.002;
          }
          // bubbles rising through the beer
          if (bH > 0.04) {
            S.bubbles.count = NB;
            const m4 = new THREE.Matrix4();
            S.bub.forEach((b, k) => {
              b.y += dt * b.s / Math.max(0.2, bH); if (b.y > 1) { b.y = 0; b.a = rng() * 6.28; }
              const y = b.y * bH * GH, r = rIn(y) * b.r * 0.9;
              m4.makeTranslation(Math.cos(b.a) * r, 0.05 + y, Math.sin(b.a) * r); S.bubbles.setMatrixAt(k, m4);
            });
            S.bubbles.instanceMatrix.needsUpdate = true;
          }
          S.drip.material.opacity = Math.min(0.85, S.spill * 6);
          S.puddle.scale.setScalar(Math.min(0.3, 0.001 + S.spill * 1.4));
          // the stream: thicker the more the tap's open
          S.stream.visible = v > 0.02;
          if (S.stream.visible) {
            const yTop = S.spout - 0.06, yBot = 0.05 + Math.max(0.02, fTop) * GH, r = 0.006 + 0.016 * Math.sqrt(v);
            S.stream.scale.set(r, yTop - yBot, r); S.stream.position.set(Math.sin(tAll * 40) * 0.002, (yTop + yBot) / 2, 0);
          }
          S.handle.rotation.x = v * 0.9;
          // the bartender: reaches for the handle while pouring, and watches the glass
          S.doll.setArms(0.25 + v * 0.9, 0.2);
          S.doll.update(dt);
        }
        if (anyPour) { pourSnd -= dt; if (pourSnd <= 0) { pourSnd = 0.28; sfx.play('pour'); } }
        if (finishAt == null && stations.every((S) => S.judged)) finishAt = tAll;
        for (let i = pops.length - 1; i >= 0; i--) { const q = pops[i]; q.life += dt; if (q.stay) { q.sp.material.opacity = Math.min(1, q.life * 4); continue; } q.sp.position.y += dt * 0.5; q.sp.material.opacity = Math.min(1, 2.4 - q.life * 2); if (q.life > 1.2) { scene.remove(q.sp); pops.splice(i, 1); } }
      },
      input(p, m) {
        const S = stations.find((x) => x.p === p);
        if (S && !S.locked && m.b === 'slide' && Number.isFinite(m.v)) S.want = Math.max(0, Math.min(1, (m.v - 0.04) / 0.96));
      },
      // out of 100: beer to the rim with a finger of head; until it's judged, how it would score right now
      scores() { return Object.fromEntries(stations.map((S) => [S.p.id, Math.round((S.judged ? S.judged.score : judge(state(S)).score) * 10) / 10])); },
      done: () => finishAt != null && tAll - finishAt > 3,
    };
  },
};
