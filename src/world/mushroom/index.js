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
    twistedTree: { count: [4, 6], scale: [0.9, 1.35] },
    giantMushroom: { count: [8, 14], scale: [0.75, 1.5] },
    toadstoolRing: { count: [4, 7], scale: [0.85, 1.2] },
    stump: { count: [4, 6], scale: [0.7, 1.15] },
    rockCluster: { count: [3, 5], scale: [0.55, 1] },
    sporeCluster: { count: [3, 5], scale: [0.9, 1.35] }
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
    moss: new MossLibrary(),
    models: new MushroomModelLibrary(),
    scatter: new MushroomScatterLibrary()
  };
}

export async function loadMushroomAssets(assetContext, renderer) {
  await Promise.all([assetContext.moss.load(renderer), assetContext.models.load(renderer)]);
}
