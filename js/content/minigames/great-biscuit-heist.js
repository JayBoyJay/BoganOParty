// The Great Biscuit Heist: Myles is passed out on the couch after a big one, and the Scotch Fingers
// are right in front of him. Tap SNEAK to creep up, nick a biscuit, then sneak it all the way back to
// the front door for a point. Then go again. When he snorts and stirs, stop: if he rolls over and sees
// anyone moving, OI! Back to the door you go, and any biscuit you were carrying stays behind.
// Red light, green light, but it's a bloke on a mustard couch.
import { mergeGeometries } from '../../../vendor/BufferGeometryUtils.js';

const LANE = 1.5; // metres per lane
const DOLL = 0.68; // player doll scale (Myles is 0.95, so he's a big unit)
const START_Z = 4.5, GRAB_Z = -5.4; // the front door line, and where the biscuit plate is
const FRONT_Z = START_Z + 2.5, BACK_Z = -14, LEN = FRONT_Z - BACK_Z, MID_Z = (FRONT_Z + BACK_Z) / 2;
const STEP = 0.25, STEP_T = 0.22; // each tap: this far, taking this long
const QUEUE = 1; // taps that can be banked while a step is under way
const GRACE = 0.22; // after he looks, a step already under way can finish
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
  howTo: "Tap SNEAK to creep a step. Get to the plate, grab a Scotch Finger, and sneak it back to the front door for a point, then go again. When Myles snorts and stirs, STOP. If he rolls over and sees you move, you're sent back to the door and lose the biscuit.",
  padText: 'Tap to sneak. Freeze when he stirs!',
  duration: 60,
  pad: { kind: 'buttons', buttons: [{ id: 'step', label: '🤫 SNEAK', tone: 'go', wide: true }] },

  create(mg) {
    const { THREE, kit, scene, players, rng, renderer } = mg;
    const n = players.length, W = Math.max(7.5, n * LANE + 1.5), RW = W + 3; // lanes, then the room's width
    const laneX = (i) => (i - (n - 1) / 2) * LANE;

    // ----- the lounge room, at night -----
    scene.background = new THREE.Color(0x07070c);
    const pm = new THREE.PMREMGenerator(renderer);
    // a dim room for reflections: warm walls, one bright window
    {
      const env = new THREE.Scene();
      env.add(new THREE.Mesh(new THREE.BoxGeometry(20, 8, 20), new THREE.MeshBasicMaterial({ color: 0x3a2a1e, side: THREE.BackSide })));
      const win = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), new THREE.MeshBasicMaterial({ color: 0x9fb4ff })); win.position.set(0, 2, 9.9); win.rotation.y = Math.PI; env.add(win);
      scene.environment = pm.fromScene(env, 0.04).texture; scene.environmentIntensity = 1.0;
      pm.dispose();
    }
    scene.add(new THREE.HemisphereLight(0xb0a0c0, 0x4a3020, 0.9));
    // the ceiling light: a single bulb, dim and orange
    const bulb = new THREE.SpotLight(0xffc98a, 320, 40, 1.1, 0.7, 1.3);
    bulb.position.set(0, 7.5, 1); bulb.target.position.set(0, 0, 0);
    bulb.castShadow = true; bulb.shadow.mapSize.set(2048, 2048); bulb.shadow.bias = -0.0004; bulb.shadow.normalBias = 0.03;
    scene.add(bulb, bulb.target);

    const carpet = kit.surf('carpet', { unit: 2.5 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(RW, LEN), carpet);
    floor.rotation.x = -Math.PI / 2; floor.position.z = MID_Z; floor.receiveShadow = true;
    // carpet UVs in metres
    { const uv = floor.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * RW, uv.getY(i) * LEN); }
    scene.add(floor);
    const paper = kit.surf('wallpaper', { unit: 3 }), panel = kit.surf('planks', { unit: 2.4, tint: 0xb08a68 });
    // the front wall (behind the players' start, facing the camera) and the side walls
    kit.box(RW, 4.2, 0.2, paper, 0, 0, FRONT_Z + 0.1, scene);
    for (const s of [-1, 1]) {
      const wall = kit.box(0.2, 4.2, LEN, paper, s * RW / 2, 0, MID_Z);
      wall.receiveShadow = true;
      kit.box(0.06, 1.1, LEN, panel, s * (RW / 2 - 0.12), 0, MID_Z); // wood panelling up to the dado
      kit.box(0.1, 0.08, LEN, 0x4a2e1a, s * (RW / 2 - 0.13), 1.1, MID_Z);
    }
    // the front door, the telly on the front wall, a window with the moon outside
    const front = kit.group(0, 0, FRONT_Z - 0.02);
    kit.box(1.3, 2.4, 0.1, 0x6a4024, -RW / 2 + 2.2, 0, 0, front);
    kit.ball(0.06, 0xd8b04a, -RW / 2 + 2.7, 1.2, 0.08, front, { metalness: 1, roughness: 0.3 });
    kit.box(2.8, 0.6, 0.7, 0x3a2416, 1.8, 0, -0.4, front); // telly cabinet
    kit.box(1.9, 1.3, 0.8, 0x2a2622, 1.8, 0.6, -0.4, front); // a big old CRT
    const screenTex = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 160; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return { c, t }; })();
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.0), new THREE.MeshBasicMaterial({ map: screenTex.t }));
    screen.position.set(1.8, 1.26, -0.81); screen.rotation.y = Math.PI; front.add(screen);
    const tvGlow = new THREE.PointLight(0x7fa8ff, 6, 12, 1.6); tvGlow.position.set(1.8, 1.3, -1.6); front.add(tvGlow);
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
    const win = kit.window(2.2, 1.4, 0, 2.6, 0, kit.group(-RW / 2 + 0.11, 0, -1.5, Math.PI / 2));
    const curtain = kit.surf('velour', { arg: 0x7a3a22, unit: 1.4 });
    for (const s of [-1, 1]) kit.box(0.12, 2.3, 0.8, curtain, -RW / 2 + 0.3, 0.8, -1.5 + s * 1.5);
    const moon = new THREE.PointLight(0x9fb4ff, 4, 14, 1.5); moon.position.set(-RW / 2 + 1, 2.6, -1.5); scene.add(moon);
    // a Southern Cross flag, a dartboard and a framed footy photo on the walls
    kit.sign('★ ✦ ★', 2.2, 1.3, RW / 2 - 0.12, 2.6, 2.5, scene, { bg: '#0a2a7a', fg: '#fff' }).rotation.y = -Math.PI / 2;
    kit.cyl(0.42, 0.42, 0.08, 0x1a1a1a, RW / 2 - 0.16, 2.1, -3.5, scene).rotation.z = Math.PI / 2;
    const dart = kit.sign('◎', 0.82, 0.82, RW / 2 - 0.22, 2.53, -3.5, scene, { bg: '#c8201c', fg: '#e8d8a0' }); dart.rotation.y = -Math.PI / 2;

    // the couch: mustard velour, three cushions, mid-century arms
    const velour = kit.surf('velour', { unit: 0.9 });
    const couch = kit.group(0, 0, COUCH_Z);
    kit.box(4.6, 0.5, 1.7, velour, 0, 0.12, 0, couch);
    for (const x of [-1.45, 0, 1.45]) { const c = kit.box(1.42, 0.3, 1.45, velour, x, 0.62 - 0.07, 0.1, couch); c.castShadow = true; }
    kit.box(4.6, 0.95, 0.4, velour, 0, 0.62, -0.68, couch); // backrest
    for (const x of [-1.45, 0, 1.45]) kit.box(1.4, 0.6, 0.25, velour, x, 0.8, -0.4, couch); // back cushions
    for (const s of [-1, 1]) kit.box(0.35, 0.95, 1.7, velour, s * 2.47, 0.12, 0, couch);
    for (const s of [-1, 1]) for (const z of [-0.7, 0.7]) kit.cyl(0.05, 0.03, 0.14, 0x2a1a10, s * 2.2, 0, z, couch);
    // a crocheted blanket hanging off one end
    kit.box(0.9, 0.04, 1.2, kit.surf('velour', { arg: 0xc84a3a, unit: 0.6 }), -2.0, 1.12, 0.1, couch).rotation.z = 0.3;

    // the coffee table: VB empties, a pizza box, the remote
    const table = kit.group(0, 0, COUCH_Z + 2.0);
    kit.box(2.4, 0.08, 1.0, kit.surf('planks', { unit: 1.5, tint: 0x8a5a38 }), 0, 0.5, 0, table, {});
    for (const x of [-1.1, 1.1]) for (const z of [-0.42, 0.42]) kit.box(0.08, 0.5, 0.08, 0x3a2416, x, 0, z, table);
    const greenCan = kit.mat(0x1f6a2a, { metalness: 0.8, roughness: 0.3 }), redCan = kit.mat(0xb8201c, { metalness: 0.8, roughness: 0.3 });
    const cans = [];
    for (let i = 0; i < 9; i++) {
      const c = kit.cyl(0.07, 0.07, 0.24, i % 3 ? greenCan : redCan, (rng() - 0.5) * 2, 0.58, (rng() - 0.5) * 0.8, table);
      if (rng() < 0.4) { c.rotation.z = Math.PI / 2; c.position.y = 0.65; }
      cans.push(c);
    }
    kit.box(0.9, 0.08, 0.9, 0xd8c4a0, 0.5, 0.58, 0.05, table).rotation.y = 0.3;
    kit.box(0.5, 0.06, 0.12, 0x1a1a1a, -0.6, 0.58, 0.2, table).rotation.y = -0.4;
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
      return { p, doll, holder, carry, x, z: START_Z, from: START_Z, st: 0, queue: 0, back: 0, has: false, points: 0, caught: 0, phase: rng() * 6, turn: Math.PI,
        bot: p.bot ? { rate: 3.5 + rng() * 2.5, react: 0.12 + rng() * 0.38, cool: 0, greedy: rng() * 0.25 } : null };
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
      s.caught += 1; s.back = 1; s.from = s.z; s.queue = 0; s.st = 0; s.has = false; s.carry.visible = false;
      s.doll.flinch();
      pop(s, 'OI!', '#ff4a3a');
      mg.sfx.play('oi');
      anger = 1.2;
      myles.setMood('angry');
    };
    const tap = (s) => {
      if (s.back > 0) return;
      if (s.st > 0) { s.queue = Math.min(QUEUE, s.queue + 1); return; }
      s.st = 1e-4;
      if (!s.p.bot) mg.sfx.play('tiptoe');
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
            s.bot.cool -= dt;
            if ((!alarmed || greedy && state === 'stir') && s.bot.cool <= 0) { tap(s); s.bot.cool = 1 / s.bot.rate * (0.7 + rng() * 0.6); }
          }
          if (s.st > 0) {
            const k0 = s.st;
            s.st += dt / STEP_T;
            s.z += (Math.min(1, s.st) - Math.min(1, k0)) * STEP * (s.has ? 1 : -1); // in for a biscuit, then back out
            if (s.st >= 1) { s.st = 0; if (s.queue > 0) { s.queue -= 1; s.st = 1e-4; } }
          }
          // spotted?
          if (running && state === 'look' && lookT > GRACE && s.st > 0) caught(s);
          if (s.back > 0) {
            // whisked back to the front door
            s.back = Math.max(0, s.back - dt / 1.1);
            const k = 1 - s.back, e = k * k * (3 - 2 * k);
            s.z = s.from + (START_Z - s.from) * e;
          }
          if (!s.has && s.back <= 0 && s.z <= GRAB_Z) {
            // got one: turn round with it
            s.has = true; s.z = GRAB_Z; s.queue = 0; s.st = 0; s.carry.visible = true;
            pop(s, 'GOT ONE!', '#ffd23f'); if (!s.p.bot) mg.sfx.play('squeak');
          }
          if (s.has && s.z >= START_Z) {
            s.has = false; s.z = START_Z; s.queue = 0; s.st = 0; s.carry.visible = false; s.points += 1;
            pop(s, '+1 🍪', '#5cff9d'); mg.sfx.play('coin'); s.doll.bounce(1.2);
          }
          // creep animation: knees up, lean forward, a little bob each step
          const moving = s.st > 0;
          s.phase += dt * (moving ? 14 : 0);
          const bob = moving ? Math.abs(Math.sin(s.st * Math.PI)) * 0.12 : 0;
          const fly = s.back > 0 ? Math.sin(s.back * Math.PI) * 1.2 : 0;
          s.holder.position.set(s.x, bob + fly, s.z);
          // face the way they're going: towards Myles on the way in, the door on the way out
          s.turn += ((s.has ? 0 : Math.PI) - s.turn) * Math.min(1, dt * 8);
          s.holder.rotation.y = s.turn;
          s.doll.group.rotation.x = s.back > 0 ? -0.8 * Math.sin(s.back * Math.PI) : 0.28; // hunched over, sneaking
          s.doll.group.rotation.z = moving ? Math.sin(s.st * Math.PI) * 0.12 * (s.phase % 2 > 1 ? 1 : -1) : 0;
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
      input(p, m) { const s = sneakers.find((x) => x.p === p); if (s && m.b === 'step') tap(s); },
      // a point per biscuit got home; how far along this trip only breaks ties (never enough to round up)
      scores() { return Object.fromEntries(sneakers.map((s) => { const trip = (START_Z - s.z) / (START_Z - GRAB_Z); return [s.p.id, s.points + 0.24 * (s.has ? 1 + (1 - trip) : trip) / 2]; })); },
    };
  },
};
