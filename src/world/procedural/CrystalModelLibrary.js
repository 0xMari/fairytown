import * as THREE from "three";
import { SELECTIVE_BLOOM_LAYER } from "../../rendering/bloom.js";
import {
  buildInstancedGroupFromDescriptors,
  extractInstancedMeshDescriptors
} from "../instancedModelUtils.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const CRYSTAL_MODELS = [
  {
    key: "enchanted-crystal-01",
    url: "/crystals/enchanted_crystal_01.glb"
  },
  {
    key: "moonstone-02",
    url: "/crystals/enchanted_crystal_02/source/Moonstone_02.glb"
  },
  {
    key: "moonstone-03",
    url: "/crystals/enchanted_crystal_03/source/Moonstone_03.glb"
  }
];
const CRYSTAL_TARGET_HEIGHT = 1.25;
const CRYSTAL_MODEL_BURY_DEPTH = -0.04;
const CRYSTAL_INSTANCE_BURY_DEPTH = -0.14;
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const IDENTITY_MATRIX = new THREE.Matrix4();

function randomBetween(rng, min, max) {
  return min + (max - min) * rng();
}

function forEachMaterial(material, callback) {
  if (Array.isArray(material)) {
    material.forEach((entry) => {
      if (entry) {
        callback(entry);
      }
    });
    return;
  }

  if (material) {
    callback(material);
  }
}

function normalizeModel(root) {
  const template = new THREE.Group();
  const content = root.clone(true);

  content.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(content);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const scale = size.y > 0 ? CRYSTAL_TARGET_HEIGHT / size.y : 1;

  content.position.x -= center.x * scale;
  content.position.y -= bounds.min.y * scale;
  content.position.y += CRYSTAL_MODEL_BURY_DEPTH;
  content.position.z -= center.z * scale;
  content.scale.multiplyScalar(scale);
  content.updateMatrixWorld(true);

  template.add(content);

  return template;
}

function tuneCrystalMaterials(root, maxAnisotropy) {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    child.castShadow = false;
    child.receiveShadow = false;

    forEachMaterial(child.material, (material) => {
      material.roughness = Math.min(material.roughness ?? 0.28, 0.34);
      material.metalness = Math.min(material.metalness ?? 0, 0.04);
      material.envMapIntensity = Math.max(material.envMapIntensity ?? 0, 0.72);
      material.emissive = material.emissive ?? new THREE.Color("#000000");
      material.emissive.lerp(new THREE.Color("#7edfff"), 0.34);
      material.emissiveIntensity = Math.max(material.emissiveIntensity ?? 0, 0.16);

      if (material.map) {
        material.map.colorSpace = THREE.SRGBColorSpace;
      }

      [
        material.map,
        material.normalMap,
        material.roughnessMap,
        material.metalnessMap,
        material.aoMap,
        material.emissiveMap
      ].forEach((texture) => {
        if (texture) {
          texture.anisotropy = maxAnisotropy;
        }
      });

      material.needsUpdate = true;
    });
  });
}

function enableCrystalBloom(root) {
  root.layers.enable(SELECTIVE_BLOOM_LAYER);
  root.traverse((child) => {
    child.layers?.enable?.(SELECTIVE_BLOOM_LAYER);
  });
}

function createCrystalMatrix(rng, {
  offset = [0, 0, 0],
  scaleRange = [0.72, 1.16],
  tilt = 0.18,
  buryDepth = CRYSTAL_INSTANCE_BURY_DEPTH
} = {}) {
  const scale = randomBetween(rng, scaleRange[0], scaleRange[1]);
  const rotation = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(
      randomBetween(rng, -tilt, tilt),
      rng() * Math.PI * 2,
      randomBetween(rng, -tilt, tilt)
    )
  );

  return new THREE.Matrix4().compose(
    new THREE.Vector3(offset[0], offset[1] + buryDepth * scale, offset[2]),
    rotation,
    new THREE.Vector3(
      scale * randomBetween(rng, 0.82, 1.2),
      scale * randomBetween(rng, 0.9, 1.28),
      scale * randomBetween(rng, 0.82, 1.2)
    )
  );
}

export class CrystalModelLibrary {
  constructor() {
    this.loader = new GLTFLoader();
    this.variants = [];
    this.loadPromise = null;
  }

  async load(renderer) {
    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = Promise.all(
      CRYSTAL_MODELS.map(async (definition) => {
        const gltf = await this.loader.loadAsync(definition.url);
        const maxAnisotropy = renderer?.capabilities?.getMaxAnisotropy?.() ?? 1;
        const template = normalizeModel(gltf.scene);

        tuneCrystalMaterials(template, maxAnisotropy);

        const descriptors = extractInstancedMeshDescriptors(template);
        const build = (placements) => {
          const group = buildInstancedGroupFromDescriptors(descriptors, placements, {
            castShadow: false,
            receiveShadow: false
          });

          if (group) {
            enableCrystalBloom(group);
          }

          return group;
        };

        return {
          key: definition.key,
          build
        };
      })
    ).then((variants) => {
      this.variants = variants;
    });

    return this.loadPromise;
  }

  createSingleInstances(rng, {
    offset = [0, 0, 0],
    scaleRange = [0.72, 1.16],
    tilt = 0.18,
    buryDepth = CRYSTAL_INSTANCE_BURY_DEPTH
  } = {}) {
    if (this.variants.length === 0) {
      return null;
    }

    const variant = this.variants[Math.floor(rng() * this.variants.length) % this.variants.length];

    return [
      {
        batchKey: `procedural:${variant.key}`,
        build: variant.build,
        localMatrix: createCrystalMatrix(rng, { offset, scaleRange, tilt, buryDepth })
      }
    ];
  }

  createPatchInstances(rng, {
    countRange = [2, 5],
    radiusRange = [0.28, 1.05],
    scaleRange = [0.58, 1.22],
    tilt = 0.16
  } = {}) {
    const instances = [];
    const count = Math.floor(randomBetween(rng, countRange[0], countRange[1] + 0.999));
    const radius = randomBetween(rng, radiusRange[0], radiusRange[1]);

    for (let index = 0; index < count; index += 1) {
      const isAnchorCrystal = index === 0;
      const sizeBias = isAnchorCrystal
        ? randomBetween(rng, 1.08, 1.48)
        : randomBetween(rng, 0.42, 0.96);
      const instanceScaleRange = [
        scaleRange[0] * sizeBias,
        scaleRange[1] * sizeBias
      ];
      const single = this.createSingleInstances(rng, {
        offset: [0, 0, 0],
        scaleRange: instanceScaleRange,
        tilt: isAnchorCrystal ? tilt * 0.5 : tilt,
        buryDepth: isAnchorCrystal ? -0.22 : -0.18
      });

      if (!single) {
        continue;
      }

      const angle = (index / Math.max(count, 1)) * Math.PI * 2 + randomBetween(rng, -0.48, 0.48);
      const distance = isAnchorCrystal ? 0 : Math.sqrt(rng()) * radius;
      const offset = new THREE.Matrix4().makeTranslation(
        Math.cos(angle) * distance,
        0,
        Math.sin(angle) * distance
      );

      single.forEach((entry) => {
        instances.push({
          ...entry,
          localMatrix: new THREE.Matrix4().multiplyMatrices(
            offset,
            entry.localMatrix ?? IDENTITY_MATRIX
          )
        });
      });
    }

    return instances.length > 0 ? instances : null;
  }
}
