// Every minigame. One is picked at random after each round (no repeats until they've all been played).
// Only the id and name live here (the wheel needs those); the game itself, in <id>.js, is loaded when
// it's picked, so the TV starts without downloading and building all of them. To add one, copy
// plane-instructor.js, give it a new id (the file is named after it) and add [id, name] here.
// See README.md → "Adding content".
const LIST = [
  ['plane-instructor', 'Plane Instructor'],
  ['chads-japanese-adventure', "Chad's Japanese Adventure"],
  ['great-biscuit-heist', 'The Great Biscuit Heist'],
  ['burger-boys', 'Burger Boys'],
  ['marble-mayhem', 'Marble Mayhem'],
  ['joe-master', 'Joe Master Universe'],
  ['toy-cars', 'Toy Cars'],
  ['ripstick-rider', 'Ripstick Rider'],
  ['alans-farm', "Alan's Farm"],
  ['back-yard', 'The (Back) Yard'],
  ['just-a-trim', 'Just a Trim'],
  ['dubai-high-flyer', 'Dubai High Flyer'],
  ['mine-your-own-business', 'Mine Your Own Business'],
  ['perfect-pour', 'Perfect Pour'],
  ['like-my-post', 'Like My Post'],
  ['distro-wars', 'Distro Wars'],
  ['draw', 'Draw!'],
  ['thong-throw', 'Thong Throw'],
  ['sausage-sizzle', 'Sausage Sizzle'],
  ['esky-tetris', 'Esky Tetris'],
  ['wheelie-bin-derby', 'Wheelie Bin Derby'],
  ['two-up', 'Two-Up'],
  ['sunscreen-slap', 'Sunscreen Slap'],
  ['footy-kick-to-kick', 'Footy Kick-to-Kick'],
  ['bottle-o-run', 'Bottle-O Run'],
  ['ute-muster', 'Ute Muster'],
  ['fishing-off-the-jetty', 'Fishing Off the Jetty'],
  ['zombies-vs-plants', 'Zombies vs Plants'],
  ['football-boy', 'Football Boy'],
  ['hand-tennis', 'Hand Tennis'],
];

export const MINIGAMES = LIST.map(([id, name]) => ({ id, name }));
export const MINIGAME_BY_ID = Object.fromEntries(MINIGAMES.map((m) => [m.id, m]));

// the full minigame ({ id, name, howTo, create... }) for a list entry; a failed download can be retried
const loading = new Map();
export function loadMinigame(entry) {
  if (!loading.has(entry.id)) {
    loading.set(entry.id, import(`./${entry.id}.js`).then((m) => m.default, (e) => { loading.delete(entry.id); throw e; }));
  }
  return loading.get(entry.id);
}

// Once the TV is up, quietly fetch the rest one at a time, so later picks start instantly and a
// flaky connection mid-party doesn't matter.
export async function prefetchMinigames() {
  for (const m of MINIGAMES) {
    await new Promise((r) => (window.requestIdleCallback || setTimeout)(r, { timeout: 2000 }));
    await loadMinigame(m).catch(() => {});
  }
}
