import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Kenney Space Kit models (CC0), see assets/License.txt
const NAMES = [
  'rocket_baseA', 'rocket_sidesA', 'rocket_fuelA', 'rocket_topA', 'rocket_finsA',
  'hangar_roundGlass', 'hangar_smallA', 'corridor', 'corridor_window', 'structure_closed',
  'machine_generatorLarge', 'machine_generator', 'machine_wireless', 'machine_barrel',
  'rover', 'astronautA', 'astronautB', 'satelliteDish_large', 'satelliteDish_detailed',
  'platform_large', 'platform_small', 'rock_largeA', 'rock_largeB', 'rocks_smallA', 'rocks_smallB',
  'pipe_ring', 'barrels', 'craft_miner',
  'pipe_straight', 'pipe_corner', 'pipe_end', 'machine_barrelLarge', 'rock_crystals', 'rock_crystalsLargeA', 'rock_crystalsLargeB',
  'chimney', 'chimney_detailed', 'pipe_ringHigh', 'structure_detailed',
];

const cache = new Map();

export async function loadAssets(onProgress) {
  const loader = new GLTFLoader();
  let done = 0;
  await Promise.all(NAMES.map((n) => loader.loadAsync(`assets/models/${n}.glb`).then((g) => {
    g.scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = true;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => { m.metalness = 0; m.roughness = 0.75; });
      }
    });
    // Kenney nodes carry transforms: re-centre every model on x/z and put its feet on y=0
    g.scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(g.scene), c = box.getCenter(new THREE.Vector3());
    const wrap = new THREE.Group();
    g.scene.position.set(-c.x, -box.min.y, -c.z);
    wrap.add(g.scene);
    cache.set(n, wrap);
    onProgress && onProgress(++done / NAMES.length);
  })));
}

// Returns a fresh clone of a model, wrapped in a Group so callers can position/scale it freely.
export function model(name, { x = 0, y = 0, z = 0, s = 1, ry = 0 } = {}) {
  const src = cache.get(name);
  if (!src) throw new Error('Model not loaded: ' + name);
  const g = new THREE.Group();
  g.add(src.clone(true));
  g.position.set(x, y, z);
  g.scale.setScalar(s);
  g.rotation.y = ry;
  return g;
}
