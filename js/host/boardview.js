// The 3D board: ground, spaces, paths, landmarks, dolls, the item, and board effects.
import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/GLTFLoader.js';
import { SPACE, mulberry32 } from '../board.js';
import { makeKit, textTexture } from './kit.js';
import { Doll } from './doll.js';
import { Tweens, easeInOut, easeOut } from './stage.js';

const SPACE_R = 1.25;
const iconTex = {};
function spaceIcon(type) {
  if (iconTex[type]) return iconTex[type];
  const text = { shop: '🛒', event: '❗', start: 'GO', red: '−', blue: '+' }[type] || '';
  const tex = textTexture(text, { w: 128, h: 128, bg: null, fg: '#fff', font: type === 'start' ? '900 58px system-ui' : '900 76px system-ui, "Apple Color Emoji", "Segoe UI Emoji"' });
  return (iconTex[type] = tex);
}

export class BoardView {
  constructor(stage, map, board) {
    this.stage = stage; this.map = map; this.board = board;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(48, 16 / 9, 0.5, 900);
    this.tweens = new Tweens();
    this.dolls = new Map();
    this.updaters = [];
    this.camPos = new THREE.Vector3(0, 95, 85);
    this.camLook = new THREE.Vector3(0, 0, 0);
    this.camGoal = { pos: this.camPos.clone(), look: this.camLook.clone() };
    this.camera.position.copy(this.camPos);
    this.build();
  }

  pos(idx) { const n = this.board.nodes[idx]; return new THREE.Vector3(n.x, 0.3, n.z); }

  build() {
    const { look } = this.map;
    const s = this.scene;
    s.background = new THREE.Color(look.sky);
    s.fog = new THREE.Fog(look.fog, 110, 320);
    s.add(new THREE.HemisphereLight(0xffffff, look.ground, 1.1));
    const sun = new THREE.DirectionalLight(look.sun, 2.2);
    sun.position.set(40, 80, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90, far: 250 });
    s.add(sun);

    const ground = new THREE.Mesh(new THREE.CircleGeometry(400, 64), new THREE.MeshStandardMaterial({ color: look.ground, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
    s.add(ground);

    const kit = makeKit(s);
    this.kit = kit;
    // paths between spaces
    const pathMat = new THREE.MeshStandardMaterial({ color: look.path, roughness: 0.9 });
    for (const n of this.board.nodes) for (const j of n.next) {
      const a = this.pos(n.idx), b = this.pos(j);
      const len = a.distanceTo(b);
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.12, len), pathMat);
      m.position.copy(a).add(b).multiplyScalar(0.5).setY(0.06);
      m.lookAt(b.x, 0.06, b.z);
      m.receiveShadow = true;
      s.add(m);
      // little arrow so the one-way direction is obvious
      const arr = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 3), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }));
      arr.position.copy(a).lerp(b, 0.5).setY(0.2);
      arr.lookAt(b.x, 0.2, b.z); arr.rotateX(Math.PI / 2);
      s.add(arr);
    }
    // spaces
    for (const n of this.board.nodes) {
      const col = SPACE[n.type]?.color ?? 0xffffff;
      const g = new THREE.Group();
      g.position.set(n.x, 0, n.z);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(SPACE_R, SPACE_R * 1.08, 0.3, 32), new THREE.MeshStandardMaterial({ color: col, roughness: 0.4, emissive: col, emissiveIntensity: 0.15 }));
      disc.position.y = 0.15; disc.castShadow = true; disc.receiveShadow = true;
      g.add(disc);
      const icon = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: spaceIcon(n.type), transparent: true, depthWrite: false }));
      icon.rotation.x = -Math.PI / 2; icon.position.y = 0.31;
      g.add(icon);
      s.add(g);
    }
    // landmarks: a .glb model if the map names one, otherwise the built-in placeholder
    const loader = new GLTFLoader();
    for (const lm of this.map.landmarks || []) {
      const g = kit.group(lm.x, 0, lm.z, lm.rot || 0, lm.scale || 1);
      if (lm.glb) {
        loader.load(lm.glb, (gltf) => { gltf.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); g.add(gltf.scene); },
          undefined, () => lm.build?.(kit, g));
      } else lm.build?.(kit, g);
      if (g.userData.spin) this.updaters.push((dt) => { g.userData.spin.rotation.x += dt * 1.5; });
      if (g.userData.bob) { const b = g.userData.bob, x0 = b.position.x; let t = 0; this.updaters.push((dt) => { t += dt; b.position.x = x0 + Math.sin(t * 0.2) * 20; b.position.y = 0.2 + Math.sin(t * 2) * 0.05; }); }
    }
    this.map.scatter?.(kit, mulberry32(7));

    // the item: model + light pillar so it can be spotted from anywhere
    this.item = new THREE.Group();
    const model = this.map.item.build(kit);
    model.position.y = 2.2;
    this.item.add(model);
    this.itemModel = model;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 60, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff1a0, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    pillar.position.y = 30;
    this.item.add(pillar);
    const glow = new THREE.PointLight(0xffe08a, 30, 14);
    glow.position.y = 2.5;
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
      if (!this.dolls.has(p.id)) { const d = new Doll(p); this.dolls.set(p.id, d); this.scene.add(d.group); }
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
  followNow(v) { this.camGoal.look.set(v.x, 0, v.z); this.camGoal.pos.set(v.x, 12, v.z + 15); }
  overview() { this.camGoal.look.set(0, 0, 0); this.camGoal.pos.set(0, 95, 85); }

  // ---------- aiming ----------
  highlight(spaces, color = 0xff4fd8, cursor = null) {
    for (const r of this.rings) this.scene.remove(r);
    this.rings = [];
    if (!spaces) return;
    for (const idx of spaces) {
      const m = new THREE.Mesh(new THREE.RingGeometry(SPACE_R * 1.1, SPACE_R * 1.45, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: idx === cursor ? 1 : 0.6, side: THREE.DoubleSide, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.position.copy(this.pos(idx)).setY(0.4);
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
