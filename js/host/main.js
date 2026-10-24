// TV screen: lobby, phones joining, then hands over to the Game.
import { HostNet } from '../net.js';
import { qrSvg } from '../qr.js';
import { buildBoard } from '../board.js';
import { MAPS, MAP_BY_ID } from '../content/maps/index.js';
import { POWERUPS } from '../content/powerups/index.js';
import { MINIGAMES, MINIGAME_BY_ID } from '../content/minigames/index.js';
import { Stage } from './stage.js';
import { BoardView } from './boardview.js';
import { Hud } from './hud.js';
import { Hub } from './hub.js';
import { Sfx } from './sfx.js';
import { Game } from './engine.js';
import { MinigameRunner } from './minigames.js';
import { Marathon, MARATHON_POINTS } from './marathon.js';
import { Drinks } from './drinks.js';
import { MOODS, BODIES, OUTFITS, HATS, PLAYER_COLORS, faceDataUrl, defaultOutfit } from './doll.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const qp = new URLSearchParams(location.search);
const store = {
  load(k, d) { try { const v = JSON.parse(localStorage.getItem('bop:' + k)); return v ?? d; } catch { return d; } },
  save(k, v) { try { localStorage.setItem('bop:' + k, JSON.stringify(v)); } catch { /* full or private */ } },
};
const BOT_NAMES = ['Shazza', 'Davo', 'Kylie', 'Gazza', 'Bazza', 'Tracey', 'Macca', 'Narelle'];
const MAX_PLAYERS = 8;
// CPUs fill whatever seats the phones leave, up to the cap
const cpuCount = () => Math.max(0, Math.min(state.settings.cpus, MAX_PLAYERS - [...state.players.values()].filter((p) => p.connected).length));
const BOT_BODIES = ['sheila', 'bloke', 'sheila', 'bloke', 'bloke', 'sheila', 'both', 'smooth'];
const BOT_HATS = ['bucket', 'akubra', 'none', 'trucker', 'corks', 'beanie', 'lifesaver', 'hardhat'];
const BOT_OUTFITS = ['bikini', 'singlet', 'lifesaver', 'smugglers', 'hivis', 'flanno', 'cricket', 'footy']; // CPUs always wear something

const state = {
  phase: 'lobby',
  players: new Map(), // pid -> { id, name, body, photos, color, ready, connected }
  settings: { mode: 'board', mgRounds: 5, map: MAPS[0].id, itemsToWin: 5, maxRounds: 0, cpus: 0, sound: true, drinks: 1, kingCup: 0, ...store.load('settings', {}) },
  game: null,
};
if (qp.has('bots')) state.settings.cpus = Math.min(7, Number(qp.get('bots')) || 0);
if (qp.has('drinks')) state.settings.drinks = Number(qp.get('drinks')) ? 1 : 0;
if (qp.has('kingcup')) state.settings.kingCup = Number(qp.get('kingcup')) ? 1 : 0;
if (qp.has('map') && MAP_BY_ID[qp.get('map')]) state.settings.map = qp.get('map');
if (qp.has('items')) state.settings.itemsToWin = Number(qp.get('items')) || 5;
if (qp.get('mode') === 'minigames' || qp.get('mode') === 'board') state.settings.mode = qp.get('mode');
if (qp.has('mgrounds')) state.settings.mgRounds = Number(qp.get('mgrounds')) || 5;
const fast = qp.has('fast');

// players are remembered (with photos) so a refresh doesn't lose anyone
for (const p of Object.values(store.load('players', {}))) state.players.set(p.id, { ...p, ready: false, connected: false });
const savePlayers = () => { try { store.save('players', Object.fromEntries([...state.players].map(([k, p]) => [k, { id: p.id, name: p.name, body: p.body, hat: p.hat, outfit: p.outfit, photos: p.photos, color: p.color }]))); } catch { /* photos too big: skip */ } };
const saveSettings = () => store.save('settings', state.settings);

const stage = new Stage($('scene'));
const sfx = new Sfx();
const hud = new Hud($('hud'));
hud.show(false);
addEventListener('pointerdown', () => sfx.unlock(), { once: true });
addEventListener('keydown', () => sfx.unlock(), { once: true });

// ---------------- phones ----------------
const net = new HostNet({
  onEvent: onNet,
  onStatus: (text, ok) => { $('netStatus').textContent = text; $('netStatus').classList.toggle('hidden', ok && !text); },
  onReady: (n) => {
    $('joinUrl').textContent = n.joinUrl.replace(/^https?:\/\//, '');
    $('qr').innerHTML = n.info?.qr || qrSvg(n.joinUrl);
    $('roomCode').textContent = n.room ? `Game code ${n.room}` : 'Same Wi-Fi as this screen';
  },
});
const hub = new Hub(net, { speed: fast ? 0.25 : 1 });
net.start();

function nextColor() {
  const used = new Set([...state.players.values()].map((p) => p.color));
  return PLAYER_COLORS.find((c) => !used.has(c)) || PLAYER_COLORS[state.players.size % PLAYER_COLORS.length];
}

function onNet(m) {
  if (m.t === 'phones') { for (const pid of m.pids) onNet({ t: 'phone-connect', pid }); return; }
  if (m.t === 'all-gone') { for (const p of state.players.values()) p.connected = false; renderLobby(); return; }
  if (m.t === 'phone-connect') {
    const p = state.players.get(m.pid);
    if (p) p.connected = true;
    hub.reconnect(m.pid);
    if (state.phase === 'lobby') { pushLobby(m.pid); renderLobby(); }
    else if (!p || !state.game?.players.includes(p)) net.send(m.pid, { t: 'idle', title: 'Game in progress', body: "You'll get in next game. Grab a drink." });
    return;
  }
  if (m.t === 'phone-disconnect') {
    const p = state.players.get(m.pid);
    if (p) p.connected = false;
    hub.disconnect(m.pid);
    renderLobby();
    return;
  }
  if (m.t !== 'phone-msg') return;
  const pid = m.pid, msg = m.msg;
  if (hub.handle(pid, msg)) return;
  const p = state.players.get(pid);
  switch (msg.t) {
    case 'profile': {
      if (state.phase !== 'lobby') return;
      const name = String(msg.name || '').trim().slice(0, 16) || 'Player';
      const body = BODIES.some((b) => b.id === msg.body) ? msg.body : 'smooth';
      const hat = HATS.some((h) => h.id === msg.hat) ? msg.hat : 'none';
      const outfit = OUTFITS.some((o) => o.id === msg.outfit) ? msg.outfit : defaultOutfit(body);
      if (p) Object.assign(p, { name, body, hat, outfit, connected: true });
      else if ([...state.players.values()].filter((q) => q.connected).length >= MAX_PLAYERS) return; // the couch is full
      else state.players.set(pid, { id: pid, name, body, hat, outfit, photos: {}, color: nextColor(), ready: false, connected: true });
      savePlayers(); pushLobby(pid); renderLobby();
      break;
    }
    case 'photo': {
      if (!p || !MOODS.includes(msg.mood)) return;
      if (typeof msg.data !== 'string' || !msg.data.startsWith('data:image/') || msg.data.length > 200_000) return;
      p.photos = { ...p.photos, [msg.mood]: msg.data };
      hud.faces.clear();
      savePlayers(); pushLobby(pid); renderLobby();
      state.game?.view.setPhotos(p);
      break;
    }
    case 'clear-photo': {
      if (!p || !MOODS.includes(msg.mood)) return;
      const { [msg.mood]: _, ...rest } = p.photos || {};
      p.photos = rest; hud.faces.clear();
      savePlayers(); pushLobby(pid); renderLobby();
      break;
    }
    case 'ready': {
      if (!p || state.phase !== 'lobby') return;
      p.ready = !!msg.v;
      pushLobby(pid); renderLobby(); maybeAutoStart();
      break;
    }
    case 'settings': {
      // any phone can flip the map from the lobby
      if (state.phase === 'lobby' && msg.map && MAP_BY_ID[msg.map]) { state.settings.map = msg.map; saveSettings(); renderLobby(); pushLobbyAll(); }
      break;
    }
    case 'emote': {
      // faces work as emotes on the board (not during minigames)
      const g = state.game;
      if (p && g && state.phase === 'board' && MOODS.includes(msg.mood) && g.players.includes(p)) {
        g.setMood(p, msg.mood, 3000);
        g.view.floatText(p, { neutral: '😐', happy: '😁', sad: '😢', angry: '😡' }[msg.mood]);
      }
      break;
    }
    case 'again': if (state.phase === 'over') backToLobby(); break;
  }
}

function lobbyView(pid) {
  const p = state.players.get(pid);
  const map = MAP_BY_ID[state.settings.map];
  return {
    t: 'lobby',
    you: p ? { joined: true, name: p.name, body: p.body, hat: p.hat || 'none', outfit: p.outfit || defaultOutfit(p.body), color: p.color, ready: !!p.ready, photos: Object.fromEntries(MOODS.map((m) => [m, p.photos?.[m] || null])) } : { joined: false },
    map: state.settings.mode === 'minigames' ? { id: map.id, name: 'Minigames only', item: 'most points', emoji: '🎮' } : { id: map.id, name: map.name, item: map.item.name, emoji: map.item.emoji },
    maps: MAPS.map((m) => ({ id: m.id, name: m.name })),
    bodies: BODIES, hats: HATS, outfits: OUTFITS,
    moods: MOODS,
    count: [...state.players.values()].filter((x) => x.connected).length,
  };
}
const pushLobby = (pid) => net.send(pid, lobbyView(pid));
const pushLobbyAll = () => { for (const p of state.players.values()) if (p.connected) pushLobby(p.id); };

// ---------------- lobby screen ----------------
function renderLobby() {
  if (state.phase !== 'lobby') return;
  const map = MAP_BY_ID[state.settings.map];
  const mg = state.settings.mode === 'minigames';
  $('lobby').classList.toggle('mode-minigames', mg);
  $('mapName').textContent = mg ? 'Minigames only' : map.name;
  $('mapBlurb').textContent = mg ? `No board: ${state.settings.mgRounds} minigames back to back. ${MARATHON_POINTS.join(' / ')} points per finish, most points wins.` : map.blurb;
  $('mapItem').textContent = mg ? `🎮 ${MINIGAMES.length} minigame${MINIGAMES.length === 1 ? '' : 's'} in the box` : `${map.item.emoji} Collect ${state.settings.itemsToWin} ${map.item.plural}`;
  for (const [id, key] of [['segItems', 'itemsToWin'], ['segRounds', 'maxRounds'], ['segCpus', 'cpus'], ['segMgRounds', 'mgRounds'], ['segDrinks', 'drinks'], ['segKingCup', 'kingCup']]) {
    for (const b of $(id).querySelectorAll('button')) b.classList.toggle('on', Number(b.dataset.v) === state.settings[key]);
  }
  for (const b of $('segMode').querySelectorAll('button')) b.classList.toggle('on', b.dataset.v === state.settings.mode);
  const people = [...state.players.values()];
  // joined phones, then the CPUs, then empty seats so it's obvious there's room for more
  const cpuCards = Array.from({ length: cpuCount() }, (_, i) => `
    <div class="pcard" style="--pc:${PLAYER_COLORS[(people.length + i) % PLAYER_COLORS.length]}">
      <img src="${faceDataUrl({ id: 'cpu' + i, name: BOT_NAMES[i % BOT_NAMES.length], body: BOT_BODIES[i % BOT_BODIES.length], photos: {}, color: PLAYER_COLORS[(people.length + i) % PLAYER_COLORS.length] }, 'neutral')}" alt="">
      <div><div class="nm">${BOT_NAMES[i % BOT_NAMES.length]}</div><div class="st">CPU · ${BODIES.find((b) => b.id === BOT_BODIES[i % BOT_BODIES.length])?.label || ''}</div></div>
    </div>`);
  const empty = Math.max(0, Math.min(MAX_PLAYERS, Math.max(4, people.length + cpuCount() + 1)) - people.length - cpuCount());
  $('playerList').classList.toggle('many', people.length + cpuCount() > 5);
  $('playerList').innerHTML = people.map((p) => `
    <div class="pcard ${p.ready ? 'ready' : ''} ${p.connected ? '' : 'off'}" style="--pc:${p.color}">
      <img src="${faceDataUrl(p, 'neutral')}" alt="">
      <div><div class="nm">${esc(p.name)}</div><div class="st">${p.connected ? (p.ready ? 'Ready!' : 'Getting set up…') : 'Phone asleep'} · ${BODIES.find((b) => b.id === p.body)?.label || ''} · ${Object.keys(p.photos || {}).length}/4 📷</div></div>
      <button class="x" data-kick="${p.id}" title="Remove">✕</button>
    </div>`).join('') + cpuCards.join('')
    + Array.from({ length: empty }, (_, i) => `<div class="pslot"><i>+</i>${i === 0 && !people.length ? 'Scan the QR code to join' : 'Free seat'}</div>`).join('');
  for (const b of $('playerList').querySelectorAll('[data-kick]')) b.onclick = () => { const id = b.dataset.kick; state.players.delete(id); net.kick(id); savePlayers(); renderLobby(); };
  const n = people.filter((p) => p.connected).length + cpuCount();
  $('startBtn').disabled = n < 2;
  $('startHint').textContent = n < 2 ? 'Need at least 2 players (add CPUs to test)' : `${n} players`;
}

function setupLobbyControls() {
  $('mapPrev').onclick = () => cycleMap(-1);
  $('mapNext').onclick = () => cycleMap(1);
  for (const [id, key] of [['segItems', 'itemsToWin'], ['segRounds', 'maxRounds'], ['segCpus', 'cpus'], ['segMgRounds', 'mgRounds'], ['segDrinks', 'drinks'], ['segKingCup', 'kingCup']]) {
    for (const b of $(id).querySelectorAll('button')) b.onclick = () => { state.settings[key] = Number(b.dataset.v); saveSettings(); renderLobby(); };
  }
  for (const b of $('segMode').querySelectorAll('button')) b.onclick = () => { state.settings.mode = b.dataset.v; saveSettings(); renderLobby(); pushLobbyAll(); };
  $('startBtn').onclick = () => startGame();
  $('fsBtn').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.());
  $('soundBtn').onclick = () => { state.settings.sound = !state.settings.sound; sfx.on = state.settings.sound; saveSettings(); $('soundBtn').textContent = sfx.on ? '🔊' : '🔇'; };
  sfx.on = state.settings.sound;
  $('soundBtn').textContent = sfx.on ? '🔊' : '🔇';
  addEventListener('keydown', (e) => {
    if (e.key === 'f' || e.key === 'F') $('fsBtn').click();
    if (state.phase === 'lobby' && e.key === 'ArrowLeft') cycleMap(-1);
    if (state.phase === 'lobby' && e.key === 'ArrowRight') cycleMap(1);
    if (e.key === 'Enter' && state.phase === 'lobby' && !$('startBtn').disabled) startGame();
    if (e.key === 'Enter' && state.phase === 'over') backToLobby();
  });
}
function cycleMap(d) {
  const i = MAPS.findIndex((m) => m.id === state.settings.map);
  state.settings.map = MAPS[(i + d + MAPS.length) % MAPS.length].id;
  saveSettings(); renderLobby(); pushLobbyAll(); showLobbyBoard();
}

let autoT = null;
function maybeAutoStart() {
  clearTimeout(autoT);
  const humans = [...state.players.values()].filter((p) => p.connected);
  if (humans.length && humans.every((p) => p.ready) && humans.length + cpuCount() >= 2) {
    $('startHint').textContent = 'Everyone is ready: starting…';
    autoT = setTimeout(() => { if (state.phase === 'lobby') startGame(); }, 2500);
  }
}

// a slow fly-over of the chosen map behind the lobby
let lobbyBoard = null;
function showLobbyBoard() {
  const map = MAP_BY_ID[state.settings.map];
  if (lobbyBoard?.map === map) return;
  lobbyBoard = new BoardView(stage, map, buildBoard(map.board));
  window.__lobbyBoard = lobbyBoard; // for screenshots and debugging
  lobbyBoard.placeAll([]);
  let t = 0;
  const up = lobbyBoard.update.bind(lobbyBoard);
  lobbyBoard.update = (dt) => { t += dt * 0.06; lobbyBoard.orbit(t); up(dt); };
  lobbyBoard.show();
}

// ---------------- game ----------------
async function startGame() {
  if (state.phase !== 'lobby') return;
  clearTimeout(autoT);
  sfx.unlock();
  const map = MAP_BY_ID[state.settings.map];
  const humans = [...state.players.values()].filter((p) => p.connected);
  const bots = Array.from({ length: cpuCount() }, (_, i) => ({
    id: 'cpu' + i, name: BOT_NAMES[i % BOT_NAMES.length], body: BOT_BODIES[i % BOT_BODIES.length], hat: BOT_HATS[i % BOT_HATS.length], outfit: BOT_OUTFITS[i % BOT_OUTFITS.length], photos: {}, bot: true, color: PLAYER_COLORS[(humans.length + i) % PLAYER_COLORS.length],
  }));
  const used = new Set();
  for (const p of humans) { if (used.has(p.color)) p.color = PLAYER_COLORS.find((c) => !used.has(c)); used.add(p.color); }
  for (const b of bots) { if (used.has(b.color)) b.color = PLAYER_COLORS.find((c) => !used.has(c)) || b.color; used.add(b.color); }
  const players = [...humans, ...bots].sort(() => Math.random() - 0.5);
  if (players.length < 2) return;
  if (state.settings.mode === 'minigames') return startMarathon(players);
  state.phase = 'board';
  $('lobby').classList.add('hidden');
  hud.show(true);
  hud.faces.clear();
  hub.players = players;
  hub.idleAll('Starting!', `${map.name}: first to ${state.settings.itemsToWin} ${map.item.plural}`);

  const board = buildBoard(map.board);
  const view = new BoardView(stage, map, board);
  view.show();
  hud.setGoal(`${map.item.emoji} First to ${state.settings.itemsToWin}`);
  const runner = new MinigameRunner({ stage, hub, sfx, root: $('minigame'), hud, speed: fast ? 0.25 : 1 });
  const only = qp.get('minigame') && MINIGAME_BY_ID[qp.get('minigame')] ? [qp.get('minigame')] : null;
  const game = new Game({
    map, board, players, hub, view, hud, sfx,
    settings: { ...state.settings, fast, noMinigames: qp.has('nominigames'), give: qp.get('give')?.split(',').filter((id) => POWERUPS.some((p) => p.id === id)).slice(0, 3) },
    runMinigame: async (ps) => { state.phase = 'minigame'; const r = await runner.run(ps, await runner.spin(ps, only, `Round ${game.round} minigame`)); state.phase = 'board'; return r; },
  });
  state.game = game;
  window.__game = game; // handy in the console, and for automated tests
  const result = await game.play();
  state.phase = 'over';
  for (const p of players) game.setMood(p, p === result.winner ? 'happy' : 'sad', 600000);
  view.focus(result.winner);
  const loser = result.ranked[result.ranked.length - 1];
  await game.drinks?.kingCupEnd(loser);
  hud.podium(result, map.item, undefined, game.drinks ? game.drinks.tallyHtml(loser) : '');
  gameOver(players, result);
}

// Minigames only: no board, minigames back to back, points per finish.
async function startMarathon(players) {
  state.phase = 'minigame';
  $('lobby').classList.add('hidden');
  hud.faces.clear();
  hub.players = players;
  hub.idleAll('Starting!', `Minigames only: ${state.settings.mgRounds} games`);
  const runner = new MinigameRunner({ stage, hub, sfx, root: $('minigame'), hud, speed: fast ? 0.25 : 1 });
  const only = qp.get('minigame') && MINIGAME_BY_ID[qp.get('minigame')] ? [qp.get('minigame')] : null;
  const { drinks: drinkOn, kingCup } = state.settings;
  const drinks = drinkOn || kingCup ? new Drinks({ players, hub, sfx, speed: fast ? 0.25 : 1, kingCup: !!kingCup }) : null;
  const marathon = new Marathon({ players, rounds: state.settings.mgRounds, runner, hub, hud, sfx, stage, root: $('minigame'), speed: fast ? 0.25 : 1, only, drinks, drinkOn: !!drinkOn });
  state.game = marathon;
  window.__game = marathon;
  const result = await marathon.play();
  state.phase = 'over';
  for (const p of players) marathon.setMood(p, p === result.winner ? 'happy' : 'sad');
  marathon.focus();
  hud.show(true);
  hud.setRound(state.settings.mgRounds, state.settings.mgRounds);
  hud.setGoal('🎮 Minigames only');
  const loser = result.ranked[result.ranked.length - 1];
  await drinks?.kingCupEnd(loser);
  hud.podium(result, null, (p) => `🏅 ${p.points} pts${p.drinks !== undefined ? ` · 🍺 ${p.drinks}` : ''}`, drinks ? drinks.tallyHtml(loser) : '');
  gameOver(players, result);
}

function gameOver(players, result) {
  sfx.play('item');
  for (const p of players) {
    if (p.bot) continue;
    hub.send(p, { t: 'prompt', id: -1, kind: 'choice', title: p === result.winner ? '🏆 You won!' : `${result.winner.name} won`, body: `You finished ${result.ranked.indexOf(p) + 1} of ${players.length}.`, options: [{ id: 'again', label: 'Play again', tone: 'go' }], layout: 'grid', timer: 0 });
  }
}

function backToLobby() {
  state.phase = 'lobby';
  state.game = null;
  hud.hideOverlay();
  hud.show(false);
  for (const p of state.players.values()) p.ready = false;
  $('lobby').classList.remove('hidden');
  lobbyBoard = null;
  showLobbyBoard();
  renderLobby();
  pushLobbyAll();
}
// the podium's "Play again" comes back as an answer to prompt -1
const origHandle = hub.handle.bind(hub);
hub.handle = (pid, m) => { if (m.t === 'answer' && m.id === -1) { if (state.phase === 'over') backToLobby(); return true; } return origHandle(pid, m); };

$('contentList').innerHTML = `${MAPS.length} maps · ${POWERUPS.length} power-ups · ${MINIGAMES.length} minigame${MINIGAMES.length === 1 ? '' : 's'}`;
setupLobbyControls();
showLobbyBoard();
renderLobby();
if (qp.has('autostart')) setTimeout(() => startGame(), 800);
