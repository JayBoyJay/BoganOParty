// Holy Hand Grenade (of Antioch), as in Worms: lob it up to 8 spaces, count to three (not five),
// and a choir sings before a huge blast. Anyone caught in it drops coins on the spot (most in the middle,
// fewer further out) for anyone behind to pick up; anyone close gets blown back a couple of spaces.
// Yes, it can hit you too.
import { spacesWithin } from '../../board.js';

const RANGE = 8, RADIUS = 2;
const COINS = [10, 6, 3]; // coins dropped, by distance from the blast

export default {
  id: 'holy-hand-grenade', name: 'Holy Hand Grenade', emoji: '✝️', price: 15,
  short: 'Huge blast: knocks coins loose. Count to three.',
  botWants: (game, p) => game.players.some((o) => o !== p && game.board.near[p.space][o.space] <= RANGE),
  async use(game, p) {
    const space = await game.aim(p, {
      title: '✝️ Aim the Holy Hand Grenade', confirm: '🙏 Throw!', range: RANGE, radius: RADIUS,
      bot: () => bestSpace(game, p),
    });
    const g = game.view.prop('grenade', p.space);
    await game.banner('One… two… FIVE!', '"Three, sir!"', { ms: 1300, small: true });
    await game.banner('THREE!', '', { ms: 700 });
    await g.throwTo(space, game.speed);
    game.sfx.play('hallelujah');
    await game.wait(1400);
    g.remove();
    game.sfx.play('bigboom');
    await game.view.explode(space, RADIUS, 0xffd23f, game.speed, 1.6);
    const b = game.board;
    const hit = game.playersOn(spacesWithin(b, space, RADIUS));
    if (!hit.length) { await game.banner('Missed!', 'The Lord is merciful today', { ms: 1400, small: true }); return; }
    for (const o of hit) {
      const d = b.near[space][o.space];
      await game.dropCoins(o, COINS[d] ?? 0, 'Holy Hand Grenade');
      if (o !== p) game.setMood(o, 'angry');
      if (d <= 1 && o.space !== b.start) await game.knockBack(o, 2);
    }
  },
};

function bestSpace(game, p) {
  let best = p.space, score = -Infinity;
  for (const n of game.board.nodes) {
    if (game.board.near[p.space][n.idx] > RANGE) continue;
    let s = 0;
    for (const o of game.playersOn(spacesWithin(game.board, n.idx, RADIUS))) s += (o === p ? -4 : 1) * Math.min(o.coins, COINS[game.board.near[n.idx][o.space]] || 0);
    if (s > score) { score = s; best = n.idx; }
  }
  return best;
}
