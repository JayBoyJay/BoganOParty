// Runs one minigame: title card, phones get their controls, countdown, play, results.
//
// A minigame file exports { id, name, blurb, howTo, duration, pad, create(mg) }. create() builds its
// own three.js scene and returns { scene, camera, update(dt, t), input(player, msg), scores() }.
// mg gives it: players, makeDoll(player, opts), rng, THREE, kit (see kit.js), sfx, timeLeft().
// Scores are numbers, higher is better; the runner turns them into placings and the board pays coins.
import * as THREE from 'three';
import { MINIGAMES } from '../content/minigames/index.js';
import { Doll, faceDataUrl } from './doll.js';
import { makeKit } from './kit.js';

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

  async run(players, def = this.pick()) {
    const root = this.root;
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
    const dur = this.speed < 1 ? Math.min(8, def.duration) : def.duration; // fast mode is for automated tests
    const scene = new THREE.Scene();
    const mg = {
      THREE, players, rng: this.rng, sfx: this.sfx, kit: makeKit(scene), scene,
      makeDoll: (p, opts) => new Doll(p, opts),
      timeLeft: () => left, duration: dur,
    };
    const inst = def.create(mg);
    inst.scene = inst.scene || scene;
    let left = dur, t = 0, t0 = 0, running = false;
    const view = {
      scene: inst.scene, camera: inst.camera,
      // the clock runs on real time, so a slow TV doesn't make the game drag on
      update: (dt) => { if (running) { t += dt; left = Math.max(0, dur - (performance.now() - t0) / 1000); } inst.update(dt, t, running); },
    };
    this.stage.setView(view);
    root.innerHTML = `<div class="mg-hud"><div class="mg-name">${esc(def.name)}</div><div class="mg-time" id="mgTime">${dur}</div></div><div class="mg-big" id="mgBig"></div><div class="mg-board" id="mgBoard"></div>`;
    const big = root.querySelector('#mgBig');

    // ----- controls + countdown -----
    const pads = players.map((p) => this.hub.live(p, { title: def.name, body: def.padText || '', ...def.pad }, (m) => { if (running) inst.input(p, m); }));
    for (const n of ['3', '2', '1']) { big.textContent = n; this.sfx.play('beep'); await sleep(800 * this.speed); }
    big.textContent = 'GO!'; this.sfx.play('go');
    running = true;
    t0 = performance.now();
    setTimeout(() => { if (big.textContent === 'GO!') big.textContent = ''; }, 700);
    const timeEl = root.querySelector('#mgTime'), boardEl = root.querySelector('#mgBoard');
    await new Promise((resolve) => {
      const tick = setInterval(() => {
        left = Math.max(0, dur - (performance.now() - t0) / 1000);
        timeEl.textContent = Math.ceil(left);
        const sc = inst.scores();
        boardEl.innerHTML = [...players].sort((a, b) => (sc[b.id] || 0) - (sc[a.id] || 0))
          .map((p) => `<div style="--pc:${p.color}"><img src="${faceDataUrl(p, 'neutral')}" alt=""><b>${esc(p.name)}</b><span>${Math.round(sc[p.id] || 0)}</span></div>`).join('');
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
    root.classList.add('hidden');
    root.innerHTML = '';
    this.hud.show(true);
    return placings;
  }
}
