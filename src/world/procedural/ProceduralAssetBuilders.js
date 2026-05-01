import * as THREE from "three";
import { SELECTIVE_BLOOM_LAYER } from "../../rendering/bloom.js";
import {
  createBranchMatrix,
  createProceduralInstance,
  createTransformMatrix,
  enableBloom,
  randomBetween,
  randomChoice
} from "./ProceduralInstancing.js";
import { getSplatMapAt } from "./ProceduralFields.js";

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const TEMP_START = new THREE.Vector3();
const TEMP_END = new THREE.Vector3();

const BARK_COLORS = ["#4d3526", "#5f432d", "#6e5138", "#3f3026"];
const MOSS_COLORS = ["#446f2b", "#5f8d32", "#7aa144", "#355629"];
const LEAF_COLORS = ["#5f8d3d", "#739f4c", "#86b75c", "#3f6f38", "#a8c86f"];
const SHADOW_LEAF_COLORS = ["#263f2a", "#314f30", "#3e6136", "#233721"];
const MUSHROOM_CAP_COLORS = ["#d95c46", "#f08a4b", "#c94a62", "#f2b35f"];

function addInstance(instances, kind, matrix, color) {
  const instance = createProceduralInstance(kind, matrix, color);

  if (instance) {
    instances.push(instance);
  }
}

function addBranch(instances, start, end, radiusStart, radiusEnd, color) {
  addInstance(instances, "branch", createBranchMatrix(start, end, radiusStart, radiusEnd), color);
}

function addTrunkSegment(instances, start, end, radiusStart, radiusEnd, color) {
  addInstance(instances, "bark", createBranchMatrix(start, end, radiusStart, radiusEnd), color);
}

function addLeafBlob(instances, rng, position, scale, color, rotationOffset = 0) {
  addInstance(
    instances,
    "leafBlob",
    createTransformMatrix({
      position: [position.x, position.y, position.z],
      rotation: [
        randomBetween(rng, -0.25, 0.25),
        rng() * Math.PI * 2 + rotationOffset,
        randomBetween(rng, -0.25, 0.25)
      ],
      scale
    }),
    color
  );
}

function addHangingVines(instances, rng, anchor, count, lengthScale = 1) {
  for (let index = 0; index < count; index += 1) {
    const offset = new THREE.Vector3(
      randomBetween(rng, -0.6, 0.6),
      randomBetween(rng, -0.2, 0.2),
      randomBetween(rng, -0.6, 0.6)
    );
    const start = anchor.clone().add(offset);
    const length = randomBetween(rng, 1.0, 3.4) * lengthScale;
    const bend = new THREE.Vector3(
      randomBetween(rng, -0.35, 0.35),
      -length,
      randomBetween(rng, -0.35, 0.35)
    );
    const end = start.clone().add(bend);

    addInstance(
      instances,
      "vine",
      createBranchMatrix(start, end, randomBetween(rng, 0.012, 0.026)),
      randomChoice(rng, MOSS_COLORS)
    );
  }
}

function buildBranchyTree({ rng, mood = "elder" }) {
  const instances = [];
  const height = mood === "conifer" ? randomBetween(rng, 10, 16) : randomBetween(rng, 7, 12);
  const baseRadius = mood === "elder" ? randomBetween(rng, 0.55, 1.05) : randomBetween(rng, 0.32, 0.58);
  const barkColor = randomChoice(rng, BARK_COLORS);
  const trunkPoints = [new THREE.Vector3(0, 0, 0)];
  const segmentCount = mood === "elder" ? 4 : 3;

  for (let index = 1; index <= segmentCount; index += 1) {
    const t = index / segmentCount;
    const wander = mood === "elder" ? 0.55 : 0.18;
    trunkPoints.push(
      new THREE.Vector3(
        randomBetween(rng, -wander, wander) * t,
        height * t,
        randomBetween(rng, -wander, wander) * t
      )
    );
  }

  for (let index = 0; index < trunkPoints.length - 1; index += 1) {
    const t0 = index / segmentCount;
    const t1 = (index + 1) / segmentCount;
    addTrunkSegment(
      instances,
      trunkPoints[index],
      trunkPoints[index + 1],
      THREE.MathUtils.lerp(baseRadius, baseRadius * 0.34, t0),
      THREE.MathUtils.lerp(baseRadius, baseRadius * 0.22, t1),
      barkColor
    );
  }

  const branchCount = mood === "conifer" ? 9 + Math.floor(rng() * 4) : 7 + Math.floor(rng() * 5);

  for (let index = 0; index < branchCount; index += 1) {
    const t = randomBetween(rng, mood === "conifer" ? 0.18 : 0.28, 0.94);
    const trunkIndex = Math.min(trunkPoints.length - 2, Math.floor(t * segmentCount));
    const localT = t * segmentCount - trunkIndex;
    const start = trunkPoints[trunkIndex].clone().lerp(trunkPoints[trunkIndex + 1], localT);
    const angle = rng() * Math.PI * 2;
    const out = new THREE.Vector3(Math.cos(angle), randomBetween(rng, 0.04, 0.36), Math.sin(angle));
    const length = randomBetween(rng, mood === "conifer" ? 2.2 : 2.8, mood === "conifer" ? 4.4 : 6.4);
    const mid = start.clone().add(out.clone().multiplyScalar(length * 0.52));
    mid.y += randomBetween(rng, -0.35, 0.75);
    const end = mid.clone().add(out.clone().multiplyScalar(length * 0.48));
    end.y += randomBetween(rng, -0.45, 0.95);
    const radius = THREE.MathUtils.lerp(baseRadius * 0.24, baseRadius * 0.08, t);

    addBranch(instances, start, mid, radius, radius * 0.72, barkColor);
    addBranch(instances, mid, end, radius * 0.72, radius * 0.28, barkColor);

    const leafCount = mood === "conifer" ? 3 : 4 + Math.floor(rng() * 3);

    for (let leafIndex = 0; leafIndex < leafCount; leafIndex += 1) {
      const leafPosition = end.clone().add(
        new THREE.Vector3(
          randomBetween(rng, -1.0, 1.0),
          randomBetween(rng, -0.35, 0.7),
          randomBetween(rng, -1.0, 1.0)
        )
      );
      const scalar = randomBetween(rng, mood === "conifer" ? 0.7 : 0.9, mood === "conifer" ? 1.35 : 1.9);
      const colorPool = rng() > 0.22 ? LEAF_COLORS : SHADOW_LEAF_COLORS;

      addLeafBlob(
        instances,
        rng,
        leafPosition,
        [
          scalar * randomBetween(rng, 0.7, 1.35),
          scalar * randomBetween(rng, mood === "conifer" ? 1.15 : 0.55, mood === "conifer" ? 2.4 : 1.2),
          scalar * randomBetween(rng, 0.7, 1.35)
        ],
        randomChoice(rng, colorPool),
        angle
      );
    }

    if (mood === "elder" && rng() > 0.45) {
      addHangingVines(instances, rng, end, 1 + Math.floor(rng() * 3));
    }
  }

  if (mood === "conifer") {
    const crownCount = 5 + Math.floor(rng() * 4);

    for (let index = 0; index < crownCount; index += 1) {
      const y = height * THREE.MathUtils.lerp(0.38, 0.94, index / Math.max(crownCount - 1, 1));
      const radius = THREE.MathUtils.lerp(2.6, 0.8, index / crownCount);
      addLeafBlob(
        instances,
        rng,
        new THREE.Vector3(randomBetween(rng, -0.35, 0.35), y, randomBetween(rng, -0.35, 0.35)),
        [radius, randomBetween(rng, 0.7, 1.25), radius],
        randomChoice(rng, SHADOW_LEAF_COLORS)
      );
    }
  }

  return { instances, baseRadius, height };
}

function addBeechFernsAtTreeFeet(built, {
  rng,
  assetContext,
  seed,
  placement,
  lodFactor = 1,
  mood = "elder"
}) {
  const fernLibrary = assetContext?.procedural?.ferns;

  if (!fernLibrary || !placement || seed === undefined || seed === null) {
    return built;
  }

  const splat = getSplatMapAt(placement.worldX, placement.worldZ, seed);

  if (splat.white < 0.5 || rng() > (mood === "conifer" ? 0.72 : 0.92)) {
    return built;
  }

  const fernInstances = fernLibrary.createUnderstoryInstances(rng, {
    lodFactor,
    trunkRadius: built.baseRadius ?? 0.72,
    countRange: mood === "conifer" ? [1, 4] : [2, 6],
    radiusRange: mood === "conifer" ? [1.0, 2.7] : [1.15, 3.8],
    scaleRange: mood === "conifer" ? [0.74, 1.12] : [0.86, 1.36]
  });

  if (fernInstances) {
    built.instances.push(...fernInstances);
  }

  return built;
}

function buildMushroomBloom({ rng }) {
  const instances = [];
  const count = 3 + Math.floor(rng() * 5);

  for (let index = 0; index < count; index += 1) {
    const angle = rng() * Math.PI * 2;
    const radius = Math.sqrt(rng()) * 0.9;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const height = randomBetween(rng, 0.35, 1.15);
    const capRadius = randomBetween(rng, 0.24, 0.62);

    addInstance(
      instances,
      "mushroomStem",
      createTransformMatrix({
        position: [x, height * 0.5, z],
        rotation: [randomBetween(rng, -0.12, 0.12), 0, randomBetween(rng, -0.12, 0.12)],
        scale: [capRadius * 0.2, height, capRadius * 0.2]
      }),
      randomChoice(rng, ["#eadfc2", "#f3e8ca", "#d8cba8"])
    );
    addInstance(
      instances,
      "mushroomCap",
      createTransformMatrix({
        position: [x, height + capRadius * 0.12, z],
        rotation: [0, rng() * Math.PI * 2, 0],
        scale: [capRadius, randomBetween(rng, 0.08, 0.18), capRadius]
      }),
      randomChoice(rng, MUSHROOM_CAP_COLORS)
    );
  }

  return { instances };
}

function buildRootArch({ rng }) {
  const instances = [];
  const barkColor = randomChoice(rng, BARK_COLORS);
  const width = randomBetween(rng, 2.1, 3.2);
  const height = randomBetween(rng, 3.4, 4.8);
  const radius = randomBetween(rng, 0.16, 0.28);
  const points = [
    new THREE.Vector3(-width * 0.5, 0, 0),
    new THREE.Vector3(-width * 0.46, height * 0.52, 0.05),
    new THREE.Vector3(0, height, randomBetween(rng, -0.08, 0.08)),
    new THREE.Vector3(width * 0.46, height * 0.52, -0.05),
    new THREE.Vector3(width * 0.5, 0, 0)
  ];

  for (let index = 0; index < points.length - 1; index += 1) {
    addBranch(instances, points[index], points[index + 1], radius, radius * 0.9, barkColor);
  }

  addInstance(
    instances,
    "glowOrb",
    createTransformMatrix({
      position: [0, height * 0.62, 0],
      scale: [0.18, 0.18, 0.18]
    }),
    randomChoice(rng, ["#fff5aa", "#d6fff2", "#f6c7ff"])
  );

  return { instances };
}

function buildGlowWisp({ rng }) {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({
    color: "#fff3a6",
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    toneMapped: false
  });
  const geometry = new THREE.SphereGeometry(1, 10, 8);
  const wisps = [];
  const count = 5 + Math.floor(rng() * 6);

  for (let index = 0; index < count; index += 1) {
    const mesh = new THREE.Mesh(geometry, material);
    const color = new THREE.Color(randomChoice(rng, ["#fff4a8", "#d6fff4", "#ffc9f4", "#cde4ff"]));
    const anchor = new THREE.Vector3(
      randomBetween(rng, -1.6, 1.6),
      randomBetween(rng, 0.6, 3.2),
      randomBetween(rng, -1.6, 1.6)
    );

    mesh.material = material.clone();
    mesh.material.color.copy(color);
    mesh.scale.setScalar(randomBetween(rng, 0.035, 0.09));
    mesh.position.copy(anchor);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.layers.enable(SELECTIVE_BLOOM_LAYER);
    group.add(mesh);
    wisps.push({
      mesh,
      anchor,
      phase: rng() * Math.PI * 2,
      speed: randomBetween(rng, 0.42, 0.86),
      radius: randomBetween(rng, 0.12, 0.48)
    });
  }

  enableBloom(group);

  return {
    object: group,
    update(elapsedTime) {
      for (const wisp of wisps) {
        wisp.mesh.position.set(
          wisp.anchor.x + Math.cos(elapsedTime * wisp.speed + wisp.phase) * wisp.radius,
          wisp.anchor.y + Math.sin(elapsedTime * wisp.speed * 1.4 + wisp.phase) * 0.28,
          wisp.anchor.z + Math.sin(elapsedTime * wisp.speed + wisp.phase) * wisp.radius
        );
      }
    }
  };
}

function buildSapling({ rng }) {
  const instances = [];
  const height = randomBetween(rng, 1.3, 2.6);
  const barkColor = randomChoice(rng, BARK_COLORS);

  TEMP_START.set(0, 0, 0);
  TEMP_END.set(randomBetween(rng, -0.18, 0.18), height, randomBetween(rng, -0.18, 0.18));
  addTrunkSegment(instances, TEMP_START, TEMP_END, 0.08, 0.035, barkColor);

  for (let index = 0; index < 5; index += 1) {
    const angle = (index / 5) * Math.PI * 2 + rng() * 0.4;
    const start = TEMP_END.clone().multiplyScalar(randomBetween(rng, 0.55, 0.9));
    const end = start.clone().add(
      new THREE.Vector3(Math.cos(angle) * randomBetween(rng, 0.45, 0.85), randomBetween(rng, 0.15, 0.55), Math.sin(angle) * randomBetween(rng, 0.45, 0.85))
    );
    addBranch(instances, start, end, 0.035, 0.016, barkColor);
    addLeafBlob(
      instances,
      rng,
      end,
      [randomBetween(rng, 0.38, 0.72), randomBetween(rng, 0.26, 0.55), randomBetween(rng, 0.38, 0.72)],
      randomChoice(rng, LEAF_COLORS)
    );
  }

  return { instances };
}

export const PROCEDURAL_ASSET_BUILDERS = {
  elderTree({ rng, assetContext, seed, placement, lodFactor }) {
    const modelTree = assetContext?.procedural?.trees?.createTreeInstances?.(rng, {
      scaleRange: [0.7, 1.3],
      yScaleRange: [0.9, 1.1],
      includeSaplings: true,
      fernLibrary: assetContext?.procedural?.ferns,
      lodFactor
    });

    return modelTree
      ? addBeechFernsAtTreeFeet(modelTree, {
        rng,
        assetContext,
        seed,
        placement,
        lodFactor,
        mood: "elder"
      })
      : null;
  },
  canopyTree({ rng, assetContext, seed, placement, lodFactor }) {
    const mood = rng() > 0.5 ? "elder" : "conifer";
    const modelTree = assetContext?.procedural?.trees?.createTreeInstances?.(rng, {
      scaleRange: [0.66, 1.22],
      yScaleRange: [0.9, 1.12],
      includeSaplings: true,
      fernLibrary: assetContext?.procedural?.ferns,
      lodFactor
    });

    return modelTree
      ? addBeechFernsAtTreeFeet(modelTree, {
        rng,
        assetContext,
        seed,
        placement,
        lodFactor,
        mood
      })
      : null;
  },
  slenderTree({ rng, assetContext, seed, placement, lodFactor }) {
    const modelTree = assetContext?.procedural?.trees?.createTreeInstances?.(rng, {
      scaleRange: [0.58, 1.06],
      yScaleRange: [1.0, 1.24],
      includeSaplings: true,
      fernLibrary: assetContext?.procedural?.ferns,
      lodFactor
    });

    return modelTree
      ? addBeechFernsAtTreeFeet(modelTree, {
        rng,
        assetContext,
        seed,
        placement,
        lodFactor,
        mood: "conifer"
      })
      : null;
  },
  sapling({ rng, assetContext, lodFactor }) {
    const fernInstances = assetContext?.procedural?.ferns?.createPatchInstances?.(rng, {
      lodFactor,
      countRange: [2, 5],
      radiusRange: [0.5, 1.8],
      scaleRange: [0.76, 1.18]
    });

    return fernInstances ? { instances: fernInstances } : null;
  },
  fernPatch({ rng, assetContext, lodFactor }) {
    const modelInstances = assetContext?.procedural?.ferns?.createPatchInstances?.(rng, {
      lodFactor,
      countRange: [1, 3],
      radiusRange: [0.24, 1.12],
      scaleRange: [0.74, 1.16]
    });

    if (modelInstances) {
      return { instances: modelInstances };
    }

    return null;
  },
  flowerSpray({ rng, assetContext, lodFactor }) {
    const modelInstances = assetContext?.procedural?.flowers?.createPatchInstances?.(rng, {
      lodFactor,
      countRange: [2, 5],
      radiusRange: [0.22, 0.95],
      scaleRange: [0.78, 1.22],
      tilt: 0.08
    });

    if (modelInstances) {
      return { instances: modelInstances };
    }

    return null;
  },
  mushroomBloom({ rng, assetContext }) {
    const modelInstances = assetContext?.procedural?.mushrooms?.createPatchInstances?.(rng);

    if (modelInstances) {
      return { instances: modelInstances };
    }

    return buildMushroomBloom({ rng });
  },
  crystalBloom({ rng, assetContext }) {
    const modelInstances = assetContext?.procedural?.crystals?.createPatchInstances?.(rng, {
      countRange: [2, 5],
      radiusRange: [0.34, 1.18],
      scaleRange: [0.62, 1.26],
      tilt: 0.16
    });

    return modelInstances ? { instances: modelInstances } : null;
  },
  rootArch({ rng }) {
    return buildRootArch({ rng });
  },
  glowWisp({ rng }) {
    return buildGlowWisp({ rng });
  }
};
