import * as THREE from "three";
import { fbm2D } from "../noise.js";
import {
  getBiomeWeightFactor,
  getLocalTerrainHeight
} from "./MossLibrary.js";

const rootGeometry = new THREE.CylinderGeometry(1, 0.72, 1, 7, 1);
const twigGeometry = new THREE.CylinderGeometry(1, 0.78, 1, 5, 1);
const pebbleGeometry = new THREE.DodecahedronGeometry(1, 0);
const leafGeometry = new THREE.CircleGeometry(1, 6);
const sproutGeometry = new THREE.ConeGeometry(1, 1, 5);

const rootMaterial = new THREE.MeshStandardMaterial({
  color: "#3a2619",
  roughness: 1,
  metalness: 0
});
const twigMaterial = new THREE.MeshStandardMaterial({
  color: "#4c3321",
  roughness: 1,
  metalness: 0
});
const pebbleMaterial = new THREE.MeshStandardMaterial({
  color: "#ffffff",
  roughness: 1,
  metalness: 0
});
const leafMaterial = new THREE.MeshStandardMaterial({
  color: "#ffffff",
  roughness: 1,
  metalness: 0,
  side: THREE.DoubleSide
});
const sproutMaterial = new THREE.MeshStandardMaterial({
  color: "#ffffff",
  roughness: 1,
  metalness: 0
});

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const LEAF_GROUND_QUATERNION = new THREE.Quaternion().setFromEuler(
  new THREE.Euler(-Math.PI / 2, 0, 0)
);

function randomBetween(rng, min, max) {
  return min + (max - min) * rng();
}

function smoothstep01(min, max, value) {
  const t = THREE.MathUtils.clamp((value - min) / (max - min), 0, 1);
  return t * t * (3 - 2 * t);
}

function sampleOrganicField(worldX, worldZ, seed, scale, offset) {
  const broad = fbm2D(
    (worldX + offset * 17) / scale,
    (worldZ - offset * 11) / scale,
    seed + offset,
    4,
    2.08,
    0.52
  );
  const detail = fbm2D(
    (worldX - offset * 7) / (scale * 0.38),
    (worldZ + offset * 13) / (scale * 0.38),
    seed + offset + 97,
    3,
    2.16,
    0.48
  );

  return broad * 0.72 + detail * 0.28;
}

function getPlacementPresence({
  localX,
  localZ,
  chunkX,
  chunkZ,
  chunkSize,
  seed,
  biomeKey,
  terrain,
  getBiomeWeightsAtPosition,
  threshold = 0.36,
  scale = 32,
  offset = 1
}) {
  const waterPresence = terrain?.getWaterDataAtLocalPosition?.(localX, localZ)?.presence ?? 0;

  if (waterPresence > 0.14) {
    return 0;
  }

  const biomeWeight = getBiomeWeightFactor(
    localX,
    localZ,
    chunkX,
    chunkZ,
    chunkSize,
    biomeKey,
    getBiomeWeightsAtPosition
  );

  if (biomeWeight < 0.16) {
    return 0;
  }

  const worldX = chunkX * chunkSize + localX;
  const worldZ = chunkZ * chunkSize + localZ;
  const field = sampleOrganicField(worldX, worldZ, seed, scale, offset);
  const waterFade = THREE.MathUtils.lerp(
    1,
    0,
    THREE.MathUtils.smoothstep(waterPresence, 0.05, 0.16)
  );

  return (
    biomeWeight *
    smoothstep01(threshold, 0.9, field) *
    waterFade
  );
}

function createInstancedMesh(geometry, material, maxCount) {
  const mesh = new THREE.InstancedMesh(geometry, material, maxCount);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = true;
  return mesh;
}

function finalizeInstancedMesh(mesh, count) {
  if (count === 0) {
    mesh.dispose?.();
    return null;
  }

  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;

  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }

  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  return mesh;
}

function addRoots({
  group,
  rng,
  chunkSize,
  chunkX,
  chunkZ,
  seed,
  terrain,
  biomeKey,
  getBiomeWeightsAtPosition,
  densityAlpha
}) {
  const halfSize = chunkSize * 0.5;
  const rootCount = Math.floor(randomBetween(rng, 4, 8) * THREE.MathUtils.lerp(0.55, 1, densityAlpha));
  const rootMesh = createInstancedMesh(rootGeometry, rootMaterial, rootCount);
  const twigMesh = createInstancedMesh(twigGeometry, twigMaterial, rootCount * 2);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const direction = new THREE.Vector3();
  const position = new THREE.Vector3();
  let roots = 0;
  let twigs = 0;

  for (let index = 0; index < rootCount; index += 1) {
    const localX = randomBetween(rng, -halfSize * 0.86, halfSize * 0.86);
    const localZ = randomBetween(rng, -halfSize * 0.86, halfSize * 0.86);
    const presence = getPlacementPresence({
      localX,
      localZ,
      chunkX,
      chunkZ,
      chunkSize,
      seed,
      biomeKey,
      terrain,
      getBiomeWeightsAtPosition,
      threshold: 0.3,
      scale: 42,
      offset: 411
    });

    if (presence < 0.18 || rng() > presence) {
      continue;
    }

    const angle = rng() * Math.PI * 2;
    const length = randomBetween(rng, 2.3, 5.8) * THREE.MathUtils.lerp(0.75, 1.12, presence);
    const radius = randomBetween(rng, 0.035, 0.095);
    const dx = Math.cos(angle) * length * 0.5;
    const dz = Math.sin(angle) * length * 0.5;
    const startY = getLocalTerrainHeight(terrain, localX - dx, localZ - dz) + radius * 0.55;
    const endY = getLocalTerrainHeight(terrain, localX + dx, localZ + dz) + radius * 0.55;

    direction.set(dx * 2, endY - startY, dz * 2).normalize();
    quaternion.setFromUnitVectors(Y_AXIS, direction);
    position.set(localX, (startY + endY) * 0.5, localZ);
    matrix.compose(
      position,
      quaternion,
      new THREE.Vector3(radius, length, radius * randomBetween(rng, 0.72, 1.22))
    );
    rootMesh.setMatrixAt(roots, matrix);
    roots += 1;

    if (rng() > 0.52 && twigs < twigMesh.count) {
      const twigAngle = angle + randomBetween(rng, -0.85, 0.85);
      const twigLength = length * randomBetween(rng, 0.25, 0.48);
      const twigX = localX + Math.cos(angle) * randomBetween(rng, -length * 0.26, length * 0.26);
      const twigZ = localZ + Math.sin(angle) * randomBetween(rng, -length * 0.26, length * 0.26);
      const twigDx = Math.cos(twigAngle) * twigLength * 0.5;
      const twigDz = Math.sin(twigAngle) * twigLength * 0.5;
      const twigStartY = getLocalTerrainHeight(terrain, twigX - twigDx, twigZ - twigDz) + 0.028;
      const twigEndY = getLocalTerrainHeight(terrain, twigX + twigDx, twigZ + twigDz) + 0.028;

      direction.set(twigDx * 2, twigEndY - twigStartY, twigDz * 2).normalize();
      quaternion.setFromUnitVectors(Y_AXIS, direction);
      position.set(twigX, (twigStartY + twigEndY) * 0.5, twigZ);
      matrix.compose(
        position,
        quaternion,
        new THREE.Vector3(radius * 0.42, twigLength, radius * randomBetween(rng, 0.26, 0.42))
      );
      twigMesh.setMatrixAt(twigs, matrix);
      twigs += 1;
    }
  }

  const rootsFinal = finalizeInstancedMesh(rootMesh, roots);
  const twigsFinal = finalizeInstancedMesh(twigMesh, twigs);

  if (rootsFinal) {
    group.add(rootsFinal);
  }

  if (twigsFinal) {
    group.add(twigsFinal);
  }
}

function addPebbles({
  group,
  rng,
  chunkSize,
  chunkX,
  chunkZ,
  seed,
  terrain,
  biomeKey,
  getBiomeWeightsAtPosition,
  densityAlpha
}) {
  const halfSize = chunkSize * 0.5;
  const step = THREE.MathUtils.lerp(8.2, 5.8, densityAlpha);
  const maxCount = Math.ceil((chunkSize / step) ** 2);
  const mesh = createInstancedMesh(pebbleGeometry, pebbleMaterial, maxCount);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();
  let count = 0;

  for (let x = -halfSize; x <= halfSize; x += step) {
    for (let z = -halfSize; z <= halfSize; z += step) {
      const localX = x + randomBetween(rng, -step * 0.42, step * 0.42);
      const localZ = z + randomBetween(rng, -step * 0.42, step * 0.42);
      const presence = getPlacementPresence({
        localX,
        localZ,
        chunkX,
        chunkZ,
        chunkSize,
        seed,
        biomeKey,
        terrain,
        getBiomeWeightsAtPosition,
        threshold: 0.42,
        scale: 24,
        offset: 617
      });

      if (presence < 0.16 || rng() > presence * 0.42) {
        continue;
      }

      const radius = randomBetween(rng, 0.08, 0.36) * THREE.MathUtils.lerp(0.8, 1.18, presence);
      const height = randomBetween(rng, 0.035, 0.13);
      const terrainHeight = getLocalTerrainHeight(terrain, localX, localZ);

      euler.set(
        randomBetween(rng, -0.38, 0.38),
        rng() * Math.PI * 2,
        randomBetween(rng, -0.3, 0.3)
      );
      quaternion.setFromEuler(euler);
      position.set(localX, terrainHeight + height * 0.42, localZ);
      scale.set(radius, height, radius * randomBetween(rng, 0.72, 1.28));
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(count, matrix);
      color.setHSL(
        THREE.MathUtils.lerp(0.22, 0.34, rng()),
        THREE.MathUtils.lerp(0.08, 0.22, rng()),
        THREE.MathUtils.lerp(0.22, 0.42, rng())
      );
      mesh.setColorAt(count, color);
      count += 1;
    }
  }

  const finalMesh = finalizeInstancedMesh(mesh, count);

  if (finalMesh) {
    group.add(finalMesh);
  }
}

function addLeafLitter({
  group,
  rng,
  chunkSize,
  chunkX,
  chunkZ,
  seed,
  terrain,
  biomeKey,
  getBiomeWeightsAtPosition,
  densityAlpha
}) {
  const halfSize = chunkSize * 0.5;
  const step = THREE.MathUtils.lerp(4.4, 3.15, densityAlpha);
  const maxCount = Math.ceil((chunkSize / step) ** 2);
  const mesh = createInstancedMesh(leafGeometry, leafMaterial, maxCount);
  const matrix = new THREE.Matrix4();
  const groundQuaternion = new THREE.Quaternion();
  const turnQuaternion = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();
  let count = 0;

  for (let x = -halfSize; x <= halfSize; x += step) {
    for (let z = -halfSize; z <= halfSize; z += step) {
      const localX = x + randomBetween(rng, -step * 0.48, step * 0.48);
      const localZ = z + randomBetween(rng, -step * 0.48, step * 0.48);
      const presence = getPlacementPresence({
        localX,
        localZ,
        chunkX,
        chunkZ,
        chunkSize,
        seed,
        biomeKey,
        terrain,
        getBiomeWeightsAtPosition,
        threshold: 0.28,
        scale: 18,
        offset: 829
      });

      if (presence < 0.12 || rng() > THREE.MathUtils.lerp(0.08, 0.5, presence)) {
        continue;
      }

      groundQuaternion.copy(LEAF_GROUND_QUATERNION);
      turnQuaternion.setFromAxisAngle(Y_AXIS, rng() * Math.PI * 2);
      groundQuaternion.premultiply(turnQuaternion);
      position.set(
        localX,
        getLocalTerrainHeight(terrain, localX, localZ) + randomBetween(rng, 0.045, 0.075),
        localZ
      );
      scale.set(
        randomBetween(rng, 0.055, 0.105),
        randomBetween(rng, 0.12, 0.27),
        1
      );
      matrix.compose(position, groundQuaternion, scale);
      mesh.setMatrixAt(count, matrix);

      if (rng() < 0.42) {
        color.setHSL(THREE.MathUtils.lerp(0.08, 0.14, rng()), 0.44, randomBetween(rng, 0.24, 0.38));
      } else {
        color.setHSL(THREE.MathUtils.lerp(0.18, 0.28, rng()), 0.32, randomBetween(rng, 0.2, 0.34));
      }

      mesh.setColorAt(count, color);
      count += 1;
    }
  }

  const finalMesh = finalizeInstancedMesh(mesh, count);

  if (finalMesh) {
    group.add(finalMesh);
  }
}

function addSprouts({
  group,
  rng,
  chunkSize,
  chunkX,
  chunkZ,
  seed,
  terrain,
  biomeKey,
  getBiomeWeightsAtPosition,
  densityAlpha
}) {
  const halfSize = chunkSize * 0.5;
  const sproutCount = Math.floor(randomBetween(rng, 12, 22) * THREE.MathUtils.lerp(0.48, 1, densityAlpha));
  const mesh = createInstancedMesh(sproutGeometry, sproutMaterial, sproutCount);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();
  let count = 0;

  for (let index = 0; index < sproutCount; index += 1) {
    const localX = randomBetween(rng, -halfSize * 0.88, halfSize * 0.88);
    const localZ = randomBetween(rng, -halfSize * 0.88, halfSize * 0.88);
    const presence = getPlacementPresence({
      localX,
      localZ,
      chunkX,
      chunkZ,
      chunkSize,
      seed,
      biomeKey,
      terrain,
      getBiomeWeightsAtPosition,
      threshold: 0.46,
      scale: 21,
      offset: 1043
    });

    if (presence < 0.16 || rng() > presence * 0.65) {
      continue;
    }

    const height = randomBetween(rng, 0.18, 0.46);

    euler.set(randomBetween(rng, -0.34, 0.34), rng() * Math.PI * 2, randomBetween(rng, -0.34, 0.34));
    quaternion.setFromEuler(euler);
    position.set(localX, getLocalTerrainHeight(terrain, localX, localZ) + height * 0.42, localZ);
    scale.set(randomBetween(rng, 0.025, 0.055), height, randomBetween(rng, 0.025, 0.06));
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(count, matrix);
    color.setHSL(
      THREE.MathUtils.lerp(0.24, 0.34, rng()),
      THREE.MathUtils.lerp(0.32, 0.52, rng()),
      THREE.MathUtils.lerp(0.28, 0.46, rng())
    );
    mesh.setColorAt(count, color);
    count += 1;
  }

  const finalMesh = finalizeInstancedMesh(mesh, count);

  if (finalMesh) {
    group.add(finalMesh);
  }
}

export class ForestFloorKit {
  createDetails({
    chunkSize,
    chunkX,
    chunkZ,
    seed,
    rng,
    terrain,
    biomeKey,
    getBiomeWeightsAtPosition,
    lodFactor = 1
  }) {
    const group = new THREE.Group();
    const lodDensity = THREE.MathUtils.clamp(lodFactor, 0.35, 1.15);
    const densityAlpha = smoothstep01(0.35, 1.15, lodDensity);
    const sharedOptions = {
      group,
      rng,
      chunkSize,
      chunkX,
      chunkZ,
      seed,
      terrain,
      biomeKey,
      getBiomeWeightsAtPosition,
      densityAlpha
    };

    addRoots(sharedOptions);
    addPebbles(sharedOptions);
    addLeafLitter(sharedOptions);
    addSprouts(sharedOptions);

    return group;
  }
}
