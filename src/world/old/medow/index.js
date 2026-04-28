import * as THREE from "three";
import { FluffyGrassLibrary } from "./FluffyGrassLibrary.js";
import { BushLibrary } from "./BushLibrary.js";
import { FlowerLibrary } from "./FlowerLibrary.js";
import { MeadowGroundLibrary } from "./MeadowGroundLibrary.js";
import {
  getMeadowGladeFactor,
  MeadowForestKit
} from "./MeadowForestKit.js";

export const MEDOW_BIOME = {
  name: "Sunlit Meadow",
  groundColor: "#9cd36c",
  groundTint: "#b9e78e",
  fogColor: "#efdff4",
  fogDensity: 0.0031,
  skyColor: "#c7e6ff",
  accentColor: "#fff3a6",
  assetMix: {
    fairyTree: { count: [11, 17], scale: [0.82, 1.22] },
    bush: { count: [13, 21], scale: [0.68, 1.12] },
    flowerPatch: { count: [52, 86], scale: [0.86, 1.3] },
    rockCluster: { count: [2, 4], scale: [0.58, 1.02] },
    fireflyCluster: { count: [2, 4], scale: [0.95, 1.22] }
  },
  getSpawnDensity({ assetName, worldX, worldZ, seed, biomeWeight, waterPresence }) {
    if (waterPresence > 0.14 || biomeWeight < 0.12) {
      return 0;
    }

    const gladeFactor = getMeadowGladeFactor(worldX, worldZ, seed);
    const forestFactor = 1 - gladeFactor;
    const gladeEdgeFactor =
      1 - Math.abs(gladeFactor - 0.48) / 0.48;

    if (assetName === "flowerPatch") {
      return THREE.MathUtils.lerp(0.16, 2.15, gladeFactor);
    }

    if (assetName === "fairyTree") {
      return THREE.MathUtils.lerp(0.08, 1.18, forestFactor);
    }

    if (assetName === "bush") {
      return THREE.MathUtils.lerp(0.16, 1.05, forestFactor) +
        Math.max(0, gladeEdgeFactor) * 0.42;
    }

    if (assetName === "fireflyCluster") {
      return THREE.MathUtils.lerp(0.62, 1.24, gladeFactor);
    }

    return THREE.MathUtils.lerp(0.24, 0.74, forestFactor);
  },
  createChunkAdditions({
    group,
    chunkSize,
    chunkX,
    chunkZ,
    seed,
    rng,
    assetContext,
    terrain,
    getBiomeWeightsAtPosition,
    lodFactor
  }) {
    const fluffyGrass = assetContext?.medow?.fluffyGrass;

    if (fluffyGrass) {
      const groundCover = fluffyGrass.createGroundCover({
        chunkSize,
        chunkX,
        chunkZ,
        seed,
        rng,
        lodFactor,
        terrain,
        getBiomeWeightsAtPosition,
        spacing: 0.95,
        spacingLodRange: [1.45, 1],
        maxInstances: 700,
        densityMultiplier: 0.94,
        scaleMultiplier: 0.58,
        minPresence: 0.08,
        batchMode: "single",
        getDensityAtPosition({ worldX, worldZ }) {
          const gladeFactor = getMeadowGladeFactor(worldX, worldZ, seed);
          const gladeEdgeFactor = Math.max(0, 1 - Math.abs(gladeFactor - 0.48) / 0.48);

          return THREE.MathUtils.lerp(0.08, 1.12, gladeFactor) + gladeEdgeFactor * 0.16;
        }
      });

      if (groundCover?.object) {
        group.add(groundCover.object);
      }
    }

    const forestFloor = assetContext?.medow?.forestFloor;

    if (forestFloor) {
      group.add(
        forestFloor.createDetails({
          chunkSize,
          chunkX,
          chunkZ,
          seed,
          rng,
          terrain,
          getBiomeWeightsAtPosition,
          lodFactor
        })
      );
    }
  }
};

export function createMedowAssetContext() {
  return {
    ground: new MeadowGroundLibrary(),
    forestFloor: new MeadowForestKit(),
    fluffyGrass: new FluffyGrassLibrary(),
    bushes: new BushLibrary(),
    flowers: new FlowerLibrary()
  };
}

export async function loadMedowAssets(assetContext, renderer) {
  await Promise.all([
    assetContext.ground.load(renderer),
    assetContext.fluffyGrass.load(),
    assetContext.bushes.load(),
    assetContext.flowers.load()
  ]);
}

export function updateMedowAssets(assetContext, elapsedTime) {
  assetContext.fluffyGrass.update(elapsedTime);
}
