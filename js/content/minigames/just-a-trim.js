// Just a Trim: everyone's got a hedge out the front and a pole trimmer. Walk along your hedge (that
// happens on its own) and slide your phone up and down to set the height of the blade: everything above
// it comes off. Trim the top of the hedge into the shape on the sign (the Opera House, Uluru, a roo...).
// You can't stick it back on, so go easy. Closest to the shape wins.
import { addSky } from '../../host/sky.js';

const HW = 4.6, HD = 0.95; // hedge width and depth
const HMAX = 2.6, BASE = 0.45, TOP = 2.4; // uncut height; the shape spans BASE..TOP
const NC = 116; // columns across each hedge
const PASS = 24; // seconds to walk the length of the hedge
const RATE = 3.2; // how fast the blade can move up and down, m/s
const BLADE = 0.12; // blade width
const DOLL = 0.62;
const SHAPES = [
  { name: 'THE OPERA HOUSE', pts: [[0, 0.14], [0.08, 0.16], [0.12, 0.45], [0.24, 0.88], [0.32, 0.4], [0.42, 0.72], [0.5, 0.32], [0.56, 0.2], [0.62, 0.2], [0.68, 0.6], [0.78, 0.82], [0.86, 0.35], [0.92, 0.16], [1, 0.14]] },
  { name: 'ULURU', pts: [[0, 0.06], [0.08, 0.08], [0.14, 0.42], [0.2, 0.58], [0.35, 0.66], [0.55, 0.69], [0.74, 0.62], [0.84, 0.5], [0.9, 0.1], [1, 0.06]] },
  { name: 'A KANGAROO', pts: [[0, 0.08], [0.14, 0.12], [0.3, 0.3], [0.38, 0.55], [0.48, 0.7], [0.58, 0.66], [0.66, 0.52], [0.72, 0.6], [0.76, 0.86], [0.79, 0.96], [0.81, 0.78], [0.84, 0.9], [0.86, 0.76], [0.92, 0.66], [1, 0.5]] },
  { name: 'THE HARBOUR BRIDGE', pts: [[0, 0.8], [0.08, 0.8], [0.09, 0.3], [0.17, 0.55], [0.32, 0.8], [0.5, 0.9], [0.68, 0.8], [0.83, 0.55], [0.91, 0.3], [0.92, 0.8], [1, 0.8]] },
  { name: 'THE BIG BANANA', pts: [[0, 0.2], [0.15, 0.48], [0.35, 0.66], [0.5, 0.7], [0.65, 0.66], [0.84, 0.5], [0.91, 0.4], [0.95, 0.5], [1, 0.48]] },
];

// a hedge's leaves: a canvas of overlapping little privet leaves
function leafCanvas() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#1f3d16'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 5200; i++) {
    const x = Math.random() * 512, y = Math.random() * 512, l = 5 + Math.random() * 7, a = Math.random() * Math.PI;
    const k = Math.random();
    g.fillStyle = `hsl(${95 + Math.random() * 25}, ${45 + Math.random() * 20}%, ${14 + k * 26}%)`;
    g.beginPath(); g.ellipse(x, y, l, l * 0.5, a, 0, Math.PI * 2); g.fill();
    if (k > 0.75) { g.fillStyle = 'rgba(220,255,180,0.25)'; g.beginPath(); g.ellipse(x - 1, y - 1, l * 0.5, l * 0.2, a, 0, Math.PI * 2); g.fill(); }
  }
  return c;
}

export default {
  id: 'just-a-trim',
  name: 'Just a Trim',
  blurb: 'Pole trimmer, one hedge each, one shape to copy. Closest to the shape wins.',
  howTo: 'You walk along your hedge by yourself. Slide your thumb up and down your phone to raise and lower the trimmer: anything above the blade gets cut off. Trim the top of the hedge to match the dotted line. Cut too low and it does not grow back!',
  padText: 'Slide to set the blade height',
  duration: 34,
  pad: { kind: 'slider', thumb: '✂️', start: 1, hint: 'Top = blade up high (no cut)' },

  create(mg) {
    const { THREE, kit, scene, players, rng, renderer, sfx } = mg;
    const shape = SHAPES[(rng() * SHAPES.length) | 0];
    const target = (u) => {
      const p = shape.pts;
      for (let i = 1; i < p.length; i++) if (u <= p[i][0]) { const k = (u - p[i - 1][0]) / (p[i][0] - p[i - 1][0] || 1); return BASE + (p[i - 1][1] + (p[i][1] - p[i - 1][1]) * k) * (TOP - BASE); }
      return BASE + p[p.length - 1][1] * (TOP - BASE);
    };
    const { sun } = addSky(scene, renderer, { elevation: 40, azimuth: 30, turbidity: 3, sunIntensity: 3.1, sky: 0xd8e8ff, ground: 0x6a6448, hemi: 0.6, env: 0.6, shadowSize: 24, fog: [0xd6e2ea, 60, 160] });
    sun.target.position.set(0, 0, -2);

    const n = players.length, rows = n > 4 ? 2 : 1, perRow = Math.ceil(n / rows);
    const GAP = 1.0, rowW = perRow * HW + (perRow - 1) * GAP;

    // ----- a front yard: lawn, a brick veneer house behind, the hedges along a garden bed -----
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(120, 80), (() => { const m = kit.surf('grass', { unit: 3, tint: 0xbcd08a }).clone(); for (const k of ['map', 'normalMap', 'roughnessMap']) if (m[k]) { m[k] = m[k].clone(); m[k].repeat.set(40, 27); m[k].needsUpdate = true; } return m; })());
    lawn.rotation.x = -Math.PI / 2; lawn.receiveShadow = true; scene.add(lawn);
    const house = kit.group(0, 0, -9 - (rows - 1) * 4);
    kit.box(rowW + 14, 3.2, 8, kit.surf('brick', { unit: 2.5, tint: 0xd8a888 }), 0, 0, -4, house);
    const roof = kit.box(rowW + 15, 0.12, 6, kit.surf('kawara', { unit: 1.4, tint: 0x8a3a2a }), 0, 3.2, -2.2, house); roof.rotation.x = 0.42;
    for (let i = -2; i <= 2; i++) if (i) kit.window(1.8, 1.3, i * (rowW + 10) / 5, 2.4, 0.02, house);
    kit.box(1.1, 2.2, 0.1, 0x5a3a24, 0, 0, 0.03, house);
    // the shape, on a sign painted by someone who means business
    const signC = document.createElement('canvas'); signC.width = 1024; signC.height = 420;
    {
      const g = signC.getContext('2d');
      g.fillStyle = '#f4ead2'; g.fillRect(0, 0, 1024, 420); g.strokeStyle = '#5b1f1a'; g.lineWidth = 16; g.strokeRect(8, 8, 1008, 404);
      g.fillStyle = '#5b1f1a'; g.font = '900 84px Impact, "Arial Black", sans-serif'; g.textAlign = 'center'; g.fillText(`TODAY: ${shape.name}`, 512, 96, 960);
      g.beginPath(); g.moveTo(112, 380);
      for (let i = 0; i <= 200; i++) { const u = i / 200; g.lineTo(112 + u * 800, 380 - (target(u) - 0.25) / (HMAX - 0.25) * 260); }
      g.lineTo(912, 380); g.closePath(); g.fillStyle = '#2f6b26'; g.fill();
    }
    const signT = new THREE.CanvasTexture(signC); signT.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 2.2), new THREE.MeshStandardMaterial({ map: signT, roughness: 0.7 }));
    sign.position.set(0, 5.15, 0.3); house.add(sign);
    kit.box(5.6, 0.12, 0.12, 0x5a3a24, 0, 3.95, 0.25, house);

    const leafTex = new THREE.CanvasTexture(leafCanvas()); leafTex.colorSpace = THREE.SRGBColorSpace; leafTex.wrapS = leafTex.wrapT = THREE.RepeatWrapping;
    const leafM = new THREE.MeshStandardMaterial({ map: leafTex, roughness: 0.9, side: THREE.DoubleSide });
    const cutM = new THREE.MeshStandardMaterial({ map: leafTex, color: 0xc8e0a0, roughness: 0.9 });
    const mulch = kit.surf('redDirt', { unit: 1.5, tint: 0x7a5034 });
    const dotGeo = new THREE.SphereGeometry(0.045, 8, 6), dotM = new THREE.MeshBasicMaterial({ color: 0xffffff });

    // a hedge as one mesh: a front face, a back face and a top, with a column of vertices every slice so
    // the top can be cut down column by column
    const makeHedge = (ox, oy, oz) => {
      const cols = NC + 1, verts = cols * 6; // per column: front-bottom, front-top, back-bottom, back-top, top-front, top-back
      const pos = new Float32Array(verts * 3), uv = new Float32Array(verts * 2), idx = [];
      const h = new Float32Array(cols).fill(HMAX), jit = new Float32Array(cols).map(() => (Math.random() - 0.5) * 0.06);
      const bulge = new Float32Array(cols).map((_, i) => Math.sin(i * 0.7) * 0.02 + (Math.random() - 0.5) * 0.04);
      const write = () => {
        for (let i = 0; i < cols; i++) {
          const x = -HW / 2 + (i / NC) * HW, top = h[i] + jit[i] * (h[i] >= HMAX - 0.01 ? 1 : 0.25), f = HD / 2 + bulge[i], b = -HD / 2 - bulge[i];
          const v = [[x, 0, f], [x, top, f], [x, 0, b], [x, top, b], [x, top, f - 0.02], [x, top + 0.015, b + 0.02]];
          v.forEach((p, k) => { pos.set(p, (i * 6 + k) * 3); });
          const u = (x + ox) / 1.4;
          uv.set([u, 0, u, top / 1.4, -u, 0, -u, top / 1.4, u, 0, u, HD / 1.4], i * 12);
        }
      };
      for (let i = 0; i < NC; i++) {
        const a = i * 6, b = (i + 1) * 6;
        idx.push(a, b, a + 1, b, b + 1, a + 1); // front
        idx.push(a + 2, a + 3, b + 2, b + 2, a + 3, b + 3); // back
        idx.push(a + 4, b + 4, a + 5, b + 4, b + 5, a + 5); // top
      }
      write();
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx);
      geo.addGroup(0, NC * 12, 0); geo.addGroup(NC * 12, NC * 6, 1);
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, [leafM, cutM]); mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.position.set(ox, oy, oz); scene.add(mesh);
      // end caps, which shrink when the end columns get cut
      const caps = [0, NC].map((i) => { const cap = new THREE.Mesh(new THREE.PlaneGeometry(HD, 1), leafM); cap.rotation.y = Math.PI / 2; cap.position.set(ox - HW / 2 + (i / NC) * HW, oy, oz); scene.add(cap); return { cap, i }; });
      const fitCaps = () => { for (const { cap, i } of caps) { cap.scale.y = h[i]; cap.position.y = oy + h[i] / 2; } };
      fitCaps();
      // garden bed of mulch with a sleeper edge
      kit.box(HW + 0.6, 0.08, HD + 0.8, mulch, ox, oy, oz).castShadow = false;
      kit.box(HW + 0.7, 0.16, 0.12, kit.surf('planks', { unit: 1.2, tint: 0x7a5a3a }), ox, oy, oz + HD / 2 + 0.42);
      // the dotted line to follow
      const dots = new THREE.InstancedMesh(dotGeo, dotM, 60);
      for (let i = 0; i < 60; i++) { const u = (i + 0.5) / 60; dots.setMatrixAt(i, new THREE.Matrix4().makeTranslation(ox - HW / 2 + u * HW, oy + target(u), oz + HD / 2 + 0.12)); }
      scene.add(dots);
      return { mesh, geo, h, write: () => { write(); fitCaps(); }, dots };
    };

    // ----- the gardeners -----
    const pops = [];
    const pop = (x, y, z, text, color, size = 1) => {
      const c = document.createElement('canvas'); c.width = 512; c.height = 160;
      const g = c.getContext('2d'); g.font = '900 100px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 14; g.strokeStyle = '#1a0d08'; g.strokeText(text, 256, 84, 500); g.fillStyle = color; g.fillText(text, 256, 84, 500);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); sp.scale.set(3.2 * size, 1 * size, 1); sp.renderOrder = 20;
      sp.position.set(x, y, z); scene.add(sp); pops.push({ sp, life: 0, stay: size > 1.1 });
    };
    const clips = [];
    const clipGeo = new THREE.BoxGeometry(0.06, 0.02, 0.04), clipM = kit.mat(0x4f8a2a, { roughness: 0.9 });
    const poleM = kit.mat(0xc8ccd0, { metalness: 0.8, roughness: 0.3 });
    const gardeners = players.map((p, i) => {
      const row = rows === 2 && i >= perRow ? 1 : 0, k = row ? i - perRow : i, inRow = row ? n - perRow : perRow;
      const w = inRow * HW + (inRow - 1) * GAP;
      const ox = -w / 2 + HW / 2 + k * (HW + GAP), oy = row * 1.3, oz = -row * 4.2;
      if (row) kit.box(HW + GAP, 1.3, 3.6, kit.surf('sandstone', { unit: 1.5 }), ox, 0, oz + 0.6); // the back row is up on a terrace
      const hedge = makeHedge(ox, oy, oz);
      const doll = mg.makeDoll(p, { scale: DOLL });
      const fz = oz + HD / 2 + 1.05;
      doll.group.position.set(ox - HW / 2 - 0.4, oy, fz); scene.add(doll.group);
      // a pole hedge trimmer: a long pole and a toothed blade with an orange motor
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 8), poleM); pole.castShadow = true; scene.add(pole);
      const head = new THREE.Group(); scene.add(head);
      const motor = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.28), kit.mat(0xff7a1a, { roughness: 0.45 })); motor.position.z = 0.16; head.add(motor);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(BLADE * 1.6, 0.03, 0.05), kit.mat(0xd8dde0, { metalness: 0.9, roughness: 0.2 })); blade.rotation.y = 0; head.add(blade);
      for (let t = 0; t < 9; t++) { const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.05, 4), kit.mat(0xd8dde0, { metalness: 0.9 })); tooth.rotation.x = -Math.PI / 2; tooth.position.set(-BLADE * 0.8 + t * BLADE * 0.2, 0, -0.04); head.add(tooth); }
      head.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      return { p, hedge, doll, ox, oy, oz, fz, pole, head, u: -0.06, y: HMAX + 0.3, want: HMAX + 0.3, done: false, shown: false, buzz: 0,
        aimJit: 0, aimT: 0, skill: 0.04 + rng() * 0.08, lagT: 0.1 + rng() * 0.1 };
    });

    const accuracy = (G, upto = 1) => {
      let err = 0, c = 0;
      const last = Math.min(NC, Math.floor(upto * NC));
      for (let i = 0; i <= last; i++) { err += Math.max(0, Math.abs(G.hedge.h[i] - target(i / NC)) - 0.06); c++; } // a few centimetres either way is spot on
      return c ? Math.max(0, 100 * (1 - err / c / 0.6)) : 0;
    };

    const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.3, 300);
    const span = Math.max(rowW + 1.6, 9);
    const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(20)) * 16 / 9);
    const dist = span / 2 / Math.tan(hfov / 2);
    camera.position.set(0, 3.0 + rows * 1.2, dist + 1.2);
    camera.lookAt(0, 1.7 + (rows - 1) * 0.9, -1 - (rows - 1) * 1.6);
    let walking = 0, finishAt = null, tAll = 0;

    return {
      camera,
      update(dt, t, running) {
        tAll += dt;
        if (running) walking += dt;
        let anyCut = false;
        for (const G of gardeners) {
          // walk along the hedge
          if (running && !G.done) { G.u = Math.min(1.04, -0.06 + walking / PASS * 1.1); if (G.u >= 1.04) { G.done = true; } }
          if (G.p.bot && running && !G.done) {
            // CPU: aim a bit ahead along the line, with a wobbly hand and slow reactions
            G.aimT -= dt; if (G.aimT <= 0) { G.aimT = 0.3 + rng() * 0.4; G.aimJit = (rng() * 2 - 1) * G.skill; }
            const ahead = Math.min(1, Math.max(0, G.u + G.lagT * 1.1 / PASS + 0.02));
            const tu = (u) => (u < 0 || u > 1 ? HMAX + 0.3 : target(u));
            G.want = Math.min(tu(ahead), tu(Math.max(0, G.u)) + 0.04) + G.aimJit;
          }
          if (G.done) G.want = HMAX + 0.4;
          const dy = G.want - G.y; G.y += Math.sign(dy) * Math.min(Math.abs(dy), RATE * dt);
          const bx = G.ox - HW / 2 + G.u * HW;
          // cut every column under the blade
          let cut = false;
          const i0 = Math.max(0, Math.floor((G.u * HW - BLADE / 2) / HW * NC)), i1 = Math.min(NC, Math.ceil((G.u * HW + BLADE / 2) / HW * NC));
          for (let i = i0; i <= i1; i++) {
            if (G.y < G.hedge.h[i] - 0.005) {
              const drop = G.hedge.h[i] - Math.max(0.3, G.y);
              G.hedge.h[i] = Math.max(0.3, G.y); cut = true;
              if (drop > 0.02 && clips.length < 260 && rng() < 0.5) {
                const m = new THREE.Mesh(clipGeo, clipM); m.position.set(G.ox - HW / 2 + i / NC * HW, G.oy + G.y + 0.05, G.oz + (rng() - 0.3) * HD); scene.add(m);
                clips.push({ m, vy: rng() * 1.2, vx: (rng() - 0.5) * 0.8, vz: 0.6 + rng() * 1.2, life: 0, spin: rng() * 10, y0: G.oy });
              }
            }
          }
          if (cut) { G.hedge.write(); G.hedge.geo.attributes.position.needsUpdate = true; G.hedge.geo.attributes.uv.needsUpdate = true; G.hedge.geo.computeVertexNormals(); if (!G.p.bot) anyCut = true; }
          G.buzz += dt;
          // the gardener: walks along in front, holds the pole up to the blade
          const walkX = bx - 0.25;
          G.doll.group.position.set(walkX, G.oy + (running && !G.done ? Math.abs(Math.sin(tAll * 7)) * 0.05 : 0), G.fz);
          const hands = new THREE.Vector3(walkX + 0.35, G.oy + 1.5, G.fz - 0.1);
          const bladeP = new THREE.Vector3(bx, G.oy + G.y, G.oz + HD / 2 + 0.05);
          G.head.position.copy(bladeP); G.head.rotation.x = cut ? Math.sin(G.buzz * 60) * 0.03 : 0;
          const mid = hands.clone().add(bladeP).multiplyScalar(0.5), len = hands.distanceTo(bladeP) + 0.6;
          G.pole.position.copy(mid); G.pole.scale.set(1, len, 1);
          G.pole.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), bladeP.clone().sub(hands).normalize());
          G.doll.setArms(Math.max(-0.1, Math.min(1.4, (G.y - 1.2) * 0.7)), 0.2);
          G.doll.update(dt);
          if (G.done && !G.shown && finishAt != null) { G.shown = true; pop(G.ox, G.oy + HMAX + 1.1, G.oz, `${Math.round(accuracy(G))}%`, G.p.color, 1.3); }
        }
        if (anyCut && Math.floor(tAll * 10) !== Math.floor((tAll - dt) * 10)) sfx.play('trim');
        if (finishAt == null && gardeners.every((G) => G.done)) { finishAt = tAll; sfx.play('hallelujah'); }
        for (let i = clips.length - 1; i >= 0; i--) {
          const c = clips[i]; c.life += dt; c.vy -= 6 * dt;
          c.m.position.x += c.vx * dt; c.m.position.z += c.vz * dt; c.m.position.y = Math.max(c.y0 + 0.08, c.m.position.y + c.vy * dt); c.m.rotation.x += c.spin * dt * (c.m.position.y > c.y0 + 0.09 ? 1 : 0);
          if (c.life > 4) { scene.remove(c.m); clips.splice(i, 1); }
        }
        for (let i = pops.length - 1; i >= 0; i--) { const q = pops[i]; q.life += dt; if (q.stay) { q.sp.material.opacity = Math.min(1, q.life * 4); continue; } q.sp.position.y += dt * 1.1; q.sp.material.opacity = Math.min(1, 2.4 - q.life * 2); if (q.life > 1.2) { scene.remove(q.sp); pops.splice(i, 1); } }
      },
      input(p, m) {
        const G = gardeners.find((x) => x.p === p);
        if (G && m.b === 'slide' && Number.isFinite(m.v)) G.want = 0.3 + Math.max(0, Math.min(1, m.v)) * (HMAX + 0.4 - 0.3);
      },
      // how close to the shape, as a percentage, over the bit trimmed so far
      scores() { return Object.fromEntries(gardeners.map((G) => [G.p.id, Math.round(accuracy(G, G.done ? 1 : Math.max(0, G.u)) * 10) / 10])); },
      done: () => finishAt != null && tAll - finishAt > 3,
    };
  },
};
