// Footy Kick-to-Kick: a Sunday arvo down the local oval. Coach Robbo boots the Sherrin high into the
// pack and everyone fights for the mark: run under it with the stick and hit JUMP at the right moment.
// Highest leap takes it. If nobody holds it, first one to the loose ball gets it. Whoever has the ball
// lines up for goal: aim with the stick, then stop the power meter with KICK. Mind the wind.
// Goal is 6, behind is 1, and a clean mark is worth 1 more.
import { addSky } from '../../host/sky.js';

const ROUNDS = 7;
const GOAL_HALF = 2.7, BEHIND_HALF = 7.6; // posts either side of the middle at the goal line (z = 0)
const ZONE = { x0: -4.5, x1: 4.5, z0: 7.5, z1: 12.5 }; // where Robbo's kicks come down
const FLY_T = 3.2, FLY_H = 12, KICK_T = 5.5, SHOW_T = 2.2;
const DOLL = 0.78, RUN = 5.2;
const REACH = 1.75, LEAP = 1.25, LEAP_T = 0.62, GRAB = 0.95;
const KICK_ANG = 0.68, V0 = 8, V1 = 14, AIM = 0.4, G = 9.8;
const GOAL = 6, BEHIND = 1, MARK = 1;
const BTN = { GO: 1 };

export default {
  id: 'footy-kick-to-kick',
  name: 'Footy Kick-to-Kick',
  blurb: "Sunday arvo at the oval. Fly for the mark, then slot it from where you took it. Goals are 6.",
  howTo: "Coach Robbo kicks it high into the pack. Run under it with the stick and hit JUMP / KICK just before it gets to you. Whoever leaps highest takes the mark (+1). If nobody holds it, first to the loose ball gets it. Then line up for goal: push the stick left or right to aim (watch the wind), and press JUMP / KICK to stop the power meter. Between the tall posts is a goal (6), between a tall and a short post is a behind (1).",
  padText: 'Run, JUMP for the mark, KICK for goal',
  duration: 92,
  pad: { kind: 'stick', buttons: [{ bit: BTN.GO, label: '🏉 JUMP / KICK', tone: 'go' }] },

  create(mg) {
    const { THREE, kit, scene, players, rng, renderer, sfx } = mg;
    const n = players.length;

    // ----- the oval -----
    const { sun } = addSky(scene, renderer, { elevation: 30, azimuth: -40, turbidity: 3, sunIntensity: 2.8, sky: 0xcfe2ff, ground: 0x4a6a2a, hemi: 0.55, env: 0.5, shadowSize: 40, fog: [0xd8e4ee, 60, 170] });
    sun.target.position.set(0, 0, 10);
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), kit.surf('grass', { unit: 3, tint: 0x6a9a3a })); grass.rotation.x = -Math.PI / 2; grass.receiveShadow = true; scene.add(grass);
    // mowing stripes and the goal square
    for (let k = -6; k < 10; k++) { const s = new THREE.Mesh(new THREE.PlaneGeometry(80, 3), kit.mat(k % 2 ? 0x5a8a30 : 0x6e9e40, { transparent: true, opacity: 0.35 })); s.rotation.x = -Math.PI / 2; s.position.set(0, 0.01, k * 3); s.receiveShadow = true; scene.add(s); }
    const line = (w, d, x, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), kit.mat(0xffffff, { roughness: 0.9 })); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.02, z); scene.add(m); };
    line(BEHIND_HALF * 2 + 0.2, 0.12, 0, 0); line(GOAL_HALF * 2, 0.1, 0, 4.5); for (const s of [-1, 1]) line(0.1, 4.5, s * GOAL_HALF, 2.25);
    // the 50 m arc, roughly
    { const arc = new THREE.Mesh(new THREE.RingGeometry(22, 22.15, 64, 1, Math.PI * 0.15, Math.PI * 0.7), kit.mat(0xffffff)); arc.rotation.x = -Math.PI / 2; arc.position.set(0, 0.02, -3); arc.rotation.z = Math.PI; scene.add(arc); }
    // the posts: two tall goal posts, two shorter behind posts, padded at the bottom
    for (const s of [-1, 1]) for (const [x, h] of [[GOAL_HALF, 9], [BEHIND_HALF, 5.5]]) {
      kit.cyl(0.11, 0.13, h, 0xffffff, s * x, 0, 0);
      kit.cyl(0.26, 0.26, 1.7, s * x === GOAL_HALF || s * x === -GOAL_HALF ? 0xc8102e : 0x1a3a8a, s * x, 0, 0);
    }
    // the clubrooms, a fence and some cars behind the far boundary
    { const club = kit.group(-14, 0, 46, Math.PI); kit.box(22, 5, 6, kit.surf('brick', { unit: 2.4, tint: 0xd8b090 }), 0, 0, 0, club); kit.box(23, 0.4, 7, 0x2a4a2a, 0, 5, 0, club); kit.sign('KANGAROO FLAT FC', 10, 1.4, 0, 3.2, 3.05, club, { bg: '#1a2a6a', fg: '#ffd23f', font: '900 120px system-ui' }); }
    for (let x = -40; x <= 40; x += 2.4) kit.box(2.3, 0.9, 0.08, 0xf0f0f0, x, 0, 40);
    for (const [x, c] of [[6, 0xc8102e], [12, 0x2a5ad8], [18, 0xf0f0f0], [26, 0x2a2a2a]]) { const car = kit.group(x, 0, 43, rng() * 0.3); kit.box(4, 1, 1.8, c, 0, 0.3, 0, car); kit.box(2.4, 0.7, 1.6, 0x334455, -0.2, 1.3, 0, car); }
    for (const [x, z] of [[-30, 30], [30, 26], [36, 6], [-34, 10]]) { const t = kit.group(x, 0, z); kit.cyl(0.4, 0.5, 6, 0x8a7a6a, 0, 0, 0, t); kit.ball(4, 0x4a6a3a, 0, 8, 0, t).scale.y = 0.8; }

    // the windsock on the behind post
    kit.cyl(0.05, 0.05, 4.2, 0xd8d8d8, -6.2, 0, 4.5, undefined, { metalness: 0.7 });
    const sock = new THREE.Group(); sock.position.set(-6.2, 4.1, 4.5); scene.add(sock);
    const sockMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.1, 1.4, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.7, side: THREE.DoubleSide }));
    sockMesh.rotation.z = Math.PI / 2; sockMesh.position.x = 0.7; sock.add(sockMesh);

    // ----- the Sherrin -----
    const ballTexC = document.createElement('canvas'); ballTexC.width = 128; ballTexC.height = 64;
    { const g = ballTexC.getContext('2d'); g.fillStyle = '#b8261a'; g.fillRect(0, 0, 128, 64); g.strokeStyle = '#7a1a10'; g.lineWidth = 2; for (const y of [16, 48]) { g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke(); } g.fillStyle = '#ffffff'; g.fillRect(52, 28, 24, 3); for (let k = 0; k < 6; k++) g.fillRect(54 + k * 4, 24, 1.5, 11); }
    const ballTex = new THREE.CanvasTexture(ballTexC); ballTex.colorSpace = THREE.SRGBColorSpace;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 16), new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.5 }));
    ball.scale.set(1, 1, 1.6); ball.castShadow = true; scene.add(ball);
    // where it's coming down (a faint ring, so you can read it)
    const landRing = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.75, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 })); landRing.rotation.x = -Math.PI / 2; landRing.position.y = 0.03; scene.add(landRing);
    // the aim arrow for a shot at goal
    const arrow = new THREE.Group(); scene.add(arrow); arrow.visible = false;
    { const m = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.85 }); const shaft = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 3.2), m); shaft.rotation.x = -Math.PI / 2; shaft.position.set(0, 0.04, -1.6); arrow.add(shaft); const head = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.8, 3), m); head.rotation.x = -Math.PI / 2; head.position.set(0, 0.04, -3.5); head.scale.y = 1; arrow.add(head); }

    // Coach Robbo, out to the side
    const coach = mg.makeDoll({ id: 'coach', name: 'Robbo', color: '#1a2a6a', body: 'bloke', hair: 0x9a9a9a }, { scale: DOLL, tag: false });
    coach.group.position.set(7, 0, 5.5); coach.group.rotation.y = -2.4; scene.add(coach.group);

    // ----- pops and the scoreboard -----
    const pops = [];
    const pop = (x, y, z, text, color, size = 1, stay = 1.1) => {
      const c = document.createElement('canvas'); c.width = 768; c.height = 160;
      const g = c.getContext('2d'); g.font = '900 104px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 16; g.strokeStyle = '#10180a'; g.strokeText(text, 384, 84, 750); g.fillStyle = color; g.fillText(text, 384, 84, 750);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); sp.scale.set(4.8 * size, 1 * size, 1); sp.renderOrder = 1000;
      sp.position.set(x, y, z); scene.add(sp); pops.push({ sp, life: 0, stay }); return sp;
    };
    let bannerSp = null;
    const banner = (text, color = '#ffffff', size = 1) => { if (bannerSp) { const q = pops.find((q) => q.sp === bannerSp); if (q) q.stay = Math.min(q.stay, q.life); } bannerSp = pop(0, 6.4, 8, text, color, size * 1.6, 1.6); return bannerSp; };
    const boardC = document.createElement('canvas'); boardC.width = 1024; boardC.height = 120;
    const boardT = new THREE.CanvasTexture(boardC); boardT.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Sprite(new THREE.SpriteMaterial({ map: boardT, depthTest: false, transparent: true })); board.renderOrder = 900; board.scale.set(16, 16 * 120 / 1024, 1);
    board.position.set(0, 10.2, 16); scene.add(board);

    // ----- the players -----
    const kickers = players.map((p, k) => {
      const x = ZONE.x0 + (ZONE.x1 - ZONE.x0) * (n === 1 ? 0.5 : k / (n - 1)), z = (ZONE.z0 + ZONE.z1) / 2 + (k % 2 ? 1.5 : -1.5);
      const doll = mg.makeDoll(p, { scale: DOLL });
      doll.group.position.set(x, 0, z); doll.group.rotation.y = Math.PI; scene.add(doll.group);
      return { p, k, doll, x, z, y: 0, vx: 0, vz: 0, face: Math.PI, jumpT: -1, goals: 0, behinds: 0, marks: 0,
        input: { x: 0, y: 0, held: 0 },
        bot: p.bot ? { err: 0.5 + rng() * 1.2, timing: 0.06 + rng() * 0.12, kickErr: 0.04 + rng() * 0.08, aimErr: 0.04 + rng() * 0.07, windSense: 0.5 + rng() * 0.45, jumped: false, wantP: 0.5, wantA: 0 } : null };
    });
    const total = (K) => K.goals * GOAL + K.behinds * BEHIND + K.marks * MARK;
    const drawBoard = () => {
      const g = boardC.getContext('2d'); g.clearRect(0, 0, 1024, 120);
      g.fillStyle = 'rgba(14,20,30,0.82)'; g.beginPath(); g.roundRect(4, 4, 1016, 112, 20); g.fill();
      const w = 1000 / n;
      kickers.forEach((K, i) => {
        const cx = 12 + w * i + w / 2;
        g.fillStyle = K.p.color; g.font = '800 30px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(K.p.name, cx, 34, w - 20);
        g.fillStyle = '#ffffff'; g.font = '900 40px system-ui'; g.fillText(`${K.goals}.${K.behinds}  (${total(K)})`, cx, 82, w - 20);
      });
      boardT.needsUpdate = true;
    };
    drawBoard();

    // ----- the rounds -----
    let phase = 'pre', phaseT = 2.0, round = 0, tAll = 0, finishAt = null;
    let wind = 0; // sideways push on a kick at goal (m/s^2, + is to the right from the kicker's view... in world, +x)
    const fly = { sx: 0, sz: 0, tx: 0, tz: 0, t: 0 };
    let holder = null, marked = false, loose = null, meter = 0, meterDir = 1, shot = null;
    const startRound = () => {
      round++; phase = 'fly'; phaseT = FLY_T; holder = null; marked = false; loose = null; shot = null; arrow.visible = false;
      fly.sx = coach.group.position.x + 0.6; fly.sz = coach.group.position.z + 0.4; fly.t = 0;
      fly.tx = ZONE.x0 + rng() * (ZONE.x1 - ZONE.x0); fly.tz = ZONE.z0 + rng() * (ZONE.z1 - ZONE.z0);
      wind = (rng() * 2 - 1) * 2;
      coach.setArms(1.4, 0); coach.bounce(1);
      banner(`KICK ${round} OF ${ROUNDS}`, '#ffffff', 0.7); sfx.play('thud');
      for (const K of kickers) if (K.bot) { const a = rng() * Math.PI * 2, r = rng() * K.bot.err * 0.7; K.bot.jumped = false; K.bot.ox = Math.cos(a) * r; K.bot.oz = Math.sin(a) * r; K.bot.timingNow = K.bot.timing + (rng() * 2 - 1) * 0.12; }
    };
    const ballAt = (t) => {
      const f = Math.min(1, t / FLY_T);
      return [fly.sx + (fly.tx - fly.sx) * f, 1.2 + Math.sin(f * Math.PI) * FLY_H - f * 1.2 + (f >= 1 ? 0 : 0), fly.sz + (fly.tz - fly.sz) * f];
    };
    const reach = (K) => REACH * DOLL / 0.62 + (K.jumpT >= 0 && K.jumpT < LEAP_T ? Math.sin(K.jumpT / LEAP_T * Math.PI) * LEAP : 0);
    const takeBall = (K, isMark) => {
      holder = K; marked = isMark; phase = 'kick'; phaseT = KICK_T; meter = 0; meterDir = 1; landRing.material.opacity = 0;
      if (isMark) { K.marks++; pop(K.x, 4.4, K.z, 'MARK! +1', '#ffd23f', 0.8); sfx.play('cheers'); K.doll.setArms(1.6, 0); K.armT = 0.8; }
      else { pop(K.x, 4.4, K.z, 'CRUMBED IT', '#9ad8ff', 0.7); sfx.play('item'); }
      drawBoard();
      K.vx = K.vz = 0; K.y = 0; K.jumpT = -1;
      K.aim = 0;
      if (K.bot) {
        // aim off the middle allowing for the wind, and pick a power for the distance
        const B = K.bot, base = Math.atan2(-K.x, K.z);
        const d = Math.hypot(K.x, K.z) + 1.5, tFl = 2 * Math.sin(KICK_ANG) * Math.sqrt(d * G / Math.sin(2 * KICK_ANG)) / G;
        const drift = 0.5 * wind * tFl * tFl * B.windSense;
        B.wantA = Math.max(-AIM, Math.min(AIM, Math.atan2(drift, d) + (rng() * 2 - 1) * B.aimErr * 2));
        B.wantP = Math.max(0, Math.min(1, (Math.sqrt(d * G / Math.sin(2 * KICK_ANG)) - V0) / (V1 - V0) + (rng() * 2 - 1) * B.kickErr));
        B.aimNow = 0; B.kickAt = 1.2 + rng() * 1.5; B.base = base;
      }
    };
    const doKick = (K) => {
      if (phase !== 'kick' || holder !== K || shot) return;
      const v = V0 + (V1 - V0) * meter;
      const dir = Math.atan2(-K.x, K.z) + K.aim; // straight at the middle of the goals, plus aim
      const h = v * Math.cos(KICK_ANG);
      shot = { x: K.x, y: 0.6, z: K.z, vx: -Math.sin(dir) * h, vy: v * Math.sin(KICK_ANG), vz: -Math.cos(dir) * h, done: false };
      arrow.visible = false; sfx.play('thud'); K.doll.bounce(1.2); K.doll.setArms(-0.2, 0.5); K.armT = 0.5;
    };
    const result = (text, color, pts, kind) => {
      shot.done = true; phase = 'show'; phaseT = SHOW_T; arrow.visible = false;
      if (kind === 'goal') { holder.goals++; sfx.play('hallelujah'); holder.doll.bounce(1.5); }
      else if (kind === 'behind') { holder.behinds++; sfx.play('coin'); }
      else sfx.play('lose');
      banner(text, color, 1); drawBoard();
    };

    const camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.3, 250);
    camera.position.set(0, 6.2, -11);
    camera.lookAt(0, 1.6, 10);

    return {
      camera,
      update(dt, t, running) {
        tAll += dt;
        if (running && finishAt == null) {
          phaseT -= dt;
          if (phase === 'pre' && phaseT <= 0) startRound();
          else if (phase === 'fly') {
            fly.t += dt;
            const [bx, by, bz] = ballAt(fly.t);
            ball.position.set(bx, by, bz); ball.rotation.x += dt * 9;
            landRing.position.set(fly.tx, 0.03, fly.tz); landRing.material.opacity = Math.min(0.75, Math.max(0, (fly.t - 0.9) * 0.8));
            // the contest: once it's in reach, the highest hands take it
            if (by < REACH + LEAP + 0.3 && fly.t > FLY_T * 0.5) {
              let best = null, br = 0;
              for (const K of kickers) { const d = Math.hypot(K.x - bx, K.z - bz), r = reach(K); if (d <= GRAB && r >= by && r > br) { br = r; best = K; } }
              if (best) takeBall(best, best.jumpT >= 0 && best.jumpT < LEAP_T);
            }
            if (phase === 'fly' && fly.t >= FLY_T) { phase = 'loose'; phaseT = 3; loose = { x: fly.tx, z: fly.tz, vx: (fly.tx - fly.sx) * 0.12, vz: (fly.tz - fly.sz) * 0.12, y: 0.2, vy: 3 }; sfx.play('boing'); pop(fly.tx, 3.6, fly.tz, 'SPILLED!', '#ffffff', 0.6, 0.6); landRing.material.opacity = 0; }
          } else if (phase === 'loose') {
            loose.vy -= G * dt; loose.y += loose.vy * dt; if (loose.y < 0.17) { loose.y = 0.17; loose.vy = Math.abs(loose.vy) * 0.45; loose.vx *= 0.7; loose.vz *= 0.7; }
            loose.x += loose.vx * dt; loose.z += loose.vz * dt;
            ball.position.set(loose.x, loose.y, loose.z); ball.rotation.y += dt * 6;
            let best = null, bd = 0.7;
            for (const K of kickers) { const d = Math.hypot(K.x - loose.x, K.z - loose.z); if (d < bd && loose.y < 1.2) { bd = d; best = K; } }
            if (best) takeBall(best, false);
            else if (phaseT <= 0) { phase = 'show'; phaseT = 1.2; banner('BALL UP', '#ffffff', 0.8); }
          } else if (phase === 'kick') {
            const K = holder;
            if (!shot) {
              meter += meterDir * dt / 1.1; if (meter >= 1) { meter = 1; meterDir = -1; } if (meter <= 0) { meter = 0; meterDir = 1; }
              if (K.bot) {
                const B = K.bot; K.aim += (B.wantA - K.aim) * Math.min(1, dt * 4);
                B.kickAt -= dt; if (B.kickAt <= 0 && Math.abs(meter - B.wantP) < 0.04) doKick(K);
              } else K.aim = K.input.x * AIM;
              arrow.visible = true; arrow.position.set(K.x, 0, K.z); arrow.rotation.y = Math.atan2(-K.x, K.z) + K.aim;
              arrow.scale.setScalar(0.7 + meter * 0.9);
              arrow.children.forEach((c) => c.material.color.setHSL(0.33 - meter * 0.33, 0.9, 0.55));
              if (phaseT <= 0) { pop(K.x, 4, K.z, 'PLAY ON!', '#ffffff', 0.6, 0.5); doKick(K); }
            } else if (!shot.done) {
              const s = shot;
              s.vx += wind * dt; s.vy -= G * dt;
              const pz = s.z; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
              ball.position.set(s.x, s.y, s.z); ball.rotation.x += dt * 14;
              if (pz > 0 && s.z <= 0) {
                const ax = Math.abs(s.x);
                if (ax < GOAL_HALF) result('GOAL!', '#ffd23f', GOAL, 'goal');
                else if (ax < BEHIND_HALF) result('BEHIND', '#9ad8ff', BEHIND, 'behind');
                else result('OUT ON THE FULL', '#ff7a5a', 0, 'out');
              } else if (s.y <= 0.17) result('SHORT!', '#ff7a5a', 0, 'short');
            }
          } else if (phase === 'show') {
            if (shot && shot.done && ball.position.z > -12 && ball.position.y > 0.17) { // let the ball carry on through
              shot.vx += wind * dt; shot.vy -= G * dt; shot.x += shot.vx * dt; shot.y += shot.vy * dt; shot.z += shot.vz * dt; ball.position.set(shot.x, Math.max(0.17, shot.y), shot.z);
            }
            if (phaseT <= 0) {
              if (round >= ROUNDS || mg.timeLeft() < FLY_T + KICK_T + SHOW_T + 1) {
                finishAt = tAll; const top = Math.max(...kickers.map(total));
                banner(`${kickers.filter((K) => total(K) === top).map((K) => K.p.name).join(' & ')} TAKES THE CHOCOLATES`, '#ffd23f', 0.75); sfx.play('cheers');
              } else { phase = 'pre'; phaseT = 0.6; }
            }
          }
        }

        // ----- move the players -----
        for (const K of kickers) {
          let ix = 0, iz = 0;
          const free = running && finishAt == null && (phase === 'fly' || phase === 'loose' || phase === 'pre' || (phase === 'kick' && holder !== K) || phase === 'show');
          if (K.bot && free) {
            const B = K.bot;
            let tx, tz;
            if (phase === 'fly') { tx = fly.tx + (B.ox || 0); tz = fly.tz + (B.oz || 0); }
            else if (phase === 'loose') { tx = loose.x; tz = loose.z; }
            else { tx = ZONE.x0 + (ZONE.x1 - ZONE.x0) * ((K.k + 0.5) / n); tz = (ZONE.z0 + ZONE.z1) / 2; }
            const dx = tx - K.x, dz = tz - K.z, d = Math.hypot(dx, dz);
            if (d > 0.15) { const s = Math.min(1, d / 1.2); ix = dx / d * s; iz = dz / d * s; }
            if (phase === 'fly' && !B.jumped) { const tl = FLY_T - fly.t; if (tl < 0.32 + (B.timingNow ?? B.timing) && Math.hypot(K.x - fly.tx, K.z - fly.tz) < 2.2) { B.jumped = true; if (K.jumpT < 0) K.jumpT = 0; } }
          } else if (!K.bot && free) { ix = K.input.x; iz = -K.input.y; }
          // the stick is from the player's view, and they're facing the camera, so flip it
          if (!K.bot) { ix = -ix; iz = -iz; }
          const m = Math.min(1, Math.hypot(ix, iz));
          const tvx = m > 0.05 ? ix / Math.hypot(ix, iz) * m * RUN : 0, tvz = m > 0.05 ? iz / Math.hypot(ix, iz) * m * RUN : 0;
          const a = 1 - Math.exp(-dt * 8); K.vx += (tvx - K.vx) * a; K.vz += (tvz - K.vz) * a;
          if (phase === 'kick' && holder === K) K.vx = K.vz = 0;
          K.x = Math.max(-12, Math.min(12, K.x + K.vx * dt)); K.z = Math.max(4, Math.min(18, K.z + K.vz * dt));
          if (K.jumpT >= 0) { K.jumpT += dt; if (K.jumpT > LEAP_T + 0.35) K.jumpT = -1; }
          K.y = K.jumpT >= 0 && K.jumpT < LEAP_T ? Math.sin(K.jumpT / LEAP_T * Math.PI) * LEAP : 0;
          K.doll.group.position.set(K.x, K.y, K.z);
          let want = Math.PI;
          if (phase === 'fly') want = Math.atan2(fly.sx - K.x, fly.sz - K.z) * 0.3 + Math.PI * 0.7;
          if (holder === K && phase === 'kick') want = Math.atan2(-K.x, -K.z);
          const cur = K.doll.group.rotation.y; let dr = want - cur; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); K.doll.group.rotation.y = cur + dr * Math.min(1, dt * 8);
          if (K.armT > 0) K.armT -= dt;
          else K.doll.setArms(K.jumpT >= 0 ? 1.6 : phase === 'fly' && fly.t > 1.5 ? 0.6 : 0, 0);
          K.doll.update(dt);
        }
        // knock into each other in the pack
        for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
          const A = kickers[a], B = kickers[b], dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz);
          if (d < 0.7 && d > 1e-4) { const p = (0.7 - d) / 2; if (!(phase === 'kick' && holder === A)) { A.x -= dx / d * p; A.z -= dz / d * p; } if (!(phase === 'kick' && holder === B)) { B.x += dx / d * p; B.z += dz / d * p; } }
        }
        // the ball sits with whoever has it
        if (phase === 'kick' && holder && !shot) ball.position.set(holder.x + 0.2, 1.0 * DOLL / 0.62 + holder.y, holder.z - 0.25);
        if (phase === 'pre') ball.position.set(coach.group.position.x + 0.5, 0.9, coach.group.position.z - 0.3);
        coach.setArms(phase === 'pre' ? 0.6 : 0, 0); coach.update(dt);
        // the windsock swings to the wind for the kick at goal
        const wa = wind >= 0 ? 0 : Math.PI; sock.rotation.y += (wa - sock.rotation.y) * Math.min(1, dt * 3);
        sockMesh.rotation.x = Math.sin(tAll * 6) * 0.15; sock.rotation.z = -0.9 + Math.min(1, Math.abs(wind) / 3) * 0.85;
        for (let i = pops.length - 1; i >= 0; i--) { const q = pops[i]; q.life += dt; q.sp.material.opacity = Math.max(0, Math.min(1, q.life * 5, q.stay - q.life + 1)); if (q.sp !== bannerSp) q.sp.position.y += dt * 0.5; if (q.life > q.stay + 1) { scene.remove(q.sp); pops.splice(i, 1); } }
      },
      input(p, m) {
        const K = kickers.find((x) => x.p === p);
        if (!K || m.b !== 'stick') return;
        const held = Number(m.h) || 0, newly = held & ~K.input.held;
        K.input.x = Math.max(-1, Math.min(1, Number(m.x) || 0)); K.input.y = Math.max(-1, Math.min(1, Number(m.y) || 0)); K.input.held = held;
        if (newly & BTN.GO) {
          if (phase === 'kick' && holder === K) doKick(K);
          else if (K.jumpT < 0 && phase !== 'kick') K.jumpT = 0;
        }
      },
      scores() { return Object.fromEntries(kickers.map((K) => [K.p.id, total(K)])); },
      done: () => finishAt != null && tAll - finishAt > 3,
    };
  },
};
