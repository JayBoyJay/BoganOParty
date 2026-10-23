// Every minigame. One is picked at random after each round (no repeats until they've all been played).
// To add one, copy plane-instructor.js, give it a new id, and add it here. See README.md → "Adding content".
import planeInstructor from './plane-instructor.js';

export const MINIGAMES = [planeInstructor];
export const MINIGAME_BY_ID = Object.fromEntries(MINIGAMES.map((m) => [m.id, m]));
