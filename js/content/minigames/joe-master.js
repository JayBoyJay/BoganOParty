// Joe Master Universe: Mr Lee's PS2-style wrestling game as a minigame. Everyone's a "NAME MASTER"
// from some other universe, in a random outfit, all in the ring at once. Strike, grab, slam, pin.
// Pinned for a 3-count and you're out; last one standing wins (or the healthiest when time's up).
// With fewer than four players, the Original JOE MASTER himself comes out as a CPU.
// The match engine, rigs, venues and CPU brains are in ./joemaster/, ported from joemasteruniverse.
import { Arena } from './joemaster/arena.js';
import { Rig } from './joemaster/rig.js';
import { Match, Wrestler, BTN, pinBarPos } from './joemaster/game.js';
import { CpuBrain } from './joemaster/ai.js';
import { RING_H, SPACE } from './joemaster/tex.js';
import { JOE, COSTUME_BY_ID, RANDOM_POOL, SKIN, masterName } from './joemaster/characters.js';

const IDLE = { x: 0, y: 0, held: 0, pressed: 0, mash: 0 };

// the kick-out bar on the TV, so the room can see who's about to get counted out
const PIN_CSS = `
  .jm-pin { position: fixed; left: 50%; bottom: 13%; width: min(900px, 70vw); transform: translateX(-50%) skewX(-8deg); display: none; padding: 14px 22px 20px; z-index: 6; pointer-events: none;
    background: linear-gradient(#000d, #000e); border: 3px solid #000; box-shadow: 0 0 0 3px var(--sc, #fff), 0 12px 40px #000c; }
  .jm-pin.on { display: block; }
  .jm-pin > * { transform: skewX(8deg); }
  .jm-pin .lbl { font: italic 900 34px Impact, sans-serif; letter-spacing: 2px; text-align: center; margin-bottom: 10px; color: #fff; text-shadow: 0 3px 0 #000; }
  .jm-pin .lbl b { color: var(--sc, #fff); }
  .jm-pin .pips i { display: inline-block; width: 22px; height: 22px; margin-left: 8px; border: 3px solid #fff; border-radius: 50%; vertical-align: -2px; }
  .jm-pin .pips i.on { background: #4dff6a; border-color: #4dff6a; box-shadow: 0 0 12px #4dff6a; }
  .jm-pin .track { position: relative; height: 46px; background: linear-gradient(#3a0a0a, #200404); border: 3px solid #000; box-shadow: 0 0 0 2px #666; }
  .jm-pin .zone { position: absolute; top: 0; bottom: 0; background: linear-gradient(#8aff7a, #1fae3a); box-shadow: 0 0 18px #4dff6a; }
  .jm-pin .mark { position: absolute; top: -10px; bottom: -10px; width: 10px; margin-left: -5px; background: #fff; border: 2px solid #000; box-shadow: 0 0 10px #fff; }
  .jm-pin.hit .track { box-shadow: 0 0 0 4px #4dff6a, 0 0 30px #4dff6a; }
  .jm-pin.miss .track { box-shadow: 0 0 0 4px #ff3b3b; }`;

export default {
  id: 'joe-master',
  name: 'Joe Master Universe',
  blurb: 'Every Joe Master in the multiverse, one ring. Pin everyone else.',
  howTo: 'Drag the stick to move. STRIKE to punch (keep tapping for a combo), GRAB to grab and grab again to slam. Grab someone on the mat to pin them. Mash any button to escape or get up. Pinned? A bar pops up on your phone: tap once when the marker is in the green to kick out. The more hurt you are, the smaller the green.',
  padText: 'Last Master standing',
  duration: 75,
  pad: { kind: 'stick', buttons: [
    { bit: BTN.STRIKE, label: '👊 STRIKE', tone: 'go' }, { bit: BTN.GRAPPLE, label: '✊ GRAB', tone: 'go' },
    { bit: BTN.RUN, label: '🏃 RUN' }, { bit: BTN.BLOCK, label: '🛡️ BLOCK' },
  ] },

  create(mg) {
    const { THREE, scene, players, rng, sfx } = mg;
    const arena = new Arena(scene, 'BOGAN-O PARTY', rng() < 0.5 ? 'shed' : 'arena');
    const match = new Match(scene, arena);

    // outfits: everyone gets a different universe
    const pool = [...RANDOM_POOL].sort(() => rng() - 0.5);
    const roster = players.map((p, i) => ({ p, costume: COSTUME_BY_ID[pool[i % pool.length]], name: masterName(p.name), kind: p.bot ? 'cpu' : 'pad', char: 'master' }));
    if (players.length < 4) roster.push({ p: null, costume: JOE, name: JOE.name, kind: 'cpu', char: 'joe' });

    const entries = roster.map((r, i) => {
      // players who sent a photo wear their own face; everyone else gets Joe's, as is tradition
      const photo = r.p?.photos?.neutral;
      const rig = new Rig({ skin: SKIN, color: JOE.color, build: r.costume.build || 'average', faceImg: null, seed: rng() * 10, look: r.costume.look });
      if (photo) { const img = new Image(); img.onload = () => rig.setFace(img); img.src = photo; }
      const w = new Wrestler(match, { name: r.name, kind: r.kind, char: r.char }, rig);
      const a = (i / roster.length) * Math.PI * 2 + Math.PI / 4, rad = (roster.length > 4 ? 2.1 : 1.9 * Math.SQRT2) * SPACE;
      w.pos.set(Math.sin(a) * rad, Math.cos(a) * rad);
      w.yaw = Math.atan2(-w.pos.x, -w.pos.y);
      match.add(w);
      // a name tag over each head in the player's colour
      const tag = (() => {
        const c = document.createElement('canvas'); c.width = 512; c.height = 96;
        const g = c.getContext('2d'); g.font = 'italic 900 54px Impact, "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineWidth = 10; g.strokeStyle = '#000'; g.strokeText(r.name, 256, 50, 500); g.fillStyle = r.p?.color || '#c8a2ff'; g.fillText(r.name, 256, 50, 500);
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, fog: false })); s.scale.set(2.2, 0.41, 1); s.renderOrder = 10;
        scene.add(s); return s;
      })();
      // phone input, turned into the frames the engine wants (pressed = newly down this frame, mash = how many)
      const input = { x: 0, y: 0, held: 0, pressed: 0, mash: 0, pinTap: null };
      return { ...r, w, rig, tag, input, brain: r.kind === 'cpu' ? new CpuBrain(w, 1) : null, sentBar: null, sentBarV: -1, sentBarT: 0 };
    });

    const style = document.createElement('style'); style.textContent = PIN_CSS; document.head.appendChild(style);
    const pinEl = document.createElement('div'); pinEl.className = 'jm-pin';
    pinEl.innerHTML = '<div class="lbl"><b></b> · KICK OUT! <span class="pips"></span></div><div class="track"><div class="zone"></div><div class="mark"></div></div>';
    document.body.appendChild(pinEl);
    const pinWho = pinEl.querySelector('b'), pinPips = pinEl.querySelector('.pips'), pinZone = pinEl.querySelector('.zone'), pinMark = pinEl.querySelector('.mark');
    let pinKey = '';
    const updatePinUi = () => {
      const v = match.pin ? match.pin.v : null, B = v && v.state === 'pinned' ? v.pinBar : null;
      pinEl.classList.toggle('on', !!B);
      if (!B) { pinKey = ''; return; }
      const e = entries.find((x) => x.w === v), key = entries.indexOf(e) + ':' + B.v;
      if (pinKey !== key) {
        pinKey = key;
        pinEl.style.setProperty('--sc', e.p?.color || '#c8a2ff');
        pinWho.textContent = e.name;
        pinZone.style.left = (B.c - B.w / 2) * 100 + '%'; pinZone.style.width = B.w * 100 + '%';
        pinPips.innerHTML = Array.from({ length: B.need > 1 ? B.need : 0 }, (_, i) => `<i class="${i < B.hits ? 'on' : ''}"></i>`).join('');
      }
      pinMark.style.left = pinBarPos(B) * 100 + '%';
      pinEl.classList.toggle('hit', B.flash > 0 && B.good);
      pinEl.classList.toggle('miss', B.flash > 0 && !B.good);
    };
    // the pinned player's phone gets its own copy of the bar and judges its own taps, so lag can't cost them
    const pushPinBars = () => {
      for (const e of entries) {
        if (!e.p || e.brain) continue;
        const B = e.w.state === 'pinned' ? e.w.pinBar : null;
        if (B) {
          const now = performance.now();
          if (e.sentBar === B && e.sentBarV === B.v && now - e.sentBarT < 500) continue;   // resync twice a second so phone and TV agree
          e.sentBar = B; e.sentBarV = B.v; e.sentBarT = now;
          mg.padSend(e.p, { pin: 1, c: +B.c.toFixed(3), w: +B.w.toFixed(3), sp: B.speed, ph: +((B.ph + B.t * B.speed) % 2).toFixed(3), hits: B.hits, need: B.need, lock: +B.lock.toFixed(2) });
        } else if (e.sentBar) { e.sentBar = null; mg.padSend(e.p, { pin: 0 }); }
      }
    };
    const byPlayer = new Map(entries.filter((e) => e.p).map((e) => [e.p.id, e]));

    const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 300);
    const camPos = new THREE.Vector3(0, RING_H + 4, 10), camLook = new THREE.Vector3(0, RING_H + 1, 0), tPos = new THREE.Vector3(), tLook = new THREE.Vector3();
    let shake = 0, hitstop = 0, slowmo = 0, rang = false, simT = 0;
    const SOUND = { hit: 'bonk', slam: 'boom', finisher: 'bigboom', grab: 'squeak', whoosh: 'step', count: 'beep', kickout: 'boing', elim: 'ko', win: 'hallelujah', pinStart: 'event', pinHit: 'step', pinMiss: 'bonk' };

    return {
      camera,
      update(dt, t, running) {
        if (running && !rang) { rang = true; arena.pop(0.8); }
        let simDt = dt;
        if (hitstop > 0) { hitstop -= dt; simDt = 0; }
        if (slowmo > 0) { slowmo -= dt; simDt *= 0.4; }
        const inputs = new Map();
        for (const e of entries) {
          let f = IDLE;
          if (running && !match.over) {
            if (e.brain) f = e.brain.frame(simDt || dt, match);
            else { f = { x: e.input.x, y: e.input.y, held: e.input.held, pressed: e.input.pressed, mash: e.input.mash, pinTap: e.input.pinTap }; e.input.pressed = 0; e.input.mash = 0; e.input.pinTap = null; }
          }
          inputs.set(e.w, f);
        }
        if (simDt > 0) {
          match.update(simDt, inputs);
          for (const ev of match.events.splice(0)) {
            if (SOUND[ev.type]) sfx.play(SOUND[ev.type]);
            if (ev.type === 'hit') { hitstop = Math.max(hitstop, 0.04 * (ev.power || 1)); arena.pop(0.1); }
            if (ev.type === 'slam') { shake = Math.max(shake, 0.12); arena.pop(0.4); }
            if (ev.type === 'finisher') { slowmo = 1.1; arena.pop(0.6); }
            if (ev.type === 'elim' || ev.type === 'win') arena.pop(1);
          }
        }
        simT += dt;
        match.sync(simDt, simT);
        updatePinUi();
        pushPinBars();
        arena.update(dt);
        for (const e of entries) {
          const head = e.w.rig.root.position;
          e.tag.position.set(head.x, head.y + 2.35, head.z);
          e.tag.visible = !e.w.eliminated;
        }
        // camera: frame everyone still in, or circle the winner
        if (match.winner) {
          const w = match.winner, a = Math.sin(t * 0.25) * 0.6;
          tPos.set(w.pos.x + Math.sin(a) * 3.6, RING_H + 1.9, w.pos.y + Math.cos(a) * 3.6);
          tLook.set(w.pos.x, RING_H + 1.35, w.pos.y);
        } else {
          const act = match.active(), c = new THREE.Vector2();
          act.forEach((w) => c.add(w.pos)); if (act.length) c.multiplyScalar(1 / act.length);
          let spread = 0; act.forEach((w) => { spread = Math.max(spread, w.pos.distanceTo(c)); });
          const far = 8.6 + (SPACE - 1) * 6;   // the bigger ring lets the camera pull back further
          const dist = Math.min(far, 5.8 + spread * 1.05);
          tPos.set(c.x * 0.6, RING_H + 2.8 + spread * 0.55, Math.min(far + 0.2, c.y * 0.5 + dist));
          tLook.set(c.x * 0.85, RING_H + 0.75, c.y * 0.85);
        }
        const k = 1 - Math.exp(-dt * 3.2);
        camPos.lerp(tPos, k); camLook.lerp(tLook, k);
        camera.position.copy(camPos);
        if (shake > 0) { camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; shake = Math.max(0, shake - dt * 0.6); }
        camera.lookAt(camLook);
      },
      input(p, m) {
        const e = byPlayer.get(p.id);
        if (!e) return;
        if (m.b === 'pin') { e.input.pinTap = !!m.hit; return; }
        if (m.b !== 'stick') return;
        const held = Number(m.h) || 0, newly = held & ~e.input.held;
        e.input.x = Math.max(-1, Math.min(1, Number(m.x) || 0));
        e.input.y = Math.max(-1, Math.min(1, Number(m.y) || 0));
        e.input.pressed |= newly;
        for (let b = newly; b; b &= b - 1) e.input.mash++;
        e.input.held = held;
      },
      // out: the order they went (1 = first out). Still in: 100 plus health.
      scores() {
        return Object.fromEntries(entries.filter((e) => e.p).map((e) => {
          const out = match.elimOrder.indexOf(e.w);
          return [e.p.id, out >= 0 ? out + 1 : 100 + Math.max(0, Math.round(e.w.hp))];
        }));
      },
      done: () => match.over,
      dispose() { pinEl.remove(); style.remove(); match.dispose(); arena.dispose(); },
    };
  },
};
