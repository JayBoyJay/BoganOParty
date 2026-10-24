// Like My Post: everyone's got Bogangram open on a phone up on the TV, and everyone scrolls the same
// feed of 20 posts. Some of the photos have another player's face pasted on one of the people in them
// (their own photo if they sent one, otherwise their doll face). LIKE a post with a mate in it for a
// point. Like a stranger's post, or your own face, and you lose one. SKIP costs nothing. Twenty scrolls
// each, so make them count.
import { faceCanvas } from '../../host/doll.js';

const POSTS = 20;
const CW = 432, CH = 864; // the phone screen canvas
const IMG = 432; // post photos are square
const TOP = 96, PH = 64 + IMG + 52 + 64; // where the feed starts, and the height of one post
const SCROLL_T = 0.32;

const HANDLES = ['bazza_from_bunnings', 'shazza.lifts', 'kev_n_the_ute', 'tradie_tom', 'sheila_sells_houses', 'gazza_fishes', 'dazza.does.darts', 'nan_of_narrabri', 'big_trev_74', 'chook_raffle_queen', 'mullet_mick', 'thongs_n_things', 'roo_wrangler', 'bogan_bev', 'servo_steve', 'cazza_on_tour', 'pie_floater', 'ute_muster_99', 'snag_king', 'boxhead_bill'];
const SKINS = ['#f2c9a8', '#e0ac85', '#c68863', '#9a6646', '#6e4430', '#f6d6c0', '#d89c74'];
const HAIRS = ['#2a1a10', '#5a3a1a', '#c89a4a', '#e8d080', '#8a2a10', '#1a1a1a', '#9a9a9a'];
const SHIRTS = ['#1e5aa8', '#d83a2a', '#2a8a4a', '#f0c020', '#ffffff', '#2a2a2a', '#ff7a2a', '#7a3ab0', '#3ab0c0'];

// ---------- drawing the photos ----------
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
const sky = (g, a, b, to = IMG) => { const gr = g.createLinearGradient(0, 0, 0, to); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, IMG, to); };

// a stranger's face, drawn in a different style from the doll faces
function strangerFace(rng) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const skin = SKINS[(rng() * SKINS.length) | 0], hair = HAIRS[(rng() * HAIRS.length) | 0], style = (rng() * 5) | 0;
  g.fillStyle = skin; g.fillRect(0, 0, 128, 128);
  g.fillStyle = hair;
  if (style === 0) { g.beginPath(); g.ellipse(64, 18, 62, 34, 0, 0, Math.PI * 2); g.fill(); } // short back and sides
  if (style === 1) { g.fillRect(0, 0, 128, 30); g.fillRect(0, 0, 20, 128); g.fillRect(108, 0, 20, 128); } // long
  if (style === 2) { g.fillRect(0, 0, 128, 24); g.fillRect(0, 60, 14, 68); g.fillRect(114, 60, 14, 68); } // mullet
  if (style === 3) { g.fillStyle = SHIRTS[(rng() * SHIRTS.length) | 0]; g.fillRect(0, 0, 128, 30); g.fillRect(20, 26, 108, 10); } // a cap
  // eyes, or sunnies
  if (rng() < 0.3) { g.fillStyle = '#111'; rr(g, 22, 48, 36, 20, 8); g.fill(); rr(g, 70, 48, 36, 20, 8); g.fill(); g.fillRect(56, 54, 16, 4); }
  else { g.fillStyle = '#1a1a1a'; g.beginPath(); g.arc(44, 58, 6, 0, 7); g.arc(84, 58, 6, 0, 7); g.fill(); g.strokeStyle = hair; g.lineWidth = 4; g.beginPath(); g.moveTo(34, 44); g.lineTo(54, 42); g.moveTo(74, 42); g.lineTo(94, 44); g.stroke(); }
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 3; g.beginPath(); g.moveTo(64, 62); g.lineTo(60, 80); g.lineTo(66, 80); g.stroke(); // nose
  if (rng() < 0.3) { g.fillStyle = hair; g.beginPath(); g.moveTo(14, 70); g.quadraticCurveTo(64, 140, 114, 70); g.lineTo(114, 128); g.lineTo(14, 128); g.fill(); } // a beard
  g.strokeStyle = '#7a2a2a'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.arc(64, 82, 18, 0.2, Math.PI - 0.2); g.stroke(); // a grin
  return c;
}

// a person in a photo: head centred at (x, y) with radius r, wearing a shirt, posing
function person(g, x, y, r, face, look) {
  const { shirt, skin, pose } = look;
  g.save();
  g.lineCap = 'round';
  // arms behind the body for some poses
  const arm = (ax, ay, bx, by) => { g.strokeStyle = shirt; g.lineWidth = r * 0.62; g.beginPath(); g.moveTo(ax, ay); g.lineTo((ax + bx) / 2, (ay + by) / 2); g.stroke(); g.strokeStyle = skin; g.lineWidth = r * 0.5; g.beginPath(); g.moveTo((ax + bx) / 2, (ay + by) / 2); g.lineTo(bx, by); g.stroke(); g.fillStyle = skin; g.beginPath(); g.arc(bx, by, r * 0.3, 0, 7); g.fill(); };
  const sh = y + r * 1.35;
  if (pose === 'flex') { arm(x - r * 1.1, sh + r * 0.3, x - r * 2.1, y - r * 0.2); arm(x + r * 1.1, sh + r * 0.3, x + r * 2.1, y - r * 0.2); }
  if (pose === 'wave') arm(x + r * 1.1, sh + r * 0.3, x + r * 1.9, y - r * 0.9);
  // the body
  g.fillStyle = shirt; rr(g, x - r * 1.25, sh, r * 2.5, r * 3.6, r * 0.6); g.fill();
  g.fillStyle = skin; g.fillRect(x - r * 0.3, y + r * 0.7, r * 0.6, r * 0.75);
  if (pose === 'hold' || pose === 'wave' || !pose) arm(x - r * 1.1, sh + r * 0.3, x - r * 0.7, sh + r * 1.9);
  if (pose === 'hold') arm(x + r * 1.1, sh + r * 0.3, x + r * 1.5, sh + r * 1.2);
  // the head: whatever face this person's got, clipped round
  g.save(); g.beginPath(); g.ellipse(x, y, r, r * 1.08, 0, 0, Math.PI * 2); g.clip();
  g.drawImage(face, x - r * 1.06, y - r * 1.14, r * 2.12, r * 2.28);
  g.restore();
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y, r, r * 1.08, 0, 0, Math.PI * 2); g.stroke();
  g.restore();
}

// each scene: a background, where its people stand, a prop or two, and some captions
const SCENES = [
  { id: 'beach', spots: [[0.38, 0.42, 0.13], [0.66, 0.46, 0.12]], poses: ['wave', 'hold'], caps: ['Beach day 🏖️ no worries', 'Bondi was packed lol', 'Salt water therapy 🌊'],
    bg(g, rng) { sky(g, '#5ab8f0', '#c8ecff', IMG * 0.5); g.fillStyle = '#ffe680'; g.beginPath(); g.arc(IMG * 0.82, IMG * 0.14, 34, 0, 7); g.fill(); g.fillStyle = '#1e7ab8'; g.fillRect(0, IMG * 0.42, IMG, IMG * 0.2); g.fillStyle = '#ffffff'; for (let i = 0; i < 6; i++) g.fillRect(rng() * IMG, IMG * (0.44 + rng() * 0.14), 40, 3); g.fillStyle = '#f0d898'; g.fillRect(0, IMG * 0.6, IMG, IMG * 0.4); g.fillStyle = '#e83a3a'; g.beginPath(); g.moveTo(40, IMG * 0.62); g.lineTo(110, IMG * 0.5); g.lineTo(130, IMG * 0.62); g.fill(); } },
  { id: 'bbq', spots: [[0.4, 0.38, 0.13]], poses: ['hold'], caps: ['Snags are ON 🌭', 'Sunday arvo barbie 🔥', 'Who wants a sanga?'],
    bg(g) { sky(g, '#88c8f0', '#d8f0ff', IMG * 0.45); g.fillStyle = '#9a6a3a'; for (let x = 0; x < IMG; x += 30) g.fillRect(x, IMG * 0.2, 27, IMG * 0.32); g.fillStyle = '#5a9a3a'; g.fillRect(0, IMG * 0.52, IMG, IMG); },
    fg(g) { g.fillStyle = '#2a2a2a'; g.fillRect(IMG * 0.55, IMG * 0.62, IMG * 0.4, IMG * 0.1); g.fillRect(IMG * 0.58, IMG * 0.72, 10, IMG * 0.28); g.fillRect(IMG * 0.9, IMG * 0.72, 10, IMG * 0.28); g.fillStyle = '#b8562a'; for (let i = 0; i < 5; i++) { rr(g, IMG * 0.58 + i * 30, IMG * 0.6, 24, 12, 6); g.fill(); } g.fillStyle = 'rgba(200,200,200,0.5)'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(IMG * (0.65 + i * 0.07), IMG * (0.5 - i * 0.05), 18 + i * 4, 0, 7); g.fill(); } } },
  { id: 'gym', spots: [[0.5, 0.36, 0.13]], poses: ['flex'], caps: ['Leg day? never heard of it 💪', 'Gains szn', 'Back yard gym hits different'],
    bg(g) { g.fillStyle = '#3a3a44'; g.fillRect(0, 0, IMG, IMG); g.fillStyle = '#8aa0b0'; g.fillRect(20, 20, IMG - 40, IMG * 0.7); g.fillStyle = '#6a8090'; g.fillRect(30, 30, IMG - 60, IMG * 0.68); g.fillStyle = '#222'; for (let i = 0; i < 6; i++) { g.fillRect(40 + i * 62, IMG * 0.82, 40, 14); g.beginPath(); g.arc(40 + i * 62, IMG * 0.82 + 7, 14, 0, 7); g.arc(80 + i * 62, IMG * 0.82 + 7, 14, 0, 7); g.fill(); } } },
  { id: 'footy', spots: [[0.35, 0.42, 0.12], [0.65, 0.42, 0.12]], poses: ['wave', 'hold'], caps: ['GO THE PIES 🏉', 'Grand final day!!', 'What a game 🏆'],
    bg(g, rng) { g.fillStyle = '#2a3a5a'; g.fillRect(0, 0, IMG, IMG * 0.5); for (let i = 0; i < 500; i++) { g.fillStyle = ['#fff', '#000', '#d83a2a', '#1e5aa8', '#f0c020'][(rng() * 5) | 0]; g.fillRect(rng() * IMG, rng() * IMG * 0.48, 4, 4); } g.fillStyle = '#3aa04a'; g.fillRect(0, IMG * 0.5, IMG, IMG * 0.5); g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath(); g.ellipse(IMG / 2, IMG * 0.75, IMG * 0.6, IMG * 0.2, 0, 0, 7); g.stroke(); } },
  { id: 'pub', spots: [[0.33, 0.4, 0.12], [0.67, 0.4, 0.12]], poses: ['hold', 'hold'], caps: ['Cheers big ears 🍻', 'Just the one (it was not the one)', 'Schooner o\'clock'],
    bg(g) { g.fillStyle = '#8a3a2a'; g.fillRect(0, 0, IMG, IMG); g.strokeStyle = '#6a2a1a'; g.lineWidth = 3; for (let y = 0; y < IMG; y += 24) { g.beginPath(); g.moveTo(0, y); g.lineTo(IMG, y); g.stroke(); for (let x = (y / 24) % 2 ? 0 : 30; x < IMG; x += 60) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 24); g.stroke(); } } g.fillStyle = '#ff5a2a'; g.font = '700 40px "Brush Script MT", cursive'; g.textAlign = 'center'; g.fillText('Bogan Arms', IMG / 2, 60); g.fillStyle = '#4a2412'; g.fillRect(0, IMG * 0.78, IMG, IMG); },
    fg(g) { for (const x of [0.46, 0.54]) { g.fillStyle = '#e09a2a'; g.fillRect(IMG * x - 14, IMG * 0.6, 28, 48); g.fillStyle = '#fff8e8'; g.fillRect(IMG * x - 14, IMG * 0.6 - 8, 28, 10); } } },
  { id: 'fishing', spots: [[0.42, 0.4, 0.13]], poses: ['hold'], caps: ['Caught a whopper 🎣', 'Dinner sorted', 'The one that DIDN\'T get away'],
    bg(g) { sky(g, '#f0a060', '#ffe0b0', IMG * 0.5); g.fillStyle = '#2a6a9a'; g.fillRect(0, IMG * 0.5, IMG, IMG * 0.5); g.fillStyle = '#7a5a3a'; for (let x = 0; x < IMG; x += 40) g.fillRect(x, IMG * 0.72, 36, IMG); },
    fg(g) { g.fillStyle = '#9ab0b8'; g.beginPath(); g.ellipse(IMG * 0.68, IMG * 0.62, 60, 22, -0.3, 0, 7); g.fill(); g.beginPath(); g.moveTo(IMG * 0.8, IMG * 0.56); g.lineTo(IMG * 0.88, IMG * 0.5); g.lineTo(IMG * 0.86, IMG * 0.64); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.arc(IMG * 0.58, IMG * 0.64, 4, 0, 7); g.fill(); } },
  { id: 'party', spots: [[0.25, 0.42, 0.11], [0.5, 0.38, 0.11], [0.75, 0.42, 0.11]], poses: ['wave', null, 'wave'], caps: ['Happy 40th Daz 🎉', 'Big night!!!', 'Cake was mid tbh'],
    bg(g, rng) { g.fillStyle = '#f0e0c8'; g.fillRect(0, 0, IMG, IMG); for (let i = 0; i < 9; i++) { g.fillStyle = ['#ff4f8b', '#3da5ff', '#ffd23f', '#5cff9d'][i % 4]; g.beginPath(); g.ellipse(20 + i * 50, 40 + rng() * 30, 20, 26, 0, 0, 7); g.fill(); } g.fillStyle = '#d83a2a'; g.font = '900 30px system-ui'; g.textAlign = 'center'; g.fillText('HAPPY BIRTHDAY', IMG / 2, 120); g.fillStyle = '#c8b090'; g.fillRect(0, IMG * 0.8, IMG, IMG); },
    fg(g) { g.fillStyle = '#ffffff'; g.fillRect(IMG * 0.38, IMG * 0.78, IMG * 0.24, 50); g.fillStyle = '#ff7ab0'; g.fillRect(IMG * 0.38, IMG * 0.78, IMG * 0.24, 12); g.fillStyle = '#ffd23f'; for (let i = 0; i < 4; i++) g.fillRect(IMG * 0.41 + i * 22, IMG * 0.74, 5, 16); } },
  { id: 'ute', spots: [[0.3, 0.42, 0.12]], poses: ['wave'], caps: ['New ute who dis 🛻', 'Out bush this weekend', 'Red dirt therapy'],
    bg(g) { sky(g, '#4aa0e0', '#bfe4ff', IMG * 0.55); g.fillStyle = '#b8542a'; g.fillRect(0, IMG * 0.55, IMG, IMG); g.fillStyle = '#5a7a3a'; for (let i = 0; i < 7; i++) { g.beginPath(); g.arc(30 + i * 70, IMG * 0.55, 18, Math.PI, 0); g.fill(); } },
    fg(g) { g.fillStyle = '#e8e8e8'; rr(g, IMG * 0.45, IMG * 0.56, IMG * 0.52, IMG * 0.18, 12); g.fill(); rr(g, IMG * 0.48, IMG * 0.46, IMG * 0.22, IMG * 0.14, 10); g.fill(); g.fillStyle = '#6ab0e0'; g.fillRect(IMG * 0.51, IMG * 0.48, IMG * 0.16, IMG * 0.08); g.fillStyle = '#1a1a1a'; g.beginPath(); g.arc(IMG * 0.56, IMG * 0.75, 26, 0, 7); g.arc(IMG * 0.88, IMG * 0.75, 26, 0, 7); g.fill(); } },
  { id: 'roo', spots: [[0.36, 0.42, 0.12]], poses: ['wave'], caps: ['Made a mate 🦘', 'He wanted to box', 'Skippy says g\'day'],
    bg(g) { sky(g, '#f0c890', '#fff0d8', IMG * 0.55); g.fillStyle = '#c87a3a'; g.fillRect(0, IMG * 0.55, IMG, IMG); g.fillStyle = '#a8502a'; g.beginPath(); g.ellipse(IMG * 0.15, IMG * 0.55, 90, 30, 0, Math.PI, 0); g.fill(); },
    fg(g) { g.fillStyle = '#9a6a3a'; g.beginPath(); g.ellipse(IMG * 0.74, IMG * 0.62, 34, 70, 0.15, 0, 7); g.fill(); g.beginPath(); g.ellipse(IMG * 0.7, IMG * 0.42, 18, 26, -0.2, 0, 7); g.fill(); g.beginPath(); g.ellipse(IMG * 0.66, IMG * 0.33, 6, 18, -0.3, 0, 7); g.ellipse(IMG * 0.73, IMG * 0.33, 6, 18, 0.2, 0, 7); g.fill(); g.beginPath(); g.moveTo(IMG * 0.78, IMG * 0.8); g.quadraticCurveTo(IMG * 0.98, IMG * 0.9, IMG, IMG * 0.82); g.lineWidth = 14; g.strokeStyle = '#9a6a3a'; g.stroke(); g.fillStyle = '#111'; g.beginPath(); g.arc(IMG * 0.69, IMG * 0.41, 3, 0, 7); g.fill(); } },
  { id: 'couch', spots: [[0.25, 0.4, 0.1], [0.5, 0.38, 0.1], [0.75, 0.4, 0.1]], poses: [null, 'wave', null], caps: ['Footy night with the boys 📺', 'Squad 💯', 'Movie marathon'],
    bg(g) { g.fillStyle = '#d8c8a0'; g.fillRect(0, 0, IMG, IMG); g.fillStyle = '#3a2a1a'; g.fillRect(IMG * 0.7, 30, 100, 70); g.fillStyle = '#8a5a2a'; g.fillRect(0, IMG * 0.85, IMG, IMG); },
    fg(g) { g.fillStyle = '#6a3a2a'; rr(g, 10, IMG * 0.64, IMG - 20, IMG * 0.3, 20); g.fill(); g.fillStyle = '#8a4a3a'; for (let i = 0; i < 3; i++) { rr(g, 24 + i * 134, IMG * 0.68, 124, 50, 12); g.fill(); } } },
];
// posts with nobody in them
const EMPTY = [
  { caps: ['Brekky of champions 🥧', 'Servo pie appreciation post'], draw(g) { g.fillStyle = '#6a4a2a'; g.fillRect(0, 0, IMG, IMG); g.fillStyle = '#f0f0f0'; g.beginPath(); g.ellipse(IMG / 2, IMG / 2, 170, 120, 0, 0, 7); g.fill(); g.fillStyle = '#d8962a'; g.beginPath(); g.ellipse(IMG / 2, IMG / 2, 110, 76, 0, 0, 7); g.fill(); g.strokeStyle = '#c8202a'; g.lineWidth = 10; g.lineCap = 'round'; g.beginPath(); g.moveTo(IMG * 0.35, IMG * 0.47); g.bezierCurveTo(IMG * 0.45, IMG * 0.4, IMG * 0.5, IMG * 0.6, IMG * 0.65, IMG * 0.5); g.stroke(); } },
  { caps: ['Uluru at sunset 😍', 'No filter needed'], draw(g) { sky(g, '#f06a3a', '#ffd080'); g.fillStyle = '#b8402a'; g.beginPath(); g.moveTo(40, IMG * 0.7); g.quadraticCurveTo(80, IMG * 0.42, IMG * 0.5, IMG * 0.44); g.quadraticCurveTo(IMG * 0.85, IMG * 0.44, IMG - 30, IMG * 0.7); g.fill(); g.fillStyle = '#c8702a'; g.fillRect(0, IMG * 0.7, IMG, IMG); } },
  { caps: ['Who\'s a good boy 🐶', 'Rex turned 5 today'], draw(g) { g.fillStyle = '#7aa04a'; g.fillRect(0, 0, IMG, IMG); g.fillStyle = '#c89050'; g.beginPath(); g.ellipse(IMG / 2, IMG * 0.55, 120, 110, 0, 0, 7); g.fill(); g.fillStyle = '#8a5a2a'; g.beginPath(); g.ellipse(IMG * 0.3, IMG * 0.42, 40, 80, 0.4, 0, 7); g.ellipse(IMG * 0.7, IMG * 0.42, 40, 80, -0.4, 0, 7); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.arc(IMG * 0.42, IMG * 0.5, 10, 0, 7); g.arc(IMG * 0.58, IMG * 0.5, 10, 0, 7); g.ellipse(IMG / 2, IMG * 0.62, 22, 16, 0, 0, 7); g.fill(); g.fillStyle = '#e85a7a'; g.beginPath(); g.ellipse(IMG / 2, IMG * 0.72, 14, 20, 0, 0, 7); g.fill(); } },
];

export default {
  id: 'like-my-post',
  name: 'Like My Post',
  blurb: 'Scroll Bogangram. Like the posts with your mates in them. 20 scrolls each.',
  howTo: 'Everyone scrolls the same feed on the TV. LIKE a post with another player\'s face in it for a point. Liking a stranger\'s post, or a post with your own face, loses a point. SKIP is free. You only get 20 scrolls, so look before you like.',
  padText: 'LIKE the posts with a mate in them',
  duration: 50,
  pad: { kind: 'buttons', buttons: [{ id: 'skip', label: '⏭ SKIP', color: '#c8ccd4', tall: true }, { id: 'like', label: '❤️ LIKE', color: '#ff5a7a', tall: true }] },

  create(mg) {
    const { THREE, kit, scene, players, rng, sfx } = mg;
    const n = players.length;

    // ----- the faces -----
    // each player's face (their photo once it loads, the doll face till then), and a crowd of strangers
    const faces = new Map();
    const strangers = Array.from({ length: 24 }, () => strangerFace(rng));
    let si = 0;
    const stranger = () => strangers[si++ % strangers.length];

    // ----- the feed: the same 20 posts for everyone, a good share with a player's face in them -----
    const posts = [];
    const pIds = players.map((p) => p.id);
    for (let i = 0; i < POSTS; i++) {
      const roll = rng();
      const post = { handle: HANDLES[(rng() * HANDLES.length) | 0], likes: 3 + ((rng() * 400) | 0), mins: 1 + ((rng() * 59) | 0), people: [], players: [] };
      if (roll < 0.12) { const e = EMPTY[(rng() * EMPTY.length) | 0]; post.empty = e; post.cap = e.caps[(rng() * e.caps.length) | 0]; }
      else {
        const sc = SCENES[(rng() * SCENES.length) | 0]; post.scene = sc; post.cap = sc.caps[(rng() * sc.caps.length) | 0];
        const withMate = roll < 0.62;
        const mateSpot = withMate ? (rng() * sc.spots.length) | 0 : -1;
        sc.spots.forEach((s, k) => {
          const look = { shirt: SHIRTS[(rng() * SHIRTS.length) | 0], skin: SKINS[(rng() * SKINS.length) | 0], pose: sc.poses[k] };
          if (k === mateSpot) { const pid = pIds[(rng() * n) | 0]; post.people.push({ pid, look }); post.players.push(pid); }
          else post.people.push({ face: stranger(), look });
        });
      }
      posts.push(post);
    }
    const drawPost = (post) => {
      const c = post.canvas || (post.canvas = Object.assign(document.createElement('canvas'), { width: IMG, height: IMG }));
      const g = c.getContext('2d');
      const prng = (() => { let a = (posts.indexOf(post) + 1) * 9973; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })();
      if (post.empty) { post.empty.draw(g, prng); return; }
      post.scene.bg(g, prng);
      post.scene.spots.forEach(([x, y, r], k) => {
        const who = post.people[k];
        const face = who.pid ? faces.get(who.pid) : who.face;
        person(g, x * IMG, y * IMG, r * IMG, face, { ...who.look, skin: who.pid ? who.look.skin : who.look.skin });
      });
      post.scene.fg?.(g, prng);
      // a touch of filter, like everyone uses
      g.fillStyle = 'rgba(255,200,140,0.08)'; g.fillRect(0, 0, IMG, IMG);
    };
    for (const p of players) faces.set(p.id, faceCanvas(p, 'happy', () => { for (const post of posts) if (post.players.includes(p.id)) drawPost(post); phones.forEach((P) => { P.dirty = true; }); }));
    posts.forEach(drawPost);

    // ----- the room: a gradient wall with every player's phone on it -----
    scene.background = new THREE.Color(0x1a0d1e);
    const bgC = document.createElement('canvas'); bgC.width = 16; bgC.height = 256;
    { const g = bgC.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#5a2a8a'); gr.addColorStop(0.55, '#c8406a'); gr.addColorStop(1, '#f0904a'); g.fillStyle = gr; g.fillRect(0, 0, 16, 256); }
    const bgT = new THREE.CanvasTexture(bgC); bgT.colorSpace = THREE.SRGBColorSpace;
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), new THREE.MeshBasicMaterial({ map: bgT })); wall.position.z = -3; scene.add(wall);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a6a9a, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(-4, 6, 10); scene.add(key);
    {
      const pm = new THREE.PMREMGenerator(mg.renderer), env = new THREE.Scene();
      env.add(new THREE.Mesh(new THREE.BoxGeometry(40, 20, 40), new THREE.MeshBasicMaterial({ color: 0x6a4a7a, side: THREE.BackSide })));
      const l = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), new THREE.MeshBasicMaterial({ color: 0xffffff })); l.position.set(0, 6, 19); l.rotation.y = Math.PI; env.add(l);
      scene.environment = pm.fromScene(env, 0.04).texture; pm.dispose();
    }

    const rows = n > 4 ? 2 : 1, perRow = Math.ceil(n / rows);
    const PW = 2.3, PHt = 4.6, GAPX = 0.7, GAPY = 0.95;
    const phoneShape = (w, h, r) => { const s = []; const seg = 6; const corner = (cx, cy, a0) => { for (let i = 0; i <= seg; i++) { const a = a0 + (i / seg) * Math.PI / 2; s.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } }; corner(w / 2 - r, h / 2 - r, 0); corner(-w / 2 + r, h / 2 - r, Math.PI / 2); corner(-w / 2 + r, -h / 2 + r, Math.PI); corner(w / 2 - r, -h / 2 + r, Math.PI * 1.5); return s; };
    const caseOutline = phoneShape(PW, PHt, 0.26);
    const pops = [];
    const pop = (P, text, color) => {
      const c = document.createElement('canvas'); c.width = 512; c.height = 128;
      const g = c.getContext('2d'); g.font = '900 64px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 12; g.strokeStyle = '#1a0d08'; g.strokeText(text, 256, 66, 496); g.fillStyle = color; g.fillText(text, 256, 66, 496);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); sp.scale.set(2.6, 0.65, 1); sp.renderOrder = 20;
      sp.position.set(P.x, P.y - 0.2, 0.6); scene.add(sp); pops.push({ sp, life: 0 });
    };

    const phones = players.map((p, i) => {
      const row = rows === 2 && i >= perRow ? 1 : 0, k = row ? i - perRow : i, inRow = row ? n - perRow : perRow;
      const x = (k - (inRow - 1) / 2) * (PW + GAPX), y = rows === 2 ? (row ? -(PHt + GAPY) / 2 : (PHt + GAPY) / 2) : 0.25;
      const g = kit.group(x, y, 0);
      const body = kit.extrude(caseOutline, 0.16, p.color, g, { roughness: 0.35, metalness: 0.1 }, 0.03); body.position.z = -0.08;
      const bezel = kit.extrude(phoneShape(PW - 0.12, PHt - 0.12, 0.2), 0.02, 0x0a0a0c, g, { roughness: 0.15 }); bezel.position.z = 0.125;
      const c = document.createElement('canvas'); c.width = CW; c.height = CH;
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      const sw = PW - 0.24, shh = sw * CH / CW;
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(sw, shh), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); screen.position.set(0, 0, 0.14); g.add(screen);
      // a name tag under the phone, with the face to look for
      const tagC = document.createElement('canvas'); tagC.width = 512; tagC.height = 112;
      const tagT = new THREE.CanvasTexture(tagC); tagT.colorSpace = THREE.SRGBColorSpace;
      const drawTag = () => {
        const tg = tagC.getContext('2d'); tg.clearRect(0, 0, 512, 112);
        tg.fillStyle = 'rgba(20,10,24,0.85)'; rr(tg, 4, 4, 504, 104, 52); tg.fill(); tg.strokeStyle = p.color; tg.lineWidth = 8; rr(tg, 4, 4, 504, 104, 52); tg.stroke();
        tg.save(); tg.beginPath(); tg.arc(58, 56, 42, 0, 7); tg.clip(); tg.drawImage(faces.get(p.id), 16, 14, 84, 84); tg.restore();
        tg.fillStyle = '#fff'; tg.font = '900 60px system-ui, sans-serif'; tg.textBaseline = 'middle'; tg.fillText(p.name, 116, 60, 380);
        tagT.needsUpdate = true;
      };
      drawTag();
      const tag = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.42), new THREE.MeshBasicMaterial({ map: tagT, transparent: true, toneMapped: false }));
      tag.position.set(0, -PHt / 2 - 0.36, 0.1); g.add(tag);
      return { p, x, y, g, c, tex, drawTag, idx: 0, scroll: 0, anim: 0, score: 0, mates: 0, wrong: 0, liked: new Set(), heart: 0, verdict: null, vt: 0, dirty: true, doneAt: null,
        bot: p.bot ? { wait: 1 + rng() * 1.2, sharp: 0.78 + rng() * 0.17 } : null };
    });
    for (const P of phones) faces.get(P.p.id) && P.drawTag();

    // ----- drawing a phone screen -----
    const drawPostBlock = (g, post, y, liked) => {
      g.fillStyle = '#fff'; g.fillRect(0, y, CW, PH);
      // header: avatar ring and handle
      g.fillStyle = '#e0408a'; g.beginPath(); g.arc(34, y + 32, 22, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(34, y + 32, 19, 0, 7); g.fill();
      g.fillStyle = '#c8b8d8'; g.beginPath(); g.arc(34, y + 32, 16, 0, 7); g.fill();
      g.fillStyle = '#111'; g.font = '700 21px system-ui, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(post.handle, 66, y + 26, 300);
      g.fillStyle = '#888'; g.font = '400 16px system-ui, sans-serif'; g.fillText(`${post.mins}m`, 66, y + 46);
      g.fillStyle = '#111'; g.font = '900 26px system-ui'; g.fillText('···', CW - 52, y + 30);
      g.drawImage(post.canvas, 0, y + 64, CW, IMG);
      // actions
      const ay = y + 64 + IMG + 26;
      heart(g, 30, ay, 15, liked ? '#ff2a5a' : null);
      g.strokeStyle = '#111'; g.lineWidth = 3; g.beginPath(); g.arc(80, ay, 13, 0.6, Math.PI * 2 + 0.3); g.stroke();
      g.beginPath(); g.moveTo(112, ay - 12); g.lineTo(140, ay); g.lineTo(112, ay + 12); g.closePath(); g.stroke();
      g.fillStyle = '#111'; g.font = '700 18px system-ui'; g.fillText(`${post.likes + (liked ? 1 : 0)} likes`, 16, ay + 34);
      g.font = '400 18px system-ui'; g.fillText(post.cap, 110, ay + 34, CW - 120);
    };
    function heart(g, x, y, s, fill) {
      g.beginPath(); g.moveTo(x, y + s * 0.9);
      g.bezierCurveTo(x - s * 1.6, y - s * 0.1, x - s * 0.7, y - s * 1.3, x, y - s * 0.4);
      g.bezierCurveTo(x + s * 0.7, y - s * 1.3, x + s * 1.6, y - s * 0.1, x, y + s * 0.9);
      if (fill) { g.fillStyle = fill; g.fill(); } else { g.strokeStyle = '#111'; g.lineWidth = 3; g.stroke(); }
    }
    const drawPhone = (P) => {
      const g = P.c.getContext('2d');
      g.fillStyle = '#f2f2f4'; g.fillRect(0, 0, CW, CH);
      const off = TOP - P.scroll * PH;
      for (let k = Math.max(0, Math.floor(P.scroll) - 1); k < Math.min(POSTS, Math.floor(P.scroll) + 3); k++) drawPostBlock(g, posts[k], off + k * PH, P.liked.has(k));
      if (P.idx >= POSTS) {
        const y0 = off + POSTS * PH;
        g.fillStyle = '#f2f2f4'; g.fillRect(0, y0, CW, CH);
        g.fillStyle = '#2aa05a'; g.beginPath(); g.arc(CW / 2, y0 + 120, 54, 0, 7); g.fill();
        g.strokeStyle = '#fff'; g.lineWidth = 12; g.lineCap = 'round'; g.beginPath(); g.moveTo(CW / 2 - 24, y0 + 122); g.lineTo(CW / 2 - 4, y0 + 142); g.lineTo(CW / 2 + 28, y0 + 100); g.stroke();
        g.fillStyle = '#111'; g.textAlign = 'center'; g.font = '900 30px system-ui'; g.fillText("You're all caught up", CW / 2, y0 + 220);
        g.font = '700 24px system-ui'; g.fillStyle = '#555'; g.fillText(`${P.mates} mates liked · ${P.wrong} oops`, CW / 2, y0 + 262);
      }
      // the big heart when you like something
      if (P.heart > 0) {
        const k = 1 - P.heart / 0.7, s = 70 * (0.6 + Math.min(1, k * 3) * 0.6);
        g.globalAlpha = Math.min(1, P.heart * 3); heart(g, CW / 2, TOP + 64 + IMG / 2, s, '#ffffff'); g.globalAlpha = 1;
      }
      // the app bar and the status bar over the top
      g.fillStyle = '#fff'; g.fillRect(0, 0, CW, TOP);
      g.fillStyle = '#111'; g.font = '700 18px system-ui'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('9:41', 22, 18);
      g.fillRect(CW - 50, 11, 30, 14); g.fillRect(CW - 19, 15, 3, 6);
      g.font = 'italic 900 34px "Brush Script MT", "Segoe Script", cursive'; g.fillText('Bogangram', 18, 62);
      g.textAlign = 'right'; g.font = '900 22px system-ui'; g.fillStyle = '#555';
      g.fillText(`${Math.min(P.idx, POSTS)}/${POSTS}`, CW - 92, 62);
      heart(g, CW - 62, 62, 12, '#ff2a5a'); g.fillStyle = '#111'; g.textAlign = 'left'; g.fillText(`${P.score}`, CW - 44, 62);
      g.fillStyle = '#ddd'; g.fillRect(0, TOP - 2, CW, 2);
      // verdict banner
      if (P.verdict && P.vt > 0) {
        g.globalAlpha = Math.min(1, P.vt * 3);
        g.fillStyle = P.verdict.color; rr(g, 20, TOP + 10, CW - 40, 54, 27); g.fill();
        g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '900 25px system-ui'; g.fillText(P.verdict.text, CW / 2, TOP + 38, CW - 60);
        g.globalAlpha = 1;
      }
      // the bottom nav
      g.fillStyle = '#fff'; g.fillRect(0, CH - 64, CW, 64); g.fillStyle = '#ddd'; g.fillRect(0, CH - 64, CW, 2);
      g.fillStyle = '#111'; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(CW * (k + 0.5) / 5, CH - 32, k === 0 ? 12 : 9, 0, 7); g.fill(); }
      P.tex.needsUpdate = true; P.dirty = false;
    };

    // ----- liking and skipping -----
    const act = (P, like) => {
      if (P.idx >= POSTS || P.anim > 0) return;
      const post = posts[P.idx];
      const mate = post.players.some((id) => id !== P.p.id), own = post.players.includes(P.p.id);
      if (like) {
        P.liked.add(P.idx); P.heart = 0.7;
        if (mate) { P.score++; P.mates++; P.verdict = { text: 'MATE SPOTTED +1', color: '#2aa05a' }; pop(P, '+1', '#5cff9d'); sfx.play('coin'); }
        else if (own) { P.score--; P.wrong++; P.verdict = { text: 'LIKING YOUR OWN POST? −1', color: '#d83a3a' }; pop(P, '−1', '#ff5a5a'); sfx.play('lose'); }
        else { P.score--; P.wrong++; P.verdict = { text: "WHO'S THAT?? −1", color: '#d83a3a' }; pop(P, '−1', '#ff5a5a'); sfx.play('lose'); }
      } else {
        P.verdict = mate ? { text: 'YOU SCROLLED PAST A MATE', color: '#e08a1a' } : null;
        sfx.play('whoosh');
      }
      P.vt = P.verdict ? 1.1 : 0;
      P.anim = SCROLL_T; P.from = P.idx; P.idx++;
      if (P.idx >= POSTS) P.doneAt = tAll;
      P.dirty = true;
    };

    const span = perRow * (PW + GAPX) + 0.4, tall = rows * (PHt + GAPY) + 0.2;
    const camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 100);
    const vfov = THREE.MathUtils.degToRad(34), hfov = 2 * Math.atan(Math.tan(vfov / 2) * 16 / 9);
    const dist = Math.max(span / 2 / Math.tan(hfov / 2), tall / 2 / Math.tan(vfov / 2));
    camera.position.set(0, 0, dist + 0.2); camera.lookAt(0, 0, 0);

    let tAll = 0, finishAt = null;
    const heartMap = new THREE.CanvasTexture(heartTex);
    const floaters = [];
    return {
      camera,
      update(dt, t, running) {
        tAll += dt;
        for (const P of phones) {
          if (P.bot && running && P.idx < POSTS && P.anim <= 0) {
            // CPU: have a look, then decide; sometimes gets it wrong
            P.bot.wait -= dt;
            if (P.bot.wait <= 0) {
              const post = posts[P.idx], right = post.players.some((id) => id !== P.p.id);
              const sure = rng() < P.bot.sharp;
              act(P, sure ? right : !right);
              P.bot.wait = 0.9 + rng() * 1.3;
            }
          }
          if (P.anim > 0) { P.anim = Math.max(0, P.anim - dt); const k = 1 - P.anim / SCROLL_T; P.scroll = P.from + (1 - Math.pow(1 - k, 3)); P.dirty = true; }
          if (P.heart > 0) { P.heart = Math.max(0, P.heart - dt); P.dirty = true; }
          if (P.vt > 0) { P.vt = Math.max(0, P.vt - dt); P.dirty = true; }
          if (P.dirty) drawPhone(P);
          P.g.position.y = P.y + Math.sin(tAll * 1.3 + P.x) * 0.03;
        }
        // hearts floating up the wall when anyone likes anything
        if (running && rng() < dt * 1.5) {
          const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartMap, transparent: true, opacity: 0.5, depthWrite: false }));
          s.position.set((rng() - 0.5) * span * 1.2, -tall / 2 - 1, -2.5); s.scale.setScalar(0.4 + rng() * 0.5); scene.add(s); floaters.push({ s, v: 0.6 + rng() * 0.6 });
        }
        for (let i = floaters.length - 1; i >= 0; i--) { const f = floaters[i]; f.s.position.y += f.v * dt; f.s.position.x += Math.sin(tAll * 2 + i) * dt * 0.2; if (f.s.position.y > tall / 2 + 1) { scene.remove(f.s); floaters.splice(i, 1); } }
        for (let i = pops.length - 1; i >= 0; i--) { const q = pops[i]; q.life += dt; q.sp.position.y += dt * 0.9; q.sp.material.opacity = Math.min(1, 2.4 - q.life * 2); if (q.life > 1.2) { scene.remove(q.sp); pops.splice(i, 1); } }
        if (finishAt == null && phones.every((P) => P.idx >= POSTS && P.anim <= 0)) { finishAt = tAll; sfx.play('hallelujah'); }
      },
      input(p, m) {
        const P = phones.find((x) => x.p === p);
        if (P && (m.b === 'like' || m.b === 'skip')) act(P, m.b === 'like');
      },
      scores() { return Object.fromEntries(phones.map((P) => [P.p.id, P.score])); },
      done: () => finishAt != null && tAll - finishAt > 2.5,
    };
  },
};

// a soft heart for the wall
const heartTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); const x = 32, y = 30, s = 22;
  g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(x, y + s * 0.9);
  g.bezierCurveTo(x - s * 1.6, y - s * 0.1, x - s * 0.7, y - s * 1.3, x, y - s * 0.4);
  g.bezierCurveTo(x + s * 0.7, y - s * 1.3, x + s * 1.6, y - s * 0.1, x, y + s * 0.9); g.fill();
  return c;
})();
