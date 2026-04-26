import {
  CRYSTAL_TERRAIN_SETTINGS,
  CRYSTAL_TERRAIN_TEXTURES
} from "./CrystalTerrainConfig.js";

export const CRYSTAL_BIOME = {
  name: "Crystal Glade",
  groundColor: "#6ec5b8",
  groundTint: "#7de1d3",
  fogColor: "#eddffd",
  fogDensity: 0.003,
  skyColor: "#cfe7ff",
  accentColor: "#b488ff",
  assetMix: {
    silverTree: { count: [3, 5], scale: [0.85, 1.25] },
    crystalCluster: { count: [7, 10], scale: [0.8, 1.5] },
    glowBloom: { count: [8, 14], scale: [0.8, 1.15] },
    rockCluster: { count: [2, 4], scale: [0.75, 1.1] },
    lantern: { count: [1, 2], scale: [0.9, 1.15] },
    wispCluster: { count: [2, 3], scale: [1, 1.3] }
  }
};

export function createCrystalAssetContext() {
  return {
    terrainTextures: CRYSTAL_TERRAIN_TEXTURES,
    terrainSettings: CRYSTAL_TERRAIN_SETTINGS
  };
}

export async function loadCrystalAssets() {
  return Promise.resolve();
}
