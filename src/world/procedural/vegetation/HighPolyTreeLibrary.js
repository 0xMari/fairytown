import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  buildInstancedGroupFromDescriptors,
  extractInstancedMeshDescriptors
} from "../../instancedModelUtils.js";

const TREE_MODEL_URLS = [
  {
    key: "old-tree",
    url: "/trees/old_tree/scene.gltf",
    fixedScale: 1.3,
    rootScaleOverride: 1,
    buryOffset: -2.5,
    groundOffset: -0.42,
    maxTerrainNormalTilt: 0.14,
    textureBase: "/trees/old_tree/textures/",
    maps: {
      oldtrunk: {
        map: "oldtrunk_diffuse.jpeg",
        normalMap: "oldtrunk_normal.png"
      },
      old_treetop: {
        map: "old_treetop_diffuse.png",
        normalMap: "old_treetop_normal.png"
      },
      leaf_old_tree: {
        map: "leaf_old_tree_diffuse.png",
        normalMap: "leaf_old_tree_normal.png"
      }
    }
  },
  {
    key: "tree-gn",
    url: "/trees/tree_gn/scene.gltf",
    buryOffset: -0.32,
    groundOffset: -0.26,
    maxTerrainNormalTilt: 0.18,
    textureBase: "/trees/tree_gn/textures/",
    maps: {
      clusterb: {
        map: "ClusterB_diffuse.png",
        normalMap: "ClusterB_normal.png"
      },
      vinesb: {
        map: "VinesB_diffuse.png",
        normalMap: "VinesB_normal.png"
      },
      clusterb2: {
        map: "ClusterB2_diffuse.png",
        normalMap: "ClusterB_normal.png"
      },
      barkb: {
        map: "BarkB_diffuse.png",
        normalMap: "BarkB_normal.png"
      },
      pruneb: {
        map: "PruneB_diffuse.png",
        normalMap: "PruneB_normal.png"
      },
      cortexb: {
        map: "CortexB_diffuse.png",
        normalMap: "CortexB_normal.png"
      }
    }
  },
  {
    key: "oak-trees",
    url: "/trees/oak_trees/scene.gltf",
    targetHeight: 15,
    fixedScale: 1,
    rootScaleOverride: 1,
    baseRadius: 1.6,
    buryOffset: -0.08,
    groundOffset: -0.48,
    maxTerrainNormalTilt: 0.12,
    textureBase: "/trees/oak_trees/textures/",
    maps: {
      bark1: {
        map: "bark1_baseColor.png",
        normalMap: "bark1_normal.png",
        roughnessMap: "bark1_metallicRoughness.png"
      },
      leaf1: {
        map: "leaf1_baseColor.png",
        normalMap: "leaf1_normal.png",
        roughnessMap: "leaf1_metallicRoughness.png"
      }
    }
  }
];
const TREE_TARGET_HEIGHT = 11.5;
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const textureLoader = new THREE.TextureLoader();

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

function getVariantRoots(root) {
  return [root];
}

function materialName(material) {
  if (Array.isArray(material)) {
    return material.map((entry) => entry?.name ?? "").join(" ").toLowerCase();
  }

  return material?.name?.toLowerCase?.() ?? "";
}

function looksLikeTrunkMesh(mesh) {
  const name = `${mesh.name ?? ""} ${materialName(mesh.material)}`.toLowerCase();

  return (
    name.includes("trunk") ||
    name.includes("bark") ||
    name.includes("cortex") ||
    name.includes("prune")
  );
}

function getGroundAnchorY(root, fallbackBounds) {
  const trunkBounds = new THREE.Box3();
  let foundTrunk = false;

  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !looksLikeTrunkMesh(child)) {
      return;
    }

    child.updateMatrixWorld(true);
    trunkBounds.expandByObject(child);
    foundTrunk = true;
  });

  return foundTrunk ? trunkBounds.min.y : fallbackBounds.min.y;
}

function normalizeModel(root, definition) {
  const template = new THREE.Group();
  const content = root.clone(true);

  content.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(content);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const targetHeight = definition.targetHeight ?? TREE_TARGET_HEIGHT;
  const scale = size.y > 0 ? targetHeight / size.y : 1;
  const anchorY = getGroundAnchorY(content, bounds);

  content.position.x -= center.x * scale;
  content.position.y -= anchorY * scale;
  content.position.y += definition.buryOffset ?? 0;
  content.position.z -= center.z * scale;
  content.scale.multiplyScalar(scale);
  content.updateMatrixWorld(true);

  template.add(content);

  return template;
}

async function loadTreeTextures(definition) {
  const entries = await Promise.all(
    Object.entries(definition.maps).map(async ([materialKey, textureNames]) => {
      const mapEntries = await Promise.all(
        Object.entries(textureNames).map(async ([slot, filename]) => {
          const texture = await textureLoader.loadAsync(`${definition.textureBase}${filename}`);
          texture.colorSpace = slot === "map" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
          texture.flipY = false;
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;

          return [slot, texture];
        })
      );

      return [materialKey, Object.fromEntries(mapEntries)];
    })
  );

  return Object.fromEntries(entries);
}

function applyModelTextures(root, texturesByMaterialName) {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    forEachMaterial(child.material, (material) => {
      const key = material.name?.toLowerCase?.() ?? "";
      const textureSet = texturesByMaterialName[key];

      if (!textureSet) {
        return;
      }

      material.map = textureSet.map ?? material.map;
      material.normalMap = textureSet.normalMap ?? material.normalMap;
      material.roughnessMap = textureSet.roughnessMap ?? material.roughnessMap;
      material.metalnessMap = textureSet.metalnessMap ?? material.metalnessMap;
      material.color?.set?.("#ffffff");
      material.needsUpdate = true;
    });
  });
}

function tuneTreeMaterials(root, maxAnisotropy) {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    child.castShadow = true;
    child.receiveShadow = true;

    forEachMaterial(child.material, (material) => {
      const name = material.name?.toLowerCase?.() ?? "";
      const looksLikeLeaf = name.includes("leaf") || name.includes("leaves");

      material.side = looksLikeLeaf ? THREE.DoubleSide : THREE.FrontSide;
      material.roughness = Math.max(material.roughness ?? 0.82, looksLikeLeaf ? 0.76 : 0.9);
      material.metalness = 0;
      material.alphaTest = looksLikeLeaf ? Math.max(material.alphaTest ?? 0, 0.32) : material.alphaTest ?? 0;
      material.transparent = false;
      material.depthWrite = true;
      material.depthTest = true;
      material.envMapIntensity = Math.min(material.envMapIntensity ?? 0.32, 0.32);
      material.emissive = material.emissive ?? new THREE.Color("#000000");
      material.emissive.lerp(new THREE.Color(looksLikeLeaf ? "#1f3515" : "#21140c"), looksLikeLeaf ? 0.28 : 0.16);
      material.emissiveIntensity = Math.max(material.emissiveIntensity ?? 0, looksLikeLeaf ? 0.05 : 0.03);

      if (material.map) {
        material.map.colorSpace = THREE.SRGBColorSpace;
      }

      if (material.normalScale) {
        material.normalScale.set(0.48, 0.48);
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

function createTreeMatrix(rng, {
  offset = [0, 0, 0],
  scaleRange = [0.7, 1.3],
  yScaleRange = [0.9, 1.1],
  fixedScale = null
} = {}) {
  const scale = fixedScale ?? randomBetween(rng, scaleRange[0], scaleRange[1]);
  const yScale = fixedScale ?? scale * randomBetween(rng, yScaleRange[0], yScaleRange[1]);

  return new THREE.Matrix4().compose(
    new THREE.Vector3(offset[0], offset[1], offset[2]),
    new THREE.Quaternion().setFromAxisAngle(Y_AXIS, rng() * Math.PI * 2),
    new THREE.Vector3(scale, yScale, scale)
  );
}

export class HighPolyTreeLibrary {
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
      TREE_MODEL_URLS.map(async (definition) => {
        const [gltf, texturesByMaterialName] = await Promise.all([
          this.loader.loadAsync(definition.url),
          loadTreeTextures(definition)
        ]);

        applyModelTextures(gltf.scene, texturesByMaterialName);

        return {
          definition,
          root: gltf.scene
        };
      })
    ).then((loadedTrees) => {
      const maxAnisotropy = renderer?.capabilities?.getMaxAnisotropy?.() ?? 1;
      const variants = loadedTrees.flatMap(({ definition, root }) =>
        getVariantRoots(root).map((variantRoot) => ({
          definition,
          root: variantRoot
        }))
      );

      this.variants = variants.map(({ definition, root }, index) => {
        const template = normalizeModel(root, definition);
        tuneTreeMaterials(template, maxAnisotropy);
        const descriptors = extractInstancedMeshDescriptors(template);
        const build = (placements) =>
          buildInstancedGroupFromDescriptors(descriptors, placements, {
            castShadow: true,
            receiveShadow: true
          });

        return {
          key: `${definition.key}-${index}`,
          fixedScale: definition.fixedScale ?? null,
          rootScaleOverride: definition.rootScaleOverride ?? null,
          groundOffset: definition.groundOffset ?? -0.24,
          maxTerrainNormalTilt: definition.maxTerrainNormalTilt ?? 0.16,
          baseRadius: definition.baseRadius ?? 0.82,
          targetHeight: definition.targetHeight ?? TREE_TARGET_HEIGHT,
          build
        };
      });
      this.variantCount = this.variants.length;
    });

    return this.loadPromise;
  }

  createTreeInstances(rng, {
    scaleRange = [0.7, 1.3],
    yScaleRange = [0.9, 1.1],
    includeSaplings = true,
    fernLibrary = null,
    lodFactor = 1
  } = {}) {
    if (this.variants.length === 0) {
      return null;
    }

    const instances = [];
    const variant = this.variants[Math.floor(rng() * this.variants.length) % this.variants.length];

    instances.push({
      batchKey: `procedural:${variant.key}`,
      build: variant.build,
      localMatrix: createTreeMatrix(rng, {
        scaleRange,
        yScaleRange,
        fixedScale: variant.fixedScale
      })
    });

    if (includeSaplings && fernLibrary && rng() < 0.72) {
      const fernInstances = fernLibrary.createUnderstoryInstances?.(rng, {
        lodFactor,
        trunkRadius: 1.05,
        countRange: [2, 5],
        radiusRange: [1.25, 4.2],
        scaleRange: [0.82, 1.3]
      });

      if (fernInstances) {
        instances.push(...fernInstances);
      }
    }

    return {
      instances,
      rootScaleOverride: variant.rootScaleOverride,
      groundOffset: variant.groundOffset,
      maxTerrainNormalTilt: variant.maxTerrainNormalTilt,
      baseRadius: variant.baseRadius,
      height: variant.targetHeight * (variant.fixedScale ?? 1)
    };
  }

  createSaplingInstances(rng) {
    const built = this.createTreeInstances(rng, {
      scaleRange: [0.18, 0.38],
      yScaleRange: [0.82, 1.2],
      includeSaplings: false
    });

    if (!built) {
      return null;
    }

    return {
      ...built,
      baseRadius: 0.26,
      height: TREE_TARGET_HEIGHT * 0.3
    };
  }
}
