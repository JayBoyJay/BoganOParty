// Sausage Sizzle: the hardware store snag sizzle, and everyone's on the barbie. Four snags each on the
// hotplate. Only the side touching the plate cooks, so flip each one at the right time, and SERVE them
// in bread once both sides are done. Golden both sides is 3 points. Raw or burnt and the customers
// complain. Leave one too long and it's charcoal. Watch the smoke: it goes grey, then black. And
// there's a magpie about.
import { addSky } from '../../host/sky.js';

const N_SNAGS = 4;
const SEC = 1.7; // each player's bit of the hotplate
const HEAT = 0.11; // cook per second on the down side; 1.0 is golden
const GOOD = [0.8, 1.3], PERFECT = [0.9, 1.15], BURNT = 1.42, CHAR = 1.95;
const SNAG_L = 0.95, SNAG_R = 0.075;
const DOLL = 0.7;

// raw pink → golden → dark → charcoal
const STOPS = [[0, 0xe89a8e], [0.45, 0xd8925a], [0.8, 0xb8682e], [1.05, 0x8e4a1e], [1.35, 0x4a2410], [1.8, 0x141010]];
const cookCol = (c, out) => { for (let i = 1; i < STOPS.length; i++) if (c <= STOPS[i][0] || i === STOPS.length - 1) { const [a, ca] = STOPS[i - 1], [b, cb] = STOPS[i]; return out.setHex(ca).lerp(new out.constructor(cb), Math.max(0, Math.min(1, (c - a) / (b - a)))); } return out; };

export default {
  id: 'sausage-sizzle',
  name: 'Sausage Sizzle',
  blurb: 'Four snags each on the barbie. Flip them on time, serve them golden. Mind the magpie.',
  howTo: 'Only the side touching the hotplate cooks. Tap a snag number to flip that snag. When both sides are golden, hit SERVE to put every snag that is done into bread. Golden both sides is 3 points, a bit under or over is 1 or 2, and burnt loses a point. Watch the smoke: grey means flip it soon, black means you are burning it.',
  padText: 'Flip 1-4, then SERVE',
  duration: 60,
  pad: { kind: 'buttons', buttons: [
    { id: 's1', label: '🌭 1', color: '#ffd8a8' }, { id: 's2', label: '🌭 2', color: '#ffd8a8' },
    { id: 's3', label: '🌭 3', color: '#ffd8a8' }, { id: 's4', label: '🌭 4', color: '#ffd8a8' },
    { id: 'serve', label: '🍞 SERVE', tone: 'go', wide: true },
  ] },

  create(mg) {
    const { THREE, kit, scene, players, rng, renderer, sfx } = mg;
    const n = players.length;
    const W = n * SEC;

    // ----- out the front of the hardware store on a Saturday -----
    const { sun } = addSky(scene, renderer, { elevation: 50, azimuth: 25, turbidity: 3, sunIntensity: 3, sky: 0xd6e8ff, ground: 0x6b6a52, hemi: 0.65, env: 0.6, shadowSize: 20, fog: [0xd8e2ea, 40, 120] });
    sun.target.position.set(0, 0.8, 0);
    const car = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), kit.surf('asphalt', { unit: 4 })); car.rotation.x = -Math.PI / 2; car.receiveShadow = true; scene.add(car);
    for (let i = -6; i <= 6; i++) kit.box(0.12, 0.01, 4.5, 0xf2f0e6, i * 2.8, 0, 6.5).castShadow = false; // car park lines
    // the store: a big green tin shed with a sign
    kit.box(W + 30, 7, 1, kit.surf('corrugated', { unit: 1.6, tint: 0x2e6a3e, metalness: 0.4 }), 0, 0, -6);
    kit.sign('SNAG SIZZLE  $3', 7, 1.2, -5, 5, -5.45, undefined, { bg: '#c8102e', fg: '#ffffff' });
    kit.sign('Supporting the Under 12s', 7, 0.6, -5, 4.1, -5.45, undefined, { bg: '#ffffff', fg: '#c8102e' });
    kit.box(4, 3, 0.1, 0x3a4a54, 7, 0, -5.45, undefined, { metalness: 0.6, roughness: 0.3 }); // sliding doors
    // a gazebo behind the barbie (just the back legs and valance, so it doesn't hide anyone)
    const gaz = kit.mat(0xc8102e, { roughness: 0.7, side: THREE.DoubleSide });
    for (const sx of [-1, 1]) kit.box(0.06, 3.2, 0.06, 0xd8d8d8, sx * (W / 2 + 0.8), 0, -2.2, undefined, { metalness: 0.7 });
    kit.box(W + 1.8, 0.4, 0.02, gaz, 0, 2.9, -2.2);
    // the barbie: a big flat hotplate on a trestle
    const plateM = kit.mat(0x2a2a2c, { metalness: 0.7, roughness: 0.45 });
    kit.box(W + 0.4, 0.8, 1.2, kit.mat(0x7a7e82, { metalness: 0.6, roughness: 0.4 }), 0, 0, 0);
    kit.box(W + 0.5, 0.06, 1.3, plateM, 0, 0.8, 0);
    kit.box(W + 0.5, 0.12, 0.05, plateM, 0, 0.86, -0.62);
    // a folding table of bread and sauce out the front
    kit.box(W + 0.4, 0.05, 0.5, 0xf4f0e8, 0, 0.72, 1.1, undefined, { roughness: 0.6 });
    for (const sx of [-1, 1]) kit.box(0.04, 0.72, 0.04, 0xa8a8a8, sx * (W / 2), 0, 1.1);
    const sauce = (x, col) => { const b = kit.cyl(0.07, 0.08, 0.26, col, x, 0.77, 1.15, undefined, { roughness: 0.3 }); kit.cone(0.05, 0.08, col, x, 1.03, 1.15); return b; };
    sauce(-W / 2 + 0.2, 0xc8102e); sauce(-W / 2 + 0.38, 0xd8a020); sauce(W / 2 - 0.2, 0xc8102e);

    // ----- the snags -----
    // a capsule with its triangles sorted into two material groups: the top half and the bottom half
    const snagGeo = (() => {
      const g = new THREE.CapsuleGeometry(SNAG_R, SNAG_L - SNAG_R * 2, 6, 14).toNonIndexed(); g.rotateZ(Math.PI / 2);
      const P = g.attributes.position, Nn = g.attributes.normal, top = [], bot = [];
      for (let i = 0; i < P.count; i += 3) { const y = (P.getY(i) + P.getY(i + 1) + P.getY(i + 2)) / 3; (y >= 0 ? top : bot).push(i); }
      const pos = [], nor = [];
      for (const i of [...top, ...bot]) for (let k = 0; k < 3; k++) { pos.push(P.getX(i + k), P.getY(i + k), P.getZ(i + k)); nor.push(Nn.getX(i + k), Nn.getY(i + k), Nn.getZ(i + k)); }
      const out = new THREE.BufferGeometry();
      out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      out.addGroup(0, top.length * 3, 0); out.addGroup(top.length * 3, bot.length * 3, 1);
      return out;
    })();
    const numTex = (k) => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.beginPath(); g.arc(32, 32, 28, 0, 7); g.fill(); g.fillStyle = '#1a1a1a'; g.font = '900 44px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(k), 32, 35); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
    const nums = [1, 2, 3, 4].map(numTex);
    const smokeTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t; })();
    const puffs = [];
    const puff = (x, y, z, cook) => {
      const dark = Math.max(0, Math.min(1, (cook - 0.85) / 0.6));
      const m = new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0.35 + dark * 0.55 });
      m.color.setRGB(0.95 - dark * 0.85, 0.95 - dark * 0.85, 0.95 - dark * 0.85);
      const s = new THREE.Sprite(m); s.position.set(x, y, z); s.scale.setScalar(0.26 + dark * 0.24); scene.add(s);
      puffs.push({ s, life: 0, v: 0.4 + rng() * 0.3, max: 1.2 + dark * 0.6 });
    };
    const pops = [];
    const pop = (x, y, z, text, color, size = 1) => {
      const c = document.createElement('canvas'); c.width = 512; c.height = 160;
      const g = c.getContext('2d'); g.font = '900 92px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 14; g.strokeStyle = '#1a0d08'; g.strokeText(text, 256, 84, 500); g.fillStyle = color; g.fillText(text, 256, 84, 500);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); sp.scale.set(1.8 * size, 0.56 * size, 1); sp.renderOrder = 20;
      sp.position.set(x, y, z); scene.add(sp); pops.push({ sp, life: 0 });
    };
    const breadM = kit.mat(0xf0dcb0, { roughness: 0.9 });

    const cooks = players.map((p, i) => {
      const x0 = -W / 2 + SEC / 2 + i * SEC;
      const doll = mg.makeDoll(p, { scale: DOLL });
      doll.group.position.set(x0, 0, -1.25); scene.add(doll.group);
      // an apron in their colour
      const apron = kit.box(0.5, 0.6, 0.03, p.color, 0, 0.75, 0.25, doll.group, { roughness: 0.8 }); apron.castShadow = false;
      const tongs = kit.box(0.04, 0.03, 0.45, 0xc8ccd0, x0 + 0.45, 1.2, -0.7, undefined, { metalness: 0.9, roughness: 0.3 });
      const snags = [];
      for (let k = 0; k < N_SNAGS; k++) {
        const z = 0.39 - k * 0.26;
        const mats = [new THREE.MeshStandardMaterial({ roughness: 0.45 }), new THREE.MeshStandardMaterial({ roughness: 0.45 })];
        const mesh = new THREE.Mesh(snagGeo, mats); mesh.castShadow = true;
        mesh.position.set(x0 + 0.1, 0.83 + SNAG_R, z); scene.add(mesh);
        const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: nums[k], depthTest: false })); tag.scale.setScalar(0.17); tag.renderOrder = 12;
        tag.position.set(x0 - SNAG_L / 2 - 0.12 + 0.1, 0.96, z); scene.add(tag);
        snags.push({ k, mesh, mats, z, x: x0 + 0.1, cook: [0, 0], down: 1, rot: 0, rotTo: 0, gone: 0, smokeT: rng() * 0.3, heat: 0.92 + rng() * 0.16 });
      }
      return { p, x0, doll, tongs, snags, score: 0, served: 0, armT: 0,
        bot: p.bot ? { target: 0.95 + rng() * 0.15, lag: 0, slop: 0.06 + rng() * 0.12 } : null };
    });
    const resetSnag = (s, delay = 0.7) => { s.cook = [0, 0]; s.down = 1; s.rot = s.rotTo = 0; s.gone = delay; s.mesh.visible = delay <= 0; s.bot = null; };

    const flip = (C, k) => {
      const s = C.snags[k]; if (!s || s.gone > 0 || Math.abs(s.rot - s.rotTo) > 0.3) return;
      s.down = 1 - s.down; s.rotTo += Math.PI;
      C.armT = 0.25; sfx.play('squeak');
    };
    const grade = (s) => {
      const [a, b] = s.cook;
      if (a >= BURNT || b >= BURNT) return { pts: -1, say: 'BURNT', col: '#ff5a5a' };
      if (a < GOOD[0] - 0.25 || b < GOOD[0] - 0.25) return { pts: -1, say: 'RAW!', col: '#ff8aa0' };
      const perfect = (c) => c >= PERFECT[0] && c <= PERFECT[1], good = (c) => c >= GOOD[0] && c <= GOOD[1];
      if (perfect(a) && perfect(b)) return { pts: 3, say: 'PERFECT', col: '#5cff9d' };
      if (good(a) && good(b)) return { pts: 2, say: 'GOOD', col: '#ffd23f' };
      return { pts: 1, say: 'MEH', col: '#ffffff' };
    };
    const breads = [];
    const serve = (C) => {
      let any = false, total = 0;
      for (const s of C.snags) {
        if (s.gone > 0) continue;
        if (s.cook[0] < 0.55 || s.cook[1] < 0.55) continue; // still raw: leave it on
        const g = grade(s); total += g.pts; C.score += g.pts; C.served++; any = true;
        // into a slice of bread on the table
        const b = new THREE.Group(); const sl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.3), breadM); b.add(sl);
        const sn = new THREE.Mesh(snagGeo, [s.mats[0].clone(), s.mats[1].clone()]); sn.scale.setScalar(0.32); sn.rotation.y = Math.PI / 4; sn.position.y = 0.03; b.add(sn);
        b.position.set(s.x, 1.0, s.z); scene.add(b); breads.push({ b, life: 0, from: b.position.clone(), to: new THREE.Vector3(C.x0 - 0.5 + (C.served % 5) * 0.25, 0.76, 1.05 + ((C.served / 5) | 0 % 2) * 0.05) });
        resetSnag(s);
      }
      if (any) { pop(C.x0, 2.3, 0.3, total > 0 ? `+${total}` : `${total}`, total >= 0 ? C.p.color : '#ff5a5a', 1); sfx.play(total > 0 ? 'coin' : 'lose'); C.armT = 0.3; }
    };

    // ----- the magpie -----
    const bird = new THREE.Group(); scene.add(bird);
    {
      const blk = kit.mat(0x111111, { roughness: 0.5 }), wht = kit.mat(0xf2f2f2, { roughness: 0.5 });
      const b = kit.ball(0.16, blk, 0, 0, 0, bird); b.scale.set(1, 0.8, 1.7);
      kit.ball(0.1, wht, 0, 0.04, -0.12, bird).scale.set(1, 0.8, 1);
      kit.ball(0.1, blk, 0, 0.08, 0.26, bird);
      kit.cone(0.035, 0.14, 0xb8b8b0, 0, 0.06, 0.4, bird).rotation.x = Math.PI / 2;
      bird.userData.wings = [-1, 1].map((sd) => { const w = kit.box(0.4, 0.02, 0.2, wht, sd * 0.25, 0.05, 0, bird); return w; });
    }
    bird.visible = false;
    const M = { t: 9 + rng() * 5, fly: null };

    const camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.2, 200);
    const span = Math.max(W + 1.2, 5.2), hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(18)) * 16 / 9);
    const dist = span / 2 / Math.tan(hfov / 2);
    camera.position.set(0, 0.9 + dist * 0.62, 0.4 + dist * 0.8);
    camera.lookAt(0, 0.85, -0.2);

    let tAll = 0;
    return {
      camera,
      update(dt, t, running) {
        tAll += dt;
        for (const C of cooks) {
          if (C.bot && running) {
            const B = C.bot; B.lag -= dt;
            if (B.lag <= 0) {
              B.lag = 0.25 + rng() * 0.3;
              const ready = C.snags.filter((s) => s.gone <= 0);
              const flipMe = ready.find((s) => s.cook[s.down] >= B.target + (rng() - 0.5) * B.slop && s.cook[1 - s.down] < B.target);
              if (ready.length && ready.every((s) => s.cook[0] >= 0.85 && s.cook[1] >= 0.85)) serve(C);
              else if (flipMe) flip(C, flipMe.k);
              else if (ready.some((s) => s.cook[0] >= 0.85 && s.cook[1] >= 0.85 && rng() < 0.15)) serve(C);
            }
          }
          for (const s of C.snags) {
            if (s.gone > 0) { s.gone -= dt; if (s.gone <= 0) { s.mesh.visible = true; s.mesh.rotation.x = 0; } continue; }
            if (running) s.cook[s.down] += HEAT * s.heat * dt;
            if (s.cook[s.down] >= CHAR) { C.score -= 1; pop(s.x, 1.6, s.z, 'CHARCOAL -1', '#ff5a5a', 0.7); sfx.play('lose'); resetSnag(s, 1); continue; }
            // flip animation: a quick roll with a little hop
            const d = s.rotTo - s.rot; s.rot += Math.sign(d) * Math.min(Math.abs(d), dt * 14);
            s.mesh.rotation.x = s.rot;
            s.mesh.position.y = 0.83 + SNAG_R + Math.sin(Math.min(1, Math.abs(d) / Math.PI) * Math.PI) * 0.12;
            // the top half of the mesh is group 0 when it hasn't been flipped (down = 1)
            cookCol(s.cook[0], s.mats[0].color); cookCol(s.cook[1], s.mats[1].color);
            s.smokeT -= dt;
            const dc = s.cook[s.down];
            if (running && s.smokeT <= 0 && dc > 0.3) { s.smokeT = dc > 1.2 ? 0.08 : dc > 0.85 ? 0.16 : 0.35; puff(s.x + (rng() - 0.5) * SNAG_L * 0.8, 0.9, s.z, dc); }
          }
          // the cook waves the tongs about
          C.armT -= dt;
          C.doll.setArms(C.armT > 0 ? 0.9 : 0.3 + Math.sin(tAll * 3 + C.x0) * 0.1, 0.3);
          C.doll.update(dt);
          C.tongs.position.set(C.x0 + 0.42, 1.15 + (C.armT > 0 ? -0.12 : 0), -0.75 + (C.armT > 0 ? 0.25 : 0));
        }
        // the magpie: swoops in, nicks a snag off someone's plate, and leaves
        if (running) {
          if (!M.fly) { M.t -= dt; if (M.t <= 0) {
            const C = cooks[(rng() * n) | 0], s = C.snags.filter((q) => q.gone <= 0)[0 | (rng() * 3)];
            if (s) { M.fly = { C, s, k: 0, from: new THREE.Vector3(-W / 2 - 8, 6, -4), to: new THREE.Vector3(W / 2 + 8, 7, 4) }; bird.visible = true; sfx.play('squeak'); }
            M.t = 11 + rng() * 8;
          } } else {
            const F = M.fly; F.k += dt / 2.6;
            const at = new THREE.Vector3(F.s.x, 1.0, F.s.z);
            const p = F.k < 0.5 ? F.from.clone().lerp(at, F.k * 2) : at.clone().lerp(F.to, (F.k - 0.5) * 2);
            bird.position.copy(p); bird.lookAt(F.k < 0.5 ? at : F.to);
            for (const w of bird.userData.wings) w.rotation.z = Math.sin(tAll * 30) * 0.6 * (w.position.x > 0 ? 1 : -1);
            if (F.k >= 0.5 && !F.took) { F.took = true; if (F.s.gone <= 0) { pop(F.s.x, 1.7, F.s.z, 'MAGPIE!', '#ffffff', 0.7); resetSnag(F.s, 1.5); sfx.play('meow'); } }
            if (F.took) { F.held = F.held || (() => { const m = new THREE.Mesh(snagGeo, [F.s.mats[0].clone(), F.s.mats[1].clone()]); m.scale.setScalar(0.5); bird.add(m); m.position.set(0, -0.15, 0.1); return m; })(); }
            if (F.k >= 1) { if (F.held) bird.remove(F.held); M.fly = null; bird.visible = false; }
          }
        }
        for (let i = breads.length - 1; i >= 0; i--) { const q = breads[i]; q.life += dt * 2.5; const k = Math.min(1, q.life); q.b.position.lerpVectors(q.from, q.to, k); q.b.position.y += Math.sin(k * Math.PI) * 0.4; if (q.life > 6) { scene.remove(q.b); breads.splice(i, 1); } }
        for (let i = puffs.length - 1; i >= 0; i--) { const q = puffs[i]; q.life += dt; q.s.position.y += q.v * dt; q.s.scale.multiplyScalar(1 + dt * 0.9); q.s.material.opacity *= 1 - dt * 0.9; if (q.life > q.max) { scene.remove(q.s); q.s.material.dispose(); puffs.splice(i, 1); } }
        for (let i = pops.length - 1; i >= 0; i--) { const q = pops[i]; q.life += dt; q.sp.position.y += dt * 0.8; q.sp.material.opacity = Math.min(1, 2.4 - q.life * 2); if (q.life > 1.2) { scene.remove(q.sp); pops.splice(i, 1); } }
      },
      input(p, m) {
        const C = cooks.find((x) => x.p === p); if (!C) return;
        if (m.b === 'serve') serve(C);
        else if (/^s[1-4]$/.test(m.b)) flip(C, Number(m.b[1]) - 1);
      },
      scores() { return Object.fromEntries(cooks.map((C) => [C.p.id, C.score])); },
    };
  },
};
