import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  buildInstancedGroupFromDescriptors,
  extractInstancedMeshDescriptors
} from "./instancedModelUtils.js";

const TREE_MODEL_CONFIG = {
  fairyTree: {
    url: "/trees/ashM.glb",
    targetHeight: 9
  },
  twistedTree: {
    url: "/trees/oakL.glb",
    targetHeight: 10
  },
  silverTree: {
    url: "/trees/aspenL.glb",
    targetHeight: 11
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

function normalizeTree(scene, targetHeight) {
  const template = new THREE.Group();
  const content = scene;

  content.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(content);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const scaleFactor = size.y > 0 ? targetHeight / size.y : 1;

  content.position.x -= center.x;
  content.position.y -= bounds.min.y;
  content.position.z -= center.z;
  content.scale.multiplyScalar(scaleFactor);

  template.add(content);
  setMeshShadows(template);

  return template;
}

export class TreeLibrary {
  constructor() {
    this.loader = new GLTFLoader();
    this.templates = new Map();
    this.descriptors = new Map();
    this.batchBuilders = new Map();
    this.targetHeights = new Map();
    this.loadPromise = null;
  }

  async load() {
    if (this.loadPromise) {
      return this.loadPromise;
    }

    const entries = Object.entries(TREE_MODEL_CONFIG);

    this.loadPromise = Promise.all(
      entries.map(async ([treeKey, config]) => {
        const gltf = await this.loader.loadAsync(config.url);
        const template = normalizeTree(gltf.scene, config.targetHeight);
        this.templates.set(treeKey, template);
        this.descriptors.set(treeKey, extractInstancedMeshDescriptors(template));
        this.batchBuilders.set(treeKey, (placements) =>
          buildInstancedGroupFromDescriptors(this.descriptors.get(treeKey), placements)
        );
        this.targetHeights.set(treeKey, config.targetHeight);
      })
    );

    return this.loadPromise;
  }

  createTree(treeKey, options = {}) {
    const template = this.templates.get(treeKey);

    if (!template) {
      return null;
    }

    const clone = template.clone(true);
    const baseHeight = this.targetHeights.get(treeKey) ?? 1;
    const requestedHeight = options.targetHeight ?? null;

    if (requestedHeight) {
      clone.scale.multiplyScalar(requestedHeight / baseHeight);
    }

    setMeshShadows(clone);

    return {
      object: clone
    };
  }

  createTreeInstances(treeKey, options = {}) {
    const descriptors = this.descriptors.get(treeKey);
    const build = this.batchBuilders.get(treeKey);

    if (!descriptors || !build) {
      return null;
    }

    const baseHeight = this.targetHeights.get(treeKey) ?? 1;
    const requestedHeight = options.targetHeight ?? baseHeight;
    const scale = requestedHeight / baseHeight;

    return [
      {
        batchKey: `tree:${treeKey}`,
        build,
        localMatrix: new THREE.Matrix4().makeScale(scale, scale, scale)
      }
    ];
  }
}
