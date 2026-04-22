import { useEffect, useRef } from 'react'
import { eulerDegToQuat } from '../utils/math'
import styles from './ARPreview.module.css'

/** Публичный URL страницы client (webpack dev :8080, прод — корень домена). */
const AR_URL = `${String(import.meta.env.VITE_CLIENT_URL || 'http://localhost:8080').replace(/\/$/, '')}/`

/**
 * Renders the 8th Wall AR experience in an iframe and sends
 * transform updates via postMessage whenever `transform` changes.
 */
export default function ARPreview({ modelName, transform, modelBase64 }) {
  const iframeRef    = useRef(null)
  const pendingRef   = useRef(null)  // last state to send after iframe loads

  function sendTransform(iframe, modelName, transform) {
    iframe.contentWindow.postMessage({
      type: 'adminSetTransform',
      modelName,
      position: [...transform.position],
      rotation: eulerDegToQuat(...transform.rotation),
      scale:    [...transform.scale],
      hidden:   transform.hidden,
    }, '*')
  }

  function sendModel(iframe, base64) {
    iframe.contentWindow.postMessage({ type: 'adminLoadModel', base64 }, '*')
  }

  // Send model file to iframe whenever it changes
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe?.contentWindow || !modelBase64) return
    sendModel(iframe, modelBase64)
  }, [modelBase64])

  // Send transform to iframe whenever it changes
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe?.contentWindow || !modelName || !transform) return
    pendingRef.current = { modelName, transform }
    sendTransform(iframe, modelName, transform)
  }, [modelName, transform])

  function handleLoad() {
    const iframe = iframeRef.current
    if (!iframe?.contentWindow) return
    if (modelBase64) sendModel(iframe, modelBase64)
    const p = pendingRef.current
    if (p) sendTransform(iframe, p.modelName, p.transform)
  }

  return (
    <div className={styles.wrap}>
      <iframe
        ref={iframeRef}
        src={AR_URL}
        title="AR Preview"
        allow="camera; microphone; accelerometer; gyroscope; xr-spatial-tracking"
        allowFullScreen
        className={styles.frame}
        onLoad={handleLoad}
      />
    </div>
  )
}
