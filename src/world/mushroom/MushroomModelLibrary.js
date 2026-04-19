import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  buildInstancedGroupFromDescriptors,
  extractInstancedMeshDescriptors
} from "../instancedModelUtils.js";

const MUSHROOM_MODEL_CONFIG = {
  chanterelle: {
    url: "/mushrooms/chanterelle-mushroom/source/model.glb",
    targetHeight: 1.15
  },
  russula: {
    url: "/mushrooms/russula-brittlegill-mushroom/source/model.glb",
    targetHeight: 1.35
  }
};

function setMeshShadows(object) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    child.castShadow = true;
    child.receiveShadow = true;
  });
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

function tuneTemplateMaterials(object, maxAnisotropy) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    forEachMaterial(child.material, (material) => {
      material.roughness = Math.max(material.roughness ?? 0.8, 0.82);
      material.metalness = Math.min(material.metalness ?? 0, 0.08);

      [
        material.map,
        material.normalMap,
        material.roughnessMap,
        material.metalnessMap,
        material.aoMap
      ].forEach((texture) => {
        if (!texture) {
          return;
        }

        texture.anisotropy = maxAnisotropy;
      });

      material.needsUpdate = true;
    });
  });
}

function normalizeMushroom(scene, targetHeight) {
  const template = new THREE.Group();
  const content = scene;

  content.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(content);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const scaleFactor = size.y > 0 ? targetHeight / size.y : 1;

  content.position.x -= center.x * scaleFactor;
  content.position.y -= bounds.min.y * scaleFactor;
  content.position.z -= center.z * scaleFactor;
  content.scale.multiplyScalar(scaleFactor);

  template.add(content);
  setMeshShadows(template);

  return template;
}

function applyInstanceVariation(object, rng) {
  const tint = new THREE.Color().setHSL(
    THREE.MathUtils.lerp(0.01, 0.1, rng()),
    THREE.MathUtils.lerp(0.02, 0.1, rng()),
    THREE.MathUtils.lerp(0.92, 1.04, rng())
  );

  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    if (Array.isArray(child.material)) {
      child.material = child.material.map((material) => material.clone());
    } else if (child.material) {
      child.material = child.material.clone();
    }

    forEachMaterial(child.material, (material) => {
      if (material.color) {
        material.color.multiply(tint);
      }

      material.needsUpdate = true;
    });
  });
}

export class MushroomModelLibrary {
  constructor() {
    this.loader = new GLTFLoader();
    this.templates = new Map();
    this.descriptors = new Map();
    this.batchBuilders = new Map();
    this.keys = Object.keys(MUSHROOM_MODEL_CONFIG);
    this.loadPromise = null;
  }

  async load(renderer) {
    if (this.loadPromise) {
      return this.loadPromise;
    }

    const maxAnisotropy = renderer?.capabilities?.getMaxAnisotropy?.() ?? 1;

    this.loadPromise = Promise.all(
      Object.entries(MUSHROOM_MODEL_CONFIG).map(async ([mushroomKey, config]) => {
        const gltf = await this.loader.loadAsync(config.url);
        const template = normalizeMushroom(gltf.scene, config.targetHeight);
        tuneTemplateMaterials(template, maxAnisotropy);
        this.templates.set(mushroomKey, template);
        this.descriptors.set(mushroomKey, extractInstancedMeshDescriptors(template));
        this.batchBuilders.set(mushroomKey, (placements) =>
          buildInstancedGroupFromDescriptors(this.descriptors.get(mushroomKey), placements)
        );
      })
    );

    return this.loadPromise;
  }

  createSingleMushroom(rng, scaleRange = [0.92, 1.08]) {
    if (this.keys.length === 0) {
      return null;
    }

    const mushroomKey = this.keys[Math.floor(rng() * this.keys.length)];
    const template = this.templates.get(mushroomKey);

    if (!template) {
      return null;
    }

    const wrapper = new THREE.Group();
    const clone = template.clone(true);
    const scale = THREE.MathUtils.lerp(scaleRange[0], scaleRange[1], rng());

    applyInstanceVariation(clone, rng);
    clone.rotation.y = rng() * Math.PI * 2;
    clone.scale.setScalar(scale);
    wrapper.add(clone);
    setMeshShadows(wrapper);

    return {
      object: wrapper
    };
  }

  createSingleMushroomInstances(rng, scaleRange = [0.92, 1.08]) {
    if (this.keys.length === 0) {
      return null;
    }

    const mushroomKey = this.keys[Math.floor(rng() * this.keys.length)];
    const build = this.batchBuilders.get(mushroomKey);

    if (!build) {
      return null;
    }

    const scale = THREE.MathUtils.lerp(scaleRange[0], scaleRange[1], rng());
    const localMatrix = new THREE.Matrix4().compose(
      new THREE.Vector3(0, 0, 0),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * Math.PI * 2),
      new THREE.Vector3(scale, scale, scale)
    );

    return [
      {
        batchKey: `mushroom:${mushroomKey}`,
        build,
        localMatrix,
        color: new THREE.Color().setHSL(
          THREE.MathUtils.lerp(0.01, 0.1, rng()),
          THREE.MathUtils.lerp(0.02, 0.1, rng()),
          THREE.MathUtils.lerp(0.92, 1.04, rng())
        )
      }
    ];
  }

  createMushroomPatch(rng) {
    const group = new THREE.Group();
    const count = 3 + Math.floor(rng() * 3);
    const radius = THREE.MathUtils.lerp(0.85, 1.55, rng());

    for (let index = 0; index < count; index += 1) {
      const built = this.createSingleMushroom(rng, [0.56, 0.88]);

      if (!built) {
        continue;
      }

      const angle = (index / count) * Math.PI * 2 + THREE.MathUtils.lerp(-0.4, 0.4, rng());
      const localRadius = radius * THREE.MathUtils.lerp(0.82, 1.22, rng());

      built.object.position.set(
        Math.cos(angle) * localRadius,
        0,
        Math.sin(angle) * localRadius
      );
      group.add(built.object);
    }

    if (rng() > 0.45) {
      const centerMushroom = this.createSingleMushroom(rng, [0.42, 0.68]);

      if (centerMushroom) {
        centerMushroom.object.position.set(
          THREE.MathUtils.lerp(-0.08, 0.08, rng()),
          0,
          THREE.MathUtils.lerp(-0.08, 0.08, rng())
        );
        group.add(centerMushroom.object);
      }
    }

    return {
      object: group
    };
  }

  createMushroomPatchInstances(rng) {
    const instances = [];
    const count = 3 + Math.floor(rng() * 3);
    const radius = THREE.MathUtils.lerp(0.85, 1.55, rng());

    for (let index = 0; index < count; index += 1) {
      const single = this.createSingleMushroomInstances(rng, [0.56, 0.88]);

      if (!single) {
        continue;
      }

      const angle = (index / count) * Math.PI * 2 + THREE.MathUtils.lerp(-0.4, 0.4, rng());
      const localRadius = radius * THREE.MathUtils.lerp(0.82, 1.22, rng());
      const patchOffset = new THREE.Matrix4().makeTranslation(
        Math.cos(angle) * localRadius,
        0,
        Math.sin(angle) * localRadius
      );

      single.forEach((entry) => {
        const localMatrix = new THREE.Matrix4().multiplyMatrices(
          patchOffset,
          entry.localMatrix ?? new THREE.Matrix4()
        );

        instances.push({
          ...entry,
          localMatrix
        });
      });
    }

    if (rng() > 0.45) {
      const centerMushroom = this.createSingleMushroomInstances(rng, [0.42, 0.68]);

      centerMushroom?.forEach((entry) => {
        const centerOffset = new THREE.Matrix4().makeTranslation(
          THREE.MathUtils.lerp(-0.08, 0.08, rng()),
          0,
          THREE.MathUtils.lerp(-0.08, 0.08, rng())
        );
        const localMatrix = new THREE.Matrix4().multiplyMatrices(
          centerOffset,
          entry.localMatrix ?? new THREE.Matrix4()
        );

        instances.push({
          ...entry,
          localMatrix
        });
      });
    }

    return instances.length > 0 ? instances : null;
  }
}
