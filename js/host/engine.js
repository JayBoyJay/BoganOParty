// The board game itself: rounds, turns, dice, moving, spaces, the item, the shop and hits.
//
// Power-ups and minigames get this Game object as their `game` and use the helpers in the
// "toolkit for content" section below (ask, pickPlayer, aim, banner, coins, dropCoins, ...). That
// keeps content files small and means new ideas rarely need engine changes.
import { chooseItemSpace, leaderOf, turnOrderFrom, spacesWithin, spacesApart, SPACE } from '../board.js';
import { POWERUPS, POWERUP_BY_ID } from '../content/powerups/index.js';
import { EFFECTS } from '../content/powerups/effects.js';
import { Drinks } from './drinks.js';

export const RULES = {
  startCoins: 10,
  diceSides: 10,
  maxPowerups: 3,
  blueCoins: 3,
  redCoins: -3,
  minigameCoins: [10, 6, 3, 1],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class Game {
  // hub: phone prompts (ask / live / stats); view: the 3D board; hud: DOM overlay; sfx: sounds
  // runMinigame(players) -> Promise<[[player, ...], ...]> placings, best first (ties share a group)
  constructor({ map, board, players, settings, hub, view, hud, sfx, runMinigame, rng = Math.random, onEnd }) {
    Object.assign(this, { map, board, players, settings, hub, view, hud, sfx, runMinigame, rng, onEnd });
    this.round = 0;
    this.itemSpace = null;
    this.piles = new Map(); // space -> { n, prop }: coins knocked loose by power-ups, waiting to be picked up
    this.turn = null;
    this.rolled = new Set();
    this.over = false;
    this.speed = settings.fast ? 0.25 : 1; // fast mode for automated tests
    for (const p of players) Object.assign(p, {
      coins: RULES.startCoins, items: 0,
      space: board.start, powerups: [...(settings.give || [])], effects: [], mood: 'neutral', // give: test hook
    });
    // drinks: minigame winners hand out drinks, drink power-ups in the shop; King Cup: loser drinks the cup
    this.drinkOn = !!settings.drinks;
    this.drinks = settings.drinks || settings.kingCup ? new Drinks({ players, hub, sfx, rng, speed: this.speed, kingCup: !!settings.kingCup }) : null;
    if (this.drinks) this.drinks.onChange = () => this.refresh();
  }

  get target() { return this.settings.itemsToWin || 5; }
  get item() { return this.map.item; }

  // ================= main loop =================
  async play() {
    this.view.placeAll(this.players);
    this.refresh();
    this.hud.setRound(1, this.settings.maxRounds);
    await this.banner(this.map.name, `First to ${this.target} ${this.item.plural} wins`, { ms: 2600 });
    await this.drinks?.kingCupStart();
    await this.placeItem(true);
    while (!this.over) {
      this.round++;
      this.rolled.clear();
      this.hud.setRound(this.round, this.settings.maxRounds);
      await this.banner(`Round ${this.round}`, this.settings.maxRounds ? `of ${this.settings.maxRounds}` : '', { ms: 1400 });
      for (const p of this.players) {
        if (this.over) break;
        await this.takeTurn(p);
      }
      if (this.over) break;
      await this.endOfRound();
      if (this.over) break;
      const placings = await this.minigame();
      if (this.settings.maxRounds && this.round >= this.settings.maxRounds) this.finish(null);
      if (!this.over && placings) await this.reorder(placings);
    }
    return this.result;
  }

  async endOfRound() {
    for (const p of this.players) {
      for (const e of [...p.effects]) {
        const def = EFFECTS[e.id];
        if (def?.onRoundEnd) await def.onRoundEnd(this, p, e);
        e.rounds--;
        if (e.rounds <= 0) { p.effects = p.effects.filter((x) => x !== e); this.toast(`${p.name}'s ${def?.name || e.id} wore off`); }
      }
    }
    this.refresh();
  }

  async minigame() {
    if (!this.runMinigame || this.settings.noMinigames) return;
    this.hub.idleAll('Minigame time!');
    const placings = await this.runMinigame(this.players);
    this.view.show();
    let place = 0;
    for (const group of placings) {
      const coins = RULES.minigameCoins[place] || 0;
      for (const p of group) if (coins) this.coins(p, coins, 'minigame', { quiet: true });
      place += group.length;
    }
    this.refresh();
    const top = placings[0] || [];
    if (top.length) await this.banner(`${top.map((p) => p.name).join(' & ')} won the minigame`, `+${RULES.minigameCoins[0]} coins${this.drinkOn ? ' and a drink to give out' : ''}`, { ms: 1800 });
    if (this.drinkOn && top.length) await this.drinks.winnersPick(top);
    return placings;
  }

  // the minigame winner goes first next round, then 2nd place, and so on
  async reorder(placings) {
    const order = turnOrderFrom(this.players, placings);
    this.players.splice(0, this.players.length, ...order); // same array: the hub and board view share it
    this.refresh();
    await this.hud.turnOrder(this.players, this.speed);
  }

  finish(winner) {
    if (this.over) return;
    this.over = true;
    const ranked = [...this.players].sort((a, b) => (b.items - a.items) || (b.coins - a.coins));
    this.result = { winner: winner || ranked[0], ranked, rounds: this.round };
    this.onEnd?.(this.result);
  }

  // ================= turns =================
  async takeTurn(p) {
    if (p.skipTurns) { p.skipTurns--; this.toast(`${p.name} sits this turn out`); return; }
    this.turn = { player: p, dice: 1, bonus: 0, over: false, used: false };
    this.hud.setCurrent(p);
    this.view.focus(p);
    this.refresh();
    await this.banner(`${p.name}'s turn`, '', { ms: 900, small: true });
    // power-ups are used before the roll, one per turn
    while (!this.turn.over) {
      const options = [{ id: 'roll', label: '🎲 Roll the dice', tone: 'go' }];
      for (const [i, id] of p.powerups.entries()) {
        const pu = POWERUP_BY_ID[id];
        // passive ones (the Reverse Card) work by themselves, so they just sit in the list
        if (pu) options.push({ id: 'pu:' + i, label: `${pu.emoji} ${pu.name}`, sub: pu.passive ? pu.short : this.turn.used ? 'One power-up per turn' : pu.short, disabled: this.turn.used || !!pu.passive });
      }
      const ans = await this.ask(p, {
        title: 'Your turn', body: options.length > 1 ? 'Use a power-up before you roll?' : '', options,
        bot: () => this.botPowerupChoice(p, options),
      });
      if (ans === 'roll' || ans == null) break;
      const i = Number(String(ans).slice(3));
      const pu = POWERUP_BY_ID[p.powerups[i]];
      if (!pu) continue;
      p.powerups.splice(i, 1);
      this.turn.used = true;
      this.refresh();
      this.hub.idle(p, `${pu.emoji} ${pu.name}…`);
      await this.banner(`${pu.emoji} ${pu.name}!`, `${p.name} used a power-up`, { ms: 1300, small: true });
      const kept = await pu.use(this, p);
      if (kept === false) { p.powerups.splice(i, 0, pu.id); this.turn.used = false; }
      this.refresh();
      this.view.focus(p);
    }
    if (!this.turn.over && !this.over) await this.rollAndMove(p, this.turn);
    this.turn = null;
  }

  botPowerupChoice(p, options) {
    const usable = options.filter((o) => o.id.startsWith('pu:') && !o.disabled);
    for (const o of usable) {
      const pu = POWERUP_BY_ID[p.powerups[Number(o.id.slice(3))]];
      if (pu?.botWants?.(this, p) ?? this.rng() < 0.5) return o.id;
    }
    return 'roll';
  }

  diceBonus(p) {
    return p.effects.reduce((s, e) => s + (EFFECTS[e.id]?.diceBonus || 0), 0);
  }

  async rollAndMove(p, turn = { dice: 1, bonus: 0 }) {
    const n = Math.max(1, turn.dice || 1);
    const bonus = (turn.bonus || 0) + this.diceBonus(p);
    this.view.focus(p);
    this.hud.diceStart(n, bonus);
    this.sfx.play('tick');
    await this.ask(p, {
      kind: 'roll', title: n > 1 ? `Roll ${n} dice!` : 'Roll!', body: bonus ? `+${bonus} bonus on top` : '',
      options: [{ id: 'roll', label: '🎲 ROLL', tone: 'go' }], timer: 20,
    });
    const values = Array.from({ length: n }, () => 1 + Math.floor(this.rng() * RULES.diceSides));
    const total = values.reduce((a, b) => a + b, 0) + bonus;
    this.sfx.play('dice');
    await this.hud.diceStop(values, bonus, total);
    this.rolled.add(p.id);
    this.hub.idle(p, `You rolled ${total}`);
    await this.move(p, total);
    if (!this.over) await this.landOn(p);
    this.hud.diceHide();
  }

  // Walk p forward `steps` spaces, asking at forks, offering the item and shops on the way past.
  async move(p, steps) {
    for (let left = steps; left > 0 && !this.over; left--) {
      const node = this.board.nodes[p.space];
      let to = node.next[0];
      if (node.next.length > 1) to = await this.chooseFork(p, node);
      this.view.setStepsLeft(p, left - 1);
      await this.view.hop(p, to, this.speed);
      p.space = to;
      this.sfx.play('step');
      if (this.piles.has(to)) this.pickUpPile(p, to);
      if (to === this.itemSpace) await this.offerItem(p);
      else if (this.board.nodes[to].type === 'shop' && left > 1) await this.shop(p, true);
    }
    this.view.setStepsLeft(p, 0);
  }

  async chooseFork(p, node) {
    const options = node.next.map((j) => {
      const n = this.board.nodes[j];
      const route = n.branch != null ? this.map.board.branches[n.branch] : null;
      return { id: String(j), label: route ? `↪ ${route.name || 'Side track'}` : `⬆ ${this.map.board.loop.name || 'Main road'}`, sub: route?.sub || '' };
    });
    this.view.showFork(node.next);
    this.view.focus(p);
    const ans = await this.ask(p, {
      title: 'Which way?', options,
      bot: () => {
        // head for the item if it's down one of the roads
        let best = options[0].id, bestD = Infinity;
        for (const o of options) { const d = this.board.fwd[Number(o.id)][this.itemSpace ?? 0]; if (d < bestD) { bestD = d; best = o.id; } }
        return this.rng() < 0.8 ? best : options[Math.floor(this.rng() * options.length)].id;
      },
    });
    this.view.showFork(null);
    return node.next.includes(Number(ans)) ? Number(ans) : node.next[0];
  }

  async landOn(p) {
    const node = this.board.nodes[p.space];
    if (node.type === 'blue') { this.coins(p, RULES.blueCoins, 'blue'); this.setMood(p, 'happy'); }
    else if (node.type === 'red') { this.coins(p, RULES.redCoins, 'red'); this.setMood(p, 'sad'); }
    else if (node.type === 'shop') await this.shop(p, false);
    else if (node.type === 'event') await this.event(p);
    this.refresh();
    await sleep(500 * this.speed);
  }

  async event(p) {
    const list = this.map.events || [];
    if (!list.length) return;
    const e = list[Math.floor(this.rng() * list.length)];
    this.sfx.play('event');
    await this.banner('❗ ' + e.text, e.coins ? `${e.coins > 0 ? '+' : ''}${e.coins} coins` : '', { ms: 2000, small: true });
    if (e.coins) this.coins(p, e.coins, 'event');
    if (e.mood) this.setMood(p, e.mood);
  }

  // ================= the item =================
  async placeItem(first = false) {
    const pick = chooseItemSpace(this.board, this.players, { spreadGap: this.settings.spreadGap, rng: this.rng, exclude: this.itemSpace != null ? [this.itemSpace] : [] });
    this.itemSpace = pick.space;
    this.lastItemRule = pick;
    await this.view.setItem(pick.space, this.speed);
    const why = pick.rule === 'furthest-from-leader' ? `Everyone's spread out, so it's as far from ${this.players.find((p) => p.id === pick.leader)?.name || 'the leader'} as it gets` : 'As far from everyone as it gets';
    await this.banner(`${this.item.emoji} The ${this.item.name} has ${first ? 'appeared' : 'moved'}!`, why, { ms: 2000, small: true });
  }

  async offerItem(p) {
    const price = this.item.price;
    this.view.focus(p);
    if (p.coins < price) {
      await this.banner(`Not enough coins`, `${p.name} needs ${price} coins for the ${this.item.name}`, { ms: 1400, small: true });
      return;
    }
    const ans = await this.ask(p, {
      title: `${this.item.emoji} ${this.item.name}`, body: `Buy it for ${price} coins? You have ${p.coins}.`,
      options: [{ id: 'yes', label: `Buy for ${price} 🪙`, tone: 'go' }, { id: 'no', label: 'No thanks' }],
      bot: 'yes', fallback: 'yes',
    });
    if (ans !== 'yes') return;
    p.coins -= price;
    p.items++;
    this.sfx.play('item');
    this.setMood(p, 'happy', 4000);
    for (const o of this.players) if (o !== p) this.setMood(o, 'angry', 3000);
    this.refresh();
    await this.banner(`${p.name} got the ${this.item.name}!`, `${p.items} of ${this.target}`, { ms: 2200, style: 'gold' });
    if (p.items >= this.target) { this.finish(p); return; }
    await this.placeItem();
    this.view.focus(p);
  }

  // ================= shop =================
  async shop(p, passing) {
    const forSale = POWERUPS.filter((pu) => !pu.hidden && (!pu.drinks || this.drinkOn));
    const full = p.powerups.length >= RULES.maxPowerups;
    if (passing) {
      const go = await this.ask(p, {
        title: '🛒 Shop', body: `Pop in? You have ${p.coins} coins.`,
        options: [{ id: 'yes', label: 'Have a look', tone: 'go' }, { id: 'no', label: 'Keep moving' }],
        bot: () => (!full && p.coins >= 8 && this.rng() < 0.6 ? 'yes' : 'no'), fallback: 'no',
      });
      if (go !== 'yes') return;
    }
    this.sfx.play('shop');
    const ans = await this.ask(p, {
      title: '🛒 Power-up shop', body: full ? `Your bag is full (${RULES.maxPowerups} max).` : `You have ${p.coins} coins.`,
      layout: 'list',
      options: [
        ...forSale.map((pu) => ({ id: pu.id, label: `${pu.emoji} ${pu.name} — ${pu.price} 🪙`, sub: pu.short, disabled: full || p.coins < pu.price })),
        { id: 'leave', label: 'Leave the shop' },
      ],
      bot: () => {
        const afford = forSale.filter((pu) => !full && p.coins >= pu.price && p.coins - pu.price >= 5);
        return afford.length && this.rng() < 0.8 ? afford[Math.floor(this.rng() * afford.length)].id : 'leave';
      },
      fallback: 'leave',
    });
    const pu = POWERUP_BY_ID[ans];
    if (!pu || full || p.coins < pu.price) return;
    p.coins -= pu.price;
    p.powerups.push(pu.id);
    this.refresh();
    this.sfx.play('coin');
    this.toast(`${p.name} bought ${pu.emoji} ${pu.name}`);
  }

  // ================= toolkit for content =================
  // Ask a player a question on their phone. prompt = { title, body, options: [{ id, label, sub, disabled, tone }],
  // kind: 'choice' | 'roll', layout: 'grid' | 'list', timer (s), bot: value | () => value, fallback }.
  ask(p, prompt) { return this.hub.ask(p, prompt); }

  // Let p choose another player. filter(o) decides who's allowed; describe(o) adds a note.
  async pickPlayer(p, { title, body = '', filter = () => true, describe = () => '', allowSelf = false, bot } = {}) {
    const others = this.players.filter((o) => (allowSelf || o !== p));
    const options = others.map((o) => ({ id: o.id, label: o.name, sub: describe(o), disabled: !filter(o) }));
    if (!options.some((o) => !o.disabled)) return null;
    const ans = await this.ask(p, { title, body, options: [...options, { id: 'cancel', label: 'Never mind' }], bot: bot || (() => options.filter((o) => !o.disabled)[0].id) });
    return this.players.find((o) => o.id === ans) || null;
  }

  // Move a target marker around the board with the phone (◀ ▶, ⑂ to switch path) and confirm a space.
  // opts = { from, title, confirm, range, time (s, auto-confirm at 0), radius (blast preview), jumpToPlayers,
  //          onMove(space), bot: () => space }
  aim(p, opts) {
    const { from = p.space, title = 'Aim', confirm = 'Confirm', range = Infinity, time = 0, radius = 0, jumpToPlayers = false } = opts;
    const b = this.board;
    let cur = from, fork = 0;
    const show = () => {
      this.view.highlight(radius ? spacesWithin(b, cur, radius) : [cur], 0xff4fd8, cur);
      opts.onMove?.(cur);
    };
    show();
    this.view.focusSpace(cur);
    return new Promise((resolve) => {
      let done = false, timer = null, botTimer = null;
      const finish = () => {
        if (done) return;
        done = true;
        clearInterval(timer); clearTimeout(botTimer);
        handle.close();
        this.view.highlight(null);
        this.hud.countdown(null);
        resolve(cur);
      };
      const step = (to) => {
        if (to == null || spacesApart(b, from, to) > range) return;
        cur = to; fork = 0;
        this.sfx.play('tick');
        show();
        this.view.focusSpace(cur);
      };
      const buttons = [
        { id: 'back', label: '◀ Back' }, { id: 'fwd', label: 'Forward ▶' }, { id: 'fork', label: '⑂ Other path' },
        ...(jumpToPlayers ? this.players.filter((o) => o !== p).map((o) => ({ id: 'p:' + o.id, label: `→ ${o.name}`, small: true })) : []),
        { id: 'ok', label: confirm, tone: 'go', wide: true },
      ];
      const handle = this.hub.live(p, { kind: 'buttons', title, body: time ? `Auto in ${time}s` : '', buttons, timer: time || 0 }, (m) => {
        const node = b.nodes[cur];
        if (m.b === 'back') step(node.prev[0]);
        else if (m.b === 'fwd') step(node.next[fork % node.next.length]);
        else if (m.b === 'fork') {
          // cycle which forward path ▶ follows, and peek down it
          fork = (fork + 1) % Math.max(1, node.next.length);
          this.view.highlight([cur, node.next[fork]], 0xff4fd8, cur);
        } else if (m.b?.startsWith('p:')) { const o = this.players.find((x) => x.id === m.b.slice(2)); if (o) step(o.space); }
        else if (m.b === 'ok') finish();
      });
      if (time) {
        let left = time;
        this.hud.countdown(left);
        timer = setInterval(() => { left--; this.hud.countdown(left); opts.onTick?.(left); if (left <= 0) finish(); }, 1000 * Math.max(0.2, this.speed));
      }
      if (p.bot) {
        // bots walk the marker to their target then confirm
        const goal = opts.bot ? opts.bot() : from;
        const walk = () => {
          if (done) return;
          if (cur === goal) { finish(); return; }
          // step along the shortest path in either direction
          const node = b.nodes[cur];
          const near = [...node.next, ...node.prev].filter((j) => spacesApart(b, from, j) <= range);
          near.sort((x, y) => b.near[x][goal] - b.near[y][goal]);
          if (!near.length || b.near[near[0]][goal] >= b.near[cur][goal]) { finish(); return; }
          step(near[0]);
          botTimer = setTimeout(walk, 300 * this.speed);
        };
        botTimer = setTimeout(walk, 500 * this.speed);
      } else if (!time) {
        // a phone that's gone quiet still finishes eventually
        timer = setInterval(() => { if (!this.hub.connected(p)) finish(); }, 20000);
      }
    });
  }

  // Pick one of several directions (each is a list of spaces it covers) with ◀ ▶.
  aimDirection(p, { title, confirm = 'Go!', directions, bot }) {
    let i = 0;
    const show = () => this.view.highlight(directions[i].spaces, 0x3de1ff, null);
    show();
    return new Promise((resolve) => {
      let done = false;
      const finish = () => { if (done) return; done = true; handle.close(); this.view.highlight(null); resolve(directions[i]); };
      const handle = this.hub.live(p, { kind: 'buttons', title, body: '', buttons: [{ id: 'l', label: '◀' }, { id: 'r', label: '▶' }, { id: 'ok', label: confirm, tone: 'go', wide: true }] }, (m) => {
        if (m.b === 'l') { i = (i + directions.length - 1) % directions.length; this.sfx.play('tick'); show(); }
        else if (m.b === 'r') { i = (i + 1) % directions.length; this.sfx.play('tick'); show(); }
        else if (m.b === 'ok') finish();
      });
      if (p.bot) {
        const want = bot ? bot(directions) : 0;
        let k = 0;
        const t = setInterval(() => { if (i !== want && k++ < 10) { i = (i + 1) % directions.length; show(); } else { clearInterval(t); finish(); } }, 450 * this.speed);
      } else setTimeout(() => { if (!this.hub.connected(p)) finish(); }, 30000);
    });
  }

  banner(text, sub = '', opts = {}) { return this.hud.banner(text, sub, { ...opts, ms: (opts.ms || 1500) * this.speed }); }
  toast(text) { this.hud.toast(text); }
  wait(ms) { return sleep(ms * this.speed); }

  coins(p, delta, why = '', { quiet = false } = {}) {
    const before = p.coins;
    p.coins = Math.max(0, p.coins + delta);
    const real = p.coins - before;
    if (real) { this.view.floatText(p, `${real > 0 ? '+' : ''}${real} 🪙`, real > 0 ? '#ffd23f' : '#ff6b6b'); if (!quiet) this.sfx.play(real > 0 ? 'coin' : 'lose'); }
    this.refresh();
    return real;
  }

  // A hit from a power-up, Mario Party style: no health, you drop coins. They stay on your space
  // as a pile, and anyone who's behind (not the leader) can grab them by walking over it.
  async dropCoins(p, n, why = '') {
    n = Math.min(Math.round(n), p.coins);
    this.view.flinch(p);
    this.setMood(p, 'sad');
    if (n <= 0) { this.view.floatText(p, 'Skint!', '#ff6b6b'); return 0; }
    const lost = -this.coins(p, -n, why);
    const pile = this.piles.get(p.space) || { n: 0, prop: this.view.prop('coins', p.space) };
    pile.n += lost;
    pile.prop.setText(String(pile.n), '#ffd23f');
    this.piles.set(p.space, pile);
    await this.wait(300);
    return lost;
  }

  pickUpPile(p, space) {
    const pile = this.piles.get(space);
    if (this.leader() === p) { this.view.floatText(p, 'Leaders can\'t pick up', '#ffffff'); return; }
    this.piles.delete(space);
    pile.prop.remove();
    this.coins(p, pile.n, 'pickup');
    this.setMood(p, 'happy');
    this.toast(`🪙 ${p.name} picked up ${pile.n} dropped coins`);
  }

  async teleport(p, space) {
    await this.view.poof(p, space, this.speed);
    p.space = space;
    this.refresh();
  }

  // Push p back along the board n spaces.
  async knockBack(p, n) {
    for (let i = 0; i < n; i++) {
      const prev = this.board.nodes[p.space].prev;
      if (!prev.length) break;
      const to = prev[Math.floor(this.rng() * prev.length)];
      await this.view.hop(p, to, this.speed * 0.6);
      p.space = to;
    }
  }

  addEffect(p, id, rounds) {
    const e = p.effects.find((x) => x.id === id);
    if (e) e.rounds = Math.max(e.rounds, rounds); else p.effects.push({ id, rounds });
    this.refresh();
  }

  setMood(p, mood, ms = 2500) {
    p.mood = mood;
    this.view.setMood(p, mood);
    this.hud.setMood(p, mood);
    clearTimeout(p._moodT);
    if (mood !== 'neutral') p._moodT = setTimeout(() => this.setMood(p, 'neutral', 0), ms);
  }

  playersOn(spaces) { const s = new Set(spaces); return this.players.filter((p) => s.has(p.space)); }
  leader() { return leaderOf(this.players); }
  hasRolled(p) { return this.rolled.has(p.id); }

  refresh() {
    this.hud.renderPlayers(this.players, this.turn?.player, this.item);
    for (const p of this.players) this.hub.stats(p, {
      coins: p.coins, items: p.items, target: this.target,
      item: { name: this.item.name, emoji: this.item.emoji },
      powerups: p.powerups.map((id) => ({ id, name: POWERUP_BY_ID[id]?.name, emoji: POWERUP_BY_ID[id]?.emoji })),
      effects: p.effects.map((e) => ({ name: EFFECTS[e.id]?.name || e.id, rounds: e.rounds })),
      space: SPACE[this.board.nodes[p.space].type]?.label,
    });
  }
}
