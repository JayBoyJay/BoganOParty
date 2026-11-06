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
import { makeD10, restQuaternion } from '../dice3d.js';
import { gatherColliders, simulateDice } from './dicephys.js';
import { TRAPS } from '../content/traps.js';

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
    stage.persist(this.scene);
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
    sun.shadow.mapSize.set(2048, 2048);
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
    // where the trap rigs go (worked out now so the scenery keeps out of their way)
    this.trapSpots = new Map(this.board.nodes.filter((n) => n.trap).map((n) => [n.idx, this.trapLayout(n, lms)]));
    kit.isClear = (x, z, r = 4) => this.board.nodes.every((n) => Math.hypot(n.x - x, n.z - z) > r + 4)
      && lms.every((l) => Math.hypot(l.x - x, l.z - z) > (l.flat ?? 16 * (l.scale || 1)) + r)
      && [...this.trapSpots.values()].every((t) => Math.hypot(t.x - x, t.z - z) > r + 3);

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

    // ----- trap rigs beside the spaces that have one (js/content/traps.js) -----
    this.trapRigs = new Map();
    for (const n of this.board.nodes) if (n.trap) this.trapRigs.set(n.idx, this.buildTrapRig(n));

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
    if (d.steps) { this.stage.drop(d.steps); d.steps = null; }
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
    this.tweens.add(1.4, (k) => { s.position.y = base.y + k * 2; s.material.opacity = 1 - k * k; }).then(() => this.stage.drop(s));
  }

  // ---------- dice ----------
  // Throw dice (already decided: values) from the viewer's side of the screen onto the board in front of p.
  // fling from the phone flick: power 0..1 (harder goes further), exit -1..1 (where it left the top of the
  // phone: where it comes in), aim -1..1 (which way it was heading), curve -1..1 (a bent swipe: spin that bends it).
  // A physics sim (dicephys.js) bounces them off the ground, props, buildings, dolls and each other; the
  // last half second eases each onto its value, reading upright from the camera.
  // onHit(kind, hard) for sounds: kind is 'ground' | 'wall' | 'doll' | 'dice', hard 0..1.
  async throwDice(p, values, fling = {}, speed = 1, onHit = null) {
    this.clearDice(true);
    const d = this.dolls.get(p.id);
    if (!d) return;
    const power = Math.max(0, Math.min(1, fling.power ?? 0.6)), aim = fling.aim || 0, exit = fling.exit || 0, curve = fling.curve ?? fling.spin ?? 0;
    const base = d.group.position.clone();
    const ground = base.y;
    const SIZE = 1.15, R = 0.85;
    const dice = values.map((value, i) => {
      const mesh = makeD10(p.color || '#ff4f8b', SIZE);
      mesh.castShadow = true;
      const verts = [];
      const pa = mesh.geometry.getAttribute('position');
      for (let j = 0; j < pa.count; j++) {
        const v = new THREE.Vector3().fromBufferAttribute(pa, j);
        if (!verts.some((w) => w.distanceToSquared(v) < 1e-6)) verts.push(v);
      }
      const off = (i - (values.length - 1) / 2) * 2.2;
      // in from the viewer's side where it left the top of the phone, heading the way it was flicked
      const pos = base.clone().add(new THREE.Vector3(1.5 + exit * 4 + off * 0.6, 7 + power * 2, 15));
      const dir = new THREE.Vector3(aim * 0.45 + off * 0.02 + (Math.random() - 0.5) * 0.04, 0, -1).normalize();
      const vel = dir.multiplyScalar(10 + power * 8).setY(2);
      const w = new THREE.Vector3(-(6 + power * 8), curve * 12, (Math.random() - 0.5) * 6);
      const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6));
      return { mesh, verts, value, start: { pos, vel, spin: w, quat, curve } };
    });
    // what's solid round here: props and buildings near the throw, and everyone's doll
    const skip = new Set([this.item, ...[...this.dolls.values()].map((x) => x.group)]);
    const colliders = gatherColliders(this.scene, base.clone().add(new THREE.Vector3(0, 0, -8)), 32, ground, skip);
    const dolls = (this.players || []).map((o) => ({ id: o.id, pos: this.dolls.get(o.id)?.group.position.clone(), r: 0.75, h: 3.6 })).filter((x) => x.pos);
    const sim = simulateDice(dice.map((x) => x.start), { colliders, dolls, groundY: ground, R });
    // ease the last half second onto the face each die has to show
    const blend = Math.round(0.5 / (1 / 120));
    dice.forEach((die, i) => {
      const fr = sim.frames[i];
      const target = restQuaternion(die.value, new THREE.Vector3(0, 0, -1));
      // where this die stopped (others may roll on after it)
      let stop = fr.length - 1;
      while (stop > 0 && fr[stop].p.distanceToSquared(fr[stop - 1].p) < 1e-6) stop--;
      const from = Math.max(0, stop - blend);
      for (let j = from; j < fr.length; j++) {
        const k = Math.min(1, (j - from) / Math.max(1, stop - from));
        fr[j].q.slerp(target, k * k * (3 - 2 * k));
      }
      die.frames = fr;
      die.land = fr[fr.length - 1].p.clone().setY(ground);
      this.scene.add(die.mesh);
    });
    this.dice = dice;
    const T = Math.max(0.5, sim.T) * speed;
    const events = sim.events.slice();
    const tmp = new THREE.Vector3(), look = new THREE.Vector3();
    const place = (die, f) => {
      die.mesh.quaternion.copy(f.q);
      let low = Infinity;
      for (const v of die.verts) low = Math.min(low, tmp.copy(v).applyQuaternion(f.q).y);
      // the ball's bottom is where the die's lowest point goes
      die.mesh.position.set(f.p.x, f.p.y - R - low, f.p.z);
    };
    for (const die of dice) place(die, die.frames[0]);
    await this.tweens.add(T, (k) => {
      const t = k * sim.T;
      look.set(0, 0, 0);
      for (const die of dice) {
        const f = die.frames[Math.min(die.frames.length - 1, Math.floor(t * 120))];
        place(die, f);
        look.add(die.mesh.position);
      }
      while (events.length && events[0].t <= t) {
        const e = events.shift();
        if (e.kind === 'doll') this.dolls.get(e.id)?.flinch();
        onHit?.(e.kind, e.hard);
      }
      // the camera follows the dice down the board
      look.divideScalar(dice.length).lerp(base, 0.35);
      this.followNow(look);
    });
    // pop the numbers up over the dice
    for (const die of dice) {
      die.label = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture(String(die.value), { w: 128, h: 128, bg: null, fg: '#fff', font: '900 104px system-ui' }), depthTest: false, transparent: true }));
      die.label.renderOrder = 12;
      this.scene.add(die.label);
    }
    const tops = dice.map((die) => die.mesh.position.y);
    await this.tweens.add(0.35 * speed, (k) => {
      dice.forEach((die, i) => {
        die.mesh.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.18);
        die.label.position.copy(die.mesh.position).setY(tops[i] + 1.6 + easeOut(k) * 0.6);
        die.label.scale.setScalar(0.2 + easeOut(k) * 1.4);
      });
    });
  }

  clearDice(now = false) {
    const dice = this.dice;
    this.dice = null;
    if (!dice?.length) return;
    const drop = () => { for (const die of dice) { this.stage.drop(die.mesh); if (die.label) this.stage.drop(die.label); } };
    if (now) { drop(); return; }
    this.tweens.add(0.3, (k) => { for (const die of dice) { die.mesh.scale.setScalar(Math.max(0.01, 1 - k)); if (die.label) die.label.material.opacity = 1 - k; } }).then(drop);
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
    this.stage.drop(...this.rings);
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
    this.stage.drop(...this.forkArrows);
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
    } else if (kind === 'coins') {
      // a scatter of dropped gold coins
      const gold = k.mat(0xffc93c, { metalness: 0.9, roughness: 0.3 });
      for (let i = 0; i < 7; i++) {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.08, 18), gold);
        const a = i * 2.4, r = i ? 0.55 + (i % 3) * 0.15 : 0;
        c.position.set(Math.cos(a) * r, 0.05 + (i % 2) * 0.06, Math.sin(a) * r);
        c.rotation.set((i % 3) * 0.25, 0, (i % 2) * 0.3);
        c.castShadow = true;
        g.add(c);
      }
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
      setText: (t, fg = '#ff3b3b') => {
        if (label) this.stage.drop(label);
        label = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture(t, { w: 128, h: 128, bg: null, fg, font: '900 100px system-ui' }), depthTest: false }));
        label.scale.set(1.5, 1.5, 1); label.position.y = 3; label.renderOrder = 12;
        g.add(label);
      },
      throwTo: async (s, speed = 1) => {
        const from = g.position.clone(), to = this.pos(s).setY(0.3);
        this.focusSpace(s);
        await this.tweens.add(1.1 * speed, (kk) => { g.position.lerpVectors(from, to, kk); g.position.y += Math.sin(kk * Math.PI) * 10; g.rotation.x = kk * 8; });
      },
      remove: () => this.stage.drop(g),
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
    this.stage.drop(ball, light, ...bits.map(([b]) => b));
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
    this.stage.drop(...motes.map(([m]) => m));
  }

  // ---------- traps ----------
  // Which way the road runs at a trap space, and which side of it the rig's plinth goes: away from the
  // camera if there's room, otherwise whichever side is clearer of landmarks and other spaces.
  trapLayout(n, lms) {
    const at = (j) => this.board.nodes[j];
    const a = at(n.prev[0] ?? n.idx), b = at(n.next[0] ?? n.idx);
    const yaw = Math.atan2(b.x - a.x, b.z - a.z);
    const off = { rock: 2.2, balls: 4.4, magpie: 2.6, mineshaft: 3.0, dropbear: 3.4 }[n.trap] ?? 3;
    // local +x points to world (cos yaw, -sin yaw)
    const far = -Math.sin(yaw) <= 0 ? 1 : -1;
    const spot = (sx) => {
      const x = n.x + Math.cos(yaw) * sx * off, z = n.z - Math.sin(yaw) * sx * off;
      const room = Math.min(...lms.map((l) => Math.hypot(l.x - x, l.z - z) - (l.flat ?? 16 * (l.scale || 1)) * 0.75),
        ...this.board.nodes.filter((m) => m !== n).map((m) => Math.hypot(m.x - x, m.z - z) - 1.6));
      return { yaw, sx, x, z, room };
    };
    const [p, q] = [spot(far), spot(-far)];
    // tall rigs always go on the far side so they never stand between the camera and a doll
    return ['rock', 'magpie', 'dropbear'].includes(n.trap) || p.room >= 2 || p.room >= q.room ? p : q;
  }

  // A rig next to a trap space, built in the space's own frame: z runs along the road, x across it.
  buildTrapRig(n) {
    const k = this.kit;
    const { yaw, sx } = this.trapSpots.get(n.idx);
    const g = k.group(n.x, 0, n.z, yaw, 1, this.scene);
    // world +x and +z in the rig's frame, for things that should face the camera
    const wx = [Math.cos(yaw), Math.sin(yaw)], wz = [-Math.sin(yaw), Math.cos(yaw)];
    const facing = (m, x, y, z, out = 0) => { m.position.set(x + wz[0] * out, y, z + wz[1] * out); m.rotation.set(0, -yaw, 0); return m; };
    const rig = { kind: n.trap, group: g, side: sx, yaw, armed: null };
    const timber = k.surf('weatherboard', { arg: 0x7a5232, unit: 1.5 });
    const steel = k.mat(0x6d6f72, { metalness: 0.8, roughness: 0.45 });
    if (n.trap === 'rock') {
      // a hardwood gantry over the space with a pulley, and the boulder hauled up on a rope when it's set
      const H = 9;
      for (const x of [-2.2, 2.2]) {
        k.box(0.45, H, 0.45, timber, x, 0, 0, g);
        k.beam([x, 0, -1.3], [x, 3.2, 0], 0.18, timber, g); // braces
        k.beam([x, 0, 1.3], [x, 3.2, 0], 0.18, timber, g);
      }
      k.box(5.0, 0.36, 0.36, timber, 0, H, 0, g);
      const wheel = k.cyl(0.42, 0.42, 0.14, steel, 0, H - 0.6, 0, g, {}, 16); wheel.rotation.x = Math.PI / 2;
      // the rope runs over the pulley and down a post to a cleat
      k.rod([0.42, H - 0.45, 0], [2.0, H - 0.45, 0], 0.05, 0xc8b68a, g);
      k.rod([2.05, H - 0.45, 0], [2.05, 1.4, 0], 0.05, 0xc8b68a, g);
      const rope = k.rod([0, H - 0.6, 0], [0, H - 1.6, 0], 0.06, 0xc8b68a, g);
      // the boulder: a lumpy chunk of ironstone
      const THREE = k.THREE;
      const geo = new THREE.DodecahedronGeometry(1.5, 2);
      const P = geo.attributes.position;
      const noise = new ImprovedNoise();
      for (let i = 0; i < P.count; i++) {
        const v = new THREE.Vector3(P.getX(i), P.getY(i), P.getZ(i));
        v.multiplyScalar(1 + noise.noise(v.x * 1.4, v.y * 1.4 + n.idx, v.z * 1.4) * 0.28);
        P.setXYZ(i, v.x, v.y * 0.85, v.z);
      }
      geo.computeVertexNormals();
      const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, P.getX(i) + P.getZ(i), P.getY(i));
      const rock = new THREE.Mesh(geo, k.surf('sandstone', { unit: 1.4, tint: 0x9a6a50 }));
      rock.castShadow = true;
      g.add(rock);
      rig.payload = rock; rig.rope = rope; rig.hang = H - 2.9; rig.H = H;
      // a yellow FALLING ROCKS sign on the far post
      facing(k.sign('⚠ FALLING\nROCKS', 1.6, 1.3, 0, 0, 0, g, { bg: '#ffd23f', fg: '#1b1b1b', font: '900 190px system-ui, sans-serif' }), sx * 2.2, 3.6, 0, 0.3);
    } else if (n.trap === 'balls') {
      // Mall's Balls: a little copy of the sculpture on a plinth beside the road, with a ramp down to the space.
      // Set it and the top ball is loose, ready to roll.
      const px = sx * 4.4, R = 1.5;
      k.cyl(1.6, 1.75, 1.6, k.surf('concrete', { unit: 1 }), px, 0, 0, g, {}, 28);
      const ramp = k.box(2.6, 0.2, 2.2, k.surf('pavers', { unit: 1.2 }), sx * 2.2, 0.55, 0, g);
      ramp.rotation.z = sx * 0.5;
      const chrome = k.mat(0xeef2f6, { metalness: 1, roughness: 0.05 });
      k.ball(R, chrome, px, 1.6 + R, 0, g); // the bottom ball stays put
      const ball = k.ball(R, chrome, 0, 0, 0, g);
      rig.payload = ball; rig.home = new k.THREE.Vector3(px, 1.6 + R * 3, 0); rig.px = px; rig.R = R;
      facing(k.sign("MALL'S BALLS", 2.0, 0.5, 0, 0, 0, g, { bg: '#6b4a1e', fg: '#ffe6a8' }), px, 0.9, 0, 1.8);
      rig.flagAt = [px + sx * 1.95, 0, 1.6, 8.6]; rig.labelAt = [px, 10];
    } else if (n.trap === 'magpie') {
      // a council SWOOPING MAGPIES sign on a post, and (in season) the magpie perched on top of it
      const px = sx * 2.6;
      k.box(0.16, 4.2, 0.16, steel, px, 0, 0, g);
      facing(k.sign('⚠ SWOOPING\nMAGPIES', 2.0, 1.4, 0, 0, 0, g, { bg: '#ffd23f', fg: '#1b1b1b', font: '900 170px system-ui, sans-serif' }), px, 3.4, 0, 0.12);
      const bird = this.magpie();
      g.add(bird);
      rig.payload = bird; rig.home = new k.THREE.Vector3(px, 4.25, 0); rig.px = px;
      rig.flagAt = [px - sx * 0.0, 0, 4.2, 6.0]; rig.labelAt = [px, 8.4];
    } else if (n.trap === 'mineshaft') {
      // a hand windlass over the old shaft beside the road, a DANGER sign, and a bucket on the rope when it's set
      const px = sx * 3.0;
      for (const z of [-1.1, 1.1]) { k.beam([px - 0.7, 0, z], [px, 2.4, z], 0.2, timber, g); k.beam([px + 0.7, 0, z], [px, 2.4, z], 0.2, timber, g); }
      const drum = k.cyl(0.32, 0.32, 2.4, timber, px, 2.25, -1.2, g, {}, 14); drum.rotation.x = Math.PI / 2; drum.position.set(px, 2.4, 0);
      k.rod([px, 2.4, 1.2], [px, 2.4, 1.6], 0.06, steel, g); k.rod([px, 2.4, 1.6], [px, 1.8, 1.6], 0.05, steel, g); // crank
      k.cyl(1.0, 1.1, 0.25, k.surf('slag', { unit: 1 }), px, 0, 0, g, {}, 18); // spoil round the collar
      k.cyl(0.75, 0.75, 0.27, 0x0b0907, px, 0, 0, g, {}, 18);
      facing(k.sign('DANGER\nOPEN SHAFT', 1.7, 1.1, 0, 0, 0, g, { bg: '#c8261e', fg: '#ffffff', font: '900 180px system-ui, sans-serif' }), px + sx * 1.6, 1.2, 0, 0.1);
      k.box(0.12, 1.2, 0.12, steel, px + sx * 1.6, 0, 0, g);
      const bucket = new k.THREE.Group();
      k.cyl(0.32, 0.26, 0.5, 0x7a5a3a, 0, -0.5, 0, bucket, {}, 12);
      k.rod([0, 0, 0], [0, -0.6, 0], 0.03, 0xc8b68a, bucket);
      g.add(bucket);
      rig.payload = bucket; rig.home = new k.THREE.Vector3(px, 2.1, 0); rig.px = px;
      // the hole that opens under whoever lands on it
      const hole = new k.THREE.Mesh(new k.THREE.CircleGeometry(1.15, 32), new k.THREE.MeshBasicMaterial({ color: 0x050403, polygonOffset: true, polygonOffsetFactor: -4 }));
      hole.rotation.x = -Math.PI / 2; hole.position.y = 0.45; hole.visible = false; g.add(hole);
      rig.hole = hole;
      rig.flagAt = [px - sx * 0.7, 0, 0, 4.2]; rig.labelAt = [px, 6.4];
    } else if (n.trap === 'dropbear') {
      // a big gum with a branch out over the road, and (when it's set) a drop bear waiting on the end of it
      const px = sx * 3.4;
      const bark = k.surf('sandstone', { unit: 2, tint: 0xd8d0c0 });
      k.cyl(0.42, 0.62, 8.5, bark, px, 0, 0, g, {}, 12);
      k.beam([px, 6.6, 0], [-sx * 0.6, 7.6, 0], 0.32, bark, g);
      k.beam([px, 5.2, 0], [px + sx * 2, 7.4, 0.6], 0.26, bark, g);
      const leaf = k.mat(0x4f6b3a, { roughness: 0.9 });
      for (const [x, y, z, r] of [[px, 9.2, 0, 2.0], [px + sx * 1.6, 8.4, 0.8, 1.5], [-sx * 0.4, 8.6, 0.2, 1.4], [px - sx * 1.4, 8.9, -0.6, 1.5]]) {
        const c = k.ball(r, leaf, x, y, z, g); c.scale.y = 0.6;
      }
      const bear = this.dropBear();
      g.add(bear);
      rig.payload = bear; rig.home = new k.THREE.Vector3(0, 7.4, 0); rig.px = px;
      facing(k.sign('DROP BEARS\nNEXT 2 KM', 1.8, 0.9, 0, 0, 0, g, { bg: '#2e6b3a', fg: '#ffffff', font: '900 150px system-ui, sans-serif' }), px, 2.2, 0, 0.65);
      rig.flagAt = [px + sx * 0.5, 0, 0, 3.6]; rig.labelAt = [px, 11.2];
    }
    if (n.trap === 'rock') { rig.flagAt = [sx * 2.2, 0, 9.2, 10.8]; rig.labelAt = [0, 11.2]; }
    // the flag on top shows whose trap it is
    const [fx, fz, fy0, fy1] = rig.flagAt;
    k.rod([fx, fy0, fz], [fx, fy1, fz], 0.05, steel, g);
    const flag = new k.THREE.Mesh(new k.THREE.PlaneGeometry(1.2, 0.75), new k.THREE.MeshStandardMaterial({ color: 0xffffff, side: k.THREE.DoubleSide, roughness: 0.8 }));
    const fd = -Math.sign(wx[0] * sx || 1) * 0.62; // hang it out towards the road
    facing(flag, fx + wx[0] * fd, fy1 - 0.42, fz + wx[1] * fd);
    g.add(flag);
    rig.flag = flag;
    this.setTrap(n.idx, null, rig);
    return rig;
  }

  // Show a trap as empty (owner null: up for grabs) or set by owner.
  setTrap(space, owner, rig = this.trapRigs.get(space)) {
    if (!rig) return;
    rig.armed = owner;
    const p = rig.payload;
    p.visible = !!owner;
    if (rig.kind === 'rock') {
      p.position.set(0, owner ? rig.hang : rig.H - 1.6, 0);
      rig.rope.visible = !!owner;
      if (owner) { // haul it up
        const top = rig.hang;
        this.tweens.add(0.8, (kk) => { p.position.y = 1.4 + (top - 1.4) * kk; p.rotation.y = kk * 2; }, easeOut);
      }
    } else if (owner) {
      p.position.copy(rig.home).setY(rig.home.y + 4);
      p.rotation.set(0, rig.kind === 'magpie' || rig.kind === 'dropbear' ? -rig.yaw : 0, 0); // face the camera
      this.tweens.add(0.5, (kk) => { p.position.y = rig.home.y + 4 * (1 - kk); }, easeOut);
    }
    rig.flag.visible = !!owner;
    if (owner) rig.flag.material.color.set(owner.color || '#ffffff');
    if (rig.label) this.stage.drop(rig.label);
    const name = TRAPS[rig.kind]?.name || 'Trap';
    rig.label = this.kit.label(owner ? `⚠ ${owner.name}'s trap` : `${name} trap: walk past to set`, rig.labelAt[0], rig.labelAt[1], 0, rig.group);
    rig.label.scale.multiplyScalar(owner ? 0.9 : 0.7);
  }

  // An Australian magpie: black with a white nape, white wing bars and a pale beak. userData.flap(t) beats the wings.
  magpie() {
    const k = this.kit, THREE = k.THREE;
    const g = new THREE.Group(), body = new THREE.Group();
    g.add(body); body.scale.setScalar(2.2);
    const black = k.mat(0x111214, { roughness: 0.5 }), white = k.mat(0xf2f2ee, { roughness: 0.6 }), beak = k.mat(0xcfd2d6, { roughness: 0.4 });
    const torso = k.ball(0.32, black, 0, 0.35, 0, body); torso.scale.set(0.8, 0.85, 1.35);
    const nape = k.ball(0.24, white, 0, 0.55, -0.12, body); nape.scale.set(0.95, 0.7, 1.1);
    k.ball(0.19, black, 0, 0.66, 0.3, body);
    const b = k.cone(0.06, 0.32, beak, 0, 0, 0, body, {}, 8); b.rotation.x = Math.PI / 2; b.position.set(0, 0.64, 0.58);
    for (const sx of [-1, 1]) k.ball(0.035, k.mat(0xa04010), sx * 0.13, 0.7, 0.4, body);
    const tail = k.box(0.22, 0.05, 0.42, black, 0, 0.26, -0.55, body); tail.rotation.x = -0.35;
    k.box(0.22, 0.051, 0.12, white, 0, 0.27, -0.42, body).rotation.x = -0.35;
    for (const sx of [-1, 1]) { k.rod([sx * 0.06, 0.12, 0.05], [sx * 0.07, -0.05, 0.08], 0.022, 0x2a2a2a, body); }
    const wings = [-1, 1].map((sx) => {
      const pivot = new THREE.Group(); pivot.position.set(sx * 0.22, 0.45, 0); body.add(pivot);
      k.box(0.62, 0.05, 0.42, black, sx * 0.3, 0, 0, pivot);
      k.box(0.3, 0.052, 0.14, white, sx * 0.16, 0.002, 0.08, pivot);
      return { pivot, sx };
    });
    g.userData.flap = (t) => wings.forEach(({ pivot, sx }) => { pivot.rotation.z = sx * Math.sin(t * Math.PI * 2) * 0.9; });
    return g;
  }

  // A drop bear: a koala gone feral. Grey fur, big fluffy ears, black nose, mad red eyes and fangs.
  dropBear() {
    const k = this.kit, THREE = k.THREE;
    const g = new THREE.Group(), b = new THREE.Group();
    g.add(b); b.scale.setScalar(1.25);
    const fur = k.mat(0x8c8c88, { roughness: 1 }), pale = k.mat(0xd8d4cc, { roughness: 1 });
    const body = k.ball(0.55, fur, 0, 0.55, 0, b); body.scale.set(1, 1.05, 0.9);
    k.ball(0.32, pale, 0, 0.5, 0.36, b).scale.set(1, 1.2, 0.6);
    k.ball(0.45, fur, 0, 1.25, 0.05, b);
    for (const sx of [-1, 1]) {
      const ear = k.ball(0.24, fur, sx * 0.42, 1.55, 0, b); ear.scale.set(1, 1, 0.5);
      k.ball(0.15, pale, sx * 0.42, 1.55, 0.06, b).scale.set(1, 1, 0.4);
      k.ball(0.07, k.mat(0xff1a1a, { emissive: 0xff0000, emissiveIntensity: 1.2 }), sx * 0.16, 1.33, 0.4, b); // mad red eyes
      k.ball(0.14, fur, sx * 0.45, 0.4, 0.3, b); // paws
      k.cone(0.03, 0.12, 0xffffff, sx * 0.07, 1.0, 0.43, b, {}, 6).rotation.x = Math.PI;
    }
    const nose = k.ball(0.14, k.mat(0x1a1a1a, { roughness: 0.3 }), 0, 1.18, 0.45, b); nose.scale.set(0.85, 1.2, 0.7);
    return g;
  }

  // An esky lid that pops up over a doll's head. break() snaps it in two and throws the halves off.
  // side: hold it up on that side (a world direction) instead of over the head, for things coming in low.
  esky(p, side = null) {
    const k = this.kit, THREE = k.THREE;
    const d = this.dolls.get(p.id);
    const g = new THREE.Group();
    const halves = [-1, 1].map((sx) => {
      const h = new THREE.Group();
      k.box(1.05, 0.16, 1.3, 0x1f63c6, sx * 0.53, 0, 0, h, { roughness: 0.5 });
      k.box(0.95, 0.1, 1.15, 0xf6f6f2, sx * 0.53, 0.16, 0, h, { roughness: 0.4 });
      k.box(0.3, 0.12, 0.2, 0x1f63c6, sx * 0.53, 0.26, 0.35, h); // handle
      g.add(h);
      return h;
    });
    const feet = side === 'feet';
    if (feet) side = null;
    const base = d.group.position.clone().setY(side ? 1.7 : feet ? 0.2 : 3.2);
    const lift = side ? side.clone().setY(0).normalize().multiplyScalar(1.0) : new THREE.Vector3(0, feet ? 0.35 : 1.1, 0);
    if (side) g.rotation.set(0, Math.atan2(-lift.z, lift.x), Math.PI / 2); // stood on edge, facing the way it's coming from
    g.position.copy(base);
    g.scale.setScalar(0.01);
    this.scene.add(g);
    const api = {
      pop: (speed = 1) => this.tweens.add(0.25 * speed, (kk) => { g.scale.setScalar((0.01 + kk * 1.1) * (feet ? 1.4 : 1)); g.position.copy(base).addScaledVector(lift, kk); }, easeOut),
      break: async (speed = 1) => {
        this.shake = 0.35;
        await this.tweens.add(0.7 * speed, (kk) => halves.forEach((h, i) => {
          const sx = i ? 1 : -1;
          h.position.set(sx * kk * 2.6, Math.sin(kk * Math.PI) * 1.4 - kk * kk * 3, 0);
          h.rotation.z = sx * kk * 4;
        }));
        this.stage.drop(g);
      },
      group: g,
    };
    return api;
  }

  // A power-up hits someone holding a shield: the lid takes it and breaks.
  async shieldBlock(p, speed = 1) {
    const lid = this.esky(p);
    await lid.pop(speed);
    await this.wait(0.25 * speed);
    await lid.break(speed);
  }

  wait(s) { return this.tweens.add(s, () => {}); }

  // A trap goes off on p. blocked: they've got a shield, so the lid takes it.
  async springTrap(space, kind, p, blocked, speed = 1, sound = () => {}) {
    const rig = this.trapRigs.get(space);
    if (!rig) return;
    const d = this.dolls.get(p.id);
    this.focusSpace(space);
    const pay = rig.payload;
    const lidAt = rig.kind === 'balls' ? new THREE.Vector3(Math.cos(rig.yaw) * rig.side, 0, -Math.sin(rig.yaw) * rig.side) : rig.kind === 'mineshaft' ? 'feet' : null;
    const lid = blocked ? this.esky(p, lidAt) : null;
    if (lid) await lid.pop(speed);
    // where the doll is, in the rig's frame (they might be standing off centre)
    const local = rig.group.worldToLocal(d.group.position.clone());
    const squash = async () => {
      this.shake = 0.6;
      d.flinch();
      const base = d.group.scale.clone();
      await this.tweens.add(0.12 * speed, (kk) => d.group.scale.set(base.x * (1 + kk * 0.5), base.y * (1 - kk * 0.8), base.z * (1 + kk * 0.5)));
      await this.wait(0.5 * speed);
      await this.tweens.add(0.45 * speed, (kk) => { const b = Math.sin(kk * Math.PI * 3) * (1 - kk) * 0.25; d.group.scale.set(base.x * (1.5 - kk * 0.5 - b), base.y * (0.2 + kk * 0.8 + b), base.z * (1.5 - kk * 0.5 - b)); }, easeOut);
      d.group.scale.copy(base);
    };
    if (rig.kind === 'rock') {
      rig.rope.visible = false; // snap
      const y0 = pay.position.y, x0 = pay.position.x, z0 = pay.position.z;
      const stop = blocked ? 5.9 : 1.5;
      await this.tweens.add(0.42 * speed, (kk) => { pay.position.set(x0 + (local.x - x0) * kk, y0 + (stop - y0) * kk * kk, z0 + (local.z - z0) * kk); pay.rotation.x = kk * 0.6; });
      sound('slam');
      if (blocked) {
        sound('clank');
        const bx = local.x + rig.side * 3.2;
        await Promise.all([lid.break(speed), this.tweens.add(0.7 * speed, (kk) => { pay.position.set(local.x + (bx - local.x) * kk, stop + Math.sin(kk * Math.PI) * 1.5 - (stop - 1.2) * kk, local.z); pay.rotation.z = -rig.side * kk * 3; })]);
      } else {
        this.explode(space, 0, 0xb58a5a, speed, 0.45);
        await squash();
      }
      await this.wait(0.3 * speed);
      await this.tweens.add(0.5 * speed, (kk) => pay.scale.setScalar(Math.max(0.01, 1 - kk)));
    } else if (rig.kind === 'magpie') {
      // takes off, then dive-bombs the head a few times (once if there's a lid in the way) and clears off
      const from = pay.position.clone(), head = new THREE.Vector3(local.x, 3.9, local.z);
      const passes = blocked ? 1 : 3;
      sound('magpie');
      await this.tweens.add(0.45 * speed, (kk) => { pay.position.set(from.x * (1 - kk), from.y + kk * 4, from.z - kk * 3); pay.userData.flap?.(kk * 12); });
      for (let i = 0; i < passes; i++) {
        const a = pay.position.clone(), dir = i % 2 ? -1 : 1;
        const b = head.clone().add(new THREE.Vector3(dir * 5, 3.5, 2));
        sound('squawk');
        await this.tweens.add(0.5 * speed, (kk) => {
          // a swoop: down through the head and back up the far side
          const t = kk;
          pay.position.set(a.x + (b.x - a.x) * t, head.y + (1 - Math.sin(t * Math.PI)) * (t < 0.5 ? a.y - head.y : b.y - head.y) + 0.2, a.z + (b.z - a.z) * t);
          pay.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
          pay.userData.flap?.(kk * 10 + i);
          if (Math.abs(t - 0.5) < 0.04 && !pay.userData.hitThis) { pay.userData.hitThis = true; if (blocked) { sound('clank'); } else { d.flinch(); this.shake = 0.25; sound('slap'); } }
        });
        pay.userData.hitThis = false;
      }
      if (blocked) await lid.break(speed); else d.flinch();
      const c = pay.position.clone();
      await this.tweens.add(0.6 * speed, (kk) => { pay.position.set(c.x, c.y + kk * 8, c.z - kk * 10); pay.scale.setScalar(Math.max(0.01, 1 - kk)); pay.userData.flap?.(kk * 12); });
    } else if (rig.kind === 'mineshaft') {
      // the ground gives way: a black hole opens under the space and down they go, then get winched back up
      const hole = rig.hole;
      hole.position.set(local.x, 0.45, local.z);
      hole.visible = true;
      sound('creak');
      await this.tweens.add(0.3 * speed, (kk) => hole.scale.setScalar(0.05 + kk * 0.95), easeOut);
      const y0 = d.group.position.y;
      if (blocked) {
        sound('clank');
        await this.tweens.add(0.2 * speed, (kk) => { d.group.position.y = y0 - kk * 0.3; });
        await this.wait(0.4 * speed);
        await lid.break(speed);
        d.group.position.y = y0;
      } else {
        p._hopping = true; // keep layout() from snapping the doll back while it's down the hole
        sound('whoosh');
        await this.tweens.add(0.45 * speed, (kk) => { d.group.position.y = y0 - kk * kk * 6; });
        sound('thud');
        this.shake = 0.4;
        await this.wait(0.7 * speed);
        // up on the rope, sooty and sore
        pay.visible = true; pay.position.copy(rig.home);
        sound('creak');
        await this.tweens.add(0.9 * speed, (kk) => { d.group.position.y = y0 - 6 + kk * 6; pay.position.y = rig.home.y - Math.sin(kk * Math.PI) * 0.4; }, easeInOut);
        d.group.position.y = y0;
        p._hopping = false;
        d.flinch();
      }
      await this.tweens.add(0.3 * speed, (kk) => hole.scale.setScalar(Math.max(0.01, 1 - kk)));
      hole.visible = false;
    } else if (rig.kind === 'dropbear') {
      // drops out of the gum onto their head and has a go at them, then scarpers
      const y0 = pay.position.y, from = pay.position.clone();
      const stop = blocked ? 4.9 : 3.7;
      sound('yell');
      await this.tweens.add(0.4 * speed, (kk) => { pay.position.set(from.x + (local.x - from.x) * kk, y0 + (stop - y0) * kk * kk, from.z + (local.z - from.z) * kk); });
      sound(blocked ? 'clank' : 'thud');
      if (blocked) {
        const bx = local.x + rig.side * 3;
        await Promise.all([lid.break(speed), this.tweens.add(0.6 * speed, (kk) => { pay.position.set(local.x + (bx - local.x) * kk, stop + Math.sin(kk * Math.PI) * 1.4 - (stop - 0.6) * kk, local.z); pay.rotation.z = rig.side * kk * 4; })]);
      } else {
        // clings on and thrashes about
        this.shake = 0.4;
        for (let i = 0; i < 4; i++) { d.flinch(); sound(i % 2 ? 'slap' : 'squawk'); await this.tweens.add(0.18 * speed, (kk) => { pay.rotation.z = Math.sin(kk * Math.PI * 2) * 0.5; pay.position.y = stop + Math.sin(kk * Math.PI) * 0.3; }); }
        const bx = local.x + rig.side * 4;
        await this.tweens.add(0.6 * speed, (kk) => { pay.position.set(local.x + (bx - local.x) * kk, stop + Math.sin(kk * Math.PI) * 1.2 - (stop - 0.6) * kk, local.z); });
      }
      await this.tweens.add(0.4 * speed, (kk) => pay.scale.setScalar(Math.max(0.01, 1 - kk)));
    } else {
      // roll off the plinth, down the ramp, across the space and away down the other side
      const from = pay.position.clone();
      const R = rig.R;
      const edge = new THREE.Vector3(rig.side * 3.2, R, local.z);
      const hit = new THREE.Vector3(local.x + rig.side * (blocked ? R + 1.25 : 0), R, local.z);
      const out = new THREE.Vector3(-rig.side * 8, R, local.z);
      sound('creak');
      await this.tweens.add(0.5 * speed, (kk) => { pay.position.lerpVectors(from, edge, kk); pay.position.y = from.y + (edge.y - from.y) * kk; pay.rotation.z += rig.side * 0.15; }, (kk) => kk * kk);
      await this.tweens.add(0.25 * speed, (kk) => { pay.position.lerpVectors(edge, hit, kk); pay.rotation.z += rig.side * 0.3; });
      sound('slam');
      if (blocked) {
        sound('clank');
        const back = hit.clone().setX(rig.side * 4);
        await Promise.all([lid.break(speed), this.tweens.add(0.6 * speed, (kk) => { pay.position.lerpVectors(hit, back, easeOut(kk)); })]);
      } else {
        const sq = squash();
        await this.tweens.add(0.6 * speed, (kk) => { pay.position.lerpVectors(hit, out, kk); pay.rotation.z += rig.side * 0.3; });
        await sq;
      }
      await this.tweens.add(0.4 * speed, (kk) => pay.scale.setScalar(Math.max(0.01, 1 - kk)));
    }
    pay.visible = false;
    pay.scale.setScalar(1);
    pay.rotation.set(0, 0, 0);
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
