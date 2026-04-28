export const VILLAGE_GRID_SIZE_IN_CHUNKS = 5;

function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

export function isVillageChunk(chunkX, chunkZ) {
  return (
    positiveModulo(chunkX, VILLAGE_GRID_SIZE_IN_CHUNKS) === 0 &&
    positiveModulo(chunkZ, VILLAGE_GRID_SIZE_IN_CHUNKS) === 0
  );
}
