// Dubai High Flyer: stunt planes over Dubai at sunset, round the Burj Khalifa. Fly through the golden
// rings for points (and a bit of health back); new ones keep popping up somewhere else. Shoot someone
// down and you take one of their points. Crates hold power-ups: balloon mines, a flak strike on the
// leader, a speed boost, a tow rope that drags you up to the plane in front and slings you past,
// 10 s of autopilot to the next ring, and a shield. The further back you are, the better your odds
// of the good stuff (the shield most of all). Health packs float about too.
import { addSky } from '../../host/sky.js';
import { mergeGeometries } from '../../../vendor/BufferGeometryUtils.js';

const R = 140; // the arena: fly past this and the plane turns itself back
const ALT_MIN = 10, ALT_MAX = 150;
const SPEED = 30, TURN = 1.3, PITCH = 0.55; // m/s, rad/s, max climb angle
const RING_R = 13;
const HP = 100, BULLET_V = 170, BULLET_DMG = 7, FIRE_RATE = 7, HIT_R = 7;
const RESPAWN = 2.6, SAFE = 2;
const PLANE_S = 1.9; // planes are drawn a bit big so they read on the TV
const BTN = { FIRE: 1, POWER: 2 };
const POWERS = {
  mines: { emoji: '🎈', name: 'BALLOON MINES' },
  flak: { emoji: '💥', name: 'FLAK STRIKE' },
  boost: { emoji: '🚀', name: 'BOOST' },
  rope: { emoji: '🪢', name: 'TOW ROPE' },
  auto: { emoji: '🤖', name: 'AUTOPILOT' },
  shield: { emoji: '🛡️', name: 'SHIELD' },
};

export default {
  id: 'dubai-high-flyer',
  name: 'Dubai High Flyer',
  blurb: 'Stunt planes round the Burj Khalifa. Fly through rings, shoot each other down, cause chaos.',
  howTo: 'Stick left and right to turn, up to climb, down to dive. Hold FIRE to shoot. Fly through gold rings for a point and some health. Shoot someone down to take one of their points. Fly into ? crates for a power-up, then tap POWER to use it. Red crosses are health.',
  padText: 'Rings = points. Shoot = steal!',
  duration: 90,
  pad: { kind: 'stick', buttons: [{ bit: BTN.FIRE, label: '🔫 FIRE', tone: 'go' }, { bit: BTN.POWER, label: '⚡ POWER' }] },

  create(mg) {
    const { THREE, kit, scene, players, rng, renderer, sfx } = mg;
    const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

    // ----- Dubai at golden hour -----
    const { sun, dir: sunDir } = addSky(scene, renderer, { elevation: 26, azimuth: 250, turbidity: 7, rayleigh: 2.2, mie: 0.008, sun: 0xffc890, sunIntensity: 3.4, sky: 0xffd8b0, ground: 0x8a6a48, hemi: 0.6, env: 0.75, shadowSize: 200, fog: [0xf0c8a0, 260, 900] });
    sun.shadow.camera.far = 900; sun.position.multiplyScalar(2.5); sun.shadow.camera.updateProjectionMatrix();
    const plane = (w, d, m, x, y, z) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m); p.rotation.x = -Math.PI / 2; p.position.set(x, y, z); p.receiveShadow = true; scene.add(p); return p; };
    const rep = (name, opts, n) => { const m = kit.surf(name, opts).clone(); for (const k of ['map', 'normalMap', 'roughnessMap']) if (m[k]) { m[k] = m[k].clone(); m[k].repeat.set(n, n); m[k].needsUpdate = true; } return m; };
    plane(2400, 2400, rep('sand', { unit: 6, tint: 0xf0d0a0 }, 400), 0, 0, 0);
    // the Gulf to the north, the city on a concrete pad
    const sea = plane(2400, 1100, (() => { const m = rep('water', { unit: 20, metalness: 0.3, roughness: 0.15 }, 60); return m; })(), 0, 0.4, -760);
    void sea;
    const city = new THREE.Mesh(new THREE.CircleGeometry(205, 64), rep('concrete', { unit: 6, tint: 0xc8bca8 }, 70)); city.rotation.x = -Math.PI / 2; city.position.y = 0.2; city.receiveShadow = true; scene.add(city);
    // highways: Sheikh Zayed Road and a ring road
    kit.box(18, 0.1, 2400, kit.mat(0x3a3a3c, { roughness: 0.9 }), 40, 0.15, 0).castShadow = false;
    const ringRoad = new THREE.Mesh(new THREE.RingGeometry(188, 200, 96), kit.mat(0x3a3a3c, { roughness: 0.9 })); ringRoad.rotation.x = -Math.PI / 2; ringRoad.position.y = 0.3; scene.add(ringRoad);

    const solids = []; // things you can fly into: { x, z, r, h } (cylinders), or a function for odd shapes
    const glass = (tint) => kit.surf('windows', { arg: tint, unit: 10, metalness: 0.55, roughness: 0.15 });
    // the Burj Khalifa: three wings in a Y, stepping back as it rises, then the spire
    {
      const g = kit.group(0, 0, 0);
      const m = glass(0x9fb4c4), steel = kit.mat(0xd8dde2, { metalness: 0.9, roughness: 0.25 });
      const tiers = 11; let y = 0;
      for (let i = 0; i < tiers; i++) {
        const h = 13 - i * 0.4, k = 1 - i / tiers;
        for (let w = 0; w < 3; w++) {
          const len = 7 + 19 * k * (w === i % 3 ? 0.85 : 1);
          const b = kit.box(7 * (0.55 + k * 0.45), h, len, m, 0, y, 0, g); b.geometry.translate(0, 0, len / 2);
          b.rotation.y = w * Math.PI * 2 / 3;
        }
        kit.cyl(5 * (0.5 + k * 0.5), 5 * (0.5 + k * 0.5), h, steel, 0, y, 0, g, {}, 12);
        y += h;
      }
      kit.cyl(1.6, 0.4, 55, steel, 0, y, 0, g, {}, 10);
      kit.ball(0.9, kit.mat(0xff3020, { emissive: 0xff2010, emissiveIntensity: 3 }), 0, y + 55, 0, g);
      const top = y + 55;
      solids.push({ x: 0, z: 0, r: 22, h: 40 }, { x: 0, z: 0, r: 15, h: 90 }, { x: 0, z: 0, r: 8, h: top - 50 }, { x: 0, z: 0, r: 3, h: top });
    }
    // the Burj Al Arab: a white sail on its own island
    {
      const g = kit.group(95, 0, -215, -0.6);
      kit.cyl(22, 26, 3, kit.surf('sand', { unit: 4, tint: 0xf4e0b8 }), 0, 0, 0, g);
      const sail = []; for (let i = 0; i <= 20; i++) { const t = i / 20; sail.push([Math.sin(t * Math.PI) * 14 * (1 - t * 0.35), t * 92]); }
      sail.push([0, 92], [0, 0]);
      const s = kit.extrude(sail, 18, kit.mat(0xf6f4ee, { roughness: 0.4 }), g); s.position.y = 3; s.rotation.y = Math.PI / 2;
      kit.beam([-9, 3, -2], [-2, 100, -2], 1.2, kit.mat(0xe8e8e8, { metalness: 0.4 }), g);
      kit.beam([-9, 3, 2], [-2, 100, 2], 1.2, kit.mat(0xe8e8e8, { metalness: 0.4 }), g);
      const pad = kit.cyl(6, 6, 0.8, kit.mat(0x2a2a2a), 9, 70, 0, g); void pad;
      solids.push({ x: 95, z: -215, r: 14, h: 100 });
    }
    // the Dubai Frame: a giant gold picture frame
    {
      const g = kit.group(-105, 0, 70, 0.5), gold = kit.mat(0xd8a940, { metalness: 0.95, roughness: 0.25 });
      for (const s of [-1, 1]) kit.box(9, 80, 9, gold, s * 28, 0, 0, g);
      kit.box(65, 9, 9, gold, 0, 80, 0, g);
      solids.push({ x: -105 + Math.cos(0.5) * 28, z: 70 - Math.sin(0.5) * 28, r: 7, h: 89 }, { x: -105 - Math.cos(0.5) * 28, z: 70 + Math.sin(0.5) * 28, r: 7, h: 89 });
    }
    // the Museum of the Future: a silver ring with a hole in it
    {
      const g = kit.group(-70, 0, -75, 0.9);
      const t = new THREE.Mesh(new THREE.TorusGeometry(22, 9, 24, 64), kit.mat(0xd0d4d8, { metalness: 0.95, roughness: 0.2 }));
      t.scale.set(1, 1.25, 1); t.position.y = 30; t.castShadow = true; g.add(t);
      kit.box(30, 8, 22, kit.mat(0x7a8a6a), 0, 0, 0, g);
      solids.push({ x: -70, z: -75, r: 30, h: 8 }, (p) => { const q = g.worldToLocal(p.clone()); q.y -= 30; q.y /= 1.25; const d = Math.hypot(Math.hypot(q.x, q.y) - 22, q.z); return d < 9 + 2; });
      g.updateMatrixWorld(true);
    }
    // the Cayan Tower: a twisted tower
    {
      const g = kit.group(70, 0, 110), m = glass(0x8aa0b8);
      for (let i = 0; i < 30; i++) { const b = kit.box(16, 3.4, 16, m, 0, i * 3.4, 0, g); b.rotation.y = i * Math.PI / 2 / 30; }
      solids.push({ x: 70, z: 110, r: 11, h: 102 });
    }
    // the rest of the skyline: glass towers
    const tints = [0x6c8094, 0x8aa6b8, 0x5a7086, 0x9cb0b8, 0x3f566a, 0xb0b8c0];
    for (let i = 0, tries = 0; i < 15 && tries < 400; tries++) {
      const a = rng() * Math.PI * 2, r = 50 + rng() * 140, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const w = 12 + rng() * 9, d = 12 + rng() * 9, h = 28 + rng() * 55 * (1 - r / 260);
      const rad = Math.hypot(w, d) / 2 + 2;
      if (solids.some((s) => typeof s !== 'function' && Math.hypot(s.x - x, s.z - z) < s.r + rad + 14)) continue;
      if (Math.abs(x - 40) < rad + 10) continue; // keep the highway clear
      const t = kit.box(w, h, d, glass(tints[(rng() * tints.length) | 0]), x, 0, z);
      t.rotation.y = rng() * Math.PI;
      if (rng() < 0.5) kit.box(w * 0.6, 6, d * 0.6, kit.mat(0xd8dde2, { metalness: 0.8 }), x, h, z).rotation.y = t.rotation.y;
      solids.push({ x, z, r: rad, h: h + (rng() < 0.5 ? 6 : 0) });
      i++;
    }
    // Palm Jumeirah out in the Gulf
    {
      const g = kit.group(-150, 0.5, -330, 0.3), sand = kit.mat(0xeed8a8, { roughness: 1 });
      kit.box(14, 1, 120, sand, 0, 0, 0, g);
      for (let i = 0; i < 16; i++) { const a = -Math.PI / 2 + (i / 15 - 0.5) * 2.6, f = kit.box(5, 1, 60, sand, 0, 0, 0, g); f.geometry.translate(0, 0, 30); f.position.z = -50; f.rotation.y = Math.PI + a * 0.9; }
      const cres = new THREE.Mesh(new THREE.TorusGeometry(95, 3.5, 6, 64, Math.PI * 1.3), sand); cres.rotation.x = -Math.PI / 2; cres.rotation.z = Math.PI * 0.85; cres.position.z = -70; g.add(cres);
    }

    // ----- pop-up text -----
    const pops = [];
    const label = (text, color, w = 512, h = 140, font = '900 92px system-ui, sans-serif') => {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d'); g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 14; g.strokeStyle = '#1a0d08'; g.strokeText(text, w / 2, h / 2 + 4, w - 12); g.fillStyle = color; g.fillText(text, w / 2, h / 2 + 4, w - 12);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    };
    const pop = (pos, text, color, size = 1) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: label(text, color), transparent: true, depthTest: false, fog: false }));
      sp.scale.set(28 * size, 7.6 * size, 1); sp.renderOrder = 20; sp.position.copy(pos); sp.position.y += 10;
      scene.add(sp); pops.push({ sp, life: 0 });
    };

    // ----- the planes: stunt planes in each player's colour, their doll's head in the cockpit -----
    const fuseGeo = (() => { const pts = [[0, -4.2], [0.35, -4.0], [0.55, -3], [0.8, -1], [0.95, 0.6], [0.9, 2], [0.7, 2.9], [0.45, 3.3], [0, 3.4]]; const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 18); g.rotateX(Math.PI / 2); return g; })();
    const makePlane = (color) => {
      const g = new THREE.Group();
      const paint = new THREE.MeshPhysicalMaterial({ color, metalness: 0.35, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 });
      const white = kit.mat(0xf4f4f0, { roughness: 0.35 }), dark = kit.mat(0x222428, { roughness: 0.5 });
      const body = new THREE.Mesh(fuseGeo, paint); g.add(body);
      const wing = new THREE.Mesh(new THREE.BoxGeometry(9, 0.22, 1.7), paint); wing.position.set(0, -0.35, 0.9); g.add(wing);
      for (const s of [-1, 1]) { const tip = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.24, 1.72), white); tip.position.set(s * 4.1, -0.35, 0.9); g.add(tip); }
      const tailW = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.16, 1.0), paint); tailW.position.set(0, 0.1, -3.6); g.add(tailW);
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.5, 1.2), white); fin.position.set(0, 0.85, -3.7); fin.rotation.x = -0.3; g.add(fin);
      const cowl = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.9, 0.6, 18), dark); cowl.rotation.x = Math.PI / 2; cowl.position.z = 3.2; g.add(cowl);
      const prop = new THREE.Group(); prop.position.z = 3.6; g.add(prop);
      for (let i = 0; i < 2; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.8, 0.08), dark); b.rotation.z = i * Math.PI / 2; prop.add(b); }
      const disc = new THREE.Mesh(new THREE.CircleGeometry(1.45, 24), new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false })); disc.position.z = 0.05; prop.add(disc);
      const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.6, 14), white); spinner.rotation.x = Math.PI / 2; spinner.position.z = 0.25; prop.add(spinner);
      for (const s of [-1, 1]) { const strut = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 0.12), dark); strut.position.set(s * 0.8, -1.0, 1.4); strut.rotation.z = s * 0.35; g.add(strut); const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.22, 14), dark); wheel.rotation.z = Math.PI / 2; wheel.position.set(s * 1.0, -1.55, 1.4); g.add(wheel); }
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      g.scale.setScalar(PLANE_S);
      return { g, prop };
    };
    const tagFor = (pl) => {
      const c = document.createElement('canvas'); c.width = 512; c.height = 150;
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, fog: false })); sp.scale.set(26, 7.6, 1); sp.renderOrder = 15;
      scene.add(sp);
      return { sp, c, t, key: '' };
    };
    const drawTag = (pl) => {
      const key = `${Math.ceil(pl.hp / 5)}|${pl.power}|${pl.dead > 0}`;
      if (key === pl.tag.key) return; pl.tag.key = key;
      const { c, t } = pl.tag, g = c.getContext('2d');
      g.clearRect(0, 0, 512, 150);
      g.font = '900 54px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      const txt = pl.p.name + (pl.power ? ' ' + POWERS[pl.power].emoji : '');
      g.lineWidth = 10; g.strokeStyle = '#1a0d08'; g.strokeText(txt, 256, 40, 500); g.fillStyle = pl.p.color; g.fillText(txt, 256, 40, 500);
      g.fillStyle = 'rgba(20,10,6,0.8)'; g.fillRect(96, 88, 320, 30);
      const k = Math.max(0, pl.hp / HP);
      g.fillStyle = k > 0.5 ? '#5cff9d' : k > 0.25 ? '#ffd23f' : '#ff4a3a'; g.fillRect(100, 92, 312 * k, 22);
      t.needsUpdate = true;
    };
    const trailGeo = new THREE.SphereGeometry(1.1, 8, 6), TRAIL = 26;
    const spawnPoint = (i, n) => { const a = (i / Math.max(1, n)) * Math.PI * 2 + 0.4; return { x: Math.cos(a) * (R - 25), z: Math.sin(a) * (R - 25), yaw: Math.atan2(-Math.cos(a), -Math.sin(a)) }; };
    const planes = players.map((p, i) => {
      const { g, prop } = makePlane(new THREE.Color(p.color));
      // the pilot: their doll's head poking out of the cockpit
      const doll = mg.makeDoll(p, { tag: false });
      const head = doll.head; head.removeFromParent();
      const box = new THREE.Box3().setFromObject(head), ctr = box.getCenter(V()), size = box.getSize(V());
      head.position.sub(ctr);
      const pilot = new THREE.Group(); pilot.add(head); pilot.scale.setScalar(1.25 / Math.max(size.x, size.y)); pilot.position.set(0, 1.05, -0.3);
      g.add(pilot);
      const goggles = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.08, 6, 20), kit.mat(0x5a3a1a)); goggles.position.set(0, 1.2, -0.3); goggles.rotation.x = Math.PI / 2; g.add(goggles);
      scene.add(g);
      const trail = new THREE.InstancedMesh(trailGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(p.color).lerp(new THREE.Color(0xffffff), 0.45), transparent: true, opacity: 0.55, depthWrite: false }), TRAIL);
      trail.frustumCulled = false; scene.add(trail);
      const shadowDot = new THREE.Mesh(new THREE.RingGeometry(3.5, 5.2, 28), new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide })); shadowDot.rotation.x = -Math.PI / 2; scene.add(shadowDot);
      const shieldM = new THREE.Mesh(new THREE.SphereGeometry(10, 24, 16), new THREE.MeshBasicMaterial({ color: 0x7fd8ff, transparent: true, opacity: 0.28, depthWrite: false })); shieldM.visible = false; scene.add(shieldM);
      const sp = spawnPoint(i, players.length);
      const pl = { p, g, prop, trail, shadowDot, shieldM, hist: [], histT: 0, x: sp.x, y: 45 + rng() * 25, z: sp.z, yaw: sp.yaw, pitch: 0, roll: 0, speed: SPEED,
        hp: HP, points: 0, power: null, fire: 0, boost: 0, auto: 0, shield: 0, rope: null, dead: 0, safe: SAFE, lastHit: null, lastHitT: 0,
        input: { x: 0, y: 0, held: 0 }, bot: p.bot ? { t: 0, wantPow: 1 + rng() * 3, aim: null, jit: 0 } : null, tag: null };
      pl.tag = tagFor(pl); drawTag(pl);
      return pl;
    });
    const fwd = (pl, out = V()) => out.set(Math.sin(pl.yaw) * Math.cos(pl.pitch), Math.sin(pl.pitch), Math.cos(pl.yaw) * Math.cos(pl.pitch));
    const pos = (pl, out = V()) => out.set(pl.x, pl.y, pl.z);

    // ----- rings, crates, health packs -----
    const ringM = new THREE.MeshStandardMaterial({ color: 0xffc83a, emissive: 0xffa800, emissiveIntensity: 1.6, metalness: 0.6, roughness: 0.3 });
    const beamM = new THREE.MeshBasicMaterial({ color: 0xffd25a, transparent: true, opacity: 0.16, depthWrite: false, fog: false });
    const rings = [];
    const freeSpot = (yMin, yMax, avoid = []) => {
      for (let k = 0; k < 60; k++) {
        const a = rng() * Math.PI * 2, r = 20 + Math.sqrt(rng()) * (R - 40), x = Math.cos(a) * r, z = Math.sin(a) * r, y = yMin + rng() * (yMax - yMin);
        if (solids.some((s) => typeof s === 'function' ? s(V(x, y, z)) : Math.hypot(s.x - x, s.z - z) < s.r + 14 && y < s.h + 14)) continue;
        if (avoid.some((o) => Math.hypot(o.x - x, o.z - z) < 50)) continue;
        return { x, y, z };
      }
      return { x: 0, y: 130 + rng() * 15, z: 60 };
    };
    const placeRing = (rg) => {
      const s = freeSpot(22, 120, rings.filter((o) => o !== rg && o.g));
      rg.x = s.x; rg.y = s.y; rg.z = s.z; rg.yaw = rng() * Math.PI; rg.t = 0;
      rg.g.position.set(s.x, s.y, s.z); rg.g.rotation.y = rg.yaw;
      rg.beam.position.set(s.x, s.y / 2, s.z); rg.beam.scale.y = s.y;
      rg.n.set(Math.sin(rg.yaw), 0, Math.cos(rg.yaw));
    };
    for (let i = 0; i < 3 + Math.floor(players.length / 2); i++) {
      const g = new THREE.Group();
      const torus = new THREE.Mesh(new THREE.TorusGeometry(RING_R, 1.2, 12, 48), ringM); torus.castShadow = true; g.add(torus);
      for (let k = 0; k < 8; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), kit.mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 2 })); const a = k / 8 * Math.PI * 2; b.position.set(Math.cos(a) * RING_R, Math.sin(a) * RING_R, 0); g.add(b); }
      scene.add(g);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 3, 1, 12, 1, true), beamM); scene.add(beam);
      const rg = { g, beam, n: V(), x: 0, y: 0, z: 0, yaw: 0, t: 0 };
      rings.push(rg); placeRing(rg);
    }
    const crateTex = label('?', '#ffffff', 128, 128, '900 100px system-ui, sans-serif');
    const crossTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#e02020'; g.fillRect(48, 16, 32, 96); g.fillRect(16, 48, 96, 32); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    const pickups = [], respawns = [];
    const addPickup = (kind) => {
      const s = freeSpot(20, 110, pickups.filter((o) => o.kind === kind));
      const g = new THREE.Group(); g.position.set(s.x, s.y, s.z); scene.add(g);
      const box = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 6), kind === 'crate'
        ? new THREE.MeshStandardMaterial({ map: crateTex, color: 0xffa040, emissive: 0xff7a1a, emissiveIntensity: 0.8, emissiveMap: crateTex, roughness: 0.4 })
        : new THREE.MeshStandardMaterial({ map: crossTex, emissive: 0xff4040, emissiveIntensity: 0.25, roughness: 0.5 }));
      box.castShadow = true; g.add(box);
      const halo = new THREE.Mesh(new THREE.SphereGeometry(5.6, 16, 12), new THREE.MeshBasicMaterial({ color: kind === 'crate' ? 0xff9a3a : 0xff5a5a, transparent: true, opacity: 0.18, depthWrite: false })); g.add(halo);
      pickups.push({ kind, g, x: s.x, y: s.y, z: s.z, t: rng() * 5 });
    };
    for (let i = 0; i < Math.max(4, players.length + 1); i++) addPickup('crate');
    for (let i = 0; i < 3; i++) addPickup('health');

    // ----- bullets, mines, flak, explosions -----
    const bullets = [];
    const bulletGeo = new THREE.BoxGeometry(0.25, 0.25, 4.5), bulletM = new THREE.MeshBasicMaterial({ color: 0xfff0a0, fog: false });
    const mines = [];
    const flaks = [];
    const booms = [];
    const boomGeo = new THREE.IcosahedronGeometry(1, 2);
    const boom = (p, size = 1, color = 0xff8a2a) => {
      const m = new THREE.Mesh(boomGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, fog: false })); m.position.copy(p); scene.add(m);
      const smoke = new THREE.Mesh(boomGeo, new THREE.MeshStandardMaterial({ color: 0x2a2624, transparent: true, opacity: 0.7, roughness: 1, depthWrite: false })); smoke.position.copy(p); scene.add(smoke);
      booms.push({ m, smoke, t: 0, size });
    };
    const ropeM = kit.mat(0xc8a060, { roughness: 0.9 });

    // ----- damage, kills, points -----
    const ranks = () => [...planes].sort((a, b) => b.points - a.points);
    const hurt = (pl, dmg, by, why) => {
      if (pl.dead > 0 || pl.safe > 0 || pl.shield > 0) return;
      pl.hp -= dmg;
      if (by && by !== pl) { pl.lastHit = by; pl.lastHitT = 4; }
      if (pl.hp > 0) return;
      // shot down
      pl.hp = 0; pl.dead = RESPAWN; pl.power = null; pl.rope = null; pl.auto = 0; pl.boost = 0;
      const killer = pl.lastHitT > 0 ? pl.lastHit : null;
      boom(pos(pl), 2.2); sfx.play('bigboom');
      pl.g.visible = false; pl.shadowDot.visible = false;
      if (killer && killer.dead <= 0 && pl.points > 0) { pl.points--; killer.points++; pop(pos(killer), '+1 STOLEN!', killer.p.color); }
      pop(pos(pl), why === 'crash' ? 'CRASHED!' : 'SHOT DOWN!', '#ff4a3a');
    };
    const usePower = (pl) => {
      if (!pl.power || pl.dead > 0) return;
      const kind = pl.power; pl.power = null;
      const here = pos(pl), f = fwd(pl);
      if (!pl.p.bot || kind !== 'boost') sfx.play(kind === 'boost' ? 'teleport' : 'event');
      if (kind === 'boost') pl.boost = 3;
      else if (kind === 'shield') pl.shield = 8;
      else if (kind === 'auto') pl.auto = 10;
      else if (kind === 'mines') {
        // a string of balloon mines left hanging behind you
        for (let i = 0; i < 4; i++) {
          const g = new THREE.Group(), side = (i - 1.5) * 7;
          const right = V(Math.cos(pl.yaw), 0, -Math.sin(pl.yaw));
          g.position.copy(here).addScaledVector(f, -14 - i * 4).addScaledVector(right, side);
          const ball = new THREE.Mesh(new THREE.SphereGeometry(2.3, 18, 14), new THREE.MeshPhysicalMaterial({ color: i % 2 ? 0xffffff : 0xe02a2a, roughness: 0.25, clearcoat: 1 })); ball.scale.y = 1.15; ball.castShadow = true; g.add(ball);
          for (let k = 0; k < 6; k++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.4, 6), kit.mat(0x333333, { metalness: 0.8 })); const a = k / 6 * Math.PI * 2; sp.position.set(Math.cos(a) * 2.3, 0, Math.sin(a) * 2.3); sp.rotation.z = -Math.PI / 2; sp.rotation.y = -a; g.add(sp); }
          const string = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 8, 4), kit.mat(0xeeeeee)); string.position.y = -6.6; g.add(string);
          scene.add(g);
          mines.push({ g, owner: pl, t: 30, y0: g.position.y, ph: rng() * 6 });
        }
        pop(here, 'MINES!', '#ff8a8a', 0.8);
      } else if (kind === 'flak') {
        // anti-aircraft fire rains up round whoever is winning
        const target = ranks().find((o) => o !== pl && o.dead <= 0) || pl;
        const zone = new THREE.Mesh(new THREE.RingGeometry(43, 46, 64), new THREE.MeshBasicMaterial({ color: 0xff3020, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false, fog: false }));
        zone.rotation.x = -Math.PI / 2; zone.position.set(target.x, 1, target.z); scene.add(zone);
        flaks.push({ zone, owner: pl, target, x: target.x, z: target.z, t: 8, next: 0.8 });
        pop(pos(target), 'FLAK INCOMING!', '#ff4a3a', 0.9);
        sfx.play('horn');
      } else if (kind === 'rope') {
        // lasso the nearest plane in front, or failing that whoever is one place ahead on points
        let best = null, bd = 140;
        for (const o of planes) { if (o === pl || o.dead > 0) continue; const to = pos(o).sub(here), d = to.length(); if (d < bd && to.normalize().dot(f) > 0.45) { bd = d; best = o; } }
        if (!best) { const rk = ranks(), i = rk.indexOf(pl); best = rk.slice(0, i).reverse().find((o) => o.dead <= 0) || rk.find((o) => o !== pl && o.dead <= 0); }
        if (best) {
          const line = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1, 6), ropeM); scene.add(line);
          pl.rope = { target: best, t: 3, line };
          pop(here, 'YEEHAW!', '#ffd23f', 0.8);
        }
      }
    };
    const rollPower = (pl) => {
      // the further back you are, the better your odds (the shield most of all)
      const rk = ranks(), k = planes.length > 1 ? rk.indexOf(pl) / (planes.length - 1) : 0;
      const w = { boost: 1.3 - k * 0.4, mines: 1, flak: 0.5 + k, rope: 0.6 + k * 1.2, auto: 0.6 + k * 0.8, shield: 0.35 + k * 2 };
      let r = rng() * Object.values(w).reduce((a, b) => a + b, 0);
      for (const [id, v] of Object.entries(w)) { r -= v; if (r <= 0) return id; }
      return 'boost';
    };

    // ----- CPU pilots -----
    const nearestRing = (pl) => { let best = rings[0], bd = 1e9; for (const r of rings) { const d = Math.hypot(r.x - pl.x, r.z - pl.z) + Math.abs(r.y - pl.y) * 0.5; if (d < bd) { bd = d; best = r; } } return best; };
    const steerTo = (pl, tx, ty, tz) => {
      let d = Math.atan2(tx - pl.x, tz - pl.z) - pl.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      const flat = Math.hypot(tx - pl.x, tz - pl.z);
      return { x: Math.max(-1, Math.min(1, -d * 2.2)), y: Math.max(-1, Math.min(1, (Math.atan2(ty - pl.y, Math.max(8, flat)) / PITCH) * 1.4)) };
    };
    const ringApproach = (pl, rg) => {
      // line up through the ring: aim at a point out along its axis on our side, which slides into
      // the ring itself as we come into line
      const toP = pos(pl).sub(V(rg.x, rg.y, rg.z)), along = toP.x * rg.n.x + toP.z * rg.n.z, side = Math.sign(along) || 1;
      const lat = Math.hypot(toP.x - rg.n.x * along, toP.z - rg.n.z * along), k = Math.min(45, lat * 1.6);
      return { x: rg.x + rg.n.x * side * k, y: rg.y, z: rg.z + rg.n.z * side * k };
    };
    const botFrame = (pl, dt) => {
      const b = pl.bot; b.t -= dt;
      const here = pos(pl), f = fwd(pl);
      // dogfight if someone's in our sights and close, otherwise go for rings and crates
      let foe = null, fd = 90;
      for (const o of planes) { if (o === pl || o.dead > 0) continue; const to = pos(o).sub(here), d = to.length(); if (d < fd && to.normalize().dot(f) > 0.8) { fd = d; foe = o; } }
      let tgt;
      const crate = !pl.power ? pickups.find((k) => k.kind === 'crate' && Math.hypot(k.x - pl.x, k.z - pl.z) < 55) : null;
      const med = pl.hp < 50 ? pickups.find((k) => k.kind === 'health' && Math.hypot(k.x - pl.x, k.z - pl.z) < 90) : null;
      if (med) tgt = med; else if (crate) tgt = crate; else tgt = ringApproach(pl, nearestRing(pl));
      if (foe && fd < 60 && pl.hp > 35) tgt = { x: foe.x, y: foe.y, z: foe.z };
      if (b.t <= 0) { b.t = 0.4 + rng() * 0.5; b.jit = (rng() - 0.5) * 0.4; }
      const s = steerTo(pl, tgt.x, tgt.y, tgt.z);
      // don't fly into towers: look ahead and pull up or swerve
      const ahead = here.clone().addScaledVector(f, 28);
      for (const so of solids) { if (typeof so === 'function') { if (so(ahead)) { s.y = 1; s.x = 1; } continue; } if (Math.hypot(so.x - ahead.x, so.z - ahead.z) < so.r + 6 && ahead.y < so.h + 6) { s.y = so.h - pl.y < 30 ? 1 : 0; s.x = Math.sign(s.x || 1); } }
      let held = foe && fd < 110 ? BTN.FIRE : 0;
      if (pl.power) { b.wantPow -= dt; if (b.wantPow <= 0) { b.wantPow = 1 + rng() * 3; held |= BTN.POWER; } }
      return { x: Math.max(-1, Math.min(1, s.x + b.jit)), y: s.y, held };
    };

    // ----- camera: one shot of the whole dogfight, pulling out as they spread -----
    const camera = new THREE.PerspectiveCamera(42, 16 / 9, 1, 2500);
    const camC = V(0, 60, 0); let camD = 200;
    let tAll = 0;
    const tmp = V(), tmp2 = V();
    const fireBullet = (pl) => {
      const f = fwd(pl), here = pos(pl);
      // a touch of aim assist toward whoever's nearly in the sights
      let aim = f.clone(), best = 0.93;
      for (const o of planes) { if (o === pl || o.dead > 0) continue; const to = pos(o).sub(here); const d = to.length(); if (d > 150) continue; const lead = pos(o).addScaledVector(fwd(o), o.speed * d / BULLET_V).sub(here).normalize(); const dot = lead.dot(f); if (dot > best) { best = dot; aim = lead; } }
      const m = new THREE.Mesh(bulletGeo, bulletM); m.position.copy(here).addScaledVector(f, 5 * PLANE_S); m.lookAt(m.position.clone().add(aim)); scene.add(m);
      bullets.push({ m, v: aim.multiplyScalar(BULLET_V).add(f.clone().multiplyScalar(pl.speed)), owner: pl, life: 1.1 });
    };

    return {
      camera,
      update(dt, t, running) {
        tAll += dt;
        // ----- fly -----
        for (const pl of planes) {
          if (pl.dead > 0) {
            pl.dead -= dt;
            if (pl.dead <= 0) { const sp = spawnPoint(rng() * 8, 8); Object.assign(pl, { x: sp.x, z: sp.z, y: 60 + rng() * 30, yaw: sp.yaw, pitch: 0, hp: HP, safe: SAFE, speed: SPEED, hist: [] }); pl.g.visible = true; pl.shadowDot.visible = true; }
            drawTag(pl); pl.tag.sp.visible = false; pl.trail.visible = false;
            continue;
          }
          pl.tag.sp.visible = true; pl.trail.visible = true;
          let inp = { x: 0, y: 0, held: 0 };
          if (running) inp = pl.bot ? botFrame(pl, dt) : pl.input;
          let ix = inp.x, iy = inp.y;
          // autopilot and the tow rope fly for you
          if (pl.auto > 0) { pl.auto -= dt; const rg = nearestRing(pl), a = ringApproach(pl, rg), s = steerTo(pl, a.x, a.y, a.z); ix = s.x; iy = s.y; }
          if (pl.rope) {
            const o = pl.rope.target; pl.rope.t -= dt;
            const s = steerTo(pl, o.x, o.y, o.z); ix = s.x; iy = s.y;
            const d = Math.hypot(o.x - pl.x, o.y - pl.y, o.z - pl.z);
            const l = pl.rope.line; tmp.set(pl.x, pl.y, pl.z); tmp2.set(o.x, o.y, o.z);
            l.position.copy(tmp).add(tmp2).multiplyScalar(0.5); l.scale.y = d; l.quaternion.setFromUnitVectors(V(0, 1, 0), tmp2.clone().sub(tmp).normalize());
            if (d < 14 || pl.rope.t <= 0 || o.dead > 0) { scene.remove(l); pl.rope = null; pl.boost = Math.max(pl.boost, 2); if (d < 14) pop(pos(pl), 'SLINGSHOT!', '#ffd23f', 0.7); }
          }
          pl.boost = Math.max(0, pl.boost - dt); pl.shield = Math.max(0, pl.shield - dt); pl.safe = Math.max(0, pl.safe - dt); pl.lastHitT -= dt;
          // out of bounds or too high/low: the plane takes over and brings you back
          const out = Math.hypot(pl.x, pl.z) > R;
          if (out) { const s = steerTo(pl, 0, 70, 0); ix = s.x; }
          const targetSpeed = SPEED * (pl.boost > 0 ? 1.75 : 1) * (pl.auto > 0 ? 1.1 : 1) * (pl.rope ? 1.9 : 1);
          pl.speed += (targetSpeed - pl.speed) * Math.min(1, dt * 2.5);
          pl.yaw -= ix * TURN * dt * (pl.rope ? 1.6 : 1);
          let wantPitch = iy * PITCH;
          if (pl.y < ALT_MIN + 6 && wantPitch < 0.15) wantPitch = 0.25;
          if (pl.y > ALT_MAX - 6 && wantPitch > -0.1) wantPitch = -0.2;
          // ring assist: close to a ring and pointing at it, ease the height to line up
          for (const rg of rings) { const d = Math.hypot(rg.x - pl.x, rg.z - pl.z); if (d < 40 && Math.abs(rg.y - pl.y) < 22) { const toR = Math.atan2(rg.x - pl.x, rg.z - pl.z) - pl.yaw; if (Math.cos(toR) > 0.7) wantPitch += Math.max(-0.25, Math.min(0.25, (rg.y - pl.y) * 0.04)); } }
          pl.pitch += (wantPitch - pl.pitch) * Math.min(1, dt * 3);
          pl.roll += (ix * 0.9 - pl.roll) * Math.min(1, dt * 5);
          const f = fwd(pl, tmp);
          const px = pl.x, py = pl.y, pz = pl.z;
          pl.x += f.x * pl.speed * dt; pl.y = Math.max(ALT_MIN, Math.min(ALT_MAX, pl.y + f.y * pl.speed * dt)); pl.z += f.z * pl.speed * dt;
          // towers
          const here = pos(pl, tmp2);
          for (const so of solids) {
            const hit = typeof so === 'function' ? so(here) : Math.hypot(so.x - pl.x, so.z - pl.z) < so.r + 2.5 && pl.y < so.h + 1;
            if (!hit) continue;
            pl.x = px; pl.y = py; pl.z = pz; pl.yaw += Math.PI * 0.8; pl.speed *= 0.5;
            if (pl.shield <= 0 && pl.safe <= 0) { boom(here, 1); sfx.play('bonk'); hurt(pl, 34, pl.lastHitT > 0 ? pl.lastHit : null, 'crash'); }
            break;
          }
          if (pl.dead > 0) continue;
          // shooting
          pl.fire -= dt;
          if (running && (inp.held & BTN.FIRE) && pl.fire <= 0) { pl.fire = 1 / FIRE_RATE; fireBullet(pl); if (!pl.p.bot && Math.floor(tAll * 7) % 2 === 0) sfx.play('tick'); }
          if (running && (inp.held & BTN.POWER) && !pl.powerHeld) usePower(pl);
          pl.powerHeld = !!(inp.held & BTN.POWER);
          // rings: through the hoop from either side
          for (const rg of rings) {
            const a = (px - rg.x) * rg.n.x + (pz - rg.z) * rg.n.z, b = (pl.x - rg.x) * rg.n.x + (pl.z - rg.z) * rg.n.z;
            if (a * b > 0 && Math.abs(b) > 0.01) continue;
            const off = Math.hypot(pl.x - rg.x - rg.n.x * b, pl.y - rg.y, pl.z - rg.z - rg.n.z * b);
            if (off > RING_R - 0.6) continue;
            pl.points++; pl.hp = Math.min(HP, pl.hp + HP * 0.1);
            pop(V(rg.x, rg.y, rg.z), '+1', pl.p.color);
            sfx.play('coin');
            placeRing(rg);
          }
          // pickups
          for (let i = pickups.length - 1; i >= 0; i--) {
            const k = pickups[i];
            if (Math.hypot(k.x - pl.x, k.y - pl.y, k.z - pl.z) > 9) continue;
            if (k.kind === 'crate') { if (pl.power) continue; pl.power = rollPower(pl); pop(V(k.x, k.y, k.z), `${POWERS[pl.power].emoji} ${POWERS[pl.power].name}`, '#ffd23f', 0.8); sfx.play('item'); }
            else { if (pl.hp >= HP) continue; pl.hp = Math.min(HP, pl.hp + 35); pop(V(k.x, k.y, k.z), '+HEALTH', '#5cff9d', 0.8); sfx.play('coin'); }
            scene.remove(k.g); pickups.splice(i, 1);
            respawns.push({ kind: k.kind, t: 4 });
          }
          // the look
          pl.g.position.set(pl.x, pl.y, pl.z);
          pl.g.rotation.set(0, 0, 0); pl.g.rotateY(pl.yaw); pl.g.rotateX(-pl.pitch); pl.g.rotateZ(pl.roll);
          pl.prop.rotation.z += dt * 60;
          pl.shadowDot.position.set(pl.x, 0.6, pl.z);
          pl.shieldM.visible = pl.shield > 0 || pl.safe > 0; pl.shieldM.position.copy(pl.g.position); pl.shieldM.material.opacity = pl.shield > 0 ? 0.28 : 0.12 + Math.sin(tAll * 20) * 0.08;
          pl.tag.sp.position.set(pl.x, pl.y + 12, pl.z);
          drawTag(pl);
          pl.histT -= dt;
          if (pl.histT <= 0) { pl.histT = 0.05; pl.hist.unshift([pl.x - f.x * 5, pl.y - f.y * 5, pl.z - f.z * 5]); if (pl.hist.length > TRAIL) pl.hist.pop(); }
          const M = new THREE.Matrix4();
          for (let i = 0; i < TRAIL; i++) { const h = pl.hist[i]; if (h) { const s = (1 - i / TRAIL) * (pl.boost > 0 ? 1.8 : 1.1); M.makeScale(s, s, s).setPosition(h[0], h[1], h[2]); } else M.makeScale(0, 0, 0); pl.trail.setMatrixAt(i, M); }
          pl.trail.instanceMatrix.needsUpdate = true;
        }
        // ----- bullets -----
        for (let i = bullets.length - 1; i >= 0; i--) {
          const bl = bullets[i]; bl.life -= dt;
          bl.m.position.addScaledVector(bl.v, dt);
          let gone = bl.life <= 0 || bl.m.position.y < 0;
          for (const o of planes) {
            if (gone || o === bl.owner || o.dead > 0) continue;
            if (bl.m.position.distanceTo(pos(o, tmp)) < HIT_R) { gone = true; if (o.shield > 0 || o.safe > 0) { sfx.play('boing'); continue; } hurt(o, BULLET_DMG, bl.owner, 'shot'); boom(bl.m.position, 0.35, 0xffd060); if (!o.p.bot || !bl.owner.p.bot) sfx.play('bonk'); }
          }
          if (gone) { scene.remove(bl.m); bullets.splice(i, 1); }
        }
        // ----- balloon mines -----
        for (let i = mines.length - 1; i >= 0; i--) {
          const mn = mines[i]; mn.t -= dt; mn.ph += dt;
          mn.g.position.y = mn.y0 + Math.sin(mn.ph * 1.5) * 1.2; mn.g.rotation.y += dt * 0.5;
          let pop2 = mn.t <= 0;
          for (const o of planes) { if (pop2 || o === mn.owner || o.dead > 0) continue; if (mn.g.position.distanceTo(pos(o, tmp)) < 7.5) { pop2 = true; hurt(o, 32, mn.owner, 'mine'); } }
          if (pop2) { if (mn.t > 0) { boom(mn.g.position, 1.6); sfx.play('boom'); } scene.remove(mn.g); mines.splice(i, 1); }
        }
        // ----- flak zones -----
        for (let i = flaks.length - 1; i >= 0; i--) {
          const fz = flaks[i]; fz.t -= dt; fz.next -= dt;
          fz.zone.material.opacity = 0.4 + Math.sin(tAll * 12) * 0.3;
          if (fz.next <= 0 && fz.t > 0) {
            fz.next = 0.18 + rng() * 0.15;
            // mostly random, sometimes right where a plane is
            const inside = planes.filter((o) => o.dead <= 0 && Math.hypot(o.x - fz.x, o.z - fz.z) < 46);
            const near = inside.length && rng() < 0.45 ? inside[(rng() * inside.length) | 0] : null;
            const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * 44;
            const p = near ? V(near.x + (rng() - 0.5) * 16, near.y + (rng() - 0.5) * 10, near.z + (rng() - 0.5) * 16) : V(fz.x + Math.cos(a) * r, ALT_MIN + rng() * (ALT_MAX - ALT_MIN) * 0.8, fz.z + Math.sin(a) * r);
            boom(p, 1.2, 0x3a3430); sfx.play('bonk');
            for (const o of inside) if (pos(o, tmp).distanceTo(p) < 10) hurt(o, 16, fz.owner, 'flak');
          }
          if (fz.t <= 0) { scene.remove(fz.zone); flaks.splice(i, 1); }
        }
        // ----- effects -----
        for (let i = booms.length - 1; i >= 0; i--) {
          const b = booms[i]; b.t += dt;
          b.m.scale.setScalar(b.size * (2 + b.t * 18)); b.m.material.opacity = Math.max(0, 0.95 - b.t * 3);
          b.smoke.scale.setScalar(b.size * (2.5 + b.t * 8)); b.smoke.material.opacity = Math.max(0, 0.6 - b.t * 0.5); b.smoke.position.y += dt * 3;
          if (b.t > 1.2) { scene.remove(b.m, b.smoke); booms.splice(i, 1); }
        }
        for (const rg of rings) { rg.t += dt; rg.g.rotation.z += dt * 0.6; rg.g.scale.setScalar(Math.min(1, rg.t * 3)); }
        for (let i = respawns.length - 1; i >= 0; i--) { respawns[i].t -= dt; if (respawns[i].t <= 0) { addPickup(respawns[i].kind); respawns.splice(i, 1); } }
        for (const k of pickups) { k.t += dt; k.g.rotation.y += dt * 1.2; k.g.position.y = k.y + Math.sin(k.t * 2) * 1.2; }
        for (let i = pops.length - 1; i >= 0; i--) { const q = pops[i]; q.life += dt; q.sp.position.y += dt * 6; q.sp.material.opacity = Math.min(1, 2.4 - q.life * 1.6); if (q.life > 1.5) { scene.remove(q.sp); pops.splice(i, 1); } }
        // ----- camera -----
        const live = planes.filter((o) => o.dead <= 0);
        const c = V(); live.forEach((o) => c.add(pos(o, tmp))); if (live.length) c.multiplyScalar(1 / live.length);
        let spread = 40; live.forEach((o) => { spread = Math.max(spread, Math.hypot(o.x - c.x, o.z - c.z) + Math.abs(o.y - c.y) * 0.3); });
        c.y = Math.min(c.y, 90);
        camC.lerp(c, Math.min(1, dt * 1.5));
        camD += (Math.min(240, Math.max(105, spread * 2.1 + 40)) - camD) * Math.min(1, dt * 1.2);
        camera.position.set(camC.x, camC.y + camD * 0.72, camC.z + camD * 0.75);
        camera.lookAt(camC.x, camC.y - 8, camC.z - 6);
        sun.target.position.set(camC.x, 0, camC.z); sun.position.copy(sun.target.position).addScaledVector(sunDir, 400);
      },
      input(p, m) {
        const pl = planes.find((x) => x.p === p);
        if (!pl || m.b !== 'stick') return;
        pl.input.x = Math.max(-1, Math.min(1, Number(m.x) || 0));
        pl.input.y = Math.max(-1, Math.min(1, Number(m.y) || 0));
        pl.input.held = Number(m.h) || 0;
      },
      scores() { return Object.fromEntries(planes.map((pl) => [pl.p.id, pl.points])); },
      dispose() { for (const pl of planes) pl.tag.t.dispose(); },
    };
  },
};
