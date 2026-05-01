import * as THREE from "three";
import { addBuiltAssetToChunk } from "../InstanceBatchCollector.js";
import { ProceduralTerrainMaterial } from "./ProceduralTerrainMaterial.js";
import { ProceduralVegetationLayer } from "./ProceduralVegetationLayer.js";
import { PROCEDURAL_ASSET_BUILDERS } from "./ProceduralAssetBuilders.js";
import {
  getAncientForestFactor,
  getCrystalFactor,
  getGladeFactor,
  getMossFactor,
  getSplatMapAt,
  smoothstep
} from "./ProceduralFields.js";
import { CrystalModelLibrary } from "./CrystalModelLibrary.js";
import { MossyRockLibrary } from "./MossyRockLibrary.js";
import { SpottedMushroomLibrary } from "./SpottedMushroomLibrary.js";
import { BeechFernLibrary } from "./vegetation/BeechFernLibrary.js";
import { GroundFlowerLibrary } from "./vegetation/GroundFlowerLibrary.js";
import { GroundGrassLibrary } from "./vegetation/GroundGrassLibrary.js";
import { HighPolyTreeLibrary } from "./vegetation/HighPolyTreeLibrary.js";

export const PROCEDURAL_BIOME_SEQUENCE = ["meadow", "mushrooms", "crystal"];

function addProceduralLayer({
  group,
  chunkSize,
  chunkX,
  chunkZ,
  seed,
  rng,
  assetContext,
  terrain,
  biomeKey,
  natureBiomeKey,
  getBiomeWeightsAtPosition,
  lodFactor
}) {
  const layer = assetContext?.procedural?.vegetation;

  if (!layer) {
    return;
  }

  group.add(
    layer.createChunkLayer({
      chunkSize,
      chunkX,
      chunkZ,
      seed,
      rng,
      assetContext,
      terrain,
      biomeKey,
      natureBiomeKey,
      getBiomeWeightsAtPosition,
      lodFactor
    })
  );
}

function buildProceduralObject({
  assetName,
  group,
  rng,
  biome,
  biomeKey,
  assetContext,
  terrain,
  x,
  z,
  scale,
  rotationY,
  instanceCollector
}) {
  const builder = PROCEDURAL_ASSET_BUILDERS[assetName];

  if (!builder) {
    return;
  }

  const height = terrain?.getHeightAtLocalPosition?.(x, z) ?? 0;
  const built = builder({ rng, biome, biomeKey, assetContext });

  addBuiltAssetToChunk({
    built,
    group,
    instanceCollector,
    position: { x, y: height, z },
    rotationY,
    scale
  });
}

function createFaeSanctuary({
  group,
  rng,
  biome,
  assetContext,
  terrain,
  natureBiomeKey,
  instanceCollector
}) {
  buildProceduralObject({
    assetName: natureBiomeKey === "crystal" ? "slenderTree" : "elderTree",
    group,
    rng,
    biome,
    biomeKey: natureBiomeKey,
    terrain,
    assetContext,
    x: 0,
    z: 0,
    scale: natureBiomeKey === "crystal" ? 1.5 : 1.85,
    rotationY: rng() * Math.PI * 2,
    instanceCollector
  });

  const archCount = 6;
  const archRadius = 13.5;

  for (let index = 0; index < archCount; index += 1) {
    const angle = (index / archCount) * Math.PI * 2 + Math.PI / 6;

    buildProceduralObject({
      assetName: "rootArch",
      group,
      rng,
      biome,
      biomeKey: "village",
      terrain,
      assetContext,
      x: Math.cos(angle) * archRadius,
      z: Math.sin(angle) * archRadius,
      scale: THREE.MathUtils.lerp(0.88, 1.22, rng()),
      rotationY: -angle + Math.PI * 0.5,
      instanceCollector
    });
  }

  for (let index = 0; index < 10; index += 1) {
    const angle = rng() * Math.PI * 2;
    const radius = THREE.MathUtils.lerp(5.5, 18, Math.sqrt(rng()));
    const accent =
      natureBiomeKey === "mushrooms"
        ? "mushroomBloom"
        : natureBiomeKey === "crystal"
          ? "crystalBloom"
          : index % 2 === 0
            ? "flowerSpray"
            : "fernPatch";

    buildProceduralObject({
      assetName: accent,
      group,
      rng,
      biome,
      biomeKey: natureBiomeKey,
      terrain,
      assetContext,
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      scale: THREE.MathUtils.lerp(0.8, 1.35, rng()),
      rotationY: rng() * Math.PI * 2,
      instanceCollector
    });
  }
}

function createSpawnDensityEvaluator(type) {
  return ({ assetName, worldX, worldZ, seed, biomeWeight, waterPresence }) => {
    if (waterPresence > 0.14 || biomeWeight < 0.1) {
      return 0;
    }

    const glade = getGladeFactor(worldX, worldZ, seed);
    const forest = getAncientForestFactor(worldX, worldZ, seed);
    const moss = getMossFactor(worldX, worldZ, seed);
    const crystal = getCrystalFactor(worldX, worldZ, seed);
    const splat = getSplatMapAt(worldX, worldZ, seed, waterPresence);
    const closedCanopy = Math.max(forest, 1 - glade);

    if (splat.black > 0.5) {
      return 0;
    }

    const treeClusterBand =
      smoothstep(0.04, 0.12, splat.noise) *
      (1 - smoothstep(0.3, 0.36, splat.noise));

    if (assetName === "elderTree") {
      if (treeClusterBand <= 0.02) {
        return 0;
      }

      return type === "meadow"
        ? THREE.MathUtils.lerp(0.18, 1.85, splat.white) * THREE.MathUtils.lerp(0.62, 1.24, closedCanopy) * treeClusterBand
        : THREE.MathUtils.lerp(0.28, 1.62, splat.white) * THREE.MathUtils.lerp(0.72, 1.26, forest) * treeClusterBand;
    }

    if (assetName === "canopyTree" || assetName === "slenderTree") {
      if (treeClusterBand <= 0.02) {
        return 0;
      }

      return type === "crystal"
        ? THREE.MathUtils.lerp(0.16, 1.02, splat.white) * THREE.MathUtils.lerp(0.76, 1.18, forest) * treeClusterBand
        : THREE.MathUtils.lerp(0.28, 1.88, splat.white) * THREE.MathUtils.lerp(0.72, 1.26, closedCanopy) * treeClusterBand;
    }

    if (assetName === "sapling") {
      return THREE.MathUtils.lerp(0.18, 1.05, splat.white) * THREE.MathUtils.lerp(0.5, 1.1, forest);
    }

    if (assetName === "flowerSpray") {
      return type === "meadow"
        ? THREE.MathUtils.lerp(0.18, 2.1, splat.gray) * THREE.MathUtils.lerp(0.75, 1.3, glade)
        : THREE.MathUtils.lerp(0.04, 0.46, splat.gray) * THREE.MathUtils.lerp(0.6, 1.1, glade);
    }

    if (assetName === "fernPatch") {
      const grayScatter = splat.gray * THREE.MathUtils.lerp(0.18, 0.58, forest);
      const whiteUnderstoryRemainder = splat.white * THREE.MathUtils.lerp(0.08, 0.22, moss);

      return type === "mushrooms"
        ? THREE.MathUtils.lerp(0.18, 0.86, grayScatter + whiteUnderstoryRemainder)
        : THREE.MathUtils.lerp(0.08, 0.54, grayScatter + whiteUnderstoryRemainder);
    }

    if (assetName === "mushroomBloom") {
      if (type !== "mushrooms" || splat.white < 0.5) {
        return 0;
      }

      return THREE.MathUtils.lerp(
        0.64,
        1.82,
        THREE.MathUtils.clamp(forest * 0.68 + moss * 0.32, 0, 1)
      );
    }

    if (assetName === "crystalBloom") {
      return type === "crystal"
        ? THREE.MathUtils.lerp(0.22, 2.1, crystal)
        : 0.03;
    }

    if (assetName === "stump") {
      return THREE.MathUtils.lerp(0.02, 0.58, splat.gray) * THREE.MathUtils.lerp(0.45, 1.05, forest);
    }

    if (assetName === "glowWisp") {
      return type === "crystal"
        ? THREE.MathUtils.lerp(0.5, 1.8, crystal)
        : THREE.MathUtils.lerp(0.45, 1.25, Math.max(glade, moss));
    }

    return 1;
  };
}

function createLayerAdditionHandler(biomeKey) {
  return (args) => {
    addProceduralLayer({
      ...args,
      biomeKey,
      natureBiomeKey: args.natureBiomeKey ?? biomeKey
    });
  };
}

export const PROCEDURAL_BIOMES = {
  meadow: {
    name: "Wildflower Elderwood",
    groundColor: "#7ea452",
    groundTint: "#d7ed9b",
    fogColor: "#e9f4dc",
    fogDensity: 0.0026,
    skyColor: "#bfe7ff",
    accentColor: "#fff1a8",
    assetMix: {
      elderTree: { count: [3, 6], scale: [0.82, 1.32] },
      canopyTree: { count: [8, 14], scale: [0.72, 1.18] },
      sapling: { count: [5, 10], scale: [0.72, 1.16] },
      fernPatch: { count: [5, 10], scale: [0.76, 1.18] },
      flowerSpray: { count: [24, 44], scale: [0.7, 1.2] },
      stump: { count: [2, 5], scale: [0.7, 1.15] },
      glowWisp: { count: [2, 4], scale: [0.9, 1.25] }
    },
    getSpawnDensity: createSpawnDensityEvaluator("meadow"),
    createChunkAdditions: createLayerAdditionHandler("meadow")
  },
  mushrooms: {
    name: "Mossveil Hollow",
    groundColor: "#44582c",
    groundTint: "#8fa65a",
    fogColor: "#d8e3d2",
    fogDensity: 0.0031,
    skyColor: "#a9c7d4",
    accentColor: "#ffd0ed",
    assetMix: {
      elderTree: { count: [3, 6], scale: [0.9, 1.42] },
      canopyTree: { count: [9, 16], scale: [0.72, 1.14] },
      sapling: { count: [5, 10], scale: [0.75, 1.22] },
      fernPatch: { count: [7, 14], scale: [0.78, 1.28] },
      mushroomBloom: { count: [18, 32], scale: [0.7, 1.45] },
      stump: { count: [2, 5], scale: [0.72, 1.2] },
      glowWisp: { count: [3, 6], scale: [0.88, 1.24] }
    },
    getSpawnDensity: createSpawnDensityEvaluator("mushrooms"),
    createChunkAdditions: createLayerAdditionHandler("mushrooms")
  },
  crystal: {
    name: "Moonstone Thicket",
    groundColor: "#677a68",
    groundTint: "#b9e7db",
    fogColor: "#e6e6ff",
    fogDensity: 0.0025,
    skyColor: "#c9e4ff",
    accentColor: "#c9f4ff",
    assetMix: {
      slenderTree: { count: [8, 14], scale: [0.78, 1.2] },
      sapling: { count: [4, 8], scale: [0.7, 1.08] },
      fernPatch: { count: [4, 8], scale: [0.72, 1.14] },
      flowerSpray: { count: [4, 10], scale: [0.72, 1.1] },
      crystalBloom: { count: [16, 28], scale: [0.72, 1.42] },
      stump: { count: [1, 3], scale: [0.62, 1.05] },
      glowWisp: { count: [4, 7], scale: [0.88, 1.3] }
    },
    getSpawnDensity: createSpawnDensityEvaluator("crystal"),
    createChunkAdditions: createLayerAdditionHandler("crystal")
  },
  village: {
    name: "Fae Hollow",
    groundColor: "#87aa58",
    groundTint: "#e2efaa",
    fogColor: "#eff5df",
    fogDensity: 0.0024,
    skyColor: "#ccecff",
    accentColor: "#fff0ae",
    assetMix: {},
    createChunkAdditions(args) {
      addProceduralLayer({
        ...args,
        biomeKey: "village",
        natureBiomeKey: args.natureBiomeKey
      });
      createFaeSanctuary(args);
    }
  }
};

export function createProceduralAssetContext() {
  return {
    terrain: new ProceduralTerrainMaterial(),
    vegetation: new ProceduralVegetationLayer(),
    mushrooms: new SpottedMushroomLibrary(),
    crystals: new CrystalModelLibrary(),
    mossyRocks: new MossyRockLibrary(),
    ferns: new BeechFernLibrary(),
    grasses: new GroundGrassLibrary(),
    flowers: new GroundFlowerLibrary(),
    trees: new HighPolyTreeLibrary()
  };
}

export async function loadProceduralAssets(assetContext, renderer) {
  await Promise.all([
    assetContext.terrain.load(renderer),
    assetContext.mushrooms.load(renderer),
    assetContext.crystals.load(renderer),
    assetContext.mossyRocks.load(renderer),
    assetContext.ferns.load(renderer),
    assetContext.grasses.load(renderer),
    assetContext.flowers.load(renderer),
    assetContext.trees.load(renderer)
  ]);
}

export function updateProceduralAssets(assetContext, elapsedTime) {
  assetContext?.vegetation?.update(elapsedTime);
}
