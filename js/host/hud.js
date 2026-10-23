// Everything drawn over the 3D board on the TV: player cards, banners, dice, coin flips, RPS.
import { faceDataUrl } from './doll.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const HAND = { rock: '✊', paper: '✋', scissors: '✌️' };

export class Hud {
  constructor(root) {
    this.root = root;
    root.innerHTML = `
      <div class="hud-top"><div class="hud-round" id="hudRound"></div><div class="hud-goal" id="hudGoal"></div></div>
      <div class="hud-players" id="hudPlayers"></div>
      <div class="hud-toasts" id="hudToasts"></div>
      <div class="hud-dice hidden" id="hudDice"></div>
      <div class="hud-count hidden" id="hudCount"></div>
      <div class="hud-banner hidden" id="hudBanner"><div class="t"></div><div class="s"></div></div>
      <div class="hud-overlay hidden" id="hudOverlay"></div>`;
    this.$ = (id) => root.querySelector('#' + id);
    this.faces = new Map();
  }

  show(on = true) { this.root.classList.toggle('hidden', !on); }

  setRound(r, max) { this.$('hudRound').textContent = max ? `Round ${r} / ${max}` : `Round ${r}`; }
  setGoal(text) { this.$('hudGoal').textContent = text; }
  setCurrent(p) { this.current = p?.id; this.$('hudPlayers').querySelectorAll('.hp-card').forEach((c) => c.classList.toggle('now', c.dataset.id === this.current)); }

  renderPlayers(players, current, item) {
    if (current) this.current = current.id;
    const box = this.$('hudPlayers');
    if (box.children.length !== players.length) box.innerHTML = players.map((p) => `<div class="hp-card" data-id="${p.id}"></div>`).join('');
    players.forEach((p, i) => {
      const c = box.children[i];
      c.style.setProperty('--pc', p.color);
      c.classList.toggle('now', p.id === this.current);
      c.innerHTML = `
        <img class="face" src="${this.faceFor(p, p.mood)}" alt="">
        <div class="info">
          <div class="nm">${esc(p.name)}${p.bot ? ' <span class="cpu">CPU</span>' : ''}</div>
          <div class="row"><span>${item.emoji} <b>${p.items}</b></span><span>🪙 <b>${p.coins}</b></span></div>
          <div class="hpbar"><i style="width:${Math.round(p.hp / p.maxHp * 100)}%"></i></div>
          <div class="pus">${p.powerups.map(() => '<span class="pu">◆</span>').join('')}${p.effects.map((e) => `<span class="fx">🍬${e.rounds}</span>`).join('')}</div>
        </div>`;
    });
  }

  faceFor(p, mood) {
    const key = `${p.id}:${mood}:${p.photos?.[mood]?.length || 0}:${p.photos?.neutral?.length || 0}`;
    if (!this.faces.has(key)) this.faces.set(key, faceDataUrl(p, mood));
    return this.faces.get(key);
  }

  setMood(p, mood) {
    const img = this.$('hudPlayers').querySelector(`.hp-card[data-id="${p.id}"] .face`);
    if (img) img.src = this.faceFor(p, mood);
  }

  async banner(text, sub = '', { ms = 1500, style = '', small = false } = {}) {
    const b = this.$('hudBanner');
    b.className = `hud-banner ${style} ${small ? 'small' : ''}`;
    b.querySelector('.t').textContent = text;
    b.querySelector('.s').textContent = sub;
    b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
    await sleep(ms);
    b.classList.add('hidden');
  }

  toast(text) {
    const box = this.$('hudToasts');
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = text;
    box.prepend(t);
    while (box.children.length > 5) box.lastChild.remove();
    setTimeout(() => t.remove(), 6000);
  }

  // ---------- dice ----------
  diceStart(n, bonus) {
    const d = this.$('hudDice');
    d.classList.remove('hidden');
    d.innerHTML = Array.from({ length: n }, () => '<div class="die spin">?</div>').join('') + (bonus ? `<div class="bonus">+${bonus}</div>` : '');
    clearInterval(this.diceT);
    this.diceT = setInterval(() => d.querySelectorAll('.die.spin').forEach((x) => { x.textContent = 1 + Math.floor(Math.random() * 10); }), 70);
  }
  async diceStop(values, bonus, total) {
    clearInterval(this.diceT);
    const d = this.$('hudDice');
    const dice = d.querySelectorAll('.die');
    values.forEach((v, i) => { if (dice[i]) { dice[i].classList.remove('spin'); dice[i].textContent = v; } });
    if (values.length > 1 || bonus) d.insertAdjacentHTML('beforeend', `<div class="total">= ${total}</div>`);
    await sleep(700);
  }
  diceHide() { clearInterval(this.diceT); this.$('hudDice').classList.add('hidden'); }

  countdown(n) {
    const c = this.$('hudCount');
    c.classList.toggle('hidden', n == null);
    if (n != null) c.textContent = n;
  }

  // ---------- overlays ----------
  async coinFlip(result, caption, speed = 1) {
    const o = this.$('hudOverlay');
    o.classList.remove('hidden');
    o.innerHTML = `<div class="ov-card"><div class="coin flipping ${result}"><div class="side h">👑</div><div class="side t">🦘</div></div><div class="cap">${esc(caption)}</div><div class="res"></div></div>`;
    await sleep(2200 * speed);
    o.querySelector('.res').textContent = result.toUpperCase() + '!';
    await sleep(1300 * speed);
    o.classList.add('hidden');
  }

  async rps(na, a, nb, b, caption, speed = 1) {
    const o = this.$('hudOverlay');
    o.classList.remove('hidden');
    o.innerHTML = `<div class="ov-card rps"><div class="hands"><div><div class="hand shake">✊</div><div>${esc(na)}</div></div><div class="vs">VS</div><div><div class="hand shake">✊</div><div>${esc(nb)}</div></div></div><div class="cap"></div></div>`;
    await sleep(1100 * speed);
    const hands = o.querySelectorAll('.hand');
    hands[0].textContent = HAND[a] || '?'; hands[1].textContent = HAND[b] || '?';
    hands.forEach((h) => h.classList.remove('shake'));
    o.querySelector('.cap').textContent = caption;
    await sleep(1600 * speed);
    o.classList.add('hidden');
  }

  // game over: winners happy, losers sad
  podium(result, item) {
    const o = this.$('hudOverlay');
    o.classList.remove('hidden');
    o.innerHTML = `<div class="ov-card podium"><h1>🏆 ${esc(result.winner.name)} wins!</h1>
      <div class="pod">${result.ranked.map((p, i) => `<div class="pp ${i === 0 ? 'win' : ''}" style="--pc:${p.color}">
        <img src="${this.faceFor(p, i === 0 ? 'happy' : i === result.ranked.length - 1 ? 'angry' : 'sad')}" alt="">
        <div class="nm">${i + 1}. ${esc(p.name)}</div><div>${item.emoji} ${p.items} · 🪙 ${p.coins}</div></div>`).join('')}</div>
      <div class="cap">Press <b>Play again</b> on any phone, or <b>Enter</b> here.</div></div>`;
  }
  hideOverlay() { this.$('hudOverlay').classList.add('hidden'); }
}
