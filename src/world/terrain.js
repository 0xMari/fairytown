import * as THREE from "three";
import { fbm2D } from "./noise.js";

export const TERRAIN_CHUNK_SEGMENTS = 36;
const TERRAIN_TEXTURE_WORLD_SCALE = 18;
export const DEFAULT_TERRAIN_HEIGHT_SETTINGS = Object.freeze({
  broadAmplitude: 16.5,
  rollingAmplitude: 11.9,
  ridgeAmplitude: 5.2,
  basinDepth: 7.6,
  finalScale: 2.01
});
const TERRAIN_HEIGHT_SETTINGS = { ...DEFAULT_TERRAIN_HEIGHT_SETTINGS };

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(min, max, value) {
  if (min === max) {
    return value < min ? 0 : 1;
  }

  const normalized = clamp01((value - min) / (max - min));
  return normalized * normalized * (3 - 2 * normalized);
}

function mix(min, max, alpha) {
  return min + (max - min) * alpha;
}

function sampleTerrainShape(x, z, seed) {
  const broad = fbm2D((x + 180) / 240, (z - 120) / 240, seed + 101, 5, 2.05, 0.52);
  const rolling = fbm2D((x - 260) / 110, (z + 210) / 110, seed + 233, 4, 2.2, 0.5);
  const ridgeSource = fbm2D((x + 420) / 175, (z - 360) / 175, seed + 367, 3, 2.1, 0.55);
  const ridge = Math.pow(1 - Math.abs(ridgeSource * 2 - 1), 1.18);
  const basinSource = fbm2D((x - 90) / 170, (z + 320) / 170, seed + 491, 4, 2, 0.55);
  const basin = Math.pow(Math.max(0, 0.54 - basinSource) / 0.54, 1.2);
  const terrain =
    (broad - 0.5) * TERRAIN_HEIGHT_SETTINGS.broadAmplitude +
    (rolling - 0.5) * TERRAIN_HEIGHT_SETTINGS.rollingAmplitude +
    (ridge - 0.5) * TERRAIN_HEIGHT_SETTINGS.ridgeAmplitude -
    basin * TERRAIN_HEIGHT_SETTINGS.basinDepth;

  return {
    broad,
    rolling,
    ridge,
    basin,
    height: terrain * TERRAIN_HEIGHT_SETTINGS.finalScale
  };
}

export function getTerrainHeightSettings() {
  return { ...TERRAIN_HEIGHT_SETTINGS };
}

export function setTerrainHeightSettings(nextSettings = {}) {
  Object.assign(TERRAIN_HEIGHT_SETTINGS, nextSettings);
  return getTerrainHeightSettings();
}

export function resetTerrainHeightSettings() {
  Object.assign(TERRAIN_HEIGHT_SETTINGS, DEFAULT_TERRAIN_HEIGHT_SETTINGS);
  return getTerrainHeightSettings();
}

export function getTerrainHeight(x, z, seed) {
  return sampleTerrainShape(x, z, seed).height;
}

export function getTerrainWaterData(x, z, seed) {
  const terrain = sampleTerrainShape(x, z, seed);
  const lowland = 1 - smoothstep(-10.5, -1.5, terrain.height);
  const valley = smoothstep(0.16, 0.72, terrain.basin);
  const channelPrimary = fbm2D((x + 220) / 205, (z - 160) / 205, seed + 601, 4, 2.05, 0.5);
  const channelDetail = fbm2D((x - 120) / 86, (z + 130) / 86, seed + 659, 3, 2.22, 0.54);
  const pondNoise = fbm2D((x + 340) / 64, (z - 280) / 64, seed + 727, 3, 2.18, 0.52);
  const calmNoise = fbm2D((x - 70) / 110, (z + 90) / 110, seed + 811, 4, 2.0, 0.46);
  const waterTableNoise = fbm2D((x + 140) / 420, (z - 220) / 420, seed + 877, 3, 2.0, 0.5);
  const waterTableDetail = fbm2D((x - 90) / 210, (z + 120) / 210, seed + 941, 2, 2.06, 0.46);
  const riverField = channelPrimary * 0.72 + channelDetail * 0.28;
  const riverRibbon = 1 - smoothstep(0.04, 0.16, Math.abs(riverField - 0.5));
  const pondCore = 1 - smoothstep(0.08, 0.24, Math.abs(pondNoise - 0.5));
  const riverMask = riverRibbon * smoothstep(0.18, 0.82, lowland * (0.55 + valley * 0.7));
  const lakeMask = smoothstep(0.36, 0.9, lowland * (0.45 + valley * 0.95 + calmNoise * 0.16));
  const pondMask = pondCore * smoothstep(0.28, 0.78, lowland * (0.42 + valley * 0.38));
  const waterTableBlend = waterTableNoise * 0.72 + waterTableDetail * 0.28;
  const surfaceHeight = mix(-11.2, -4.6, waterTableBlend);
  const submergedBy = surfaceHeight - terrain.height;
  const submersion = smoothstep(0.12, 2.6, submergedBy);
  const presence = clamp01(Math.max(riverMask * 0.9, lakeMask, pondMask * 0.78) * submersion);
  const depth = clamp01(
    Math.max(lakeMask * 0.95, pondMask * 0.72, riverMask * 0.58) *
      (0.48 + lowland * 0.52) *
      smoothstep(0.18, 3.8, submergedBy)
  );

  return {
    presence,
    depth,
    river: riverMask,
    lake: lakeMask,
    pond: pondMask,
    surfaceHeight
  };
}

export function getTerrainHeightInChunk(localX, localZ, chunkX, chunkZ, chunkSize, seed) {
  return getTerrainHeight(chunkX * chunkSize + localX, chunkZ * chunkSize + localZ, seed);
}

export function createTerrainGeometry({
  chunkX,
  chunkZ,
  chunkSize,
  seed,
  segments = TERRAIN_CHUNK_SEGMENTS,
  heightOffset = 0
}) {
  const geometry = new THREE.PlaneGeometry(chunkSize, chunkSize, segments, segments);
  const positions = geometry.attributes.position;
  const uvs = geometry.attributes.uv;

  for (let index = 0; index < positions.count; index += 1) {
    const localX = positions.getX(index);
    const localZ = -positions.getY(index);
    const worldX = chunkX * chunkSize + localX;
    const worldZ = chunkZ * chunkSize + localZ;
    const height = getTerrainHeightInChunk(localX, localZ, chunkX, chunkZ, chunkSize, seed);
    positions.setZ(index, height + heightOffset);
    uvs.setXY(index, worldX / TERRAIN_TEXTURE_WORLD_SCALE, worldZ / TERRAIN_TEXTURE_WORLD_SCALE);
  }

  positions.needsUpdate = true;
  uvs.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}
