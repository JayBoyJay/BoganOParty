// Every power-up in the shop. To add one, copy a file here (coin-flip.js is the simplest), give it a
// new id, and add it to this list. Power-ups are used before the dice roll; see README.md → "Adding content".
import coinFlip from './coin-flip.js';
import sugarBomb from './sugar-bomb.js';
import holyHandGrenade from './holy-hand-grenade.js';
import vacuum from './vacuum.js';
import teleport from './teleport.js';
import drinkVoucher from './drink-voucher.js';
import groupDrink from './group-drink.js';
import reverseCard from './reverse-card.js';

export const POWERUPS = [coinFlip, sugarBomb, teleport, vacuum, holyHandGrenade, reverseCard, drinkVoucher, groupDrink];
export const POWERUP_BY_ID = Object.fromEntries(POWERUPS.map((p) => [p.id, p]));
