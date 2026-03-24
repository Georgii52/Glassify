import { useCallback } from 'react'
import styles from './SliderRow.module.css'

/**
 * A linked slider + number input pair.
 *
 * Props:
 *   label        - axis label ("X", "Y", "Z")
 *   value        - current numeric value
 *   min / max    - slider range (for linear sliders)
 *   step         - slider step
 *   sliderValue  - optional override for slider position (for log-scale sliders)
 *   onSliderChange(rawSliderValue) - called when slider moves
 *   onNumChange(value)             - called when number input changes
 *   disabled     - grays out both controls
 *   numStep      - step for number input (defaults to step)
 */
export default function SliderRow({
  label,
  value,
  min = -2, max = 2, step = 0.001,
  sliderValue,       // if provided, used for slider position instead of value
  onSliderChange,
  onNumChange,
  disabled = false,
  numStep,
}) {
  const handleSlider = useCallback(e => {
    onSliderChange?.(parseFloat(e.target.value))
  }, [onSliderChange])

  const handleNum = useCallback(e => {
    const v = parseFloat(e.target.value)
    if (!isNaN(v)) onNumChange?.(v)
  }, [onNumChange])

  const sliderPos = sliderValue !== undefined ? sliderValue : Math.max(min, Math.min(max, value))

  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={sliderPos}
        onChange={handleSlider}
        disabled={disabled}
        className={styles.slider}
      />
      <input
        type="number"
        value={value}
        step={numStep ?? step}
        onChange={handleNum}
        disabled={disabled}
        className={styles.num}
      />
    </div>
  )
}
