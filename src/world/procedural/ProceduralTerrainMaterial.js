import * as THREE from "three";

export class ProceduralTerrainMaterial {
  constructor() {
    this.textureLoader = new THREE.TextureLoader();
    this.loadPromise = null;
    this.uniforms = {
      uCloverBaseColorMap: { value: null },
      uCloverRoughnessMap: { value: null },
      uMossBaseColorMap: { value: null },
      uMossRoughnessMap: { value: null },
      uRockBaseColorMap: { value: null },
      uRockOrmMap: { value: null }
    };
    this.material = new THREE.MeshStandardMaterial({
      color: "#ffffff",
      vertexColors: true,
      roughness: 0.98,
      metalness: 0,
      envMapIntensity: 0.18
    });

    this.material.onBeforeCompile = (shader) => {
      shader.uniforms.uCloverBaseColorMap = this.uniforms.uCloverBaseColorMap;
      shader.uniforms.uCloverRoughnessMap = this.uniforms.uCloverRoughnessMap;
      shader.uniforms.uMossBaseColorMap = this.uniforms.uMossBaseColorMap;
      shader.uniforms.uMossRoughnessMap = this.uniforms.uMossRoughnessMap;
      shader.uniforms.uRockBaseColorMap = this.uniforms.uRockBaseColorMap;
      shader.uniforms.uRockOrmMap = this.uniforms.uRockOrmMap;

      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
attribute float crystalWeight;
attribute float meadowWeight;
attribute float mushroomWeight;
varying vec3 vProcWorldPosition;
varying float vMeadowBiomeWeight;
varying float vMushroomBiomeWeight;
varying float vCrystalBiomeWeight;`
        )
        .replace(
          "#include <worldpos_vertex>",
          `#include <worldpos_vertex>
vProcWorldPosition = worldPosition.xyz;
vMeadowBiomeWeight = meadowWeight;
vMushroomBiomeWeight = mushroomWeight;
vCrystalBiomeWeight = crystalWeight;`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
varying vec3 vProcWorldPosition;
varying float vMeadowBiomeWeight;
varying float vMushroomBiomeWeight;
varying float vCrystalBiomeWeight;
uniform sampler2D uCloverBaseColorMap;
uniform sampler2D uCloverRoughnessMap;
uniform sampler2D uMossBaseColorMap;
uniform sampler2D uMossRoughnessMap;
uniform sampler2D uRockBaseColorMap;
uniform sampler2D uRockOrmMap;

float procHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float procNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(procHash(i), procHash(i + vec2(1.0, 0.0)), u.x),
    mix(procHash(i + vec2(0.0, 1.0)), procHash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float procFbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    value += procNoise(p) * amplitude;
    p *= 2.03;
    amplitude *= 0.5;
  }
  return value;
}

vec3 procTerrainSplat(vec2 worldUv) {
  float noise = procFbm(worldUv * 0.0077 + vec2(5.69, -3.92));
  float white = 1.0 - step(0.33, noise);
  float gray = step(0.33, noise) * (1.0 - step(0.66, noise));
  float black = step(0.66, noise);
  return vec3(white, gray, black);
}`
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
vec2 terrainUv = vProcWorldPosition.xz / 8.5;
vec3 splat = procTerrainSplat(vProcWorldPosition.xz);
vec3 cloverTexture = texture2D(uCloverBaseColorMap, terrainUv).rgb;
vec3 mossTexture = texture2D(uMossBaseColorMap, terrainUv * 0.78 + vec2(0.17, 0.29)).rgb;
vec3 rockTexture = texture2D(uRockBaseColorMap, terrainUv * 0.64 + vec2(-0.11, 0.23)).rgb;
float rockLuma = dot(rockTexture, vec3(0.299, 0.587, 0.114));
rockTexture = mix(vec3(rockLuma) * vec3(0.86, 0.9, 0.94), rockTexture, 0.18);
vec3 pathTexture = vec3(0.21, 0.18, 0.12) * mix(0.74, 1.08, procFbm(vProcWorldPosition.xz * 0.09));
float nonCrystalTotal = max(vMeadowBiomeWeight + vMushroomBiomeWeight, 0.001);
float mushroomBlend = smoothstep(0.08, 0.92, vMushroomBiomeWeight / nonCrystalTotal);
vec3 nonCrystalTexture = mix(cloverTexture, mossTexture, mushroomBlend);
float crystalBlend = smoothstep(0.52, 0.72, vCrystalBiomeWeight);
nonCrystalTexture = mix(nonCrystalTexture, pathTexture, splat.z * 0.08 * (1.0 - crystalBlend));
float broadMoss = procFbm(vProcWorldPosition.xz * 0.035);
float fineMoss = procFbm(vProcWorldPosition.xz * 0.19 + vec2(12.4, -7.8));
float rootShadow = procFbm(vProcWorldPosition.xz * 0.075 + vec2(80.0));
float lichen = smoothstep(0.46, 0.88, fineMoss) * 0.18;
vec3 mossGlow = vec3(0.42, 0.58, 0.22);
vec3 dampSoil = vec3(0.23, 0.19, 0.12);
nonCrystalTexture = mix(nonCrystalTexture, mossGlow, smoothstep(0.34, 0.82, broadMoss) * 0.28);
nonCrystalTexture = mix(nonCrystalTexture, dampSoil, smoothstep(0.58, 0.86, rootShadow) * 0.18);
nonCrystalTexture *= mix(0.78, 1.18, fineMoss);
nonCrystalTexture += lichen;
diffuseColor.rgb = mix(nonCrystalTexture, rockTexture, crystalBlend);`
        )
        .replace(
          "#include <roughnessmap_fragment>",
          `float roughnessFactor = roughness;
vec2 roughnessUv = vProcWorldPosition.xz / 8.5;
vec3 roughnessSplat = procTerrainSplat(vProcWorldPosition.xz);
float cloverRoughness = texture2D(uCloverRoughnessMap, roughnessUv).r;
float mossRoughness = texture2D(uMossRoughnessMap, roughnessUv * 0.78 + vec2(0.17, 0.29)).r;
float rockBlend = smoothstep(0.52, 0.72, vCrystalBiomeWeight);
float rockRoughness = texture2D(uRockOrmMap, roughnessUv * 0.64 + vec2(-0.11, 0.23)).g;
float roughnessNonCrystalTotal = max(vMeadowBiomeWeight + vMushroomBiomeWeight, 0.001);
float roughnessMushroomBlend = smoothstep(0.08, 0.92, vMushroomBiomeWeight / roughnessNonCrystalTotal);
roughnessFactor = mix(
  roughnessFactor,
  mix(cloverRoughness, mossRoughness, roughnessMushroomBlend),
  0.62
);
roughnessFactor = mix(roughnessFactor, rockRoughness, rockBlend * 0.78);
roughnessFactor = mix(roughnessFactor, 0.96, roughnessSplat.z * 0.08 * (1.0 - rockBlend));`
        );
    };

    this.material.customProgramCacheKey = () => "fairytown-procedural-terrain-v7";
  }

  async load(renderer) {
    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = Promise.all([
      this.textureLoader.loadAsync(
        "/textures/clover_patches_on_grass_sgmkajak_1k/Clover_Patches_on_Grass_sgmkajak_1K_BaseColor.jpg"
      ),
      this.textureLoader.loadAsync(
        "/textures/clover_patches_on_grass_sgmkajak_1k/Clover_Patches_on_Grass_sgmkajak_1K_Roughness.jpg"
      ),
      this.textureLoader.loadAsync(
        "/textures/nordic_moss_se4rwei_1k/Nordic_Moss_se4rwei_1K_BaseColor.jpg"
      ),
      this.textureLoader.loadAsync(
        "/textures/nordic_moss_se4rwei_1k/Nordic_Moss_se4rwei_1K_Roughness.jpg"
      ),
      this.textureLoader.loadAsync(
        "/textures/icelandic_rock_cliff_smokagcp_1k_ue_low/Textures/T_smokagcp_1K_B.jpg"
      ),
      this.textureLoader.loadAsync(
        "/textures/icelandic_rock_cliff_smokagcp_1k_ue_low/Textures/T_smokagcp_1K_ORM.jpg"
      )
    ]).then(([cloverBaseColor, cloverRoughness, mossBaseColor, mossRoughness, rockBaseColor, rockOrm]) => {
      const maxAnisotropy = renderer?.capabilities?.getMaxAnisotropy?.() ?? 1;

      [cloverBaseColor, mossBaseColor, rockBaseColor].forEach((texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
      });

      [cloverBaseColor, cloverRoughness, mossBaseColor, mossRoughness, rockBaseColor, rockOrm].forEach((texture) => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.anisotropy = maxAnisotropy;
        texture.needsUpdate = true;
      });

      this.uniforms.uCloverBaseColorMap.value = cloverBaseColor;
      this.uniforms.uCloverRoughnessMap.value = cloverRoughness;
      this.uniforms.uMossBaseColorMap.value = mossBaseColor;
      this.uniforms.uMossRoughnessMap.value = mossRoughness;
      this.uniforms.uRockBaseColorMap.value = rockBaseColor;
      this.uniforms.uRockOrmMap.value = rockOrm;
      this.material.needsUpdate = true;
    });

    return this.loadPromise;
  }

  getTerrainMaterial() {
    return this.material;
  }
}
