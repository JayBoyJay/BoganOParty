// Background music: one track at a time, picked at random from the tracks tagged for what's on
// screen ('lobby', 'board' or 'minigame'), crossfading when the scene changes. Tracks and their
// licences live in js/content/music.js; the files go in assets/music/.
import { TRACKS } from '../content/music.js';

const FADE = 1.2; // seconds

export class Music {
  constructor({ volume = 0.35 } = {}) {
    this.volume = volume;
    this.on = true;
    this.scene = null;
    this.audio = null;
    this.track = null;
    this.unlocked = false;
    this.recent = [];
  }

  // browsers only start sound after a click or key press
  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    if (this.scene) this.start(this.scene);
  }

  setOn(on) {
    this.on = on;
    if (!on) this.fadeOut();
    else if (this.scene) this.start(this.scene);
  }

  // switch to music for this scene; keeps the current track if it already fits
  play(scene) {
    if (scene === this.scene && this.audio) return;
    this.scene = scene;
    if (this.track?.scenes.includes(scene) && this.audio && !this.audio.paused) return;
    this.start(scene);
  }

  start(scene) {
    if (!this.on || !this.unlocked) return;
    const pool = TRACKS.filter((t) => t.scenes.includes(scene));
    if (!pool.length) return this.fadeOut();
    const fresh = pool.filter((t) => !this.recent.includes(t.file));
    const list = fresh.length ? fresh : pool;
    const track = list[Math.floor(Math.random() * list.length)];
    this.recent = [track.file, ...this.recent].slice(0, Math.max(0, pool.length - 1));
    this.fadeOut();
    const a = new Audio(track.file);
    a.volume = 0;
    a.onended = () => { if (this.audio === a) this.start(this.scene); }; // next song in the same scene
    a.play().catch(() => {});
    this.fade(a, (track.gain ?? 1) * this.volume);
    this.audio = a;
    this.track = track;
  }

  fadeOut() {
    const a = this.audio;
    this.audio = null;
    this.track = null;
    if (a) this.fade(a, 0, () => a.pause());
  }

  fade(a, to, done) {
    const from = a.volume, t0 = performance.now();
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / 1000 / FADE);
      a.volume = from + (to - from) * k;
      if (k < 1) requestAnimationFrame(step); else done?.();
    };
    step();
  }
}
