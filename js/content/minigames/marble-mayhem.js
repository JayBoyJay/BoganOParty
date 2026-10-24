// Marble Mayhem: the marble race from Mr Lee's MarbleDrinks, as a minigame. Every player is a glass
// marble with their doll's head inside, kept upright and facing the camera while the glass rolls
// (their photo face if they sent one). A fresh short track each time, on a
// random theme. BOOST three times per race; roll through a vape to grab a power, then USE it.
// The race itself (track generator, physics, scenery, camera director) lives in ./marble/, ported
// from MarbleDrinks with the World drawing into the minigame's scene instead of its own canvas.
import { generateTrack, THEME_KEYS } from './marble/track.js';
import { RaceSim, BOOSTS_PER_RACE } from './marble/sim.js';
import { World } from './marble/render.js';
import { Director } from './marble/camera.js';
import { MARBLE_R } from './marble/track.js';

const AFTER_WIN = 12; // seconds the rest get to finish once someone's won

export default {
  id: 'marble-mayhem',
  name: 'Marble Mayhem',
  blurb: "You're a marble now. Your face is on it. First to the bottom of the hill wins.",
  howTo: `Your marble rolls itself. Tap BOOST for a burst of speed (${BOOSTS_PER_RACE} per race). Roll through a vape to pick up a power, then tap USE POWER to fire it.`,
  padText: 'Boost at the right moment!',
  duration: 90,
  pad: { kind: 'buttons', buttons: [{ id: 'boost', label: '🚀 BOOST', tone: 'go', wide: true }, { id: 'power', label: '⚡ USE POWER', wide: true }] },

  create(mg) {
    const { THREE, scene, players, rng, renderer, sfx } = mg;
    const theme = THEME_KEYS[Math.floor(rng() * THEME_KEYS.length)];
    const track = generateTrack({ seed: (rng() * 1e9) | 0, theme, length: 'short' });
    const world = new World({ renderer, scene });
    world.buildTrack(track);

    const ents = players.map((p) => ({ id: p.id, name: p.name, skin: 'ocean', color: p.color, bot: !!p.bot, hat: 'none' }));
    const sim = new RaceSim(track, ents, rng, { pickups: true, tilt: false });
    world.setMarbles(ents);
    world.syncMarbles(sim.marbles, 0, true);
    // turn each marble into a tinted glass ball with the player's doll head floating inside
    const heads = new Map();
    world.glass = true;
    for (const p of players) {
      const vis = world.marbles.get(p.id);
      vis.mesh.material = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(p.color).lerp(new THREE.Color(0xffffff), 0.55), roughness: 0.04, metalness: 0, clearcoat: 1, transparent: true, opacity: 0.22, depthWrite: false, emissive: 0x000000 });
      vis.mesh.renderOrder = 2;
      const doll = mg.makeDoll(p, { tag: false });
      const head = doll.head; head.removeFromParent();
      doll.hat?.removeFromParent(); // no room for a hat inside the marble
      const box = new THREE.Box3().setFromObject(head), c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
      head.position.sub(c);
      const holder = new THREE.Group(); holder.add(head);
      holder.scale.setScalar((MARBLE_R * 1.55) / Math.max(size.x, size.y));
      scene.add(holder);
      heads.set(p.id, holder);
    }
    const director = new Director(world);
    director.style = 'broadcast';
    director.setMode('grid');

    let started = false, winAt = null, t0 = 0, now = 0;
    const SOUND = { boost: 'teleport', bumper: 'bonk', tramp: 'boing', jump: 'boing', pickup: 'item', power: 'event', portal: 'teleport' };
    return {
      camera: world.camera,
      update(dt, t, running) {
        if (running && !started) { started = true; sim.start(); director.setMode('race'); }
        if (started) {
          sim.update(dt, true);
          for (const e of sim.events.splice(0)) {
            if (e.type === 'finish') { sfx.play(e.place === 1 ? 'hallelujah' : 'coin'); if (winAt == null) winAt = t; }
            else if (SOUND[e.type] && (e.type !== 'boost' || !sim.marbles.find((m) => m.id === e.id)?.bot)) sfx.play(SOUND[e.type]);
          }
        }
        t0 += dt;
        world.syncMarbles(sim.marbles, dt, true);
        for (const [id, h] of heads) {
          const m = world.marbles.get(id).mesh;
          h.position.copy(m.position);
          h.quaternion.copy(m.quaternion); // the head tumbles with the marble it's sealed in
          h.visible = m.material.opacity > 0.1;
        }
        world.animate(t0, started, t, started ? sim.t : t0);
        world.syncFans(t0, started ? sim.marbles.filter((m) => !m.finished).map((m) => m.s) : null);
        world.syncPickups(started ? sim.pickups : null, started ? sim.t : 0, t0, dt, true);
        if (started) world.syncTempZones(sim.tempZones);
        director.update(dt, sim);
        now = t;
      },
      input(p, m) {
        if (m.b === 'boost') { if (sim.boost(p.id)) sfx.play('teleport'); }
        else if (m.b === 'power') sim.usePower(p.id);
      },
      // live race position: the leader has the most
      scores() { const st = sim.standings(); return Object.fromEntries(st.map((m, i) => [m.id, st.length - i])); },
      done() { return sim.allFinished() || (winAt != null && now - winAt > AFTER_WIN); },
    };
  },
};
