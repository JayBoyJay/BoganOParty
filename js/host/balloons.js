// Emote balloons: when a player pulls a face from their phone, a balloon of their head (with that
// face on it) rises from the bottom of the TV and floats off the top. Plain DOM over everything, so
// it works the same over the board, the minigame results card and the standings stage.
const EMOJI = { neutral: '😐', happy: '😁', sad: '😢', angry: '😡' };
const MAX_LIVE = 24; // a room mashing the buttons can't fill the screen
const GAP_MS = 350; // per player, so one phone can't machine-gun them

export class Balloons {
  constructor(faceFor) {
    this.faceFor = faceFor; // (player, mood) -> image url
    this.root = document.createElement('div');
    this.root.id = 'balloons';
    document.body.appendChild(this.root);
    this.last = new Map();
    this.lane = 0;
  }

  launch(p, mood) {
    const now = performance.now();
    if (now - (this.last.get(p.id) || -1e9) < GAP_MS) return false;
    if (this.root.childElementCount >= MAX_LIVE) return false;
    this.last.set(p.id, now);

    const el = document.createElement('div');
    el.className = 'balloon';
    el.style.setProperty('--pc', p.color || '#fff');
    // spread them out: step across the screen in golden-ratio jumps, plus a little jitter
    this.lane = (this.lane + 0.618) % 1;
    el.style.left = `${8 + this.lane * 84 + (Math.random() - 0.5) * 4}%`;
    el.innerHTML = `<div class="b-sway"><div class="b-head"><img src="${this.faceFor(p, mood)}" alt=""><i class="b-shine"></i><span class="b-emo">${EMOJI[mood] || ''}</span></div>
      <i class="b-knot"></i><svg class="b-string" viewBox="0 0 20 90" preserveAspectRatio="none"><path d="M10 0 C 2 18, 18 36, 10 54 S 4 78, 10 90"/></svg></div>`;
    this.root.appendChild(el);

    const dur = 5200 + Math.random() * 1600;
    const rise = el.animate([
      { transform: 'translate(-50%, 0) scale(0.6)', opacity: 0 },
      { transform: 'translate(-50%, -22vh) scale(1)', opacity: 1, offset: 0.12 },
      { transform: 'translate(-50%, calc(-100vh - 100%)) scale(1)', opacity: 1 },
    ], { duration: dur, easing: 'cubic-bezier(.3,.1,.6,1)', fill: 'forwards' });
    const dir = Math.random() < 0.5 ? -1 : 1;
    el.firstElementChild.animate([
      { transform: `rotate(${-6 * dir}deg) translateX(0)` },
      { transform: `rotate(${6 * dir}deg) translateX(${2.5 * dir}vw)` },
      { transform: `rotate(${-6 * dir}deg) translateX(0)` },
    ], { duration: 2200 + Math.random() * 600, iterations: Infinity, easing: 'ease-in-out' });
    rise.finished.then(() => el.remove(), () => el.remove());
    return true;
  }

  clear() { this.root.innerHTML = ''; this.last.clear(); }
}
