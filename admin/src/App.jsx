import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import ARPreview from "./components/ARPreview";
import TransformControls from "./components/TransformControls";
import { eulerDegToQuat } from "./utils/math";
import { modelToTransform } from "./utils/config";
import styles from "./App.module.css";

// ─── Initial state ───────────────────────────────────────────

const EMPTY_TRANSFORM = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  hidden: false,
};

// ─── Log ─────────────────────────────────────────────────────

function progressBar(pct) {
  const filled = Math.round(pct / 10);
  return "█".repeat(filled) + "░".repeat(10 - filled) + ` ${pct}%`;
}

function useLog() {
  const [entries, setEntries] = useState([]);
  const add = useCallback((msg, type = "") => {
    const id = Date.now() + Math.random();
    setEntries((prev) => [
      ...prev,
      { id, msg, type, time: new Date().toLocaleTimeString() },
    ]);
    return id;
  }, []);
  const update = useCallback((id, msg, type) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id
          ? { ...e, msg, ...(type !== undefined ? { type } : {}) }
          : e,
      ),
    );
  }, []);
  return { entries, add, update };
}

// ─── App ─────────────────────────────────────────────────────

export default function App() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlModelId = searchParams.get("modelId");

  const [config, setConfig] = useState(null);
  const [originals, setOriginals] = useState({});
  const [modelId, setModelId] = useState(null);
  const [transform, setTransform] = useState(EMPTY_TRANSFORM);
  const [status, setStatus] = useState({
    type: "loading",
    text: "Загрузка...",
  });
  const [modelBase64, setModelBase64] = useState(null);
  const { entries: logs, add: addLog, update: updateLog } = useLog();
  const logRef = useRef(null);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  // ── Load config ────────────────────────────────────────────
  useEffect(() => {
    if (!urlModelId) return;
    async function load() {
      try {
        const logId = addLog("Загрузка " + progressBar(0));
        const { data } = await axios.get(
          `${import.meta.env.VITE_BASE_URL}/glasses/${urlModelId}`,
          {
            onDownloadProgress: (e) => {
              if (e.total)
                updateLog(
                  logId,
                  "Загрузка " +
                    progressBar(Math.round((e.loaded / e.total) * 100)),
                );
            },
          },
        );
        updateLog(logId, "Конфигурация загружена", "ok");

        const dto = data.dto;
        const parseArr = (v) => (Array.isArray(v) ? v : JSON.parse(v));
        const cfg = {
          objects: {
            [urlModelId]: {
              id: urlModelId,
              name: data.name ?? `Модель ${urlModelId}`,
              hidden: false,
              position: parseArr(dto.position),
              rotation: parseArr(dto.rotation),
              scale: parseArr(dto.scale),
            },
          },
        };
        initConfig(cfg);
        if (data.file?.base64) setModelBase64(data.file.base64);
      } catch (e) {
        addLog(`Ошибка загрузки: ${e.message}`, "err");
        setStatus({ type: "err", text: "Ошибка загрузки" });
      }
    }
    load();
  }, [urlModelId]);

  function initConfig(cfg) {
    setConfig(cfg);
    const target = cfg.objects?.[urlModelId];
    if (target) {
      setOriginals({ [urlModelId]: JSON.parse(JSON.stringify(target)) });
      setModelId(urlModelId);
      setTransform(modelToTransform(target));
    } else {
      setStatus({ type: "err", text: `Модель не найдена: ${urlModelId}` });
    }
  }

  // ── Transform change ───────────────────────────────────────
  function handleTransformChange(next) {
    setTransform(next);
    applyTransformToConfig(config, modelId, next);
    setConfig((cfg) => ({ ...cfg })); // trigger re-render if needed
  }

  function applyTransformToConfig(cfg, id, t) {
    if (!cfg?.objects?.[id] || !t) return;
    cfg.objects[id].position = [...t.position];
    cfg.objects[id].rotation = eulerDegToQuat(...t.rotation);
    cfg.objects[id].scale = [...t.scale];
    cfg.objects[id].hidden = t.hidden;
  }

  // ── Save to backend ────────────────────────────────────────
  async function saveToBackend() {
    if (!import.meta.env.VITE_BASE_URL) {
      addLog("URL бекенда не задан", "err");
      return;
    }
    const m = config?.objects?.[modelId];
    if (!m) return;

    setStatus({ type: "loading", text: "Сохранение..." });
    const logId = addLog("↑ Сохранение " + progressBar(0));
    try {
      await axios.patch(
        `${import.meta.env.VITE_BASE_URL}/glasses/${m.id}`,
        { position: m.position, rotation: m.rotation, scale: m.scale },
        {
          onUploadProgress: (e) => {
            if (e.total)
              updateLog(
                logId,
                "↑ Сохранение " +
                  progressBar(Math.round((e.loaded / e.total) * 100)),
              );
          },
        },
      );
      updateLog(logId, `✓ ${m.name} сохранена на сервере`, "ok");
      setStatus({ type: "ok", text: "Сохранено" });
    } catch (e) {
      updateLog(logId, `✗ ${e.message}`, "err");
      setStatus({ type: "err", text: "Ошибка" });
    }
  }

  function resetToDefault() {
    const orig = originals[modelId];
    if (!orig) return;
    const restored = JSON.parse(JSON.stringify(orig));
    setConfig((prev) => ({
      ...prev,
      objects: { ...prev.objects, [modelId]: restored },
    }));
    setTransform(modelToTransform(restored));
    addLog("Сброшено до значений с сервера", "ok");
  }

  // ── Render ─────────────────────────────────────────────────
  const currentModel = config?.objects?.[modelId];

  if (!urlModelId) {
    return (
      <div
        className={styles.root}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text)",
        }}
      >
        Не передан ID модели
      </div>
    );
  }

  return (
    <div className={styles.root}>
      {/* Top bar */}
      <div className={styles.topbar}>
        <button className={styles.btnGhost} onClick={() => navigate("/")}>
          Назад в каталог
        </button>
        <span className={styles.title}>{currentModel?.name ?? "..."}</span>
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
            {logs.length === 0 ? (
              <span style={{ color: "var(--dim)" }}>Готов к работе...</span>
            ) : (
              logs.map((e, i) => (
                <div
                  key={i}
                  className={`${styles.logEntry} ${e.type === "ok" ? styles.logOk : e.type === "err" ? styles.logErr : ""}`}
                >
                  [{e.time}] {e.msg}
                </div>
              ))
            )}
          </div>

          <div className={styles.divider} />

          {/* Transform controls */}
          <TransformControls
            transform={transform}
            onChange={handleTransformChange}
          />

          <div className={styles.topActions}>
            <button className={styles.btnOk} onClick={saveToBackend}>
              Сохранить положение
            </button>
            <button className={styles.btnGhost} onClick={resetToDefault}>
              Сбросить до значений по умолчанию
            </button>
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className={styles.statusbar}>
        <div className={`${styles.dot} ${styles["dot_" + status.type]}`} />
        <span>{status.text}</span>
      </div>
    </div>
  );
}
