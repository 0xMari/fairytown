import * as THREE from "three";
import { SELECTIVE_BLOOM_LAYER } from "../../rendering/bloom.js";

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const TEMP_DIRECTION = new THREE.Vector3();
const TEMP_MIDPOINT = new THREE.Vector3();
const TEMP_QUATERNION = new THREE.Quaternion();
const TEMP_SCALE = new THREE.Vector3();

export function randomBetween(rng, min, max) {
  return min + (max - min) * rng();
}

export function randomChoice(rng, choices) {
  return choices[Math.floor(rng() * choices.length) % choices.length];
}

export function createTransformMatrix({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1]
}) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(position[0], position[1], position[2]),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rotation[0], rotation[1], rotation[2])),
    new THREE.Vector3(scale[0], scale[1], scale[2])
  );
}

export function createBranchMatrix(start, end, radiusStart, radiusEnd = radiusStart) {
  TEMP_DIRECTION.subVectors(end, start);
  const length = TEMP_DIRECTION.length();

  if (length <= 0.0001) {
    return new THREE.Matrix4();
  }

  TEMP_DIRECTION.normalize();
  TEMP_MIDPOINT.copy(start).add(end).multiplyScalar(0.5);
  TEMP_QUATERNION.setFromUnitVectors(Y_AXIS, TEMP_DIRECTION);
  TEMP_SCALE.set((radiusStart + radiusEnd) * 0.5, length, (radiusStart + radiusEnd) * 0.5);

  return new THREE.Matrix4().compose(TEMP_MIDPOINT, TEMP_QUATERNION, TEMP_SCALE);
}

function createBladeGeometry({ width = 1, height = 1, bend = 0.12 } = {}) {
  const geometry = new THREE.BufferGeometry();
  const halfWidth = width * 0.5;
  const positions = new Float32Array([
    0, 0, 0,
    -halfWidth, height * 0.48, bend,
    0, height, 0,
    halfWidth, height * 0.48, -bend
  ]);
  const uvs = new Float32Array([
    0.5, 0,
    0, 0.48,
    0.5, 1,
    1, 0.48
  ]);

  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}

function createLeafCardGeometry() {
  const geometry = createBladeGeometry({ width: 0.74, height: 1.25, bend: 0.2 });
  geometry.translate(0, -0.03, 0);
  return geometry;
}

function createMaterial({
  color,
  roughness = 0.9,
  metalness = 0,
  emissive = "#000000",
  emissiveIntensity = 0,
  side = THREE.FrontSide,
  transparent = false,
  opacity = 1,
  toneMapped = true
}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    emissive,
    emissiveIntensity,
    side,
    transparent,
    opacity,
    vertexColors: true,
    toneMapped
  });
}

const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 8);
const thinCylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 6);
const leafBlobGeometry = new THREE.DodecahedronGeometry(1, 1);
const grassBladeGeometry = createBladeGeometry({ width: 0.16, height: 1, bend: 0.08 });
const fernBladeGeometry = createBladeGeometry({ width: 0.34, height: 1, bend: 0.18 });
const leafCardGeometry = createLeafCardGeometry();
const flowerHeadGeometry = new THREE.DodecahedronGeometry(1, 0);
const mushroomCapGeometry = new THREE.SphereGeometry(1, 12, 8);
const glowGeometry = new THREE.SphereGeometry(1, 10, 8);

const barkMaterial = createMaterial({
  color: "#6a4c35",
  roughness: 0.98,
  emissive: "#281a10",
  emissiveIntensity: 0.16
});
const vineMaterial = createMaterial({
  color: "#4d6f2e",
  roughness: 1,
  side: THREE.DoubleSide,
  emissive: "#203414",
  emissiveIntensity: 0.22
});
const leafMaterial = createMaterial({
  color: "#6fa146",
  roughness: 0.88,
  emissive: "#29441a",
  emissiveIntensity: 0.3
});
const leafCardMaterial = createMaterial({
  color: "#7cad54",
  roughness: 0.86,
  side: THREE.DoubleSide,
  emissive: "#2d4a1d",
  emissiveIntensity: 0.3
});
const grassMaterial = createMaterial({
  color: "#7dad4f",
  roughness: 0.95,
  side: THREE.DoubleSide,
  emissive: "#31461b",
  emissiveIntensity: 0.22
});
const fernMaterial = createMaterial({
  color: "#537b3d",
  roughness: 0.94,
  side: THREE.DoubleSide,
  emissive: "#223a1c",
  emissiveIntensity: 0.24
});
const flowerStemMaterial = createMaterial({
  color: "#5c8b42",
  roughness: 0.96,
  emissive: "#223a18",
  emissiveIntensity: 0.18
});
const flowerHeadMaterial = createMaterial({
  color: "#ffe278",
  roughness: 0.72,
  emissive: "#fff0a0",
  emissiveIntensity: 0.08
});
const mushroomStemMaterial = createMaterial({
  color: "#eadfc2",
  roughness: 0.88
});
const mushroomCapMaterial = createMaterial({
  color: "#d76745",
  roughness: 0.72,
  emissive: "#ffb68d",
  emissiveIntensity: 0.08
});
const glowMaterial = createMaterial({
  color: "#fff6aa",
  roughness: 0.35,
  emissive: "#fff2a6",
  emissiveIntensity: 1.9,
  toneMapped: false
});

const BATCH_DEFINITIONS = {
  bark: {
    geometry: cylinderGeometry,
    material: barkMaterial,
    castShadow: true,
    receiveShadow: true
  },
  branch: {
    geometry: cylinderGeometry,
    material: barkMaterial,
    castShadow: true,
    receiveShadow: true
  },
  vine: {
    geometry: thinCylinderGeometry,
    material: vineMaterial,
    castShadow: false,
    receiveShadow: false
  },
  leafBlob: {
    geometry: leafBlobGeometry,
    material: leafMaterial,
    castShadow: false,
    receiveShadow: false
  },
  leafCard: {
    geometry: leafCardGeometry,
    material: leafCardMaterial,
    castShadow: false,
    receiveShadow: false
  },
  grassBlade: {
    geometry: grassBladeGeometry,
    material: grassMaterial,
    castShadow: false,
    receiveShadow: false
  },
  fernBlade: {
    geometry: fernBladeGeometry,
    material: fernMaterial,
    castShadow: false,
    receiveShadow: false
  },
  flowerStem: {
    geometry: thinCylinderGeometry,
    material: flowerStemMaterial,
    castShadow: false,
    receiveShadow: false
  },
  flowerHead: {
    geometry: flowerHeadGeometry,
    material: flowerHeadMaterial,
    castShadow: false,
    receiveShadow: false
  },
  mushroomStem: {
    geometry: thinCylinderGeometry,
    material: mushroomStemMaterial,
    castShadow: false,
    receiveShadow: true
  },
  mushroomCap: {
    geometry: mushroomCapGeometry,
    material: mushroomCapMaterial,
    castShadow: false,
    receiveShadow: false
  },
  glowOrb: {
    geometry: glowGeometry,
    material: glowMaterial,
    castShadow: false,
    receiveShadow: false,
    bloom: true
  }
};

function buildInstancedMesh(kind, placements) {
  const batch = BATCH_DEFINITIONS[kind];

  if (!batch || placements.length === 0) {
    return null;
  }

  const mesh = new THREE.InstancedMesh(batch.geometry, batch.material, placements.length);

  placements.forEach((placement, index) => {
    mesh.setMatrixAt(index, placement.matrix);

    if (placement.color) {
      mesh.setColorAt(index, placement.color);
    }
  });

  mesh.instanceMatrix.needsUpdate = true;

  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }

  mesh.castShadow = batch.castShadow;
  mesh.receiveShadow = batch.receiveShadow;
  mesh.frustumCulled = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();

  if (batch.bloom) {
    mesh.layers.enable(SELECTIVE_BLOOM_LAYER);
  }

  return mesh;
}

Object.entries(BATCH_DEFINITIONS).forEach(([kind, batch]) => {
  batch.build = (placements) => buildInstancedMesh(kind, placements);
});

export function createProceduralInstance(kind, localMatrix, color = null) {
  const batch = BATCH_DEFINITIONS[kind];

  if (!batch) {
    return null;
  }

  return {
    batchKey: `procedural:${kind}`,
    build: batch.build,
    localMatrix: localMatrix.clone(),
    color: color ? new THREE.Color(color) : null
  };
}

export function addBucketInstance(buckets, kind, matrix, color = null) {
  if (!BATCH_DEFINITIONS[kind]) {
    return;
  }

  const entries = buckets.get(kind);
  const placement = {
    matrix: matrix.clone(),
    color: color ? new THREE.Color(color) : null
  };

  if (entries) {
    entries.push(placement);
    return;
  }

  buckets.set(kind, [placement]);
}

export function buildBucketGroup(buckets) {
  const group = new THREE.Group();

  for (const [kind, placements] of buckets.entries()) {
    const mesh = buildInstancedMesh(kind, placements);

    if (mesh) {
      group.add(mesh);
    }
  }

  return group;
}

export function enableBloom(object) {
  object.traverse((child) => {
    if (child.isMesh || child.isPoints) {
      child.layers.enable(SELECTIVE_BLOOM_LAYER);
    }
  });
}
