// Chad's Japanese Adventure: everyone runs down a shrine path in Kyoto, straight at the camera.
// Cats sit in the way (jump them) and low torii gates span each lane (duck under them).
// Everyone gets the same obstacles, so it's fair. Each one cleared scores a point; hit one and your
// doll goes flying and loses ground. A bank of fog follows the pack and creeps closer as the run goes
// on: fall far enough behind to be swallowed by it and you're out.
import { addSky } from '../../host/sky.js';
import { cherryTreeParts } from '../../host/props.js';
import { mergeGeometries } from '../../../vendor/BufferGeometryUtils.js';

const LANE = 2.6; // metres per lane
const DOLL = 0.8; // doll scale
const JUMP_T = 0.6, JUMP_H = 1.75, DUCK_T = 0.75, STUN_T = 1.1;
const CAT_CLEAR = 0.95; // how high the doll's feet must be over a cat
const SPAN = 90; // scenery loops over this many metres (the fog hides anything further back)
const FOG_GAP = [18, 12]; // how far behind the leader the fog sits, at the start and at the end
const STUN_SLOW = 0.3; // a tumble drops you to this fraction of the pace for STUN_T
const OFF = 6; // the pack runs this far back from the camera's focus, so obstacles show up in the foreground early

// One torii, merged into three geometries (red, black, the ink on the pillars), with its span along z.
// Proper Myojin proportions: a kasagi that sweeps up at the ends, a shimaki under it, a gakuzuka
// plaque, a nuki through the pillars poking out each side, and black nemaki at the feet.
function torii(THREE, { span, h, r, nukiY = h * 0.76 }) {
  const red = [], dark = [], ink = [];
  const put = (list, g, x = 0, y = 0, z = 0) => { g = g.index ? g.toNonIndexed() : g; g.translate(x, y, z); list.push(g); };
  const half = span / 2, lean = 0.025;
  for (const s of [-1, 1]) {
    const p = new THREE.CylinderGeometry(r * 0.9, r, h, 16); p.rotateX(-s * lean); put(red, p, 0, h / 2, s * half);
    put(dark, new THREE.CylinderGeometry(r * 1.18, r * 1.25, h * 0.11, 16), 0, h * 0.055, s * half); // nemaki
    put(red, new THREE.TorusGeometry(r * 0.95, r * 0.12, 6, 16).rotateX(Math.PI / 2), 0, h * 0.93, s * (half - lean * h * 0.43)); // daiwa ring
    const t = new THREE.PlaneGeometry(r * 0.9, h * 0.42); t.rotateY(Math.PI / 2); put(ink, t, r * 0.97, h * 0.42, s * half); // donor's name, facing the path
  }
  put(red, new THREE.BoxGeometry(r * 1.0, r * 1.05, span + r * 4.4), 0, nukiY, 0); // nuki
  put(red, new THREE.BoxGeometry(r * 0.75, h - nukiY - r * 0.6, r * 1.2), 0, (h + nukiY) / 2 + r * 0.25, 0); // gakuzuka
  // shimaki and kasagi: a beam profile in (z, y) that curves up at the tips, extruded through x
  const beam = (len, y0, th, rise, depth, list, flare) => {
    const sh = new THREE.Shape(), N = 16, L = len / 2;
    const curve = (u) => rise * Math.pow(Math.abs(u), 3.2);
    for (let i = 0; i <= N; i++) { const u = -1 + (2 * i) / N; const yy = y0 + curve(u); i ? sh.lineTo(u * L, yy) : sh.moveTo(u * L, yy); }
    for (let i = N; i >= 0; i--) { const u = -1 + (2 * i) / N; sh.lineTo(u * L * (1 + flare * Math.abs(u) ** 6), y0 + th + curve(u) * 1.15); }
    const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1, curveSegments: 4 });
    g.rotateY(Math.PI / 2); g.translate(-depth / 2, 0, 0); put(list, g);
  };
  beam(span + r * 5.2, h - r * 0.55, r * 0.95, r * 0.9, r * 1.7, red, 0);
  beam(span + r * 7.0, h + r * 0.45, r * 0.95, r * 1.7, r * 2.3, dark, 0.04);
  return { red: mergeGeometries(red), dark: mergeGeometries(dark), ink: mergeGeometries(ink) };
}

// brushed black characters running down a pillar, drawn as strokes so no CJK font is needed
function inscription(THREE, rng) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const g = c.getContext('2d'); g.strokeStyle = '#141010'; g.lineCap = 'round';
  for (let k = 0; k < 7; k++) {
    const cy = 22 + k * 32;
    for (let i = 0; i < 5; i++) {
      g.lineWidth = 3 + rng() * 3; g.beginPath();
      const x = 18 + rng() * 28, y = cy - 12 + rng() * 22;
      if (rng() < 0.5) { g.moveTo(x - 9, y); g.lineTo(x + 9, y + (rng() - 0.5) * 4); } else { g.moveTo(x, y - 10); g.quadraticCurveTo(x + (rng() - 0.5) * 10, y, x - 4 + rng() * 8, y + 10); }
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export default {
  id: 'chads-japanese-adventure',
  name: "Chad's Japanese Adventure",
  blurb: 'Chad is running late through Kyoto. Jump the cats, duck under the torii gates.',
  howTo: 'Press JUMP to hop over the cats and DUCK to squash under the low torii gates. Every one you clear scores. Hit one and you go flying and drop back. There\'s a fog rolling along behind the pack, and it creeps closer as you go: fall back into it and you\'re out. Still running at the end? +5.',
  padText: 'Jump the cats, duck the gates!',
  duration: 55,
  pad: { kind: 'buttons', buttons: [{ id: 'duck', label: '⬇️ DUCK', tall: true }, { id: 'jump', label: '⬆️ JUMP', tone: 'go', tall: true }] },

  create(mg) {
    const { THREE, kit, scene, players, rng, renderer } = mg;
    const n = players.length, W = n * LANE;
    const laneZ = (i) => (i - (n - 1) / 2) * LANE;
    const FRONT = 14 + W * 0.45 + 10; // scenery re-enters just past the camera

    // ----- sky: late afternoon, sun low behind the camera -----
    const { sun } = addSky(scene, renderer, { elevation: 22, azimuth: 62, turbidity: 6, rayleigh: 2.4, mie: 0.006, sun: 0xffd2a0, sunIntensity: 3.2, sky: 0xffe2c8, ground: 0x6a5a48, hemi: 0.55, env: 0.55, shadowSize: 34, fog: [0xf2e6dc, 30, 95] });
    sun.target.position.set(-4, 0, 0);

    // ----- ground: flagstone path over raked gravel, both scroll as we run -----
    const scrollers = [];
    const groundPlane = (w, d, name, unit, y, tint) => {
      const m = kit.surf(name, { unit, tint }).clone();
      for (const key of ['map', 'normalMap', 'roughnessMap']) { if (!m[key]) continue; m[key] = m[key].clone(); m[key].repeat.set(w / unit, d / unit); m[key].needsUpdate = true; }
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m);
      p.rotation.x = -Math.PI / 2; p.position.set(-w / 2 + FRONT + 10, y, 0); p.receiveShadow = true;
      scene.add(p);
      scrollers.push((R) => { for (const key of ['map', 'normalMap', 'roughnessMap']) if (m[key]) m[key].offset.x = (R / unit) % 1; });
      return p;
    };
    groundPlane(SPAN + 60, 260, 'gravel', 3, 0, 0xd8d2c4);
    groundPlane(SPAN + 60, W + 1.2, 'flagstone', 4, 0.02, 0xffffff);
    // kerbs between lanes and along the edges (the same all the way along, so they needn't move)
    const kerb = kit.surf('concrete', { unit: 1, tint: 0xa9a397 });
    for (let i = 0; i <= n; i++) {
      const z = (i - n / 2) * LANE, edge = i === 0 || i === n;
      const k = kit.box(SPAN + 60, edge ? 0.22 : 0.08, edge ? 0.35 : 0.12, kerb, -(SPAN + 60) / 2 + FRONT + 10, 0, z);
      k.castShadow = false;
    }

    // ----- scenery that loops past: torii tunnels, stone lanterns, cherry trees, machiya houses -----
    const loops = [];
    // instanced parts at ground positions g; x on screen = g - R
    const instanced = (parts, items) => {
      const meshes = parts.map(({ geo, material, shadow = true }) => { const m = new THREE.InstancedMesh(geo, material, items.length); m.castShadow = shadow; m.receiveShadow = true; m.frustumCulled = false; scene.add(m); return m; });
      const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
      loops.push((R) => {
        items.forEach((it, i) => {
          while (it.g - R < FRONT - SPAN) it.g += SPAN;
          P.set(it.g - R, it.y || 0, it.z); Q.setFromAxisAngle(up, it.rot || 0); S.setScalar(it.s || 1);
          M.compose(P, Q, S);
          for (const m of meshes) m.setMatrixAt(i, M);
        });
        for (const m of meshes) m.instanceMatrix.needsUpdate = true;
      });
      return meshes;
    };
    const groups = (items, make) => {
      for (const it of items) { it.obj = make(it); scene.add(it.obj); }
      loops.push((R) => { for (const it of items) { while (it.g - R < FRONT - SPAN) it.g += SPAN; it.obj.position.set(it.g - R, 0, it.z); } });
    };
    const spread = (step, jitter = 0) => { const out = []; for (let g = FRONT - SPAN; g < FRONT; g += step) out.push(g + (rng() - 0.5) * jitter); return out; };

    // the Fushimi Inari tunnels: gates packed shoulder to shoulder down both sides, so their black
    // curved caps run together into one long roofline
    const vermilion = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.35 });
    const black = new THREE.MeshStandardMaterial({ color: 0x1b1714, roughness: 0.55 });
    const ink = new THREE.MeshStandardMaterial({ map: inscription(THREE, rng), transparent: true, alphaTest: 0.4, roughness: 0.6, color: 0xffffff });
    {
      const T = torii(THREE, { span: 3.0, h: 3.7, r: 0.2 });
      const items = [];
      for (const side of [-1, 1]) for (const g of spread(1.2)) items.push({ g, z: side * (W / 2 + 3.6) });
      const meshes = instanced([{ geo: T.red, material: vermilion }, { geo: T.dark, material: black }, { geo: T.ink, material: ink, shadow: false }], items);
      // weathering: no two gates quite the same red
      const c = new THREE.Color();
      items.forEach((_, i) => { const v = rng(); c.setHex(0xe24a1c).offsetHSL((v - 0.5) * 0.02, (rng() - 0.5) * 0.1, (v - 0.5) * 0.12); meshes[0].setColorAt(i, c); });
      meshes[0].instanceColor.needsUpdate = true;
    }

    // stone lanterns (toro) along the path, lit
    {
      const stone = kit.surf('concrete', { unit: 0.8, tint: 0xb4ae9f });
      const glow = new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffa040, emissiveIntensity: 2.2 });
      const lathe = (prof, seg = 16) => new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), seg);
      const s = [lathe([[0, 0], [0.5, 0], [0.5, 0.18], [0.36, 0.26], [0.18, 0.3], [0.14, 0.9], [0.32, 1.0], [0.32, 1.12], [0, 1.12]]),
        (() => { const g = new THREE.BoxGeometry(0.62, 0.08, 0.62); g.translate(0, 1.56, 0); return g; })(),
        (() => { const g = new THREE.ConeGeometry(0.66, 0.42, 4); g.rotateY(Math.PI / 4); g.translate(0, 1.8, 0); return g; })(),
        (() => { const g = new THREE.SphereGeometry(0.1, 10, 8); g.translate(0, 2.06, 0); return g; })()];
      for (const [dx, dz] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) { const g = new THREE.BoxGeometry(0.1, 0.44, 0.1); g.translate(dx, 1.34, dz); s.push(g); }
      const lit = new THREE.BoxGeometry(0.4, 0.34, 0.4); lit.translate(0, 1.32, 0);
      const items = [];
      for (const side of [-1, 1]) for (const g of spread(9)) items.push({ g, z: side * (W / 2 + 1.25) });
      instanced([{ geo: mergeGeometries(s), material: stone }, { geo: lit, material: glow, shadow: false }], items);
    }

    // cherry trees in blossom behind the gates
    for (let v = 0; v < 3; v++) {
      const items = [];
      for (const side of [-1, 1]) for (const g of spread(14, 6)) if (rng() < 0.55) items.push({ g: g + v * 4.6, z: side * (W / 2 + 8 + rng() * 9), s: 0.9 + rng() * 0.4, rot: rng() * 6 });
      instanced(cherryTreeParts(v + 3), items);
    }

    // machiya townhouses: dark timber, lattice fronts glowing from inside, tiled roofs
    const lattice = (() => {
      const c = document.createElement('canvas'); c.width = 256; c.height = 128;
      const g = c.getContext('2d');
      const grd = g.createLinearGradient(0, 0, 0, 128); grd.addColorStop(0, '#f7d9a0'); grd.addColorStop(1, '#e8b468');
      g.fillStyle = grd; g.fillRect(0, 0, 256, 128);
      g.fillStyle = '#3a2416'; for (let x = 0; x < 256; x += 9) g.fillRect(x, 0, 5, 128);
      g.fillRect(0, 0, 256, 8); g.fillRect(0, 120, 256, 8); g.fillRect(0, 40, 256, 4);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t;
    })();
    const noren = (() => {
      const c = document.createElement('canvas'); c.width = 128; c.height = 96;
      const g = c.getContext('2d'); g.fillStyle = '#1f3566'; g.fillRect(0, 0, 128, 96);
      g.fillStyle = '#f4efe2'; for (const x of [42, 86]) g.fillRect(x, 0, 2, 96);
      g.strokeStyle = '#f4efe2'; g.lineWidth = 5; g.beginPath(); g.arc(64, 44, 18, 0, 7); g.stroke(); g.beginPath(); g.moveTo(52, 44); g.lineTo(76, 44); g.stroke();
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    const wood = kit.surf('planks', { unit: 1.6, tint: 0x6a4630 }), plaster = kit.surf('render', { arg: 0xe9e1cf, unit: 3 }), tiles = kit.surf('kawara', { unit: 1.6 });
    const latticeMats = [0, 1, 2].map((i) => { const t = lattice.clone(); t.needsUpdate = true; return new THREE.MeshStandardMaterial({ map: t, emissive: 0xffa850, emissiveMap: t, emissiveIntensity: 0.5 + i * 0.25, roughness: 0.8 }); });
    const norenMat = new THREE.MeshStandardMaterial({ map: noren, side: THREE.DoubleSide, roughness: 0.95 });
    const chochin = new THREE.MeshStandardMaterial({ color: 0xd8301c, emissive: 0xff5a20, emissiveIntensity: 1.4, roughness: 0.6 });
    const machiya = (side, w) => {
      const g = new THREE.Group(), d = 7;
      const h = kit.group(0, 0, 0, side > 0 ? Math.PI : 0, 1, g); // front faces the path
      kit.box(w, 2.9, d, wood, 0, 0, -d / 2, h);
      const lat = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.6, 2.1), latticeMats[Math.floor(rng() * 3)]);
      lat.material.map.repeat.x = (w - 0.6) / 3; lat.position.set(0.2, 1.2, 0.02); h.add(lat);
      const nr = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.95), norenMat); nr.position.set(-w / 2 + 1.1, 2.2, 0.25); h.add(nr);
      const eave = kit.box(w + 0.5, 0.12, 1.4, tiles, 0, 2.86, 0.45, h); eave.rotation.x = 0.38;
      kit.box(w, 2.1, d - 1.4, plaster, 0, 2.95, -d / 2 - 0.7, h);
      for (const x of [-w / 4, w / 4]) kit.box(w / 3, 0.7, 0.06, 0x2a1d14, x, 3.7, -1.38, h); // mushiko slit windows
      for (const s of [-1, 1]) { const r = kit.box(w + 0.7, 0.14, d / 2 + 0.7, tiles, 0, 5.2, -d / 2 + s * (d / 4 + 0.1), h); r.rotation.x = -s * 0.48; }
      kit.box(w + 0.7, 0.3, 0.4, 0x3d3f44, 0, 6.0, -d / 2, h);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), chochin); lamp.scale.y = 1.35; lamp.position.set(w / 2 - 0.8, 2.35, 0.6); h.add(lamp);
      return g;
    };
    {
      const items = [];
      for (const side of [-1, 1]) { let g = FRONT - SPAN; while (g < FRONT - 8) { const w = 6 + rng() * 3; items.push({ g: g + w / 2, z: side * (W / 2 + 7.5 + rng() * 1.5), w, side }); g += w + 0.4 + (rng() < 0.3 ? 7 : 0); } }
      groups(items, (it) => machiya(it.side, it.w));
    }

    // far away: Mt Fuji and a five-storey pagoda
    {
      const prof = []; for (let i = 0; i <= 24; i++) { const t = i / 24; prof.push(new THREE.Vector2(Math.max(0.02, (1 - t) ** 1.6) * 900, t * 420)); }
      const geo = new THREE.LatheGeometry(prof, 64), cols = [];
      const P = geo.attributes.position;
      for (let i = 0; i < P.count; i++) { const y = P.getY(i), snow = y > 300 + Math.sin(P.getX(i) * 0.05) * 30 ? 1 : 0; const c = snow ? [0.93, 0.95, 1] : [0.55, 0.62, 0.74]; cols.push(...c); }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      const fuji = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, transparent: true, opacity: 0.85 }));
      fuji.position.set(-1500, -20, -250); scene.add(fuji);
      const pg = kit.group(-260, 0, -(W / 2 + 60), 0.3, 1.6);
      for (let i = 0; i < 5; i++) {
        const s = 1 - i * 0.12;
        kit.box(5 * s, 2.6, 5 * s, 0xd8461f, 0, i * 3.4, 0, pg);
        const roof = kit.cone(5.4 * s, 1.1, black, 0, i * 3.4 + 2.5, 0, pg, {}, 4); roof.rotation.y = Math.PI / 4;
      }
      kit.cyl(0.12, 0.12, 6, 0xc9a24a, 0, 17, 0, pg, { metalness: 1, roughness: 0.3 });
    }

    // falling petals
    const petals = (() => {
      const N = 260, pos = new Float32Array(N * 3), vel = [];
      for (let i = 0; i < N; i++) { pos.set([-40 + rng() * (FRONT + 40), rng() * 9, (rng() - 0.5) * (W + 16)], i * 3); vel.push([rng() * 0.6 - 0.3, -0.35 - rng() * 0.4, rng() * 0.6 - 0.3, rng() * 6]); }
      const c = document.createElement('canvas'); c.width = c.height = 32;
      const g = c.getContext('2d'); g.fillStyle = '#ffd1e0'; g.beginPath(); g.ellipse(16, 16, 13, 8, 0.5, 0, 7); g.fill();
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: t, size: 0.16, transparent: true, alphaTest: 0.3, depthWrite: false }));
      scene.add(pts);
      return { pos, vel, geo, N };
    })();

    // ----- the obstacles -----
    const fur = (kind) => {
      const c = document.createElement('canvas'); c.width = 256; c.height = 128;
      const g = c.getContext('2d');
      const base = { calico: '#f3eee6', black: '#1c1a1d', ginger: '#d9822b', maneki: '#f7f4ee' }[kind];
      g.fillStyle = base; g.fillRect(0, 0, 256, 128);
      if (kind === 'calico') for (let i = 0; i < 9; i++) { g.fillStyle = i % 2 ? '#d07a2e' : '#2b2422'; g.beginPath(); g.ellipse(rng() * 256, rng() * 128, 20 + rng() * 30, 14 + rng() * 20, rng() * 3, 0, 7); g.fill(); }
      if (kind === 'ginger') { g.strokeStyle = '#a8551a'; g.lineWidth = 7; for (let x = 0; x < 256; x += 22) { g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + 10, 64, x - 4, 128); g.stroke(); } }
      for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${kind === 'black' ? '255,255,255' : '0,0,0'},0.05)`; g.fillRect(rng() * 256, rng() * 128, 1, 3); }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    };
    const furMats = Object.fromEntries(['calico', 'black', 'ginger', 'maneki'].map((k) => [k, new THREE.MeshPhysicalMaterial({ map: fur(k), roughness: k === 'maneki' ? 0.25 : 0.85, clearcoat: k === 'maneki' ? 1 : 0, sheen: k === 'maneki' ? 0 : 1, sheenRoughness: 0.6, sheenColor: new THREE.Color(k === 'black' ? 0x444444 : 0xffffff) })]));
    const eyeMat = new THREE.MeshPhysicalMaterial({ color: 0xc8d23a, roughness: 0.05, clearcoat: 1 }), pupil = new THREE.MeshBasicMaterial({ color: 0x050505 }), pink = new THREE.MeshStandardMaterial({ color: 0xf08a9a, roughness: 0.6 });
    const redMat = new THREE.MeshStandardMaterial({ color: 0xc8201c, roughness: 0.5 }), gold = new THREE.MeshStandardMaterial({ color: 0xe0b440, metalness: 1, roughness: 0.25 });
    const makeCat = (kind) => {
      const g = new THREE.Group(), m = furMats[kind];
      const add = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; g.add(o); return o; };
      add(new THREE.SphereGeometry(0.32, 20, 14), m, -0.05, 0.36, 0, 1.05, 1.15, 0.85); // body, sitting up
      const head = new THREE.Group(); head.position.set(0.1, 0.78, 0); g.add(head);
      const hm = new THREE.Mesh(new THREE.SphereGeometry(0.23, 20, 14), m); hm.scale.set(0.95, 0.88, 1.08); hm.castShadow = true; head.add(hm);
      for (const s of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.17, 4), m); ear.position.set(-0.02, 0.2, s * 0.12); ear.rotation.x = s * 0.35; head.add(ear);
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.048, 12, 10), eyeMat); eye.position.set(0.19, 0.03, s * 0.085); head.add(eye);
        const pp = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), pupil); pp.scale.set(0.5, 1.4, 0.35); pp.position.set(0.232, 0.03, s * 0.085); head.add(pp);
        add(new THREE.SphereGeometry(0.08, 10, 8), m, 0.22, 0.05, s * 0.1, 1.2, 0.6, 1); // front paws
        for (const dy of [-0.01, 0.03]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.26, 4), pupil); w.rotation.x = Math.PI / 2 + s * 0.2; w.rotation.z = dy * 4; w.position.set(0.2, -0.04 + dy, s * 0.13); head.add(w); }
      }
      const nose = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), pink); nose.position.set(0.225, -0.03, 0); head.add(nose);
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.3, 0.12, 0), new THREE.Vector3(-0.5, 0.18, 0.12), new THREE.Vector3(-0.5, 0.5, 0.2), new THREE.Vector3(-0.42, 0.7, 0.1)]);
      const tail = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.05, 8), m); tail.castShadow = true;
      const tailPivot = new THREE.Group(); tailPivot.position.set(-0.3, 0.12, 0); tail.position.set(0.3, -0.12, 0); tailPivot.add(tail); g.add(tailPivot);
      let paw = null;
      if (kind === 'maneki') {
        // the lucky waving cat: red collar, gold bell, one paw up
        const col = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.03, 8, 24), redMat); col.rotation.z = Math.PI / 2; col.rotation.y = Math.PI / 2; col.position.set(0.05, 0.62, 0); g.add(col);
        add(new THREE.SphereGeometry(0.05, 10, 8), gold, 0.2, 0.58, 0);
        paw = new THREE.Group(); paw.position.set(0.12, 0.55, 0.2); g.add(paw);
        const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.22, 4, 10), m); arm.position.y = 0.16; paw.add(arm);
      }
      g.userData.anim = (t) => { tailPivot.rotation.x = Math.sin(t * 2.4) * 0.35; head.rotation.x = Math.sin(t * 0.9) * 0.12; if (paw) paw.rotation.z = Math.sin(t * 6) * 0.5; };
      g.scale.setScalar(1.25);
      return g;
    };
    // a low torii across one lane: duck under the nuki
    const gateMat = vermilion.clone(); gateMat.color.setHex(0xe24a1c);
    const LT = torii(THREE, { span: 2.15, h: 2.05, r: 0.12, nukiY: 1.45 });
    const makeGate = () => {
      const g = new THREE.Group();
      for (const [geo, mat] of [[LT.red, gateMat], [LT.dark, black], [LT.ink, ink]]) { const m = new THREE.Mesh(geo, mat); m.castShadow = mat !== ink; g.add(m); }
      return g;
    };
    const CATS = ['calico', 'black', 'ginger', 'maneki'];
    const obstacles = []; // { g, type, cat, meshes: [] per lane }
    let nextG = 18;
    const spawn = (R, t) => {
      while (nextG < R + FRONT - 6) {
        const type = rng() < 0.5 ? 'cat' : 'gate';
        obstacles.push({ g: nextG, type, cat: CATS[Math.floor(rng() * CATS.length)], meshes: null });
        nextG += Math.max(6.5, 12 - t * 0.12) + rng() * 4.5;
      }
    };

    // ----- the runners -----
    const camX = 12 + W * 0.45, camY = 7 + W * 0.22;
    const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.3, 3000);
    const runners = players.map((p, i) => {
      const holder = new THREE.Group(); holder.rotation.y = Math.PI / 2; scene.add(holder); // dolls face the camera
      const doll = mg.makeDoll(p, { scale: DOLL });
      holder.add(doll.group);
      return { p, doll, holder, z: laneZ(i), d: 0, jt: 0, duck: 0, stun: 0, phase: rng() * 6, idx: 0, score: 0, hits: 0, squash: 1, out: false, gone: 0, bot: p.bot ? { skill: 0.8 + rng() * 0.14, plan: new Map() } : null };
    });
    const pops = []; // floating "MEOW!" / "BONK!" words
    const pop = (r, text, color) => {
      const c = document.createElement('canvas'); c.width = 256; c.height = 96;
      const g = c.getContext('2d'); g.font = '900 64px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 10; g.strokeStyle = '#1a0d08'; g.strokeText(text, 128, 50); g.fillStyle = color; g.fillText(text, 128, 50);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); s.scale.set(2.4, 0.9, 1); s.renderOrder = 20;
      scene.add(s); pops.push({ s, r, life: 0 });
    };
    const act = (r, what) => {
      if (r.stun > 0) return;
      if (what === 'jump' && r.jt === 0 && r.duck <= 0) { r.jt = 1e-4; if (!r.p.bot) mg.sfx.play('boing'); }
      if (what === 'duck' && r.jt === 0) { r.duck = DUCK_T; if (!r.p.bot) mg.sfx.play('squeak'); }
    };

    // the fog bank: layers of soft billowing sprites right across the path, sitting behind the pack
    const fogTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
      for (let i = 0; i < 9; i++) { const x = 20 + rng() * 88, y = 30 + rng() * 68, r = 24 + rng() * 26, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    const fogBank = [];
    for (let i = 0; i < 26; i++) {
      const m = new THREE.SpriteMaterial({ map: fogTex, transparent: true, depthWrite: false, fog: false, color: 0xf6eee8, opacity: 0.9 });
      const sp = new THREE.Sprite(m); const sz = 7 + rng() * 6; sp.scale.set(sz, sz * 0.75, 1); sp.renderOrder = 5; scene.add(sp);
      fogBank.push({ sp, z: (rng() - 0.5) * (W + 14), y: 0.8 + rng() * 3.5, dx: -rng() * 6, ph: rng() * 9 });
    }
    const fogGap = (t) => FOG_GAP[0] + (FOG_GAP[1] - FOG_GAP[0]) * Math.min(1, t / mg.duration);
    let R = 0, speed = 0;
    return {
      camera,
      update(dt, t, running) {
        // pace: starts at a jog and builds to a sprint
        const target = running ? 7 + 6 * Math.min(1, t / mg.duration) : 0;
        speed += (target - speed) * Math.min(1, dt * 2);
        if (running) spawn(R, t);
        let lead = R;
        for (const r of runners) {
          // stragglers run a little faster to get back in the pack
          if (r.out) { r.gone += dt; continue; }
          const v = speed * (r.stun > 0 ? STUN_SLOW : 1 + Math.min(0.3, Math.max(0, R - r.d) * 0.03));
          r.d += v * dt;
          lead = Math.max(lead, r.d);
          if (r.bot && running) {
            const o = obstacles[r.idx];
            if (o) {
              if (!r.bot.plan.has(o)) {
                const good = rng() < r.bot.skill;
                r.bot.plan.set(o, good ? { act: o.type === 'cat' ? 'jump' : 'duck', lead: 0.3 + (rng() - 0.5) * 0.14 } : rng() < 0.5 ? { act: o.type === 'cat' ? 'jump' : 'duck', lead: rng() < 0.5 ? 0.62 : 0.04 } : { act: null, lead: 0 });
              }
              const plan = r.bot.plan.get(o);
              if (plan.act && !plan.done && (o.g - r.d) / Math.max(1, v) < plan.lead) { plan.done = true; act(r, plan.act); }
            }
          }
          // timers
          if (r.jt > 0) { r.jt += dt; if (r.jt >= JUMP_T) { r.jt = 0; r.doll.bounce(1.1); } }
          if (r.duck > 0) { r.duck -= dt; if (r.duck <= 0) r.doll.bounce(0.7); }
          if (r.stun > 0) r.stun -= dt;
          // obstacles reaching this runner
          while (obstacles[r.idx] && obstacles[r.idx].g <= r.d) {
            const o = obstacles[r.idx++];
            if (r.stun > 0) continue;
            const y = r.jt > 0 ? JUMP_H * 4 * (r.jt / JUMP_T) * (1 - r.jt / JUMP_T) : 0;
            const ok = o.type === 'cat' ? y > CAT_CLEAR : r.duck > 0;
            if (ok) r.score += 1;
            else {
              r.hits += 1; r.stun = STUN_T; r.jt = 0; r.duck = 0;
              r.doll.flinch();
              pop(r, o.type === 'cat' ? 'MEOW!' : 'BONK!', o.type === 'cat' ? '#ffd23f' : '#ff6a4a');
              mg.sfx.play(o.type === 'cat' ? 'meow' : 'bonk');
            }
          }
        }
        R = lead;
        // swallowed by the fog?
        if (running) for (const r of runners) if (!r.out && R - r.d > fogGap(t)) {
          r.out = true; r.stun = 0; pop(r, 'LOST IN THE FOG', '#c8c8d8'); mg.sfx.play('deflate');
        }
        { const fx = -fogGap(t) - OFF - 1.5;
          for (const f of fogBank) { f.sp.position.set(fx + f.dx + Math.sin(t * 0.4 + f.ph) * 0.8, f.y + Math.sin(t * 0.6 + f.ph) * 0.2, f.z + Math.cos(t * 0.3 + f.ph) * 0.6); } }

        // place the runners
        for (const r of runners) {
          r.phase += dt * (6 + speed * 0.9);
          const p = r.jt > 0 ? r.jt / JUMP_T : 0;
          let y = r.jt > 0 ? JUMP_H * 4 * p * (1 - p) : speed > 0.5 && r.duck <= 0 && r.stun <= 0 ? Math.abs(Math.sin(r.phase)) * 0.22 : 0;
          const tumble = r.stun > 0 ? Math.sin((1 - r.stun / STUN_T) * Math.PI) : 0;
          y += tumble * 0.9;
          r.holder.position.set(Math.max(-40, r.d - R) - OFF - (r.out ? r.gone * 6 : 0), y, r.z);
          r.holder.visible = !r.out || r.gone < 1.5;
          r.doll.group.rotation.x = r.stun > 0 ? -tumble * 1.3 : Math.min(0.25, speed * 0.02); // lean into the run, or flail backwards
          r.squash += ((r.duck > 0 ? 0.45 : 1) - r.squash) * Math.min(1, dt * 18);
          r.doll.body.scale.set(1 / Math.sqrt(r.squash), r.squash, 1 / Math.sqrt(r.squash));
          r.doll.update(dt);
        }

        // obstacles: one copy per lane, made when they come into view, dropped once everyone's past
        const tail = Math.min(...runners.filter((r) => !r.out).map((r) => r.d).concat([R]));
        for (let i = obstacles.length - 1; i >= 0; i--) {
          const o = obstacles[i];
          if (!o.meshes) o.meshes = runners.map((r) => { const m = o.type === 'cat' ? makeCat(o.cat) : makeGate(); m.position.z = r.z; scene.add(m); return m; });
          for (const m of o.meshes) { m.position.x = o.g - R - OFF; m.userData.anim?.(t + o.g); }
          if (o.g < tail - 6) { for (const m of o.meshes) scene.remove(m); obstacles.splice(i, 1); for (const r of runners) r.idx = Math.max(0, r.idx - 1); }
        }

        for (const f of scrollers) f(R);
        for (const f of loops) f(R);
        // petals drift down and stream past
        const P = petals.pos;
        for (let i = 0; i < petals.N; i++) {
          const v = petals.vel[i];
          P[i * 3] += (v[0] - speed * 0.95) * dt + Math.sin(t * 1.3 + v[3]) * 0.01;
          P[i * 3 + 1] += v[1] * dt;
          P[i * 3 + 2] += v[2] * dt + Math.cos(t + v[3]) * 0.006;
          if (P[i * 3 + 1] < 0 || P[i * 3] < -40) { P[i * 3] = -40 + rng() * (FRONT + 40); P[i * 3 + 1] = 6 + rng() * 4; }
        }
        petals.geo.attributes.position.needsUpdate = true;
        for (let i = pops.length - 1; i >= 0; i--) {
          const q = pops[i]; q.life += dt;
          q.s.position.set(q.r.holder.position.x, 3.2 + q.life * 1.5, q.r.z);
          q.s.material.opacity = 1 - Math.max(0, q.life - 0.6) / 0.4;
          if (q.life > 1) { scene.remove(q.s); pops.splice(i, 1); }
        }
        camera.position.set(camX, camY + Math.sin(t * 0.7) * 0.15, Math.sin(t * 0.4) * 0.6);
        camera.lookAt(-9, 0.6, 0);
      },
      input(p, m) { const r = runners.find((x) => x.p === p); if (r && (m.b === 'jump' || m.b === 'duck')) act(r, m.b); },
      scores() { return Object.fromEntries(runners.map((r) => [r.p.id, r.score + (r.out ? 0 : 5)])); },
      done: () => runners.every((r) => r.out),
    };
  },
};
