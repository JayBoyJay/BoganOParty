// Draw!: a knockout of one-on-one quick-draw duels on the main street of a dusty western town. Two
// cowboys face off, the ref stands between them, and nobody touches their gun till the ref blows the
// whistle. First to shoot after the whistle wins and goes through. Shoot early and the other one goes
// through instead. Everyone in a round duels before anyone goes again; an odd one out gets a bye.
// Last cowboy standing wins.
import { addSky } from '../../host/sky.js';

const DOLL = 0.82;
const GAP = 4.2; // each duellist's distance from the middle of the street
const WAIT = [2.4, 6.2]; // seconds from READY to the whistle
const NO_SHOW = 3; // seconds after the whistle before the ref picks someone

export default {
  id: 'draw',
  name: 'Draw!',
  blurb: 'One-on-one quick-draw duels, knockout style. Wait for the whistle. Shoot early and you lose.',
  howTo: "Two at a time face off on main street. When the ref blows the whistle, hit DRAW! as fast as you can: first shot wins and goes to the next round. Shoot before the whistle and you lose straight away. Careful, the ref has a cold. Odd one out in a round gets a free pass. Last cowboy standing wins.",
  padText: 'Wait for the whistle...',
  duration: 120,
  pad: { kind: 'buttons', buttons: [{ id: 'fire', label: '🔫 DRAW!', color: '#ffb84a', tall: true }] },

  create(mg) {
    const { THREE, kit, scene, players, rng, sfx, renderer } = mg;
    const n = players.length;

    // ----- main street, late arvo -----
    const { sun } = addSky(scene, renderer, { elevation: 18, azimuth: 20, turbidity: 6, sunIntensity: 3.2, sun: 0xffd8a8, sky: 0xffe0b8, ground: 0x8a6440, hemi: 0.65, env: 0.6, shadowSize: 30, fog: [0xe8c8a0, 40, 140] });
    sun.target.position.set(0, 0, -2);
    const dirt = kit.surf('sand', { unit: 5, tint: 0xd0a878 });
    const street = new THREE.Mesh(new THREE.PlaneGeometry(160, 80), dirt); street.rotation.x = -Math.PI / 2; street.receiveShadow = true; scene.add(street);
    const wood = (tint) => kit.surf('planks', { unit: 1.6, tint });
    // the shopfronts behind, with a boardwalk and a veranda
    const SHOPS = [['SALOON', 0x8a5a34], ['BANK', 0x7a6a5a], ['JAIL', 0x6a5040], ['GENERAL STORE', 0x9a6a3a], ['HOTEL', 0x8a4a3a], ['BARBER', 0x7a5a44], ['SHERIFF', 0x6a5a48]];
    const BZ = -7.5;
    let x0 = -26;
    SHOPS.forEach(([name, tint], i) => {
      const w = 6.2 + (i % 3) * 0.9, h = 4.2 + (i % 2) * 1.6;
      const g = kit.group(x0 + w / 2, 0, BZ - 2.5);
      kit.box(w - 0.1, h, 4, wood(tint), 0, 0, 0, g);
      kit.box(w + 0.1, 1.0, 0.2, wood(tint), 0, h, 2.0, g); // false front
      kit.sign(name, w * 0.8, 0.7, 0, h - 0.6, 2.06, g, { bg: '#f0e0b8', fg: '#3a1a0a', font: '900 160px Georgia, serif' });
      kit.box(1.1, 2.1, 0.08, 0x3a2414, 0, 0, 2.02, g);
      for (const wx of [-w * 0.3, w * 0.3]) kit.window(1.1, 1.0, wx, 1.6, 2.02, g, 0xe8dcc0);
      // the veranda roof on posts
      kit.box(w, 0.08, 2.2, wood(0x9a7a54), 0, 2.7, 3.1, g).rotation.x = 0.06;
      for (const px of [-w / 2 + 0.2, w / 2 - 0.2]) kit.box(0.14, 2.7, 0.14, 0x6a4a2a, px, 0, 4.1, g);
      x0 += w + 0.15;
    });
    kit.box(60, 0.25, 2.4, wood(0xa88a64), 0, 0, BZ + 1.2); // the boardwalk
    // a water tower and some cactus out the ends, and the hills
    {
      const t = kit.group(17, 0, -16);
      for (const lx of [-1.4, 1.4]) for (const lz of [-1.4, 1.4]) kit.box(0.2, 6, 0.2, 0x5a3a20, lx, 0, lz, t);
      kit.cyl(2.2, 2.2, 2.8, wood(0x8a6a44), 0, 6, 0, t);
      kit.cone(2.5, 1.2, 0x5a3a24, 0, 8.8, 0, t);
    }
    const cactusM = kit.mat(0x4a7a3a, { roughness: 0.8 });
    const cactus = (x, z, s) => { const g = kit.group(x, 0, z, rng() * 6, s); kit.cyl(0.32, 0.36, 3, cactusM, 0, 0, 0, g); kit.ball(0.32, cactusM, 0, 3, 0, g); for (const side of [-1, 1]) { kit.cyl(0.2, 0.2, 0.8, cactusM, side * 0.55, 1.2, 0, g).rotation.z = side * Math.PI / 2; kit.cyl(0.2, 0.2, 1.1, cactusM, side * 0.95, 1.2, 0, g); kit.ball(0.2, cactusM, side * 0.95, 2.3, 0, g); } };
    cactus(-15, 3, 0.9); cactus(15.5, 4, 0.8); cactus(-20, -2, 1.1); cactus(22, 0, 1);
    for (let i = 0; i < 6; i++) { const m = kit.cone(14 + rng() * 10, 6 + rng() * 6, kit.mat(0xb8784a, { roughness: 1 }), -60 + i * 24, 0, -60 - rng() * 10); m.castShadow = false; }
    // a tumbleweed
    const weed = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 1), new THREE.MeshStandardMaterial({ color: 0xa88a54, wireframe: true }));
    weed.position.set(-30, 0.45, 1.5); scene.add(weed);

    // ----- the cowboys -----
    const hatColours = [0x5a3a1e, 0x2a2a2a, 0xd8c8a8, 0x7a4a2a, 0x3a2a1a, 0xe8e0d0, 0x8a6a4a, 0x4a3a3a];
    const addHat = (doll, col) => {
      if (doll.hat) return; // they brought their own
      const hat = new THREE.Group();
      const m = kit.mat(col, { roughness: 0.75 });
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.035, 28), m); hat.add(brim);
      brim.scale.z = 0.86;
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.32, 20), m); crown.position.y = 0.17; hat.add(crown);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.305, 0.305, 0.06, 20), kit.mat(0x2a1a0a)); band.position.y = 0.05; hat.add(band);
      hat.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      hat.position.set(0, 0.36, 0); hat.rotation.x = -0.12;
      doll.head.add(hat);
      return hat;
    };
    const revolver = () => {
      const g = new THREE.Group(), steel = kit.mat(0x2a2c30, { metalness: 0.8, roughness: 0.3 });
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 10), steel); barrel.rotation.z = Math.PI / 2; barrel.position.x = 0.2; g.add(barrel);
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.12, 12), steel); cyl.rotation.z = Math.PI / 2; g.add(cyl);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.06), kit.mat(0x6a3a1a, { roughness: 0.6 })); grip.position.set(-0.08, -0.1, 0); grip.rotation.z = 0.3; g.add(grip);
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      return g;
    };
    const flashTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, '#fffbe0'); gr.addColorStop(0.4, '#ffc040'); gr.addColorStop(1, 'rgba(255,120,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();

    // spectators wait along the boardwalk
    const benchX = (i) => { const k = i - (n - 1) / 2; return k * 1.9 + Math.sign(k || 1) * 1.4; }; // either side of the ref
    const cowboys = players.map((p, i) => {
      const doll = mg.makeDoll(p, { scale: DOLL });
      scene.add(doll.group);
      addHat(doll, hatColours[i % hatColours.length]);
      const gun = revolver(); scene.add(gun);
      const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); flash.scale.setScalar(0.9); flash.visible = false; scene.add(flash);
      const home = new THREE.Vector3(benchX(i), 0.25, BZ + 1.2);
      doll.group.position.copy(home);
      return { p, doll, gun, flash, home, pos: home.clone(), target: home.clone(), side: 0, fall: 0, out: false, wins: 0, best: null, flashT: 0, shot: false,
        bot: p.bot ? { react: 0.22 + rng() * 0.25, jumpy: 0.01 + rng() * 0.03 } : null };
    });
    // the ref, in stripes, with a whistle
    const refP = { id: 'ref', name: 'Ref', color: '#f2f2f2', body: 'bloke', hair: 0x2a2a2a };
    const ref = mg.makeDoll(refP, { scale: DOLL * 0.95, tag: false });
    ref.group.position.set(0, 0, -2.4); scene.add(ref.group);
    addHat(ref, 0x1a1a1a);
    for (let k = 0; k < 5; k++) { const s = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.035, 6, 24), kit.mat(0x111111)); s.rotation.x = Math.PI / 2; s.position.y = 0.95 + k * 0.13; s.scale.z = 0.6; ref.group.add(s); }
    const whistle = kit.box(0.08, 0.05, 0.12, 0xd8d8d8, 0.1, 1.95, 0.25, ref.group, { metalness: 0.9, roughness: 0.2 });

    // ----- big words on the screen -----
    const pops = [];
    const pop = (text, color, { y = 4.6, size = 1, stay = 1.6, z = 1 } = {}) => {
      const c = document.createElement('canvas'); c.width = 1024; c.height = 180;
      const g = c.getContext('2d'); g.font = '900 120px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 16; g.strokeStyle = '#2a1206'; g.strokeText(text, 512, 94, 1000); g.fillStyle = color; g.fillText(text, 512, 94, 1000);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); sp.scale.set(8 * size, 1.4 * size, 1); sp.renderOrder = 20;
      sp.position.set(0, y, z); scene.add(sp); pops.push({ sp, life: 0, stay });
      return sp;
    };
    const clearPops = () => { for (const q of pops) scene.remove(q.sp); pops.length = 0; };

    // ----- the bracket -----
    let round = 0, alive = [...cowboys], queue = [], nextRound = [], duel = null, champ = null, tAll = 0, finishAt = null, lead = 1.2;
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const startRound = () => {
      round++;
      const order = shuffle([...alive]);
      queue = []; nextRound = [];
      for (let i = 0; i + 1 < order.length; i += 2) queue.push([order[i], order[i + 1]]);
      if (order.length % 2) { const bye = order[order.length - 1]; nextRound.push(bye); bye.byeNote = true; }
      const label = alive.length === 2 ? 'THE FINAL SHOWDOWN' : `ROUND ${round}`;
      clearPops(); pop(label, '#ffd23f', { size: 1.1 });
      const byes = order.length % 2 ? order[order.length - 1] : null;
      if (byes) pop(`${byes.p.name} gets a bye`, '#fff2d8', { y: 3.4, size: 0.6 });
      lead = 2.2;
    };
    const startDuel = (a, b) => {
      clearPops();
      duel = { a, b, phase: 'walk', t: 0, wait: WAIT[0] + rng() * (WAIT[1] - WAIT[0]), sneezeAt: rng() < 0.35 ? 0.3 + rng() * 0.5 : -1, sneezed: false, winner: null, why: '', drawT: 0 };
      duel.wait = Math.max(duel.wait, 1.5);
      a.side = -1; b.side = 1; a.shot = b.shot = false;
      a.target.set(-GAP, 0, 0); b.target.set(GAP, 0, 0);
      pop(`${a.p.name}  vs  ${b.p.name}`, '#fff2d8', { size: 0.9 });
    };
    const endDuel = (winner, why) => {
      const d = duel, loser = winner === d.a ? d.b : d.a;
      d.winner = winner; d.phase = 'result'; d.t = 0;
      winner.wins++; loser.out = true;
      nextRound.push(winner);
      clearPops();
      pop(`${winner.p.name} WINS`, winner.p.color, { size: 1 });
      if (why) pop(why, '#fff2d8', { y: 3.5, size: 0.6 });
    };
    const shoot = (c) => {
      const d = duel; if (!d || c.shot) return;
      c.shot = true; c.flashT = 0.12;
      sfx.play('boom');
      if (d.phase === 'wait') {
        // too early: the ref sends the other one through
        const other = c === d.a ? d.b : d.a;
        endDuel(other, `${c.p.name} drew too early!`);
        c.doll.flinch();
        return;
      }
      if (d.phase === 'draw' && !d.winner) {
        const rt = d.t;
        if (c.best == null || rt < c.best) c.best = rt;
        const other = c === d.a ? d.b : d.a;
        other.fall = 0.001; other.doll.flinch();
        endDuel(c, `${rt.toFixed(2)} seconds`);
      }
    };

    const camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.3, 400);
    camera.position.set(0, 3.2, 15.5);
    camera.lookAt(0, 2.0, -1.5);

    return {
      camera,
      update(dt, t, running) {
        tAll += dt;
        if (running && !champ) {
          if (lead > 0) lead -= dt;
          else if (!duel) {
            if (!queue.length && !nextRound.length && round === 0) startRound();
            else if (queue.length) startDuel(...queue.shift());
            else { alive = nextRound; if (alive.length <= 1) { champ = alive[0]; finishAt = tAll; clearPops(); pop(`${champ.p.name} IS THE FASTEST GUN`, champ.p.color, { size: 0.9 }); pop('IN THE OUTBACK', '#ffd23f', { y: 3.5, size: 0.8 }); sfx.play('hallelujah'); champ.doll.bounce(); champ.target.set(0, 0, 1.5); } else startRound(); }
          }
        }
        // ----- the duel -----
        const d = duel;
        if (d) {
          d.t += dt;
          if (d.phase === 'walk' && d.t > 2.2) { d.phase = 'wait'; d.t = 0; clearPops(); pop('READY...', '#fff2d8'); }
          else if (d.phase === 'wait') {
            if (d.sneezeAt > 0 && !d.sneezed && d.t > d.wait * d.sneezeAt) { d.sneezed = true; sfx.play('snort'); pop('ACHOO!', '#ffffff', { y: 3.4, size: 0.6 }); ref.flinch(); }
            for (const c of [d.a, d.b]) if (c.bot && !c.shot && rng() < dt * c.bot.jumpy * (d.sneezed && d.t - d.wait * d.sneezeAt < 0.6 ? 6 : 1)) shoot(c);
            if (d.phase === 'wait' && d.t > d.wait) { d.phase = 'draw'; d.t = 0; clearPops(); pop('DRAW!', '#ff5a2a', { size: 1.5 }); sfx.play('whistle'); }
          } else if (d.phase === 'draw') {
            for (const c of [d.a, d.b]) if (c.bot && !c.shot && d.t > c.bot.react) shoot(c);
            if (d.phase === 'draw' && d.t > NO_SHOW) { const w = rng() < 0.5 ? d.a : d.b; endDuel(w, 'Nobody drew. Coin toss!'); }
          } else if (d.phase === 'result' && d.t > 2.8) {
            for (const c of [d.a, d.b]) { c.target.copy(c.home); c.side = 0; }
            duel = null; lead = 0.6;
          }
        }
        // ----- drawing -----
        for (const c of cowboys) {
          // walk to where they need to be
          const to = c.target.clone().sub(c.pos); to.y = 0;
          const dist = to.length(), step = Math.min(dist, dt * 5.5);
          if (dist > 0.01) c.pos.addScaledVector(to.normalize(), step);
          const atHome = c.pos.distanceTo(c.home) < 0.05;
          c.doll.group.position.set(c.pos.x, atHome ? c.home.y : c.home.y * Math.max(0, 1 - Math.abs(c.pos.z - c.home.z) / 2) + (dist > 0.05 ? Math.abs(Math.sin(tAll * 10)) * 0.08 : 0), c.pos.z);
          const inDuel = d && (c === d.a || c === d.b);
          // the hand hovers over the holster, then comes up
          const drawn = inDuel && c.shot;
          c.doll.setArms(drawn ? 0.3 : inDuel ? -0.35 : 0.05, 0);
          c.doll.group.rotation.y = inDuel ? c.side * -0.55 : 0;
          // falling over when shot, and getting back up for the walk home
          if (c.fall > 0) { c.fall = Math.min(1.6, c.fall + dt * 2.2); }
          if (!inDuel && c.fall > 0) c.fall = Math.max(0, c.fall - dt * 4) || 0;
          const tip = Math.min(1, c.fall) * (Math.PI / 2) * 0.95;
          c.doll.group.rotation.z = c.side ? -c.side * tip : 0;
          c.doll.update(dt);
          // the revolver: on the hip, or out pointing at the other bloke
          const gp = c.doll.group.position, facing = c.side ? -c.side : 1;
          if (drawn) { c.gun.position.set(gp.x + facing * 0.75, gp.y + 1.45 * DOLL / 0.82, gp.z + 0.2); c.gun.rotation.set(0, facing > 0 ? 0 : Math.PI, 0); }
          else { c.gun.position.set(gp.x + (c.side ? facing * 0.45 : 0.45), gp.y + 0.95, gp.z + 0.15); c.gun.rotation.set(0, facing > 0 ? 0 : Math.PI, -1.35 * facing * (facing > 0 ? 1 : -1)); }
          c.gun.visible = c.fall < 0.3;
          c.flashT = Math.max(0, c.flashT - dt);
          c.flash.visible = c.flashT > 0;
          if (c.flash.visible) c.flash.position.set(c.gun.position.x + facing * 0.5, c.gun.position.y, c.gun.position.z);
        }
        // the ref lifts the whistle
        const up = d && (d.phase === 'wait' || d.phase === 'draw');
        ref.setArms(up ? 0.9 : 0.1, 0);
        whistle.visible = !!up;
        ref.update(dt);
        // tumbleweed
        weed.position.x += dt * 2.4; weed.rotation.z -= dt * 5; weed.position.y = 0.45 + Math.abs(Math.sin(tAll * 3)) * 0.3;
        if (weed.position.x > 30) weed.position.x = -30;
        for (let i = pops.length - 1; i >= 0; i--) { const q = pops[i]; q.life += dt; q.sp.material.opacity = Math.min(1, q.life * 5); }
      },
      input(p, m) {
        if (m.b !== 'fire' || !duel || duel.winner) return;
        const c = cowboys.find((x) => x.p === p);
        if (c && (c === duel.a || c === duel.b) && (duel.phase === 'wait' || duel.phase === 'draw')) shoot(c);
      },
      // 25 for every duel won; the champion gets 40 on top
      scores() { return Object.fromEntries(cowboys.map((c) => [c.p.id, c.wins * 25 + (c === champ ? 40 : 0)])); },
      done: () => finishAt != null && tAll - finishAt > 4,
    };
  },
};
