// Mr Music Maa'm: cheap, and it starts the moment you buy it. For 3 turns your phone becomes a
// little keyboard whenever you're waiting, and whatever you play goes out over the background music
// on the TV, in the song's key and on the beat (see Music.playerNote in js/host/music.js).
export default {
  id: 'mr-music', name: "Mr Music Maa'm", emoji: '🎹', price: 3, instant: true,
  short: 'Play a tune over the music from your phone for 3 turns',
  botWants: () => false,
  async onBuy(game, p) {
    game.addEffect(p, 'music', 3);
    const e = p.effects.find((x) => x.id === 'music'); if (e) e.fresh = true; // 3 full rounds from here
    game.sfx.play('item');
    game.toast(`🎹 ${p.name} is on the keys for 3 turns`);
  },
  // only reached if it ends up in a bag (the ?give= test hook): start it then
  async use(game, p) { await this.onBuy(game, p); },
};
