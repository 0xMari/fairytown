import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { SSAOPass } from "three/examples/jsm/postprocessing/SSAOPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { LUTPass } from "three/examples/jsm/postprocessing/LUTPass.js";
import { LUTCubeLoader } from "three/examples/jsm/loaders/LUTCubeLoader.js";
import "./style.css";
import { SELECTIVE_BLOOM_LAYER } from "./rendering/bloom.js";
import { PerformanceController } from "./rendering/PerformanceController.js";
import { SSAOController } from "./rendering/SSAOController.js";
import { BIOMES } from "./world/biomes.js";
import { ChunkManager } from "./world/chunkManager.js";
import { FairyControls } from "./world/FairyControls.js";
import {
  createProceduralAssetContext,
  loadProceduralAssets,
  updateProceduralAssets
} from "./world/procedural/index.js";
import { TimeOfDayController } from "./world/TimeOfDayController.js";

const MAX_RENDERER_PIXEL_RATIO = 1.25;
const BLOOM_RESOLUTION_SCALE = 0.6;
const SSAO_RESOLUTION_SCALE = 0.75;
const WORLD_SEED = 83473;
const WORLD_VIEW_RADIUS = 1;
const WORLD_PRELOAD_RADIUS = 2;
const SUN_SHADOW_MAP_SIZE = 1024;
const MOON_SHADOW_MAP_SIZE = 512;
const SHADOW_CAMERA_SIZE = 92;
const HORIZON_FOG_COLOR = "#d9ebfa";
const HORIZON_FOG_NEAR = 36;
const HORIZON_FOG_FAR = 125;
const IS_DEBUG_ROUTE = window.location.pathname.replace(/\/+$/, "").endsWith("/debug");
const ENABLE_BLOOM_PASS = false;
const FAIRYTOWN_LUT_PATH = "/luts/fairytown_forest_look.cube";
const FAIRYTOWN_LUT_INTENSITY = 1;

const biomeNameEl = document.querySelector("#biome-name");
const chunkCountEl = document.querySelector("#chunk-count");
const crosshairEl = document.querySelector("#crosshair");
const entryScreenEl = document.querySelector("#entry-screen");
const entryStatusEl = document.querySelector("#entry-status");
const enterWorldButtonEl = document.querySelector("#enter-world-button");
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

function getCappedPixelRatio() {
  return Math.min(window.devicePixelRatio, MAX_RENDERER_PIXEL_RATIO);
}

function getBloomPixelRatio(renderer) {
  return Math.max(0.5, renderer.getPixelRatio() * BLOOM_RESOLUTION_SCALE);
}

function createLutPass(lut) {
  if (!lut?.texture3D) {
    return null;
  }

  const pass = new LUTPass({
    lut: lut.texture3D,
    intensity: FAIRYTOWN_LUT_INTENSITY
  });

  pass.material.depthTest = false;
  pass.material.depthWrite = false;
  pass.material.blending = THREE.NoBlending;

  return pass;
}

function createWorldEntryController(renderer) {
  const state = {
    hasEntered: false
  };

  function setLoadingProgress(loaded, total) {
    if (!entryStatusEl) {
      return;
    }

    const safeTotal = Math.max(total, 1);
    const percentage = Math.min(100, Math.round((loaded / safeTotal) * 100));
    entryStatusEl.textContent = `Loading world... ${percentage}%`;
  }

  function setReady(isReady) {
    if (!enterWorldButtonEl || !entryStatusEl) {
      return;
    }

    enterWorldButtonEl.disabled = !isReady;
    entryStatusEl.textContent = isReady
      ? "World ready. 100%. Click Enter to begin."
      : "Loading world... 0%";
  }

  function enterWorld() {
    if (!entryScreenEl || !enterWorldButtonEl || state.hasEntered || enterWorldButtonEl.disabled) {
      return;
    }

    state.hasEntered = true;
    entryScreenEl.classList.add("is-hidden");
    crosshairEl?.classList.remove("is-hidden");
    renderer.domElement.requestPointerLock?.();
  }

  enterWorldButtonEl?.addEventListener("click", enterWorld);

  return {
    get hasEntered() {
      return state.hasEntered;
    },
    setLoadingProgress,
    setReady
  };
}

async function bootstrap() {
  setupFairyFlightPanel();
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(getCappedPixelRatio());
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.info.autoReset = false;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.append(renderer.domElement);
  const worldEntry = createWorldEntryController(renderer);
  const loadingManager = THREE.DefaultLoadingManager;

  loadingManager.onStart = (_url, itemsLoaded, itemsTotal) => {
    worldEntry.setLoadingProgress(itemsLoaded, itemsTotal);
  };

  loadingManager.onProgress = (_url, itemsLoaded, itemsTotal) => {
    worldEntry.setLoadingProgress(itemsLoaded, itemsTotal);
  };

  loadingManager.onLoad = () => {
    worldEntry.setLoadingProgress(1, 1);
  };

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#87ceeb");
  scene.fog = new THREE.Fog(HORIZON_FOG_COLOR, HORIZON_FOG_NEAR, HORIZON_FOG_FAR);

  const camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.1,
    1200
  );
  camera.position.set(0, 1, 12);

  const controls = new FairyControls(camera, renderer.domElement);
  const proceduralAssets = createProceduralAssetContext();
  let fairytownLut = null;

  try {
    await loadProceduralAssets(proceduralAssets, renderer);
    fairytownLut = await new LUTCubeLoader(loadingManager).loadAsync(FAIRYTOWN_LUT_PATH);
  } catch (error) {
    console.error("World assets failed to load.", error);
  } finally {
    worldEntry.setReady(true);
  }

  const world = new ChunkManager(scene, {
    seed: WORLD_SEED,
    chunkSize: 48,
    viewRadius: WORLD_VIEW_RADIUS,
    preloadRadius: WORLD_PRELOAD_RADIUS,
    maxObjectsPerChunk: 72,
    assetContext: {
      procedural: proceduralAssets
    }
  });
  const performanceMonitor = new PerformanceController({
    renderer,
    getLoadedChunkCount: () => world.getLoadedChunkCount(),
    showGui: IS_DEBUG_ROUTE
  });

  const hemiLight = new THREE.HemisphereLight("#fff8dd", "#7ba985", 1.7);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight("#fff6d2", 1.8);
  sunLight.position.set(18, 30, 12);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(SUN_SHADOW_MAP_SIZE, SUN_SHADOW_MAP_SIZE);
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 240;
  sunLight.shadow.camera.left = -SHADOW_CAMERA_SIZE;
  sunLight.shadow.camera.right = SHADOW_CAMERA_SIZE;
  sunLight.shadow.camera.top = SHADOW_CAMERA_SIZE;
  sunLight.shadow.camera.bottom = -SHADOW_CAMERA_SIZE;
  sunLight.shadow.camera.updateProjectionMatrix();
  sunLight.shadow.bias = -0.00018;
  sunLight.shadow.normalBias = 0.055;
  sunLight.shadow.radius = 2.4;
  scene.add(sunLight);

  const moonLight = new THREE.DirectionalLight("#dce8ff", 0.25);
  moonLight.position.set(-18, 24, -12);
  moonLight.castShadow = false;
  moonLight.shadow.mapSize.set(MOON_SHADOW_MAP_SIZE, MOON_SHADOW_MAP_SIZE);
  moonLight.shadow.camera.near = 0.5;
  moonLight.shadow.camera.far = 220;
  moonLight.shadow.camera.left = -SHADOW_CAMERA_SIZE;
  moonLight.shadow.camera.right = SHADOW_CAMERA_SIZE;
  moonLight.shadow.camera.top = SHADOW_CAMERA_SIZE;
  moonLight.shadow.camera.bottom = -SHADOW_CAMERA_SIZE;
  moonLight.shadow.camera.updateProjectionMatrix();
  moonLight.shadow.bias = -0.00008;
  moonLight.shadow.normalBias = 0.08;
  moonLight.shadow.radius = 5.2;
  scene.add(moonLight);

  const fairyLight = new THREE.PointLight("#fff1a8", 1.7, 22, 2);
  fairyLight.position.set(0, 0, 0);
  camera.add(fairyLight);
  scene.add(camera);

  const timeOfDay = new TimeOfDayController({
    scene,
    renderer,
    camera,
    sunLight,
    moonLight,
    hemiLight,
    fairyLight,
    showGui: IS_DEBUG_ROUTE
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
  bloomComposer.setPixelRatio(getBloomPixelRatio(renderer));
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
  const finalLutPass = createLutPass(fairytownLut);

  finalComposer.addPass(finalRenderPass);
  finalComposer.addPass(finalPass);
  if (finalLutPass) {
    finalComposer.addPass(finalLutPass);
  }
  finalComposer.addPass(new OutputPass());
  finalComposer.setPixelRatio(renderer.getPixelRatio());
  finalComposer.setSize(window.innerWidth, window.innerHeight);

  const ssaoComposer = new EffectComposer(renderer);
  const ssaoRenderPass = new RenderPass(scene, camera);
  const ssaoPass = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight, 16);
  const ssaoLutPass = createLutPass(fairytownLut);
  ssaoComposer.addPass(ssaoRenderPass);
  ssaoComposer.addPass(ssaoPass);
  if (ssaoLutPass) {
    ssaoComposer.addPass(ssaoLutPass);
  }
  ssaoComposer.addPass(new OutputPass());

  const ssaoController = new SSAOController({
    composer: ssaoComposer,
    pass: ssaoPass,
    renderer,
    width: window.innerWidth,
    height: window.innerHeight,
    showGui: IS_DEBUG_ROUTE,
    enabled: true,
    resolutionScale: SSAO_RESOLUTION_SCALE
  });

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
    if (worldEntry.hasEntered) {
      controls.update(delta);
    }
    const focusHeight = world.getSurfaceHeightAtPosition(camera.position.x, camera.position.z);
    camera.position.y = Math.max(
      focusHeight + 1,
      camera.position.y
    );
    timeOfDay.update(delta, camera.position, focusHeight);
    world.update(camera.position, elapsedTime);
    updateProceduralAssets(proceduralAssets, elapsedTime);
    updateBiomeReadout();

    if (ENABLE_BLOOM_PASS) {
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
    } else {
      ssaoComposer.render();
    }
    performanceMonitor.update(delta);
    requestAnimationFrame(animate);
  }

  animate();

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(getCappedPixelRatio());
    renderer.setSize(window.innerWidth, window.innerHeight);
    bloomComposer.setPixelRatio(getBloomPixelRatio(renderer));
    finalComposer.setPixelRatio(renderer.getPixelRatio());
    bloomComposer.setSize(window.innerWidth, window.innerHeight);
    finalComposer.setSize(window.innerWidth, window.innerHeight);
    ssaoController.resize(window.innerWidth, window.innerHeight);
  });
}

bootstrap().catch((error) => {
  console.error("Fairytown failed to start.", error);
});
