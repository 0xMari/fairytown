import * as THREE from "three";
import { fbm2D } from "../noise.js";

const twigGeometry = new THREE.CylinderGeometry(1, 0.72, 1, 6, 1);
const fernGeometry = new THREE.ConeGeometry(1, 1, 5);
const cloverGeometry = new THREE.CircleGeometry(1, 7);
const fallenLeafGeometry = new THREE.CircleGeometry(1, 6);

const twigMaterial = new THREE.MeshStandardMaterial({
  color: "#5a3d25",
  roughness: 1,
  metalness: 0
});
const fernMaterial = new THREE.MeshStandardMaterial({
  color: "#ffffff",
  roughness: 0.96,
  metalness: 0
});
const cloverMaterial = new THREE.MeshStandardMaterial({
  color: "#ffffff",
  roughness: 1,
  metalness: 0,
  side: THREE.DoubleSide
});
const fallenLeafMaterial = new THREE.MeshStandardMaterial({
  color: "#ffffff",
  roughness: 1,
  metalness: 0,
  side: THREE.DoubleSide
});

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const FLAT_GROUND_QUATERNION = new THREE.Quaternion().setFromEuler(
  new THREE.Euler(-Math.PI / 2, 0, 0)
);

function randomBetween(rng, min, max) {
  return min + (max - min) * rng();
}

function smoothstep01(min, max, value) {
  const t = THREE.MathUtils.clamp((value - min) / (max - min), 0, 1);
  return t * t * (3 - 2 * t);
}

function sampleWarpedField(worldX, worldZ, seed, scale, offset) {
  const warpX =
    (fbm2D(
      (worldX + offset * 11) / 118,
      (worldZ - offset * 7) / 118,
      seed + offset,
      3,
      2.05,
      0.52
    ) -
      0.5) *
    18;
  const warpZ =
    (fbm2D(
      (worldX - offset * 5) / 132,
      (worldZ + offset * 13) / 132,
      seed + offset + 43,
      3,
      2.1,
      0.5
    ) -
      0.5) *
    18;

  return fbm2D(
    (worldX + warpX) / scale,
    (worldZ + warpZ) / scale,
    seed + offset + 97,
    4,
    2.04,
    0.52
  );
}

export function getMeadowGladeFactor(worldX, worldZ, seed) {
  const broad = sampleWarpedField(worldX, worldZ, seed, 82, 1301);
  const detail = sampleWarpedField(worldX + 90, worldZ - 120, seed, 36, 1381);
  const gladeField = broad * 0.78 + detail * 0.22;

  return smoothstep01(0.58, 0.78, gladeField);
}

export function getMeadowForestFactor(worldX, worldZ, seed) {
  return 1 - getMeadowGladeFactor(worldX, worldZ, seed);
}

function getBiomeWeight({
  localX,
  localZ,
  chunkX,
  chunkZ,
  chunkSize,
  getBiomeWeightsAtPosition
}) {
  if (!getBiomeWeightsAtPosition) {
    return 1;
  }

  const worldX = chunkX * chunkSize + localX;
  const worldZ = chunkZ * chunkSize + localZ;
  return getBiomeWeightsAtPosition(worldX, worldZ)?.meadow ?? 1;
}

function getTerrainHeight(terrain, localX, localZ) {
  return terrain?.getHeightAtLocalPosition?.(localX, localZ) ?? 0;
}

function getDryLandFactor(terrain, localX, localZ) {
  const waterPresence = terrain?.getWaterDataAtLocalPosition?.(localX, localZ)?.presence ?? 0;

  if (waterPresence > 0.14) {
    return 0;
  }

  return THREE.MathUtils.lerp(
    1,
    0,
    THREE.MathUtils.smoothstep(waterPresence, 0.04, 0.16)
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

function addFernUnderstory({
  group,
  rng,
  chunkSize,
  chunkX,
  chunkZ,
  seed,
  terrain,
  getBiomeWeightsAtPosition,
  densityAlpha
}) {
  const halfSize = chunkSize * 0.5;
  const step = THREE.MathUtils.lerp(7.2, 5.1, densityAlpha);
  const maxCount = Math.ceil((chunkSize / step) ** 2);
  const mesh = createInstancedMesh(fernGeometry, fernMaterial, maxCount);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();
  let count = 0;

  for (let x = -halfSize; x <= halfSize; x += step) {
    for (let z = -halfSize; z <= halfSize; z += step) {
      const localX = x + randomBetween(rng, -step * 0.45, step * 0.45);
      const localZ = z + randomBetween(rng, -step * 0.45, step * 0.45);
      const worldX = chunkX * chunkSize + localX;
      const worldZ = chunkZ * chunkSize + localZ;
      const biomeWeight = getBiomeWeight({
        localX,
        localZ,
        chunkX,
        chunkZ,
        chunkSize,
        getBiomeWeightsAtPosition
      });
      const forestFactor = getMeadowForestFactor(worldX, worldZ, seed);
      const dryLandFactor = getDryLandFactor(terrain, localX, localZ);
      const presence =
        biomeWeight *
        dryLandFactor *
        THREE.MathUtils.lerp(0.05, 1, forestFactor) *
        THREE.MathUtils.lerp(0.72, 1.15, sampleWarpedField(worldX, worldZ, seed, 18, 1511));

      if (presence < 0.18 || rng() > presence * 0.62) {
        continue;
      }

      const height = randomBetween(rng, 0.34, 0.9) * THREE.MathUtils.lerp(0.72, 1.18, forestFactor);

      euler.set(
        randomBetween(rng, -0.34, 0.34),
        rng() * Math.PI * 2,
        randomBetween(rng, -0.34, 0.34)
      );
      quaternion.setFromEuler(euler);
      position.set(localX, getTerrainHeight(terrain, localX, localZ) + height * 0.42, localZ);
      scale.set(randomBetween(rng, 0.035, 0.075), height, randomBetween(rng, 0.035, 0.08));
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(count, matrix);
      color.setHSL(
        THREE.MathUtils.lerp(0.24, 0.34, rng()),
        THREE.MathUtils.lerp(0.34, 0.58, rng()),
        THREE.MathUtils.lerp(0.3, 0.5, rng())
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

function addGladeClover({
  group,
  rng,
  chunkSize,
  chunkX,
  chunkZ,
  seed,
  terrain,
  getBiomeWeightsAtPosition,
  densityAlpha
}) {
  const halfSize = chunkSize * 0.5;
  const step = THREE.MathUtils.lerp(4.8, 3.15, densityAlpha);
  const maxCount = Math.ceil((chunkSize / step) ** 2);
  const mesh = createInstancedMesh(cloverGeometry, cloverMaterial, maxCount);
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
      const worldX = chunkX * chunkSize + localX;
      const worldZ = chunkZ * chunkSize + localZ;
      const biomeWeight = getBiomeWeight({
        localX,
        localZ,
        chunkX,
        chunkZ,
        chunkSize,
        getBiomeWeightsAtPosition
      });
      const gladeFactor = getMeadowGladeFactor(worldX, worldZ, seed);
      const dryLandFactor = getDryLandFactor(terrain, localX, localZ);
      const presence =
        biomeWeight *
        dryLandFactor *
        THREE.MathUtils.lerp(0.08, 1, gladeFactor) *
        THREE.MathUtils.lerp(0.72, 1.2, sampleWarpedField(worldX, worldZ, seed, 14, 1627));

      if (presence < 0.14 || rng() > presence * 0.58) {
        continue;
      }

      groundQuaternion.copy(FLAT_GROUND_QUATERNION);
      turnQuaternion.setFromAxisAngle(Y_AXIS, rng() * Math.PI * 2);
      groundQuaternion.premultiply(turnQuaternion);
      position.set(
        localX,
        getTerrainHeight(terrain, localX, localZ) + randomBetween(rng, 0.035, 0.065),
        localZ
      );
      scale.set(
        randomBetween(rng, 0.08, 0.18) * THREE.MathUtils.lerp(0.75, 1.24, gladeFactor),
        randomBetween(rng, 0.08, 0.18) * THREE.MathUtils.lerp(0.75, 1.24, gladeFactor),
        1
      );
      matrix.compose(position, groundQuaternion, scale);
      mesh.setMatrixAt(count, matrix);
      color.setHSL(
        THREE.MathUtils.lerp(0.22, 0.34, rng()),
        THREE.MathUtils.lerp(0.42, 0.66, rng()),
        THREE.MathUtils.lerp(0.3, 0.5, rng())
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

function addForestLitter({
  group,
  rng,
  chunkSize,
  chunkX,
  chunkZ,
  seed,
  terrain,
  getBiomeWeightsAtPosition,
  densityAlpha
}) {
  const halfSize = chunkSize * 0.5;
  const leafStep = THREE.MathUtils.lerp(5.6, 4.1, densityAlpha);
  const twigCount = Math.floor(randomBetween(rng, 5, 9) * THREE.MathUtils.lerp(0.45, 1, densityAlpha));
  const leafMaxCount = Math.ceil((chunkSize / leafStep) ** 2);
  const leafMesh = createInstancedMesh(fallenLeafGeometry, fallenLeafMaterial, leafMaxCount);
  const twigMesh = createInstancedMesh(twigGeometry, twigMaterial, twigCount);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const turnQuaternion = new THREE.Quaternion();
  const direction = new THREE.Vector3();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();
  let leaves = 0;
  let twigs = 0;

  for (let x = -halfSize; x <= halfSize; x += leafStep) {
    for (let z = -halfSize; z <= halfSize; z += leafStep) {
      const localX = x + randomBetween(rng, -leafStep * 0.48, leafStep * 0.48);
      const localZ = z + randomBetween(rng, -leafStep * 0.48, leafStep * 0.48);
      const worldX = chunkX * chunkSize + localX;
      const worldZ = chunkZ * chunkSize + localZ;
      const biomeWeight = getBiomeWeight({
        localX,
        localZ,
        chunkX,
        chunkZ,
        chunkSize,
        getBiomeWeightsAtPosition
      });
      const forestFactor = getMeadowForestFactor(worldX, worldZ, seed);
      const dryLandFactor = getDryLandFactor(terrain, localX, localZ);
      const presence = biomeWeight * dryLandFactor * THREE.MathUtils.lerp(0.04, 0.75, forestFactor);

      if (presence < 0.1 || rng() > presence) {
        continue;
      }

      quaternion.copy(FLAT_GROUND_QUATERNION);
      turnQuaternion.setFromAxisAngle(Y_AXIS, rng() * Math.PI * 2);
      quaternion.premultiply(turnQuaternion);
      position.set(
        localX,
        getTerrainHeight(terrain, localX, localZ) + randomBetween(rng, 0.04, 0.07),
        localZ
      );
      scale.set(randomBetween(rng, 0.07, 0.14), randomBetween(rng, 0.16, 0.3), 1);
      matrix.compose(position, quaternion, scale);
      leafMesh.setMatrixAt(leaves, matrix);
      color.setHSL(
        THREE.MathUtils.lerp(0.08, 0.16, rng()),
        THREE.MathUtils.lerp(0.26, 0.44, rng()),
        THREE.MathUtils.lerp(0.22, 0.38, rng())
      );
      leafMesh.setColorAt(leaves, color);
      leaves += 1;
    }
  }

  for (let index = 0; index < twigCount; index += 1) {
    const localX = randomBetween(rng, -halfSize * 0.86, halfSize * 0.86);
    const localZ = randomBetween(rng, -halfSize * 0.86, halfSize * 0.86);
    const worldX = chunkX * chunkSize + localX;
    const worldZ = chunkZ * chunkSize + localZ;
    const biomeWeight = getBiomeWeight({
      localX,
      localZ,
      chunkX,
      chunkZ,
      chunkSize,
      getBiomeWeightsAtPosition
    });
    const forestFactor = getMeadowForestFactor(worldX, worldZ, seed);

    if (biomeWeight < 0.2 || getDryLandFactor(terrain, localX, localZ) === 0 || rng() > forestFactor) {
      continue;
    }

    const angle = rng() * Math.PI * 2;
    const length = randomBetween(rng, 0.8, 2.1);
    const radius = randomBetween(rng, 0.018, 0.045);
    const dx = Math.cos(angle) * length * 0.5;
    const dz = Math.sin(angle) * length * 0.5;
    const startY = getTerrainHeight(terrain, localX - dx, localZ - dz) + radius * 0.6;
    const endY = getTerrainHeight(terrain, localX + dx, localZ + dz) + radius * 0.6;

    direction.set(dx * 2, endY - startY, dz * 2).normalize();
    quaternion.setFromUnitVectors(Y_AXIS, direction);
    position.set(localX, (startY + endY) * 0.5, localZ);
    scale.set(radius, length, radius * randomBetween(rng, 0.6, 1.25));
    matrix.compose(position, quaternion, scale);
    twigMesh.setMatrixAt(twigs, matrix);
    twigs += 1;
  }

  const finalLeaves = finalizeInstancedMesh(leafMesh, leaves);
  const finalTwigs = finalizeInstancedMesh(twigMesh, twigs);

  if (finalLeaves) {
    group.add(finalLeaves);
  }

  if (finalTwigs) {
    group.add(finalTwigs);
  }
}

export class MeadowForestKit {
  createDetails({
    chunkSize,
    chunkX,
    chunkZ,
    seed,
    rng,
    terrain,
    getBiomeWeightsAtPosition,
    lodFactor = 1
  }) {
    const group = new THREE.Group();
    const densityAlpha = smoothstep01(0.35, 1.15, THREE.MathUtils.clamp(lodFactor, 0.35, 1.15));
    const sharedOptions = {
      group,
      rng,
      chunkSize,
      chunkX,
      chunkZ,
      seed,
      terrain,
      getBiomeWeightsAtPosition,
      densityAlpha
    };

    addForestLitter(sharedOptions);
    addFernUnderstory(sharedOptions);
    addGladeClover(sharedOptions);

    return group;
  }
}
