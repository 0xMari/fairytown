import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { getMeadowGrassScaleAt } from "./FluffyGrassLibrary.js";
import {
  buildInstancedGroupFromDescriptors,
  extractInstancedMeshDescriptors
} from "../instancedModelUtils.js";

const FLOWER_MODEL_CONFIG = {
  blue: {
    url: "/flowers/flower_blue.glb",
    targetHeight: 0.95
  },
  white: {
    url: "/flowers/flower_white.glb",
    targetHeight: 0.89
  },
  yellow: {
    url: "/flowers/flower_yellow.glb",
    targetHeight: 0.80
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

function normalizeFlower(scene, targetHeight) {
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

function createColorJitter(rng) {
  return 0.92 + rng() * 0.16;
}

export class FlowerLibrary {
  constructor() {
    this.loader = new GLTFLoader();
    this.templates = new Map();
    this.descriptors = new Map();
    this.batchBuilders = new Map();
    this.keys = Object.keys(FLOWER_MODEL_CONFIG);
    this.loadPromise = null;
  }

  async load() {
    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = Promise.all(
      Object.entries(FLOWER_MODEL_CONFIG).map(async ([flowerKey, config]) => {
        const gltf = await this.loader.loadAsync(config.url);
        const template = normalizeFlower(gltf.scene, config.targetHeight);
        this.templates.set(flowerKey, template);
        this.descriptors.set(flowerKey, extractInstancedMeshDescriptors(template));
        this.batchBuilders.set(flowerKey, (placements) =>
          buildInstancedGroupFromDescriptors(this.descriptors.get(flowerKey), placements, {
            castShadow: false,
            receiveShadow: false
          })
        );
      })
    );

    return this.loadPromise;
  }

  createFlower(rng, placement = {}) {
    if (this.keys.length === 0) {
      return null;
    }

    const flowerKey = this.keys[Math.floor(rng() * this.keys.length)];
    const template = this.templates.get(flowerKey);

    if (!template) {
      return null;
    }

    const clone = template.clone(true);
    const wrapper = new THREE.Group();
    const colorJitter = createColorJitter(rng);
    const grassScale =
      placement.worldX !== undefined && placement.worldZ !== undefined && placement.seed !== undefined
        ? getMeadowGrassScaleAt(placement.worldX, placement.worldZ, placement.seed)
        : 1.35;
    const grassBlend = THREE.MathUtils.smoothstep(grassScale, 1.35, 5);
    const embeddedScale =
      THREE.MathUtils.lerp(0.92, 1.32, grassBlend) * THREE.MathUtils.lerp(0.96, 1.08, rng());
    const stemEmbedDepth = THREE.MathUtils.lerp(0.02, 0.16, grassBlend);

    clone.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) {
        return;
      }

      child.material = child.material.clone();

      if ("color" in child.material && child.material.color) {
        child.material.color.multiplyScalar(colorJitter);
      }
    });

    clone.scale.setScalar(embeddedScale);
    clone.position.y = -stemEmbedDepth;
    wrapper.add(clone);
    setMeshShadows(clone);

    return {
      object: wrapper
    };
  }

  createFlowerInstances(rng, placement = {}) {
    if (this.keys.length === 0) {
      return null;
    }

    const flowerKey = this.keys[Math.floor(rng() * this.keys.length)];
    const build = this.batchBuilders.get(flowerKey);

    if (!build) {
      return null;
    }

    const grassScale =
      placement.worldX !== undefined && placement.worldZ !== undefined && placement.seed !== undefined
        ? getMeadowGrassScaleAt(placement.worldX, placement.worldZ, placement.seed)
        : 1.35;
    const grassBlend = THREE.MathUtils.smoothstep(grassScale, 1.35, 5);
    const embeddedScale =
      THREE.MathUtils.lerp(0.92, 1.32, grassBlend) * THREE.MathUtils.lerp(0.96, 1.08, rng());
    const stemEmbedDepth = THREE.MathUtils.lerp(0.02, 0.16, grassBlend);
    const localMatrix = new THREE.Matrix4().compose(
      new THREE.Vector3(0, -stemEmbedDepth, 0),
      new THREE.Quaternion(),
      new THREE.Vector3(embeddedScale, embeddedScale, embeddedScale)
    );
    const jitter = createColorJitter(rng);

    return [
      {
        batchKey: `flower:${flowerKey}`,
        build,
        localMatrix,
        color: new THREE.Color(jitter, jitter, jitter)
      }
    ];
  }
}
