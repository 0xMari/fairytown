import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  buildInstancedGroupFromDescriptors,
  extractInstancedMeshDescriptors
} from "../instancedModelUtils.js";

const SPOTTED_MUSHROOM_URL = "/mushrooms/spotted_red_mushrooms_rdlvw_mid.glb";
const SPOTTED_MUSHROOM_TARGET_HEIGHT = 1.05;
const SPOTTED_MUSHROOM_BURY_DEPTH = -0.18;
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const IDENTITY_MATRIX = new THREE.Matrix4();

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
  const scale = size.y > 0 ? SPOTTED_MUSHROOM_TARGET_HEIGHT / size.y : 1;

  content.position.x -= center.x * scale;
  content.position.y -= bounds.min.y * scale;
  content.position.z -= center.z * scale;
  content.scale.multiplyScalar(scale);
  content.updateMatrixWorld(true);

  template.add(content);

  return template;
}

function getVariantRoots(scene) {
  const directVariants = scene.children.filter((child) => {
    let hasMesh = false;

    child.traverse((entry) => {
      if (entry instanceof THREE.Mesh) {
        hasMesh = true;
      }
    });

    return hasMesh;
  });

  if (directVariants.length > 1) {
    return directVariants;
  }

  const meshVariants = [];

  scene.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      meshVariants.push(child);
    }
  });

  return meshVariants.length > 0 ? meshVariants : [scene];
}

function tuneModelMaterials(root, maxAnisotropy) {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    child.castShadow = true;
    child.receiveShadow = true;

    forEachMaterial(child.material, (material) => {
      material.roughness = Math.max(material.roughness ?? 0.75, 0.78);
      material.metalness = Math.min(material.metalness ?? 0, 0.04);

      if (material.map) {
        material.map.colorSpace = THREE.SRGBColorSpace;
      }

      [
        material.map,
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

export class SpottedMushroomLibrary {
  constructor() {
    this.loader = new GLTFLoader();
    this.variants = [];
    this.loadPromise = null;
  }

  async load(renderer) {
    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = this.loader.loadAsync(SPOTTED_MUSHROOM_URL).then((gltf) => {
      const maxAnisotropy = renderer?.capabilities?.getMaxAnisotropy?.() ?? 1;
      const variants = getVariantRoots(gltf.scene);

      this.variants = variants.map((root, index) => {
        const template = normalizeModel(root);
        tuneModelMaterials(template, maxAnisotropy);
        const descriptors = extractInstancedMeshDescriptors(template);
        const build = (placements) =>
          buildInstancedGroupFromDescriptors(descriptors, placements, {
            castShadow: true,
            receiveShadow: true
          });

        return {
          key: `spotted-red-mushroom-${index}`,
          build
        };
      });
    });

    return this.loadPromise;
  }

  createSingleInstances(rng, scaleRange = [0.72, 1.08]) {
    if (this.variants.length === 0) {
      return null;
    }

    const variant = this.variants[Math.floor(rng() * this.variants.length) % this.variants.length];
    const scale = THREE.MathUtils.lerp(scaleRange[0], scaleRange[1], rng());
    const localMatrix = new THREE.Matrix4().compose(
      new THREE.Vector3(0, SPOTTED_MUSHROOM_BURY_DEPTH, 0),
      new THREE.Quaternion().setFromAxisAngle(Y_AXIS, rng() * Math.PI * 2),
      new THREE.Vector3(scale, scale, scale)
    );

    return [
      {
        batchKey: `procedural:${variant.key}`,
        build: variant.build,
        localMatrix
      }
    ];
  }

  createPatchInstances(rng) {
    const instances = [];
    const count = 2 + Math.floor(rng() * 4);
    const radius = THREE.MathUtils.lerp(0.65, 1.45, rng());

    for (let index = 0; index < count; index += 1) {
      const single = this.createSingleInstances(rng, [0.46, 0.82]);

      if (!single) {
        continue;
      }

      const angle = (index / count) * Math.PI * 2 + THREE.MathUtils.lerp(-0.38, 0.38, rng());
      const offset = new THREE.Matrix4().makeTranslation(
        Math.cos(angle) * radius * THREE.MathUtils.lerp(0.72, 1.22, rng()),
        0,
        Math.sin(angle) * radius * THREE.MathUtils.lerp(0.72, 1.22, rng())
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
