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

  return terrain * TERRAIN_HEIGHT_SETTINGS.finalScale;
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
