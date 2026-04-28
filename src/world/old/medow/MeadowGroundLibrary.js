import * as THREE from "three";
import { EXRLoader } from "three/addons/loaders/EXRLoader.js";
import {
  CRYSTAL_TERRAIN_SETTINGS,
  CRYSTAL_TERRAIN_TEXTURES
} from "../crystal/CrystalTerrainConfig.js";

const MEADOW_TERRAIN_DIFFUSE_URL = "/textures/aerial_rocks/aerial_rocks_02_diff_4k.jpg";
const MEADOW_TERRAIN_ROUGHNESS_URL = "/textures/aerial_rocks/aerial_rocks_02_rough_4k.jpg";
const MEADOW_TERRAIN_DISPLACEMENT_URL = "/textures/aerial_rocks/aerial_rocks_02_disp_4k.png";
const MEADOW_TERRAIN_NORMAL_URL = "/textures/aerial_rocks/aerial_rocks_02_nor_gl_4k.exr";
const MUSHROOM_TERRAIN_DIFFUSE_URL = "/textures/mud_leaves/brown_mud_leaves_01_diff_4k.jpg";
const MUSHROOM_TERRAIN_ROUGHNESS_URL = "/textures/mud_leaves/brown_mud_leaves_01_rough_4k.exr";
const MUSHROOM_TERRAIN_DISPLACEMENT_URL = "/textures/mud_leaves/brown_mud_leaves_01_disp_4k.png";
const MUSHROOM_TERRAIN_NORMAL_URL = "/textures/mud_leaves/brown_mud_leaves_01_nor_gl_4k.exr";
function configureColorTexture(texture, anisotropy = 1) {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
  return texture;
}

function configureDataTexture(texture, anisotropy = 1) {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
  return texture;
}

function configureExrTexture(texture) {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

export class MeadowGroundLibrary {
  constructor() {
    this.textureLoader = new THREE.TextureLoader();
    this.exrLoader = new EXRLoader();
    this.loadPromise = null;
    this.diffuseTexture = null;
    this.roughnessTexture = null;
    this.displacementTexture = null;
    this.normalTexture = null;
    this.mushroomDiffuseTexture = null;
    this.mushroomRoughnessTexture = null;
    this.mushroomDisplacementTexture = null;
    this.mushroomNormalTexture = null;
    this.crystalDiffuseTexture = null;
    this.crystalRoughnessTexture = null;
    this.crystalDisplacementTexture = null;
    this.crystalNormalTexture = null;
    this.terrainMaterial = null;
  }

  async load(renderer) {
    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = Promise.all([
      this.textureLoader.loadAsync(MEADOW_TERRAIN_DIFFUSE_URL),
      this.textureLoader.loadAsync(MEADOW_TERRAIN_ROUGHNESS_URL),
      this.textureLoader.loadAsync(MEADOW_TERRAIN_DISPLACEMENT_URL),
      this.exrLoader.loadAsync(MEADOW_TERRAIN_NORMAL_URL),
      this.textureLoader.loadAsync(MUSHROOM_TERRAIN_DIFFUSE_URL),
      this.exrLoader.loadAsync(MUSHROOM_TERRAIN_ROUGHNESS_URL),
      this.textureLoader.loadAsync(MUSHROOM_TERRAIN_DISPLACEMENT_URL),
      this.exrLoader.loadAsync(MUSHROOM_TERRAIN_NORMAL_URL),
      this.textureLoader.loadAsync(CRYSTAL_TERRAIN_TEXTURES.diffuseUrl),
      this.exrLoader.loadAsync(CRYSTAL_TERRAIN_TEXTURES.roughnessUrl),
      this.textureLoader.loadAsync(CRYSTAL_TERRAIN_TEXTURES.displacementUrl),
      this.exrLoader.loadAsync(CRYSTAL_TERRAIN_TEXTURES.normalUrl)
    ]).then(([
      diffuseTexture,
      roughnessTexture,
      displacementTexture,
      normalTexture,
      mushroomDiffuseTexture,
      mushroomRoughnessTexture,
      mushroomDisplacementTexture,
      mushroomNormalTexture,
      crystalDiffuseTexture,
      crystalRoughnessTexture,
      crystalDisplacementTexture,
      crystalNormalTexture
    ]) => {
        const anisotropy = renderer?.capabilities?.getMaxAnisotropy?.() ?? 1;
        this.diffuseTexture = configureColorTexture(diffuseTexture, anisotropy);
        this.roughnessTexture = configureDataTexture(roughnessTexture, anisotropy);
        this.displacementTexture = configureDataTexture(displacementTexture, anisotropy);
        this.normalTexture = configureExrTexture(normalTexture);
        this.mushroomDiffuseTexture = configureColorTexture(mushroomDiffuseTexture, anisotropy);
        this.mushroomRoughnessTexture = configureExrTexture(mushroomRoughnessTexture);
        this.mushroomDisplacementTexture = configureDataTexture(
          mushroomDisplacementTexture,
          anisotropy
        );
        this.mushroomNormalTexture = configureExrTexture(mushroomNormalTexture);
        this.crystalDiffuseTexture = configureColorTexture(crystalDiffuseTexture, anisotropy);
        this.crystalRoughnessTexture = configureExrTexture(crystalRoughnessTexture);
        this.crystalDisplacementTexture = configureDataTexture(crystalDisplacementTexture, anisotropy);
        this.crystalNormalTexture = configureExrTexture(crystalNormalTexture);
      });

    return this.loadPromise;
  }

  getTerrainMaterial() {
    if (
      !this.diffuseTexture ||
      !this.roughnessTexture ||
      !this.displacementTexture ||
      !this.normalTexture ||
      !this.mushroomDiffuseTexture ||
      !this.mushroomRoughnessTexture ||
      !this.mushroomDisplacementTexture ||
      !this.mushroomNormalTexture ||
      !this.crystalDiffuseTexture ||
      !this.crystalRoughnessTexture ||
      !this.crystalDisplacementTexture ||
      !this.crystalNormalTexture
    ) {
      return null;
    }

    if (this.terrainMaterial) {
      return this.terrainMaterial;
    }

    const material = new THREE.MeshStandardMaterial({
      color: "#ffffff",
      vertexColors: true,
      roughness: 0.96,
      metalness: 0,
      map: this.diffuseTexture,
      roughnessMap: this.roughnessTexture,
      normalMap: this.normalTexture,
      normalScale: new THREE.Vector2(0.42, 0.42),
      displacementMap: this.displacementTexture,
      displacementScale: 0.1,
      displacementBias: -0.03
    });

    material.onBeforeCompile = (shader) => {
      shader.uniforms.mushroomDiffuseMap = { value: this.mushroomDiffuseTexture };
      shader.uniforms.mushroomRoughnessMap = { value: this.mushroomRoughnessTexture };
      shader.uniforms.mushroomDisplacementMap = { value: this.mushroomDisplacementTexture };
      shader.uniforms.mushroomNormalMap = { value: this.mushroomNormalTexture };
      shader.uniforms.mushroomNormalScale = { value: new THREE.Vector2(0.32, 0.32) };
      shader.uniforms.mushroomDisplacementScale = { value: 0.075 };
      shader.uniforms.mushroomDisplacementBias = { value: -0.02 };
      shader.uniforms.crystalDiffuseMap = { value: this.crystalDiffuseTexture };
      shader.uniforms.crystalRoughnessMap = { value: this.crystalRoughnessTexture };
      shader.uniforms.crystalDisplacementMap = { value: this.crystalDisplacementTexture };
      shader.uniforms.crystalNormalMap = { value: this.crystalNormalTexture };
      shader.uniforms.crystalNormalScale = {
        value: new THREE.Vector2(...CRYSTAL_TERRAIN_SETTINGS.normalScale)
      };
      shader.uniforms.crystalDisplacementScale = {
        value: CRYSTAL_TERRAIN_SETTINGS.displacementScale
      };
      shader.uniforms.crystalDisplacementBias = {
        value: CRYSTAL_TERRAIN_SETTINGS.displacementBias
      };

      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
attribute float meadowWeight;
attribute float mushroomWeight;
attribute float crystalWeight;
uniform sampler2D mushroomDisplacementMap;
uniform float mushroomDisplacementScale;
uniform float mushroomDisplacementBias;
uniform sampler2D crystalDisplacementMap;
uniform float crystalDisplacementScale;
uniform float crystalDisplacementBias;
varying float vMeadowWeight;
varying float vMushroomWeight;`
        )
        .replace(
          "varying float vMushroomWeight;",
          `varying float vMushroomWeight;
varying float vCrystalWeight;`
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
vMeadowWeight = meadowWeight;
vMushroomWeight = mushroomWeight;
vCrystalWeight = crystalWeight;`
        )
        .replace(
          "#include <displacementmap_vertex>",
          `#ifdef USE_DISPLACEMENTMAP
  float meadowDisplacement =
    texture2D(displacementMap, vDisplacementMapUv).x * displacementScale + displacementBias;
  float mushroomDisplacement =
    texture2D(mushroomDisplacementMap, vDisplacementMapUv).x * mushroomDisplacementScale +
    mushroomDisplacementBias;
  float crystalDisplacement =
    texture2D(crystalDisplacementMap, vDisplacementMapUv).x * crystalDisplacementScale +
    crystalDisplacementBias;
  transformed +=
    normalize(objectNormal) *
    (
      meadowDisplacement * clamp(vMeadowWeight, 0.0, 1.0) +
      mushroomDisplacement * clamp(vMushroomWeight, 0.0, 1.0) +
      crystalDisplacement * clamp(vCrystalWeight, 0.0, 1.0)
    );
#endif`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
uniform sampler2D mushroomDiffuseMap;
uniform sampler2D mushroomRoughnessMap;
uniform sampler2D mushroomNormalMap;
uniform vec2 mushroomNormalScale;
uniform sampler2D crystalDiffuseMap;
uniform sampler2D crystalRoughnessMap;
uniform sampler2D crystalNormalMap;
uniform vec2 crystalNormalScale;
varying float vMeadowWeight;
varying float vMushroomWeight;`
        )
        .replace(
          "varying float vMushroomWeight;",
          `varying float vMushroomWeight;
varying float vCrystalWeight;`
        )
        .replace(
          "#include <map_fragment>",
          `#ifdef USE_MAP
  float biomeMapMeadowMix = clamp(vMeadowWeight, 0.0, 1.0);
  float biomeMapMushroomMix = clamp(vMushroomWeight, 0.0, 1.0);
  float biomeMapCrystalMix = clamp(vCrystalWeight, 0.0, 1.0);
  float biomeMapTexturedMix = clamp(
    biomeMapMeadowMix + biomeMapMushroomMix + biomeMapCrystalMix,
    0.0,
    1.0
  );
  float biomeMapTexturedDenominator = max(biomeMapTexturedMix, 0.0001);
  vec4 sampledDiffuseColor = texture2D(map, vMapUv);
  vec4 sampledMushroomDiffuseColor = texture2D(mushroomDiffuseMap, vMapUv);
  vec4 sampledCrystalDiffuseColor = texture2D(crystalDiffuseMap, vMapUv);
  #ifdef DECODE_VIDEO_TEXTURE
    sampledDiffuseColor = sRGBTransferEOTF(sampledDiffuseColor);
    sampledMushroomDiffuseColor = sRGBTransferEOTF(sampledMushroomDiffuseColor);
    sampledCrystalDiffuseColor = sRGBTransferEOTF(sampledCrystalDiffuseColor);
  #endif
  vec3 biomeMapTexturedColor =
    (
      sampledDiffuseColor.rgb * biomeMapMeadowMix +
      sampledMushroomDiffuseColor.rgb * biomeMapMushroomMix +
      sampledCrystalDiffuseColor.rgb * biomeMapCrystalMix
    ) / biomeMapTexturedDenominator;
  diffuseColor.rgb = mix(diffuseColor.rgb, biomeMapTexturedColor, biomeMapTexturedMix);
#endif`
        )
        .replace(
          "#include <color_fragment>",
          `#if defined( USE_COLOR_ALPHA )
  float biomeColorTexturedMix = clamp(
    vMeadowWeight + vMushroomWeight + vCrystalWeight,
    0.0,
    1.0
  );
  vec4 biomeBlendedVertexColor = mix(vColor, vec4(1.0), biomeColorTexturedMix);
  diffuseColor *= biomeBlendedVertexColor;
#elif defined( USE_COLOR )
  float biomeColorTexturedMix = clamp(
    vMeadowWeight + vMushroomWeight + vCrystalWeight,
    0.0,
    1.0
  );
  vec3 biomeBlendedVertexColor = mix(vColor, vec3(1.0), biomeColorTexturedMix);
  diffuseColor.rgb *= biomeBlendedVertexColor;
#endif`
        )
        .replace(
          "#include <roughnessmap_fragment>",
          `float roughnessFactor = roughness;

#ifdef USE_ROUGHNESSMAP
  float biomeRoughnessMeadowMix = clamp(vMeadowWeight, 0.0, 1.0);
  float biomeRoughnessMushroomMix = clamp(vMushroomWeight, 0.0, 1.0);
  float biomeRoughnessCrystalMix = clamp(vCrystalWeight, 0.0, 1.0);
  float biomeRoughnessTexturedMix =
    clamp(
      biomeRoughnessMeadowMix + biomeRoughnessMushroomMix + biomeRoughnessCrystalMix,
      0.0,
      1.0
    );
  float biomeRoughnessTexturedDenominator = max(biomeRoughnessTexturedMix, 0.0001);
  vec4 texelRoughness = texture2D(roughnessMap, vRoughnessMapUv);
  vec4 texelMushroomRoughness = texture2D(mushroomRoughnessMap, vRoughnessMapUv);
  vec4 texelCrystalRoughness = texture2D(crystalRoughnessMap, vRoughnessMapUv);
  float biomeBlendedRoughness =
    (
      texelRoughness.g * biomeRoughnessMeadowMix +
      texelMushroomRoughness.g * biomeRoughnessMushroomMix +
      texelCrystalRoughness.g * biomeRoughnessCrystalMix
    ) / biomeRoughnessTexturedDenominator;
  roughnessFactor *= mix(1.0, biomeBlendedRoughness, biomeRoughnessTexturedMix);
#endif`
        )
        .replace(
          "#include <normal_fragment_maps>",
          `#ifdef USE_NORMALMAP_OBJECTSPACE
  float biomeObjectNormalMeadowMix = clamp(vMeadowWeight, 0.0, 1.0);
  float biomeObjectNormalMushroomMix = clamp(vMushroomWeight, 0.0, 1.0);
  float biomeObjectNormalCrystalMix = clamp(vCrystalWeight, 0.0, 1.0);
  float biomeObjectNormalTexturedMix =
    clamp(
      biomeObjectNormalMeadowMix +
      biomeObjectNormalMushroomMix +
      biomeObjectNormalCrystalMix,
      0.0,
      1.0
    );
  float biomeObjectNormalTexturedDenominator = max(biomeObjectNormalTexturedMix, 0.0001);
  vec3 biomeMappedNormal = texture2D(normalMap, vNormalMapUv).xyz * 2.0 - 1.0;
  vec3 biomeMushroomNormal = texture2D(mushroomNormalMap, vNormalMapUv).xyz * 2.0 - 1.0;
  vec3 biomeCrystalNormal = texture2D(crystalNormalMap, vNormalMapUv).xyz * 2.0 - 1.0;
  biomeMappedNormal =
    (
      biomeMappedNormal * biomeObjectNormalMeadowMix +
      biomeMushroomNormal * biomeObjectNormalMushroomMix +
      biomeCrystalNormal * biomeObjectNormalCrystalMix
    ) / biomeObjectNormalTexturedDenominator;
  biomeMappedNormal = mix(vec3(0.0, 0.0, 1.0), biomeMappedNormal, biomeObjectNormalTexturedMix);
  normal = biomeMappedNormal;

  #ifdef FLIP_SIDED
    normal = -normal;
  #endif

  #ifdef DOUBLE_SIDED
    normal = normal * faceDirection;
  #endif

  normal = normalize(normalMatrix * normal);
#elif defined(USE_NORMALMAP_TANGENTSPACE)
  float biomeTangentNormalMeadowMix = clamp(vMeadowWeight, 0.0, 1.0);
  float biomeTangentNormalMushroomMix = clamp(vMushroomWeight, 0.0, 1.0);
  float biomeTangentNormalCrystalMix = clamp(vCrystalWeight, 0.0, 1.0);
  float biomeTangentNormalTexturedMix =
    clamp(
      biomeTangentNormalMeadowMix +
      biomeTangentNormalMushroomMix +
      biomeTangentNormalCrystalMix,
      0.0,
      1.0
    );
  float biomeTangentNormalTexturedDenominator = max(biomeTangentNormalTexturedMix, 0.0001);
  vec3 biomeMapN = texture2D(normalMap, vNormalMapUv).xyz * 2.0 - 1.0;
  vec3 biomeMushroomMapN = texture2D(mushroomNormalMap, vNormalMapUv).xyz * 2.0 - 1.0;
  vec3 biomeCrystalMapN = texture2D(crystalNormalMap, vNormalMapUv).xyz * 2.0 - 1.0;
  vec2 biomeBlendedNormalScale =
    (
      normalScale * biomeTangentNormalMeadowMix +
      mushroomNormalScale * biomeTangentNormalMushroomMix +
      crystalNormalScale * biomeTangentNormalCrystalMix
    ) / biomeTangentNormalTexturedDenominator;
  biomeMapN =
    (
      biomeMapN * biomeTangentNormalMeadowMix +
      biomeMushroomMapN * biomeTangentNormalMushroomMix +
      biomeCrystalMapN * biomeTangentNormalCrystalMix
    ) / biomeTangentNormalTexturedDenominator;
  biomeMapN = mix(vec3(0.0, 0.0, 1.0), biomeMapN, biomeTangentNormalTexturedMix);
  biomeMapN.xy *= biomeBlendedNormalScale;
  normal = normalize(tbn * biomeMapN);
#elif defined(USE_BUMPMAP)
  normal = perturbNormalArb(-vViewPosition, normal, dHdxy_fwd(), faceDirection);
#endif`
        );
    };

    material.customProgramCacheKey = () => "fairytown-biome-terrain-v3";
    material.needsUpdate = true;
    this.terrainMaterial = material;

    return this.terrainMaterial;
  }
}
