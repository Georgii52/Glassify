import { useState, useCallback } from 'react'
import SliderRow from './SliderRow'
import { scaleToSlider, sliderToScale } from '../utils/math'
import styles from './TransformControls.module.css'

const AXES = ['x', 'y', 'z']

export default function TransformControls({ transform, onChange }) {
  const [uniformScale, setUniformScale] = useState(true)

  const { position, rotation, scale, hidden } = transform

  // ── Position ──────────────────────────────────────────────
  const setPos = useCallback((i, v) => {
    const next = [...position]
    next[i] = v
    onChange({ ...transform, position: next })
  }, [transform, onChange])

  // ── Rotation ──────────────────────────────────────────────
  const setRot = useCallback((i, v) => {
    const next = [...rotation]
    next[i] = v
    onChange({ ...transform, rotation: next })
  }, [transform, onChange])

  // ── Scale ─────────────────────────────────────────────────
  const setScale = useCallback((i, v) => {
    if (uniformScale) {
      onChange({ ...transform, scale: [v, v, v] })
    } else {
      const next = [...scale]
      next[i] = v
      onChange({ ...transform, scale: next })
    }
  }, [transform, onChange, uniformScale, scale])

  const handleScaleSlider = useCallback((i, raw) => {
    setScale(i, sliderToScale(raw))
  }, [setScale])

  const handleScaleNum = useCallback((i, v) => {
    setScale(i, v)
  }, [setScale])

  const toggleUniform = useCallback(e => {
    setUniformScale(e.target.checked)
    if (e.target.checked) {
      // Lock Y/Z to X
      onChange({ ...transform, scale: [scale[0], scale[0], scale[0]] })
    }
  }, [transform, onChange, scale])

  // ── Visibility ────────────────────────────────────────────
  const toggleVisible = useCallback(e => {
    onChange({ ...transform, hidden: !e.target.checked })
  }, [transform, onChange])

  return (
    <div className={styles.root}>

      {/* Position */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Позиция</div>
        {AXES.map((a, i) => (
          <SliderRow
            key={a}
            label={a.toUpperCase()}
            value={+position[i].toFixed(6)}
            min={-2} max={2} step={0.001}
            onSliderChange={v => setPos(i, v)}
            onNumChange={v => setPos(i, v)}
          />
        ))}
      </div>

      <div className={styles.divider} />

      {/* Rotation */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Поворот (°)</div>
        {AXES.map((a, i) => (
          <SliderRow
            key={a}
            label={a.toUpperCase()}
            value={+rotation[i].toFixed(4)}
            min={-180} max={180} step={0.5}
            onSliderChange={v => setRot(i, v)}
            onNumChange={v => setRot(i, v)}
          />
        ))}
      </div>

      <div className={styles.divider} />

      {/* Scale */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Масштаб</div>
        <label className={styles.uniformRow}>
          <input type="checkbox" checked={uniformScale} onChange={toggleUniform} />
          Единый масштаб
        </label>
        {AXES.map((a, i) => (
          <SliderRow
            key={a}
            label={a.toUpperCase()}
            value={+scale[i].toPrecision(5)}
            min={0} max={1000} step={0.01}
            defaultValue={1}
            sliderValue={scaleToSlider(scale[i])}
            disabled={uniformScale && i > 0}
            onSliderChange={v => handleScaleSlider(i, v)}
            onNumChange={v => handleScaleNum(i, v)}
          />
        ))}
      </div>

    </div>
  )
}
