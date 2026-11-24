import * as THREE from 'three';
import { ease } from './world.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/* 1 ─ Landing: rocket descends on a plume of fire, plants the n8n flag */
async function landing(w, ui) {
  const o = w.ensure('landing');
  const START = 5.5;
  o.rocket.position.y = START;
  o.flag.scale.y = 0.001; o.astro.visible = false;
  w.camSet(w.view('landing', { side: 1.9, up: 0.5, back: 4.6 }, { up: 1.3 }));

  ui.caption('T-minus 10. Descent burn initiated.');
  ui.loop('engine', 1.2);
  await w.wait(0.9);

  let touched = false;
  w.addTick(() => {
    if (touched) return false;
    w.exhaust('landing', V(0, o.rocket.position.y + 0.05, 0), 5);
  });
  await w.tween(6.5, (e) => {
    const y = START * (1 - e) * (1 - e);
    o.rocket.position.y = y;
    w.look.copy(w.siteAt('landing', 0, 1.0 + y * 0.16, 0));
    if (y < 1.7) w.dust('landing', V(), Math.ceil((1.7 - y) * 2.4), 1.4 + (1.7 - y), 0.05);
  }, ease.linear);
  touched = true;
  o.rocket.position.y = 0;
  ui.stopLoop('engine', 1.4); ui.sfx('touchdown');
  w.dust('landing', V(), 90, 2.2, 0.15);

  ui.caption('Touchdown. We are on the Moon.');
  await w.camTo(w.view('landing', { side: 1.3, up: 0.5, back: 1.9 }, { up: 0.45, side: 0.3 }), 2.6);
  o.astro.visible = true; w.dust('landing', V(0.55, 0, 0.5), 10, 0.3);
  await w.wait(0.6);
  ui.caption('Flag planted.'); ui.sfx('thud', { vol: 0.5, rate: 1.2 });
  await w.tween(1.0, (e) => { o.flag.scale.y = Math.max(0.001, e); }, ease.out);
  await w.wait(1.4);
}

/* 2 ─ Base: modules drop out of the sky one by one, then the lights come on */
async function base(w, ui) {
  const o = w.ensure('base');
  o.parts.forEach((p) => { p.visible = false; });
  o.light.intensity = 0;
  w.camSet(w.view('base', { side: -3.2, up: 1.5, back: 3.6 }, { up: 0.25 }));
  ui.caption('Construction drones inbound.');

  const total = o.parts.length * 0.62 + 2;
  w.tween(total, (e) => {
    w.camera.position.copy(w.siteAt('base', -3.2 + e * 6.4, 1.5 - e * 0.5, 3.6 - e * 0.6));
    w.look.copy(w.siteAt('base', e * 0.3, 0.25, 0));
  }, ease.inOut);

  await w.wait(1.2);
  for (const p of o.parts) {
    p.visible = true;
    const fy = p.userData.finalY;
    ui.sfx('deploy', { vol: 0.5 });
    w.tween(0.9, (e) => { p.position.y = fy + (1 - e) * 9; }, ease.bounce).then(() => {
      ui.sfx('thud');
      // dust at landing point, in site-local space
      const wp = p.getWorldPosition(V()), s = w.sites.base;
      const rel = wp.clone().sub(s.P);
      w.dust('base', V(rel.dot(s.T), 0, rel.dot(s.Z)), 14, 0.5, 0.1);
    });
    await w.wait(0.62);
  }
  ui.caption('Habitat sealed. Powering up.'); ui.sfx('door'); ui.sfx('power', { delay: 0.3 });
  await w.tween(1.6, (e) => { o.light.intensity = 1.4 * e; }, ease.out);
  await w.wait(1.4);
}

/* 3 ─ Telescope: the dish unfolds and listens to the cosmos */
async function telescope(w, ui) {
  const o = w.ensure('telescope');
  o.parts.forEach((p) => { p.visible = false; });
  o.pivot.rotation.y = 0;
  w.camSet(w.view('telescope', { side: -2.6, up: 1.0, back: 3.4 }, { up: 0.6, side: 0 }));
  ui.caption('Survey drones deploying the observatory.');
  await w.wait(0.8);

  for (const p of o.parts) {
    p.visible = true; ui.sfx('deploy', { vol: 0.6 });
    const s0 = p.scale.x, fy = p.userData.finalY;
    w.tween(0.7, (e) => { p.scale.setScalar(Math.max(0.01, s0 * e)); p.position.y = fy; }, ease.bounce);
    await w.wait(0.5);
  }
  await w.wait(0.6);

  ui.caption('Dish online. Scanning the sky.'); ui.sfx('power'); ui.loop('scan', 1.5);
  w.tween(5.5, (e) => { o.pivot.rotation.y = e * Math.PI * 1.6; }, ease.inOut);
  let scanning = true;
  w.addTick(() => { if (!scanning) return false; w.sparks('telescope', V(0, 0.75, 0), 2); });
  for (let i = 0; i < 5; i++) {
    w.flare('telescope', 0.25 + Math.random() * 0.35, (Math.random() - 0.5) * 1.1, 0.7 + Math.random() * 0.8); ui.sfx('ping');
    await w.wait(0.7);
  }
  ui.caption('Signal acquired. The universe is listening.');
  scanning = false; ui.stopLoop('scan', 1.5); ui.sfx('success', { vol: 0.8 });
  await w.wait(1.4);
}

/* 4 ─ Water: ice deposits are drilled, meltwater flows down a pipeline into the tanks */
async function mine(w, ui) {
  const o = w.ensure('mine');
  o.parts.forEach((p) => { p.visible = false; });
  o.glow.intensity = 0;
  const K = o.K;
  w.camSet(w.view('mine', { side: -3.4, up: 1.5, back: 4.6 }, { up: 0.3, side: 0.2 }));
  ui.caption('Mining drones inbound to the polar ice field.');
  w.tween(o.parts.length * 0.55 + 6, (e) => {
    w.camera.position.copy(w.siteAt('mine', -3.4 + e * 6.4, 1.5 - e * 0.5, 4.6 - e * 0.6));
    w.look.copy(w.siteAt('mine', 0.2 + e * 0.1, 0.3, 0));
  }, ease.inOut);
  await w.wait(1.0);
  for (const p of o.parts) {
    p.visible = true;
    const fy = p.userData.finalY;
    ui.sfx('deploy', { vol: 0.5 });
    w.tween(0.8, (e) => { p.position.y = fy + (1 - e) * 8; }, ease.bounce).then(() => {
      ui.sfx('thud');
      const wp = p.getWorldPosition(V()), s = w.sites.mine, rel = wp.clone().sub(s.P);
      w.dust('mine', V(rel.dot(s.T), 0, rel.dot(s.Z)), 12, 0.5, 0.1);
    });
    await w.wait(0.55);
  }
  ui.caption('Ice detected. Drills engaged.');
  ui.sfx('power');
  // drill vibration + steam at the deposit, meltwater streaming down the pipeline to the tanks
  let drilling = true;
  w.addTick((dt, t) => {
    if (!drilling) return false;
    o.miner.position.x = (Math.random() - 0.5) * 0.08;
    w.smoke('mine', V(-2.6 * K, 0.25, 0), 1, [0.9, 0.96, 1]);
    w.stream('mine', V(-2.0 * K, 0.18, 0), V(2.0 * K, 0.18, 0), 3);
  });
  await w.wait(2.2);
  ui.caption('Water flowing to the tanks.');
  await w.tween(3.2, (e) => { o.glow.intensity = 1.6 * e; }, ease.out);
  drilling = false; o.miner.position.x = 0;
  ui.caption('Tanks full. 4,600 liters secured.'); ui.sfx('success', { vol: 0.7 });
  await w.wait(1.6);
}

/* 5 ─ Atmosphere: vent stacks start pouring gas, then a glowing shell wraps the whole Moon */
async function plant(w, ui) {
  const o = w.ensure('plant'), atmo = w.ensureAtmosphere();
  atmo.mat.uniforms.strength.value = 0;
  o.parts.forEach((p) => { p.visible = false; });
  w.camSet(w.view('plant', { side: 3.6, up: 1.5, back: 4.6 }, { up: 0.5, side: 0 }));
  ui.caption('Gas-processing plant deploying.');
  w.tween(o.parts.length * 0.5 + 4, (e) => {
    w.camera.position.copy(w.siteAt('plant', 3.6 - e * 6.8, 1.5 - e * 0.3, 4.6 - e * 0.6));
    w.look.copy(w.siteAt('plant', -e * 0.2, 0.5, 0));
  }, ease.inOut);
  await w.wait(0.9);
  for (const p of o.parts) {
    p.visible = true;
    const fy = p.userData.finalY;
    ui.sfx('deploy', { vol: 0.5 });
    w.tween(0.8, (e) => { p.position.y = fy + (1 - e) * 8; }, ease.bounce).then(() => {
      ui.sfx('thud');
      const wp = p.getWorldPosition(V()), s = w.sites.plant, rel = wp.clone().sub(s.P);
      w.dust('plant', V(rel.dot(s.T), 0, rel.dot(s.Z)), 10, 0.5, 0.1);
    });
    await w.wait(0.5);
  }
  ui.caption('Generators online. Gas is rising.'); ui.sfx('power');
  let venting = true;
  w.addTick(() => { if (!venting) return false; o.vents.forEach((v) => w.smoke('plant', v, 1)); });
  await w.wait(3.5);
  ui.caption('An atmosphere is forming.');
  const hub = w.hubPose();
  w.camTo({ pos: hub.pos, look: hub.look, up: w.hubUp }, 4.5);
  await w.tween(5, (e) => { atmo.mat.uniforms.strength.value = e; }, ease.inOut);
  venting = false; ui.sfx('success', { vol: 0.7 });
  await w.wait(1.6);
}

/* 6 ─ Oceans: rain falls, craters flood, then the camera pulls back to reveal a living Moon */
async function oceans(w, ui) {
  w.ensureAtmosphere();
  const sea = w.ensureOceans(), lo = (12 - 0.9) / (12 - 0.04);
  sea.scale.setScalar(lo); w.cloudBase = 0;
  const hub = w.hubPose();
  w.camSet({ pos: hub.pos, look: hub.look, up: w.hubUp });
  ui.caption('Water released from the polar tanks.'); ui.sfx('power');
  await w.wait(1.2);
  let raining = true;
  w.addTick(() => { if (!raining) return false; w.rain(7); });
  ui.caption('Rain begins to fall.');
  w.tween(5, (e) => { w.cloudBase = 0.55 * e; }, ease.linear);
  await w.wait(3.5);
  ui.caption('The craters are filling.');
  const rise = w.tween(8, (e) => { sea.scale.setScalar(lo + (1 - lo) * e); }, ease.inOut);
  await w.wait(3);
  raining = false;
  const far = { pos: w.hubDir.clone().multiplyScalar(40).addScaledVector(w.hubT, 16).addScaledVector(w.hubUp, 6), look: V(0, 0, 0), up: UPV };
  w.camTo(far, 6);
  await rise;
  ui.caption('The Moon has oceans. A new world is born.'); ui.sfx('success', { vol: 0.9 });
  await w.wait(3.5);
}

const UPV = new THREE.Vector3(0, 1, 0);
export const CUTSCENES = { landing, base, telescope, mine, plant, oceans };
