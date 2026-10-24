// Synthesised sound effects (no audio files needed). Real sounds can replace these later:
// drop files in assets/sfx/ and map them in FILES below.
const FILES = {}; // e.g. { boom: 'assets/sfx/boom.mp3' }

export class Sfx {
  constructor() { this.ctx = null; this.on = true; this.buffers = {}; }

  unlock() {
    if (this.ctx) return;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    for (const [k, url] of Object.entries(FILES)) fetch(url).then((r) => r.arrayBuffer()).then((b) => this.ctx.decodeAudioData(b)).then((buf) => { this.buffers[k] = buf; }).catch(() => {});
  }

  tone(freq, dur, { type = 'square', vol = 0.08, slide = 0, delay = 0 } = {}) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  }

  noise(dur, vol = 0.3, delay = 0) {
    const c = this.ctx, len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const s = c.createBufferSource(), g = c.createGain();
    s.buffer = buf; g.gain.value = vol;
    s.connect(g).connect(c.destination); s.start(c.currentTime + delay);
  }

  play(name) {
    if (!this.on || !this.ctx) return;
    if (this.buffers[name]) { const s = this.ctx.createBufferSource(); s.buffer = this.buffers[name]; s.connect(this.ctx.destination); s.start(); return; }
    switch (name) {
      case 'tick': this.tone(900, 0.04, { vol: 0.04 }); break;
      case 'step': this.tone(520, 0.06, { type: 'triangle', vol: 0.06 }); break;
      case 'dice': [0, 0.05, 0.1].forEach((d) => this.tone(300 + Math.random() * 400, 0.05, { delay: d, vol: 0.05 })); break;
      case 'coin': this.tone(988, 0.08, { vol: 0.06 }); this.tone(1319, 0.2, { vol: 0.06, delay: 0.08 }); break;
      case 'lose': this.tone(400, 0.25, { type: 'sawtooth', vol: 0.05, slide: -250 }); break;
      case 'item': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.25, { type: 'triangle', vol: 0.09, delay: i * 0.12 })); break;
      case 'shop': this.tone(660, 0.1, { type: 'triangle' }); this.tone(880, 0.15, { type: 'triangle', delay: 0.1 }); break;
      case 'event': this.tone(440, 0.12, { type: 'triangle' }); this.tone(660, 0.12, { type: 'triangle', delay: 0.12 }); break;
      case 'flip': for (let i = 0; i < 10; i++) this.tone(1200 + i * 60, 0.03, { vol: 0.03, delay: i * 0.15 }); break;
      case 'boom': this.noise(0.8, 0.5); this.tone(120, 0.6, { type: 'sine', vol: 0.3, slide: -80 }); break;
      case 'bigboom': this.noise(1.6, 0.7); this.tone(90, 1.2, { type: 'sine', vol: 0.4, slide: -60 }); break;
      case 'hallelujah': [[523, 659, 784], [587, 740, 880], [659, 831, 988]].forEach((ch, i) => ch.forEach((f) => this.tone(f, 0.5, { type: 'sine', vol: 0.06, delay: i * 0.42 }))); break;
      case 'vacuum': this.tone(180, 1.6, { type: 'sawtooth', vol: 0.05, slide: 300 }); this.noise(1.6, 0.12); break;
      case 'teleport': this.tone(300, 0.5, { type: 'sine', vol: 0.08, slide: 1200 }); break;
      case 'ko': this.tone(300, 0.7, { type: 'square', vol: 0.06, slide: -260 }); break;
      case 'go': this.tone(880, 0.3, { type: 'square', vol: 0.06 }); break;
      case 'beep': this.tone(660, 0.12, { type: 'square', vol: 0.05 }); break;
      case 'boing': this.tone(220, 0.25, { type: 'sine', vol: 0.12, slide: 500 }); break; // an inflatable hopping
      case 'squeak': this.tone(1400, 0.12, { type: 'triangle', vol: 0.05, slide: -500 }); break; // vinyl squashing
      case 'bonk': this.tone(160, 0.18, { type: 'square', vol: 0.08, slide: -90 }); this.noise(0.12, 0.2); break;
      case 'snore': this.tone(70, 1.1, { type: 'sawtooth', vol: 0.09, slide: 30 }); this.noise(1.0, 0.08); break; // a long rattling breath in
      case 'snort': this.tone(110, 0.18, { type: 'sawtooth', vol: 0.12, slide: -40 }); this.noise(0.15, 0.2); break;
      case 'creak': this.tone(300, 0.5, { type: 'triangle', vol: 0.05, slide: 180 }); this.tone(240, 0.3, { type: 'triangle', vol: 0.04, delay: 0.25, slide: -90 }); break; // the couch springs
      case 'oi': this.tone(190, 0.35, { type: 'square', vol: 0.1, slide: -70 }); this.tone(130, 0.3, { type: 'sawtooth', vol: 0.06, slide: -40 }); break;
      case 'kick': this.tone(150, 0.16, { type: 'sine', vol: 0.22, slide: -110 }); break;
      case 'snare': this.noise(0.14, 0.18); this.tone(220, 0.08, { type: 'triangle', vol: 0.05 }); break;
      case 'hat': this.noise(0.03, 0.06); break;
      case 'clank': this.tone(1900, 0.12, { type: 'square', vol: 0.03 }); this.tone(2600, 0.2, { type: 'triangle', vol: 0.03, delay: 0.02 }); break; // plates hitting the bar
      case 'miss': this.tone(140, 0.2, { type: 'sawtooth', vol: 0.05, slide: -40 }); break;
      case 'baa': this.tone(520, 0.45, { type: 'sawtooth', vol: 0.04, slide: -120 }); for (let i = 0; i < 6; i++) this.tone(480 - i * 15, 0.06, { type: 'square', vol: 0.02, delay: 0.05 + i * 0.06 }); break;
      case 'yell': this.tone(260, 0.6, { type: 'sawtooth', vol: 0.09, slide: 140 }); this.noise(0.5, 0.12); break;
      case 'horn': this.tone(392, 0.5, { type: 'square', vol: 0.06 }); this.tone(494, 0.5, { type: 'square', vol: 0.05 }); break;
      case 'bark': this.tone(600, 0.08, { type: 'sawtooth', vol: 0.08, slide: -300 }); this.tone(560, 0.08, { type: 'sawtooth', vol: 0.07, slide: -280, delay: 0.16 }); break;
      case 'meow': this.tone(700, 0.4, { type: 'triangle', vol: 0.06, slide: 300 }); break;
      case 'whoosh': this.noise(0.25, 0.16); break;
      case 'trim': this.tone(95, 0.12, { type: 'sawtooth', vol: 0.025 }); break; // a hedge trimmer buzzing
      case 'pour': this.noise(0.32, 0.035); this.tone(180 + Math.random() * 60, 0.08, { type: 'sine', vol: 0.03 }); break; // beer out of the tap
      case 'thud': this.tone(90, 0.3, { type: 'sine', vol: 0.25, slide: -50 }); this.noise(0.2, 0.25); break;
      case 'tiptoe': this.tone(1800, 0.03, { type: 'sine', vol: 0.02 }); break;
      case 'cheers': this.tone(1200, 0.05, { type: 'triangle', vol: 0.06 }); this.tone(1600, 0.08, { type: 'triangle', vol: 0.05, delay: 0.06 }); this.noise(0.25, 0.08, 0.1); break; // cans clinking, then the pssht
      case 'meow': this.tone(700, 0.35, { type: 'sawtooth', vol: 0.04, slide: 300 }); this.tone(1000, 0.25, { type: 'sawtooth', vol: 0.03, delay: 0.2, slide: -500 }); break;
    }
  }
}
