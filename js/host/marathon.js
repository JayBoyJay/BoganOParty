// Minigames-only mode: no board, just minigames back to back. Each finish scores points
// (10 / 6 / 3 / 1, ties share the better place) and the most points after the last game wins.
// Between games the dolls stand on pedestals that rise with their score.
import * as THREE from 'three';
import { RoomEnvironment } from '../../vendor/RoomEnvironment.js';
import { RULES } from './engine.js';
import { Doll, faceDataUrl } from './doll.js';
import { makeKit } from './kit.js';
import { Tweens, easeOut } from './stage.js';

export const MARATHON_POINTS = RULES.minigameCoins;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// The standings stage: a dark studio, spotlights, one pedestal per player.
class StandingsView {
  constructor(stage, players) {
    this.stage = stage; this.players = players;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.5, 300);
    this.tweens = new Tweens();
    this.t = 0;
    const s = this.scene, k = makeKit(s);
    s.background = new THREE.Color(0x1a0f24);
    s.fog = new THREE.Fog(0x1a0f24, 30, 70);
    s.environment = new THREE.PMREMGenerator(stage.renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    s.environmentIntensity = 0.5;
    s.add(new THREE.HemisphereLight(0xb9a6ff, 0x2a1530, 0.5));
    // a glossy stage floor and a back wall with the show's name in neon
    const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 64), new THREE.MeshPhysicalMaterial({ color: 0x241433, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; s.add(floor);
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(24, 24, 18, 64, 1, true, Math.PI * 0.7, Math.PI * 0.6), new THREE.MeshStandardMaterial({ color: 0x2b1640, roughness: 0.9, side: THREE.BackSide }));
    wall.position.set(0, 9, 6); s.add(wall);
    k.sign('BOGAN-O PARTY', 14, 2.4, 0, 10.5, -16.5, s, { bg: null, fg: '#ff4fb0', glow: '#ff4fb0', font: '900 150px system-ui, sans-serif' });
    k.sign('MINIGAME MARATHON', 9, 1, 0, 8.4, -16.4, s, { bg: null, fg: '#7fe8ff', glow: '#7fe8ff' });
    const n = players.length, gap = Math.min(3.4, 16 / n);
    for (const x of [-1, 0, 1]) {
      const spot = new THREE.SpotLight(0xfff0dd, 260, 60, 0.45, 0.6, 1.6);
      spot.position.set(x * 9, 18, 10); spot.target.position.set(x * 4, 0, 0);
      spot.castShadow = x === 0; spot.shadow.mapSize.set(2048, 2048);
      s.add(spot, spot.target);
    }
    this.slots = players.map((p, i) => {
      const x = (i - (n - 1) / 2) * gap;
      const g = new THREE.Group(); g.position.x = x; s.add(g);
      // pedestal: a lathed column with a gold lip, scaled in height by points
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 1, 40), new THREE.MeshPhysicalMaterial({ color: new THREE.Color(p.color).multiplyScalar(0.55), roughness: 0.3, clearcoat: 1 }));
      col.castShadow = true; col.receiveShadow = true; g.add(col);
      const lip = new THREE.Mesh(new THREE.TorusGeometry(0.98, 0.07, 10, 48), new THREE.MeshStandardMaterial({ color: 0xd8b04a, metalness: 1, roughness: 0.25 }));
      lip.rotation.x = Math.PI / 2; g.add(lip);
      const doll = new Doll(p, { tag: false, scale: 1.15 });
      g.add(doll.group);
      const label = makeLabel(); label.position.y = 4.4; g.add(label);
      const slot = { p, g, col, lip, doll, label, h: 0.2 };
      this.setHeight(slot, 0.2);
      return slot;
    });
    // looking a little left of centre, so the pedestals sit to the right of the standings panel
    this.camLook = new THREE.Vector3(-3.6, 3.6, 0);
    this.centred = false; // true once the podium is up and there's no panel to make room for
  }

  setHeight(slot, h) {
    slot.h = h;
    slot.col.scale.y = h; slot.col.position.y = h / 2;
    slot.lip.position.y = h;
    slot.doll.group.position.y = h;
    slot.label.position.y = h + 4.1;
  }

  // points: Map pid -> total; gained: Map pid -> this game's points; ranked: players best first
  show(points, gained, ranked) {
    const top = Math.max(10, ...points.values());
    for (const slot of this.slots) {
      const pts = points.get(slot.p.id) || 0, from = slot.h, to = 0.2 + (pts / top) * 3.2;
      const rank = ranked.indexOf(slot.p);
      drawLabel(slot.label, slot.p, pts, gained?.get(slot.p.id) || 0, rank);
      slot.doll.setMood(rank === 0 && pts > 0 ? 'happy' : rank === ranked.length - 1 && pts < top ? 'sad' : 'neutral');
      this.tweens.add(1.2, (k) => this.setHeight(slot, from + (to - from) * k), easeOut);
    }
  }

  setPhotos(p) { this.slots.find((s) => s.p === p)?.doll.setPhotos(p.photos); }

  update(dt) {
    this.t += dt;
    this.tweens.update(dt);
    const ox = this.centred ? 0 : -3.6;
    this.camLook.x += (ox - this.camLook.x) * Math.min(1, dt * 2);
    this.camera.position.set(this.camLook.x + Math.sin(this.t * 0.15) * 2.5, 7.2, 21);
    this.camera.lookAt(this.camLook);
    for (const s of this.slots) { s.doll.group.rotation.y = Math.sin(this.t * 0.6 + s.g.position.x) * 0.25; s.doll.update(dt); }
  }

  activate() { this.stage.setView(this); }
}

function makeLabel() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, transparent: true }));
  s.scale.set(2.8, 1.4, 1);
  return s;
}
function drawLabel(sprite, p, pts, gained, rank) {
  const t = sprite.material.map, g = t.image.getContext('2d');
  g.clearRect(0, 0, 512, 256);
  g.fillStyle = 'rgba(10,6,18,0.78)'; g.beginPath(); g.roundRect(16, 20, 480, 216, 40); g.fill();
  g.strokeStyle = p.color; g.lineWidth = 8; g.stroke();
  g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = '900 56px system-ui, sans-serif';
  g.fillText(`${['🥇', '🥈', '🥉'][rank] || ''} ${p.name}`.trim(), 256, 92, 450);
  g.fillStyle = '#ffd23f'; g.font = '900 78px system-ui, sans-serif';
  g.fillText(`${pts} pts`, 256, 180);
  if (gained) { g.fillStyle = '#5cff9d'; g.font = '900 40px system-ui, sans-serif'; g.fillText(`+${gained}`, 440, 220); }
  t.needsUpdate = true;
}

export class Marathon {
  constructor({ players, rounds, runner, hub, hud, sfx, stage, root, speed = 1, only = null }) {
    Object.assign(this, { players, rounds, runner, hub, hud, sfx, stage, root, speed, only });
    this.points = new Map(players.map((p) => [p.id, 0]));
    this.wins = new Map(players.map((p) => [p.id, 0]));
    for (const p of players) { p.points = 0; p.mood = 'neutral'; }
    this.view = new StandingsView(stage, players);
  }

  ranked() {
    // ties go to more wins, then to whoever did better in the latest game
    const last = this.lastGained || new Map();
    return [...this.players].sort((a, b) => (this.points.get(b.id) - this.points.get(a.id)) || (this.wins.get(b.id) - this.wins.get(a.id)) || ((last.get(b.id) || 0) - (last.get(a.id) || 0)));
  }

  table(gained) {
    return this.ranked().map((p, i) => `<div style="--pc:${p.color}"><span class="pl">${i + 1}</span><img src="${faceDataUrl(p, 'neutral')}" alt=""><b>${esc(p.name)}</b>${gained?.get(p.id) ? `<em>+${gained.get(p.id)}</em>` : ''}<span>${this.points.get(p.id)}</span></div>`).join('');
  }

  // the panel over the standings stage between games
  panel(label, title, sub, gained) {
    this.root.classList.remove('hidden');
    this.root.innerHTML = `<div class="mt-panel"><div class="label">${esc(label)}</div><h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}<div class="mg-results">${this.table(gained)}</div></div>`;
  }

  async play() {
    this.hud.show(false);
    for (let r = 1; r <= this.rounds; r++) {
      const def = this.runner.pick(this.only);
      this.view.activate();
      this.view.show(this.points, null, this.ranked());
      this.panel(`Minigame ${r} of ${this.rounds}`, r === 1 ? 'Minigame marathon!' : `Next up: ${def.name}`,
        r === 1 ? `${this.rounds} games back to back. ${MARATHON_POINTS.join(' / ')} points per finish. Most points wins. First up: ${def.name}.` : this.leadLine());
      this.hub.idleAll(`Minigame ${r} of ${this.rounds}`, `Next up: ${def.name}`);
      await sleep((r === 1 ? 5000 : 3500) * this.speed);

      const placings = await this.runner.run(this.players, def);
      this.hud.show(false);
      const gained = new Map();
      let place = 0;
      for (const group of placings) {
        const pts = MARATHON_POINTS[place] || 0;
        for (const p of group) { gained.set(p.id, pts); this.points.set(p.id, this.points.get(p.id) + pts); p.points = this.points.get(p.id); if (place === 0) this.wins.set(p.id, this.wins.get(p.id) + 1); }
        place += group.length;
      }
      this.lastGained = gained;
      this.view.activate();
      this.view.show(this.points, gained, this.ranked());
      this.sfx.play('coin');
      const last = r === this.rounds;
      this.panel(`After minigame ${r} of ${this.rounds}`, last ? 'Final scores' : 'Standings', last ? '' : this.leadLine(), gained);
      this.hub.idleAll(last ? 'That was the last one!' : 'Standings', this.ranked().map((p, i) => `${i + 1}. ${p.name} ${this.points.get(p.id)}`).join('  ·  '));
      await sleep((last ? 3000 : 4500) * this.speed);
    }
    this.root.classList.add('hidden');
    this.root.innerHTML = '';
    const ranked = this.ranked();
    return { winner: ranked[0], ranked };
  }

  leadLine() {
    const [a, b] = this.ranked();
    const pa = this.points.get(a.id), pb = b ? this.points.get(b.id) : 0;
    if (!pa) return 'Nobody on the board yet.';
    return pa === pb ? `${a.name} and ${b.name} are level on ${pa}.` : `${a.name} leads by ${pa - pb}.`;
  }

  setMood(p, mood) { this.view.slots.find((s) => s.p === p)?.doll.setMood(mood); }
  focus() { this.view.centred = true; this.view.activate(); }
}
