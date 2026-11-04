// The dice on the phone: grab them and flick them up off the top of the screen to throw them onto the TV.
// Loaded only when a roll comes up (it pulls in three.js), and the phone falls back to a ROLL button if it can't.
import * as THREE from 'three';
import { makeD10 } from '../dice3d.js';

let renderer = null; // one WebGL context for the whole visit: phones only allow a few
function getRenderer() {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.domElement.className = 'rollcv';
  }
  return renderer;
}

// box: the element to fill. opts = { dice, color, onThrow({ power, aim, spin }), onMiss() }. Returns stop().
export function mountRoll(box, { dice = 1, color = '#ff7a3d', onThrow, onMiss } = {}) {
  const r = getRenderer();
  const cv = r.domElement;
  box.appendChild(cv);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x3a1a0a, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(-3, 5, 8);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, 12);
  const visH = 2 * 12 * Math.tan(THREE.MathUtils.degToRad(19));

  const n = Math.max(1, Math.min(6, dice | 0));
  const group = new THREE.Group();
  scene.add(group);
  const meshes = Array.from({ length: n }, () => {
    const m = makeD10(color, 1);
    m.quaternion.setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6));
    group.add(m);
    return m;
  });

  // sizes and where the dice sit, from the box's shape (works upright or sideways)
  let W = 1, H = 1, unit = 1, home = new THREE.Vector3();
  const fit = () => {
    const w = Math.max(1, box.clientWidth), h = Math.max(1, box.clientHeight);
    if (w === W && h === H) return;
    W = w; H = h;
    r.setSize(w, h, false);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    camera.aspect = w / h; camera.updateProjectionMatrix();
    unit = visH / h; // world units per pixel
    const visW = visH * camera.aspect;
    const size = Math.min(visH * 0.22, visW / (n * 2.6));
    meshes.forEach((m, i) => { m.scale.setScalar(size); m.position.set((i - (n - 1) / 2) * size * 2.3, 0, 0); });
    home.set(0, -visH * 0.18, 0);
    if (state === 'rest') group.position.copy(home);
  };

  let state = 'rest'; // rest | drag | back | gone
  let raf = 0, last = performance.now(), t = 0;
  const vel = new THREE.Vector3(); // world units/s once thrown
  let spinV = new THREE.Vector3(); // tumble while flying
  let trail = []; // recent pointer points [x, y, time]
  let grab = null; // pointer offset from the dice when grabbed
  const q = new THREE.Quaternion(), axis = new THREE.Vector3();

  const toWorld = (x, y) => new THREE.Vector3((x - W / 2) * unit, (H / 2 - y) * unit, 0);
  const local = (e) => { const b = cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };

  const down = (e) => {
    if (state === 'gone') return;
    e.preventDefault();
    cv.setPointerCapture?.(e.pointerId);
    const [x, y] = local(e);
    state = 'drag';
    grab = group.position.clone().sub(toWorld(x, y));
    trail = [[x, y, performance.now()]];
  };
  const move = (e) => {
    if (state !== 'drag') return;
    e.preventDefault();
    const [x, y] = local(e);
    const p = trail[trail.length - 1];
    trail.push([x, y, performance.now()]);
    if (trail.length > 12) trail.shift();
    group.position.copy(toWorld(x, y).add(grab));
    // the dice roll under your finger
    const dx = x - p[0], dy = y - p[1];
    const d = Math.hypot(dx, dy);
    if (d > 0) {
      axis.set(dy, dx, 0).normalize();
      q.setFromAxisAngle(axis, d * 0.012);
      for (const m of meshes) m.quaternion.premultiply(q);
    }
  };
  const up = (e) => {
    if (state !== 'drag') return;
    e.preventDefault();
    const now = performance.now();
    const recent = trail.filter((p) => now - p[2] < 110);
    const a = recent[0] || trail[0], b = trail[trail.length - 1];
    const dt = Math.max(16, b[2] - a[2]);
    const vx = (b[0] - a[0]) / dt, vy = (b[1] - a[1]) / dt; // px per ms, y down
    const shortSide = Math.min(W, H);
    // a flick is quick and upwards: about a third of the screen in a tenth of a second
    const need = shortSide / 450;
    if (vy < -need && -vy > Math.abs(vx) * 0.6) {
      const power = Math.max(0, Math.min(1, (-vy - need) / (need * 3.5)));
      const aim = Math.max(-1, Math.min(1, vx / -vy));
      const spin = Math.max(-1, Math.min(1, vx / (need * 4)));
      state = 'gone';
      vel.set(vx * 1000 * unit, -vy * 1000 * unit, -3 - power * 6);
      spinV.set(-vy * 9, vx * 9, (Math.random() - 0.5) * 6);
      onThrow?.({ power, aim, spin });
    } else {
      state = 'back';
      onMiss?.();
    }
  };
  cv.addEventListener('pointerdown', down);
  cv.addEventListener('pointermove', move);
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);

  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now; t += dt;
    fit();
    if (state === 'rest') {
      // waiting to be picked up: a lazy tumble and a bob
      group.position.y = home.y + Math.sin(t * 2.4) * visH * 0.012;
      for (const [i, m] of meshes.entries()) { m.rotation.x += dt * (0.5 + i * 0.1); m.rotation.y += dt * 0.8; }
    } else if (state === 'back') {
      group.position.lerp(home, 1 - Math.pow(0.0005, dt));
      if (group.position.distanceTo(home) < 0.02) state = 'rest';
    } else if (state === 'gone') {
      group.position.addScaledVector(vel, dt);
      vel.multiplyScalar(Math.pow(0.6, dt));
      for (const m of meshes) {
        axis.copy(spinV); const ang = axis.length() * dt;
        if (ang > 0) { q.setFromAxisAngle(axis.normalize(), ang); m.quaternion.premultiply(q); }
      }
    }
    r.render(scene, camera);
  };
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    cv.removeEventListener('pointerdown', down);
    cv.removeEventListener('pointermove', move);
    cv.removeEventListener('pointerup', up);
    cv.removeEventListener('pointercancel', up);
    cv.remove();
    for (const m of meshes) { m.geometry.dispose(); for (const mt of m.material) mt.dispose(); }
  };
}
