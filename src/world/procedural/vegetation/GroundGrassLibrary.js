import { MegascansPlantLibrary } from "./MegascansPlantLibrary.js";

export class GroundGrassLibrary extends MegascansPlantLibrary {
  constructor() {
    super({
      keyPrefix: "ground-grass",
      targetHeight: 0.62,
      preferredLods: [1, 2],
      sink: -0.025,
      materialOptions: {
        alphaTest: 0.34,
        roughness: 0.9,
        emissive: "#1f3517",
        emissiveMix: 0.35,
        emissiveIntensity: 0.05,
        normalScale: 0.42,
        aoIntensity: 0.52
      },
      packs: [
        {
          key: "ribbon",
          prefix: "tbdpec3r",
          url: "/grass/ribbon_grass_tbdpec3r_ue_mid/standard/tbdpec3r_tier_2_nonUE.gltf",
          targetHeight: 0.58
        },
        {
          key: "wild",
          prefix: "vlkhcbxia",
          url: "/grass/wild_grass_vlkhcbxia_ue_mid/standard/vlkhcbxia_tier_2_nonUE.gltf",
          targetHeight: 0.72
        }
      ]
    });
  }
}
