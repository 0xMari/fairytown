import { GUI } from "three/examples/jsm/libs/lil-gui.module.min.js";

function addReadOnlyController(gui, state, key, name, decimals = 0) {
  const controller = gui.add(state, key).name(name).listen();

  if (typeof controller.decimals === "function") {
    controller.decimals(decimals);
  }

  controller.disable();
  return controller;
}

function roundTo(value, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export class PerformanceController {
  constructor({ renderer, getLoadedChunkCount, showGui = true }) {
    this.renderer = renderer;
    this.getLoadedChunkCount = getLoadedChunkCount;
    this.showGui = showGui;
    this.smoothedFrameMs = 16.7;
    this.sampleElapsed = 0;
    this.sampleFrames = 0;
    this.state = {
      fps: 60,
      frameMs: 16.7,
      drawCalls: 0,
      triangles: 0,
      geometries: 0,
      textures: 0,
      chunks: 0,
      dpr: renderer.getPixelRatio(),
      heapMb: 0
    };

    if (!this.showGui) {
      this.gui = null;
      return;
    }

    this.gui = new GUI({ autoPlace: false, title: "Performance", width: 270 });
    this.gui.domElement.classList.add("performance-gui");
    document.body.appendChild(this.gui.domElement);

    const frameFolder = this.gui.addFolder("Frame");
    frameFolder.open();
    addReadOnlyController(frameFolder, this.state, "fps", "FPS", 1);
    addReadOnlyController(frameFolder, this.state, "frameMs", "Frame (ms)", 1);

    const rendererFolder = this.gui.addFolder("Renderer");
    rendererFolder.open();
    addReadOnlyController(rendererFolder, this.state, "drawCalls", "Draw Calls");
    addReadOnlyController(rendererFolder, this.state, "triangles", "Triangles");
    addReadOnlyController(rendererFolder, this.state, "geometries", "Geometries");
    addReadOnlyController(rendererFolder, this.state, "textures", "Textures");
    addReadOnlyController(rendererFolder, this.state, "dpr", "Pixel Ratio", 2);
    addReadOnlyController(rendererFolder, this.state, "heapMb", "Heap (MB)");

    const worldFolder = this.gui.addFolder("World");
    worldFolder.open();
    addReadOnlyController(worldFolder, this.state, "chunks", "Loaded Chunks");
  }

  update(delta) {
    const clampedDelta = Math.max(delta, 1 / 240);
    const currentFrameMs = clampedDelta * 1000;

    this.smoothedFrameMs += (currentFrameMs - this.smoothedFrameMs) * 0.16;
    this.state.frameMs = roundTo(this.smoothedFrameMs, 1);

    this.sampleElapsed += delta;
    this.sampleFrames += 1;

    if (this.sampleElapsed >= 0.35) {
      this.state.fps = roundTo(this.sampleFrames / this.sampleElapsed, 1);
      this.sampleElapsed = 0;
      this.sampleFrames = 0;
    }

    this.state.drawCalls = this.renderer.info.render.calls;
    this.state.triangles = this.renderer.info.render.triangles;
    this.state.geometries = this.renderer.info.memory.geometries;
    this.state.textures = this.renderer.info.memory.textures;
    this.state.chunks = this.getLoadedChunkCount();
    this.state.dpr = roundTo(this.renderer.getPixelRatio(), 2);

    if (globalThis.performance?.memory?.usedJSHeapSize) {
      this.state.heapMb = Math.round(
        globalThis.performance.memory.usedJSHeapSize / (1024 * 1024)
      );
    }
  }
}
