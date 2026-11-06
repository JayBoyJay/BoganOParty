// "Hold your phone this way" prompt. When a screen wants the phone sideways (or upright) and the phone
// is the other way round, a full-screen card with a turning-phone icon covers it, and it stays until the
// phone is turned. Anyone can switch it off for good with "Do not show me this prompt again" (handy with
// rotation lock on, where the page never turns).
const KEY = 'bop:noturn';
const off = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };

let want = null; // 'landscape' | 'portrait' | null (either way is fine)
let el = null;

const isLandscape = () => (window.matchMedia ? matchMedia('(orientation: landscape)').matches : innerWidth > innerHeight);

function build() {
  el = document.createElement('div');
  el.id = 'turnPrompt';
  el.className = 'turnp hidden';
  el.setAttribute('role', 'dialog');
  el.innerHTML = `<div class="turnin">
      <div class="turnicon" aria-hidden="true"><div class="tphone"><i></i></div><div class="tarrow">↻</div></div>
      <h2 class="turnt"></h2>
      <div class="dim turnb"></div>
      <button class="turnoff">Do not show me this prompt again</button>
      <div class="dim turnlock">Phone won't turn? Switch off rotation lock, or tap the button above.</div>
    </div>`;
  el.querySelector('.turnoff').onclick = () => {
    try { localStorage.setItem(KEY, '1'); } catch { /* private mode */ }
    update();
  };
  // nothing behind the card should get taps or zoom gestures while it's up
  el.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  document.body.appendChild(el);
}

function update() {
  if (!el) return;
  const wrong = want && !off() && (want === 'landscape') !== isLandscape();
  el.classList.toggle('hidden', !wrong);
  if (!wrong) return;
  el.classList.toggle('toland', want === 'landscape');
  el.classList.toggle('toport', want === 'portrait');
  el.querySelector('.turnt').textContent = want === 'landscape' ? 'Turn your phone sideways' : 'Turn your phone upright';
  el.querySelector('.turnb').textContent = want === 'landscape'
    ? 'This game is played with the phone held sideways, like a controller.'
    : 'This one is played with the phone held upright.';
}

// tell the prompt which way the current screen wants the phone held (null for either way)
export function wantOrientation(w) {
  if (!el) build();
  want = w === 'landscape' || w === 'portrait' ? w : null;
  update();
}

addEventListener('resize', update);
addEventListener('orientationchange', () => setTimeout(update, 60));
try { matchMedia('(orientation: landscape)').addEventListener('change', update); } catch { /* old browser */ }
