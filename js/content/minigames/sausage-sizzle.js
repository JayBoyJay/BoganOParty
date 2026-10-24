// Sausage Sizzle: the hardware store snag sizzle, and everyone's on the barbie with a line of Under 12s
// footy kids (and their dads) out the front. Four snags each on the hotplate; only the side touching the
// plate cooks, so flip each one at the right time. Every customer wants theirs a certain way: just done,
// golden, well done, or cremated for the dads. SERVE hands over whichever snag is closest to what they
// asked for. Nail it for 3 (plus a tip if they weren't kept waiting); leave them too long and they walk
// off. Fat flare-ups cook a snag three times as fast, the magpie nicks one now and then, and the last
// 25 seconds are the lunch rush: shorter tempers, double points.
import { addSky } from '../../host/sky.js';

const N_SNAGS = 4;
const SEC = 1.7; // each player's bit of the hotplate
const HEAT = 0.2; // cook per second on the down side; 1.0 is golden
const CHAR = 1.95, READY = 0.6; // charcoal; and under this on either side it's still raw and stays on
// what the customers ask for: both sides inside the band is a match, within CLOSE of it is near enough
const WANTS = [
  { id: 'light', say: 'Just done', band: [0.7, 1.0] },
  { id: 'golden', say: 'Golden', band: [0.95, 1.25] },
  { id: 'well', say: 'Well done', band: [1.2, 1.5] },
  { id: 'crem', say: 'Cremated!', band: [1.5, 1.88] },
];
const CLOSE = 0.18, PATIENCE = 15, RUSH_PATIENCE = 10, RUSH_T = 25, FLARE_T = 2.4;
const SNAG_L = 0.95, SNAG_R = 0.075;
const DOLL = 0.7;

// raw pink → golden → dark → charcoal
const STOPS = [[0, 0xe89a8e], [0.45, 0xd8925a], [0.8, 0xb8682e], [1.05, 0x8e4a1e], [1.35, 0x4a2410], [1.8, 0x141010]];
const cookCol = (c, out) => { for (let i = 1; i < STOPS.length; i++) if (c <= STOPS[i][0] || i === STOPS.length - 1) { const [a, ca] = STOPS[i - 1], [b, cb] = STOPS[i]; return out.setHex(ca).lerp(new out.constructor(cb), Math.max(0, Math.min(1, (c - a) / (b - a)))); } return out; };

export default {
  id: 'sausage-sizzle',
  name: 'Sausage Sizzle',
  blurb: 'A line of hungry footy kids, four snags each on the barbie. Cook every one the way they asked.',
  howTo: 'Only the side touching the hotplate cooks. Tap a snag number to flip it. Your customer\'s bubble shows how they want it (just done, golden, well done, or cremated) and the colour to aim for. SERVE gives them your snag that is closest. Spot on is 3 points, plus 1 if they weren\'t kept waiting; near enough is 1. Keep them waiting too long and they walk off (-1). Flare-ups cook fast, charcoal loses a point, and the last 25 seconds are the lunch rush: double points.',
  padText: 'Flip 1-4. SERVE when it looks right',
  duration: 80,
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
    // fat flare-ups: a bright sprite of flame, pushed over the bloom threshold so it glows
    const flameMat = (() => {
      const c = document.createElement('canvas'); c.width = 64; c.height = 96; const g = c.getContext('2d');
      const gr = g.createRadialGradient(32, 70, 2, 32, 60, 40); gr.addColorStop(0, 'rgba(255,250,200,1)'); gr.addColorStop(0.35, 'rgba(255,170,40,0.95)'); gr.addColorStop(0.7, 'rgba(230,60,10,0.6)'); gr.addColorStop(1, 'rgba(200,30,0,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(32, 2); g.quadraticCurveTo(64, 60, 32, 94); g.quadraticCurveTo(0, 60, 32, 2); g.fill();
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }); m.color.setScalar(3.2); return m;
    })();
    // the customers' orders: everyone's line asks for the same things in the same order
    const orders = [];
    const order = (k) => {
      while (orders.length <= k) {
        const i = orders.length, w = i < 2 ? WANTS[1] : WANTS[(rng() * WANTS.length) | 0];
        orders.push({ want: w, count: i > 3 && rng() < 0.3 ? 2 : 1, dad: w.id === 'crem' || rng() < 0.2 });
      }
      return orders[k];
    };
    const KIDS = ['#ffd23f', '#3da5ff', '#5cff9d', '#ff8a3d', '#c8a0ff', '#ff5a8a'];

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
        const flame = new THREE.Sprite(flameMat.clone()); flame.visible = false; flame.renderOrder = 11; scene.add(flame);
        snags.push({ k, mesh, mats, z, x: x0 + 0.1, cook: [0, 0], down: 1, rot: 0, rotTo: 0, gone: 0, smokeT: rng() * 0.3, heat: 0.92 + rng() * 0.16, flare: 0, flame });
      }
      // the customer: a little footy kid (or a dad, for the cremated ones) at the front of the table
      const kid = { face: '#fff', dad: false, k: -1, wait: 0, max: PATIENCE, walk: 0, leaving: 0, bubble: null, ctx: null, tex: null, drawn: '' };
      const c = document.createElement('canvas'); c.width = 300; c.height = 170;
      kid.ctx = c.getContext('2d'); kid.tex = new THREE.CanvasTexture(c); kid.tex.colorSpace = THREE.SRGBColorSpace;
      kid.bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: kid.tex, depthTest: false, transparent: true })); kid.bubble.scale.set(Math.min(1.5, SEC * 0.9), Math.min(1.5, SEC * 0.9) * 170 / 300, 1); kid.bubble.renderOrder = 15; scene.add(kid.bubble);
      return { p, x0, doll, tongs, snags, kid, score: 0, served: 0, armT: 0, streak: 0,
        bot: p.bot ? { lag: 0, slop: 0.04 + rng() * 0.1, react: 0.2 + rng() * 0.35 } : null };
    });
    const resetSnag = (s, delay = 0.7) => { s.cook = [0, 0]; s.down = 1; s.rot = s.rotTo = 0; s.gone = delay; s.mesh.visible = delay <= 0; s.bot = null; s.flare = 0; if (s.flame) s.flame.visible = false; };

    const flip = (C, k) => {
      const s = C.snags[k]; if (!s || s.gone > 0 || Math.abs(s.rot - s.rotTo) > 0.3) return;
      s.down = 1 - s.down; s.rotTo += Math.PI;
      C.armT = 0.25; sfx.play('squeak');
    };
    const bandMiss = (c, [lo, hi]) => (c < lo ? lo - c : c > hi ? c - hi : 0);
    const miss = (s, w) => Math.max(bandMiss(s.cook[0], w.band), bandMiss(s.cook[1], w.band));
    const rush = () => mg.timeLeft() <= RUSH_T;
    // a new customer walks up to the table
    const nextKid = (C) => {
      const K = C.kid; K.k += 1; const o = order(K.k);
      K.face = KIDS[K.k % KIDS.length]; K.dad = o.dad;
      K.wait = 0; K.max = rush() ? RUSH_PATIENCE : PATIENCE; K.walk = 1; K.leaving = 0; K.drawn = '';
    };
    const drawBubble = (C) => {
      const K = C.kid, o = order(K.k), left = Math.max(0, 1 - K.wait / K.max), key = `${K.k}:${Math.ceil(left * 20)}`;
      if (key === K.drawn) return; K.drawn = key;
      const g = K.ctx; g.clearRect(0, 0, 300, 170);
      g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.roundRect(4, 4, 292, 140, 26); g.fill();
      g.beginPath(); g.moveTo(130, 142); g.lineTo(150, 168); g.lineTo(170, 142); g.fill();
      g.lineWidth = 6; g.strokeStyle = C.p.color; g.beginPath(); g.roundRect(4, 4, 292, 140, 26); g.stroke();
      // the colour to aim for: a little snag drawn in it
      const col = cookCol((o.want.band[0] + o.want.band[1]) / 2, new THREE.Color());
      g.fillStyle = '#' + col.getHexString(); g.beginPath(); g.roundRect(18, 26, 84, 34, 17); g.fill();
      if (o.count > 1) { g.beginPath(); g.roundRect(18, 66, 84, 34, 17); g.fill(); }
      // who's asking: a little round face (a mo and a cap for the dads)
      g.fillStyle = '#f2c8a8'; g.beginPath(); g.arc(258, 40, 22, 0, 7); g.fill();
      g.fillStyle = K.face; g.beginPath(); g.arc(258, 34, 23, Math.PI, 0); g.fill(); g.fillRect(258, 28, 30, 6);
      g.fillStyle = '#1a1a1a'; g.beginPath(); g.arc(250, 42, 3, 0, 7); g.arc(266, 42, 3, 0, 7); g.fill();
      if (K.dad) { g.fillStyle = '#5a3a20'; g.fillRect(247, 50, 22, 5); }
      g.fillStyle = '#1a1a1a'; g.font = '900 40px system-ui'; g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillText(o.want.say, 112, 46, 118);
      g.font = '800 28px system-ui'; g.fillStyle = '#555'; g.fillText(o.count > 1 ? 'Two, ta' : o.dad ? 'Cheers mate' : 'Please!', 114, 86, 176);
      g.fillStyle = '#ddd'; g.fillRect(18, 114, 264, 16);
      g.fillStyle = left > 0.5 ? '#3ac85a' : left > 0.25 ? '#f0b020' : '#e83a2a'; g.fillRect(18, 114, 264 * left, 16);
      K.tex.needsUpdate = true;
    };
    const breads = [];
    const handOver = (C, s, good) => {
      const b = new THREE.Group(); const sl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.3), breadM); b.add(sl);
      const sn = new THREE.Mesh(snagGeo, [s.mats[0].clone(), s.mats[1].clone()]); sn.scale.setScalar(0.32); sn.rotation.y = Math.PI / 4; sn.position.y = 0.03; b.add(sn);
      const kp = C.kid.bubble.position;
      b.position.set(s.x, 1.0, s.z); scene.add(b); breads.push({ b, life: 0, from: b.position.clone(), to: kp.clone(), good });
      resetSnag(s);
    };
    const serve = (C) => {
      const K = C.kid; if (K.walk > 0 || K.leaving > 0) return;
      const o = order(K.k), ready = C.snags.filter((s) => s.gone <= 0 && s.cook[0] >= READY && s.cook[1] >= READY);
      if (ready.length < o.count) { pop(C.x0, 2.0, 0.3, ready.length ? 'NEED TWO' : 'NOT READY', '#ffffff', 0.6); return; }
      ready.sort((a, b) => miss(a, o.want) - miss(b, o.want));
      let pts = 0, worst = 0;
      for (const s of ready.slice(0, o.count)) { const m = miss(s, o.want); worst = Math.max(worst, m); pts += m === 0 ? 3 : m <= CLOSE ? 1 : 0; handOver(C, s, m <= CLOSE); }
      const quick = K.wait < K.max * 0.5 && worst === 0 ? 1 : 0;
      pts = (pts + quick) * (rush() ? 2 : 1);
      C.score += pts; C.served += 1; C.armT = 0.3;
      C.streak = worst === 0 ? C.streak + 1 : 0;
      const say = worst === 0 ? (quick ? 'BEAUTY! +' : 'SPOT ON +') + pts : worst <= CLOSE ? `NEAR ENOUGH +${pts}` : 'NOT WHAT I ASKED';
      pop(C.x0, 2.3, 0.3, say, worst === 0 ? '#5cff9d' : worst <= CLOSE ? '#ffd23f' : '#ff8a8a', 0.8);
      if (C.streak >= 3 && C.streak % 3 === 0) pop(C.x0, 2.85, 0.3, `ON A ROLL x${C.streak}`, C.p.color, 0.7);
      sfx.play(pts > 0 ? 'coin' : 'lose');
      K.leaving = 1;
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
    camera.lookAt(0, 1.3, -0.4); // a touch high, so the dockets over the cooks sit in shot with the hotplate

    let tAll = 0, flareT = 5 + rng() * 3, rushSaid = false;
    return {
      camera,
      update(dt, t, running) {
        tAll += dt;
        if (running) {
          // a flare-up under someone's snag every few seconds
          if ((flareT -= dt) <= 0) {
            flareT = 3.5 + rng() * 3.5;
            const C = cooks[(rng() * n) | 0], s = C.snags.filter((q) => q.gone <= 0 && q.flare <= 0)[(rng() * 4) | 0];
            if (s) { s.flare = FLARE_T; pop(s.x, 1.5, s.z, 'FLARE UP!', '#ffb030', 0.6); sfx.play('whoosh'); }
          }
          if (!rushSaid && mg.timeLeft() <= RUSH_T) { rushSaid = true; pop(0, 3.2, 0, 'LUNCH RUSH! x2', '#ffd23f', 1.6); sfx.play('whistle'); }
        }
        for (const C of cooks) {
          if (C.bot && running && C.kid.k >= 0) {
            const B = C.bot; B.lag -= dt;
            if (B.lag <= 0) {
              B.lag = B.react + rng() * 0.3;
              const w = order(C.kid.k).want, mid = (w.band[0] + w.band[1]) / 2;
              const live = C.snags.filter((s) => s.gone <= 0);
              const hits = live.filter((s) => miss(s, w) <= B.slop * 0.5 && s.cook[0] >= READY && s.cook[1] >= READY);
              const flipMe = live.find((s) => s.cook[s.down] >= mid + (rng() - 0.5) * B.slop && s.cook[1 - s.down] < mid);
              if (hits.length >= order(C.kid.k).count) serve(C);
              else if (flipMe) flip(C, flipMe.k);
              else if (C.kid.wait > C.kid.max * 0.8 && live.some((s) => s.cook[0] >= READY && s.cook[1] >= READY)) serve(C); // better something than nothing
            }
          }
          for (const s of C.snags) {
            if (s.gone > 0) { s.gone -= dt; if (s.gone <= 0) { s.mesh.visible = true; s.mesh.rotation.x = 0; } continue; }
            if (running) s.cook[s.down] += HEAT * s.heat * dt * (s.flare > 0 ? 3 : 1);
            if (s.flare > 0) {
              s.flare -= dt; s.flame.visible = s.flare > 0;
              s.flame.position.set(s.x + Math.sin(tAll * 23 + s.k) * 0.25, 1.0 + Math.abs(Math.sin(tAll * 17 + s.k)) * 0.08, s.z);
              s.flame.scale.set(0.4 + Math.sin(tAll * 31) * 0.06, 0.55 + Math.sin(tAll * 27 + 1) * 0.1, 1);
            }
            if (s.cook[s.down] >= CHAR) { s.flare = 0; s.flame.visible = false; C.score -= 1; pop(s.x, 1.6, s.z, 'CHARCOAL -1', '#ff5a5a', 0.7); sfx.play('lose'); resetSnag(s, 1); continue; }
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
          // the customer: walk up, wait (and get the sulks), take the snag and wander off
          {
            const K = C.kid;
            if (running && K.k < 0) nextKid(C);
            if (K.k >= 0) {
              if (K.walk > 0) K.walk = Math.max(0, K.walk - dt / 0.8);
              else if (K.leaving > 0) { K.leaving -= dt / 1.1; if (K.leaving <= 0) { nextKid(C); } }
              else if (running) {
                K.wait += dt;
                if (K.wait >= K.max) { C.score -= 1; C.streak = 0; pop(C.x0, 2.3, 0.3, 'STUFF THIS! -1', '#ff5a5a', 0.75); sfx.play('lose'); K.leaving = 1; }
              }
              // the docket drops in over the cook's head, shakes when they're getting cranky, and lifts away when done
              const off = K.walk > 0 ? K.walk * K.walk : K.leaving > 0 ? (1 - K.leaving) ** 2 : 0;
              const cranky = K.walk <= 0 && K.leaving <= 0 && K.wait > K.max * 0.65 ? Math.sin(tAll * 30) * 0.03 : 0;
              K.bubble.position.set(C.x0 + cranky, 1.95 + off * 1.6, -0.7);
              K.bubble.material.opacity = 1 - off;
              drawBubble(C);
            }
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
        for (let i = breads.length - 1; i >= 0; i--) { const q = breads[i]; q.life += dt * 2.5; const k = Math.min(1, q.life); q.b.position.lerpVectors(q.from, q.to, k); q.b.position.y += Math.sin(k * Math.PI) * 0.4; if (q.life > 1.2) { scene.remove(q.b); breads.splice(i, 1); } }
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
