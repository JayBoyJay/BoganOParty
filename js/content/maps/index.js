// Every board map. To add one, copy a map file (broken-hill.js is a good start), give it a new id,
// and add it to this list. See README.md → "Adding content".
import brokenHill from './broken-hill.js';
import adelaide from './adelaide.js';

export const MAPS = [brokenHill, adelaide];
export const MAP_BY_ID = Object.fromEntries(MAPS.map((m) => [m.id, m]));
