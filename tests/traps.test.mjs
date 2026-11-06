import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/host/engine.js';
import { buildBoard } from '../js/board.js';
import { MAPS } from '../js/content/maps/index.js';
import { TRAPS } from '../js/content/traps.js';

// a Game with the TV, phones and sounds stubbed out; every space is a trap spot, players parked on 0..n
function makeGame(coins, answer = 'yes') {
  const nop = () => {};
  const view = new Proxy({}, { get: (_, k) => k === 'prop' ? () => ({ setText: nop, remove: nop }) : nop });
  const players = coins.map((c, i) => ({ id: 'p' + i, name: 'P' + i }));
  const board = { start: 0, nodes: coins.map(() => ({ type: 'blue', trap: 'rock' })) };
  const game = new Game({
    map: { item: { name: 'Lead', emoji: '🪨' } }, board, players, settings: { fast: true },
    hub: { stats: nop, ask: async () => answer }, view, hud: { renderPlayers: nop, setMood: nop, toast: nop, banner: async () => {} }, sfx: { play: nop }, runMinigame: nop,
  });
  game.speed = 0;
  players.forEach((p, i) => { p.coins = coins[i]; p.space = i; });
  return { game, players };
}

test('every map has trap spots, all on plain spaces, all of a known kind', () => {
  for (const m of MAPS) {
    const b = buildBoard(m.board);
    const spots = b.nodes.filter((n) => n.trap);
    assert.ok(spots.length >= 3, `${m.id} has ${spots.length} traps`);
    for (const n of spots) {
      assert.ok(TRAPS[n.trap], `${m.id} ${n.id}: unknown trap ${n.trap}`);
      assert.equal(n.type, 'blue', `${m.id} ${n.id} is a ${n.type} space`);
    }
  }
});

test('setting a trap costs coins; the next person to land on it pays the setter', async () => {
  const { game, players: [a, b] } = makeGame([20, 15]);
  await game.offerTrap(a, 0);
  assert.equal(a.coins, 20 - TRAPS.rock.price);
  assert.equal(game.traps.get(0), a);
  await game.offerTrap(b, 0); // already set: nothing to buy
  assert.equal(b.coins, 15);
  await game.springTrap(a, 0); // your own trap doesn't go off on you
  assert.equal(game.traps.get(0), a);
  b.space = 0;
  await game.springTrap(b, 0);
  assert.equal(b.coins, 15 - TRAPS.rock.take);
  assert.equal(a.coins, 20 - TRAPS.rock.price + TRAPS.rock.take);
  assert.equal(game.traps.has(0), false, 'a sprung trap is empty again');
});

test('a trap only takes what you have', async () => {
  const { game, players: [a, b] } = makeGame([20, 3]);
  await game.offerTrap(a, 1);
  await game.springTrap(b, 1);
  assert.equal(b.coins, 0);
  assert.equal(a.coins, 20 - TRAPS.rock.price + 3);
});

test('a shield sets the trap off but blocks it, and breaks', async () => {
  const { game, players: [a, b] } = makeGame([20, 15]);
  b.powerups = ['shield', 'vacuum'];
  await game.offerTrap(a, 1);
  await game.springTrap(b, 1);
  assert.equal(b.coins, 15);
  assert.equal(a.coins, 20 - TRAPS.rock.price);
  assert.deepEqual(b.powerups, ['vacuum']);
  assert.equal(game.traps.has(1), false);
});

test('a shield blocks someone else\'s hit once, never your own', async () => {
  const { game, players: [a, b] } = makeGame([20, 15]);
  b.powerups = ['shield'];
  a.powerups = ['shield'];
  assert.equal(await game.shieldBlocks(a, a), false);
  assert.deepEqual(a.powerups, ['shield']);
  assert.equal(await game.shieldBlocks(b, a), true);
  assert.equal(await game.shieldBlocks(b, a), false);
});

test('saying no or being skint leaves the trap empty', async () => {
  const { game, players: [a, b] } = makeGame([20, 2], 'no');
  await game.offerTrap(a, 0);
  assert.equal(game.traps.size, 0);
  const g2 = makeGame([20, 2]);
  await g2.game.offerTrap(g2.players[1], 0);
  assert.equal(g2.game.traps.size, 0);
  assert.equal(g2.players[1].coins, 2);
});
