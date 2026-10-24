// Wheelie Bin Derby: it's bin night on the steepest street in the suburb, so everyone climbs into a
// wheelie bin and lets go. Tilt your phone to steer, KICK for a shove of speed. Dodge the bins out for
// collection, the parked cars and the potholes. Hit the plank ramps for air, and go easy over the
// speed humps. First to the bottom wins. (Yes, you ride it backwards. That's how it's done.)
import { addSky } from '../../host/sky.js';
import { cottage, car as carProp } from '../../host/props.js';

const L = 430; // the length of the hill
const SLOPE = 0.085; // radians
const ROAD = 4.4, PATH = 6.6; // half-widths: kerb, footpath edge
const ACC = 2.5, VTOP = 17, STEER = 5.2, KICK = 2.8, KICK_CD = 3;
const DRAG = ACC / (VTOP * VTOP);
const BIN_R = 0.55, DOLL = 0.5;
const SEG = 16, NSEG = 9;

export default {
  id: 'wheelie-bin-derby',
  name: 'Wheelie Bin Derby',
  blurb: 'Bin night on the steepest street in town. Ride a wheelie bin to the bottom. First one down wins.',
  howTo: 'Tilt your phone like a steering wheel to steer your bin. Tap KICK for a burst of speed (every few seconds). Bins out for collection, parked cars and potholes will wipe you out. Plank ramps send you flying, and speed humps bounce you if you hit them fast. First to the bottom of the hill wins.',
  padText: 'Tilt to steer, KICK for speed',
  duration: 70,
  pad: { kind: 'tilt', buttons: [{ id: 'kick', label: '🦶 KICK', tone: 'go', wide: true }] },

  create(mg) {
    const { THREE, kit, scene, players, rng, renderer, sfx } = mg;
    const n = players.length;

    // ----- the hill: everything sits in a group tipped down the slope -----
    const { sun } = addSky(scene, renderer, { elevation: 22, azimuth: 15, turbidity: 4, sunIntensity: 3, sun: 0xffe2c0, sky: 0xd8e4f4, ground: 0x6b6a52, hemi: 0.6, env: 0.6, shadowSize: 30, fog: [0xd8dce4, 60, 170] });
    const world = new THREE.Group(); world.rotation.x = -SLOPE; scene.add(world);

    const strip = (x0, x1, m, y = 0) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, L + 200), m); p.rotation.x = -Math.PI / 2; p.position.set((x0 + x1) / 2, y, -L / 2 + 20); p.receiveShadow = true; world.add(p); return p; };
    const tiled = (name, unit, w, opts = {}) => { const m = kit.surf(name, { unit, ...opts }).clone(); for (const k of ['map', 'normalMap', 'roughnessMap']) { if (!m[k]) continue; m[k] = m[k].clone(); m[k].repeat.set(w / unit, (L + 200) / unit); m[k].needsUpdate = true; } return m; };
    strip(-ROAD, ROAD, tiled('asphalt', 4, ROAD * 2));
    for (const s of [-1, 1]) {
      const [a, b] = s < 0 ? [-PATH, -ROAD] : [ROAD, PATH];
      strip(a, b, tiled('concrete', 2.2, PATH - ROAD, { tint: 0xd8d2c6 }), 0.06);
      const [c, d] = s < 0 ? [-40, -PATH] : [PATH, 40];
      strip(c, d, tiled('grass', 4, 40 - PATH, { tint: 0xa8c070 }), 0.02);
      kit.box(0.25, 0.15, L + 200, kit.surf('concrete', { unit: 1, tint: 0xbab4a8 }), s * (ROAD + 0.12), 0, -L / 2 + 20, world).castShadow = false;
    }
    const dash = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.14, 3), kit.mat(0xf2f0e6), Math.ceil((L + 200) / 9));
    for (let i = 0; i < dash.count; i++) { const m = new THREE.Matrix4().makeRotationX(-Math.PI / 2); m.setPosition(0, 0.012, 20 - i * 9); dash.setMatrixAt(i, m); }
    world.add(dash);
    // start and finish banners
    const banner = (z, text, bg) => { for (const s of [-1, 1]) kit.box(0.12, 3.6, 0.12, 0x8a8a8a, s * (ROAD + 0.6), 0, z, world, { metalness: 0.7 }); kit.sign(text, ROAD * 2 + 1.2, 0.8, 0, 3.4, z, world, { bg, fg: '#ffffff' }); };
    banner(2, 'BIN NIGHT DERBY', '#1e5aa8');
    banner(-L, 'FINISH', '#c8102e');
    const chk = new THREE.Mesh(new THREE.PlaneGeometry(ROAD * 2, 1.2), new THREE.MeshStandardMaterial({ map: (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 32; const g = c.getContext('2d'); for (let i = 0; i < 32; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? '#111' : '#fff'; g.fillRect(i * 8, j * 8, 8, 8); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })() }));
    chk.rotation.x = -Math.PI / 2; chk.position.set(0, 0.02, -L); world.add(chk);

    // houses either side, recycled down the hill as we go
    const segs = [];
    const houseCols = [0xe8e2d0, 0xd9c7a4, 0xc9d6d0, 0xf0dcc8, 0xd6c1b8];
    const roofCols = [0x9aa3a8, 0x7d2b22, 0x3c4a52, 0x5a3c2c];
    for (let i = 0; i < NSEG; i++) {
      const g = new THREE.Group(); g.position.z = 10 - i * SEG; world.add(g);
      for (const s of [-1, 1]) {
        cottage(kit, s * (PATH + 9), 0, -s * Math.PI / 2, { wall: rng() < 0.5 ? 'brick' : 'weatherboard', color: houseCols[(rng() * houseCols.length) | 0], roof: roofCols[(rng() * roofCols.length) | 0], w: 9, d: 7 }, g);
        kit.box(0.25, 0.85, SEG - 4, kit.surf('brick', { unit: 2.2, tint: 0xe6c9b0 }), s * (PATH + 1.2), 0, -2, g);
      }
      segs.push(g);
    }

    // ----- the obstacles -----
    const obs = [];
    const binBody = (lidCol, parent, bodyCol = 0x2e3a2e) => {
      const b = new THREE.Group();
      kit.box(0.6, 1.0, 0.72, kit.mat(bodyCol, { roughness: 0.55 }), 0, 0, 0, b);
      kit.box(0.66, 0.06, 0.78, lidCol, 0, 1.0, 0, b, { roughness: 0.5 });
      for (const s of [-1, 1]) { const w = kit.cyl(0.11, 0.11, 0.06, 0x111111, s * 0.26, 0.1, 0.3, b); w.rotation.z = Math.PI / 2; }
      parent.add(b); return b;
    };
    const lidCols = [0xc0262d, 0xf2c200, 0x2f8a3a];
    let z = -22;
    while (z > -L + 15) {
      const r = rng();
      if (r < 0.32) {
        // bins out for collection: one or two on a kerb, sometimes rolled into the road
        const x = (rng() < 0.5 ? -1 : 1) * (ROAD - 0.5 - rng() * (rng() < 0.4 ? 3.2 : 0.3));
        const b = binBody(lidCols[(rng() * 3) | 0], world); b.position.set(x, 0, z); b.rotation.y = rng() * 0.6;
        obs.push({ kind: 'bin', x, z, r: 0.45, mesh: b });
      } else if (r < 0.5) {
        const s = rng() < 0.5 ? -1 : 1, x = s * (ROAD - 1.1);
        carProp(kit, x, z, s * Math.PI / 2 + (rng() < 0.5 ? Math.PI : 0), { color: [0xb3261e, 0x2c4f7a, 0xe8e4dc, 0x2a2a2a, 0x6a7a3a][(rng() * 5) | 0], style: rng() < 0.4 ? 'ute' : 'sedan' }, world);
        obs.push({ kind: 'car', x, z, hw: 1.0, hd: 2.4 });
      } else if (r < 0.64) {
        const m = kit.box(ROAD * 2, 0.14, 0.9, kit.mat(0xf2c200, { roughness: 0.6 }), 0, 0, z, world); m.castShadow = false;
        for (let k = -3; k <= 3; k++) kit.box(0.5, 0.15, 0.92, 0x1a1a1a, k * 1.2, 0, z, world).castShadow = false;
        obs.push({ kind: 'hump', z });
      } else if (r < 0.8) {
        const x = (rng() - 0.5) * (ROAD * 2 - 3);
        const ramp = new THREE.Group(); ramp.position.set(x, 0, z); world.add(ramp);
        const plank = kit.box(1.8, 0.06, 2.6, kit.surf('planks', { unit: 1.2, tint: 0xb08858 }), 0, 0, 0, ramp); plank.rotation.x = 0.26; plank.position.y = 0.36;
        kit.box(1.6, 0.6, 0.4, 0xa86a2a, 0, 0, -1.1, ramp); // a milk crate under it
        obs.push({ kind: 'ramp', x, z, hw: 0.9 });
      } else {
        const x = (rng() - 0.5) * (ROAD * 2 - 1.5);
        const h = new THREE.Mesh(new THREE.CircleGeometry(0.65, 18), kit.mat(0x1c1c1e, { roughness: 1 })); h.rotation.x = -Math.PI / 2; h.position.set(x, 0.015, z); h.scale.set(1.2, 0.8, 1); world.add(h);
        obs.push({ kind: 'hole', x, z, r: 0.7 });
      }
      z -= 7 + rng() * 9;
    }

    // ----- the riders: a bin each, tipped back on its wheels, a doll riding in it backwards -----
    const pops = [];
    const pop = (pos, text, color, size = 1) => {
      const c = document.createElement('canvas'); c.width = 512; c.height = 160;
      const g = c.getContext('2d'); g.font = '900 92px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 14; g.strokeStyle = '#1a0d08'; g.strokeText(text, 256, 84, 500); g.fillStyle = color; g.fillText(text, 256, 84, 500);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); sp.scale.set(3 * size, 0.95 * size, 1); sp.renderOrder = 20;
      sp.position.copy(pos); scene.add(sp); pops.push({ sp, life: 0 });
    };
    const lane = (i) => (i - (n - 1) / 2) * Math.min(1.1, (ROAD * 2 - 1.5) / Math.max(1, n));
    const riders = players.map((p, i) => {
      const root = new THREE.Group(); root.scale.setScalar(1.35); world.add(root);
      const tip = new THREE.Group(); root.add(tip); // tips back onto the wheels
      const b = binBody(0x2e3a2e, tip, new THREE.Color(p.color).getHex()); // painted in their colour, of course b.position.z = -0.3; b.rotation.y = Math.PI;
      b.children[1].position.set(0, 1.25, 0.45); b.children[1].rotation.x = -1.2; // lid flipped open
      const doll = mg.makeDoll(p, { scale: DOLL });
      doll.group.position.set(0, 0.45, -0.3); tip.add(doll.group);
      return { p, root, tip, doll, x: lane(i), z: 0.5, v: 0, vx: 0, y: 0, vy: 0, want: 0, kickCd: 0, crash: 0, spin: 0, done: false, place: 0, finishT: 0, input: 0,
        bot: p.bot ? { look: 14 + rng() * 6, err: 0.3 + rng() * 0.5, lane: 0, re: 0, kickNerve: 0.3 + rng() * 0.6 } : null };
    });
    let placeN = 0;

    const hitTest = (R) => {
      if (R.y > 0.3) return null;
      for (const o of obs) {
        if (Math.abs(o.z - R.z) > 3) continue;
        if (o.kind === 'bin' || o.kind === 'hole') { if (Math.hypot(o.x - R.x, o.z - R.z) < o.r + BIN_R) return o; }
        else if (o.kind === 'car') { if (Math.abs(o.x - R.x) < o.hw + BIN_R && Math.abs(o.z - R.z) < o.hd + BIN_R) return o; }
        else if (o.kind === 'hump') { if (Math.abs(o.z - R.z) < 0.5) return o; }
        else if (o.kind === 'ramp') { if (Math.abs(o.x - R.x) < o.hw && Math.abs(o.z - R.z) < 1.1) return o; }
      }
      return null;
    };
    const wpos = new THREE.Vector3();

    // CPU: look down the hill for the clearest line, nudge toward it, kick when it's clear
    const botSteer = (R, dt) => {
      const B = R.bot; B.re -= dt;
      if (B.re <= 0) {
        B.re = 0.25 + rng() * 0.2;
        let best = R.x, bestS = -1e9;
        for (let x = -ROAD + 0.6; x <= ROAD - 0.6; x += 0.4) {
          let s = -Math.abs(x - R.x) * 0.6;
          for (const o of obs) {
            const ahead = R.z - o.z; if (ahead < 0 || ahead > B.look) continue;
            const w = 1 - ahead / (B.look + 4);
            if (o.kind === 'bin' || o.kind === 'hole') { if (Math.abs(o.x - x) < o.r + BIN_R + 0.35) s -= 30 * w; }
            else if (o.kind === 'car') { if (Math.abs(o.x - x) < o.hw + BIN_R + 0.35) s -= 40 * w; }
            else if (o.kind === 'ramp') { if (Math.abs(o.x - x) < o.hw - 0.2) s += 8 * w; }
          }
          for (const q of riders) if (q !== R && Math.abs(q.z - R.z) < 2.5 && Math.abs(q.x - x) < 0.9) s -= 5;
          if (s > bestS) { bestS = s; best = x; }
        }
        B.lane = best + (rng() - 0.5) * B.err;
      }
      const hump = obs.some((o) => o.kind === 'hump' && R.z - o.z > 0 && R.z - o.z < 8);
      if (R.kickCd <= 0 && !hump && rng() < dt * B.kickNerve * 2) kick(R);
      return Math.max(-1, Math.min(1, (B.lane - R.x) * 0.9));
    };
    const kick = (R) => { if (R.kickCd > 0 || R.crash > 0 || R.done || R.y > 0.05) return; R.v += KICK; R.kickCd = KICK_CD; R.doll.setArms(1.2, 0.4); R.kickT = 0.3; sfx.play('whoosh'); };

    const camera = new THREE.PerspectiveCamera(48, 16 / 9, 0.3, 300);
    let camZ = 0, tAll = 0, finishAt = null, run = 0;
    const camPos = new THREE.Vector3(), camAt = new THREE.Vector3();

    return {
      camera,
      update(dt, t, running) {
        tAll += dt; if (running) run += dt;
        const lead = Math.min(...riders.map((R) => R.z));
        for (const R of riders) {
          if (R.done) { R.v = Math.max(0, R.v - dt * 6); }
          else if (running) {
            const steer = R.bot ? botSteer(R, dt) : R.input;
            // gravity down the hill, drag, and a little help for anyone well behind
            const behind = Math.max(0, R.z - lead);
            R.v += (ACC + Math.min(2.2, behind * 0.06) - DRAG * R.v * R.v) * dt;
            if (R.crash > 0) { R.crash -= dt; R.v *= 1 - dt * 2; R.spin += dt * 12; }
            else { R.vx += (steer * STEER - R.vx) * Math.min(1, dt * 6); R.spin *= 1 - Math.min(1, dt * 8); }
            R.kickCd = Math.max(0, R.kickCd - dt);
          }
          R.z -= R.v * dt; R.x += (R.crash > 0 ? R.vx * 0.3 : R.vx) * dt;
          R.x = Math.max(-ROAD + 0.45, Math.min(ROAD - 0.45, R.x));
          // in the air
          if (R.y > 0 || R.vy > 0) { R.vy -= 14 * dt; R.y += R.vy * dt; if (R.y <= 0) { R.y = 0; R.vy = 0; sfx.play('thud'); } }
          if (!R.done && running && R.crash <= 0) {
            const o = hitTest(R);
            if (o && o !== R.lastHit) {
              R.lastHit = o;
              R.root.getWorldPosition(wpos); wpos.y += 2.4;
              if (o.kind === 'ramp') { R.vy = 4 + R.v * 0.25; R.y = 0.05; R.v += 1.2; pop(wpos, 'AIR!', '#5cff9d', 0.7); sfx.play('boing'); }
              else if (o.kind === 'hump') { if (R.v > 9) { R.vy = 3.2; R.y = 0.05; R.v *= 0.8; pop(wpos, 'BOING', '#ffd23f', 0.6); sfx.play('boing'); } else R.v *= 0.92; }
              else if (o.kind === 'hole') { R.v *= 0.55; R.vy = 1.5; R.y = 0.02; R.doll.flinch(); pop(wpos, 'POTHOLE', '#ffffff', 0.6); sfx.play('bonk'); }
              else { R.v *= 0.25; R.crash = 1.1; R.doll.flinch(); pop(wpos, 'STACKED IT!', '#ff5a5a', 0.75); sfx.play('bonk'); if (o.kind === 'bin' && o.mesh) { o.mesh.rotation.z = (R.x > o.x ? -1 : 1) * 1.3; o.mesh.position.y = 0.3; o.kind = 'down'; } R.x += Math.sign(R.x - (o.x || 0) || 1) * 0.6; }
            }
            if (!o) R.lastHit = null;
          }
          if (!R.done && R.z <= -L) { R.done = true; R.place = ++placeN; R.finishT = run; R.root.getWorldPosition(wpos); wpos.y += 2.6; pop(wpos, R.place === 1 ? '1ST!' : `${R.place}${['', 'ST', 'ND', 'RD'][R.place] || 'TH'}`, R.p.color, 1); sfx.play(R.place === 1 ? 'hallelujah' : 'coin'); }
          // drawing: the bin rocks back on its wheels and wobbles with speed
          R.root.position.set(R.x, R.y, R.z);
          R.root.rotation.y = R.spin + R.vx * -0.05;
          R.tip.rotation.x = -0.42 + Math.sin(tAll * 18 + R.x) * 0.02 * Math.min(1, R.v / 8) + (R.y > 0 ? -0.2 : 0);
          R.tip.rotation.z = R.vx * 0.04;
          if (R.kickT > 0) R.kickT -= dt; else R.doll.setArms(0.9 + Math.sin(tAll * 7 + R.x) * 0.15, 0.2);
          R.doll.update(dt);
        }
        // bumping each other
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
          const a = riders[i], b = riders[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
          if (d > 0.001 && d < BIN_R * 2) { const k = (BIN_R * 2 - d) / 2; a.x -= dx / d * k; b.x += dx / d * k; a.z -= dz / d * k * 0.5; b.z += dz / d * k * 0.5; const vx = a.vx; a.vx = b.vx * 0.8; b.vx = vx * 0.8; }
        }
        // camera: behind the pack, uphill, looking down the street, framing leader and stragglers
        const zs = riders.filter((R) => !R.done || R.z > -L - 30).map((R) => R.z);
        const front = Math.min(...zs), back = Math.max(...zs);
        const target = Math.max(-L - 4, Math.min(front + 5, back * 0.3 + front * 0.7));
        camZ += (target - camZ) * Math.min(1, dt * 3);
        const spread = Math.min(18, back - front);
        camPos.set(0, 3.8 + spread * 0.16, camZ + 7.5 + spread * 0.45); camAt.set(0, 0.6, camZ - 9);
        world.localToWorld(camPos); world.localToWorld(camAt);
        camera.position.copy(camPos); camera.lookAt(camAt);
        sun.position.set(camPos.x + 20, camPos.y + 40, camPos.z + 10); sun.target.position.copy(camAt); sun.target.updateMatrixWorld();
        for (const g of segs) while (g.position.z > camZ + 30) g.position.z -= SEG * NSEG;
        for (let i = pops.length - 1; i >= 0; i--) { const q = pops[i]; q.life += dt; q.sp.position.y += dt * 1.2; q.sp.material.opacity = Math.min(1, 2.4 - q.life * 2); if (q.life > 1.2) { scene.remove(q.sp); pops.splice(i, 1); } }
        if (finishAt == null && riders.every((R) => R.done)) finishAt = tAll;
      },
      input(p, m) {
        const R = riders.find((x) => x.p === p); if (!R) return;
        if (m.b === 'tilt' && Number.isFinite(m.v)) R.input = Math.max(-1, Math.min(1, m.v / 30));
        if (m.b === 'kick') kick(R);
      },
      // finishers by place; anyone still rolling by how far down the hill they got
      scores() { return Object.fromEntries(riders.map((R) => [R.p.id, R.done ? 100 - (R.place - 1) * 10 : Math.round(Math.max(0, -R.z) / L * 50)])); },
      done: () => finishAt != null && tAll - finishAt > 3,
    };
  },
};
