// Esky Tetris: everyone's packing an esky for the long weekend, with the same pile of gear coming in
// the same order: stubbies, bags of ice, snags, a watermelon, a slab, the goon... Move it, spin it,
// drop it. Nothing comes back out, and anything sticking up past the rim means the lid won't shut and
// you're done packing. Most things in your esky with the lid shut wins.
import { addSky } from '../../host/sky.js';

const COLS = 8, ROWS = 8, CELL = 0.34;
const FALL0 = 0.9, FALL1 = 0.45; // seconds per row, at the start and at the end
const REPEAT0 = 0.28, REPEAT = 0.11; // holding the stick over: first auto-shuffle, then every this often
const BTN = { SPIN: 1, DROP: 2 };
const ITEMS = [
  { id: 'stubby', label: 'STUBBY', col: 0x7a4a1e, cells: [[0, 0]], w: 3 },
  { id: 'ice', label: 'ICE', col: 0xbfe6ff, cells: [[0, 0], [1, 0]], w: 3 },
  { id: 'snags', label: 'SNAGS', col: 0xe88a8a, cells: [[0, 0], [1, 0], [2, 0]], w: 3 },
  { id: 'melon', label: 'MELON', col: 0x2f8a3a, cells: [[0, 0], [1, 0], [0, 1], [1, 1]], w: 2 },
  { id: 'slab', label: 'SLAB', col: 0xe8b020, cells: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]], w: 1.5 },
  { id: 'goon', label: 'GOON', col: 0x8a3ab0, cells: [[0, 0], [1, 0], [0, 1], [0, 2]], w: 2 },
  { id: 'pav', label: 'PAV', col: 0xf4ecd8, cells: [[0, 0], [1, 0], [2, 0], [1, 1]], w: 2 },
  { id: 'prawns', label: 'PRAWNS', col: 0xff7a5a, cells: [[0, 0], [1, 0], [1, 1], [2, 1]], w: 2 },
];

const rotateCells = (cells, r) => {
  let c = cells.map(([x, y]) => [x, y]);
  for (let i = 0; i < r; i++) c = c.map(([x, y]) => [y, -x]);
  const mx = Math.min(...c.map((p) => p[0])), my = Math.min(...c.map((p) => p[1]));
  return c.map(([x, y]) => [x - mx, y - my]);
};

export default {
  id: 'esky-tetris',
  name: 'Esky Tetris',
  blurb: 'Same gear for everyone, one esky each. Pack the most in and still get the lid shut.',
  howTo: 'Everyone gets the same stuff in the same order. Push the stick left and right to move it (hold it over to keep going), SPIN to turn it, DROP to drop it straight down. Nothing comes back out. If anything sticks up past the rim, the lid will not shut and you are done. Most things packed wins.',
  padText: 'Stick to move, SPIN, DROP',
  duration: 75,
  pad: { kind: 'stick', buttons: [{ bit: BTN.SPIN, label: '🔄 SPIN', tone: 'go' }, { bit: BTN.DROP, label: '⬇ DROP' }] },

  create(mg) {
    const { THREE, kit, scene, players, rng, renderer, sfx } = mg;
    const n = players.length;

    // ----- a driveway on the Friday arvo before the long weekend -----
    const { sun } = addSky(scene, renderer, { elevation: 45, azimuth: 20, turbidity: 3, sunIntensity: 2.4, sky: 0xd8e8ff, ground: 0x6b6a52, hemi: 0.45, env: 0.45, shadowSize: 22, fog: [0xd8e2ea, 40, 120] });
    sun.target.position.set(0, 1, 0);
    const drive = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), kit.surf('concrete', { unit: 3, tint: 0xd0c8b8 })); drive.rotation.x = -Math.PI / 2; drive.receiveShadow = true; scene.add(drive);
    kit.box(40, 3.2, 0.3, kit.surf('brick', { unit: 2.4, tint: 0xd8a888 }), 0, 0, -4.5);
    kit.box(9, 2.6, 0.1, kit.surf('corrugated', { unit: 0.6, tint: 0xe8e4dc, metalness: 0.4 }), 0, 0, -4.3); // roller door
    kit.sign('LONG WEEKEND!', 5, 0.7, 0, 2.9, -4.25, undefined, { bg: '#1e5aa8', fg: '#ffffff' });

    // ----- the gear, in the same order for everyone -----
    const bag = [];
    for (let i = 0; i < 80; i++) { const tot = ITEMS.reduce((s, it) => s + it.w, 0); let r = rng() * tot; bag.push(ITEMS.find((it) => (r -= it.w) < 0) || ITEMS[0]); }
    const labelTex = new Map();
    const labelFor = (it) => {
      if (labelTex.has(it.id)) return labelTex.get(it.id);
      const c = document.createElement('canvas'); c.width = 256; c.height = 64;
      const g = c.getContext('2d'); g.font = '900 44px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,0.75)'; g.strokeText(it.label, 128, 34, 248); g.fillStyle = '#fff'; g.fillText(it.label, 128, 34, 248);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; labelTex.set(it.id, t); return t;
    };
    const cellGeo = new THREE.BoxGeometry(CELL * 0.94, CELL * 0.94, CELL * 1.6);
    const canGeo = new THREE.CylinderGeometry(CELL * 0.38, CELL * 0.38, CELL * 0.92, 18);
    const itemMats = new Map(ITEMS.map((it) => [it.id, kit.mat(it.col, { roughness: it.id === 'stubby' || it.id === 'ice' ? 0.15 : 0.55, transparent: it.id === 'ice', opacity: it.id === 'ice' ? 0.85 : 1 })]));
    const pieceMesh = (it, cells) => {
      const g = new THREE.Group();
      for (const [x, y] of cells) {
        const m = new THREE.Mesh(it.id === 'stubby' ? canGeo : cellGeo, itemMats.get(it.id)); m.position.set((x + 0.5) * CELL, (y + 0.5) * CELL, 0); m.castShadow = true; g.add(m);
        if (it.id === 'stubby') { const cap = new THREE.Mesh(new THREE.CylinderGeometry(CELL * 0.12, CELL * 0.18, CELL * 0.2, 12), itemMats.get('stubby')); cap.position.set((x + 0.5) * CELL, (y + 1) * CELL - 0.02, 0); g.add(cap); }
        if (it.id === 'melon') for (let k = 0; k < 3; k++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.02, CELL * 0.94, CELL * 1.62), kit.mat(0x1a5a24)); s.position.set((x + 0.2 + k * 0.3) * CELL, (y + 0.5) * CELL, 0); g.add(s); }
      }
      const cx = cells.reduce((s, c) => s + c[0] + 0.5, 0) / cells.length, cy = cells.reduce((s, c) => s + c[1] + 0.5, 0) / cells.length;
      if (cells.length < 3) return g; // the little ones speak for themselves
      const lab = new THREE.Mesh(new THREE.PlaneGeometry(CELL * 2.2, CELL * 0.55), new THREE.MeshBasicMaterial({ map: labelFor(it), transparent: true, depthWrite: false }));
      lab.position.set(cx * CELL, cy * CELL, CELL * 0.82); lab.renderOrder = 5; g.add(lab);
      return g;
    };

    // ----- the eskies -----
    const rows = n > 4 ? 2 : 1, perRow = Math.ceil(n / rows);
    const EW = COLS * CELL, EH = ROWS * CELL, GAPX = 1.15;
    const white = kit.mat(0xf4f4f2, { roughness: 0.35 }), blue = kit.mat(0x1e5aa8, { roughness: 0.35 });
    const pops = [];
    const pop = (x, y, z, text, color, size = 1) => {
      const c = document.createElement('canvas'); c.width = 512; c.height = 160;
      const g = c.getContext('2d'); g.font = '900 88px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 14; g.strokeStyle = '#1a0d08'; g.strokeText(text, 256, 84, 500); g.fillStyle = color; g.fillText(text, 256, 84, 500);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); sp.scale.set(2.6 * size, 0.8 * size, 1); sp.renderOrder = 20;
      sp.position.set(x, y, z); scene.add(sp); pops.push({ sp, life: 0, stay: size > 1.05 });
      return sp;
    };
    const packers = players.map((p, i) => {
      const row = rows === 2 && i >= perRow ? 1 : 0, k = row ? i - perRow : i, inRow = row ? n - perRow : perRow;
      const ox = (k - (inRow - 1) / 2) * (EW + GAPX) - EW / 2, oy = row ? 0.75 : (rows === 2 ? EH + 2.35 : 0.75), oz = 0;
      const g = kit.group(ox, oy, oz);
      // the esky, cut away at the front so you can see in: white walls, a blue base, the lid up the back
      const T = 0.12;
      kit.box(EW + T * 2, T, CELL * 2.2, blue, EW / 2, -T, 0, g);
      // up on a trestle so it's easy to see into
      const tm = kit.surf('planks', { unit: 1.4, tint: 0xa8784a });
      kit.box(EW + 0.6, 0.08, CELL * 2.6, tm, EW / 2, -T - 0.08, 0, g);
      for (const lx of [-0.2, EW + 0.2]) kit.box(0.08, oy - T - 0.08, 0.08, 0x5a3a20, lx, -oy, 0.2, g);
      for (const sx of [-T / 2, EW + T / 2]) { kit.box(T, EH, CELL * 2.2, white, sx, 0, 0, g); kit.box(T + 0.01, EH * 0.28, CELL * 2.2 + 0.01, blue, sx, 0, 0, g); }
      kit.box(EW, EH, 0.05, kit.mat(0xd8e4ec, { roughness: 0.5 }), EW / 2, 0, -CELL * 1.05, g);
      const lid = new THREE.Group(); lid.position.set(0, EH, -CELL * 1.1); g.add(lid);
      kit.box(EW + T * 2, 0.16, CELL * 2.3, white, EW / 2, 0, CELL * 1.15, lid);
      lid.rotation.x = -1.7;
      // the rim line
      const rim = new THREE.Mesh(new THREE.PlaneGeometry(EW, 0.025), new THREE.MeshBasicMaterial({ color: 0xff3a3a })); rim.position.set(EW / 2, EH, CELL * 0.85); g.add(rim);
      // a name plate on the front of the base
      const plateC = document.createElement('canvas'); plateC.width = 512; plateC.height = 96;
      { const pg = plateC.getContext('2d'); pg.fillStyle = p.color; pg.beginPath(); pg.roundRect(4, 4, 504, 88, 40); pg.fill(); pg.fillStyle = '#111'; pg.font = '900 60px system-ui'; pg.textAlign = 'center'; pg.textBaseline = 'middle'; pg.fillText(p.name, 256, 52, 480); }
      const plateT = new THREE.CanvasTexture(plateC); plateT.colorSpace = THREE.SRGBColorSpace;
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(EW * 0.8, EW * 0.8 * 96 / 512), new THREE.MeshBasicMaterial({ map: plateT })); plate.position.set(EW / 2, -T - 0.3, CELL * 1.32); g.add(plate);
      const ghost = new THREE.Group(); g.add(ghost);
      return { p, g, ox, oy, lid, ghost, grid: Array.from({ length: ROWS + 4 }, () => new Array(COLS).fill(0)), next: 0, cur: null, items: 0, done: false, fallT: 0, lidT: 0, dir: 0, repT: 0, held: 0,
        bot: p.bot ? { plan: null, stepT: 0, speed: 0.13 + rng() * 0.12, slip: 0.1 + rng() * 0.2 } : null };
    });

    const fits = (P, cells, x, y) => cells.every(([cx, cy]) => { const gx = x + cx, gy = y + cy; return gx >= 0 && gx < COLS && gy >= 0 && (gy >= ROWS + 4 || !P.grid[gy][gx]); });
    const spawn = (P) => {
      const it = bag[P.next++ % bag.length];
      const cells = rotateCells(it.cells, 0), w = Math.max(...cells.map((c) => c[0])) + 1;
      const cur = { it, r: 0, cells, x: Math.floor((COLS - w) / 2), y: ROWS + 1, mesh: null };
      if (!fits(P, cells, cur.x, cur.y)) { finish(P); return; }
      P.cur = cur; redraw(P); P.fallT = 0; P.bot && (P.bot.plan = null);
    };
    const redraw = (P) => {
      const c = P.cur; if (!c) return;
      if (c.mesh) P.g.remove(c.mesh);
      c.mesh = pieceMesh(c.it, c.cells); P.g.add(c.mesh);
      c.mesh.position.set(c.x * CELL, c.y * CELL, 0);
      // where it would land
      P.ghost.clear();
      let gy = c.y; while (fits(P, c.cells, c.x, gy - 1)) gy--;
      for (const [x, y] of c.cells) { const m = new THREE.Mesh(new THREE.PlaneGeometry(CELL * 0.9, CELL * 0.9), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false })); m.position.set((c.x + x + 0.5) * CELL, (gy + y + 0.5) * CELL, CELL * 0.9); P.ghost.add(m); }
    };
    const finish = (P, why) => {
      if (P.done) return;
      P.done = true; P.failed = !!why; P.cur = null; P.ghost.clear();
      pop(P.ox + EW / 2, P.oy + EH + 1.0, 0.6, why || `${P.items} PACKED`, why ? '#ff8a5a' : P.p.color, 0.8);
    };
    const lock = (P) => {
      const c = P.cur;
      const over = c.cells.some(([x, y]) => c.y + y >= ROWS);
      for (const [x, y] of c.cells) if (c.y + y < ROWS + 4) P.grid[c.y + y][c.x + x] = 1;
      P.cur = null; P.ghost.clear();
      if (over) { c.mesh.traverse((o) => { if (o.material && o.material.color) { o.material = o.material.clone(); o.material.color.multiplyScalar(0.6); } }); finish(P, "LID WON'T SHUT"); sfx.play('lose'); return; }
      P.items++; sfx.play('thud');
      spawn(P);
    };
    const move = (P, dx) => { const c = P.cur; if (c && fits(P, c.cells, c.x + dx, c.y)) { c.x += dx; redraw(P); sfx.play('tick'); } };
    const spin = (P) => {
      const c = P.cur; if (!c) return;
      const r = (c.r + 1) % 4, cells = rotateCells(c.it.cells, r);
      for (const kick of [0, -1, 1, -2]) if (fits(P, cells, c.x + kick, c.y)) { c.r = r; c.cells = cells; c.x += kick; redraw(P); sfx.play('tick'); return; }
    };
    const drop = (P) => { const c = P.cur; if (!c) return; while (fits(P, c.cells, c.x, c.y - 1)) c.y--; c.mesh.position.y = c.y * CELL; lock(P); };

    // CPU packing: try every spin and spot, keep the one that leaves the flattest, lowest, hole-free pile
    const plan = (P) => {
      const c = P.cur; let best = null;
      for (let r = 0; r < 4; r++) {
        const cells = rotateCells(c.it.cells, r), w = Math.max(...cells.map((q) => q[0])) + 1;
        for (let x = 0; x + w <= COLS; x++) {
          let y = ROWS + 1; if (!fits(P, cells, x, y)) continue;
          while (fits(P, cells, x, y - 1)) y--;
          const grid = P.grid.map((row) => row.slice());
          let over = false;
          for (const [cx, cy] of cells) { if (y + cy >= ROWS) over = true; if (y + cy < ROWS + 4) grid[y + cy][x + cx] = 1; }
          const hts = Array.from({ length: COLS }, (_, gx) => { for (let gy = ROWS + 3; gy >= 0; gy--) if (grid[gy][gx]) return gy + 1; return 0; });
          let holes = 0; for (let gx = 0; gx < COLS; gx++) for (let gy = 0; gy < hts[gx]; gy++) if (!grid[gy][gx]) holes++;
          const bump = hts.slice(1).reduce((s, h, k) => s + Math.abs(h - hts[k]), 0);
          const score = -(over ? 1000 : 0) - holes * 7 - bump * 1.2 - Math.max(...hts) * 2 - y * 0.5 + rng() * P.bot.slip * 4;
          if (!best || score > best.score) best = { r, x, score };
        }
      }
      return best;
    };

    const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.2, 200);
    const spanW = perRow * (EW + GAPX) + 0.4, spanH = rows * (EH + 1.9) + 0.9;
    const vf = THREE.MathUtils.degToRad(38), hf = 2 * Math.atan(Math.tan(vf / 2) * 16 / 9);
    const dist = Math.max(spanW / 2 / Math.tan(hf / 2), spanH / 2 / Math.tan(vf / 2));
    const midY = rows === 2 ? (EH + 2.35 + EH) / 2 + 0.55 : EH / 2 + 0.95;
    camera.position.set(0, midY + dist * 0.18, dist + 0.6);
    camera.lookAt(0, midY, 0);

    let tAll = 0, run = 0, finishAt = null, started = false;
    return {
      camera,
      update(dt, t, running) {
        tAll += dt;
        if (running) {
          run += dt;
          if (!started) { started = true; for (const P of packers) spawn(P); }
        }
        const fall = FALL0 + (FALL1 - FALL0) * Math.min(1, run / mg.duration);
        for (const P of packers) {
          if (P.done) { P.lidT = Math.min(1, P.lidT + dt * 2); P.lid.rotation.x = -1.7 + (P.failed ? 1.1 : 1.7) * P.lidT; continue; } // it won't shut on a full esky
          if (!running || !P.cur) continue;
          if (P.bot) {
            const B = P.bot; B.stepT -= dt;
            if (!B.plan) B.plan = plan(P);
            if (B.stepT <= 0 && B.plan) {
              B.stepT = B.speed;
              const c = P.cur;
              if (c.r !== B.plan.r) spin(P);
              else if (c.x < B.plan.x) move(P, 1);
              else if (c.x > B.plan.x) move(P, -1);
              else { drop(P); B.stepT = B.speed * 2; }
              if (!P.cur) continue;
            }
          }
          // the stick held over keeps shuffling the piece along
          if (P.dir) { P.repT -= dt; if (P.repT <= 0) { P.repT = REPEAT; move(P, P.dir); if (!P.cur) continue; } }
          P.fallT += dt;
          if (P.fallT >= fall) {
            P.fallT = 0;
            const c = P.cur;
            if (fits(P, c.cells, c.x, c.y - 1)) { c.y--; c.mesh.position.y = c.y * CELL; } else lock(P);
          }
        }
        if (running && run > mg.duration - 0.5) for (const P of packers) if (!P.done) finish(P);
        if (finishAt == null && started && packers.every((P) => P.done)) { finishAt = tAll; sfx.play('hallelujah'); }
        for (const q of pops) { q.life += dt; q.sp.material.opacity = Math.min(1, q.life * 4); }
      },
      input(p, m) {
        const P = packers.find((x) => x.p === p); if (!P || m.b !== 'stick') return;
        const x = Number(m.x) || 0, held = Number(m.h) || 0, newly = held & ~P.held;
        // a push past halfway moves once straight away, then repeats while it's held there
        const dir = x > 0.5 ? 1 : x < -0.5 ? -1 : 0;
        const changed = dir !== P.dir;
        P.dir = dir; P.held = held;
        if (P.done || !P.cur) return;
        if (changed && dir) { P.repT = REPEAT0; move(P, dir); }
        if (P.cur && (newly & BTN.SPIN)) spin(P);
        if (P.cur && (newly & BTN.DROP)) drop(P);
      },
      scores() { return Object.fromEntries(packers.map((P) => [P.p.id, P.items])); },
      done: () => finishAt != null && tAll - finishAt > 3,
    };
  },
};
