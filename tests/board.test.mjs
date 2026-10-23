// node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBoard, chooseItemSpace, isSpreadOut, stepsTo, mulberry32 } from '../js/board.js';
import { MAPS } from '../js/content/maps/index.js';

const ring = buildBoard({ loop: { points: [[0, 20], [-20, 0], [0, -20], [20, 0]], count: 20, pattern: 'B' } });

test('every map builds a board where every space can reach every other going forward', () => {
  for (const m of MAPS) {
    const b = buildBoard(m.board);
    for (const n of b.nodes) {
      assert.ok(n.next.length >= 1, `${m.id} ${n.id} has a way out`);
      for (const o of b.nodes) assert.ok(Number.isFinite(stepsTo(b, n.idx, o.idx)), `${m.id}: ${n.id} -> ${o.id}`);
    }
    assert.ok(b.nodes.filter((n) => n.next.length > 1).length >= 1, `${m.id} has a fork`);
    assert.ok(b.nodes.some((n) => n.type === 'shop'), `${m.id} has a shop`);
  }
});

test('item goes furthest from everyone when players are bunched up', () => {
  const players = [{ id: 'a', space: 0, items: 0, coins: 0 }, { id: 'b', space: 1, items: 0, coins: 0 }];
  const pick = chooseItemSpace(ring, players, { rng: mulberry32(1) });
  assert.equal(pick.rule, 'furthest-from-all');
  // one-way loop of 20: the space just behind them (19) is the longest walk for the nearest player (18 steps)
  assert.equal(pick.space, 19);
  assert.equal(pick.distance, 18);
});

test('item goes furthest from the leader when everyone is spread out', () => {
  const players = [
    { id: 'a', space: 0, items: 2, coins: 5 }, // leader
    { id: 'b', space: 7, items: 0, coins: 30 },
    { id: 'c', space: 14, items: 1, coins: 0 },
  ];
  assert.ok(isSpreadOut(ring, players, 5));
  const pick = chooseItemSpace(ring, players, { spreadGap: 5, rng: mulberry32(1) });
  assert.equal(pick.rule, 'furthest-from-leader');
  assert.equal(pick.leader, 'a');
  assert.equal(pick.space, 19);
});

test('leader ties on items are broken by coins', () => {
  const players = [{ id: 'a', space: 0, items: 1, coins: 5 }, { id: 'b', space: 10, items: 1, coins: 9 }];
  const pick = chooseItemSpace(ring, players, { spreadGap: 5, rng: mulberry32(1) });
  assert.equal(pick.leader, 'b');
  assert.equal(pick.space, 9);
});

test('item never lands on a player, the start, or a shop', () => {
  for (const m of MAPS) {
    const b = buildBoard(m.board);
    const rng = mulberry32(42);
    for (let i = 0; i < 200; i++) {
      const players = [0, 1, 2, 3].map((k) => ({ id: 'p' + k, space: Math.floor(rng() * b.nodes.length), items: k, coins: 0 }));
      const { space } = chooseItemSpace(b, players, { rng });
      assert.ok(!players.some((p) => p.space === space));
      assert.ok(['blue', 'red', 'event'].includes(b.nodes[space].type));
    }
  }
});
