// The 3D board: ground, spaces, paths, landmarks, dolls, the item, and board effects.
import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/GLTFLoader.js';
import { SPACE, mulberry32 } from '../board.js';
import { makeKit, textTexture, surf, mat } from './kit.js';
import { TEX } from './textures.js';
import { Batch } from './props.js';
import { Sky } from '../../vendor/Sky.js';
import { ImprovedNoise } from '../../vendor/ImprovedNoise.js';
import { Doll } from './doll.js';
import { Tweens, easeInOut, easeOut } from './stage.js';

const SPACE_R = 1.25;
const iconTex = {};
// The symbol painted on each space, drawn as vector shapes (not emoji, which look different on every
// TV) at 512 px so it stays sharp when the camera is right down at the board.
function spaceIcon(type) {
  if (iconTex[type]) return iconTex[type];
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.translate(S / 2, S / 2);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const ink = type === 'start' ? '#b3261e' : 'rgba(255,255,255,0.97)', edge = type === 'start' ? 'rgba(120,20,10,0.25)' : 'rgba(0,0,0,0.3)';
  // draw once dark and offset (an engraved edge), then white on top
  const twice = (draw) => { g.save(); g.translate(0, 10); g.fillStyle = g.strokeStyle = edge; draw(); g.restore(); g.fillStyle = g.strokeStyle = ink; draw(); };
  if (type === 'blue' || type === 'red') {
    g.lineWidth = 64;
    twice(() => { g.beginPath(); g.moveTo(-124, 0); g.lineTo(124, 0); if (type === 'blue') { g.moveTo(0, -124); g.lineTo(0, 124); } g.stroke(); });
  } else if (type === 'event') {
    g.font = '900 380px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    twice(() => g.fillText('?', 0, 14));
  } else if (type === 'start') {
    g.font = 'italic 900 210px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    twice(() => g.fillText('GO', 0, 8));
  } else if (type === 'shop') {
    // a shopping trolley
    g.scale(1.2, 1.2);
    g.lineWidth = 30;
    twice(() => {
      g.beginPath(); g.moveTo(-150, -110); g.lineTo(-100, -110); g.lineTo(-62, 60); g.lineTo(118, 60); g.stroke();
      g.beginPath(); g.moveTo(-92, -64); g.lineTo(148, -64); g.lineTo(122, 18); g.lineTo(-72, 18); g.closePath(); g.fill();
      g.beginPath(); g.arc(-40, 112, 30, 0, Math.PI * 2); g.arc(96, 112, 30, 0, Math.PI * 2); g.fill();
    });
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16;
  return (iconTex[type] = t);
}

// gentle hills that flatten out under the board and the landmarks
function makeTerrain(map, board) {
  const noise = new ImprovedNoise();
  const look = map.look;
  const flats = [...board.nodes.map((n) => [n.x, n.z, 5]), ...(map.landmarks || []).map((l) => [l.x, l.z, l.flat ?? 16 * (l.scale || 1)])];
  const hill = look.hills ?? 4;
  return (x, z) => {
    let d = Infinity;
    for (const [fx, fz, r] of flats) { const dd = Math.hypot(x - fx, z - fz) - r; if (dd < d) d = dd; }
    const t = Math.max(0, Math.min(1, d / 22));
    const k = t * t * (3 - 2 * t);
    const far = Math.max(0, Math.hypot(x, z) - 150) / 120; // ranges on the horizon
    const h = (noise.noise(x * 0.02, 0.5, z * 0.02) * 0.6 + noise.noise(x * 0.06, 1.5, z * 0.06) * 0.25 + noise.noise(x * 0.2, 2.5, z * 0.2) * 0.05) * hill;
    const land = k * (h + hill * 0.4) + far * far * (look.ranges ?? 25) * (0.6 + noise.noise(x * 0.01, 9, z * 0.01));
    if (look.sea == null || z > look.sea + 16) return land;
    // flatten to a beach for the last 12 m, then shelve down under the water
    if (z > look.sea + 4) return land * Math.min(1, (z - look.sea - 4) / 12);
    // shelve down under the water past the coastline
    const s = Math.min(1, (look.sea + 4 - z) / 10);
    return land * (1 - s) - 2.5 * s;
  };
}

export class BoardView {
  constructor(stage, map, board) {
    this.stage = stage; this.map = map; this.board = board;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(48, 16 / 9, 0.5, 1400);
    this.tweens = new Tweens();
    this.dolls = new Map();
    this.updaters = [];
    this.camPos = new THREE.Vector3(0, 95, 85);
    this.camLook = new THREE.Vector3(0, 0, 0);
    this.camGoal = { pos: this.camPos.clone(), look: this.camLook.clone() };
    this.camera.position.copy(this.camPos);
    this.build();
    // the board's footprint, so the overview and the lobby fly-over can frame it
    const xs = board.nodes.map((n) => n.x), zs = board.nodes.map((n) => n.z);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
    this.bounds = { cx, cz, r: Math.max(...board.nodes.map((n) => Math.hypot(n.x - cx, n.z - cz))) + 4 };
    this.overview(); this.camPos.copy(this.camGoal.pos); this.camLook.copy(this.camGoal.look); this.camera.position.copy(this.camPos);
  }

  // how far back the camera must sit to fit a circle of radius r on screen (narrow screens need more)
  fitDistance(r) {
    const half = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const halfH = Math.atan(Math.tan(half) * Math.max(0.3, this.camera.aspect || 16 / 9));
    return r / Math.sin(Math.min(half * 1.15, halfH));
  }
  // a slow circle round the board for the lobby, framed to fit
  orbit(t) {
    const { cx, cz, r } = this.bounds, d = this.fitDistance(r) * 0.92;
    this.camGoal.pos.set(cx + Math.sin(t) * d * 0.72, d * 0.68, cz + Math.cos(t) * d * 0.72);
    this.camGoal.look.set(cx, 0, cz);
  }

  pos(idx) { const n = this.board.nodes[idx]; return new THREE.Vector3(n.x, 0.42, n.z); }

  build() {
    const { look } = this.map;
    const s = this.scene;
    const sky = look.sky || {};

    // ----- sky, sun and reflections -----
    const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - (sky.elevation ?? 35)), THREE.MathUtils.degToRad(sky.azimuth ?? 160));
    const dome = new Sky();
    dome.scale.setScalar(4000);
    dome.material.uniforms.turbidity.value = sky.turbidity ?? 4;
    dome.material.uniforms.rayleigh.value = sky.rayleigh ?? 1.5;
    dome.material.uniforms.mieCoefficient.value = sky.mie ?? 0.005;
    dome.material.uniforms.mieDirectionalG.value = 0.8;
    dome.material.uniforms.sunPosition.value.copy(sunDir);
    s.add(dome);
    // image-based lighting from the same sky, so metal and glass reflect it
    const pmrem = new THREE.PMREMGenerator(this.stage.renderer);
    const envScene = new THREE.Scene();
    const envSky = new Sky(); envSky.scale.setScalar(1000); envSky.material.uniforms = THREE.UniformsUtils.clone(dome.material.uniforms); envScene.add(envSky);
    s.environment = pmrem.fromScene(envScene, 0, 0.1, 2000).texture;
    s.environmentIntensity = look.envIntensity ?? 0.6;
    s.fog = new THREE.Fog(look.fog, 160, 700);

    s.add(new THREE.HemisphereLight(look.skyLight ?? 0xcfe4ff, look.ground, 0.5));
    const sun = new THREE.DirectionalLight(look.sun, look.sunIntensity ?? 3.2);
    sun.position.copy(sunDir).multiplyScalar(150);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
    Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, near: 1, far: 400 });
    s.add(sun);

    // ----- ground -----
    this.heightAt = makeTerrain(this.map, this.board);
    const SIZE = 1400, SEG = 260;
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    const P = geo.attributes.position, UV = geo.attributes.uv;
    const colors = new Float32Array(P.count * 3);
    const tint = new ImprovedNoise();
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), z = P.getZ(i);
      P.setY(i, this.heightAt(x, z));
      UV.setXY(i, x / 7, z / 7);
      const v = 0.85 + tint.noise(x * 0.015, 4, z * 0.015) * 0.3 + tint.noise(x * 0.08, 5, z * 0.08) * 0.08;
      colors[i * 3] = v; colors[i * 3 + 1] = v * (0.97 + tint.noise(x * 0.02, 6, z * 0.02) * 0.1); colors[i * 3 + 2] = v;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const groundSet = TEX[look.groundTex || 'redDirt']();
    const gm = new THREE.MeshStandardMaterial({ map: groundSet.map, normalMap: groundSet.normalMap, roughnessMap: groundSet.roughnessMap, vertexColors: true, roughness: 1, normalScale: new THREE.Vector2(1.5, 1.5) });
    for (const t of [gm.map, gm.normalMap, gm.roughnessMap]) t.repeat.set(1, 1);
    const ground = new THREE.Mesh(geo, gm);
    ground.receiveShadow = true;
    s.add(ground);

    const kit = makeKit(s, { heightAt: this.heightAt });
    this.kit = kit;
    // is a spot free for scenery (clear of the board, the landmarks and the middle of the map)?
    const lms = this.map.landmarks || [];
    kit.isClear = (x, z, r = 4) => this.board.nodes.every((n) => Math.hypot(n.x - x, n.z - z) > r + 4)
      && lms.every((l) => Math.hypot(l.x - x, l.z - z) > (l.flat ?? 16 * (l.scale || 1)) + r);

    // ----- paths: a gravel (or paved) track with stone edging, one strip per link -----
    const pathM = surf(look.pathTex || 'gravel', { unit: 2.2, tint: look.path ?? 0xffffff });
    const edgeM = surf(look.edgeTex || 'sandstone', { unit: 1.2 });
    for (const n of this.board.nodes) for (const j of n.next) {
      const a = this.pos(n.idx).setY(0), b = this.pos(j).setY(0);
      const len = a.distanceTo(b);
      const strip = new THREE.Group();
      strip.position.copy(a).add(b).multiplyScalar(0.5);
      strip.lookAt(b);
      kit.box(1.9, 0.08, len, pathM, 0, 0, 0, strip).receiveShadow = true;
      for (const sx of [-1, 1]) kit.box(0.22, 0.16, len - 2.4, edgeM, sx * 1.02, 0, 0, strip);
      // a faint painted arrow so the one-way direction is obvious
      const arr = new THREE.Mesh(new THREE.CircleGeometry(0.42, 3), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, roughness: 0.6 }));
      arr.rotation.set(-Math.PI / 2, 0, Math.PI / 2); arr.position.y = 0.09;
      strip.add(arr);
      s.add(strip);
    }

    // ----- spaces: a stone plinth with a glossy enamel disc set into the top -----
    // (lathe profiles run bottom to top so the faces point outwards)
    const plinthGeo = new THREE.LatheGeometry([[0, 0], [1.6, 0], [1.62, 0.12], [1.52, 0.3], [1.42, 0.34], [0, 0.34]].map(([r, y]) => new THREE.Vector2(r, y)), 48);
    const plinthM = surf(look.plinthTex || 'concrete', { unit: 1.2 });
    const topGeo = new THREE.LatheGeometry([[1.34, 0.3], [1.34, 0.36], [1.28, 0.4], [1.0, 0.415], [0, 0.42]].map(([r, y]) => new THREE.Vector2(r, y)), 48);
    const ringGeo = new THREE.TorusGeometry(1.36, 0.055, 10, 64);
    const brass = mat(0xd9b25a, { metalness: 1, roughness: 0.28 });
    const topMats = {};
    for (const n of this.board.nodes) {
      const col = SPACE[n.type]?.color ?? 0xffffff;
      const g = new THREE.Group();
      g.position.set(n.x, 0, n.z);
      const plinth = new THREE.Mesh(plinthGeo, plinthM); plinth.castShadow = true; plinth.receiveShadow = true; g.add(plinth);
      topMats[n.type] ??= new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.4, clearcoat: 0.4, clearcoatRoughness: 0.25, envMapIntensity: 0.45, emissive: col, emissiveIntensity: n.type === 'start' ? 0.02 : 0.18 });
      const top = new THREE.Mesh(topGeo, topMats[n.type]);
      top.receiveShadow = true; g.add(top);
      const ring = new THREE.Mesh(ringGeo, brass); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.34; ring.castShadow = true; g.add(ring);
      const icon = new THREE.Mesh(new THREE.CircleGeometry(1.0, 40), new THREE.MeshStandardMaterial({ map: spaceIcon(n.type), transparent: true, depthWrite: false, roughness: 0.35, polygonOffset: true, polygonOffsetFactor: -2 }));
      icon.rotation.x = -Math.PI / 2; icon.position.y = 0.425;
      g.add(icon);
      s.add(g);
    }

    // ----- landmarks: a .glb model if the map names one, otherwise the built-in model -----
    const loader = new GLTFLoader();
    for (const lm of this.map.landmarks || []) {
      const g = kit.group(lm.x, lm.y ?? 0, lm.z, lm.rot || 0, lm.scale || 1);
      if (lm.glb) {
        loader.load(lm.glb, (gltf) => { gltf.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); g.add(gltf.scene); },
          undefined, () => lm.build?.(kit, g));
      } else lm.build?.(kit, g);
      g.userData._hooked = true;
      if (g.userData.spin) { const sp = [].concat(g.userData.spin); this.updaters.push((dt) => sp.forEach((o) => { o.rotation.x += dt * 1.5; })); }
      if (g.userData.update) this.updaters.push(g.userData.update);
    }
    // scenery: trees, bushes, rocks, houses
    this.batch = new Batch(s);
    kit.batch = this.batch;
    this.map.scatter?.(kit, mulberry32(7));
    this.batch.build();
    s.traverse((o) => { if (o.userData.spin && o !== s && !o.userData._hooked) { o.userData._hooked = true; const f = o.userData.spin; this.updaters.push((dt) => { f.rotation.z += dt * 2; }); } });

    // ----- the item: model + light pillar so it can be spotted from anywhere -----
    this.item = new THREE.Group();
    const model = this.map.item.build(kit);
    model.position.y = 2.4;
    this.item.add(model);
    this.itemModel = model;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 60, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff1a0, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    pillar.position.y = 30;
    this.item.add(pillar);
    const glow = new THREE.PointLight(0xffe08a, 14, 9); // a warm glow on the spaces round it, not a floodlight
    glow.position.y = 2.6;
    this.item.add(glow);
    this.item.visible = false;
    s.add(this.item);

    // highlight rings for aiming
    this.rings = [];
    this.forkArrows = [];
  }

  show() { this.stage.setView(this); }

  // ---------- players ----------
  placeAll(players) {
    for (const p of players) {
      if (!this.dolls.has(p.id)) { const d = new Doll(p, { scale: 1.3 }); this.dolls.set(p.id, d); this.scene.add(d.group); }
    }
    this.players = players;
    this.layout(true);
  }

  // spread everyone sharing a space around it
  layout(instant = false) {
    const by = new Map();
    for (const p of this.players) { if (p._hopping) continue; if (!by.has(p.space)) by.set(p.space, []); by.get(p.space).push(p); }
    for (const [space, list] of by) {
      const c = this.pos(space);
      list.forEach((p, i) => {
        const d = this.dolls.get(p.id);
        const off = list.length > 1 ? new THREE.Vector3(Math.cos(i / list.length * Math.PI * 2) * 0.8, 0, Math.sin(i / list.length * Math.PI * 2) * 0.8) : new THREE.Vector3();
        const to = c.clone().add(off);
        // standing still, everyone turns to face the camera
        if (instant) { d.group.position.copy(to); d.group.rotation.y = 0; }
        else { const from = d.group.position.clone(), r0 = d.group.rotation.y; this.tweens.add(0.25, (k) => { d.group.position.lerpVectors(from, to, k); d.group.rotation.y = r0 * (1 - k); }); }
      });
    }
  }

  async hop(p, to, speed = 1) {
    const d = this.dolls.get(p.id);
    p._hopping = true;
    this.layout();
    const from = d.group.position.clone(), dest = this.pos(to);
    let yaw = Math.atan2(dest.x - from.x, dest.z - from.z);
    if (yaw > Math.PI) yaw -= Math.PI * 2;
    d.group.rotation.y = yaw;
    await this.tweens.add(0.3 * speed, (k) => {
      d.group.position.lerpVectors(from, dest, k);
      d.group.position.y = from.y + Math.sin(k * Math.PI) * 1.3;
    }, easeInOut);
    // the engine also sets this, but only after we return: lay out against where the doll actually is now
    p.space = to;
    p._hopping = false;
    this.followNow(dest);
    this.layout();
  }

  async poof(p, to, speed = 1) {
    const d = this.dolls.get(p.id);
    await this.tweens.add(0.35 * speed, (k) => d.group.scale.setScalar(1 - k * 0.99));
    p._hopping = true;
    d.group.position.copy(this.pos(to));
    await this.tweens.add(0.35 * speed, (k) => d.group.scale.setScalar(0.01 + k * 0.99), easeOut);
    p.space = to;
    p._hopping = false;
    this.layout();
  }

  setMood(p, mood) { this.dolls.get(p.id)?.setMood(mood); }
  flinch(p) { this.dolls.get(p.id)?.flinch(); }
  setPhotos(p) { this.dolls.get(p.id)?.refreshFace(); }

  setStepsLeft(p, n) {
    const d = this.dolls.get(p.id);
    if (!d) return;
    if (d.steps) { d.group.remove(d.steps); d.steps = null; }
    if (n > 0) {
      d.steps = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture(String(n), { w: 128, h: 128, bg: null, fg: '#fff', font: '900 110px system-ui' }), depthTest: false }));
      d.steps.scale.set(1.6, 1.6, 1); d.steps.position.y = 4.4; d.steps.renderOrder = 11;
      d.group.add(d.steps);
    }
  }

  floatText(p, text, color = '#fff') {
    const d = this.dolls.get(p.id);
    if (!d) return;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture(text, { w: 384, h: 128, bg: null, fg: color, font: '900 84px system-ui, "Apple Color Emoji", "Segoe UI Emoji"' }), depthTest: false, transparent: true }));
    s.scale.set(3, 1, 1); s.renderOrder = 12;
    const base = d.group.position.clone().setY(3.6);
    s.position.copy(base);
    this.scene.add(s);
    this.tweens.add(1.4, (k) => { s.position.y = base.y + k * 2; s.material.opacity = 1 - k * k; }).then(() => this.scene.remove(s));
  }

  // ---------- item ----------
  async setItem(space, speed = 1) {
    this.itemSpace = space;
    if (space == null) { this.item.visible = false; return; }
    const to = this.pos(space);
    this.item.visible = true;
    this.focusSpace(space);
    const from = to.clone().setY(40);
    await this.tweens.add(1.0 * speed, (k) => this.item.position.lerpVectors(from, to.clone().setY(0), k), easeOut);
  }

  // ---------- camera ----------
  focus(p) { const d = this.dolls.get(p.id); if (d) this.followNow(d.group.position); }
  focusSpace(idx) { this.followNow(this.pos(idx)); }
  followNow(v) {
    // pull back a bit on narrow (portrait) screens so the spaces either side stay in view
    const k = Math.min(1.8, Math.max(1, 1.5 / (this.camera.aspect || 16 / 9)));
    this.camGoal.look.set(v.x, 0, v.z); this.camGoal.pos.set(v.x, 12 * k, v.z + 15 * k);
  }
  overview() {
    const { cx, cz, r } = this.bounds, d = this.fitDistance(r);
    this.camGoal.look.set(cx, 0, cz); this.camGoal.pos.set(cx, d * 0.78, cz + d * 0.63);
  }

  // ---------- aiming ----------
  highlight(spaces, color = 0xff4fd8, cursor = null) {
    for (const r of this.rings) this.scene.remove(r);
    this.rings = [];
    if (!spaces) return;
    for (const idx of spaces) {
      const m = new THREE.Mesh(new THREE.RingGeometry(SPACE_R * 1.1, SPACE_R * 1.45, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: idx === cursor ? 1 : 0.6, side: THREE.DoubleSide, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.position.copy(this.pos(idx)).setY(0.47);
      m.userData.pulse = idx === cursor;
      this.scene.add(m);
      this.rings.push(m);
    }
  }

  showFork(nexts) {
    for (const a of this.forkArrows) this.scene.remove(a);
    this.forkArrows = [];
    for (const j of nexts || []) {
      const a = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.4, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      a.position.copy(this.pos(j)).setY(2.5);
      a.rotation.x = Math.PI;
      a.userData.bob = true;
      this.scene.add(a);
      this.forkArrows.push(a);
    }
  }

  // ---------- props and effects ----------
  prop(kind, space) {
    const g = new THREE.Group();
    const k = this.kit;
    if (kind === 'sugar') {
      // a 1 kg bag of white sugar
      const bag = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.5, 0.7), [k.mat(0xf4f4f4), k.mat(0xf4f4f4), k.mat(0xffffff), k.mat(0xf4f4f4),
        new THREE.MeshStandardMaterial({ map: textTexture('SUGAR\n1kg', { w: 256, h: 320, bg: '#f4f4f4', fg: '#1e5bb8', font: '900 80px system-ui' }) }), k.mat(0xf4f4f4)]);
      bag.position.y = 0.95; bag.castShadow = true;
      g.add(bag);
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.25, 0.4), k.mat(0xe8e8e8));
      top.position.y = 1.8; g.add(top);
    } else if (kind === 'grenade') {
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.6, 20, 14), k.mat(0xffd23f, { metalness: 0.9, roughness: 0.25 }));
      orb.position.y = 0.8; g.add(orb);
      for (const [w, h] of [[0.14, 0.8], [0.5, 0.14]]) { const c = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.14), k.mat(0xffd23f, { metalness: 0.9, roughness: 0.25 })); c.position.y = 1.65; g.add(c); }
      g.position.y = 2;
    }
    g.position.copy(this.pos(space)).setY(kind === 'grenade' ? 2 : 0.3);
    this.scene.add(g);
    let label = null;
    const api = {
      group: g,
      moveTo: (s) => {
        const from = g.position.clone(), to = this.pos(s).setY(g.position.y);
        this.tweens.add(0.25, (kk) => { g.position.lerpVectors(from, to, kk); g.rotation.z = kk * Math.PI * 2; });
      },
      setText: (t) => {
        if (label) g.remove(label);
        label = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture(t, { w: 128, h: 128, bg: null, fg: '#ff3b3b', font: '900 100px system-ui' }), depthTest: false }));
        label.scale.set(1.5, 1.5, 1); label.position.y = 3; label.renderOrder = 12;
        g.add(label);
      },
      throwTo: async (s, speed = 1) => {
        const from = g.position.clone(), to = this.pos(s).setY(0.3);
        this.focusSpace(s);
        await this.tweens.add(1.1 * speed, (kk) => { g.position.lerpVectors(from, to, kk); g.position.y += Math.sin(kk * Math.PI) * 10; g.rotation.x = kk * 8; });
      },
      remove: () => this.scene.remove(g),
    };
    return api;
  }

  async explode(space, radius, color = 0xffaa33, speed = 1, size = 1) {
    const c = this.pos(space);
    this.focusSpace(space);
    const r = (radius + 0.7) * 4.6 * size;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false }));
    ball.position.copy(c);
    const light = new THREE.PointLight(color, 400, r * 3);
    light.position.copy(c).setY(4);
    this.scene.add(ball, light);
    // chunks flying out
    const bits = [];
    for (let i = 0; i < 40; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshBasicMaterial({ color: i % 2 ? color : 0xffffff }));
      b.position.copy(c);
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.3, Math.random() - 0.5).normalize().multiplyScalar(r * (0.6 + Math.random()));
      bits.push([b, v]); this.scene.add(b);
    }
    this.shake = 0.8;
    await this.tweens.add(0.9 * speed, (k) => {
      ball.scale.setScalar(0.5 + r * easeOut(k)); ball.material.opacity = 0.85 * (1 - k);
      light.intensity = 400 * (1 - k);
      for (const [b, v] of bits) { b.position.copy(c).addScaledVector(v, k); b.position.y = Math.max(0.2, c.y + v.y * k * 1.6 - 9 * k * k); }
    });
    this.scene.remove(ball, light, ...bits.map(([b]) => b));
  }

  async vacuum(p, spaces, speed = 1) {
    const d = this.dolls.get(p.id);
    const from = d.group.position.clone().setY(1.5);
    const pts = spaces.map((s) => this.pos(s).setY(1));
    const motes = [];
    for (let i = 0; i < 60; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 4), new THREE.MeshBasicMaterial({ color: i % 3 ? 0x3de1ff : 0xffd23f }));
      const start = pts[i % pts.length].clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2));
      motes.push([m, start, Math.random() * 0.5]); this.scene.add(m);
    }
    this.highlight(spaces, 0x3de1ff);
    await this.tweens.add(1.6 * speed, (k) => {
      for (const [m, s, delay] of motes) { const kk = Math.max(0, Math.min(1, (k - delay) / (1 - delay))); m.position.lerpVectors(s, from, easeInOut(kk)); m.visible = kk < 1; }
      d.body.rotation.y = Math.sin(k * 40) * 0.1;
    });
    this.highlight(null);
    this.scene.remove(...motes.map(([m]) => m));
  }

  update(dt) {
    this.tweens.update(dt);
    for (const f of this.updaters) f(dt);
    for (const d of this.dolls.values()) d.update(dt);
    if (this.item.visible) { this.itemModel.rotation.y += dt * 1.4; this.itemModel.position.y = 2.2 + Math.sin(performance.now() / 400) * 0.25; }
    const t = performance.now() / 1000;
    for (const r of this.rings) if (r.userData.pulse) r.scale.setScalar(1 + Math.sin(t * 8) * 0.08);
    for (const a of this.forkArrows) a.position.y = 2.5 + Math.sin(t * 5) * 0.3;
    // camera eases towards its goal
    const f = 1 - Math.pow(0.02, dt);
    this.camPos.lerp(this.camGoal.pos, f);
    this.camLook.lerp(this.camGoal.look, f);
    this.camera.position.copy(this.camPos);
    if (this.shake > 0) { this.shake -= dt; this.camera.position.x += (Math.random() - 0.5) * this.shake; this.camera.position.y += (Math.random() - 0.5) * this.shake; }
    this.camera.lookAt(this.camLook);
  }
}
