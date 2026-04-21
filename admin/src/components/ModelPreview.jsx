import { useEffect, useRef, useState } from 'react'
import '@google/model-viewer'
import axios from 'axios'
import styles from './ModelPreview.module.css'

export default function ModelPreview({ modelId }) {
  const [src, setSrc] = useState(null)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef(null)
  const blobUrlRef = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observer.disconnect()
          load()
        }
      },
      { rootMargin: '120px' }
    )
    if (containerRef.current) observer.observe(containerRef.current)
    return () => {
      observer.disconnect()
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
    }
  }, [modelId])

  async function load() {
    setLoading(true)
    try {
      const { data } = await axios.get(`${import.meta.env.VITE_BASE_URL}/glasses/${modelId}`)
      if (data.file?.base64) {
        const binary = atob(data.file.base64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        const blob = new Blob([bytes], { type: 'model/gltf-binary' })
        const url = URL.createObjectURL(blob)
        blobUrlRef.current = url
        setSrc(url)
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }

  return (
    <div ref={containerRef} className={styles.root}>
      {loading && <span className={styles.hint}>Загрузка...</span>}
      {src && (
        // @ts-ignore
        <model-viewer
          src={src}
          camera-controls
          disable-zoom
          interaction-prompt="none"
          style={{ width: '100%', height: '100%' }}
        />
      )}
      {!loading && !src && <span className={styles.hint}>—</span>}
    </div>
  )
}
