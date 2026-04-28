import * as THREE from "three";

const IDENTITY_MATRIX = new THREE.Matrix4();

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
    const rootMatrix = new THREE.Matrix4().compose(
      new THREE.Vector3(position.x, position.y, position.z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationY),
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

  built.object.position.set(position.x, position.y, position.z);
  built.object.rotation.y = rotationY;
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
