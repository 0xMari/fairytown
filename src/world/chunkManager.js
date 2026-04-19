import * as THREE from "three";
import {
  BIOMES,
  BIOME_SEQUENCE,
  getBiomeKeyAt,
  getBiomeWeightsAt,
  getChunkPalette
} from "./biomes.js";
import { createRng } from "./noise.js";
import { PLACEHOLDER_BUILDERS } from "./placeholders.js";
import {
  createTerrainGeometry,
  getTerrainHeight,
  getTerrainHeightInChunk,
  TERRAIN_CHUNK_SEGMENTS
} from "./terrain.js";
import { InstanceBatchCollector, addBuiltAssetToChunk } from "./InstanceBatchCollector.js";
import { isVillageChunk } from "./village/index.js";

function randomBetween(rng, min, max) {
  return min + (max - min) * rng();
}

export class ChunkManager {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.seed = options.seed ?? 424242;
    this.chunkSize = options.chunkSize ?? 42;
    this.terrainSegments = options.terrainSegments ?? TERRAIN_CHUNK_SEGMENTS;
    this.viewRadius = options.viewRadius ?? 2;
    this.maxObjectsPerChunk = options.maxObjectsPerChunk ?? 80;
    this.assetContext = options.assetContext ?? {};
    this.activeChunks = new Map();
    this.updaters = [];
    this.biomeGroundColors = Object.fromEntries(
      BIOME_SEQUENCE.map((key) => [key, new THREE.Color(BIOMES[key].groundColor)])
    );
  }

  getChunkKey(chunkX, chunkZ) {
    return `${chunkX},${chunkZ}`;
  }

  getLoadedChunkCount() {
    return this.activeChunks.size;
  }

  getBiomeKeyAtPosition(x, z) {
    const chunkX = Math.floor(x / this.chunkSize);
    const chunkZ = Math.floor(z / this.chunkSize);

    if (isVillageChunk(chunkX, chunkZ)) {
      return "village";
    }

    return getBiomeKeyAt(x, z, this.seed);
  }

  getBiomeWeightsAtPosition(x, z) {
    return getBiomeWeightsAt(x, z, this.seed);
  }

  getNatureBiomeKeyAtPosition(x, z) {
    return getBiomeKeyAt(x, z, this.seed);
  }

  getNatureBiomeWeightsAtPosition(x, z) {
    return getBiomeWeightsAt(x, z, this.seed);
  }

  getTerrainHeightAtPosition(x, z) {
    return getTerrainHeight(x, z, this.seed);
  }

  getTerrainHeightAtLocalPosition(localX, localZ, chunkX, chunkZ) {
    return getTerrainHeightInChunk(localX, localZ, chunkX, chunkZ, this.chunkSize, this.seed);
  }

  createTerrainGeometryForChunk(chunkX, chunkZ, heightOffset = 0) {
    return createTerrainGeometry({
      chunkX,
      chunkZ,
      chunkSize: this.chunkSize,
      seed: this.seed,
      segments: this.terrainSegments,
      heightOffset
    });
  }

  getBlendedGroundColorAtPosition(x, z, target = new THREE.Color()) {
    const weights = this.getBiomeWeightsAtPosition(x, z);

    target.setRGB(0, 0, 0);

    for (const biomeKey of BIOME_SEQUENCE) {
      const color = this.biomeGroundColors[biomeKey];
      const weight = weights[biomeKey];
      target.r += color.r * weight;
      target.g += color.g * weight;
      target.b += color.b * weight;
    }

    return target;
  }

  update(position, elapsedTime) {
    const currentChunkX = Math.floor(position.x / this.chunkSize);
    const currentChunkZ = Math.floor(position.z / this.chunkSize);
    const wanted = new Set();

    for (let dx = -this.viewRadius; dx <= this.viewRadius; dx += 1) {
      for (let dz = -this.viewRadius; dz <= this.viewRadius; dz += 1) {
        const chunkX = currentChunkX + dx;
        const chunkZ = currentChunkZ + dz;
        const key = this.getChunkKey(chunkX, chunkZ);
        wanted.add(key);

        if (!this.activeChunks.has(key)) {
          const chunk = this.createChunk(chunkX, chunkZ);
          this.activeChunks.set(key, chunk);
          this.scene.add(chunk.group);
          this.updaters.push(...chunk.updaters);
        }
      }
    }

    for (const [key, chunk] of this.activeChunks.entries()) {
      if (wanted.has(key)) {
        continue;
      }

      this.scene.remove(chunk.group);
      this.activeChunks.delete(key);
      this.updaters = this.updaters.filter((entry) => entry.chunkKey !== key);
    }

    for (const updater of this.updaters) {
      updater.update(elapsedTime);
    }
  }

  createChunk(chunkX, chunkZ) {
    const chunkKey = this.getChunkKey(chunkX, chunkZ);
    const natureBiomeKey = this.getNatureBiomeKeyAtPosition(
      (chunkX + 0.5) * this.chunkSize,
      (chunkZ + 0.5) * this.chunkSize
    );
    const biomeKey = isVillageChunk(chunkX, chunkZ) ? "village" : natureBiomeKey;
    const biome = BIOMES[biomeKey];
    const natureBiome = BIOMES[natureBiomeKey];
    const palette = getChunkPalette(biome);
    const naturePalette = getChunkPalette(natureBiome);
    const group = new THREE.Group();
    const updaters = [];
    const instanceCollector = new InstanceBatchCollector();
    group.position.set(chunkX * this.chunkSize, 0, chunkZ * this.chunkSize);
    group.userData = { biomeKey, natureBiomeKey };
    const terrainGeometry = this.createTerrainGeometryForChunk(chunkX, chunkZ);
    const terrainPositions = terrainGeometry.attributes.position;
    const groundColors = new Float32Array(terrainPositions.count * 3);
    const groundColor = new THREE.Color();

    for (let index = 0; index < terrainPositions.count; index += 1) {
      const localX = terrainPositions.getX(index);
      const localZ = -terrainPositions.getY(index);
      const worldX = chunkX * this.chunkSize + localX;
      const worldZ = chunkZ * this.chunkSize + localZ;

      this.getBlendedGroundColorAtPosition(worldX, worldZ, groundColor);
      groundColors[index * 3] = groundColor.r;
      groundColors[index * 3 + 1] = groundColor.g;
      groundColors[index * 3 + 2] = groundColor.b;
    }

    terrainGeometry.setAttribute("color", new THREE.BufferAttribute(groundColors, 3));

    const ground = new THREE.Mesh(
      terrainGeometry,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 1,
        metalness: 0
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    group.add(ground);

    const rng = createRng("chunk", this.seed, chunkX, chunkZ, biomeKey);

    if (biome.createChunkAdditions) {
      biome.createChunkAdditions({
        group,
        chunkKey,
        chunkX,
        chunkZ,
        chunkSize: this.chunkSize,
        seed: this.seed,
        rng,
        palette,
        biome,
        biomeKey,
        natureBiome,
        natureBiomeKey,
        naturePalette,
        assetContext: this.assetContext,
        getBiomeKeyAtPosition: this.getBiomeKeyAtPosition.bind(this),
        getBiomeWeightsAtPosition: this.getBiomeWeightsAtPosition.bind(this),
        getNatureBiomeKeyAtPosition: this.getNatureBiomeKeyAtPosition.bind(this),
        getNatureBiomeWeightsAtPosition: this.getNatureBiomeWeightsAtPosition.bind(this),
        getBlendedGroundColorAtPosition: this.getBlendedGroundColorAtPosition.bind(this),
        instanceCollector,
        terrain: {
          getHeightAtPosition: this.getTerrainHeightAtPosition.bind(this),
          getHeightAtLocalPosition: (localX, localZ) =>
            this.getTerrainHeightAtLocalPosition(localX, localZ, chunkX, chunkZ),
          createChunkGeometry: ({ heightOffset = 0 } = {}) =>
            this.createTerrainGeometryForChunk(chunkX, chunkZ, heightOffset)
        }
      });
    }

    let spawnedAssets = 0;

    for (const [assetName, config] of Object.entries(biome.assetMix)) {
      if (spawnedAssets >= this.maxObjectsPerChunk) {
        break;
      }

      const builder = PLACEHOLDER_BUILDERS[assetName];

      if (!builder) {
        continue;
      }

      const count = Math.floor(randomBetween(rng, config.count[0], config.count[1] + 0.999));

      for (let index = 0; index < count; index += 1) {
        const angle = rng() * Math.PI * 2;
        const radius = Math.sqrt(rng()) * this.chunkSize * 0.65;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const biomeWeight =
          this.getBiomeWeightsAtPosition(chunkX * this.chunkSize + x, chunkZ * this.chunkSize + z)[
            biomeKey
          ] ?? 1;
        const spawnDensity =
          biome.getSpawnDensity?.({
            chunkKey,
            chunkX,
            chunkZ,
            x,
            z,
            worldX: chunkX * this.chunkSize + x,
            worldZ: chunkZ * this.chunkSize + z,
            biomeWeight
          }) ?? 1;
        const totalDensity = biomeWeight * spawnDensity;

        if (totalDensity < 0.12 || rng() > THREE.MathUtils.lerp(0.2, 1, totalDensity)) {
          continue;
        }

        const scale =
          randomBetween(rng, config.scale[0], config.scale[1]) *
          THREE.MathUtils.lerp(0.55, 1, totalDensity);
        const height = this.getTerrainHeightAtLocalPosition(x, z, chunkX, chunkZ);
        const built = builder({
          rng,
          biome,
          biomeKey,
          palette,
          assetContext: this.assetContext,
          seed: this.seed,
          placement: {
            chunkX,
            chunkZ,
            x,
            z,
            worldX: chunkX * this.chunkSize + x,
            worldZ: chunkZ * this.chunkSize + z
          }
        });
        const rotationY = rng() * Math.PI * 2;
        addBuiltAssetToChunk({
          built,
          group,
          instanceCollector,
          position: { x, y: height, z },
          rotationY,
          scale,
          updaters,
          chunkKey
        });
        spawnedAssets += 1;

        if (spawnedAssets >= this.maxObjectsPerChunk) {
          break;
        }
      }
    }

    instanceCollector.flushInto(group);

    return { group, updaters };
  }
}
