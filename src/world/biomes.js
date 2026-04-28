import * as THREE from "three";
import { fbm2D } from "./noise.js";
import {
  PROCEDURAL_BIOMES,
  PROCEDURAL_BIOME_SEQUENCE
} from "./procedural/index.js";

export const BIOMES = PROCEDURAL_BIOMES;

export const BIOME_SEQUENCE = PROCEDURAL_BIOME_SEQUENCE;
const BIOME_THRESHOLDS = [1 / 3, 2 / 3];
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
