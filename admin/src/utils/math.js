// Quaternion → Euler (degrees, XYZ order)
export function quatToEulerDeg(qx, qy, qz, qw) {
  const sinr = 2*(qw*qx + qy*qz), cosr = 1 - 2*(qx*qx + qy*qy)
  const rx = Math.atan2(sinr, cosr)
  const sinp = 2*(qw*qy - qz*qx)
  const ry = Math.abs(sinp) >= 1 ? Math.sign(sinp)*Math.PI/2 : Math.asin(sinp)
  const siny = 2*(qw*qz + qx*qy), cosy = 1 - 2*(qy*qy + qz*qz)
  const rz = Math.atan2(siny, cosy)
  return [rx, ry, rz].map(r => +(r*180/Math.PI).toFixed(4))
}

// Euler (degrees, XYZ) → Quaternion
export function eulerDegToQuat(rx, ry, rz) {
  const r=rx*Math.PI/180, p=ry*Math.PI/180, y=rz*Math.PI/180
  const cr=Math.cos(r/2), sr=Math.sin(r/2)
  const cp=Math.cos(p/2), sp=Math.sin(p/2)
  const cy=Math.cos(y/2), sy=Math.sin(y/2)
  return [
    +(sr*cp*cy - cr*sp*sy).toFixed(12),
    +(cr*sp*cy + sr*cp*sy).toFixed(12),
    +(cr*cp*sy - sr*sp*cy).toFixed(12),
    +(cr*cp*cy + sr*sp*sy).toFixed(12),
  ]
}

// Logarithmic scale helpers for scale slider (0..1000 ↔ real value)
const LOG_MIN = 0.0001
const LOG_MAX = 25

export function scaleToSlider(v) {
  const lo = Math.log(LOG_MIN), hi = Math.log(LOG_MAX)
  return Math.round((Math.log(Math.max(LOG_MIN, Math.min(LOG_MAX, v))) - lo) / (hi - lo) * 1000)
}

export function sliderToScale(s) {
  const lo = Math.log(LOG_MIN), hi = Math.log(LOG_MAX)
  return +Math.exp(lo + (s/1000)*(hi - lo)).toPrecision(5)
}
