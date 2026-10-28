// Talks to the phones during a game. The TV owns all game state; a phone only ever shows the
// screen the TV last sent it and sends back taps:
//
//   TV → phone  { t: 'prompt', id, title, body, options, kind, layout, timer }   pick one, sent back as answer
//               { t: 'pad', id, kind, title, body, buttons, timer }               live controls, every tap sent
//               { t: 'idle', title }                                               nothing to do right now
//               { t: 'stats', ... }                                                coins, items, power-ups
//   phone → TV  { t: 'answer', id, v }   { t: 'in', id, b, ...extra }   { t: 'emote', mood }
//
// CPU players answer prompts here too, so game code never needs to care who is a bot.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class Hub {
  constructor(net, { speed = 1 } = {}) {
    this.net = net;
    this.speed = speed;
    this.seq = 0;
    this.screens = new Map(); // pid -> last screen sent (resent when a phone reconnects)
    this.pending = new Map(); // prompt id -> { resolve, player }
    this.pads = new Map(); // pad id -> { player, onInput }
    this.lastStats = new Map();
    this.online = new Set();
  }

  connected(p) { return p.bot || this.online.has(p.id); }

  send(p, msg, remember = true) {
    if (p.bot) return;
    if (remember) this.screens.set(p.id, msg);
    this.net.send(p.id, msg);
  }

  ask(p, prompt) {
    const id = ++this.seq;
    const options = prompt.options || [];
    const enabled = options.filter((o) => !o.disabled);
    const pick = (v) => (typeof v === 'function' ? v() : v);
    return new Promise((resolve) => {
      let done = false, timer = null;
      const finish = (v) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        this.pending.delete(id);
        if (!p.bot && this.screens.get(p.id)?.id === id) this.idle(p, 'Waiting…');
        resolve(v);
      };
      this.pending.set(id, { finish, player: p, options });
      const fallback = () => finish(prompt.fallback !== undefined ? pick(prompt.fallback) : (enabled[0]?.id ?? null));
      if (p.bot) {
        // a short think so people can follow what the CPU is doing
        sleep((500 + Math.random() * 700) * this.speed).then(() => {
          const v = prompt.bot !== undefined ? pick(prompt.bot) : enabled[Math.floor(Math.random() * enabled.length)]?.id;
          finish(v ?? enabled[0]?.id ?? null);
        });
        return;
      }
      const secs = prompt.timer || 45;
      timer = setTimeout(fallback, secs * 1000 * Math.max(0.2, this.speed));
      this.send(p, { t: 'prompt', id, kind: prompt.kind || 'choice', title: prompt.title || '', body: prompt.body || '', layout: prompt.layout || (options.length > 4 ? 'list' : 'grid'), timer: secs,
        options: options.map(({ id: oid, label, sub, disabled, tone }) => ({ id: oid, label, sub, disabled: !!disabled, tone })) });
    });
  }

  // Live controls: every tap/tilt calls onInput(msg) until close().
  live(p, pad, onInput) {
    const id = ++this.seq;
    this.pads.set(id, { player: p, onInput });
    this.send(p, { t: 'pad', id, ...pad });
    return { id, close: () => { this.pads.delete(id); if (!p.bot && this.screens.get(p.id)?.id === id) this.idle(p, ''); } };
  }

  idle(p, title = '', body = '') { this.send(p, { t: 'idle', title, body }); }
  idleAll(title, body = '', players = null) { for (const p of players || this.players || []) this.idle(p, title, body); }

  stats(p, s) {
    const key = JSON.stringify(s);
    if (this.lastStats.get(p.id) === key) return;
    this.lastStats.set(p.id, key);
    if (!p.bot) this.net.send(p.id, { t: 'stats', ...s });
  }

  // phone messages for the game (the lobby handles its own)
  handle(pid, m) {
    if (m.t === 'answer') {
      const q = this.pending.get(m.id);
      if (!q || q.player.id !== pid) return true;
      const opt = q.options.find((o) => o.id === m.v);
      if (q.options.length && (!opt || opt.disabled)) return true;
      q.finish(m.v);
      return true;
    }
    if (m.t === 'in') {
      const pad = this.pads.get(m.id);
      if (pad && pad.player.id === pid) pad.onInput(m);
      return true;
    }
    return false;
  }

  reconnect(pid) {
    this.online.add(pid);
    const s = this.screens.get(pid);
    if (s) this.net.send(pid, s);
    this.lastStats.delete(pid);
  }
  disconnect(pid) { this.online.delete(pid); }
}
