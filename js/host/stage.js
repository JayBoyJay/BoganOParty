// One WebGL renderer for the whole game. The board and each minigame are "views":
// { scene, camera, update(dt) }, and the stage draws whichever one is showing.
import * as THREE from 'three';
import { EffectComposer } from '../../vendor/postprocessing/EffectComposer.js';
import { RenderPass } from '../../vendor/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../../vendor/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../../vendor/postprocessing/OutputPass.js';

// Frames are drawn at about 1080p at most: a 4K TV upscales that fine and it's a quarter of the pixels.
// Add ?fullres to the address to draw every pixel anyway.
const MAX_PIXELS = 1920 * 1080 * 1.1;

export class Stage {
  constructor(canvas) {
    const qp = new URLSearchParams(location.search);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: false });
    this.renderer.info.autoReset = false; // bloom draws several passes; count the whole frame
    this.fullRes = qp.has('fullres');
    this.scale = 1; // drops when the TV can't keep up (see adapt), climbs back when it can
    this.keep = new Set(); // scenes that live all game (the board, the standings), never disposed
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.view = null;
    // bloom makes neon signs, the item's glow and explosions pop; add ?low to the address to turn it off
    this.fancy = !qp.has('low');
    if (this.fancy) {
      this.composer = new EffectComposer(this.renderer, new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 4 }));
      this.renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
      // only things brighter than white bloom (neon, lamps, the item's glow), so sunlit walls stay crisp
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.28, 0.4, 2.2);
      this.composer.addPass(this.renderPass);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
    }
    this.clock = new THREE.Clock();
    this.perf = { t: 0, n: 0, good: 0, cool: 0, fps: 0 };
    this.adaptive = !qp.has('fixedres');
    if (qp.has('fps')) this.fpsBox = Object.assign(document.body.appendChild(document.createElement('div')), { className: 'fps-box' });
    this.resize();
    addEventListener('resize', () => this.resize());
    const loop = () => {
      requestAnimationFrame(loop);
      const raw = this.clock.getDelta(), dt = Math.min(0.05, raw);
      if (!this.view) return;
      this.view.update?.(dt);
      this.renderer.info.reset();
      if (this.composer) { this.renderPass.scene = this.view.scene; this.renderPass.camera = this.view.camera; this.composer.render(dt); }
      else this.renderer.render(this.view.scene, this.view.camera);
      this.adapt(raw);
    };
    loop();
  }

  // Dynamic resolution: average the frame time over 1.5 s; under ~42 fps draw 10% fewer pixels a side,
  // and after 6 s of smooth 60 creep back up. The 1.5 s after a scene change (building it, compiling its
  // shaders) and any gap over a second (a hidden tab) don't count.
  adapt(dt) {
    const f = this.perf;
    if (dt > 1) return;
    f.t += dt; f.n++;
    if (f.t < 1.5) return;
    const ms = f.t * 1000 / f.n;
    f.fps = Math.round(f.n / f.t); f.t = 0; f.n = 0;
    if (f.cool > 0) f.cool--;
    else if (this.adaptive && ms > 24 && this.scale > 0.55) { this.scale = Math.max(0.55, this.scale - 0.1); f.good = 0; f.cool = 1; this.resize(); }
    else if (this.adaptive && ms < 17.5 && this.scale < 1) { if (++f.good >= 4) { this.scale = Math.min(1, this.scale + 0.05); f.good = 0; this.resize(); } }
    else f.good = 0;
    if (this.fpsBox) {
      const r = this.renderer, px = r.getDrawingBufferSize(new THREE.Vector2()), m = r.info.memory;
      this.fpsBox.textContent = `${f.fps} fps · ${px.x}×${px.y} (${this.scale.toFixed(2)}) · ${r.info.render.calls} draws · ${m.geometries} geo · ${m.textures} tex · ${r.info.programs.length} shaders`;
    }
  }

  // the pixel ratio for this window: the screen's own (max 2), cut to stay near 1080p, times the dynamic scale
  pixelRatio(w, h) {
    let pr = Math.min(2, window.devicePixelRatio || 1);
    if (!this.fullRes) pr = Math.min(pr, Math.sqrt(MAX_PIXELS / (w * h)));
    return pr * this.scale;
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    const pr = this.pixelRatio(w, h);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.composer?.setPixelRatio(pr);
    this.composer?.setSize(w, h);
    this.aspect = w / h;
    if (this.view?.camera) { this.view.camera.aspect = this.aspect; this.view.camera.updateProjectionMatrix(); }
  }

  setView(view) {
    this.view = view;
    this.perf.t = 0; this.perf.n = 0; this.perf.cool = 1; // a new scene's first frames (shader compiles) don't count
    if (view?.camera) { view.camera.aspect = this.aspect; view.camera.updateProjectionMatrix(); }
  }

  // a scene that lives all game; disposeScene leaves anything it uses alone
  persist(scene) { this.keep.add(scene); }
  // done with a kept scene (the lobby fly-over, a finished game's board): free it
  release(scene) { if (this.keep.delete(scene)) this.disposeScene(scene); }

  // Free the GPU memory a finished scene holds: geometries, materials, textures (incl. shadow maps and
  // the environment map) and the shader programs only it used. Anything a kept scene also uses stays.
  disposeScene(scene, extra = []) {
    const keep = new Set();
    for (const k of this.keep) collect(k, keep);
    const mine = new Set();
    collect(scene, mine);
    for (const r of extra) if (r) mine.add(r);
    for (const r of mine) if (!keep.has(r)) r.dispose();
  }
}

// every disposable thing a scene uses: geometries, materials, textures (incl. ones inside shader
// uniforms), light shadow maps, and the scene's background and environment
function collect(scene, out) {
  const tex = (v) => { if (v?.isTexture) out.add(v); };
  const mat = (m) => {
    if (!m || out.has(m)) return;
    out.add(m);
    for (const v of Object.values(m)) tex(v);
    if (m.uniforms) for (const u of Object.values(m.uniforms)) { tex(u?.value); if (Array.isArray(u?.value)) u.value.forEach(tex); }
  };
  tex(scene.background); tex(scene.environment);
  scene.traverse((o) => {
    if (o.geometry) out.add(o.geometry);
    [].concat(o.material || []).forEach(mat);
    mat(o.customDepthMaterial); mat(o.customDistanceMaterial);
    if (o.isLight && o.shadow?.map) out.add(o.shadow.map);
  });
}

// Small tween helper shared by views: tweens.add(seconds, (k) => {...}) returns a promise.
export class Tweens {
  constructor() { this.list = []; }
  add(dur, fn, ease = (k) => k) {
    return new Promise((resolve) => this.list.push({ t: 0, dur: Math.max(0.001, dur), fn, ease, resolve }));
  }
  update(dt) {
    for (const tw of [...this.list]) {
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.dur);
      tw.fn(tw.ease(k));
      if (k >= 1) { this.list.splice(this.list.indexOf(tw), 1); tw.resolve(); }
    }
  }
}
export const easeInOut = (k) => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
export const easeOut = (k) => 1 - Math.pow(1 - k, 3);
