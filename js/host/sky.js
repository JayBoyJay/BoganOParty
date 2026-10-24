// A physical sky, sun and sky reflections for a scene, the same set-up the boards use.
// Minigames call addSky(mg.scene, mg.renderer, { ... }) and get the sun light back.
import * as THREE from 'three';
import { Sky } from '../../vendor/Sky.js';

export function addSky(scene, renderer, {
  elevation = 35, azimuth = 160, turbidity = 4, rayleigh = 1.5, mie = 0.005,
  sun = 0xfff2e0, sunIntensity = 3, sky = 0xcfe4ff, ground = 0x5a5040, hemi = 0.5, env = 0.6,
  shadowSize = 40, fog = null,
} = {}) {
  const dir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - elevation), THREE.MathUtils.degToRad(azimuth));
  const dome = new Sky();
  dome.scale.setScalar(4000);
  const u = dome.material.uniforms;
  u.turbidity.value = turbidity; u.rayleigh.value = rayleigh; u.mieCoefficient.value = mie; u.mieDirectionalG.value = 0.8;
  u.sunPosition.value.copy(dir);
  scene.add(dome);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envSky = new Sky(); envSky.scale.setScalar(1000); envSky.material.uniforms = THREE.UniformsUtils.clone(u); envScene.add(envSky);
  scene.environment = pmrem.fromScene(envScene, 0, 0.1, 2000).texture;
  scene.environmentIntensity = env;
  pmrem.dispose();
  if (fog) scene.fog = new THREE.Fog(fog[0], fog[1], fog[2]);
  scene.add(new THREE.HemisphereLight(sky, ground, hemi));
  const light = new THREE.DirectionalLight(sun, sunIntensity);
  light.position.copy(dir).multiplyScalar(120);
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  Object.assign(light.shadow.camera, { left: -shadowSize, right: shadowSize, top: shadowSize, bottom: -shadowSize, near: 1, far: 400 });
  light.shadow.bias = -0.0004; light.shadow.normalBias = 0.03;
  scene.add(light, light.target);
  return { sun: light, dir };
}
