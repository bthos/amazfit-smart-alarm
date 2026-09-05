// Shared layout/design tokens. Coordinates are in design pixels (designWidth
// 432 in app.json) and must always be passed through px() before use in a
// widget so they scale correctly on-device.

export const DESIGN_WIDTH = 432
export const DESIGN_HEIGHT = 514

export const COLOR = {
  background: 0x000000,
  surface: 0x1c1c1e,
  surfaceAlt: 0x2c2c2e,
  primary: 0x3ddc97,
  primaryDim: 0x1f6b4c,
  danger: 0xef5350,
  text: 0xffffff,
  textDim: 0x8e8e93,
  border: 0x3a3a3c,
}

export const STORAGE_KEY_ALARMS = 'alarms'
export const STORAGE_KEY_NEXT_ID = 'nextAlarmId'

// Order matches the row of day-toggle buttons shown on the edit page.
export const WEEKDAYS = [
  { key: 'mon', label: 'M' },
  { key: 'tue', label: 'T' },
  { key: 'wed', label: 'W' },
  { key: 'thu', label: 'T' },
  { key: 'fri', label: 'F' },
  { key: 'sat', label: 'S' },
  { key: 'sun', label: 'S' },
]

// Smart-wake window choices, in minutes.
export const SMART_WINDOWS = [10, 20, 30]

// How often (seconds) the watch re-checks the wearer's heart rate while
// inside a smart-wake window.
export const SMART_CHECK_INTERVAL_SEC = 120

// Minimum bpm rise above resting heart rate that counts as a light-sleep /
// waking signal, good enough to wake the wearer early.
export const SMART_HR_DELTA = 6

// Snooze duration, in minutes.
export const SNOOZE_MINUTES = 9

export function formatTime(hour, minute) {
  const h = String(hour).padStart(2, '0')
  const m = String(minute).padStart(2, '0')
  return `${h}:${m}`
}

export function daysSummary(days) {
  if (!days) return 'Once'
  if (days === 0b1111111) return 'Every day'
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const picked = []
  for (let i = 0; i < 7; i++) {
    if (days & (1 << i)) picked.push(labels[i])
  }
  return picked.join(' ')
}
