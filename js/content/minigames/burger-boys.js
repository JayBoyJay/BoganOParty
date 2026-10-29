// Burger Boys: everyone's on the line at a takeaway. Order tickets come down the rail and you build
// each burger by tapping the ingredients in order, bottom bun up. Get one wrong and the whole thing
// ends up on the floor; start that order again. Bigger burgers score more. Same orders for everyone.
const GAP = 3.1; // metres between stations
const DOLL = 0.8;
const R = 0.4; // burger radius
const COUNTER_Y = 1.1;
const RESET_T = 0.9; // lockout after binning a burger

// what's in the kitchen: thickness on the stack, colour for the ticket, word, button label
const ING = {
  bun: { h: 0.15, top: 0.3, color: '#d89a4a', word: 'Bun', label: '🍞 Bun' },
  patty: { h: 0.13, color: '#5a3222', word: 'Patty', label: '🥩 Patty' },
  cheese: { h: 0.035, color: '#ffc21a', word: 'Cheese', label: '🧀 Cheese' },
  lettuce: { h: 0.05, color: '#6fc23a', word: 'Lettuce', label: '🥬 Lettuce' },
  tomato: { h: 0.06, color: '#e0352a', word: 'Tomato', label: '🍅 Tomato' },
  beetroot: { h: 0.05, color: '#8a1f5a', word: 'Beetroot', label: '🟣 Beetroot' },
  egg: { h: 0.07, color: '#fff4dc', word: 'Egg', label: '🍳 Egg' },
  pineapple: { h: 0.06, color: '#f5d23a', word: 'Pineapple', label: '🍍 Pineapple' },
};
const FILLINGS = ['patty', 'cheese', 'lettuce', 'tomato', 'beetroot', 'egg', 'pineapple'];
const NAMES = ['The Lot', 'Aussie Classic', 'Brekky Burger', 'Double Trouble', 'The Tradie', 'Hangover Cure', 'The Bogan', 'Servo Special', 'Big Kev', 'Arvo Snack'];

export default {
  id: 'burger-boys',
  name: 'Burger Boys',
  blurb: "Tickets on the rail, grill's hot. Stack every burger exactly as ordered.",
  howTo: 'Each order ticket shows a burger from the bottom bun up. Tap the ingredients in that order. One wrong tap and the burger hits the floor. Bigger burgers score more.',
  padText: 'Build it bottom up, exactly like the ticket.',
  duration: 70,
  pad: { kind: 'buttons', buttons: ['bun', 'patty', 'cheese', 'lettuce', 'tomato', 'beetroot', 'egg', 'pineapple'].map((id) => ({ id, label: ING[id].label })) },

  create(mg) {
    const { THREE, kit, scene, players, rng, renderer } = mg;
    const n = players.length, gap = n > 4 ? 2.5 : GAP, W = n * gap; // a bigger crew squeezes up along the counter
    const stX = (i) => (i - (n - 1) / 2) * gap;

    // ----- the orders (everyone gets the same ones) -----
    const orders = [];
    const order = (k) => {
      while (orders.length <= k) {
        const i = orders.length, count = Math.min(7, 2 + Math.floor(i * 0.7));
        const fill = []; for (let j = 0; j < count; j++) fill.push(FILLINGS[Math.floor(rng() * FILLINGS.length)]);
        if (!fill.includes('patty')) fill[Math.floor(rng() * count)] = 'patty'; // it's not a burger without one
        orders.push({ name: NAMES[i % NAMES.length], stack: ['bun', ...fill, 'bun'] });
      }
      return orders[k];
    };

    // ----- the shop -----
    scene.background = new THREE.Color(0x101014);
    mg.env((env) => {
      env.add(new THREE.Mesh(new THREE.BoxGeometry(30, 10, 30), new THREE.MeshBasicMaterial({ color: 0x8a8a90, side: THREE.BackSide })));
      for (const x of [-8, 0, 8]) { const l = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.6), new THREE.MeshBasicMaterial({ color: 0xffffff })); l.position.set(x, 4.9, 0); l.rotation.x = Math.PI / 2; env.add(l); }
    }, 0.03);
    scene.environmentIntensity = 0.8;
    scene.add(new THREE.HemisphereLight(0xfff4e8, 0x40342a, 0.8));
    const key = new THREE.DirectionalLight(0xfff0e0, 2.2);
    key.position.set(4, 12, 10); key.target.position.set(0, 1, 0); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -W / 2 - 4, right: W / 2 + 4, top: 8, bottom: -4, near: 1, far: 40 });
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
    scene.add(key, key.target);

    // floor: red and white chequered lino; back wall: white subway tiles
    // a tiled canvas: chequered when given two colours, offset brick-bond with grout lines when given one
    const tile = (w, h, a, b, grout = 0) => {
      const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
      g.fillStyle = a; g.fillRect(0, 0, 256, 256);
      for (let y = 0; y * h < 256; y++) for (let x = -1; x * w < 256; x++) {
        const off = !b && y % 2 ? w / 2 : 0;
        if (b && (x + y) % 2) { g.fillStyle = b; g.fillRect(x * w, y * h, w, h); }
        if (grout) { g.strokeStyle = '#b8b4ac'; g.lineWidth = grout; g.strokeRect(x * w + off, y * h, w, h); }
      }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
    };
    const lino = tile(64, 64, '#e8e2d6', '#b8282a'); lino.repeat.set((W + 20) / 2, 6);
    lino.repeat.y = 11; // deep enough to reach the camera with a big crew
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W + 20, 22), new THREE.MeshStandardMaterial({ map: lino, roughness: 0.35 }));
    floor.rotation.x = -Math.PI / 2; floor.position.z = 6.8; floor.receiveShadow = true; scene.add(floor);
    const subway = tile(64, 32, '#f4f2ec', null, 3); subway.repeat.set((W + 20) / 1.2, 13 / 0.6);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(W + 20, 13), new THREE.MeshPhysicalMaterial({ map: subway, roughness: 0.2, clearcoat: 0.6 }));
    wall.position.set(0, 6.5, -4.2); wall.receiveShadow = true; scene.add(wall);
    kit.box(W + 20, 0.25, 0.1, 0xb8282a, 0, 1.2, -4.12); // a red stripe in the tiles

    // the back line: flat-top grill with patties sizzling, fryers, a range hood
    const steel = new THREE.MeshStandardMaterial({ color: 0xc8ccd0, metalness: 0.9, roughness: 0.32 });
    const darkSteel = new THREE.MeshStandardMaterial({ color: 0x2a2c30, metalness: 0.8, roughness: 0.45 });
    kit.box(W + 6, 0.95, 1.1, steel, 0, 0, -3.5);
    kit.box(W * 0.45, 0.06, 1.0, darkSteel, -W * 0.18, 0.95, -3.5); // grill plate
    const sizzle = [];
    for (let i = 0; i < Math.max(4, n * 2); i++) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.96, 0.13, 24), new THREE.MeshStandardMaterial({ color: 0x5a3222, roughness: 0.85 }));
      p.position.set(-W * 0.18 + (i / Math.max(4, n * 2) - 0.5) * W * 0.4, 1.08, -3.5 + (i % 2 ? 0.2 : -0.2)); p.castShadow = true; scene.add(p); sizzle.push(p);
    }
    for (let i = 0; i < 2; i++) {
      const fx = W * 0.2 + i * 1.6;
      kit.box(1.3, 0.1, 0.9, darkSteel, fx, 0.95, -3.5);
      const oil = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.7), new THREE.MeshStandardMaterial({ color: 0xc8901a, roughness: 0.05, metalness: 0.3 })); oil.rotation.x = -Math.PI / 2; oil.position.set(fx, 1.03, -3.5); scene.add(oil);
      kit.box(0.9, 0.3, 0.5, steel, fx, 1.1, -3.4).rotation.x = -0.3; // basket
    }
    kit.box(W + 6, 0.7, 1.4, steel, 0, 4.2, -3.5); // range hood
    // smoke off the grill
    const smoke = [];
    const smokeTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
    for (let i = 0; i < 18; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0.4 })); s.userData.p = rng(); scene.add(s); smoke.push(s); }
    // the neon sign and the menu boards
    kit.sign('BURGER BOYS', Math.min(9, W * 0.6 + 3), 1.3, 0, 6.0, -4.1, scene, { bg: null, fg: '#ffcf3a', glow: '#ff9a1a', font: '900 240px system-ui, sans-serif' });
    const menu = ['THE LOT ........ $14.50', 'AUSSIE ......... $11.00', 'BREKKY ......... $12.50', 'CHIPS + GRAVY ... $6.00'];
    for (const s of [-1, 1]) {
      const m = kit.sign(s < 0 ? menu.slice(0, 2).join('   ') : menu.slice(2).join('   '), 6, 0.8, s * (W / 2 + 2.8), 3.0, -4.1, scene, { bg: '#1a1a1a', fg: '#fff' });
      m.scale.set(0.8, 0.8, 1);
    }
    const neon = new THREE.PointLight(0xffa030, 6, 14, 1.5); neon.position.set(0, 4.5, -3); scene.add(neon);
    // the ticket rail
    kit.box(W + 1, 0.06, 0.06, steel, 0, 5.04, -0.33);

    // ----- the stations -----
    const geo = {
      bunBase: (() => { const g = new THREE.CylinderGeometry(R, R * 0.92, ING.bun.h, 32); g.translate(0, ING.bun.h / 2, 0); return g; })(),
      bunTop: (() => { const g = new THREE.SphereGeometry(R, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2); g.scale(1, ING.bun.top / R, 1); return g; })(),
      disc: (r, h, seg = 32) => { const g = new THREE.CylinderGeometry(r, r, h, seg); g.translate(0, h / 2, 0); return g; },
    };
    const bunMat = new THREE.MeshPhysicalMaterial({ color: 0xd08a3a, roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.4 });
    const crumbMat = new THREE.MeshStandardMaterial({ color: 0xf2d8a8, roughness: 0.9 });
    const seedMat = new THREE.MeshStandardMaterial({ color: 0xfff2d0, roughness: 0.6 });
    const mats = {
      patty: new THREE.MeshStandardMaterial({ color: 0x4a2a1a, roughness: 0.9, map: (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#6a3c26'; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 900; i++) { g.fillStyle = rng() < 0.5 ? '#3a1e12' : '#8a5236'; g.fillRect(rng() * 128, rng() * 128, 2 + rng() * 3, 2 + rng() * 3); } for (let x = 0; x < 128; x += 26) { g.fillStyle = '#26120a'; g.fillRect(0, x, 128, 5); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })() }),
      cheese: new THREE.MeshPhysicalMaterial({ color: 0xffb81a, roughness: 0.35, clearcoat: 0.4, sheen: 0.3 }),
      lettuce: new THREE.MeshStandardMaterial({ color: 0x7ccf3a, roughness: 0.6, side: THREE.DoubleSide }),
      tomato: new THREE.MeshPhysicalMaterial({ color: 0xd8301f, roughness: 0.3, clearcoat: 0.8 }),
      beetroot: new THREE.MeshPhysicalMaterial({ color: 0x7a1048, roughness: 0.3, clearcoat: 0.8 }),
      eggWhite: new THREE.MeshPhysicalMaterial({ color: 0xfffaf0, roughness: 0.3, clearcoat: 0.5 }),
      yolk: new THREE.MeshPhysicalMaterial({ color: 0xffa81a, roughness: 0.2, clearcoat: 1 }),
      pineapple: new THREE.MeshPhysicalMaterial({ color: 0xf5cf2a, roughness: 0.4, clearcoat: 0.6 }),
    };
    const ruffled = (r, h, amp, waves) => { const g = new THREE.CylinderGeometry(r, r, h, 64, 1); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), d = Math.hypot(x, z); if (d > r * 0.9) { const k = 1 + amp * Math.sin(a * waves); p.setXYZ(i, x * k, p.getY(i) + Math.sin(a * waves * 0.5) * h, z * k); } } g.computeVertexNormals(); g.translate(0, h / 2, 0); return g; };
    const lettuceGeo = ruffled(R * 1.12, ING.lettuce.h, 0.1, 14), eggGeo = ruffled(R * 0.95, 0.03, 0.12, 5);
    const cheeseGeo = (() => { const g = new THREE.BoxGeometry(R * 1.75, ING.cheese.h, R * 1.75, 6, 1, 6); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), d = Math.max(Math.abs(x), Math.abs(z)) / (R * 0.875); if (d > 0.7) p.setY(i, p.getY(i) - (d - 0.7) * 0.18); } g.computeVertexNormals(); g.rotateY(Math.PI / 4); g.translate(0, ING.cheese.h / 2, 0); return g; })();
    const sliceGeo = geo.disc(R * 0.42, ING.tomato.h, 24);
    const pineGeo = (() => { const g = new THREE.TorusGeometry(R * 0.68, R * 0.22, 10, 32); g.rotateX(Math.PI / 2); g.scale(1, 0.6, 1); g.translate(0, ING.pineapple.h / 2, 0); return g; })();
    const sesame = (() => { const parts = []; for (let i = 0; i < 26; i++) { const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * R * 0.8, s = new THREE.SphereGeometry(0.018, 6, 4); s.scale(1.6, 0.5, 1); s.rotateY(rng() * 3); const y = ING.bun.top * Math.sqrt(Math.max(0, 1 - (d / R) ** 2)); s.translate(Math.cos(a) * d, y, Math.sin(a) * d); parts.push(s); } return parts; })();
    const make = (kind, top) => {
      const g = new THREE.Group();
      const m = (geom, mat, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geom, mat); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
      if (kind === 'bun' && top) { m(geo.bunTop, bunMat); for (const s of sesame) m(s, seedMat); m(geo.disc(R * 0.98, 0.02), crumbMat); }
      else if (kind === 'bun') { m(geo.bunBase, bunMat); m(geo.disc(R * 0.96, 0.01), crumbMat, 0, ING.bun.h - 0.005); }
      else if (kind === 'patty') m(geo.disc(R * 1.04, ING.patty.h), mats.patty);
      else if (kind === 'cheese') m(cheeseGeo, mats.cheese);
      else if (kind === 'lettuce') m(lettuceGeo, mats.lettuce);
      else if (kind === 'tomato' || kind === 'beetroot') { for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 + 0.4; m(sliceGeo, mats[kind], Math.cos(a) * R * 0.45, 0, Math.sin(a) * R * 0.45); } m(sliceGeo, mats[kind], 0, 0.005, 0); }
      else if (kind === 'egg') { m(eggGeo, mats.eggWhite); const y = m(new THREE.SphereGeometry(R * 0.32, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mats.yolk, R * 0.1, 0.03, 0); y.scale.y = 0.55; }
      else if (kind === 'pineapple') m(pineGeo, mats.pineapple);
      return g;
    };

    // the order ticket: a paper docket on the rail showing the burger, bottom up, with the next layer flagged
    const ticket = () => {
      const c = document.createElement('canvas'); c.width = 256; c.height = 400;
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 2.1), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, side: THREE.DoubleSide }));
      const draw = (o, k, done, wrong, who) => {
        const g = c.getContext('2d');
        g.fillStyle = wrong ? '#ffd6d0' : done ? '#d6ffd8' : '#fbf8f0'; g.fillRect(0, 0, 256, 400);
        g.fillStyle = '#222'; g.textAlign = 'center';
        g.font = '900 30px system-ui, sans-serif'; g.fillText(who.toUpperCase(), 128, 32, 240);
        g.font = '700 20px ui-monospace, monospace'; g.fillText(`ORDER #${k + 1}`, 128, 56);
        g.font = '700 22px system-ui, sans-serif'; g.fillText(o.name, 128, 80, 236);
        g.strokeStyle = '#999'; g.setLineDash([6, 5]); g.beginPath(); g.moveTo(10, 92); g.lineTo(246, 92); g.stroke(); g.setLineDash([]);
        // the stack, drawn side on, top of the burger at the top of the docket
        const L = o.stack.length, rowH = Math.min(40, 290 / L);
        o.stack.forEach((kind, i) => {
          const y = 100 + (L - 1 - i) * rowH, info = ING[kind], isNext = i === done;
          if (isNext) { g.fillStyle = '#ffe680'; g.fillRect(4, y, 248, rowH); }
          g.fillStyle = info.color; g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 2;
          const top = kind === 'bun' && i === L - 1, bot = kind === 'bun' && i === 0;
          g.beginPath();
          if (top) g.roundRect(18, y + 3, 78, rowH - 4, [rowH, rowH, 4, 4]); else if (bot) g.roundRect(18, y + 3, 78, rowH - 6, [3, 3, 10, 10]); else g.roundRect(14, y + rowH * 0.2, 86, rowH * 0.6, 6);
          g.fill(); g.stroke();
          g.fillStyle = i < done ? '#2a8a3a' : '#222'; g.textAlign = 'left';
          g.font = `${isNext ? 900 : 700} ${Math.round(rowH * 0.62)}px system-ui, sans-serif`;
          g.fillText((i < done ? '✓ ' : '') + info.word, 108, y + rowH * 0.72, 140);
        });
        t.needsUpdate = true;
      };
      return { mesh, draw };
    };

    const stations = players.map((p, i) => {
      const x = stX(i), g = kit.group(x, 0, 0);
      // counter: stainless top on a white cabinet
      kit.box(gap - 0.15, COUNTER_Y - 0.06, 1.2, 0xeeeeee, 0, 0, 0.2, g, { roughness: 0.4 });
      const top = kit.box(gap - 0.1, 0.06, 1.3, steel, 0, COUNTER_Y - 0.06, 0.2, g); top.receiveShadow = true;
      kit.box(gap - 0.15, 0.12, 0.02, p.color, 0, 0.6, 0.86, g, { emissive: p.color, emissiveIntensity: 0.3 });
      // a wooden board to build on, and the pass at the end
      kit.box(1.3, 0.05, 1.0, kit.surf('planks', { unit: 1.2, tint: 0xd8b088 }), 0, COUNTER_Y, 0.3, g);
      const doll = mg.makeDoll(p, { scale: DOLL, tag: false }); // the ticket has their name
      doll.group.position.set(0, 0, -0.85); g.add(doll.group);
      // a paper hat
      const hat = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.22, 0.3), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }));
      hat.position.set(0, 0.32, 0); if (!doll.hat) doll.head.add(hat); // the paper hat, unless they brought their own
      const tk = ticket(); tk.mesh.position.set(0, 3.95, -0.3); g.add(tk.mesh);
      const clip = kit.box(0.24, 0.14, 0.05, steel, 0, 4.96, -0.3, g);
      return { p, x, g, doll, tk, clip, k: 0, done: 0, pieces: [], flying: [], lock: 0, score: 0, served: 0, wobble: 0, reach: 0, ticketDirty: true, flash: 0,
        bot: p.bot ? { rate: 2.2 + rng() * 1.8, err: 0.02 + rng() * 0.04, cool: 1 } : null };
    });
    const pops = [];
    const pop = (s, text, color) => {
      const c = document.createElement('canvas'); c.width = 512; c.height = 96;
      const g = c.getContext('2d'); g.font = '900 58px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 10; g.strokeStyle = '#1a0d08'; g.strokeText(text, 256, 50, 490); g.fillStyle = color; g.fillText(text, 256, 50, 490);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); sp.scale.set(2.8, 0.52, 1); sp.renderOrder = 20;
      scene.add(sp); pops.push({ sp, s, life: 0 });
    };
    const stackTop = (s) => s.pieces.reduce((y, q) => y + q.h, COUNTER_Y + 0.05);
    const place = (s, kind) => {
      if (s.lock > 0) return;
      const o = order(s.k), want = o.stack[s.done];
      s.reach = 1;
      if (kind !== want) {
        // wrong: the lot goes on the floor
        const all = s.pieces.splice(0);
        const extra = make(kind, false); extra.position.set(s.x, stackTop(s) + 0.6, 0.3); scene.add(extra); all.push({ m: extra, h: 0 });
        for (const q of all) s.flying.push({ m: q.m, v: new THREE.Vector3((rng() - 0.5) * 4, 2 + rng() * 3, 1.5 + rng() * 2.5), w: new THREE.Vector3(rng() * 8, rng() * 8, rng() * 8), life: 0 });
        s.done = 0; s.lock = RESET_T; s.flash = -1; s.ticketDirty = true;
        s.doll.flinch();
        pop(s, 'WRONG!', '#ff4a3a'); mg.sfx.play('bonk');
        return;
      }
      const isTop = kind === 'bun' && s.done === o.stack.length - 1;
      const m = make(kind, isTop);
      const y = stackTop(s);
      m.position.set(s.x, y + 1.0, 0.3); m.rotation.y = rng() * 6;
      scene.add(m);
      s.pieces.push({ m, h: isTop ? ING.bun.top : ING[kind].h, y, vy: 0, landed: false });
      s.done += 1; s.ticketDirty = true;
      if (!s.p.bot) mg.sfx.play('step');
      if (s.done === o.stack.length) {
        // order up: score it, slide it down the pass
        const fillings = o.stack.length - 2;
        s.score += fillings; s.served += 1;
        const burger = s.pieces.splice(0);
        s.flying.push(...burger.map((q) => ({ m: q.m, q, slide: true, life: 0, delay: 0.6 }))); // the top bun still lands before it goes
        s.done = 0; s.k += 1; s.lock = 0.4; s.flash = 1;
        pop(s, `ORDER UP! +${fillings}`, '#5cff9d'); mg.sfx.play('coin');
        s.doll.bounce(1);
      }
    };

    const camera = new THREE.PerspectiveCamera(n > 4 ? 46 : 40, 16 / 9, 0.3, 200);
    const camZ = Math.max(7.5, (W / 2 + (n > 4 ? 1.3 : 0.8)) / (n > 4 ? 0.755 : 0.64)), camX = W * (n > 4 ? 0.035 : 0.07);

    return {
      camera,
      update(dt, t, running) {
        for (const s of stations) {
          if (s.bot && running) {
            s.bot.cool -= dt;
            if (s.bot.cool <= 0 && s.lock <= 0) {
              const o = order(s.k), want = o.stack[s.done];
              const kind = rng() < s.bot.err ? FILLINGS[Math.floor(rng() * FILLINGS.length)] : want;
              place(s, kind);
              s.bot.cool = (1 / s.bot.rate) * (0.6 + rng() * 0.8) + (s.done === 0 ? 0.5 : 0); // a moment to read each new ticket
            }
          }
          if (s.lock > 0) s.lock -= dt;
          if (s.ticketDirty) { s.ticketDirty = false; s.tk.draw(order(s.k), s.k, s.done, s.flash < 0 && s.lock > 0, s.p.name); }
          if (s.flash < 0 && s.lock <= 0) { s.flash = 0; s.ticketDirty = true; }
          // falling into place, with a squash on landing and a wobble up the stack
          for (const q of s.pieces) {
            if (q.landed) continue;
            q.vy -= 28 * dt; q.m.position.y += q.vy * dt;
            if (q.m.position.y <= q.y) { q.m.position.y = q.y; q.landed = true; s.wobble = Math.min(1, s.wobble + 0.5); q.m.scale.set(1.15, 0.7, 1.15); }
          }
          s.wobble *= Math.exp(-dt * 3);
          const lean = Math.sin(t * 11) * s.wobble * 0.06;
          s.pieces.forEach((q, i) => { if (!q.landed) return; q.m.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, dt * 12)); q.m.position.x = s.x + lean * i * 0.25; q.m.rotation.z = lean * 0.5; });
          for (let i = s.flying.length - 1; i >= 0; i--) {
            const f = s.flying[i]; f.life += dt;
            if (f.slide) { const q = f.q; if (q && !q.landed) { q.vy -= 28 * dt; f.m.position.y += q.vy * dt; if (f.m.position.y <= q.y) { f.m.position.y = q.y; q.landed = true; } } else if (q && f.life <= f.delay) f.m.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, dt * 12)); if (f.life > f.delay) { f.m.position.x += dt * 7; f.m.position.y += dt * 0.6; f.m.scale.multiplyScalar(1 - dt * 1.4); } }
            else { f.v.y -= 20 * dt; f.m.position.addScaledVector(f.v, dt); f.m.rotation.x += f.w.x * dt; f.m.rotation.z += f.w.z * dt; if (f.m.position.y < 0.05) { f.m.position.y = 0.05; f.v.multiplyScalar(0.4); f.v.y = Math.abs(f.v.y) * 0.3; } }
            if (f.life > 1.6 + (f.delay || 0)) { scene.remove(f.m); s.flying.splice(i, 1); }
          }
          // the doll reaches out to drop each layer, then stands back up
          s.reach = Math.max(0, s.reach - dt * 4);
          s.doll.setArms(-0.4 + s.reach * 0.9, Math.sin(t * 2 + s.x) * 0.05);
          s.doll.group.rotation.x = s.reach * 0.2;
          s.doll.update(dt);
        }
        for (const p of sizzle) p.position.y = 1.08 + Math.max(0, Math.sin(t * 9 + p.position.x * 3)) * 0.004;
        for (const s of smoke) { const k = (t * 0.25 + s.userData.p) % 1; s.position.set(-W * 0.18 + (s.userData.p - 0.5) * W * 0.4 + Math.sin(t + s.userData.p * 9) * 0.3, 1.2 + k * 2.6, -3.5); s.scale.setScalar(0.6 + k * 1.6); s.material.opacity = 0.35 * Math.sin(k * Math.PI); }
        for (let i = pops.length - 1; i >= 0; i--) {
          const q = pops[i]; q.life += dt;
          q.sp.position.set(q.s.x, 1.9 + q.life * 0.8, 1.0);
          q.sp.material.opacity = 1 - Math.max(0, q.life - 0.8) / 0.4;
          if (q.life > 1.2) { scene.remove(q.sp); pops.splice(i, 1); }
        }
        camera.position.set(camX + Math.sin(t * 0.25) * 0.4, 3.3, camZ);
        camera.lookAt(camX, 2.9, 0); // a touch right of centre, so the scoreboard doesn't cover the last ticket
      },
      input(p, m) { const s = stations.find((x) => x.p === p); if (s && ING[m.b]) place(s, m.b); },
      scores() { return Object.fromEntries(stations.map((s) => [s.p.id, s.score])); },
    };
  },
};
