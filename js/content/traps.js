// Board traps. Some spaces have a trap rig next to them (the map says which, with `traps` in its board
// def). Walk past or land on an empty one and you can pay to set it. The next person who lands on it
// (not you) gets hit, and their coins go straight to you. A Shield sets the trap off but blocks it:
// the shield breaks and nobody pays.
//
// To add a kind: add it here, give it a rig and a fall in boardview.js (buildTrapRig / springTrap),
// then put it on some spaces in a map.
export const TRAPS = {
  rock: {
    name: 'Falling Rock', emoji: '🪨', price: 6, take: 10,
    hit: (who) => `A rock fell on ${who}!`,
  },
  magpie: {
    name: 'Magpie Season', emoji: '🐦', price: 5, take: 8,
    hit: (who) => `${who} got swooped by a magpie!`,
  },
  mineshaft: {
    name: 'Mine Shaft', emoji: '🕳️', price: 8, take: 12,
    hit: (who) => `${who} fell down an old mine shaft!`,
  },
  dropbear: {
    name: 'Drop Bear', emoji: '🐨', price: 6, take: 10,
    hit: (who) => `A drop bear got ${who}!`,
  },
  balls: {
    name: "Mall's Balls", emoji: '🔮', price: 6, take: 10,
    hit: (who) => `The Mall's Balls flattened ${who}!`,
  },
};
