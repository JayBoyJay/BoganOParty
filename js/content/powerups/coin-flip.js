// Coin Flip: pick someone who hasn't rolled yet. They call heads or tails and flip on their phone.
// Right call: they steal your turn. Wrong call: you roll two dice this turn.
// Picking someone who has already rolled just wastes the power-up.
export default {
  id: 'coin-flip', name: 'Coin Flip', emoji: '🪙', price: 5,
  short: 'Heads or tails for the turn',
  botWants: (game, p) => game.players.some((o) => o !== p && !game.hasRolled(o)) && game.rng() < 0.4,
  async use(game, p) {
    const target = await game.pickPlayer(p, {
      title: '🪙 Coin flip: pick a player',
      body: "Pick someone who hasn't rolled yet. Picking someone who has wastes the power-up.",
      describe: (o) => (game.hasRolled(o) ? 'Already rolled: wastes it' : "Hasn't rolled yet"),
      bot: () => (game.players.find((o) => o !== p && !game.hasRolled(o)) || game.players.find((o) => o !== p)).id,
    });
    if (!target) return false;
    if (game.hasRolled(target)) {
      await game.banner('Wasted!', `${target.name} already rolled, so the coin flip fizzles`, { ms: 1800, small: true });
      game.setMood(p, 'sad');
      return;
    }
    const call = await game.ask(target, {
      title: `🪙 ${p.name} flipped a coin at you!`, body: 'Call it. Get it right and you steal their turn.',
      options: [{ id: 'heads', label: '👑 Heads' }, { id: 'tails', label: '🦘 Tails' }],
      bot: () => (game.rng() < 0.5 ? 'heads' : 'tails'), fallback: 'heads',
    });
    await game.ask(target, { title: `You called ${call}`, body: 'Flick it!', options: [{ id: 'flip', label: '🪙 FLIP', tone: 'go' }], timer: 12 });
    const result = game.rng() < 0.5 ? 'heads' : 'tails';
    game.sfx.play('flip');
    await game.hud.coinFlip(result, `${target.name} called ${call}`, game.speed);
    if (call === result) {
      game.setMood(target, 'happy'); game.setMood(p, 'angry');
      await game.banner(`${target.name} called it!`, `${target.name} steals ${p.name}'s turn`, { ms: 2000 });
      game.turn.over = true;
      game.hud.setCurrent(target);
      await game.rollAndMove(target, { dice: 1, bonus: 0 });
    } else {
      game.setMood(p, 'happy'); game.setMood(target, 'sad');
      await game.banner('Wrong call!', `${p.name} rolls two dice this turn`, { ms: 1800 });
      game.turn.dice = 2;
    }
  },
};
