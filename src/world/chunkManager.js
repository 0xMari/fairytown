import * as THREE from "three";
import {
  BIOMES,
  BIOME_SEQUENCE,
  getBiomeKeyAt,
  getBiomeWeightsAt,
  getChunkPalette
} from "./biomes.js";
import { createRng } from "./noise.js";
import { PROCEDURAL_ASSET_BUILDERS as PLACEHOLDER_BUILDERS } from "./procedural/ProceduralAssetBuilders.js";
import {
  createTerrainGeometry,
  getTerrainHeight,
  getTerrainHeightInChunk,
  getTerrainNormal,
  getTerrainNormalInChunk,
  getTerrainWaterData,
  TERRAIN_CHUNK_SEGMENTS
} from "./terrain.js";
import { InstanceBatchCollector, addBuiltAssetToChunk } from "./InstanceBatchCollector.js";
import { TerrainWaterLibrary } from "./TerrainWaterLibrary.js";
import { isVillageChunk } from "./villageGrid.js";

const CHUNK_BUILD_STAGE_COUNT = 3;
const DEFAULT_CHUNK_BUILD_STEPS_PER_FRAME = 1;
const DEFAULT_CHUNK_PRELOAD_RADIUS = 2;
const DEFAULT_CHUNK_UNLOAD_GRACE_SECONDS = 0.45;
const DEFAULT_CENTER_CHUNK_LOD_FACTOR = 1.1;
const DEFAULT_NEARBY_CHUNK_LOD_FACTOR = 0.68;
const DEFAULT_POPULATION_REBUILD_LOD_DELTA = Number.POSITIVE_INFINITY;

function randomBetween(rng, min, max) {
  return min + (max - min) * rng();
}

function disposeInstanceBatchMaterials(object) {
  object.traverse((child) => {
    if (!child.isMesh) {
      return;
    }

    const materials = Array.isArray(child.material) ? child.material : [child.material];

    if (child.geometry?.userData?.disposeWithChunk) {
      child.geometry.dispose();
    }

    materials.forEach((material) => {
      if (material?.userData?.disposeWithInstanceBatch) {
        material.dispose();
      }
    });
  });
}

export class ChunkManager {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.seed = options.seed ?? 424242;
    this.chunkSize = options.chunkSize ?? 42;
    this.terrainSegments = options.terrainSegments ?? TERRAIN_CHUNK_SEGMENTS;
    this.viewRadius = options.viewRadius ?? 2;
    this.preloadRadius = Math.max(this.viewRadius, options.preloadRadius ?? DEFAULT_CHUNK_PRELOAD_RADIUS);
    this.maxObjectsPerChunk = options.maxObjectsPerChunk ?? 80;
    this.assetContext = options.assetContext ?? {};
    this.activeChunks = new Map();
    this.generationQueue = [];
    this.updaters = [];
    this.chunkBuildStepsPerFrame = options.chunkBuildStepsPerFrame ?? DEFAULT_CHUNK_BUILD_STEPS_PER_FRAME;
    this.chunkUnloadGraceSeconds =
      options.chunkUnloadGraceSeconds ?? DEFAULT_CHUNK_UNLOAD_GRACE_SECONDS;
    this.centerChunkLodFactor =
      options.centerChunkLodFactor ?? DEFAULT_CENTER_CHUNK_LOD_FACTOR;
    this.nearbyChunkLodFactor =
      options.nearbyChunkLodFactor ?? DEFAULT_NEARBY_CHUNK_LOD_FACTOR;
    this.populationRebuildLodDelta =
      options.populationRebuildLodDelta ?? DEFAULT_POPULATION_REBUILD_LOD_DELTA;
    this.lastElapsedTime = 0;
    this.terrainWater = new TerrainWaterLibrary();
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

  getWantedChunkEntries(currentChunkX, currentChunkZ, radius = this.preloadRadius) {
    const entries = [];

    for (let dx = -radius; dx <= radius; dx += 1) {
      for (let dz = -radius; dz <= radius; dz += 1) {
        const chunkX = currentChunkX + dx;
        const chunkZ = currentChunkZ + dz;
        entries.push({
          chunkX,
          chunkZ,
          key: this.getChunkKey(chunkX, chunkZ),
          distanceSq: dx * dx + dz * dz
        });
      }
    }

    entries.sort((left, right) => left.distanceSq - right.distanceSq);
    return entries;
  }

  getTargetStageForChunk(chunkX, chunkZ, currentChunkX, currentChunkZ) {
    const ringDistance = Math.max(
      Math.abs(chunkX - currentChunkX),
      Math.abs(chunkZ - currentChunkZ)
    );

    if (ringDistance <= this.viewRadius) {
      return CHUNK_BUILD_STAGE_COUNT;
    }

    if (ringDistance <= this.preloadRadius) {
      return 1;
    }

    return 0;
  }

  getChunkRingDistance(chunkX, chunkZ, currentChunkX, currentChunkZ) {
    return Math.max(Math.abs(chunkX - currentChunkX), Math.abs(chunkZ - currentChunkZ));
  }

  getLodFactorForChunk(chunkX, chunkZ, currentChunkX, currentChunkZ) {
    const ringDistance = this.getChunkRingDistance(chunkX, chunkZ, currentChunkX, currentChunkZ);

    if (ringDistance === 0 || this.viewRadius <= 0) {
      return this.centerChunkLodFactor;
    }

    if (ringDistance > this.viewRadius) {
      return 0;
    }

    const normalizedDistance = ringDistance / this.viewRadius;
    return THREE.MathUtils.lerp(
      this.centerChunkLodFactor,
      this.nearbyChunkLodFactor,
      THREE.MathUtils.smoothstep(normalizedDistance, 0, 1)
    );
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

  getTerrainNormalAtPosition(x, z, sampleDistance, target) {
    return getTerrainNormal(x, z, this.seed, sampleDistance, target);
  }

  getTerrainHeightAtLocalPosition(localX, localZ, chunkX, chunkZ) {
    return getTerrainHeightInChunk(localX, localZ, chunkX, chunkZ, this.chunkSize, this.seed);
  }

  getTerrainNormalAtLocalPosition(localX, localZ, chunkX, chunkZ, sampleDistance, target) {
    return getTerrainNormalInChunk(
      localX,
      localZ,
      chunkX,
      chunkZ,
      this.chunkSize,
      this.seed,
      sampleDistance,
      target
    );
  }

  getTerrainWaterDataAtPosition(x, z) {
    return getTerrainWaterData(x, z, this.seed);
  }

  getVisibleTerrainWaterDataAtPosition(x, z) {
    const chunkX = Math.floor(x / this.chunkSize);
    const chunkZ = Math.floor(z / this.chunkSize);
    const localX = x - chunkX * this.chunkSize;
    const localZ = z - chunkZ * this.chunkSize;
    const localCenterX = localX - this.chunkSize * 0.5;
    const localCenterZ = localZ - this.chunkSize * 0.5;
    const rawWaterData = this.getTerrainWaterDataAtPosition(x, z);
    const villageClearance =
      isVillageChunk(chunkX, chunkZ)
        ? THREE.MathUtils.smoothstep(Math.hypot(localCenterX, localCenterZ), 10, 18)
        : 1;
    const presence = rawWaterData.presence * villageClearance;
    const depth = rawWaterData.depth * villageClearance;

    return {
      ...rawWaterData,
      presence,
      depth
    };
  }

  getSurfaceHeightAtPosition(x, z) {
    const terrainHeight = this.getTerrainHeightAtPosition(x, z);
    const waterData = this.getVisibleTerrainWaterDataAtPosition(x, z);

    if (waterData.presence < 0.12) {
      return terrainHeight;
    }

    return Math.max(terrainHeight, waterData.surfaceHeight);
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
    this.lastElapsedTime = elapsedTime;
    const wanted = new Set();
    const wantedEntries = this.getWantedChunkEntries(
      currentChunkX,
      currentChunkZ,
      this.preloadRadius
    );

    for (const entry of wantedEntries) {
      wanted.add(entry.key);

      let chunk = this.activeChunks.get(entry.key);

      if (!chunk) {
        chunk = this.createChunkRecord(entry.chunkX, entry.chunkZ);
        this.activeChunks.set(entry.key, chunk);
        this.scene.add(chunk.group);
      }

      chunk.missingSince = null;
      chunk.ringDistance = this.getChunkRingDistance(
        entry.chunkX,
        entry.chunkZ,
        currentChunkX,
        currentChunkZ
      );
      chunk.targetStage = this.getTargetStageForChunk(
        entry.chunkX,
        entry.chunkZ,
        currentChunkX,
        currentChunkZ
      );
      chunk.lodFactor = this.getLodFactorForChunk(
        entry.chunkX,
        entry.chunkZ,
        currentChunkX,
        currentChunkZ
      );

      this.syncChunkPopulationForLod(chunk);

      if (chunk.stage < chunk.targetStage && !chunk.isQueued) {
        this.enqueueChunkBuild(chunk);
      }
    }

    for (const [key, chunk] of this.activeChunks.entries()) {
      if (wanted.has(key)) {
        continue;
      }

      if (chunk.missingSince === null) {
        chunk.missingSince = elapsedTime;
        continue;
      }

      if (elapsedTime - chunk.missingSince < this.chunkUnloadGraceSeconds) {
        continue;
      }

      this.disposeChunk(key, chunk);
    }

    this.processGenerationQueue();

    for (const updater of this.updaters) {
      updater.update(elapsedTime);
    }
  }

  syncChunkPopulationForLod(chunk) {
    if (chunk.stage < 1) {
      return;
    }

    if (chunk.targetStage <= 1) {
      if (chunk.stage > 1 || chunk.detailsBuildTarget) {
        this.clearChunkDetails(chunk);
      }

      return;
    }

    if (
      chunk.stage !== CHUNK_BUILD_STAGE_COUNT ||
      chunk.detailsLodFactor === null ||
      chunk.detailsBuildTarget
    ) {
      return;
    }

    if (
      Math.abs(chunk.lodFactor - chunk.detailsLodFactor) < this.populationRebuildLodDelta
    ) {
      return;
    }

    this.scheduleChunkDetailsRebuild(chunk);
  }

  createChunkPopulationRng(chunk, lodFactor = chunk.lodFactor ?? 1) {
    return createRng(
      "chunk-details",
      this.seed,
      chunk.chunkX,
      chunk.chunkZ,
      chunk.biomeKey,
      Math.round(lodFactor * 100)
    );
  }

  createChunkDetailsGroup() {
    const details = new THREE.Group();
    details.name = "chunk-details";
    return details;
  }

  clearChunkDetails(chunk) {
    if (chunk.detailsBuildTarget) {
      disposeInstanceBatchMaterials(chunk.detailsBuildTarget);
      chunk.detailsBuildTarget = null;
      chunk.pendingDetailsLodFactor = null;
    }

    if (chunk.details) {
      chunk.content.remove(chunk.details);
      disposeInstanceBatchMaterials(chunk.details);
    }

    chunk.details = this.createChunkDetailsGroup();
    chunk.content.add(chunk.details);
    chunk.instanceCollector = new InstanceBatchCollector();
    chunk.updaters = [];
    chunk.hasRegisteredUpdaters = false;
    chunk.detailsLodFactor = null;
    chunk.stage = Math.min(chunk.stage, 1);
    this.updaters = this.updaters.filter((entry) => entry.chunkKey !== chunk.key);
  }

  scheduleChunkDetailsRebuild(chunk) {
    this.updaters = this.updaters.filter((entry) => entry.chunkKey !== chunk.key);
    chunk.updaters = [];
    chunk.instanceCollector = new InstanceBatchCollector();
    chunk.rng = this.createChunkPopulationRng(chunk);
    chunk.detailsBuildTarget = this.createChunkDetailsGroup();
    chunk.pendingDetailsLodFactor = chunk.lodFactor;
    chunk.hasRegisteredUpdaters = false;
    chunk.stage = 1;

    if (!chunk.isQueued) {
      this.enqueueChunkBuild(chunk);
    }
  }

  commitChunkDetailsRebuild(chunk) {
    if (!chunk.detailsBuildTarget) {
      chunk.detailsLodFactor = chunk.lodFactor;
      return;
    }

    if (chunk.details) {
      chunk.content.remove(chunk.details);
      disposeInstanceBatchMaterials(chunk.details);
    }

    chunk.details = chunk.detailsBuildTarget;
    chunk.content.add(chunk.details);
    chunk.detailsLodFactor = chunk.pendingDetailsLodFactor ?? chunk.lodFactor;
    chunk.detailsBuildTarget = null;
    chunk.pendingDetailsLodFactor = null;
  }

  enqueueChunkBuild(chunk) {
    chunk.isQueued = true;
    this.generationQueue.push(chunk.key);
  }

  processGenerationQueue() {
    let stepsRemaining = this.chunkBuildStepsPerFrame;

    while (stepsRemaining > 0 && this.generationQueue.length > 0) {
      const chunkKey = this.generationQueue.shift();
      const chunk = this.activeChunks.get(chunkKey);

      stepsRemaining -= 1;

      if (!chunk) {
        continue;
      }

      chunk.isQueued = false;

      if (chunk.missingSince !== null) {
        continue;
      }

      if (chunk.stage >= chunk.targetStage) {
        continue;
      }

      if (chunk.stage === 0) {
        this.buildChunkTerrain(chunk);
        chunk.stage = 1;
        chunk.group.visible = true;
      } else if (chunk.stage === 1) {
        if (!chunk.detailsBuildTarget && chunk.detailsLodFactor === null) {
          chunk.rng = this.createChunkPopulationRng(chunk);
        }

        this.buildChunkAdditions(chunk);
        chunk.stage = 2;
      } else if (chunk.stage === 2) {
        this.buildChunkProps(chunk);
        chunk.stage = 3;
      }

      if (chunk.stage < chunk.targetStage) {
        this.enqueueChunkBuild(chunk);
      }
    }
  }

  disposeChunk(key, chunk) {
    if (chunk.terrainMesh?.geometry) {
      chunk.terrainMesh.geometry.dispose();
    }

    if (chunk.waterMesh?.geometry) {
      chunk.waterMesh.geometry.dispose();
    }

    if (chunk.detailsBuildTarget) {
      disposeInstanceBatchMaterials(chunk.detailsBuildTarget);
    }

    if (chunk.details) {
      disposeInstanceBatchMaterials(chunk.details);
    }

    this.scene.remove(chunk.group);
    this.activeChunks.delete(key);
    this.updaters = this.updaters.filter((entry) => entry.chunkKey !== key);
  }

  rebuildAllChunks() {
    const activeChunkEntries = Array.from(this.activeChunks.entries());

    this.generationQueue.length = 0;

    for (const [key, chunk] of activeChunkEntries) {
      this.disposeChunk(key, chunk);
    }
  }

  createChunkRecord(chunkX, chunkZ) {
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
    const content = new THREE.Group();
    const details = this.createChunkDetailsGroup();
    const updaters = [];
    const instanceCollector = new InstanceBatchCollector();
    group.position.set(chunkX * this.chunkSize, 0, chunkZ * this.chunkSize);
    group.userData = { biomeKey, natureBiomeKey };
    group.visible = false;
    group.add(content);
    content.add(details);

    return {
      key: chunkKey,
      chunkX,
      chunkZ,
      biomeKey,
      biome,
      natureBiomeKey,
      natureBiome,
      palette,
      naturePalette,
      group,
      content,
      details,
      detailsBuildTarget: null,
      detailsLodFactor: null,
      pendingDetailsLodFactor: null,
      updaters,
      instanceCollector,
      rng: createRng("chunk", this.seed, chunkX, chunkZ, biomeKey),
      stage: 0,
      targetStage: 1,
      ringDistance: Number.POSITIVE_INFINITY,
      lodFactor: 0,
      isQueued: false,
      missingSince: null,
      hasRegisteredUpdaters: false
    };
  }

  getTerrainContextForChunk(chunk) {
    return {
      getHeightAtPosition: this.getTerrainHeightAtPosition.bind(this),
      getNormalAtPosition: this.getTerrainNormalAtPosition.bind(this),
      getHeightAtLocalPosition: (localX, localZ) =>
        this.getTerrainHeightAtLocalPosition(localX, localZ, chunk.chunkX, chunk.chunkZ),
      getNormalAtLocalPosition: (localX, localZ, sampleDistance, target) =>
        this.getTerrainNormalAtLocalPosition(
          localX,
          localZ,
          chunk.chunkX,
          chunk.chunkZ,
          sampleDistance,
          target
        ),
      getWaterDataAtPosition: this.getVisibleTerrainWaterDataAtPosition.bind(this),
      getWaterDataAtLocalPosition: (localX, localZ) =>
        this.getVisibleTerrainWaterDataAtPosition(
          chunk.chunkX * this.chunkSize + localX,
          chunk.chunkZ * this.chunkSize + localZ
        ),
      createChunkGeometry: ({ heightOffset = 0 } = {}) =>
        this.createTerrainGeometryForChunk(chunk.chunkX, chunk.chunkZ, heightOffset)
    };
  }

  buildChunkTerrain(chunk) {
    const terrainGeometry = this.createTerrainGeometryForChunk(chunk.chunkX, chunk.chunkZ);
    const terrainPositions = terrainGeometry.attributes.position;
    const groundColors = new Float32Array(terrainPositions.count * 3);
    const meadowWeights = new Float32Array(terrainPositions.count);
    const mushroomWeights = new Float32Array(terrainPositions.count);
    const crystalWeights = new Float32Array(terrainPositions.count);
    const waterMasks = new Float32Array(terrainPositions.count);
    const waterDepths = new Float32Array(terrainPositions.count);
    const groundColor = new THREE.Color();
    let maxWaterMask = 0;

    for (let index = 0; index < terrainPositions.count; index += 1) {
      const localX = terrainPositions.getX(index);
      const localZ = -terrainPositions.getY(index);
      const worldX = chunk.chunkX * this.chunkSize + localX;
      const worldZ = chunk.chunkZ * this.chunkSize + localZ;
      const biomeWeights = this.getBiomeWeightsAtPosition(worldX, worldZ);
      const waterData = this.getVisibleTerrainWaterDataAtPosition(worldX, worldZ);
      const waterMask = waterData.presence;
      const waterDepth = waterData.depth;
      const terrainHeight = terrainPositions.getZ(index);

      if (waterMask > 0.12) {
        const submergedBedHeight = waterData.surfaceHeight - (0.28 + waterDepth * 1.85);
        const flattenedHeight = THREE.MathUtils.lerp(
          terrainHeight,
          Math.min(terrainHeight, submergedBedHeight),
          THREE.MathUtils.smoothstep(waterMask, 0.12, 0.72)
        );
        terrainPositions.setZ(index, flattenedHeight);
      }

      groundColor.setRGB(0, 0, 0);

      for (const biomeKey of BIOME_SEQUENCE) {
        const color = this.biomeGroundColors[biomeKey];
        const weight = biomeWeights[biomeKey] ?? 0;
        groundColor.r += color.r * weight;
        groundColor.g += color.g * weight;
        groundColor.b += color.b * weight;
      }

      groundColors[index * 3] = groundColor.r;
      groundColors[index * 3 + 1] = groundColor.g;
      groundColors[index * 3 + 2] = groundColor.b;
      meadowWeights[index] = biomeWeights.meadow ?? 0;
      mushroomWeights[index] = biomeWeights.mushrooms ?? 0;
      crystalWeights[index] = biomeWeights.crystal ?? 0;
      waterMasks[index] = waterMask;
      waterDepths[index] = waterDepth;
      maxWaterMask = Math.max(maxWaterMask, waterMask);
    }

    terrainPositions.needsUpdate = true;
    terrainGeometry.computeVertexNormals();
    terrainGeometry.computeBoundingBox();
    terrainGeometry.computeBoundingSphere();

    terrainGeometry.setAttribute("color", new THREE.BufferAttribute(groundColors, 3));
    terrainGeometry.setAttribute("meadowWeight", new THREE.BufferAttribute(meadowWeights, 1));
    terrainGeometry.setAttribute("mushroomWeight", new THREE.BufferAttribute(mushroomWeights, 1));
    terrainGeometry.setAttribute("crystalWeight", new THREE.BufferAttribute(crystalWeights, 1));

    const terrainMaterial =
      this.assetContext?.procedural?.terrain?.getTerrainMaterial?.() ??
      this.assetContext?.medow?.ground?.getTerrainMaterial?.() ??
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 1,
        metalness: 0
      });

    const ground = new THREE.Mesh(
      terrainGeometry,
      terrainMaterial
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    chunk.content.add(ground);
    chunk.terrainMesh = ground;

    if (maxWaterMask > 0.18) {
      const waterGeometry = new THREE.PlaneGeometry(
        this.chunkSize,
        this.chunkSize,
        this.terrainSegments,
        this.terrainSegments
      );
      const waterPositions = waterGeometry.attributes.position;
      const waterUvs = waterGeometry.attributes.uv;

      for (let index = 0; index < waterPositions.count; index += 1) {
        const localX = waterPositions.getX(index);
        const localZ = -waterPositions.getY(index);
        const worldX = chunk.chunkX * this.chunkSize + localX;
        const worldZ = chunk.chunkZ * this.chunkSize + localZ;
        const waterData = this.getVisibleTerrainWaterDataAtPosition(worldX, worldZ);
        waterPositions.setZ(index, waterData.surfaceHeight);
        waterUvs.setXY(index, worldX / 18, worldZ / 18);
      }

      waterPositions.needsUpdate = true;
      waterUvs.needsUpdate = true;
      waterGeometry.computeVertexNormals();
      waterGeometry.computeBoundingBox();
      waterGeometry.computeBoundingSphere();
      waterGeometry.setAttribute("waterMask", new THREE.BufferAttribute(waterMasks, 1));
      waterGeometry.setAttribute("waterDepth", new THREE.BufferAttribute(waterDepths, 1));

      const water = new THREE.Mesh(waterGeometry, this.terrainWater.getMaterial());
      water.rotation.x = -Math.PI / 2;
      water.receiveShadow = false;
      water.castShadow = false;
      water.renderOrder = 2;
      chunk.content.add(water);
      chunk.waterMesh = water;
    }
  }

  buildChunkAdditions(chunk) {
    if (!chunk.biome.createChunkAdditions) {
      return;
    }

    const detailsGroup = chunk.detailsBuildTarget ?? chunk.details ?? chunk.content;

    chunk.biome.createChunkAdditions({
      group: detailsGroup,
      chunkKey: chunk.key,
      chunkX: chunk.chunkX,
      chunkZ: chunk.chunkZ,
      chunkSize: this.chunkSize,
      seed: this.seed,
      rng: chunk.rng,
      palette: chunk.palette,
      biome: chunk.biome,
      biomeKey: chunk.biomeKey,
      natureBiome: chunk.natureBiome,
      natureBiomeKey: chunk.natureBiomeKey,
      naturePalette: chunk.naturePalette,
      lodFactor: chunk.lodFactor,
      lodRingDistance: chunk.ringDistance,
      assetContext: this.assetContext,
      getBiomeKeyAtPosition: this.getBiomeKeyAtPosition.bind(this),
      getBiomeWeightsAtPosition: this.getBiomeWeightsAtPosition.bind(this),
      getNatureBiomeKeyAtPosition: this.getNatureBiomeKeyAtPosition.bind(this),
      getNatureBiomeWeightsAtPosition: this.getNatureBiomeWeightsAtPosition.bind(this),
      getBlendedGroundColorAtPosition: this.getBlendedGroundColorAtPosition.bind(this),
      instanceCollector: chunk.instanceCollector,
      terrain: this.getTerrainContextForChunk(chunk)
    });
  }

  buildChunkProps(chunk) {
    let spawnedAssets = 0;
    const lodFactor = chunk.lodFactor ?? 1;
    const lodObjectBudget = Math.max(10, Math.floor(this.maxObjectsPerChunk * lodFactor));
    const detailsGroup = chunk.detailsBuildTarget ?? chunk.details ?? chunk.content;

    for (const [assetName, config] of Object.entries(chunk.biome.assetMix)) {
      if (spawnedAssets >= lodObjectBudget) {
        break;
      }

      const builder = PLACEHOLDER_BUILDERS[assetName];

      if (!builder) {
        continue;
      }

      const baseCount = Math.floor(
        randomBetween(chunk.rng, config.count[0], config.count[1] + 0.999)
      );
      const assetLodFactor = this.getAssetLodFactor(assetName, lodFactor);
      const count = Math.max(0, Math.floor(baseCount * assetLodFactor));

      if (count === 0) {
        continue;
      }

      for (let index = 0; index < count; index += 1) {
        const angle = chunk.rng() * Math.PI * 2;
        const radius = Math.sqrt(chunk.rng()) * this.chunkSize * 0.65;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const biomeWeight =
          this.getBiomeWeightsAtPosition(
            chunk.chunkX * this.chunkSize + x,
            chunk.chunkZ * this.chunkSize + z
          )[chunk.biomeKey] ?? 1;
        const visibleWaterPresence = this.getVisibleTerrainWaterDataAtPosition(
          chunk.chunkX * this.chunkSize + x,
          chunk.chunkZ * this.chunkSize + z
        ).presence;
        const spawnDensity =
          chunk.biome.getSpawnDensity?.({
            assetName,
            chunkKey: chunk.key,
            chunkX: chunk.chunkX,
            chunkZ: chunk.chunkZ,
            seed: this.seed,
            x,
            z,
            worldX: chunk.chunkX * this.chunkSize + x,
            worldZ: chunk.chunkZ * this.chunkSize + z,
            biomeWeight,
            waterPresence: visibleWaterPresence
          }) ?? 1;
        if (visibleWaterPresence > 0.14) {
          continue;
        }

        const dryLandFactor = THREE.MathUtils.lerp(
          1,
          0,
          THREE.MathUtils.smoothstep(visibleWaterPresence, 0.08, 0.24)
        );
        const totalDensity = biomeWeight * spawnDensity * assetLodFactor * dryLandFactor;
        const placementDensity = THREE.MathUtils.clamp(totalDensity, 0, 1);

        if (
          placementDensity < 0.12 ||
          chunk.rng() > THREE.MathUtils.lerp(0.2, 1, placementDensity)
        ) {
          continue;
        }

        const scale =
          randomBetween(chunk.rng, config.scale[0], config.scale[1]) *
          THREE.MathUtils.lerp(0.55, 1.04, placementDensity);
        const height = this.getTerrainHeightAtLocalPosition(
          x,
          z,
          chunk.chunkX,
          chunk.chunkZ
        );
        const terrainNormal = this.getTerrainNormalAtLocalPosition(
          x,
          z,
          chunk.chunkX,
          chunk.chunkZ
        );
        const built = builder({
          rng: chunk.rng,
          biome: chunk.biome,
          biomeKey: chunk.biomeKey,
          palette: chunk.palette,
          assetContext: this.assetContext,
          seed: this.seed,
          lodFactor,
          lodRingDistance: chunk.ringDistance,
          placement: {
            chunkX: chunk.chunkX,
            chunkZ: chunk.chunkZ,
            x,
            z,
            worldX: chunk.chunkX * this.chunkSize + x,
            worldZ: chunk.chunkZ * this.chunkSize + z
          }
        });
        const rotationY = chunk.rng() * Math.PI * 2;
        const added = addBuiltAssetToChunk({
          built,
          group: detailsGroup,
          instanceCollector: chunk.instanceCollector,
          position: { x, y: height, z },
          terrainNormal,
          rotationY,
          scale,
          updaters: chunk.updaters,
          chunkKey: chunk.key
        });

        if (!added) {
          continue;
        }

        spawnedAssets += 1;

        if (spawnedAssets >= lodObjectBudget) {
          break;
        }
      }
    }

    chunk.instanceCollector.flushInto(detailsGroup);
    this.commitChunkDetailsRebuild(chunk);

    if (!chunk.hasRegisteredUpdaters && chunk.updaters.length > 0) {
      this.updaters.push(...chunk.updaters);
      chunk.hasRegisteredUpdaters = true;
    }
  }

  getAssetLodFactor(assetName, lodFactor) {
    const density = Math.max(0, lodFactor);

    if (
      assetName === "fireflyCluster" ||
      assetName === "sporeCluster" ||
      assetName === "wispCluster" ||
      assetName === "glowWisp"
    ) {
      return Math.min(1.35, Math.pow(density, 1.45));
    }

    if (
      assetName === "flowerPatch" ||
      assetName === "bush" ||
      assetName === "glowBloom" ||
      assetName === "flowerSpray" ||
      assetName === "fernPatch" ||
      assetName === "mushroomBloom" ||
      assetName === "crystalBloom" ||
      assetName === "sapling"
    ) {
      return Math.min(1.85, Math.pow(density, 1.12));
    }

    if (
      assetName === "fairyTree" ||
      assetName === "twistedTree" ||
      assetName === "silverTree" ||
      assetName === "elderTree" ||
      assetName === "canopyTree" ||
      assetName === "slenderTree"
    ) {
      return Math.min(1.35, Math.pow(density, 0.85));
    }

    return Math.min(1.55, density);
  }
}
