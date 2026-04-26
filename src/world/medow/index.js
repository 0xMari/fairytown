// import { FluffyGrassLibrary } from "./FluffyGrassLibrary.js";
import { BushLibrary } from "./BushLibrary.js";
import { FlowerLibrary } from "./FlowerLibrary.js";
import { MeadowGroundLibrary } from "./MeadowGroundLibrary.js";

export const MEDOW_BIOME = {
  name: "Sunlit Meadow",
  groundColor: "#9cd36c",
  groundTint: "#b9e78e",
  fogColor: "#efdff4",
  fogDensity: 0.0031,
  skyColor: "#c7e6ff",
  accentColor: "#fff3a6",
  assetMix: {
    fairyTree: { count: [4, 7], scale: [0.9, 1.35] },
    flowerPatch: { count: [22, 34], scale: [0.95, 1.35] },
    bush: { count: [5, 8], scale: [0.8, 1.2] },
    rockCluster: { count: [3, 5], scale: [0.7, 1.2] },
    fireflyCluster: { count: [2, 3], scale: [1, 1.3] }
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
    // Meadow grass instancing is temporarily disabled in favor of the textured terrain pass.
    /*
    const fluffyGrass = assetContext?.medow?.fluffyGrass;

    if (!fluffyGrass) {
      return;
    }

    const groundCover = fluffyGrass.createGroundCover({
      chunkSize,
      chunkX,
      chunkZ,
      seed,
      rng,
      lodFactor,
      terrain,
      getBiomeWeightsAtPosition
    });

    if (groundCover?.object) {
      group.add(groundCover.object);
    }
    */
  }
};

export function createMedowAssetContext() {
  return {
    ground: new MeadowGroundLibrary(),
    // fluffyGrass: new FluffyGrassLibrary(),
    bushes: new BushLibrary(),
    flowers: new FlowerLibrary()
  };
}

export async function loadMedowAssets(assetContext, renderer) {
  await Promise.all([
    assetContext.ground.load(renderer),
    // assetContext.fluffyGrass.load(),
    assetContext.bushes.load(),
    assetContext.flowers.load()
  ]);
}

export function updateMedowAssets(assetContext, elapsedTime) {
  // assetContext.fluffyGrass.update(elapsedTime);
}
