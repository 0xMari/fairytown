import * as THREE from "three";
import { InstanceBatchCollector } from "../InstanceBatchCollector.js";
import {
  addBucketInstance,
  buildBucketGroup,
  createTransformMatrix,
  randomBetween,
  randomChoice
} from "./ProceduralInstancing.js";
import {
  getAncientForestFactor,
  getCrystalFactor,
  getGladeFactor,
  getMossFactor,
  getSplatMapAt,
  smoothstep
} from "./ProceduralFields.js";

const MOSS_COLORS = ["#426f2f", "#5f8739", "#75a149", "#9ab65a"];
const CRYSTAL_COLORS = ["#b9ecff", "#d8c3ff", "#c4fff0", "#fff3af"];
const Y_AXIS = new THREE.Vector3(0, 1, 0);

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

function addMossPillow(buckets, rng, x, y, z, scale, color) {
  addBucketInstance(
    buckets,
    "mossBlob",
    createTransformMatrix({
      position: [x, y + 0.06 * scale, z],
      rotation: [rng() * Math.PI, rng() * Math.PI * 2, rng() * Math.PI],
      scale: [
        randomBetween(rng, 0.48, 1.35) * scale,
        randomBetween(rng, 0.08, 0.22) * scale,
        randomBetween(rng, 0.48, 1.2) * scale
      ]
    }),
    color
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

function addTinyCrystal(buckets, rng, x, y, z, scale) {
  addBucketInstance(
    buckets,
    "crystalShard",
    createTransformMatrix({
      position: [x, y + 0.01, z],
      rotation: [randomBetween(rng, -0.24, 0.24), rng() * Math.PI * 2, randomBetween(rng, -0.24, 0.24)],
      scale: [randomBetween(rng, 0.1, 0.22) * scale, randomBetween(rng, 0.32, 0.78) * scale, randomBetween(rng, 0.1, 0.22) * scale]
    }),
    randomChoice(rng, CRYSTAL_COLORS)
  );
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
    const buckets = new Map();
    const plantCollector = new InstanceBatchCollector();
    const grassLibrary = assetContext?.procedural?.grasses;
    const fernLibrary = assetContext?.procedural?.ferns;
    const flowerLibrary = assetContext?.procedural?.flowers;
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
        const mossDensity =
          (mushrooms * (0.46 + moss * 0.86) + meadow * forest * 0.24) *
          (splat.white * 1.08 + splat.gray * 0.24) *
          dryFactor;
        const flowerDensity = meadow * splat.gray * glade * (0.45 + (1 - forest) * 0.45) * dryFactor;
        const crystalDensity = crystal * crystalVein * (splat.white * 0.45 + splat.gray * 0.82) * dryFactor;
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

        if (rng() < mossDensity * 0.55) {
          addMossPillow(buckets, rng, localX, groundHeight, localZ, scale, randomChoice(rng, MOSS_COLORS));
          acceptedSamples += 1;
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
          addTinyCrystal(buckets, rng, localX, groundHeight, localZ, randomBetween(rng, 0.75, 1.7));
          acceptedSamples += 1;
        }
      }
    }

    const groundCover = buildBucketGroup(buckets);
    group.add(groundCover);
    plantCollector.flushInto(group);

    return group;
  }

  update() {}
}
