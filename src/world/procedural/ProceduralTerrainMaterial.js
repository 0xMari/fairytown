import * as THREE from "three";

export class ProceduralTerrainMaterial {
  constructor() {
    this.textureLoader = new THREE.TextureLoader();
    this.loadPromise = null;
    this.uniforms = {
      uCloverBaseColorMap: { value: null },
      uCloverRoughnessMap: { value: null },
      uMossBaseColorMap: { value: null },
      uMossRoughnessMap: { value: null }
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

      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
varying vec3 vProcWorldPosition;`
        )
        .replace(
          "#include <worldpos_vertex>",
          `#include <worldpos_vertex>
vProcWorldPosition = worldPosition.xyz;`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
varying vec3 vProcWorldPosition;
uniform sampler2D uCloverBaseColorMap;
uniform sampler2D uCloverRoughnessMap;
uniform sampler2D uMossBaseColorMap;
uniform sampler2D uMossRoughnessMap;

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
vec3 pathTexture = vec3(0.21, 0.18, 0.12) * mix(0.74, 1.08, procFbm(vProcWorldPosition.xz * 0.09));
vec3 splatTexture = mix(cloverTexture, mossTexture, splat.x);
splatTexture = mix(splatTexture, pathTexture, splat.z);
float broadMoss = procFbm(vProcWorldPosition.xz * 0.035);
float fineMoss = procFbm(vProcWorldPosition.xz * 0.19 + vec2(12.4, -7.8));
float rootShadow = procFbm(vProcWorldPosition.xz * 0.075 + vec2(80.0));
float lichen = smoothstep(0.46, 0.88, fineMoss) * 0.18;
vec3 mossGlow = vec3(0.42, 0.58, 0.22);
vec3 dampSoil = vec3(0.23, 0.19, 0.12);
diffuseColor.rgb = mix(diffuseColor.rgb, splatTexture, 0.88);
diffuseColor.rgb = mix(diffuseColor.rgb, mossGlow, smoothstep(0.34, 0.82, broadMoss) * 0.28);
diffuseColor.rgb = mix(diffuseColor.rgb, dampSoil, smoothstep(0.58, 0.86, rootShadow) * 0.18);
diffuseColor.rgb *= mix(0.78, 1.18, fineMoss);
diffuseColor.rgb += lichen;`
        )
        .replace(
          "#include <roughnessmap_fragment>",
          `float roughnessFactor = roughness;
vec2 roughnessUv = vProcWorldPosition.xz / 8.5;
vec3 roughnessSplat = procTerrainSplat(vProcWorldPosition.xz);
float cloverRoughness = texture2D(uCloverRoughnessMap, roughnessUv).r;
float mossRoughness = texture2D(uMossRoughnessMap, roughnessUv * 0.78 + vec2(0.17, 0.29)).r;
roughnessFactor = mix(
  roughnessFactor,
  mix(cloverRoughness, mossRoughness, roughnessSplat.x),
  0.62
);
roughnessFactor = mix(roughnessFactor, 0.96, roughnessSplat.z * 0.75);`
        );
    };

    this.material.customProgramCacheKey = () => "fairytown-procedural-terrain-v1";
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
      )
    ]).then(([cloverBaseColor, cloverRoughness, mossBaseColor, mossRoughness]) => {
      const maxAnisotropy = renderer?.capabilities?.getMaxAnisotropy?.() ?? 1;

      [cloverBaseColor, mossBaseColor].forEach((texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
      });

      [cloverBaseColor, cloverRoughness, mossBaseColor, mossRoughness].forEach((texture) => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.anisotropy = maxAnisotropy;
        texture.needsUpdate = true;
      });

      this.uniforms.uCloverBaseColorMap.value = cloverBaseColor;
      this.uniforms.uCloverRoughnessMap.value = cloverRoughness;
      this.uniforms.uMossBaseColorMap.value = mossBaseColor;
      this.uniforms.uMossRoughnessMap.value = mossRoughness;
      this.material.needsUpdate = true;
    });

    return this.loadPromise;
  }

  getTerrainMaterial() {
    return this.material;
  }
}
