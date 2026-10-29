// Teleport: challenge another player to rock paper scissors, best of 3, on your phones.
// Whoever wins decides whether the two of you swap places.
const HANDS = [{ id: 'rock', label: '✊ Rock' }, { id: 'paper', label: '✋ Paper' }, { id: 'scissors', label: '✌️ Scissors' }];
const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

export default {
  id: 'teleport', name: 'Teleport', emoji: '✨', price: 10,
  short: 'Rock paper scissors to swap places',
  botWants: (game, p) => game.itemSpace != null && game.players.some((o) => o !== p && game.board.fwd[o.space][game.itemSpace] < game.board.fwd[p.space][game.itemSpace] - 4),
  async use(game, p) {
    const target = await game.pickPlayer(p, {
      title: '🌀 Teleport: who do you challenge?',
      describe: (o) => `${game.board.fwd[o.space][game.itemSpace] ?? '?'} spaces from the ${game.item.name}`,
      bot: () => [...game.players].filter((o) => o !== p).sort((a, b) => game.board.fwd[a.space][game.itemSpace] - game.board.fwd[b.space][game.itemSpace])[0].id,
    });
    if (!target) return false;
    let a = 0, b = 0, round = 1;
    while (a < 2 && b < 2) {
      const ask = (who, vs, score) => game.ask(who, {
        title: `Rock, paper, scissors vs ${vs.name}`, body: `Best of 3 · you ${score}`, options: HANDS,
        bot: () => HANDS[Math.floor(game.rng() * 3)].id, fallback: HANDS[Math.floor(game.rng() * 3)].id, timer: 20,
      });
      const [ha, hb] = await Promise.all([ask(p, target, `${a}–${b}`), ask(target, p, `${b}–${a}`)]);
      const winner = ha === hb ? null : BEATS[ha] === hb ? p : target;
      if (winner === p) a++; else if (winner === target) b++;
      game.sfx.play('tick');
      await game.hud.rps(p.name, ha, target.name, hb, winner ? `${winner.name} takes round ${round}` : 'Draw! Go again', game.speed);
      if (winner) round++;
    }
    const winner = a === 2 ? p : target, loser = winner === p ? target : p;
    game.setMood(winner, 'happy'); game.setMood(loser, 'angry');
    const d = (o) => game.board.fwd[o.space][game.itemSpace];
    const ans = await game.ask(winner, {
      title: `You won ${Math.max(a, b)}–${Math.min(a, b)}!`, body: `Swap places with ${loser.name}?`,
      options: [{ id: 'swap', label: '🌀 Swap places', tone: 'go' }, { id: 'stay', label: 'Stay put' }],
      bot: () => (d(loser) < d(winner) ? 'swap' : 'stay'), fallback: 'stay',
    });
    if (ans !== 'swap') { await game.banner(`${winner.name} stays put`, '', { ms: 1200, small: true }); return; }
    const sa = p.space, sb = target.space;
    game.sfx.play('teleport');
    await Promise.all([game.teleport(p, sb), game.teleport(target, sa)]);
    await game.banner('Swapped!', `${p.name} ⇄ ${target.name}`, { ms: 1400, small: true });
  },
};
