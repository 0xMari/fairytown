import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { fbm2D } from "../noise.js";

const MEADOW_GRASS_COVER_SETTINGS = {
  spacing: 0.78,
  liteSpacing: 1.85,
  liteMaxInstances: 260,
  jitterRatio: 0.2,
  overlap: 1.2
};
const MEADOW_GRASS_PATCH_SIZE = 12;

function randomBetween(rng, min, max) {
  return min + (max - min) * rng();
}

function getPatchKey(localX, localZ, patchOffset, patchSize) {
  const patchX = Math.floor((localX + patchOffset) / patchSize);
  const patchZ = Math.floor((localZ + patchOffset) / patchSize);
  return `${patchX},${patchZ}`;
}

function addMatrixToPatchMap(patchMatrices, patchKey, matrix) {
  const matrices = patchMatrices.get(patchKey);

  if (matrices) {
    matrices.push(matrix.clone());
    return;
  }

  patchMatrices.set(patchKey, [matrix.clone()]);
}

function addPatchMeshesToGroup(group, geometry, material, patchMatrices) {
  for (const matrices of patchMatrices.values()) {
    const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);

    matrices.forEach((instanceMatrix, index) => {
      mesh.setMatrixAt(index, instanceMatrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
    mesh.receiveShadow = false;
    mesh.castShadow = false;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
}

function addSingleMeshToGroup(group, geometry, material, matrices) {
  if (matrices.length === 0) {
    return;
  }

  const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);

  matrices.forEach((instanceMatrix, index) => {
    mesh.setMatrixAt(index, instanceMatrix);
  });

  mesh.instanceMatrix.needsUpdate = true;
  mesh.receiveShadow = false;
  mesh.castShadow = false;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  group.add(mesh);
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
      seed + options.seedOffset + 23,
      3,
      2.1,
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

function sampleMeadowCoverage(worldX, worldZ, seed) {
  const broad = sampleWarpedField(worldX, worldZ, seed, {
    offsetX: 180,
    offsetZ: -260,
    baseScale: 74,
    warpScale: 180,
    warpStrength: 22,
    seedOffset: 1101
  });
  const detail = sampleWarpedField(worldX - 120, worldZ + 95, seed, {
    offsetX: -340,
    offsetZ: 220,
    baseScale: 34,
    warpScale: 92,
    warpStrength: 12,
    seedOffset: 1187
  });

  return broad * 0.74 + detail * 0.26;
}

function sampleMeadowScaleField(worldX, worldZ, seed) {
  const broad = sampleWarpedField(worldX + 240, worldZ - 110, seed, {
    offsetX: 420,
    offsetZ: -160,
    baseScale: 96,
    warpScale: 210,
    warpStrength: 28,
    seedOffset: 1301
  });
  const detail = sampleWarpedField(worldX - 90, worldZ + 170, seed, {
    offsetX: -210,
    offsetZ: 310,
    baseScale: 44,
    warpScale: 120,
    warpStrength: 10,
    seedOffset: 1381
  });

  return broad * 0.72 + detail * 0.28;
}

function mapGrassScale(field) {
  const lowToMid = THREE.MathUtils.smoothstep(field, 0.24, 0.56);
  const midToHigh = THREE.MathUtils.smoothstep(field, 0.58, 0.86);
  const lowMid = THREE.MathUtils.lerp(1.35, 3, lowToMid);

  return THREE.MathUtils.lerp(lowMid, 5, midToHigh);
}

export function getMeadowGrassScaleAt(worldX, worldZ, seed) {
  return mapGrassScale(sampleMeadowScaleField(worldX, worldZ, seed));
}

export class FluffyGrassLibrary {
  constructor() {
    this.loader = new GLTFLoader();
    this.textureLoader = new THREE.TextureLoader();
    this.uniforms = {
      uTime: { value: 0 },
      uNoiseScale: { value: 1.5 },
      uNoiseTexture: { value: null },
      uGrassAlphaTexture: { value: null },
      uGrassLightIntensity: { value: 1 },
      uBaseColor: { value: new THREE.Color("#313f1b") },
      uTipColor1: { value: new THREE.Color("#9bd38d") },
      uTipColor2: { value: new THREE.Color("#1f352a") }
    };
    this.geometry = null;
    this.material = null;
    this.loadPromise = null;
  }

  async load() {
    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = Promise.all([
      this.loader.loadAsync("/fluffy-grass/grassLODs.glb"),
      this.textureLoader.loadAsync("/fluffy-grass/grass.jpeg"),
      this.textureLoader.loadAsync("/fluffy-grass/perlinnoise.webp")
    ]).then(([gltf, grassAlphaTexture, noiseTexture]) => {
      let sourceMesh = null;

      gltf.scene.traverse((child) => {
        if (!(child instanceof THREE.Mesh) || sourceMesh) {
          return;
        }

        if (child.name.includes("LOD00")) {
          sourceMesh = child;
        }
      });

      if (!sourceMesh) {
        gltf.scene.traverse((child) => {
          if (child instanceof THREE.Mesh && !sourceMesh) {
            sourceMesh = child;
          }
        });
      }

      if (!sourceMesh) {
        throw new Error("Fluffy grass geometry could not be found.");
      }

      this.geometry = sourceMesh.geometry.clone();
      this.geometry.scale(3, 3, 3);
      this.geometry.computeVertexNormals();

      grassAlphaTexture.needsUpdate = true;

      noiseTexture.wrapS = THREE.RepeatWrapping;
      noiseTexture.wrapT = THREE.RepeatWrapping;

      this.uniforms.uNoiseTexture.value = noiseTexture;
      this.uniforms.uGrassAlphaTexture.value = grassAlphaTexture;
      this.material = this.createMaterial();
    });

    return this.loadPromise;
  }

  createMaterial() {
    const material = new THREE.MeshLambertMaterial({
      side: THREE.DoubleSide,
      color: 0x229944,
      transparent: true,
      alphaTest: 0.1,
      shadowSide: THREE.BackSide
    });

    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.uniforms.uTime;
      shader.uniforms.uNoiseScale = this.uniforms.uNoiseScale;
      shader.uniforms.uNoiseTexture = this.uniforms.uNoiseTexture;
      shader.uniforms.uGrassAlphaTexture = this.uniforms.uGrassAlphaTexture;
      shader.uniforms.uGrassLightIntensity = this.uniforms.uGrassLightIntensity;
      shader.uniforms.uBaseColor = this.uniforms.uBaseColor;
      shader.uniforms.uTipColor1 = this.uniforms.uTipColor1;
      shader.uniforms.uTipColor2 = this.uniforms.uTipColor2;

      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
uniform float uTime;
uniform float uNoiseScale;
uniform sampler2D uNoiseTexture;
varying vec2 vGlobalUV;
varying vec2 vFluffyGrassUv;`
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
vec4 instanceWorldPosition = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
vec2 fieldUv = (100.0 - instanceWorldPosition.xz) / 100.0;
float bladeFactor = 1.0 - uv.y;
float baseNoise = texture2D(
  uNoiseTexture,
  fieldUv + vec2(uTime * 0.001)
).r;
vec2 windDirection = normalize(vec2(1.0, 1.0));
float wave = sin(
  50.0 * dot(windDirection, fieldUv) +
  baseNoise * 5.5 +
  uTime
) * 0.035;
transformed.x += wave * bladeFactor;
transformed.z += wave * bladeFactor;
transformed.y += exp(texture2D(uNoiseTexture, fieldUv * uNoiseScale).r) * 0.045 * bladeFactor;
vGlobalUV = fieldUv;
vFluffyGrassUv = vec2(uv.x, 1.0 - uv.y);`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
uniform float uNoiseScale;
uniform sampler2D uNoiseTexture;
uniform sampler2D uGrassAlphaTexture;
uniform float uGrassLightIntensity;
uniform vec3 uBaseColor;
uniform vec3 uTipColor1;
uniform vec3 uTipColor2;
varying vec2 vGlobalUV;
varying vec2 vFluffyGrassUv;`
        )
        .replace(
          "vec4 diffuseColor = vec4( diffuse, opacity );",
          `vec4 grassAlpha = texture2D(uGrassAlphaTexture, vFluffyGrassUv);
vec4 grassVariation = texture2D(uNoiseTexture, vGlobalUV * uNoiseScale);
vec3 tipColor = mix(uTipColor1, uTipColor2, grassVariation.r);
vec3 bladeColor = mix(uBaseColor, tipColor, vFluffyGrassUv.y) * uGrassLightIntensity;
vec4 diffuseColor = vec4(bladeColor, step(0.1, grassAlpha.r));`
        );
    };

    material.customProgramCacheKey = () => "fairytown-fluffy-grass-original-v1";
    material.needsUpdate = true;

    return material;
  }

  createPatch(rng) {
    if (!this.geometry || !this.material) {
      return null;
    }

    const bladeCount = Math.floor(randomBetween(rng, 22, 34));
    const mesh = new THREE.InstancedMesh(this.geometry, this.material, bladeCount);
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const matrix = new THREE.Matrix4();
    const yAxis = new THREE.Vector3(0, 1, 0);
    const patchRadius = randomBetween(rng, 0.55, 1.15);

    for (let index = 0; index < bladeCount; index += 1) {
      const angle = rng() * Math.PI * 2;
      const radius = Math.sqrt(rng()) * patchRadius;
      position.set(
        Math.cos(angle) * radius,
        0,
        Math.sin(angle) * radius
      );
      quaternion.setFromAxisAngle(yAxis, rng() * Math.PI * 2);

      const bladeHeight = randomBetween(rng, 0.5, 1.1);
      const bladeWidth = randomBetween(rng, 0.55, 0.9);
      scale.set(bladeWidth, bladeHeight, bladeWidth);

      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(index, matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.receiveShadow = false;
    mesh.castShadow = false;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();

    return {
      object: mesh
    };
  }

  createGroundCover({
    chunkSize,
    chunkX,
    chunkZ,
    seed,
    rng,
    lodFactor = 1,
    terrain,
    getBiomeWeightsAtPosition,
    biomeWeightKey = "meadow",
    spacing = MEADOW_GRASS_COVER_SETTINGS.spacing,
    spacingLodRange = [1.55, 1],
    maxInstances = Number.POSITIVE_INFINITY,
    densityMultiplier = 1,
    scaleMultiplier = 1,
    minPresence = 0.08,
    batchMode = "patches",
    getDensityAtPosition = null
  }) {
    if (!this.geometry || !this.material) {
      return null;
    }

    const group = new THREE.Group();
    const halfSize = chunkSize * 0.5;
    const overlap = MEADOW_GRASS_COVER_SETTINGS.overlap;
    const lodDensity = THREE.MathUtils.clamp(lodFactor, 0.35, 1);
    const effectiveSpacing = spacing * THREE.MathUtils.lerp(
      spacingLodRange[0],
      spacingLodRange[1],
      lodDensity
    );
    const jitter = effectiveSpacing * MEADOW_GRASS_COVER_SETTINGS.jitterRatio;
    const patchOffset = halfSize + overlap;
    const patchMatrices = new Map();
    const singleMeshMatrices = [];
    const singleMeshLimit = Number.isFinite(maxInstances)
      ? Math.max(0, Math.floor(maxInstances))
      : Number.POSITIVE_INFINITY;
    let singleMeshCandidateCount = 0;

    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const yawQuaternion = new THREE.Quaternion();
    const tiltQuaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const matrix = new THREE.Matrix4();
    const yAxis = new THREE.Vector3(0, 1, 0);

    for (let x = -halfSize - overlap; x <= halfSize + overlap; x += effectiveSpacing) {
      for (let z = -halfSize - overlap; z <= halfSize + overlap; z += effectiveSpacing) {
        const jitteredX = x + randomBetween(rng, -jitter, jitter);
        const jitteredZ = z + randomBetween(rng, -jitter, jitter);
        const worldX = chunkX * chunkSize + jitteredX;
        const worldZ = chunkZ * chunkSize + jitteredZ;
        const meadowWeight =
          getBiomeWeightsAtPosition?.(worldX, worldZ)?.[biomeWeightKey] ?? 1;

        if (meadowWeight < 0.1 || rng() > THREE.MathUtils.lerp(0.18, 1, meadowWeight)) {
          continue;
        }

        const waterPresence =
          terrain?.getWaterDataAtLocalPosition?.(jitteredX, jitteredZ)?.presence ?? 0;

        if (waterPresence > 0.12) {
          continue;
        }

        const coverage = sampleMeadowCoverage(worldX, worldZ, seed);
        const breakup = sampleWarpedField(worldX - 140, worldZ + 60, seed, {
          offsetX: 90,
          offsetZ: -210,
          baseScale: 28,
          warpScale: 78,
          warpStrength: 7,
          seedOffset: 1453,
          octaves: 3,
          lacunarity: 2.16,
          gain: 0.5
        });
        const localDensity =
          getDensityAtPosition?.({
            worldX,
            worldZ,
            x: jitteredX,
            z: jitteredZ,
            meadowWeight,
            coverage,
            breakup,
            waterPresence
          }) ?? 1;
        const dryLandFactor = THREE.MathUtils.lerp(
          1,
          0,
          THREE.MathUtils.smoothstep(waterPresence, 0.04, 0.16)
        );
        const density =
          THREE.MathUtils.smoothstep(coverage, 0.2, 1) *
          THREE.MathUtils.lerp(0.68, 1.16, breakup);
        const presence =
          meadowWeight *
          Math.min(1, density) *
          localDensity *
          densityMultiplier *
          dryLandFactor *
          THREE.MathUtils.lerp(0.52, 1, lodDensity);

        if (presence < minPresence || rng() > presence) {
          continue;
        }

        const groundHeight = terrain?.getHeightAtLocalPosition?.(jitteredX, jitteredZ) ?? 0;

        position.set(jitteredX, groundHeight + 0.02, jitteredZ);

        yawQuaternion.setFromAxisAngle(yAxis, rng() * Math.PI * 2);
        tiltQuaternion.setFromEuler(
          new THREE.Euler(
            randomBetween(rng, -0.08, 0.08),
            0,
            randomBetween(rng, -0.08, 0.08)
          )
        );
        quaternion.copy(yawQuaternion).multiply(tiltQuaternion);

        const baseScale = mapGrassScale(sampleMeadowScaleField(worldX, worldZ, seed));
        const localScale =
          baseScale *
          THREE.MathUtils.lerp(0.82, 1.18, breakup) *
          THREE.MathUtils.lerp(0.4, 1, presence) *
          THREE.MathUtils.lerp(0.88, 1, lodDensity) *
          scaleMultiplier;

        scale.setScalar(localScale);
        matrix.compose(position, quaternion, scale);

        if (batchMode === "single") {
          singleMeshCandidateCount += 1;

          if (singleMeshMatrices.length < singleMeshLimit) {
            singleMeshMatrices.push(matrix.clone());
          } else if (singleMeshLimit > 0) {
            const replacementIndex = Math.floor(rng() * singleMeshCandidateCount);

            if (replacementIndex < singleMeshLimit) {
              singleMeshMatrices[replacementIndex] = matrix.clone();
            }
          }
        } else {
          addMatrixToPatchMap(
            patchMatrices,
            getPatchKey(jitteredX, jitteredZ, patchOffset, MEADOW_GRASS_PATCH_SIZE),
            matrix
          );
        }
      }
    }

    if (patchMatrices.size === 0 && singleMeshMatrices.length === 0) {
      return null;
    }

    if (batchMode === "single") {
      addSingleMeshToGroup(group, this.geometry, this.material, singleMeshMatrices);
    } else {
      addPatchMeshesToGroup(group, this.geometry, this.material, patchMatrices);
    }

    return {
      object: group
    };
  }

  update(elapsedTime) {
    this.uniforms.uTime.value = elapsedTime;
  }
}
