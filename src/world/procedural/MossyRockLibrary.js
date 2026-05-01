import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  buildInstancedGroupFromDescriptors,
  extractInstancedMeshDescriptors
} from "../instancedModelUtils.js";

const MOSSY_ROCK_MODELS = [
  {
    key: "mossy-rock-sketchfab",
    url: "/rocks/mossy_rock/scene.gltf",
    targetHeight: 0.62,
    modelSinkDepth: -0.025
  },
  {
    key: "mossy-rock-n081j",
    url: "/rocks/n081j_mossy_rock.glb",
    targetHeight: 0.56,
    modelSinkDepth: -0.035
  }
];
const MOSSY_ROCK_INSTANCE_SINK_DEPTH = -0.045;

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

function normalizeModel(root, { targetHeight, modelSinkDepth }) {
  const template = new THREE.Group();
  const content = root.clone(true);

  content.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(content);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const scale = size.y > 0 ? targetHeight / size.y : 1;

  content.position.x -= center.x * scale;
  content.position.y -= bounds.min.y * scale;
  content.position.y += modelSinkDepth;
  content.position.z -= center.z * scale;
  content.scale.multiplyScalar(scale);
  content.updateMatrixWorld(true);

  template.add(content);

  return template;
}

function tuneRockMaterials(root, maxAnisotropy) {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    child.castShadow = false;
    child.receiveShadow = true;

    forEachMaterial(child.material, (material) => {
      material.roughness = Math.max(material.roughness ?? 0.92, 0.92);
      material.metalness = 0;
      material.envMapIntensity = Math.min(material.envMapIntensity ?? 0.28, 0.28);

      if (material.map) {
        material.map.colorSpace = THREE.SRGBColorSpace;
      }

      if (material.normalScale) {
        material.normalScale.set(0.62, 0.62);
      }

      if (material.aoMap) {
        material.aoMapIntensity = 0.72;
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

function createRockMatrix({
  rng,
  offset = [0, 0, 0],
  scaleRange = [0.75, 1.28],
  tilt = 0.08,
  sinkDepth = MOSSY_ROCK_INSTANCE_SINK_DEPTH
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
    new THREE.Vector3(offset[0], offset[1] + sinkDepth * scale, offset[2]),
    rotation,
    new THREE.Vector3(
      scale * randomBetween(rng, 0.84, 1.26),
      scale * randomBetween(rng, 0.82, 1.14),
      scale * randomBetween(rng, 0.84, 1.26)
    )
  );
}

export class MossyRockLibrary {
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
      MOSSY_ROCK_MODELS.map(async (definition) => {
        const gltf = await this.loader.loadAsync(definition.url);
        const maxAnisotropy = renderer?.capabilities?.getMaxAnisotropy?.() ?? 1;
        const template = normalizeModel(gltf.scene, definition);

        tuneRockMaterials(template, maxAnisotropy);

        const descriptors = extractInstancedMeshDescriptors(template);
        const build = (placements) =>
          buildInstancedGroupFromDescriptors(descriptors, placements, {
            castShadow: false,
            receiveShadow: true
          });

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
    scaleRange = [0.75, 1.28],
    tilt = 0.08
  } = {}) {
    if (this.variants.length === 0) {
      return null;
    }

    const variant = this.variants[Math.floor(rng() * this.variants.length) % this.variants.length];

    return [
      {
        batchKey: `procedural:${variant.key}`,
        build: variant.build,
        localMatrix: createRockMatrix({ rng, offset, scaleRange, tilt })
      }
    ];
  }

  createPatchInstances(rng, {
    countRange = [1, 3],
    radiusRange = [0.22, 0.95],
    scaleRange = [0.72, 1.22],
    tilt = 0.1
  } = {}) {
    const instances = [];
    const count = Math.floor(randomBetween(rng, countRange[0], countRange[1] + 0.999));
    const radius = randomBetween(rng, radiusRange[0], radiusRange[1]);

    for (let index = 0; index < count; index += 1) {
      const angle = rng() * Math.PI * 2;
      const distance = Math.sqrt(rng()) * radius;
      const single = this.createSingleInstances(rng, {
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
