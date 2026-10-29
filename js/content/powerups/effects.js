// Lasting effects a player can carry for a few rounds. Power-ups add them with game.addEffect(p, id, rounds).
// diceBonus is added to every roll while the effect lasts; onRoundEnd runs once at the end of each round.
export const EFFECTS = {
  sugar: {
    name: 'Sugar Rush', emoji: '🍬', diceBonus: 2,
    // the crash: drop 2 coins each round, for as long as it lasts
    async onRoundEnd(game, p) {
      game.toast(`🍬 ${p.name}'s sugar crash: dropped some coins`);
      await game.dropCoins(p, 2, 'Sugar crash');
    },
  },
};
