// Test-only mock of the @zos/ui module. Not used by the real Zepp OS build
// (rollup/QJSC never sees this file) - only by test/run.mjs under plain Node.

export const widget = new Proxy(
  {},
  {
    get(_target, key) {
      return `WIDGET_${String(key)}`
    },
  }
)

export const align = { LEFT: 'LEFT', RIGHT: 'RIGHT', CENTER_H: 'CENTER_H', TOP: 'TOP', BOTTOM: 'BOTTOM', CENTER_V: 'CENTER_V' }
export const text_style = { NONE: 'NONE', WRAP: 'WRAP', ELLIPSIS: 'ELLIPSIS' }
export const prop = new Proxy(
  {},
  {
    get(_target, key) {
      return String(key)
    },
  }
)

export const __mock = {
  created: [],
  reset() {
    this.created = []
  },
}

class MockWidget {
  constructor(type, opts) {
    this._type = type
    this._opts = { ...opts }
    this._deleted = false
  }

  getProperty(key) {
    if (key === 'HOUR' && '__testHour' in this) return this.__testHour
    if (key === 'MINUTE' && '__testMinute' in this) return this.__testMinute
    return this._opts[key]
  }

  setProperty(key, value) {
    if (key === 'MORE' && typeof value === 'object') {
      Object.assign(this._opts, value)
    } else {
      this._opts[key] = value
    }
  }
}

export function createWidget(type, opts) {
  const w = new MockWidget(type, opts)
  __mock.created.push(w)
  return w
}

export function deleteWidget(w) {
  w._deleted = true
  const idx = __mock.created.indexOf(w)
  if (idx >= 0) __mock.created.splice(idx, 1)
}

export function getTextLayout(text) {
  return { width: String(text).length * 10, height: 20 }
}
