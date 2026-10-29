// Plane Instructor: the instructor holds their arms out like a plane and banks left and right.
// Push your stick left and right to match. Every moment you're within the instructor's bounds scores points.
// Get past the halfway mark and your doll takes off and flies on the spot. One minute.
const MATCH = 0.2; // radians either side of the instructor that still counts (~11°)
const RATE = 10; // points per second while matched
const MAX_TILT = 0.95;

export default {
  id: 'plane-instructor',
  name: 'Plane Instructor',
  blurb: 'Arms out, copy the instructor. Stay in line and you might just take off.',
  howTo: 'Push your stick left and right to bank your arms like the instructor. The further you push, the harder you bank.',
  padText: 'Stick left and right to bank. Match the instructor!',
  duration: 60,
  pad: { kind: 'stick', buttons: [] },

  create(mg) {
    const { THREE, kit, scene, players, rng } = mg;
    scene.background = new THREE.Color(0x87c8f0);
    scene.fog = new THREE.Fog(0x9fd3f2, 40, 140);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x4c7a2a, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(10, 30, 20); sun.castShadow = true;
    Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30 });
    scene.add(sun);
    // airfield: grass, runway, a hangar and a windsock
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), kit.mat(0x5e9b3a));
    grass.rotation.x = -Math.PI / 2; grass.receiveShadow = true; scene.add(grass);
    kit.box(18, 0.05, 200, 0x3b3b3e, 0, 0, -60);
    for (let z = 20; z > -150; z -= 10) kit.box(0.6, 0.06, 4, 0xffffff, 0, 0, z);
    const hangar = kit.group(-26, 0, -30, 0.3);
    kit.box(20, 8, 14, 0xb8bec6, 0, 0, 0, hangar);
    kit.sign('BOGAN AIR', 12, 2, 0, 9, 7.1, hangar, { bg: '#0b3d91', fg: '#fff' });
    kit.cyl(0.12, 0.12, 6, 0xdddddd, 18, 0, -12);
    const sock = kit.cone(0.6, 2.4, 0xff7a00, 18, 5, -12);
    sock.rotation.z = Math.PI / 2;
    // instructor up on a podium at the back, in a hi-vis vest
    kit.box(3, 1.5, 3, 0x777777, 0, 0, -5);
    const instructor = mg.makeDoll({ id: 'instructor', name: 'Instructor', color: '#ff8a00', body: 'smooth', hair: 0x222222 }, { tag: false });
    instructor.group.position.set(0, 1.5, -5);
    instructor.group.scale.setScalar(1.35);
    const vest = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.7, 20), kit.mat(0xd7ff00, { emissive: 0x556600, emissiveIntensity: 0.3 }));
    vest.position.y = 1.45; instructor.body.add(vest);
    scene.add(instructor.group);

    const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.5, 400);
    const width = Math.max(8, players.length * 2.6);
    camera.position.set(0, 6.5, 9 + width * 0.75);
    camera.lookAt(0, 2.4, -1);

    const state = new Map();
    players.forEach((p, i) => {
      const d = mg.makeDoll(p);
      const x = (i - (players.length - 1) / 2) * 2.6;
      d.group.position.set(x, 0, 2);
      scene.add(d.group);
      const glow = new THREE.Mesh(new THREE.RingGeometry(0.7, 1.0, 32), new THREE.MeshBasicMaterial({ color: 0x5cff9d, transparent: true, opacity: 0, side: THREE.DoubleSide }));
      glow.rotation.x = -Math.PI / 2; glow.position.set(x, 0.05, 2);
      scene.add(glow);
      state.set(p.id, { doll: d, glow, tilt: 0, want: 0, score: 0, flying: false, lift: 0, x, lag: 0.25 + rng() * 0.5, wobble: rng() * 10 });
    });

    // the instructor's bank angle: hold, then swing to a new angle
    let target = 0, aim = 0, holdFor = 1.5;
    return {
      camera,
      update(dt, t, running) {
        if (running) {
          holdFor -= dt;
          if (holdFor <= 0) { aim = (rng() * 2 - 1) * 0.8; holdFor = 1.2 + rng() * 2; }
          target += (aim - target) * Math.min(1, dt * 2.2);
        }
        instructor.setArms(0, target);
        instructor.update(dt);
        for (const p of players) {
          const s = state.get(p.id);
          if (p.bot && running) {
            // CPU: chase the instructor with a bit of lag and wobble
            s.want = target + Math.sin(t * 1.3 + s.wobble) * 0.18;
          }
          s.tilt += (s.want - s.tilt) * Math.min(1, dt / (p.bot ? s.lag : 0.08));
          s.doll.setArms(0, s.tilt);
          s.doll.update(dt);
          const matched = Math.abs(s.tilt - target) < MATCH;
          if (running && matched) s.score += RATE * dt;
          s.glow.material.opacity += ((matched ? 0.9 : 0) - s.glow.material.opacity) * Math.min(1, dt * 8);
          // past halfway: take off and fly on the spot
          if (!s.flying && s.score >= RATE * mg.duration / 2) { s.flying = true; mg.sfx.play('teleport'); }
          s.lift += ((s.flying ? 2.6 : 0) - s.lift) * Math.min(1, dt * 1.5);
          s.doll.group.position.y = s.lift + (s.flying ? Math.sin(t * 3 + s.wobble) * 0.25 : 0);
          s.doll.group.rotation.x = s.flying ? 0.35 : 0;
        }
      },
      input(p, m) {
        if (m.b === 'stick' && Number.isFinite(m.x)) state.get(p.id).want = Math.max(-1, Math.min(1, m.x)) * MAX_TILT;
      },
      scores() { return Object.fromEntries(players.map((p) => [p.id, state.get(p.id).score])); },
    };
  },
};
