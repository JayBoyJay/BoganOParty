// Runs one minigame: title card, phones get their controls, countdown, play, results.
//
// A minigame file exports { id, name, blurb, howTo, duration, pad, create(mg) }. create() builds its
// own three.js scene and returns { scene, camera, update(dt, t), input(player, msg), scores() }, plus
// optionally draw(renderer, target) to draw the frame itself (split screen; see stage.js).
// mg gives it: players, makeDoll(player, opts), rng, THREE, kit (see kit.js), sfx, timeLeft(), renderer
// (for addSky in sky.js).
// untimed: true hides the clock (duration is then just a safety net) and shows inst.status() instead.
// Scores are numbers, higher is better; the runner turns them into placings and the board pays coins.
import * as THREE from 'three';
import { MINIGAMES, loadMinigame } from '../content/minigames/index.js';
import { Doll, faceDataUrl } from './doll.js';
import { makeKit } from './kit.js';
import { roomEnv } from './sky.js';
import { spinWheel, wheelGames, markPlayed } from './wheel.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class MinigameRunner {
  constructor({ stage, hub, sfx, root, hud, rng = Math.random, speed = 1 }) {
    Object.assign(this, { stage, hub, sfx, root, hud, rng, speed });
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

  async run(players, entry = this.pick()) {
    const def = await this.load(entry);
    const root = this.root;
    markPlayed(def.id);
    this.hud.show(false);
    // ----- title card -----
    root.classList.remove('hidden');
    root.innerHTML = `<div class="mg-card"><div class="label">Minigame</div><h1>${esc(def.name)}</h1><p>${esc(def.blurb)}</p>
      <div class="how">${esc(def.howTo)}</div><div class="mg-ready" id="mgReady"></div></div>`;
    const readyBox = root.querySelector('#mgReady');
    const ready = new Set();
    const drawReady = () => { readyBox.innerHTML = players.map((p) => `<span class="${ready.has(p.id) ? 'ok' : ''}" style="--pc:${p.color}">${esc(p.name)} ${ready.has(p.id) ? '✔' : '…'}</span>`).join(''); };
    drawReady();
    await Promise.all(players.map((p) => this.hub.ask(p, {
      title: def.name, body: def.howTo, options: [{ id: 'ready', label: "I'm ready!", tone: 'go' }], timer: 25, bot: 'ready',
    }).then(() => { ready.add(p.id); drawReady(); })));

    // ----- build the scene -----
    const full = def.duration + Math.max(0, players.length - 4) * (def.perPlayer || 0);
    const dur = this.speed < 1 ? Math.min(8, full) : full; // fast mode is for automated tests
    const scene = new THREE.Scene();
    const extras = []; // GPU things the game made outside its scene (render targets...), freed at the end
    const mg = {
      THREE, players, rng: this.rng, sfx: this.sfx, kit: makeKit(scene), scene, renderer: this.stage.renderer,
      makeDoll: (p, opts) => new Doll(p, opts),
      timeLeft: () => left, duration: dur,
      track: (r) => { extras.push(r); return r; },
      env: (build, blur) => roomEnv(this.stage.renderer, scene, build, blur),
    };
    const inst = def.create(mg);
    inst.scene = inst.scene || scene;
    let left = dur, t = 0, t0 = 0, running = false;
    const view = {
      scene: inst.scene, camera: inst.camera,
      draw: inst.draw && ((r, target) => inst.draw(r, target)),
      // the clock runs on real time, so a slow TV doesn't make the game drag on
      update: (dt) => { if (running) { t += dt; left = Math.max(0, dur - (performance.now() - t0) / 1000); } inst.update(dt, t, running); },
    };
    const prevView = this.stage.view;
    this.stage.setView(view);
    root.innerHTML = `<div class="mg-hud"><div class="mg-name">${esc(def.name)}</div><div class="mg-time" id="mgTime">${def.untimed ? '' : dur}</div></div><div class="mg-big" id="mgBig"></div><div class="mg-board" id="mgBoard"></div>`;
    const big = root.querySelector('#mgBig');

    // ----- controls + countdown -----
    const pads = players.map((p) => this.hub.live(p, { title: def.name, body: def.padText || '', ...def.pad }, (m) => { if (running) inst.input(p, m); }));
    for (const n of ['3', '2', '1']) { big.textContent = n; this.sfx.play('beep'); await sleep(800 * this.speed); }
    big.textContent = 'GO!'; this.sfx.play('go');
    running = true;
    t0 = performance.now();
    setTimeout(() => { if (big.textContent === 'GO!') big.textContent = ''; }, 700);
    const timeEl = root.querySelector('#mgTime'), boardEl = root.querySelector('#mgBoard');
    // the side scoreboard: rows built once, then only the numbers and the order change
    boardEl.innerHTML = players.map((p) => `<div style="--pc:${p.color}"><img src="${faceDataUrl(p, 'neutral')}" alt=""><b>${esc(p.name)}</b><span>0</span></div>`).join('');
    const rows = players.map((p, i) => ({ p, el: boardEl.children[i], num: boardEl.children[i].lastChild, shown: '0', order: -1 }));
    let timeShown = '';
    await new Promise((resolve) => {
      const tick = setInterval(() => {
        left = Math.max(0, dur - (performance.now() - t0) / 1000);
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
    pads.forEach((h) => h.close());
    this.sfx.play('go');
    big.textContent = 'TIME!';
    await sleep(1200 * this.speed);

    // ----- results -----
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
    inst.dispose?.();
    // back to whatever was showing before, then free the minigame's geometry, textures and shaders
    // (a long night of minigames used to pile them up until the TV's browser choked)
    if (this.stage.view === view) this.stage.setView(prevView);
    this.stage.disposeScene(inst.scene, extras);
    root.classList.add('hidden');
    root.innerHTML = '';
    this.hud.show(true);
    return placings;
  }
}
