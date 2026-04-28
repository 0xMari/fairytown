import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  buildInstancedGroupFromDescriptors,
  extractInstancedMeshDescriptors
} from "../../instancedModelUtils.js";

const BEECH_FERN_URL = "/bushes/beech_fern_vmkpdbeia_ue_mid/standard/vmkpdbeia_tier_2_nonUE.gltf";
const BEECH_FERN_TARGET_HEIGHT = 0.72;
const ENABLED_VARIANTS = ["A", "B", "C", "D", "E", "F", "G", "H"];

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

function parseFernNodeName(name) {
  const match = /^SM_vmkpdbeia_Var([A-H])(?:_LOD(\d+))?$/i.exec(name ?? "");

  if (!match) {
    return null;
  }

  return {
    variant: match[1].toUpperCase(),
    lod: match[2] ? Number(match[2]) : 0
  };
}

function getVariantLodRoots(scene) {
  const variants = new Map();

  scene.children.forEach((child) => {
    const parsed = parseFernNodeName(child.name);

    if (!parsed || !ENABLED_VARIANTS.includes(parsed.variant)) {
      return;
    }

    let lods = variants.get(parsed.variant);

    if (!lods) {
      lods = new Map();
      variants.set(parsed.variant, lods);
    }

    lods.set(parsed.lod, child);
  });

  return ENABLED_VARIANTS.map((variant) => ({
    variant,
    lodRoots: variants.get(variant)
  })).filter((entry) => entry.lodRoots?.size > 0);
}

function getClosestLodRoot(lodRoots, desiredLod) {
  if (lodRoots.has(desiredLod)) {
    return lodRoots.get(desiredLod);
  }

  const sortedLods = [...lodRoots.keys()].sort(
    (left, right) => Math.abs(left - desiredLod) - Math.abs(right - desiredLod)
  );

  return lodRoots.get(sortedLods[0]);
}

function normalizeModel(root) {
  const template = new THREE.Group();
  const content = root.clone(true);

  content.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(content);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const scale = size.y > 0 ? BEECH_FERN_TARGET_HEIGHT / size.y : 1;

  content.position.x -= center.x * scale;
  content.position.y -= bounds.min.y * scale;
  content.position.z -= center.z * scale;
  content.scale.multiplyScalar(scale);
  content.updateMatrixWorld(true);

  template.add(content);

  return template;
}

function tuneFernMaterials(root, maxAnisotropy) {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    child.castShadow = false;
    child.receiveShadow = true;

    forEachMaterial(child.material, (material) => {
      material.side = THREE.DoubleSide;
      material.roughness = Math.max(material.roughness ?? 0.84, 0.84);
      material.metalness = 0;
      material.alphaTest = Math.max(material.alphaTest ?? 0, 0.32);
      material.transparent = false;
      material.depthWrite = true;
      material.depthTest = true;
      material.envMapIntensity = Math.min(material.envMapIntensity ?? 0.35, 0.35);
      material.emissive = material.emissive ?? new THREE.Color("#000000");
      material.emissive.lerp(new THREE.Color("#183015"), 0.45);
      material.emissiveIntensity = Math.max(material.emissiveIntensity ?? 0, 0.08);

      if (material.map) {
        material.map.colorSpace = THREE.SRGBColorSpace;
      }

      if (material.normalScale) {
        material.normalScale.set(0.45, 0.45);
      }

      if (material.aoMap) {
        material.aoMapIntensity = 0.55;
      }

      [
        material.map,
        material.alphaMap,
        material.normalMap,
        material.roughnessMap,
        material.metalnessMap,
        material.aoMap
      ].forEach((texture) => {
        if (texture) {
          texture.anisotropy = maxAnisotropy;
        }
      });

      material.needsUpdate = true;
    });
  });
}

function createFernPlacementMatrix({
  rng,
  offset = [0, 0, 0],
  scaleRange = [0.85, 1.25],
  tilt = 0.1
}) {
  const scale = randomBetween(rng, scaleRange[0], scaleRange[1]);
  const rotation = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(
      randomBetween(rng, -tilt, tilt),
      rng() * Math.PI * 2,
      randomBetween(rng, -tilt, tilt)
    )
  );

  return new THREE.Matrix4().compose(
    new THREE.Vector3(offset[0], offset[1] + 0.015, offset[2]),
    rotation,
    new THREE.Vector3(
      scale * randomBetween(rng, 0.9, 1.12),
      scale * randomBetween(rng, 0.9, 1.16),
      scale * randomBetween(rng, 0.9, 1.12)
    )
  );
}

function chooseLodIndex(lodFactor = 1) {
  // LOD3 is a billboard in this pack, so we avoid it until the alpha card setup is deliberately tuned.
  return lodFactor >= 0.95 ? 1 : 2;
}

export class BeechFernLibrary {
  constructor() {
    this.loader = new GLTFLoader();
    this.variants = [];
    this.loadPromise = null;
  }

  async load(renderer) {
    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = this.loader.loadAsync(BEECH_FERN_URL).then((gltf) => {
      const maxAnisotropy = renderer?.capabilities?.getMaxAnisotropy?.() ?? 1;
      const variantRoots = getVariantLodRoots(gltf.scene);

      this.variants = variantRoots.map(({ variant, lodRoots }) => {
        const lods = new Map();

        [1, 2].forEach((lodIndex) => {
          const root = getClosestLodRoot(lodRoots, lodIndex);
          const template = normalizeModel(root);
          tuneFernMaterials(template, maxAnisotropy);
          const descriptors = extractInstancedMeshDescriptors(template);
          const build = (placements) =>
            buildInstancedGroupFromDescriptors(descriptors, placements, {
              castShadow: false,
              receiveShadow: true
            });

          lods.set(lodIndex, {
            key: `beech-fern-${variant.toLowerCase()}-lod${lodIndex}`,
            build
          });
        });

        return { variant, lods };
      });
    });

    return this.loadPromise;
  }

  createSingleInstances(rng, {
    lodFactor = 1,
    offset = [0, 0, 0],
    scaleRange = [0.85, 1.25],
    tilt = 0.1
  } = {}) {
    if (this.variants.length === 0) {
      return null;
    }

    const variant = this.variants[Math.floor(rng() * this.variants.length) % this.variants.length];
    const lodIndex = chooseLodIndex(lodFactor);
    const lod = variant.lods.get(lodIndex) ?? variant.lods.get(2) ?? variant.lods.get(1);

    if (!lod) {
      return null;
    }

    return [
      {
        batchKey: `procedural:${lod.key}`,
        build: lod.build,
        localMatrix: createFernPlacementMatrix({ rng, offset, scaleRange, tilt })
      }
    ];
  }

  createPatchInstances(rng, {
    lodFactor = 1,
    countRange = [1, 3],
    radiusRange = [0.28, 1.05],
    scaleRange = [0.76, 1.18],
    tilt = 0.12
  } = {}) {
    const instances = [];
    const count = Math.floor(randomBetween(rng, countRange[0], countRange[1] + 0.999));
    const radius = randomBetween(rng, radiusRange[0], radiusRange[1]);

    for (let index = 0; index < count; index += 1) {
      const angle = (index / Math.max(count, 1)) * Math.PI * 2 + randomBetween(rng, -0.6, 0.6);
      const distance = Math.sqrt(rng()) * radius;
      const single = this.createSingleInstances(rng, {
        lodFactor,
        offset: [
          Math.cos(angle) * distance,
          0,
          Math.sin(angle) * distance
        ],
        scaleRange,
        tilt
      });

      if (single) {
        instances.push(...single);
      }
    }

    return instances.length > 0 ? instances : null;
  }

  createUnderstoryInstances(rng, {
    lodFactor = 1,
    trunkRadius = 0.72,
    countRange = [2, 5],
    radiusRange = [1.05, 3.5],
    scaleRange = [0.86, 1.34]
  } = {}) {
    const instances = [];
    const count = Math.floor(randomBetween(rng, countRange[0], countRange[1] + 0.999));
    const innerRadius = Math.max(0.65, trunkRadius * 1.05);
    const outerRadius = Math.max(innerRadius + 0.45, randomBetween(rng, radiusRange[0], radiusRange[1]));

    for (let index = 0; index < count; index += 1) {
      const angle = rng() * Math.PI * 2;
      const distance = randomBetween(rng, innerRadius, outerRadius);
      const single = this.createSingleInstances(rng, {
        lodFactor,
        offset: [
          Math.cos(angle) * distance,
          0,
          Math.sin(angle) * distance
        ],
        scaleRange,
        tilt: 0.09
      });

      if (single) {
        instances.push(...single);
      }
    }

    return instances.length > 0 ? instances : null;
  }
}
