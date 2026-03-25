import { quatToEulerDeg } from './math'

export function getModels(config) {
  if (!config?.objects) return []
  return Object.values(config.objects).filter(o => o.gltfModel?.src?.asset)
}

// Convert a config object's rotation (quaternion) to Euler for UI
export function modelToTransform(m) {
  return {
    position: [...m.position],
    rotation: quatToEulerDeg(...m.rotation),
    scale:    [...m.scale],
    hidden:   !!m.hidden,
  }
}
