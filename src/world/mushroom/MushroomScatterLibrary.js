import * as THREE from "three";
import { PLACEHOLDER_BUILDERS } from "../placeholders.js";
import { addBuiltAssetToChunk } from "../InstanceBatchCollector.js";
import {
  getBiomeWeightFactor,
  getLocalTerrainHeight,
  getPathMetrics
} from "./MossLibrary.js";

function randomBetween(rng, min, max) {
  return min + (max - min) * rng();
}

function addBuiltObject({
  group,
  assetName,
  rng,
  assetContext,
  biome,
  biomeKey,
  palette,
  position,
  scale,
  terrain,
  y = 0,
  instanceCollector
}) {
  const builder = PLACEHOLDER_BUILDERS[assetName];

  if (!builder) {
    return;
  }

  const built = builder({
    rng,
    assetContext,
    biome,
    biomeKey,
    palette
  });

  const terrainHeight = getLocalTerrainHeight(terrain, position.x, position.z);
  addBuiltAssetToChunk({
    built,
    group,
    instanceCollector,
    position: { x: position.x, y: terrainHeight + y, z: position.z },
    rotationY: rng() * Math.PI * 2,
    scale
  });
}

export class MushroomScatterLibrary {
  createForestClusters({
    group,
    chunkSize,
    chunkX,
    chunkZ,
    rng,
    assetContext,
    biome,
    biomeKey,
    palette,
    terrain,
    getBiomeWeightsAtPosition,
    instanceCollector
  }) {
    const anchorCount = Math.floor(randomBetween(rng, 4, 7));
    const halfSize = chunkSize * 0.5;

    for (let index = 0; index < anchorCount; index += 1) {
      const anchor = new THREE.Vector2(
        randomBetween(rng, -halfSize * 0.72, halfSize * 0.72),
        randomBetween(rng, -halfSize * 0.72, halfSize * 0.72)
      );
      const anchorPath = getPathMetrics(anchor.x, anchor.y, chunkX, chunkZ, chunkSize);
      const anchorWeight = getBiomeWeightFactor(
        anchor.x,
        anchor.y,
        chunkX,
        chunkZ,
        chunkSize,
        biomeKey,
        getBiomeWeightsAtPosition
      );

      if (anchorPath.distance < anchorPath.halfWidth + 2.4 || anchorWeight < 0.28) {
        continue;
      }

      addBuiltObject({
        group,
        assetName: "twistedTree",
        rng,
        assetContext,
        biome,
        biomeKey,
        palette,
        position: anchor,
        scale: randomBetween(rng, 1, 1.45),
        terrain,
        instanceCollector
      });

      if (rng() > 0.45) {
        addBuiltObject({
          group,
          assetName: "twistedTree",
          rng,
          assetContext,
          biome,
          biomeKey,
          palette,
          position: new THREE.Vector2(
            anchor.x + randomBetween(rng, -4, 4),
            anchor.y + randomBetween(rng, -4, 4)
          ),
          scale: randomBetween(rng, 0.8, 1.1),
          terrain,
          instanceCollector
        });
      }

      const floorScatterCount = Math.floor(randomBetween(rng, 7, 12));

      for (let scatterIndex = 0; scatterIndex < floorScatterCount; scatterIndex += 1) {
        const angle = rng() * Math.PI * 2;
        const radius = randomBetween(rng, 1.1, 6.5);
        const position = new THREE.Vector2(
          anchor.x + Math.cos(angle) * radius,
          anchor.y + Math.sin(angle) * radius
        );
        const path = getPathMetrics(position.x, position.y, chunkX, chunkZ, chunkSize);
        const biomeWeight = getBiomeWeightFactor(
          position.x,
          position.y,
          chunkX,
          chunkZ,
          chunkSize,
          biomeKey,
          getBiomeWeightsAtPosition
        );

        if (path.distance < path.halfWidth + 0.65 || biomeWeight < 0.18) {
          continue;
        }

        if (rng() > THREE.MathUtils.lerp(0.2, 1, biomeWeight)) {
          continue;
        }

        const roll = rng();
        const scaleMultiplier = THREE.MathUtils.lerp(0.45, 1, biomeWeight);

        if (roll < 0.22) {
          addBuiltObject({
            group,
            assetName: "stump",
            rng,
            assetContext,
            biome,
            biomeKey,
            palette,
            position,
            scale: randomBetween(rng, 0.75, 1.15) * scaleMultiplier,
            terrain,
            instanceCollector
          });
          continue;
        }

        if (roll < 0.45) {
          addBuiltObject({
            group,
            assetName: "rockCluster",
            rng,
            assetContext,
            biome,
            biomeKey,
            palette,
            position,
            scale: randomBetween(rng, 0.55, 0.95) * scaleMultiplier,
            terrain,
            instanceCollector
          });
          continue;
        }

        if (roll < 0.72) {
          addBuiltObject({
            group,
            assetName: "giantMushroom",
            rng,
            assetContext,
            biome,
            biomeKey,
            palette,
            position,
            scale: randomBetween(rng, 0.45, 1.2) * scaleMultiplier,
            terrain,
            instanceCollector
          });
          continue;
        }

        if (roll < 0.88) {
          addBuiltObject({
            group,
            assetName: "bush",
            rng,
            assetContext,
            biome,
            biomeKey,
            palette,
            position,
            scale: randomBetween(rng, 0.7, 1.1) * scaleMultiplier,
            terrain,
            instanceCollector
          });
          continue;
        }

        addBuiltObject({
          group,
          assetName: "sporeCluster",
          rng,
          assetContext,
          biome,
          biomeKey,
          palette,
          position,
          scale: randomBetween(rng, 0.75, 1.1) * scaleMultiplier,
          terrain
        });
      }

      if (rng() > 0.3) {
        addBuiltObject({
          group,
          assetName: "toadstoolRing",
          rng,
          assetContext,
          biome,
          biomeKey,
          palette,
          position: new THREE.Vector2(
            anchor.x + randomBetween(rng, -3.2, 3.2),
            anchor.y + randomBetween(rng, -3.2, 3.2)
          ),
          scale: randomBetween(rng, 0.8, 1.25),
          terrain,
          instanceCollector
        });
      }
    }
  }
}
