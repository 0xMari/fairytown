import * as THREE from "three";
import { Water } from "three/examples/jsm/objects/Water.js";

const WATER_REFLECTION_SIZE = 64;
const WATER_COLOR = "#1f6f86";
const WATER_SUN_COLOR = "#fff4c8";
const WATER_DISTORTION_SCALE = 2.35;
const WATER_ALPHA = 0.78;
const WATER_NORMAL_SIZE = 128;

function hash2(x, y) {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return THREE.MathUtils.euclideanModulo(value, 1);
}

function valueNoise(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);

  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(a, b, ux),
    THREE.MathUtils.lerp(c, d, ux),
    uy
  );
}

function fbm(x, y) {
  let value = 0;
  let amplitude = 0.55;
  let frequency = 1;
  let total = 0;

  for (let octave = 0; octave < 5; octave += 1) {
    value += valueNoise(x * frequency, y * frequency) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2.07;
  }

  return value / total;
}

export class TerrainWaterLibrary {
  constructor() {
    this.material = null;
    this.normalTexture = null;
    this.waters = new Set();
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

  getNormalTexture() {
    if (this.normalTexture) {
      return this.normalTexture;
    }

    const canvas = document.createElement("canvas");
    canvas.width = WATER_NORMAL_SIZE;
    canvas.height = WATER_NORMAL_SIZE;
    const context = canvas.getContext("2d");
    const image = context.createImageData(WATER_NORMAL_SIZE, WATER_NORMAL_SIZE);
    const sampleStep = 1 / WATER_NORMAL_SIZE;

    for (let y = 0; y < WATER_NORMAL_SIZE; y += 1) {
      for (let x = 0; x < WATER_NORMAL_SIZE; x += 1) {
        const u = x / WATER_NORMAL_SIZE;
        const v = y / WATER_NORMAL_SIZE;
        const scale = 10.5;
        const hL = fbm((u - sampleStep) * scale, v * scale);
        const hR = fbm((u + sampleStep) * scale, v * scale);
        const hD = fbm(u * scale, (v - sampleStep) * scale);
        const hU = fbm(u * scale, (v + sampleStep) * scale);
        const normal = new THREE.Vector3((hL - hR) * 6, (hD - hU) * 6, 1).normalize();
        const pixel = (y * WATER_NORMAL_SIZE + x) * 4;

        image.data[pixel] = Math.round((normal.x * 0.5 + 0.5) * 255);
        image.data[pixel + 1] = Math.round((normal.y * 0.5 + 0.5) * 255);
        image.data[pixel + 2] = Math.round((normal.z * 0.5 + 0.5) * 255);
        image.data[pixel + 3] = 255;
      }
    }

    context.putImageData(image, 0, 0);

    this.normalTexture = new THREE.CanvasTexture(canvas);
    this.normalTexture.wrapS = THREE.RepeatWrapping;
    this.normalTexture.wrapT = THREE.RepeatWrapping;
    this.normalTexture.colorSpace = THREE.NoColorSpace;
    this.normalTexture.needsUpdate = true;

    return this.normalTexture;
  }

  createWater(geometry) {
    const water = new Water(geometry, {
      textureWidth: WATER_REFLECTION_SIZE,
      textureHeight: WATER_REFLECTION_SIZE,
      waterNormals: this.getNormalTexture(),
      sunDirection: new THREE.Vector3(0.42, 0.82, 0.28).normalize(),
      sunColor: WATER_SUN_COLOR,
      waterColor: WATER_COLOR,
      distortionScale: WATER_DISTORTION_SCALE,
      alpha: WATER_ALPHA,
      side: THREE.DoubleSide,
      fog: true
    });

    water.material.transparent = true;
    water.material.depthWrite = false;
    water.material.uniforms.size.value = 3.2;

    const originalOnBeforeRender = water.onBeforeRender.bind(water);

    water.onBeforeRender = (renderer, scene, camera) => {
      const hiddenWaters = [];

      for (const otherWater of this.waters) {
        if (otherWater === water || !otherWater.visible) {
          continue;
        }

        otherWater.visible = false;
        hiddenWaters.push(otherWater);
      }

      originalOnBeforeRender(renderer, scene, camera);

      for (const hiddenWater of hiddenWaters) {
        hiddenWater.visible = true;
      }
    };

    this.waters.add(water);

    return water;
  }

  update(elapsedTime) {
    for (const water of this.waters) {
      water.material.uniforms.time.value = elapsedTime * 0.62;
    }
  }

  disposeWater(water) {
    if (!water) {
      return;
    }

    this.waters.delete(water);
    water.geometry?.dispose();
    water.material?.uniforms?.mirrorSampler?.value?.dispose?.();
    water.material?.dispose?.();
  }
}
