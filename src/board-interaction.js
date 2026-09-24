// Ignore atmosphere and transparent glazing, but never pick through an opaque wall.
export function pickBoard(raycaster, scene, room) {
  for (const hit of raycaster.intersectObjects(scene.children, true)) {
    const mesh = hit.object;
    if (!mesh.isMesh) continue;
    let visible = true;
    for (let node = mesh; node; node = node.parent) visible &&= node.visible;
    if (!visible) continue;
    const material = Array.isArray(mesh.material)
      ? mesh.material[hit.face?.materialIndex || 0]
      : mesh.material;
    if (
      !material?.visible ||
      material.opacity < 0.5 ||
      material.transmission > 0.5
    )
      continue;
    return mesh.userData.exhibitionRoom === room
      ? mesh.userData.exhibitionSlot || null
      : null;
  }
  return null;
}
