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

function setMeshShadows(object, { castShadow = false, receiveShadow = true } = {}) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    child.castShadow = castShadow;
    child.receiveShadow = receiveShadow;
  });
}

function normalizeTree(scene, targetHeight) {
  const template = new THREE.Group();
  const content = scene;

  content.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(content);
  const size = bounds.getSize(new THREE.Vector3());
  const scaleFactor = size.y > 0 ? targetHeight / size.y : 1;

  content.scale.multiplyScalar(scaleFactor);
  content.rotation.x = 0;
  content.rotation.z = 0;
  content.updateMatrixWorld(true);

  const scaledBounds = new THREE.Box3().setFromObject(content);
  const scaledCenter = scaledBounds.getCenter(new THREE.Vector3());

  content.position.x -= scaledCenter.x;
  content.position.y -= scaledBounds.min.y;
  content.position.z -= scaledCenter.z;
  content.updateMatrixWorld(true);

  const groundedBounds = new THREE.Box3().setFromObject(content);

  if (Math.abs(groundedBounds.min.y) > 1e-4) {
    content.position.y -= groundedBounds.min.y;
    content.updateMatrixWorld(true);
  }

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
          buildInstancedGroupFromDescriptors(this.descriptors.get(treeKey), placements, {
            castShadow: false,
            receiveShadow: true
          })
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
