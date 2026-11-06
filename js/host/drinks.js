// Drinks: the grown-ups' layer on top of the party. Shared by the board game and Minigames-only mode.
//
//  give(from, to, why)   one drink from `from` to `to`. If `to` is holding a Reverse Card they can
//                        bounce it straight back (and the other person can bounce it again with theirs)
//  group(from, why)      everyone drinks, `from` included; each person can reverse their own share
//  winnersPick(winners)  every minigame winner hands out a drink
//  kingCupStart()        King Cup (oopsie mode): everyone tips some of their drink into one big cup
//  kingCupEnd(loser)     ...and whoever came last drinks it
//
// Everything is tallied per player (drinks had, drinks given out) for the podium at the end.
// It draws its own pop-up over whatever is on the TV, so it works on the board and between minigames.
import { faceDataUrl } from './doll.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const CSS = `
.drink-pop { position: fixed; inset: 0; display: grid; place-items: center; z-index: 60; pointer-events: none; background: radial-gradient(circle, rgba(40,20,6,0.55), rgba(10,4,0,0.8)); animation: dpIn 0.25s ease-out; }
.drink-pop .card { background: linear-gradient(180deg, #ffcf3a, #f2a20c); color: #2a1406; border-radius: 36px; padding: 28px 48px 30px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.6), inset 0 -10px 0 rgba(0,0,0,0.12); border: 6px solid #fff6d8; max-width: 80vw; }
.drink-pop .faces { display: flex; justify-content: center; gap: 18px; margin-bottom: 8px; }
.drink-pop img { width: 140px; height: 140px; border-radius: 50%; border: 6px solid var(--pc, #fff); background: #fff; object-fit: cover; }
.drink-pop .faces.many img { width: 92px; height: 92px; border-width: 5px; }
.drink-pop h1 { font: 900 64px/1.05 system-ui, sans-serif; margin: 6px 0 4px; letter-spacing: 0.01em; }
.drink-pop p { font: 700 26px/1.3 system-ui, sans-serif; margin: 0; opacity: 0.85; }
.drink-pop .foam { font-size: 70px; line-height: 1; }
.drink-pop.rev .card { background: linear-gradient(180deg, #ff6a5a, #d81e3a); color: #fff; border-color: #ffd8d0; }
.drink-pop.king .card { background: linear-gradient(180deg, #ffe680, #c8a020); }
@keyframes dpIn { from { opacity: 0; transform: scale(1.08); } to { opacity: 1; transform: none; } }
.drink-tally { margin-top: 14px; display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; font: 700 18px system-ui, sans-serif; }
.drink-tally span { background: rgba(255,207,58,0.16); border: 2px solid var(--pc); border-radius: 999px; padding: 6px 14px; }
.drink-tally .king { background: #ffcf3a; color: #2a1406; border-color: #fff6d8; font-weight: 900; }
`;

export class Drinks {
  constructor({ players, hub, sfx, rng = Math.random, speed = 1, kingCup = false }) {
    Object.assign(this, { players, hub, sfx, rng, speed, kingCup });
    this.had = new Map(players.map((p) => [p.id, 0]));
    this.gave = new Map(players.map((p) => [p.id, 0]));
    for (const p of players) p.drinks = 0;
    if (!document.getElementById('drinkCss')) { const s = document.createElement('style'); s.id = 'drinkCss'; s.textContent = CSS; document.head.appendChild(s); }
  }

  // ----- the pop-up on the TV -----
  async pop({ who = [], title, sub = '', emoji = '🍺', style = '', ms = 2600 }) {
    const el = document.createElement('div');
    el.className = `drink-pop ${style}`;
    el.innerHTML = `<div class="card"><div class="foam">${emoji}</div><div class="faces ${who.length > 3 ? 'many' : ''}">${who.map((p) => `<img style="--pc:${p.color}" src="${faceDataUrl(p, style === 'rev' ? 'angry' : 'sad')}" alt="">`).join('')}</div><h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}</div>`;
    document.body.appendChild(el);
    await sleep(ms * this.speed);
    el.remove();
  }

  // tell the drinker's phone too (doesn't hold the game up)
  buzz(p, title, body) {
    if (p.bot) return;
    this.hub.ask(p, { title, body, options: [{ id: 'ok', label: '🍻 Done', tone: 'go' }], timer: 8, fallback: 'ok' });
  }

  hasReverse(p) { return (p.powerups || []).includes('reverse-card'); }

  // One drink, from -> to. Returns who ended up drinking it.
  async give(from, to, why = '') {
    if (from && from !== to && this.hasReverse(to)) {
      const ans = await this.hub.ask(to, {
        title: `🍺 ${from.name} is making you drink!`, body: `You've got a Reverse Card. Bounce it back to ${from.name}?`,
        options: [{ id: 'rev', label: '🔄 Reverse it!', tone: 'go' }, { id: 'drink', label: "No, I'll drink" }],
        bot: () => (this.rng() < 0.8 ? 'rev' : 'drink'), fallback: 'drink', timer: 15,
      });
      if (ans === 'rev') {
        to.powerups.splice(to.powerups.indexOf('reverse-card'), 1);
        this.onChange?.();
        this.sfx.play('teleport');
        await this.pop({ who: [to, from], title: 'REVERSED!', sub: `${to.name} bounces it back to ${from.name}`, emoji: '🔄', style: 'rev', ms: 2000 });
        return this.give(to, from, `reversed by ${to.name}`);
      }
    }
    this.had.set(to.id, (this.had.get(to.id) || 0) + 1);
    to.drinks = this.had.get(to.id);
    if (from && from !== to) this.gave.set(from.id, (this.gave.get(from.id) || 0) + 1);
    this.onChange?.();
    this.sfx.play('cheers');
    this.buzz(to, '🍺 Drink!', from && from !== to ? `${from.name} says drink${why ? ` (${why})` : ''}.` : why || 'Have a drink.');
    await this.pop({ who: [to], title: `${to.name.toUpperCase()} DRINKS!`, sub: from && from !== to ? `from ${from.name}${why ? ` · ${why}` : ''}` : why });
    return to;
  }

  // Everyone drinks, the buyer too. Each person on the receiving end can reverse their share.
  async group(from, why = 'Group drink') {
    this.sfx.play('cheers');
    await this.pop({ who: this.players, title: 'EVERYONE DRINKS!', sub: `${from.name} shouted the bar · ${why}`, emoji: '🍻', ms: 2400 });
    const order = [from, ...this.players.filter((p) => p !== from)];
    for (const p of order) {
      if (p !== from && this.hasReverse(p)) { await this.give(from, p, why); continue; }
      this.had.set(p.id, (this.had.get(p.id) || 0) + 1); p.drinks = this.had.get(p.id);
      if (p !== from) this.gave.set(from.id, (this.gave.get(from.id) || 0) + 1);
      this.buzz(p, '🍻 Group drink!', `${from.name} shouted everyone a drink.`);
    }
    this.onChange?.();
  }

  // Every minigame winner picks someone to drink.
  async winnersPick(winners) {
    for (const w of winners) {
      const others = this.players.filter((o) => o !== w);
      if (!others.length) continue;
      const most = Math.max(...others.map((o) => this.had.get(o.id) || 0));
      const id = await this.hub.ask(w, {
        title: '🏆 You won! Give out a drink', body: 'Who drinks?', layout: 'list',
        options: others.map((o) => ({ id: o.id, label: o.name, sub: `🍺 ${this.had.get(o.id) || 0} so far` })),
        // CPUs pick on whoever's had the least, so it spreads around
        bot: () => { const low = others.filter((o) => (this.had.get(o.id) || 0) < most || this.rng() < 0.3); const pool = low.length ? low : others; return pool[Math.floor(this.rng() * pool.length)].id; },
        timer: 20,
      });
      const to = others.find((o) => o.id === id) || others[Math.floor(this.rng() * others.length)];
      await this.give(w, to, 'minigame win');
    }
  }

  async kingCupStart() {
    if (!this.kingCup) return;
    this.sfx.play('pour');
    const humans = this.players.filter((p) => !p.bot);
    const waits = humans.map((p) => this.hub.ask(p, { title: '👑 King Cup', body: 'Tip some of your drink into the King Cup. Whoever comes last drinks the lot.', options: [{ id: 'ok', label: '🫗 Tipped it in', tone: 'go' }], timer: 30, fallback: 'ok' }));
    const popped = this.pop({ who: this.players, title: 'KING CUP!', sub: 'Everyone tip some of your drink into the big cup. Whoever comes LAST drinks it.', emoji: '👑', style: 'king', ms: 4200 });
    await Promise.all([popped, Promise.all(waits)]);
  }

  async kingCupEnd(loser) {
    if (!this.kingCup || !loser) return;
    this.had.set(loser.id, (this.had.get(loser.id) || 0) + 1); loser.drinks = this.had.get(loser.id);
    this.buzz(loser, '👑 King Cup', 'You came last. Drink the King Cup!');
    this.sfx.play('hallelujah');
    await this.pop({ who: [loser], title: `${loser.name.toUpperCase()} DRINKS THE KING CUP!`, sub: 'Came last. Bottoms up.', emoji: '👑', style: 'king', ms: 4000 });
  }

  // a strip for the podium: drinks had / given out, plus who's on the King Cup
  tallyHtml(loser = null) {
    const rows = [...this.players].sort((a, b) => (this.had.get(b.id) || 0) - (this.had.get(a.id) || 0))
      .map((p) => `<span style="--pc:${p.color}">${esc(p.name)}: 🍺 ${this.had.get(p.id) || 0} had · ${this.gave.get(p.id) || 0} given</span>`).join('');
    return `<div class="drink-tally">${rows}${this.kingCup && loser ? `<span class="king" style="--pc:#fff6d8">👑 ${esc(loser.name)} drinks the King Cup</span>` : ''}</div>`;
  }
}
