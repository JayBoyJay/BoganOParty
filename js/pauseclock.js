// Pause for the whole game: a clock that can stop.
//
// The game runs on setTimeout / setInterval / requestAnimationFrame / performance.now / Date.now all
// over the place (board turns, minigame clocks, prompt timers, CPU thinking, the 3-2-1, physics).
// Rather than teach every one of them about pausing, this swaps those browser functions for ones on
// a clock that stands still while paused: timers don't fire, frames don't run, and time doesn't move,
// so when play resumes every countdown carries on from exactly where it was.
//
// The phone connection is the exception. PeerJS and js/net.js keep real time (worked out from who
// called setTimeout), so heartbeats and reconnects carry on and nobody drops out during a long pause.
// Web Audio is suspended while paused, and CSS animations stop (except inside .pause-ui).
//
// This is a classic script (not a module) so it runs before any module code grabs the originals.
// window.__clock = { pause(), resume(), paused, now(), on(fn) }
(function () {
  if (window.__clock) return;
  const W = window;
  const rNow = performance.now.bind(performance);
  const rDate = Date.now.bind(Date);
  const rST = W.setTimeout.bind(W), rCT = W.clearTimeout.bind(W);
  const rSI = W.setInterval.bind(W), rCI = W.clearInterval.bind(W);
  const rRAF = W.requestAnimationFrame?.bind(W), rCAF = W.cancelAnimationFrame?.bind(W);

  let paused = false, pauseAt = 0, lost = 0;
  const vnow = () => (paused ? pauseAt : rNow()) - lost;
  try { performance.now = vnow; } catch { /* read-only: leave it */ }
  try { Date.now = () => rDate() - (rNow() - vnow()); } catch { /* read-only */ }

  // network code keeps real time
  const REAL = /peerjs|\/js\/net\.js/;
  // only the direct caller counts: game code run from a phone message has net.js further down its stack
  const fromNet = () => {
    const lines = String(new Error().stack || '').split('\n');
    for (const l of lines) {
      if (!/:\d+/.test(l) || l.includes('pauseclock.js')) continue;
      return REAL.test(l);
    }
    return false;
  };

  let seq = 1 << 30; // our ids sit far above the browser's own, so clearTimeout can tell them apart
  const timers = new Map(); // id -> { fn, args, due, every, h }
  const run = (fn, args) => { if (typeof fn === 'function') fn(...args); else (0, eval)(String(fn)); };
  const arm = (id, t) => { t.h = rST(() => fire(id), Math.max(0, t.due - vnow())); };
  function fire(id) {
    const t = timers.get(id);
    if (!t) return;
    t.h = 0;
    if (paused) return; // re-armed on resume
    if (vnow() < t.due - 1) { arm(id, t); return; }
    if (t.every !== null) { t.due = vnow() + t.every; arm(id, t); } else timers.delete(id);
    run(t.fn, t.args);
  }
  function add(fn, ms, args, every) {
    const id = ++seq;
    const d = Math.max(0, Number(ms) || 0);
    const t = { fn, args, due: vnow() + d, every: every ? Math.max(1, d) : null, h: 0 };
    timers.set(id, t);
    if (!paused) arm(id, t);
    return id;
  }
  function clear(id) {
    const t = timers.get(id);
    if (t) { if (t.h) rCT(t.h); timers.delete(id); return true; }
    return false;
  }
  W.setTimeout = function (fn, ms, ...args) { return fromNet() ? rST(fn, ms, ...args) : add(fn, ms, args, false); };
  W.setInterval = function (fn, ms, ...args) { return fromNet() ? rSI(fn, ms, ...args) : add(fn, ms, args, true); };
  W.clearTimeout = function (id) { if (!clear(id)) rCT(id); };
  W.clearInterval = function (id) { if (!clear(id)) rCI(id); };

  // animation frames wait while paused
  const frames = new Map(); // id -> { cb, h }
  if (rRAF) {
    const runFrame = (id) => {
      const f = frames.get(id);
      if (!f) return;
      f.h = 0;
      if (paused) return;
      frames.delete(id);
      f.cb(vnow());
    };
    W.requestAnimationFrame = function (cb) {
      const id = ++seq, f = { cb, h: 0 };
      frames.set(id, f);
      if (!paused) f.h = rRAF(() => runFrame(id));
      return id;
    };
    W.cancelAnimationFrame = function (id) {
      const f = frames.get(id);
      if (f) { if (f.h) rCAF(f.h); frames.delete(id); } else rCAF(id);
    };
    W.__resumeFrames = () => { for (const [id, f] of frames) if (!f.h) f.h = rRAF(() => runFrame(id)); };
  }

  // Web Audio: every context made on this page, so they can all be hushed
  const contexts = [];
  for (const k of ['AudioContext', 'webkitAudioContext']) {
    const AC = W[k];
    if (!AC) continue;
    const Wrapped = class extends AC { constructor(...a) { super(...a); contexts.push(this); } };
    try { W[k] = Wrapped; } catch { /* leave it */ }
  }
  const hushed = new Set();

  const listeners = new Set();
  const tell = () => { for (const fn of listeners) { try { fn(paused); } catch (e) { console.error(e); } } };

  W.__clock = {
    get paused() { return paused; },
    now: vnow,
    realNow: rNow,
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    pause() {
      if (paused) return;
      pauseAt = rNow();
      paused = true;
      for (const t of timers.values()) if (t.h) { rCT(t.h); t.h = 0; }
      for (const c of contexts) if (c.state === 'running') { hushed.add(c); c.suspend().catch(() => {}); }
      document.documentElement.classList.add('paused');
      tell();
    },
    resume() {
      if (!paused) return;
      lost += rNow() - pauseAt;
      paused = false;
      for (const [id, t] of timers) if (!t.h) arm(id, t);
      W.__resumeFrames?.();
      for (const c of hushed) c.resume().catch(() => {});
      hushed.clear();
      document.documentElement.classList.remove('paused');
      tell();
    },
  };
})();
