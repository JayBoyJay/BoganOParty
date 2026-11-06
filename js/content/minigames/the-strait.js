// Riayatollah: The Strait. Everyone has a little tanker at the home port on the west end of a narrow
// strait. Steam out to the oil terminal at the east end, take on a load of oil and bring it home for 10.
// Halfway along, on the north bank, a giant baby girl is having a tantrum: she bawls, lifts her arms and
// smashes them down, and each smash flings a house off the shore into the water (a red ring shows where
// it'll land). Floating crates give you a rocket: FIRE sends it the way your bow points, curving onto
// any boat in front of you. Three hits from rockets or houses and you sink, lose your oil and start
// again from the port.
import { addSky } from '../../host/sky.js';
import { mergeGeometries } from '../../../vendor/BufferGeometryUtils.js';

const XL = 44; // the water runs from -XL to XL
const PORT_X = -37, TERM_X = 37; // inside these lines you're at the port / the terminal
const ACC = 9, ACC_FULL = 7.4, DRAG = 1.4, TURN = 3.4; // thrust, water drag, turning (rad/s)
const BOAT = 1.25, BOAT_R = 0.95 * BOAT; // boats are drawn this much bigger than modelled
const LIVES = 3;
const ROCKET_V = 21, ROCKET_LIFE = 2.3, ROCKET_TURN = 1.9, ROCKET_CONE = 0.7;
const FLIGHT = 1.75; // seconds a flung house is in the air
const SPLASH_R = 2.4;
const BTN = { FIRE: 1 };
const LOAD = 10; // points for a load of oil brought home

// half-width of the water at x: wide bays at each end, a narrow choke in the middle beside the baby
const halfW = (x) => 9.5 - 5 * Math.exp(-((x / 13) ** 2)) + 0.7 * Math.sin(x * 0.17 + 1);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export default {
  id: 'the-strait',
  name: 'Riayatollah: The Strait',
  blurb: 'Get your tanker through the strait, fill up with oil and bring it home. Mind the giant baby throwing houses.',
  howTo: 'Push the stick the way you want your boat to go. Sail to the oil terminal at the far end to load up, then bring it back to the home port for 10 points. The giant baby smashes the shore and flings houses into the water: get out of the red rings. Grab a floating rocket crate, point your bow at someone and press FIRE. Three hits and you sink, lose your oil and start again from the port.',
  padText: 'Stick to steer, FIRE a rocket',
  duration: 90,
  pad: { kind: 'stick', buttons: [{ bit: BTN.FIRE, id: 'fire', label: '🚀 FIRE', tone: 'go', off: true }] },

  create(mg) {
    const { THREE, kit, scene, players, rng, renderer, sfx } = mg;
    const n = players.length;
    const { sun } = addSky(scene, renderer, { elevation: 40, azimuth: 200, turbidity: 6, sunIntensity: 3.2, sun: 0xffe6c4, sky: 0xd9e6f2, ground: 0x9a8058, hemi: 0.65, env: 0.6, shadowSize: 60, fog: [0xe2dccd, 90, 220] });
    sun.position.set(-30, 80, 50); sun.target.position.set(0, 0, -2); sun.target.updateMatrixWorld();

    // Plain-coloured parts get welded into one mesh (colours go in the vertices), so the whole strait is a
    // few dozen draws instead of a thousand. bakeGeo takes a loose group, gives back one geometry.
    const VC = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.1 });
    const bakeGeo = (obj) => {
      obj.updateMatrixWorld(true);
      const inv = new THREE.Matrix4().copy(obj.matrixWorld).invert(), rel = new THREE.Matrix4(), c = new THREE.Color(), list = [];
      obj.traverse((o) => {
        if (!o.isMesh) return;
        const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
        for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
        g.applyMatrix4(rel.multiplyMatrices(inv, o.matrixWorld));
        c.copy((Array.isArray(o.material) ? o.material[0] : o.material).color);
        const col = new Float32Array(g.attributes.position.count * 3);
        for (let i = 0; i < col.length; i += 3) { col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b; }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        list.push(g); o.geometry.dispose();
      });
      const out = mergeGeometries(list); list.forEach((g) => g.dispose());
      return out;
    };
    const baked = (geo, parent = scene) => { const m = new THREE.Mesh(geo, VC); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
    const loose = () => new THREE.Group(); // a group to build into, then bake

    // ----- the land: one heightfield, sand at the shore and dry scrub further back -----
    const shoreDist = (x, z) => Math.max(Math.abs(z) - halfW(x), Math.abs(x) - XL);
    const bumps = (x, z) => Math.sin(x * 0.21 + z * 0.13) * 0.5 + Math.sin(x * 0.07 - z * 0.31 + 2) * 0.6 + Math.sin(x * 0.53 + z * 0.47) * 0.15;
    const heightAt = (x, z) => {
      const d = shoreDist(x, z);
      if (d < 0) return Math.max(-2.5, d * 0.5) - 0.3;
      const k = 1 - Math.exp(-d * 0.35);
      return -0.3 + k * 1.5 + k * k * Math.max(0, bumps(x, z)) * 1.2;
    };
    {
      const W = 170, D = 120, SX = 170, SZ = 120;
      const g = new THREE.PlaneGeometry(W, D, SX, SZ); g.rotateX(-Math.PI / 2); g.translate(0, 0, -6); // more land on the north bank, where the baby sits
      const pos = g.attributes.position, uv = g.attributes.uv, col = new Float32Array(pos.count * 3);
      const wet = new THREE.Color(0xa89270), sand = new THREE.Color(0xe6d0a0), dry = new THREE.Color(0xc9a46c), scrub = new THREE.Color(0x8a8a52), c = new THREE.Color();
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i), d = shoreDist(x, z);
        pos.setY(i, heightAt(x, z));
        uv.setXY(i, x, z);
        if (d < 0.6) c.copy(wet); else if (d < 3) c.copy(wet).lerp(sand, (d - 0.6) / 2.4); else c.copy(sand).lerp(dry, Math.min(1, (d - 3) / 8));
        const s = Math.sin(x * 1.7 + Math.sin(z * 1.3) * 2) * Math.sin(z * 1.9 + x * 0.4);
        if (d > 5 && s > 0.55) c.lerp(scrub, 0.6);
        c.multiplyScalar(0.93 + 0.07 * Math.sin(x * 3.1 + z * 2.3));
        col.set([c.r, c.g, c.b], i * 3);
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.computeVertexNormals();
      const m = kit.surf('sand', { unit: 6 }).clone(); m.vertexColors = true;
      const land = new THREE.Mesh(g, m); land.receiveShadow = true; scene.add(land);
    }
    const waterMat = kit.surf('water', { unit: 7, tint: 0x5fa6b8, roughness: 0.25, metalness: 0.15 });
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(200, 160), waterMat); sea.rotation.x = -Math.PI / 2; sea.position.y = 0; sea.receiveShadow = true; scene.add(sea);

    // ----- the home port (west) and the oil terminal (east) -----
    const decor = loose();
    const band = (x0, x1, color, text) => {
      // a line of buoys across the strait with a floating boom between them
      const bx = x0 < 0 ? x1 : x0, hw = halfW(bx) - 0.4;
      for (let z = -hw; z <= hw + 0.01; z += hw / 4) { kit.cyl(0.25, 0.36, 0.8, color, bx, -0.15, z, decor); kit.ball(0.14, 0xffffff, bx, 0.7, z, decor); }
      kit.rod([bx, 0.08, -hw], [bx, 0.08, hw], 0.09, color, decor);
      // a big sign on the south bank, where the scoreboard doesn't cover it
      const sx = x0 < 0 ? x1 + 3 : x0 + 4, sz = halfW(sx) + 3.2;
      for (const d of [-4.5, 4.5]) kit.box(0.25, 3.2, 0.25, 0x5a5a5a, sx + d, heightAt(sx + d, sz) - 0.2, sz, decor);
      const sg = kit.sign(text, 11, 2, sx, heightAt(sx, sz) + 3.6, sz, scene, { bg: '#' + new THREE.Color(color).getHexString(), fg: '#ffffff' });
      sg.rotation.x = -0.5;
    };
    band(-XL - 2, PORT_X, 0x2fbf5a, 'HOME PORT');
    band(TERM_X, XL + 2, 0xff8a1f, 'OIL TERMINAL');
    // wharf: concrete deck, bollards, a crane
    kit.box(6, 1.4, 22, kit.surf('concrete', { unit: 2, tint: 0xc8c2b6 }), -XL - 2.6, -0.6, 0);
    for (let z = -9; z <= 9; z += 3) kit.cyl(0.18, 0.22, 0.4, 0x2a2a2a, -XL + 0.1, 0.8, z, decor);
    {
      const c = kit.group(-XL - 3.2, 0.8, -6, 0, 1, decor);
      kit.box(0.5, 9, 0.5, 0xf2c200, 0, 0, 0, c, { metalness: 0.4 });
      kit.box(9, 0.5, 0.5, 0xf2c200, 3, 9, 0, c, { metalness: 0.4 });
      kit.box(1.6, 1.2, 1.2, 0x2a2a2a, -0.6, 8.6, 0, c);
      kit.rod([7, 9, 0], [7, 4, 0], 0.03, 0x222222, c);
    }
    // terminal: storage tanks on the land, a loading jetty with pipes
    kit.box(6, 1.4, 22, kit.surf('concrete', { unit: 2, tint: 0xbab4a8 }), XL + 2.6, -0.6, 0);
    for (const [x, z, r] of [[49, 9, 3.2], [52, 17, 3.8], [53, -2, 3.4], [50, -12, 3.6], [58, -8, 4]]) {
      kit.cyl(r, r, 4.2, 0xe8e6e0, x, heightAt(x, z), z, decor);
      kit.cyl(r * 0.98, r * 0.9, 0.6, 0xd8d6d0, x, heightAt(x, z) + 4.2, z, decor);
      kit.box(r * 2.02, 0.4, 0.05, 0xff8a1f, x, heightAt(x, z) + 2.4, z + r, decor);
    }
    for (const z of [-5, 0, 5]) {
      kit.rod([XL + 0.4, 0.9, z], [XL + 8, 0.9, z * 0.6], 0.25, 0x6a6e72, decor);
      kit.rod([XL + 0.2, 0.9, z], [XL - 1.2, 2.6, z], 0.18, 0x2a2a2a, decor);
      kit.rod([XL - 1.2, 2.6, z], [XL - 1.6, 0.3, z], 0.12, 0x2a2a2a, decor);
    }
    kit.box(1.4, 10, 1.4, 0x9a9da0, XL + 4, 0.8, -8, decor);
    const flare = kit.cone(0.6, 1.6, kit.mat(0xffb040, { emissive: 0xff7a10, emissiveIntensity: 3 }), XL + 4, 10.8, -8);

    // ----- the giant baby, sat on the north bank beside the narrowest bit -----
    const BX = 0, BZ = -(halfW(0) + 12.5);
    const baby = kit.group(BX, heightAt(BX, BZ) - 0.2, BZ, 0, 1.45);
    const skin = kit.mat(0xf5caa8, { roughness: 0.55 }), dress = kit.mat(0xff8fc4, { roughness: 0.7 }), pink = kit.mat(0xff5fa2, { roughness: 0.5 });
    const body = kit.group(0, 0, 0, 0, 1, baby);
    const bodyL = loose();
    kit.lathe([[0, 0], [3.4, 0], [3.5, 0.4], [3.1, 1.6], [2.5, 3.2], [2.0, 4.4], [1.2, 5.0], [0, 5.1]], dress, bodyL);
    kit.torus(1.35, 0.28, 0xffffff, 0, 4.85, 0, bodyL).rotation.x = Math.PI / 2; // collar
    for (const s of [-1, 1]) { // chubby legs poking out the front, feet up
      const leg = kit.cyl(0.85, 0.95, 3.4, skin, s * 1.5, 0, 0, bodyL); leg.rotation.x = Math.PI / 2 - 0.15; leg.position.set(s * 1.5, 0.95, 2.4);
      kit.ball(0.95, skin, s * 1.55, 1.3, 4.3, bodyL).scale.set(0.9, 1.15, 0.8);
    }
    baked(bakeGeo(bodyL), body);
    const head = kit.group(0, 7.3, 0.2, 0, 1, body);
    const headL = loose();
    kit.ball(2.5, skin, 0, 0, 0, headL).scale.set(1, 0.95, 0.95);
    for (const s of [-1, 1]) {
      kit.ball(0.5, skin, s * 2.45, -0.1, 0, headL).scale.set(0.5, 1, 0.8); // ears
      const eye = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.11, 8, 20, Math.PI), kit.mat(0x2a1a14)); eye.position.set(s * 0.9, 0.45, 2.25); eye.rotation.set(0, s * 0.35, 0); headL.add(eye); // squeezed shut
      const brow = kit.box(0.9, 0.16, 0.12, 0x6a4024, s * 0.95, 1.15, 2.15, headL); brow.rotation.z = s * 0.45;
      kit.ball(0.55, 0xff8a9a, s * 1.45, -0.3, 1.9, headL).scale.set(1, 0.7, 0.4); // red cheeks
    }
    const mouth = kit.ball(0.8, kit.mat(0x5a0f1e, { roughness: 0.4 }), 0, -0.85, 2.15, head); mouth.scale.set(1, 0.7, 0.35);
    kit.ball(0.42, 0xff6f86, 0, -1.1, 2.3, head).scale.set(1, 0.5, 0.3); // tongue
    kit.torus(0.35, 0.12, 0x8a5a2a, 0, 2.5, 0.3, headL).rotation.y = Math.PI / 2; // the one curl of hair
    const bow = kit.group(1.1, 2.15, 0.6, 0, 1, headL); bow.rotation.z = -0.4;
    for (const s of [-1, 1]) { const c = kit.cone(0.55, 1.1, pink, s * 0.5, -0.55, 0, bow); c.rotation.z = s * Math.PI / 2; c.position.set(s * 0.55, 0, 0); }
    kit.ball(0.3, pink, 0, 0, 0, bow);
    baked(bakeGeo(headL), head);
    // arms: a shoulder that spreads out to the side, an elbow-less arm that swings up and slams down
    const arms = [-1, 1].map((s) => {
      const sh = kit.group(s * 2.1, 4.4, 0.3, 0, 1, body); sh.rotation.z = s * 0.35;
      const sw = kit.group(0, 0, 0, 0, 1, sh);
      const armL = loose();
      kit.cyl(0.6, 0.75, 4.2, skin, 0, -4.2, 0, armL);
      kit.ball(0.95, skin, 0, -4.5, 0, armL).scale.set(1.1, 0.8, 1.1);
      baked(bakeGeo(armL), sw);
      const hand = new THREE.Object3D(); hand.position.y = -4.5; sw.add(hand); // where the slam lands
      return { s, sh, sw, hand };
    });
    const ARM = { rest: -0.25, up: -2.75, down: -0.82 };
    const B = { state: 'idle', t: 0, next: 3.2, shake: 0, sob: 0, side: 1 };
    const handPos = new THREE.Vector3();

    // ----- houses lined along the north shore, in front of her -----
    const houseCols = [0xf0e2c8, 0xd9c7a4, 0xc9d6d0, 0xf4d0b8, 0xe6e6e6, 0xd8b8a0];
    const roofCols = [0x9a3b2a, 0x7d2b22, 0x3c4a52, 0x5a6066, 0xb06a3a];
    const houseGeos = houseCols.map((wall, i) => {
      const g = loose();
      kit.box(2.8, 2.0, 2.3, wall, 0, 0, 0, g);
      kit.box(2.9, 0.12, 2.4, 0xffffff, 0, 0, 0, g); // white trim along the bottom
      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.3, 1.4, 4), kit.mat(roofCols[i % roofCols.length]));
      roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, 0.82); roof.position.y = 2.7; g.add(roof);
      kit.box(0.6, 1.2, 0.06, 0x2f5d3a, 0, 0, 1.17, g);
      for (const s of [-1, 1]) { kit.box(0.72, 0.72, 0.05, 0xffffff, s * 0.9, 0.84, 1.16, g); kit.box(0.6, 0.6, 0.06, 0x1a242c, s * 0.9, 0.9, 1.17, g); }
      kit.box(0.4, 0.9, 0.4, 0xa0503a, 0.8, 2.5, -0.4, g);
      return bakeGeo(g);
    });
    const makeHouse = (i) => baked(houseGeos[i % houseGeos.length]);
    const houses = [];
    for (let i = 0, x = -15; x <= 15.01; x += 2.6, i++) {
      if (Math.abs(x) < 1.6) continue; // her feet are there
      const z = -(halfW(x) + 2.4 + (Math.abs(x) < 6 ? 0 : 0.6 * Math.sin(x)));
      const home = new THREE.Vector3(x, heightAt(x, z) - 0.05, z);
      const g = makeHouse(i); g.position.copy(home); g.rotation.y = (rng() - 0.5) * 0.4;
      houses.push({ g, home, rot: g.rotation.y, state: 'home', t: 0, from: new THREE.Vector3(), to: new THREE.Vector3(), spin: new THREE.Vector3(), tilt: new THREE.Vector3(), ring: null });
    }
    // a few more along both banks, out of her reach, and some date palms
    const palmGeo = (() => {
      const g = loose(), lean = 0.15; let px = 0, py = 0;
      for (let k = 0; k < 6; k++) { const s = kit.cyl(0.22, 0.26, 0.9, k % 2 ? 0x8a6a44 : 0x7a5c3a, px, py, 0, g); s.rotation.z = lean; px -= Math.sin(lean) * 0.9; py += Math.cos(lean) * 0.9; }
      for (let k = 0; k < 8; k++) { const f = kit.box(0.45, 0.06, 2.8, k % 2 ? 0x4c7a2a : 0x5e8a34, px, py, 0, g); f.geometry.translate(0, 0, 1.4); f.rotation.set(0.45 + (k % 2) * 0.25, k / 8 * Math.PI * 2, 0, 'YXZ'); }
      return bakeGeo(g);
    })();
    const palms = [];
    const palm = (x, z) => palms.push(new THREE.Matrix4().compose(new THREE.Vector3(x, heightAt(x, z) - 0.1, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rng() * 6.3, 0)), new THREE.Vector3().setScalar(0.85 + rng() * 0.4)));
    for (let i = 0; i < 14; i++) {
      const x = -40 + i * 6.2 + rng() * 2, side = i % 2 ? 1 : -1;
      if (side < 0 && Math.abs(x) < 20) continue;
      const z = side * (halfW(x) + 5 + rng() * 5);
      const g = makeHouse(i + 3); g.position.set(x, heightAt(x, z) - 0.05, z); g.rotation.y = side > 0 ? Math.PI : 0;
    }
    for (let i = 0; i < 16; i++) { const x = -42 + rng() * 84, s = rng() < 0.6 ? 1 : -1; if (s < 0 && Math.abs(x) < 18) continue; palm(x, s * (halfW(x) + 2 + rng() * 9)); }
    {
      const im = new THREE.InstancedMesh(palmGeo, VC, palms.length); palms.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = true; im.receiveShadow = true; scene.add(im);
      baked(bakeGeo(decor));
    }

    // ----- effects: one pool of little balls for splashes, smoke, sparks, tears and wakes -----
    const MAXP = 900;
    const pMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshStandardMaterial({ roughness: 0.6 }), MAXP);
    pMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); pMesh.frustumCulled = false; pMesh.count = 0; scene.add(pMesh);
    const parts = [];
    const pc = new THREE.Color(), m4 = new THREE.Matrix4(), q0 = new THREE.Quaternion(), sv = new THREE.Vector3(), ss = new THREE.Vector3();
    const puff = (x, y, z, vx, vy, vz, color, size, life, grav = 9) => { if (parts.length < MAXP) parts.push({ x, y, z, vx, vy, vz, color, size, life, max: life, grav }); };
    const splash = (x, z, big = 1) => {
      for (let i = 0; i < 40 * big; i++) { const a = rng() * Math.PI * 2, r = rng() * 3 * big; puff(x + Math.cos(a) * r * 0.3, 0, z + Math.sin(a) * r * 0.3, Math.cos(a) * r, 4 + rng() * 7 * big, Math.sin(a) * r, 0xffffff, 0.15 + rng() * 0.25 * big, 0.8 + rng() * 0.6); }
    };
    const boom = (x, y, z) => {
      for (let i = 0; i < 26; i++) { const a = rng() * Math.PI * 2, e = rng() * 1.4; puff(x, y, z, Math.cos(a) * 4 * Math.cos(e), Math.sin(e) * 5, Math.sin(a) * 4 * Math.cos(e), i < 14 ? 0xffa030 : 0x555555, 0.2 + rng() * 0.35, 0.5 + rng() * 0.5, i < 14 ? 2 : -1); }
    };
    const rings = []; // expanding shock rings on the water and land
    const shock = (x, y, z, color, size) => {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
      m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); scene.add(m); rings.push({ m, t: 0, size });
    };

    // floating words
    const pops = [];
    const pop = (x, y, z, text, color, size = 1) => {
      const c = document.createElement('canvas'); c.width = 512; c.height = 160;
      const g = c.getContext('2d'); g.font = '900 92px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 14; g.strokeStyle = '#1a0d08'; g.strokeText(text, 256, 84, 500); g.fillStyle = color; g.fillText(text, 256, 84, 500);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); sp.scale.set(5 * size, 1.6 * size, 1); sp.renderOrder = 20;
      sp.position.set(x, y, z); scene.add(sp); pops.push({ sp, life: 0 });
    };

    // ----- the tankers -----
    const hullShape = [[-1.6, -0.62], [0.9, -0.62], [1.75, 0], [0.9, 0.62], [-1.6, 0.62]];
    const oilGeo = (() => {
      const g = loose();
      for (const [x, z] of [[0.25, -0.27], [0.25, 0.27], [0.85, 0]]) { kit.cyl(0.24, 0.24, 0.5, 0x1d2a48, x, 0.44, z, g); kit.cyl(0.25, 0.25, 0.05, 0xf2c200, x, 0.62, z, g); kit.cyl(0.25, 0.25, 0.05, 0xf2c200, x, 0.75, z, g); }
      return bakeGeo(g);
    })();
    const makeBoat = (p) => {
      const root = new THREE.Group(); scene.add(root);
      const rock = new THREE.Group(); rock.scale.setScalar(BOAT); root.add(rock);
      const b = loose();
      const hull = kit.extrude(hullShape, 0.55, 0x2a2e34, b, {}, 0.06); hull.rotation.x = -Math.PI / 2; hull.position.y = 0.05;
      const under = kit.extrude(hullShape.map(([x, z]) => [x * 0.96, z * 0.92]), 0.3, 0xa8281e, b); under.rotation.x = -Math.PI / 2; under.position.y = -0.2;
      const deck = kit.extrude(hullShape.map(([x, z]) => [x * 0.94, z * 0.86]), 0.04, 0x6c7a5a, b); deck.rotation.x = -Math.PI / 2; deck.position.y = 0.4;
      const col = new THREE.Color(p.color).getHex();
      kit.box(0.85, 0.75, 1.0, col, -1.05, 0.42, 0, b);
      kit.box(0.88, 0.2, 1.03, 0x1a242c, -1.03, 0.9, 0, b);
      kit.box(1.0, 0.08, 1.15, 0xf2f2f2, -1.05, 1.17, 0, b);
      kit.cyl(0.16, 0.18, 0.7, col, -1.35, 1.2, 0, b);
      kit.cyl(0.17, 0.17, 0.12, 0x111111, -1.35, 1.85, 0, b);
      baked(bakeGeo(b), rock);
      const oil = baked(oilGeo, rock); oil.visible = false;
      const doll = mg.makeDoll(p, { scale: 0.42, tag: false });
      doll.group.position.set(-0.35, 0.44, 0); rock.add(doll.group);
      // name, lives, oil and rockets above the boat
      const c = document.createElement('canvas'); c.width = 256; c.height = 96;
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })); tag.scale.set(3.2, 1.2, 1); tag.renderOrder = 15; scene.add(tag);
      return { root, rock, oil, doll, tag, tagCanvas: c, tagTex: tex, tagKey: '' };
    };
    const drawTag = (R) => {
      const key = `${LIVES - R.hits}|${R.cargo}|${R.ammo}|${R.sinking > 0}`;
      if (key === R.tagKey) return;
      R.tagKey = key;
      const g = R.tagCanvas.getContext('2d'); g.clearRect(0, 0, 256, 96);
      g.fillStyle = 'rgba(16,10,20,0.72)'; g.beginPath(); g.roundRect(8, 4, 240, 88, 22); g.fill();
      g.fillStyle = R.p.color; g.fillRect(8, 4, 10, 88);
      g.font = '900 34px system-ui, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = '#fff';
      g.fillText(R.p.name, 28, 28, 210);
      for (let i = 0; i < LIVES; i++) { g.beginPath(); g.arc(44 + i * 34, 66, 12, 0, Math.PI * 2); g.fillStyle = i < LIVES - R.hits ? '#ff4d5e' : '#4a4050'; g.fill(); }
      if (R.cargo) { g.fillStyle = '#1d2a48'; g.fillRect(150, 50, 26, 32); g.fillStyle = '#f2c200'; g.fillRect(150, 56, 26, 5); g.fillRect(150, 72, 26, 5); }
      if (R.ammo) { g.fillStyle = '#ff5a3a'; g.beginPath(); g.moveTo(232, 66); g.lineTo(212, 56); g.lineTo(192, 56); g.lineTo(192, 76); g.lineTo(212, 76); g.closePath(); g.fill(); if (R.ammo > 1) { g.fillStyle = '#fff'; g.font = '900 22px system-ui'; g.fillText('2', 196, 67); } }
      R.tagTex.needsUpdate = true;
    };
    const laneZ = (i) => (i - (n - 1) / 2) * Math.min(2.2, 14 / Math.max(1, n));
    const startX = PORT_X - 3.5;
    const riders = players.map((p, i) => {
      const R = { p, ...makeBoat(p), i, x: startX, z: laneZ(i), vx: 0, vz: 0, yaw: 0, sx: 0, sy: 0, held: 0, hits: 0, cargo: false, ammo: 0, delivered: 0, inv: 0, stun: 0, sinking: 0, spinV: 0, wakeT: 0,
        bot: p.bot ? { lane: (rng() - 0.5) * 0.9, re: 0, nerve: 0.5 + rng() * 0.8, skill: 0.75 + rng() * 0.25, dodge: 0, dodgeZ: 0 } : null };
      drawTag(R); return R;
    });

    // ----- rocket crates bobbing in the strait -----
    const rocketParts = (parent, s = 1, y = 0) => {
      const g = new THREE.Group(); g.scale.setScalar(s); g.position.y = y; parent.add(g);
      const b = kit.cyl(0.13, 0.13, 0.9, 0xf0f0f0, 0, -0.45, 0, g); b.rotation.z = -Math.PI / 2; b.position.set(0, 0, 0);
      const nose = kit.cone(0.13, 0.35, 0xe8402a, 0, 0, 0, g); nose.rotation.z = -Math.PI / 2; nose.position.set(0.62, 0, 0);
      for (let k = 0; k < 3; k++) { const f = kit.box(0.3, 0.02, 0.22, 0xe8402a, -0.38, 0, 0, g); f.rotation.x = k / 3 * Math.PI * 2; f.position.set(-0.38, 0, 0); f.geometry.translate(0, 0, 0.12); }
      return g;
    };
    const rocketGeo = (() => { const g = loose(); rocketParts(g, 1.1); return bakeGeo(g); })();
    const crateGeo = (() => {
      const g = loose();
      kit.box(0.9, 0.7, 0.9, 0xf2c200, 0, -0.25, 0, g);
      for (const s of [-1, 1]) kit.box(0.94, 0.08, 0.12, 0x6a4a1a, 0, 0.2, s * 0.32, g);
      rocketParts(g, 0.9, 0.85);
      return bakeGeo(g);
    })();
    const crates = [];
    const placeCrate = (C) => {
      for (let k = 0; k < 20; k++) {
        const x = -26 + rng() * 52, w = halfW(x) - 1.6, z = (rng() * 2 - 1) * w;
        if (riders.some((R) => Math.hypot(R.x - x, R.z - z) < 4)) continue;
        C.x = x; C.z = z; break;
      }
      C.on = true; C.g.visible = true; C.pop = 0;
    };
    for (let i = 0; i < 2 + Math.ceil(n / 3); i++) {
      const g = baked(crateGeo);
      const glow = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.15, 32), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }));
      glow.rotation.x = -Math.PI / 2; glow.position.y = 0.05; scene.add(glow);
      const C = { g, glow, x: 0, z: 0, on: true, wait: 0, pop: 0, ph: rng() * 6 };
      placeCrate(C); crates.push(C);
    }

    // ----- rockets in flight -----
    const rockets = [];
    const fire = (R) => {
      if (!R.ammo || R.sinking > 0 || R.stun > 0.3) return;
      R.ammo--;
      const fx = Math.cos(R.yaw), fz = Math.sin(R.yaw);
      const g = baked(rocketGeo);
      rockets.push({ R, g, x: R.x + fx * 2.4, z: R.z + fz * 2.4, a: R.yaw, life: ROCKET_LIFE });
      sfx.play('whoosh');
      syncPad(R);
    };
    const explodeRocket = (k) => { const r = rockets[k]; boom(r.x, 0.8, r.z); scene.remove(r.g); rockets.splice(k, 1); sfx.play('boom'); };

    // the FIRE button lights up when you've got a rocket
    const syncPad = (R) => { if (!R.p.bot) mg.padSend(R.p, { lit: 'fire', on: R.ammo > 0 ? 1 : 0 }); };
    let padT = 0;

    const hit = (R, from, cause) => {
      if (R.inv > 0 || R.sinking > 0) return false;
      R.hits++; R.inv = 1.3; R.stun = 0.7; R.spinV = (rng() < 0.5 ? -1 : 1) * 9;
      const dx = R.x - from.x, dz = R.z - from.z, d = Math.hypot(dx, dz) || 1;
      R.vx += dx / d * 6; R.vz += dz / d * 6;
      R.doll.flinch();
      if (R.hits >= LIVES) {
        R.sinking = 1.8; R.cargo = false; R.oil.visible = false;
        pop(R.x, 3.5, R.z, 'SUNK!', '#ff5a5a', 0.9); sfx.play('deflate');
      } else pop(R.x, 3.5, R.z, cause === 'house' ? 'HOUSED!' : 'BOOM!', '#ffd23f', 0.75);
      sfx.play('bonk');
      return true;
    };
    const respawn = (R) => {
      R.x = startX - rng() * 2; R.z = laneZ(R.i) * 0.8 + (rng() - 0.5); R.vx = R.vz = 0; R.yaw = 0; R.hits = 0; R.inv = 2; R.stun = 0; R.spinV = 0;
      R.rock.rotation.set(0, 0, 0); R.root.position.y = 0;
      pop(R.x, 3.5, R.z, 'BACK AGAIN', R.p.color, 0.7);
    };

    // ----- the tantrum: wind up, slam, a house (or two) goes flying -----
    const fling = (count) => {
      const free = houses.filter((h) => h.state === 'home');
      for (let k = 0; k < count && free.length; k++) {
        // the house nearest the hand that came down
        const hx = BX + B.side * (4 + rng() * 9) * (k ? -1 : 1);
        free.sort((a, b) => Math.abs(a.home.x - hx) - Math.abs(b.home.x - hx));
        const H = free.shift();
        // aim at where a boat will be, or anywhere in the middle stretch
        let tx, tz;
        const live = riders.filter((R) => R.sinking <= 0 && Math.abs(R.x) < 33);
        if (live.length && rng() < 0.6) {
          const R = live[(rng() * live.length) | 0];
          tx = R.x + R.vx * FLIGHT * 0.8 + (rng() - 0.5) * 3; tz = R.z + R.vz * FLIGHT * 0.8 + (rng() - 0.5) * 3;
        } else { tx = -30 + rng() * 60; tz = (rng() * 2 - 1) * halfW(tx); }
        tx = Math.max(-33, Math.min(33, tx)); const w = halfW(tx) - 0.8; tz = Math.max(-w, Math.min(w, tz));
        H.state = 'fly'; H.t = 0; H.from.copy(H.g.position); H.to.set(tx, 0, tz);
        H.spin.set((rng() - 0.5) * 8, (rng() - 0.5) * 6, (rng() - 0.5) * 8);
        // the warning ring where it'll land
        const ring = new THREE.Group(); ring.position.set(tx, 0.06, tz); scene.add(ring);
        const outer = new THREE.Mesh(new THREE.RingGeometry(SPLASH_R - 0.25, SPLASH_R, 40), new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.85, depthWrite: false }));
        const fill = new THREE.Mesh(new THREE.CircleGeometry(SPLASH_R, 40), new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.3, depthWrite: false }));
        outer.rotation.x = fill.rotation.x = -Math.PI / 2; fill.scale.setScalar(0.01); ring.add(outer, fill);
        H.ring = { g: ring, fill };
        puff(H.from.x, H.from.y + 0.5, H.from.z, 0, 3, 0, 0xc9a46c, 0.6, 0.6, -1);
      }
    };
    const updateBaby = (dt, running, prog) => {
      B.t += dt; B.sob += dt;
      if (B.state === 'idle') {
        // sobbing: shoulders heave, arms flap
        for (const a of arms) a.sw.rotation.x += (ARM.rest + Math.sin(B.sob * 7 + a.s) * 0.18 - a.sw.rotation.x) * Math.min(1, dt * 6);
        if (running) B.next -= dt;
        if (B.next <= 0) { B.state = 'wind'; B.t = 0; B.side = rng() < 0.5 ? -1 : 1; sfx.play('wah'); }
      } else if (B.state === 'wind') {
        const k = Math.min(1, B.t / 0.95);
        for (const a of arms) a.sw.rotation.x = ARM.rest + (ARM.up - ARM.rest) * (1 - (1 - k) ** 3);
        if (B.t >= 0.95) { B.state = 'slam'; B.t = 0; }
      } else if (B.state === 'slam') {
        const k = Math.min(1, B.t / 0.16);
        for (const a of arms) a.sw.rotation.x = ARM.up + (ARM.down - ARM.up) * k * k;
        if (k >= 1) {
          B.state = 'hold'; B.t = 0; B.shake = 0.5;
          sfx.play('bigboom');
          for (const a of arms) { a.hand.getWorldPosition(handPos); for (let i = 0; i < 14; i++) { const an = rng() * Math.PI * 2; puff(handPos.x, handPos.y - 0.4, handPos.z, Math.cos(an) * 5, 2 + rng() * 3, Math.sin(an) * 5, 0xc9a46c, 0.3 + rng() * 0.3, 0.7); } shock(handPos.x, handPos.y - 0.6, handPos.z, 0xfff0d0, 7); }
          const extra = (n >= 5 ? 0.45 : 0.15) + prog * 0.45;
          fling(1 + (rng() < extra ? 1 : 0));
        }
      } else if (B.state === 'hold') {
        if (B.t > 0.45) { B.state = 'idle'; B.t = 0; B.next = Math.max(1.6, 4.2 - prog * 2.2) + rng() * 1.2; }
      }
      // she rocks and heaves while she cries
      body.rotation.z = Math.sin(B.sob * 2.3) * 0.04;
      body.position.y = Math.abs(Math.sin(B.sob * 7)) * 0.12;
      head.rotation.z = Math.sin(B.sob * 3.1) * 0.08;
      mouth.scale.y = 0.6 + Math.abs(Math.sin(B.sob * 5)) * 0.35 + (B.state === 'wind' ? 0.3 : 0);
      // tears fountain out sideways from the eyes
      for (const s of [-1, 1]) if (rng() < dt * 30) { sv.set(s * 1.3, 7.75, 2.3); body.localToWorld(sv); puff(sv.x, sv.y, sv.z, s * (3.5 + rng() * 2.5), 2.5 + rng() * 2.5, 1.5 + rng() * 2, 0x7fd0ff, 0.22 + rng() * 0.12, 1.5); }
    };
    const updateHouses = (dt) => {
      for (const H of houses) {
        H.t += dt;
        if (H.state === 'fly') {
          const s = Math.min(1, H.t / FLIGHT);
          H.g.position.lerpVectors(H.from, H.to, s); H.g.position.y = H.from.y + (H.to.y - H.from.y) * s + 16 * s * (1 - s) - 0.4 * s;
          H.g.rotation.x += H.spin.x * dt; H.g.rotation.y += H.spin.y * dt; H.g.rotation.z += H.spin.z * dt;
          if (H.ring) { H.ring.fill.scale.setScalar(Math.max(0.01, s)); H.ring.fill.material.opacity = 0.2 + s * 0.35; }
          if (s >= 1) {
            if (H.ring) { scene.remove(H.ring.g); H.ring.g.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); }); H.ring = null; }
            splash(H.to.x, H.to.z, 1.3); shock(H.to.x, 0.08, H.to.z, 0xffffff, SPLASH_R * 1.8); sfx.play('thud');
            for (const R of riders) if (Math.hypot(R.x - H.to.x, R.z - H.to.z) < SPLASH_R + 0.3) hit(R, H.to, 'house');
            H.state = 'float'; H.t = 0; H.tilt.set((rng() - 0.5) * 0.7, rng() * 6, (rng() - 0.5) * 0.7);
          }
        } else if (H.state === 'float') {
          // wallowing roof-up in the water: something to steer round
          H.g.position.set(H.to.x, -0.9 + Math.sin(H.t * 2) * 0.08, H.to.z);
          H.g.rotation.set(H.tilt.x + Math.sin(H.t * 1.7) * 0.05, H.tilt.y, H.tilt.z);
          if (H.t > 6) { H.state = 'sink'; H.t = 0; }
        } else if (H.state === 'sink') {
          H.g.position.y = -0.9 - H.t * 2;
          if (H.t > 1.4) { H.state = 'gone'; H.t = 0; H.g.visible = false; }
        } else if (H.state === 'gone') {
          // rebuilt back on the shore
          if (H.t > 2) { H.state = 'grow'; H.t = 0; H.g.visible = true; H.g.position.copy(H.home); H.g.rotation.set(0, H.rot, 0); H.g.scale.setScalar(0.01); }
        } else if (H.state === 'grow') {
          H.g.scale.setScalar(Math.min(1, H.t / 0.8));
          if (H.t >= 0.8) { H.state = 'home'; H.g.scale.setScalar(1); }
        }
      }
    };

    // ----- CPU skippers -----
    const botDrive = (R, dt) => {
      const Bt = R.bot; Bt.re -= dt;
      const goalX = R.cargo ? startX - 2 : TERM_X + 4, dir = Math.sign(goalX - R.x) || 1;
      let tx = R.x + dir * 9; if (dir > 0 ? tx > goalX : tx < goalX) tx = goalX;
      if (Bt.re <= 0) { Bt.re = 1 + rng() * 1.5; Bt.lane = Math.max(-0.8, Math.min(0.8, Bt.lane + (rng() - 0.5) * 0.5)); }
      let tz = Bt.lane * (halfW(tx) - 1.5);
      // a crate close by and not much of a detour
      if (R.ammo < 2) {
        let best = null, bd = 9;
        for (const C of crates) if (C.on && (C.x - R.x) * dir > -1) { const d = Math.hypot(C.x - R.x, C.z - R.z); if (d < bd) { bd = d; best = C; } }
        if (best) { tx = best.x; tz = best.z; }
      }
      // get out of any red ring or floating house in the way
      let ax = tx - R.x, az = tz - R.z;
      const al = Math.hypot(ax, az) || 1; ax /= al; az /= al;
      for (const H of houses) {
        if (H.state !== 'fly' && H.state !== 'float') continue;
        const left = H.state === 'fly' ? FLIGHT - H.t : 0;
        const px = R.x + R.vx * Math.min(left, 1), pz = R.z + R.vz * Math.min(left, 1);
        const dx = px - H.to.x, dz = pz - H.to.z, d = Math.hypot(dx, dz), rr = (H.state === 'fly' ? SPLASH_R + 1.4 : 2.4) * (0.7 + Bt.skill * 0.4);
        if (d < rr) { const w = (rr - d) / rr * 2.5; ax += dx / (d || 1) * w; az += dz / (d || 1) * w; }
      }
      for (const Q of riders) { if (Q === R) continue; const dx = R.x - Q.x, dz = R.z - Q.z, d = Math.hypot(dx, dz); if (d < 2.4 && d > 0.01) { ax += dx / d * 0.4; az += dz / d * 0.4; } }
      const l = Math.hypot(ax, az) || 1;
      R.sx = ax / l * Bt.skill; R.sy = -az / l * Bt.skill;
      // fire at anyone lined up in front
      if (R.ammo) {
        for (const Q of riders) {
          if (Q === R || Q.sinking > 0 || Q.inv > 0) continue;
          const dx = Q.x - R.x, dz = Q.z - R.z, d = Math.hypot(dx, dz);
          if (d < 18 && d > 2.5 && Math.abs(wrap(Math.atan2(dz, dx) - R.yaw)) < 0.3 && rng() < dt * Bt.nerve * 3) { fire(R); break; }
        }
      }
    };

    const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.5, 400);
    const camBase = new THREE.Vector3(5, 64, 54), camAt = new THREE.Vector3(5, 0, -2.5);
    let tAll = 0, run = 0;

    return {
      camera,
      update(dt, t, running) {
        tAll += dt; if (running) run += dt;
        const prog = Math.min(1, run / Math.max(1, mg.duration || 90));
        updateBaby(dt, running, prog);
        updateHouses(dt);

        for (const R of riders) {
          R.inv = Math.max(0, R.inv - dt); R.stun = Math.max(0, R.stun - dt);
          if (R.sinking > 0) {
            R.sinking -= dt;
            R.rock.rotation.z += dt * 0.6; R.rock.rotation.x += dt * 0.3; R.root.position.y -= dt * 0.9;
            R.vx *= 1 - dt * 2; R.vz *= 1 - dt * 2;
            if (rng() < dt * 20) puff(R.x + (rng() - 0.5), 0.1, R.z + (rng() - 0.5), 0, 1.5 + rng(), 0, 0xffffff, 0.15, 0.6);
            if (R.sinking <= 0) respawn(R);
          } else {
            if (running && R.bot) botDrive(R, dt);
            const mag = running && R.stun <= 0 ? Math.min(1, Math.hypot(R.sx, R.sy)) : 0;
            if (mag > 0.18) {
              const want = Math.atan2(-R.sy, R.sx); // stick up is away from the camera (north, -z)
              const d = wrap(want - R.yaw);
              R.yaw += Math.sign(d) * Math.min(Math.abs(d), TURN * dt * (0.5 + mag * 0.5));
              // a boat only pushes the way it's pointing; turning hard slows it
              const thrust = (R.cargo ? ACC_FULL : ACC) * mag * Math.max(0.2, Math.cos(d));
              R.vx += Math.cos(R.yaw) * thrust * dt; R.vz += Math.sin(R.yaw) * thrust * dt;
            }
            if (R.spinV) { R.yaw += R.spinV * dt; R.spinV *= 1 - Math.min(1, dt * 3); if (Math.abs(R.spinV) < 0.2) R.spinV = 0; }
            // water drag, much stronger sideways (the keel)
            const fx = Math.cos(R.yaw), fz = Math.sin(R.yaw);
            let vf = R.vx * fx + R.vz * fz, vl = -R.vx * fz + R.vz * fx;
            vf *= Math.exp(-DRAG * dt); vl *= Math.exp(-4 * dt);
            R.vx = vf * fx - vl * fz; R.vz = vf * fz + vl * fx;
          }
          R.x += R.vx * dt; R.z += R.vz * dt;
          // the banks and the two ends
          if (R.x < -XL + 1) { R.x = -XL + 1; R.vx = Math.abs(R.vx) * 0.3; }
          if (R.x > XL - 1) { R.x = XL - 1; R.vx = -Math.abs(R.vx) * 0.3; }
          const w = halfW(R.x) - BOAT_R;
          if (R.z > w) { R.z = w; R.vz = -Math.abs(R.vz) * 0.3; }
          if (R.z < -w) { R.z = -w; R.vz = Math.abs(R.vz) * 0.3; }
          // floating houses are in the way
          for (const H of houses) {
            if (H.state !== 'float') continue;
            const dx = R.x - H.to.x, dz = R.z - H.to.z, d = Math.hypot(dx, dz), rr = 1.7 + BOAT_R * 0.6;
            if (d < rr && d > 0.001) { R.x = H.to.x + dx / d * rr; R.z = H.to.z + dz / d * rr; const vn = (R.vx * dx + R.vz * dz) / d; if (vn < 0) { R.vx -= dx / d * vn * 1.3; R.vz -= dz / d * vn * 1.3; } }
          }
          if (R.sinking > 0) continue;
          // load up at the terminal, cash in at home
          if (!R.cargo && R.x > TERM_X) { R.cargo = true; R.oil.visible = true; pop(R.x, 3.5, R.z, 'OIL!', '#ffd23f', 0.8); sfx.play('pour'); }
          if (R.cargo && R.x < PORT_X) { R.cargo = false; R.oil.visible = false; R.delivered++; pop(R.x, 3.5, R.z, `+${LOAD}`, '#5cff9d', 1); sfx.play('coin'); }
          // crates
          for (const C of crates) if (C.on && Math.hypot(C.x - R.x, C.z - R.z) < 1.6) {
            C.on = false; C.wait = 4 + rng() * 3; C.g.visible = false; C.glow.visible = false;
            if (R.ammo < 2) { R.ammo++; syncPad(R); }
            pop(R.x, 3.5, R.z, 'ROCKET!', '#ff8a3d', 0.7); sfx.play('item');
          }
        }
        // boats bump each other
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
          const a = riders[i], b = riders[j]; if (a.sinking > 0 || b.sinking > 0) continue;
          const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
          if (d > 0.001 && d < BOAT_R * 2) {
            const k = (BOAT_R * 2 - d) / 2, ux = dx / d, uz = dz / d; a.x -= ux * k; a.z -= uz * k; b.x += ux * k; b.z += uz * k;
            const rv = (b.vx - a.vx) * ux + (b.vz - a.vz) * uz; if (rv < 0) { a.vx += ux * rv * 0.8; a.vz += uz * rv * 0.8; b.vx -= ux * rv * 0.8; b.vz -= uz * rv * 0.8; }
          }
        }
        // draw the boats: rocking on the swell, blinking while they can't be hit
        for (const R of riders) {
          R.root.position.x = R.x; R.root.position.z = R.z; if (R.sinking <= 0) R.root.position.y = Math.sin(tAll * 2.2 + R.i) * 0.06;
          R.root.rotation.y = -R.yaw;
          if (R.sinking <= 0) { const sp = Math.hypot(R.vx, R.vz); R.rock.rotation.x = Math.sin(tAll * 1.7 + R.i * 2) * 0.05; R.rock.rotation.z = Math.min(0.12, sp * 0.015) + Math.sin(tAll * 2.3 + R.i) * 0.03; }
          R.root.visible = R.sinking > 0 || R.inv <= 0 || Math.floor(tAll * 10) % 2 === 0;
          R.doll.group.rotation.y = R.yaw; // always facing the TV
          R.doll.update(dt);
          R.tag.position.set(R.x, Math.max(0.6, R.root.position.y + 3.5), R.z);
          drawTag(R);
          // wake
          const sp = Math.hypot(R.vx, R.vz);
          if (R.sinking <= 0 && sp > 1.2 && (R.wakeT -= dt) <= 0) {
            R.wakeT = 0.05;
            const bx = R.x - Math.cos(R.yaw) * 2.1, bz = R.z - Math.sin(R.yaw) * 2.1;
            for (const s of [-1, 1]) puff(bx - Math.sin(R.yaw) * s * 0.4, 0.05, bz + Math.cos(R.yaw) * s * 0.4, -Math.sin(R.yaw) * s * 0.6, 0.6, Math.cos(R.yaw) * s * 0.6, 0xf4fbff, 0.22, 0.9, 1.5);
          }
        }
        // rockets: straight on, curving onto anyone in front of them
        for (let k = rockets.length - 1; k >= 0; k--) {
          const r = rockets[k]; r.life -= dt;
          let best = null, bd = 30;
          for (const Q of riders) {
            if (Q === r.R || Q.sinking > 0) continue;
            const dx = Q.x - r.x, dz = Q.z - r.z, d = Math.hypot(dx, dz);
            if (d < bd && Math.abs(wrap(Math.atan2(dz, dx) - r.a)) < ROCKET_CONE) { bd = d; best = Q; }
          }
          if (best) { const d = wrap(Math.atan2(best.z - r.z, best.x - r.x) - r.a); r.a += Math.sign(d) * Math.min(Math.abs(d), ROCKET_TURN * dt); }
          r.x += Math.cos(r.a) * ROCKET_V * dt; r.z += Math.sin(r.a) * ROCKET_V * dt;
          r.g.position.set(r.x, 0.8, r.z); r.g.rotation.y = -r.a;
          puff(r.x - Math.cos(r.a) * 0.6, 0.8, r.z - Math.sin(r.a) * 0.6, (rng() - 0.5), rng(), (rng() - 0.5), rng() < 0.5 ? 0xffb040 : 0xbbbbbb, 0.14 + rng() * 0.1, 0.4, -1);
          let gone = r.life <= 0 || Math.abs(r.z) > halfW(r.x) || Math.abs(r.x) > XL;
          for (const Q of riders) if (!gone && Q !== r.R && Q.sinking <= 0 && Math.hypot(Q.x - r.x, Q.z - r.z) < 1.3) { hit(Q, { x: r.x - Math.cos(r.a), z: r.z - Math.sin(r.a) }, 'rocket'); gone = true; }
          for (const H of houses) if (!gone && H.state === 'float' && Math.hypot(H.to.x - r.x, H.to.z - r.z) < 1.7) gone = true;
          if (gone) explodeRocket(k);
        }
        // crates bob and come back
        for (const C of crates) {
          if (!C.on) { if ((C.wait -= dt) <= 0) { placeCrate(C); C.glow.visible = true; } continue; }
          C.pop = Math.min(1, C.pop + dt * 3);
          C.g.position.set(C.x, 0.15 + Math.sin(tAll * 2 + C.ph) * 0.12, C.z); C.g.rotation.y = tAll * 0.8 + C.ph; C.g.scale.setScalar(C.pop);
          C.glow.position.set(C.x, 0.05, C.z); C.glow.scale.setScalar(1 + Math.sin(tAll * 4 + C.ph) * 0.12);
        }
        // particles
        let c = 0;
        for (let i = parts.length - 1; i >= 0; i--) {
          const P = parts[i]; P.life -= dt;
          if (P.life <= 0 || (P.y < -0.2 && P.grav > 0)) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
          P.vy -= P.grav * dt; P.x += P.vx * dt; P.y += P.vy * dt; P.z += P.vz * dt;
          const s = P.size * (P.grav < 0 ? 1 + (1 - P.life / P.max) * 1.5 : Math.min(1, P.life / P.max * 2));
          m4.compose(sv.set(P.x, P.y, P.z), q0, ss.set(s, s, s)); pMesh.setMatrixAt(c, m4); pMesh.setColorAt(c, pc.set(P.color)); c++;
        }
        pMesh.count = c; pMesh.instanceMatrix.needsUpdate = true; if (pMesh.instanceColor) pMesh.instanceColor.needsUpdate = true;
        for (let i = rings.length - 1; i >= 0; i--) {
          const g = rings[i]; g.t += dt; const k = g.t / 0.7;
          g.m.scale.setScalar(0.3 + k * g.size); g.m.material.opacity = 0.8 * (1 - k);
          if (k >= 1) { scene.remove(g.m); g.m.geometry.dispose(); g.m.material.dispose(); rings.splice(i, 1); }
        }
        for (let i = pops.length - 1; i >= 0; i--) { const q = pops[i]; q.life += dt; q.sp.position.y += dt * 1.4; q.sp.material.opacity = Math.min(1, 2.4 - q.life * 2); if (q.life > 1.2) { scene.remove(q.sp); q.sp.material.map.dispose(); q.sp.material.dispose(); pops.splice(i, 1); } }
        // the water drifts, the flare flickers, and the camera shakes when she slams
        if (waterMat.map) { waterMat.map.offset.x = tAll * 0.01; waterMat.map.offset.y = tAll * 0.004; }
        if (waterMat.normalMap) { waterMat.normalMap.offset.x = -tAll * 0.008; waterMat.normalMap.offset.y = tAll * 0.006; }
        flare.scale.setScalar(0.9 + Math.sin(tAll * 17) * 0.1 + Math.sin(tAll * 7) * 0.08);
        B.shake = Math.max(0, B.shake - dt);
        const sh = B.shake * 0.9;
        camera.position.set(camBase.x + (rng() - 0.5) * sh, camBase.y + (rng() - 0.5) * sh, camBase.z);
        camera.lookAt(camAt);
        // keep each phone's FIRE button right (again every few seconds in case a phone reconnected)
        if ((padT -= dt) <= 0) { padT = 3; for (const R of riders) syncPad(R); }
      },
      input(p, m) {
        const R = riders.find((x) => x.p === p); if (!R || m.b !== 'stick') return;
        const held = Number(m.h) || 0, newly = held & ~R.held;
        R.held = held;
        if (Number.isFinite(m.x)) R.sx = Math.max(-1, Math.min(1, m.x));
        if (Number.isFinite(m.y)) R.sy = Math.max(-1, Math.min(1, m.y));
        if (newly & BTN.FIRE) fire(R);
      },
      // 10 a load brought home, plus up to 9 for how far along this trip you are
      scores() {
        const span = TERM_X - PORT_X;
        return Object.fromEntries(riders.map((R) => {
          const out = Math.max(0, Math.min(1, (R.x - PORT_X) / span)), back = Math.max(0, Math.min(1, (TERM_X - R.x) / span));
          const leg = R.sinking > 0 ? 0 : R.cargo ? 4 + back * 5 : out * 4;
          return [R.p.id, R.delivered * LOAD + Math.floor(leg)];
        }));
      },
    };
  },
};
