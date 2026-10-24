// Fishing Off the Jetty: everyone lines up at the end of the jetty with a rod. The phone is a stick,
// used like the rod and reel: pull it back and flick it up to cast (the quicker the flick, the further
// out, and further out is bigger fish and more junk). When your float goes under it's a BITE: flick up
// (or start winding) to strike, then wind the stick round in circles to reel it in. Winding tightens the
// line, and when the fish makes a run it tightens on its own, so ease off or it snaps. No tapping
// anywhere (phones zoom on quick taps). Stingrays just nick your bait. Heaviest total catch wins.
import { addSky } from '../../host/sky.js';

const DOLL = 0.62;
const CAST_MIN = 3, CAST_MAX = 8.5; // how far out the float lands
const WAIT = [2.2, 5.5], BITE_T = 1.3, PER_TURN = 1.25, RIG_T = 1.1; // metres of line per turn of the stick
const SPECIES = [
  { id: 'thong', name: 'AN OLD THONG', kg: [0.2, 0.2], near: 2, far: 1.5, color: 0x2a6ad8, junk: true },
  { id: 'weed', name: 'SEAWEED', kg: [0.1, 0.1], near: 2, far: 1, color: 0x3a6a2a, junk: true },
  { id: 'ruff', name: 'TOMMY RUFF', kg: [0.2, 0.4], near: 4, far: 1, color: 0x9ab0b8 },
  { id: 'whiting', name: 'WHITING', kg: [0.3, 0.7], near: 3, far: 2, color: 0xd8c8a0 },
  { id: 'flathead', name: 'FLATHEAD', kg: [0.8, 2.2], near: 1, far: 3, color: 0x8a6a40 },
  { id: 'snapper', name: 'SNAPPER', kg: [2, 5.5], near: 0.2, far: 2.5, color: 0xe86a6a },
  { id: 'mulloway', name: 'MULLOWAY', kg: [6, 11], near: 0, far: 0.8, color: 0xa8b0a0 },
  { id: 'ray', name: 'STINGRAY', kg: [0, 0], near: 1, far: 1.5, color: 0x5a5a4a, thief: true },
];

export default {
  id: 'fishing-off-the-jetty',
  name: 'Fishing Off the Jetty',
  blurb: 'Cast, wait for a bite, and reel it in without snapping the line. Heaviest catch wins.',
  howTo: "Your stick is the rod and reel. Pull it back and flick it up to cast: a quicker flick goes further, and further out means bigger fish (and more junk). When your float goes under it's a bite: flick up straight away to strike, then wind the stick round in circles to reel it in. Winding tightens the line, and when the fish makes a run it tightens on its own, so slow down when the bar goes red or the line snaps. Stingrays just nick your bait. Heaviest total catch wins.",
  padText: 'Pull back and flick up to cast. Circle to reel',
  duration: 75,
  pad: { kind: 'stick', buttons: [] },

  create(mg) {
    const { THREE, kit, scene, players, rng, renderer, sfx } = mg;
    const n = players.length;

    // ----- the bay, the jetty, the beach behind -----
    const { sun } = addSky(scene, renderer, { elevation: 26, azimuth: 30, turbidity: 3, sunIntensity: 2.8, sky: 0xbcd8f0, ground: 0x6a7a8a, hemi: 0.6, env: 0.6, shadowSize: 30, fog: [0xc8dcec, 60, 200] });
    sun.target.position.set(0, 0, 5);
    const waterMat = kit.surf('water', { unit: 6, tint: 0x8ac8e0, roughness: 0.4, metalness: 0.1 });
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(260, 260, 1, 1), waterMat); sea.rotation.x = -Math.PI / 2; sea.position.set(0, 0, 20); sea.receiveShadow = true; scene.add(sea);
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(260, 60), kit.surf('sand', { unit: 4, tint: 0xf0dcae })); sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.05, -52); scene.add(sand);
    { const shore = new THREE.Mesh(new THREE.PlaneGeometry(260, 3), kit.mat(0xffffff, { transparent: true, opacity: 0.6 })); shore.rotation.x = -Math.PI / 2; shore.position.set(0, 0.06, -22.5); scene.add(shore); }
    // the jetty: planks on piles, running back to the beach, with a wider T at the end
    const plank = kit.surf('planks', { unit: 1.4, tint: 0xa88a64 });
    const DECK = 1.6;
    kit.box(Math.max(16, n * 3.4 + 4), 0.25, 3.2, plank, 0, DECK - 0.25, -0.6);
    kit.box(3.2, 0.25, 22, plank, 0, DECK - 0.25, -13);
    for (let x = -Math.max(8, n * 1.7 + 2); x <= Math.max(8, n * 1.7 + 2); x += 2.2) for (const z of [0.85, -2.05]) { kit.cyl(0.16, 0.18, DECK + 1.6, 0x5a4a3a, x, -1.6, z); }
    for (let z = -4; z > -24; z -= 3) for (const s of [-1, 1]) kit.cyl(0.16, 0.18, DECK + 1.6, 0x5a4a3a, s * 1.45, -1.6, z);
    // a rail along the back of the T and down the jetty
    const rail = 0xe8e0d0;
    kit.box(Math.max(16, n * 3.4 + 4), 0.08, 0.08, rail, 0, DECK + 0.95, -2.1);
    for (let x = -Math.max(8, n * 1.7 + 2); x <= Math.max(8, n * 1.7 + 2); x += 2.2) kit.box(0.08, 1, 0.08, rail, x, DECK, -2.1);
    for (const s of [-1, 1]) { kit.box(0.08, 0.08, 20, rail, s * 1.55, DECK + 0.95, -12.2); for (let z = -2.2; z > -22; z -= 2.5) kit.box(0.08, 1, 0.08, rail, s * 1.55, DECK, z); }
    // a lamp post, a bait bucket and an esky
    { const lamp = kit.group(Math.max(7, n * 1.7 + 1), DECK, -1.6); kit.cyl(0.06, 0.08, 3.2, 0x2a3a2a, 0, 0, 0, lamp); kit.ball(0.22, 0xfff2c8, 0, 3.35, 0, lamp, { emissive: 0x554422 }); }
    // the foreshore: a kiosk, Norfolk pines, beach huts
    { const k = kit.group(-8, 0, -30); kit.box(7, 3, 4, kit.surf('weatherboard', { arg: 0xf0e8d8, unit: 3 }), 0, 0, 0, k); kit.box(7.6, 0.3, 4.6, 0x2a6a8a, 0, 3, 0, k); kit.sign('BAIT & TACKLE', 5, 0.8, 0, 3.6, 2.05, k, { bg: '#2a6a8a', fg: '#ffffff', font: '900 110px system-ui' }); }
    for (const [x, z] of [[-24, -34], [-14, -38], [10, -34], [20, -37], [30, -33], [-34, -36]]) { const t = kit.group(x, 0, z); kit.cyl(0.35, 0.5, 14, 0x6a5040, 0, 0, 0, t); for (let k = 0; k < 6; k++) kit.cone(3.2 - k * 0.45, 2.4, 0x2a5a3a, 0, 4 + k * 1.7, 0, t); }
    for (let k = 0; k < 5; k++) { const h = kit.group(6 + k * 3, 0, -26); kit.box(2.2, 2.2, 2.2, [0xe8402a, 0xffd23f, 0x2a8ad8, 0x3aa83a, 0xff8ad8][k], 0, 0, 0, h); kit.cone(1.8, 1, 0xf0f0f0, 0, 2.2, 0, h, {}, 4).rotation.y = Math.PI / 4; }
    // a couple of seagulls loitering on the rail
    const gulls = [0, 1, 2].map((k) => { const g = kit.group(-5 + k * 5.5, DECK + 1.0, -2.1); kit.ball(0.2, 0xffffff, 0, 0.18, 0, g).scale.set(1.4, 1, 1); kit.ball(0.11, 0xffffff, 0.24, 0.34, 0, g); kit.cone(0.04, 0.14, 0xffb800, 0.38, 0.32, 0, g).rotation.z = -Math.PI / 2; kit.box(0.3, 0.05, 0.2, 0x9aa0a8, -0.05, 0.25, 0, g); return g; });

    // ----- fish models -----
    const fishModel = (S, kg) => {
      const g = new THREE.Group();
      const m = kit.mat(S.color, { roughness: 0.35, metalness: S.junk ? 0 : 0.3 });
      if (S.id === 'thong') { const sole = kit.box(0.3, 0.05, 0.7, m, 0, -0.025, 0, g); sole.rotation.x = Math.PI / 2; kit.box(0.04, 0.2, 0.04, 0xffffff, 0, 0.15, 0.03, g); }
      else if (S.id === 'weed') { for (let k = 0; k < 5; k++) { const b = kit.ball(0.12, m, (rng() - 0.5) * 0.2, -k * 0.13, (rng() - 0.5) * 0.1, g); b.scale.set(1, 1.6, 0.4); } }
      else {
        const s = Math.min(1.8, 0.45 + Math.cbrt(kg) * 0.42);
        const body = kit.ball(0.22, m, 0, -0.32 * s, 0, g); body.scale.set(0.45 * s, 1.6 * s, 0.9 * s);
        const tail = kit.cone(0.16 * s, 0.24 * s, m, 0, -0.62 * s - 0.24 * s, 0, g, {}, 4); tail.rotation.x = 0; tail.scale.z = 0.25;
        kit.ball(0.03 * s, 0x111111, 0.08 * s, -0.08 * s, 0.12 * s, g); kit.ball(0.03 * s, 0x111111, 0.08 * s, -0.08 * s, -0.12 * s, g);
      }
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      return g;
    };
    const pick = (far) => {
      const w = SPECIES.map((S) => S.near * (1 - far) + S.far * far), sum = w.reduce((a, b) => a + b, 0);
      let r = rng() * sum; for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return SPECIES[i]; } return SPECIES[2];
    };

    // ----- pops -----
    const pops = [];
    const pop = (x, y, z, text, color, size = 1, stay = 1.1) => {
      const c = document.createElement('canvas'); c.width = 768; c.height = 160;
      const g = c.getContext('2d'); g.font = '900 96px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 16; g.strokeStyle = '#0a1a2a'; g.strokeText(text, 384, 84, 750); g.fillStyle = color; g.fillText(text, 384, 84, 750);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); sp.scale.set(4.8 * size, 1 * size, 1); sp.renderOrder = 1000;
      sp.position.set(x, y, z); scene.add(sp); pops.push({ sp, life: 0, stay }); return sp;
    };

    // ----- the fishers -----
    const lineMat = new THREE.LineBasicMaterial({ color: 0xf8f8f8, transparent: true, opacity: 0.85 });
    const SPACE = n > 5 ? 2.75 : 3.4, CARD = n > 5 ? 0.88 : 1; // a full jetty packs in tighter
    const fishers = players.map((p, k) => {
      const x = (k - (n - 1) / 2) * SPACE;
      const doll = mg.makeDoll(p, { scale: DOLL, tag: false });
      doll.group.position.set(x, DECK, 0.35); scene.add(doll.group);
      // rod: a pivot at the hands, pointing out over the water
      const rod = new THREE.Group(); rod.position.set(x + 0.35, DECK + 1.05, 0.7); scene.add(rod);
      const blank = kit.cyl(0.015, 0.035, 3.2, 0x1a1a1a, 0, 0, 0, rod); blank.castShadow = true;
      kit.cyl(0.07, 0.07, 0.12, 0xc8c8c8, 0, 0.35, 0.06, rod, { metalness: 0.8 }).rotation.x = Math.PI / 2;
      // float: red and white
      const float = new THREE.Group(); scene.add(float);
      kit.ball(0.12, 0xe8202a, 0, 0.04, 0, float); kit.ball(0.121, 0xffffff, 0, -0.03, 0, float).scale.y = 0.5; kit.cyl(0.015, 0.015, 0.2, 0xe8202a, 0, 0.12, 0, float);
      float.visible = false;
      const pts = new Float32Array(9 * 3); const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(pts, 3));
      const line = new THREE.Line(lg, lineMat); line.frustumCulled = false; scene.add(line);
      // the card over their head
      const c = document.createElement('canvas'); c.width = 320; c.height = 170;
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const card = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); card.scale.set(2.6 * CARD, 1.38 * CARD, 1); card.renderOrder = 900;
      card.position.set(x, DECK + 3.3, 0.4); scene.add(card);
      return { p, k, x, doll, rod, float, line, lg, c, t, card, kg: 0, best: null, state: 'ready', T: 0, power: 0, pdir: 1, dist: 0, fx: x, fz: 0, fish: null, tension: 0, surge: 0, nextSurge: 0, held: null, heldT: 0, caught: [], biteSpin: 0, clickT: 0, lowAt: null, prevY: null, prevA: null,
        bot: p.bot ? { react: 0.25 + rng() * 0.45, spin: 8 + rng() * 6, care: 0.5 + rng() * 0.45, nextT: 0.5 + rng() * 1.5 } : null };
    });
    const STATE_TXT = { ready: 'PULL BACK...', centre: 'LET GO OF THE STICK', wind: 'FLICK UP!', flying: '...', wait: 'WAITING', bite: 'BITE! FLICK UP!', fight: 'WIND IT IN', rig: 'NEW BAIT' };
    const drawCard = (F) => {
      const g = F.c.getContext('2d'); g.clearRect(0, 0, 320, 170);
      g.fillStyle = 'rgba(10,26,42,0.82)'; g.beginPath(); g.roundRect(4, 4, 312, 162, 20); g.fill(); g.lineWidth = 6; g.strokeStyle = F.p.color; g.stroke();
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#ffffff'; g.font = '800 30px system-ui'; g.fillText(F.p.name, 160, 32, 290);
      g.fillStyle = '#ffd23f'; g.font = '900 44px system-ui'; g.fillText(`${F.kg.toFixed(1)} kg`, 160, 76);
      // the bar: casting power, or line tension when fighting
      if (F.state === 'fight') {
        const v = Math.min(1, F.tension);
        g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(22, 112, 276, 22);
        g.fillStyle = v > 0.8 ? '#ff3a2a' : v > 0.55 ? '#ffb800' : '#5cff9d'; g.fillRect(22, 112, 276 * v, 22);
        if (F.state === 'fight') { g.fillStyle = '#ff3a2a'; g.fillRect(22 + 276 * 0.999 - 4, 108, 4, 30); }
        g.fillStyle = '#ffffff'; g.font = '800 20px system-ui'; g.fillText(F.surge > 0 ? 'IT\'S RUNNING! EASE OFF' : 'CIRCLE TO WIND IT IN', 160, 152);
      } else { g.fillStyle = F.state === 'bite' ? '#ff5a3a' : '#c8d8e8'; g.font = '900 30px system-ui'; g.fillText((F.state === 'ready' && F.needCentre ? STATE_TXT.centre : STATE_TXT[F.state]) || '', 160, 130, 290); }
      F.t.needsUpdate = true;
    };
    fishers.forEach(drawCard);

    const cast = (F, power) => {
      F.state = 'flying'; F.T = 0; F.power = power; F.dist = CAST_MIN + (CAST_MAX - CAST_MIN) * power;
      F.fx = F.x * 0.85 + (rng() - 0.5) * 1.2; F.fz = 0.6 + F.dist; F.float.visible = true;
      sfx.play('whoosh'); F.doll.setArms(1.3, 0); F.armT = 0.5;
    };
    const strike = (F) => {
      F.state = 'fight'; F.tension = 0.3; F.surge = 0; F.nextSurge = 0.8 + rng() * 1.5; sfx.play('boing');
      pop(F.x, DECK + 4.2, 0.4, 'HOOKED!', '#ffd23f', 0.6, 0.5);
    };
    // winding: `rad` is how far round the stick went
    const wind = (F, rad) => {
      if (F.state === 'bite') { F.biteSpin += rad; if (F.biteSpin > Math.PI * 0.6) strike(F); return; }
      if (F.state !== 'fight') return;
      const turns = rad / (Math.PI * 2);
      F.dist = Math.max(0, F.dist - turns * PER_TURN); F.tension += turns * (0.2 + F.fish.kg * 0.025);
      F.clickT -= rad; if (F.clickT <= 0) { F.clickT = Math.PI; sfx.play('tick'); }
    };
    const snap = (F, text, color = '#ff7a5a') => { F.state = 'rig'; F.T = RIG_T; F.fish = null; F.float.visible = false; pop(F.x, DECK + 4.2, 0.4, text, color, 0.6, 0.8); };
    const land = (F) => {
      const S = F.fish.S, kg = F.fish.kg;
      F.kg += kg; F.caught.push(S.id);
      F.held = fishModel(S, kg); scene.add(F.held); F.heldT = 1.6;
      pop(F.x, DECK + 4.4, 0.4, S.junk ? `${S.name}!` : `${S.name} ${kg.toFixed(1)} KG`, S.junk ? '#c8d8e8' : kg >= 4 ? '#ffd23f' : '#5cff9d', S.junk ? 0.55 : 0.6, 1.1);
      sfx.play(S.junk ? 'lose' : kg >= 4 ? 'hallelujah' : 'coin'); if (!S.junk) F.doll.bounce(1.3);
      F.fish = null; F.state = 'rig'; F.T = 0.9; F.float.visible = false;
    };

    const camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.3, 300);
    const camZ = Math.max(16.5, ((n - 1) * SPACE / 2 + 2.2) / 0.755 + 3.2);
    camera.position.set(0, 6.2 * camZ / 16.5, camZ);
    camera.lookAt(0, 2.0, 3.2);

    let tAll = 0, cardT = 0;
    return {
      camera,
      update(dt, t, running) {
        tAll += dt;
        for (const F of fishers) {
          // ----- bots -----
          if (F.bot && running) {
            const B = F.bot; B.nextT -= dt;
            if (F.state === 'ready' && B.nextT <= 0) cast(F, 0.3 + rng() * 0.7);
            else if (F.state === 'bite' && F.T > B.react + (rng() - 0.5) * 0.1) strike(F);
            else if (F.state === 'fight') {
              const safe = F.surge > 0 ? 0.35 * (1 - B.care) : 0.62 + (1 - B.care) * 0.3;
              if (F.tension < safe) wind(F, B.spin * dt);
            }
            if (F.state !== 'ready') B.nextT = 0.4 + rng() * 1;
          }
          // ----- states -----
          if (running) F.T += F.state === 'rig' ? -dt : dt;
          if (F.state === 'flying') {
            const f = Math.min(1, F.T / 0.75);
            F.float.position.set(F.x + (F.fx - F.x) * f, DECK + 3 + Math.sin(f * Math.PI) * 3 - f * (DECK + 3), 0.7 + (F.fz - 0.7) * f);
            if (f >= 1) { F.state = 'wait'; F.T = 0; F.biteAt = WAIT[0] + rng() * (WAIT[1] - WAIT[0]); sfx.play('thud'); }
          } else if (F.state === 'wait') {
            F.float.position.set(F.fx, Math.sin(tAll * 2 + F.k) * 0.04, F.fz);
            if (running && F.T >= F.biteAt) {
              const far = Math.min(1, (F.dist - CAST_MIN) / (CAST_MAX - CAST_MIN)), S = pick(far);
              if (S.thief) { snap(F, 'STINGRAY NICKED YOUR BAIT', '#c8d8e8'); sfx.play('lose'); }
              else { F.fish = { S, kg: S.kg[0] + rng() * (S.kg[1] - S.kg[0]) }; F.state = 'bite'; F.T = 0; F.biteSpin = 0; sfx.play('squeak'); }
            }
          } else if (F.state === 'bite') {
            F.float.position.set(F.fx, -0.15 - Math.abs(Math.sin(tAll * 18)) * 0.12, F.fz);
            if (F.T > BITE_T) { // too slow
              if (rng() < 0.45) snap(F, 'IT TOOK THE BAIT', '#c8d8e8');
              else { F.state = 'wait'; F.T = 0; F.biteAt = 1 + rng() * 3; F.fish = null; pop(F.x, DECK + 4.2, 0.4, 'MISSED IT', '#c8d8e8', 0.5, 0.5); }
            }
          } else if (F.state === 'fight') {
            const kg = F.fish.kg, S = F.fish.S;
            // the fish makes runs; junk just drags
            if (!S.junk) {
              F.nextSurge -= dt;
              if (F.surge > 0) { F.surge -= dt; F.tension += (0.35 + kg * 0.09) * dt; F.dist = Math.min(CAST_MAX + 3, F.dist + (0.8 + kg * 0.15) * dt); }
              else if (F.nextSurge <= 0) { F.surge = 0.7 + rng() * 0.8 + kg * 0.05; F.nextSurge = 1.6 + rng() * 2.6; sfx.play('whoosh'); }
            }
            F.tension = Math.max(0, F.tension - (0.55 + (S.junk ? 0.4 : 0)) * dt);
            if (F.tension >= 1) { snap(F, 'SNAPPED!'); sfx.play('boom'); F.doll.flinch(); }
            else {
              const wob = F.surge > 0 ? Math.sin(tAll * 14) * 0.4 : Math.sin(tAll * 4) * 0.15;
              const zz = 0.7 + F.dist, xx = F.x + (F.fx - F.x) * Math.min(1, F.dist / 6) + wob;
              F.float.position.set(xx, -0.05 + Math.sin(tAll * 9) * 0.05, zz);
              if (F.dist <= 0.05) land(F);
            }
          } else if (F.state === 'rig') { if (F.T <= 0) { F.state = 'ready'; F.T = 0; F.needCentre = !F.bot; } }
          // ----- the rod and line -----
          const bend = F.state === 'fight' ? Math.min(1, F.tension) * 0.7 + (F.surge > 0 ? 0.2 : 0) : F.state === 'bite' ? 0.25 : 0;
          const lift = F.state === 'wind' ? -0.9 : F.state === 'flying' ? 0.9 : 0.75;
          F.rod.rotation.set(lift + bend * 0.5, 0, (F.fx - F.x) * -0.04);
          const tip = new THREE.Vector3(0, 3.2, 0).applyEuler(F.rod.rotation).add(F.rod.position);
          const a = F.lg.attributes.position;
          const showLine = F.float.visible;
          const end = showLine ? F.float.position : tip;
          const slack = F.state === 'wait' ? 0.9 : F.state === 'fight' ? 0.25 * (1 - Math.min(1, F.tension)) : 0.3;
          for (let i = 0; i < 9; i++) { const s = i / 8; a.setXYZ(i, tip.x + (end.x - tip.x) * s, tip.y + (end.y - tip.y) * s - Math.sin(s * Math.PI) * slack * Math.max(1, (end.z - tip.z) * 0.15), tip.z + (end.z - tip.z) * s); }
          a.needsUpdate = true; F.line.visible = showLine;
          // a fish they've just landed swings off the rod tip
          if (F.held) { F.heldT -= dt; F.held.position.set(tip.x, tip.y - 0.1, tip.z); F.held.rotation.set(Math.sin(tAll * 8) * 0.3, tAll * 2, 0); if (F.heldT <= 0) { scene.remove(F.held); F.held = null; } }
          if (F.armT > 0) F.armT -= dt; else F.doll.setArms(F.state === 'fight' ? 0.5 + Math.sin(tAll * 20) * (F.surge > 0 ? 0 : 0.1) : 0.2, 0);
          F.doll.update(dt);
        }
        if ((cardT -= dt) <= 0) { cardT = 0.08; fishers.forEach(drawCard); }
        gulls.forEach((g, k) => { g.rotation.y = Math.sin(tAll * 0.7 + k * 2) * 0.8; g.position.y = DECK + 1.0 + Math.max(0, Math.sin(tAll * 3 + k * 5)) * 0.03; });
        if (waterMat.map) { waterMat.map.offset.x = tAll * 0.004; waterMat.map.offset.y = tAll * 0.006; }
        for (let i = pops.length - 1; i >= 0; i--) { const q = pops[i]; q.life += dt; q.sp.material.opacity = Math.max(0, Math.min(1, q.life * 5, q.stay - q.life + 1)); q.sp.position.y += dt * 0.5; if (q.life > q.stay + 1) { scene.remove(q.sp); pops.splice(i, 1); } }
      },
      input(p, m) {
        const F = fishers.find((x) => x.p === p); if (!F || m.b !== 'stick') return;
        const x = Math.max(-1, Math.min(1, Number(m.x) || 0)), y = Math.max(-1, Math.min(1, Number(m.y) || 0));
        // after a catch, let go of the stick before the next cast, so winding doesn't fling one out
        if (F.needCentre) { if (Math.hypot(x, y) < 0.35) F.needCentre = false; else { F.prevA = null; return; } }
        // casting: pull back, then flick up; a quicker flick goes further
        if (y < -0.6) { F.lowAt = tAll; if (F.state === 'ready') { F.state = 'wind'; sfx.play('tick'); } }
        if (y > 0.55 && F.lowAt != null) {
          const quick = tAll - F.lowAt;
          if (F.state === 'wind') cast(F, Math.max(0.08, Math.min(1, (0.5 - quick) / 0.4)));
          else if (F.state === 'bite') strike(F);
          F.lowAt = null;
        }
        if (F.state === 'bite' && y > 0.55 && F.prevY != null && F.prevY < 0.2) strike(F);
        F.prevY = y;
        // reeling: how far round the stick has gone since last time
        if (Math.hypot(x, y) > 0.45) {
          const a = Math.atan2(y, x);
          if (F.prevA != null) { let d = a - F.prevA; d = Math.atan2(Math.sin(d), Math.cos(d)); if (Math.abs(d) < 1.6) wind(F, Math.abs(d)); }
          F.prevA = a;
        } else F.prevA = null;
      },
      scores() { return Object.fromEntries(fishers.map((F) => [F.p.id, F.kg * 10])); },
    };
  },
};
