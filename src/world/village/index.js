import * as THREE from "three";
import { PLACEHOLDER_BUILDERS } from "../placeholders.js";
import { addBuiltAssetToChunk } from "../InstanceBatchCollector.js";

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

const houseGeometry = new THREE.BoxGeometry(1, 1, 1);
const houseMaterial = new THREE.MeshStandardMaterial({
  color: "#f4d8b0",
  roughness: 0.92
});
const houseAccentMaterial = new THREE.MeshStandardMaterial({
  color: "#e6b88c",
  emissive: "#ffe6b7",
  emissiveIntensity: 0.06,
  roughness: 0.82
});
const treeBaseMaterial = new THREE.MeshStandardMaterial({
  color: "#8b684a",
  roughness: 0.98
});
const houseRingRadius = 14.5;

function createBuiltObject({
  group,
  assetName,
  rng,
  assetContext,
  biome,
  biomeKey,
  palette,
  terrain,
  chunkX,
  chunkZ,
  chunkSize,
  seed,
  x,
  z,
  scale = 1,
  instanceCollector
}) {
  const builder = PLACEHOLDER_BUILDERS[assetName];

  if (!builder) {
    return;
  }

  const built = builder({
    rng,
    biome,
    biomeKey,
    palette,
    assetContext,
    seed,
    placement: {
      chunkX,
      chunkZ,
      x,
      z,
      worldX: chunkX * chunkSize + x,
      worldZ: chunkZ * chunkSize + z
    }
  });

  const terrainHeight = terrain?.getHeightAtLocalPosition?.(x, z) ?? 0;
  addBuiltAssetToChunk({
    built,
    group,
    instanceCollector,
    position: { x, y: terrainHeight, z },
    rotationY: rng() * Math.PI * 2,
    scale
  });
}

function createHouse({ width, height, depth, color }) {
  const house = new THREE.Group();
  const body = new THREE.Mesh(
    houseGeometry,
    color ? houseMaterial.clone() : houseMaterial
  );

  if (color) {
    body.material.color.set(color);
  }

  body.castShadow = true;
  body.receiveShadow = true;
  body.scale.set(width, height, depth);
  body.position.y = height * 0.5;
  house.add(body);

  const doorway = new THREE.Mesh(houseGeometry, houseAccentMaterial);
  doorway.castShadow = true;
  doorway.receiveShadow = true;
  doorway.scale.set(width * 0.22, height * 0.42, depth * 0.12);
  doorway.position.set(0, doorway.scale.y * 0.5, depth * 0.5 + doorway.scale.z * 0.5);
  house.add(doorway);

  return house;
}

function getVillageTreeKey(natureBiomeKey) {
  if (natureBiomeKey === "mushrooms") {
    return "twistedTree";
  }

  if (natureBiomeKey === "crystal") {
    return "silverTree";
  }

  return "fairyTree";
}

function addNatureAccents({
  group,
  rng,
  assetContext,
  natureBiome,
  natureBiomeKey,
  naturePalette,
  terrain,
  chunkX,
  chunkZ,
  chunkSize,
  seed,
  instanceCollector
}) {
  const ringAngles = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];

  if (natureBiomeKey === "meadow") {
    ringAngles.forEach((angle, index) => {
      const radius = houseRingRadius + (index % 2 === 0 ? 4.5 : 2.5);
      createBuiltObject({
        group,
        assetName: "flowerPatch",
        rng,
        assetContext,
        biome: natureBiome,
        biomeKey: natureBiomeKey,
        palette: naturePalette,
        terrain,
        chunkX,
        chunkZ,
        chunkSize,
        seed,
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        scale: 1.15,
        instanceCollector
      });
    });
    return;
  }

  if (natureBiomeKey === "mushrooms") {
    ringAngles.forEach((angle, index) => {
      const radius = houseRingRadius + (index % 2 === 0 ? 4.2 : 2.8);
      createBuiltObject({
        group,
        assetName: index % 2 === 0 ? "giantMushroom" : "toadstoolRing",
        rng,
        assetContext,
        biome: natureBiome,
        biomeKey: natureBiomeKey,
        palette: naturePalette,
        terrain,
        chunkX,
        chunkZ,
        chunkSize,
        seed,
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        scale: index % 2 === 0 ? 0.95 : 0.85,
        instanceCollector
      });
    });
    return;
  }

  if (natureBiomeKey === "crystal") {
    ringAngles.forEach((angle, index) => {
      const radius = houseRingRadius + (index % 2 === 0 ? 4.8 : 2.6);
      createBuiltObject({
        group,
        assetName: "crystalCluster",
        rng,
        assetContext,
        biome: natureBiome,
        biomeKey: natureBiomeKey,
        palette: naturePalette,
        terrain,
        chunkX,
        chunkZ,
        chunkSize,
        seed,
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        scale: 1.1,
        instanceCollector
      });
    });
  }
}

function createVillageCenterpiece({
  group,
  terrain,
  assetContext,
  natureBiomeKey,
  rng,
  instanceCollector
}) {
  if (!terrain) {
    return;
  }

  const centerHeight = terrain.getHeightAtLocalPosition?.(0, 0) ?? 0;
  const heroTreeInstances = assetContext?.trees?.createTreeInstances?.(
    getVillageTreeKey(natureBiomeKey),
    { targetHeight: 20 }
  );

  if (heroTreeInstances) {
    addBuiltAssetToChunk({
      built: { instances: heroTreeInstances },
      group,
      instanceCollector,
      position: { x: 0, y: centerHeight, z: 0 }
    });
  } else {
    const treeBase = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 5.2, 12), treeBaseMaterial);
    treeBase.castShadow = true;
    treeBase.receiveShadow = true;
    treeBase.position.set(0, centerHeight + 2.6, 0);
    group.add(treeBase);
  }

  const houseCount = 6;

  for (let index = 0; index < houseCount; index += 1) {
    const angle = (index / houseCount) * Math.PI * 2 + Math.PI / 6;
    const layout = {
      x: Math.cos(angle) * houseRingRadius,
      z: Math.sin(angle) * houseRingRadius,
      width: 4 + rng() * 1.5,
      height: 1.35 + rng() * 1.1,
      depth: 3.7 + rng() * 1.2,
      color: ["#f6dcb6", "#f0cfaa", "#f8e1c0", "#eed3a7", "#f1d7b0"][index % 5]
    };
    const house = createHouse(layout);
    const height = terrain.getHeightAtLocalPosition?.(layout.x, layout.z) ?? centerHeight;

    house.position.set(layout.x, height, layout.z);
    house.rotation.y = Math.atan2(-layout.x, -layout.z) + Math.PI;
    group.add(house);
  }
}

export const VILLAGE_BIOME = {
  name: "Fairy Village",
  groundColor: "#a6d97b",
  groundTint: "#d7efaa",
  fogColor: "#f3e5f5",
  fogDensity: 0.0029,
  skyColor: "#d7eaff",
  accentColor: "#ffd7a8",
  assetMix: {},
  createChunkAdditions({
    group,
    chunkKey,
    chunkSize,
    chunkX,
    chunkZ,
    seed,
    rng,
    assetContext,
    terrain,
    getBiomeWeightsAtPosition,
    getNatureBiomeKeyAtPosition,
    natureBiome,
    natureBiomeKey,
    naturePalette,
    instanceCollector,
    lodFactor
  }) {
    // const fluffyGrass = assetContext?.medow?.fluffyGrass;
    const moss = assetContext?.mushroom?.moss;

    // Meadow grass instancing is temporarily disabled in favor of the textured terrain pass.
    /*
    if (natureBiomeKey === "meadow" && fluffyGrass) {
      const groundCover = fluffyGrass.createGroundCover({
        chunkSize,
        chunkX,
        chunkZ,
        seed,
        rng,
        lodFactor,
        terrain,
        getBiomeWeightsAtPosition,
        biomeWeightKey: "meadow"
      });

      if (groundCover?.object) {
        group.add(groundCover.object);
      }
    }
    */

    if (natureBiomeKey === "mushrooms" && moss) {
      group.add(
        moss.createFloor({
          chunkSize,
          chunkX,
          chunkZ,
          seed,
          rng,
          lodFactor,
          terrain,
          biomeKey: "mushrooms",
          getBiomeKeyAtPosition: getNatureBiomeKeyAtPosition,
          getBiomeWeightsAtPosition,
          getBlendedGroundColorAtPosition: null
        })
      );
    }

    addNatureAccents({
      group,
      rng,
      assetContext,
      natureBiome,
      natureBiomeKey,
      naturePalette,
      terrain,
      chunkX,
      chunkZ,
      chunkSize,
      seed,
      instanceCollector
    });

    createVillageCenterpiece({
      group,
      terrain,
      assetContext,
      natureBiomeKey,
      rng,
      instanceCollector
    });
  }
};
