import * as THREE from "three";
import { fbm2D } from "./noise.js";

export const TERRAIN_CHUNK_SEGMENTS = 36;

export function getTerrainHeight(x, z, seed) {
  const broad = fbm2D((x + 180) / 240, (z - 120) / 240, seed + 101, 5, 2.05, 0.52);
  const rolling = fbm2D((x - 260) / 110, (z + 210) / 110, seed + 233, 4, 2.2, 0.5);
  const ridgeSource = fbm2D((x + 420) / 175, (z - 360) / 175, seed + 367, 3, 2.1, 0.55);
  const ridge = 1 - Math.abs(ridgeSource * 2 - 1);
  const basinSource = fbm2D((x - 90) / 170, (z + 320) / 170, seed + 491, 4, 2, 0.55);
  const basin = Math.max(0, 0.54 - basinSource) / 0.54;
  const terrain =
    (broad - 0.5) * 8.9 +
    (rolling - 0.5) * 4.6 +
    (ridge - 0.5) * 3.4 -
    basin * 2.9;

  return terrain * 1.14;
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

  for (let index = 0; index < positions.count; index += 1) {
    const localX = positions.getX(index);
    const localZ = -positions.getY(index);
    const height = getTerrainHeightInChunk(localX, localZ, chunkX, chunkZ, chunkSize, seed);
    positions.setZ(index, height + heightOffset);
  }

  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}
