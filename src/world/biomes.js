import * as THREE from "three";
import { fbm2D } from "./noise.js";
import { MEDOW_BIOME } from "./medow/index.js";
import { MUSHROOM_BIOME } from "./mushroom/index.js";
import { VILLAGE_BIOME } from "./village/index.js";

export const BIOMES = {
  meadow: MEDOW_BIOME,
  village: VILLAGE_BIOME,
  mushrooms: MUSHROOM_BIOME,
  crystal: {
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
  }
};

export const BIOME_SEQUENCE = ["meadow", "mushrooms", "crystal"];
const BIOME_THRESHOLDS = [0.48, 0.86];
const BIOME_BLEND_WIDTH = 0.1;

function getBiomeBlendValue(x, z, seed) {
  const broad = fbm2D(x / 240, z / 240, seed + 11, 4, 2, 0.5);
  const detail = fbm2D((x + 320) / 120, (z - 160) / 120, seed + 71, 3, 2.2, 0.45);
  return broad * 0.7 + detail * 0.3;
}

function smoothNeighborBlend(value, threshold) {
  const min = threshold - BIOME_BLEND_WIDTH;
  const max = threshold + BIOME_BLEND_WIDTH;

  if (value <= min) {
    return 0;
  }

  if (value >= max) {
    return 1;
  }

  return THREE.MathUtils.smoothstep(value, min, max);
}

function getDominantBiomeKey(weights) {
  let bestKey = BIOME_SEQUENCE[0];
  let bestWeight = -Infinity;

  for (const key of BIOME_SEQUENCE) {
    const weight = weights[key] ?? 0;

    if (weight > bestWeight) {
      bestWeight = weight;
      bestKey = key;
    }
  }

  return bestKey;
}

export function getBiomeWeightsAt(x, z, seed) {
  const blend = getBiomeBlendValue(x, z, seed);
  const weights = Object.fromEntries(BIOME_SEQUENCE.map((key) => [key, 0]));

  if (blend <= BIOME_THRESHOLDS[0] - BIOME_BLEND_WIDTH) {
    weights[BIOME_SEQUENCE[0]] = 1;
    return weights;
  }

  for (let index = 0; index < BIOME_THRESHOLDS.length; index += 1) {
    const threshold = BIOME_THRESHOLDS[index];
    const min = threshold - BIOME_BLEND_WIDTH;
    const max = threshold + BIOME_BLEND_WIDTH;

    if (blend >= min && blend <= max) {
      const alpha = smoothNeighborBlend(blend, threshold);
      weights[BIOME_SEQUENCE[index]] = 1 - alpha;
      weights[BIOME_SEQUENCE[index + 1]] = alpha;
      return weights;
    }

    const nextThreshold = BIOME_THRESHOLDS[index + 1];
    const inSolidBand =
      blend > max &&
      (nextThreshold === undefined || blend < nextThreshold - BIOME_BLEND_WIDTH);

    if (inSolidBand) {
      weights[BIOME_SEQUENCE[index + 1]] = 1;
      return weights;
    }
  }

  weights[BIOME_SEQUENCE[BIOME_SEQUENCE.length - 1]] = 1;
  return weights;
}

export function getBiomeKeyAt(x, z, seed) {
  return getDominantBiomeKey(getBiomeWeightsAt(x, z, seed));
}

export function getBiomeAt(x, z, seed) {
  return BIOMES[getBiomeKeyAt(x, z, seed)];
}

export function getChunkPalette(biome) {
  return {
    ground: new THREE.Color(biome.groundColor),
    tint: new THREE.Color(biome.groundTint),
    accent: new THREE.Color(biome.accentColor)
  };
}
