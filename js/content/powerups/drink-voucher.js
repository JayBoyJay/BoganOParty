// Drink Voucher: shout a mate a drink they didn't ask for. Pick anyone and they drink
// (unless they're holding a Reverse Card, in which case it might come straight back).
// Only in the shop when drinking is turned on in the lobby.
export default {
  id: 'drink-voucher', name: 'Drink Voucher', emoji: '🍺', price: 15, drinks: true,
  short: 'Pick someone. They drink.',
  botWants: (game) => game.rng() < 0.6,
  async use(game, p) {
    const target = await game.pickPlayer(p, {
      title: '🍺 Drink voucher: who drinks?',
      body: 'Careful: anyone holding a Reverse Card can send it back.',
      describe: (o) => `🍺 ${o.drinks || 0} so far`,
      bot: () => { const others = game.players.filter((o) => o !== p); return others[Math.floor(game.rng() * others.length)].id; },
    });
    if (!target) return false;
    game.setMood(p, 'happy');
    const drank = await game.drinks.give(p, target, 'drink voucher');
    game.setMood(drank, 'sad');
  },
};
