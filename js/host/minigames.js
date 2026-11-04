// Runs one minigame: practice round (or a title card), phones get their controls, countdown, play, results.
//
// A minigame file exports { id, name, blurb, howTo, duration, pad, create(mg) }. create() builds its
// own three.js scene and returns { scene, camera, update(dt, t), input(player, msg), scores() }, plus
// optionally draw(renderer, target) to draw the frame itself (split screen; see stage.js).
// mg gives it: players, makeDoll(player, opts), rng, THREE, kit (see kit.js), sfx, timeLeft(), renderer
// (for addSky in sky.js).
// untimed: true hides the clock (duration is then just a safety net) and shows inst.status() instead.
// Scores are numbers, higher is better; the runner turns them into placings and the board pays coins.
// create() can run more than once per minigame: the practice round builds its own copy and throws it away.
import * as THREE from 'three';
import { MINIGAMES, loadMinigame } from '../content/minigames/index.js';
import { Doll, faceDataUrl } from './doll.js';
import { makeKit } from './kit.js';
import { roomEnv } from './sky.js';
import { spinWheel, wheelGames, markPlayed } from './wheel.js';

// longest a practice round runs if not everyone presses READY
const PRACTICE_SECS = 45;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class MinigameRunner {
  constructor({ stage, hub, sfx, root, hud, rng = Math.random, speed = 1, practice = true }) {
    Object.assign(this, { stage, hub, sfx, root, hud, rng, speed });
    this.practiceOn = practice;
    this.recent = [];
  }

  pick(only) {
    const pool = MINIGAMES.filter((m) => !only || only.includes(m.id));
    const fresh = pool.filter((m) => !this.recent.includes(m.id));
    const list = fresh.length ? fresh : pool;
    const def = list[Math.floor(this.rng() * list.length)];
    this.recent = [def.id, ...this.recent].slice(0, Math.max(0, pool.length - 1));
    return def;
  }

  // spin the wheel to choose (or straight to the one game when testing with ?minigame=)
  async spin(players, only, label) {
    if (only) return this.pick(only);
    this.hud.show(false);
    const games = wheelGames(MINIGAMES, this.rng);
    return spinWheel({ root: this.root, hub: this.hub, sfx: this.sfx, players, games, rng: this.rng, speed: this.speed, label });
  }

  // the picked game's code, downloaded now if it isn't yet; if that fails (no internet), another one
  async load(entry) {
    try { return await loadMinigame(entry); } catch (e) { console.warn('could not load', entry.id, e); }
    for (const m of [...MINIGAMES].sort(() => this.rng() - 0.5)) { try { return await loadMinigame(m); } catch { /* next */ } }
    throw new Error('no minigames could be loaded');
  }

  // One copy of the game: its own scene, clock and pads. The practice round gets a throwaway copy, so
  // nothing from it (scores, positions, who got knocked out) leaks into the real one.
  build(def, players, dur) {
    const scene = new THREE.Scene();
    const padOf = new Map(); // player id -> their live pad, once the controls are up
    const extras = []; // GPU things the game made outside its scene (render targets...), freed at the end
    const c = { left: dur, t: 0, t0: 0, running: false };
    const mg = {
      THREE, players, rng: this.rng, sfx: this.sfx, kit: makeKit(scene), scene, renderer: this.stage.renderer,
      makeDoll: (p, opts) => new Doll(p, opts),
      timeLeft: () => c.left, duration: dur,
      track: (r) => { extras.push(r); return r; },
      env: (build, blur) => roomEnv(this.stage.renderer, scene, build, blur),
      padSend: (p, m) => padOf.get(p.id)?.send(m),
    };
    const inst = def.create(mg);
    inst.scene = inst.scene || scene;
    const view = {
      scene: inst.scene, camera: inst.camera,
      draw: inst.draw && ((r, target) => inst.draw(r, target)),
      // the clock runs on real time, so a slow TV doesn't make the game drag on
      update: (dt) => { if (c.running) { c.t += dt; c.left = Math.max(0, dur - (performance.now() - c.t0) / 1000); } inst.update(dt, c.t, c.running); },
    };
    this.stage.setView(view);
    return {
      inst, view, padOf, c,
      start: () => { c.running = true; c.t0 = performance.now(); },
      // free the game's geometry, textures and shaders (a long night of minigames used to pile them up
      // until the TV's browser choked). The caller puts another view up straight after.
      free: () => { c.running = false; inst.dispose?.(); this.stage.disposeScene(inst.scene, extras); },
    };
  }

  // Old-school practice round: the game runs for real on the TV with everyone's controls live, nothing
  // counts, and each phone has a READY button. It ends when everyone's ready or the clock runs out.
  // If the practice game finishes (time up, last one standing) it just starts again.
  async practice(def, players, dur) {
    const root = this.root;
    const cap = this.speed < 1 ? 3 : PRACTICE_SECS;
    root.innerHTML = `<div class="mg-hud"><div class="mg-tag">Practice</div><div class="mg-name">${esc(def.name)}</div><div class="mg-time" id="mgTime">${cap}</div></div>
      <div class="mp-how"><div class="label">How to play</div>${esc(def.howTo)}</div>
      <div class="mp-foot"><div class="mp-hint">Have a go on your phone. Nothing counts. Tap <b>READY</b> when you've got it.</div><div class="mg-ready" id="mgReady"></div></div>
      <div class="mg-big" id="mgBig"></div>`;
    const readyBox = root.querySelector('#mgReady'), timeEl = root.querySelector('#mgTime'), big = root.querySelector('#mgBig');
    const ready = new Set();
    const drawReady = () => { readyBox.innerHTML = players.map((p) => `<span class="${ready.has(p.id) ? 'ok' : ''}" style="--pc:${p.color}">${esc(p.name)} ${ready.has(p.id) ? '✔' : '…'}</span>`).join(''); };
    const setReady = (p) => { if (ready.has(p.id)) return; ready.add(p.id); drawReady(); this.sfx.play('beep'); };
    drawReady();

    let g = this.build(def, players, dur);
    const pads = players.map((p) => this.hub.live(p, { title: def.name, body: def.padText || '', sideways: true, ...def.pad, practice: true }, (m) => {
      if (m.b === 'practice-ready') setReady(p);
      else if (g.c.running) g.inst.input(p, m);
    }));
    const hookPads = () => pads.forEach((h, i) => g.padOf.set(players[i].id, h));
    hookPads();
    g.start();
    // CPUs muck about for a few seconds first, so you can see what they're up to
    const botTimers = players.filter((p) => p.bot).map((p) => setTimeout(() => setReady(p), (2500 + this.rng() * 3500) * this.speed));

    const t0 = performance.now();
    let shown = '';
    await new Promise((resolve) => {
      const tick = setInterval(() => {
        const left = Math.max(0, cap - (performance.now() - t0) / 1000);
        const tt = String(Math.ceil(left));
        if (tt !== shown) timeEl.textContent = shown = tt;
        if (ready.size >= players.length || left <= 0) { clearInterval(tick); resolve(); return; }
        if (g.c.left <= 0 || g.inst.done?.()) {
          // practice game over: fresh one, same pads
          g.free();
          g = this.build(def, players, dur);
          hookPads();
          pads.forEach((h) => h.send({ pin: false })); // drop any leftover overlay (Joe Master's kick-out bar)
          g.start();
          big.textContent = 'Again!';
          setTimeout(() => { if (big.textContent === 'Again!') big.textContent = ''; }, 900);
        }
      }, 200);
    });
    botTimers.forEach(clearTimeout);
    pads.forEach((h) => h.close());
    big.textContent = ready.size >= players.length ? 'Everyone\'s ready!' : 'Time\'s up!';
    this.sfx.play('go');
    await sleep(1300 * this.speed);
    g.free();
  }

  async run(players, entry = this.pick()) {
    const def = await this.load(entry);
    const root = this.root;
    this.playing = true; // practice + play: no emote balloons until the results are up
    markPlayed(def.id);
    this.hud.show(false);
    root.classList.remove('hidden');
    const prevView = this.stage.view;
    const full = def.duration + Math.max(0, players.length - 4) * (def.perPlayer || 0);
    const dur = this.speed < 1 ? Math.min(8, full) : full; // fast mode is for automated tests

    if (this.practiceOn) await this.practice(def, players, dur);
    else {
      // ----- title card -----
      root.innerHTML = `<div class="mg-card"><div class="label">Minigame</div><h1>${esc(def.name)}</h1><p>${esc(def.blurb)}</p>
        <div class="how">${esc(def.howTo)}</div><div class="mg-ready" id="mgReady"></div></div>`;
      const readyBox = root.querySelector('#mgReady');
      const ready = new Set();
      const drawReady = () => { readyBox.innerHTML = players.map((p) => `<span class="${ready.has(p.id) ? 'ok' : ''}" style="--pc:${p.color}">${esc(p.name)} ${ready.has(p.id) ? '✔' : '…'}</span>`).join(''); };
      drawReady();
      await Promise.all(players.map((p) => this.hub.ask(p, {
        title: def.name, body: def.howTo, options: [{ id: 'ready', label: "I'm ready!", tone: 'go' }], timer: 25, bot: 'ready',
      }).then(() => { ready.add(p.id); drawReady(); })));
    }

    // ----- build the scene -----
    const g = this.build(def, players, dur);
    const { inst, view, padOf } = g;
    root.innerHTML = `<div class="mg-hud"><div class="mg-name">${esc(def.name)}</div><div class="mg-time" id="mgTime">${def.untimed ? '' : dur}</div></div><div class="mg-big" id="mgBig"></div><div class="mg-board" id="mgBoard"></div>`;
    const big = root.querySelector('#mgBig');

    // ----- controls + countdown -----
    let running = false;
    const pads = players.map((p) => this.hub.live(p, { title: def.name, body: def.padText || '', sideways: true, ...def.pad }, (m) => { if (running) inst.input(p, m); }));
    pads.forEach((h, i) => padOf.set(players[i].id, h));
    for (const n of ['3', '2', '1']) { big.textContent = n; this.sfx.play('beep'); await sleep(800 * this.speed); }
    big.textContent = 'GO!'; this.sfx.play('go');
    running = true;
    g.start();
    setTimeout(() => { if (big.textContent === 'GO!') big.textContent = ''; }, 700);
    const timeEl = root.querySelector('#mgTime'), boardEl = root.querySelector('#mgBoard');
    // the side scoreboard: rows built once, then only the numbers and the order change
    boardEl.innerHTML = players.map((p) => `<div style="--pc:${p.color}"><img src="${faceDataUrl(p, 'neutral')}" alt=""><b>${esc(p.name)}</b><span>0</span></div>`).join('');
    const rows = players.map((p, i) => ({ p, el: boardEl.children[i], num: boardEl.children[i].lastChild, shown: '0', order: -1 }));
    let timeShown = '';
    await new Promise((resolve) => {
      const tick = setInterval(() => {
        const left = g.c.left = Math.max(0, dur - (performance.now() - g.c.t0) / 1000);
        const tt = String(def.untimed ? inst.status?.() || '' : Math.ceil(left)); // untimed games run to their own end
        if (tt !== timeShown) timeEl.textContent = timeShown = tt;
        const sc = inst.scores();
        [...rows].sort((a, b) => (sc[b.p.id] || 0) - (sc[a.p.id] || 0)).forEach((r, i) => {
          const v = String(Math.round(sc[r.p.id] || 0));
          if (v !== r.shown) r.num.textContent = r.shown = v;
          if (i !== r.order) r.el.style.order = r.order = i;
        });
        if (left <= 0 || inst.done?.()) { clearInterval(tick); resolve(); }
      }, 200);
    });
    running = false;
    g.c.running = false;
    pads.forEach((h) => h.close());
    this.sfx.play('go');
    big.textContent = 'TIME!';
    await sleep(1200 * this.speed);

    // ----- results -----
    this.playing = false;
    const sc = inst.scores();
    const sorted = [...players].sort((a, b) => (sc[b.id] || 0) - (sc[a.id] || 0));
    const placings = [];
    for (const p of sorted) {
      const last = placings[placings.length - 1];
      if (last && Math.round(sc[last[0].id] || 0) === Math.round(sc[p.id] || 0)) last.push(p); else placings.push([p]);
    }
    root.innerHTML = `<div class="mg-card"><div class="label">${esc(def.name)}</div><h1>Results</h1><div class="mg-results">${placings.map((g, i) => g.map((p) =>
      `<div style="--pc:${p.color}"><span class="pl">${i + 1}</span><img src="${faceDataUrl(p, 'neutral')}" alt=""><b>${esc(p.name)}</b><span>${Math.round(sc[p.id] || 0)}</span></div>`).join('')).join('')}</div></div>`;
    await sleep(3200 * this.speed);
    // back to whatever was showing before, then free the minigame
    if (this.stage.view === view) this.stage.setView(prevView);
    g.free();
    root.classList.add('hidden');
    root.innerHTML = '';
    this.hud.show(true);
    return placings;
  }
}
