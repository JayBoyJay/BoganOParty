// Background music, played live on the same Web Audio synth as the sound effects (js/host/sfx.js).
// Songs live in js/content/music.js. One plays at a time, picked from the songs tagged for what's on
// screen ('lobby', 'board' or 'minigame'), crossfading when the scene changes and moving on to
// another song in the same scene after a couple of minutes.
//
// A small look-ahead scheduler queues the next fraction of a second of notes on the audio clock,
// so timing stays tight even when a minigame makes a frame run long.
import { SONGS } from '../content/music.js';

const FADE = 1.5;          // crossfade, seconds
const SONG_MINUTES = 2.5;  // then the next song for the same scene
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], minorPent: [0, 3, 5, 7, 10], majorPent: [0, 2, 4, 7, 9] };
const hz = (m) => 440 * 2 ** ((m - 69) / 12);
const pcOf = (name) => (NOTE[name[0]] + (name[1] === '#' ? 1 : name[1] === 'b' ? -1 : 0) + 12) % 12;

// 'Am' → { root: 9, tones: [0, 3, 7] } (semitones above the root)
function parseChord(c) {
  const root = pcOf(c), q = c.slice(/[#b]/.test(c[1] || '') ? 2 : 1);
  const tones = q === '5' ? [0, 7] : q.startsWith('m') ? [0, 3, 7] : [0, 4, 7];
  if (q.endsWith('7')) tones.push(q.startsWith('maj') ? 11 : 10);
  return { root, tones, third: tones[1] === 7 ? 7 : tones[1] };
}

// a small seeded random, so a song's tune can be rebuilt the same way
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// Makes up a tune over 8 bars: a 2-bar rhythm that repeats, chord tones on the strong beats, small
// steps in between, ending on the key note. Returns [bar][step] = { m (MIDI), len (steps) } or null.
function makeTune(song, chords, seed) {
  const r = rng(seed), d = song.lead.density, [lo, hi] = song.lead.range;
  const key = pcOf(song.key), scale = SCALES[song.scale];
  const notes = []; for (let m = lo; m <= hi; m++) if (scale.includes((m - key + 12) % 12)) notes.push(m);
  const rhythm = [];
  for (let s = 0; s < 32; s++) {
    const p = s % 8 === 0 ? 0.9 : s % 4 === 0 ? 0.25 + 0.6 * d : s % 2 === 0 ? 0.55 * d : 0.12 * d;
    if (r() < p) rhythm.push(s);
  }
  if (!rhythm.includes(0)) rhythm.unshift(0);
  const bars = chords.length, tune = Array.from({ length: bars }, () => Array(16).fill(null));
  let i = Math.floor(notes.length / 2);
  for (let b = 0; b < bars; b += 2) {
    const steps = b + 2 >= bars ? rhythm.filter((s) => s < 24).concat(24) : rhythm; // last phrase: land and hold
    steps.forEach((s, k) => {
      const bar = b + Math.floor(s / 16), ch = chords[bar % bars];
      if (s % 8 === 0) { // strong beat: nearest chord tone
        const tones = notes.map((m, j) => [m, j]).filter(([m]) => ch.tones.some((t) => (ch.root + t) % 12 === m % 12));
        tones.sort((a, c) => Math.abs(a[1] - i) - Math.abs(c[1] - i));
        i = tones[r() < 0.7 || tones.length < 2 ? 0 : 1][1];
      } else {
        const toward = i < notes.length * 0.3 ? 1 : i > notes.length * 0.7 ? -1 : r() < 0.5 ? 1 : -1;
        i = Math.max(0, Math.min(notes.length - 1, i + toward * (r() < 0.7 ? 1 : 2)));
      }
      let m = notes[i];
      if (b + 2 >= bars && s === 24) { // final note: the key's root nearest where we are
        m = notes.filter((n) => n % 12 === key).sort((a, c) => Math.abs(a - m) - Math.abs(c - m))[0] ?? m;
      }
      const next = steps[k + 1] ?? 32, len = Math.min(s === 24 && b + 2 >= bars ? 8 : 6, next - s);
      tune[bar][s % 16] = { m, len };
    });
  }
  return tune;
}

export class Music {
  constructor(sfx, { volume = 0.4 } = {}) {
    Object.assign(this, { sfx, volume });
    this.on = true; this.scene = null; this.cur = null; this.unlocked = false; this.recent = []; this.timer = null;
  }

  get ctx() { return this.sfx.ctx; }

  // browsers only start sound after a click or key press
  unlock() {
    this.sfx.unlock();
    if (this.unlocked || !this.ctx) return;
    this.unlocked = true;
    const c = this.ctx, comp = c.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 3; comp.connect(c.destination);
    this.master = c.createGain(); this.master.gain.value = this.volume; this.master.connect(comp);
    if (this.scene) this.start(this.scene);
  }

  setOn(on) {
    this.on = on;
    if (!on) this.stop();
    else if (this.scene) this.start(this.scene);
  }

  // switch to music for this scene; keeps the current song if it already fits
  play(scene) {
    if (scene === this.scene && this.cur) return;
    this.scene = scene;
    if (this.cur?.song.scenes.includes(scene) && !this.cur.preview) return;
    this.start(scene);
  }

  start(scene) {
    if (!this.on || !this.unlocked) return;
    const pool = SONGS.filter((s) => s.scenes.includes(scene));
    if (!pool.length) return this.stop();
    const fresh = pool.filter((s) => !this.recent.includes(s.id) && s !== this.cur?.song);
    const list = fresh.length ? fresh : pool;
    const song = list[Math.floor(Math.random() * list.length)];
    this.recent = [song.id, ...this.recent].slice(0, Math.max(0, pool.length - 1));
    this.playSong(song);
  }

  // the sound board plays a song by id, whatever the scene
  preview(id) {
    if (!this.unlocked) this.unlock();
    const song = SONGS.find((s) => s.id === id);
    if (song && this.master) { this.playSong(song); this.cur.preview = true; }
  }

  playSong(song, at = null) {
    const c = this.ctx;
    this.stop();
    const t = at ?? c.currentTime + 0.05, g = song.gain ?? 1;
    const dry = c.createGain(), wet = c.createGain();
    dry.gain.setValueAtTime(0.0001, t); dry.gain.linearRampToValueAtTime(g, t + (at == null ? FADE : 0.01));
    wet.gain.setValueAtTime(0.0001, t); wet.gain.linearRampToValueAtTime(g * 0.7, t + (at == null ? FADE : 0.01));
    dry.connect(this.master); wet.connect(this.sfx.verbIn);
    const chords = song.chords.map(parseChord), seed = Math.floor(Math.random() * 1e9);
    this.cur = {
      song, chords, bus: { dry, wet }, step: 0, next: t, t0: t, dur: 60 / song.bpm / 4,
      tunes: [makeTune(song, chords, seed), makeTune(song, chords, seed + 7)],
      bars: Math.max(16, Math.round(SONG_MINUTES * song.bpm / 4 / 16) * 16),
    };
    if (!this.timer && typeof setInterval === 'function' && at == null) this.timer = setInterval(() => this.pump(), 50);
  }

  stop() {
    const cur = this.cur; this.cur = null;
    if (!cur) return;
    const c = this.ctx, t = c.currentTime;
    for (const g of [cur.bus.dry, cur.bus.wet]) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0.0001, t + FADE); }
    setTimeout(() => { cur.bus.dry.disconnect(); cur.bus.wet.disconnect(); }, (FADE + 1) * 1000);
  }

  // queue every note that starts before `until` (audio-clock seconds); runs on a timer
  pump(until = this.ctx.currentTime + (document.hidden ? 1.5 : 0.3)) {
    const S = this.cur;
    if (!S) { clearInterval(this.timer); this.timer = null; return; }
    while (S.next < until) {
      const bar = Math.floor(S.step / 16);
      if (bar >= S.bars && !S.preview && this.scene) { this.start(this.scene); return; }
      this.sfx.withBus(S.bus, () => this.playStep(S, S.step, S.next));
      S.next += S.dur; S.step++;
    }
  }

  // ---- Mr Music Maa'm: a player's phone keyboard ------------------------------------------
  // Note n (0-7, low to high) in the current song's key, landed on the next 16th so it sits in time.
  // voice (0..) picks one of a few bell/keys sounds so two players on the keys sound different.
  playerNote(n, voice = 0) {
    if (!this.unlocked || !this.master) return;
    const c = this.ctx, S = this.cur, song = S?.song;
    const key = pcOf(song?.key || 'C'), scale = SCALES[song?.scale || 'majorPent'];
    const notes = []; for (let m = 60 + key; notes.length < 8; m++) if (scale.includes((m - 60 - key + 120) % 12)) notes.push(m);
    const f = hz(notes[Math.max(0, Math.min(7, n | 0))]);
    let t = c.currentTime + 0.02;
    if (S) t = S.t0 + Math.ceil((t - S.t0) / S.dur) * S.dur;
    if (!this.keysBus) {
      const dry = c.createGain(), wet = c.createGain(); dry.gain.value = 1; wet.gain.value = 0.8;
      dry.connect(this.master); wet.connect(this.sfx.verbIn); this.keysBus = { dry, wet };
    }
    const sfx = this.sfx;
    sfx.withBus(this.keysBus, () => {
      switch (voice % 4) {
        case 0: sfx.fm({ when: t, f, ratio: 2, index: 1.2, d: 0.6, vol: 0.12, verb: 0.3 }); break; // electric piano
        case 1: sfx.osc({ when: t, type: 'square', f, hold: 0.12, d: 0.15, vol: 0.05, filt: 'lowpass', ff: 3200, vib: [6, f * 0.006], verb: 0.2 }); break; // chip lead
        case 2: sfx.fm({ when: t, f: f * 2, ratio: 3.5, index: 1.6, d: 0.5, vol: 0.08, verb: 0.35 }); break; // glockenspiel
        default: sfx.osc({ when: t, type: 'sawtooth', f, a: 0.01, hold: 0.15, d: 0.2, vol: 0.05, filt: 'lowpass', ff: 2400, ff2: 900, verb: 0.25 }); // synth brass
      }
    });
  }

  // ---- one 16th note of the song ----------------------------------------------------------
  playStep(S, step, t0) {
    const { song } = S, s = step % 16, bar = Math.floor(step / 16), n = song.chords.length;
    const ch = S.chords[bar % n], dur = S.dur;
    const t = t0 + (s % 4 === 2 ? song.swing * dur : 0);
    const section = Math.floor(bar / n) % 4; // 0: no tune, 1: tune A, 2: tune B, 3: tune A
    const lastBar = bar % n === n - 1, sfx = this.sfx;
    const O = (o) => sfx.osc({ ...o, when: t }), N = (o) => sfx.noise({ ...o, when: t });
    const at = (str) => str && str[s] !== '.' && str[s] !== '-' ? str[s] : null;

    // drums, with a snare fill into each new section
    const D = song.drums;
    if (bar % n === 0 && s === 0 && bar > 0) N({ filt: 'highpass', ff: 5000, d: 1.2, vol: 0.06, verb: 0.3 }); // crash
    if (at(D.kick)) O({ f: 150, f2: 45, glide: 0.08, d: 0.22, vol: 0.5 });
    const fill = lastBar && s >= 12 && song.bpm < 145 ? true : lastBar && s >= 12 && s % 2 === 0;
    if (at(D.snare) || fill) { N({ filt: 'bandpass', ff: 1800, q: 0.8, d: 0.12, vol: fill && !at(D.snare) ? 0.14 : 0.24 }); O({ type: 'triangle', f: 190, d: 0.06, vol: 0.08 }); }
    const h = at(D.hat);
    if (h) N({ filt: 'highpass', ff: 8000, d: h === 'o' ? 0.16 : 0.03, vol: s % 4 === 0 ? 0.08 : 0.055 });

    // bass
    const b = at(song.bass);
    if (b) {
      let root = 36 + ch.root; if (root < 40) root += 12;
      const m = root + ({ R: 0, 3: ch.third, 5: 7, 8: 12 }[b] ?? 0);
      let len = 1; while (s + len < 16 && '.-'.includes(song.bass[s + len]) && len < 4) len++;
      const L = len * dur;
      O({ type: 'sawtooth', f: hz(m), a: 0.005, hold: L * 0.6, d: L * 0.5, vol: 0.1, filt: 'lowpass', ff: 900, ff2: 250, fglide: L });
      O({ f: hz(m), a: 0.005, hold: L * 0.6, d: L * 0.5, vol: 0.09 });
    }

    // chords
    if (at(song.comp.rhythm)) this.comp(song.comp.inst, ch, t, dur);

    // tune
    const note = section % 2 === 1 || section === 2 ? S.tunes[section === 2 ? 1 : 0][bar % n][s] : null;
    if (note) this.lead(song.lead.inst, hz(note.m), note.len * dur, t);
  }

  comp(inst, ch, t, dur) {
    const sfx = this.sfx, notes = ch.tones.map((x) => { let m = 48 + ((ch.root + x) % 12); if (m < 52) m += 12; return m; }).sort((a, b) => a - b);
    const O = (o) => sfx.osc({ ...o, when: t + (o.dt || 0) });
    switch (inst) {
      case 'keys': // a soft organ
        for (const m of notes) { O({ type: 'triangle', f: hz(m), a: 0.02, hold: dur * 3, d: 0.25, vol: 0.035, vib: [5, 1.5] }); O({ f: hz(m + 12), a: 0.02, hold: dur * 3, d: 0.2, vol: 0.012 }); }
        break;
      case 'pluck':
        for (const m of notes) O({ type: 'square', f: hz(m), d: 0.14, vol: 0.022, filt: 'lowpass', ff: 3000, ff2: 600 });
        break;
      case 'strum': // an acoustic-ish strum, low string first
        notes.concat(notes[0] + 12).forEach((m, k) => O({ type: 'sawtooth', f: hz(m), dt: k * 0.012, d: 0.35, vol: 0.018, filt: 'lowpass', ff: 2600, ff2: 900, verb: 0.15 }));
        break;
      case 'power': { // palm-muted distorted power chord
        const r = notes.find((m) => (m - ch.root) % 12 === 0) ?? notes[0];
        for (const m of [r - 12, r - 5, r]) O({ type: 'sawtooth', f: hz(m), d: dur * 1.4, vol: 0.03, drive: true, filt: 'lowpass', ff: 1500, q: 1.2 });
        break;
      }
      case 'trem': // surf guitar tremolo picking, two bars' worth
        for (const m of notes) O({ type: 'sawtooth', f: hz(m), a: 0.01, hold: dur * 7, d: 0.3, vol: 0.022, filt: 'lowpass', ff: 2000, am: [16, 0.9], verb: 0.45 });
        break;
    }
  }

  lead(inst, f, L, t) {
    const O = (o) => this.sfx.osc({ ...o, when: t });
    switch (inst) {
      case 'whistle': O({ type: 'triangle', f, a: 0.03, hold: L * 0.75, d: 0.12, vol: 0.085, vib: [5.5, f * 0.008], verb: 0.35 }); O({ f: f * 2, a: 0.03, hold: L * 0.75, d: 0.1, vol: 0.01 }); break;
      case 'chip': O({ type: 'square', f, a: 0.005, hold: L * 0.7, d: 0.08, vol: 0.03, filt: 'lowpass', ff: 3000, vib: [6, f * 0.005], verb: 0.15 }); break;
      case 'twang': O({ type: 'sawtooth', f: f * 0.97, path: [[0.04, f]], a: 0.003, hold: L * 0.4, d: L * 0.6 + 0.15, vol: 0.06, filt: 'lowpass', ff: 3200, ff2: 900, fglide: L, verb: 0.2 }); break;
      case 'rock': O({ type: 'sawtooth', f, a: 0.006, hold: L * 0.85, d: 0.12, vol: 0.026, drive: true, filt: 'lowpass', ff: 2400, vib: [6, f * 0.012], verb: 0.2 }); break;
      case 'surf': O({ type: 'sawtooth', f, a: 0.006, hold: L * 0.8, d: 0.18, vol: 0.05, filt: 'lowpass', ff: 2200, am: [12, 0.45], verb: 0.55 }); break;
    }
  }
}
