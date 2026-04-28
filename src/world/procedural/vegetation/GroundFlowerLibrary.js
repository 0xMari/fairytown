import { MegascansPlantLibrary } from "./MegascansPlantLibrary.js";

export class GroundFlowerLibrary extends MegascansPlantLibrary {
  constructor() {
    super({
      keyPrefix: "ground-flower",
      targetHeight: 0.48,
      preferredLods: [1, 2],
      sink: -0.035,
      materialOptions: {
        alphaTest: 0.3,
        roughness: 0.78,
        emissive: "#2f3d18",
        emissiveMix: 0.22,
        emissiveIntensity: 0.04,
        normalScale: 0.38,
        aoIntensity: 0.48
      },
      packs: [
        {
          key: "lily",
          prefix: "xikkdhjja",
          url: "/flowers/lily_of_the_valley_xikkdhjja_ue_mid/standard/xikkdhjja_tier_2_nonUE.gltf",
          targetHeight: 0.52
        },
        {
          key: "violet-sorrel",
          prefix: "uchkajuia",
          url: "/flowers/violet_wood_sorrel_uchkajuia_ue_mid/standard/uchkajuia_tier_2_nonUE.gltf",
          targetHeight: 0.42
        }
      ]
    });
  }
}
