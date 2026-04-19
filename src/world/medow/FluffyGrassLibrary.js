import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { fbm2D } from "../noise.js";

const MEADOW_GRASS_COVER_SETTINGS = {
  spacing: 0.78,
  jitterRatio: 0.2,
  overlap: 1.2
};

function randomBetween(rng, min, max) {
  return min + (max - min) * rng();
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
      uNoiseScale: { value: 1.35 },
      uNoiseTexture: { value: null },
      uBaseColor: { value: new THREE.Color("#446c25") },
      uTipColor1: { value: new THREE.Color("#9fd676") },
      uTipColor2: { value: new THREE.Color("#d3efab") }
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

      grassAlphaTexture.flipY = false;
      grassAlphaTexture.needsUpdate = true;

      noiseTexture.wrapS = THREE.RepeatWrapping;
      noiseTexture.wrapT = THREE.RepeatWrapping;

      this.uniforms.uNoiseTexture.value = noiseTexture;
      this.material = this.createMaterial(grassAlphaTexture);
    });

    return this.loadPromise;
  }

  createMaterial(grassAlphaTexture) {
    const material = new THREE.MeshLambertMaterial({
      side: THREE.DoubleSide,
      color: 0xffffff,
      transparent: true,
      alphaTest: 0.45,
      alphaMap: grassAlphaTexture
    });

    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.uniforms.uTime;
      shader.uniforms.uNoiseScale = this.uniforms.uNoiseScale;
      shader.uniforms.uNoiseTexture = this.uniforms.uNoiseTexture;
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
varying float vBladeMix;`
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
vec4 instanceWorldPosition = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
vec2 fieldUv = instanceWorldPosition.xz * 0.03;
float bladeFactor = 1.0 - uv.y;
float baseNoise = texture2D(
  uNoiseTexture,
  fieldUv * uNoiseScale + vec2(uTime * 0.01, uTime * 0.008)
).r;
float wave = sin(
  fieldUv.x * 8.0 +
  fieldUv.y * 6.0 +
  uTime * 0.75 +
  baseNoise * 6.28318
) * 0.025;
transformed.x += wave * bladeFactor;
transformed.z += wave * 0.3 * bladeFactor;
transformed.y += baseNoise * 0.05 * bladeFactor;
vGlobalUV = fieldUv;
vBladeMix = clamp(bladeFactor, 0.0, 1.0);`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
uniform float uNoiseScale;
uniform sampler2D uNoiseTexture;
uniform vec3 uBaseColor;
uniform vec3 uTipColor1;
uniform vec3 uTipColor2;
varying vec2 vGlobalUV;
varying float vBladeMix;`
        )
        .replace(
          "vec4 diffuseColor = vec4( diffuse, opacity );",
          `vec4 grassVariation = texture2D(uNoiseTexture, vGlobalUV * uNoiseScale * 0.85);
vec3 tipColor = mix(uTipColor1, uTipColor2, grassVariation.r);
vec3 bladeColor = mix(uBaseColor, tipColor, vBladeMix);
vec4 diffuseColor = vec4(bladeColor, opacity);`
        );
    };

    material.customProgramCacheKey = () => "fairytown-fluffy-grass-v1";
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
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.frustumCulled = false;

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
    terrain,
    getBiomeWeightsAtPosition,
    biomeWeightKey = "meadow"
  }) {
    if (!this.geometry || !this.material) {
      return null;
    }

    const group = new THREE.Group();
    const halfSize = chunkSize * 0.5;
    const overlap = MEADOW_GRASS_COVER_SETTINGS.overlap;
    const spacing = MEADOW_GRASS_COVER_SETTINGS.spacing;
    const jitter = spacing * MEADOW_GRASS_COVER_SETTINGS.jitterRatio;
    const matrices = [];

    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const yawQuaternion = new THREE.Quaternion();
    const tiltQuaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const matrix = new THREE.Matrix4();
    const yAxis = new THREE.Vector3(0, 1, 0);

    for (let x = -halfSize - overlap; x <= halfSize + overlap; x += spacing) {
      for (let z = -halfSize - overlap; z <= halfSize + overlap; z += spacing) {
        const jitteredX = x + randomBetween(rng, -jitter, jitter);
        const jitteredZ = z + randomBetween(rng, -jitter, jitter);
        const worldX = chunkX * chunkSize + jitteredX;
        const worldZ = chunkZ * chunkSize + jitteredZ;
        const meadowWeight =
          getBiomeWeightsAtPosition?.(worldX, worldZ)?.[biomeWeightKey] ?? 1;

        if (meadowWeight < 0.1 || rng() > THREE.MathUtils.lerp(0.18, 1, meadowWeight)) {
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
        const density =
          THREE.MathUtils.smoothstep(coverage, 0.2, 1) *
          THREE.MathUtils.lerp(0.68, 1.16, breakup);
        const presence = meadowWeight * Math.min(1, density);

        if (presence < 0.08 || rng() > presence) {
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
          THREE.MathUtils.lerp(0.4, 1, presence);

        scale.setScalar(localScale);
        matrix.compose(position, quaternion, scale);
        matrices.push(matrix.clone());
      }
    }

    if (matrices.length === 0) {
      return null;
    }

    const mesh = new THREE.InstancedMesh(this.geometry, this.material, matrices.length);

    matrices.forEach((instanceMatrix, index) => {
      mesh.setMatrixAt(index, instanceMatrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.frustumCulled = false;
    group.add(mesh);

    return {
      object: group
    };
  }

  update(elapsedTime) {
    this.uniforms.uTime.value = elapsedTime;
  }
}
