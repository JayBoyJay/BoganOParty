// Distro Wars: Mr Lee's Linux LAN party has turned into a holy war. Everyone starts on their own distro
// (Arch, Ubuntu, Debian, Fedora...) and throws install USBs at everyone else. Three hits from the same
// distro and you've been reinstalled: you join that distro and fight for it from then on. Last distro
// standing wins (it's finally the year of the Linux desktop). Points for every convert you make, and
// for being on the biggest distro when time runs out.
import { makeDecor } from '../../host/decor.js';

const RW = 11.5, RD = 7.5; // half the room's width and depth
const RUN = 5.6;
const USB_V = 14, USB_RANGE = 12, THROW_CD = 0.55;
const HIT = 0.36; // install progress per hit (three hits does it)
const ROLL_T = 0.3, ROLL_CD = 1.6, ROLL_V = 13;
const SUDO_T = 6, WALL_T = 5;
const DOLL = 0.72, PR = 0.45;
const BTN = { THROW: 1, ROLL: 2 };

const DISTROS = [
  { name: 'Arch', col: '#1793d1', logo(g) { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(64, 14); g.lineTo(108, 110); g.quadraticCurveTo(64, 70, 20, 110); g.closePath(); g.fill(); } },
  { name: 'Ubuntu', col: '#e95420', logo(g) { g.strokeStyle = '#fff'; g.lineWidth = 12; g.beginPath(); g.arc(64, 64, 30, 0, 7); g.stroke(); g.fillStyle = '#fff'; for (let k = 0; k < 3; k++) { const a = k * 2.094 - 0.5; g.beginPath(); g.arc(64 + Math.cos(a) * 42, 64 + Math.sin(a) * 42, 13, 0, 7); g.fill(); } } },
  { name: 'Debian', col: '#d70a53', logo(g) { g.strokeStyle = '#fff'; g.lineWidth = 11; g.lineCap = 'round'; g.beginPath(); for (let k = 0; k < 60; k++) { const a = k * 0.17, r = 8 + k * 0.7; g.lineTo(64 + Math.cos(a) * r, 60 + Math.sin(a) * r); } g.stroke(); } },
  { name: 'Fedora', col: '#3c6eb4', logo(g) { g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 64, 44, 0, 7); g.fill(); g.strokeStyle = '#3c6eb4'; g.lineWidth = 12; g.lineCap = 'round'; g.beginPath(); g.moveTo(54, 100); g.lineTo(54, 50); g.quadraticCurveTo(54, 32, 74, 32); g.moveTo(40, 64); g.lineTo(76, 64); g.stroke(); } },
  { name: 'Mint', col: '#69b53f', logo(g) { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(64, 64, 26, 46, 0.7, 0, 7); g.fill(); g.strokeStyle = '#69b53f'; g.lineWidth = 6; g.beginPath(); g.moveTo(40, 92); g.lineTo(88, 36); g.stroke(); } },
  { name: 'Gentoo', col: '#54487a', logo(g) { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(68, 60, 42, 34, 0.5, 0, 7); g.fill(); g.fillStyle = '#54487a'; g.beginPath(); g.ellipse(80, 54, 12, 9, 0.5, 0, 7); g.fill(); } },
  { name: 'openSUSE', col: '#2f9a4a', logo(g) { g.strokeStyle = '#fff'; g.lineWidth = 12; g.lineCap = 'round'; g.beginPath(); g.arc(64, 70, 30, Math.PI * 0.9, Math.PI * 2.4); g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.arc(84, 52, 8, 0, 7); g.fill(); } },
  { name: 'Manjaro', col: '#35bf5c', logo(g) { g.fillStyle = '#fff'; g.fillRect(22, 22, 36, 84); g.fillRect(64, 22, 42, 36); g.fillRect(64, 64, 18, 42); g.fillRect(88, 64, 18, 42); } },
];

export default {
  id: 'distro-wars',
  name: 'Distro Wars',
  blurb: "Mr Lee's Linux LAN party. Throw install USBs and convert everyone to your distro. Last distro standing wins.",
  howTo: 'You start on your own Linux distro. Drag to move, THROW chucks an install USB the way you are facing, ROLL dodges. Three hits from the same distro and you get reinstalled: you join their side. Grab crates for sudo (triple throw) or a firewall (blocks USBs). Points for every convert and for being on the biggest distro at the end.',
  padText: 'Move, THROW USBs, ROLL to dodge',
  duration: 75,
  pad: { kind: 'stick', buttons: [{ bit: BTN.THROW, label: '💾 THROW', tone: 'go' }, { bit: BTN.ROLL, label: '🌀 ROLL' }] },

  create(mg) {
    const { THREE, kit, scene, players, rng, sfx } = mg;
    const n = players.length;

    // ----- the room: carpet tiles, beige computers, a server rack wall, and a big Tux -----
    scene.background = new THREE.Color(0x14161c);
    {
      const pm = new THREE.PMREMGenerator(mg.renderer), env = new THREE.Scene();
      env.add(new THREE.Mesh(new THREE.BoxGeometry(40, 20, 40), new THREE.MeshBasicMaterial({ color: 0x8a909a, side: THREE.BackSide })));
      for (let i = -1; i <= 1; i++) { const l = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.5), new THREE.MeshBasicMaterial({ color: 0xffffff })); l.position.set(i * 9, 9.5, 0); l.rotation.x = Math.PI / 2; env.add(l); }
      scene.environment = pm.fromScene(env, 0.04).texture; scene.environmentIntensity = 0.7; pm.dispose();
    }
    scene.add(new THREE.HemisphereLight(0xeef4ff, 0x40384a, 1.2));
    const key = new THREE.DirectionalLight(0xfff4e8, 2.4);
    key.position.set(-8, 22, 12); key.target.position.set(0, 0, 0); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -18, right: 18, top: 14, bottom: -14, near: 1, far: 60 });
    key.shadow.bias = -0.0005; key.shadow.normalBias = 0.04;
    scene.add(key, key.target);

    // office carpet tiles, the grey-blue kind
    const carpetC = document.createElement('canvas'); carpetC.width = carpetC.height = 256;
    {
      const g = carpetC.getContext('2d');
      for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) {
        g.fillStyle = (tx + ty) % 2 ? '#4a566a' : '#525e72'; g.fillRect(tx * 128, ty * 128, 128, 128);
        for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${rng() < 0.5 ? '255,255,255' : '0,0,0'},${0.05 + rng() * 0.08})`; const x = tx * 128 + rng() * 128, y = ty * 128 + rng() * 128; (tx + ty) % 2 ? g.fillRect(x, y, 1, 4) : g.fillRect(x, y, 4, 1); }
      }
    }
    const carpetT = new THREE.CanvasTexture(carpetC); carpetT.colorSpace = THREE.SRGBColorSpace; carpetT.wrapS = carpetT.wrapT = THREE.RepeatWrapping; carpetT.repeat.set((RW * 2 + 6) / 2, (RD * 2 + 8) / 2); carpetT.anisotropy = 8;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(RW * 2 + 6, RD * 2 + 8), new THREE.MeshStandardMaterial({ map: carpetT, roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    const D = makeDecor(kit);
    const put = (obj, x, z, rot = 0, y = 0) => { obj.position.set(x, y, z); obj.rotation.y = rot; scene.add(obj); return obj; };
    // the walls: painted plaster with a skirting board, windows with the blinds half down
    const wallM = kit.surf('render', { arg: 0xd8d4c8, unit: 3 });
    const skirt = kit.mat(0x6a5a4a, { roughness: 0.6 });
    kit.box(RW * 2 + 2, 3.2, 0.3, wallM, 0, 0, -RD - 0.6);
    kit.box(0.3, 3.2, RD * 2 + 1.5, wallM, -RW - 0.8, 0, 0); kit.box(0.3, 3.2, RD * 2 + 1.5, wallM, RW + 0.8, 0, 0);
    kit.box(RW * 2 + 1.4, 0.14, 0.04, skirt, 0, 0, -RD - 0.43);
    for (const s of [-1, 1]) kit.box(0.04, 0.14, RD * 2 + 1.2, skirt, s * (RW + 0.63), 0, 0);
    for (const x of [-4.2, 4.2]) put(D.blindWindow(2.2, 1.3), x, -RD - 0.45, 0, 1.1);
    kit.sign("MR LEE'S LINUX LAN PARTY", 6.2, 0.62, 0, 2.62, -RD - 0.43, undefined, { bg: '#111418', fg: '#5cff7a', font: '900 120px "Courier New", monospace' });
    // posters and a whiteboard of very serious plans
    const poster = (title, sub, bg, fg) => D.poster(0.8, 1.1, (g, W, H) => { g.fillStyle = bg; g.fillRect(0, 0, W, H); g.fillStyle = fg; g.textAlign = 'center'; g.font = '900 34px Impact, sans-serif'; g.fillText(title, W / 2, 90, W - 16); g.font = '700 18px system-ui'; g.fillText(sub, W / 2, 140, W - 16); g.beginPath(); g.arc(W / 2, 200, 26, 0, 7); g.fill(); });
    put(poster('I USE ARCH', 'btw', '#1793d1', '#ffffff'), -1.6, -RD - 0.44, 0, 1.0);
    put(poster('SUDO', 'make me a sandwich', '#2a2a2a', '#ffd23f'), -0.6, -RD - 0.44, 0, 1.0);
    put(D.whiteboard(2.2, 1.0, (g, W, H) => { g.strokeStyle = '#1a1a1a'; g.lineWidth = 4; g.font = '700 30px "Comic Sans MS", cursive'; g.fillStyle = '#1a1a1a'; g.fillText('LAN PARTY TODO', 30, 50); g.fillStyle = '#c02020'; g.fillText('1. install arch', 40, 100); g.fillText('2. ???', 40, 140); g.fillStyle = '#2040c0'; g.fillText('3. year of the linux desktop', 40, 180); g.strokeStyle = '#c02020'; g.beginPath(); g.moveTo(36, 92); g.lineTo(240, 92); g.stroke(); }), 1.4, -RD - 0.42, 0, 0.95);
    for (const [x, rot] of [[-RW - 0.62, Math.PI / 2], [RW + 0.62, -Math.PI / 2]]) put(D.blindWindow(2.6, 1.3), x, -1, rot, 1.1);
    // a rug in the middle so the floor isn't one flat colour
    {
      const rug = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 5), new THREE.MeshStandardMaterial({ map: D.canvasTex(512, 300, (g, W, H) => { g.fillStyle = '#6a2a2a'; g.fillRect(0, 0, W, H); g.strokeStyle = '#e8c87a'; g.lineWidth = 10; g.strokeRect(16, 16, W - 32, H - 32); g.lineWidth = 4; g.strokeRect(34, 34, W - 68, H - 68); for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`; g.fillRect(Math.random() * W, Math.random() * H, 3, 3); } }), roughness: 1 }));
      rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.006, 0.2); rug.receiveShadow = true; scene.add(rug);
    }

    // server racks along the back wall, with blinking lights
    const leds = [];
    for (const sx of [-1, 1]) for (let r = 0; r < 3; r++) put(D.serverRack({ leds }), sx * (7.4 + r * 0.66), -RD + 0.05);

    // a CRT terminal on each monitor
    const termTex = (lines) => D.canvasTex(256, 192, (g) => { g.fillStyle = '#0a140a'; g.fillRect(0, 0, 256, 192); g.fillStyle = '#5cff7a'; g.font = '700 17px "Courier New", monospace'; lines.forEach((l, i) => g.fillText(l, 10, 26 + i * 24)); });
    const TERMS = [['$ sudo pacman -Syu', ':: Starting full', '   system upgrade', 'I use Arch btw', '$ _'], ['$ sudo apt install', '  happiness', 'E: Unable to locate', '  package', '$ _'], ['$ vim', '$ how do i exit vim', '$ :q!', '$ :wq', '$ _'], ['$ make -j8', '[ 42%] Building C', '[ 97%] Linking', 'Segmentation fault', '$ _'], ['$ rm -rf node_mod', '$ npm install', 'added 1984 pkgs', '  in 6m', '$ _'], ['$ uptime', ' up 412 days', '$ cowsay moo', ' < moo >', '$ _']];
    const solids = []; // boxes nothing walks or throws through: [x0, z0, x1, z1]
    const chairCols = [0x233a5c, 0x5c2323, 0x2a4a2a, 0x3a3a3a];
    const desk = (x, z, rot) => {
      const g = kit.group(x, 0, z, rot);
      g.add(D.desk(3.0, 1.1));
      for (const mx of [-0.75, 0.75]) {
        const crt = D.crt({ screen: termTex(TERMS[(rng() * TERMS.length) | 0]), rot: (rng() - 0.5) * 0.3 }); crt.position.set(mx, 0.76, -0.12); crt.scale.setScalar(1.25); g.add(crt);
        const kb = D.keyboard({ rot: (rng() - 0.5) * 0.2 }); kb.position.set(mx - 0.05, 0.76, 0.32); g.add(kb);
        for (const side of [1, -1]) { const ch = D.officeChair({ color: chairCols[(rng() * 4) | 0], rot: side > 0 ? Math.PI + (rng() - 0.5) * 0.8 : (rng() - 0.5) * 0.8 }); ch.position.set(mx + (rng() - 0.5) * 0.2, 0, side * 0.95); if (side < 0) continue; g.add(ch); }
      }
      const c = D.can({ color: [0x1a8a3a, 0x1a1a1a, 0xc02020][(rng() * 3) | 0], label: ['ZAP', 'VOLT', 'RAGE'][(rng() * 3) | 0] }); c.position.set((rng() - 0.5) * 2.2, 0.76, 0.2 + rng() * 0.2); g.add(c);
      if (rng() < 0.6) { const pz = D.pizzaBox({ open: rng() < 0.5, rot: rng() }); pz.position.set(0, 0.76, 0.1); g.add(pz); }
      const hw = rot ? 0.6 : 1.55, hd = rot ? 1.55 : 0.6;
      solids.push([x - hw, z - hd, x + hw, z + hd]);
    };
    desk(-5.6, -2.8, 0); desk(5.6, -2.8, 0); desk(-5.6, 3.2, 0); desk(5.6, 3.2, 0); desk(0, 0.2, 0);
    // network cables between the desks and the racks, and the odd bit of clutter
    for (const [a, b, c] of [[[-5.6, -2.2], [-7.4, -RD + 0.5], 0x2a5aa8], [[5.6, -2.2], [7.4, -RD + 0.5], 0xe8c020], [[0, 0.8], [-5.6, 2.6], 0x2a5aa8], [[0, 0.8], [5.6, 2.6], 0xc02a2a], [[-5.6, 3.8], [-5.6, -2.2], 0xe8c020]]) scene.add(D.floorCable(a, b, c, rng() * 10));
    for (const [x, z, col] of [[RW - 1.0, RD - 0.7, 0x8a2a4a], [RW - 2.2, RD - 0.5, 0x2a5a8a], [-RW + 1.0, RD - 0.8, 0x3a6a2a]]) put(D.beanbag({ color: col }), x, z, rng() * 6);
    for (const [x, z] of [[RW - 0.5, -RD + 0.4], [-RW + 0.5, 1.2]]) put(D.pottedPlant({ size: 1.6 }), x, z);
    put(D.bin(), RW - 0.4, -0.6); put(D.bin({ color: 0x2a6a3a }), -RW + 0.4, -3.0);
    for (let k = 0; k < 4; k++) put(D.pizzaBox({ rot: k * 0.2 }), -RW + 0.8, -1.2, 0, k * 0.05);
    put(D.esky({ color: 0xc02a2a }), RW - 1.4, 2.0, -0.4);
    solids.push([RW - 2.9, RD - 1.3, RW - 0.4, RD], [-RW + 0.3, RD - 1.4, -RW + 1.6, RD]);
    // a big inflatable Tux in the corner, because of course
    {
      const t = kit.group(-RW + 1.6, 0, -RD + 1.6, 0.5);
      const blk = kit.mat(0x1a1a1e, { roughness: 0.3 }), wht = kit.mat(0xf4f4f0, { roughness: 0.35 }), org = kit.mat(0xf0a020, { roughness: 0.35 });
      const body = kit.ball(1, blk, 0, 1.25, 0, t); body.scale.set(1, 1.25, 0.9);
      const belly = kit.ball(0.85, wht, 0, 1.1, 0.22, t); belly.scale.set(0.95, 1.2, 0.85);
      kit.ball(0.68, blk, 0, 2.75, 0, t);
      for (const ex of [-0.22, 0.22]) { kit.ball(0.17, wht, ex, 2.9, 0.53, t); kit.ball(0.08, blk, ex, 2.9, 0.68, t); }
      const beak = kit.ball(0.22, org, 0, 2.62, 0.6, t); beak.scale.set(1.3, 0.6, 1.2);
      for (const fx of [-0.45, 0.45]) { const f = kit.ball(0.32, org, fx, 0.1, 0.4, t); f.scale.set(1.2, 0.35, 1.5); }
      for (const wx of [-1, 1]) { const w = kit.ball(0.4, blk, wx * 0.98, 1.4, 0, t); w.scale.set(0.35, 1.2, 0.7); w.rotation.z = wx * 0.3; }
      solids.push([-RW + 0.4, -RD + 0.4, -RW + 2.8, -RD + 2.8]);
    }

    // ----- the players -----
    const logoCache = new Map();
    const tagCanvas = (d) => { const c = document.createElement('canvas'); c.width = 128; c.height = 128; const g = c.getContext('2d'); g.fillStyle = DISTROS[d].col; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill(); DISTROS[d].logo(g); return c; };
    const logoTex = (d) => { if (!logoCache.has(d)) { const t = new THREE.CanvasTexture(tagCanvas(d)); t.colorSpace = THREE.SRGBColorSpace; logoCache.set(d, t); } return logoCache.get(d); };
    const pops = [];
    const pop = (x, y, z, text, color, size = 1) => {
      const c = document.createElement('canvas'); c.width = 768; c.height = 160;
      const g = c.getContext('2d'); g.font = '900 92px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 14; g.strokeStyle = '#0d0d12'; g.strokeText(text, 384, 84, 750); g.fillStyle = color; g.fillText(text, 384, 84, 750);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); sp.scale.set(4.8 * size, 1 * size, 1); sp.renderOrder = 20;
      sp.position.set(x, y, z); scene.add(sp); pops.push({ sp, life: 0, stay: size > 1.5 });
    };
    const spawnAt = (i) => { const a = (i / n) * Math.PI * 2 + 0.4; return [Math.cos(a) * (RW - 2.5), Math.sin(a) * (RD - 2.2)]; };
    const fighters = players.map((p, i) => {
      const doll = mg.makeDoll(p, { scale: DOLL });
      scene.add(doll.group);
      const [x, z] = spawnAt(i);
      // the distro badge over their head, and an install bar under it
      const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: logoTex(i % DISTROS.length), depthTest: false })); badge.scale.set(0.75, 0.75, 1); badge.renderOrder = 15; scene.add(badge);
      const barBg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x111111, depthTest: false })); barBg.scale.set(1.1, 0.14, 1); barBg.renderOrder = 15; scene.add(barBg);
      const bar = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffffff, depthTest: false })); bar.center.set(0, 0.5); bar.scale.set(0.001, 0.1, 1); bar.renderOrder = 16; scene.add(bar);
      // a ring on the floor in the distro's colour, with a pointer for which way you'll throw
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.72, 32), new THREE.MeshBasicMaterial({ color: DISTROS[i % DISTROS.length].col, transparent: true, opacity: 0.85 }));
      ring.rotation.x = -Math.PI / 2; scene.add(ring);
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 3), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }));
      arrow.rotation.x = Math.PI / 2; const arrowG = new THREE.Group(); arrowG.add(arrow); arrow.position.z = 1.05; scene.add(arrowG);
      const shield = new THREE.Mesh(new THREE.SphereGeometry(1.0, 24, 16), new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.28, depthWrite: false })); shield.visible = false; scene.add(shield);
      return { p, doll, x, z, vx: 0, vz: 0, fx: -x, fz: -z, distro: i % DISTROS.length, home: i % DISTROS.length, inst: { d: -1, v: 0 }, badge, barBg, bar, ring, arrowG, shield,
        cd: 0, rollT: 0, rollCd: 0, sudo: 0, wall: 0, bob: 0, input: { x: 0, y: 0, held: 0 }, converts: 0, convertedT: 0,
        bot: p.bot ? { think: 0, mx: 0, mz: 0, strafe: rng() < 0.5 ? 1 : -1, aimErr: 0.08 + rng() * 0.12, target: null } : null };
    });
    const norm = (f) => { const l = Math.hypot(f.fx, f.fz) || 1; f.fx /= l; f.fz /= l; };
    fighters.forEach(norm);
    const setDistro = (f, d) => { f.distro = d; f.badge.material.map = logoTex(d); f.badge.material.needsUpdate = true; f.ring.material.color.set(DISTROS[d].col); };

    // ----- install USBs -----
    const usbs = [];
    const usbGeo = new THREE.BoxGeometry(0.42, 0.1, 0.18), plugGeo = new THREE.BoxGeometry(0.16, 0.07, 0.14);
    const plugM = kit.mat(0xd0d4d8, { metalness: 0.9, roughness: 0.2 });
    const usbMats = DISTROS.map((d) => kit.mat(d.col, { roughness: 0.35, emissive: d.col, emissiveIntensity: 0.35 }));
    const throwUsb = (f, ang = 0) => {
      const c = Math.cos(ang), s = Math.sin(ang), dx = f.fx * c - f.fz * s, dz = f.fx * s + f.fz * c;
      const m = new THREE.Group();
      const b = new THREE.Mesh(usbGeo, usbMats[f.distro]); b.castShadow = true; m.add(b);
      const pl = new THREE.Mesh(plugGeo, plugM); pl.position.x = 0.28; m.add(pl);
      m.position.set(f.x + dx * 0.6, 1.0, f.z + dz * 0.6); scene.add(m);
      usbs.push({ m, x: m.position.x, z: m.position.z, dx, dz, d: f.distro, from: f, left: USB_RANGE });
    };
    const fire = (f) => {
      if (f.cd > 0 || f.rollT > 0) return;
      f.cd = f.sudo > 0 ? THROW_CD * 0.7 : THROW_CD;
      if (f.sudo > 0) { throwUsb(f, -0.22); throwUsb(f, 0); throwUsb(f, 0.22); } else throwUsb(f);
      f.doll.setArms(1.4, 0.4); f.armT = 0.18;
      sfx.play('whoosh');
    };
    const roll = (f) => {
      if (f.rollCd > 0) return;
      let mx = f.vx, mz = f.vz; const l = Math.hypot(mx, mz);
      if (l < 0.5) { mx = f.fx; mz = f.fz; } else { mx /= l; mz /= l; }
      f.rollT = ROLL_T; f.rollCd = ROLL_CD; f.rdx = mx; f.rdz = mz;
      sfx.play('boing');
    };

    // ----- crates: sudo and a firewall -----
    const crates = [];
    const crateTex = (label, col) => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = col; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#111'; g.lineWidth = 8; g.strokeRect(4, 4, 120, 120); g.fillStyle = '#111'; g.font = '900 34px "Courier New", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, 64, 66, 116); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
    const crateMats = { sudo: new THREE.MeshStandardMaterial({ map: crateTex('sudo', '#ffd23f'), roughness: 0.6 }), wall: new THREE.MeshStandardMaterial({ map: crateTex('iptables', '#ff8a3d'), roughness: 0.6 }) };
    const blocked = (x, z, r = 0) => solids.some(([a, b, c, d]) => x > a - r && x < c + r && z > b - r && z < d + r);
    const dropCrate = () => {
      for (let tries = 0; tries < 20; tries++) {
        const x = (rng() * 2 - 1) * (RW - 1.5), z = (rng() * 2 - 1) * (RD - 1.5);
        if (blocked(x, z, 0.8)) continue;
        const kind = rng() < 0.55 ? 'sudo' : 'wall';
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), crateMats[kind]); m.castShadow = true; m.position.set(x, 0.5, z); scene.add(m);
        crates.push({ m, x, z, kind }); return;
      }
    };
    let crateT = 3;

    const collide = (f) => {
      f.x = Math.max(-RW + PR, Math.min(RW - PR, f.x)); f.z = Math.max(-RD + PR, Math.min(RD - PR, f.z));
      for (const [a, b, c, d] of solids) {
        if (f.x > a - PR && f.x < c + PR && f.z > b - PR && f.z < d + PR) {
          const pushes = [[f.x - (a - PR), 'x', a - PR], [(c + PR) - f.x, 'x', c + PR], [f.z - (b - PR), 'z', b - PR], [(d + PR) - f.z, 'z', d + PR]];
          pushes.sort((u, v) => u[0] - v[0]); f[pushes[0][1]] = pushes[0][2];
        }
      }
    };

    const counts = () => { const c = new Array(DISTROS.length).fill(0); fighters.forEach((f) => c[f.distro]++); return c; };
    const sparks = [];
    const burst = (x, z, col) => {
      for (let i = 0; i < 14; i++) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), new THREE.MeshBasicMaterial({ color: col }));
        m.position.set(x, 1.2, z); scene.add(m);
        const a = rng() * Math.PI * 2; sparks.push({ m, vx: Math.cos(a) * (2 + rng() * 3), vy: 2 + rng() * 3, vz: Math.sin(a) * (2 + rng() * 3), life: 0 });
      }
    };

    // ----- CPU players -----
    const botThink = (f, dt) => {
      const B = f.bot;
      B.think -= dt;
      const foes = fighters.filter((o) => o.distro !== f.distro);
      if (B.think <= 0) {
        B.think = 0.25 + rng() * 0.25;
        B.target = foes.sort((a, b) => Math.hypot(a.x - f.x, a.z - f.z) - Math.hypot(b.x - f.x, b.z - f.z))[0] || null;
        if (rng() < 0.08) B.strafe *= -1;
        B.crate = crates.find((c) => Math.hypot(c.x - f.x, c.z - f.z) < 5) || null;
      }
      let mx = 0, mz = 0;
      const T = B.target;
      if (B.crate && crates.includes(B.crate)) { mx = B.crate.x - f.x; mz = B.crate.z - f.z; }
      else if (T) {
        const dx = T.x - f.x, dz = T.z - f.z, d = Math.hypot(dx, dz) || 1;
        const want = d > 6.5 ? 1 : d < 4 ? -0.7 : 0;
        mx = dx / d * want - dz / d * B.strafe * 0.7; mz = dz / d * want + dx / d * B.strafe * 0.7;
        // aim (leading the target a little, with a wobbly hand) and throw
        const tt = d / USB_V, ax = T.x + T.vx * tt * 0.6 - f.x, az = T.z + T.vz * tt * 0.6 - f.z, al = Math.hypot(ax, az) || 1;
        const e = (rng() - 0.5) * B.aimErr * 2, c = Math.cos(e), s = Math.sin(e);
        if (d < 10 && f.cd <= 0 && rng() < dt * 3) { f.fx = (ax * c - az * s) / al; f.fz = (ax * s + az * c) / al; fire(f); }
      }
      // dodge a USB coming straight at us, now and then
      if (f.rollCd <= 0) for (const u of usbs) if (u.d !== f.distro) { const rx = f.x - u.x, rz = f.z - u.z, along = rx * u.dx + rz * u.dz, perp = Math.abs(rx * u.dz - rz * u.dx); if (along > 0 && along < 3 && perp < 0.7 && rng() < 0.25) { f.vx = -u.dz * RUN; f.vz = u.dx * RUN; roll(f); break; } }
      // steer round desks
      if (blocked(f.x + mx * 0.8, f.z + mz * 0.8, PR)) { const t = mx; mx = -mz * B.strafe; mz = t * B.strafe; }
      return { x: mx, z: mz };
    };

    const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.5, 200);
    camera.position.set(0, 17.4, 15.4);
    camera.lookAt(0, 0, 0.6);

    let tAll = 0, finishAt = null;
    return {
      camera,
      update(dt, t, running) {
        tAll += dt;
        if (running && finishAt == null) { crateT -= dt; if (crateT <= 0) { crateT = 5 + rng() * 3; if (crates.length < 3) dropCrate(); } }
        for (const f of fighters) {
          let mx = 0, mz = 0;
          if (running && finishAt == null) {
            if (f.bot) { const m = botThink(f, dt); mx = m.x; mz = m.z; }
            else { mx = f.input.x; mz = -f.input.y; }
          }
          const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
          if (!f.bot && ml > 0.25) { f.fx = mx; f.fz = mz; norm(f); } // humans throw the way they're moving
          if (f.rollT > 0) { f.rollT -= dt; f.vx = f.rdx * ROLL_V; f.vz = f.rdz * ROLL_V; }
          else { f.vx += (mx * RUN - f.vx) * Math.min(1, dt * 10); f.vz += (mz * RUN - f.vz) * Math.min(1, dt * 10); }
          f.x += f.vx * dt; f.z += f.vz * dt;
          collide(f);
          f.cd = Math.max(0, f.cd - dt); f.rollCd = Math.max(0, f.rollCd - dt); f.sudo = Math.max(0, f.sudo - dt); f.wall = Math.max(0, f.wall - dt);
          f.inst.v = Math.max(0, f.inst.v - dt * 0.06);
          for (let i = crates.length - 1; i >= 0; i--) {
            const c = crates[i];
            if (Math.hypot(c.x - f.x, c.z - f.z) < 0.9) {
              scene.remove(c.m); crates.splice(i, 1); sfx.play('item');
              if (c.kind === 'sudo') { f.sudo = SUDO_T; pop(f.x, 3.2, f.z, 'SUDO!', '#ffd23f', 0.7); } else { f.wall = WALL_T; pop(f.x, 3.2, f.z, 'FIREWALL UP', '#ff8a3d', 0.7); }
            }
          }
          // drawing
          const sp = Math.hypot(f.vx, f.vz);
          f.bob += dt * sp * 3;
          const spin = f.rollT > 0 ? (1 - f.rollT / ROLL_T) * Math.PI * 2 : 0;
          f.doll.group.position.set(f.x, Math.abs(Math.sin(f.bob)) * 0.1 * Math.min(1, sp / RUN), f.z);
          f.doll.group.rotation.y = spin + Math.max(-0.5, Math.min(0.5, f.vx * 0.08));
          if (f.armT > 0) f.armT -= dt; else f.doll.setArms(0.15 + Math.sin(f.bob) * 0.2 * Math.min(1, sp / RUN), 0);
          f.doll.update(dt);
          f.badge.position.set(f.x, 3.05, f.z); f.barBg.position.set(f.x, 3.55, f.z);
          const show = f.inst.v > 0.01;
          f.barBg.visible = f.bar.visible = show;
          if (show) { f.bar.position.set(f.x - 0.53, 3.55, f.z); f.bar.scale.x = 1.06 * Math.min(1, f.inst.v); f.bar.material.color.set(DISTROS[f.inst.d].col); }
          f.ring.position.set(f.x, 0.03, f.z);
          f.arrowG.position.set(f.x, 0.04, f.z); f.arrowG.rotation.y = Math.atan2(f.fx, f.fz);
          f.shield.visible = f.wall > 0; if (f.shield.visible) { f.shield.position.set(f.x, 1.0, f.z); f.shield.material.opacity = 0.2 + Math.sin(tAll * 10) * 0.08; }
          f.convertedT = Math.max(0, f.convertedT - dt);
        }
        // shoving apart
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
          const a = fighters[i], b = fighters[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
          if (d > 0.001 && d < PR * 2) { const k = (PR * 2 - d) / 2; a.x -= dx / d * k; a.z -= dz / d * k; b.x += dx / d * k; b.z += dz / d * k; }
        }
        // USBs flying
        for (let i = usbs.length - 1; i >= 0; i--) {
          const u = usbs[i], step = USB_V * dt;
          u.x += u.dx * step; u.z += u.dz * step; u.left -= step;
          u.m.position.set(u.x, 1.0, u.z); u.m.rotation.y += dt * 14;
          let gone = u.left <= 0 || Math.abs(u.x) > RW + 0.5 || Math.abs(u.z) > RD + 0.5 || blocked(u.x, u.z);
          if (!gone) for (const f of fighters) {
            if (f.distro === u.d || f.rollT > 0 || Math.hypot(f.x - u.x, f.z - u.z) > 0.7) continue;
            gone = true;
            if (f.wall > 0) { sfx.play('bonk'); pop(f.x, 2.9, f.z, 'BLOCKED', '#ff8a3d', 0.6); break; }
            if (f.inst.d !== u.d) f.inst = { d: u.d, v: 0 };
            f.inst.v += HIT; f.doll.flinch(); sfx.play('bonk');
            f.vx += u.dx * 5; f.vz += u.dz * 5;
            if (f.inst.v >= 0.999) {
              // reinstalled
              setDistro(f, u.d); f.inst = { d: -1, v: 0 }; f.convertedT = 1; f.wall = 1.2; // a moment to get your bearings
              u.from.converts++;
              burst(f.x, f.z, DISTROS[u.d].col);
              pop(f.x, 3.4, f.z, `${f.p.name} → ${DISTROS[u.d].name}`, DISTROS[u.d].col, 0.75);
              sfx.play('teleport');
              const c = counts();
              if (finishAt == null && c.filter((k) => k > 0).length === 1) {
                finishAt = tAll; sfx.play('hallelujah');
                pop(0, 6, 2, `YEAR OF THE ${DISTROS[u.d].name.toUpperCase()} DESKTOP!`, DISTROS[u.d].col, 1.6);
              }
            }
            break;
          }
          if (gone) { scene.remove(u.m); usbs.splice(i, 1); }
        }
        for (let k = 0; k < leds.length; k++) leds[k].material.emissiveIntensity = Math.sin(tAll * (2 + (k * 7) % 9) + k) > -0.3 ? 3.5 : 0.2;
        for (const c of crates) { c.m.rotation.y += dt; c.m.position.y = 0.5 + Math.sin(tAll * 3 + c.x) * 0.1; }
        for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i]; s.life += dt; s.vy -= 9 * dt; s.m.position.x += s.vx * dt; s.m.position.y = Math.max(0.05, s.m.position.y + s.vy * dt); s.m.position.z += s.vz * dt; if (s.life > 1.2) { scene.remove(s.m); sparks.splice(i, 1); } }
        for (let i = pops.length - 1; i >= 0; i--) { const q = pops[i]; q.life += dt; if (q.stay) { q.sp.material.opacity = Math.min(1, q.life * 3); continue; } q.sp.position.y += dt * 1.0; q.sp.material.opacity = Math.min(1, 2.4 - q.life * 2); if (q.life > 1.2) { scene.remove(q.sp); pops.splice(i, 1); } }
      },
      input(p, m) {
        const f = fighters.find((x) => x.p === p);
        if (!f || m.b !== 'stick') return;
        const held = Number(m.h) || 0, newly = held & ~f.input.held;
        f.input.x = Math.max(-1, Math.min(1, Number(m.x) || 0)); f.input.y = Math.max(-1, Math.min(1, Number(m.y) || 0)); f.input.held = held;
        if (finishAt != null) return;
        if (newly & BTN.THROW) fire(f);
        if (newly & BTN.ROLL) roll(f);
      },
      // 10 a convert, 40 for being on the biggest distro, 15 if you never got converted
      scores() {
        const c = counts(), top = Math.max(...c);
        return Object.fromEntries(fighters.map((f) => [f.p.id, f.converts * 10 + (c[f.distro] === top ? 40 : 0) + (f.distro === f.home ? 15 : 0)]));
      },
      done: () => finishAt != null && tAll - finishAt > 3.5,
    };
  },
};
