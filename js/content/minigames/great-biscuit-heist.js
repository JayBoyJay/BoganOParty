// The Great Biscuit Heist: Myles is passed out on the couch after a big one, and the Scotch Fingers
// are right in front of him. Push the slider up to creep in (higher is faster), nick a biscuit, then sneak it all the way back to
// the front door for a point. Then go again. When he snorts and stirs, stop: if he rolls over and sees
// anyone moving, OI! Back to the door you go, and any biscuit you were carrying stays behind.
// Red light, green light, but it's a bloke on a mustard couch.
import { mergeGeometries } from '../../../vendor/BufferGeometryUtils.js';
import { makeDecor } from '../../host/decor.js';

const LANE = 1.5; // metres per lane
const DOLL = 0.68; // player doll scale (Myles is 0.95, so he's a big unit)
const START_Z = 4.5, GRAB_Z = -5.4; // the front door line, and where the biscuit plate is
const FRONT_Z = START_Z + 2.5, BACK_Z = -14, LEN = FRONT_Z - BACK_Z, MID_Z = (FRONT_Z + BACK_Z) / 2;
const MAXV = 2.0; // metres a second with the slider right up
const STILL = 0.12; // slower than this and Myles won't notice you
const GRACE = 0.3; // after he looks, a moment to stop dead
const SEAT_Y = 0.85, COUCH_Z = -9.2;

// Myles' face: printed like the players' dolls, with a mullet, a mo and a five o'clock shadow
function mylesFace(mood) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#e8b48e'; g.fillRect(0, 0, 256, 256);
  // stubble
  for (let i = 0; i < 2600; i++) { const a = Math.random() * Math.PI, r = 60 + Math.random() * 70; const x = 128 + Math.cos(a) * r * 0.9, y = 120 + Math.sin(a) * r; g.fillStyle = 'rgba(70,45,30,0.35)'; g.fillRect(x, y, 1.6, 1.6); }
  g.lineCap = 'round'; g.strokeStyle = '#2a1a12'; g.fillStyle = '#2a1a12';
  if (mood === 'asleep') {
    g.lineWidth = 8;
    for (const x of [92, 164]) { g.beginPath(); g.arc(x, 100, 18, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); }
    // mouth hanging open, a bit of drool
    g.fillStyle = '#5a1c22'; g.beginPath(); g.ellipse(128, 186, 26, 20, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(190,230,255,0.85)'; g.beginPath(); g.ellipse(150, 212, 5, 12, 0, 0, 7); g.fill();
  } else {
    // eyes wide open, bloodshot
    for (const x of [92, 164]) {
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x, 102, 24, 22, 0, 0, 7); g.fill();
      g.strokeStyle = 'rgba(220,40,40,0.7)'; g.lineWidth = 2;
      for (let k = 0; k < 6; k++) { const a = k * 1.05; g.beginPath(); g.moveTo(x + Math.cos(a) * 22, 102 + Math.sin(a) * 20); g.lineTo(x + Math.cos(a + 0.3) * 12, 102 + Math.sin(a + 0.3) * 11); g.stroke(); }
      g.fillStyle = '#3a6a3a'; g.beginPath(); g.arc(x + 3, 104, 10, 0, 7); g.fill();
      g.fillStyle = '#000'; g.beginPath(); g.arc(x + 3, 104, 5, 0, 7); g.fill();
    }
    // brows down, teeth gritted
    g.strokeStyle = '#3a2416'; g.lineWidth = 12;
    g.beginPath(); g.moveTo(62, 66); g.lineTo(114, 82); g.moveTo(194, 66); g.lineTo(142, 82); g.stroke();
    g.fillStyle = '#fff'; g.fillRect(98, 176, 60, 20); g.strokeStyle = '#2a1a12'; g.lineWidth = 4; g.strokeRect(98, 176, 60, 20);
    g.beginPath(); for (let x = 113; x < 158; x += 15) { g.moveTo(x, 176); g.lineTo(x, 196); } g.stroke();
  }
  // the mo
  g.fillStyle = '#5a3a20'; g.beginPath(); g.moveTo(84, 168); g.quadraticCurveTo(128, 140, 172, 168); g.quadraticCurveTo(128, 158, 84, 168); g.fill();
  // business up front
  g.fillStyle = '#6b4526'; g.beginPath(); g.moveTo(0, 0); g.lineTo(256, 0); g.lineTo(256, 120); g.quadraticCurveTo(220, 50, 128, 48); g.quadraticCurveTo(36, 50, 0, 120); g.closePath(); g.fill();
  return c.toDataURL('image/png');
}

export default {
  id: 'great-biscuit-heist',
  name: 'The Great Biscuit Heist',
  blurb: "Myles is asleep on the couch, guarding the Scotch Fingers. Nick one and get it back to the door.",
  howTo: "Slide up to sneak: the higher, the faster. Get to the plate, grab a Scotch Finger, and sneak it back to the front door for a point, then go again. When Myles snorts and stirs, drag it right down and STOP. If he rolls over and sees you move, you're sent back to the door and lose the biscuit.",
  padText: 'Slide up to sneak. Drop it when he stirs!',
  duration: 75,
  pad: { kind: 'slider', thumb: '🤫', start: 0, hint: 'Up = sneak faster. Down = freeze' },

  create(mg) {
    const { THREE, kit, scene, players, rng, renderer } = mg;
    const n = players.length, W = Math.max(7.5, n * LANE + 1.5), RW = W + 3; // lanes, then the room's width
    const laneX = (i) => (i - (n - 1) / 2) * LANE;

    // ----- the lounge room, at night -----
    scene.background = new THREE.Color(0x07070c);
    // a dim room for reflections: warm walls, one bright window
    mg.env((env) => {
      env.add(new THREE.Mesh(new THREE.BoxGeometry(20, 8, 20), new THREE.MeshBasicMaterial({ color: 0x3a2a1e, side: THREE.BackSide })));
      const win = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), new THREE.MeshBasicMaterial({ color: 0x9fb4ff })); win.position.set(0, 2, 9.9); win.rotation.y = Math.PI; env.add(win);
    }, 0.04);
    scene.environmentIntensity = 1.0;
    scene.add(new THREE.HemisphereLight(0xb0a0c0, 0x4a3020, 0.9));
    // the ceiling light: a single bulb, dim and orange
    const bulb = new THREE.SpotLight(0xffc98a, 320, 40, 1.1, 0.7, 1.3);
    bulb.position.set(0, 7.5, 1); bulb.target.position.set(0, 0, 0);
    bulb.castShadow = true; bulb.shadow.mapSize.set(2048, 2048); bulb.shadow.bias = -0.0004; bulb.shadow.normalBias = 0.03;
    scene.add(bulb, bulb.target);

    const D = makeDecor(kit);
    const put = (obj, x, y, z, rot = 0) => { obj.position.set(x, y, z); obj.rotation.y = rot; scene.add(obj); return obj; };
    // short-pile carpet in a muted brown, the kind every rental had, and a patterned rug down the middle
    const carpetTex = D.canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#6e5b44'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 26000; i++) { const v = rng(); g.fillStyle = v < 0.5 ? `rgba(40,28,16,${0.08 + rng() * 0.1})` : `rgba(190,160,120,${0.05 + rng() * 0.08})`; g.fillRect(rng() * w, rng() * h, 1.5, 1.5); }
    });
    carpetTex.wrapS = carpetTex.wrapT = THREE.RepeatWrapping; carpetTex.repeat.set(RW / 2, LEN / 2);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(RW, LEN), new THREE.MeshStandardMaterial({ map: carpetTex, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2; floor.position.z = MID_Z; floor.receiveShadow = true;
    scene.add(floor);
    {
      const rw = Math.min(RW - 3, W + 1.6), rl = LEN - 9;
      const rug = new THREE.Mesh(new THREE.PlaneGeometry(rw, rl), new THREE.MeshStandardMaterial({ roughness: 1, map: D.canvasTex(512, 1024, (g, w, h) => {
        g.fillStyle = '#7a2e22'; g.fillRect(0, 0, w, h);
        g.strokeStyle = '#d8b46a'; g.lineWidth = 14; g.strokeRect(22, 22, w - 44, h - 44);
        g.strokeStyle = '#2a3a5a'; g.lineWidth = 26; g.strokeRect(58, 58, w - 116, h - 116);
        g.strokeStyle = '#d8b46a'; g.lineWidth = 6; g.strokeRect(84, 84, w - 168, h - 168);
        // a big central medallion and corner flourishes, Persian-ish
        g.fillStyle = '#2a3a5a'; g.beginPath(); g.ellipse(w / 2, h / 2, 130, 230, 0, 0, 7); g.fill();
        g.fillStyle = '#d8b46a'; g.beginPath(); g.ellipse(w / 2, h / 2, 80, 150, 0, 0, 7); g.fill();
        g.fillStyle = '#7a2e22'; g.beginPath(); g.ellipse(w / 2, h / 2, 40, 80, 0, 0, 7); g.fill();
        for (const [cx, cy] of [[110, 110], [w - 110, 110], [110, h - 110], [w - 110, h - 110]]) { g.fillStyle = '#2a3a5a'; g.beginPath(); g.arc(cx, cy, 34, 0, 7); g.fill(); }
        for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(0,0,0,${rng() * 0.12})`; g.fillRect(rng() * w, rng() * h, 2, 2); }
      }) }));
      rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.008, (START_Z + COUCH_Z) / 2 + 0.6); rug.receiveShadow = true; scene.add(rug);
    }
    // walls: painted plaster above, timber panelling below a dado rail, skirting and cornice
    const plaster = kit.surf('render', { arg: 0xc9b48e, unit: 2.5 });
    const panelM = kit.surf('planks', { unit: 1.4, tint: 0x8a5e3e });
    const trimM = kit.mat(0x4a2e1a, { roughness: 0.5 });
    kit.box(RW, 3.6, 0.2, plaster, 0, 0, FRONT_Z + 0.1);
    for (const s of [-1, 1]) {
      kit.box(0.2, 3.6, LEN, plaster, s * RW / 2, 0, MID_Z).receiveShadow = true;
      kit.box(0.05, 1.05, LEN, panelM, s * (RW / 2 - 0.12), 0, MID_Z);
      kit.box(0.09, 0.07, LEN, trimM, s * (RW / 2 - 0.14), 1.05, MID_Z); // dado rail
      kit.box(0.08, 0.14, LEN, trimM, s * (RW / 2 - 0.15), 0, MID_Z); // skirting
      kit.box(0.14, 0.12, LEN, kit.mat(0xe8dcc4), s * (RW / 2 - 0.16), 3.48, MID_Z); // cornice
    }
    kit.box(RW, 1.05, 0.05, panelM, 0, 0, FRONT_Z - 0.02);
    kit.box(RW, 0.07, 0.09, trimM, 0, 1.05, FRONT_Z - 0.04);
    // the front wall: the door, the telly on its cabinet
    const front = kit.group(0, 0, FRONT_Z - 0.06);
    {
      const door = kit.group(-RW / 2 + 2.2, 0, 0, Math.PI, 1, front);
      door.add(D.bx(new THREE.Group(), 1.0, 2.1, 0.06, kit.surf('planks', { unit: 1, tint: 0x7a4a28 }), 0, 0, 0, 0.01).parent || new THREE.Group());
      kit.box(1.1, 2.15, 0.06, kit.surf('planks', { unit: 1, tint: 0x7a4a28 }), 0, 0, 0, door);
      for (const [y, h] of [[0.15, 0.8], [1.1, 0.85]]) kit.box(0.8, h, 0.03, kit.surf('planks', { unit: 1, tint: 0x6a3e20 }), 0, y, 0.04, door);
      for (const s of [-1, 1]) kit.box(0.08, 2.25, 0.1, trimM, s * 0.6, 0, 0.02, door);
      kit.box(1.28, 0.08, 0.1, trimM, 0, 2.17, 0.02, door);
      kit.ball(0.05, kit.mat(0xd8b04a, { metalness: 1, roughness: 0.25 }), 0.4, 1.05, 0.09, door);
    }
    const screenTex = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 160; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return { c, t }; })();
    {
      const tv = kit.group(1.8, 0, -0.45, Math.PI, 1, front);
      const cab = D.desk(2.6, 0.6, { top: 0x5a3a22, legs: 0x3a2416 }); cab.scale.set(1, 0.75, 1); tv.add(cab);
      D.bx(tv, 2.5, 0.42, 0.55, kit.surf('planks', { unit: 1, tint: 0x5a3a22 }), 0, 0.08, 0, 0.02); // cupboards
      for (const s of [-1, 1]) D.bx(tv, 1.18, 0.36, 0.02, kit.surf('planks', { unit: 1, tint: 0x4a2e18 }), s * 0.62, 0.11, 0.28, 0.01);
      const crt = D.crt({ screen: screenTex.t }); crt.scale.setScalar(3.2); crt.position.set(0, 0.56, -0.05); tv.add(crt);
      const vcr = D.bx(tv, 0.7, 0.12, 0.4, 0x1c1c1e, -0.85, 0.56, 0.02, 0.01);
      void vcr;
      const plant = D.pottedPlant({ size: 1.4 }); plant.position.set(1.0, 0.56, 0); tv.add(plant);
    }
    const tvGlow = new THREE.PointLight(0x7fa8ff, 6, 12, 1.6); tvGlow.position.set(1.8, 1.4, -1.6); front.add(tvGlow);
    const drawTv = (t) => {
      // the cricket highlights, on mute: green oval, a pitch, a scoreline
      const g = screenTex.c.getContext('2d');
      g.fillStyle = '#2e7a34'; g.fillRect(0, 0, 256, 160);
      g.fillStyle = '#c9b27a'; g.fillRect(110 + Math.sin(t * 0.3) * 30, 40, 36, 90);
      g.fillStyle = '#fff'; g.fillRect(124 + Math.sin(t * 0.3) * 30 + Math.sin(t * 5) * 6, 70, 6, 14);
      g.fillStyle = 'rgba(0,0,40,0.8)'; g.fillRect(0, 128, 256, 32);
      g.fillStyle = '#fff'; g.font = '700 20px system-ui, sans-serif'; g.fillText(`AUS 4/${280 + Math.floor(t / 4)}`, 10, 151);
      g.fillStyle = `rgba(255,255,255,${0.06 + Math.random() * 0.05})`; for (let y = 0; y < 160; y += 3) g.fillRect(0, y, 256, 1);
      screenTex.t.needsUpdate = true;
      tvGlow.intensity = 5 + Math.sin(t * 7) * 0.8 + Math.sin(t * 13) * 0.6;
    };
    // the window on the left wall, with a moonlit street outside and heavy curtains with real folds
    {
      const wg = kit.group(-RW / 2 + 0.11, 0, -1.5, Math.PI / 2);
      const night = D.canvasTex(256, 160, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0a1430'); gr.addColorStop(1, '#2a3a5a'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#e8eeff'; g.beginPath(); g.arc(190, 40, 16, 0, 7); g.fill(); for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(rng() * w, rng() * h * 0.5, 1.5, 1.5); } g.fillStyle = '#0a0e18'; g.fillRect(0, 110, w, 50); g.beginPath(); g.moveTo(20, 110); g.lineTo(60, 80); g.lineTo(100, 110); g.fill(); g.fillStyle = '#f8d878'; g.fillRect(48, 96, 10, 8); });
      D.panel(wg, 2.2, 1.4, night, 0, 2.0, -0.02, { glow: 0.9 });
      const frameM = kit.mat(0xe8e0cc, { roughness: 0.5 });
      for (const [w, h, x, y] of [[2.4, 0.1, 0, 1.25], [2.4, 0.1, 0, 2.7], [0.1, 1.5, -1.15, 1.3], [0.1, 1.5, 1.15, 1.3], [0.06, 1.4, 0, 1.3], [2.3, 0.06, 0, 1.95]]) D.bx(wg, w, h, 0.12, frameM, x, y, 0.02, 0.01);
      // curtains: a wavy sheet each side
      const folds = (w, h) => { const geo = new THREE.PlaneGeometry(w, h, 24, 1); const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) / w * Math.PI * 7) * 0.06); geo.computeVertexNormals(); return geo; };
      const curtainM = new THREE.MeshPhysicalMaterial({ color: 0x7a3a22, roughness: 0.85, sheen: 1, sheenColor: 0xd08060, side: THREE.DoubleSide });
      for (const s of [-1, 1]) { const c = new THREE.Mesh(folds(0.9, 2.7), curtainM); c.position.set(s * 1.55, 1.75, 0.18); c.castShadow = true; wg.add(c); }
      D.cyl(wg, 0.025, 0.025, 4.2, kit.mat(0xd8b04a, { metalness: 0.9, roughness: 0.3 }), 0, 3.12, 0.2).rotation.z = Math.PI / 2;
      wg.children.at(-1).position.set(0, 3.12, 0.2);
    }
    const moon = new THREE.PointLight(0x9fb4ff, 4, 14, 1.5); moon.position.set(-RW / 2 + 1, 2.6, -1.5); scene.add(moon);
    // on the right wall: the Southern Cross, a dartboard, framed photos, and a sideboard with the good glasses
    {
      const flag = D.canvasTex(330, 180, (g, w, h) => { g.fillStyle = '#0a2a7a'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; const star = (x, y, r, pts = 7) => { g.beginPath(); for (let k = 0; k < pts * 2; k++) { const a = -Math.PI / 2 + k * Math.PI / pts, rr = k % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.fill(); }; star(230, 40, 15); star(270, 85, 15); star(230, 145, 15); star(195, 80, 15); star(250, 105, 7, 5); });
      const fg = kit.group(RW / 2 - 0.11, 0, 2.6, -Math.PI / 2); D.panel(fg, 1.9, 1.04, flag, 0, 2.5, 0.01, { roughness: 0.9 });
      const dart = D.canvasTex(256, 256, (g) => { const cx = 128; g.fillStyle = '#111'; g.beginPath(); g.arc(cx, cx, 126, 0, 7); g.fill(); for (let k = 0; k < 20; k++) { for (const [r0, col] of [[100, k % 2 ? '#c8201c' : '#1a7a3a'], [92, k % 2 ? '#f2e2b0' : '#111'], [60, k % 2 ? '#c8201c' : '#1a7a3a'], [52, k % 2 ? '#f2e2b0' : '#111']]) { g.fillStyle = col; g.beginPath(); g.moveTo(cx, cx); g.arc(cx, cx, r0, k * Math.PI / 10, (k + 1) * Math.PI / 10); g.fill(); } } g.fillStyle = '#1a7a3a'; g.beginPath(); g.arc(cx, cx, 14, 0, 7); g.fill(); g.fillStyle = '#c8201c'; g.beginPath(); g.arc(cx, cx, 6, 0, 7); g.fill(); });
      const dg = kit.group(RW / 2 - 0.11, 0, -3.5, -Math.PI / 2); D.cyl(dg, 0.46, 0.46, 0.06, 0x1a1a1a, 0, 2.3, 0.0).rotation.x = Math.PI / 2; dg.children.at(-1).position.set(0, 2.3, 0.03);
      const face = new THREE.Mesh(new THREE.CircleGeometry(0.44, 40), new THREE.MeshStandardMaterial({ map: dart, roughness: 0.9 })); face.position.set(0, 2.3, 0.065); dg.add(face);
      const photo = (title, col, z, y) => { const p = D.poster(0.62, 0.48, (g, w, h) => { g.fillStyle = col; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,0.85)'; g.font = '800 26px system-ui'; g.textAlign = 'center'; g.fillText(title, w / 2, h - 22, w - 10); g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(w / 2, h / 2 - 20, 60, 50, 0, 0, 7); g.fill(); }, { frame: 0x6a4a2a }); p.position.set(RW / 2 - 0.12, y, z); p.rotation.y = -Math.PI / 2; scene.add(p); };
      photo('BATHURST 98', '#3a5a8a', -0.8, 2.0); photo('BIG SNAPPER', '#2a6a7a', 0.2, 2.25); photo('MUM & DAD', '#8a6a4a', 1.0, 1.95);
      // sideboard with a radio and the glasses
      const sb = kit.group(RW / 2 - 0.5, 0, -6.0, -Math.PI / 2);
      D.bx(sb, 2.0, 0.8, 0.5, kit.surf('planks', { unit: 1, tint: 0x6a4024 }), 0, 0.12, 0, 0.02);
      for (const [x, z] of [[-0.9, -0.2], [0.9, -0.2], [-0.9, 0.2], [0.9, 0.2]]) D.cyl(sb, 0.025, 0.02, 0.12, 0x3a2416, x, 0, z, 8);
      for (let k = 0; k < 4; k++) D.bx(sb, 0.46, 0.66, 0.02, kit.surf('planks', { unit: 1, tint: 0x5a3418 }), -0.72 + k * 0.48, 0.18, 0.255, 0.01);
      for (let k = 0; k < 5; k++) { const b = D.bottle({ color: [0x5a3a12, 0x2a5a2a, 0x8a5a1a][k % 3], h: 0.3 + (k % 2) * 0.08 }); b.position.set(-0.8 + k * 0.14, 0.92, -0.05); sb.add(b); }
      const radio = D.bx(sb, 0.5, 0.28, 0.2, 0x8a6a4a, 0.55, 0.92, 0, 0.04); void radio;
      D.panel(sb, 0.22, 0.18, D.canvasTex(64, 64, (g) => { g.fillStyle = '#d8c8a0'; g.fillRect(0, 0, 64, 64); g.strokeStyle = '#4a3a2a'; for (let y = 6; y < 64; y += 6) { g.beginPath(); g.moveTo(4, y); g.lineTo(60, y); g.stroke(); } }), 0.45, 1.06, 0.101);
      scene.add(sb);
    }
    // a pendant light over the coffee table, and a ceiling fan
    // (the ceiling itself is out of shot)

    // the couch: a proper three-seater in mustard velour, plump cushions, rolled arms, timber legs
    const velour = new THREE.MeshPhysicalMaterial({ color: 0xb08a2e, roughness: 0.82, sheen: 1, sheenRoughness: 0.4, sheenColor: 0xffe0a0 });
    const couch = kit.group(0, 0, COUCH_Z);
    D.bx(couch, 4.6, 0.42, 1.6, velour, 0, 0.16, 0, 0.12); // base
    for (const x of [-1.45, 0, 1.45]) D.bx(couch, 1.42, 0.24, 1.36, velour, x, 0.56, 0.12, 0.11); // seat cushions
    D.bx(couch, 4.6, 0.9, 0.38, velour, 0, 0.5, -0.64, 0.14); // backrest
    for (const x of [-1.45, 0, 1.45]) { const c = D.bx(couch, 1.4, 0.62, 0.3, velour, x, 0.74, -0.38, 0.13); c.rotation.x = -0.12; }
    for (const s of [-1, 1]) {
      D.bx(couch, 0.34, 0.62, 1.6, velour, s * 2.43, 0.16, 0, 0.1);
      const roll = D.cyl(couch, 0.22, 0.22, 1.62, velour, s * 2.45, 0.78, 0, 24); roll.rotation.x = Math.PI / 2; roll.position.set(s * 2.45, 0.8, 0);
    }
    for (const s of [-1, 1]) for (const z of [-0.6, 0.6]) D.cyl(couch, 0.05, 0.035, 0.16, 0x3a2416, s * 2.2, 0, z, 10);
    // a crocheted granny-square rug thrown over one end
    {
      const granny = D.canvasTex(256, 256, (g) => { const cols = ['#c84a3a', '#e8b03a', '#3a7a5a', '#3a5a9a', '#e8e0d0']; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) for (let r = 4; r > 0; r--) { g.fillStyle = cols[(x + y + r) % 5]; g.fillRect(x * 64 + 32 - r * 7.5, y * 64 + 32 - r * 7.5, r * 15, r * 15); } });
      const throwGeo = new THREE.PlaneGeometry(1.0, 1.4, 12, 12); const p = throwGeo.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 6) * 0.03 + (p.getY(i) < -0.2 ? (p.getY(i) + 0.2) * 0.9 : 0)); throwGeo.computeVertexNormals();
      const th = new THREE.Mesh(throwGeo, new THREE.MeshStandardMaterial({ map: granny, roughness: 1, side: THREE.DoubleSide })); th.rotation.set(-Math.PI / 2, 0, 0.1); th.position.set(-1.8, 0.82, 0.05); th.castShadow = true; couch.add(th);
    }

    // the coffee table: VB empties, a pizza box, the remote, a pile of magazines
    const table = kit.group(0, 0, COUCH_Z + 2.0);
    D.bx(table, 2.4, 0.07, 1.0, kit.surf('planks', { unit: 1.5, tint: 0x8a5a38 }), 0, 0.48, 0, 0.03);
    D.bx(table, 2.2, 0.03, 0.85, kit.surf('planks', { unit: 1.5, tint: 0x7a4a28 }), 0, 0.14, 0, 0.01); // the lower shelf
    for (const x of [-1.08, 1.08]) for (const z of [-0.4, 0.4]) D.cyl(table, 0.04, 0.03, 0.48, 0x3a2416, x, 0, z, 10);
    const greenCan = kit.mat(0x1f6a2a, { metalness: 0.8, roughness: 0.3 }), redCan = kit.mat(0xb8201c, { metalness: 0.8, roughness: 0.3 });
    for (let i = 0; i < 8; i++) {
      const c = D.can({ color: i % 3 ? 0x1f6a2a : 0xb8201c, label: i % 3 ? 'DRAUGHT' : 'BITTER' }); c.scale.setScalar(2);
      c.position.set((rng() - 0.5) * 2, 0.55, (rng() - 0.5) * 0.7);
      if (rng() < 0.4) { c.rotation.z = Math.PI / 2; c.position.y = 0.62; c.rotation.y = rng() * 6; }
      table.add(c);
    }
    { const pz = D.pizzaBox({ open: true }); pz.scale.setScalar(1.9); pz.position.set(0.5, 0.55, 0.05); pz.rotation.y = 0.3; table.add(pz); }
    for (let k = 0; k < 3; k++) D.bx(table, 0.42, 0.015, 0.3, [0xd8d0c0, 0xc84a3a, 0x3a5a9a][k], -0.7 + k * 0.03, 0.17 + k * 0.016, 0.05, 0.004).rotation.y = k * 0.2;
    D.bx(table, 0.5, 0.05, 0.12, 0x1a1a1a, -0.6, 0.55, 0.25, 0.02).rotation.y = -0.4;
    // an armchair and a side table off to the right, a pot plant and a bin in the corners
    { const ac = kit.group(RW / 2 - 1.6, 0, COUCH_Z + 3.4, -Math.PI / 2 - 0.5); D.bx(ac, 1.2, 0.4, 1.1, velour, 0, 0.16, 0, 0.1); D.bx(ac, 1.0, 0.22, 0.95, velour, 0, 0.56, 0.05, 0.1); D.bx(ac, 1.2, 0.8, 0.3, velour, 0, 0.5, -0.42, 0.12); for (const s of [-1, 1]) D.bx(ac, 0.22, 0.42, 1.1, velour, s * 0.5, 0.56, 0, 0.1); }
    put(D.pottedPlant({ size: 2.2 }), -RW / 2 + 0.7, 0, FRONT_Z - 0.8);
    put(D.pottedPlant({ size: 1.8 }), RW / 2 - 0.7, 0, FRONT_Z - 0.9);
    put(D.bin({ color: 0x6a4a2a }), -RW / 2 + 0.5, 0, COUCH_Z + 3.0);
    // the Scotch Fingers: two golden fingers joined down the middle, docked with holes, dusted with sugar
    const biscuitMat = (() => {
      const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
      g.fillStyle = '#c98a3e'; g.fillRect(0, 0, 256, 128);
      const gr = g.createRadialGradient(128, 64, 10, 128, 64, 150); gr.addColorStop(0, 'rgba(255,220,150,0.3)'); gr.addColorStop(0.7, 'rgba(160,90,30,0.2)'); gr.addColorStop(1, 'rgba(110,55,15,0.7)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
      for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${rng() < 0.5 ? '255,245,220' : '140,80,30'},${0.15 + rng() * 0.2})`; g.fillRect(rng() * 256, rng() * 128, 1.5, 1.5); }
      g.fillStyle = 'rgba(90,45,12,0.9)'; g.fillRect(0, 59, 256, 10); // the snap line between the fingers
      for (const y of [32, 96]) for (let k = 0; k < 5; k++) { g.fillStyle = 'rgba(100,55,20,0.8)'; g.beginPath(); g.arc(30 + k * 49, y, 6, 0, 7); g.fill(); }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 });
    })();
    const biscuitGeo = (() => {
      // two rounded fingers side by side, slightly domed; texture laid on from above
      const finger = (y) => { const w = 0.62, h = 0.13, r = 0.05, sh = new THREE.Shape(); sh.moveTo(-w / 2 + r, -h / 2); sh.lineTo(w / 2 - r, -h / 2); sh.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); sh.lineTo(w / 2, h / 2 - r); sh.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); sh.lineTo(-w / 2 + r, h / 2); sh.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); sh.lineTo(-w / 2, -h / 2 + r); sh.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
        const g = new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.015, bevelSegments: 3, curveSegments: 8 }); g.translate(0, y, 0); return g; };
      const g = mergeGeometries([finger(-0.066), finger(0.066)]);
      const p = g.attributes.position, uv = g.attributes.uv;
      for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 0.66 + 0.5, p.getY(i) / 0.28 + 0.5);
      g.rotateX(-Math.PI / 2); g.computeVertexNormals();
      return g;
    })();
    const biscuit = () => { const m = new THREE.Mesh(biscuitGeo, biscuitMat); m.castShadow = true; return m; };
    // a long plate of them on the rug, one stack per lane, and the open tin on the coffee table
    const plate = kit.box(W + 0.4, 0.05, 0.9, kit.surf('planks', { unit: 1.2, tint: 0x8a5a38 }), 0, 0, GRAB_Z - 0.75); // a long bread board
    plate.receiveShadow = true;
    const stacks = [];
    for (let i = 0; i < players.length; i++) {
      const st = new THREE.Group(); st.position.set(laneX(i), 0.05, GRAB_Z - 0.75); scene.add(st);
      for (let k = 0; k < 3; k++) { const b = biscuit(); b.scale.setScalar(1.3); b.position.set((k - 1) * 0.22, k * 0.03, (rng() - 0.5) * 0.1); b.rotation.set(0, Math.PI / 2 + (rng() - 0.5) * 0.4, (k - 1) * 0.08); st.add(b); }
      stacks.push(st);
    }
    const tin = kit.group(-0.6, 0.54, COUCH_Z + 2.0);
    kit.cyl(0.42, 0.42, 0.3, kit.mat(0x8a1a1a, { metalness: 0.7, roughness: 0.35 }), 0, 0, 0, tin, {}, 32);
    kit.cyl(0.43, 0.43, 0.05, kit.mat(0xd8b04a, { metalness: 0.9, roughness: 0.3 }), 0.55, 0, 0.1, tin, {}, 32).rotation.z = 0.25; // lid off to the side
    for (let k = 0; k < 3; k++) { const b = biscuit(); b.position.set((k - 1) * 0.12, 0.31, 0); b.rotation.set(0.2, k * 0.3, 0); tin.add(b); }
    // a couple of empties on the floor for flavour
    for (let i = 0; i < 6; i++) { const c = kit.cyl(0.07, 0.07, 0.24, greenCan, (rng() - 0.5) * W, 0.07, -2 + rng() * 9); c.rotation.set(Math.PI / 2, 0, rng() * 6); }

    // the beer fridges either side of the couch, glowing
    const fridgeGlow = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdfeeff, emissiveIntensity: 0.2 });
    for (const s of [-1, 1]) {
      const f = kit.group(s * (RW / 2 - 0.6), 0, GRAB_Z - 1.6, -s * Math.PI / 2);
      kit.box(1.1, 1.9, 0.9, 0x2a2a2e, 0, 0, 0, f, { metalness: 0.6, roughness: 0.35 });
      const inside = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.6), fridgeGlow); inside.position.set(0, 1.0, 0.452); f.add(inside);
      for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.22, 10), (r + k) % 4 ? greenCan : redCan); c.position.set(-0.36 + k * 0.145, 0.38 + r * 0.38, 0.38); f.add(c); }
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.7), new THREE.MeshPhysicalMaterial({ color: 0xcfe8ff, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.18 }));
      glass.position.set(0, 1.0, 0.47); f.add(glass);
      kit.sign('COLD BEER', 1.0, 0.24, 0, 2.1, 0.46, f, { bg: '#c8201c', fg: '#fff' });
      const l = new THREE.PointLight(0xdfeeff, 2.5, 6, 1.5); l.position.set(0, 1, 1); f.add(l);
    }
    // the floor lamp: off while he sleeps. When he's looking, it's on.
    const lampG = kit.group(-3.0, 0, COUCH_Z + 0.9);
    kit.cyl(0.25, 0.3, 0.06, 0x2a2a2a, 0, 0, 0, lampG, { metalness: 0.7 });
    kit.cyl(0.03, 0.03, 2.1, 0x2a2a2a, 0, 0, 0, lampG, { metalness: 0.7 });
    const shadeMat = new THREE.MeshStandardMaterial({ color: 0xf0d8a0, emissive: 0xffa040, emissiveIntensity: 0, side: THREE.DoubleSide, roughness: 0.8 });
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 0.5, 24, 1, true), shadeMat); shade.position.y = 2.25; lampG.add(shade);
    const lamp = new THREE.PointLight(0xff7a40, 0, 26, 1.2); lamp.position.set(-3.0, 2.2, COUCH_Z + 1.1); scene.add(lamp);

    // ----- Myles -----
    const myles = mg.makeDoll({ id: 'myles', name: 'Myles', color: '#3b6d3b', body: 'bloke', hair: 0x6b4526, photos: { neutral: mylesFace('asleep'), angry: mylesFace('awake') } }, { tag: false, scale: 0.95 });
    const pivot = new THREE.Group(); pivot.position.set(1.85, SEAT_Y + 0.42, COUCH_Z + 0.1); scene.add(pivot);
    const roll = new THREE.Group(); pivot.add(roll); roll.add(myles.group);
    // speech: Zzz while he sleeps, then the call
    const word = (() => {
      const c = document.createElement('canvas'); c.width = 512; c.height = 160;
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); s.scale.set(4.2, 1.3, 1); s.renderOrder = 30;
      s.position.set(0, 3.2, COUCH_Z + 2.6); scene.add(s);
      let last = '';
      s.say = (text, color) => {
        if (text + color === last) return; last = text + color;
        const g = c.getContext('2d'); g.clearRect(0, 0, 512, 160);
        if (text) { g.font = '900 100px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 14; g.strokeStyle = '#140a06'; g.strokeText(text, 256, 84); g.fillStyle = color; g.fillText(text, 256, 84); }
        t.needsUpdate = true;
      };
      return s;
    })();
    const zs = []; // drifting Z's
    const zTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.font = '900 54px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 6; g.strokeStyle = '#1a2a4a'; g.strokeText('Z', 32, 34); g.fillStyle = '#bfe0ff'; g.fillText('Z', 32, 34); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    const headPos = new THREE.Vector3();

    // ----- the sneakers -----
    const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.3, 200);
    const sneakers = players.map((p, i) => {
      const holder = new THREE.Group(); holder.rotation.y = Math.PI; scene.add(holder); // facing Myles, and the camera behind him
      const doll = mg.makeDoll(p, { scale: DOLL });
      holder.add(doll.group);
      const x = laneX(i);
      holder.position.set(x, 0, START_Z);
      // the biscuit they're carrying, held up in front of them
      const carry = biscuit(); carry.scale.setScalar(1.4); carry.rotation.set(-1.2, 0, 0); carry.position.set(0, 1.45 * DOLL / 0.68, 0.55); carry.visible = false; holder.add(carry);
      return { p, doll, holder, carry, x, z: START_Z, from: START_Z, want: 0, v: 0, back: 0, has: false, points: 0, caught: 0, phase: rng() * 6, turn: Math.PI,
        bot: p.bot ? { pace: 0.55 + rng() * 0.45, react: 0.12 + rng() * 0.38, greedy: rng() * 0.25 } : null };
    });
    const pops = [];
    const pop = (s, text, color) => {
      const c = document.createElement('canvas'); c.width = 256; c.height = 96;
      const g = c.getContext('2d'); g.font = '900 66px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 10; g.strokeStyle = '#1a0d08'; g.strokeText(text, 128, 50); g.fillStyle = color; g.fillText(text, 128, 50);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); sp.scale.set(2.2, 0.82, 1); sp.renderOrder = 20;
      scene.add(sp); pops.push({ sp, s, life: 0 });
    };
    // finish line: a strip of gaffer tape across the carpet
    kit.box(W + 0.4, 0.012, 0.18, kit.mat(0xd8d0b8, { roughness: 0.6 }), 0, 0, GRAB_Z);
    kit.box(W + 0.4, 0.012, 0.12, kit.mat(0x5a5a5a, { roughness: 0.6 }), 0, 0, START_Z + 0.5);

    // ----- Myles' sleep cycle -----
    // sleep -> stir (the warning) -> look (freeze!) -> settle -> sleep. Sometimes he stirs and drops off again.
    let state = 'sleep', stT = 0, stDur = 2.2 + rng() * 1.2, wake = 0, snoreT = 0, fake = false, scan = 0, lookT = 0, anger = 0;
    const setState = (s, dur) => { state = s; stT = 0; stDur = dur; };
    const caught = (s) => {
      s.caught += 1; s.back = 1; s.from = s.z; s.v = 0; s.has = false; s.carry.visible = false;
      s.doll.flinch();
      pop(s, 'OI!', '#ff4a3a');
      mg.sfx.play('oi');
      anger = 1.2;
      myles.setMood('angry');
    };

    return {
      camera,
      update(dt, t, running) {
        // Myles
        stT += dt;
        if (running) {
          const pace = 1 - 0.35 * Math.min(1, t / mg.duration); // he gets lighter on as the night wears on
          if (state === 'sleep' && stT > stDur) { fake = rng() < 0.2; setState('stir', 0.55 + rng() * 0.4); mg.sfx.play('snort'); mg.sfx.play('creak'); }
          else if (state === 'stir' && stT > stDur) { if (fake) setState('sleep', (2 + rng() * 3) * pace); else { setState('look', 1.8 + rng() * 1.6); lookT = 0; mg.sfx.play('creak'); } }
          else if (state === 'look' && stT > stDur) setState('settle', 0.6);
          else if (state === 'settle' && stT > stDur) setState('sleep', (2.2 + rng() * 3.4) * pace);
        }
        const wantWake = state === 'look' ? 1 : state === 'stir' ? 0.12 : 0;
        wake += (wantWake - wake) * Math.min(1, dt * (state === 'look' ? 9 : 4));
        // asleep: on his side facing the backrest (we see his face). Awake: rolled over and propped up, glaring at the room.
        pivot.rotation.z = Math.PI / 2 - wake * 0.85;
        const twitch = state === 'stir' ? Math.sin(stT * 30) * 0.08 : 0;
        roll.rotation.y = Math.PI * (1 - wake) + twitch + (state === 'look' ? Math.sin(t * 1.4) * 0.22 : 0);
        pivot.position.y = SEAT_Y + 0.42 + wake * 0.25;
        myles.group.scale.setScalar(1 + (state === 'sleep' ? Math.sin(t * 2.2) * 0.012 : 0)); // breathing
        if (anger > 0) { anger -= dt; if (anger <= 0) myles.setMood('neutral'); }
        if (state !== 'look' && myles.mood !== 'neutral' && anger <= 0) myles.setMood('neutral');
        if (state === 'look' && myles.mood !== 'angry') myles.setMood('angry');
        myles.update(dt);
        // the lamp clicks on when he's looking
        const lampOn = state === 'look' ? 1 : 0;
        lamp.intensity += (lampOn * 40 - lamp.intensity) * Math.min(1, dt * 14);
        shadeMat.emissiveIntensity = lamp.intensity / 20;
        bulb.intensity = 320 - lamp.intensity * 3;
        // Zzz and the big word over the couch
        myles.head.getWorldPosition(headPos);
        if (state === 'sleep' && running) {
          snoreT -= dt;
          if (snoreT <= 0) { snoreT = 2.4; mg.sfx.play('snore'); }
          if (rng() < dt * 2.2) { const z = new THREE.Sprite(new THREE.SpriteMaterial({ map: zTex, transparent: true, depthTest: false })); z.renderOrder = 25; z.position.copy(headPos); scene.add(z); zs.push({ z, life: 0, drift: (rng() - 0.5) * 0.6 }); }
        }
        for (let i = zs.length - 1; i >= 0; i--) {
          const q = zs[i]; q.life += dt;
          q.z.position.y += dt * 0.8; q.z.position.x += dt * (0.3 + q.drift); q.z.scale.setScalar(0.35 + q.life * 0.35);
          q.z.material.opacity = Math.min(1, 2.4 - q.life);
          if (q.life > 2.4 || state === 'look') { scene.remove(q.z); zs.splice(i, 1); }
        }
        if (!running && t === 0) word.say('', '#fff');
        else if (state === 'look') word.say('FREEZE!', '#ff4a3a');
        else if (state === 'stir') word.say(fake ? '…mmf?' : '…huh?', '#ffd23f');
        else word.say(running ? 'SNEAK…' : '', '#5cff9d');
        word.position.y = 3.2 + (state === 'look' ? Math.sin(t * 20) * 0.03 : 0);
        if (state === 'look') lookT += dt;

        // the sneakers
        for (const s of sneakers) {
          if (s.bot && running && s.back <= 0) {
            // CPUs tap away while he sleeps and stop once they notice him stirring (some notice late)
            const alarmed = (state === 'stir' && !fake && stT > s.bot.react) || (state === 'stir' && fake && stT > s.bot.react + 0.1) || state === 'look' || (state === 'settle' && stT < 0.3);
            const greedy = state === 'stir' && stT < s.bot.react + s.bot.greedy;
            s.want = !alarmed || (greedy && state === 'stir') ? s.bot.pace : 0;
          }
          // ease towards the slider's speed (a slowish start, a quick stop), in for a biscuit, then back out
          if (s.back <= 0 && running) {
            const target = s.want * MAXV * (s.has ? 0.85 : 1);
            s.v += (target - s.v) * Math.min(1, dt * (target > s.v ? 5 : 12));
            s.z += s.v * dt * (s.has ? 1 : -1);
          } else s.v = 0;
          const moving = s.v > STILL;
          // spotted?
          if (running && state === 'look' && lookT > GRACE && moving) caught(s);
          if (s.back > 0) {
            // whisked back to the front door
            s.back = Math.max(0, s.back - dt / 1.1);
            const k = 1 - s.back, e = k * k * (3 - 2 * k);
            s.z = s.from + (START_Z - s.from) * e;
          }
          if (!s.has && s.back <= 0 && s.z <= GRAB_Z) {
            // got one: turn round with it
            s.has = true; s.z = GRAB_Z; s.carry.visible = true;
            pop(s, 'GOT ONE!', '#ffd23f'); if (!s.p.bot) mg.sfx.play('squeak');
          }
          if (s.has && s.z >= START_Z) {
            s.has = false; s.z = START_Z; s.carry.visible = false; s.points += 1;
            pop(s, '+1 🍪', '#5cff9d'); mg.sfx.play('coin'); s.doll.bounce(1.2);
          }
          // creep animation: knees up, lean forward, a little bob each step
          // a stride cycle driven by distance covered, so it speeds up and slows down with them
          const before = Math.floor(s.phase / Math.PI);
          s.phase += dt * s.v * 7;
          if (moving && !s.p.bot && Math.floor(s.phase / Math.PI) !== before) mg.sfx.play('tiptoe');
          const bob = Math.abs(Math.sin(s.phase)) * 0.07 * Math.min(1, s.v / 1.2);
          const fly = s.back > 0 ? Math.sin(s.back * Math.PI) * 1.2 : 0;
          s.holder.position.set(s.x, bob + fly, s.z);
          // face the way they're going: towards Myles on the way in, the door on the way out
          s.turn += ((s.has ? 0 : Math.PI) - s.turn) * Math.min(1, dt * 8);
          s.holder.rotation.y = s.turn;
          s.doll.group.rotation.x = s.back > 0 ? -0.8 * Math.sin(s.back * Math.PI) : 0.28; // hunched over, sneaking
          s.doll.group.rotation.z = Math.sin(s.phase) * 0.1 * Math.min(1, s.v / 1.2);
          s.doll.setArms(s.has ? 0.35 : s.back > 0 ? 0.7 : -0.15, 0);
          s.doll.update(dt);
        }
        for (let i = pops.length - 1; i >= 0; i--) {
          const q = pops[i]; q.life += dt;
          q.sp.position.set(q.s.holder.position.x, 2.6 + q.life * 1.3, q.s.holder.position.z);
          q.sp.material.opacity = 1 - Math.max(0, q.life - 0.8) / 0.4;
          if (q.life > 1.2) { scene.remove(q.sp); pops.splice(i, 1); }
        }
        drawTv(t);
        // camera: up behind the couch, over Myles' shoulder, looking down the room at everyone creeping in
        camera.position.set(1.6 + Math.sin(t * 0.2) * 0.3, 5.0 + W * 0.1, COUCH_Z - 4.6 - W * 0.15);
        camera.lookAt(0, 0.6, -1);
      },
      input(p, m) { const s = sneakers.find((x) => x.p === p); if (s && m.b === 'slide') s.want = Math.max(0, Math.min(1, Number(m.v) || 0)); },
      // a point per biscuit got home; how far along this trip only breaks ties (never enough to round up)
      scores() { return Object.fromEntries(sneakers.map((s) => { const trip = (START_Z - s.z) / (START_Z - GRAB_Z); return [s.p.id, s.points + 0.24 * (s.has ? 1 + (1 - trip) : trip) / 2]; })); },
    };
  },
};
