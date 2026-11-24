import * as THREE from 'three';
import { model } from './assets.js';

const { Vector3, Group, Mesh } = THREE;
export const R = 12; // moon radius (was 5)
const SCALE = 5 / R; // keeps site spacing / crater sizes in world units
const UP = new Vector3(0, 1, 0);

/* ───────────── easing ───────────── */
export const ease = {
  linear: (t) => t,
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
  bounce: (t) => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
};
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/* ───────────── noise / terrain ───────────── */
function hash3(x, y, z) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const l = (a, b, t) => a + (b - a) * t;
  return l(
    l(l(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), u), l(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), u), v),
    l(l(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), u), l(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), u), v),
    w);
}
const fbm = (x, y, z) => vnoise(x, y, z) * 0.55 + vnoise(x * 2.1, y * 2.1, z * 2.1) * 0.3 + vnoise(x * 4.3, y * 4.3, z * 4.3) * 0.15;

function mulberry(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const dirOf = (x, y, z) => new Vector3(x, y, z).normalize();
// angular layout designed for a radius-5 moon, squeezed so sites keep the same spacing in world units
const squeeze = (x, y, z) => {
  const d = dirOf(x, y, z), lon = Math.atan2(d.x, d.z) * SCALE, lat = Math.asin(d.y) * SCALE;
  return new Vector3(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon));
};
export const SITE_DEFS = {
  landing: { dir: squeeze(0.18, 0.12, 1), flat: 0.1 * SCALE, blend: 0.18 * SCALE },
  base: { dir: squeeze(0.52, 0.1, 0.88), flat: 0.24 * SCALE, blend: 0.14 * SCALE },
  telescope: { dir: squeeze(0.0, 0.5, 0.86), flat: 0.18 * SCALE, blend: 0.14 * SCALE },
  mine: { dir: squeeze(-0.46, 0.2, 0.86), flat: 0.2 * SCALE, blend: 0.14 * SCALE },
  plant: { dir: squeeze(0.95, 0.22, 0.32), flat: 0.2 * SCALE, blend: 0.14 * SCALE },
};

const craters = (() => {
  const rnd = mulberry(7), out = [];
  const add = (rad, ratio) => {
    const d = new Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize();
    out.push({ d, r: rad, depth: rad * R * ratio, cosR: Math.cos(Math.min(3, rad * 1.7)) });
  };
  for (let i = 0; i < 850; i++) add((0.03 + Math.pow(rnd(), 2.4) * 0.3) * SCALE, 0.19);   // everyday craters
  for (let i = 0; i < 14; i++) add((0.25 + rnd() * 0.3) * SCALE * 2.2, 0.07);              // big shallow basins
  return out;
})();

export function surfaceRadius(d) {
  let h = (fbm(d.x * 1.6 + 10, d.y * 1.6, d.z * 1.6) - 0.5) * 0.4 + (fbm(d.x * 14, d.y * 14, d.z * 14) - 0.5) * 0.06;
  for (const c of craters) {
    const dt = d.dot(c.d);
    if (dt < c.cosR) continue;
    const t = Math.acos(Math.min(1, dt)) / c.r;
    if (t < 1) h -= c.depth * (1 - t * t);
    h += c.depth * 0.3 * Math.exp(-(((t - 1) / 0.16) ** 2));
  }
  let w = 0;
  for (const s of Object.values(SITE_DEFS)) {
    const a = Math.acos(Math.min(1, d.dot(s.dir)));
    w = Math.max(w, 1 - smooth(s.flat, s.flat + s.blend, a));
  }
  return R + h * (1 - w);
}

function buildMoonMesh() {
  const geo = new THREE.IcosahedronGeometry(1, 80);
  const pos = geo.attributes.position, n = pos.count;
  const col = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  const v = new Vector3(), cache = new Map(), us = [0, 0, 0];
  for (let i = 0; i < n; i += 3) {
    let cx = 0, cy = 0, cz = 0, hAvg = 0;
    for (let k = 0; k < 3; k++) {
      v.fromBufferAttribute(pos, i + k).normalize();
      const key = Math.round(v.x * 4000) + ',' + Math.round(v.y * 4000) + ',' + Math.round(v.z * 4000);
      let r = cache.get(key); if (r === undefined) { r = surfaceRadius(v); cache.set(key, r); }
      hAvg += (r - R) / 3; cx += v.x / 3; cy += v.y / 3; cz += v.z / 3;
      pos.setXYZ(i + k, v.x * r, v.y * r, v.z * r);
      us[k] = 0.5 + Math.atan2(v.x, v.z) / (2 * Math.PI);
      uv[(i + k) * 2 + 1] = 0.5 + Math.asin(clamp(v.y, -1, 1)) / Math.PI;
    }
    // avoid a smeared texture seam where a triangle straddles the date line
    if (Math.max(...us) - Math.min(...us) > 0.5) for (let k = 0; k < 3; k++) if (us[k] < 0.5) us[k] += 1;
    for (let k = 0; k < 3; k++) uv[(i + k) * 2] = us[k];
    // grey facet shading multiplies the texture: darker crater floors, bright rims, a little per-face jitter
    const shade = clamp(0.92 + hAvg * 0.9 + (hash3(Math.round(cx * 900), Math.round(cy * 900), Math.round(cz * 900)) - 0.5) * 0.1, 0.55, 1.2);
    for (let k = 0; k < 3; k++) { col[(i + k) * 3] = shade; col[(i + k) * 3 + 1] = shade; col[(i + k) * 3 + 2] = shade; }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0, color: 0xcfcfd4 });
  new THREE.TextureLoader().load('assets/textures/moon_2k.jpg', (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping; tex.anisotropy = 8;
    mat.map = tex; mat.color.set(0xffffff); mat.needsUpdate = true;
  });
  const mesh = new Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

/* ───────────── particles ───────────── */
class Particles {
  constructor(max = 700) {
    this.max = max; this.i = 0; this.list = new Array(max).fill(null);
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max); this.alpha = new Float32Array(max);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    this.uniforms = { scale: { value: 500 } };
    this.points = new THREE.Points(geo, new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false,
      vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; varying float vA; varying vec3 vC; uniform float scale;
        void main(){ vA=alpha; vC=color; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=size*scale/-mv.z; gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `varying float vA; varying vec3 vC; void main(){ float d=length(gl_PointCoord-.5); if(d>.5) discard; gl_FragColor=vec4(vC, smoothstep(.5,.0,d)*vA); }`,
    }));
    this.points.frustumCulled = false;
  }
  emit(p) { this.list[this.i] = { ...p, age: 0 }; this.i = (this.i + 1) % this.max; }
  update(dt) {
    for (let i = 0; i < this.max; i++) {
      const p = this.list[i];
      if (!p || p.age >= p.life) { this.alpha[i] = 0; this.size[i] = 0; continue; }
      p.age += dt;
      p.vel.addScaledVector(p.grav, dt);
      p.pos.addScaledVector(p.vel, dt);
      const t = p.age / p.life;
      this.pos[i * 3] = p.pos.x; this.pos[i * 3 + 1] = p.pos.y; this.pos[i * 3 + 2] = p.pos.z;
      this.col[i * 3] = p.color[0]; this.col[i * 3 + 1] = p.color[1]; this.col[i * 3 + 2] = p.color[2];
      this.size[i] = p.size * (1 + t * (p.grow ?? 1.5));
      this.alpha[i] = (1 - t) * (p.opacity ?? 0.8);
    }
    const g = this.points.geometry.attributes;
    g.position.needsUpdate = g.color.needsUpdate = g.size.needsUpdate = g.alpha.needsUpdate = true;
  }
}

/* ───────────── builders (use Kenney models) ───────────── */
// Clickable structures carry userData.info; picking walks up the hierarchy to find it.
const tag = (obj, title, desc, mission, missionTitle) => { obj.userData.info = { title, desc, mission, missionTitle }; return obj; };
const M1 = 'Touchdown', M2 = 'Moon Base', M3 = 'Deep-Space Telescope';
const flagTexture = () => {
  const c = document.createElement('canvas'); c.width = 128; c.height = 80;
  const x = c.getContext('2d');
  x.fillStyle = '#ff6d5a'; x.fillRect(0, 0, 128, 80);
  x.fillStyle = '#fff'; x.font = 'bold 44px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('n8n', 64, 42);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
};

function buildLanding() {
  // Rocket: stacked Kenney pieces, scaled down to sit on the moon
  const rocket = new Group(), k = 0.26;
  const stack = new Group(); stack.scale.setScalar(k);
  stack.add(model('rocket_baseA'));
  stack.add(model('rocket_finsA', { y: 0 }));
  stack.add(model('rocket_sidesA', { y: 1.6 }));
  stack.add(model('rocket_fuelA', { y: 2.6 }));
  stack.add(model('rocket_topA', { y: 3.1 }));
  rocket.add(stack);
  const flag = new Group();
  const pole = new Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 6), new THREE.MeshStandardMaterial({ color: 0xdddddd }));
  pole.position.y = 0.25; pole.castShadow = true;
  const cloth = new Mesh(new THREE.PlaneGeometry(0.24, 0.15), new THREE.MeshStandardMaterial({ map: flagTexture(), emissive: 0xffffff, emissiveMap: flagTexture(), emissiveIntensity: 0.55, side: THREE.DoubleSide, roughness: 0.9 }));
  cloth.position.set(0.125, 0.42, 0); cloth.castShadow = true;
  flag.add(pole, cloth);
  flag.position.set(0.7, 0, 0.25);
  const astro = model('astronautA', { s: 0.1, x: 0.55, z: 0.5, ry: -0.7 });
  tag(rocket, 'Descent Lander', 'The retro-rocket lander that carried the crew down. Its thrusters fired once altitude dropped below 150 m: the IF-node rule you wired up.', 1, M1);
  tag(flag, 'n8n Flag', 'Planted beside the lander. Every great automation starts with a first node.', 1, M1);
  tag(astro, 'Mission Specialist', 'First out of the lander, checking the landing pad before construction begins.', 1, M1);
  const group = new Group(); group.add(rocket, flag, astro);
  return { group, rocket, flag, astro, height: 3.9 * k };
}

function buildBase() {
  const K = 0.3, group = new Group(), parts = [];
  const inner = new Group(); inner.scale.setScalar(K); inner.position.x = -0.15; group.add(inner);
  const add = (obj, t, d) => { inner.add(obj); parts.push(obj); obj.userData.finalY = obj.position.y; if (t) tag(obj, t, d, 2, M2); return obj; };
  add(model('platform_large', { x: 0, z: 0, s: 1.7 }), 'Foundation Pad', 'Levelled regolith foundation, poured from the bricks your Merge nodes routed into the construction queue.');
  add(model('hangar_roundGlass'), 'Habitat Dome', 'Glass dome with crew quarters and a greenhouse. Sealed using the airlock and dome panels that survived your Filter.');
  add(model('corridor', { x: 2.15, ry: Math.PI / 2 }), 'Connecting Corridor', 'Pressurised tunnel linking the dome to the rest of the base.');
  add(model('corridor_window', { x: 3.15, ry: Math.PI / 2 }), 'Observation Corridor', 'A corridor with windows. The best view of Earthrise on the Moon.');
  add(model('structure_closed', { x: 4.15 }), 'Airlock', 'Sealed hatch module. Built from the single airlock part your HTTP Request fetched from the habitat depot.');
  add(model('machine_generatorLarge', { x: -2.6, z: 0.4 }), 'Power Generator', 'Stores energy from the solar panels and battery packs shipped from the solar depot.');
  add(model('machine_wireless', { x: -2.4, z: -1.6, ry: 0.5 }), 'Comms Relay', 'Keeps the base in contact with Earth and the lander.');
  add(model('machine_barrel', { x: -2.0, z: 1.8 }), 'Fuel Barrel', 'Reserve propellant for the surface rover and future landers.');
  add(model('rover', { x: 1.2, z: 2.4, s: 2.6, ry: 0.8 }), 'Surface Rover', 'Small rover for hauling regolith and scouting future water-ice deposits.');
  add(model('astronautB', { x: 0.2, z: 2.8, s: 0.8, ry: 0.4 }), 'Base Engineer', 'Inspecting the finished habitat.');
  add(model('rocks_smallA', { x: 3.2, z: 1.8 }), 'Regolith Stockpile', 'Excavated lunar rock, ready to be turned into bricks.');
  const light = new THREE.PointLight(0xffe0a8, 1.4, 3, 1.6);
  light.position.set(0, 0.5, 0.2); group.add(light);
  group.rotation.y = -0.45;
  return { group, parts, light, K };
}

function buildTelescope() {
  const K = 0.7, group = new Group(), parts = [];
  const inner = new Group(); inner.scale.setScalar(K); group.add(inner);
  const add = (obj, t, d, tgt = inner) => { tgt.add(obj); parts.push(obj); obj.userData.finalY = obj.position.y; if (t) tag(obj, t, d, 3, M3); return obj; };
  add(model('platform_large', { s: 1.1 }), 'Observatory Platform', 'Built on Plateau Epsilon: sunlit, flat and the highest site that qualified in your Filter → Sort → Limit pipeline.');
  const pivot = new Group(); pivot.position.set(0, 0.1, 0);
  pivot.add(model('satelliteDish_large', { s: 1.5 }));
  add(pivot, 'Deep-Space Dish', 'The main radio dish. It slowly rotates to listen for signals from across the universe.');
  add(model('satelliteDish_detailed', { x: 1.7, z: 0.8, s: 0.9, ry: -0.8 }), 'Relay Dish', 'A smaller dish that beams findings back to Earth.');
  add(model('machine_wireless', { x: -1.5, z: 0.9, ry: 0.6 }), 'Signal Processor', 'Cleans and decodes the raw signal the dish collects.');
  add(model('hangar_smallA', { x: -0.4, z: -2.0, s: 0.9 }), 'Control Building', 'Where the telescope operators work and the data is stored.');
  add(model('rocks_smallB', { x: 1.9, z: -1.4 }), 'Boulders', 'Natural lunar rock left in place around the platform.');
  return { group, parts, pivot, K };
}

const M4 = 'Extract Water', M5 = 'Create Atmosphere';
function tint(obj, color) {
  obj.traverse((m) => { if (m.isMesh) { m.material = (Array.isArray(m.material) ? m.material : [m.material]).map((x) => { const y = x.clone(); y.color.multiply(new THREE.Color(color)); return y; })[0]; } });
  return obj;
}

function buildMine() {
  const K = 0.3, group = new Group(), parts = [];
  const inner = new Group(); inner.scale.setScalar(K); group.add(inner);
  const add = (obj, t, d) => { inner.add(obj); parts.push(obj); obj.userData.finalY = obj.position.y; if (t) tag(obj, t, d, 4, M4); return obj; };
  add(model('platform_large', { s: 2.1 }), 'Mining Pad', 'Levelled work area at the edge of the polar ice field.');
  const ice = new Group();
  ice.add(tint(model('rock_crystalsLargeA', { x: 0, z: 0, s: 1.7 }), 0x9fe6ff), tint(model('rock_crystalsLargeB', { x: 0.7, z: 0.9, s: 1.4, ry: 1 }), 0xbdeeff), tint(model('rock_crystals', { x: -0.6, z: -0.9, s: 1.6, ry: 2 }), 0x9fe6ff));
  ice.position.set(-2.6, 0, 0); add(ice, 'Ice Deposit', 'Water ice locked in the regolith. Your Switch picked the four richest deposits (60%+) to drill first.');
  add(model('craft_miner', { x: -0.7, z: 2.0, ry: 0.5 }), 'Mining Rig', 'Autonomous drilling craft that bores into the ice and melts it for pumping.');
  for (const x of [-1.2, -0.2, 0.8]) add(model('pipe_straight', { x, z: 0, ry: Math.PI / 2 }), x === -1.2 ? 'Water Pipeline' : null, 'Insulated pipe carrying meltwater from the drill site to storage.');
  add(model('machine_generator', { x: 0.2, z: -1.8, ry: 0.3 }), 'Pump Station', 'Pumps and heats the water so it never freezes in the pipes.');
  const tanks = [0.8, 0.1, -0.6].map((dz) => add(model('machine_barrelLarge', { x: 2.2, z: dz * 2.6 - 0.3, s: 1.5 }), 'Water Tank', 'Storage tank for the extracted water. Your Summarize node added up 4,600 liters of incoming supply.'));
  const glow = new THREE.PointLight(0x6fd8ff, 1.3, 3, 1.6); glow.position.set(2.2 * K, 0.5, -0.3 * K); group.add(glow);
  return { group, parts, K, ice, tanks, glow, miner: parts[2] };
}

function buildPlant() {
  const K = 0.3, group = new Group(), parts = [], vents = [];
  const inner = new Group(); inner.scale.setScalar(K); group.add(inner);
  const add = (obj, t, d) => { inner.add(obj); parts.push(obj); obj.userData.finalY = obj.position.y; if (t) tag(obj, t, d, 5, M5); return obj; };
  add(model('platform_large', { s: 2.1 }), 'Plant Foundation', 'Heavy-duty pad for the gas-processing plant.');
  [-2.0, 0, 2.0].forEach((x, i) => {
    add(model('machine_generatorLarge', { x, z: 0.5 }), 'Gas Generator', 'Releases trapped gases from lunar rock. Faulty units were filtered out of your totals.');
    const h = [1.6, 2.0, 1.7][i];
    add(model(i === 1 ? 'chimney' : 'chimney_detailed', { x, z: -1.0, s: h }), 'Vent Stack', 'Releases processed gas into the sky to build up the atmosphere.');
    vents.push(new Vector3(x * K, 2 * h * K, -1.0 * K));
  });
  add(model('hangar_smallA', { x: 0.2, z: 3.1, s: 0.85, ry: Math.PI }), 'Atmosphere Control', 'Monitors pressure and composition of every gas.');
  add(model('machine_barrelLarge', { x: -3.6, z: 1.8, s: 1.3 }), 'Gas Storage', 'Compressed reserve of nitrogen and oxygen.');
  add(model('machine_barrelLarge', { x: 3.6, z: 1.4, s: 1.3 }), 'Gas Storage', 'Compressed reserve of argon and water vapor.');
  return { group, parts, K, vents };
}

const BUILDERS = { landing: buildLanding, base: buildBase, telescope: buildTelescope, mine: buildMine, plant: buildPlant };

/* ───────────── world ───────────── */
export class World {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x03040a);
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.03, 1500);
    this.look = new Vector3();
    this.t = 0; this.auto = true; this.upTarget = UP.clone(); this.hubUp = UP.clone(); this.drag = { az: 0, el: 0 };
    this.tweens = []; this.ticks = []; this.objs = {};
    this.particles = new Particles(); this.scene.add(this.particles.points);

    this.moon = buildMoonMesh(); this.scene.add(this.moon);
    this.makeSites();
    this.makeLights();
    this.makeSky();

    this.hubDir = Object.values(this.sites).reduce((a, s) => a.add(s.N), new Vector3()).normalize();
    this.hubUp = this.hubDir.clone(); this.upTarget = this.hubUp.clone(); this.camera.up.copy(this.hubUp);
    this.hubP = this.hubDir.clone().multiplyScalar(R);
    this.hubT = new Vector3().crossVectors(UP, this.hubDir).normalize();
    this.hubZ = new Vector3().crossVectors(this.hubT, this.hubDir);
    this.placeEarth();
    this.snapHub();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.bindDrag();
  }

  makeSites() {
    this.sites = {};
    for (const [name, def] of Object.entries(SITE_DEFS)) {
      const N = def.dir.clone(), P = N.clone().multiplyScalar(surfaceRadius(N));
      const T = new Vector3().crossVectors(UP, N).normalize();
      const Z = new Vector3().crossVectors(T, N);
      const anchor = new Group(); anchor.position.copy(P);
      anchor.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(T, N, Z));
      this.scene.add(anchor);
      this.sites[name] = { P, N, T, Z, anchor };
    }
  }

  makeLights() {
    const sunDir = dirOf(0.75, 0.42, 0.55);
    const center = Object.values(this.sites).reduce((a, s) => a.add(s.P), new Vector3()).multiplyScalar(1 / Object.keys(this.sites).length);
    const sun = new THREE.DirectionalLight(0xfff2dc, 3.1);
    sun.position.copy(center).addScaledVector(sunDir, 18); sun.target.position.copy(center);
    sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
    Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 4, far: 44 });
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.012;
    this.scene.add(sun, sun.target);
    this.scene.add(new THREE.HemisphereLight(0xb8c4ff, 0x2a2a38, 0.45));
    const fill = new THREE.DirectionalLight(0x6f8cff, 0.5); fill.position.set(-8, 2, 6); this.scene.add(fill);
  }

  makeSky() {
    const rnd = mulberry(99), n = 3500, p = new Float32Array(n * 3), c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const d = new Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize().multiplyScalar(600);
      p.set([d.x, d.y, d.z], i * 3);
      const b = 0.45 + rnd() * 0.55, tint = rnd();
      c.set([b * (0.85 + tint * 0.15), b * 0.92, b * (1 - tint * 0.2)], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    this.scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, fog: false })));
  }

  placeEarth() {
    const e = 0.17, a = -0.25, rad = 9, tl = new THREE.TextureLoader();
    const dir = this.hubUp.clone().multiplyScalar(Math.sin(e)).addScaledVector(this.hubZ, -Math.cos(e) * Math.cos(a)).addScaledVector(this.hubT, Math.cos(e) * Math.sin(a));
    const srgb = (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
    const earth = new THREE.Group(); earth.position.copy(this.hubP).addScaledVector(dir, 110); this.scene.add(earth);
    const day = srgb(tl.load('assets/textures/earth_day.jpg'));
    const globe = new Mesh(new THREE.SphereGeometry(rad, 96, 48), new THREE.MeshStandardMaterial({
      map: day, emissive: 0xffffff, emissiveMap: day, emissiveIntensity: 0.85, roughness: 0.9, metalness: 0,
    }));
    const clouds = new Mesh(new THREE.SphereGeometry(rad * 1.012, 96, 48), new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.55, alphaMap: tl.load('assets/textures/earth_clouds.png'), transparent: true, opacity: 0.75, depthWrite: false, roughness: 1,
    }));
    const glow = new Mesh(new THREE.SphereGeometry(rad * 1.1, 64, 32), new THREE.ShaderMaterial({
      transparent: true, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
      vertexShader: 'varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec3 vN; void main(){ float i = pow(0.68 - dot(vN, vec3(0.0, 0.0, 1.0)), 3.0); gl_FragColor = vec4(0.32, 0.62, 1.0, 1.0) * i * 1.0; }',
    }));
    earth.add(globe, clouds, glow); earth.rotation.set(0.4, 2.2, 0.1);
    this.earth = globe; this.earthClouds = clouds;
  }

  /* ----- camera ----- */
  hubPose(t = this.t) {
    // low "landscape" shot over the sites: horizon and Earth in the sky. Slowly drifts side to side.
    const az = Math.sin(t * 0.12) * 0.3 + this.drag.az, el = this.drag.el;
    const pos = this.hubP.clone().addScaledVector(this.hubUp, 3.0 + el * 8)
      .addScaledVector(this.hubZ, Math.cos(az) * 10.8).addScaledVector(this.hubT, Math.sin(az) * 10.8);
    return { pos, look: this.hubP.clone().addScaledVector(this.hubUp, 1.4) };
  }
  snapHub() { const p = this.hubPose(); this.camera.position.copy(p.pos); this.look.copy(p.look); this.camera.lookAt(this.look); }
  setAuto(on) { this.auto = on; if (on) this.upTarget = this.hubUp.clone(); }
  siteAt(name, side = 0, up = 0, back = 0) {
    const s = this.sites[name];
    return s.P.clone().addScaledVector(s.T, side).addScaledVector(s.N, up).addScaledVector(s.Z, back);
  }
  view(name, cam = {}, look = {}) {
    return { pos: this.siteAt(name, cam.side, cam.up, cam.back), look: this.siteAt(name, look.side, look.up, look.back), up: this.sites[name].N.clone() };
  }
  camSet(v) { this.auto = false; this.camera.position.copy(v.pos); this.look.copy(v.look); this.upTarget = (v.up || UP).clone(); this.camera.up.copy(this.upTarget); this.camera.lookAt(this.look); }
  camTo(v, dur = 2, e = ease.inOut) {
    this.auto = false; this.upTarget = (v.up || UP).clone();
    const p0 = this.camera.position.clone(), l0 = this.look.clone();
    return this.tween(dur, (k) => { this.camera.position.lerpVectors(p0, v.pos, k); this.look.lerpVectors(l0, v.look, k); }, e);
  }

  /* ----- timing ----- */
  tween(dur, fn, e = ease.inOut) { return new Promise((res) => this.tweens.push({ t: 0, dur, fn, e, res })); }
  wait(s) { return this.tween(s, () => {}, ease.linear); }
  addTick(fn) { this.ticks.push(fn); }

  /* ----- builds ----- */
  ensure(name) {
    if (this.objs[name]) return this.objs[name];
    const o = BUILDERS[name]();
    this.sites[name].anchor.add(o.group);
    o.group.traverse((m) => { if (m.isMesh && !m.userData.noShadow) { m.castShadow = true; m.receiveShadow = true; } });
    this.objs[name] = o;
    return o;
  }
  restore(done) {
    ['landing', 'base', 'telescope', 'mine', 'plant'].slice(0, done).forEach((n) => this.ensure(n));
    if (done >= 5) this.ensureAtmosphere().mat.uniforms.strength.value = 1;
    if (done >= 6) { this.ensureOceans(); this.sea.scale.setScalar(1); this.cloudBase = 0.55; }
  }
  ensureAtmosphere() {
    if (this.atmo) return this.atmo;
    const mat = new THREE.ShaderMaterial({
      uniforms: { strength: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform float strength; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.2); gl_FragColor = vec4(0.38, 0.66, 1.0, 1.0) * f * strength * 1.1; }',
    });
    const mesh = new Mesh(new THREE.SphereGeometry(R + 0.9, 128, 64), mat); mesh.renderOrder = 5;
    this.scene.add(mesh); this.atmo = { mesh, mat };
    return this.atmo;
  }
  ensureOceans() {
    if (this.sea) return this.sea;
    this.sea = new Mesh(new THREE.SphereGeometry(R - 0.04, 192, 96), new THREE.MeshStandardMaterial({ color: 0x2a7bc8, roughness: 0.18, metalness: 0.05, emissive: 0x0a2f5c, emissiveIntensity: 0.5 }));
    this.sea.scale.setScalar((R - 0.9) / (R - 0.04)); this.scene.add(this.sea); this.cloudBase = 0;
    const tex = new THREE.TextureLoader().load('assets/textures/earth_clouds.png');
    this.clouds = new Mesh(new THREE.SphereGeometry(R + 0.4, 96, 48), new THREE.MeshStandardMaterial({ color: 0xffffff, alphaMap: tex, transparent: true, opacity: 0, depthWrite: false, roughness: 1, emissive: 0xffffff, emissiveIntensity: 0.25 }));
    this.scene.add(this.clouds);
    return this.sea;
  }
  smoke(name, local, count = 2, color = [0.86, 0.92, 1]) {
    const s = this.sites[name], o = s.P.clone().addScaledVector(s.T, local.x).addScaledVector(s.N, local.y).addScaledVector(s.Z, local.z);
    for (let i = 0; i < count; i++) {
      const vel = s.N.clone().multiplyScalar(0.5 + Math.random() * 0.5).addScaledVector(s.T, (Math.random() - 0.3) * 0.25).addScaledVector(s.Z, (Math.random() - 0.5) * 0.2);
      this.particles.emit({ pos: o.clone(), vel, grav: new Vector3(), life: 3 + Math.random() * 2, size: 0.07 + Math.random() * 0.05, color, opacity: 0.5, grow: 4 });
    }
  }
  stream(name, a, b, count = 3, color = [0.5, 0.85, 1]) {
    const s = this.sites[name], at = (v) => s.P.clone().addScaledVector(s.T, v.x).addScaledVector(s.N, v.y).addScaledVector(s.Z, v.z);
    const from = at(a), to = at(b), dir = to.clone().sub(from), len = dir.length(), sp = 1.4;
    dir.normalize();
    for (let i = 0; i < count; i++) {
      const o = from.clone().addScaledVector(s.T, (Math.random() - 0.5) * 0.08).addScaledVector(s.Z, (Math.random() - 0.5) * 0.08);
      this.particles.emit({ pos: o, vel: dir.clone().multiplyScalar(sp), grav: new Vector3(), life: len / sp, size: 0.05, color, opacity: 0.95, grow: 0.1 });
    }
  }
  rain(count = 8) {
    for (let i = 0; i < count; i++) {
      const o = this.hubP.clone().addScaledVector(this.hubUp, 3.6).addScaledVector(this.hubT, (Math.random() - 0.5) * 11).addScaledVector(this.hubZ, (Math.random() - 0.5) * 9);
      this.particles.emit({ pos: o, vel: this.hubUp.clone().multiplyScalar(-4.2), grav: new Vector3(), life: 1.0, size: 0.028, color: [0.6, 0.8, 1], opacity: 0.8, grow: 0 });
    }
  }

  /* ----- effects ----- */
  dust(name, local = new Vector3(), count = 20, speed = 0.9, up = 0.25) {
    const s = this.sites[name], origin = s.P.clone().addScaledVector(s.T, local.x).addScaledVector(s.N, local.y + 0.02).addScaledVector(s.Z, local.z);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, sp = speed * (0.4 + Math.random() * 0.8);
      const vel = s.T.clone().multiplyScalar(Math.cos(a) * sp).addScaledVector(s.Z, Math.sin(a) * sp).addScaledVector(s.N, up * sp * Math.random());
      this.particles.emit({ pos: origin.clone(), vel, grav: s.N.clone().multiplyScalar(-0.5), life: 1.6 + Math.random() * 1.4, size: 0.06 + Math.random() * 0.05, color: [0.72, 0.7, 0.66], opacity: 0.55, grow: 2.2 });
    }
  }
  exhaust(name, local, count = 4) {
    const s = this.sites[name], origin = s.P.clone().addScaledVector(s.T, local.x).addScaledVector(s.N, local.y).addScaledVector(s.Z, local.z);
    for (let i = 0; i < count; i++) {
      const vel = s.N.clone().multiplyScalar(-(2.2 + Math.random())).addScaledVector(s.T, (Math.random() - 0.5) * 0.5).addScaledVector(s.Z, (Math.random() - 0.5) * 0.5);
      const hot = Math.random();
      this.particles.emit({ pos: origin.clone(), vel, grav: new Vector3(), life: 0.35 + Math.random() * 0.25, size: 0.07 + Math.random() * 0.05, color: hot > 0.5 ? [1, 0.82, 0.45] : [1, 0.45, 0.2], opacity: 0.9, grow: 0.4 });
    }
  }
  sparks(name, local, count = 3, color = [0.5, 0.85, 1]) {
    const s = this.sites[name], origin = s.P.clone().addScaledVector(s.T, local.x).addScaledVector(s.N, local.y).addScaledVector(s.Z, local.z);
    for (let i = 0; i < count; i++) {
      const vel = s.N.clone().multiplyScalar(1.6 + Math.random()).addScaledVector(s.T, (Math.random() - 0.5) * 0.35).addScaledVector(s.Z, (Math.random() - 0.5) * 0.35);
      this.particles.emit({ pos: origin.clone(), vel, grav: new Vector3(), life: 1.6 + Math.random(), size: 0.035 + Math.random() * 0.03, color, opacity: 1, grow: 0.2 });
    }
  }
  flare(name, elev, azim, size = 1) {
    const s = this.sites[name];
    const dir = s.N.clone().multiplyScalar(Math.sin(elev)).addScaledVector(s.Z, -Math.cos(elev) * Math.cos(azim)).addScaledVector(s.T, Math.cos(elev) * Math.sin(azim));
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(160,220,255,.8)'); g.addColorStop(1, 'rgba(60,120,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    sp.position.copy(s.P).addScaledVector(dir, 120); sp.scale.setScalar(0.01);
    this.scene.add(sp);
    return this.tween(2.2, (k) => { const pulse = Math.sin(k * Math.PI); sp.scale.setScalar(size * 9 * pulse + 0.01); sp.material.opacity = pulse; }, ease.linear).then(() => { this.scene.remove(sp); });
  }

  /* ----- picking ----- */
  pick(cx, cy) {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.ray = this.ray || new THREE.Raycaster(); this.ray.setFromCamera(ndc, this.camera);
    const roots = Object.keys(this.objs).map((k) => this.objs[k].group);
    const hit = this.ray.intersectObjects(roots, true).find((h) => h.object.isMesh && h.object.visible);
    if (!hit) return null;
    for (let o = hit.object; o; o = o.parent) if (o.userData.info) return { object: o, info: o.userData.info };
    return null;
  }
  select(obj) {
    this.deselect();
    const mats = [];
    obj.traverse((m) => {
      if (!m.isMesh) return;
      mats.push([m, m.material]);
      const c = (Array.isArray(m.material) ? m.material : [m.material]).map((x) => { const y = x.clone(); y.emissive = new THREE.Color(0xff6d5a); y.emissiveIntensity = 0.3; return y; });
      m.material = Array.isArray(m.material) ? c : c[0];
    });
    this.sel = { obj, mats };
  }
  deselect() {
    if (!this.sel) return;
    for (const [m, orig] of this.sel.mats) { (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose()); m.material = orig; }
    this.sel = null;
  }
  focus(obj, dur = 1.4) {
    const box = new THREE.Box3().setFromObject(obj), c = box.getCenter(new Vector3()), rad = Math.max(0.35, box.getSize(new Vector3()).length() * 0.5);
    const dir = this.camera.position.clone().sub(c).normalize();
    const pos = c.clone().addScaledVector(dir, rad * 3.4 + 0.9);
    return this.camTo({ pos, look: c, up: this.hubUp }, dur);
  }

  /* ----- frame ----- */
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.particles.uniforms.scale.value = this.renderer.domElement.height * 0.5 / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
  }
  bindDrag() {
    let down = null;
    this.canvas.addEventListener('pointerdown', (e) => { if (this.auto) down = { x: e.clientX, y: e.clientY, az: this.drag.az, el: this.drag.el }; });
    window.addEventListener('pointermove', (e) => {
      if (!down || !this.auto) return;
      this.drag.az = clamp(down.az - (e.clientX - down.x) * 0.004, -1.3, 1.3);
      this.drag.el = clamp(down.el + (e.clientY - down.y) * 0.004, -0.5, 1.2);
    });
    window.addEventListener('pointerup', () => { down = null; });
  }
  update(dt) {
    dt = Math.min(dt, 0.05); this.t += dt;
    for (const tw of [...this.tweens]) {
      tw.t += dt; const p = Math.min(1, tw.t / tw.dur);
      tw.fn(tw.e(p));
      if (p >= 1) { this.tweens.splice(this.tweens.indexOf(tw), 1); tw.res(); }
    }
    this.ticks = this.ticks.filter((f) => f(dt, this.t) !== false);
    if (this.auto) {
      const k = 1 - Math.exp(-dt * 1.4), p = this.hubPose();
      this.camera.position.lerp(p.pos, k); this.look.lerp(p.look, k);
    }
    this.camera.up.lerp(this.upTarget, 1 - Math.exp(-dt * 2.5)).normalize();
    this.camera.lookAt(this.look);
    if (this.clouds) { this.clouds.rotation.y += dt * 0.01; this.clouds.material.opacity = this.cloudBase * smooth(R + 2.5, R + 12, this.camera.position.length()); } this.earth.rotation.y += dt * 0.02; this.earthClouds.rotation.y += dt * 0.008;
    if (this.sel) { const k = 0.22 + 0.16 * Math.sin(this.t * 4); this.sel.mats.forEach(([m]) => (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => { x.emissiveIntensity = k; })); }
    this.particles.update(dt);
    this.renderer.render(this.scene, this.camera);
  }
}
