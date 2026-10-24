// Reverse Card (you know the one): just hold onto it. The next time someone tries to give you a
// drink, you can bounce it straight back to them. It works by itself, so there's nothing to use on
// your turn. If they've got one too, they can bounce it back again.
// Only in the shop when drinking is turned on in the lobby.
export default {
  id: 'reverse-card', name: 'Reverse Card', emoji: '🔄', price: 8, drinks: true, passive: true,
  short: 'Hold it: bounce a drink back at whoever sent it',
  botWants: () => false,
  async use() { return false; },
};
