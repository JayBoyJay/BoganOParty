// Split screen helpers for minigames that give every player their own camera (Toy Cars; Marble
// Mayhem has its own copy in marble/ from MarbleDrinks). A pane is { id, camera, rect, label, color }
// with rect in 0..1 screen fractions from the top left. The minigame returns draw(r, target) that
// calls drawPanes, so the stage's bloom still applies (see stage.js).
import * as THREE from 'three';

// rows of panes with no empty cells, the players spread evenly over the rows (7 is 3 + 2 + 2,
// 5 is 3 + 2), picking the row count whose panes are closest to a TV shape
export function evenRows(n, W, H) {
  let best = null;
  for (let rows = 1; rows <= n; rows++) {
    const counts = Array.from({ length: rows }, (_, r) => Math.floor(n / rows) + (r < n % rows ? 1 : 0));
    const score = counts.reduce((a, c) => a + c * Math.abs(Math.log((W / c) / (H / rows) / 1.45)), 0) / n;
    if (!best || score < best.score) best = { counts, score };
  }
  return best.counts;
}

// n pane rects filling the screen left of a sidebar sidebar pixels wide
export function paneRects(n, sidebar = 0) {
  const W = innerWidth, H = innerHeight, AW = W - sidebar;
  const rows = evenRows(n, AW, H), out = [];
  rows.forEach((c, row) => { for (let i = 0; i < c; i++) out.push({ x: (i * AW / c) / W, y: row / rows.length, w: AW / c / W, h: 1 / rows.length }); });
  return out;
}

// draw each pane into target (the bloom buffer, or null for the screen). before(pane) runs ahead of
// each pane, e.g. to hide that player's own name tag. Shadows are worked out once for the frame.
export function drawPanes(r, target, scene, panes, before) {
  const size = target ? { x: target.width, y: target.height } : r.getSize(new THREE.Vector2());
  const W = size.x, H = size.y;
  const setRect = (x, y, w, h, on) => {
    if (target) { target.viewport.set(x, y, w, h); target.scissor.set(x, y, w, h); target.scissorTest = on; r.setRenderTarget(target); }
    else { r.setViewport(x, y, w, h); r.setScissor(x, y, w, h); r.setScissorTest(on); }
  };
  r.shadowMap.autoUpdate = false; r.shadowMap.needsUpdate = true;
  for (const p of panes) {
    const x = Math.round(p.rect.x * W), y = Math.round((1 - p.rect.y - p.rect.h) * H);
    const w = Math.round((p.rect.x + p.rect.w) * W) - x, h = Math.round((1 - p.rect.y) * H) - y;
    p.camera.aspect = w / h; p.camera.updateProjectionMatrix();
    setRect(x, y, w, h, true);
    before?.(p);
    r.render(scene, p.camera);
  }
  setRect(0, 0, W, H, false);
  r.shadowMap.autoUpdate = true;
}

// pane frames and name tags as a DOM layer over the canvas but under the minigame's own HUD, plus a
// strip down the right as wide as the runner's scoreboard so it doesn't cover anyone's pane
export function paneOverlay() {
  const root = document.createElement('div');
  root.style.cssText = 'position:fixed;inset:0;pointer-events:none;';
  document.body.insertBefore(root, document.getElementById('minigame'));
  const side = document.createElement('div');
  side.style.cssText = 'position:absolute;top:0;right:0;bottom:0;background:linear-gradient(180deg,#1b2440,#0d1222);display:none;';
  root.appendChild(side);
  const frames = new Map();
  let sideT = 0, sideW = 0;
  return {
    // the sidebar width in pixels, measured from the scoreboard twice a second
    sidebar(dt) {
      if ((sideT -= dt) <= 0) {
        sideT = 0.5;
        const b = document.querySelector('.mg-board')?.getBoundingClientRect();
        sideW = b?.width ? Math.ceil(b.width + 2 * (innerWidth - b.right)) : 0;
      }
      return sideW;
    },
    show(panes, sidebar) {
      side.style.display = panes.length && sidebar ? '' : 'none';
      side.style.width = sidebar + 'px';
      const seen = new Set();
      for (const p of panes) {
        seen.add(p.id);
        let el = frames.get(p.id);
        if (!el) {
          el = document.createElement('div');
          el.style.cssText = 'position:absolute;box-sizing:border-box;border:3px solid;';
          el.innerHTML = '<span style="position:absolute;left:0.5rem;bottom:0.5rem;padding:0.2rem 0.7rem;border-radius:0.5rem;background:rgba(10,10,20,0.75);color:#fff;font-weight:900;font-size:clamp(0.8rem,1.6vw,1.4rem);white-space:nowrap;"></span>';
          root.appendChild(el); frames.set(p.id, el);
        }
        const r = p.rect;
        el.style.left = r.x * 100 + '%'; el.style.top = r.y * 100 + '%'; el.style.width = r.w * 100 + '%'; el.style.height = r.h * 100 + '%';
        el.style.borderColor = p.color;
        if (el.firstChild.textContent !== p.label) el.firstChild.textContent = p.label;
        el.firstChild.style.borderLeft = `0.35rem solid ${p.color}`;
      }
      for (const [id, el] of frames) el.style.display = seen.has(id) ? '' : 'none';
    },
    remove() { root.remove(); },
  };
}
