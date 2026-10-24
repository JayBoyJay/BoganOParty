// Every minigame. One is picked at random after each round (no repeats until they've all been played).
// To add one, copy plane-instructor.js, give it a new id, and add it here. See README.md → "Adding content".
import planeInstructor from './plane-instructor.js';
import chadsJapaneseAdventure from './chads-japanese-adventure.js';
import greatBiscuitHeist from './great-biscuit-heist.js';
import burgerBoys from './burger-boys.js';
import marbleMayhem from './marble-mayhem.js';
import joeMaster from './joe-master.js';
import toyCars from './toy-cars.js';
import ripstickRider from './ripstick-rider.js';
import alansFarm from './alans-farm.js';
import backYard from './back-yard.js';
import justATrim from './just-a-trim.js';
import dubaiHighFlyer from './dubai-high-flyer.js';
import mineYourOwnBusiness from './mine-your-own-business.js';
import perfectPour from './perfect-pour.js';
import likeMyPost from './like-my-post.js';
import distroWars from './distro-wars.js';
import draw from './draw.js';
import thongThrow from './thong-throw.js';
import sausageSizzle from './sausage-sizzle.js';
import eskyTetris from './esky-tetris.js';
import wheelieBinDerby from './wheelie-bin-derby.js';

export const MINIGAMES = [planeInstructor, chadsJapaneseAdventure, greatBiscuitHeist, burgerBoys, marbleMayhem, joeMaster, toyCars, ripstickRider, alansFarm, backYard, justATrim, dubaiHighFlyer, mineYourOwnBusiness, perfectPour, likeMyPost, distroWars, draw, thongThrow, sausageSizzle, eskyTetris, wheelieBinDerby];
export const MINIGAME_BY_ID = Object.fromEntries(MINIGAMES.map((m) => [m.id, m]));
