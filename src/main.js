import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import "./style.css";
import { SELECTIVE_BLOOM_LAYER } from "./rendering/bloom.js";
import { PerformanceController } from "./rendering/PerformanceController.js";
import { BIOMES } from "./world/biomes.js";
import { ChunkManager } from "./world/chunkManager.js";
import { FairyControls } from "./world/FairyControls.js";
import { TreeLibrary } from "./world/TreeLibrary.js";
import {
  createMedowAssetContext,
  loadMedowAssets,
  updateMedowAssets
} from "./world/medow/index.js";
import {
  createMushroomAssetContext,
  loadMushroomAssets
} from "./world/mushroom/index.js";
import { TimeOfDayController } from "./world/TimeOfDayController.js";

const biomeNameEl = document.querySelector("#biome-name");
const chunkCountEl = document.querySelector("#chunk-count");
const fairyFlightPanelEl = document.querySelector("#fairy-flight-panel");
const fairyFlightToggleEl = document.querySelector("#fairy-flight-toggle");

const bloomLayer = new THREE.Layers();
bloomLayer.set(SELECTIVE_BLOOM_LAYER);

const darkMaterial = new THREE.MeshBasicMaterial({ color: "#000000" });
darkMaterial.fog = false;

const selectiveBloomShader = {
  uniforms: {
    baseTexture: { value: null },
    bloomTexture: { value: null }
  },
  vertexShader: `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D baseTexture;
    uniform sampler2D bloomTexture;
    varying vec2 vUv;

    void main() {
      vec4 base = texture2D(baseTexture, vUv);
      vec4 bloom = texture2D(bloomTexture, vUv);
      gl_FragColor = base + bloom;
    }
  `
};

function setupFairyFlightPanel() {
  if (!fairyFlightPanelEl || !fairyFlightToggleEl) {
    return;
  }

  fairyFlightToggleEl.addEventListener("click", () => {
    const isCollapsed = fairyFlightPanelEl.classList.toggle("is-collapsed");

    fairyFlightToggleEl.textContent = isCollapsed ? "Show" : "Hide";
    fairyFlightToggleEl.setAttribute("aria-expanded", String(!isCollapsed));
    fairyFlightToggleEl.setAttribute(
      "aria-label",
      `${isCollapsed ? "Expand" : "Collapse"} Fairy Flight panel`
    );
  });
}

async function bootstrap() {
  setupFairyFlightPanel();
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.info.autoReset = false;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#87ceeb");

  const camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.1,
    1200
  );
  camera.position.set(0, 1, 12);

  const controls = new FairyControls(camera, renderer.domElement);
  const medowAssets = createMedowAssetContext();
  const mushroomAssets = createMushroomAssetContext();
  const trees = new TreeLibrary();

  try {
    await Promise.all([
      loadMedowAssets(medowAssets),
      loadMushroomAssets(mushroomAssets, renderer),
      trees.load()
    ]);
  } catch (error) {
    console.error("World assets failed to load.", error);
  }

  const world = new ChunkManager(scene, {
    seed: 83473,
    chunkSize: 48,
    viewRadius: 2,
    maxObjectsPerChunk: 90,
    assetContext: {
      medow: medowAssets,
      mushroom: mushroomAssets,
      trees
    }
  });
  const performanceMonitor = new PerformanceController({
    renderer,
    getLoadedChunkCount: () => world.getLoadedChunkCount()
  });

  const hemiLight = new THREE.HemisphereLight("#fff8dd", "#7ba985", 1.7);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight("#fff6d2", 1.8);
  sunLight.position.set(18, 30, 12);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 120;
  sunLight.shadow.camera.left = -60;
  sunLight.shadow.camera.right = 60;
  sunLight.shadow.camera.top = 60;
  sunLight.shadow.camera.bottom = -60;
  scene.add(sunLight);

  const fairyLight = new THREE.PointLight("#fff1a8", 1.7, 22, 2);
  fairyLight.position.set(0, 0, 0);
  camera.add(fairyLight);
  scene.add(camera);

  const timeOfDay = new TimeOfDayController({
    scene,
    renderer,
    camera,
    sunLight,
    hemiLight,
    fairyLight
  });

  const clock = new THREE.Clock();
  const savedMaterials = new Map();
  const bloomComposer = new EffectComposer(renderer);
  const bloomRenderPass = new RenderPass(scene, camera);
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.25,
    0.65,
    0.08
  );

  bloomComposer.renderToScreen = false;
  bloomComposer.addPass(bloomRenderPass);
  bloomComposer.addPass(bloomPass);
  bloomComposer.setPixelRatio(renderer.getPixelRatio());
  bloomComposer.setSize(window.innerWidth, window.innerHeight);

  const finalComposer = new EffectComposer(renderer);
  const finalRenderPass = new RenderPass(scene, camera);
  const finalPass = new ShaderPass(
    new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(selectiveBloomShader.uniforms),
      vertexShader: selectiveBloomShader.vertexShader,
      fragmentShader: selectiveBloomShader.fragmentShader
    }),
    "baseTexture"
  );
  finalPass.material.uniforms.bloomTexture.value = bloomComposer.renderTarget2.texture;

  finalComposer.addPass(finalRenderPass);
  finalComposer.addPass(finalPass);
  finalComposer.addPass(new OutputPass());
  finalComposer.setPixelRatio(renderer.getPixelRatio());
  finalComposer.setSize(window.innerWidth, window.innerHeight);

  function darkenNonBloomed(object) {
    if (!object.isMesh || bloomLayer.test(object.layers)) {
      return;
    }

    savedMaterials.set(object.uuid, object.material);
    object.material = darkMaterial;
  }

  function restoreMaterials(object) {
    const material = savedMaterials.get(object.uuid);

    if (!material) {
      return;
    }

    object.material = material;
    savedMaterials.delete(object.uuid);
  }

  function updateBiomeReadout() {
    const biomeKey = world.getBiomeKeyAtPosition(camera.position.x, camera.position.z);
    const biome = BIOMES[biomeKey];

    biomeNameEl.textContent = `Biome: ${biome.name}`;
    chunkCountEl.textContent = `Loaded chunks: ${world.getLoadedChunkCount()}`;
  }

  function animate() {
    const delta = clock.getDelta();
    const elapsedTime = clock.elapsedTime;

    renderer.info.reset();
    controls.update(delta);
    const focusHeight = world.getTerrainHeightAtPosition(camera.position.x, camera.position.z);
    camera.position.y = Math.max(
      focusHeight + 1.4,
      camera.position.y
    );
    timeOfDay.update(delta, camera.position, focusHeight);
    world.update(camera.position, elapsedTime);
    updateMedowAssets(medowAssets, elapsedTime);
    updateBiomeReadout();

    const originalBackground = scene.background;
    const originalFog = scene.fog;

    scene.background = null;
    scene.fog = null;
    scene.traverse(darkenNonBloomed);
    bloomComposer.render();
    scene.traverse(restoreMaterials);
    scene.background = originalBackground;
    scene.fog = originalFog;

    finalComposer.render();
    performanceMonitor.update(delta);
    requestAnimationFrame(animate);
  }

  animate();

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    bloomComposer.setPixelRatio(renderer.getPixelRatio());
    finalComposer.setPixelRatio(renderer.getPixelRatio());
    bloomComposer.setSize(window.innerWidth, window.innerHeight);
    finalComposer.setSize(window.innerWidth, window.innerHeight);
  });
}

bootstrap().catch((error) => {
  console.error("Fairytown failed to start.", error);
});
