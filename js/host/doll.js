// The players: inflatable blow-up dolls with the player's photo on the face.
// Each player can send up to four photos (neutral, happy, sad, angry) and the face swaps to match
// what's happening. Without a photo for a mood, a drawn cartoon face stands in.
import * as THREE from 'three';

export const MOODS = ['neutral', 'happy', 'sad', 'angry'];
export const BODIES = [
  { id: 'bloke', label: 'Bloke', emoji: '🩳' },
  { id: 'sheila', label: 'Sheila', emoji: '👙' },
  { id: 'smooth', label: 'Smooth', emoji: '✨', sub: 'No bits' },
  { id: 'both', label: 'Both', emoji: '🎉', sub: 'All the bits' },
];
export const PLAYER_COLORS = ['#ff4f8b', '#3da5ff', '#ffd23f', '#5cff9d', '#b06bff', '#ff8a3d', '#3de1ff', '#ff5a5a'];

// ---------- faces ----------
function drawCartoon(g, mood, skin) {
  const S = 256;
  g.fillStyle = skin; g.fillRect(0, 0, S, S);
  g.lineCap = 'round'; g.lineWidth = 9; g.strokeStyle = '#2a1a22'; g.fillStyle = '#2a1a22';
  const eye = (x) => { g.beginPath(); g.ellipse(x, 104, 15, mood === 'happy' ? 8 : 19, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(x + 5, 96, 5, 0, 7); g.fill(); g.fillStyle = '#2a1a22'; };
  eye(92); eye(164);
  // lashes, because it's a doll
  for (const x of [92, 164]) for (const dx of [-12, 0, 12]) { g.lineWidth = 4; g.beginPath(); g.moveTo(x + dx, 84); g.lineTo(x + dx * 1.4, 72); g.stroke(); }
  g.lineWidth = 9;
  if (mood === 'angry') { g.beginPath(); g.moveTo(70, 70); g.lineTo(112, 86); g.moveTo(186, 70); g.lineTo(144, 86); g.stroke(); }
  if (mood === 'sad') { g.beginPath(); g.moveTo(72, 82); g.lineTo(110, 72); g.moveTo(184, 82); g.lineTo(146, 72); g.stroke(); }
  // cheeks
  g.fillStyle = 'rgba(255,80,120,0.35)'; g.beginPath(); g.arc(64, 150, 20, 0, 7); g.arc(192, 150, 20, 0, 7); g.fill();
  g.fillStyle = '#c2185b'; g.strokeStyle = '#c2185b';
  if (mood === 'neutral') { g.beginPath(); g.ellipse(128, 178, 24, 28, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#4a0d22'; g.beginPath(); g.ellipse(128, 178, 13, 16, 0, 0, Math.PI * 2); g.fill(); }
  if (mood === 'happy') { g.beginPath(); g.arc(128, 156, 44, 0.15 * Math.PI, 0.85 * Math.PI); g.closePath(); g.fill(); }
  if (mood === 'sad') { g.lineWidth = 10; g.beginPath(); g.arc(128, 214, 34, 1.2 * Math.PI, 1.8 * Math.PI); g.stroke(); g.fillStyle = '#5ab4ff'; g.beginPath(); g.ellipse(170, 136, 7, 12, 0, 0, 7); g.fill(); }
  if (mood === 'angry') { g.fillStyle = '#fff'; g.fillRect(96, 168, 64, 22); g.lineWidth = 6; g.strokeRect(96, 168, 64, 22); g.beginPath(); for (let x = 112; x < 160; x += 16) { g.moveTo(x, 168); g.lineTo(x, 190); } g.stroke(); }
}

const faceCache = new Map(); // `${pid}:${mood}:${photoKey}` -> texture
function faceTexture(pid, mood, photo, skin) {
  const key = `${pid}:${mood}:${photo ? photo.length + photo.slice(-24) : 'cartoon'}:${skin}`;
  if (faceCache.has(key)) return faceCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  drawCartoon(g, mood, skin);
  if (photo) {
    const img = new Image();
    img.onload = () => {
      g.fillStyle = skin; g.fillRect(0, 0, 256, 256);
      g.save(); g.beginPath(); g.arc(128, 128, 120, 0, Math.PI * 2); g.clip();
      g.drawImage(img, 0, 0, 256, 256);
      g.restore();
      tex.needsUpdate = true;
    };
    img.src = photo;
  }
  faceCache.set(key, tex);
  return tex;
}

// small square image for the HUD and phones (photo or cartoon)
export function faceDataUrl(player, mood = 'neutral') {
  const photo = player.photos?.[mood] || player.photos?.neutral;
  if (photo) return photo;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.scale(0.5, 0.5);
  drawCartoon(g, mood, '#ffd3c4');
  return c.toDataURL('image/png');
}

// ---------- body ----------
function vinyl(color) {
  // glossy PVC: a hard clear coat over a slightly soft, sheeny base
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, sheen: 0.35, sheenRoughness: 0.5, sheenColor: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.4), specularIntensity: 0.7 });
}
// an inflated tube along +y from a [radius, y] profile (arms and legs), seam rings where it pinches
function tube(profile, m, seamMat) {
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 22), m);
  mesh.castShadow = true;
  g.add(mesh);
  for (const [r, y, pinch] of profile) if (pinch) { const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.004, 0.009, 6, 24), seamMat); ring.rotation.x = Math.PI / 2; ring.position.y = y; g.add(ring); }
  return g;
}

export class Doll {
  constructor(player, opts = {}) {
    const tag = opts.tag ?? true;
    this.player = player;
    this.group = new THREE.Group();
    this.scaler = new THREE.Group(); // overall size (bigger on the board so faces read on the TV)
    this.scaler.scale.setScalar(opts.scale || 1);
    this.group.add(this.scaler);
    this.body = new THREE.Group(); // wobbles; group stays put for game logic
    this.scaler.add(this.body);
    const tint = new THREE.Color(player.color || '#ff9fb8');
    const skinCol = new THREE.Color('#ffc9b5').lerp(tint, 0.35);
    this.skinCss = '#' + skinCol.getHexString();
    const skin = vinyl(skinCol);
    const seam = vinyl(skinCol.clone().multiplyScalar(0.8));
    this.skinMat = skin;

    // torso: one inflated lathe shape
    const prof = [[0, 0.82], [0.36, 0.86], [0.44, 1.0], [0.37, 1.25], [0.42, 1.48], [0.4, 1.7], [0.3, 1.86], [0.16, 1.95], [0.15, 2.05], [0, 2.06]]
      .map(([r, y]) => new THREE.Vector2(r, y));
    const torso = new THREE.Mesh(new THREE.LatheGeometry(prof, 28), skin);
    torso.castShadow = true;
    this.body.add(torso);
    // the seam down each side and the valve on the back, so it reads as inflatable
    for (const s of [-1, 1]) { const sm = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.012, 4, 40, Math.PI * 0.7), seam); sm.rotation.y = Math.PI / 2; sm.position.set(s * 0.38, 1.35, 0); sm.scale.set(1, 1, 0.66); sm.rotation.z = Math.PI * 0.65; this.body.add(sm); }
    const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.12, 10), seam);
    valve.rotation.x = Math.PI / 2; valve.position.set(0, 1.25, -0.4); this.body.add(valve);

    // head with a face cap wrapped over the front
    this.head = new THREE.Group();
    this.head.position.y = 2.42;
    this.body.add(this.head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.44, 28, 20), skin);
    skull.castShadow = true;
    this.head.add(skull);
    // moulded plastic hair: a glossy cap with a fringe and a few curls round the back
    const hairMat = vinyl(player.hair || 0x3a2418);
    hairMat.roughness = 0.18;
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.47, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.42), hairMat);
    hair.rotation.x = -0.35;
    this.head.add(hair);
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * 0.55 + i / 8 * Math.PI * 0.9;
      const curl = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), hairMat);
      curl.position.set(Math.cos(a) * 0.4, 0.02 - Math.abs(Math.sin(i)) * 0.06, Math.sin(a) * -0.4 - 0.02);
      this.head.add(curl);
    }
    // ears
    for (const sd of [-1, 1]) { const ear = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), skin); ear.scale.set(0.5, 1, 0.8); ear.position.set(sd * 0.44, -0.02, 0); this.head.add(ear); }
    this.faceMat = new THREE.MeshStandardMaterial({ roughness: 0.55 });
    // a patch of sphere centred on +z (phi 0.2π–0.8π), so the doll looks down its +z axis
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.452, 32, 20, Math.PI * 0.2, Math.PI * 0.6, Math.PI * 0.2, Math.PI * 0.6), this.faceMat);
    this.head.add(face);

    // arms stick straight out (it's a blow-up doll); each hangs off a shoulder pivot
    this.arms = [];
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.36, 1.78, 0);
      // inflated arm with a pinched elbow, and a mitten hand with a thumb
      const arm = tube([[0, 0], [0.12, 0.02], [0.135, 0.15], [0.125, 0.36], [0.1, 0.42, true], [0.125, 0.48], [0.12, 0.7], [0.09, 0.8, true], [0, 0.82]], skin, seam);
      arm.rotation.z = -s * Math.PI / 2;
      arm.position.x = s * 0.06;
      pivot.add(arm);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), skin);
      hand.scale.set(1.15, 0.6, 1); hand.position.x = s * 0.98; hand.castShadow = true;
      pivot.add(hand);
      const thumb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), skin);
      thumb.scale.set(1.4, 0.8, 0.8); thumb.position.set(s * 0.92, 0.02, 0.13);
      pivot.add(thumb);
      pivot.userData.side = s;
      this.body.add(pivot);
      this.arms.push(pivot);
    }
    this.setArms();
    for (const s of [-1, 1]) {
      // legs: thick inflated tubes, pinched knee, flat-soled feet
      const leg = tube([[0, 0.1], [0.13, 0.12], [0.16, 0.3], [0.13, 0.48, true], [0.17, 0.62], [0.19, 0.86], [0, 0.96]], skin, seam);
      leg.position.set(s * 0.22, 0, 0);
      leg.rotation.z = s * 0.1;
      this.body.add(leg);
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), skin);
      foot.scale.set(0.9, 0.5, 1.5); foot.position.set(s * 0.21, 0.08, 0.1); foot.castShadow = true;
      this.body.add(foot);
    }
    this.buildBits(player.body || 'smooth', skin, tint);

    // colour ring and name tag
    if (tag) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.8, 32), new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04;
      this.group.add(ring);
      this.tag = makeTag(player.name, player.color);
      this.tag.position.y = 2.75 * (opts.scale || 1) + 0.55;
      this.group.add(this.tag);
    }
    this.mood = 'neutral';
    this.refreshFace();
    this.t = Math.random() * 10;
    this.flinchT = 0;
  }

  buildBits(kind, skin, tint) {
    const add = (m, x, y, z) => { m.position.set(x, y, z); m.castShadow = true; this.body.add(m); return m; };
    if (kind === 'sheila' || kind === 'both') {
      for (const s of [-1, 1]) add(new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), skin), s * 0.17, 1.55, 0.3);
      const top = vinyl(tint.clone().offsetHSL(0.5, 0, 0));
      for (const s of [-1, 1]) add(new THREE.Mesh(new THREE.SphereGeometry(0.175, 16, 8, 0, Math.PI * 2, Math.PI * 0.25, Math.PI * 0.5), top), s * 0.17, 1.55, 0.31).rotation.x = Math.PI / 2;
    }
    if (kind === 'bloke' || kind === 'both') {
      // budgie smugglers, Aussie flag-ish green and gold
      const togs = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.38, 0.26, 24), vinyl(0x00843d));
      add(togs, 0, 0.9, 0);
      const bulge = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), vinyl(0xffcd00));
      bulge.scale.set(1, 0.8, 0.9);
      add(bulge, 0, 0.86, 0.36);
    }
  }

  setPhotos(photos) { this.player.photos = photos; this.refreshFace(); }

  setMood(mood) { this.mood = MOODS.includes(mood) ? mood : 'neutral'; this.refreshFace(); }

  refreshFace() {
    const ph = this.player.photos || {};
    this.faceMat.map = faceTexture(this.player.id, this.mood, ph[this.mood] || ph.neutral || null, this.skinCss);
    this.faceMat.needsUpdate = true;
  }

  // lift: 0 = arms straight out, + = up (radians); tilt: + = left arm up, right arm down (a plane's bank)
  setArms(lift = -0.4, tilt = 0) {
    for (const a of this.arms) a.rotation.z = a.userData.side * lift - tilt;
  }

  flinch() { this.flinchT = 0.5; }

  update(dt) {
    this.t += dt;
    // inflatables never stand still
    const sway = Math.sin(this.t * 2.1) * 0.05;
    this.body.rotation.z = sway + (this.flinchT > 0 ? Math.sin(this.flinchT * 40) * 0.2 : 0);
    const squish = 1 + Math.sin(this.t * 3.3) * 0.015;
    this.body.scale.set(1 / Math.sqrt(squish), squish, 1 / Math.sqrt(squish));
    this.head.rotation.z = Math.sin(this.t * 1.7 + 1) * 0.08;
    if (this.flinchT > 0) this.flinchT -= dt;
  }
}

function makeTag(name, color) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 112;
  const g = c.getContext('2d');
  g.font = '900 64px system-ui, sans-serif';
  const w = Math.min(500, g.measureText(name).width + 60);
  g.fillStyle = 'rgba(10,8,20,0.75)';
  g.beginPath(); g.roundRect((512 - w) / 2, 8, w, 96, 48); g.fill();
  g.strokeStyle = color || '#fff'; g.lineWidth = 6; g.stroke();
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(name, 256, 58, 470);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(2.6, 0.57, 1);
  s.renderOrder = 10;
  return s;
}
