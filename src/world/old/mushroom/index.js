import { ForestFloorKit } from "./ForestFloorKit.js";
import { MossLibrary } from "./MossLibrary.js";
import { MushroomModelLibrary } from "./MushroomModelLibrary.js";
import { MushroomScatterLibrary } from "./MushroomScatterLibrary.js";

export const MUSHROOM_BIOME = {
  name: "Mushroom Grove",
  groundColor: "#2d3721",
  groundTint: "#435235",
  fogColor: "#b8a6c8",
  fogDensity: 0.0038,
  skyColor: "#c9d3ea",
  accentColor: "#ff7d95",
  assetMix: {
    twistedTree: { count: [7, 11], scale: [0.82, 1.28] },
    giantMushroom: { count: [14, 24], scale: [0.68, 1.42] },
    toadstoolRing: { count: [7, 12], scale: [0.75, 1.14] },
    stump: { count: [5, 9], scale: [0.62, 1.05] },
    rockCluster: { count: [3, 6], scale: [0.48, 0.92] },
    sporeCluster: { count: [4, 7], scale: [0.85, 1.25] }
  },
  createChunkAdditions({
    group,
    chunkX,
    chunkZ,
    chunkSize,
    seed,
    rng,
    assetContext,
    biome,
    biomeKey,
    palette,
    getBiomeKeyAtPosition,
    getBiomeWeightsAtPosition,
    getBlendedGroundColorAtPosition,
    terrain,
    instanceCollector,
    lodFactor
  }) {
    const mushroomAssets = assetContext?.mushroom;

    if (mushroomAssets?.moss) {
      group.add(
        mushroomAssets.moss.createFloor({
          chunkSize,
          chunkX,
          chunkZ,
          seed,
          rng,
          terrain,
          lodFactor,
          biomeKey,
          getBiomeKeyAtPosition,
          getBiomeWeightsAtPosition,
          getBlendedGroundColorAtPosition
        })
      );
    }

    if (mushroomAssets?.forestFloor) {
      group.add(
        mushroomAssets.forestFloor.createDetails({
          chunkSize,
          chunkX,
          chunkZ,
          seed,
          rng,
          terrain,
          biomeKey,
          getBiomeWeightsAtPosition,
          lodFactor
        })
      );
    }

    mushroomAssets?.scatter?.createForestClusters({
      group,
      chunkSize,
      chunkX,
      chunkZ,
      rng,
      assetContext,
      biome,
      biomeKey,
      palette,
      terrain,
      getBiomeWeightsAtPosition,
      instanceCollector,
      lodFactor
    });
  }
};

export function createMushroomAssetContext() {
  return {
    forestFloor: new ForestFloorKit(),
    moss: new MossLibrary(),
    models: new MushroomModelLibrary(),
    scatter: new MushroomScatterLibrary()
  };
}

export async function loadMushroomAssets(assetContext, renderer) {
  await Promise.all([assetContext.moss.load(renderer), assetContext.models.load(renderer)]);
}
