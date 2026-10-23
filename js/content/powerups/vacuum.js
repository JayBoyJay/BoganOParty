// Vacuum: point it down the board (any way out of your space) and suck. Everyone in the cone
// loses a random handful of coins to you, and there's a 1 in 4 chance you also nick one of
// their power-ups.
const REACH = 4;

export default {
  id: 'vacuum', name: 'Vacuum', emoji: '🌀', price: 12,
  short: 'Suck coins out of everyone in front of you',
  botWants: (game, p) => directions(game, p).some((d) => game.playersOn(d.spaces).some((o) => o !== p && o.coins > 0)),
  async use(game, p) {
    const dirs = directions(game, p);
    const dir = await game.aimDirection(p, {
      title: '🌀 Point the vacuum', confirm: '🌀 SUCK!', directions: dirs,
      bot: (ds) => {
        let best = 0, most = -1;
        ds.forEach((d, i) => { const c = game.playersOn(d.spaces).filter((o) => o !== p).reduce((s, o) => s + o.coins, 0); if (c > most) { most = c; best = i; } });
        return best;
      },
    });
    game.sfx.play('vacuum');
    await game.view.vacuum(p, dir.spaces, game.speed);
    const hit = game.playersOn(dir.spaces).filter((o) => o !== p);
    if (!hit.length) { await game.banner('Sucked up nothing', 'Just dust and a few chip crumbs', { ms: 1400, small: true }); return; }
    const lines = [];
    for (const o of hit) {
      const want = 1 + Math.floor(game.rng() * 8);
      const took = -game.coins(o, -want, 'vacuum');
      if (took) game.coins(p, took, 'vacuum');
      let extra = '';
      if (o.powerups.length && p.powerups.length < 3 && game.rng() < 0.25) {
        const [id] = o.powerups.splice(Math.floor(game.rng() * o.powerups.length), 1);
        p.powerups.push(id);
        extra = ' and a power-up';
      }
      game.setMood(o, 'angry');
      lines.push(`${o.name}: ${took} coins${extra}`);
    }
    game.setMood(p, 'happy');
    game.refresh();
    await game.banner('🌀 Hoovered!', lines.join(' · '), { ms: 2200 });
  },
};

// one direction per way out of the player's space: follow that road for REACH spaces
function directions(game, p) {
  const b = game.board, here = b.nodes[p.space];
  const walk = (start, key) => {
    const out = [start];
    let frontier = [start];
    for (let i = 1; i < REACH; i++) {
      frontier = frontier.flatMap((j) => b.nodes[j][key]);
      out.push(...frontier);
    }
    return [...new Set(out)];
  };
  return [
    ...here.next.map((j, i) => ({ label: here.next.length > 1 ? `Ahead (path ${i + 1})` : 'Ahead', spaces: walk(j, 'next') })),
    ...here.prev.map((j, i) => ({ label: here.prev.length > 1 ? `Behind (path ${i + 1})` : 'Behind', spaces: walk(j, 'prev') })),
  ];
}
