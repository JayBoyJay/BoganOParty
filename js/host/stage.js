// One WebGL renderer for the whole game. The board and each minigame are "views":
// { scene, camera, update(dt) }, and the stage draws whichever one is showing.
import * as THREE from 'three';
import { EffectComposer } from '../../vendor/postprocessing/EffectComposer.js';
import { RenderPass } from '../../vendor/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../../vendor/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../../vendor/postprocessing/OutputPass.js';

export class Stage {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.view = null;
    // bloom makes neon signs, the item's glow and explosions pop; add ?low to the address to turn it off
    this.fancy = !new URLSearchParams(location.search).has('low');
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
    this.resize();
    addEventListener('resize', () => this.resize());
    const loop = () => {
      requestAnimationFrame(loop);
      const dt = Math.min(0.05, this.clock.getDelta());
      if (!this.view) return;
      this.view.update?.(dt);
      if (this.composer) { this.renderPass.scene = this.view.scene; this.renderPass.camera = this.view.camera; this.composer.render(dt); }
      else this.renderer.render(this.view.scene, this.view.camera);
    };
    loop();
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h);
    this.aspect = w / h;
    if (this.view?.camera) { this.view.camera.aspect = this.aspect; this.view.camera.updateProjectionMatrix(); }
  }

  setView(view) {
    this.view = view;
    if (view?.camera) { view.camera.aspect = this.aspect; view.camera.updateProjectionMatrix(); }
  }
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
