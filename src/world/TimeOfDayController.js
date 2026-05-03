import * as THREE from "three";
import { GUI } from "three/examples/jsm/libs/lil-gui.module.min.js";
import { SELECTIVE_BLOOM_LAYER } from "../rendering/bloom.js";

const SUN_ORBIT_RADIUS = 170;
const SUN_DISC_DISTANCE = 240;
const SUN_DISC_SIZE = 10;
const SUN_AZIMUTH = -Math.PI * 0.28;
const MOON_DISC_DISTANCE = 228;
const MOON_DISC_SIZE = 7.2;
const STAR_FIELD_DISTANCE = 330;
const STAR_COUNT = 520;
const DAY_FOG_RANGE = { near: 45, far: 125 };
const NIGHT_FOG_RANGE = { near: 36, far: 82 };
const SUN_SHADOW_VISIBILITY_THRESHOLD = 0.05;
const MOON_SHADOW_VISIBILITY_THRESHOLD = 0.18;

const SKY_COLOR_STOPS = [
  { hour: 0, value: "#02040a" },
  { hour: 4.5, value: "#0b1424" },
  { hour: 6.2, value: "#6b4d5e" },
  { hour: 7.2, value: "#e5c1f5" },
  { hour: 9, value: "#95daf0" },
  { hour: 13, value: "#b0d8e8" },
  { hour: 17, value: "#94b9d1" },
  { hour: 18.4, value: "#d18a66" },
  { hour: 19.3, value: "#3a415a" },
  { hour: 21.2, value: "#080d1a" },
  { hour: 24, value: "#02040a" }
];

const FOG_COLOR_STOPS = [
  { hour: 0, value: "#000103" },
  { hour: 5.8, value: "#12131a" },
  { hour: 7.2, value: "#c9b09a" },
  { hour: 12, value: "#c9dac6" },
  { hour: 18.1, value: "#9c7a6f" },
  { hour: 20.4, value: "#05070c" },
  { hour: 24, value: "#000103" }
];

const HEMI_SKY_STOPS = [
  { hour: 0, value: "#24365c" },
  { hour: 6.3, value: "#f6c1ce" },
  { hour: 9, value: "#dff4ff" },
  { hour: 13, value: "#fff6dd" },
  { hour: 18.3, value: "#ffc0af" },
  { hour: 20.5, value: "#495687" },
  { hour: 24, value: "#24365c" }
];

const HEMI_GROUND_STOPS = [
  { hour: 0, value: "#040702" },
  { hour: 6.3, value: "#262b1a" },
  // { hour: 9, value: "#7ba985" },
  { hour: 13, value: "#354221" },
  { hour: 18.4, value: "#1a210f" },
  // { hour: 21, value: "#111b28" },
  { hour: 24, value: "#040702" }
];

const SUN_COLOR_STOPS = [
  { hour: 0, value: "#ffb37a" },
  { hour: 6, value: "#ff9a73" },
  { hour: 8, value: "#ffe6a8" },
  { hour: 13, value: "#fffdf2" },
  { hour: 18, value: "#ff9a73" },
  { hour: 24, value: "#ffb37a" }
];

const EXPOSURE_STOPS = [
  { hour: 0, value: 0.55 },
  { hour: 5.8, value: 0.72 },
  { hour: 7.5, value: 1.0 },
  { hour: 12, value: 1.18 },
  { hour: 18.3, value: 0.92 },
  { hour: 20.2, value: 0.65 },
  { hour: 24, value: 0.55 }
];

const FAIRY_LIGHT_STOPS = [
  { hour: 0, value: 2.35 },
  { hour: 6.5, value: 1.9 },
  { hour: 9, value: 1.3 },
  { hour: 13, value: 1.05 },
  { hour: 18.5, value: 1.85 },
  { hour: 21, value: 2.2 },
  { hour: 24, value: 2.35 }
];

const MOON_COLOR_STOPS = [
  { hour: 0, value: "#dce8ff" },
  { hour: 5.8, value: "#efe7ff" },
  { hour: 7.2, value: "#ffe7d7" },
  { hour: 18.2, value: "#ffe4dc" },
  { hour: 20.5, value: "#dce8ff" },
  { hour: 24, value: "#dce8ff" }
];

function wrapHour(hour) {
  return ((hour % 24) + 24) % 24;
}

function sampleStops(stops, hour) {
  const wrappedHour = wrapHour(hour);

  for (let index = 0; index < stops.length - 1; index += 1) {
    const start = stops[index];
    const end = stops[index + 1];

    if (wrappedHour < start.hour || wrappedHour > end.hour) {
      continue;
    }

    const span = end.hour - start.hour || 1;
    const alpha = (wrappedHour - start.hour) / span;
    return { start, end, alpha };
  }

  return { start: stops[0], end: stops[1], alpha: 0 };
}

function sampleNumberStops(stops, hour) {
  const { start, end, alpha } = sampleStops(stops, hour);
  return THREE.MathUtils.lerp(start.value, end.value, alpha);
}

function sampleColorStops(stops, hour, target) {
  const { start, end, alpha } = sampleStops(stops, hour);
  target.set(start.value);
  return target.lerp(new THREE.Color(end.value), alpha);
}

function setShadowActive(light, isActive) {
  if (!light || light.castShadow === isActive) {
    return;
  }

  light.castShadow = isActive;
  light.shadow.needsUpdate = true;
}

function getDayPhase(hour) {
  if (hour < 5) {
    return "Night";
  }

  if (hour < 7) {
    return "Dawn";
  }

  if (hour < 11) {
    return "Morning";
  }

  if (hour < 16) {
    return "Midday";
  }

  if (hour < 19) {
    return "Sunset";
  }

  return "Night";
}

function createSunGroup() {
  const group = new THREE.Group();
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(SUN_DISC_SIZE * 1.8, 24, 24),
    new THREE.MeshBasicMaterial({
      color: "#fff4c6",
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      toneMapped: false
    })
  );
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(SUN_DISC_SIZE, 32, 32),
    new THREE.MeshBasicMaterial({
      color: "#fff7cf",
      depthWrite: false,
      toneMapped: false
    })
  );

  halo.layers.enable(SELECTIVE_BLOOM_LAYER);
  core.layers.enable(SELECTIVE_BLOOM_LAYER);
  group.add(halo);
  group.add(core);

  return { group, halo, core };
}

function createMoonGroup() {
  const group = new THREE.Group();
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(MOON_DISC_SIZE * 1.75, 24, 24),
    new THREE.MeshBasicMaterial({
      color: "#dce8ff",
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      toneMapped: false
    })
  );
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(MOON_DISC_SIZE, 32, 32),
    new THREE.MeshBasicMaterial({
      color: "#e9f0ff",
      depthWrite: false,
      toneMapped: false
    })
  );
  const craterMaterial = new THREE.MeshBasicMaterial({
    color: "#c4d0ea",
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    toneMapped: false
  });
  const craterA = new THREE.Mesh(new THREE.CircleGeometry(MOON_DISC_SIZE * 0.18, 18), craterMaterial);
  const craterB = new THREE.Mesh(new THREE.CircleGeometry(MOON_DISC_SIZE * 0.1, 18), craterMaterial);

  craterA.position.set(-MOON_DISC_SIZE * 0.16, MOON_DISC_SIZE * 0.12, MOON_DISC_SIZE * 0.92);
  craterB.position.set(MOON_DISC_SIZE * 0.2, -MOON_DISC_SIZE * 0.08, MOON_DISC_SIZE * 0.92);

  halo.layers.enable(SELECTIVE_BLOOM_LAYER);
  core.layers.enable(SELECTIVE_BLOOM_LAYER);
  craterA.layers.enable(SELECTIVE_BLOOM_LAYER);
  craterB.layers.enable(SELECTIVE_BLOOM_LAYER);
  group.add(halo);
  group.add(core);
  group.add(craterA);
  group.add(craterB);

  return { group, halo, core };
}

function createStarField() {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(STAR_COUNT * 3);
  const colors = new Float32Array(STAR_COUNT * 3);
  const colorChoices = ["#ffffff", "#d7e7ff", "#fff2d9", "#b7d0ff"];
  const color = new THREE.Color();

  for (let index = 0; index < STAR_COUNT; index += 1) {
    const theta = Math.random() * Math.PI * 2;
    const heightBias = Math.pow(Math.random(), 0.58);
    const y = THREE.MathUtils.lerp(-0.12, 0.98, heightBias);
    const radial = Math.sqrt(Math.max(0, 1 - y * y));
    const radius = STAR_FIELD_DISTANCE * THREE.MathUtils.lerp(0.84, 1.02, Math.random());
    const x = Math.cos(theta) * radial * radius;
    const z = Math.sin(theta) * radial * radius;

    positions[index * 3] = x;
    positions[index * 3 + 1] = y * radius;
    positions[index * 3 + 2] = z;

    color.set(colorChoices[Math.floor(Math.random() * colorChoices.length)]);
    color.multiplyScalar(THREE.MathUtils.lerp(0.72, 1.16, Math.random()));
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 2.2,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
    vertexColors: true,
    toneMapped: false
  });
  const points = new THREE.Points(geometry, material);

  points.layers.enable(SELECTIVE_BLOOM_LAYER);

  return { points, material };
}

export class TimeOfDayController {
  constructor({
    scene,
    renderer,
    camera,
    sunLight,
    moonLight,
    hemiLight,
    fairyLight,
    showGui = true
  }) {
    this.scene = scene;
    this.renderer = renderer;
    this.camera = camera;
    this.sunLight = sunLight;
    this.moonLight = moonLight;
    this.hemiLight = hemiLight;
    this.fairyLight = fairyLight;
    this.showGui = showGui;
    this.state = {
      autoCycle: true,
      hour: 8.5,
      dayLengthSeconds: 180,
      phase: "Morning"
    };
    this.skyColor = new THREE.Color();
    this.fogColor = new THREE.Color();
    this.hemiSkyColor = new THREE.Color();
    this.hemiGroundColor = new THREE.Color();
    this.sunColor = new THREE.Color();
    this.moonColor = new THREE.Color();
    this.focusPoint = new THREE.Vector3();
    this.sunDirection = new THREE.Vector3();
    this.moonDirection = new THREE.Vector3();
    this.sunOffset = new THREE.Vector3();
    this.moonOffset = new THREE.Vector3();
    this.sunDiscOffset = new THREE.Vector3();
    this.moonDiscOffset = new THREE.Vector3();
    this.elapsedTime = 0;

    const { group, halo, core } = createSunGroup();
    const moon = createMoonGroup();
    const stars = createStarField();
    this.sunGroup = group;
    this.sunHalo = halo;
    this.sunCore = core;
    this.moonGroup = moon.group;
    this.moonHalo = moon.halo;
    this.moonCore = moon.core;
    this.starField = stars.points;
    this.starMaterial = stars.material;

    this.scene.add(this.sunGroup);
    this.scene.add(this.moonGroup);
    this.scene.add(this.starField);
    this.scene.add(this.sunLight.target);
    this.scene.add(this.moonLight.target);

    if (this.showGui) {
      this.gui = new GUI({ autoPlace: false, title: "Time Of Day", width: 280 });
      this.gui.domElement.classList.add("time-gui");
      document.body.appendChild(this.gui.domElement);
      this.gui.add(this.state, "autoCycle").name("Auto Cycle");
      this.gui.add(this.state, "hour", 0, 24, 0.01).name("Hour").listen();
      this.gui.add(this.state, "dayLengthSeconds", 40, 480, 1).name("Day Length (s)");
      this.gui.add(this.state, "phase").name("Phase").listen().disable();
    } else {
      this.gui = null;
    }

    this.apply(this.camera.position, 0);
  }

  update(delta, cameraPosition, focusHeight = 0) {
    this.elapsedTime += delta;

    if (this.state.autoCycle) {
      this.state.hour = wrapHour(
        this.state.hour + (24 / Math.max(this.state.dayLengthSeconds, 1)) * delta
      );
    }

    this.apply(cameraPosition, focusHeight);
  }

  apply(cameraPosition, focusHeight = 0) {
    const hour = wrapHour(this.state.hour);
    const orbitalAngle = (hour / 24) * Math.PI * 2 - Math.PI * 0.5;
    const solarElevation = Math.sin(orbitalAngle);
    const daylight = THREE.MathUtils.smoothstep(solarElevation, -0.12, 0.28);
    const sunVisibility = THREE.MathUtils.smoothstep(solarElevation, -0.08, 0.12);
    const moonVisibility = THREE.MathUtils.smoothstep(-solarElevation, -0.08, 0.12);
    const starVisibility = THREE.MathUtils.smoothstep(-solarElevation, -0.02, 0.2);
    const twilightBoost = 1 - Math.min(1, Math.abs(solarElevation) * 2.2);

    this.state.phase = getDayPhase(hour);

    sampleColorStops(SKY_COLOR_STOPS, hour, this.skyColor);
    this.scene.background.copy(this.skyColor);

    if (this.scene.fog) {
      sampleColorStops(FOG_COLOR_STOPS, hour, this.fogColor);
      this.scene.fog.color.copy(this.fogColor);
      this.scene.fog.near = THREE.MathUtils.lerp(NIGHT_FOG_RANGE.near, DAY_FOG_RANGE.near, daylight);
      this.scene.fog.far = THREE.MathUtils.lerp(NIGHT_FOG_RANGE.far, DAY_FOG_RANGE.far, daylight);
    }

    sampleColorStops(HEMI_SKY_STOPS, hour, this.hemiSkyColor);
    sampleColorStops(HEMI_GROUND_STOPS, hour, this.hemiGroundColor);
    this.hemiLight.color.copy(this.hemiSkyColor);
    this.hemiLight.groundColor.copy(this.hemiGroundColor);
    this.hemiLight.intensity = THREE.MathUtils.lerp(0.16, 1.75, daylight) + twilightBoost * 0.08;

    sampleColorStops(SUN_COLOR_STOPS, hour, this.sunColor);
    sampleColorStops(MOON_COLOR_STOPS, hour, this.moonColor);
    this.sunLight.color.copy(this.sunColor);
    this.sunLight.intensity = THREE.MathUtils.lerp(0.04, 2.25, daylight);
    this.moonLight.color.copy(this.moonColor);
    this.moonLight.intensity = THREE.MathUtils.lerp(0, 0.52, moonVisibility);

    setShadowActive(this.sunLight, sunVisibility > SUN_SHADOW_VISIBILITY_THRESHOLD);
    setShadowActive(
      this.moonLight,
      moonVisibility > MOON_SHADOW_VISIBILITY_THRESHOLD && daylight < 0.28
    );
    this.sunLight.shadow.radius = THREE.MathUtils.lerp(5.2, 1.6, daylight);
    this.sunLight.shadow.normalBias = THREE.MathUtils.lerp(0.115, 0.04, daylight);
    this.sunLight.shadow.bias = THREE.MathUtils.lerp(-0.00008, -0.00022, daylight);
    this.moonLight.shadow.radius = 5.8;
    this.moonLight.shadow.normalBias = 0.09;
    this.moonLight.shadow.bias = -0.00006;

    this.renderer.toneMappingExposure = sampleNumberStops(EXPOSURE_STOPS, hour);
    this.fairyLight.intensity = sampleNumberStops(FAIRY_LIGHT_STOPS, hour);

    this.sunDirection.set(
      Math.cos(SUN_AZIMUTH) * Math.cos(orbitalAngle),
      Math.sin(orbitalAngle),
      Math.sin(SUN_AZIMUTH) * Math.cos(orbitalAngle)
    );
    this.moonDirection.copy(this.sunDirection).multiplyScalar(-1);

    this.focusPoint.set(cameraPosition.x, focusHeight + 8, cameraPosition.z);
    this.sunOffset.copy(this.sunDirection).multiplyScalar(SUN_ORBIT_RADIUS);
    this.sunLight.position.copy(this.focusPoint).add(this.sunOffset);
    this.sunLight.target.position.copy(this.focusPoint);
    this.sunLight.target.updateMatrixWorld();

    this.moonOffset.copy(this.moonDirection).multiplyScalar(SUN_ORBIT_RADIUS);
    this.moonLight.position.copy(this.focusPoint).add(this.moonOffset);
    this.moonLight.target.position.copy(this.focusPoint);
    this.moonLight.target.updateMatrixWorld();

    this.sunDiscOffset.copy(this.sunDirection).multiplyScalar(SUN_DISC_DISTANCE);
    this.sunGroup.position.copy(cameraPosition).add(this.sunDiscOffset);
    this.sunGroup.visible = sunVisibility > 0.01;

    this.sunCore.material.color.copy(this.sunColor).multiplyScalar(0.8 + sunVisibility * 0.8);
    this.sunHalo.material.color.copy(this.sunColor).multiplyScalar(0.65 + sunVisibility * 0.7);
    this.sunCore.scale.setScalar(THREE.MathUtils.lerp(0.88, 1.14, 1 - daylight));
    this.sunHalo.scale.setScalar(THREE.MathUtils.lerp(1.2, 1.8, sunVisibility));
    this.sunHalo.material.opacity = THREE.MathUtils.lerp(0.05, 0.28, sunVisibility);

    this.moonDiscOffset.copy(this.moonDirection).multiplyScalar(MOON_DISC_DISTANCE);
    this.moonGroup.position.copy(cameraPosition).add(this.moonDiscOffset);
    this.moonGroup.visible = moonVisibility > 0.01;
    this.moonCore.material.color
      .copy(this.moonColor)
      .multiplyScalar(0.7 + moonVisibility * 0.75 + twilightBoost * 0.1);
    this.moonHalo.material.color.copy(this.moonColor).multiplyScalar(0.7 + moonVisibility * 0.45);
    this.moonCore.scale.setScalar(THREE.MathUtils.lerp(0.92, 1.06, moonVisibility));
    this.moonHalo.scale.setScalar(THREE.MathUtils.lerp(1.05, 1.55, moonVisibility));
    this.moonHalo.material.opacity = THREE.MathUtils.lerp(0.02, 0.16, moonVisibility);

    this.starField.position.copy(cameraPosition);
    this.starField.rotation.y = hour / 24 * Math.PI * 2 * 0.3 + this.elapsedTime * 0.006;
    this.starField.rotation.x = -0.12 + Math.sin(hour / 24 * Math.PI * 2) * 0.08;
    this.starField.visible = starVisibility > 0.01;
    this.starMaterial.opacity =
      starVisibility * THREE.MathUtils.lerp(0.72, 1, 0.5 + Math.sin(this.elapsedTime * 0.35) * 0.5);
  }
}
