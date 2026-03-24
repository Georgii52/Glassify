import { useEffect, useRef } from 'react'
import { eulerDegToQuat } from '../utils/math'
import styles from './ARPreview.module.css'

const AR_URL = 'http://localhost:8080'

/**
 * Renders the 8th Wall AR experience in an iframe and sends
 * transform updates via postMessage whenever `transform` changes.
 */
export default function ARPreview({ modelName, transform }) {
  const iframeRef = useRef(null)

  // Send transform to iframe whenever it changes
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe?.contentWindow || !modelName || !transform) return

    iframe.contentWindow.postMessage({
      type: 'adminSetTransform',
      modelName,
      position: [...transform.position],
      rotation: eulerDegToQuat(...transform.rotation),
      scale:    [...transform.scale],
      hidden:   transform.hidden,
    }, '*')
  }, [modelName, transform])

  return (
    <div className={styles.wrap}>
      <iframe
        ref={iframeRef}
        src={AR_URL}
        title="AR Preview"
        allow="camera; microphone; accelerometer; gyroscope; xr-spatial-tracking"
        allowFullScreen
        className={styles.frame}
      />
    </div>
  )
}
