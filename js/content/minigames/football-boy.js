// Football Boy: a backyard Bomberman. The yard is a grid of brick pillars and eskies, everyone starts
// in a corner, and your bomb is an overpumped footy: drop it, it ticks, and after a couple of seconds
// it bursts in a cross that runs along the rows and columns. Bursts smash eskies (some hide gear) and
// set off other footies. Get caught in one and your doll goes down with a pssssht. Gear: 🏉 one more
// footy at a time, 💥 a longer burst, 🩴 thongs to run faster, 👢 a boot, so walking into a footy
// kicks it along till it hits something. The yard shrinks near the end. Last doll standing wins.
import { addSky } from '../../host/sky.js';
import { makeDecor } from '../../host/decor.js';
import { gumTreeParts } from '../../host/props.js';

const BTN = { DROP: 1 };
const W = 15, H = 11; // cells, walls round the outside included
const C = 1.6; // cell size in metres
const FUSE = 2.4, BLAST = 0.5, KICK_SPEED = 7;
const GEAR = { footy: '🏉', fire: '💥', thongs: '🩴', boot: '👢' };
const SHRINK = [{ at: 50, ring: 1 }, { at: 25, ring: 2 }]; // seconds left when each outer ring closes

export default {
  id: 'football-boy',
  name: 'Football Boy',
  blurb: 'Backyard Bomberman. Drop an overpumped footy, run, and let it burst. Last doll standing wins.',
  howTo: "Move with the stick. DROP leaves a footy where you stand: it bursts in a cross after a couple of seconds, so get out of its line. Bursts smash eskies, and some eskies hide gear: 🏉 more footies, 💥 bigger bursts, 🩴 faster thongs, 👢 a boot to kick footies along. The yard closes in near the end. Last one standing wins, and every knockout's worth points.",
  padText: 'Stick to move. DROP for a footy.',
  duration: 120,
  pad: { kind: 'stick', buttons: [{ bit: BTN.DROP, label: '🏉 DROP', tone: 'go' }] },

  create(mg) {
    const { THREE, kit, scene, players, rng, sfx, renderer } = mg;
    const n = players.length;
    const wx = (i) => (i - (W - 1) / 2) * C, wz = (j) => (j - (H - 1) / 2) * C;

    // ----- the yard -----
    addSky(scene, renderer, { elevation: 50, azimuth: 140, turbidity: 3, sunIntensity: 3.2, hemi: 0.75, env: 0.6, shadowSize: 22, fog: [0xc8dcef, 60, 160] });
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), kit.surf('grass', { unit: 3, tint: 0x8fae5c }));
    lawn.rotation.x = -Math.PI / 2; lawn.position.y = -0.02; lawn.receiveShadow = true; scene.add(lawn);
    // the mown playing area, with stripes
    for (let i = 1; i < W - 1; i++) {
      const s = kit.box(C, 0.02, (H - 2) * C, kit.surf('grass', { unit: 2.4, tint: i % 2 ? 0xb4d07a : 0x9cc066 }), wx(i), 0, 0);
      s.receiveShadow = true; s.castShadow = false;
    }
    const brick = kit.surf('brick', { unit: 1.4, tint: 0xd89a7a });
    const cap = kit.surf('concrete', { unit: 0.8, tint: 0xe0cfa8 }); // sandstone
    const D = makeDecor(kit);
    const fence = kit.surf('corrugated', { unit: 0.8, tint: 0x5c6e5a, metalness: 0.4 });

    // cell types: 0 open, 1 wall, 2 pillar, 3 esky
    const grid = Array.from({ length: W }, () => new Array(H).fill(0));
    const eskies = new Map(); // `${i},${j}` -> mesh group
    const hidden = new Map(); // `${i},${j}` -> gear hidden in that esky
    const key = (i, j) => `${i},${j}`;
    for (let i = 0; i < W; i++) for (let j = 0; j < H; j++) {
      if (i === 0 || j === 0 || i === W - 1 || j === H - 1) grid[i][j] = 1;
      else if (i % 2 === 0 && j % 2 === 0) grid[i][j] = 2;
    }
    // over the fence: the back of the house up top, gum trees round the rest
    {
      const wall = kit.surf('brick', { unit: 1.6, tint: 0xc8906a }), top = wz(0) - C * 0.1 - 2.2;
      kit.box(W * C + 8, 3.2, 4, wall, 0, 0, top - 2);
      kit.box(W * C + 9, 0.3, 5, 0x6a6e72, 0, 3.2, top - 1.8); // gutter and eave
      for (const x of [-W * C * 0.3, W * C * 0.3]) { const w = kit.box(2.2, 1.3, 0.1, 0x9ac0d8, x, 1.2, top - 0.02, scene, { roughness: 0.05, metalness: 0.3 }); w.castShadow = false; kit.box(2.4, 0.08, 0.2, 0xf2f2f0, x, 1.15, top + 0.05); }
      kit.box(3.2, 2.4, 0.1, 0x30383e, 0, 0, top - 0.02, scene, { roughness: 0.1, metalness: 0.4 }); // the sliding door
      kit.box(W * C + 8, 0.12, 2.2, kit.surf('pavers', { unit: 1, tint: 0xd8c8b0 }), 0, 0, top + 1.1);
      const trees = [];
      for (let k = 0; k < 8; k++) { const side = k % 2 ? 1 : -1, z = -H * C * 0.35 + (k >> 1) * H * C * 0.28; trees.push([side * ((W - 1) / 2 * C + 3.2 + rng() * 2), z, k]); }
      for (const [x, z, k] of trees) for (const { geo, material } of gumTreeParts(k + 3, 0.8)) { const m = new THREE.Mesh(geo, material); m.position.set(x, 0, z); m.rotation.y = rng() * 6; m.castShadow = true; scene.add(m); }
    }
    // the Colorbond fence round the edge
    kit.box(W * C, 1.3, 0.08, fence, 0, 0, wz(0) - C * 0.1);
    kit.box(W * C, 1.3, 0.08, fence, 0, 0, wz(H - 1) + C * 0.1);
    for (const s of [-1, 1]) kit.box(0.08, 1.3, H * C, fence, s * ((W - 1) / 2 * C + C * 0.1), 0, 0);
    // the border cells are a low brick garden edge, so it reads as a wall from up top
    for (let i = 0; i < W; i++) for (let j = 0; j < H; j++) {
      if (grid[i][j] === 1) kit.box(C * 0.98, 0.5, C * 0.98, brick, wx(i), 0, wz(j));
      if (grid[i][j] === 2) {
        // a rendered-brick pillar with a sandstone cap, and a pot plant on every other one
        const g = kit.group(wx(i), 0, wz(j));
        D.bx(g, C * 0.84, 1.1, C * 0.84, brick, 0, 0, 0, 0.04);
        D.bx(g, C * 0.92, 0.08, C * 0.92, cap, 0, 1.1, 0, 0.03); D.bx(g, C * 0.8, 0.06, C * 0.8, cap, 0, 1.18, 0, 0.03);
        if ((i + j) % 4 === 0) { const pl = D.pottedPlant({ size: 0.55 }); pl.position.y = 1.24; g.add(pl); }
        g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      }
    }

    // spawn spots: the corners first, then the middles of the edges
    const SPAWNS = [[1, 1], [W - 2, H - 2], [W - 2, 1], [1, H - 2], [7, 1], [7, H - 2], [1, 5], [W - 2, 5]].slice(0, Math.max(n, 4));
    const keepClear = new Set();
    for (const [i, j] of SPAWNS) for (const [di, dj] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) keepClear.add(key(i + di, j + dj));

    // eskies everywhere else (most cells), some with gear inside
    const eskyBody = [0x2a6fd0, 0xd02a2a, 0x2a9a5a, 0xe0a020];
    const lid = kit.mat(0xf4f4f0, { roughness: 0.4 });
    const gearBag = [];
    const addEsky = (i, j) => {
      const g = kit.group(wx(i), 0, wz(j), (rng() - 0.5) * 0.2);
      const e = D.esky({ color: eskyBody[(i * 7 + j * 3) % 4], w: C * 0.84, h: 0.95, dp: C * 0.62 }); g.add(e); void lid;
      grid[i][j] = 3; eskies.set(key(i, j), g);
    };
    for (let i = 1; i < W - 1; i++) for (let j = 1; j < H - 1; j++) {
      if (grid[i][j] !== 0 || keepClear.has(key(i, j))) continue;
      if (rng() < 0.72) addEsky(i, j);
    }
    {
      const spots = shuffle([...eskies.keys()]);
      const counts = { footy: 2 + Math.ceil(n * 0.75), fire: 2 + Math.ceil(n * 0.75), thongs: 1 + Math.ceil(n / 2), boot: Math.ceil(n / 3) };
      for (const [g, c] of Object.entries(counts)) for (let k = 0; k < c; k++) gearBag.push(g);
      gearBag.forEach((g, k) => { if (spots[k]) hidden.set(spots[k], g); });
    }
    function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }

    // ----- the footy -----
    const leather = kit.mat(0xb3202a, { roughness: 0.55 });
    const lace = kit.mat(0xffffff, { roughness: 0.6 });
    const makeFooty = () => {
      const g = new THREE.Group();
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 16), leather); ball.scale.set(1, 0.66, 0.66); ball.castShadow = true; g.add(ball);
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 0.05), lace); l.position.y = 0.27; g.add(l);
      for (let k = -2; k <= 2; k++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.12), lace); s.position.set(k * 0.06, 0.27, 0); g.add(s); }
      g.position.y = 0.3;
      return g;
    };
    const flameTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, '#fffbe0'); gr.addColorStop(0.35, '#ffd040'); gr.addColorStop(0.7, 'rgba(255,90,20,0.8)'); gr.addColorStop(1, 'rgba(255,60,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    const gearTex = {};
    for (const [g, e] of Object.entries(GEAR)) {
      const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
      x.fillStyle = '#fff6d8'; x.beginPath(); x.arc(64, 64, 58, 0, 7); x.fill();
      x.lineWidth = 8; x.strokeStyle = '#2a1406'; x.stroke();
      x.font = '72px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(e, 64, 70);
      gearTex[g] = new THREE.CanvasTexture(c); gearTex[g].colorSpace = THREE.SRGBColorSpace;
    }

    // ----- the players -----
    const P = players.map((p, idx) => {
      const [i, j] = SPAWNS[idx % SPAWNS.length];
      const doll = mg.makeDoll(p, { scale: 0.6 });
      doll.group.position.set(wx(i), 0, wz(j));
      scene.add(doll.group);
      return { p, doll, x: i, y: j, face: 0, input: { x: 0, y: 0, held: 0 }, alive: true, outAt: null, deadT: 0, kos: 0,
        max: 1, range: 2, speed: 3.1, boot: false, out: [], bot: p.bot ? { plan: 0, path: null, next: null, wantDrop: false, style: rng() } : null };
    });

    const footies = []; // { i, j, x, y, t, owner, range, mesh, passers:Set, vx, vy }
    const blasts = []; // { cells: [[i,j]], t, sprites }
    const gearOnFloor = new Map(); // key -> { kind, sprite }
    const hot = new Map(); // key -> seconds the cell stays deadly
    let tAll = 0, shrunk = 0, lastAlive = null, finishAt = null;

    const footyAt = (i, j) => footies.find((f) => f.i === i && f.j === j);
    const solid = (i, j) => i < 0 || j < 0 || i >= W || j >= H || grid[i][j] !== 0;
    const blockedFor = (S, i, j) => solid(i, j) || (footyAt(i, j) && !footyAt(i, j).passers.has(S));

    // ----- popping words -----
    const pops = [];
    const pop = (text, color, x, z, size = 1) => {
      const c = document.createElement('canvas'); c.width = 512; c.height = 128;
      const g = c.getContext('2d'); g.font = '900 86px Impact, "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 14; g.strokeStyle = '#1a0a04'; g.strokeText(text, 256, 66, 500); g.fillStyle = color; g.fillText(text, 256, 66, 500);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); sp.scale.set(4.2 * size, 1.05 * size, 1); sp.renderOrder = 50;
      sp.position.set(x, 2.6, z); scene.add(sp); pops.push({ sp, life: 1.5 });
    };

    // ----- dropping, bursting, kicking -----
    const drop = (S) => {
      if (!S.alive) return;
      const i = Math.round(S.x), j = Math.round(S.y);
      if (footyAt(i, j) || S.out.length >= S.max || grid[i][j] !== 0) return;
      const mesh = makeFooty(); mesh.position.set(wx(i), 0.3, wz(j)); mesh.rotation.y = rng() * Math.PI; scene.add(mesh);
      // anyone standing on it can walk off it
      const passers = new Set(P.filter((o) => o.alive && Math.round(o.x) === i && Math.round(o.y) === j));
      const f = { i, j, x: i, y: j, t: FUSE, owner: S, range: S.range, mesh, passers, vx: 0, vy: 0 };
      footies.push(f); S.out.push(f);
      sfx.play('thud');
    };
    const blastCells = (i, j, range) => {
      const cells = [[i, j]];
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        for (let k = 1; k <= range; k++) {
          const a = i + di * k, b = j + dj * k;
          if (a < 0 || b < 0 || a >= W || b >= H) break;
          const g = grid[a][b];
          if (g === 1 || g === 2) break;
          cells.push([a, b]);
          if (g === 3) break; // the esky takes the hit
        }
      }
      return cells;
    };
    const burst = (f) => {
      const k0 = footies.indexOf(f); if (k0 < 0) return;
      footies.splice(k0, 1);
      f.owner.out = f.owner.out.filter((o) => o !== f);
      scene.remove(f.mesh);
      const i = Math.round(f.x), j = Math.round(f.y);
      const cells = blastCells(i, j, f.range);
      const sprites = [];
      for (const [a, b] of cells) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        sp.position.set(wx(a), 0.7, wz(b)); sp.scale.setScalar(C * 1.5); scene.add(sp); sprites.push(sp);
        hot.set(key(a, b), Math.max(hot.get(key(a, b)) || 0, BLAST));
        if (grid[a][b] === 3) smash(a, b);
        else if (gearOnFloor.has(key(a, b)) && !(a === i && b === j)) { scene.remove(gearOnFloor.get(key(a, b)).sprite); gearOnFloor.delete(key(a, b)); }
        const other = footyAt(a, b); if (other) other.t = Math.min(other.t, 0.06); // chain reaction
      }
      blasts.push({ t: BLAST, sprites, by: f.owner });
      sfx.play('boom');
    };
    const smash = (i, j) => {
      grid[i][j] = 0;
      const g = eskies.get(key(i, j)); eskies.delete(key(i, j));
      if (g) { g.userData.flyT = 0.5; flying.push(g); }
      const gear = hidden.get(key(i, j));
      if (gear) {
        hidden.delete(key(i, j));
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: gearTex[gear], transparent: true })); sp.scale.setScalar(1.05); sp.position.set(wx(i), 0.8, wz(j)); scene.add(sp);
        // it shows up once the burst has died down
        setTimeoutish(() => gearOnFloor.set(key(i, j), { kind: gear, sprite: sp }), BLAST + 0.05);
        sp.visible = false;
      }
    };
    const flying = []; // smashed eskies tumbling away
    const later = [];
    function setTimeoutish(fn, s) { later.push({ fn, t: s }); }

    const knockOut = (S, by) => {
      if (!S.alive) return;
      S.alive = false; S.outAt = tAll; S.deadT = 0;
      S.doll.flinch();
      sfx.play('deflate');
      if (by && by !== S) { by.kos++; pop(`${by.p.name} got ${S.p.name}!`, by.p.color, S.doll.group.position.x, S.doll.group.position.z, 0.8); }
      else pop(`${S.p.name} is out!`, '#ffd23f', S.doll.group.position.x, S.doll.group.position.z, 0.8);
    };

    // ----- moving on the grid, Bomberman style: one axis at a time, sliding round corners -----
    const move = (S, dt) => {
      let ix = S.input.x, iy = -S.input.y; // stick up = up the screen = towards -j
      const mag = Math.hypot(ix, iy);
      if (mag < 0.35) return false;
      const horiz = Math.abs(ix) >= Math.abs(iy);
      const d = S.speed * dt;
      const ci = Math.round(S.x), cj = Math.round(S.y);
      if (horiz) {
        const s = Math.sign(ix);
        S.face = s > 0 ? Math.PI / 2 : -Math.PI / 2;
        const off = S.y - cj;
        if (blockedFor(S, ci + s, cj)) {
          // blocked straight ahead: slide round a corner if we're mostly past it, otherwise stop in the cell middle
          const side = off > 0.18 ? 1 : off < -0.18 ? -1 : 0;
          if (side && !blockedFor(S, ci + s, cj + side) && !blockedFor(S, ci, cj + side)) { S.y += Math.sign(side) * Math.min(d, Math.abs(side - off)); return true; }
          if (S.x * s < ci * s) S.x = s > 0 ? Math.min(ci, S.x + d) : Math.max(ci, S.x - d);
          if (Math.abs(off) > 0.01) S.y += -Math.sign(off) * Math.min(Math.abs(off), d);
          tryKick(S, ci + s, cj, s, 0);
          return true;
        }
        if (Math.abs(off) > 0.01) { const a = Math.min(Math.abs(off), d); S.y -= Math.sign(off) * a; S.x += s * (d - a) * 0.6; }
        else { S.y = cj; S.x += s * d; }
      } else {
        const s = Math.sign(iy);
        S.face = s > 0 ? 0 : Math.PI;
        const off = S.x - ci;
        if (blockedFor(S, ci, cj + s)) {
          const side = off > 0.18 ? 1 : off < -0.18 ? -1 : 0;
          if (side && !blockedFor(S, ci + side, cj + s) && !blockedFor(S, ci + side, cj)) { S.x += Math.sign(side) * Math.min(d, Math.abs(side - off)); return true; }
          if (S.y * s < cj * s) S.y = s > 0 ? Math.min(cj, S.y + d) : Math.max(cj, S.y - d);
          if (Math.abs(off) > 0.01) S.x += -Math.sign(off) * Math.min(Math.abs(off), d);
          tryKick(S, ci, cj + s, 0, s);
          return true;
        }
        if (Math.abs(off) > 0.01) { const a = Math.min(Math.abs(off), d); S.x -= Math.sign(off) * a; S.y += s * (d - a) * 0.6; }
        else { S.x = ci; S.y += s * d; }
      }
      return true;
    };
    const tryKick = (S, i, j, di, dj) => {
      if (!S.boot) return;
      const f = footyAt(i, j);
      if (!f || f.vx || f.vy || f.passers.has(S)) return;
      if (solid(i + di, j + dj) || footyAt(i + di, j + dj) || P.some((o) => o.alive && Math.round(o.x) === i + di && Math.round(o.y) === j + dj)) return;
      f.vx = di * KICK_SPEED; f.vy = dj * KICK_SPEED;
      sfx.play('kick');
    };

    // ----- bots -----
    const dangerMap = (extra) => {
      const m = new Map();
      const all = extra ? [...footies, extra] : footies;
      for (const f of all) for (const [a, b] of blastCells(Math.round(f.x), Math.round(f.y), f.range)) { const k = key(a, b); m.set(k, Math.min(m.get(k) ?? 99, f.t)); }
      for (const [k, t] of hot) m.set(k, 0);
      return m;
    };
    // breadth-first over open cells; returns { dist, prev } maps
    const bfs = (S, i0, j0, danger, maxD = 40) => {
      const dist = new Map([[key(i0, j0), 0]]), prev = new Map(), q = [[i0, j0]];
      while (q.length) {
        const [i, j] = q.shift(), d = dist.get(key(i, j));
        if (d >= maxD) continue;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const a = i + di, b = j + dj, k = key(a, b);
          if (dist.has(k) || solid(a, b) || (footyAt(a, b) && !(a === i0 && b === j0))) continue;
          if (hot.has(k)) continue;
          // don't walk into a cell that will be bursting when we get there
          const t = danger.get(k), arrive = (d + 1) / S.speed;
          if (t !== undefined && arrive > t - 0.45 && arrive < t + BLAST + 0.2) continue;
          dist.set(k, d + 1); prev.set(k, key(i, j)); q.push([a, b]);
        }
      }
      return { dist, prev };
    };
    const firstStep = (prev, from, to) => { let k = to; while (prev.get(k) && prev.get(k) !== from) k = prev.get(k); return k.split(',').map(Number); };
    const shrinkRing = () => { const next = SHRINK.find((s) => s.ring > shrunk); return next && mg.timeLeft() < next.at + 4 ? next.ring : shrunk; };
    const inRing = (i, j, r) => r > 0 && (Math.min(i, j, W - 1 - i, H - 1 - j) <= r);
    const botThink = (S) => {
      const b = S.bot;
      const i = Math.round(S.x), j = Math.round(S.y), here = key(i, j);
      const danger = dangerMap();
      const ring = shrinkRing();
      const unsafe = (k) => { const [a, c] = k.split(',').map(Number); return danger.has(k) || hot.has(k) || inRing(a, c, ring); };
      const { dist, prev } = bfs(S, i, j, danger);
      let goal = null;
      if (unsafe(here)) {
        // run: nearest safe cell
        let best = null; for (const [k, d] of dist) if (!unsafe(k) && (!best || d < best[1])) best = [k, d];
        goal = best?.[0];
      } else {
        // something worth bursting next to us? drop, if there's a way out afterwards
        const near = (a, c) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([di, dj]) => grid[a + di]?.[c + dj] === 3);
        const enemyInLine = P.some((o) => o !== S && o.alive && blastCells(i, j, S.range).some(([a, c]) => a === Math.round(o.x) && c === Math.round(o.y)));
        if (S.out.length < S.max && (near(i, j) || (enemyInLine && rng() < 0.5 + b.style * 0.4))) {
          const pretend = { i, j, x: i, y: j, t: FUSE, range: S.range };
          const d2 = dangerMap(pretend);
          const esc = bfs(S, i, j, d2, 8);
          if ([...esc.dist].some(([k, d]) => !d2.has(k) && !hot.has(k) && d > 0 && d / S.speed < FUSE - 0.5)) { drop(S); return; }
        }
        // otherwise head for gear, then a cell next to an esky, then a rival
        let best = null;
        for (const [k, d] of dist) {
          if (d === 0 || unsafe(k)) continue;
          const [a, c] = k.split(',').map(Number);
          let v = -d;
          if (gearOnFloor.has(k)) v += 14;
          else if (near(a, c)) v += 4 + rng();
          else if (P.some((o) => o !== S && o.alive && Math.abs(Math.round(o.x) - a) + Math.abs(Math.round(o.y) - c) <= 2)) v += 3 * b.style;
          else continue;
          if (!best || v > best[1]) best = [k, v];
        }
        goal = best?.[0];
      }
      b.next = goal && goal !== here && dist.has(goal) ? firstStep(prev, here, goal) : null;
    };
    const botSteer = (S) => {
      const b = S.bot;
      if (!b.next) { S.input.x = S.input.y = 0; return; }
      const [a, c] = b.next, dx = a - S.x, dy = c - S.y;
      if (Math.abs(dx) < 0.06 && Math.abs(dy) < 0.06) { S.input.x = S.input.y = 0; return; }
      // line up across the lane first, then go along it
      if (Math.abs(dx) > Math.abs(dy)) { S.input.x = Math.sign(dx); S.input.y = 0; } else { S.input.x = 0; S.input.y = -Math.sign(dy); }
    };

    // ----- camera -----
    const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.5, 300);
    camera.position.set(0, 21, 12.5);
    camera.lookAt(0, 0, 0.9);

    const shrink = SHRINK.map((x) => ({ ...x }));
    const warn = []; // flashing ring cells before the yard closes in
    return {
      camera,
      update(dt, t, running) {
        tAll += dt;
        for (let k = later.length - 1; k >= 0; k--) { later[k].t -= dt; if (later[k].t <= 0) { later[k].fn(); later.splice(k, 1); } }
        for (const [k, v] of hot) { if (v - dt <= 0) hot.delete(k); else hot.set(k, v - dt); }
        if (running) {
          // the yard closes in: a warning, then the outer ring fills with fence
          const left = mg.timeLeft();
          for (const s of shrink) {
            if (s.ring <= shrunk) continue;
            if (left < s.at + 3 && !s.warned) { s.warned = true; pop('THE YARD IS SHRINKING!', '#ff6a5a', 0, 0, 1.4); sfx.play('whistle');
              for (let i = 1; i < W - 1; i++) for (let j = 1; j < H - 1; j++) if (Math.min(i, j, W - 1 - i, H - 1 - j) === s.ring) { const m = kit.box(C * 0.96, 0.03, C * 0.96, kit.mat(0xff3a2a, { transparent: true, opacity: 0.45 }), wx(i), 0.02, wz(j)); warn.push(m); } }
            if (left < s.at) {
              shrunk = s.ring;
              for (const m of warn) scene.remove(m);
              warn.length = 0;
              for (let i = 1; i < W - 1; i++) for (let j = 1; j < H - 1; j++) {
                if (Math.min(i, j, W - 1 - i, H - 1 - j) !== s.ring || grid[i][j] === 2) continue;
                if (grid[i][j] === 3) { scene.remove(eskies.get(key(i, j))); eskies.delete(key(i, j)); }
                const f = footyAt(i, j); if (f) { scene.remove(f.mesh); footies.splice(footies.indexOf(f), 1); f.owner.out = f.owner.out.filter((o) => o !== f); }
                if (gearOnFloor.has(key(i, j))) { scene.remove(gearOnFloor.get(key(i, j)).sprite); gearOnFloor.delete(key(i, j)); }
                grid[i][j] = 1;
                const m = kit.box(C * 0.98, 0.5, C * 0.98, brick, wx(i), 2.5, wz(j)); m.userData.dropTo = 0; flying.push(m);
                for (const S of P) if (S.alive && Math.round(S.x) === i && Math.round(S.y) === j) knockOut(S, null);
              }
              sfx.play('bigboom');
            }
          }
          for (const S of P) {
            if (!S.alive) continue;
            if (S.bot) { S.bot.plan -= dt; if (S.bot.plan <= 0) { S.bot.plan = 0.18; botThink(S); } botSteer(S); }
            const moving = move(S, dt);
            // gear underfoot
            const k = key(Math.round(S.x), Math.round(S.y));
            const gear = gearOnFloor.get(k);
            if (gear) {
              gearOnFloor.delete(k); scene.remove(gear.sprite);
              if (gear.kind === 'footy') S.max = Math.min(6, S.max + 1);
              if (gear.kind === 'fire') S.range = Math.min(7, S.range + 1);
              if (gear.kind === 'thongs') S.speed = Math.min(5.2, S.speed + 0.55);
              if (gear.kind === 'boot') S.boot = true;
              sfx.play('item');
              pop(GEAR[gear.kind], '#fff', S.doll.group.position.x, S.doll.group.position.z, 0.6);
            }
            // walked off a footy you were standing on: it's solid to you from now on
            for (const f of footies) if (f.passers.has(S) && (Math.abs(S.x - f.x) > 0.75 || Math.abs(S.y - f.y) > 0.75)) f.passers.delete(S);
            if (hot.has(k)) knockOut(S, blasts.find((bl) => bl.sprites.some((sp) => Math.abs(sp.position.x - wx(Math.round(S.x))) < 0.1 && Math.abs(sp.position.z - wz(Math.round(S.y))) < 0.1))?.by);
            S.walk = moving ? (S.walk || 0) + dt * S.speed * 3 : 0;
          }
          // footies tick, and kicked ones slide
          for (const f of [...footies]) {
            if (f.vx || f.vy) {
              const ni = Math.round(f.x + Math.sign(f.vx) * 0.51), nj = Math.round(f.y + Math.sign(f.vy) * 0.51);
              const stop = (ni !== Math.round(f.x) || nj !== Math.round(f.y)) && (solid(ni, nj) || footyAt(ni, nj) || P.some((o) => o.alive && Math.round(o.x) === ni && Math.round(o.y) === nj));
              if (stop) { f.x = Math.round(f.x); f.y = Math.round(f.y); f.vx = f.vy = 0; }
              else { f.x += f.vx * dt; f.y += f.vy * dt; f.mesh.rotation.z -= f.vx * dt * 2; f.mesh.rotation.x += f.vy * dt * 2; }
              f.i = Math.round(f.x); f.j = Math.round(f.y);
              f.mesh.position.set(wx(0) + f.x * C, 0.3, wz(0) + f.y * C);
            }
            f.t -= dt;
            const pulse = 1 + Math.max(0, Math.sin((FUSE - f.t) * (6 + (FUSE - f.t) * 6))) * 0.18 * (1 - f.t / FUSE + 0.3);
            f.mesh.scale.setScalar(pulse);
            if (f.t <= 0) burst(f);
          }
          const alive = P.filter((S) => S.alive);
          if (n > 1 && alive.length <= 1 && finishAt == null) { finishAt = tAll; lastAlive = alive[0] || null; if (lastAlive) pop(`${lastAlive.p.name} WINS!`, lastAlive.p.color, 0, 0, 1.6); }
        }
        for (let k = blasts.length - 1; k >= 0; k--) {
          const bl = blasts[k]; bl.t -= dt;
          for (const sp of bl.sprites) { sp.material.opacity = Math.max(0, bl.t / BLAST); sp.scale.setScalar(C * (1.2 + (1 - bl.t / BLAST) * 0.6)); }
          if (bl.t <= 0) { for (const sp of bl.sprites) scene.remove(sp); blasts.splice(k, 1); }
        }
        for (const [, g] of gearOnFloor) { g.sprite.visible = true; g.sprite.position.y = 0.8 + Math.sin(tAll * 3 + g.sprite.position.x) * 0.12; }
        for (let k = flying.length - 1; k >= 0; k--) {
          const o = flying[k];
          if (o.userData.dropTo !== undefined) { o.position.y = Math.max(o.userData.dropTo, o.position.y - dt * 14); if (o.position.y <= o.userData.dropTo) flying.splice(k, 1); continue; }
          o.userData.flyT -= dt; o.position.y += dt * 6; o.rotation.x += dt * 9; o.scale.multiplyScalar(1 - dt * 3);
          if (o.userData.flyT <= 0) { scene.remove(o); flying.splice(k, 1); }
        }
        for (const S of P) {
          const g = S.doll.group;
          g.position.set(wx(0) + S.x * C, 0, wz(0) + S.y * C);
          if (S.alive) { g.rotation.y += ((S.face - g.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 12); g.position.y = Math.abs(Math.sin(S.walk || 0)) * 0.12; }
          else {
            // deflate: flatten and tip over
            S.deadT += dt;
            const k = Math.min(1, S.deadT / 0.8);
            g.scale.set(1 + k * 0.3, 1 - k * 0.85, 1 + k * 0.3);
            g.rotation.x = -k * 1.3;
          }
          S.doll.update(dt);
        }
        for (let k = pops.length - 1; k >= 0; k--) { const q = pops[k]; q.life -= dt; q.sp.position.y += dt * 0.8; q.sp.material.opacity = Math.min(1, q.life / 0.5); if (q.life <= 0) { scene.remove(q.sp); pops.splice(k, 1); } }
        for (const m of warn) m.material.opacity = 0.25 + Math.abs(Math.sin(tAll * 8)) * 0.4;
      },
      input(p, m) {
        const S = P.find((q) => q.p === p);
        if (!S || S.bot || m.b !== 'stick') return;
        const held = Number(m.h) || 0, newly = held & ~S.input.held;
        S.input.x = Math.max(-1, Math.min(1, Number(m.x) || 0)); S.input.y = Math.max(-1, Math.min(1, Number(m.y) || 0)); S.input.held = held;
        if (newly & BTN.DROP) drop(S);
      },
      // seconds survived, 20 a knockout, 40 for the last one standing
      scores() { return Object.fromEntries(P.map((S) => [S.p.id, Math.floor(S.alive ? tAll : S.outAt) + S.kos * 20 + (S === lastAlive ? 40 : 0)])); },
      done: () => finishAt != null && tAll - finishAt > 2.5,
    };
  },
};
