// Board graph: spaces, one-way links, distances and the item spawn rule.
// Pure logic with no three.js, so it can be unit tested in Node (see tests/).
//
// A map describes its board as one closed loop plus optional branches that leave the loop at one
// space and rejoin it further on. Players only ever move forward along `next` links.

export const SPACE = {
  start: { color: 0xf2f2f2, label: 'Start' },
  blue: { color: 0x2f7dff, label: '+3 coins' },
  red: { color: 0xff3b3b, label: '−3 coins' },
  event: { color: 0x2fd27a, label: 'Event' },
  shop: { color: 0xffb020, label: 'Shop' },
};
const CODE = { B: 'blue', R: 'red', E: 'event', S: 'shop', '.': 'blue' };

// ---------- geometry helpers ----------
function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])];
}
// Dense polyline along a Catmull-Rom curve through pts (closed or open).
function densify(pts, closed, per = 24) {
  const out = [], n = pts.length;
  const at = (i) => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) for (let k = 0; k < per; k++) out.push(catmull(at(i - 1), at(i), at(i + 1), at(i + 2), k / per));
  if (closed) out.push(out[0]); else out.push(pts[n - 1]);
  return out;
}
// count points evenly spaced by arc length along a dense polyline (endpoints excluded when open)
function resample(line, count, closed) {
  const acc = [0];
  for (let i = 1; i < line.length; i++) acc.push(acc[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
  const total = acc[acc.length - 1], out = [];
  for (let k = 0; k < count; k++) {
    const want = closed ? total * k / count : total * (k + 1) / (count + 1);
    let i = 1; while (i < acc.length - 1 && acc[i] < want) i++;
    const f = (want - acc[i - 1]) / Math.max(1e-9, acc[i] - acc[i - 1]);
    out.push([line[i - 1][0] + (line[i][0] - line[i - 1][0]) * f, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * f]);
  }
  return out;
}
const typeAt = (pattern, i) => CODE[pattern[i % pattern.length]] || 'blue';

// ---------- build ----------
// def = {
//   loop: { points: [[x, z], ...], count, pattern: 'BBRBE...' },
//   branches: [{ from, to, points: [[x, z], ...], count, pattern }],   // from/to are loop indices
//   shops: [loop index, ...],
// }
export function buildBoard(def) {
  const nodes = [];
  const add = (n) => { n.idx = nodes.length; nodes.push(n); return n; };
  const loopPts = resample(densify(def.loop.points, true), def.loop.count, true);
  const loop = loopPts.map(([x, z], i) => add({ id: 'L' + i, x, z, type: typeAt(def.loop.pattern || 'B', i), next: [] }));
  loop.forEach((n, i) => n.next.push(loop[(i + 1) % loop.length].idx));
  loop[0].type = 'start';
  for (const i of def.shops || []) loop[i].type = 'shop';
  (def.branches || []).forEach((b, bi) => {
    const a = loop[b.from], z = loop[b.to];
    const pts = resample(densify([[a.x, a.z], ...b.points, [z.x, z.z]], false), b.count, false);
    let prev = a;
    pts.forEach(([x, zz], k) => {
      const n = add({ id: `B${bi}_${k}`, x, z: zz, type: typeAt(b.pattern || 'B', k), next: [], branch: bi });
      prev.next.push(n.idx);
      prev = n;
    });
    prev.next.push(z.idx);
    for (const k of b.shops || []) nodes[nodes.length - pts.length + k].type = 'shop';
  });
  const prev = nodes.map(() => []);
  nodes.forEach((n) => n.next.forEach((j) => prev[j].push(n.idx)));
  nodes.forEach((n) => { n.prev = prev[n.idx]; });
  const board = { nodes, start: loop[0].idx, loopLength: loop.length };
  board.fwd = nodes.map((n) => bfs(nodes, n.idx, (m) => m.next));
  board.near = nodes.map((n) => bfs(nodes, n.idx, (m) => [...m.next, ...m.prev]));
  return board;
}

function bfs(nodes, from, links) {
  const d = new Array(nodes.length).fill(Infinity);
  d[from] = 0;
  const q = [from];
  while (q.length) {
    const i = q.shift();
    for (const j of links(nodes[i])) if (d[j] === Infinity) { d[j] = d[i] + 1; q.push(j); }
  }
  return d;
}

// Forward steps from a to b (how far a player at a must walk to reach b).
export const stepsTo = (board, a, b) => board.fwd[a][b];
// Steps ignoring direction (for blast radius and the like).
export const spacesApart = (board, a, b) => board.near[a][b];
export const spacesWithin = (board, from, r) => board.nodes.filter((n) => board.near[from][n.idx] <= r).map((n) => n.idx);

// ---------- standings ----------
export function leaderOf(players) {
  return [...players].sort((a, b) => (b.items - a.items) || (b.coins - a.coins))[0] || null;
}

// Next round's turn order from a minigame's placings (best first, ties share a group). Tied players
// and anyone missing from the placings keep their old order relative to each other.
export function turnOrderFrom(players, placings) {
  const place = new Map();
  placings.forEach((group, i) => { for (const p of group) place.set(p, i); });
  const last = placings.length;
  return players.map((p, i) => ({ p, i })).sort((a, b) => ((place.get(a.p) ?? last) - (place.get(b.p) ?? last)) || (a.i - b.i)).map((x) => x.p);
}

// ---------- item spawn rule ----------
// The item goes on the space furthest from every player (the space whose nearest player has the most
// steps to walk). If the players are all spread out (every pair at least `spreadGap` spaces apart),
// it goes on the space furthest from the leader instead.
export const ITEM_SPACE_TYPES = ['blue', 'red', 'event'];

export function defaultSpreadGap(board, playerCount) {
  return Math.max(4, Math.round(board.loopLength / Math.max(2, playerCount * 2)));
}

export function isSpreadOut(board, players, gap) {
  if (players.length < 2) return false;
  for (let i = 0; i < players.length; i++) for (let j = i + 1; j < players.length; j++) {
    const a = players[i].space, b = players[j].space;
    if (spacesApart(board, a, b) < gap) return false;
  }
  return true;
}

export function chooseItemSpace(board, players, { spreadGap, rng = Math.random, exclude = [] } = {}) {
  const gap = spreadGap ?? defaultSpreadGap(board, players.length);
  const taken = new Set([...players.map((p) => p.space), ...exclude]);
  const candidates = board.nodes.filter((n) => ITEM_SPACE_TYPES.includes(n.type) && !taken.has(n.idx));
  if (!candidates.length) return { space: null, rule: 'none' };
  const spread = isSpreadOut(board, players, gap);
  const leader = spread ? leaderOf(players) : null;
  const score = (n) => {
    if (!players.length) return 0;
    if (spread) return stepsTo(board, leader.space, n.idx);
    return Math.min(...players.map((p) => stepsTo(board, p.space, n.idx)));
  };
  let best = -Infinity, picks = [];
  for (const n of candidates) {
    const s = score(n);
    if (s > best) { best = s; picks = [n.idx]; } else if (s === best) picks.push(n.idx);
  }
  return { space: picks[Math.floor(rng() * picks.length)], rule: spread ? 'furthest-from-leader' : 'furthest-from-all', leader: leader?.id ?? null, distance: best };
}

// seeded random, for tests and repeatable boards
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
