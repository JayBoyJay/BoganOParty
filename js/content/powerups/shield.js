// Shield (an esky lid held over your head): just hold onto it. The next time someone else's power-up
// or trap would hit you, the lid takes it and breaks instead: no coins dropped, no knock back, no
// Sugar Rush, nothing hoovered. It works by itself, so there's nothing to use on your turn.
// Your own Holy Hand Grenade still gets you, mind.
export default {
  id: 'shield', name: 'Esky Lid Shield', emoji: '🛡️', price: 8, passive: true,
  short: "Hold it: blocks the next power-up or trap that hits you",
  botWants: () => false,
  async use() { return false; },
};
