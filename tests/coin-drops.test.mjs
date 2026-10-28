import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/host/engine.js';

// a Game with the TV, phones and sounds stubbed out, players parked on spaces 0..n
function makeGame(coins) {
  const nop = () => {};
  const props = [];
  const view = new Proxy({}, { get: (_, k) => k === 'prop' ? () => { const pr = { text: '', removed: false, setText: (t) => { pr.text = t; }, remove: () => { pr.removed = true; } }; props.push(pr); return pr; } : nop });
  const players = coins.map((c, i) => ({ id: 'p' + i, name: 'P' + i }));
  const board = { start: 0, nodes: coins.map(() => ({ type: 'blue' })) };
  const game = new Game({
    map: { item: { name: 'Lead', emoji: '🪨' } }, board, players, settings: { fast: true },
    hub: { stats: nop }, view, hud: { renderPlayers: nop, setMood: nop, toast: nop }, sfx: { play: nop }, runMinigame: nop,
  });
  game.speed = 0;
  players.forEach((p, i) => { p.coins = coins[i]; p.space = i; });
  return { game, players, props };
}

test('a hit drops coins into a pile on the space, never more than the player has', async () => {
  const { game, players, props } = makeGame([5, 20]);
  assert.equal(await game.dropCoins(players[0], 10), 5);
  assert.equal(players[0].coins, 0);
  assert.equal(game.piles.get(0).n, 5);
  await game.dropCoins(players[0], 3);
  assert.equal(game.piles.get(0).n, 5, 'skint players drop nothing');
  assert.equal(props.length, 1);
  assert.equal(props[0].text, '5');
});

test('anyone behind picks up the whole pile; the leader walks past it', async () => {
  const { game, players } = makeGame([10, 30, 4]);
  await game.dropCoins(players[0], 6); // pile of 6 on space 0, P1 leads
  game.pickUpPile(players[1], 0);
  assert.equal(players[1].coins, 30);
  assert.equal(game.piles.get(0).n, 6);
  game.pickUpPile(players[2], 0);
  assert.equal(players[2].coins, 10);
  assert.equal(game.piles.has(0), false);
});
