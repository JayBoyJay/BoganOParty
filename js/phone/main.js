// Phone remote. It only shows whatever screen the TV last sent and sends taps back;
// all game rules live on the TV (see js/host/hub.js for the message list).
import { PhoneNet } from '../net.js';
import { keepAwake } from './wakelock.js';
import { wantOrientation } from './orient.js';
import { mountMap, routeInfo, legendIcon, boardAspect } from './map.js';
import { SPACE } from '../board.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const store = {
  get(k) { try { return localStorage.getItem('bop:' + k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem('bop:' + k, v); } catch { /* private mode */ } },
};
const buzz = (p) => { try { navigator.vibrate?.(p); } catch { /* not supported */ } };
const MOOD_LABEL = { neutral: ['😐', 'Neutral'], happy: ['😁', 'Happy'], sad: ['😢', 'Sad'], angry: ['😡', 'Angry'] };

let pid = store.get('pid');
if (!/^[a-z0-9]{6,20}$/.test(pid || '')) { pid = Math.random().toString(36).slice(2, 12).padEnd(10, 'x'); store.set('pid', pid); }

let lobby = null; // last lobby view
let stats = null;
let board = null; // the board layout for the map (sent by the TV once a game)
let screen = null; // last prompt/pad/idle
let body = store.get('body') || 'smooth';
let hat = store.get('hat') || 'none';
let outfit = store.get('outfit') || '';

const net = new PhoneNet({
  onMsg,
  onStatus: (t) => { $('status').textContent = t; $('status').classList.toggle('hidden', !t); },
});
const send = (m) => net.send(m);
const sendFast = (m) => net.sendFast(m); // control positions: newest wins (see net.js)
net.start(pid);
// phones zoom on a pinch or a quick double tap, which wrecks a game pad mid-minigame: block both
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => { const now = Date.now(); if (now - lastTouchEnd < 350 && !e.target.closest('input, textarea, select')) e.preventDefault(); lastTouchEnd = now; }, { passive: false });
document.addEventListener('visibilitychange', () => { if (!document.hidden) net.reconnectNow(); });
keepAwake(); // stop the screen sleeping mid-game

let holdUntil = 0, heldT = 0;
// the 3D dice (three.js) load in the background once the game starts, so a roll shows them straight away
let rollMod = null;
const loadRoll = () => (rollMod ||= import('./roll.js').catch(() => { rollMod = null; return null; }));

function show(id) { for (const s of ['vConnect', 'vLobby', 'vGame']) $(s).classList.toggle('hidden', s !== id); if (id !== 'vGame') wantOrientation(null); }

function onMsg(m) {
  switch (m.t) {
    case 'welcome': if (!lobby && !screen) show('vConnect'); break;
    case 'nohost': $('status').textContent = 'The TV screen went away. Waiting for it…'; $('status').classList.remove('hidden'); break;
    case 'hostup': $('status').classList.add('hidden'); break;
    case 'kicked': show('vConnect'); $('vConnect').querySelector('p').textContent = 'You were removed from the lobby. Refresh to join again.'; break;
    case 'moved': show('vConnect'); $('vConnect').querySelector('p').textContent = 'This player is now open on another tab or phone.'; break;
    case 'lobby': lobby = m; screen = null; stats = null; closeMap(); renderLobby(); break;
    case 'stats': stats = m; renderBar(); mapsChanged(); break;
    case 'board': board = m; renderBar(); mapsChanged(); break;
    case 'prompt': case 'pad': case 'idle':
      screen = m;
      if (m.t !== 'idle') { buzz(25); closeMap(); } // something to do: get the map out of the way
      // let a thrown die finish flying off the top before the next screen replaces it
      clearTimeout(heldT);
      if (Date.now() < holdUntil) heldT = setTimeout(renderScreen, holdUntil - Date.now());
      else renderScreen();
      break;
    case 'padx':
      if (screen?.t !== 'pad' || screen.id !== m.id) break;
      if ('pin' in m) pinBar(m);
      if ('btn' in m) relabel(m);
      if ('rod' in m) rodSay?.(m);
      if ('map' in m) { screen.map = { ...screen.map, ...m.map }; miniMap?.redraw(); } // e.g. the grenade's aim marker
      if ('lit' in m) { const b = document.querySelector(`[data-b="${CSS.escape(m.lit)}"]`); b?.classList.toggle('lit', !!m.on); b?.classList.toggle('off', !m.on); } // e.g. Burger Boys' PISS button once the bar is full
      break;
  }
}

// ---------------- lobby ----------------
function renderLobby() {
  show('vLobby');
  const you = lobby.you;
  if (you.color) document.documentElement.style.setProperty('--pc', you.color);
  if (you.joined) { body = you.body; hat = you.hat || hat; outfit = you.outfit || outfit; if (document.activeElement !== $('name')) $('name').value = you.name; }
  else if (!$('name').value) $('name').value = store.get('name') || '';
  $('bodies').innerHTML = lobby.bodies.map((b) => `<button data-b="${b.id}" class="${b.id === body ? 'on' : ''}"><span class="e">${b.emoji}</span>${esc(b.label)}${b.sub ? `<small>${esc(b.sub)}</small>` : ''}</button>`).join('');
  for (const btn of $('bodies').querySelectorAll('button')) btn.onclick = () => { body = btn.dataset.b; store.set('body', body); sendProfile(); renderLobby(); };
  const picker = (el, list, cur, pick) => {
    $(el).innerHTML = (list || []).map((b) => `<button data-b="${b.id}" class="${b.id === cur ? 'on' : ''}"><span class="e">${b.emoji}</span>${esc(b.label)}${b.sub ? `<small>${esc(b.sub)}</small>` : ''}</button>`).join('');
    for (const btn of $(el).querySelectorAll('button')) btn.onclick = () => { pick(btn.dataset.b); sendProfile(); renderLobby(); };
  };
  picker('hats', lobby.hats, hat, (v) => { hat = v; store.set('hat', v); });
  picker('outfits', lobby.outfits, outfit || (body === 'bloke' || body === 'both' ? 'smugglers' : 'nude'), (v) => { outfit = v; store.set('outfit', v); });
  $('faces').innerHTML = lobby.moods.map((mood) => {
    const ph = you.photos?.[mood];
    return `<button data-m="${mood}"><div class="ph">${ph ? `<img src="${ph}" alt="">` : MOOD_LABEL[mood][0]}</div>${MOOD_LABEL[mood][1]}</button>`;
  }).join('');
  for (const btn of $('faces').querySelectorAll('button')) btn.onclick = () => openSheet(btn.dataset.m);
  $('mapName').textContent = lobby.map.name;
  $('mapItem').textContent = `${lobby.map.emoji} Collect the ${lobby.map.item}`;
  $('readyBtn').textContent = you.ready ? '✔ Ready! (tap to undo)' : "I'm ready!";
  $('readyBtn').classList.toggle('go', !you.ready);
  if (!you.joined && $('name').value.trim()) sendProfile();
}
let nameT = null;
$('name').oninput = () => { clearTimeout(nameT); nameT = setTimeout(sendProfile, 400); };
function sendProfile() {
  const name = $('name').value.trim();
  if (!name) return;
  store.set('name', name);
  send({ t: 'profile', name, body, hat, outfit: outfit || undefined });
}
$('readyBtn').onclick = () => {
  if (!$('name').value.trim()) { $('name').focus(); $('name').placeholder = 'Type your name first'; return; }
  sendProfile();
  send({ t: 'ready', v: !lobby?.you?.ready });
  buzz(30);
  askMotion(); // iPhones only allow tilt after a tap
};
$('mapBtn').onclick = () => {
  const i = lobby.maps.findIndex((m) => m.id === lobby.map.id);
  send({ t: 'settings', map: lobby.maps[(i + 1) % lobby.maps.length].id });
};

// ---------------- photos ----------------
const crop = { img: null, zoom: 1, ox: 0, oy: 0, drag: null, mood: 'neutral' };
function openSheet(mood) {
  crop.mood = mood; crop.img = null;
  $('sheetTitle').textContent = `${MOOD_LABEL[mood][0]} ${MOOD_LABEL[mood][1]} face`;
  $('cropArea').classList.add('hidden');
  $('clearBtn').classList.toggle('hidden', !lobby?.you?.photos?.[mood]);
  $('sheet').classList.remove('hidden');
}
const closeSheet = () => { $('sheet').classList.add('hidden'); $('camIn').value = ''; $('fileIn').value = ''; };
$('sheetClose').onclick = closeSheet;
$('takeBtn').onclick = () => $('camIn').click();
$('fileBtn').onclick = () => $('fileIn').click();
$('clearBtn').onclick = () => { send({ t: 'clear-photo', mood: crop.mood }); closeSheet(); };
for (const inp of [$('camIn'), $('fileIn')]) inp.onchange = () => { const f = inp.files?.[0]; if (f) loadFile(f); };
function loadFile(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const k = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    Object.assign(crop, { img: c, zoom: 1, ox: 0, oy: 0 });
    $('zoom').value = 1;
    $('cropArea').classList.remove('hidden');
    drawCrop();
  };
  img.onerror = () => { URL.revokeObjectURL(url); alert('Could not open that image. Try another one.'); };
  img.src = url;
}
function drawSquare(g, S) {
  const im = crop.img, base = Math.max(S / im.width, S / im.height) * crop.zoom;
  const w = im.width * base, h = im.height * base;
  const mx = (w - S) / 2 / S, my = (h - S) / 2 / S;
  crop.ox = Math.max(-mx, Math.min(mx, crop.ox)); crop.oy = Math.max(-my, Math.min(my, crop.oy));
  g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
  g.drawImage(im, (S - w) / 2 + crop.ox * S, (S - h) / 2 + crop.oy * S, w, h);
}
function drawCrop() {
  const cv = $('cropCv'), g = cv.getContext('2d'), S = cv.width;
  drawSquare(g, S);
  g.save(); g.fillStyle = 'rgba(0,0,0,0.55)'; g.beginPath(); g.rect(0, 0, S, S); g.arc(S / 2, S / 2, S / 2 - 6, 0, Math.PI * 2, true); g.fill('evenodd');
  g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 4; g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 6, 0, Math.PI * 2); g.stroke(); g.restore();
}
const box = $('cropBox');
box.addEventListener('pointerdown', (e) => { box.setPointerCapture(e.pointerId); crop.drag = { x: e.clientX, y: e.clientY, ox: crop.ox, oy: crop.oy }; });
box.addEventListener('pointermove', (e) => {
  if (!crop.drag || !crop.img) return;
  const r = box.getBoundingClientRect();
  crop.ox = crop.drag.ox + (e.clientX - crop.drag.x) / r.width; crop.oy = crop.drag.oy + (e.clientY - crop.drag.y) / r.height;
  drawCrop();
});
for (const ev of ['pointerup', 'pointercancel']) box.addEventListener(ev, () => { crop.drag = null; });
$('zoom').oninput = () => { crop.zoom = Number($('zoom').value); drawCrop(); };
$('useBtn').onclick = () => {
  if (!crop.img) return;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  drawSquare(c.getContext('2d'), 256);
  send({ t: 'photo', mood: crop.mood, data: c.toDataURL('image/jpeg', 0.82) });
  buzz([30, 30, 60]);
  closeSheet();
};

// ---------------- in game ----------------
function renderBar() {
  if (!stats) { $('bar').classList.add('hidden'); return; }
  $('bar').classList.remove('hidden');
  const canMap = !!(board && stats.where);
  $('bar').innerHTML = `<span class="nm">${esc(lobby?.you?.name || '')}</span><span>${stats.item.emoji} ${stats.items}/${stats.target}</span><span>🪙 ${stats.coins}</span>${canMap ? '<button class="mapbtn" id="mapOpen">🗺️ Map</button>' : ''}
    <div class="pus">${stats.powerups.length ? stats.powerups.map((p) => `${p.emoji} ${esc(p.name)}`).join(' · ') : 'No power-ups'}${stats.effects.map((e) => ` · 🍬 ${esc(e.name)} (${e.rounds})`).join('')}</div>`;
  if (canMap) $('mapOpen').onclick = () => { buzz(15); openMap(); };
}

// ---------------- the board map ----------------
// The 🗺️ Map button opens a bird's-eye view of the board: the way to the item, how many spaces it
// is, where everyone is, and what the spaces mean. Power-ups that pick a player or a space show the
// same map in their prompt (screen.map), with everyone on it.
let bigMap = null, miniMap = null;
const meId = () => stats?.you;
function mapOpts(extra = {}) {
  return { board, where: stats?.where, me: meId(), ...extra };
}
function openMap() {
  if (!board || !stats?.where) return;
  $('mapov').classList.remove('hidden');
  $('mapTitle').textContent = `🗺️ ${board.name}`;
  document.documentElement.style.setProperty('--map-ar', boardAspect(board).toFixed(3)); // portrait: the map box hugs the board
  if (!bigMap) bigMap = mountMap($('mapBox'), () => mapOpts({ route: routeInfo(board, stats?.where, meId())?.path, labels: true }));
  renderMapSide();
  bigMap.redraw();
}
function closeMap() {
  $('mapov').classList.add('hidden');
  bigMap?.destroy(); bigMap = null;
}
$('mapClose').onclick = closeMap;
function mapsChanged() {
  if (bigMap) { renderMapSide(); bigMap.redraw(); }
  miniMap?.redraw();
}
const spaces = (n) => `${n} space${n === 1 ? '' : 's'}`;
function renderMapSide() {
  const where = stats?.where, it = board.item, me = meId();
  const info = routeInfo(board, where, me);
  let html;
  if (where?.item == null) html = `<div class="rt"><b>The ${esc(it.name)} hasn't turned up yet.</b></div>`;
  else if (!info) html = `<div class="rt"><b>Can't find a way to the ${esc(it.name)}.</b></div>`;
  else if (info.steps === 0) html = `<div class="rt"><b>You're standing on the ${esc(it.emoji)} ${esc(it.name)}!</b></div>`;
  else {
    const next = info.forks[0];
    const turn = !next ? `Straight ahead, no turns to make.`
      : `${next.in === 0 ? 'At the fork right here' : `In ${spaces(next.in)}, at the fork`}, take <b>${next.side ? '↪' : '⬆'} ${esc(next.name)}</b>${next.sub ? ` <span class="dim">(${esc(next.sub)})</span>` : ''}.`;
    const later = info.forks.slice(1, 3).map((f) => `then ${f.side ? '↪' : '⬆'} ${esc(f.name)}`).join(', ');
    html = `<div class="rt"><div class="steps">${info.steps}</div><div><b>spaces to the ${esc(it.emoji)} ${esc(it.name)}</b><div class="dim">About ${info.rolls} roll${info.rolls === 1 ? '' : 's'} of the die</div></div></div>
      <div class="turnline">🧭 ${turn}${later ? ` <span class="dim">Then ${later.slice(5)}.</span>` : ''}</div>`;
  }
  if (it.price && stats) html += `<div class="dim cost">It costs ${it.price} 🪙. ${stats.coins >= it.price ? `You've got ${stats.coins}, enough to buy it.` : `You've got ${stats.coins}, so you need ${it.price - stats.coins} more.`}</div>`;
  // how far everyone else is from the item
  if (where?.item != null) {
    const rows = where.players.map((p) => ({ p, d: routeInfo(board, where, p.id)?.steps })).sort((a, b) => (a.d ?? 999) - (b.d ?? 999));
    html += `<div class="label">Everyone's walk to the ${esc(it.emoji)}</div><div class="who">${rows.map(({ p, d }) => `<div class="${p.id === me ? 'me' : ''}"><i style="background:${esc(p.color)}"></i><span>${esc(p.name)}${p.id === me ? ' (you)' : ''}</span><b>${d ?? '?'}</b></div>`).join('')}</div>`;
  }
  html += '<div class="label">What the map shows</div><div class="legend" id="mapLegend"></div>';
  $('mapSide').innerHTML = html;
  const youColor = where?.players?.find((p) => p.id === me)?.color || getComputedStyle(document.documentElement).getPropertyValue('--pc').trim();
  const legend = [
    ['start', 'Start'],
    ['blue', `Blue: ${SPACE.blue.label}`],
    ['red', `Red: ${SPACE.red.label}`],
    ['event', 'Event: something random happens'],
    ['shop', 'Shop: buy power-ups, even just passing'],
    [it.emoji, `The ${it.name}: walk past it to buy it`],
    ['🪙', 'Dropped coins: walk over to grab them (not the leader)'],
    ['you', 'You'],
    ['them', 'Another player (🎲 = their turn)'],
    ['route', 'Your quickest way to the item'],
  ];
  const lg = $('mapLegend');
  for (const [k, text] of legend) {
    const row = document.createElement('div');
    row.appendChild(legendIcon(k, k === 'you' ? youColor : '#9ad0ff'));
    const t = document.createElement('span'); t.textContent = text; row.appendChild(t);
    lg.appendChild(row);
  }
}
// a small map inside a prompt or pad. Taps: on a player picks them (if they're an option),
// on a space moves an aim marker there (pads with map.tap)
function addMiniMap(s, box) {
  if (!board || !stats?.where || !box) return;
  document.documentElement.style.setProperty('--map-ar', boardAspect(board).toFixed(3));
  miniMap = mountMap(box, () => mapOpts({ hl: s.map?.hl, cur: s.map?.cur, reach: s.map?.reach, tint: s.map?.tint, labels: true }), (hits, x, y) => {
    if (s.t === 'prompt') {
      const p = hits.playerAt(x, y);
      const b = p && $('screen').querySelector(`[data-o="${CSS.escape(p.id)}"]`);
      if (b && !b.disabled) b.click();
    } else if (s.map?.tap) {
      const sp = hits.spaceAt(x, y);
      if (sp != null) { send({ t: 'in', id: s.id, b: 'go', s: sp }); buzz(12); }
    }
  });
}

let timerT = null, tiltStop = null, rollStop = null;
function renderScreen() {
  show('vGame');
  renderBar();
  loadRoll();
  clearInterval(timerT);
  if (tiltStop) { tiltStop(); tiltStop = null; }
  if (rollStop) { rollStop(); rollStop = null; }
  miniMap?.destroy(); miniMap = null;
  const s = screen, el = $('screen');
  wantOrientation(padOrientation(s));
  // live pads take the whole screen (no scrolling), so they fit a phone held sideways
  $('vGame').classList.toggle('pad', (s.t === 'pad' && s.kind !== 'touchpad') || (s.t === 'prompt' && s.kind === 'roll'));
  if (s.t === 'prompt' && s.kind === 'roll') { renderRoll(s, el); return; }
  if (s.t === 'idle') {
    el.innerHTML = `<div class="idle"><div class="big">📺</div><h2>${esc(s.title || 'Watch the TV')}</h2><div class="dim">${esc(s.body || '')}</div></div>
      <div class="label">Send a face balloon to the TV</div><div class="emotes">${Object.entries(MOOD_LABEL).map(([m, [e]]) => `<button data-e="${m}">${e}</button>`).join('')}</div>`;
    for (const b of el.querySelectorAll('[data-e]')) b.onclick = () => { send({ t: 'emote', mood: b.dataset.e }); buzz(15); };
    return;
  }
  if (s.t === 'prompt') {
    const roll = s.kind === 'roll';
    const cls = roll || s.options.length === 1 ? 'one' : s.layout === 'list' ? 'list' : '';
    const withMap = s.map && board && stats?.where;
    const opts = `<div class="opts ${cls}">${s.options.map((o) => `<button data-o="${esc(o.id)}" class="${o.tone === 'go' ? 'go' : ''} ${roll ? 'roll' : ''}" ${o.disabled ? 'disabled' : ''}>${esc(o.label)}${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</button>`).join('')}</div>`;
    el.innerHTML = `<h1>${esc(s.title)}</h1>${s.body ? `<div class="dim">${esc(s.body)}</div>` : ''}${s.timer ? '<div class="timer"><i id="tbar"></i></div>' : '<div style="height:12px"></div>'}
      ${withMap ? `<div class="mapq"><div class="pmap" id="pmap"></div>${opts}</div>` : opts}`;
    for (const b of el.querySelectorAll('[data-o]')) b.onclick = () => {
      send({ t: 'answer', id: s.id, v: b.dataset.o });
      buzz(roll ? [40, 30, 80] : 20);
      miniMap?.destroy(); miniMap = null;
      el.innerHTML = `<div class="idle"><div class="big">${roll ? '🎲' : '👍'}</div><h2>${roll ? 'Rolling…' : 'Sent!'}</h2></div>`;
    };
    if (withMap) addMiniMap(s, $('pmap'));
    if (s.timer) startTimer(s.timer);
    return;
  }
  if (s.t === 'pad') {
    if (s.kind === 'tilt') renderTilt(s, el);
    else if (s.kind === 'stick') renderStick(s, el);
    else if (s.kind === 'slider') renderSlider(s, el);
    else if (s.kind === 'touchpad') renderTouchpad(s, el);
    else if (s.kind === 'gyro') renderGyro(s, el);
    else if (s.kind === 'rod') renderRod(s, el);
    else renderButtons(s, el);
    if (s.practice) practiceStrip(s, el);
  }
}

// which way the phone should be held for a screen: live game pads play sideways (a pad can ask with
// { hold: 'portrait' | 'landscape' }); menus, prompts and the dice roll work either way
const SIDEWAYS_KINDS = new Set(['stick', 'gyro', 'tilt', 'touchpad']);
function padOrientation(s) {
  if (s?.t !== 'pad') return null;
  if (s.hold === 'portrait' || s.hold === 'landscape') return s.hold;
  return s.sideways || SIDEWAYS_KINDS.has(s.kind) ? 'landscape' : null;
}

// A roll: the dice sit at the bottom of the screen; grab them and flick them up off the top to throw.
// If three.js won't load (or WebGL is off) it's the old ROLL button.
function renderRoll(s, el) {
  const n = s.dice || 1;
  const fallback = () => {
    el.innerHTML = `<h1>${esc(s.title)}</h1>${s.body ? `<div class="dim">${esc(s.body)}</div>` : ''}${s.timer ? '<div class="timer"><i id="tbar"></i></div>' : ''}
      <div class="opts one"><button data-o="roll" class="go roll">🎲 ROLL</button></div>`;
    el.querySelector('[data-o]').onclick = () => { send({ t: 'answer', id: s.id, v: 'roll' }); buzz([40, 30, 80]); el.innerHTML = '<div class="idle"><div class="big">🎲</div><h2>Rolling…</h2></div>'; };
  };
  el.innerHTML = `<div class="rollscr"><div class="rollhead"><b>${esc(s.title)}</b> <span class="dim">${esc(s.body || '')}</span></div>
    ${s.timer ? '<div class="timer"><i id="tbar"></i></div>' : ''}
    <div class="rollbox" id="rollBox"><div class="rollhint" id="rollHint"><span class="arrow">⇡</span>Grab the ${n > 1 ? 'dice' : 'die'} and flick ${n > 1 ? 'them' : 'it'} up to the top</div></div></div>`;
  if (s.timer) startTimer(s.timer);
  const me = s;
  loadRoll().then((mod) => {
    if (screen !== me) return; // moved on while it loaded
    let stop = null;
    try {
      stop = mod.mountRoll($('rollBox'), {
        dice: n, color: s.color || getComputedStyle(document.documentElement).getPropertyValue('--pc').trim() || '#ff7a3d',
        onThrow: (fling) => {
          send({ t: 'answer', id: s.id, v: 'roll', fling });
          buzz([30, 20, 60]);
          holdUntil = Date.now() + 700;
          const h = $('rollHint');
          if (h) { h.classList.add('thrown'); h.innerHTML = '📺 Watch the TV!'; }
        },
        onMiss: () => {
          buzz(15);
          const h = $('rollHint');
          if (h) { h.classList.remove('nudge'); void h.offsetWidth; h.classList.add('nudge'); h.innerHTML = `<span class="arrow">⇡</span>Harder! Flick ${n > 1 ? 'them' : 'it'} right up off the top`; }
        },
      });
    } catch { stop = null; }
    if (!stop) { fallback(); if (s.timer) { clearInterval(timerT); startTimer(s.timer); } return; }
    rollStop = stop;
  });
}

// Practice round: the controls work for real but nothing counts. A strip on top says so and has the
// READY button; the controls stay live after you press it, so you can keep mucking about.
const practiceReady = new Set(); // pad ids this phone has said READY on (kept if the pad is redrawn)
function practiceStrip(s, el) {
  const strip = document.createElement('div');
  strip.className = `pstrip ${s.kind === 'touchpad' ? 'float' : ''}`;
  const draw = () => {
    strip.classList.toggle('done', practiceReady.has(s.id));
    strip.innerHTML = practiceReady.has(s.id)
      ? '<span><b>✔ Ready!</b> Keep practising till everyone is</span>'
      : '<span><b>PRACTICE</b> nothing counts</span><button class="go">READY ✔</button>';
    const b = strip.querySelector('button');
    if (b) b.onpointerdown = (e) => { e.preventDefault(); practiceReady.add(s.id); send({ t: 'in', id: s.id, b: 'practice-ready' }); buzz([20, 40, 20]); draw(); };
  };
  draw();
  el.prepend(strip);
}

// Wide buttons get a row to themselves; runs of the others share rows of up to 4, evened out.
// A pad can also place buttons itself with { row: n }.
function padRows(buttons) {
  if (buttons.some((b) => Number.isInteger(b.row))) {
    const rows = [];
    for (const b of buttons) (rows[b.row || 0] ||= []).push(b);
    return rows.filter(Boolean);
  }
  const rows = [];
  let run = [];
  const flush = () => {
    const per = Math.ceil(run.length / Math.ceil(run.length / 4));
    for (let i = 0; i < run.length; i += per) rows.push(run.slice(i, i + per));
    run = [];
  };
  for (const b of buttons) { if (b.wide) { if (run.length) flush(); rows.push([b]); } else run.push(b); }
  if (run.length) flush();
  return rows;
}

// the TV can change what a pad button says mid-game, e.g. Marble Mayhem's power button showing the power you hold:
// { btn: id, label, sub?, color?, on } (on: 0 greys it out)
function relabel(m) {
  const b = document.querySelector(`[data-b="${CSS.escape(m.btn)}"]`);
  if (!b) return;
  b.innerHTML = `<span style="display:flex;flex-direction:column;align-items:center;line-height:1.1;">${esc(m.label || '')}${m.sub ? `<small style="font-size:0.5em;font-weight:700;opacity:0.85;margin-top:0.3em;">${esc(m.sub)}</small>` : ''}</span>`;
  // the power's colour as a glowing rim, so it doesn't blend into a neighbouring button of the same colour
  b.style.background = m.color ? '#1d1420' : ''; b.style.borderColor = m.color || ''; b.style.color = m.color || '';
  b.style.boxShadow = m.color ? `inset 0 0 0 3px ${m.color}, 0 0 18px ${m.color}88` : '';
  b.classList.toggle('off', !m.on);
}

// buttons in rows that stretch to fill the screen, so the same pad fits a phone held sideways or upright
function renderButtons(s, el) {
  const rows = padRows(s.buttons || []);
  const btn = (b) => `<button data-b="${esc(b.id)}" class="${b.tone === 'go' ? 'go' : ''} ${b.small ? 'small' : ''} ${b.off ? 'off' : ''}" style="${b.color ? `background:${b.color};border-color:transparent;color:#1a0d06;` : ''}">${esc(b.label)}</button>`;
  el.innerHTML = `<div class="btnpad"><div class="padhead"><b>${esc(s.title)}</b> <span class="dim">${esc(s.body || '')}</span>${s.sideways ? SIDEWAYS : ''}</div>
    ${s.timer ? '<div class="timer"><i id="tbar"></i></div>' : ''}
    ${s.lanes
    // a note highway like the one on the TV: each lane is a button, with its coloured pad down at the bottom
    ? `<div class="lanes">${s.buttons.map((b) => `<button data-b="${esc(b.id)}" class="lane" style="--lc:${b.color || 'var(--pc)'}"><i>${esc(b.label)}</i></button>`).join('')}</div>`
    : (() => {
      const prows = `<div class="prows">${rows.map((r) => `<div class="prow" style="flex:${r.some((b) => b.tall) ? 2 : r.every((b) => b.small) ? 0.7 : 1}">${r.map(btn).join('')}</div>`).join('')}</div>`;
      // power-ups that aim at the board show it, with everyone on it; tap a space to jump the marker there
      return s.map && board && stats?.where ? `<div class="padbody"><div class="pmap" id="pmap">${s.map.tap ? '<span class="maphint">Tap a space to aim there</span>' : ''}</div>${prows}</div>` : prows;
    })()}</div>`;
  if (s.map) addMiniMap(s, $('pmap'));
  const defs = new Map((s.buttons || []).map((b) => [String(b.id), b]));
  for (const b of el.querySelectorAll('[data-b]')) {
    const def = defs.get(b.dataset.b);
    // pads fire on touch-down, not on release: in action games every millisecond counts
    b.onpointerdown = (e) => {
      e.preventDefault();
      if (def?.hold) { b.setPointerCapture(e.pointerId); b.classList.add('dn'); send({ t: 'in', id: s.id, b: def.id, down: true }); }
      else send({ t: 'in', id: s.id, b: b.dataset.b });
      buzz(12);
    };
    // hold buttons also say when they're let go
    if (def?.hold) b.onpointerup = b.onpointercancel = () => { b.classList.remove('dn'); send({ t: 'in', id: s.id, b: def.id, down: false }); };
  }
  if (s.timer) startTimer(s.timer);
}

function startTimer(secs) {
  const t0 = Date.now();
  timerT = setInterval(() => {
    const bar = $('tbar');
    if (!bar) { clearInterval(timerT); return; }
    bar.style.transform = `scaleX(${Math.max(0, 1 - (Date.now() - t0) / 1000 / secs)})`;
  }, 100);
}

// ---------------- tilt controls ----------------
let motionOk = false;
async function askMotion() {
  if (motionOk) return true;
  try {
    const DM = window.DeviceMotionEvent;
    if (DM && typeof DM.requestPermission === 'function') motionOk = (await DM.requestPermission()) === 'granted';
    else motionOk = !!DM;
  } catch { motionOk = false; }
  return motionOk;
}

// a thumbstick on the left and held buttons on the right (fighting games). Sends the stick as x/y in
// -1..1 (y up) and the buttons as a bitmask of the ones held down: { b: 'stick', x, y, h }
// A pad with `tilt: true` also steers by tilting the phone (on by default, a button swaps back to the
// stick). Tilt sends the same { b: 'stick', x, y } as the thumb, so the game can't tell the difference.
function renderStick(s, el) {
  const nb = s.buttons?.length || 0;
  const canTilt = !!s.tilt;
  let tiltOn = canTilt && store.get('tiltmode') !== '0';
  el.innerHTML = `<div class="stickpad ${nb ? '' : 'nobtns'}"><div class="stickhead"><b>${esc(s.title)}</b> <span class="dim">${esc(s.body || '')}</span>${SIDEWAYS}</div>
    <div class="stickzone" id="stickzone"><div class="base"><i class="ar u"></i><i class="ar r"></i><i class="ar d"></i><i class="ar l"></i><div class="well"></div></div><div class="knob"><div class="cap"></div></div>
      ${canTilt ? `<div class="tiltview" id="tiltview"><div class="tiltwheel" id="tiltwheel"><i></i></div><div class="tiltnote" id="tiltnote">Tilt your phone like a steering wheel</div>
        <div class="tiltsmall"><button id="tiltperm" class="go hidden">Turn on tilt</button><button id="tiltctr">⌖ Centre</button></div></div>
        <button class="tiltswap" id="tiltswap"></button>` : ''}</div>
    <div class="stickbtns n${Math.min(nb, 4)}">${(s.buttons || []).map((b) => `<button data-bit="${b.bit}"${b.id ? ` data-b="${esc(b.id)}"` : ''} class="${b.tone === 'go' ? 'go' : ''} ${b.off ? 'off' : ''}">${esc(b.label)}</button>`).join('')}</div></div>`;
  let sx = 0, sy = 0, held = 0, lastSent = 0, last = '';
  const push = (force) => {
    const now = Date.now(), key = `${sx.toFixed(2)},${sy.toFixed(2)},${held}`;
    if (!force && (key === last || now - lastSent < 40)) return;
    last = key; lastSent = now;
    sendFast({ t: 'in', id: s.id, b: 'stick', x: +sx.toFixed(2), y: +sy.toFixed(2), h: held });
  };
  // A real joystick drawn in the middle of the zone, always on screen. Touch anywhere in the zone and the
  // knob follows your thumb out from the centre; let go and it springs back.
  const zone = $('stickzone'), base = zone.querySelector('.base'), knob = zone.querySelector('.knob');
  let sid = null, cx = 0, cy = 0, R = 60;
  const size = () => {
    const r = zone.getBoundingClientRect();
    const m = Math.min(r.width, r.height);
    const d = Math.max(90, Math.min(m * 0.86, m - 8, 320)) | 0;
    zone.style.setProperty('--d', d + 'px');
    cx = r.width / 2; cy = r.height / 2; R = d * 0.34;
  };
  size();
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(size) : null;
  ro?.observe(zone);
  const place = (dx, dy) => { knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`; };
  const move = (e) => {
    const r = zone.getBoundingClientRect();
    let dx = e.clientX - r.left - cx, dy = e.clientY - r.top - cy;
    const d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; }
    place(dx, dy);
    sx = dx / R; sy = -dy / R;
    push(false);
  };
  zone.onpointerdown = (e) => {
    if (tiltOn || e.target.closest('button')) return;
    e.preventDefault(); sid = e.pointerId; zone.setPointerCapture(sid);
    size(); zone.classList.add('on'); move(e);
  };
  zone.onpointermove = (e) => { if (e.pointerId === sid && !tiltOn) move(e); };
  const end = (e) => { if (e.pointerId !== sid) return; sid = null; sx = sy = 0; zone.classList.remove('on'); place(0, 0); push(true); };
  zone.onpointerup = end; zone.onpointercancel = end;
  let tiltDone = () => {};
  if (canTilt) tiltDone = stickTilt(zone, () => tiltOn, (on) => { tiltOn = on; sx = sy = 0; push(true); }, (x, y) => { sx = x; sy = y; push(false); });
  for (const b of el.querySelectorAll('[data-bit]')) {
    const bit = Number(b.dataset.bit);
    b.onpointerdown = (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add('dn'); held |= bit; push(true); buzz(12); };
    const up = () => { b.classList.remove('dn'); held &= ~bit; push(true); };
    b.onpointerup = up; b.onpointercancel = up;
  }
  const keep = setInterval(() => push(true), 200);
  tiltStop = () => { clearInterval(keep); ro?.disconnect(); tiltDone(); };
}

// Tilt steering for the stick pad. Uses deviceorientation's beta/gamma only (no compass, so no drift)
// and works out from them how far the screen's own left-right edge is rolled off level (steer, x) and
// how far its top edge leans forward from where it was at the start or on Centre (y, forward = up).
// That holds whichever way the phone is turned and however upright or flat it's held.
const TILT_FULL = 32, PITCH_FULL = 25, TILT_DEAD = 2.5; // degrees for a full push, and the slack in the middle
function stickTilt(zone, isOn, setOn, out) {
  const view = $('tiltview'), wheel = $('tiltwheel'), note = $('tiltnote'), swap = $('tiltswap'), perm = $('tiltperm');
  const D = Math.PI / 180;
  let got = false, ref = null, rx = 0, ry = 0, lastT = 0, waitT = 0;
  const shape = (a, full) => { const m = Math.max(0, Math.abs(a) - TILT_DEAD) / (full - TILT_DEAD); return Math.sign(a) * Math.min(1, m); };
  const paint = () => {
    const on = isOn();
    zone.classList.toggle('tilting', on);
    swap.textContent = on ? '🕹 Use the stick' : '📱 Use tilt';
  };
  const onOrient = (e) => {
    if (e.beta == null || e.gamma == null) return;
    if (!got) { got = true; motionOk = true; perm.classList.add('hidden'); note.textContent = 'Tilt your phone like a steering wheel'; }
    if (!isOn()) return;
    const cB = Math.cos(e.beta * D), sB = Math.sin(e.beta * D), cG = Math.cos(e.gamma * D), sG = Math.sin(e.gamma * D);
    const th = screenAngle() * D, st = Math.sin(th), ct = Math.cos(th);
    // height (world up) of the page's right and top edges and of the screen's face, from the spec's Z-X'-Y'' rotation
    const rightZ = -cB * sG * ct - sB * st, upZ = -cB * sG * st + sB * ct, faceZ = cB * cG;
    const roll = Math.asin(Math.max(-1, Math.min(1, rightZ))) / D; // right edge up = steering left
    const pitch = Math.atan2(upZ, faceZ) / D; // 90 = held upright, 0 = flat on its back
    if (ref == null) ref = pitch;
    const now = performance.now(), dt = lastT ? Math.min(0.1, (now - lastT) / 1000) : 0.016; lastT = now;
    const k = 1 - Math.exp(-dt * 18); // takes out hand shake without feeling laggy
    rx += (-roll - rx) * k; ry += (ref - pitch - ry) * k;
    const x = shape(rx, TILT_FULL), y = shape(ry, PITCH_FULL);
    wheel.style.transform = `rotate(${(x * TILT_FULL).toFixed(1)}deg) translateY(${(-y * 18).toFixed(1)}px)`;
    out(+x.toFixed(2), +y.toFixed(2));
  };
  addEventListener('deviceorientation', onOrient);
  // iPhones only send tilt after a button press asks for it
  const DO = window.DeviceOrientationEvent;
  const needsAsk = typeof DO?.requestPermission === 'function' || typeof window.DeviceMotionEvent?.requestPermission === 'function';
  if (!motionOk && needsAsk) {
    perm.classList.remove('hidden');
    perm.onclick = async () => {
      try { if (typeof DO?.requestPermission === 'function') await DO.requestPermission(); } catch { /* denied */ }
      await askMotion();
      if (motionOk) perm.classList.add('hidden');
    };
  }
  // no readings at all (a laptop, or tilt switched off in the browser): say so, the stick is a press away
  const check = () => { if (!got && isOn() && !needsAsk) note.textContent = 'No tilt on this phone. Use the stick instead.'; };
  waitT = setTimeout(check, 1500);
  $('tiltctr').onclick = () => { ref = null; rx = ry = 0; buzz(15); };
  swap.onclick = () => { const on = !isOn(); store.set('tiltmode', on ? '1' : '0'); ref = null; rx = ry = 0; setOn(on); paint(); buzz(15); };
  paint();
  return () => { removeEventListener('deviceorientation', onOrient); clearTimeout(waitT); };
}

// Joe Master's kick-out bar: covers the pad while you're pinned. The TV sends the bar; the phone runs its
// own copy and judges its own taps, so lag can't cost you: { b: 'pin', hit }
let PB = null;
function pinBar(m) {
  let ov = $('pinbar');
  if (!m.pin) { PB = null; ov?.remove(); return; }
  const now = performance.now();
  if (!ov) {
    ov = document.createElement('div'); ov.id = 'pinbar'; ov.className = 'pinbar';
    ov.innerHTML = `<div class="t">YOU'RE BEING PINNED!</div><div class="ptrack"><div class="pzone"></div><div class="pmark"></div></div><div class="pips"></div><div class="dim">TAP ANYWHERE WHEN THE MARKER IS IN THE GREEN</div>`;
    $('screen').appendChild(ov);
    buzz([60, 40, 60]);
    const mark = ov.querySelector('.pmark');
    const loop = () => {
      if (!PB || !ov.isConnected) { PB = null; return; }
      const t = performance.now(); mark.style.left = pinPos(t) * 100 + '%'; ov.classList.toggle('locked', t < PB.lockUntil);
      requestAnimationFrame(loop);
    };
    ov.onpointerdown = (e) => {
      e.preventDefault(); if (!PB) return;
      const t = performance.now(); if (t < PB.lockUntil) return;
      const hit = Math.abs(pinPos(t) - PB.c) <= PB.w / 2;
      send({ t: 'in', id: PB.id, b: 'pin', hit });
      PB.lockUntil = t + (hit ? 200 : 450);
      ov.classList.remove('hit', 'miss'); void ov.offsetWidth; ov.classList.add(hit ? 'hit' : 'miss');
      setTimeout(() => ov.classList.remove('hit', 'miss'), 300);
      buzz(hit ? 40 : 140);
    };
    PB = { lockUntil: 0 };
    requestAnimationFrame(loop);
  }
  PB = { ...m, t0: now, lockUntil: Math.max(PB ? PB.lockUntil : 0, now + (m.lock || 0) * 1000) };
  const zone = ov.querySelector('.pzone'); zone.style.left = (m.c - m.w / 2) * 100 + '%'; zone.style.width = m.w * 100 + '%';
  ov.querySelector('.pips').innerHTML = Array.from({ length: m.need > 1 ? m.need : 0 }, (_, i) => `<i class="${i < m.hits ? 'on' : ''}"></i>`).join('');
}
function pinPos(now) { const x = ((PB.ph + (now - PB.t0) / 1000 * PB.sp) % 2 + 2) % 2; return x < 1 ? x : 2 - x; }

// a tall slider you drag up and down with your thumb. Sends where it is, 0 (bottom) to 1 (top): { b: 'slide', v }
function renderSlider(s, el) {
  el.innerHTML = `<div class="sliderpad"><div class="slidehead"><h1>${esc(s.title)}</h1><div class="dim">${esc(s.body || '')}</div>
    <div class="dim hint">${esc(s.hint || 'Drag up and down')}</div>${s.sideways ? SIDEWAYS : ''}</div>
    <div class="vtrack" id="vtrack"><div class="vfill"></div><div class="vthumb">${esc(s.thumb || '')}</div></div></div>`;
  const tr = $('vtrack'), th = tr.querySelector('.vthumb'), fill = tr.querySelector('.vfill');
  let v = Number.isFinite(s.start) ? s.start : 1, lastSent = 0;
  const draw = () => { th.style.bottom = `calc(${v * 100}% - ${v * 64}px)`; fill.style.height = `${v * 100}%`; };
  const push = (force) => { const now = Date.now(); if (force || now - lastSent > 40) { lastSent = now; sendFast({ t: 'in', id: s.id, b: 'slide', v: +v.toFixed(3) }); } };
  const at = (e) => { const r = tr.getBoundingClientRect(); v = Math.max(0, Math.min(1, 1 - (e.clientY - r.top - 32) / (r.height - 64))); draw(); push(false); };
  let sid = null;
  tr.onpointerdown = (e) => { e.preventDefault(); sid = e.pointerId; tr.setPointerCapture(sid); at(e); buzz(10); };
  tr.onpointermove = (e) => { if (e.pointerId === sid) at(e); };
  tr.onpointerup = tr.onpointercancel = (e) => { if (e.pointerId === sid) { sid = null; push(true); } };
  draw();
  const keep = setInterval(() => push(true), 250);
  tiltStop = () => clearInterval(keep);
}

// how far the page is rotated from the phone's upright position, in degrees (0, 90, 180, 270)
function screenAngle() {
  const a = window.screen.orientation?.angle ?? window.orientation ?? 0;
  return ((Number(a) || 0) + 360) % 360;
}
// shown on portrait phones for pads that play better sideways (hidden by CSS in landscape)
const SIDEWAYS = '<div class="sideways">↻ Turn your phone sideways: it plays better</div>';

// Zombies vs Plants style aiming: the phone is held sideways and the screen is a map of the TV.
// Touch down = shoot at that spot ({ b: 'shot', x, y }, 0..1 from the top left); moving a held finger
// moves your crosshair ({ b: 'aim', x, y }). If the page is stuck upright (rotation lock on) it turns the
// pad itself, assuming the phone's top is to the left; FLIP covers the other way round.
function renderTouchpad(s, el) {
  let flip = store.get('tpflip') === '1';
  el.innerHTML = `<div class="tpad" id="tpad"><div class="tpbox" id="tpbox"><div class="tpgrid"></div><div class="tphint"><b>${esc(s.title)}</b><br>${esc(s.body || 'Your screen is the TV. Touch where you want to shoot.')}</div><div class="tpdot" id="tpdot"></div>
    <div class="tpcool" id="tpcool"></div></div><button id="tpflip" class="tpflipbtn">⇅ Flip</button><div class="tprot">Rotation lock on? Hold the phone with its top to the left, or press ⇅ Flip.</div></div>`;
  const pad = $('tpad'), box = $('tpbox'), dot = $('tpdot');
  const portrait = () => innerHeight > innerWidth;
  // fit a 16:9 box (the TV's shape) in the screen as the phone is held
  const layout = () => {
    const rot = portrait();
    pad.classList.toggle('rot', rot);
    const W = rot ? innerHeight : innerWidth, H = rot ? innerWidth : innerHeight;
    let w = W - 16, h = w * 9 / 16; if (h > H - 16) { h = H - 16; w = h * 16 / 9; }
    box.style.width = w + 'px'; box.style.height = h + 'px';
    box.style.transform = rot ? `translate(-50%, -50%) rotate(${flip ? -90 : 90}deg)` : 'translate(-50%, -50%)';
  };
  // pointer position -> 0..1 across the TV, using the box's own (unrotated) frame
  const at = (e) => {
    const r = box.getBoundingClientRect(), cx = (e.clientX - r.left) / r.width, cy = (e.clientY - r.top) / r.height;
    let x = cx, y = cy;
    if (portrait()) { x = flip ? 1 - cy : cy; y = flip ? cx : 1 - cx; }
    return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  };
  const show = (p) => { dot.style.left = p.x * 100 + '%'; dot.style.top = p.y * 100 + '%'; dot.style.display = 'block'; };
  let sid = null, lastSent = 0;
  pad.onpointerdown = (e) => {
    if (e.target.id === 'tpflip') return;
    e.preventDefault(); sid = e.pointerId; pad.setPointerCapture(sid);
    const p = at(e); show(p);
    send({ t: 'in', id: s.id, b: 'shot', x: +p.x.toFixed(3), y: +p.y.toFixed(3) }); buzz(25);
  };
  pad.onpointermove = (e) => {
    if (e.pointerId !== sid) return;
    const p = at(e); show(p);
    const now = Date.now(); if (now - lastSent > 40) { lastSent = now; sendFast({ t: 'in', id: s.id, b: 'aim', x: +p.x.toFixed(3), y: +p.y.toFixed(3) }); }
  };
  pad.onpointerup = pad.onpointercancel = (e) => { if (e.pointerId === sid) { sid = null; dot.style.display = 'none'; } };
  $('tpflip').onclick = () => { flip = !flip; store.set('tpflip', flip ? '1' : '0'); layout(); };
  layout();
  addEventListener('resize', layout);
  tiltStop = () => removeEventListener('resize', layout);
}

// Gyro aiming (Zombies vs Plants): point the phone at the TV like a spud gun. Uses the phone's own
// fused orientation (deviceorientation), so where the phone points is where the crosshair sits: no drift
// from adding up turn speeds, and the same pointing always gives the same spot. CENTRE (or the first
// reading) sets "pointing at the middle of the TV". Aims with the back of the phone, or its top edge
// when it's held flat like a controller. Dragging on the little TV nudges the aim (or is the whole aim
// on a phone without a gyro). Sends { b: 'aim', x, y } as it moves and { b: 'shot', x, y } on SHOOT.
const GYRO_SENS = [[40, 'Low'], [28, 'Med'], [18, 'High']]; // degrees of turn across the whole TV
function renderGyro(s, el) {
  let sens = Math.max(0, Math.min(2, Number(store.get('gyrosens') ?? 1) || 0));
  const label = s.buttons?.[0]?.label || 'SHOOT';
  el.innerHTML = `<div class="gyropad"><div class="stickhead"><b>${esc(s.title)}</b> <span class="dim">${esc(s.body || '')}</span>${SIDEWAYS}</div>
    <div class="gyrobox" id="gyrobox"><div class="tpgrid"></div><div class="gyrohint" id="gyrohint">No gyro yet: drag here to aim.</div><div class="tpdot" id="gyrodot" style="display:block"></div></div>
    <div class="gyrobtns"><button id="gyroshoot" class="go">${esc(label)}</button>
      <div class="gyrosmall"><button id="gyroperm" class="hidden">Turn on gyro aim</button><button id="gyroctr">⌖ Centre</button><button id="gyrosens"></button></div></div></div>`;
  const box = $('gyrobox'), dot = $('gyrodot'), hint = $('gyrohint');
  const clamp = (v) => Math.max(0, Math.min(1, v));
  let x = 0.5, y = 0.5, ox = 0, oy = 0, lastSent = 0, got = false;
  let ref = null; // { yaw, pitch, top } of the pose that means "middle of the TV"
  let yaw = 0, pitch = 0, sy = 0, sp = 0, lastT = 0;
  const draw = () => { dot.style.left = x * 100 + '%'; dot.style.top = y * 100 + '%'; };
  const push = (force) => {
    const now = Date.now(); if (!force && now - lastSent < 25) return;
    lastSent = now; sendFast({ t: 'in', id: s.id, b: 'aim', x: +x.toFixed(3), y: +y.toFixed(3) });
  };
  const showSens = () => { $('gyrosens').textContent = `Aim speed: ${GYRO_SENS[sens][1]}`; };
  showSens();
  const wrap = (a) => ((a + 540) % 360) - 180;
  const D = Math.PI / 180;
  // where the phone points, as compass-style yaw and up/down pitch (degrees). Built from the spec's
  // Z-X'-Y'' rotation, so it is right whichever way the phone is held or the page is turned.
  const pose = (e, top) => {
    const cA = Math.cos(e.alpha * D), sA = Math.sin(e.alpha * D), cB = Math.cos(e.beta * D), sB = Math.sin(e.beta * D), cG = Math.cos(e.gamma * D), sG = Math.sin(e.gamma * D);
    let vx, vy, vz;
    if (!top) { vx = -(cG * sA * sB + cA * sG); vy = -(sA * sG - cA * cG * sB); vz = -cB * cG; } // out the back
    else {
      // the screen's top edge (the page's "up"), for a phone held flat like a game controller
      const th = screenAngle() * D, ux = Math.sin(th), uy = Math.cos(th);
      vx = (cA * cG - sA * sB * sG) * ux - cB * sA * uy;
      vy = (cG * sA + cA * sB * sG) * ux + cA * cB * uy;
      vz = -cB * sG * ux + sB * uy;
    }
    return { yaw: Math.atan2(vx, vy) / D, pitch: Math.asin(Math.max(-1, Math.min(1, vz))) / D, back: -cB * cG };
  };
  const onOrient = (e) => {
    if (e.alpha == null || e.beta == null || e.gamma == null) return;
    if (!got) { got = true; motionOk = true; $('gyroperm').classList.add('hidden'); hint.textContent = 'Point at the middle of the TV and press Centre. Drag to nudge.'; }
    if (!ref) {
      // lying flatter than ~30 degrees from flat: aim with the top edge instead of the back
      const p0 = pose(e, false), top = Math.abs(p0.back) > 0.87;
      const p = pose(e, top); ref = { yaw: p.yaw, pitch: p.pitch, top }; ox = oy = 0; yaw = sy = 0; pitch = sp = 0;
    }
    const p = pose(e, ref.top);
    yaw = wrap(p.yaw - ref.yaw); pitch = p.pitch - ref.pitch;
    // a light low-pass takes out hand shake without feeling laggy
    const now = performance.now(), dt = lastT ? Math.min(0.1, (now - lastT) / 1000) : 0.016; lastT = now;
    const k = 1 - Math.exp(-dt * 22);
    sy += wrap(yaw - sy) * k; sp += (pitch - sp) * k;
    const span = GYRO_SENS[sens][0];
    x = clamp(0.5 + sy / span + ox); y = clamp(0.5 - sp / (span * 9 / 16) + oy);
    draw(); push(false);
  };
  addEventListener('deviceorientation', onOrient);
  // iPhones ask for motion access once, from a button press
  const DO = window.DeviceOrientationEvent;
  if (!motionOk && (typeof DO?.requestPermission === 'function' || typeof window.DeviceMotionEvent?.requestPermission === 'function')) {
    $('gyroperm').classList.remove('hidden');
    $('gyroperm').onclick = async () => {
      try { if (typeof DO?.requestPermission === 'function') await DO.requestPermission(); } catch { /* denied */ }
      await askMotion();
      if (motionOk) $('gyroperm').classList.add('hidden');
    };
  }
  // drag on the little TV: a nudge on top of the gyro, or the whole aim without one
  let sid = null, px = 0, py = 0;
  box.onpointerdown = (e) => { e.preventDefault(); sid = e.pointerId; box.setPointerCapture(sid); px = e.clientX; py = e.clientY; };
  box.onpointermove = (e) => {
    if (e.pointerId !== sid) return;
    const rc = box.getBoundingClientRect(), dx = (e.clientX - px) / rc.width * 1.3, dy = (e.clientY - py) / rc.height * 1.3;
    px = e.clientX; py = e.clientY;
    const nx = clamp(x + dx), ny = clamp(y + dy);
    ox += nx - x; oy += ny - y; x = nx; y = ny;
    draw(); push(false);
  };
  box.onpointerup = box.onpointercancel = (e) => { if (e.pointerId === sid) sid = null; };
  const shoot = $('gyroshoot');
  shoot.onpointerdown = (e) => {
    e.preventDefault(); shoot.classList.add('dn');
    send({ t: 'in', id: s.id, b: 'shot', x: +x.toFixed(3), y: +y.toFixed(3) }); buzz(25);
  };
  shoot.onpointerup = shoot.onpointercancel = shoot.onpointerleave = () => shoot.classList.remove('dn');
  // CENTRE: wherever the phone points now is the middle of the TV
  $('gyroctr').onclick = () => { ref = null; ox = oy = 0; x = 0.5; y = 0.5; draw(); push(true); buzz(15); };
  $('gyrosens').onclick = () => { sens = (sens + 1) % GYRO_SENS.length; store.set('gyrosens', String(sens)); showSens(); };
  draw(); push(true);
  const keep = setInterval(() => push(true), 250);
  tiltStop = () => { removeEventListener('deviceorientation', onOrient); clearInterval(keep); };
}

// Fishing rod (Fishing Off the Jetty). The phone is the rod and the screen is the reel:
//  - flick the phone forward (top edge away from you) to cast: a harder flick goes further { b: 'cast', v: 0..1 }
//  - when the TV says there's a bite, pull the phone back towards you to hook it { b: 'hook' }
//  - wind the reel handle round in circles with your thumb to reel in { b: 'crank', v: turns a second }
// The flick and pull come from how fast the screen's top edge tips forward or back (deviceorientation
// beta/gamma, so no compass). A phone without motion gets CAST / HOOK buttons instead.
// The TV tells the pad what's happening with { rod: 'ready' | 'wait' | 'bite' | 'fight' | 'run' | 'rig' }.
let rodSay = null;
const ROD_TXT = {
  ready: ['🎣 FLICK TO CAST', 'Flick the phone forward. Harder goes further'],
  flying: ['…', ''], wait: ['WAITING…', 'Watch your float'],
  bite: ['BITE! PULL BACK!', 'Yank the phone back towards you'],
  fight: ['WIND THE REEL', 'Circle your thumb round the reel'], run: ["IT'S RUNNING! STOP WINDING", 'Let the line go slack'],
  rig: ['NEW BAIT', ''],
};
function renderRod(s, el) {
  el.innerHTML = `<div class="rodpad"><div class="padhead"><b>${esc(s.title)}</b> <span class="dim">${esc(s.body || '')}</span></div>
    <div class="rodmain"><div class="rodsay" id="rodsay"><h2 id="rodbig"></h2><div class="dim" id="rodsmall"></div>
      <div class="rodbtns"><button id="rodperm" class="go hidden">Turn on motion</button><button id="rodcast" class="go hidden">🎣 CAST</button><button id="rodhook" class="hidden">🪝 HOOK</button></div></div>
    <div class="reel" id="reel"><div class="reelplate"><i></i><i></i><i></i></div><div class="reelarm" id="reelarm"><b></b></div><div class="reelhint">WIND</div></div></div></div>`;
  const reel = $('reel'), arm = $('reelarm'), big = $('rodbig'), small = $('rodsmall');
  let state = 'ready';
  const say = () => { const [b, t] = ROD_TXT[state] || ['', '']; big.textContent = b; small.textContent = noMotion && state === 'ready' ? 'Press CAST' : noMotion && state === 'bite' ? 'Press HOOK' : t; $('rodsay').dataset.s = state; };
  rodSay = (m) => { const was = state; state = m.rod; if (state === 'bite' && was !== 'bite') buzz([60, 40, 60]); say(); };
  // ----- the reel: angle of your thumb round the centre, turned into turns a second -----
  let sid = null, lastA = null, spin = 0, ang = 0, lastSent = 0, lastMove = 0;
  const angleAt = (e) => { const r = reel.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)); };
  const sendCrank = (force) => { const now = Date.now(); if (!force && now - lastSent < 80) return; lastSent = now; sendFast({ t: 'in', id: s.id, b: 'crank', v: +spin.toFixed(2) }); };
  reel.onpointerdown = (e) => { e.preventDefault(); sid = e.pointerId; reel.setPointerCapture(sid); lastA = angleAt(e); lastMove = performance.now(); };
  reel.onpointermove = (e) => {
    if (e.pointerId !== sid) return;
    const a = angleAt(e), now = performance.now();
    let d = a - lastA; d = ((d + Math.PI * 3) % (Math.PI * 2)) - Math.PI; lastA = a;
    ang += d;
    const dt = Math.max(0.008, (now - lastMove) / 1000); lastMove = now;
    const rate = Math.abs(d) / (Math.PI * 2) / dt; // either way round winds it in
    spin += (Math.min(4, rate) - spin) * Math.min(1, dt * 8);
    arm.style.transform = `rotate(${ang}rad)`;
    sendCrank(false);
  };
  const stop = (e) => { if (e.pointerId !== sid) return; sid = null; spin = 0; sendCrank(true); };
  reel.onpointerup = stop; reel.onpointercancel = stop;
  // a thumb resting still on the reel isn't winding
  const keep = setInterval(() => { if (sid != null && performance.now() - lastMove > 150) spin *= 0.5; if (sid != null || spin) sendCrank(true); }, 120);
  // ----- the flick and the pull: how fast the top edge tips -----
  const D = Math.PI / 180;
  let got = false, lastP = null, lastT = 0, rate = 0, peak = 0, dir = 0, quietT = 0, noMotion = false;
  const FLICK = 220, END = 90; // degrees a second to count as a flick, and to call it over
  const onOrient = (e) => {
    if (e.beta == null || e.gamma == null) return;
    if (!got) { got = true; motionOk = true; noMotion = false; $('rodperm').classList.add('hidden'); for (const id of ['rodcast', 'rodhook']) $(id).classList.add('hidden'); say(); }
    const cB = Math.cos(e.beta * D), sB = Math.sin(e.beta * D), cG = Math.cos(e.gamma * D), sG = Math.sin(e.gamma * D);
    const th = screenAngle() * D, st = Math.sin(th), ct = Math.cos(th);
    const upZ = -cB * sG * st + sB * ct, faceZ = cB * cG;
    const p = Math.atan2(upZ, faceZ) / D, now = performance.now() / 1000;
    if (lastP != null) {
      const dt = Math.max(0.005, now - lastT);
      let dp = p - lastP; dp = ((dp + 540) % 360) - 180;
      rate = rate * 0.4 + (dp / dt) * 0.6; // + = top coming back towards you, - = tipping forward
      if (now < quietT) { /* settling after the last one */ }
      else if (!dir && Math.abs(rate) > FLICK) { dir = Math.sign(rate); peak = Math.abs(rate); }
      else if (dir) {
        if (Math.sign(rate) === dir) peak = Math.max(peak, Math.abs(rate));
        if (Math.sign(rate) !== dir || Math.abs(rate) < END) {
          if (dir < 0) {
            send({ t: 'in', id: s.id, b: 'cast', v: +Math.min(1, Math.max(0.08, (peak - FLICK) / 650)).toFixed(2) }); buzz(30);
            dir = 0; quietT = now + 0.45; // a flick bounces back: don't read the bounce as a pull
          } else {
            send({ t: 'in', id: s.id, b: 'hook' }); if (state === 'bite') buzz(40);
            // a pull back is often the wind-up for a cast, so a flick forward can follow straight on
            dir = Math.abs(rate) > FLICK && rate < 0 ? -1 : 0; peak = Math.abs(rate);
          }
        }
      }
    }
    lastP = p; lastT = now;
  };
  addEventListener('deviceorientation', onOrient);
  const DO = window.DeviceOrientationEvent;
  const needsAsk = typeof DO?.requestPermission === 'function' || typeof window.DeviceMotionEvent?.requestPermission === 'function';
  if (!motionOk && needsAsk) {
    $('rodperm').classList.remove('hidden');
    $('rodperm').onclick = async () => {
      try { if (typeof DO?.requestPermission === 'function') await DO.requestPermission(); } catch { /* denied */ }
      await askMotion();
      if (motionOk) $('rodperm').classList.add('hidden');
    };
  }
  // no motion at all: buttons instead
  const fallback = () => {
    if (got || needsAsk) return;
    noMotion = true; say();
    $('rodcast').classList.remove('hidden'); $('rodhook').classList.remove('hidden');
  };
  const waitT = setTimeout(fallback, 1500);
  $('rodcast').onclick = () => { send({ t: 'in', id: s.id, b: 'cast', v: 0.5 + Math.random() * 0.5 }); buzz(30); };
  $('rodhook').onclick = () => { send({ t: 'in', id: s.id, b: 'hook' }); buzz(30); };
  say();
  tiltStop = () => { removeEventListener('deviceorientation', onOrient); clearInterval(keep); clearTimeout(waitT); rodSay = null; };
}

function renderTilt(s, el) {
  let invert = store.get('invert') === '1';
  el.innerHTML = `<div class="tiltbox"><div class="tilthead"><h1>${esc(s.title)}</h1><div class="dim">${esc(s.body || 'Hold your phone sideways and tilt it like a steering wheel')}</div>${SIDEWAYS}</div>
    <div class="wing"><div class="plane" id="plane"></div></div><div class="tiltctl">
    <button id="perm" class="go wide hidden">Turn on tilt</button>
    <div class="label">No tilt? Slide instead</div><input type="range" id="slide" min="-55" max="55" step="1" value="0">
    <div style="height:10px"></div><button id="inv" class="wide">${invert ? 'Tilt is flipped ↔' : 'Flip tilt direction ↔'}</button>
    ${s.buttons?.length ? `<div style="height:12px"></div><div class="opts">${s.buttons.map((b) => `<button data-b="${esc(b.id)}" class="${b.tone === 'go' ? 'go' : ''} ${b.wide ? 'full' : ''}">${esc(b.label)}</button>`).join('')}</div>` : ''}</div></div>`;
  for (const b of el.querySelectorAll('[data-b]')) b.onpointerdown = (e) => { e.preventDefault(); send({ t: 'in', id: s.id, b: b.dataset.b }); buzz(15); };
  let angle = 0, lastSent = 0, usingTilt = false;
  const plane = $('plane');
  const draw = () => { plane.style.transform = `rotate(${angle}deg)`; };
  const push = () => { const now = Date.now(); if (now - lastSent > 60) { lastSent = now; sendFast({ t: 'in', id: s.id, b: 'tilt', v: angle }); } };
  // clockwise roll of the phone (as you look at it), from gravity; works the same on iPhone and Android
  const onMotion = (e) => {
    const g = e.accelerationIncludingGravity;
    if (!g || g.x == null) return;
    // turn gravity into screen axes, so holding the phone sideways steers the same as upright
    const th = screenAngle() * Math.PI / 180;
    let gx = g.x * Math.cos(th) - g.y * Math.sin(th), gy = g.x * Math.sin(th) + g.y * Math.cos(th);
    if (gy < 0) { gx = -gx; gy = -gy; }
    let a = Math.atan2(-gx, gy) * 180 / Math.PI;
    if (invert) a = -a;
    usingTilt = true;
    angle = Math.max(-60, Math.min(60, a));
    draw(); push();
  };
  addEventListener('devicemotion', onMotion);
  if (!motionOk && typeof window.DeviceMotionEvent?.requestPermission === 'function') {
    $('perm').classList.remove('hidden');
    $('perm').onclick = async () => { if (await askMotion()) $('perm').classList.add('hidden'); };
  }
  $('slide').oninput = () => { if (usingTilt) return; angle = Number($('slide').value); draw(); push(); };
  $('slide').onpointerdown = () => { usingTilt = false; };
  $('inv').onclick = () => { invert = !invert; store.set('invert', invert ? '1' : '0'); $('inv').textContent = invert ? 'Tilt is flipped ↔' : 'Flip tilt direction ↔'; };
  const keep = setInterval(() => { sendFast({ t: 'in', id: s.id, b: 'tilt', v: angle }); }, 250);
  tiltStop = () => { removeEventListener('devicemotion', onMotion); clearInterval(keep); };
}
