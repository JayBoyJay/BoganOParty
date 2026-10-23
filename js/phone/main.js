// Phone remote. It only shows whatever screen the TV last sent and sends taps back;
// all game rules live on the TV (see js/host/hub.js for the message list).
import { PhoneNet } from '../net.js';

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
let screen = null; // last prompt/pad/idle
let body = store.get('body') || 'smooth';

const net = new PhoneNet({
  onMsg,
  onStatus: (t) => { $('status').textContent = t; $('status').classList.toggle('hidden', !t); },
});
const send = (m) => net.send(m);
net.start(pid);
document.addEventListener('visibilitychange', () => { if (!document.hidden) net.reconnectNow(); });

function show(id) { for (const s of ['vConnect', 'vLobby', 'vGame']) $(s).classList.toggle('hidden', s !== id); }

function onMsg(m) {
  switch (m.t) {
    case 'welcome': if (!lobby && !screen) show('vConnect'); break;
    case 'nohost': $('status').textContent = 'The TV screen went away. Waiting for it…'; $('status').classList.remove('hidden'); break;
    case 'hostup': $('status').classList.add('hidden'); break;
    case 'kicked': show('vConnect'); $('vConnect').querySelector('p').textContent = 'You were removed from the lobby. Refresh to join again.'; break;
    case 'moved': show('vConnect'); $('vConnect').querySelector('p').textContent = 'This player is now open on another tab or phone.'; break;
    case 'lobby': lobby = m; screen = null; stats = null; renderLobby(); break;
    case 'stats': stats = m; renderBar(); break;
    case 'prompt': case 'pad': case 'idle': screen = m; renderScreen(); if (m.t !== 'idle') buzz(25); break;
  }
}

// ---------------- lobby ----------------
function renderLobby() {
  show('vLobby');
  const you = lobby.you;
  if (you.color) document.documentElement.style.setProperty('--pc', you.color);
  if (you.joined) { body = you.body; if (document.activeElement !== $('name')) $('name').value = you.name; }
  else if (!$('name').value) $('name').value = store.get('name') || '';
  $('bodies').innerHTML = lobby.bodies.map((b) => `<button data-b="${b.id}" class="${b.id === body ? 'on' : ''}"><span class="e">${b.emoji}</span>${esc(b.label)}${b.sub ? `<small>${esc(b.sub)}</small>` : ''}</button>`).join('');
  for (const btn of $('bodies').querySelectorAll('button')) btn.onclick = () => { body = btn.dataset.b; store.set('body', body); sendProfile(); renderLobby(); };
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
  send({ t: 'profile', name, body });
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
  $('bar').innerHTML = `<span class="nm">${esc(lobby?.you?.name || '')}</span><span>${stats.item.emoji} ${stats.items}/${stats.target}</span><span>🪙 ${stats.coins}</span>
    <span class="hp"><i style="width:${Math.round(stats.hp / stats.maxHp * 100)}%"></i></span>
    <div class="pus">${stats.powerups.length ? stats.powerups.map((p) => `${p.emoji} ${esc(p.name)}`).join(' · ') : 'No power-ups'}${stats.effects.map((e) => ` · 🍬 ${esc(e.name)} (${e.rounds})`).join('')}</div>`;
}

let timerT = null, tiltStop = null;
function renderScreen() {
  show('vGame');
  renderBar();
  clearInterval(timerT);
  if (tiltStop) { tiltStop(); tiltStop = null; }
  const s = screen, el = $('screen');
  if (s.t === 'idle') {
    el.innerHTML = `<div class="idle"><div class="big">📺</div><h2>${esc(s.title || 'Watch the TV')}</h2><div class="dim">${esc(s.body || '')}</div></div>
      ${stats ? `<div class="label">Pull a face on the TV</div><div class="emotes">${Object.entries(MOOD_LABEL).map(([m, [e]]) => `<button data-e="${m}">${e}</button>`).join('')}</div>` : ''}`;
    for (const b of el.querySelectorAll('[data-e]')) b.onclick = () => { send({ t: 'emote', mood: b.dataset.e }); buzz(15); };
    return;
  }
  if (s.t === 'prompt') {
    const roll = s.kind === 'roll';
    const cls = roll || s.options.length === 1 ? 'one' : s.layout === 'list' ? 'list' : '';
    el.innerHTML = `<h1>${esc(s.title)}</h1>${s.body ? `<div class="dim">${esc(s.body)}</div>` : ''}${s.timer ? '<div class="timer"><i id="tbar"></i></div>' : '<div style="height:12px"></div>'}
      <div class="opts ${cls}">${s.options.map((o) => `<button data-o="${esc(o.id)}" class="${o.tone === 'go' ? 'go' : ''} ${roll ? 'roll' : ''}" ${o.disabled ? 'disabled' : ''}>${esc(o.label)}${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</button>`).join('')}</div>`;
    for (const b of el.querySelectorAll('[data-o]')) b.onclick = () => {
      send({ t: 'answer', id: s.id, v: b.dataset.o });
      buzz(roll ? [40, 30, 80] : 20);
      el.innerHTML = `<div class="idle"><div class="big">${roll ? '🎲' : '👍'}</div><h2>${roll ? 'Rolling…' : 'Sent!'}</h2></div>`;
    };
    if (s.timer) startTimer(s.timer);
    return;
  }
  if (s.t === 'pad') {
    if (s.kind === 'tilt') return renderTilt(s, el);
    el.innerHTML = `<h1>${esc(s.title)}</h1>${s.body ? `<div class="dim">${esc(s.body)}</div>` : ''}${s.timer ? '<div class="timer"><i id="tbar"></i></div>' : '<div style="height:12px"></div>'}
      <div class="opts">${s.buttons.map((b) => `<button data-b="${esc(b.id)}" class="${b.tone === 'go' ? 'go' : ''} ${b.wide ? 'full' : ''}" style="${b.small ? 'min-height:54px;font-size:15px' : ''}">${esc(b.label)}</button>`).join('')}</div>`;
    for (const b of el.querySelectorAll('[data-b]')) b.onclick = () => { send({ t: 'in', id: s.id, b: b.dataset.b }); buzz(12); };
    if (s.timer) startTimer(s.timer);
  }
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

function renderTilt(s, el) {
  let invert = store.get('invert') === '1';
  el.innerHTML = `<div class="tiltbox"><h1>${esc(s.title)}</h1><div class="dim">${esc(s.body || 'Tilt your phone like a steering wheel')}</div>
    <div class="wing"><div class="plane" id="plane"></div></div>
    <button id="perm" class="go wide hidden">Turn on tilt</button>
    <div class="label">No tilt? Slide instead</div><input type="range" id="slide" min="-55" max="55" step="1" value="0">
    <div style="height:10px"></div><button id="inv" class="wide">${invert ? 'Tilt is flipped ↔' : 'Flip tilt direction ↔'}</button></div>`;
  let angle = 0, lastSent = 0, usingTilt = false;
  const plane = $('plane');
  const draw = () => { plane.style.transform = `rotate(${angle}deg)`; };
  const push = () => { const now = Date.now(); if (now - lastSent > 60) { lastSent = now; send({ t: 'in', id: s.id, b: 'tilt', v: angle }); } };
  // clockwise roll of the phone (as you look at it), from gravity; works the same on iPhone and Android
  const onMotion = (e) => {
    const g = e.accelerationIncludingGravity;
    if (!g || g.x == null) return;
    let gx = g.x, gy = g.y;
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
  const keep = setInterval(() => { send({ t: 'in', id: s.id, b: 'tilt', v: angle }); }, 250);
  tiltStop = () => { removeEventListener('devicemotion', onMotion); clearInterval(keep); };
}
