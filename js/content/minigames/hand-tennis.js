// Hand Tennis: the lunchtime classic. Two squares painted on the school asphalt, a tennis ball, and
// your hand for a racquet. Let it bounce once in your square, then hit it into theirs. Hit it out or
// into your own square and you lose the point; let it bounce twice and you lose the point. It's King
// of the court: the winner stays on (with the crown), the loser goes to the back of the line and the
// next one steps up. Every point you win is worth one.
import { addSky } from '../../host/sky.js';

const BTN = { HIT: 1 };
const SQ = 3.2; // each square is SQ x SQ metres; the court runs along x, the middle line at x = 0
const G = 9.8, BOUNCE = 0.72, R = 0.13;
const REACH = 1.35; // how far from a doll's middle it can still get a hand to the ball
const HOME = 2.0; // where each player waits, in metres back from the middle line

export default {
  id: 'hand-tennis',
  name: 'Hand Tennis',
  blurb: 'King of the court on the school asphalt. One bounce, then hit it into their square.',
  howTo: "Let the ball bounce once in your square, then press HIT when it's near you. Push the stick where you want it to go: towards them to hit it deep, up or down to angle it. Hit it out, or let it bounce twice, and you lose the point. The winner stays on as King, the loser goes to the back of the line. A point a point.",
  padText: 'Stick to move and aim. HIT when the ball is near.',
  duration: 100,
  pad: { kind: 'stick', buttons: [{ bit: BTN.HIT, label: '✋ HIT', tone: 'go' }] },

  create(mg) {
    const { THREE, kit, scene, players, rng, sfx, renderer } = mg;
    const n = players.length;

    // ----- the schoolyard -----
    addSky(scene, renderer, { elevation: 55, azimuth: 200, turbidity: 3, sunIntensity: 3.3, hemi: 0.7, env: 0.6, shadowSize: 16, fog: [0xcfe0ee, 50, 140] });
    const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), kit.surf('asphalt', { unit: 3, tint: 0xd0ccc4 }));
    asphalt.rotation.x = -Math.PI / 2; asphalt.receiveShadow = true; scene.add(asphalt);
    // the painted court: yellow lines, a bit worn
    const paint = kit.mat(0xf2d23a, { roughness: 0.7 });
    const line = (w, d, x, z) => { const m = kit.box(w, 0.012, d, paint, x, 0.002, z); m.receiveShadow = true; m.castShadow = false; };
    for (const x of [-SQ, 0, SQ]) line(0.12, SQ, x, 0);
    for (const z of [-SQ / 2, SQ / 2]) line(SQ * 2 + 0.12, 0.12, 0, z);
    kit.sign('HAND TENNIS', 3.4, 0.7, 0, 0.02, SQ / 2 + 0.7, scene, { bg: null, fg: '#f2d23a', font: '900 150px Impact, "Arial Black", sans-serif' }).rotation.x = -Math.PI / 2;
    // the school: a brick block with a verandah, the bubbler, a peppercorn tree and the bins
    const wall = kit.group(0, 0, -6.5);
    kit.box(26, 4.2, 0.4, kit.surf('brick', { unit: 1.4, tint: 0xc88a6a }), 0, 0, 0, wall);
    for (const x of [-9, -4.5, 4.5, 9]) kit.window(2.2, 1.4, x, 2.2, 0.22, wall, 0xe8e4d8);
    kit.box(1.4, 2.3, 0.06, 0x2a5a8a, 0, 0, 0.22, wall);
    kit.sign('BOGAN-O PRIMARY', 7.5, 0.8, 0, 3.4, 0.24, wall, { bg: '#1f4a7a', fg: '#ffffff', font: '900 120px system-ui, sans-serif' });
    kit.box(26, 0.1, 2.6, kit.surf('corrugated', { unit: 1, tint: 0xb8c0c4, metalness: 0.5 }), 0, 3.0, 1.4, wall).rotation.x = 0.06;
    for (const x of [-12, -6, 0, 6, 12]) kit.box(0.12, 3.0, 0.12, 0x2f5d3a, x, 0, 2.6, wall);
    const bub = kit.group(8.5, 0, -4.4);
    kit.box(0.6, 0.9, 0.5, kit.surf('steel', { unit: 1 }), 0, 0, 0, bub, { metalness: 0.8, roughness: 0.3 });
    kit.cyl(0.04, 0.04, 0.12, 0xc8c8c8, 0, 0.9, 0, bub, { metalness: 0.9 });
    for (const [x, c] of [[-9.6, 0x2a6a2a], [-8.9, 0xd8b020]]) kit.cyl(0.3, 0.28, 1.0, c, x, 0, -4.6);
    kit.box(4.2, 0.45, 0.4, kit.surf('planks', { unit: 1.2, tint: 0x8a6a4a }), -4, 0, -3.9); // the bench the line waits on

    // ----- dolls -----
    const DOLL = 0.72;
    const P = players.map((p, i) => {
      const doll = mg.makeDoll(p, { scale: DOLL });
      scene.add(doll.group);
      return { p, doll, x: 0, z: 0, tx: 0, tz: 0, face: 0, input: { x: 0, y: 0, held: 0 }, side: 0, pts: 0, swing: 0,
        bot: p.bot ? { skill: 0.55 + rng() * 0.35, think: 0, gx: 0, gz: 0, hitAt: null } : null };
    });
    // the crown for whoever's King
    const crown = new THREE.Group();
    {
      const gold = kit.mat(0xf2c23a, { metalness: 0.9, roughness: 0.25 });
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.14, 24, 1, true), gold); band.material.side = THREE.DoubleSide; crown.add(band);
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; const sp = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 8), gold); sp.position.set(Math.cos(a) * 0.24, 0.15, Math.sin(a) * 0.24); crown.add(sp); }
      crown.position.y = 0.46;
    }
    // the line: everyone not on court waits by the bench, in order
    const queueSpot = (k) => ({ x: -5.6 + k * 1.15, z: -3.4 });
    let order = [...P].sort(() => rng() - 0.5);
    let king = order[0], challenger = order[1] || null, queue = order.slice(2);
    // the King's side swaps with each new challenger, so both squares get used
    const place = () => {
      king.side = king.side || -1;
      if (challenger) challenger.side = -king.side;
      king.doll.head.add(crown);
      queue.forEach((S, k) => { const q = queueSpot(k); S.side = 0; S.tx = q.x; S.tz = q.z; });
    };
    place();
    for (const S of P) {
      if (S.side) { S.x = S.side * HOME; S.z = 0; } else { S.x = S.tx; S.z = S.tz; }
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
    const B = { p: new THREE.Vector3(), v: new THREE.Vector3(), live: false, hitter: null, bounces: 0, lastSide: 0 };
    const sideOf = (x) => (x < 0 ? -1 : 1);
    const inCourt = (x, z) => Math.abs(x) <= SQ + 0.05 && Math.abs(z) <= SQ / 2 + 0.05;

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

    // ----- serving, hitting, points -----
    let phase = 'serve', phaseT = 0, server = king, rally = 0, shots = 0;
    const receiver = () => (B.hitter === king ? challenger : king);
    // aim from the stick: towards them = deep, up/down = angle it across
    const launch = (S, quality) => {
      const dir = -S.side; // which way the other square is
      const depth = THREE.MathUtils.clamp(1.7 + S.input.x * dir * 1.1, 0.5, SQ - 0.3);
      const across = THREE.MathUtils.clamp(-S.input.y * 1.25, -SQ / 2 + 0.25, SQ / 2 - 0.25);
      const err = (1 - quality) * 2.6;
      const tx = dir * (depth + (rng() - 0.5) * err), tz = across + (rng() - 0.5) * err;
      const dist = Math.hypot(tx - B.p.x, tz - B.p.z);
      const T = 0.5 + dist * 0.085 + (1 - quality) * 0.1;
      B.v.set((tx - B.p.x) / T, (0 - B.p.y) / T + 0.5 * G * T, (tz - B.p.z) / T);
      shots++;
      B.hitter = S; B.bounces = 0; B.lastSide = 0; B.live = true;
      marker.material.color.set(S.p.color); marker.position.x = tx; marker.position.z = tz; marker.visible = true;
      S.swing = 0.3; S.doll.setArms(1.3, S.side * 0.4);
      sfx.play('bonk');
    };
    const canHit = (S) => {
      if (!S || !B.live || S === B.hitter || S.side === 0) return false;
      if (B.bounces !== 1 || B.lastSide !== S.side) return false;
      const d = Math.hypot(B.p.x - S.x, B.p.z - S.z);
      return d < REACH && B.p.y < 1.9;
    };
    const tryHit = (S) => {
      if (phase === 'serve' && S === server && phaseT > 0.4) {
        B.p.set(S.x - S.side * 0.4, 0.9, S.z); // serve: drop it and smack it over
        launch(S, 0.8);
        phase = 'rally';
        return;
      }
      if (!canHit(S)) { S.swing = 0.2; S.doll.setArms(1.0, S.side * 0.3); return; }
      // a cleaner hit when the ball's at waist height and close in
      const d = Math.hypot(B.p.x - S.x, B.p.z - S.z);
      let quality = THREE.MathUtils.clamp(1 - Math.abs(B.p.y - 0.85) * 0.5 - Math.max(0, d - 0.7) * 0.4, 0.2, 1);
      // CPUs aren't robots: they shank a few, more as a rally drags on
      if (S.bot) quality *= THREE.MathUtils.clamp(0.4 + S.bot.skill * 0.5 * (0.5 + rng() * 0.5) - rally * 0.015, 0.1, 1);
      rally++;
      launch(S, quality);
    };
    const point = (winner, why) => {
      if (phase !== 'rally') return;
      phase = 'point'; phaseT = 0; B.live = false; marker.visible = false; rally = 0;
      winner.pts++;
      const loser = winner === king ? challenger : king;
      sfx.play(winner === king ? 'coin' : 'item');
      pop(why, '#ffffff', 0, 3.3, 0, 0.7);
      pop(`${winner.p.name} +1`, winner.p.color, winner.x, 2.6, winner.z, 0.7);
      pending = { winner, loser };
    };
    let pending = null;
    const nextPoint = () => {
      const { winner, loser } = pending; pending = null;
      if (queue.length) {
        // loser to the back of the line, the next one steps up
        const wasKing = winner !== king;
        if (wasKing) { king = winner; pop(`${king.p.name} IS KING!`, king.p.color, 0, 3.6, 0, 1); sfx.play('hallelujah'); }
        queue.push(loser);
        challenger = queue.shift();
      } else if (winner !== king) { king = winner; challenger = loser; pop(`${king.p.name} IS KING!`, king.p.color, 0, 3.6, 0, 1); }
      place();
      server = king;
      phase = 'serve'; phaseT = 0;
    };

    // ----- bots: read where the ball will be, get there, and hit at the right moment -----
    const predict = () => {
      // step the ball forward to find where it'll be after its first bounce, at a nice height
      const p = B.p.clone(), v = B.v.clone(); let b = B.bounces;
      for (let k = 0; k < 160; k++) {
        const h = 0.016;
        v.y -= G * h; p.addScaledVector(v, h);
        if (p.y < R) { p.y = R; v.y = -v.y * BOUNCE; b++; }
        if (b >= 1 && v.y < 0 && p.y < 1.05) return p;
        if (b >= 2) return p;
      }
      return p;
    };
    const botThink = (S, dt) => {
      const b = S.bot;
      b.think -= dt;
      let gx = S.side * HOME, gz = 0;
      if (phase === 'rally' && B.live && B.hitter !== S) {
        const at = predict();
        if (sideOf(at.x) === S.side) { gx = at.x + S.side * 0.25; gz = at.z; }
      }
      if (b.think <= 0) { b.think = 0.12 + (1 - b.skill) * 0.25; b.gx = gx + (rng() - 0.5) * (1 - b.skill) * 0.8; b.gz = gz + (rng() - 0.5) * (1 - b.skill) * 0.8; }
      const dx = b.gx - S.x, dz = b.gz - S.z, d = Math.hypot(dx, dz);
      // the stick doubles as aim: lean towards a corner just before hitting
      if (d > 0.12) { S.input.x = dx / Math.max(d, 0.6); S.input.y = -dz / Math.max(d, 0.6); } else { S.input.x = S.input.y = 0; }
      if (phase === 'serve' && server === S && phaseT > 0.9 + rng() * 0.3) { S.input.x = -S.side * (rng() - 0.2); S.input.y = (rng() - 0.5) * 1.6; tryHit(S); return; }
      // once per ball, decide whether this one's going to get past them
      if (b.ballFor !== shots) { b.ballFor = shots; b.whiff = rng() < 0.08 + (1 - b.skill) * 0.2 + rally * 0.025; }
      if (canHit(S) && !b.whiff) {
        const dd = Math.hypot(B.p.x - S.x, B.p.z - S.z);
        if (B.p.y < 1.25 && (dd < 0.95 || B.v.y < -1) && rng() < 0.25 + b.skill * 0.5) {
          S.input.x = -S.side * (0.2 + rng() * 0.8); S.input.y = (rng() - 0.5) * 2;
          tryHit(S);
        }
      }
    };

    // ----- camera -----
    const camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.3, 200);
    camera.position.set(0, 5.4, 7.6);
    camera.lookAt(0, 0.5, -0.5);

    const SPEED = 4.4;
    return {
      camera,
      update(dt, t, running) {
        phaseT += dt;
        if (running) {
          // movement: the two on court move in their own half (and a bit behind it); the line shuffles along
          for (const S of P) {
            if (S.bot && S.side) botThink(S, dt);
            if (S.side) {
              const ix = S.input.x, iz = -S.input.y, m = Math.hypot(ix, iz);
              if (m > 0.2) {
                const k = Math.min(1, m) * (S.bot ? 0.7 + S.bot.skill * 0.3 : 1);
                S.x += (ix / m) * k * SPEED * dt; S.z += (iz / m) * k * SPEED * dt;
                S.face = Math.atan2(ix, iz);
              } else S.face = S.side < 0 ? Math.PI / 2 : -Math.PI / 2;
              // stay on your own side of the middle line
              S.x = S.side < 0 ? THREE.MathUtils.clamp(S.x, -SQ - 2, -0.3) : THREE.MathUtils.clamp(S.x, 0.3, SQ + 2);
              S.z = THREE.MathUtils.clamp(S.z, -SQ / 2 - 1.5, SQ / 2 + 2);
            } else {
              const dx = S.tx - S.x, dz = S.tz - S.z, d = Math.hypot(dx, dz);
              if (d > 0.05) { const s = Math.min(d, 3 * dt); S.x += dx / d * s; S.z += dz / d * s; S.face = Math.atan2(dx, dz); } else S.face = 0;
            }
          }
          // new players on court walk to their spot before the serve
          if (phase === 'serve') {
            for (const S of [king, challenger]) if (S && phaseT < 0.6) { S.x += (S.side * HOME - S.x) * Math.min(1, dt * 6); S.z += (0 - S.z) * Math.min(1, dt * 6); }
            B.p.set(server.x - server.side * 0.45, 1.0 + Math.abs(Math.sin(phaseT * 5)) * 0.4, server.z + 0.2); // bouncing it, ready to serve
            if (server && !server.bot && phaseT > 4) tryHit(server); // nobody likes a slow server
            if (!challenger) { phase = 'idle'; }
          }
          if (phase === 'point' && phaseT > 1.4) nextPoint();
          // ball flight
          if (phase === 'rally' && B.live) {
            const sub = 3, h = dt / sub;
            for (let k = 0; k < sub && B.live; k++) {
              B.v.y -= G * h; B.p.addScaledVector(B.v, h);
              if (B.p.y < R) {
                B.p.y = R; B.v.y = -B.v.y * BOUNCE; B.v.x *= 0.92; B.v.z *= 0.92;
                const s = sideOf(B.p.x), hitterSide = B.hitter.side;
                if (!inCourt(B.p.x, B.p.z)) { point(B.bounces === 0 ? receiver() : B.hitter, B.bounces === 0 ? 'OUT!' : 'TOO GOOD!'); break; }
                if (B.bounces === 0 && s === hitterSide) { point(receiver(), 'OWN SQUARE!'); break; }
                B.bounces++; B.lastSide = s;
                if (B.bounces === 1) marker.visible = false;
                if (B.bounces >= 2) { point(B.hitter, 'DOUBLE BOUNCE!'); break; }
                sfx.play('tick');
              }
            }
          }
        }
        // draw
        ball.position.copy(B.p);
        shadow.position.set(B.p.x, 0.01, B.p.z); shadow.scale.setScalar(Math.max(0.4, 1 - B.p.y * 0.2));
        ball.visible = shadow.visible = phase !== 'idle';
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
        if (newly & BTN.HIT) tryHit(S);
      },
      scores() { return Object.fromEntries(P.map((S) => [S.p.id, S.pts])); },
    };
  },
};
