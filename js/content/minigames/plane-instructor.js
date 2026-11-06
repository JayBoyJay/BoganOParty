// Plane Instructor: the instructor holds their arms out like a plane and banks left and right.
// Push your stick left and right to match. Every moment you're within the instructor's bounds scores points.
// Every few seconds the instructor calls a trick (LOOP or SPIN): its icon pops up above them with a ring
// that fills around it. Press that trick's button as the ring closes; the closer you are, the more it's worth.
// Get past the halfway mark and your doll takes off and flies on the spot. One minute.
const MATCH = 0.2; // radians either side of the instructor that still counts (~11°)
const RATE = 10; // points per second while matched
const MAX_TILT = 0.95;
const BTN = { LOOP: 1, SPIN: 2 };
const TRICKS = {
  loop: { bit: BTN.LOOP, icon: '➰', name: 'LOOP', color: '#ff5fa2', time: 1.0 },
  spin: { bit: BTN.SPIN, icon: '🌀', name: 'SPIN', color: '#3ad1ff', time: 0.8 },
};
const LEAD = 2.6; // seconds the ring takes to close
const WINDOW = 0.6; // seconds either side of the ring closing that still score
const TRICK_MAX = 30; // points for a dead-on press (three seconds of perfect banking)
const PIVOT = 1.1; // dolls loop and spin about their middle, not their feet
const TOWER = 4.6; // the instructor stands up on a tower so the flyers don't block the view

export default {
  id: 'plane-instructor',
  name: 'Plane Instructor',
  blurb: 'Arms out, copy the instructor. Nail the loops and spins and you might just take off.',
  howTo: 'Push your stick left and right to bank your arms like the instructor. When a trick icon pops up above the instructor, press LOOP or SPIN to match it just as the ring around it closes. The closer you are, the more points.',
  padText: 'Stick to bank. Press the trick as its ring closes!',
  duration: 60,
  pad: { kind: 'stick', buttons: [{ bit: BTN.LOOP, label: '➰ LOOP', tone: 'go' }, { bit: BTN.SPIN, label: '🌀 SPIN' }] },

  create(mg) {
    const { THREE, kit, scene, players, rng, sfx } = mg;
    scene.background = new THREE.Color(0x87c8f0);
    scene.fog = new THREE.Fog(0x9fd3f2, 40, 140);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x4c7a2a, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(10, 30, 20); sun.castShadow = true;
    Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30 });
    scene.add(sun);
    // airfield: grass, runway, a hangar and a windsock
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), kit.mat(0x5e9b3a));
    grass.rotation.x = -Math.PI / 2; grass.receiveShadow = true; scene.add(grass);
    kit.box(18, 0.05, 200, 0x3b3b3e, 0, 0, -60);
    for (let z = 20; z > -150; z -= 10) kit.box(0.6, 0.06, 4, 0xffffff, 0, 0, z);
    const hangar = kit.group(-26, 0, -30, 0.3);
    kit.box(20, 8, 14, 0xb8bec6, 0, 0, 0, hangar);
    kit.sign('BOGAN AIR', 12, 2, 0, 9, 7.1, hangar, { bg: '#0b3d91', fg: '#fff' });
    kit.cyl(0.12, 0.12, 6, 0xdddddd, 18, 0, -12);
    const sock = kit.cone(0.6, 2.4, 0xff7a00, 18, 5, -12);
    sock.rotation.z = Math.PI / 2;

    // the instructor's tower: four steel legs with cross braces, a deck and a sign
    const tz = -6;
    for (const sx of [-1.5, 1.5]) for (const sz of [-1.5, 1.5]) kit.box(0.22, TOWER, 0.22, 0x8a8f96, sx, 0, tz + sz);
    for (const y of [1.2, 2.6, 3.9]) {
      kit.box(3.2, 0.12, 0.12, 0xb0b5bb, 0, y, tz + 1.5);
      kit.box(3.2, 0.12, 0.12, 0xb0b5bb, 0, y, tz - 1.5);
      kit.box(0.12, 0.12, 3.2, 0xb0b5bb, -1.5, y, tz);
      kit.box(0.12, 0.12, 3.2, 0xb0b5bb, 1.5, y, tz);
    }
    kit.box(3.6, 0.3, 3.6, 0x666a70, 0, TOWER, tz);
    kit.sign('FLIGHT SCHOOL', 3.4, 0.6, 0, TOWER - 0.75, tz + 1.82, undefined, { bg: '#ff8a00', fg: '#111' });
    // instructor up on the deck in a hi-vis vest, inside a pivot so they can loop and spin
    const iRig = new THREE.Group(); iRig.position.set(0, TOWER + 0.3 + PIVOT * 1.35, tz); scene.add(iRig);
    const instructor = mg.makeDoll({ id: 'instructor', name: 'Instructor', color: '#ff8a00', body: 'smooth', hair: 0x222222 }, { tag: false });
    instructor.group.position.set(0, -PIVOT * 1.35, 0);
    instructor.group.scale.setScalar(1.35);
    const vest = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.7, 20), kit.mat(0xd7ff00, { emissive: 0x556600, emissiveIntensity: 0.3 }));
    vest.position.y = 1.45; instructor.body.add(vest);
    iRig.add(instructor.group);

    // the trick call: an icon above the instructor with a ring that fills around it
    const cueC = document.createElement('canvas'); cueC.width = cueC.height = 256;
    const cueG = cueC.getContext('2d');
    const cueT = new THREE.CanvasTexture(cueC); cueT.colorSpace = THREE.SRGBColorSpace;
    const cueSp = new THREE.Sprite(new THREE.SpriteMaterial({ map: cueT, transparent: true, depthTest: false, opacity: 0 }));
    cueSp.scale.set(2.3, 2.3, 1); cueSp.renderOrder = 30;
    cueSp.position.set(0, TOWER + 5.7, tz); scene.add(cueSp);
    let cueDrawn = '';
    const drawCue = (trick, frac, flash) => {
      const key = `${trick.name}|${Math.round(frac * 60)}|${flash}`;
      if (key === cueDrawn) return; cueDrawn = key;
      const g = cueG, c = 128;
      g.clearRect(0, 0, 256, 256);
      g.fillStyle = 'rgba(10,14,24,0.82)'; g.beginPath(); g.arc(c, c, 100, 0, Math.PI * 2); g.fill();
      g.lineWidth = 16; g.strokeStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.arc(c, c, 112, 0, Math.PI * 2); g.stroke();
      // the timer: fills clockwise from the top, going gold as it nears the close
      g.strokeStyle = flash ? '#7dff8a' : frac > 0.8 ? '#ffd23a' : trick.color; g.lineCap = 'round';
      g.beginPath(); g.arc(c, c, 112, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, frac)); g.stroke();
      g.font = '96px system-ui, "Apple Color Emoji", "Segoe UI Emoji"'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(trick.icon, c, c - 14);
      g.font = '900 40px system-ui'; g.fillStyle = trick.color; g.fillText(trick.name, c, c + 60);
      cueT.needsUpdate = true;
    };

    // little "PERFECT +30" pops above each player
    const pops = [];
    const pop = (x, y, text, color) => {
      const c = document.createElement('canvas'); c.width = 512; c.height = 128;
      const g = c.getContext('2d');
      g.font = '900 72px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 12; g.strokeStyle = '#111'; g.strokeText(text, 256, 64, 500);
      g.fillStyle = color; g.fillText(text, 256, 64, 500);
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
      sp.scale.set(2.8, 0.7, 1); sp.position.set(x, y, 2.2); sp.renderOrder = 31;
      scene.add(sp); pops.push({ sp, life: 0 });
    };

    const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.5, 400);
    const width = Math.max(8, players.length * 2.6);
    camera.position.set(0, 7.2, 9 + width * 0.75);
    camera.lookAt(0, 4.2, -2);

    const state = new Map();
    players.forEach((p, i) => {
      const d = mg.makeDoll(p);
      const x = (i - (players.length - 1) / 2) * 2.6;
      const rig = new THREE.Group(); rig.position.set(x, PIVOT, 2); scene.add(rig);
      d.group.position.y = -PIVOT; rig.add(d.group);
      const glow = new THREE.Mesh(new THREE.RingGeometry(0.7, 1.0, 32), new THREE.MeshBasicMaterial({ color: 0x5cff9d, transparent: true, opacity: 0, side: THREE.DoubleSide }));
      glow.rotation.x = -Math.PI / 2; glow.position.set(x, 0.05, 2);
      scene.add(glow);
      state.set(p.id, {
        doll: d, rig, glow, tilt: 0, want: 0, score: 0, flying: false, lift: 0, x, lag: 0.25 + rng() * 0.5, wobble: rng() * 10,
        held: 0, used: -1, trick: null, trickT: 0, botAt: null, botPick: null,
        botSkill: 0.12 + rng() * 0.25,
      });
    });

    // a doll (or the instructor) doing a trick: a loop flips over forwards, a spin twirls on the spot
    const startTrick = (s, kind) => { s.trick = TRICKS[kind]; s.trickKind = kind; s.trickT = 0; };
    const animTrick = (s, rig, dt) => {
      if (!s.trick) { rig.rotation.x = 0; rig.rotation.y = 0; return 0; }
      s.trickT += dt;
      const k = Math.min(1, s.trickT / s.trick.time), e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      let hop = Math.sin(k * Math.PI) * 1.4;
      if (s.trickKind === 'loop') { rig.rotation.x = -e * Math.PI * 2; rig.rotation.y = 0; } else { rig.rotation.y = e * Math.PI * 2; rig.rotation.x = 0; hop *= 0.5; }
      if (k >= 1) { s.trick = null; rig.rotation.x = rig.rotation.y = 0; hop = 0; }
      return hop;
    };
    const iState = { trick: null, trickT: 0 };

    // the call schedule: one trick at a time, the ring closes at cue.at
    let cue = null, cueN = 0, nextCue = 4.5, lastT = 0;
    const press = (p, kind) => {
      const s = state.get(p.id);
      if (!s.trick) startTrick(s, kind);
      if (!cue || s.used === cue.n) return; // one go per call
      const off = lastT - cue.at;
      s.used = cue.n;
      if (kind !== cue.kind || Math.abs(off) > WINDOW) {
        pop(s.x, s.lift + 3.6, kind !== cue.kind ? 'WRONG!' : off < 0 ? 'TOO EARLY' : 'TOO LATE', '#ff6a6a');
        return;
      }
      const close = 1 - Math.abs(off) / WINDOW;
      const pts = Math.max(3, Math.round(TRICK_MAX * close));
      s.score += pts;
      const word = close > 0.8 ? 'PERFECT' : close > 0.5 ? 'GREAT' : 'OK';
      pop(s.x, s.lift + 3.6, `${word} +${pts}`, close > 0.8 ? '#7dff8a' : close > 0.5 ? '#ffd23a' : '#ffffff');
      if (close > 0.8) sfx.play('coin');
    };

    // the instructor's bank angle: hold, then swing to a new angle
    let target = 0, aim = 0, holdFor = 1.5;
    return {
      camera,
      update(dt, t, running) {
        lastT = t;
        if (running) {
          holdFor -= dt;
          if (holdFor <= 0) { aim = (rng() * 2 - 1) * 0.8; holdFor = 1.2 + rng() * 2; }
          target += (aim - target) * Math.min(1, dt * 2.2);
          // call the next trick
          if (!cue && t >= nextCue && mg.duration - t > LEAD + 0.5) {
            const kind = rng() < 0.5 ? 'loop' : 'spin';
            cue = { kind, at: t + LEAD, n: ++cueN };
            sfx.play('whoosh');
            for (const p of players) {
              if (!p.bot) continue;
              const s = state.get(p.id);
              s.botPick = rng() < 0.9 ? kind : (kind === 'loop' ? 'spin' : 'loop');
              s.botAt = rng() < 0.12 ? null : cue.at + (rng() * 2 - 1) * s.botSkill * 2;
            }
          }
          if (cue && !cue.done && t >= cue.at) { cue.done = true; startTrick(iState, cue.kind); }
          if (cue && t > cue.at + WINDOW) { cue = null; nextCue = t + 2 + rng() * 2.5; }
        }
        // the cue icon
        if (cue) {
          drawCue(TRICKS[cue.kind], 1 - (cue.at - t) / LEAD, cue.done);
          cueSp.material.opacity = Math.min(1, cueSp.material.opacity + dt * 6);
          const pulse = cue.done ? 1.15 : 1 + Math.max(0, 1 - (cue.at - t) / 0.4) * 0.12;
          cueSp.scale.set(2.3 * pulse, 2.3 * pulse, 1);
        } else cueSp.material.opacity = Math.max(0, cueSp.material.opacity - dt * 4);

        instructor.setArms(0, target);
        instructor.update(dt);
        iRig.position.y = TOWER + 0.3 + PIVOT * 1.35 + animTrick(iState, iRig, dt) * 0.6;
        for (const p of players) {
          const s = state.get(p.id);
          if (p.bot && running) {
            // CPU: chase the instructor with a bit of lag and wobble, and have a go at each trick
            s.want = target + Math.sin(t * 1.3 + s.wobble) * 0.18;
            if (s.botAt != null && t >= s.botAt) { s.botAt = null; press(p, s.botPick); }
          }
          s.tilt += (s.want - s.tilt) * Math.min(1, dt / (p.bot ? s.lag : 0.08));
          s.doll.setArms(0, s.tilt);
          s.doll.update(dt);
          const matched = Math.abs(s.tilt - target) < MATCH;
          if (running && matched) s.score += RATE * dt;
          s.glow.material.opacity += ((matched ? 0.9 : 0) - s.glow.material.opacity) * Math.min(1, dt * 8);
          // past halfway: take off and fly on the spot
          if (!s.flying && s.score >= RATE * mg.duration / 2) { s.flying = true; sfx.play('takeoff'); }
          s.lift += ((s.flying ? 2.0 : 0) - s.lift) * Math.min(1, dt * 1.5);
          const hop = animTrick(s, s.rig, dt);
          s.rig.position.y = PIVOT + s.lift + hop + (s.flying ? Math.sin(t * 3 + s.wobble) * 0.25 : 0);
          s.doll.group.rotation.x = s.flying ? 0.35 : 0;
        }
        for (let i = pops.length - 1; i >= 0; i--) {
          const q = pops[i]; q.life += dt;
          q.sp.position.y += dt * 0.9;
          q.sp.material.opacity = q.life < 0.9 ? 1 : Math.max(0, 1 - (q.life - 0.9) * 3);
          if (q.life > 1.3) { scene.remove(q.sp); q.sp.material.map.dispose(); q.sp.material.dispose(); pops.splice(i, 1); }
        }
      },
      input(p, m) {
        if (m.b !== 'stick') return;
        const s = state.get(p.id);
        if (Number.isFinite(m.x)) s.want = Math.max(-1, Math.min(1, m.x)) * MAX_TILT;
        const held = Number(m.h) || 0, newly = held & ~s.held;
        s.held = held;
        if (newly & BTN.LOOP) press(p, 'loop');
        else if (newly & BTN.SPIN) press(p, 'spin');
      },
      scores() { return Object.fromEntries(players.map((p) => [p.id, state.get(p.id).score])); },
    };
  },
};
