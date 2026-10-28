// Sugar Bomb: a bag of sugar with a 15 second fuse. Roll it along the board (or straight at a
// player) with your phone, or pop it early. Everyone within 2 spaces gets a Sugar Rush:
// +2 on their dice for 3 rounds, but the sugar crash makes them drop 2 coins each round.
import { spacesWithin } from '../../board.js';

const RADIUS = 2;

export default {
  id: 'sugar-bomb', name: 'Sugar Bomb', emoji: '🍬', price: 8,
  short: 'Roll it, pop it: Sugar Rush for 3 rounds',
  botWants: (game) => game.rng() < 0.6,
  async use(game, p) {
    const bomb = game.view.prop('sugar', p.space);
    bomb.setText('15');
    const space = await game.aim(p, {
      title: '🍬 Roll the sugar bomb', confirm: '💥 Pop it now', time: 15, radius: RADIUS, jumpToPlayers: true, range: 12,
      onMove: (s) => bomb.moveTo(s), onTick: (left) => bomb.setText(String(Math.max(0, left))),
      bot: () => bestSpace(game, p),
    });
    bomb.moveTo(space);
    await game.wait(400);
    bomb.remove();
    game.sfx.play('boom');
    await game.view.explode(space, RADIUS, 0xffffff, game.speed);
    const hit = game.playersOn(spacesWithin(game.board, space, RADIUS));
    if (!hit.length) { await game.banner('Missed!', 'Nobody got a sugar hit', { ms: 1400, small: true }); return; }
    for (const o of hit) { game.addEffect(o, 'sugar', 3); game.setMood(o, o === p ? 'sad' : 'angry'); }
    await game.banner('SUGAR RUSH!', `${hit.map((o) => o.name).join(', ')}: +2 dice, −2 coins a round, for 3 rounds`, { ms: 2400, style: 'sugar' });
  },
};

// the space within reach that hits the most rivals and not yourself
function bestSpace(game, p) {
  let best = p.space, score = -Infinity;
  for (const n of game.board.nodes) {
    if (game.board.near[p.space][n.idx] > 12) continue;
    const hit = game.playersOn(spacesWithin(game.board, n.idx, RADIUS));
    const s = hit.filter((o) => o !== p).length * 2 - (hit.includes(p) ? 3 : 0);
    if (s > score) { score = s; best = n.idx; }
  }
  return best;
}
