import { fbm2D } from "../noise.js";

export function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

export function smoothstep(min, max, value) {
  if (min === max) {
    return value < min ? 0 : 1;
  }

  const t = clamp01((value - min) / (max - min));
  return t * t * (3 - 2 * t);
}

export function getGladeFactor(worldX, worldZ, seed) {
  const broad = fbm2D((worldX + 160) / 165, (worldZ - 240) / 165, seed + 2101, 4, 2.05, 0.5);
  const detail = fbm2D((worldX - 90) / 58, (worldZ + 120) / 58, seed + 2173, 3, 2.14, 0.48);
  const field = broad * 0.78 + detail * 0.22;

  return smoothstep(0.47, 0.76, field);
}

export function getAncientForestFactor(worldX, worldZ, seed) {
  const canopy = fbm2D((worldX - 320) / 210, (worldZ + 180) / 210, seed + 2219, 5, 2.0, 0.52);
  const understory = fbm2D((worldX + 80) / 82, (worldZ - 60) / 82, seed + 2267, 3, 2.25, 0.5);

  return smoothstep(0.32, 0.76, canopy * 0.72 + understory * 0.28);
}

export function getMossFactor(worldX, worldZ, seed) {
  const damp = fbm2D((worldX + 420) / 130, (worldZ - 90) / 130, seed + 2309, 4, 2.12, 0.53);
  const velvet = fbm2D((worldX - 120) / 38, (worldZ + 340) / 38, seed + 2371, 3, 2.1, 0.46);

  return smoothstep(0.28, 0.82, damp * 0.7 + velvet * 0.3);
}

export function getCrystalFactor(worldX, worldZ, seed) {
  const broad = fbm2D((worldX - 540) / 150, (worldZ + 470) / 150, seed + 2441, 4, 2.02, 0.5);
  const seam = 1 - Math.abs(fbm2D((worldX + 55) / 54, (worldZ - 35) / 54, seed + 2503, 3, 2.2, 0.48) * 2 - 1);

  return smoothstep(0.46, 0.84, broad * 0.7 + seam * 0.3);
}

export function getSplatMapAt(worldX, worldZ, seed, waterPresence = 0) {
  const noise = fbm2D((worldX + 740) / 130, (worldZ - 510) / 130, seed + 3101, 5, 2.03, 0.5);
  const waterMask = smoothstep(0.08, 0.22, waterPresence);
  const white = noise < 0.33 && waterMask < 0.5 ? 1 : 0;
  const gray = noise >= 0.33 && noise < 0.66 && waterMask < 0.5 ? 1 : 0;
  const black = noise >= 0.66 || waterMask >= 0.5 ? 1 : 0;

  return {
    white,
    gray,
    black,
    noise,
    path: black,
    clover: gray,
    moss: white
  };
}
