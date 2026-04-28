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
      color: "#2f6f8c",
      roughness: 0.72,
      metalness: 0,
      transparent: false
    });

    this.material = material;

    return this.material;
  }
}
