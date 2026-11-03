// Hand Tennis: four square on the school asphalt. Four squares in a 2x2 grid (King, Queen, Jack and
// Dunce), a tennis ball, and your hand for a racquet. The King serves. When the ball bounces in your
// square you have to hit it before it bounces again, into someone else's square: you pick which one with
// your four buttons. Hit it out, into your own square (that's a double bounce foul), or let it bounce
// twice and you're out.
// Out means: everyone below you moves up a square and you go to the back of the line, and the next one
// in the line steps in at Dunce. The King never goes out: a King who loses drops to Dunce. With nobody in
// the line (four or fewer), whoever loses drops to Dunce. Fewer than four players and CPUs fill the empty
// squares; they don't score. Every point you survive scores for the square you're in.
import { addSky } from '../../host/sky.js';

// the four target buttons, laid out on the phone in a 2x2 grid like the court on the TV
// (top row: King, Queen; bottom row: Dunce, Jack)
const BTN = [{ bit: 1, sq: 0 }, { bit: 2, sq: 1 }, { bit: 4, sq: 3 }, { bit: 8, sq: 2 }];
const NAMES = ['KING', 'QUEEN', 'JACK', 'DUNCE'];
const WORTH = [3, 2, 1, 1]; // points for surviving a point in each square
const SQ = 2.8; // each square is SQ x SQ metres; the middle lines cross at the origin
const G = 9.8, BOUNCE = 0.72, R = 0.13;
const REACH = 1.35; // how far from a doll's middle it can still get a hand to the ball
const WHIFF_CD = 0.45; // a swing at nothing locks your hand for a moment, so mashing doesn't help
// the squares: 0 King at the back left, then clockwise: Queen back right, Jack front right, Dunce front left
const CX = [-1, 1, 1, -1].map((s) => s * SQ / 2), CZ = [-1, -1, 1, 1].map((s) => s * SQ / 2);
const squareAt = (x, z) => {
  if (Math.abs(x) > SQ + 0.05 || Math.abs(z) > SQ + 0.05) return -1;
  return z < 0 ? (x < 0 ? 0 : 1) : (x < 0 ? 3 : 2);
};
const FILL_COLORS = ['#9aa4ae', '#c2b59b', '#8fb3a3'];

export default {
  id: 'hand-tennis',
  name: 'Hand Tennis',
  blurb: 'Four square on the school asphalt. Knock them out and work your way up to King.',
  howTo: "Four squares: King, Queen, Jack and Dunce. The King serves. When the ball bounces in your square, get to it and hit it before it bounces again: press the button for the square you want to send it to. Hit it out, let it bounce twice, or press your OWN square (a double bounce foul) and you're out. Out goes to the back of the line and everyone moves up; a King who loses drops to Dunce. Every point you survive scores: King 3, Queen 2, Jack and Dunce 1.",
  padText: 'Stick to move. Press the square you want to hit it into. Not your own!',
  duration: 100,
  perPlayer: 10, // more players, a longer line: everyone needs time on court
  pad: {
    kind: 'stick',
    buttons: BTN.map((b) => ({ bit: b.bit, label: (b.sq === 0 ? '👑 ' : '') + NAMES[b.sq], tone: b.sq === 0 ? 'go' : undefined })),
  },

  create(mg) {
    const { THREE, kit, scene, players, rng, sfx, renderer } = mg;

    // ----- the schoolyard -----
    addSky(scene, renderer, { elevation: 55, azimuth: 200, turbidity: 3, sunIntensity: 3.3, hemi: 0.7, env: 0.6, shadowSize: 16, fog: [0xcfe0ee, 50, 140] });
    const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), kit.surf('asphalt', { unit: 3, tint: 0xd0ccc4 }));
    asphalt.rotation.x = -Math.PI / 2; asphalt.receiveShadow = true; scene.add(asphalt);
    // the painted court: yellow lines, a bit worn, and each square's name
    const paint = kit.mat(0xf2d23a, { roughness: 0.7 });
    const line = (w, d, x, z) => { const m = kit.box(w, 0.012, d, paint, x, 0.002, z); m.receiveShadow = true; m.castShadow = false; };
    for (const x of [-SQ, 0, SQ]) line(0.12, SQ * 2 + 0.12, x, 0);
    for (const z of [-SQ, 0, SQ]) line(SQ * 2 + 0.12, 0.12, 0, z);
    const fnt = '900 150px Impact, "Arial Black", sans-serif';
    for (let s = 0; s < 4; s++) {
      const zz = CZ[s] + 0.95; // the camera side of each square, so the dolls don't stand on it
      kit.sign(NAMES[s], 1.7, 0.5, CX[s], 0.02, zz, scene, { bg: null, fg: '#f2d23a', font: fnt }).rotation.x = -Math.PI / 2;
    }
    // the school: a brick block with a verandah, the bubbler, a peppercorn tree and the bins
    const wall = kit.group(0, 0, -7.6);
    kit.box(26, 4.2, 0.4, kit.surf('brick', { unit: 1.4, tint: 0xc88a6a }), 0, 0, 0, wall);
    for (const x of [-9, -4.5, 4.5, 9]) kit.window(2.2, 1.4, x, 2.2, 0.22, wall, 0xe8e4d8);
    kit.box(1.4, 2.3, 0.06, 0x2a5a8a, 0, 0, 0.22, wall);
    kit.sign('BOGAN-O PRIMARY', 7.5, 0.8, 0, 3.4, 0.24, wall, { bg: '#1f4a7a', fg: '#ffffff', font: '900 120px system-ui, sans-serif' });
    kit.box(26, 0.1, 2.6, kit.surf('corrugated', { unit: 1, tint: 0xb8c0c4, metalness: 0.5 }), 0, 3.0, 1.4, wall).rotation.x = 0.06;
    for (const x of [-12, -6, 0, 6, 12]) kit.box(0.12, 3.0, 0.12, 0x2f5d3a, x, 0, 2.6, wall);
    const bub = kit.group(6.5, 0, -5.4);
    kit.box(0.6, 0.9, 0.5, kit.surf('steel', { unit: 1 }), 0, 0, 0, bub, { metalness: 0.8, roughness: 0.3 });
    kit.cyl(0.04, 0.04, 0.12, 0xc8c8c8, 0, 0.9, 0, bub, { metalness: 0.9 });
    for (const [x, c] of [[7.6, 0x2a6a2a], [8.3, 0xd8b020]]) kit.cyl(0.3, 0.28, 1.0, c, x, 0, -5.6);
    kit.box(0.4, 0.45, 4.6, kit.surf('planks', { unit: 1.2, tint: 0x8a6a4a }), -5.3, 0, 0.2); // the bench the line waits by

    // ----- dolls: everyone playing, plus CPUs to fill the court if there aren't four -----
    const DOLL = 0.72;
    const fillers = [];
    for (let k = players.length; k < 4; k++) {
      fillers.push({ id: 'ht-cpu' + k, name: 'CPU ' + (k - players.length + 1), color: FILL_COLORS[(k - players.length) % FILL_COLORS.length], body: 'smooth', photos: {}, bot: true });
    }
    const P = [...players, ...fillers].map((p) => {
      const doll = mg.makeDoll(p, { scale: DOLL });
      scene.add(doll.group);
      return { p, doll, filler: fillers.includes(p), x: 0, z: 0, tx: 0, tz: 0, face: 0, input: { x: 0, y: 0, held: 0 }, slot: -1, pts: 0, swing: 0, cool: 0,
        bot: p.bot ? { skill: 0.55 + rng() * 0.35, think: 0, gx: 0, gz: 0 } : null };
    });
    // the crown for the King and a paper hat for the Dunce
    const crown = new THREE.Group();
    {
      const gold = kit.mat(0xf2c23a, { metalness: 0.9, roughness: 0.25 });
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.14, 24, 1, true), gold); band.material.side = THREE.DoubleSide; crown.add(band);
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; const sp = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 8), gold); sp.position.set(Math.cos(a) * 0.24, 0.15, Math.sin(a) * 0.24); crown.add(sp); }
      crown.position.y = 0.46;
    }
    const dunceHat = new THREE.Group();
    {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.8, 20), kit.mat(0xf4f0e6, { roughness: 0.9 }));
      cone.position.y = 0.4; dunceHat.add(cone);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.21, 0.1, 20), kit.mat(0xd83a3a, { roughness: 0.8 }));
      band.position.y = 0.12; dunceHat.add(band);
      dunceHat.position.y = 0.42; dunceHat.rotation.z = 0.2;
    }
    // the line: anyone not on court waits by the bench, in order
    const queueSpot = (k) => ({ x: -4.6, z: -1.7 + k * 1.15 });
    const order = [...P].sort(() => rng() - 0.5);
    let slots = order.slice(0, 4);
    const queue = order.slice(4);
    const home = (s) => ({ x: CX[s] * 1.05, z: CZ[s] * 1.05 });
    const place = () => {
      slots.forEach((S, s) => { S.slot = s; });
      queue.forEach((S, k) => { const q = queueSpot(k); S.slot = -1; S.tx = q.x; S.tz = q.z; });
      slots[0].doll.head.add(crown);
      slots[3].doll.head.add(dunceHat);
    };
    place();
    for (const S of P) {
      if (S.slot >= 0) { const h = home(S.slot); S.x = h.x; S.z = h.z; } else { S.x = S.tx; S.z = S.tz; }
      S.doll.group.position.set(S.x, 0, S.z);
    }

    // ----- the ball -----
    const ball = new THREE.Mesh(new THREE.SphereGeometry(R, 20, 14), kit.mat(0xd8f040, { roughness: 0.85 }));
    ball.castShadow = true; scene.add(ball);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(R * 1.3, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; scene.add(shadow);
    // where the ball will land, in the hitter's colour, so everyone can read the play on the TV
    const marker = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.32, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false }));
    marker.rotation.x = -Math.PI / 2; marker.position.y = 0.015; marker.visible = false; scene.add(marker);
    // B.sq is the square the ball has bounced in (whose ball it is); -1 while it's in the air off a hit
    const B = { p: new THREE.Vector3(), v: new THREE.Vector3(), live: false, hitter: null, bounces: 0, sq: -1 };

    // ----- words on screen -----
    const pops = [];
    const pop = (text, color, x, y, z, size = 1, life = 1.6) => {
      const c = document.createElement('canvas'); c.width = 768; c.height = 160;
      const g = c.getContext('2d'); g.font = '900 104px Impact, "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 16; g.strokeStyle = '#1a0a04'; g.strokeText(text, 384, 84, 750); g.fillStyle = color; g.fillText(text, 384, 84, 750);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); sp.scale.set(5.2 * size, 1.08 * size, 1); sp.renderOrder = 50;
      sp.position.set(x, y, z); scene.add(sp); pops.push({ sp, life });
    };

    // ----- serving, hitting, going out -----
    let phase = 'serve', phaseT = 0, rally = 0, shots = 0, pending = null;
    const launch = (S, target, quality) => {
      // somewhere in the target square, kept off its lines; a worse hit strays further
      const inset = 0.45, err = (1 - quality) * 1.7;
      const tx = CX[target] + (rng() - 0.5) * (SQ - inset * 2) + (rng() - 0.5) * err;
      const tz = CZ[target] + (rng() - 0.5) * (SQ - inset * 2) + (rng() - 0.5) * err;
      const dist = Math.hypot(tx - B.p.x, tz - B.p.z);
      const T = 0.55 + dist * 0.09 + (1 - quality) * 0.1;
      B.v.set((tx - B.p.x) / T, (0 - B.p.y) / T + 0.5 * G * T, (tz - B.p.z) / T);
      shots++;
      B.hitter = S; B.bounces = 0; B.sq = -1; B.live = true;
      marker.material.color.set(S.p.color); marker.position.x = tx; marker.position.z = tz; marker.visible = true;
      swingArms(S, 0.3, 1.3);
      sfx.play('bonk');
    };
    const swingArms = (S, time, lift) => { S.swing = time; S.doll.setArms(lift, (S.x < 0 ? -1 : 1) * 0.4); };
    const canHit = (S) => {
      if (!S || !B.live || S.slot < 0 || B.bounces !== 1 || B.sq !== S.slot) return false;
      const d = Math.hypot(B.p.x - S.x, B.p.z - S.z);
      return d < REACH && B.p.y < 1.9;
    };
    const tryHit = (S, target) => {
      if (S.cool > 0 || S.slot < 0) return;
      if (phase === 'serve') {
        if (S !== slots[0] || phaseT < 0.6) return;
        B.p.set(S.x - Math.sign(S.x) * 0.3, 0.9, S.z - Math.sign(S.z) * 0.3); // drop it and smack it
        phase = 'rally';
        if (target === S.slot) { ownSquare(S); return; }
        launch(S, target, 0.8);
        return;
      }
      if (phase !== 'rally') return;
      if (!canHit(S)) { S.cool = WHIFF_CD; swingArms(S, 0.2, 1.0); return; }
      // pressing your own square smacks it straight down into it: a double bounce, and you're out
      if (target === S.slot) { ownSquare(S); return; }
      // a cleaner hit when the ball's at waist height and close in
      const d = Math.hypot(B.p.x - S.x, B.p.z - S.z);
      let quality = THREE.MathUtils.clamp(1 - Math.abs(B.p.y - 0.85) * 0.5 - Math.max(0, d - 0.7) * 0.4, 0.2, 1);
      // CPUs aren't robots: they shank a few, more as a rally drags on
      if (S.bot) quality *= THREE.MathUtils.clamp(0.45 + S.bot.skill * 0.5 * (0.5 + rng() * 0.5) - rally * 0.015, 0.1, 1);
      rally++;
      launch(S, target, quality);
    };
    const ownSquare = (S) => {
      swingArms(S, 0.35, 1.3);
      sfx.play('bonk');
      B.v.set((rng() - 0.5) * 0.6, -6, (rng() - 0.5) * 0.6); // hammered into the ground at their feet
      out(S, 'DOUBLE BOUNCE FOUL!');
    };
    const out = (loser, why) => {
      if (phase !== 'rally') return;
      phase = 'point'; phaseT = 0; marker.visible = false; rally = 0;
      // everyone else still on court scores for the square they held
      for (const S of slots) if (S !== loser && !S.filler) { S.pts += WORTH[S.slot]; pop(`+${WORTH[S.slot]}`, S.p.color, S.x, 2.3, S.z, 0.45, 1.3); }
      sfx.play(loser.slot === 0 ? 'item' : 'coin');
      pop(why, '#ffffff', 0, 3.4, 0, 0.75);
      pop(`${loser.p.name} OUT`, loser.p.color, loser.x, 2.7, loser.z, 0.65);
      pending = loser;
    };
    const nextPoint = () => {
      const L = pending; pending = null;
      const i = L.slot, oldKing = slots[0];
      slots = slots.filter((S) => S !== L);
      if (i > 0 && queue.length) { queue.push(L); slots.push(queue.shift()); } // out: back of the line, next one in at Dunce
      else slots.push(L); // a beaten King (or nobody waiting): down to Dunce
      place();
      if (slots[0] !== oldKing) { pop(`${slots[0].p.name} IS KING!`, slots[0].p.color, 0, 3.7, 0, 1); sfx.play('hallelujah'); }
      B.live = false;
      phase = 'serve'; phaseT = 0;
    };

    // ----- bots: read where the ball will be, get there, and hit at the right moment -----
    const predict = () => {
      // step the ball forward to find where it'll first land, and where it'll be after that bounce at a nice height
      const p = B.p.clone(), v = B.v.clone(); let b = B.bounces, land = null;
      for (let k = 0; k < 200; k++) {
        const h = 0.016;
        v.y -= G * h; p.addScaledVector(v, h);
        if (p.y < R) { p.y = R; v.y = -v.y * BOUNCE; v.x *= 0.92; v.z *= 0.92; b++; if (!land) land = p.clone(); }
        if (b >= 1 && v.y < 0 && p.y < 1.05) return { at: p, land: land || p };
        if (b >= 2) break;
      }
      return { at: p, land: land || p };
    };
    const botThink = (S, dt) => {
      const b = S.bot;
      b.think -= dt;
      const h = home(S.slot);
      let gx = h.x, gz = h.z;
      if (phase === 'rally' && B.live && B.hitter !== S) {
        const { at, land } = predict();
        const mine = B.bounces === 0 ? squareAt(land.x, land.z) === S.slot : B.sq === S.slot;
        if (mine) { gx = at.x + Math.sign(at.x) * 0.2; gz = at.z + Math.sign(at.z) * 0.2; }
      }
      if (b.think <= 0) { b.think = 0.12 + (1 - b.skill) * 0.25; b.gx = gx + (rng() - 0.5) * (1 - b.skill) * 0.8; b.gz = gz + (rng() - 0.5) * (1 - b.skill) * 0.8; }
      const dx = b.gx - S.x, dz = b.gz - S.z, d = Math.hypot(dx, dz);
      if (d > 0.12) { S.input.x = dx / Math.max(d, 0.6); S.input.y = -dz / Math.max(d, 0.6); } else { S.input.x = S.input.y = 0; }
      const pickTarget = () => { const o = [0, 1, 2, 3].filter((s) => s !== S.slot); return o[Math.floor(rng() * o.length)]; };
      if (phase === 'serve' && slots[0] === S && phaseT > 1.1 + rng() * 0.4) { tryHit(S, pickTarget()); return; }
      // once per ball, decide whether this one's going to get past them
      if (b.ballFor !== shots) { b.ballFor = shots; b.whiff = rng() < 0.08 + (1 - b.skill) * 0.2 + rally * 0.025; }
      if (canHit(S) && !b.whiff) {
        const dd = Math.hypot(B.p.x - S.x, B.p.z - S.z);
        if (B.p.y < 1.25 && (dd < 0.95 || B.v.y < -1) && rng() < 0.25 + b.skill * 0.5) tryHit(S, pickTarget());
      }
    };

    // ----- camera -----
    const camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.3, 200);
    camera.position.set(0, 7.4, 6.6);
    camera.lookAt(0, 0.2, 0.3);

    const SPEED = 4.4;
    return {
      camera,
      update(dt, t, running) {
        phaseT += dt;
        if (running) {
          const walking = phase === 'serve' && phaseT < 0.8; // the court reshuffles before each serve
          for (const S of P) {
            S.cool = Math.max(0, S.cool - dt);
            if (S.slot >= 0) {
              if (walking) {
                const h = home(S.slot), dx = h.x - S.x, dz = h.z - S.z, k = Math.min(1, dt * 6);
                S.x += dx * k; S.z += dz * k;
                S.face = Math.hypot(dx, dz) > 0.2 ? Math.atan2(dx, dz) : Math.atan2(-S.x, -S.z);
                continue;
              }
              if (S.bot) botThink(S, dt);
              const ix = S.input.x, iz = -S.input.y, m = Math.hypot(ix, iz);
              if (m > 0.2) {
                const k = Math.min(1, m) * (S.bot ? 0.7 + S.bot.skill * 0.3 : 1);
                S.x += (ix / m) * k * SPEED * dt; S.z += (iz / m) * k * SPEED * dt;
                S.face = Math.atan2(ix, iz);
              } else S.face = Math.atan2(-S.x, -S.z); // face the middle
              // stay in your own square (you can step out past the outside lines to chase one)
              const sx = Math.sign(CX[S.slot]), sz = Math.sign(CZ[S.slot]);
              S.x = sx < 0 ? THREE.MathUtils.clamp(S.x, -SQ - 1.3, -0.25) : THREE.MathUtils.clamp(S.x, 0.25, SQ + 1.3);
              S.z = sz < 0 ? THREE.MathUtils.clamp(S.z, -SQ - 1.3, -0.25) : THREE.MathUtils.clamp(S.z, 0.25, SQ + 1.3);
            } else {
              const dx = S.tx - S.x, dz = S.tz - S.z, d = Math.hypot(dx, dz);
              if (d > 0.05) { const s = Math.min(d, 3 * dt); S.x += dx / d * s; S.z += dz / d * s; S.face = Math.atan2(dx, dz); } else S.face = Math.PI / 2;
            }
          }
          if (phase === 'serve') {
            const K = slots[0];
            B.p.set(K.x - Math.sign(K.x) * 0.35, 1.0 + Math.abs(Math.sin(phaseT * 5)) * 0.4, K.z - Math.sign(K.z) * 0.35); // bouncing it, ready to serve
            if (!K.bot && phaseT > 4.5) { const o = [1, 2, 3]; tryHit(K, o[Math.floor(rng() * 3)]); } // nobody likes a slow server
          }
          if (phase === 'point' && phaseT > 1.6) nextPoint();
          // ball flight (it keeps bouncing after a point, it just doesn't count)
          if ((phase === 'rally' && B.live) || phase === 'point') {
            const sub = 3, h = dt / sub;
            for (let k = 0; k < sub; k++) {
              B.v.y -= G * h; B.p.addScaledVector(B.v, h);
              if (B.p.y < R) {
                B.p.y = R; B.v.y = -B.v.y * BOUNCE; B.v.x *= 0.92; B.v.z *= 0.92;
                if (phase !== 'rally') continue;
                const s = squareAt(B.p.x, B.p.z);
                if (B.bounces === 0) {
                  if (s < 0) { out(B.hitter, 'OUT!'); continue; }
                  if (s === B.hitter.slot) { out(B.hitter, 'OWN SQUARE!'); continue; }
                  B.bounces = 1; B.sq = s; marker.visible = false;
                  sfx.play('tick');
                } else {
                  // second bounce: whoever's square it was didn't get it back
                  out(slots[B.sq], s === B.sq ? 'DOUBLE BOUNCE!' : 'TOO GOOD!');
                }
              }
            }
          }
        }
        // draw
        ball.position.copy(B.p);
        shadow.position.set(B.p.x, 0.01, B.p.z); shadow.scale.setScalar(Math.max(0.4, 1 - B.p.y * 0.2));
        marker.scale.setScalar(1 + Math.sin(t * 8) * 0.08);
        for (const S of P) {
          const g = S.doll.group;
          g.position.set(S.x, 0, S.z);
          g.rotation.y += ((S.face - g.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 10);
          if (S.swing > 0) { S.swing -= dt; if (S.swing <= 0) S.doll.setArms(); }
          S.doll.update(dt);
        }
        for (let k = pops.length - 1; k >= 0; k--) { const q = pops[k]; q.life -= dt; q.sp.position.y += dt * 0.5; q.sp.material.opacity = Math.min(1, q.life / 0.5); if (q.life <= 0) { scene.remove(q.sp); pops.splice(k, 1); } }
      },
      input(p, m) {
        const S = P.find((q) => q.p === p);
        if (!S || S.bot || m.b !== 'stick') return;
        const held = Number(m.h) || 0, newly = held & ~S.input.held;
        S.input.x = Math.max(-1, Math.min(1, Number(m.x) || 0)); S.input.y = Math.max(-1, Math.min(1, Number(m.y) || 0)); S.input.held = held;
        const b = BTN.find((q) => newly & q.bit);
        if (b) tryHit(S, b.sq);
      },
      scores() { return Object.fromEntries(P.filter((S) => !S.filler).map((S) => [S.p.id, S.pts])); },
    };
  },
};
