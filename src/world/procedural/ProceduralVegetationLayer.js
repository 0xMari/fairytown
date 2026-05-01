import * as THREE from "three";
import { InstanceBatchCollector } from "../InstanceBatchCollector.js";
import { randomBetween } from "./ProceduralInstancing.js";
import {
  getAncientForestFactor,
  getCrystalFactor,
  getGladeFactor,
  getMossFactor,
  getSplatMapAt,
  smoothstep
} from "./ProceduralFields.js";

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const TEMP_NORMAL = new THREE.Vector3();
const TEMP_ALIGNMENT = new THREE.Quaternion();
const TEMP_TWIST = new THREE.Quaternion();
const TEMP_SCALE = new THREE.Vector3(1, 1, 1);

function getGroundBiomeWeights({ biomeKey, natureBiomeKey, getBiomeWeightsAtPosition, worldX, worldZ }) {
  const weights = getBiomeWeightsAtPosition?.(worldX, worldZ) ?? {
    meadow: biomeKey === "meadow" ? 1 : 0,
    mushrooms: biomeKey === "mushrooms" ? 1 : 0,
    crystal: biomeKey === "crystal" ? 1 : 0
  };

  if (biomeKey !== "village") {
    return weights;
  }

  return {
    meadow: natureBiomeKey === "meadow" ? 1 : 0,
    mushrooms: natureBiomeKey === "mushrooms" ? 1 : 0,
    crystal: natureBiomeKey === "crystal" ? 1 : 0
  };
}

function getTerrainNormalAtLocalPosition(terrain, localX, localZ, sampleDistance = 1.6) {
  const centerHeight = terrain?.getHeightAtLocalPosition?.(localX, localZ) ?? 0;
  const left = terrain?.getHeightAtLocalPosition?.(localX - sampleDistance, localZ) ?? centerHeight;
  const right = terrain?.getHeightAtLocalPosition?.(localX + sampleDistance, localZ) ?? centerHeight;
  const back = terrain?.getHeightAtLocalPosition?.(localX, localZ - sampleDistance) ?? centerHeight;
  const forward = terrain?.getHeightAtLocalPosition?.(localX, localZ + sampleDistance) ?? centerHeight;

  return TEMP_NORMAL
    .set(left - right, sampleDistance * 2, back - forward)
    .normalize()
    .lerp(Y_AXIS, 0.24)
    .normalize();
}

function createTerrainAlignedMatrix({ rng, x, y, z, normal }) {
  TEMP_ALIGNMENT.setFromUnitVectors(Y_AXIS, normal);
  TEMP_TWIST.setFromAxisAngle(normal, rng() * Math.PI * 2).multiply(TEMP_ALIGNMENT);

  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    TEMP_TWIST,
    TEMP_SCALE
  );
}

function addModelPatch({
  collector,
  library,
  rng,
  x,
  y,
  z,
  lodFactor,
  countRange,
  radiusRange,
  scaleRange,
  tilt
}) {
  const instances = library?.createPatchInstances?.(rng, {
    lodFactor,
    countRange,
    radiusRange,
    scaleRange,
    tilt
  });

  if (!instances) {
    return false;
  }

  const rootMatrix = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromAxisAngle(Y_AXIS, rng() * Math.PI * 2),
    new THREE.Vector3(1, 1, 1)
  );

  collector.queue(instances, rootMatrix);

  return true;
}

export class ProceduralVegetationLayer {
  constructor() {}

  createChunkLayer({
    chunkSize,
    chunkX,
    chunkZ,
    seed,
    rng,
    assetContext,
    terrain,
    biomeKey,
    natureBiomeKey,
    getBiomeWeightsAtPosition,
    lodFactor = 1
  }) {
    const group = new THREE.Group();
    const plantCollector = new InstanceBatchCollector();
    const grassLibrary = assetContext?.procedural?.grasses;
    const fernLibrary = assetContext?.procedural?.ferns;
    const flowerLibrary = assetContext?.procedural?.flowers;
    const crystalLibrary = assetContext?.procedural?.crystals;
    const mossyRockLibrary = assetContext?.procedural?.mossyRocks;
    const halfSize = chunkSize * 0.5;
    const lodDensity = THREE.MathUtils.clamp(lodFactor, 0.38, 1.15);
    const spacing = THREE.MathUtils.lerp(3.2, 1.45, lodDensity);
    const jitter = spacing * 0.46;
    const maxGroundSamples = Math.floor(420 * lodDensity);
    let acceptedSamples = 0;

    for (let x = -halfSize; x <= halfSize; x += spacing) {
      for (let z = -halfSize; z <= halfSize; z += spacing) {
        if (acceptedSamples >= maxGroundSamples) {
          break;
        }

        const localX = x + randomBetween(rng, -jitter, jitter);
        const localZ = z + randomBetween(rng, -jitter, jitter);
        const worldX = chunkX * chunkSize + localX;
        const worldZ = chunkZ * chunkSize + localZ;
        const waterPresence = terrain?.getWaterDataAtLocalPosition?.(localX, localZ)?.presence ?? 0;

        if (waterPresence > 0.13) {
          continue;
        }

        const weights = getGroundBiomeWeights({
          biomeKey,
          natureBiomeKey,
          getBiomeWeightsAtPosition,
          worldX,
          worldZ
        });
        const meadow = weights.meadow ?? 0;
        const mushrooms = weights.mushrooms ?? 0;
        const crystal = weights.crystal ?? 0;
        const crystalPresence = smoothstep(0.52, 0.72, crystal);
        const canPlaceMossyRocks = biomeKey === "meadow" || biomeKey === "mushrooms";
        const glade = getGladeFactor(worldX, worldZ, seed);
        const forest = getAncientForestFactor(worldX, worldZ, seed);
        const moss = getMossFactor(worldX, worldZ, seed);
        const crystalVein = getCrystalFactor(worldX, worldZ, seed);
        const splat = getSplatMapAt(worldX, worldZ, seed, waterPresence);

        if (splat.black > 0.62) {
          continue;
        }

        const groundHeight = terrain?.getHeightAtLocalPosition?.(localX, localZ) ?? 0;
        const dryFactor = 1 - smoothstep(0.04, 0.16, waterPresence);
        const meadowGrass = meadow * splat.gray * (0.42 + glade * 0.72) * dryFactor;
        const fernDensity =
          (mushrooms * 0.72 + meadow * forest * 0.38 + crystal * 0.2) *
          (splat.white * 0.36 + splat.gray * 0.18) *
          dryFactor;
        const mossyRockDensity =
          (mushrooms * (0.3 + moss * 0.62) + meadow * forest * 0.22) *
          (splat.white * 0.54 + splat.gray * 0.18) *
          (canPlaceMossyRocks ? 1 : 0) *
          (1 - crystalPresence) *
          dryFactor;
        const flowerDensity = meadow * splat.gray * glade * (0.45 + (1 - forest) * 0.45) * dryFactor;
        const crystalDensity =
          crystalPresence *
          (0.32 + crystalVein * 0.78) *
          (splat.white * 0.45 + splat.gray * 0.82) *
          dryFactor;
        const scale = THREE.MathUtils.lerp(0.75, 1.45, moss * 0.55 + glade * 0.45);

        if (
          rng() < meadowGrass * 0.52 &&
          addModelPatch({
            collector: plantCollector,
            library: grassLibrary,
            rng,
            x: localX,
            y: groundHeight,
            z: localZ,
            lodFactor,
            countRange: [1, 2],
            radiusRange: [0.14, 0.56],
            scaleRange: [0.78 * scale, 1.22 * scale],
            tilt: 0.08
          })
        ) {
          acceptedSamples += 1;
        }

        if (
          rng() < fernDensity * 0.24 &&
          addModelPatch({
            collector: plantCollector,
            library: fernLibrary,
            rng,
            x: localX,
            y: groundHeight,
            z: localZ,
            lodFactor,
            countRange: [1, 2],
            radiusRange: [0.22, 0.82],
            scaleRange: [0.68 * scale, 1.08 * scale],
            tilt: 0.09
          })
        ) {
          acceptedSamples += 1;
        }

        if (rng() < mossyRockDensity * 0.035) {
          const rockInstances = mossyRockLibrary?.createSingleInstances?.(rng, {
            scaleRange: [0.72 * scale, 1.28 * scale],
            tilt: 0.1
          });

          if (rockInstances) {
            const terrainNormal = getTerrainNormalAtLocalPosition(terrain, localX, localZ);
            const rootMatrix = createTerrainAlignedMatrix({
              rng,
              x: localX,
              y: groundHeight,
              z: localZ,
              normal: terrainNormal
            });

            plantCollector.queue(rockInstances, rootMatrix);
            acceptedSamples += 1;
          }
        }

        if (
          rng() < flowerDensity * 0.24 &&
          addModelPatch({
            collector: plantCollector,
            library: flowerLibrary,
            rng,
            x: localX + randomBetween(rng, -0.22, 0.22),
            y: groundHeight,
            z: localZ + randomBetween(rng, -0.22, 0.22),
            lodFactor,
            countRange: [1, 3],
            radiusRange: [0.12, 0.48],
            scaleRange: [0.72 * scale, 1.16 * scale],
            tilt: 0.07
          })
        ) {
          acceptedSamples += 1;
        }

        if (rng() < crystalDensity * 0.38) {
          const crystalInstances = crystalLibrary?.createSingleInstances?.(rng, {
            scaleRange: [0.24 * scale, 0.68 * scale],
            tilt: 0.14
          });

          if (crystalInstances) {
            const rootMatrix = new THREE.Matrix4().compose(
              new THREE.Vector3(localX, groundHeight, localZ),
              new THREE.Quaternion().setFromAxisAngle(Y_AXIS, rng() * Math.PI * 2),
              new THREE.Vector3(1, 1, 1)
            );

            plantCollector.queue(crystalInstances, rootMatrix);
            acceptedSamples += 1;
          }
        }
      }
    }

    plantCollector.flushInto(group);

    return group;
  }

  update() {}
}
