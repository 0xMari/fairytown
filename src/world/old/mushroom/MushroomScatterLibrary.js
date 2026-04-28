import * as THREE from "three";
import { PLACEHOLDER_BUILDERS } from "../placeholders.js";
import { addBuiltAssetToChunk } from "../InstanceBatchCollector.js";
import {
  getBiomeWeightFactor,
  getLocalTerrainHeight
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
  const localZ = position.z ?? position.y ?? 0;

  if (!builder) {
    return;
  }

  if ((terrain?.getWaterDataAtLocalPosition?.(position.x, localZ)?.presence ?? 0) > 0.14) {
    return;
  }

  const built = builder({
    rng,
    assetContext,
    biome,
    biomeKey,
    palette
  });

  const terrainHeight = getLocalTerrainHeight(terrain, position.x, localZ);
  addBuiltAssetToChunk({
    built,
    group,
    instanceCollector,
    position: { x: position.x, y: terrainHeight + y, z: localZ },
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
    instanceCollector,
    lodFactor = 1
  }) {
    const scatterLodFactor = THREE.MathUtils.clamp(lodFactor, 0.35, 1.8);
    const scatterDensity = THREE.MathUtils.smoothstep(scatterLodFactor, 0.35, 1.8);
    const anchorCount = Math.max(
      1,
      Math.floor(
        randomBetween(rng, 5, 9) * THREE.MathUtils.lerp(0.45, 1.3, scatterDensity)
      )
    );
    const halfSize = chunkSize * 0.5;

    for (let index = 0; index < anchorCount; index += 1) {
      const anchor = new THREE.Vector2(
        randomBetween(rng, -halfSize * 0.72, halfSize * 0.72),
        randomBetween(rng, -halfSize * 0.72, halfSize * 0.72)
      );
      const anchorWeight = getBiomeWeightFactor(
        anchor.x,
        anchor.y,
        chunkX,
        chunkZ,
        chunkSize,
        biomeKey,
        getBiomeWeightsAtPosition
      );

      if (anchorWeight < 0.28) {
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

      if (rng() > THREE.MathUtils.lerp(0.78, 0.28, scatterDensity)) {
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

      const floorScatterCount = Math.max(
        2,
        Math.floor(
          randomBetween(rng, 9, 16) * THREE.MathUtils.lerp(0.38, 1.38, scatterDensity)
        )
      );

      for (let scatterIndex = 0; scatterIndex < floorScatterCount; scatterIndex += 1) {
        const angle = rng() * Math.PI * 2;
        const radius = randomBetween(rng, 1.1, 6.5);
        const position = new THREE.Vector2(
          anchor.x + Math.cos(angle) * radius,
          anchor.y + Math.sin(angle) * radius
        );
        const biomeWeight = getBiomeWeightFactor(
          position.x,
          position.y,
          chunkX,
          chunkZ,
          chunkSize,
          biomeKey,
          getBiomeWeightsAtPosition
        );

        if (biomeWeight < 0.18) {
          continue;
        }

        if (rng() > THREE.MathUtils.lerp(0.2, 1, biomeWeight)) {
          continue;
        }

        const roll = rng();
        const scaleMultiplier =
          THREE.MathUtils.lerp(0.45, 1, biomeWeight) *
          THREE.MathUtils.lerp(0.82, 1.08, scatterDensity);

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

      if (rng() > THREE.MathUtils.lerp(0.72, 0.22, scatterDensity)) {
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
