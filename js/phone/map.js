// The phone's bird's-eye map of the board: every space, the roads between them, the item, dropped
// coins and where everyone is standing. The TV sends the layout once a game ({ t: 'board' }) and
// where everyone is with each stats update; this file only draws it and works out the route.
import { SPACE, routeTo } from '../board.js';

const hex = (n) => '#' + (n >>> 0).toString(16).padStart(6, '0');
const DPR = () => Math.min(3, window.devicePixelRatio || 1);

// ---------- the route to the item ----------
// { path, steps, rolls, forks: [{ in, name, sub, side }] } from your space to the item, or null
export function routeInfo(board, where, me) {
  const you = where?.players?.find((p) => p.id === me);
  if (!board || !you || where.item == null) return null;
  const path = routeTo(board.nodes, you.s, where.item);
  if (!path) return null;
  const forks = [];
  for (let i = 0; i < path.length - 1; i++) {
    const n = board.nodes[path[i]];
    if (n.next.length < 2) continue;
    const to = board.nodes[path[i + 1]];
    const road = to.b != null ? board.roads.branches[to.b] : null;
    forks.push({ in: i, name: road ? road.name : board.roads.loop, sub: road?.sub || '', side: !!road });
  }
  const steps = path.length - 1;
  return { path, steps, rolls: Math.max(1, Math.ceil(steps / (board.avgRoll || 5.5))), forks };
}

// ---------- drawing ----------
// little vector symbols matching the ones painted on the TV's spaces (see host/boardview.js)
function spaceIcon(g, type, x, y, r) {
  g.save();
  g.translate(x, y);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const ink = type === 'start' ? '#b3261e' : '#fff';
  g.strokeStyle = g.fillStyle = ink;
  if (type === 'blue' || type === 'red') {
    g.lineWidth = r * 0.26;
    g.beginPath(); g.moveTo(-r * 0.45, 0); g.lineTo(r * 0.45, 0);
    if (type === 'blue') { g.moveTo(0, -r * 0.45); g.lineTo(0, r * 0.45); }
    g.stroke();
  } else if (type === 'event' || type === 'start') {
    g.font = `${type === 'start' ? 'italic ' : ''}900 ${r * (type === 'start' ? 0.85 : 1.35)}px system-ui, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(type === 'start' ? 'GO' : '?', 0, r * 0.06);
  } else if (type === 'shop') {
    const k = r / 190;
    g.scale(k, k);
    g.lineWidth = 34;
    g.beginPath(); g.moveTo(-150, -110); g.lineTo(-100, -110); g.lineTo(-62, 60); g.lineTo(118, 60); g.stroke();
    g.beginPath(); g.moveTo(-92, -64); g.lineTo(148, -64); g.lineTo(122, 18); g.lineTo(-72, 18); g.closePath(); g.fill();
    g.beginPath(); g.arc(-40, 112, 32, 0, Math.PI * 2); g.arc(96, 112, 32, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

function spaceDisc(g, type, x, y, r) {
  g.beginPath(); g.arc(x, y + r * 0.18, r, 0, Math.PI * 2); g.fillStyle = 'rgba(0,0,0,0.45)'; g.fill();
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2);
  g.fillStyle = hex(SPACE[type]?.color ?? 0xffffff); g.fill();
  g.lineWidth = Math.max(1.5, r * 0.14); g.strokeStyle = 'rgba(255,255,255,0.85)'; g.stroke();
  spaceIcon(g, type, x, y, r);
}

function playerDot(g, p, x, y, r, { you = false, turn = false } = {}) {
  if (you) { g.beginPath(); g.arc(x, y, r * 1.55, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,0.22)'; g.fill(); }
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2);
  g.fillStyle = p.color || '#ff7a3d'; g.fill();
  g.lineWidth = you ? Math.max(3, r * 0.3) : Math.max(1.5, r * 0.16);
  g.strokeStyle = you ? '#fff' : 'rgba(0,0,0,0.75)'; g.stroke();
  g.fillStyle = '#1a0d06';
  g.font = `900 ${r * 1.1}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText((p.name || '?').trim().charAt(0).toUpperCase(), x, y + r * 0.06);
  if (turn) { g.font = `${r * 0.95}px system-ui, sans-serif`; g.fillText('🎲', x + r * 0.95, y - r * 0.95); }
}

function tag(g, text, x, y, size, color = '#fff', bg = 'rgba(10,4,2,0.82)') {
  g.font = `800 ${size}px system-ui, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const w = g.measureText(text).width + size * 0.9, h = size * 1.45;
  g.fillStyle = bg;
  g.beginPath(); g.roundRect ? g.roundRect(x - w / 2, y - h / 2, w, h, h / 2) : g.rect(x - w / 2, y - h / 2, w, h); g.fill();
  g.fillStyle = color; g.fillText(text, x, y + size * 0.04);
}

function arrowHead(g, x0, y0, x1, y1, s) {
  const a = Math.atan2(y1 - y0, x1 - x0), mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  g.beginPath();
  g.moveTo(mx + Math.cos(a) * s, my + Math.sin(a) * s);
  g.lineTo(mx + Math.cos(a + 2.5) * s, my + Math.sin(a + 2.5) * s);
  g.lineTo(mx + Math.cos(a - 2.5) * s, my + Math.sin(a - 2.5) * s);
  g.closePath(); g.fill();
}

// Draw the board into a canvas. o = { board, where, me, route (path), hl, cur, reach, tint, labels }
// Returns hit tests for taps: { playerAt(x, y), spaceAt(x, y) } in CSS pixels.
export function drawMap(cv, o) {
  const dpr = DPR(), W = cv.width, H = cv.height, g = cv.getContext('2d');
  g.clearRect(0, 0, W, H);
  const { board, where } = o;
  if (!board) return { playerAt: () => null, spaceAt: () => null };
  const nodes = board.nodes;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const n of nodes) { x0 = Math.min(x0, n.x); x1 = Math.max(x1, n.x); z0 = Math.min(z0, n.z); z1 = Math.max(z1, n.z); }
  const pad = (o.labels ? 30 : 20) * dpr;
  const k = Math.min((W - pad * 2) / Math.max(1, x1 - x0), (H - pad * 2) / Math.max(1, z1 - z0));
  const ox = (W - (x1 - x0) * k) / 2, oy = (H - (z1 - z0) * k) / 2;
  const P = (n) => [ox + (n.x - x0) * k, oy + (n.z - z0) * k];
  // space size: as big as the gaps between spaces allow
  let gap = Infinity;
  for (const n of nodes) for (const j of n.next) gap = Math.min(gap, Math.hypot(nodes[j].x - n.x, nodes[j].z - n.z));
  const r = Math.max(4 * dpr, Math.min(16 * dpr, gap * k * 0.42));
  const reach = o.reach ? new Set(o.reach) : null;

  // ground
  const bg = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
  bg.addColorStop(0, '#2b3b1d'); bg.addColorStop(1, '#141c0d');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);

  // roads: a dark kerb, then the bitumen
  for (const [w, col] of [[r * 1.5, '#0c0805'], [r * 1.05, '#4b433d']]) {
    g.lineWidth = w; g.strokeStyle = col; g.lineCap = 'round';
    g.beginPath();
    for (const n of nodes) for (const j of n.next) { const [ax, ay] = P(n), [bx, by] = P(nodes[j]); g.moveTo(ax, ay); g.lineTo(bx, by); }
    g.stroke();
  }
  // which way the roads run (players only ever go forward)
  g.fillStyle = 'rgba(255,255,255,0.35)';
  for (const n of nodes) for (const j of n.next) { const [ax, ay] = P(n), [bx, by] = P(nodes[j]); if (Math.hypot(bx - ax, by - ay) > r * 2.6) arrowHead(g, ax, ay, bx, by, r * 0.38); }

  // the route to the item
  if (o.route?.length > 1) {
    g.save();
    g.lineWidth = r * 0.62; g.strokeStyle = 'rgba(255,210,63,0.95)'; g.lineCap = 'round'; g.lineJoin = 'round';
    g.shadowColor = '#ffd23f'; g.shadowBlur = r * 1.2;
    g.beginPath();
    o.route.forEach((i, m) => { const [x, y] = P(nodes[i]); if (m) g.lineTo(x, y); else g.moveTo(x, y); });
    g.stroke();
    g.restore();
  }

  // spaces
  const hl = new Set(o.hl || []), tint = o.tint || '#ff4fd8';
  nodes.forEach((n, i) => {
    const [x, y] = P(n);
    g.globalAlpha = reach && !reach.has(i) ? 0.35 : 1;
    spaceDisc(g, n.t, x, y, r);
  });
  g.globalAlpha = 1;
  if (o.route?.length > 1) {
    g.fillStyle = '#ffd23f';
    for (let m = 1; m < o.route.length; m++) {
      const [ax, ay] = P(nodes[o.route[m - 1]]), [bx, by] = P(nodes[o.route[m]]);
      arrowHead(g, ax, ay, bx, by, r * 0.62);
    }
  }
  for (const i of hl) {
    const [x, y] = P(nodes[i]);
    g.beginPath(); g.arc(x, y, r * 1.35, 0, Math.PI * 2);
    g.lineWidth = r * 0.42; g.strokeStyle = tint; g.stroke();
  }
  if (o.cur != null && nodes[o.cur]) {
    const [x, y] = P(nodes[o.cur]);
    g.save(); g.strokeStyle = '#fff'; g.lineWidth = Math.max(2, r * 0.22); g.shadowColor = tint; g.shadowBlur = r;
    g.beginPath(); g.arc(x, y, r * 1.9, 0, Math.PI * 2); g.stroke();
    for (const a of [0, 1, 2, 3]) { const c = Math.cos(a * Math.PI / 2), s = Math.sin(a * Math.PI / 2); g.beginPath(); g.moveTo(x + c * r * 1.5, y + s * r * 1.5); g.lineTo(x + c * r * 2.5, y + s * r * 2.5); g.stroke(); }
    g.restore();
  }

  // dropped coins and the item
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const s of where?.piles || []) if (nodes[s]) { const [x, y] = P(nodes[s]); g.font = `${r * 1.2}px system-ui, sans-serif`; g.fillText('🪙', x - r * 0.75, y + r * 0.75); }
  if (where?.item != null && nodes[where.item]) {
    const [x, y] = P(nodes[where.item]);
    const glow = g.createRadialGradient(x, y, 0, x, y, r * 3);
    glow.addColorStop(0, 'rgba(255,220,90,0.95)'); glow.addColorStop(1, 'rgba(255,220,90,0)');
    g.fillStyle = glow; g.beginPath(); g.arc(x, y, r * 3, 0, Math.PI * 2); g.fill();
  }

  // players, fanned out when they share a space
  const spots = [];
  const bySpace = new Map();
  for (const p of where?.players || []) { if (!nodes[p.s]) continue; if (!bySpace.has(p.s)) bySpace.set(p.s, []); bySpace.get(p.s).push(p); }
  const pr = Math.max(6 * dpr, r * 0.95);
  for (const [s, ps] of bySpace) {
    const [cx, cy] = P(nodes[s]);
    ps.forEach((p, i) => {
      const a = -Math.PI / 2 + (i / ps.length) * Math.PI * 2;
      const d = ps.length > 1 ? pr * 1.1 : 0;
      spots.push({ p, x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d - (ps.length > 1 ? 0 : r * 0.2) });
    });
  }
  spots.sort((a, b) => (a.p.id === o.me) - (b.p.id === o.me)); // you on top
  for (const sp of spots) playerDot(g, sp.p, sp.x, sp.y, pr, { you: sp.p.id === o.me, turn: where.turn === sp.p.id });
  // the item as a pin stuck above its space, so players standing there don't hide it
  if (where?.item != null && nodes[where.item]) {
    const [x, y] = P(nodes[where.item]);
    const R = Math.max(9 * dpr, r * 1.25), py = y - R * 1.9;
    g.beginPath(); g.moveTo(x - R * 0.5, py + R * 0.75); g.lineTo(x, y - r * 0.3); g.lineTo(x + R * 0.5, py + R * 0.75); g.closePath();
    g.fillStyle = '#ffd23f'; g.fill();
    g.beginPath(); g.arc(x, py, R, 0, Math.PI * 2); g.fillStyle = '#2c160b'; g.fill();
    g.lineWidth = Math.max(2, R * 0.2); g.strokeStyle = '#ffd23f'; g.stroke();
    g.font = `${R * 1.25}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff';
    g.fillText(board.item?.emoji || '⭐', x, py + R * 0.08);
  }
  // name tags: YOU above your dot, everyone else's names below theirs (one tag per space)
  const fs = Math.max(10 * dpr, Math.min(15 * dpr, r * 0.95));
  for (const sp of spots) if (sp.p.id === o.me) tag(g, 'YOU', sp.x, sp.y - pr - fs, fs, '#1a0d06', '#fff');
  if (o.labels) for (const [s, ps] of bySpace) {
    const others = ps.filter((p) => p.id !== o.me);
    if (!others.length) continue;
    const [cx, cy] = P(nodes[s]);
    const text = others.map((p) => p.name).join(', ');
    tag(g, text, cx, cy + pr * (ps.length > 1 ? 2.1 : 1) + fs * 0.9, fs, others.length === 1 ? others[0].color || '#fff' : '#fff');
  }

  return {
    playerAt(px, py) {
      let best = null, bd = pr * 1.8;
      for (const sp of spots) { const d = Math.hypot(sp.x - px * dpr, sp.y - py * dpr); if (d < bd) { bd = d; best = sp.p; } }
      return best;
    },
    spaceAt(px, py) {
      let best = null, bd = r * 2.2;
      nodes.forEach((n, i) => { const [x, y] = P(n); const d = Math.hypot(x - px * dpr, y - py * dpr); if (d < bd) { bd = d; best = i; } });
      return best;
    },
  };
}

// width / height of the board, so a map box can be shaped to fit it
export function boardAspect(board) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const n of board?.nodes || []) { x0 = Math.min(x0, n.x); x1 = Math.max(x1, n.x); z0 = Math.min(z0, n.z); z1 = Math.max(z1, n.z); }
  return x1 > x0 && z1 > z0 ? (x1 - x0 + 8) / (z1 - z0 + 8) : 1;
}

// A canvas that fills `box`, redraws when the box resizes, and reports taps.
// get() returns the drawMap options; onTap(hits, x, y) gets the hit tests.
export function mountMap(box, get, onTap) {
  const cv = document.createElement('canvas');
  cv.className = 'mapcanvas';
  box.appendChild(cv);
  let hits = null;
  const redraw = () => {
    const r = box.getBoundingClientRect(), dpr = DPR();
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    hits = drawMap(cv, get());
  };
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(redraw) : null;
  ro?.observe(box);
  if (onTap) cv.addEventListener('pointerdown', (e) => {
    const r = cv.getBoundingClientRect();
    if (hits) onTap(hits, e.clientX - r.left, e.clientY - r.top);
  });
  redraw();
  return { redraw, destroy: () => { ro?.disconnect(); cv.remove(); } };
}

// small icon canvases for the legend
export function legendIcon(kind, color) {
  const dpr = DPR(), S = 30, cv = document.createElement('canvas');
  cv.width = cv.height = S * dpr; cv.style.width = cv.style.height = S + 'px';
  const g = cv.getContext('2d'), c = S * dpr / 2, r = S * dpr * 0.36;
  if (SPACE[kind]) spaceDisc(g, kind, c, c - r * 0.1, r);
  else if (kind === 'you' || kind === 'them') playerDot(g, { name: kind === 'you' ? 'Y' : 'M', color }, c, c, r * 0.85, { you: kind === 'you' });
  else if (kind === 'route') {
    g.lineWidth = r * 0.55; g.strokeStyle = '#ffd23f'; g.lineCap = 'round';
    g.beginPath(); g.moveTo(c - r * 1.2, c); g.lineTo(c + r * 1.2, c); g.stroke();
    g.fillStyle = '#ffd23f'; arrowHead(g, c - r, c, c + r * 1.6, c, r * 0.75);
  } else { g.font = `${r * 1.7}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(kind, c, c + r * 0.1); }
  return cv;
}
