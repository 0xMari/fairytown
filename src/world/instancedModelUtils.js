import * as THREE from "three";

export function cloneMaterial(material) {
  if (Array.isArray(material)) {
    return material.map((entry) => entry?.clone?.() ?? entry);
  }

  return material?.clone?.() ?? material;
}

function markDisposableInstanceMaterial(material) {
  if (Array.isArray(material)) {
    material.forEach(markDisposableInstanceMaterial);
    return material;
  }

  if (material?.userData) {
    material.userData.disposeWithInstanceBatch = true;
  }

  return material;
}

export function extractInstancedMeshDescriptors(root) {
  root.updateMatrixWorld(true);

  const descriptors = [];

  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    descriptors.push({
      geometry: child.geometry,
      material: cloneMaterial(child.material),
      localMatrix: child.matrixWorld.clone(),
      castShadow: child.castShadow,
      receiveShadow: child.receiveShadow
    });
  });

  return descriptors;
}

export function buildInstancedGroupFromDescriptors(
  descriptors,
  placements,
  { castShadow = null, receiveShadow = null } = {}
) {
  if (!descriptors?.length || !placements?.length) {
    return null;
  }

  const group = new THREE.Group();
  const matrix = new THREE.Matrix4();

  descriptors.forEach((descriptor) => {
    const material = markDisposableInstanceMaterial(cloneMaterial(descriptor.material));
    const mesh = new THREE.InstancedMesh(
      descriptor.geometry,
      material,
      placements.length
    );

    placements.forEach((placement, index) => {
      matrix.multiplyMatrices(placement.matrix, descriptor.localMatrix);
      mesh.setMatrixAt(index, matrix);

      if (placement.color) {
        mesh.setColorAt(index, placement.color);
      }
    });

    mesh.instanceMatrix.needsUpdate = true;

    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }

    mesh.castShadow = castShadow ?? descriptor.castShadow;
    mesh.receiveShadow = receiveShadow ?? descriptor.receiveShadow;
    mesh.computeBoundingSphere();
    mesh.computeBoundingBox();
    group.add(mesh);
  });

  return group;
}
