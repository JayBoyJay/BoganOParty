// One WebGL renderer for the whole game. The board and each minigame are "views":
// { scene, camera, update(dt) }, and the stage draws whichever one is showing.
import * as THREE from 'three';

export class Stage {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.view = null;
    this.clock = new THREE.Clock();
    this.resize();
    addEventListener('resize', () => this.resize());
    const loop = () => {
      requestAnimationFrame(loop);
      const dt = Math.min(0.05, this.clock.getDelta());
      if (!this.view) return;
      this.view.update?.(dt);
      this.renderer.render(this.view.scene, this.view.camera);
    };
    loop();
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
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
