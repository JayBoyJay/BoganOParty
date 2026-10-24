// Thong Throw: everyone lines up on the back verandah with five thongs and flings them at the wheelie
// bin down the yard. Left and right on the stick aims, up and down sets how hard. The ring on the grass
// shows where it'd land on a still day, but there's a breeze, and it changes. Watch out for Bluey the
// kelpie: she'll snatch a low thong out of the air. In the bin is 3, off the bin is 1.
import { addSky } from '../../host/sky.js';

const THONGS = 5;
const BIN_Z = -11, BIN_R = 0.42, BIN_H = 1.1; // the bin's opening
const ANG = 0.72; // launch angle (radians)
const V0 = 7.5, V1 = 13; // throw speed: stick all the way down to all the way up
const AIM = 0.42; // widest aim either side (radians)
const G = 9.8, CD = 1.5;
const DOLL = 0.62;
const BTN = { THROW: 1 };

export default {
  id: 'thong-throw',
  name: 'Thong Throw',
  blurb: 'Five thongs each, one wheelie bin, a gusty arvo and a kelpie. In the bin is 3 points.',
  howTo: "Push the stick left and right to aim and up and down to throw harder or softer. The ring on the grass shows where it would land with no wind. Check the windsock and allow for it, then hit THROW. In the bin is 3 points, off the side of the bin is 1. The dog will nick any thong that flies low past her.",
  padText: 'Aim with the stick, THROW!',
  duration: 65,
  pad: { kind: 'stick', buttons: [{ bit: BTN.THROW, label: '🩴 THROW', tone: 'go' }] },

  create(mg) {
    const { THREE, kit, scene, players, rng, renderer, sfx } = mg;
    const n = players.length;

    // ----- an Aussie backyard -----
    const { sun } = addSky(scene, renderer, { elevation: 40, azimuth: 20, turbidity: 3, sunIntensity: 3.1, sky: 0xd8e8ff, ground: 0x6a6448, hemi: 0.6, env: 0.6, shadowSize: 26, fog: [0xd6e2ea, 50, 140] });
    sun.target.position.set(0, 0, -6);
    const lawnM = (() => { const m = kit.surf('grass', { unit: 3, tint: 0xb8cc84 }).clone(); for (const k of ['map', 'normalMap', 'roughnessMap']) if (m[k]) { m[k] = m[k].clone(); m[k].repeat.set(20, 20); m[k].needsUpdate = true; } return m; })();
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), lawnM); lawn.rotation.x = -Math.PI / 2; lawn.position.z = -10; lawn.receiveShadow = true; scene.add(lawn);
    // Colorbond fence round the back and sides
    const fenceM = kit.surf('corrugated', { unit: 1.2, tint: 0x5a6a5a, metalness: 0.4 });
    kit.box(30, 1.9, 0.08, fenceM, 0, 0, -19);
    for (const s of [-1, 1]) kit.box(0.08, 1.9, 22, fenceM, s * 13, 0, -8);
    // the verandah they throw from: pavers and a pergola post or two
    kit.box(Math.max(12, n * 1.7 + 3), 0.12, 3, kit.surf('pavers', { unit: 1.2, tint: 0xd8c8b0 }), 0, 0, 1.6);
    // a Hills Hoist, a lemon tree and a shed
    {
      const h = kit.group(-7.5, 0, -9);
      kit.cyl(0.06, 0.06, 2.4, 0x9ea2a4, 0, 0, 0, h, { metalness: 0.8, roughness: 0.3 });
      for (let a = 0; a < 4; a++) { const arm = kit.group(0, 2.3, 0, a * Math.PI / 2 + 0.4, 1, h); kit.rod([0, 0, 0], [2.2, -0.25, 0], 0.03, 0x9ea2a4, arm, { metalness: 0.8 }); }
      for (const [c, x] of [[0xd84040, 1.2], [0x3a6ad8, 1.6], [0xf0f0f0, 1.9]]) kit.box(0.5, 0.7, 0.02, c, x, 1.4, 0.3, h);
    }
    {
      const s = kit.group(8.5, 0, -15.5);
      kit.box(4, 2.3, 3, kit.surf('corrugated', { unit: 1.2, tint: 0xc8ccc8, metalness: 0.5 }), 0, 0, 0, s);
      kit.box(4.3, 0.1, 3.3, kit.surf('corrugated', { unit: 1.2, tint: 0xa8aca8, metalness: 0.5 }), 0, 2.3, 0, s).rotation.x = 0.08;
      kit.box(1.4, 2.0, 0.05, 0x7a7e78, 0, 0, 1.52, s, { metalness: 0.5 });
    }
    {
      const t = kit.group(-9, 0, -16);
      kit.cyl(0.1, 0.14, 1.2, kit.surf('bark', { unit: 1 }), 0, 0, 0, t);
      const leaves = kit.mat(0x3a6a2a, { roughness: 0.8 });
      for (let i = 0; i < 5; i++) kit.ball(0.8 + rng() * 0.3, leaves, (rng() - 0.5) * 1.2, 1.7 + rng() * 0.6, (rng() - 0.5) * 1.2, t);
      for (let i = 0; i < 12; i++) kit.ball(0.07, 0xf0d020, (rng() - 0.5) * 2, 1.4 + rng() * 1.2, (rng() - 0.5) * 2 + 0.6, t);
    }

    // ----- the bin, with its lid flipped open -----
    const bin = kit.group(0, 0, BIN_Z);
    const binM = kit.mat(0x2e3a2e, { roughness: 0.55 });
    const binBody = kit.lathe([[0.001, 0.06], [BIN_R - 0.06, 0.06], [BIN_R + 0.02, BIN_H - 0.05], [BIN_R + 0.06, BIN_H], [BIN_R - 0.02, BIN_H], [BIN_R - 0.07, 0.1], [0.001, 0.1]], binM, bin, { side: THREE.DoubleSide }, 4);
    binBody.rotation.y = Math.PI / 4;
    const lid = kit.box(BIN_R * 2 + 0.15, 0.06, BIN_R * 2 + 0.15, kit.mat(0xc0262d, { roughness: 0.5 }), 0, 0, 0, bin);
    lid.position.set(0, BIN_H - BIN_R - 0.02, -BIN_R - 0.1); lid.rotation.x = Math.PI / 2 + 0.12;
    for (const s of [-1, 1]) { const w = kit.cyl(0.11, 0.11, 0.06, 0x111111, s * (BIN_R - 0.05), 0.04, -BIN_R + 0.05, bin); w.rotation.z = Math.PI / 2; }
    kit.sign('BIN', 0.5, 0.18, 0, 0.7, BIN_R + 0.05, bin, { bg: '#f2c200', fg: '#111' });

    // the windsock (on a pole by the shed) and a wind sign
    const sockPole = kit.group(5, 0, -12);
    kit.cyl(0.04, 0.04, 3.2, 0xd8d8d8, 0, 0, 0, sockPole, { metalness: 0.7 });
    const sock = new THREE.Group(); sock.position.y = 3.1; sockPole.add(sock);
    const sockMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.08, 1.1, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.7, side: THREE.DoubleSide }));
    sockMesh.rotation.z = Math.PI / 2; sockMesh.position.x = 0.55; sockMesh.castShadow = true; sock.add(sockMesh);
    const windC = document.createElement('canvas'); windC.width = 512; windC.height = 160;
    const windT = new THREE.CanvasTexture(windC); windT.colorSpace = THREE.SRGBColorSpace;
    const windSign = new THREE.Sprite(new THREE.SpriteMaterial({ map: windT, depthTest: false, transparent: true })); windSign.scale.set(3.2, 1, 1); windSign.position.set(0, 4.3, BIN_Z); windSign.renderOrder = 18; scene.add(windSign);
    let wx = 0, wz = 0, windT0 = 0;
    const newWind = () => {
      const a = rng() * Math.PI * 2, s = rng() < 0.15 ? 0 : 0.6 + rng() * 2.4; // m/s² of push
      wx = Math.cos(a) * s; wz = Math.sin(a) * s * 0.5;
      const g = windC.getContext('2d'); g.clearRect(0, 0, 512, 160);
      g.fillStyle = 'rgba(20,30,40,0.8)'; g.beginPath(); g.roundRect(6, 6, 500, 148, 30); g.fill();
      g.fillStyle = '#fff'; g.font = '900 64px system-ui, sans-serif'; g.textBaseline = 'middle'; g.textAlign = 'left';
      const kmh = Math.round(Math.hypot(wx, wz) * 6);
      g.fillText(kmh ? `WIND ${kmh} km/h` : 'NO WIND', 30, 82, 340);
      if (kmh) { g.save(); g.translate(430, 80); g.rotate(Math.atan2(-wz, wx)); g.fillStyle = '#ffd23f'; g.beginPath(); g.moveTo(44, 0); g.lineTo(-10, -32); g.lineTo(-10, -12); g.lineTo(-44, -12); g.lineTo(-44, 12); g.lineTo(-10, 12); g.lineTo(-10, 32); g.closePath(); g.fill(); g.restore(); }
      windT.needsUpdate = true;
    };
    newWind();

    // ----- Bluey the kelpie -----
    const dog = new THREE.Group(); scene.add(dog);
    {
      const fur = kit.mat(0x6a3a1e, { roughness: 0.8 }), tan = kit.mat(0xc88a4a, { roughness: 0.8 });
      const body = kit.ball(0.3, fur, 0, 0.55, 0, dog); body.scale.set(0.8, 0.75, 1.6);
      const head = kit.group(0, 0.78, 0.48, 0, 1, dog);
      kit.ball(0.17, fur, 0, 0, 0, head).scale.set(1, 0.95, 1.1);
      kit.ball(0.09, tan, 0, -0.04, 0.17, head).scale.set(1, 0.8, 1.4);
      kit.ball(0.03, 0x111111, 0, -0.01, 0.29, head);
      for (const s of [-1, 1]) { kit.cone(0.06, 0.17, fur, s * 0.09, 0.1, -0.02, head).rotation.z = -s * 0.25; kit.ball(0.025, 0x111111, s * 0.07, 0.04, 0.14, head); }
      dog.userData.legs = [];
      for (const [lx, lz] of [[-0.13, 0.3], [0.13, 0.3], [-0.13, -0.3], [0.13, -0.3]]) { const leg = kit.cyl(0.05, 0.045, 0.42, tan, lx, 0, lz, dog); dog.userData.legs.push(leg); }
      const tail = kit.cyl(0.04, 0.02, 0.4, fur, 0, 0.6, -0.5, dog); tail.rotation.x = -0.9; dog.userData.tail = tail;
      dog.userData.head = head;
    }
    const D = { x: 4, z: -6, tx: 4, tz: -6, carry: null, jump: 0, wait: 0, run: 0 };

    // ----- the throwers -----
    const thongGeo = (() => {
      const s = new THREE.Shape(); // a sole, wider at the toes
      s.moveTo(0, -0.14); s.bezierCurveTo(0.055, -0.14, 0.05, -0.04, 0.045, 0); s.bezierCurveTo(0.07, 0.08, 0.06, 0.14, 0, 0.15); s.bezierCurveTo(-0.06, 0.14, -0.07, 0.08, -0.045, 0); s.bezierCurveTo(-0.05, -0.04, -0.055, -0.14, 0, -0.14);
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.025, bevelEnabled: false }); g.rotateX(-Math.PI / 2); g.scale(1.6, 1, 1.6); return g;
    })();
    const strapM = kit.mat(0x1a1a1a, { roughness: 0.6 });
    const makeThong = (col) => {
      const t = new THREE.Group();
      const sole = new THREE.Mesh(thongGeo, kit.mat(col, { roughness: 0.6 })); sole.castShadow = true; t.add(sole);
      for (const s of [-1, 1]) { const strap = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 6, 12, Math.PI), strapM); strap.position.set(s * 0.035, 0.03, -0.12); strap.rotation.set(0, s * 0.9, 0); t.add(strap); }
      return t;
    };
    const pops = [];
    const pop = (x, y, z, text, color, size = 1) => {
      const c = document.createElement('canvas'); c.width = 512; c.height = 160;
      const g = c.getContext('2d'); g.font = '900 96px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 14; g.strokeStyle = '#1a0d08'; g.strokeText(text, 256, 84, 500); g.fillStyle = color; g.fillText(text, 256, 84, 500);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); sp.scale.set(2.4 * size, 0.75 * size, 1); sp.renderOrder = 20;
      sp.position.set(x, y, z); scene.add(sp); pops.push({ sp, life: 0 });
    };
    const spread = Math.min(1.7, 11 / Math.max(1, n));
    const throwers = players.map((p, i) => {
      const x = (i - (n - 1) / 2) * spread;
      const doll = mg.makeDoll(p, { scale: DOLL });
      doll.group.position.set(x, 0.12, 1.4); doll.group.rotation.y = Math.PI; scene.add(doll.group);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.32, 24), new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0.85, depthWrite: false })); ring.rotation.x = -Math.PI / 2; scene.add(ring);
      const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 6, 4), new THREE.MeshBasicMaterial({ color: p.color }), 14); scene.add(dots);
      const left = Array.from({ length: THONGS }, (_, k) => { const t = makeThong(p.color); t.position.set(x - 0.5 + k * 0.12, 0.14, 2.4); t.rotation.y = 0.2; scene.add(t); return t; });
      return { p, x, doll, ring, dots, left, aim: 0, pow: 0.5, input: { x: 0, y: 0, held: 0 }, cd: 0, score: 0, inBin: 0, armT: 0,
        bot: p.bot ? { wait: 1 + rng() * 2, err: 0.05 + rng() * 0.1, windSense: 0.5 + rng() * 0.45 } : null };
    });
    const flying = [], landed = [];

    // where a throw would land (no wind), for the ring on the grass
    const launch = (T) => { const v = V0 + T.pow * (V1 - V0); return { vx: Math.sin(T.aim) * v * Math.cos(ANG), vy: v * Math.sin(ANG), vz: -Math.cos(T.aim) * v * Math.cos(ANG) }; };
    const sx = 0, sy = 1.6;
    const landing = (T, k = 1) => {
      const { vx, vy, vz } = launch(T);
      const tt = (vy + Math.sqrt(vy * vy + 2 * G * sy)) / G * k;
      return { x: T.x + vx * tt, y: Math.max(0, sy + vy * tt - G * tt * tt / 2), z: 1.2 + vz * tt, t: tt };
    };
    const doThrow = (T) => {
      if (T.cd > 0 || !T.left.length) return;
      const th = T.left.pop(); const { vx, vy, vz } = launch(T);
      th.position.set(T.x, sy, 1.2);
      flying.push({ T, th, x: T.x, y: sy, z: 1.2, vx, vy, vz, spin: (rng() - 0.5) * 18 });
      T.cd = CD; T.armT = 0.3; T.doll.setArms(1.4, 0.5);
      sfx.play('whoosh');
    };
    const land = (f, how) => {
      const T = f.T;
      if (how === 'in') { T.score += 3; T.inBin++; pop(0, 2.4, BIN_Z + 0.6, `${T.p.name} +3`, T.p.color, 1); sfx.play('coin'); scene.remove(f.th); return; }
      if (how === 'rim') { T.score += 1; pop(f.x, 1.8, f.z, '+1 RIM', '#ffffff', 0.7); sfx.play('bonk'); }
      if (how === 'dog') { pop(f.x, 2.0, f.z, 'DOG GOT IT!', '#ffd23f', 0.8); sfx.play('bark'); return; }
      landed.push({ th: f.th, x: f.x, z: f.z });
    };

    const camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.3, 200);
    camera.position.set(0, 6.4, 9.6);
    camera.lookAt(0, 0.2, -6.8);

    let tAll = 0, finishAt = null;
    const v3 = new THREE.Vector3();
    return {
      camera,
      update(dt, t, running) {
        tAll += dt;
        windT0 += dt; if (running && windT0 > 9) { windT0 = 0; newWind(); }
        for (const T of throwers) {
          if (T.bot && running && T.left.length) {
            // CPU: work out the throw for the bin, allow for some of the wind, add a shaky hand
            const B = T.bot;
            const dx = 0 - T.x, dz = BIN_Z - 1.2, d = Math.hypot(dx, dz);
            let aim = Math.atan2(dx, -dz), pow = 0.5;
            for (let it = 0; it < 18; it++) { const L = landing({ x: T.x, aim, pow }); pow += (d - Math.hypot(L.x - T.x, L.z - 1.2)) * 0.06; pow = Math.max(0, Math.min(1, pow)); }
            const tt = landing({ x: T.x, aim, pow }).t;
            const drift = 0.5 * wx * tt * tt * B.windSense, driftZ = 0.5 * wz * tt * tt * B.windSense;
            aim -= drift / d; pow -= -driftZ / d * 0.8;
            T.aim += (Math.max(-AIM, Math.min(AIM, aim + B.err * (rng() - 0.5))) - T.aim) * Math.min(1, dt * 3);
            T.pow += (Math.max(0, Math.min(1, pow + B.err * (rng() - 0.5))) - T.pow) * Math.min(1, dt * 3);
            B.wait -= dt; if (B.wait <= 0 && T.cd <= 0) { doThrow(T); B.wait = 1.8 + rng() * 2.5; }
          } else if (!T.bot) { T.aim = T.input.x * AIM; T.pow = Math.max(0, Math.min(1, 0.5 + T.input.y * 0.5)); }
          T.cd = Math.max(0, T.cd - dt);
          // the aim ring and a dotted arc
          const show = T.left.length > 0 && running;
          T.ring.visible = T.dots.visible = show;
          if (show) {
            const L = landing(T); T.ring.position.set(L.x, 0.03, L.z);
            const m4 = new THREE.Matrix4();
            for (let k = 0; k < 14; k++) { const P = landing(T, (k + 1) / 15); m4.makeTranslation(P.x, P.y, P.z); T.dots.setMatrixAt(k, m4); }
            T.dots.instanceMatrix.needsUpdate = true;
          }
          T.doll.group.rotation.y = Math.PI - T.aim * 0.6;
          if (T.armT > 0) T.armT -= dt; else T.doll.setArms(0.1 + T.pow * 0.5, 0.15);
          T.doll.update(dt);
        }
        // thongs in the air
        for (let i = flying.length - 1; i >= 0; i--) {
          const f = flying[i];
          f.vx += wx * dt; f.vz += wz * dt; f.vy -= G * dt;
          const py = f.y;
          f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt;
          f.th.position.set(f.x, f.y, f.z); f.th.rotation.y += f.spin * dt; f.th.rotation.x = Math.sin(tAll * 7 + i) * 0.4;
          const bd = Math.hypot(f.x, f.z - BIN_Z);
          let how = null;
          if (D.jump <= 0 && !D.carry && f.y < 1.3 && f.y > 0.2 && Math.hypot(f.x - D.x, f.z - D.z) < 0.8) { how = 'dog'; D.jump = 0.5; D.carry = f.th; }
          else if (py >= BIN_H && f.y < BIN_H && bd < BIN_R) how = 'in';
          else if (f.y < BIN_H && f.y > 0 && bd < BIN_R + 0.08) { how = 'rim'; f.vx = (f.x / (bd || 1)) * 2; f.vz = ((f.z - BIN_Z) / (bd || 1)) * 2; f.vy = 1.5; f.rim = true; flying.splice(i, 1); f.T.score += 1; pop(f.x, 1.8, f.z, '+1 RIM', '#ffffff', 0.7); sfx.play('bonk'); f.x += f.vx * 0.15; f.z += f.vz * 0.15; f.th.position.set(f.x, 0.03, f.z); landed.push({ th: f.th, x: f.x, z: f.z }); continue; }
          else if (f.y <= 0.02) { f.y = 0.02; f.th.position.y = 0.02; f.th.rotation.x = 0; how = 'ground'; }
          if (how) { flying.splice(i, 1); land(f, how); }
        }
        // Bluey: trots about, leaps for low thongs, and runs off with one she's caught
        if (D.carry) {
          D.tx = 11; D.tz = -17;
          if (Math.hypot(D.x - D.tx, D.z - D.tz) < 0.6) { scene.remove(D.carry); D.carry = null; D.wait = 1.5; }
        } else if (D.wait > 0) D.wait -= dt;
        else if (Math.hypot(D.x - D.tx, D.z - D.tz) < 0.5) {
          // patrol between the bin and the throwers, now and then grabbing a thong off the grass
          const grab = landed.length && rng() < 0.4 ? landed[(rng() * landed.length) | 0] : null;
          if (grab) { D.tx = grab.x; D.tz = grab.z; D.grab = grab; } else { D.tx = (rng() - 0.5) * 10; D.tz = BIN_Z + 2 + rng() * 6; D.grab = null; }
          D.wait = 0.4 + rng();
        }
        if (D.grab && Math.hypot(D.x - D.grab.x, D.z - D.grab.z) < 0.5) { const k = landed.indexOf(D.grab); if (k >= 0) { landed.splice(k, 1); D.carry = D.grab.th; } D.grab = null; }
        const ddx = D.tx - D.x, ddz = D.tz - D.z, dd = Math.hypot(ddx, ddz), dsp = D.carry ? 6 : 3.4;
        if (dd > 0.05 && D.wait <= 0) { D.x += ddx / dd * Math.min(dd, dsp * dt); D.z += ddz / dd * Math.min(dd, dsp * dt); D.run += dt * 12; dog.rotation.y = Math.atan2(ddx, ddz); }
        D.jump = Math.max(0, D.jump - dt);
        dog.position.set(D.x, Math.sin(Math.max(0, D.jump) / 0.5 * Math.PI) * 0.9, D.z);
        dog.userData.legs.forEach((l, k) => { l.rotation.x = Math.sin(D.run + (k % 2) * Math.PI + (k > 1 ? 1 : 0)) * 0.5; });
        dog.userData.tail.rotation.y = Math.sin(tAll * 12) * 0.5;
        if (D.carry) { dog.userData.head.getWorldPosition(v3); D.carry.position.set(v3.x, v3.y - 0.05, v3.z); D.carry.rotation.set(0, dog.rotation.y + 1.5, 0); }
        // the windsock points with the wind
        const ws = Math.hypot(wx, wz);
        sock.rotation.y = Math.atan2(-wz, wx); sockMesh.rotation.z = Math.PI / 2 + (1 - Math.min(1, ws / 2.4)) * 1.2;
        sockMesh.rotation.y = Math.sin(tAll * 9) * 0.08 * ws;
        for (let i = pops.length - 1; i >= 0; i--) { const q = pops[i]; q.life += dt; q.sp.position.y += dt * 0.9; q.sp.material.opacity = Math.min(1, 2.4 - q.life * 2); if (q.life > 1.2) { scene.remove(q.sp); pops.splice(i, 1); } }
        if (finishAt == null && throwers.every((T) => !T.left.length) && !flying.length) finishAt = tAll;
      },
      input(p, m) {
        const T = throwers.find((x) => x.p === p);
        if (!T || m.b !== 'stick') return;
        const held = Number(m.h) || 0, newly = held & ~T.input.held;
        T.input.x = Math.max(-1, Math.min(1, Number(m.x) || 0)); T.input.y = Math.max(-1, Math.min(1, Number(m.y) || 0)); T.input.held = held;
        if (newly & BTN.THROW) doThrow(T);
      },
      scores() { return Object.fromEntries(throwers.map((T) => [T.p.id, T.score])); },
      done: () => finishAt != null && tAll - finishAt > 2.5,
    };
  },
};
