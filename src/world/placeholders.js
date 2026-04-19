import * as THREE from "three";
import { SELECTIVE_BLOOM_LAYER } from "../rendering/bloom.js";

const trunkMaterial = new THREE.MeshStandardMaterial({ color: "#846245", roughness: 0.95 });
const darkTrunkMaterial = new THREE.MeshStandardMaterial({ color: "#5f493f", roughness: 1 });
const rockMaterial = new THREE.MeshStandardMaterial({ color: "#a3a6a4", roughness: 1 });
const paleRockMaterial = new THREE.MeshStandardMaterial({ color: "#beced3", roughness: 1 });
const lanternMaterial = new THREE.MeshStandardMaterial({
  color: "#f6f0bd",
  emissive: "#f6f0bd",
  emissiveIntensity: 0.7,
  roughness: 0.45
});

const sphereGeometry = new THREE.SphereGeometry(1, 18, 16);
const coneGeometry = new THREE.ConeGeometry(1, 1, 7);
const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 12);
const octaGeometry = new THREE.OctahedronGeometry(1, 0);
const dodecaGeometry = new THREE.DodecahedronGeometry(1, 0);

function randomBetween(rng, min, max) {
  return min + (max - min) * rng();
}

function createMesh(geometry, material) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createPlantMaterial(color, emissive = null, emissiveIntensity = 0) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: emissive ?? color,
    emissiveIntensity,
    roughness: 0.9
  });
}

function buildRoundedTree({ rng, canopyColor, trunk = trunkMaterial, twist = 0.1 }) {
  const group = new THREE.Group();
  const trunkMesh = createMesh(cylinderGeometry, trunk);
  trunkMesh.scale.set(0.25, randomBetween(rng, 1.7, 2.5), 0.25);
  trunkMesh.position.y = trunkMesh.scale.y * 0.5;
  trunkMesh.rotation.z = randomBetween(rng, -twist, twist);
  trunkMesh.rotation.x = randomBetween(rng, -twist * 0.7, twist * 0.7);
  group.add(trunkMesh);

  const canopyMaterial = createPlantMaterial(canopyColor);
  const canopyCount = 3 + Math.floor(rng() * 3);

  for (let index = 0; index < canopyCount; index += 1) {
    const canopy = createMesh(sphereGeometry, canopyMaterial);
    canopy.scale.setScalar(randomBetween(rng, 0.65, 1.05));
    canopy.position.set(
      randomBetween(rng, -0.65, 0.65),
      trunkMesh.scale.y + randomBetween(rng, 0.45, 1.5),
      randomBetween(rng, -0.65, 0.65)
    );
    group.add(canopy);
  }

  return { object: group };
}

function buildTreeModel({ assetContext, treeKey, fallback }) {
  const builtTreeInstances = assetContext?.trees?.createTreeInstances?.(treeKey);

  if (builtTreeInstances) {
    return { instances: builtTreeInstances };
  }

  const builtTree = assetContext?.trees?.createTree?.(treeKey);

  if (builtTree) {
    return builtTree;
  }

  return fallback();
}

function buildRockCluster({ rng, material = rockMaterial }) {
  const group = new THREE.Group();
  const rockCount = 2 + Math.floor(rng() * 3);

  for (let index = 0; index < rockCount; index += 1) {
    const geometry = index % 2 === 0 ? dodecaGeometry : octaGeometry;
    const rock = createMesh(geometry, material);
    rock.scale.set(
      randomBetween(rng, 0.35, 0.8),
      randomBetween(rng, 0.25, 0.65),
      randomBetween(rng, 0.3, 0.75)
    );
    rock.position.set(
      randomBetween(rng, -0.85, 0.85),
      rock.scale.y * 0.45,
      randomBetween(rng, -0.85, 0.85)
    );
    rock.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
    group.add(rock);
  }

  return { object: group };
}

function buildGrassTuft({ rng, colors }) {
  const group = new THREE.Group();
  const bladeMaterial = createPlantMaterial(colors[0]);
  const bladeCount = 4 + Math.floor(rng() * 4);

  for (let index = 0; index < bladeCount; index += 1) {
    const blade = createMesh(coneGeometry, bladeMaterial);
    blade.scale.set(0.08, randomBetween(rng, 0.45, 1), 0.08);
    blade.position.set(
      randomBetween(rng, -0.2, 0.2),
      blade.scale.y * 0.5,
      randomBetween(rng, -0.2, 0.2)
    );
    blade.rotation.z = randomBetween(rng, -0.3, 0.3);
    blade.rotation.x = randomBetween(rng, -0.25, 0.25);
    group.add(blade);
  }

  return { object: group };
}

function buildFlowerPatch({ rng, stemColor, bloomColors }) {
  const group = new THREE.Group();
  const stemMaterial = createPlantMaterial(stemColor);
  const blossomCount = 3 + Math.floor(rng() * 4);

  for (let index = 0; index < blossomCount; index += 1) {
    const stem = createMesh(cylinderGeometry, stemMaterial);
    stem.scale.set(0.03, randomBetween(rng, 0.35, 0.7), 0.03);
    stem.position.set(
      randomBetween(rng, -0.35, 0.35),
      stem.scale.y * 0.5,
      randomBetween(rng, -0.35, 0.35)
    );
    group.add(stem);

    const blossom = createMesh(
      sphereGeometry,
      createPlantMaterial(
        bloomColors[Math.floor(rng() * bloomColors.length)],
        bloomColors[Math.floor(rng() * bloomColors.length)],
        0.08
      )
    );
    blossom.scale.setScalar(randomBetween(rng, 0.1, 0.18));
    blossom.position.copy(stem.position);
    blossom.position.y = stem.scale.y + randomBetween(rng, 0.02, 0.08);
    group.add(blossom);
  }

  return { object: group };
}

function buildBush({ rng, leafColor, assetContext, biomeKey }) {
  const builtBushInstances =
    biomeKey === "meadow" || biomeKey === "village"
      ? assetContext?.medow?.bushes?.createBushInstances?.(rng)
      : null;

  if (builtBushInstances) {
    return { instances: builtBushInstances };
  }

  const builtBush =
    biomeKey === "meadow" || biomeKey === "village"
      ? assetContext?.medow?.bushes?.createBush(rng)
      : null;

  if (builtBush) {
    return builtBush;
  }

  const group = new THREE.Group();
  const bushMaterial = createPlantMaterial(leafColor);
  const blobCount = 3 + Math.floor(rng() * 3);

  for (let index = 0; index < blobCount; index += 1) {
    const blob = createMesh(sphereGeometry, bushMaterial);
    blob.scale.setScalar(randomBetween(rng, 0.28, 0.55));
    blob.position.set(
      randomBetween(rng, -0.3, 0.3),
      randomBetween(rng, 0.18, 0.45),
      randomBetween(rng, -0.3, 0.3)
    );
    group.add(blob);
  }

  return { object: group };
}

function buildLantern({ rng, glowColor }) {
  const group = new THREE.Group();
  const post = createMesh(cylinderGeometry, trunkMaterial);
  post.scale.set(0.06, 0.8, 0.06);
  post.position.y = 0.4;
  group.add(post);

  const bulb = createMesh(
    sphereGeometry,
    new THREE.MeshStandardMaterial({
      color: glowColor,
      emissive: glowColor,
      emissiveIntensity: 1.3,
      roughness: 0.3
    })
  );
  bulb.scale.setScalar(randomBetween(rng, 0.18, 0.24));
  bulb.position.set(0, 0.95, 0);
  group.add(bulb);

  return { object: group };
}

function buildFireflyCluster({
  rng,
  glowColor,
  spread = 2.2,
  speed = 0.6,
  emissiveIntensity = 1.2,
  bloomLayer = null
}) {
  const group = new THREE.Group();
  const flies = [];
  const material = new THREE.MeshStandardMaterial({
    color: glowColor,
    emissive: glowColor,
    emissiveIntensity,
    roughness: 0.4
  });
  const count = 5 + Math.floor(rng() * 4);

  for (let index = 0; index < count; index += 1) {
    const firefly = createMesh(sphereGeometry, material);
    firefly.castShadow = false;
    firefly.receiveShadow = false;
    firefly.scale.setScalar(randomBetween(rng, 0.01, 0.05));

    if (bloomLayer !== null) {
      firefly.layers.enable(bloomLayer);
    }

    const anchor = new THREE.Vector3(
      randomBetween(rng, -spread, spread),
      randomBetween(rng, 0.5, 2.4),
      randomBetween(rng, -spread, spread)
    );
    firefly.position.copy(anchor);
    group.add(firefly);
    flies.push({
      mesh: firefly,
      anchor,
      phase: rng() * Math.PI * 2,
      radius: randomBetween(rng, 0.15, 0.45)
    });
  }

  return {
    object: group,
    update(elapsedTime) {
      for (const firefly of flies) {
        firefly.mesh.position.x =
          firefly.anchor.x + Math.cos(elapsedTime * speed + firefly.phase) * firefly.radius;
        firefly.mesh.position.y =
          firefly.anchor.y + Math.sin(elapsedTime * speed * 1.5 + firefly.phase) * 0.18;
        firefly.mesh.position.z =
          firefly.anchor.z + Math.sin(elapsedTime * speed + firefly.phase) * firefly.radius;
      }
    }
  };
}

function buildMushroom({ rng, stemColor, capColor, glowColor = null }) {
  const group = new THREE.Group();
  const stem = createMesh(
    cylinderGeometry,
    createPlantMaterial(stemColor, stemColor, 0.02)
  );
  stem.scale.set(0.12, randomBetween(rng, 0.45, 1.2), 0.12);
  stem.position.y = stem.scale.y * 0.5;
  group.add(stem);

  const capMaterial = createPlantMaterial(
    capColor,
    glowColor ?? capColor,
    glowColor ? 0.4 : 0.08
  );
  const cap = createMesh(sphereGeometry, capMaterial);
  cap.scale.set(
    randomBetween(rng, 0.35, 0.8),
    randomBetween(rng, 0.16, 0.28),
    randomBetween(rng, 0.35, 0.8)
  );
  cap.position.y = stem.scale.y + randomBetween(rng, 0.1, 0.22);
  group.add(cap);

  return { object: group };
}

function buildToadstoolRing({ rng }) {
  const group = new THREE.Group();
  const count = 5 + Math.floor(rng() * 4);
  const radius = randomBetween(rng, 0.55, 0.95);

  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2;
    const mushroom = buildMushroom({
      rng,
      stemColor: "#f4e7bf",
      capColor: rng() > 0.5 ? "#ff6cab" : "#ffbf59",
      glowColor: "#ffe7a8"
    }).object;
    mushroom.scale.setScalar(randomBetween(rng, 0.45, 0.8));
    mushroom.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    group.add(mushroom);
  }

  return { object: group };
}

function buildStump({ rng }) {
  const group = new THREE.Group();
  const stump = createMesh(cylinderGeometry, darkTrunkMaterial);
  stump.scale.set(
    randomBetween(rng, 0.35, 0.55),
    randomBetween(rng, 0.18, 0.35),
    randomBetween(rng, 0.35, 0.55)
  );
  stump.position.y = stump.scale.y * 0.5;
  group.add(stump);

  const ring = createMesh(
    cylinderGeometry,
    new THREE.MeshStandardMaterial({ color: "#c9a078", roughness: 0.9 })
  );
  ring.scale.set(stump.scale.x * 0.92, 0.03, stump.scale.z * 0.92);
  ring.position.y = stump.scale.y;
  group.add(ring);

  return { object: group };
}

function buildCrystalCluster({ rng, crystalColor }) {
  const group = new THREE.Group();
  const crystalMaterial = new THREE.MeshStandardMaterial({
    color: crystalColor,
    emissive: crystalColor,
    emissiveIntensity: 0.35,
    metalness: 0.12,
    roughness: 0.25
  });
  const count = 3 + Math.floor(rng() * 4);

  for (let index = 0; index < count; index += 1) {
    const crystal = createMesh(octaGeometry, crystalMaterial);
    crystal.scale.set(
      randomBetween(rng, 0.18, 0.45),
      randomBetween(rng, 0.6, 1.7),
      randomBetween(rng, 0.18, 0.45)
    );
    crystal.position.set(
      randomBetween(rng, -0.55, 0.55),
      crystal.scale.y * 0.5,
      randomBetween(rng, -0.55, 0.55)
    );
    crystal.rotation.y = rng() * Math.PI;
    group.add(crystal);
  }

  return { object: group };
}

function buildGlowBloom({ rng, glowColor }) {
  const group = new THREE.Group();
  const stem = createMesh(cylinderGeometry, createPlantMaterial("#7f9b67"));
  stem.scale.set(0.04, randomBetween(rng, 0.3, 0.55), 0.04);
  stem.position.y = stem.scale.y * 0.5;
  group.add(stem);

  const bloom = createMesh(
    sphereGeometry,
    createPlantMaterial(glowColor, glowColor, 0.65)
  );
  bloom.scale.set(0.18, 0.18, 0.18);
  bloom.position.y = stem.scale.y + 0.08;
  group.add(bloom);

  return { object: group };
}

function buildWispCluster({ rng, glowColor }) {
  return buildFireflyCluster({ rng, glowColor, spread: 1.4, speed: 0.4 });
}

export const PLACEHOLDER_BUILDERS = {
  fairyTree({ rng, assetContext }) {
    return buildTreeModel({
      assetContext,
      treeKey: "fairyTree",
      fallback: () => buildRoundedTree({ rng, canopyColor: "#6dbf65", twist: 0.08 })
    });
  },
  twistedTree({ rng, assetContext }) {
    return buildTreeModel({
      assetContext,
      treeKey: "twistedTree",
      fallback: () =>
        buildRoundedTree({
          rng,
          canopyColor: rng() > 0.5 ? "#799a51" : "#9061aa",
          trunk: darkTrunkMaterial,
          twist: 0.35
        })
    });
  },
  silverTree({ rng, assetContext }) {
    return buildTreeModel({
      assetContext,
      treeKey: "silverTree",
      fallback: () => buildRoundedTree({ rng, canopyColor: "#bfe6e0", twist: 0.16 })
    });
  },
  rockCluster({ rng, biomeKey }) {
    return buildRockCluster({
      rng,
      material: biomeKey === "crystal" ? paleRockMaterial : rockMaterial
    });
  },
  grassTuft({ rng }) {
    return buildGrassTuft({ rng, colors: ["#79c458", "#9ee06e"] });
  },
  flowerPatch({ rng, assetContext, biomeKey, placement, seed }) {
    const builtFlowerInstances =
      biomeKey === "meadow" || biomeKey === "village"
        ? assetContext?.medow?.flowers?.createFlowerInstances?.(rng, {
            worldX: placement?.worldX,
            worldZ: placement?.worldZ,
            seed
          })
        : null;

    if (builtFlowerInstances) {
      return { instances: builtFlowerInstances };
    }

    const builtFlower =
      biomeKey === "meadow" || biomeKey === "village"
        ? assetContext?.medow?.flowers?.createFlower(rng, {
            worldX: placement?.worldX,
            worldZ: placement?.worldZ,
            seed
          })
        : null;

    if (builtFlower) {
      return builtFlower;
    }

    return buildFlowerPatch({
      rng,
      stemColor: "#68944c",
      bloomColors: ["#ffd670", "#fda9ff", "#fff1b5"]
    });
  },
  bush({ rng, assetContext, biomeKey }) {
    return buildBush({ rng, leafColor: "#6db569", assetContext, biomeKey });
  },
  lantern({ rng, biome }) {
    return buildLantern({ rng, glowColor: biome.accentColor });
  },
  fireflyCluster({ rng, biome, biomeKey }) {
    return buildFireflyCluster({
      rng,
      glowColor: biome.accentColor,
      emissiveIntensity:
        biomeKey === "meadow" || biomeKey === "village" ? 2.6 : 1.2,
      bloomLayer:
        biomeKey === "meadow" || biomeKey === "village" ? SELECTIVE_BLOOM_LAYER : null
    });
  },
  giantMushroom({ rng, assetContext, biomeKey }) {
    const builtMushroomInstances =
      biomeKey === "mushrooms"
        ? assetContext?.mushroom?.models?.createSingleMushroomInstances?.(rng)
        : null;

    if (builtMushroomInstances) {
      return { instances: builtMushroomInstances };
    }

    const builtMushroom =
      biomeKey === "mushrooms" ? assetContext?.mushroom?.models?.createSingleMushroom(rng) : null;

    if (builtMushroom) {
      return builtMushroom;
    }

    return buildMushroom({
      rng,
      stemColor: "#f0e1bf",
      capColor: rng() > 0.5 ? "#ff5da8" : "#f39b4c",
      glowColor: "#ffd8f4"
    });
  },
  toadstoolRing({ rng, assetContext, biomeKey }) {
    const builtPatchInstances =
      biomeKey === "mushrooms"
        ? assetContext?.mushroom?.models?.createMushroomPatchInstances?.(rng)
        : null;

    if (builtPatchInstances) {
      return { instances: builtPatchInstances };
    }

    const builtPatch =
      biomeKey === "mushrooms" ? assetContext?.mushroom?.models?.createMushroomPatch(rng) : null;

    if (builtPatch) {
      return builtPatch;
    }

    return buildToadstoolRing({ rng });
  },
  stump({ rng }) {
    return buildStump({ rng });
  },
  sporeCluster({ rng }) {
    return buildFireflyCluster({ rng, glowColor: "#ffcdf1", spread: 1.8, speed: 0.25 });
  },
  crystalCluster({ rng }) {
    return buildCrystalCluster({
      rng,
      crystalColor: rng() > 0.5 ? "#90b6ff" : "#d6a4ff"
    });
  },
  glowBloom({ rng }) {
    return buildGlowBloom({ rng, glowColor: rng() > 0.5 ? "#d7b7ff" : "#fff3a3" });
  },
  wispCluster({ rng }) {
    return buildWispCluster({ rng, glowColor: "#c2e8ff" });
  }
};
