import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  buildInstancedGroupFromDescriptors,
  extractInstancedMeshDescriptors
} from "../../instancedModelUtils.js";

const DEFAULT_VARIANTS = ["A", "B", "C", "D", "E", "F", "G", "H"];

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

function parsePlantNodeName(name, prefix) {
  const match = new RegExp(`^SM_${prefix}_Var([A-H])(?:_LOD(\\d+))?$`, "i").exec(name ?? "");

  if (!match) {
    return null;
  }

  return {
    variant: match[1].toUpperCase(),
    lod: match[2] ? Number(match[2]) : 0
  };
}

function getVariantLodRoots(scene, prefix, enabledVariants) {
  const variants = new Map();

  scene.children.forEach((child) => {
    const parsed = parsePlantNodeName(child.name, prefix);

    if (!parsed || !enabledVariants.includes(parsed.variant)) {
      return;
    }

    let lods = variants.get(parsed.variant);

    if (!lods) {
      lods = new Map();
      variants.set(parsed.variant, lods);
    }

    lods.set(parsed.lod, child);
  });

  return enabledVariants.map((variant) => ({
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

function normalizeModel(root, targetHeight) {
  const template = new THREE.Group();
  const content = root.clone(true);

  content.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(content);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const scale = size.y > 0 ? targetHeight / size.y : 1;

  content.position.x -= center.x * scale;
  content.position.y -= bounds.min.y * scale;
  content.position.z -= center.z * scale;
  content.scale.multiplyScalar(scale);
  content.updateMatrixWorld(true);

  template.add(content);

  return template;
}

function tunePlantMaterials(root, maxAnisotropy, materialOptions) {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    child.castShadow = false;
    child.receiveShadow = true;

    forEachMaterial(child.material, (material) => {
      material.side = THREE.DoubleSide;
      material.roughness = Math.max(material.roughness ?? materialOptions.roughness, materialOptions.roughness);
      material.metalness = 0;
      material.alphaTest = Math.max(material.alphaTest ?? 0, materialOptions.alphaTest);
      material.transparent = false;
      material.depthWrite = true;
      material.depthTest = true;
      material.envMapIntensity = Math.min(material.envMapIntensity ?? materialOptions.envMapIntensity, materialOptions.envMapIntensity);
      material.emissive = material.emissive ?? new THREE.Color("#000000");
      material.emissive.lerp(new THREE.Color(materialOptions.emissive), materialOptions.emissiveMix);
      material.emissiveIntensity = Math.max(material.emissiveIntensity ?? 0, materialOptions.emissiveIntensity);

      if (material.map) {
        material.map.colorSpace = THREE.SRGBColorSpace;
      }

      if (material.normalScale) {
        material.normalScale.set(materialOptions.normalScale, materialOptions.normalScale);
      }

      if (material.aoMap) {
        material.aoMapIntensity = materialOptions.aoIntensity;
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

function createPlacementMatrix({
  rng,
  offset = [0, 0, 0],
  scaleRange = [0.85, 1.2],
  tilt = 0.08,
  sink = 0
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
    new THREE.Vector3(offset[0], offset[1] + sink, offset[2]),
    rotation,
    new THREE.Vector3(
      scale * randomBetween(rng, 0.9, 1.12),
      scale * randomBetween(rng, 0.9, 1.14),
      scale * randomBetween(rng, 0.9, 1.12)
    )
  );
}

export class MegascansPlantLibrary {
  constructor({
    keyPrefix,
    packs,
    targetHeight,
    enabledVariants = DEFAULT_VARIANTS,
    preferredLods = [1, 2],
    materialOptions = {},
    sink = 0
  }) {
    this.keyPrefix = keyPrefix;
    this.packs = packs;
    this.targetHeight = targetHeight;
    this.enabledVariants = enabledVariants;
    this.preferredLods = preferredLods;
    this.materialOptions = {
      alphaTest: 0.32,
      roughness: 0.86,
      envMapIntensity: 0.3,
      emissive: "#183015",
      emissiveMix: 0.4,
      emissiveIntensity: 0.06,
      normalScale: 0.5,
      aoIntensity: 0.62,
      ...materialOptions
    };
    this.sink = sink;
    this.loader = new GLTFLoader();
    this.variants = [];
    this.loadPromise = null;
  }

  chooseLodIndex(lodFactor = 1) {
    return lodFactor >= 0.95
      ? this.preferredLods[0]
      : this.preferredLods[1] ?? this.preferredLods[0];
  }

  async load(renderer) {
    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = Promise.all(
      this.packs.map((pack) => this.loader.loadAsync(pack.url).then((gltf) => ({ gltf, pack })))
    ).then((loadedPacks) => {
      const maxAnisotropy = renderer?.capabilities?.getMaxAnisotropy?.() ?? 1;

      this.variants = loadedPacks.flatMap(({ gltf, pack }) => {
        const variantRoots = getVariantLodRoots(gltf.scene, pack.prefix, this.enabledVariants);

        return variantRoots.map(({ variant, lodRoots }) => {
          const lods = new Map();

          this.preferredLods.forEach((lodIndex) => {
            const root = getClosestLodRoot(lodRoots, lodIndex);
            const template = normalizeModel(root, pack.targetHeight ?? this.targetHeight);
            tunePlantMaterials(template, maxAnisotropy, this.materialOptions);
            const descriptors = extractInstancedMeshDescriptors(template);
            const build = (placements) =>
              buildInstancedGroupFromDescriptors(descriptors, placements, {
                castShadow: false,
                receiveShadow: true
              });

            lods.set(lodIndex, {
              key: `${this.keyPrefix}-${pack.key}-${variant.toLowerCase()}-lod${lodIndex}`,
              build
            });
          });

          return {
            packKey: pack.key,
            variant,
            lods
          };
        });
      });
    });

    return this.loadPromise;
  }

  createSingleInstances(rng, {
    lodFactor = 1,
    offset = [0, 0, 0],
    scaleRange = [0.85, 1.2],
    tilt = 0.08
  } = {}) {
    if (this.variants.length === 0) {
      return null;
    }

    const variant = this.variants[Math.floor(rng() * this.variants.length) % this.variants.length];
    const lodIndex = this.chooseLodIndex(lodFactor);
    const lod = variant.lods.get(lodIndex) ?? variant.lods.get(this.preferredLods.at(-1)) ?? variant.lods.values().next().value;

    if (!lod) {
      return null;
    }

    return [
      {
        batchKey: `procedural:${lod.key}`,
        build: lod.build,
        localMatrix: createPlacementMatrix({
          rng,
          offset,
          scaleRange,
          tilt,
          sink: this.sink
        })
      }
    ];
  }

  createPatchInstances(rng, {
    lodFactor = 1,
    countRange = [1, 2],
    radiusRange = [0.18, 0.72],
    scaleRange = [0.8, 1.18],
    tilt = 0.08
  } = {}) {
    const instances = [];
    const count = Math.floor(randomBetween(rng, countRange[0], countRange[1] + 0.999));
    const radius = randomBetween(rng, radiusRange[0], radiusRange[1]);

    for (let index = 0; index < count; index += 1) {
      const angle = (index / Math.max(count, 1)) * Math.PI * 2 + randomBetween(rng, -0.55, 0.55);
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
}
