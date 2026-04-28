import { GUI } from "three/examples/jsm/libs/lil-gui.module.min.js";
import {
  getTerrainHeightSettings,
  resetTerrainHeightSettings,
  setTerrainHeightSettings
} from "./terrain.js";

const TERRAIN_REFRESH_DEBOUNCE_MS = 140;

const TERRAIN_CONTROL_CONFIG = {
  broadAmplitude: { min: 0, max: 24, step: 0.1, label: "Broad Amplitude" },
  rollingAmplitude: { min: 0, max: 18, step: 0.1, label: "Rolling Amplitude" },
  ridgeAmplitude: { min: 0, max: 18, step: 0.1, label: "Ridge Amplitude" },
  basinDepth: { min: 0, max: 12, step: 0.1, label: "Basin Depth" },
  finalScale: { min: 0.2, max: 2.5, step: 0.01, label: "Final Scale" }
};

export class TerrainSettingsController {
  constructor({ onTerrainChanged }) {
    this.onTerrainChanged = onTerrainChanged;
    this.refreshTimer = null;
    this.state = getTerrainHeightSettings();
    this.actions = {
      rebuild: () => this.flushTerrainRefresh(),
      reset: () => {
        Object.assign(this.state, resetTerrainHeightSettings());
        this.flushTerrainRefresh();
      }
    };

    this.gui = new GUI({ autoPlace: false, title: "Terrain", width: 300 });
    this.gui.domElement.classList.add("terrain-gui");
    document.body.appendChild(this.gui.domElement);

    const heightFolder = this.gui.addFolder("Height");
    heightFolder.open();

    for (const [key, config] of Object.entries(TERRAIN_CONTROL_CONFIG)) {
      const controller = heightFolder
        .add(this.state, key, config.min, config.max, config.step)
        .name(config.label);

      controller.onChange((value) => {
        setTerrainHeightSettings({ [key]: value });
        this.scheduleTerrainRefresh();
      });

      controller.onFinishChange(() => {
        this.flushTerrainRefresh();
      });
    }

    this.gui.add(this.actions, "rebuild").name("Rebuild World");
    this.gui.add(this.actions, "reset").name("Reset Defaults");
  }

  scheduleTerrainRefresh() {
    globalThis.clearTimeout(this.refreshTimer);
    this.refreshTimer = globalThis.setTimeout(() => {
      this.refreshTimer = null;
      this.onTerrainChanged?.();
    }, TERRAIN_REFRESH_DEBOUNCE_MS);
  }

  flushTerrainRefresh() {
    globalThis.clearTimeout(this.refreshTimer);
    this.refreshTimer = null;
    this.onTerrainChanged?.();
  }
}
