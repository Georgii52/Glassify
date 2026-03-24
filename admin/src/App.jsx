import { useState, useEffect, useCallback, useRef } from 'react'
import ARPreview from './components/ARPreview'
import TransformControls from './components/TransformControls'
import { quatToEulerDeg, eulerDegToQuat } from './utils/math'
import { defaultConfig, getModels, modelToTransform } from './utils/config'
import styles from './App.module.css'

// ─── Initial state ───────────────────────────────────────────

const EMPTY_TRANSFORM = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale:    [1, 1, 1],
  hidden:   false,
}

// ─── Backend API ─────────────────────────────────────────────

function useBackend() {
  const [url, setUrl]  = useState(() => localStorage.getItem('admin_url') || '')
  const [key, setKey]  = useState(() => localStorage.getItem('admin_key') || '')
  const [open, setOpen] = useState(false)

  const save = useCallback(() => {
    localStorage.setItem('admin_url', url)
    localStorage.setItem('admin_key', key)
  }, [url, key])

  const headers = useCallback((json = true) => {
    const h = {}
    if (json) h['Content-Type'] = 'application/json'
    if (key)  h['X-API-Key']    = key
    return h
  }, [key])

  const baseUrl = url.replace(/\/$/, '')

  return { url, setUrl, key, setKey, save, headers, baseUrl, open, setOpen }
}

// ─── Log ─────────────────────────────────────────────────────

function useLog() {
  const [entries, setEntries] = useState([])
  const add = useCallback((msg, type = '') => {
    setEntries(prev => [...prev, { msg, type, time: new Date().toLocaleTimeString() }])
  }, [])
  return { entries, add }
}

// ─── App ─────────────────────────────────────────────────────

export default function App() {
  const [config, setConfig]       = useState(null)
  const [originals, setOriginals] = useState({})
  const [modelId, setModelId]     = useState(null)
  const [transform, setTransform] = useState(EMPTY_TRANSFORM)
  const [status, setStatus]       = useState({ type: 'loading', text: 'Загрузка...' })
  const [uploadFile, setUploadFile] = useState(null)
  const backend = useBackend()
  const { entries: logs, add: addLog } = useLog()
  const logRef   = useRef(null)
  const fileRef  = useRef(null)

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs])

  // ── Load config ────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/expanse.json')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const cfg = await res.json()
        initConfig(cfg)
        addLog('Конфигурация загружена с /expanse.json', 'ok')
      } catch (e) {
        addLog(`/expanse.json: ${e.message} — использую встроенные данные`, 'err')
        initConfig(defaultConfig())
      }
      setStatus({ type: 'ok', text: 'Готово' })
    }
    load()
  }, [])

  function initConfig(cfg) {
    setConfig(cfg)
    const models = getModels(cfg)
    const snaps  = {}
    models.forEach(m => { snaps[m.id] = JSON.parse(JSON.stringify(m)) })
    setOriginals(snaps)
    if (models.length > 0) {
      setModelId(models[0].id)
      setTransform(modelToTransform(models[0]))
    }
  }

  // ── Select model ───────────────────────────────────────────
  function selectModel(id) {
    // Persist current transform to config before switching
    applyTransformToConfig(config, modelId, transform)
    setModelId(id)
    setTransform(modelToTransform(config.objects[id]))
  }

  // ── Transform change ───────────────────────────────────────
  function handleTransformChange(next) {
    setTransform(next)
    applyTransformToConfig(config, modelId, next)
    setConfig(cfg => ({ ...cfg }))   // trigger re-render if needed
  }

  function applyTransformToConfig(cfg, id, t) {
    if (!cfg?.objects?.[id] || !t) return
    cfg.objects[id].position = [...t.position]
    cfg.objects[id].rotation = eulerDegToQuat(...t.rotation)
    cfg.objects[id].scale    = [...t.scale]
    cfg.objects[id].hidden   = t.hidden
  }

  // ── Reset ──────────────────────────────────────────────────
  function reset() {
    const orig = originals[modelId]
    if (!orig) return
    const restored = JSON.parse(JSON.stringify(orig))
    config.objects[modelId] = restored
    setTransform(modelToTransform(restored))
    addLog(`Сброшено: ${orig.name}`, 'ok')
  }

  // ── Download ───────────────────────────────────────────────
  function downloadConfig() {
    if (!config) return
    const json = JSON.stringify(config, null, 2)
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([json], { type: 'application/json' })),
      download: '.expanse.json',
    })
    a.click(); URL.revokeObjectURL(a.href)
    addLog('Скачан .expanse.json', 'ok')
  }

  // ── Save to backend ────────────────────────────────────────
  async function saveToBackend() {
    if (!backend.baseUrl) { addLog('URL бекенда не задан', 'err'); return }
    const m = config?.objects?.[modelId]
    if (!m) return

    setStatus({ type: 'loading', text: 'Сохранение...' })
    try {
      const res = await fetch(`${backend.baseUrl}/models/${m.id}`, {
        method: 'POST',
        headers: backend.headers(),
        body: JSON.stringify({
          id: m.id, name: m.name, asset: m.gltfModel?.src?.asset,
          position: m.position, rotation: m.rotation, scale: m.scale, hidden: m.hidden,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      addLog(`✓ ${m.name} → бекенд`, 'ok')
      setStatus({ type: 'ok', text: 'Сохранено' })
    } catch (e) {
      addLog(`✗ ${e.message}`, 'err')
      setStatus({ type: 'err', text: 'Ошибка' })
    }
  }

  // ── Upload new model ───────────────────────────────────────
  async function uploadModel() {
    if (!uploadFile) { addLog('Файл не выбран', 'err'); return }
    if (!backend.baseUrl) { addLog('URL бекенда не задан', 'err'); return }

    const name = uploadFile.name
    const fd = new FormData()
    fd.append('file', uploadFile, name)
    fd.append('meta', JSON.stringify({
      name,
      position: transform.position,
      rotation: eulerDegToQuat(...transform.rotation),
      scale: transform.scale,
    }))

    setStatus({ type: 'loading', text: 'Загрузка...' })
    try {
      const res = await fetch(`${backend.baseUrl}/models/upload`, {
        method: 'POST',
        headers: backend.headers(false),
        body: fd,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json().catch(() => ({}))
      const newId = data.id || ('up-' + Date.now())
      addModelToConfig(newId, name)
      addLog(`✓ "${name}" загружен`, 'ok')
      setStatus({ type: 'ok', text: 'Готово' })
    } catch (e) {
      addLog(`✗ ${e.message}`, 'err')
      setStatus({ type: 'err', text: 'Ошибка' })
    }
  }

  function addLocally() {
    if (!uploadFile) { addLog('Файл не выбран', 'err'); return }
    addModelToConfig('local-' + Date.now(), uploadFile.name)
  }

  function addModelToConfig(id, name) {
    const newModel = {
      id, name, hidden: false,
      position: [...transform.position],
      rotation: eulerDegToQuat(...transform.rotation),
      scale: [...transform.scale],
      gltfModel: { src: { type: 'asset', asset: `assets/${name}` }, animationClip: '', loop: true },
      shadow: { castShadow: true, receiveShadow: true },
    }
    setConfig(prev => ({
      ...prev,
      objects: { ...prev.objects, [id]: newModel },
    }))
    setOriginals(prev => ({ ...prev, [id]: JSON.parse(JSON.stringify(newModel)) }))
    setModelId(id)
    setTransform(modelToTransform(newModel))
    setUploadFile(null)
    if (fileRef.current) fileRef.current.value = ''
    addLog(`"${name}" добавлен`, 'ok')
  }

  // ── Drag & drop ────────────────────────────────────────────
  function handleDrop(e) {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f?.name.toLowerCase().endsWith('.glb')) setUploadFile(f)
    else addLog('Нужен .glb файл', 'err')
  }

  // ── Render ─────────────────────────────────────────────────
  const models = config ? getModels(config) : []
  const currentModel = config?.objects?.[modelId]

  return (
    <div className={styles.root}>

      {/* Top bar */}
      <div className={styles.topbar}>
        <span className={styles.title}>👓 Glasses Admin</span>
        <div className={styles.topActions}>
          <button className={styles.btnGhost} onClick={reset}>↺ Сброс</button>
          <button className={styles.btnGhost} onClick={downloadConfig}>↓ .expanse.json</button>
          <button className={styles.btnOk}   onClick={saveToBackend}>💾 На бекенд</button>
        </div>
      </div>

      <div className={styles.layout}>

        {/* AR Preview */}
        <ARPreview
          modelName={currentModel?.name}
          transform={transform}
        />

        {/* Controls */}
        <div className={styles.ctrlPanel}>

          {/* Model tabs */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Модель</div>
            <div className={styles.tabs}>
              {models.map(m => (
                <button
                  key={m.id}
                  className={`${styles.tab} ${m.id === modelId ? styles.tabActive : ''}`}
                  onClick={() => selectModel(m.id)}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.divider} />

          {/* Transform controls */}
          <TransformControls
            transform={transform}
            onChange={handleTransformChange}
          />

          <div className={styles.divider} />

          {/* Upload */}
          <details className={styles.details}>
            <summary className={styles.summary}>Загрузить новую модель</summary>
            <div className={styles.uploadSection}>
              <div
                className={`${styles.dropZone} ${uploadFile ? styles.dropZoneHasFile : ''}`}
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".glb"
                  style={{ display: 'none' }}
                  onChange={e => setUploadFile(e.target.files[0] || null)}
                />
                {uploadFile
                  ? <><strong>{uploadFile.name}</strong> ({(uploadFile.size/1024/1024).toFixed(2)} МБ)</>
                  : '📦 Выбрать .glb или перетащить'
                }
              </div>
              {uploadFile && (
                <div className={styles.uploadActions}>
                  <button className={styles.btnOk}    onClick={uploadModel}>↑ На бекенд</button>
                  <button className={styles.btnGhost} onClick={addLocally}>+ Локально</button>
                  <button className={styles.btnGhost} onClick={() => { setUploadFile(null); if(fileRef.current) fileRef.current.value='' }}>✕</button>
                </div>
              )}
            </div>
          </details>

          {/* Log */}
          <div className={styles.log} ref={logRef}>
            {logs.length === 0
              ? <span style={{ color: 'var(--dim)' }}>Готов к работе...</span>
              : logs.map((e, i) => (
                  <div key={i} className={`${styles.logEntry} ${e.type === 'ok' ? styles.logOk : e.type === 'err' ? styles.logErr : ''}`}>
                    [{e.time}] {e.msg}
                  </div>
                ))
            }
          </div>

        </div>
      </div>

      {/* Status bar */}
      <div className={styles.statusbar}>
        <div className={`${styles.dot} ${styles['dot_' + status.type]}`} />
        <span>{status.text}</span>
      </div>

    </div>
  )
}
