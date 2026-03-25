import { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'
import ARPreview from './components/ARPreview'
import TransformControls from './components/TransformControls'
import { eulerDegToQuat } from './utils/math'
import { modelToTransform } from './utils/config'
import styles from './App.module.css'

// ─── URL params & constants ──────────────────────────────────

const URL_MODEL_ID = new URLSearchParams(window.location.search).get('modelId')
const MODEL_NAME   = `Модель ${URL_MODEL_ID}`

// ─── Initial state ───────────────────────────────────────────

const EMPTY_TRANSFORM = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale:    [1, 1, 1],
  hidden:   false,
}

// ─── Log ─────────────────────────────────────────────────────

function progressBar(pct) {
  const filled = Math.round(pct / 10)
  return '█'.repeat(filled) + '░'.repeat(10 - filled) + ` ${pct}%`
}

function useLog() {
  const [entries, setEntries] = useState([])
  const add = useCallback((msg, type = '') => {
    const id = Date.now() + Math.random()
    setEntries(prev => [...prev, { id, msg, type, time: new Date().toLocaleTimeString() }])
    return id
  }, [])
  const update = useCallback((id, msg, type) => {
    setEntries(prev => prev.map(e =>
      e.id === id ? { ...e, msg, ...(type !== undefined ? { type } : {}) } : e
    ))
  }, [])
  return { entries, add, update }
}

// ─── App ─────────────────────────────────────────────────────

export default function App() {
  const [config, setConfig]       = useState(null)
  const [originals, setOriginals] = useState({})
  const [modelId, setModelId]     = useState(null)
  const [transform, setTransform] = useState(EMPTY_TRANSFORM)
  const [status, setStatus]       = useState({ type: 'loading', text: 'Загрузка...' })
  const [uploadFile, setUploadFile] = useState(null)
  const [modelBase64, setModelBase64] = useState(null)
  const { entries: logs, add: addLog, update: updateLog } = useLog()
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
        const logId = addLog('Загрузка ' + progressBar(0))
        const { data } = await axios.get(`${import.meta.env.VITE_BASE_URL}/glasses/${URL_MODEL_ID}`, {
          onDownloadProgress: (e) => {
            if (e.total) updateLog(logId, 'Загрузка ' + progressBar(Math.round(e.loaded / e.total * 100)))
          },
        })
        updateLog(logId, 'Конфигурация загружена', 'ok')

        const dto  = data.dto
        const parseArr = v => Array.isArray(v) ? v : JSON.parse(v)
        const cfg  = {
          objects: {
            [URL_MODEL_ID]: {
              id:       URL_MODEL_ID,
              name:     MODEL_NAME,
              hidden:   false,
              position: parseArr(dto.position),
              rotation: parseArr(dto.rotation),
              scale:    parseArr(dto.scale),
            },
          },
        }
        initConfig(cfg)
        if (data.file?.base64) setModelBase64(data.file.base64)
      } catch (e) {
        addLog(`Ошибка загрузки: ${e.message}`, 'err')
        setStatus({ type: 'err', text: 'Ошибка загрузки' })
      }
    }
    load()
  }, [])

  function initConfig(cfg) {
    setConfig(cfg)
    const target = cfg.objects?.[URL_MODEL_ID]
    if (target) {
      setOriginals({ [URL_MODEL_ID]: JSON.parse(JSON.stringify(target)) })
      setModelId(URL_MODEL_ID)
      setTransform(modelToTransform(target))
    } else {
      setStatus({ type: 'err', text: `Модель не найдена: ${URL_MODEL_ID}` })
    }
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

  // ── Save to backend ────────────────────────────────────────
  async function saveToBackend() {
    if (!import.meta.env.VITE_BASE_URL) { addLog('URL бекенда не задан', 'err'); return }
    const m = config?.objects?.[modelId]
    if (!m) return

    setStatus({ type: 'loading', text: 'Сохранение...' })
    const logId = addLog('↑ Сохранение ' + progressBar(0))
    try {
      await axios.patch(`${import.meta.env.VITE_BASE_URL}/glasses/${m.id}`,
        { position: m.position, rotation: m.rotation, scale: m.scale },
        {
          onUploadProgress: (e) => {
            if (e.total) updateLog(logId, '↑ Сохранение ' + progressBar(Math.round(e.loaded / e.total * 100)))
          },
        }
      )
      updateLog(logId, `✓ ${m.name} сохранена на сервере`, 'ok')
      setStatus({ type: 'ok', text: 'Сохранено' })
    } catch (e) {
      updateLog(logId, `✗ ${e.message}`, 'err')
      setStatus({ type: 'err', text: 'Ошибка' })
    }
  }

  function resetToDefault() {
    const orig = originals[modelId]
    if (!orig) return
    const restored = JSON.parse(JSON.stringify(orig))
    setConfig(prev => ({ ...prev, objects: { ...prev.objects, [modelId]: restored } }))
    setTransform(modelToTransform(restored))
    addLog('Сброшено до значений с сервера', 'ok')
  }

  // ── Upload new model ───────────────────────────────────────
  async function uploadModel() {
    if (!uploadFile) { addLog('Файл не выбран', 'err'); return }
    if (!import.meta.env.VITE_BASE_URL) { addLog('URL бекенда не задан', 'err'); return }

    const name = uploadFile.name
    const fd = new FormData()
    fd.append('model', uploadFile, name)

    setStatus({ type: 'loading', text: 'Загрузка...' })
    const logId = addLog('Загрузка ' + progressBar(0))
    try {
      const { data } = await axios.post(`${import.meta.env.VITE_BASE_URL}/glasses`, fd, {
        onUploadProgress: (e) => {
          if (e.total) updateLog(logId, 'Загрузка ' + progressBar(Math.round(e.loaded / e.total * 100)))
        },
      })
      const newId = data.id || ('up-' + Date.now())
      addModelToConfig(newId, name)
      updateLog(logId, `✓ "${name}" загружен`, 'ok')
      setStatus({ type: 'ok', text: 'Готово' })
    } catch (e) {
      updateLog(logId, `✗ ${e.message}`, 'err')
      setStatus({ type: 'err', text: 'Ошибка' })
    }
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
  const currentModel = config?.objects?.[modelId]

  if (!URL_MODEL_ID) {
    return <div className={styles.root} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)' }}>Неизвестный URL или не передан ID</div>
  }

  return (
    <div className={styles.root}>

      {/* Top bar */}
      <div className={styles.topbar}>
        <span className={styles.title}>{currentModel?.name ?? '...'}</span>
      </div>

      <div className={styles.layout}>

        {/* AR Preview */}
        <ARPreview
          modelName={currentModel?.name}
          transform={transform}
          modelBase64={modelBase64}
        />

        {/* Controls */}
        <div className={styles.ctrlPanel}>

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
                  <button className={styles.btnOk}    onClick={uploadModel}>Отправить</button>
                  <button className={styles.btnGhost} onClick={() => { setUploadFile(null); if(fileRef.current) fileRef.current.value='' }}>✕</button>
                </div>
              )}
            </div>
          </details>

          <div className={styles.topActions}>
            <button className={styles.btnOk} onClick={saveToBackend}>Сохранить положение</button>
            <button className={styles.btnGhost} onClick={resetToDefault}>
              Сбросить до значений по умолчанию
            </button>
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
