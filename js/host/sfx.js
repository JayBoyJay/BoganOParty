// Synthesised sound effects (no audio files needed). Real sounds can replace these later:
// drop files in assets/sfx/ and map them in FILES below.
//
// Everything is built from a few Web Audio voices: osc (one oscillator), noise (filtered white noise),
// fm (a two-operator bell/metal tone) and voice (a sawtooth through two vowel formants, for the
// animals and the blokes yelling). Each voice gets an envelope, optional filter sweep, vibrato,
// tremolo and a send to a shared room reverb. All of it runs through one compressor so eight
// players mashing at once doesn't clip the TV.
//
// play(name) is the only thing the game calls; /sfx-lab.html plays every sound in the list.
const FILES = {}; // e.g. { boom: 'assets/sfx/boom.mp3' }

const rnd = (a, b) => a + Math.random() * (b - a);
// first two formants of a few vowels, in Hz
const VOWEL = { a: [800, 1250], e: [520, 1850], eh: [620, 1700], i: [300, 2300], o: [470, 820], u: [350, 700], ah: [720, 1100] };

// The shortest gap between two of the same sound (seconds). Stops eight phones' worth of ticks,
// bonks and whooshes in the same frame stacking into one loud crunch.
const GAP = { tick: 0.03, step: 0.04, clack: 0.03, bonk: 0.045, whoosh: 0.06, swing: 0.05, coin: 0.04, squeak: 0.05, thud: 0.05, tiptoe: 0.05, pour: 0.15, reel: 0.1, slap: 0.04, punch: 0.04, hat: 0.02, trim: 0.05, lose: 0.12, boing: 0.05, shot: 0.04, crash: 0.06, lego: 0.06 };

// Loudness trims, set by rendering each sound offline and evening them out: clicks sit low, normal
// feedback in the middle, explosions and crowds on top. Raise or lower one here rather than in its recipe.
const TRIM = {
  yell: 0.4, baa: 0.4, meow: 0.4, oi: 0.7, thud: 0.7, kick: 0.45, deflate: 0.75, snare: 1.3,
  squeak: 5, tick: 2.5, clack: 1.5, slap: 1.3, swing: 2.5, tiptoe: 3, snort: 2, magpie: 1.6, squawk: 1.5,
  creak: 3, ko: 1.8, miss: 2, lego: 1.6, shot: 1.8, boost: 1.5, coins: 1.6, plop: 2, reel: 1, clank: 1.4, hat: 1.4, coin: 1.3,
};

// Every sound the game knows, grouped for /sfx-lab.html (the comment says where it's heard).
export const SOUNDS = {
  board: ['tick', 'step', 'clack', 'dice', 'coin', 'lose', 'item', 'shop', 'event', 'go', 'beep', 'fanfare'],
  powerups: ['flip', 'boom', 'bigboom', 'hallelujah', 'vacuum', 'teleport'],
  bodies: ['boing', 'squeak', 'bonk', 'thud', 'slap', 'punch', 'slam', 'swing', 'whoosh', 'deflate', 'ko', 'miss', 'tiptoe'],
  voices: ['oi', 'yell', 'snore', 'snort', 'baa', 'bark', 'meow', 'magpie', 'squawk', 'crowd'],
  things: ['creak', 'kick', 'snare', 'hat', 'clank', 'lego', 'crash', 'shot', 'gunshot', 'horn', 'boost', 'takeoff', 'trim', 'pour', 'whistle', 'cheers', 'coins', 'ding', 'buzz'],
  water: ['splash', 'plop', 'reel', 'snap'],
};

export class Sfx {
  constructor() { this.ctx = null; this.on = true; this.buffers = {}; this.last = {}; this.voices = 0; }

  unlock() {
    if (this.ctx) { this._wake(); return; }
    let ctx;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    this.attach(ctx);
    for (const [k, url] of Object.entries(FILES)) fetch(url).then((r) => r.arrayBuffer()).then((b) => this.ctx.decodeAudioData(b)).then((buf) => { this.buffers[k] = buf; }).catch(() => {});
  }

  // builds the shared mixer on an AudioContext (an OfflineAudioContext works too, for tests)
  attach(ctx) {
    const c = (this.ctx = ctx);
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
    comp.connect(c.destination);
    this.out = c.createGain(); this.out.gain.value = 0.85; this.out.connect(comp);
    // a small room: decaying stereo noise, darker as it fades
    const len = Math.floor(c.sampleRate * 1.6), ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch); let lp = 0;
      for (let i = 0; i < len; i++) { const k = i / len; lp += ((Math.random() * 2 - 1) - lp) * (0.9 - 0.75 * k); d[i] = lp * Math.exp(-k * 5); }
    }
    this.verbIn = c.createConvolver(); this.verbIn.buffer = ir;
    const wet = c.createGain(); wet.gain.value = 0.45; this.verbIn.connect(wet).connect(this.out);
    const nlen = c.sampleRate * 2; this.noiseBuf = c.createBuffer(1, nlen, c.sampleRate);
    const nd = this.noiseBuf.getChannelData(0); for (let i = 0; i < nlen; i++) nd[i] = Math.random() * 2 - 1;
    this.curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) this.curve[i] = Math.tanh((i / 511.5 - 1) * 3);
  }

  _wake() { if (this.ctx.state === 'suspended' && this.ctx.resume) this.ctx.resume().catch(() => {}); }

  // ---- voices -------------------------------------------------------------------------------
  // shared options: at (delay, s), a (attack), hold, d (decay), vol, verb (reverb send 0..1),
  // filt/ff/ff2/fpath/q (filter type, start freq, end freq or [[t, f], ...] path, Q),
  // am: [rate, depth, endRate, 'square'] tremolo, drive (soft clip)

  _t(at) { return this.ctx.currentTime + 0.01 + (at || 0); }
  _end(o, t) { return t + (o.a ?? 0.004) + (o.hold || 0) + (o.d ?? 0.2); }

  // a frequency-ish param: f, then either a path of [time, value] (linear) or an exponential slide to f2
  _path(param, t, f, f2, glide, path, end) {
    param.setValueAtTime(f, t);
    if (path) for (const [dt, v] of path) param.linearRampToValueAtTime(v, t + dt);
    else if (f2 != null) param.exponentialRampToValueAtTime(Math.max(1, f2), Math.min(end, t + (glide ?? end - t)));
  }

  _env(param, t, o) {
    const a = o.a ?? 0.004, hold = o.hold || 0, d = o.d ?? 0.2, vol = o.vol ?? 0.1;
    param.setValueAtTime(0.0001, t);
    param.linearRampToValueAtTime(vol, t + a);
    if (hold) param.setValueAtTime(vol, t + a + hold);
    param.exponentialRampToValueAtTime(0.0001, t + a + hold + d);
  }

  _track(src) { this.voices++; src.onended = () => { this.voices--; }; }

  _lfo(t, end, rate, rate2, type = 'sine') {
    const l = this.ctx.createOscillator(); l.type = type;
    l.frequency.setValueAtTime(rate, t); if (rate2) l.frequency.linearRampToValueAtTime(rate2, end);
    l.start(t); l.stop(end + 0.05); return l;
  }

  // src → drive → filter → envelope → tremolo → the play's dry bus (+ reverb send)
  _chain(src, o, t, end) {
    const c = this.ctx; let head = src;
    const link = (n) => { head.connect(n); head = n; return n; };
    if (o.drive) { const w = c.createWaveShaper(); w.curve = this.curve; link(w); }
    if (o.filt) {
      const fl = link(c.createBiquadFilter()); fl.type = o.filt; fl.Q.value = o.q ?? 1;
      this._path(fl.frequency, t, o.ff, o.ff2, o.fglide, o.fpath, end);
    }
    const g = link(c.createGain()); this._env(g.gain, t, o);
    if (o.am) {
      const [rate, depth, rate2, type] = o.am, a = link(c.createGain()); a.gain.value = 1 - depth / 2;
      const lg = c.createGain(); lg.gain.value = depth / 2; this._lfo(t, end, rate, rate2, type).connect(lg).connect(a.gain);
    }
    head.connect(this.bus.dry);
    if (o.verb) { const s = c.createGain(); s.gain.value = o.verb; head.connect(s).connect(this.bus.wet); }
  }

  _vib(param, t, end, vib) {
    if (!vib) return;
    const [rate, depth, endDepth] = vib, lg = this.ctx.createGain();
    lg.gain.setValueAtTime(depth, t); if (endDepth != null) lg.gain.linearRampToValueAtTime(endDepth, end);
    this._lfo(t, end, rate).connect(lg).connect(param);
  }

  osc(o) {
    const c = this.ctx, t = this._t(o.at), end = this._end(o, t), s = c.createOscillator();
    s.type = o.type || 'sine'; if (o.detune) s.detune.value = o.detune;
    this._path(s.frequency, t, o.f, o.f2, o.glide, o.path, end);
    this._vib(s.frequency, t, end, o.vib);
    this._chain(s, o, t, end); s.start(t); s.stop(end + 0.03); this._track(s);
  }

  noise(o) {
    const c = this.ctx, t = this._t(o.at), end = this._end(o, t), s = c.createBufferSource();
    s.buffer = this.noiseBuf; s.loop = true;
    this._chain(s, o, t, end); s.start(t, rnd(0, 1.8)); s.stop(end + 0.03); this._track(s);
  }

  // two-operator FM: ratio sets how metallic (whole numbers = bell-ish, odd decimals = clanky)
  fm(o) {
    const c = this.ctx, t = this._t(o.at), end = this._end(o, t);
    const car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain();
    car.frequency.setValueAtTime(o.f, t); mod.frequency.setValueAtTime(o.f * (o.ratio ?? 2), t);
    mg.gain.setValueAtTime(o.f * (o.index ?? 2), t);
    mg.gain.exponentialRampToValueAtTime(Math.max(1, o.f * (o.index ?? 2) * 0.05), t + (o.a ?? 0.004) + (o.d ?? 0.2) * 0.7);
    mod.connect(mg).connect(car.frequency);
    this._chain(car, o, t, end);
    car.start(t); mod.start(t); car.stop(end + 0.03); mod.stop(end + 0.03); this._track(car);
  }

  // a sawtooth through two bandpass formants; vowels: [[time, 'o'], [time, 'i'], ...]
  voice(o) {
    const c = this.ctx, t = this._t(o.at), end = this._end(o, t), s = c.createOscillator();
    s.type = o.wave || 'sawtooth';
    this._path(s.frequency, t, o.f, o.f2, o.glide, o.path, end);
    this._vib(s.frequency, t, end, o.vib);
    const mix = c.createGain(), vs = o.vowels || [[0, 'a']];
    [0, 1].forEach((k) => {
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = k ? 9 : 6;
      bp.frequency.setValueAtTime(VOWEL[vs[0][1]][k], t);
      for (const [dt, v] of vs.slice(1)) bp.frequency.linearRampToValueAtTime(VOWEL[v][k], t + dt);
      const lv = c.createGain(); lv.gain.value = k ? 2.2 : 3;
      s.connect(bp).connect(lv).connect(mix);
    });
    this._chain(mix, o, t, end); s.start(t); s.stop(end + 0.03); this._track(s);
  }

  // ---- the sounds ---------------------------------------------------------------------------

  play(name, { vol = 1 } = {}) {
    if (!this.on || !this.ctx) return;
    const c = this.ctx;
    this._wake();
    const now = c.currentTime;
    if (now - (this.last[name] ?? -1) < (GAP[name] ?? 0.02)) return;
    if (this.voices > 90) return;
    this.last[name] = now;
    if (this.buffers[name]) { const s = c.createBufferSource(); s.buffer = this.buffers[name]; const g = c.createGain(); g.gain.value = vol; s.connect(g).connect(this.out); s.start(); return; }
    // every voice of this play goes through one dry and one wet bus, so vol scales the lot
    const dry = c.createGain(), wet = c.createGain(); dry.gain.value = wet.gain.value = vol * (TRIM[name] ?? 1);
    dry.connect(this.out); wet.connect(this.verbIn); this.bus = { dry, wet };
    const O = (o) => this.osc(o), N = (o) => this.noise(o), F = (o) => this.fm(o), V = (o) => this.voice(o);
    const p = rnd(0.94, 1.06); // a touch of pitch drift so repeats don't sound like a machine gun
    const R = this.recipes || (this.recipes = recipes());
    (R[name] || (() => {}))({ O, N, F, V, p });
    // drop the buses once everything in them is long finished
    setTimeout(() => { dry.disconnect(); wet.disconnect(); }, 6000);
  }
}

function recipes() {
  return {
    // --- board ---
    // the phone's turn starts / cursor moves: a dry little click
    tick: ({ O, N, p }) => { N({ filt: 'highpass', ff: 5000, d: 0.012, vol: 0.18 }); O({ f: 2200 * p, d: 0.02, vol: 0.05 }); },
    // a blow-up doll hopping onto the next space: soft vinyl thump with a tiny squeak
    step: ({ O, p }) => { O({ f: 260 * p, f2: 140, d: 0.1, vol: 0.28 }); O({ type: 'triangle', f: 900 * p, f2: 1400, d: 0.05, vol: 0.03 }); },
    // a die hitting the board
    clack: ({ O, N, p }) => {
      N({ filt: 'bandpass', ff: 3000 * p, q: 2.5, d: 0.03, vol: 0.55 });
      O({ type: 'triangle', f: rnd(1600, 2300), d: 0.025, vol: 0.07 });
      O({ f: 240 * p, f2: 150, d: 0.05, vol: 0.18 });
    },
    // the dice have settled and the number shows: two marimba notes up
    dice: ({ F }) => { F({ f: 784, ratio: 4, index: 1.2, d: 0.25, vol: 0.13, verb: 0.15 }); F({ f: 1175, ratio: 4, index: 1.2, d: 0.4, vol: 0.13, at: 0.09, verb: 0.2 }); },
    // gaining coins: the classic two-step blip, with a bell on top
    coin: ({ O, F }) => {
      O({ type: 'square', f: 988, d: 0.07, vol: 0.05, filt: 'lowpass', ff: 5000 });
      O({ type: 'square', f: 1319, d: 0.32, vol: 0.05, at: 0.07, filt: 'lowpass', ff: 5000, ff2: 1800 });
      F({ f: 2637, ratio: 2, index: 0.6, d: 0.35, vol: 0.04, at: 0.07, verb: 0.25 });
    },
    // losing coins / a fail: a short sad trombone, wah-wah-waaah
    lose: ({ O }) => {
      const tb = { type: 'sawtooth', filt: 'lowpass', q: 2, vol: 0.09, a: 0.02 };
      O({ ...tb, f: 330, ff: 1500, ff2: 700, d: 0.16 });
      O({ ...tb, f: 311, ff: 1500, ff2: 700, d: 0.16, at: 0.17 });
      O({ ...tb, f: 294, f2: 262, glide: 0.45, ff: 1400, ff2: 450, hold: 0.15, d: 0.3, at: 0.34, vib: [6, 6] });
    },
    // picking up a crown item / wheel lands: bright bell arpeggio and a sparkle
    item: ({ F, N }) => {
      [1047, 1319, 1568, 2093].forEach((f, i) => F({ f, ratio: 2, index: 0.8, d: i === 3 ? 0.9 : 0.35, vol: 0.09, at: i * 0.08, verb: 0.35 }));
      N({ filt: 'highpass', ff: 7000, a: 0.2, d: 0.5, vol: 0.05, at: 0.2, verb: 0.4 });
    },
    // buying from the shop: ka-ching (drawer clunk, then the till bell)
    shop: ({ O, N, F }) => {
      N({ filt: 'bandpass', ff: 2200, q: 2, d: 0.05, vol: 0.4 }); O({ f: 140, f2: 90, d: 0.08, vol: 0.3 });
      F({ f: 2637, ratio: 2.76, index: 1.5, d: 0.9, vol: 0.09, at: 0.09, verb: 0.3 });
      F({ f: 3520, ratio: 2.76, index: 1.2, d: 0.7, vol: 0.06, at: 0.12, verb: 0.3 });
    },
    // landing on an event (?) space: four whole-tone notes, a bit mysterious
    event: ({ O }) => { [523, 587, 659, 740].forEach((f, i) => O({ type: 'triangle', f, d: i === 3 ? 0.5 : 0.18, vol: 0.1, at: i * 0.1, vib: [6, 8], verb: 0.45 })); },
    // GO! a brass stab and a cymbal
    go: ({ O, N }) => {
      for (const f of [392, 494, 587, 784]) O({ type: 'sawtooth', f, detune: rnd(-8, 8), a: 0.02, hold: 0.22, d: 0.35, vol: 0.05, filt: 'lowpass', ff: 700, ff2: 4500, fglide: 0.08, verb: 0.25 });
      N({ filt: 'highpass', ff: 5000, d: 0.7, vol: 0.12, verb: 0.3 });
    },
    // 3, 2, 1 countdown / player ready
    beep: ({ O }) => { O({ type: 'square', f: 660, hold: 0.09, d: 0.06, vol: 0.06, filt: 'lowpass', ff: 2500 }); O({ f: 1320, hold: 0.09, d: 0.06, vol: 0.03 }); },
    // game over, someone's won: a little brass fanfare
    fanfare: ({ O, N }) => {
      const br = { type: 'sawtooth', a: 0.015, vol: 0.045, filt: 'lowpass', ff: 900, ff2: 4000, fglide: 0.06, verb: 0.35 };
      [[0, 392, 0.1], [0.13, 392, 0.1], [0.26, 392, 0.1], [0.39, 523, 1.1]].forEach(([at, f, d], i) => {
        const chord = i === 3 ? [f, f * 1.26, f * 1.5, f * 2] : [f, f * 1.5];
        for (const g of chord) O({ ...br, f: g, detune: rnd(-7, 7), at, hold: d * 0.6, d: d, vib: i === 3 ? [5, 3] : null });
      });
      N({ filt: 'highpass', ff: 4500, d: 1.2, vol: 0.12, at: 0.39, verb: 0.4 });
    },

    // --- power-ups ---
    // Coin Flip: the coin pinging as it spins, faster as it falls, then the clink on landing
    flip: ({ F }) => {
      let at = 0, gap = 0.16, k = 0;
      while (at < 1.4) { F({ f: k++ % 2 ? 2700 : 2350, ratio: 2.76, index: 1, d: 0.12, vol: 0.05, at, verb: 0.2 }); at += gap; gap = Math.max(0.06, gap * 0.9); }
      F({ f: 3100, ratio: 2.76, index: 1.6, d: 0.5, vol: 0.09, at: 1.5, verb: 0.3 });
    },
    // Sugar Bomb pops / footy blast: crack, rumble, sub
    boom: ({ O, N }) => {
      N({ filt: 'highpass', ff: 1200, d: 0.08, vol: 0.5 });
      N({ filt: 'lowpass', ff: 2200, ff2: 120, q: 0.7, d: 1.0, vol: 0.9, verb: 0.3 });
      O({ f: 95, f2: 30, d: 0.8, vol: 0.55 });
    },
    // Holy Hand Grenade / tree crash: bigger, longer, with debris landing
    bigboom: ({ O, N }) => {
      N({ filt: 'highpass', ff: 900, d: 0.1, vol: 0.6 });
      N({ filt: 'lowpass', ff: 3000, ff2: 80, q: 0.7, d: 2.0, vol: 1, verb: 0.35 });
      N({ filt: 'lowpass', ff: 300, a: 0.1, d: 2.2, vol: 0.5 });
      O({ f: 75, f2: 25, d: 1.6, vol: 0.65 });
      for (let i = 0; i < 9; i++) N({ filt: 'bandpass', ff: rnd(600, 2500), q: 3, d: 0.05, vol: rnd(0.08, 0.2), at: rnd(0.35, 1.5) });
    },
    // the choir: "Hal-le-lu-jah!" in four chords
    hallelujah: ({ V }) => {
      const D = [294, 370, 440, 587], G = [294, 392, 494, 587];
      [[0, D, 0.22, 'a'], [0.3, D, 0.12, 'e'], [0.45, G, 0.12, 'u'], [0.6, D, 0.85, 'ah']].forEach(([at, ch, hold, v]) => {
        for (const f of ch) for (const dt of [-9, 9]) V({ f: f * 2 ** (dt / 1200), vowels: [[0, v]], a: 0.05, hold, d: 0.3, vol: 0.022, at, vib: [5, f * 0.006], verb: 0.5 });
      });
    },
    // the Vacuum: motor spinning up and down, air rushing
    vacuum: ({ O, N }) => {
      O({ type: 'sawtooth', f: 90, f2: 240, glide: 0.6, a: 0.2, hold: 1.0, d: 0.4, vol: 0.1, filt: 'lowpass', ff: 900, am: [33, 0.3] });
      O({ type: 'sawtooth', f: 181, f2: 482, glide: 0.6, a: 0.2, hold: 1.0, d: 0.4, vol: 0.05, filt: 'lowpass', ff: 1400 });
      N({ filt: 'bandpass', ff: 800, ff2: 3500, fglide: 0.8, q: 1.2, a: 0.3, hold: 0.9, d: 0.4, vol: 0.35 });
    },
    // Teleport / reverse card: shimmery sweep up with rising chirps
    teleport: ({ O }) => {
      O({ f: 400, f2: 2400, d: 0.55, a: 0.02, vol: 0.09, vib: [28, 60], verb: 0.5 });
      [1200, 1500, 1800, 2400].forEach((f, i) => O({ type: 'triangle', f, d: 0.08, vol: 0.05, at: 0.05 + i * 0.06, verb: 0.5 }));
    },

    // --- bodies and hits ---
    // an inflatable bouncing / jump: springy wobble upward
    boing: ({ O, p }) => { O({ f: 170 * p, f2: 420 * p, glide: 0.3, d: 0.45, vol: 0.22, vib: [16, 50, 0] }); },
    // vinyl squashing / ducking: a rubbery chirp
    squeak: ({ O, p }) => { O({ type: 'triangle', f: 1300 * p, path: [[0.05, 1900 * p], [0.15, 1100 * p]], d: 0.15, vol: 0.07, vib: [38, 70] }); },
    // a hollow knock: hitting a fence, a rim, a ball
    bonk: ({ O, N, p }) => {
      O({ f: 340 * p, f2: 150, d: 0.14, vol: 0.32 });
      O({ type: 'triangle', f: 700 * p, f2: 320, d: 0.06, vol: 0.06 });
      N({ filt: 'bandpass', ff: 900 * p, q: 3, d: 0.04, vol: 0.3 });
    },
    // something heavy landing
    thud: ({ O, N, p }) => { O({ f: 125 * p, f2: 50, d: 0.3, vol: 0.55 }); N({ filt: 'lowpass', ff: 500, d: 0.15, vol: 0.45 }); },
    // skin on skin: sunscreen slap, the ref counting on the mat
    slap: ({ O, N, p }) => {
      N({ filt: 'bandpass', ff: 2300 * p, q: 0.9, a: 0.001, d: 0.06, vol: 0.9 });
      N({ filt: 'lowpass', ff: 700, a: 0.001, d: 0.08, vol: 0.4 });
      O({ f: 190 * p, d: 0.05, vol: 0.12 });
    },
    // a wrestling hit
    punch: ({ O, N, p }) => { O({ f: 150 * p, f2: 60, d: 0.13, vol: 0.5 }); N({ filt: 'bandpass', ff: 1500 * p, q: 1, a: 0.001, d: 0.05, vol: 0.5 }); },
    // a body slammed on the ring mat, with the ropes rattling
    slam: ({ O, N, F }) => {
      N({ filt: 'lowpass', ff: 1000, ff2: 200, a: 0.002, d: 0.4, vol: 0.9, verb: 0.2 });
      O({ f: 85, f2: 38, d: 0.45, vol: 0.6 });
      F({ f: 420, ratio: 1.73, index: 2, d: 0.35, vol: 0.05, at: 0.02 });
    },
    // swinging an arm / a quick move
    swing: ({ N, p }) => { N({ filt: 'bandpass', ff: 700 * p, ff2: 2600 * p, q: 1.5, a: 0.03, d: 0.12, vol: 0.35 }); },
    // something flying past, a throw, a gust
    whoosh: ({ N }) => {
      const s = rnd(0.85, 1.2);
      N({ filt: 'bandpass', ff: 400 * s, fpath: [[0.12, 2200 * s], [0.34, 600 * s]], q: 1.3, a: 0.12, d: 0.22, vol: 0.4 });
    },
    // pssssht, then the vinyl flapping as a doll goes down
    deflate: ({ O, N }) => {
      N({ filt: 'bandpass', ff: 5000, ff2: 2500, q: 1, a: 0.02, hold: 0.35, d: 0.4, vol: 0.28 });
      O({ type: 'sawtooth', f: 150, f2: 70, a: 0.03, hold: 0.25, d: 0.5, vol: 0.1, at: 0.1, filt: 'lowpass', ff: 900, am: [24, 0.9, 11] });
    },
    // knocked out of a match: descending wobbly "bwaaah"
    ko: ({ O, N }) => {
      O({ type: 'square', f: 440, f2: 110, d: 0.8, vol: 0.06, filt: 'lowpass', ff: 2200, ff2: 500, vib: [8, 20] });
      N({ filt: 'lowpass', ff: 800, d: 0.3, vol: 0.15 });
    },
    // missed a beat: a dull "bwomp"
    miss: ({ O }) => { O({ type: 'sawtooth', f: 160, f2: 110, d: 0.22, vol: 0.12, filt: 'lowpass', ff: 600, ff2: 250 }); },
    // creeping in the Biscuit Heist
    tiptoe: ({ O, N, p }) => { O({ f: 1400 * p, d: 0.03, vol: 0.03 }); N({ filt: 'highpass', ff: 3000, d: 0.015, vol: 0.04 }); },

    // --- voices and animals ---
    oi: ({ V, N }) => {
      V({ f: 210, path: [[0.08, 245], [0.3, 175]], vowels: [[0, 'o'], [0.1, 'o'], [0.22, 'i']], a: 0.015, hold: 0.18, d: 0.15, vol: 0.18, vib: [6, 3], verb: 0.15 });
      N({ filt: 'bandpass', ff: 1800, q: 1, a: 0.01, d: 0.2, vol: 0.04 });
    },
    // Alan yelling at the sheep
    yell: ({ V, N }) => {
      V({ f: 280, path: [[0.12, 360], [0.5, 300], [0.7, 240]], vowels: [[0, 'eh'], [0.15, 'a'], [0.55, 'o']], a: 0.03, hold: 0.45, d: 0.25, vol: 0.2, vib: [6, 6], drive: true, verb: 0.2 });
      N({ filt: 'bandpass', ff: 1500, q: 0.8, a: 0.05, hold: 0.4, d: 0.2, vol: 0.06 });
    },
    // the old fella asleep in the Biscuit Heist: a rattly breath in
    snore: ({ O, N }) => {
      O({ type: 'sawtooth', f: 72, f2: 95, a: 0.4, hold: 0.4, d: 0.3, vol: 0.14, filt: 'lowpass', ff: 500, am: [28, 0.8] });
      N({ filt: 'bandpass', ff: 600, q: 1.5, a: 0.4, hold: 0.4, d: 0.3, vol: 0.18, am: [28, 0.8] });
    },
    snort: ({ O, N }) => {
      O({ type: 'sawtooth', f: 125, f2: 90, d: 0.2, vol: 0.22, filt: 'lowpass', ff: 700, am: [45, 0.9] });
      N({ filt: 'bandpass', ff: 900, q: 1.2, d: 0.15, vol: 0.25, am: [45, 0.9] });
    },
    baa: ({ V, p }) => { V({ f: 520 * p, f2: 460 * p, vowels: [[0, 'eh'], [0.4, 'e']], a: 0.03, hold: 0.3, d: 0.25, vol: 0.18, vib: [8, 22], verb: 0.2 }); },
    bark: ({ V, N, p }) => {
      for (const [at, f] of [[0, 430 * p], [0.17, 400 * p]]) {
        V({ f, f2: f * 0.6, vowels: [[0, 'a'], [0.08, 'o']], a: 0.005, d: 0.12, vol: 0.28, drive: true, at });
        N({ filt: 'bandpass', ff: 1100, q: 1.2, d: 0.07, vol: 0.18, at });
      }
    },
    meow: ({ V, p }) => { V({ f: 560 * p, path: [[0.15, 820 * p], [0.5, 600 * p]], vowels: [[0, 'i'], [0.2, 'a'], [0.45, 'u']], a: 0.04, hold: 0.25, d: 0.25, vol: 0.16, vib: [6, 10], verb: 0.15 }); },
    // an Aussie magpie warbling (it's arrived)
    magpie: ({ O }) => {
      const pts = [[0, 1100], [0.07, 1550], [0.13, 1320], [0.2, 1800], [0.27, 1250], [0.35, 1650], [0.45, 980]];
      O({ f: 1100, path: pts.slice(1), d: 0.5, a: 0.02, vol: 0.07, vib: [24, 45], verb: 0.35 });
      O({ f: 900, path: [[0.1, 1200], [0.2, 1050], [0.3, 1400]], d: 0.35, vol: 0.04, at: 0.5, vib: [30, 60], verb: 0.35 });
    },
    // a magpie swooping / nicking something: harsh squawk
    squawk: ({ V, N, p }) => {
      V({ f: 1000 * p, f2: 750 * p, vowels: [[0, 'a'], [0.15, 'eh']], a: 0.005, d: 0.22, vol: 0.2, am: [55, 0.6], drive: true });
      N({ filt: 'bandpass', ff: 2200, q: 1.5, d: 0.18, vol: 0.15 });
    },
    // the crowd goes off: a swell of voices, whistles and claps
    crowd: ({ V, N }) => {
      N({ filt: 'bandpass', ff: 900, q: 0.6, a: 0.18, hold: 0.6, d: 0.8, vol: 0.4, am: [7, 0.3], verb: 0.3 });
      for (let i = 0; i < 14; i++) {
        const f = rnd(170, 480);
        V({ f, f2: f * rnd(1.05, 1.3), glide: 0.4, vowels: [[0, ['a', 'o', 'eh', 'u'][i % 4]]], a: rnd(0.08, 0.3), hold: rnd(0.3, 0.7), d: 0.7, vol: 0.012, at: rnd(0, 0.15), vib: [rnd(4, 7), f * 0.02], verb: 0.4 });
      }
      for (let i = 0; i < 22; i++) N({ filt: 'bandpass', ff: rnd(1200, 2200), q: 1.2, a: 0.001, d: 0.02, vol: rnd(0.1, 0.25), at: rnd(0.1, 1.3) });
    },

    // --- things ---
    // couch springs
    creak: ({ O }) => {
      O({ type: 'sawtooth', f: 180, d: 0.1, hold: 0.4, a: 0.02, vol: 0.12, filt: 'bandpass', ff: 1100, ff2: 1500, q: 6, am: [20, 1, 55, 'square'] });
      O({ type: 'sawtooth', f: 160, d: 0.1, hold: 0.2, a: 0.02, vol: 0.1, at: 0.3, filt: 'bandpass', ff: 900, q: 6, am: [40, 1, 25, 'square'] });
    },
    // drum kit (the Back Yard beat) and a boot into a footy
    kick: ({ O, N }) => { O({ f: 160, f2: 45, glide: 0.1, d: 0.3, vol: 0.55 }); N({ filt: 'highpass', ff: 3000, d: 0.01, vol: 0.12 }); },
    snare: ({ O, N }) => { N({ filt: 'bandpass', ff: 1900, q: 0.8, d: 0.16, vol: 0.45 }); O({ type: 'triangle', f: 190, d: 0.08, vol: 0.18 }); },
    hat: ({ N }) => { N({ filt: 'highpass', ff: 7500, d: 0.035, vol: 0.18 }); },
    // plates hitting the bar, metal on metal
    clank: ({ F, N, p }) => {
      F({ f: 1900 * p, ratio: 1.41, index: 3, d: 0.25, vol: 0.08 });
      F({ f: 2700 * p, ratio: 1.73, index: 2.5, d: 0.3, vol: 0.05, at: 0.025 });
      N({ filt: 'highpass', ff: 4000, d: 0.02, vol: 0.15 });
    },
    // stepping on Lego: a little plastic clatter
    lego: ({ O, N }) => {
      for (let i = 0; i < 6; i++) O({ type: 'triangle', f: rnd(1800, 3600), d: 0.02, vol: 0.06, at: rnd(0, 0.15) });
      N({ filt: 'highpass', ff: 3000, d: 0.04, vol: 0.12 });
    },
    // stacking it into a bin: plastic crash and rattle
    crash: ({ O, N }) => {
      N({ filt: 'bandpass', ff: 1200, q: 0.8, d: 0.3, vol: 0.55 });
      O({ f: 190, f2: 85, d: 0.2, vol: 0.4 });
      for (let i = 0; i < 6; i++) O({ type: 'triangle', f: rnd(500, 1300), f2: rnd(300, 600), d: 0.05, vol: 0.06, at: rnd(0.03, 0.35) });
    },
    // a toy blaster
    shot: ({ O, N, p }) => {
      O({ type: 'square', f: 1500 * p, f2: 180, d: 0.15, vol: 0.07, filt: 'lowpass', ff: 4000 });
      N({ filt: 'bandpass', ff: 2000, q: 1, d: 0.05, vol: 0.2 });
    },
    // Draw!: a revolver crack echoing off the outback
    gunshot: ({ O, N }) => {
      N({ filt: 'highpass', ff: 600, a: 0.001, d: 0.06, vol: 1, verb: 0.5 });
      N({ filt: 'lowpass', ff: 1500, a: 0.001, d: 0.35, vol: 0.5, verb: 0.5 });
      O({ f: 110, f2: 40, d: 0.2, vol: 0.5 });
      N({ filt: 'bandpass', ff: 900, q: 1, d: 0.25, vol: 0.18, at: 0.3, verb: 0.6 });
      N({ filt: 'bandpass', ff: 700, q: 1, d: 0.3, vol: 0.08, at: 0.62, verb: 0.6 });
    },
    // a car horn / the ute horn: two notes, a bit distorted
    horn: ({ O }) => { for (const f of [415, 523]) O({ type: 'square', f, a: 0.01, hold: 0.32, d: 0.08, vol: 0.06, drive: true, filt: 'lowpass', ff: 2400 }); },
    // a turbo / marble boost
    boost: ({ O, N }) => {
      N({ filt: 'bandpass', ff: 500, ff2: 3200, q: 1.5, a: 0.04, d: 0.5, vol: 0.4 });
      O({ type: 'sawtooth', f: 180, f2: 720, d: 0.45, a: 0.02, vol: 0.05, filt: 'lowpass', ff: 2000 });
    },
    // the plane lifting off: engine roar winding up
    takeoff: ({ O, N }) => {
      O({ type: 'sawtooth', f: 90, f2: 230, a: 0.3, hold: 0.5, d: 0.8, vol: 0.09, filt: 'lowpass', ff: 600, ff2: 1600, am: [30, 0.25, 60] });
      N({ filt: 'bandpass', ff: 700, ff2: 1900, q: 1, a: 0.3, hold: 0.5, d: 0.8, vol: 0.3, verb: 0.2 });
    },
    // a hedge trimmer buzzing
    trim: ({ O, N }) => {
      O({ type: 'sawtooth', f: 98, a: 0.01, hold: 0.07, d: 0.05, vol: 0.06, filt: 'lowpass', ff: 1500, am: [50, 0.6] });
      O({ type: 'sawtooth', f: 197, a: 0.01, hold: 0.07, d: 0.05, vol: 0.03, filt: 'lowpass', ff: 1800 });
      N({ filt: 'bandpass', ff: 2500, q: 1.5, a: 0.01, hold: 0.07, d: 0.05, vol: 0.05 });
    },
    // liquid: beer out of the tap, glugs and bubbles
    pour: ({ O, N }) => {
      N({ filt: 'lowpass', ff: 1300, q: 1, a: 0.04, hold: 0.15, d: 0.12, vol: 0.12 });
      for (let i = 0; i < 3; i++) { const f = rnd(350, 900); O({ f, f2: f * 1.7, d: 0.045, vol: 0.06, at: rnd(0, 0.25) }); }
    },
    // the ref's pea whistle: a trill with breath
    whistle: ({ O, N }) => {
      O({ f: 2900, a: 0.02, hold: 0.42, d: 0.1, vol: 0.09, vib: [30, 170] });
      N({ filt: 'bandpass', ff: 3000, q: 2, a: 0.02, hold: 0.42, d: 0.1, vol: 0.06 });
    },
    // cans clinking, then the pssht of one opening
    cheers: ({ F, N }) => {
      F({ f: 2400, ratio: 2.76, index: 1, d: 0.3, vol: 0.07, verb: 0.2 });
      F({ f: 2900, ratio: 2.76, index: 1, d: 0.3, vol: 0.06, at: 0.07, verb: 0.2 });
      N({ filt: 'highpass', ff: 6000, ff2: 3000, a: 0.005, d: 0.35, vol: 0.2, at: 0.22 });
    },
    // two pennies landing on the ground (Two-Up)
    coins: ({ F }) => {
      [[0, 3200, 0.07], [0.06, 2800, 0.06], [0.15, 3150, 0.03], [0.21, 2780, 0.025], [0.27, 3180, 0.012]].forEach(([at, f, vol]) => F({ f, ratio: 2.76, index: 1.3, d: 0.25, vol, at, verb: 0.2 }));
    },
    // service bell: order up
    ding: ({ F, O }) => { F({ f: 2093, ratio: 2.4, index: 1, d: 1.2, vol: 0.1, verb: 0.25 }); O({ f: 4186, d: 0.4, vol: 0.02 }); },
    // wrong-answer buzzer
    buzz: ({ O }) => { O({ type: 'sawtooth', f: 110, hold: 0.32, d: 0.05, vol: 0.07, filt: 'lowpass', ff: 1400 }); O({ type: 'square', f: 117, hold: 0.32, d: 0.05, vol: 0.05, filt: 'lowpass', ff: 1400 }); },

    // --- water (Fishing Off the Jetty) ---
    splash: ({ O, N }) => {
      N({ filt: 'lowpass', ff: 3500, ff2: 400, q: 0.8, a: 0.005, d: 0.4, vol: 0.5, verb: 0.15 });
      for (let i = 0; i < 4; i++) { const f = rnd(400, 1000); O({ f, f2: f * 1.8, d: 0.04, vol: 0.06, at: rnd(0.05, 0.3) }); }
    },
    // a bite: the float bobbing under
    plop: ({ O, N }) => { O({ f: 320, f2: 950, glide: 0.05, d: 0.08, vol: 0.2 }); N({ filt: 'lowpass', ff: 1200, d: 0.1, vol: 0.15 }); },
    // the reel's ratchet clicking
    reel: ({ O, N }) => { for (let i = 0; i < 5; i++) { N({ filt: 'bandpass', ff: 3500, q: 4, d: 0.01, vol: 0.4, at: i * 0.035 }); O({ f: 2500, d: 0.01, vol: 0.03, at: i * 0.035 }); } },
    // the line snapping: crack and a twang
    snap: ({ O, N }) => {
      N({ filt: 'highpass', ff: 2000, a: 0.001, d: 0.04, vol: 0.6 });
      O({ type: 'sawtooth', f: 700, f2: 150, d: 0.2, vol: 0.08, filt: 'lowpass', ff: 3000 });
      O({ type: 'triangle', f: 180, d: 0.45, vol: 0.12, vib: [12, 25, 0] });
    },
  };
}
