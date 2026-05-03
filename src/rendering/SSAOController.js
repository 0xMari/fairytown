import { GUI } from "three/examples/jsm/libs/lil-gui.module.min.js";
import { SSAOPass } from "three/examples/jsm/postprocessing/SSAOPass.js";

const OUTPUT_OPTIONS = {
  Default: SSAOPass.OUTPUT.Default,
  "SSAO Only": SSAOPass.OUTPUT.SSAO,
  Blur: SSAOPass.OUTPUT.Blur,
  Depth: SSAOPass.OUTPUT.Depth,
  Normal: SSAOPass.OUTPUT.Normal
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export class SSAOController {
  constructor({
    composer,
    pass,
    renderer,
    width,
    height,
    showGui = true,
    enabled = false,
    kernelRadius = 4.5,
    minDistance = 0.0015,
    maxDistance = 0.075,
    resolutionScale = 0.75
  }) {
    this.composer = composer;
    this.pass = pass;
    this.renderer = renderer;
    this.state = {
      enabled,
      kernelRadius,
      minDistance,
      maxDistance,
      resolutionScale,
      output: SSAOPass.OUTPUT.Default
    };

    this.apply();
    this.resize(width, height);

    if (!showGui) {
      this.gui = null;
      return;
    }

    this.gui = new GUI({ autoPlace: false, title: "SSAO", width: 280 });
    this.gui.domElement.classList.add("ssao-gui");
    document.body.appendChild(this.gui.domElement);

    this.gui.add(this.state, "enabled").name("Enabled").onChange(() => this.apply());
    this.gui
      .add(this.state, "kernelRadius", 0.5, 18, 0.1)
      .name("Radius")
      .onChange(() => this.apply());
    this.gui
      .add(this.state, "minDistance", 0.0001, 0.03, 0.0001)
      .name("Min Distance")
      .onChange(() => this.apply());
    this.gui
      .add(this.state, "maxDistance", 0.005, 0.28, 0.001)
      .name("Max Distance")
      .onChange(() => this.apply());
    this.gui
      .add(this.state, "resolutionScale", 0.35, 1, 0.05)
      .name("Resolution")
      .onChange(() => this.resize(window.innerWidth, window.innerHeight));
    this.gui
      .add(this.state, "output", OUTPUT_OPTIONS)
      .name("Debug View")
      .onChange(() => this.apply());
  }

  get isEnabled() {
    return this.state.enabled;
  }

  apply() {
    this.pass.enabled = this.state.enabled;
    this.pass.kernelRadius = this.state.kernelRadius;
    this.pass.minDistance = this.state.minDistance;
    this.pass.maxDistance = this.state.maxDistance;
    this.pass.output = Number(this.state.output);
  }

  resize(width, height) {
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(width, height);

    const pixelRatio = this.renderer.getPixelRatio();
    const scale = clamp(this.state.resolutionScale, 0.35, 1);
    const ssaoWidth = Math.max(1, Math.floor(width * pixelRatio * scale));
    const ssaoHeight = Math.max(1, Math.floor(height * pixelRatio * scale));

    this.pass.setSize(ssaoWidth, ssaoHeight);
  }
}
