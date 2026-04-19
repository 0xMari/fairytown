import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  buildInstancedGroupFromDescriptors,
  extractInstancedMeshDescriptors
} from "../instancedModelUtils.js";

const BUSH_MODEL_CONFIG = {
  bush1: {
    url: "/bushes/bush1.glb",
    targetWidth: 2.6,
    targetHeight: 1.8
  },
  bush2: {
    url: "/bushes/bush2.glb",
    targetWidth: 2.2,
    targetHeight: 1.55
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

function normalizeBush(scene, config) {
  const template = new THREE.Group();
  const content = scene;

  content.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(content);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const width = Math.max(size.x, size.z);
  const widthScale = width > 0 ? config.targetWidth / width : 1;
  const heightScale = size.y > 0 ? config.targetHeight / size.y : 1;
  const scaleFactor = Math.min(widthScale, heightScale);

  content.position.x -= center.x * scaleFactor;
  content.position.y -= bounds.min.y * scaleFactor;
  content.position.z -= center.z * scaleFactor;
  content.scale.multiplyScalar(scaleFactor);

  template.add(content);
  setMeshShadows(template);

  return template;
}

function createColorVariation(rng) {
  const color = new THREE.Color("#7caf63");
  const hsl = {};
  color.getHSL(hsl);
  color.setHSL(
    hsl.h + (rng() - 0.5) * 0.035,
    THREE.MathUtils.clamp(hsl.s + (rng() - 0.5) * 0.08, 0, 1),
    THREE.MathUtils.clamp(hsl.l + (rng() - 0.5) * 0.08, 0, 1)
  );
  return color;
}

export class BushLibrary {
  constructor() {
    this.loader = new GLTFLoader();
    this.templates = new Map();
    this.descriptors = new Map();
    this.batchBuilders = new Map();
    this.keys = Object.keys(BUSH_MODEL_CONFIG);
    this.loadPromise = null;
  }

  async load() {
    if (this.loadPromise) {
      return this.loadPromise;
    }

    const entries = Object.entries(BUSH_MODEL_CONFIG);

    this.loadPromise = Promise.all(
      entries.map(async ([bushKey, config]) => {
        const gltf = await this.loader.loadAsync(config.url);
        const template = normalizeBush(gltf.scene, config);
        this.templates.set(bushKey, template);
        this.descriptors.set(bushKey, extractInstancedMeshDescriptors(template));
        this.batchBuilders.set(bushKey, (placements) =>
          buildInstancedGroupFromDescriptors(this.descriptors.get(bushKey), placements, {
            castShadow: false,
            receiveShadow: true
          })
        );
      })
    );

    return this.loadPromise;
  }

  createBush(rng) {
    if (this.keys.length === 0) {
      return null;
    }

    const bushKey = this.keys[Math.floor(rng() * this.keys.length)];
    const template = this.templates.get(bushKey);

    if (!template) {
      return null;
    }

    const clone = template.clone(true);
    const tint = createColorVariation(rng);

    clone.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) {
        return;
      }

      child.material = child.material.clone();

      if ("color" in child.material && child.material.color) {
        child.material.color.multiply(tint);
      }

      if ("emissive" in child.material && child.material.emissive) {
        child.material.emissive.multiplyScalar(0.9);
      }
    });

    setMeshShadows(clone);

    return {
      object: clone
    };
  }

  createBushInstances(rng) {
    if (this.keys.length === 0) {
      return null;
    }

    const bushKey = this.keys[Math.floor(rng() * this.keys.length)];
    const build = this.batchBuilders.get(bushKey);

    if (!build) {
      return null;
    }

    return [
      {
        batchKey: `bush:${bushKey}`,
        build,
        color: createColorVariation(rng)
      }
    ];
  }
}
