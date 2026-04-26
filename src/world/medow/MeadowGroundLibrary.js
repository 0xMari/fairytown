import * as THREE from "three";
import { EXRLoader } from "three/addons/loaders/EXRLoader.js";

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
      this.exrLoader.loadAsync(MUSHROOM_TERRAIN_NORMAL_URL)
    ]).then(([
      diffuseTexture,
      roughnessTexture,
      displacementTexture,
      normalTexture,
      mushroomDiffuseTexture,
      mushroomRoughnessTexture,
      mushroomDisplacementTexture,
      mushroomNormalTexture
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
      !this.mushroomNormalTexture
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

      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
attribute float meadowWeight;
attribute float mushroomWeight;
uniform sampler2D mushroomDisplacementMap;
uniform float mushroomDisplacementScale;
uniform float mushroomDisplacementBias;
varying float vMeadowWeight;
varying float vMushroomWeight;`
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
vMeadowWeight = meadowWeight;
vMushroomWeight = mushroomWeight;`
        )
        .replace(
          "#include <displacementmap_vertex>",
          `#ifdef USE_DISPLACEMENTMAP
  float meadowDisplacement =
    texture2D(displacementMap, vDisplacementMapUv).x * displacementScale + displacementBias;
  float mushroomDisplacement =
    texture2D(mushroomDisplacementMap, vDisplacementMapUv).x * mushroomDisplacementScale +
    mushroomDisplacementBias;
  transformed +=
    normalize(objectNormal) *
    (
      meadowDisplacement * clamp(vMeadowWeight, 0.0, 1.0) +
      mushroomDisplacement * clamp(vMushroomWeight, 0.0, 1.0)
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
varying float vMeadowWeight;
varying float vMushroomWeight;`
        )
        .replace(
          "#include <map_fragment>",
          `#ifdef USE_MAP
  float biomeMapMeadowMix = clamp(vMeadowWeight, 0.0, 1.0);
  float biomeMapMushroomMix = clamp(vMushroomWeight, 0.0, 1.0);
  float biomeMapTexturedMix = clamp(biomeMapMeadowMix + biomeMapMushroomMix, 0.0, 1.0);
  float biomeMapTexturedDenominator = max(biomeMapTexturedMix, 0.0001);
  vec4 sampledDiffuseColor = texture2D(map, vMapUv);
  vec4 sampledMushroomDiffuseColor = texture2D(mushroomDiffuseMap, vMapUv);
  #ifdef DECODE_VIDEO_TEXTURE
    sampledDiffuseColor = sRGBTransferEOTF(sampledDiffuseColor);
    sampledMushroomDiffuseColor = sRGBTransferEOTF(sampledMushroomDiffuseColor);
  #endif
  vec3 biomeMapTexturedColor = mix(
    sampledDiffuseColor.rgb,
    sampledMushroomDiffuseColor.rgb,
    biomeMapMushroomMix / biomeMapTexturedDenominator
  );
  diffuseColor.rgb = mix(diffuseColor.rgb, biomeMapTexturedColor, biomeMapTexturedMix);
#endif`
        )
        .replace(
          "#include <color_fragment>",
          `#if defined( USE_COLOR_ALPHA )
  float biomeColorTexturedMix = clamp(vMeadowWeight + vMushroomWeight, 0.0, 1.0);
  vec4 biomeBlendedVertexColor = mix(vColor, vec4(1.0), biomeColorTexturedMix);
  diffuseColor *= biomeBlendedVertexColor;
#elif defined( USE_COLOR )
  float biomeColorTexturedMix = clamp(vMeadowWeight + vMushroomWeight, 0.0, 1.0);
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
  float biomeRoughnessTexturedMix =
    clamp(biomeRoughnessMeadowMix + biomeRoughnessMushroomMix, 0.0, 1.0);
  float biomeRoughnessTexturedDenominator = max(biomeRoughnessTexturedMix, 0.0001);
  vec4 texelRoughness = texture2D(roughnessMap, vRoughnessMapUv);
  vec4 texelMushroomRoughness = texture2D(mushroomRoughnessMap, vRoughnessMapUv);
  float biomeBlendedRoughness = mix(
    texelRoughness.g,
    texelMushroomRoughness.g,
    biomeRoughnessMushroomMix / biomeRoughnessTexturedDenominator
  );
  roughnessFactor *= mix(1.0, biomeBlendedRoughness, biomeRoughnessTexturedMix);
#endif`
        )
        .replace(
          "#include <normal_fragment_maps>",
          `#ifdef USE_NORMALMAP_OBJECTSPACE
  float biomeObjectNormalMeadowMix = clamp(vMeadowWeight, 0.0, 1.0);
  float biomeObjectNormalMushroomMix = clamp(vMushroomWeight, 0.0, 1.0);
  float biomeObjectNormalTexturedMix =
    clamp(biomeObjectNormalMeadowMix + biomeObjectNormalMushroomMix, 0.0, 1.0);
  float biomeObjectNormalTexturedDenominator = max(biomeObjectNormalTexturedMix, 0.0001);
  vec3 biomeMappedNormal = texture2D(normalMap, vNormalMapUv).xyz * 2.0 - 1.0;
  vec3 biomeMushroomNormal = texture2D(mushroomNormalMap, vNormalMapUv).xyz * 2.0 - 1.0;
  biomeMappedNormal = mix(
    biomeMappedNormal,
    biomeMushroomNormal,
    biomeObjectNormalMushroomMix / biomeObjectNormalTexturedDenominator
  );
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
  float biomeTangentNormalTexturedMix =
    clamp(biomeTangentNormalMeadowMix + biomeTangentNormalMushroomMix, 0.0, 1.0);
  float biomeTangentNormalTexturedDenominator = max(biomeTangentNormalTexturedMix, 0.0001);
  vec3 biomeMapN = texture2D(normalMap, vNormalMapUv).xyz * 2.0 - 1.0;
  vec3 biomeMushroomMapN = texture2D(mushroomNormalMap, vNormalMapUv).xyz * 2.0 - 1.0;
  vec2 biomeBlendedNormalScale = mix(
    normalScale,
    mushroomNormalScale,
    biomeTangentNormalMushroomMix / biomeTangentNormalTexturedDenominator
  );
  biomeMapN = mix(
    biomeMapN,
    biomeMushroomMapN,
    biomeTangentNormalMushroomMix / biomeTangentNormalTexturedDenominator
  );
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
