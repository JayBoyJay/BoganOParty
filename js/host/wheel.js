// The minigame wheel. Before each minigame a big wheel of games spins on the TV, and one random
// player is put "on the wheel": they can hold BRAKE to slow it early, or BLOW to nudge it on a bit
// when it's nearly stopped. Help everyone, or cheat for the game you're good at.
//
// The wheel only holds games nobody has played yet (remembered on this TV between nights). Once
// there aren't enough fresh ones to fill it, the games played longest ago come back round.
import { MINIGAMES, MINIGAME_BY_ID } from '../content/minigames/index.js';
import { faceDataUrl } from './doll.js';

export const MG_EMOJI = {
  'plane-instructor': '✈️', 'chads-japanese-adventure': '⛩️', 'great-biscuit-heist': '🍪', 'burger-boys': '🍔', 'marble-mayhem': '🔮',
  'joe-master': '🤼', 'toy-cars': '🏎️', 'ripstick-rider': '🛹', 'alans-farm': '🐑', 'back-yard': '🏋️', 'just-a-trim': '✂️',
  'dubai-high-flyer': '🛩️', 'mine-your-own-business': '⛏️', 'perfect-pour': '🍺', 'like-my-post': '❤️', 'distro-wars': '🐧', draw: '🤠',
  'thong-throw': '🩴', 'sausage-sizzle': '🌭', 'esky-tetris': '🧊', 'wheelie-bin-derby': '🗑️', 'two-up': '🪙', 'sunscreen-slap': '🧴',
  'footy-kick-to-kick': '🏉', 'bottle-o-run': '🛒', 'ute-muster': '🛻', 'fishing-off-the-jetty': '🎣', 'zombies-vs-plants': '🧟',
  'football-boy': '💣', 'hand-tennis': '✋',
};

const SEGS = 8; // games on the wheel
const KEY = 'bogan-o-party.mgPlayed';
const COLS = ['#e63946', '#f4a261', '#2a9d8f', '#e9c46a', '#457b9d', '#ff7aa2', '#8ac926', '#9b5de5'];
// spin physics, in radians: drag = K0 + K1 * speed, so it slows quickly at first then creeps
const K0 = 0.45, K1 = 0.3, BRAKE = 3.2, FUEL = 1.6, PUFF = 0.85, PUFFS = 2;
const TAU = Math.PI * 2;
const mod = (a, n) => ((a % n) + n) % n;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// play history, oldest first, kept on this TV
export function loadPlayed() { try { return JSON.parse(localStorage.getItem(KEY) || '[]').filter((id) => MINIGAME_BY_ID[id]); } catch { return []; } }
export function markPlayed(id) {
  const h = loadPlayed().filter((x) => x !== id);
  h.push(id);
  try { localStorage.setItem(KEY, JSON.stringify(h)); } catch { /* private window: forget it */ }
}

// which games go on the wheel: fresh ones first, topped up with the longest-ago played
export function wheelGames(pool = MINIGAMES, rng = Math.random, played = loadPlayed()) {
  const fresh = pool.filter((m) => !played.includes(m.id));
  for (let i = fresh.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [fresh[i], fresh[j]] = [fresh[j], fresh[i]]; }
  const games = fresh.slice(0, SEGS).map((def) => ({ def, back: false }));
  for (const id of played) {
    if (games.length >= Math.min(SEGS, pool.length)) break;
    const def = pool.find((m) => m.id === id);
    if (def && !games.some((g) => g.def === def)) games.push({ def, back: true });
  }
  // shuffle so the returning games aren't all bunched together
  for (let i = games.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [games[i], games[j]] = [games[j], games[i]]; }
  return games;
}

// how far the wheel still turns from speed v with no help
const coast = (v) => { const c = K0 / K1; return v <= 0 ? 0 : (v - c * Math.log(1 + v / c)) / K1; };

export async function spinWheel({ root, hub, sfx, players, games, rng = Math.random, speed = 1, label = 'Minigame' }) {
  if (games.length === 1) return games[0].def;
  const n = games.length, seg = TAU / n;
  const helper = players[Math.floor(rng() * players.length)];
  root.classList.remove('hidden');
  root.innerHTML = `<div class="wheel-wrap">
    <div class="wheel-title"><div class="label">${esc(label)}</div><h1>Spin the wheel!</h1></div>
    <div class="wheel-box"><canvas id="wheelC"></canvas></div>
    <div class="wheel-helper" style="--pc:${helper.color}"><img src="${faceDataUrl(helper, 'happy')}" alt=""><div><div class="label">On the wheel</div><b>${esc(helper.name)}</b>
      <div class="wh-how">Hold 🛑 BRAKE to slow it · 💨 BLOW to nudge it on</div>
      <div class="wh-fuel"><i id="whFuel"></i></div><div class="wh-puffs" id="whPuffs"></div></div></div>
    <div class="wheel-call" id="whCall"></div></div>`;
  const cv = root.querySelector('#wheelC'), g = cv.getContext('2d');
  const fuelEl = root.querySelector('#whFuel'), puffEl = root.querySelector('#whPuffs'), callEl = root.querySelector('#whCall');
  const size = () => { const r = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d); };
  size();

  let a = rng() * TAU, v = 7.5 + rng() * 3, fuel = FUEL, puffs = PUFFS, braking = false, gust = 0, stopped = false, lastPeg = Math.floor(a / seg), flap = 0;
  const puffFx = [];
  const blow = () => {
    if (puffs <= 0 || stopped) return;
    puffs--; v += PUFF; gust = 1; sfx.play('whoosh');
    for (let i = 0; i < 6; i++) puffFx.push({ x: -0.9 - Math.random() * 0.3, y: -0.8 + Math.random() * 0.5, t: 0, s: 0.7 + Math.random() * 0.6 });
    call(`💨 ${helper.name} blows it on!`);
  };
  let callT = null;
  const call = (txt) => { callEl.textContent = txt; callEl.classList.add('on'); clearTimeout(callT); callT = setTimeout(() => callEl.classList.remove('on'), 1400); };
  const others = players.filter((p) => p !== helper);
  hub.idleAll('🎡 Spinning for the minigame', `${helper.name} is on the wheel`, others);
  const pad = hub.live(helper, {
    kind: 'buttons', title: "🎡 You're on the wheel!", body: 'Hold BRAKE to stop it sooner. BLOW nudges it on a bit (2 puffs). Help your mates, or cheat.',
    buttons: [{ id: 'brake', label: '🛑 HOLD TO BRAKE', color: '#ff6b6b', tall: true, hold: true }, { id: 'blow', label: '💨 BLOW', color: '#8fd8ff', tall: true }],
  }, (m) => {
    if (m.b === 'brake') { braking = m.down !== false; if (braking && fuel > 0) call(`🛑 ${helper.name} hits the brake!`); }
    if (m.b === 'blow') blow();
  });
  // a CPU on the wheel quietly works toward a favourite
  const fav = Math.floor(rng() * n);
  const need = () => mod(-Math.PI / 2 - (fav + 0.5) * seg - a, TAU); // turn left before fav sits under the pointer
  const botThink = () => {
    if (!helper.bot || stopped) return;
    const d = coast(v), left = need();
    braking = v < 3 && fuel > 0 && left < d && d - left > seg * 0.3;
    if (v < 0.12 && puffs > 0 && left > seg * 0.3 && left < seg * 1.2 && rng() < 0.05) blow();
  };

  const draw = (t) => {
    const W = cv.width, H = cv.height, R = Math.min(W, H) / 2 - 6, cx = W / 2, cy = H / 2 + R * 0.02;
    g.clearRect(0, 0, W, H);
    // rim
    g.fillStyle = '#4a2410'; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
    g.fillStyle = '#7a3c18'; g.beginPath(); g.arc(cx, cy, R * 0.965, 0, TAU); g.fill();
    const r = R * 0.9, under = Math.floor(mod(-Math.PI / 2 - a, TAU) / seg);
    for (let i = 0; i < n; i++) {
      const a0 = a + i * seg, a1 = a0 + seg, { def, back } = games[i];
      g.fillStyle = COLS[i % COLS.length]; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r, a0, a1); g.closePath(); g.fill();
      if (back) { g.save(); g.clip(); g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = r * 0.04; for (let k = -12; k < 12; k++) { g.beginPath(); g.moveTo(cx + k * r * 0.12 - r, cy - r); g.lineTo(cx + k * r * 0.12 + r, cy + r); g.stroke(); } g.restore(); }
      if (stopped && i === under) { g.fillStyle = `rgba(255,255,255,${0.25 + 0.25 * Math.sin(t * 10)})`; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r, a0, a1); g.closePath(); g.fill(); }
      // label along the middle of the slice, reading outward
      g.save(); g.translate(cx, cy); g.rotate(a0 + seg / 2);
      g.textBaseline = 'middle'; g.textAlign = 'right';
      g.font = `${Math.round(r * 0.13)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      g.fillText(MG_EMOJI[def.id] || '🎮', r * 0.97, 0);
      let fs = r * 0.085;
      g.font = `900 ${fs}px system-ui, sans-serif`;
      const room = r * 0.58, w = g.measureText(def.name).width;
      if (w > room) { fs *= room / w; g.font = `900 ${fs}px system-ui, sans-serif`; }
      g.lineWidth = fs * 0.22; g.strokeStyle = 'rgba(30,12,4,0.75)'; g.lineJoin = 'round';
      g.strokeText(def.name, r * 0.8, back ? -fs * 0.25 : 0); g.fillStyle = '#fff'; g.fillText(def.name, r * 0.8, back ? -fs * 0.25 : 0);
      if (back) { g.font = `800 ${Math.round(r * 0.04)}px system-ui, sans-serif`; g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillText('↺ BACK AGAIN', r * 0.8, fs * 0.75); }
      g.restore();
    }
    // pegs between slices and bulbs round the rim
    for (let i = 0; i < n; i++) { const ang = a + i * seg; g.fillStyle = '#f6e7c8'; g.beginPath(); g.arc(cx + Math.cos(ang) * r * 0.985, cy + Math.sin(ang) * r * 0.985, R * 0.022, 0, TAU); g.fill(); }
    for (let i = 0; i < 32; i++) {
      const ang = (i / 32) * TAU, on = (Math.floor(t * 4) + i) % 2 === 0 || stopped && Math.floor(t * 8) % 2 === 0;
      g.fillStyle = on ? '#fff3b0' : '#8a6a3a'; g.beginPath(); g.arc(cx + Math.cos(ang) * R * 0.95, cy + Math.sin(ang) * R * 0.95, R * 0.014, 0, TAU); g.fill();
    }
    // hub
    g.fillStyle = '#2b1408'; g.beginPath(); g.arc(cx, cy, r * 0.2, 0, TAU); g.fill();
    g.fillStyle = '#ffcf3f'; g.beginPath(); g.arc(cx, cy, r * 0.17, 0, TAU); g.fill();
    g.fillStyle = '#2b1408'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `900 ${r * 0.06}px system-ui, sans-serif`;
    g.fillText('BOGAN-O', cx, cy - r * 0.035); g.fillText('PARTY', cx, cy + r * 0.04);
    // the flapper at the top, kicked sideways by each peg
    g.save(); g.translate(cx, cy - R * 0.99); g.rotate(-flap * 0.5);
    g.fillStyle = '#fff'; g.strokeStyle = '#2b1408'; g.lineWidth = R * 0.012;
    g.beginPath(); g.moveTo(-R * 0.055, -R * 0.04); g.lineTo(R * 0.055, -R * 0.04); g.lineTo(0, R * 0.13); g.closePath(); g.fill(); g.stroke();
    g.restore();
    // brake pads glowing, and puffs of air
    if (braking && fuel > 0) for (const s of [-1, 1]) { g.fillStyle = `rgba(255,120,60,${0.5 + Math.random() * 0.4})`; g.beginPath(); g.arc(cx + s * R * 0.99, cy, R * 0.035, 0, TAU); g.fill(); }
    g.font = `${Math.round(R * 0.16)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    for (const p of puffFx) { g.globalAlpha = Math.max(0, 1 - p.t); g.fillText('💨', cx + (p.x + p.t * 0.9) * R, cy + p.y * R); }
    g.globalAlpha = 1;
  };

  // run the spin
  const t0 = performance.now();
  let prev = t0;
  await new Promise((resolve) => {
    let raf = 0;
    const finish = () => { cancelAnimationFrame(raf); resolve(); };
    const frame = (now) => {
      const dt = Math.max(0, Math.min(0.05, (now - prev) / 1000)) / speed; prev = now;
      const t = Math.max(0, now - t0) / 1000;
      botThink();
      if (!stopped) {
        const br = braking && fuel > 0;
        if (br) fuel = Math.max(0, fuel - dt);
        v = Math.max(0, v - (K0 + K1 * v + (br ? BRAKE : 0)) * dt);
        a += v * dt;
        const peg = Math.floor(a / seg);
        if (peg !== lastPeg) { lastPeg = peg; flap = 1; sfx.play('tick'); }
        if (v <= 0 && t > 1) {
          stopped = true;
          sfx.play('item');
          setTimeout(finish, 2200 * speed);
        }
      }
      flap *= Math.pow(0.002, dt);
      gust *= Math.pow(0.05, dt);
      for (const p of puffFx) p.t += dt * p.s;
      fuelEl.style.width = `${(fuel / FUEL) * 100}%`;
      puffEl.textContent = puffs ? '💨'.repeat(puffs) + ' left' : 'No puffs left';
      draw(t);
      if (stopped && !callEl.dataset.done) { callEl.dataset.done = '1'; const w = games[Math.floor(mod(-Math.PI / 2 - a, TAU) / seg)].def; call(`${MG_EMOJI[w.id] || '🎮'} ${w.name}!`); clearTimeout(callT); }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    window.__wheel = { games, helper, get v() { return v; }, get a() { return a; } }; // for tests
  });
  pad.close();
  const pick = games[Math.floor(mod(-Math.PI / 2 - a, TAU) / seg)].def;
  root.innerHTML = '';
  return pick;
}
