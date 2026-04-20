# Fairytown

Procedural fairy-world starter built with Three.js and Vite.

## For now

- Three explorable biomes.
- Infinite-ish chunk loading around the camera
- Fairy-style flying controls.
- Primitive placeholder assets for trees, rocks, mushrooms, crystals, flowers, lanterns, and ambient particles.

## Run

```bash
npm install
npm run dev
```

## Replace Placeholder Assets

Biome spawning lives in [`src/world/biomes.js`](./src/world/biomes.js).

Primitive placeholder builders live in [`src/world/placeholders.js`](./src/world/placeholders.js).

When you are ready to swap in real assets, keep the asset keys the same and replace the matching builder with a loader-backed version.

## Included External Meadow Grass

The meadow biome now uses grass assets adapted from [thebenezer/FluffyGrass](https://github.com/thebenezer/FluffyGrass) via files in [`public/fluffy-grass`](./public/fluffy-grass).
Meadow-specific setup is grouped in [`src/world/medow`](./src/world/medow).
