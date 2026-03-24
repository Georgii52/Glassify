import { quatToEulerDeg } from './math'

export function defaultConfig() {
  return {
    objects: {
      'b58bb468-59d2-4389-ad1e-d4d22f493544': {
        id: 'b58bb468-59d2-4389-ad1e-d4d22f493544',
        name: 'glasses.glb',
        hidden: false,
        position: [-0.01, 0.04930388133509308, 0.0369342911609067],
        rotation: [0.04650484306359841, 2.55e-20, 2.71e-18, 0.998918064493595],
        scale: [9, 8, 8],
        gltfModel: { src: { type: 'asset', asset: 'assets/glasses.glb' }, animationClip: '', loop: true },
        shadow: { castShadow: true, receiveShadow: true },
      },
      '5fb636c8-6f48-4636-9064-30ffaa166571': {
        id: '5fb636c8-6f48-4636-9064-30ffaa166571',
        name: 'glasses3.glb',
        hidden: true,
        position: [-0.02, -0.7, 0.06381199371111357],
        rotation: [0, -1.22e-16, -1.22e-16, 1],
        scale: [0.0022, 0.0022, 0.0022],
        gltfModel: { src: { type: 'asset', asset: 'assets/glasses3.glb' }, animationClip: '', loop: true },
        shadow: { castShadow: true, receiveShadow: true },
      },
    },
  }
}

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
