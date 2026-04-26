import * as THREE from "three";

export class TerrainWaterLibrary {
  constructor() {
    this.material = null;
  }

  getMaterial() {
    if (this.material) {
      return this.material;
    }

    const material = new THREE.MeshStandardMaterial({
      color: "#3c7fa8",
      transparent: true,
      opacity: 0.88,
      roughness: 0.18,
      metalness: 0,
      depthWrite: false
    });

    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
attribute float waterMask;
attribute float waterDepth;
varying float vWaterMask;
varying float vWaterDepth;`
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
vWaterMask = waterMask;
vWaterDepth = waterDepth;`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
varying float vWaterMask;
varying float vWaterDepth;`
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
float waterCoverage = smoothstep(0.12, 0.46, vWaterMask);
float waterDepthMix = clamp(vWaterDepth, 0.0, 1.0);
float waterEdgeFoam = 1.0 - smoothstep(0.18, 0.44, vWaterMask);
float cartoonDepthMix = smoothstep(0.08, 0.82, waterDepthMix);
vec3 shallowWaterColor = vec3(0.28, 0.63, 0.79);
vec3 midWaterColor = vec3(0.16, 0.41, 0.63);
vec3 deepWaterColor = vec3(0.07, 0.2, 0.39);
vec3 foamColor = vec3(0.93, 0.99, 1.0);
diffuseColor.rgb = mix(
  shallowWaterColor,
  midWaterColor,
  smoothstep(0.18, 0.58, cartoonDepthMix)
);
diffuseColor.rgb = mix(
  diffuseColor.rgb,
  deepWaterColor,
  smoothstep(0.54, 1.0, cartoonDepthMix)
);
diffuseColor.rgb = mix(diffuseColor.rgb, foamColor, waterEdgeFoam * 0.26);
diffuseColor.a *= waterCoverage * (0.68 + waterDepthMix * 0.18);`
        )
        .replace(
          "#include <roughnessmap_fragment>",
          `float roughnessFactor = roughness;
roughnessFactor = mix(0.24, 0.12, clamp(vWaterDepth, 0.0, 1.0));`
        )
        .replace(
          "#include <alphatest_fragment>",
          `#include <alphatest_fragment>
if (diffuseColor.a < 0.03) discard;`
        );
    };

    material.customProgramCacheKey = () => "fairytown-terrain-water-v1";
    material.needsUpdate = true;
    this.material = material;

    return this.material;
  }
}
