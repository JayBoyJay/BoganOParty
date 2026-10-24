// Alan's Farm: twenty sheep in the middle of Alan's paddock and everyone has a little pen on the edge.
// Round up as many as you can into yours before time's up. Sheep shy away from whoever's close, so you
// herd them by getting round behind them. YELL (every 10 s) sends every sheep nearby running away
// from you, which is great for clearing out someone else's pen. Grab a hay bale and hold it up for
// 5 seconds and every sheep around follows you like you're their mum. The sheep in your pen at the end
// are your score.
import { addSky } from '../../host/sky.js';
import { cottage, windmill, waterTank, car as carProp, gumTreeParts, Batch } from '../../host/props.js';
import { mergeGeometries } from '../../../vendor/BufferGeometryUtils.js';

const H = 15; // half the paddock
const P = 6.4, GATE = 2.6; // pen size, gate gap
const SHEEP = 20, SR = 0.42, PR = 0.4; // sheep and player radius
const RUN = 4.6, FLEE_R = 3.4, YELL_R = 7.5, YELL_CD = 10, HAY_R = 6.5, HAY_T = 5;
const DOLL = 0.64;
const BTN = { YELL: 1, HAY: 2 };

export default {
  id: 'alans-farm',
  name: "Alan's Farm",
  blurb: 'Twenty sheep, one paddock, everyone wants them. Round up the most into your pen.',
  howTo: "Drag the stick to run. Sheep move away from you, so get round behind them and walk them into your pen. YELL scares every sheep near you off (once every 10 seconds): try it in someone else's pen. Pick up hay and tap HAY to hold it up for 5 seconds: sheep nearby will follow you.",
  padText: 'Herd them into your pen!',
  duration: 75,
  pad: { kind: 'stick', buttons: [{ bit: BTN.YELL, label: '📣 YELL', tone: 'go' }, { bit: BTN.HAY, label: '🌾 HAY' }] },

  create(mg) {
    const { THREE, kit, scene, players, rng, renderer, sfx } = mg;
    const { sun } = addSky(scene, renderer, { elevation: 52, azimuth: 210, turbidity: 3.5, sunIntensity: 3.2, sky: 0xd8e8ff, ground: 0x7a6a40, hemi: 0.6, env: 0.6, shadowSize: 30, fog: [0xd8dccc, 60, 160] });
    sun.target.position.set(0, 0, 0);

    // ----- the paddock: dry summer grass, a worn patch in the middle, a farm round the outside -----
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), (() => { const m = kit.surf('grass', { unit: 5, tint: 0xd6c98a }).clone(); for (const k of ['map', 'normalMap', 'roughnessMap']) if (m[k]) { m[k] = m[k].clone(); m[k].repeat.set(52, 52); m[k].needsUpdate = true; } return m; })());
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    const dirt = new THREE.Mesh(new THREE.CircleGeometry(5.5, 40), kit.surf('redDirt', { unit: 4, tint: 0xc9a27a }));
    dirt.rotation.x = -Math.PI / 2; dirt.position.y = 0.01; dirt.receiveShadow = true; scene.add(dirt);

    // fences: treated pine posts and plain wire. Every fence is also a wall for the physics.
    const walls = [];
    const postM = kit.surf('planks', { unit: 1.2, tint: 0x9a8264 }), wireM = kit.mat(0xb8bcc0, { metalness: 0.8, roughness: 0.35 });
    const fence = (ax, az, bx, bz, { rail = null, posts = 2 } = {}) => {
      walls.push({ ax, az, bx, bz });
      const len = Math.hypot(bx - ax, bz - az), np = Math.max(1, Math.round(len / posts));
      for (let i = 0; i <= np; i++) { const k = i / np; kit.cyl(0.07, 0.08, 1.15, postM, ax + (bx - ax) * k, 0, az + (bz - az) * k, scene, {}, 8); }
      for (const y of rail ? [0.5, 0.95] : [0.35, 0.65, 0.95]) {
        if (rail) kit.beam([ax, y, az], [bx, y, bz], 0.09, rail, scene, { roughness: 0.7 });
        else kit.rod([ax, y, az], [bx, y, bz], 0.012, wireM);
      }
    };
    // the boundary
    fence(-H, -H, H, -H); fence(H, -H, H, H); fence(H, H, -H, H); fence(-H, H, -H, -H);

    // ----- the pens: on the edges, gates facing the middle -----
    const n = players.length;
    const slots = [];
    const E = H - P / 2 - 0.05;
    // mid-edges first (the front one last, it's nearest the camera), then corners
    const mids = [[0, -E, 0, 1], [-E, 0, 1, 0], [E, 0, -1, 0], [0, E, 0, -1]];
    const corners = [[-E, -E, 0, 1], [E, -E, 0, 1], [-E, E, 0, -1], [E, E, 0, -1]];
    if (n <= 4) slots.push(...[[0, 1, 2, 3], [1, 2], [0, 1, 2], [1, 2, 0, 3]][Math.max(0, n - 1)].map((i) => mids[i]));
    else slots.push(...mids, ...corners);
    if (n === 1) slots[0] = mids[0];
    const pens = players.map((p, i) => {
      const [cx, cz, dx, dz] = slots[i];
      const col = new THREE.Color(p.color);
      // local frame: d points into the paddock, s along the gate side
      const sx = dz, sz = -dx, h = P / 2;
      const pt = (u, v) => [cx + sx * u + dx * v, cz + sz * u + dz * v];
      const railM = kit.mat(col.clone().lerp(new THREE.Color(0xffffff), 0.2).getHex(), { roughness: 0.6 });
      const seg = (a, b) => { const [ax, az] = pt(...a), [bx, bz] = pt(...b); fence(ax, az, bx, bz, { rail: railM, posts: 1.6 }); };
      seg([-h, -h], [h, -h]); seg([-h, -h], [-h, h]); seg([h, -h], [h, h]);
      seg([-h, h], [-GATE / 2, h]); seg([GATE / 2, h], [h, h]);
      for (const u of [-GATE / 2, GATE / 2]) { const [x, z] = pt(u, h); kit.box(0.22, 1.5, 0.22, railM, x, 0, z); }
      // a tinted floor so you can see whose is whose, and their name on the back rail
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(P - 0.2, P - 0.2), new THREE.MeshStandardMaterial({ color: col, transparent: true, opacity: 0.22, roughness: 1, depthWrite: false }));
      floor.rotation.x = -Math.PI / 2; floor.position.set(cx, 0.03, cz); scene.add(floor);
      const [nx, nz] = pt(0, -h - 0.05);
      const sign = kit.sign(p.name.toUpperCase(), 3.2, 0.7, nx, 1.55, nz, scene, { bg: p.color, fg: '#1a0d06', font: '900 120px system-ui, sans-serif' });
      // a water trough in the back corner
      const [tx, tz] = pt(h - 0.8, -h + 0.55);
      const trough = kit.box(1.2, 0.45, 0.5, kit.mat(0x9aa2a8, { metalness: 0.7, roughness: 0.4 }), tx, 0, tz); trough.rotation.y = Math.atan2(sx, sz);
      return { p, cx, cz, dx, dz, sx, sz, gate: pt(0, h + 1.4), inside: (x, z) => { const u = (x - cx) * sx + (z - cz) * sz, v = (x - cx) * dx + (z - cz) * dz; return Math.abs(u) < h - 0.1 && Math.abs(v) < h - 0.1; } };
    });

    // ----- Alan's place, round the outside -----
    cottage(kit, -8, -H - 12, 0, { wall: 'weatherboard', color: 0xeae2cc, roof: 0x7d2b22, w: 11, d: 8 });
    kit.sign("ALAN'S FARM", 6, 1, -8, 6.6, -H - 7.4, scene, { bg: '#f4e2b0', fg: '#5b1f1a', font: '900 150px Georgia, serif' });
    windmill(kit, 10, -H - 9);
    waterTank(kit, 14, -H - 7);
    carProp(kit, H + 5, -6, 0.6, { color: 0xc8c4b8, style: 'ute', metal: false });
    const shed = kit.group(H + 10, 0, 6, -Math.PI / 2);
    kit.box(9, 4, 7, kit.surf('corrugated', { unit: 2, tint: 0x9aa3a8, metalness: 0.5 }), 0, 0, 0, shed);
    kit.box(4, 3.2, 0.1, 0x1a1a1a, 0, 0, 3.55, shed);
    // round hay bales by the shed, and a stack of square ones
    const hayM = kit.mat(0xd9b862, { roughness: 1 });
    for (let i = 0; i < 3; i++) { const b = kit.cyl(0.8, 0.8, 1.4, hayM, H + 4.2, 0.8, 10 + i * 1.8); b.rotation.x = Math.PI / 2; }
    const trees = new Batch(scene);
    for (let i = 0; i < 22; i++) {
      const a = rng() * Math.PI * 2, r = H + 9 + rng() * 22;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (z > H + 2 && Math.abs(x) < 26) continue; // keep the camera's side clear
      if (Math.abs(x + 8) < 9 && z < -H - 4 && z > -H - 20) continue; // and the house
      trees.add('gum' + (i % 3), () => gumTreeParts(i % 3 + 2, 1.1), x, 0, z, 0.9 + rng() * 0.4);
    }
    trees.build();
    // Alan himself, leaning on the ute in his Akubra, supervising
    const alan = mg.makeDoll({ id: 'alan', name: 'Alan', color: '#8a6a3a', body: 'bloke', hair: 0x6a6a6a }, { tag: false, scale: 0.62 });
    alan.group.position.set(H + 3.2, 0, -3.6); alan.group.rotation.y = -0.9; scene.add(alan.group);
    const hat = new THREE.Group(); alan.head.add(hat);
    const hatM = kit.mat(0x6b4a2a, { roughness: 0.85 });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.04, 28), hatM); hat.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.34, 20), hatM); crown.position.y = 0.18; hat.add(crown);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.365, 0.365, 0.07, 20), kit.mat(0x2a1a10)); band.position.y = 0.05; hat.add(band);
    hat.position.y = 0.36; hat.rotation.x = -0.12;

    // ----- sheep -----
    const woolGeo = (() => {
      const parts = [];
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2, g = new THREE.IcosahedronGeometry(0.26 + (i % 3) * 0.03, 1);
        g.translate(Math.cos(a) * 0.17, 0.08 + Math.sin(i * 1.7) * 0.06, Math.sin(a) * 0.3);
        parts.push(g);
      }
      const core = new THREE.SphereGeometry(0.36, 16, 12); core.scale(0.95, 0.85, 1.35); parts.push(core);
      const top = new THREE.IcosahedronGeometry(0.28, 1); top.translate(0, 0.22, 0); parts.push(top);
      return mergeGeometries(parts.map((p) => p.toNonIndexed()));
    })();
    const woolM = new THREE.MeshStandardMaterial({ color: 0xf0e8d6, roughness: 1, flatShading: true });
    const faceM = kit.mat(0x1d1a18, { roughness: 0.7 }), legM = kit.mat(0x22201e, { roughness: 0.8 });
    const sheep = [];
    for (let i = 0; i < SHEEP; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(woolGeo, woolM); body.position.y = 0.56; body.castShadow = true; g.add(body);
      const head = new THREE.Group(); head.position.set(0, 0.72, 0.5); g.add(head);
      const skull = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), faceM); skull.scale.set(0.85, 0.95, 1.4); skull.position.z = 0.08; head.add(skull);
      for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.07), faceM); ear.position.set(s * 0.15, 0.04, 0.02); ear.rotation.z = s * -0.4; head.add(ear); }
      const tuft = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 1), woolM); tuft.position.set(0, 0.12, -0.02); head.add(tuft);
      const legs = [];
      for (const [lx, lz] of [[-0.16, 0.28], [0.16, 0.28], [-0.16, -0.28], [0.16, -0.28]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.42, 6), legM); l.geometry.translate(0, -0.21, 0); l.position.set(lx, 0.44, lz); l.castShadow = true; g.add(l); legs.push(l); }
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * 3.2;
      const s = { g, head, legs, x: Math.cos(a) * r, z: Math.sin(a) * r, vx: 0, vz: 0, yaw: rng() * 6, panic: 0, pdx: 0, pdz: 0, graze: rng() * 4, wx: 0, wz: 0, wt: 0, step: rng() * 6, owner: null, baaT: 2 + rng() * 10 };
      g.position.set(s.x, 0, s.z); g.scale.setScalar(0.95 + rng() * 0.15);
      scene.add(g); sheep.push(s);
    }

    // ----- players -----
    const pops = [];
    const pop = (x, y, z, text, color, size = 1) => {
      const c = document.createElement('canvas'); c.width = 512; c.height = 160;
      const g = c.getContext('2d'); g.font = '900 92px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 14; g.strokeStyle = '#1a0d08'; g.strokeText(text, 256, 84, 500); g.fillStyle = color; g.fillText(text, 256, 84, 500);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); sp.scale.set(3.6 * size, 1.12 * size, 1); sp.renderOrder = 20;
      sp.position.set(x, y, z); scene.add(sp); pops.push({ sp, life: 0 });
    };
    const rings = [];
    const ring = (x, z, color, r0, r1, life) => {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.set(x, 0.06, z); scene.add(m); rings.push({ m, r0, r1, life, t: 0 });
    };
    const baleGeo = new THREE.BoxGeometry(0.9, 0.45, 0.5);
    const makeBale = () => { const b = new THREE.Mesh(baleGeo, kit.mat(0xe0c060, { roughness: 1 })); b.castShadow = true; for (const s of [-0.2, 0.2]) { const tw = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.47, 0.52), kit.mat(0xc23a2a)); tw.position.x = s; b.add(tw); } return b; };
    const herders = players.map((p, i) => {
      const pen = pens[i];
      const doll = mg.makeDoll(p, { scale: DOLL });
      const x = pen.cx + pen.dx * (P / 2 + 1.5), z = pen.cz + pen.dz * (P / 2 + 1.5);
      doll.group.position.set(x, 0, z); scene.add(doll.group);
      const aura = new THREE.Mesh(new THREE.RingGeometry(HAY_R - 0.15, HAY_R, 64), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
      aura.rotation.x = -Math.PI / 2; aura.position.y = 0.05; scene.add(aura);
      const bale = makeBale(); bale.visible = false; bale.position.set(0, 2.1, 0.35); doll.body.add(bale);
      return { p, pen, doll, x, z, vx: 0, vz: 0, input: { x: 0, y: 0, held: 0 }, yellCd: 2, hasHay: false, holding: 0, aura, bale, bob: rng() * 6,
        bot: p.bot ? { target: null, think: 0, keep: 0, mode: 'herd', raid: null, around: rng() < 0.5 ? 1 : -1, slack: 0.8 + rng() * 0.35 } : null };
    });

    // hay to pick up, dropped in random spots
    const hays = [];
    let hayT = 6;
    const dropHay = () => {
      for (let k = 0; k < 20; k++) {
        const x = (rng() * 2 - 1) * (H - P - 1.5), z = (rng() * 2 - 1) * (H - P - 1.5);
        if (Math.hypot(x, z) < 3) continue;
        const b = makeBale(); b.position.set(x, 0.25, z); scene.add(b);
        const glow = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.95, 32), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.8, side: THREE.DoubleSide })); glow.rotation.x = -Math.PI / 2; glow.position.set(x, 0.05, z); scene.add(glow);
        hays.push({ b, glow, x, z }); return;
      }
    };

    // push a circle out of every fence
    const collide = (o, r) => {
      for (const w of walls) {
        const ex = w.bx - w.ax, ez = w.bz - w.az, L2 = ex * ex + ez * ez;
        const k = Math.max(0, Math.min(1, ((o.x - w.ax) * ex + (o.z - w.az) * ez) / L2));
        const px = w.ax + ex * k, pz = w.az + ez * k, dx = o.x - px, dz = o.z - pz, d = Math.hypot(dx, dz);
        if (d < r && d > 1e-6) { o.x = px + (dx / d) * r; o.z = pz + (dz / d) * r; const vn = o.vx * dx / d + o.vz * dz / d; if (vn < 0) { o.vx -= vn * dx / d; o.vz -= vn * dz / d; } }
      }
      o.x = Math.max(-H + r, Math.min(H - r, o.x)); o.z = Math.max(-H + r, Math.min(H - r, o.z));
    };

    const yell = (h) => {
      if (h.yellCd > 0) return;
      h.yellCd = YELL_CD;
      sfx.play('yell');
      ring(h.x, h.z, new THREE.Color(h.p.color).getHex(), 0.5, YELL_R, 0.6);
      pop(h.x, 3.2, h.z, ['GET OUT OF IT!', 'HOO-ROO!', 'OI! SHOO!', 'YAH!'][(rng() * 4) | 0], h.p.color, 0.9);
      for (const s of sheep) {
        const dx = s.x - h.x, dz = s.z - h.z, d = Math.hypot(dx, dz);
        if (d < YELL_R && d > 1e-3) { s.panic = 1.4 + rng() * 0.5; s.pdx = dx / d; s.pdz = dz / d; s.baaT = Math.min(s.baaT, rng() * 0.6); }
      }
      h.doll.bounce(1.1);
    };
    const useHay = (h) => {
      if (!h.hasHay || h.holding > 0) return;
      h.hasHay = false; h.holding = HAY_T; h.bale.visible = true;
      sfx.play('item');
      pop(h.x, 3.2, h.z, 'HAY!', '#ffd23f', 0.8);
    };

    // a few sums the CPUs use
    const inPenOf = (s) => pens.find((pn) => pn.inside(s.x, s.z)) || null;
    const counts = () => { const c = new Map(pens.map((pn) => [pn.p.id, 0])); for (const s of sheep) { const pn = inPenOf(s); if (pn) c.set(pn.p.id, c.get(pn.p.id) + 1); } return c; };
    let score = counts();

    const botThink = (h, dt) => {
      const b = h.bot, pen = h.pen;
      b.think -= dt;
      if (b.think <= 0) {
        b.think = 0.3 + rng() * 0.3;
        const free = sheep.filter((s) => !pen.inside(s.x, s.z));
        // raid: if someone else's pen is fat, go and yell in it
        b.raid = null;
        if (h.yellCd <= 0 && rng() < 0.2) {
          let best = null, bc = 4;
          for (const pn of pens) { if (pn === pen) continue; const c = score.get(pn.p.id); if (c > bc && c >= (score.get(pen.p.id) || 0) - 1) { bc = c; best = pn; } }
          b.raid = best;
        }
        if (h.hasHay && free.filter((s) => Math.hypot(s.x - h.x, s.z - h.z) < HAY_R * 0.7).length >= 3) useHay(h);
        // hay nearby? go get it
        b.hay = !h.hasHay && h.holding <= 0 ? hays.find((y) => Math.hypot(y.x - h.x, y.z - h.z) < 9) : null;
        // otherwise pick the free sheep that's cheapest to bring home: close to us and close to our gate
        b.keep -= 0.45; // roughly the time between thinks
        if (!b.target || pen.inside(b.target.x, b.target.z) || b.keep <= 0) {
          b.keep = 8 + rng() * 6;
          let best = null, bs = 1e9;
          for (const s of free) {
            const c = Math.hypot(s.x - h.x, s.z - h.z) * 0.6 + Math.hypot(s.x - pen.gate[0], s.z - pen.gate[1]) + (inPenOf(s) ? 3 : 0) + rng() * 3;
            if (c < bs) { bs = c; best = s; }
          }
          b.target = best;
        }
      }
      let gx = h.x, gz = h.z;
      if (h.holding > 0) { gx = pen.cx - pen.dx * 1.5; gz = pen.cz - pen.dz * 1.5; if (Math.hypot(h.x - pen.gate[0], h.z - pen.gate[1]) > 2 && !pen.inside(h.x, h.z)) { gx = pen.gate[0]; gz = pen.gate[1]; } }
      else if (b.raid) {
        const pn = b.raid, bx = pn.cx - pn.dx * 2, bz = pn.cz - pn.dz * 2;
        if (!pn.inside(h.x, h.z)) { gx = pn.gate[0] + pn.dx * 0.5; gz = pn.gate[1] + pn.dz * 0.5; if (Math.hypot(h.x - gx, h.z - gz) < 1.2) { gx = bx; gz = bz; } }
        else { gx = bx; gz = bz; if (Math.hypot(h.x - bx, h.z - bz) < 1.3) yell(h); }
      } else if (b.hay) { gx = b.hay.x; gz = b.hay.z; }
      else if (b.target) {
        const s = b.target;
        // where to stand: behind the sheep, on the far side from where it needs to go
        const inGate = Math.hypot(s.x - pen.gate[0], s.z - pen.gate[1]) < 2.2;
        const tx = inGate ? pen.cx : pen.gate[0], tz = inGate ? pen.cz : pen.gate[1];
        let ux = s.x - tx, uz = s.z - tz; const ul = Math.hypot(ux, uz) || 1; ux /= ul; uz /= ul;
        const px = s.x + ux * 2.0 * b.slack, pz = s.z + uz * 2.0 * b.slack;
        // if we're on the wrong side, swing round the sheep rather than through it
        const hx = h.x - s.x, hz = h.z - s.z, hd = Math.hypot(hx, hz) || 1;
        if ((hx * ux + hz * uz) / hd < 0.3 && hd < FLEE_R + 2) {
          const tx2 = -hz / hd * b.around, tz2 = hx / hd * b.around;
          gx = s.x + (hx / hd) * (FLEE_R + 1.2) + tx2 * 3; gz = s.z + (hz / hd) * (FLEE_R + 1.2) + tz2 * 3;
        } else { gx = px - ux * 0.9; gz = pz - uz * 0.9; }
        // never plan to stand inside a pen while herding: step out in front of it instead
        for (const pn of pens) {
          if (!pn.inside(gx, gz)) continue;
          const u = (gx - pn.cx) * pn.sx + (gz - pn.cz) * pn.sz;
          gx = pn.cx + pn.sx * u + pn.dx * (P / 2 + 0.9); gz = pn.cz + pn.sz * u + pn.dz * (P / 2 + 0.9);
        }
      }
      // fences: go in and out of pens through the gate, not through the rails
      for (const pn of pens) {
        const inH = pn.inside(h.x, h.z), inG = pn.inside(gx, gz);
        if (inH === inG) continue;
        const v = (h.x - pn.cx) * pn.dx + (h.z - pn.cz) * pn.dz, u = (h.x - pn.cx) * pn.sx + (h.z - pn.cz) * pn.sz;
        if (inH) {
          if (v < P / 2 - 0.9 || Math.abs(u) > GATE / 2 - 0.4) { gx = pn.cx + pn.dx * (P / 2 - 0.5); gz = pn.cz + pn.dz * (P / 2 - 0.5); } else { gx = pn.gate[0]; gz = pn.gate[1]; }
        } else if (Math.hypot(h.x - pn.gate[0], h.z - pn.gate[1]) > 0.8) { gx = pn.gate[0]; gz = pn.gate[1]; }
        break;
      }
      const dx = gx - h.x, dz = gz - h.z, d = Math.hypot(dx, dz);
      const sp = d > 0.25 ? Math.min(1, d / 1.2) : 0;
      return { x: d > 1e-3 ? (dx / d) * sp : 0, z: d > 1e-3 ? (dz / d) * sp : 0 };
    };

    const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.5, 400);
    camera.position.set(0, 31, 27);
    camera.lookAt(0, 0, 1.5);
    let tAll = 0;

    return {
      camera,
      update(dt, t, running) {
        tAll += dt;
        if (running) { hayT -= dt; if (hayT <= 0) { hayT = 7 + rng() * 5; if (hays.length < 2) dropHay(); } }
        // ----- herders -----
        for (const h of herders) {
          let mx = 0, mz = 0;
          if (running) {
            if (h.bot) { const m = botThink(h, dt); mx = m.x; mz = m.z; }
            else { mx = h.input.x; mz = -h.input.y; }
          }
          const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
          h.vx += (mx * RUN - h.vx) * Math.min(1, dt * 10); h.vz += (mz * RUN - h.vz) * Math.min(1, dt * 10);
          h.x += h.vx * dt; h.z += h.vz * dt;
          collide(h, PR);
          h.yellCd = Math.max(0, h.yellCd - dt);
          if (h.holding > 0) { h.holding -= dt; if (h.holding <= 0) { h.bale.visible = false; } }
          for (let i = hays.length - 1; i >= 0; i--) {
            const y = hays[i];
            if (!h.hasHay && h.holding <= 0 && Math.hypot(y.x - h.x, y.z - h.z) < 0.9) { h.hasHay = true; scene.remove(y.b, y.glow); hays.splice(i, 1); sfx.play('coin'); pop(h.x, 3, h.z, '+ HAY', '#ffd23f', 0.7); }
          }
          const sp = Math.hypot(h.vx, h.vz);
          h.bob += dt * sp * 3.2;
          h.doll.group.position.set(h.x, Math.abs(Math.sin(h.bob)) * 0.12 * Math.min(1, sp), h.z);
          h.doll.group.rotation.y = Math.max(-0.5, Math.min(0.5, h.vx * 0.12));
          h.doll.setArms(h.holding > 0 ? 1.3 : h.yellCd > YELL_CD - 0.6 ? 1.1 : 0.1 + Math.sin(h.bob) * 0.25 * Math.min(1, sp), 0);
          h.doll.update(dt);
          h.aura.position.x = h.x; h.aura.position.z = h.z;
          h.aura.material.opacity += ((h.holding > 0 ? 0.55 + Math.sin(tAll * 8) * 0.2 : 0) - h.aura.material.opacity) * Math.min(1, dt * 8);
        }
        for (let i = 0; i < herders.length; i++) for (let j = i + 1; j < herders.length; j++) {
          const a = herders[i], b = herders[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
          if (d < PR * 2 && d > 1e-4) { const o = (PR * 2 - d) / 2; a.x -= dx / d * o; a.z -= dz / d * o; b.x += dx / d * o; b.z += dz / d * o; }
        }
        // ----- sheep: graze, flock a little, shy away from people, bolt when yelled at, follow hay -----
        for (const s of sheep) {
          let fx = 0, fz = 0, scared = 0, lured = false;
          for (const h of herders) {
            const dx = s.x - h.x, dz = s.z - h.z, d = Math.hypot(dx, dz) || 1e-3;
            if (h.holding > 0 && d < HAY_R) {
              lured = true;
              if (d > 1.5) { fx -= dx / d * 3.2; fz -= dz / d * 3.2; } else { fx += dx / d * 1.2; fz += dz / d * 1.2; }
            } else if (d < FLEE_R) {
              const k = (1 - d / FLEE_R); scared = Math.max(scared, k);
              fx += dx / d * k * 7; fz += dz / d * k * 7;
            }
          }
          for (const o of sheep) {
            if (o === s) continue;
            const dx = s.x - o.x, dz = s.z - o.z, d = Math.hypot(dx, dz);
            if (d < SR * 2.3 && d > 1e-4) { fx += dx / d * (SR * 2.3 - d) * 9; fz += dz / d * (SR * 2.3 - d) * 9; }
            else if (scared > 0.2 && d < 4) { fx -= dx / d * 0.25; fz -= dz / d * 0.25; } // bunch up when spooked
          }
          s.wt -= dt;
          if (s.wt <= 0) { s.wt = 2 + rng() * 4; const a = rng() * Math.PI * 2, w = rng() < 0.5 ? 0 : 0.5; s.wx = Math.cos(a) * w; s.wz = Math.sin(a) * w; }
          // a sheep in a pen settles down near the trough rather than wandering back out
          const home = scared < 0.05 && !lured && s.panic <= 0 ? pens.find((pn) => pn.inside(s.x, s.z)) : null;
          if (home) { fx += (home.cx - home.dx * 1.2 - s.x) * 0.25; fz += (home.cz - home.dz * 1.2 - s.z) * 0.25; } else { fx += s.wx; fz += s.wz; }
          let max = scared > 0 || lured ? 2.9 : 0.7;
          if (s.panic > 0) { s.panic -= dt; fx += s.pdx * 14; fz += s.pdz * 14; max = 5.2; }
          s.vx += (fx - s.vx * 2.2) * dt * 2.2; s.vz += (fz - s.vz * 2.2) * dt * 2.2;
          const v = Math.hypot(s.vx, s.vz); if (v > max) { s.vx *= max / v; s.vz *= max / v; }
          if (!running) { s.vx *= 0.9; s.vz *= 0.9; }
          s.x += s.vx * dt; s.z += s.vz * dt;
          collide(s, SR);
          // the look
          const sp = Math.hypot(s.vx, s.vz);
          if (sp > 0.15) { const want = Math.atan2(s.vx, s.vz); let d = want - s.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); s.yaw += d * Math.min(1, dt * 6); }
          s.step += dt * sp * 7;
          s.legs.forEach((l, k) => { l.rotation.x = Math.sin(s.step + (k === 0 || k === 3 ? 0 : Math.PI)) * Math.min(0.6, sp * 0.4); });
          s.graze += dt;
          s.head.rotation.x = sp < 0.2 ? 0.55 + Math.sin(s.graze * 1.3) * 0.15 : -0.1;
          s.head.position.y = sp < 0.2 ? 0.55 : 0.72;
          s.g.position.set(s.x, Math.abs(Math.sin(s.step)) * (s.panic > 0 ? 0.12 : 0.03), s.z);
          s.g.rotation.y = s.yaw;
          s.baaT -= dt;
          if (s.baaT <= 0) { s.baaT = 6 + rng() * 14; if (running) sfx.play('baa'); }
        }
        score = counts();
        for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; r.t += dt; const k = r.t / r.life; r.m.scale.setScalar(r.r0 + (r.r1 - r.r0) * k); r.m.material.opacity = 0.85 * (1 - k); if (k >= 1) { scene.remove(r.m); rings.splice(i, 1); } }
        for (const y of hays) { y.b.rotation.y += dt; y.glow.material.opacity = 0.5 + Math.sin(tAll * 5) * 0.3; }
        for (let i = pops.length - 1; i >= 0; i--) { const q = pops[i]; q.life += dt; q.sp.position.y += dt * 1.1; q.sp.material.opacity = Math.min(1, 2.4 - q.life * 2); if (q.life > 1.2) { scene.remove(q.sp); pops.splice(i, 1); } }
        alan.setArms(-0.2, Math.sin(tAll * 0.7) * 0.05); alan.update(dt);
      },
      input(p, m) {
        const h = herders.find((x) => x.p === p);
        if (!h || m.b !== 'stick') return;
        const held = Number(m.h) || 0, newly = held & ~h.input.held;
        h.input.x = Math.max(-1, Math.min(1, Number(m.x) || 0)); h.input.y = Math.max(-1, Math.min(1, Number(m.y) || 0)); h.input.held = held;
        if (newly & BTN.YELL) yell(h);
        if (newly & BTN.HAY) useHay(h);
      },
      scores() { return Object.fromEntries(players.map((p) => [p.id, score.get(p.id) || 0])); },
    };
  },
};
