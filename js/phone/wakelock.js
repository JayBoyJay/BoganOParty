// keep the phone's screen on while it's being used as a controller.
// Uses the Screen Wake Lock API where the browser has it (Chrome/Android, Safari 16.4+).
// Older browsers (older iOS especially) get the classic fallback: a tiny silent video looping
// out of sight, which stops the screen dimming because "media is playing".
// Both need a user tap before they're allowed, so we arm on the first tap and re-arm whenever
// the page comes back into view (the browser drops the lock when you switch apps).

let lock = null;
let video = null;

function fallbackVideo() {
  if (video) return video;
  video = document.createElement('video');
  video.src = 'img/phone/keepawake.mp4';
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('muted', '');
  video.setAttribute('aria-hidden', 'true');
  Object.assign(video.style, { position: 'fixed', left: '0', top: '0', width: '1px', height: '1px', opacity: '0.01', pointerEvents: 'none', zIndex: '-1' });
  document.body.appendChild(video);
  return video;
}

async function acquire() {
  if (document.hidden) return;
  if ('wakeLock' in navigator) {
    if (lock && !lock.released) return;
    try {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { lock = null; });
      return;
    } catch { /* refused (no tap yet, low battery mode, iframe): fall through to the video */ }
  }
  const v = fallbackVideo();
  if (v.paused) v.play().catch(() => {});
}

export function keepAwake() {
  const arm = () => acquire();
  // any tap counts as the gesture the browser wants; keep listening so a lost lock comes back on the next tap
  document.addEventListener('pointerdown', arm, { passive: true });
  document.addEventListener('click', arm, { passive: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) acquire(); });
  acquire();
}
