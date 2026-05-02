import * as THREE from "three";

const IDENTITY_MATRIX = new THREE.Matrix4();
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const TEMP_NORMAL = new THREE.Vector3();
const TEMP_ALIGNMENT = new THREE.Quaternion();
const TEMP_TWIST = new THREE.Quaternion();
const TEMP_ROTATION = new THREE.Quaternion();
const DEFAULT_TERRAIN_NORMAL_TILT = 0.32;

function getLimitedTerrainNormal(normal, maxTiltRadians, target) {
  if (!normal) {
    return target.copy(Y_AXIS);
  }

  target.copy(normal).normalize();

  const tilt = Y_AXIS.angleTo(target);

  if (tilt > maxTiltRadians && tilt > 0.0001) {
    target.copy(Y_AXIS).lerp(target, maxTiltRadians / tilt).normalize();
  }

  return target;
}

function createTerrainRotation(rotationY, terrainNormal, maxTiltRadians = DEFAULT_TERRAIN_NORMAL_TILT) {
  const normal = getLimitedTerrainNormal(terrainNormal, maxTiltRadians, TEMP_NORMAL);

  TEMP_ALIGNMENT.setFromUnitVectors(Y_AXIS, normal);
  TEMP_TWIST.setFromAxisAngle(normal, rotationY);

  return TEMP_ROTATION.multiplyQuaternions(TEMP_TWIST, TEMP_ALIGNMENT);
}

export class InstanceBatchCollector {
  constructor() {
    this.batches = new Map();
  }

  queue(instances, rootMatrix = IDENTITY_MATRIX) {
    if (!instances || instances.length === 0) {
      return;
    }

    for (const instance of instances) {
      const batch = this.batches.get(instance.batchKey);

      if (batch) {
        batch.placements.push({
          matrix: new THREE.Matrix4().multiplyMatrices(rootMatrix, instance.localMatrix ?? IDENTITY_MATRIX),
          color: instance.color?.clone?.() ?? null
        });
        continue;
      }

      this.batches.set(instance.batchKey, {
        build: instance.build,
        placements: [
          {
            matrix: new THREE.Matrix4().multiplyMatrices(
              rootMatrix,
              instance.localMatrix ?? IDENTITY_MATRIX
            ),
            color: instance.color?.clone?.() ?? null
          }
        ]
      });
    }
  }

  flushInto(group) {
    for (const batch of this.batches.values()) {
      const built = batch.build(batch.placements);

      if (built) {
        group.add(built);
      }
    }

    this.batches.clear();
  }
}

export function addBuiltAssetToChunk({
  built,
  group,
  instanceCollector,
  position,
  terrainNormal = null,
  rotationY = 0,
  scale = 1,
  updaters = null,
  chunkKey = null
}) {
  if (!built) {
    return false;
  }

  if (built.instances?.length) {
    const rootScale = built.rootScaleOverride ?? scale;
    const groundOffset = built.groundOffset ?? 0;
    const alignmentTilt = built.maxTerrainNormalTilt ?? DEFAULT_TERRAIN_NORMAL_TILT;
    const rootMatrix = new THREE.Matrix4().compose(
      new THREE.Vector3(position.x, position.y + groundOffset, position.z),
      createTerrainRotation(rotationY, terrainNormal, alignmentTilt),
      new THREE.Vector3(rootScale, rootScale, rootScale)
    );

    instanceCollector?.queue(built.instances, rootMatrix);

    if (built.update && updaters && chunkKey) {
      updaters.push({
        chunkKey,
        update: built.update
      });
    }

    return true;
  }

  if (!built.object) {
    return false;
  }

  built.object.position.set(position.x, position.y + (built.groundOffset ?? 0), position.z);
  built.object.quaternion.copy(
    built.alignToTerrainNormal
      ? createTerrainRotation(rotationY, terrainNormal, built.maxTerrainNormalTilt)
      : new THREE.Quaternion().setFromAxisAngle(Y_AXIS, rotationY)
  );
  built.object.scale.setScalar(scale);
  group.add(built.object);

  if (built.update && updaters && chunkKey) {
    updaters.push({
      chunkKey,
      update: built.update
    });
  }

  return true;
}
