// Group Drink Discount: you shout the whole bar. Everyone drinks, you included.
// Anyone holding a Reverse Card can bounce their one back to you.
// Only in the shop when drinking is turned on in the lobby.
export default {
  id: 'group-drink', name: 'Group Drink Discount', emoji: '🍻', price: 30, drinks: true,
  short: 'Everyone drinks (you too)',
  botWants: (game) => game.rng() < 0.7,
  async use(game, p) {
    await game.drinks.group(p, 'group drink discount');
    for (const o of game.players) game.setMood(o, 'happy');
  },
};
