import * as THREE from "three";
import { fbm2D } from "../noise.js";

const MOSS_TEXTURE_URL = "/textures/texture-moss.jpg";
const PATH_PATCH_GEOMETRY = new THREE.CircleGeometry(1, 18);
const BIOME_EDGE_SAMPLE_RADII = [3.5, 7, 10.5, 14];
const BIOME_EDGE_SAMPLE_DIRECTIONS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [0.7071, 0.7071],
  [0.7071, -0.7071],
  [-0.7071, 0.7071],
  [-0.7071, -0.7071]
];
const MOSS_PATCH_SIZE = 12;

const dirtFloorMaterial = new THREE.MeshStandardMaterial({
  color: "#ffffff",
  roughness: 1,
  metalness: 0,
  vertexColors: true
});

const mossBlanketMaterial = new THREE.MeshStandardMaterial({
  color: "#ffffff",
  roughness: 1,
  metalness: 0,
  emissive: "#243018",
  emissiveIntensity: 0.02,
  vertexColors: true
});

const mossPuffMaterial = new THREE.MeshStandardMaterial({
  color: "#6b883a",
  roughness: 1,
  metalness: 0,
  emissive: "#2a361d",
  emissiveIntensity: 0.02
});

const mossDeepMaterial = new THREE.MeshStandardMaterial({
  color: "#3c5224",
  roughness: 0.98,
  metalness: 0,
  emissive: "#16200e",
  emissiveIntensity: 0.015
});

const mossHighlightMaterial = new THREE.MeshStandardMaterial({
  color: "#93ad4a",
  roughness: 1,
  metalness: 0,
  emissive: "#34441d",
  emissiveIntensity: 0.03
});

const pathMaterial = new THREE.MeshStandardMaterial({
  color: "#2a1f16",
  roughness: 1,
  metalness: 0
});



const mossGeometry = new THREE.SphereGeometry(1, 20, 18);

function randomBetween(rng, min, max) {
  return min + (max - min) * rng();
}

function smoothstep01(min, max, value) {
  const t = THREE.MathUtils.clamp((value - min) / (max - min), 0, 1);
  return t * t * (3 - 2 * t);
}

function getPatchKey(localX, localZ, patchOffset, patchSize) {
  const patchX = Math.floor((localX + patchOffset) / patchSize);
  const patchZ = Math.floor((localZ + patchOffset) / patchSize);
  return `${patchX},${patchZ}`;
}

function configureTexture(texture, repeatX, repeatY, colorSpace, anisotropy = 1) {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.colorSpace = colorSpace;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
  return texture;
}

function createTextureSet(baseTexture, options) {
  return {
    map: configureTexture(
      baseTexture.clone(),
      options.repeat[0],
      options.repeat[1],
      THREE.SRGBColorSpace,
      options.anisotropy
    ),
    roughnessMap: configureTexture(
      baseTexture.clone(),
      options.repeat[0],
      options.repeat[1],
      THREE.NoColorSpace,
      options.anisotropy
    ),
    bumpMap: configureTexture(
      baseTexture.clone(),
      options.repeat[0],
      options.repeat[1],
      THREE.NoColorSpace,
      options.anisotropy
    ),
    displacementMap: configureTexture(
      baseTexture.clone(),
      options.repeat[0],
      options.repeat[1],
      THREE.NoColorSpace,
      options.anisotropy
    )
  };
}

function applyTextureSet(material, textureSet, options = {}) {
  material.map = options.useColorMap === false ? null : textureSet.map;
  material.roughnessMap = options.useRoughnessMap === false ? null : textureSet.roughnessMap;
  material.bumpMap = options.useBumpMap === false ? null : textureSet.bumpMap;
  material.bumpScale = options.useBumpMap === false ? 0 : options.bumpScale ?? 0;

  if (options.useDisplacement) {
    material.displacementMap = textureSet.displacementMap;
    material.displacementScale = options.displacementScale ?? 0;
    material.displacementBias = options.displacementBias ?? 0;
  } else {
    material.displacementMap = null;
    material.displacementScale = 0;
    material.displacementBias = 0;
  }

  material.needsUpdate = true;
}

function sampleWarpedField(worldX, worldZ, seed, options) {
  const warpX =
    (fbm2D(
      (worldX + options.offsetX) / options.warpScale,
      (worldZ + options.offsetZ) / options.warpScale,
      seed + options.seedOffset,
      3,
      2.05,
      0.5
    ) -
      0.5) *
    options.warpStrength;
  const warpZ =
    (fbm2D(
      (worldX - options.offsetZ) / options.warpScale,
      (worldZ - options.offsetX) / options.warpScale,
      seed + options.seedOffset + 19,
      3,
      2.08,
      0.48
    ) -
      0.5) *
    options.warpStrength;

  return fbm2D(
    (worldX + warpX) / options.baseScale,
    (worldZ + warpZ) / options.baseScale,
    seed + options.seedOffset + 61,
    options.octaves ?? 4,
    options.lacunarity ?? 2.08,
    options.gain ?? 0.52
  );
}

function sampleMossPatchField(worldX, worldZ, seed) {
  const broad = sampleWarpedField(worldX, worldZ, seed, {
    offsetX: 260,
    offsetZ: -180,
    baseScale: 52,
    warpScale: 150,
    warpStrength: 19,
    seedOffset: 2101
  });
  const detail = sampleWarpedField(worldX - 130, worldZ + 170, seed, {
    offsetX: -320,
    offsetZ: 110,
    baseScale: 23,
    warpScale: 72,
    warpStrength: 9,
    seedOffset: 2161,
    octaves: 3,
    lacunarity: 2.18,
    gain: 0.5
  });

  return broad * 0.7 + detail * 0.3;
}

function sampleMossVariationField(worldX, worldZ, seed) {
  return sampleWarpedField(worldX + 95, worldZ - 120, seed, {
    offsetX: 160,
    offsetZ: 260,
    baseScale: 36,
    warpScale: 96,
    warpStrength: 8,
    seedOffset: 2237,
    octaves: 3,
    lacunarity: 2.14,
    gain: 0.52
  });
}

function sampleMossHeightField(worldX, worldZ, seed) {
  return sampleWarpedField(worldX - 210, worldZ + 140, seed, {
    offsetX: -90,
    offsetZ: 340,
    baseScale: 31,
    warpScale: 84,
    warpStrength: 6,
    seedOffset: 2311,
    octaves: 3,
    lacunarity: 2.2,
    gain: 0.48
  });
}

export function getPathCenterZ(worldX) {
  return Math.sin(worldX * 0.045) * 8 + Math.cos(worldX * 0.018) * 3.5;
}

export function getPathHalfWidth(worldX) {
  return 2.2 + (Math.sin(worldX * 0.022) * 0.5 + 0.5) * 0.9;
}

export function getPathMetrics(localX, localZ, chunkX, chunkZ, chunkSize) {
  const worldX = chunkX * chunkSize + localX;
  const worldZ = chunkZ * chunkSize + localZ;
  const centerZ = getPathCenterZ(worldX);
  const halfWidth = getPathHalfWidth(worldX);

  return {
    distance: Math.abs(worldZ - centerZ),
    halfWidth,
    worldX
  };
}

function getBiomeInteriorFactor(
  localX,
  localZ,
  chunkX,
  chunkZ,
  chunkSize,
  biomeKey,
  getBiomeKeyAtPosition
) {
  if (!getBiomeKeyAtPosition) {
    return 1;
  }

  const worldX = chunkX * chunkSize + localX;
  const worldZ = chunkZ * chunkSize + localZ;

  if (getBiomeKeyAtPosition(worldX, worldZ) !== biomeKey) {
    return 0;
  }

  let clearance = BIOME_EDGE_SAMPLE_RADII[BIOME_EDGE_SAMPLE_RADII.length - 1];

  for (const radius of BIOME_EDGE_SAMPLE_RADII) {
    let touchesAnotherBiome = false;

    for (const [directionX, directionZ] of BIOME_EDGE_SAMPLE_DIRECTIONS) {
      if (
        getBiomeKeyAtPosition(worldX + directionX * radius, worldZ + directionZ * radius) !==
        biomeKey
      ) {
        touchesAnotherBiome = true;
        break;
      }
    }

    if (touchesAnotherBiome) {
      clearance = radius;
      break;
    }
  }

  return smoothstep01(3.5, 14, clearance);
}

export function getBiomeWeightFactor(
  localX,
  localZ,
  chunkX,
  chunkZ,
  chunkSize,
  biomeKey,
  getBiomeWeightsAtPosition
) {
  if (!getBiomeWeightsAtPosition) {
    return 1;
  }

  const worldX = chunkX * chunkSize + localX;
  const worldZ = chunkZ * chunkSize + localZ;
  return getBiomeWeightsAtPosition(worldX, worldZ)?.[biomeKey] ?? 1;
}

export function getLocalTerrainHeight(terrain, localX, localZ) {
  return terrain?.getHeightAtLocalPosition?.(localX, localZ) ?? 0;
}

function createTerrainSurfaceGeometry(terrain, chunkSize, heightOffset = 0) {
  if (terrain?.createChunkGeometry) {
    return terrain.createChunkGeometry({ heightOffset });
  }

  return new THREE.PlaneGeometry(chunkSize, chunkSize, 1, 1);
}

function tintSurfaceGeometry(geometry, options) {
  const positions = geometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  const baseColor = new THREE.Color();
  const tintedColor = new THREE.Color();

  for (let index = 0; index < positions.count; index += 1) {
    const localX = positions.getX(index);
    const localZ = -positions.getY(index);
    const worldX = options.chunkX * options.chunkSize + localX;
    const worldZ = options.chunkZ * options.chunkSize + localZ;
    const biomeWeight = getBiomeWeightFactor(
      localX,
      localZ,
      options.chunkX,
      options.chunkZ,
      options.chunkSize,
      options.biomeKey,
      options.getBiomeWeightsAtPosition
    );
    const coverage = sampleMossPatchField(worldX, worldZ, options.seed);
    const breakup = sampleMossVariationField(worldX, worldZ, options.seed);
    const strength =
      biomeWeight *
      THREE.MathUtils.smoothstep(coverage, options.threshold[0], options.threshold[1]) *
      THREE.MathUtils.lerp(0.7, 1.14, breakup) *
      options.intensity;

    if (options.getBlendedGroundColorAtPosition) {
      options.getBlendedGroundColorAtPosition(worldX, worldZ, baseColor);
    } else {
      baseColor.set("#425133");
    }

    tintedColor.copy(baseColor).lerp(options.tintColor, THREE.MathUtils.clamp(strength, 0, 1));
    colors[index * 3] = tintedColor.r;
    colors[index * 3 + 1] = tintedColor.g;
    colors[index * 3 + 2] = tintedColor.b;
  }

  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function createMossTransforms({
  rng,
  chunkSize,
  halfSize,
  chunkX,
  chunkZ,
  seed,
  lodFactor = 1,
  terrain,
  biomeKey,
  getBiomeKeyAtPosition,
  getBiomeWeightsAtPosition
}) {
  const transforms = [];
  const lodDensity = THREE.MathUtils.clamp(lodFactor, 0.35, 1);
  const lodStepScale = THREE.MathUtils.lerp(1.55, 1, lodDensity);
  const lodPresenceScale = THREE.MathUtils.lerp(0.45, 1, lodDensity);
  const layers = [
    {
      step: 1.55,
      jitter: 0.64,
      threshold: 0.42,
      minPresence: 0.13,
      scaleRange: [0.55, 1.65],
      heightRange: [0.42, 0.82],
      tilt: 0.11
    },
    {
      step: 1.02,
      jitter: 0.52,
      threshold: 0.31,
      minPresence: 0.1,
      scaleRange: [0.25, 0.78],
      heightRange: [0.34, 0.6],
      tilt: 0.08
    }
  ];

  for (const layer of layers) {
    const lodStep = layer.step * lodStepScale;

    for (let x = -halfSize - 1; x <= halfSize + 1; x += lodStep) {
      for (let z = -halfSize - 1; z <= halfSize + 1; z += lodStep) {
        const jitteredX =
          x + randomBetween(rng, -lodStep * layer.jitter, lodStep * layer.jitter);
        const jitteredZ =
          z + randomBetween(rng, -lodStep * layer.jitter, lodStep * layer.jitter);
        const path = getPathMetrics(jitteredX, jitteredZ, chunkX, chunkZ, chunkSize);

        if (Math.abs(jitteredX) > halfSize + 1.5 || Math.abs(jitteredZ) > halfSize + 1.5) {
          continue;
        }

        if (path.distance < path.halfWidth + 0.45) {
          continue;
        }

        const biomeInterior = getBiomeInteriorFactor(
          jitteredX,
          jitteredZ,
          chunkX,
          chunkZ,
          chunkSize,
          biomeKey,
          getBiomeKeyAtPosition
        );
        const biomeWeight = getBiomeWeightFactor(
          jitteredX,
          jitteredZ,
          chunkX,
          chunkZ,
          chunkSize,
          biomeKey,
          getBiomeWeightsAtPosition
        );
        const biomePresence = Math.min(biomeInterior, biomeWeight);

        if (biomePresence < layer.minPresence) {
          continue;
        }

        const worldX = chunkX * chunkSize + jitteredX;
        const worldZ = chunkZ * chunkSize + jitteredZ;
        const patchField = sampleMossPatchField(worldX, worldZ, seed);
        const variationField = sampleMossVariationField(worldX, worldZ, seed);
        const heightField = sampleMossHeightField(worldX, worldZ, seed);
        const presence =
          biomePresence *
          THREE.MathUtils.smoothstep(patchField, layer.threshold, 0.92) *
          THREE.MathUtils.lerp(0.72, 1.18, variationField) *
          lodPresenceScale;

        if (presence < layer.minPresence || rng() > presence) {
          continue;
        }

        const baseScale =
          THREE.MathUtils.lerp(
            layer.scaleRange[0],
            layer.scaleRange[1],
            THREE.MathUtils.smoothstep(patchField, layer.threshold, 0.95)
          ) * THREE.MathUtils.lerp(0.28, 1, biomePresence);
        const stretchA = THREE.MathUtils.lerp(0.84, 1.32, variationField);
        const stretchB = THREE.MathUtils.lerp(0.82, 1.28, 1 - variationField);
        const scaleX = baseScale * stretchA * randomBetween(rng, 0.9, 1.12);
        const scaleZ = baseScale * stretchB * randomBetween(rng, 0.9, 1.12);
        const scaleY =
          baseScale *
          THREE.MathUtils.lerp(layer.heightRange[0], layer.heightRange[1], heightField) *
          randomBetween(rng, 0.94, 1.08);
        const terrainHeight = getLocalTerrainHeight(terrain, jitteredX, jitteredZ);
        const materialField = patchField * 0.6 + variationField * 0.4;

        transforms.push({
          x: jitteredX,
          z: jitteredZ,
          y: terrainHeight + scaleY * 0.43 - 0.03,
          rotationY: rng() * Math.PI * 2,
          tiltX: randomBetween(rng, -layer.tilt, layer.tilt),
          tiltZ: randomBetween(rng, -layer.tilt, layer.tilt),
          scale: new THREE.Vector3(scaleX, scaleY, scaleZ),
          bucket: materialField < 0.34 ? "deep" : materialField < 0.8 ? "mid" : "highlight"
        });
      }
    }
  }

  return transforms;
}

function addMossInstancedMeshes(group, transforms, halfSize) {
  const buckets = {
    deep: { material: mossDeepMaterial, patches: new Map() },
    mid: { material: mossPuffMaterial, patches: new Map() },
    highlight: { material: mossHighlightMaterial, patches: new Map() }
  };
  const patchOffset = halfSize + 1.5;

  transforms.forEach((transform) => {
    const bucket = buckets[transform.bucket];
    const patchKey = getPatchKey(transform.x, transform.z, patchOffset, MOSS_PATCH_SIZE);
    const patchTransforms = bucket.patches.get(patchKey);

    if (patchTransforms) {
      patchTransforms.push(transform);
      return;
    }

    bucket.patches.set(patchKey, [transform]);
  });

  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();

  for (const bucket of Object.values(buckets)) {
    for (const patchTransforms of bucket.patches.values()) {
      const mesh = new THREE.InstancedMesh(
        mossGeometry,
        bucket.material,
        patchTransforms.length
      );

      patchTransforms.forEach((transform, index) => {
        euler.set(transform.tiltX, transform.rotationY, transform.tiltZ);
        quaternion.setFromEuler(euler);
        matrix.compose(
          new THREE.Vector3(transform.x, transform.y, transform.z),
          quaternion,
          transform.scale
        );
        mesh.setMatrixAt(index, matrix);
      });

      mesh.instanceMatrix.needsUpdate = true;
      mesh.receiveShadow = false;
      mesh.castShadow = false;
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();
      group.add(mesh);
    }
  }
}



function createPathTrail(group, rng, chunkSize, chunkX, chunkZ, terrain) {
  const halfSize = chunkSize * 0.5;
  const step = 1.75;

  for (let localX = -halfSize - 2; localX <= halfSize + 2; localX += step) {
    const worldX = chunkX * chunkSize + localX;
    const centerZ = getPathCenterZ(worldX);
    const localZ = centerZ - chunkZ * chunkSize;

    if (localZ < -halfSize - 4 || localZ > halfSize + 4) {
      continue;
    }

    const patch = new THREE.Mesh(PATH_PATCH_GEOMETRY, pathMaterial);
    patch.rotation.x = -Math.PI / 2;
    patch.rotation.z = randomBetween(rng, -0.18, 0.18);
    const patchX = localX + randomBetween(rng, -0.15, 0.15);
    const patchZ = localZ + randomBetween(rng, -0.28, 0.28);
    const terrainHeight = getLocalTerrainHeight(terrain, patchX, patchZ);
    patch.position.set(patchX, terrainHeight + 0.03, patchZ);
    patch.scale.set(
      getPathHalfWidth(worldX) * randomBetween(rng, 1.05, 1.35),
      step * randomBetween(rng, 1.2, 1.45),
      1
    );
    patch.receiveShadow = true;
    group.add(patch);
  }
}

export class MossLibrary {
  constructor() {
    this.textureLoader = new THREE.TextureLoader();
    this.loadPromise = null;
  }

  async load(renderer) {
    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = this.textureLoader.loadAsync(MOSS_TEXTURE_URL).then((mossTexture) => {
      const anisotropy = renderer?.capabilities?.getMaxAnisotropy?.() ?? 1;
      const blanketTextures = createTextureSet(mossTexture, {
        repeat: [2.4, 2.4],
        anisotropy
      });
      const puffDetailTextures = createTextureSet(mossTexture, {
        repeat: [3.2, 3.2],
        anisotropy
      });

      applyTextureSet(mossBlanketMaterial, blanketTextures, {
        useColorMap: false,
        useRoughnessMap: false,
        useBumpMap: false
      });
      applyTextureSet(mossPuffMaterial, puffDetailTextures, {
        useColorMap: false,
        useRoughnessMap: false,
        bumpScale: 0.014
      });
      applyTextureSet(mossDeepMaterial, puffDetailTextures, {
        useColorMap: false,
        useRoughnessMap: false,
        bumpScale: 0.01
      });
      applyTextureSet(mossHighlightMaterial, puffDetailTextures, {
        useColorMap: false,
        useRoughnessMap: false,
        bumpScale: 0.016
      });
    });

    return this.loadPromise;
  }

  createFloor({
    chunkSize,
    chunkX,
    chunkZ,
    seed,
    rng,
    lodFactor = 1,
    terrain,
    biomeKey,
    getBiomeKeyAtPosition,
    getBiomeWeightsAtPosition,
    getBlendedGroundColorAtPosition
  }) {
    const group = new THREE.Group();
    const halfSize = chunkSize * 0.5;

    const dirtGeometry = tintSurfaceGeometry(createTerrainSurfaceGeometry(terrain, chunkSize, 0.008), {
      chunkX,
      chunkZ,
      chunkSize,
      seed,
      biomeKey,
      getBiomeWeightsAtPosition,
      getBlendedGroundColorAtPosition,
      tintColor: new THREE.Color("#16120d"),
      threshold: [0.2, 0.8],
      intensity: 0.95
    });
    const dirt = new THREE.Mesh(dirtGeometry, dirtFloorMaterial);
    dirt.rotation.x = -Math.PI / 2;
    dirt.receiveShadow = true;
    group.add(dirt);

    const blanketGeometry = tintSurfaceGeometry(
      createTerrainSurfaceGeometry(terrain, chunkSize, 0.02),
      {
        chunkX,
        chunkZ,
        chunkSize,
        seed,
        biomeKey,
        getBiomeWeightsAtPosition,
        getBlendedGroundColorAtPosition,
        tintColor: new THREE.Color("#6b883a"),
        threshold: [0.26, 0.86],
        intensity: 0.88
      }
    );
    const blanket = new THREE.Mesh(blanketGeometry, mossBlanketMaterial);
    blanket.rotation.x = -Math.PI / 2;
    blanket.receiveShadow = true;
    group.add(blanket);

    createPathTrail(group, rng, chunkSize, chunkX, chunkZ, terrain);

    const mossTransforms = createMossTransforms({
      rng,
      chunkSize,
      halfSize,
      chunkX,
      chunkZ,
      seed,
      lodFactor,
      terrain,
      biomeKey,
      getBiomeKeyAtPosition,
      getBiomeWeightsAtPosition
    });
    addMossInstancedMeshes(group, mossTransforms, halfSize);

    return group;
  }
}
