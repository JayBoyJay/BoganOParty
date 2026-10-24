// Two-Up: it's Anzac Day out the back of the pub, so everyone's in the ring. Ten chips each. Every
// toss, pick HEADS, TAILS or ODDS and how much to put on, then the spinner throws two pennies off the
// kip. Two heads is HEADS, two tails is TAILS, one of each is ODDS. Heads or tails pays 2 to 1, odds
// pays even money, and if you backed heads or tails and it comes up odds you get your stake back.
// Ten tosses. Most chips at the end wins.
import { addSky } from '../../host/sky.js';

const TOSSES = 10, START = 10;
const BET_T = 5.5, TOSS_T = 3.6, SHOW_T = 2.4;
const DOLL = 0.62;
const SIZES = { b1: 1, b3: 3, b5: 5, ball: Infinity };

export default {
  id: 'two-up',
  name: 'Two-Up',
  blurb: 'Anzac Day in the ring. Back heads, tails or odds with your chips. Ten tosses, most chips wins.',
  howTo: "Each toss, pick how much to bet (1, 3, 5 or ALL IN) and then HEADS, TAILS or ODDS. Two heads is heads, two tails is tails, one of each is odds. Heads or tails pays 2 to 1 (and you get your money back on odds). Odds pays even money. Ten tosses. Most chips at the end wins. Go broke and the bar shouts you 2 chips each toss so you can claw back.",
  padText: 'Pick a bet size, then call it',
  duration: 98,
  pad: { kind: 'buttons', buttons: [
    { id: 'b1', label: 'BET 1', color: '#e8dcc0' }, { id: 'b3', label: 'BET 3', color: '#e8dcc0' },
    { id: 'b5', label: 'BET 5', color: '#e8dcc0' }, { id: 'ball', label: 'ALL IN', color: '#ffb84a' },
    { id: 'heads', label: '👑 HEADS', color: '#ffd23f', tall: true }, { id: 'tails', label: '🦘 TAILS', color: '#9ad8ff', tall: true },
    { id: 'odds', label: '🔀 ODDS', color: '#c8a8ff', wide: true },
  ] },

  create(mg) {
    const { THREE, kit, scene, players, rng, renderer, sfx } = mg;
    const n = players.length;

    // ----- the beer garden out the back of the pub, late arvo -----
    const { sun } = addSky(scene, renderer, { elevation: 24, azimuth: 30, turbidity: 5, sunIntensity: 3, sun: 0xffe0b8, sky: 0xffe8cc, ground: 0x6b5a40, hemi: 0.6, env: 0.6, shadowSize: 24, fog: [0xe8d8c0, 40, 120] });
    sun.target.position.set(0, 0, 0);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), kit.surf('gravel', { unit: 2, tint: 0xd8c8a8 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    // the ring: a circle of sand in the gravel, marked with a rope
    const RING = 4.2;
    const sand = new THREE.Mesh(new THREE.CircleGeometry(RING, 48), kit.surf('sand', { unit: 2, tint: 0xe8d4a8 })); sand.rotation.x = -Math.PI / 2; sand.position.y = 0.01; sand.receiveShadow = true; scene.add(sand);
    const rope = new THREE.Mesh(new THREE.TorusGeometry(RING, 0.04, 6, 64), kit.mat(0xc8a878)); rope.rotation.x = Math.PI / 2; rope.position.y = 0.05; scene.add(rope);
    // the pub wall behind, with a flag and a sign
    kit.box(30, 5, 0.4, kit.surf('brick', { unit: 2.4, tint: 0xc89070 }), 0, 0, -9);
    kit.sign('TWO-UP TODAY ONLY', 7, 1, 0, 1.9, -8.75, undefined, { bg: '#1a3a1a', fg: '#f0d890', font: '900 140px Georgia, serif' });
    kit.sign('LEST WE FORGET', 4, 0.5, 0, 1.15, -8.75, undefined, { bg: '#f0e8d8', fg: '#7a1a1a', font: '900 120px Georgia, serif' });
    for (const x of [-9, 9]) { const poppy = kit.group(x, 0, -8.6); kit.cyl(0.05, 0.05, 2.6, 0x3a5a2a, 0, 0, 0, poppy); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; kit.ball(0.22, 0xc8102e, Math.cos(a) * 0.25, 2.7 + Math.sin(a) * 0.25, 0.05, poppy).scale.z = 0.3; } kit.ball(0.1, 0x111111, 0, 2.7, 0.12, poppy); }
    // beer garden tables
    for (const [x, z] of [[-8, -3], [8, -3], [-9, 3], [9, 3]]) { const t = kit.group(x, 0, z, rng()); kit.box(2.2, 0.08, 0.9, kit.surf('planks', { unit: 1.2, tint: 0x8a6a44 }), 0, 0.75, 0, t); for (const s of [-1, 1]) { kit.box(2.2, 0.06, 0.3, kit.surf('planks', { unit: 1.2, tint: 0x8a6a44 }), 0, 0.45, s * 0.7, t); kit.box(0.08, 0.75, 0.08, 0x5a3a20, s * 0.9, 0, 0, t); } }

    // ----- the spinner, the kip and the pennies -----
    const spinner = mg.makeDoll({ id: 'spinner', name: 'Spinner', color: '#2a4a2a', body: 'bloke', hair: 0x8a8a8a }, { scale: DOLL * 1.05, tag: false });
    spinner.group.position.set(0, 0, 0); scene.add(spinner.group);
    const kip = kit.box(0.14, 0.02, 0.4, kit.surf('planks', { unit: 0.6, tint: 0xc8a070 }), 0, 0, 0, undefined); kip.castShadow = true;
    const coinGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.025, 28);
    const faceTex = (heads) => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#c87a3a'; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill(); g.strokeStyle = '#8a4a1a'; g.lineWidth = 6; g.beginPath(); g.arc(64, 64, 52, 0, 7); g.stroke(); g.fillStyle = '#7a3a12'; g.font = '900 54px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(heads ? 'H' : 'T', 64, 68); if (heads) { g.font = '900 22px Georgia'; g.fillText('♛', 64, 28); } else { g.font = '900 22px Georgia'; g.fillText('🦘', 64, 28); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
    const copper = kit.mat(0xb8682e, { metalness: 0.85, roughness: 0.35 });
    const headsM = new THREE.MeshStandardMaterial({ map: faceTex(true), metalness: 0.6, roughness: 0.4 }), tailsM = new THREE.MeshStandardMaterial({ map: faceTex(false), metalness: 0.6, roughness: 0.4 });
    const coins = [0, 1].map(() => { const m = new THREE.Mesh(coinGeo, [copper, headsM, tailsM]); m.castShadow = true; scene.add(m); return m; });

    // ----- the punters, round the ring -----
    const pops = [];
    const pop = (x, y, z, text, color, size = 1, stay = 1.2) => {
      const c = document.createElement('canvas'); c.width = 768; c.height = 160;
      const g = c.getContext('2d'); g.font = '900 100px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 14; g.strokeStyle = '#2a1206'; g.strokeText(text, 384, 84, 750); g.fillStyle = color; g.fillText(text, 384, 84, 750);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); sp.scale.set(4.8 * size, 1 * size, 1); sp.renderOrder = 1000;
      sp.position.set(x, y, z); scene.add(sp); pops.push({ sp, life: 0, stay });
      return sp;
    };
    const punters = players.map((p, i) => {
      // spread round the front of the ring so everyone faces the camera
      const a = Math.PI * (0.12 + 0.76 * (n === 1 ? 0.5 : i / (n - 1)));
      const big = n > 5, rx = big ? RING + 1.6 : RING + 0.5; // a full ring stands wider
      const x = big ? (-1 + (2 * i) / (n - 1)) * rx * 0.92 : -Math.cos(a) * rx; // a full ring is evenly spaced across the screen
      const z = (big ? Math.sqrt(1 - (x / rx) ** 2) : Math.sin(a)) * (RING + 0.5) * 0.55 + 0.6;
      const doll = mg.makeDoll(p, { scale: DOLL, tag: false }); // the name's on the card instead
      doll.group.position.set(x, 0, z); scene.add(doll.group);
      // a card over their head showing chips and bet
      const c = document.createElement('canvas'); c.width = 320; c.height = 200;
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const card = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false })); card.scale.set(1.5, 0.94, 1); card.renderOrder = 15;
      card.position.set(x, 2.75 + (big && i % 2 ? 1.15 : 0), z); scene.add(card); // staggered so a full ring's cards don't overlap
      const stack = new THREE.Group(); stack.position.set(x + 0.55, 0, z + 0.2); scene.add(stack);
      return { p, x, z, doll, c, t, card, stack, chips: START, size: 1, call: null, stake: 0, lastWin: 0, broke: false,
        bot: p.bot ? { style: rng(), when: 0 } : null };
    });
    const chipGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.035, 18);
    const drawCard = (P) => {
      const g = P.c.getContext('2d'); g.clearRect(0, 0, 320, 200);
      g.fillStyle = 'rgba(26,18,10,0.85)'; g.beginPath(); g.roundRect(4, 4, 312, 192, 26); g.fill(); g.strokeStyle = P.p.color; g.lineWidth = 6; g.stroke();
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = P.p.color; g.font = '900 34px system-ui'; g.fillText(P.p.name, 160, 34, 290);
      g.translate(0, 40);
      g.fillStyle = '#ffd23f'; g.font = '900 54px system-ui'; g.fillText(`${P.chips}`, 70, 56);
      g.fillStyle = '#d8c8a8'; g.font = '700 22px system-ui'; g.fillText('chips', 70, 98);
      const lab = P.broke ? 'BROKE' : !P.call && P.shout ? 'SHOUT' : P.call ? `${P.call.toUpperCase()}` : '...';
      g.fillStyle = P.call === 'heads' ? '#ffd23f' : P.call === 'tails' ? '#9ad8ff' : P.call === 'odds' ? '#c8a8ff' : '#888';
      g.font = '900 40px system-ui'; g.fillText(lab, 222, 56, 180);
      if (P.call) { g.fillStyle = '#fff'; g.font = '800 30px system-ui'; g.fillText(`x${P.stake}`, 222, 106); }
      g.setTransform(1, 0, 0, 1, 0, 0);
      P.t.needsUpdate = true;
      // a little stack of chips on the ground beside them
      P.stack.clear();
      const show = Math.min(30, P.chips);
      for (let k = 0; k < show; k++) { const m = new THREE.Mesh(chipGeo, kit.mat(k % 5 === 4 ? 0xffffff : P.p.color, { roughness: 0.4 })); m.position.set((k / 10 | 0) * 0.24, 0.02 + (k % 10) * 0.036, 0); m.castShadow = true; P.stack.add(m); }
    };
    punters.forEach(drawCard);

    const call = (P, what) => {
      if (phase !== 'bet' || P.broke || P.call) return;
      P.stake = Math.min(P.chips, P.size === Infinity ? P.chips : P.size);
      if (P.stake <= 0) return;
      P.call = what; P.chips -= P.stake;
      drawCard(P); sfx.play('clank');
      P.doll.setArms(0.8, 0.2); P.armT = 0.4;
    };

    let phase = 'intro', phaseT = 2.2, toss = 0, faces = [true, true], result = null, tAll = 0, finishAt = null;
    const banner = (text, color, size = 1.1) => { for (const q of pops.filter((q) => q.big)) { scene.remove(q.sp); pops.splice(pops.indexOf(q), 1); } const s = pop(0, 4.4, -1, text, color, size, 99); pops[pops.length - 1].big = true; return s; };
    banner('COME IN SPINNER!', '#ffd23f');

    const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.3, 200);
    camera.position.set(0, n > 5 ? 7.2 : 6.2, n > 5 ? 12.6 : 10.6);
    camera.lookAt(0, 1.4, -0.6);

    return {
      camera,
      update(dt, t, running) {
        tAll += dt;
        if (running && finishAt == null) {
          phaseT -= dt;
          if (phase === 'intro' && phaseT <= 0) { phase = 'bet'; phaseT = BET_T; toss++; banner(`TOSS ${toss} OF ${TOSSES}: PLACE YOUR BETS`, '#ffffff', 0.9); for (const P of punters) { P.call = null; P.stake = 0; P.broke = false; if (P.chips <= 0) { P.chips = 2; P.shout = true; } else P.shout = false; drawCard(P); if (P.bot) P.bot.when = 0.8 + rng() * 3.5; } }
          else if (phase === 'bet') {
            for (const P of punters) if (P.bot && !P.call && !P.broke) {
              P.bot.when -= dt;
              if (P.bot.when <= 0) {
                // CPU: cautious ones bet small on odds, punters go big on heads or tails
                const s = P.bot.style, r = rng();
                P.size = r < 0.08 + s * 0.12 ? Infinity : s > 0.6 ? 5 : s > 0.3 ? 3 : 1;
                call(P, rng() < 0.45 - s * 0.25 ? 'odds' : rng() < 0.5 ? 'heads' : 'tails');
              }
            }
            if (phaseT <= 0 || punters.every((P) => P.call || P.broke)) { phase = 'toss'; phaseT = TOSS_T; banner('COME IN SPINNER!', '#ffd23f'); faces = [rng() < 0.5, rng() < 0.5]; sfx.play('whoosh'); }
          } else if (phase === 'toss' && phaseT <= 0) {
            result = faces[0] && faces[1] ? 'heads' : !faces[0] && !faces[1] ? 'tails' : 'odds';
            banner(result === 'heads' ? 'HEADS!' : result === 'tails' ? 'TAILS!' : 'ODDS!', result === 'heads' ? '#ffd23f' : result === 'tails' ? '#9ad8ff' : '#c8a8ff', 1.5);
            sfx.play('bigboom');
            for (const P of punters) {
              if (!P.call) continue;
              let back = 0;
              if (P.call === result) back = P.call === 'odds' ? P.stake * 2 : P.stake * 3;
              else if (result === 'odds') back = P.stake; // heads/tails backers get their money back on odds
              P.chips += back;
              const net = back - P.stake;
              if (net) pop(P.x, 1.2, P.z + 1.2, net > 0 ? `+${net}` : `${net}`, net > 0 ? '#5cff9d' : '#ff5a5a', 0.55);
              if (net > 0) P.doll.bounce(); else if (net < 0) P.doll.flinch();
              drawCard(P);
            }
            if (punters.some((P) => P.call === result && result !== 'odds')) sfx.play('cheers');
            phase = 'show'; phaseT = SHOW_T;
          } else if (phase === 'show' && phaseT <= 0) {
            if (toss >= TOSSES) {
              finishAt = tAll; const top = Math.max(...punters.map((P) => P.chips));
              const w = punters.filter((P) => P.chips === top).map((P) => P.p.name).join(' & ');
              banner(`${w} CLEANS UP`, '#ffd23f', 1); sfx.play('hallelujah');
            } else { phase = 'intro'; phaseT = 0.3; }
          }
        }
        // ----- the spinner and the pennies -----
        const sp = phase === 'toss' ? 1 - phaseT / TOSS_T : 0;
        spinner.setArms(phase === 'toss' && sp < 0.15 ? 1.6 : phase === 'bet' ? 0.6 : 0.3, 0);
        spinner.update(dt);
        kip.position.set(0.45, 1.25 + (phase === 'toss' && sp < 0.15 ? 0.6 : 0), 0.15);
        coins.forEach((c, k) => {
          if (phase === 'toss') {
            // up, up, spinning, and down onto the sand
            const air = Math.max(0, Math.min(1, (sp - 0.08) / 0.85));
            const h = air < 1 ? 1.5 + Math.sin(air * Math.PI) * 5.5 - air * 1.45 : 0.03;
            c.position.set(0.45 + (k ? 0.35 : -0.25) * air + (k ? 0.1 : 0), Math.max(0.03, h), 0.15 + air * 0.9 + k * 0.1);
            if (air < 1) c.rotation.set(tAll * (16 + k * 3), 0, tAll * 3 + k);
            else c.rotation.set(faces[k] ? 0 : Math.PI, k * 1.3, 0);
          } else if (phase === 'show' || finishAt != null) {
            c.position.set(0.25 + k * 0.45, 0.03, 1.05 + k * 0.1); c.rotation.set(faces[k] ? 0 : Math.PI, k * 1.3, 0);
          } else { c.position.set(0.45 + k * 0.12 - 0.06, 1.27 + (phase === 'toss' ? 0.6 : 0), 0.15); c.rotation.set(0, 0, 0); }
        });
        for (const P of punters) {
          if (P.armT > 0) P.armT -= dt; else P.doll.setArms(phase === 'toss' ? 0.6 + Math.sin(tAll * 8 + P.x) * 0.15 : 0.15, 0.1);
          P.doll.update(dt);
        }
        for (let i = pops.length - 1; i >= 0; i--) { const q = pops[i]; q.life += dt; q.sp.material.opacity = Math.min(1, q.life * 5, q.stay - q.life + 1); if (!q.big) q.sp.position.y += dt * 0.6; if (q.life > q.stay + 1) { scene.remove(q.sp); pops.splice(i, 1); } }
      },
      input(p, m) {
        const P = punters.find((x) => x.p === p); if (!P) return;
        if (m.b in SIZES) { P.size = SIZES[m.b]; sfx.play('tick'); }
        else if (m.b === 'heads' || m.b === 'tails' || m.b === 'odds') call(P, m.b);
      },
      scores() { return Object.fromEntries(punters.map((P) => [P.p.id, P.chips + P.stake * (phase === 'bet' || phase === 'toss' ? 1 : 0)])); },
      done: () => finishAt != null && tAll - finishAt > 3.5,
    };
  },
};
