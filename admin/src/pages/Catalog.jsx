import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import ModelPreview from "../components/ModelPreview";
import styles from "./Catalog.module.css";

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

export default function Catalog() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadName, setUploadName] = useState("");
  const [uploading, setUploading] = useState(false);
  const { entries: logs, add: addLog, update: updateLog } = useLog();
  const fileRef = useRef(null);
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  useEffect(() => {
    fetchModels();
  }, []);

  async function fetchModels() {
    setLoading(true);
    try {
      const { data } = await axios.get(
        `${import.meta.env.VITE_BASE_URL}/glasses`,
      );
      setModels(Array.isArray(data) ? data : []);
    } catch (e) {
      addLog(`Ошибка загрузки каталога: ${e.message}`, "err");
    } finally {
      setLoading(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f?.name.toLowerCase().endsWith(".glb")) setUploadFile(f);
    else addLog("Нужен .glb файл", "err");
  }

  function clearUpload() {
    setUploadFile(null);
    setUploadName("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function uploadModel() {
    if (!uploadFile) return;
    if (!uploadName.trim()) {
      addLog("Укажите название модели", "err");
      return;
    }
    if (!import.meta.env.VITE_BASE_URL) {
      addLog("URL бекенда не задан", "err");
      return;
    }

    const fd = new FormData();
    fd.append("model", uploadFile, uploadFile.name);
    fd.append("name", uploadName.trim());

    setUploading(true);
    const logId = addLog("Загрузка " + progressBar(0));
    try {
      await axios.post(`${import.meta.env.VITE_BASE_URL}/glasses`, fd, {
        onUploadProgress: (e) => {
          if (e.total)
            updateLog(
              logId,
              "Загрузка " + progressBar(Math.round((e.loaded / e.total) * 100)),
            );
        },
      });
      updateLog(logId, `✓ "${uploadName.trim()}" загружен`, "ok");
      clearUpload();
      await fetchModels();
    } catch (e) {
      updateLog(logId, `✗ ${e.message}`, "err");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={styles.root}>
      {/* Top bar */}
      <div className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <span className={styles.title}>Каталог</span>
        </div>
        <button className={styles.btnGhost} onClick={logout}>
          Выйти
        </button>
      </div>

      <div className={styles.body}>
        {/* Upload section */}
        <div className={styles.uploadCard}>
          <p className={styles.uploadTitle}>Загрузить новую модель</p>
          <div
            className={`${styles.dropZone} ${uploadFile ? styles.dropZoneHasFile : ""}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".glb"
              style={{ display: "none" }}
              onChange={(e) => setUploadFile(e.target.files[0] || null)}
            />
            {uploadFile ? (
              <>
                <strong>{uploadFile.name}</strong> —{" "}
                {(uploadFile.size / 1024 / 1024).toFixed(2)} МБ
              </>
            ) : (
              "Выбрать .glb или перетащить"
            )}
          </div>
          {uploadFile && (
            <>
              <input
                className={styles.nameInput}
                type="text"
                placeholder="Название модели"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
              />
              <div className={styles.uploadActions}>
                <button
                  className={styles.btnOk}
                  onClick={uploadModel}
                  disabled={uploading}
                >
                  {uploading ? "Отправка..." : "Отправить"}
                </button>
                <button className={styles.btnGhost} onClick={clearUpload}>
                  Отмена
                </button>
              </div>
            </>
          )}

          {logs.length > 0 && (
            <div className={styles.log} ref={logRef}>
              {logs.map((e, i) => (
                <div
                  key={i}
                  className={`${styles.logEntry} ${e.type === "ok" ? styles.logOk : e.type === "err" ? styles.logErr : ""}`}
                >
                  [{e.time}] {e.msg}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Models grid */}
        {loading ? (
          <div className={styles.empty}>Загрузка...</div>
        ) : models.length === 0 ? (
          <div className={styles.empty}>
            Файлы не найдены. Загрузите первый.
          </div>
        ) : (
          <div className={styles.grid}>
            {models.map((model) => (
              <div key={model.id} className={styles.card}>
                <div className={styles.cardPreview}>
                  <ModelPreview modelId={model.id} />
                </div>
                <div className={styles.cardInfo}>
                  <span className={styles.cardName}>
                    {model.name ?? model.id}
                  </span>
                  <span className={styles.cardId}>ID модели: {model.id}</span>
                </div>
                <button
                  className={styles.btnAccent}
                  onClick={() => navigate(`/editor?modelId=${model.id}`)}
                >
                  Открыть
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
