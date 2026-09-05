export const __mock = {
  nextId: 1,
  active: new Map(), // id -> options passed to set()
  reset() {
    this.nextId = 1
    this.active = new Map()
  },
}

export function set(options) {
  const id = __mock.nextId++
  __mock.active.set(id, options)
  return id
}

export function cancel(idOrOptions) {
  const id = typeof idOrOptions === 'object' ? idOrOptions.id : idOrOptions
  __mock.active.delete(id)
  return 0
}

export function getAllAlarms() {
  return Array.from(__mock.active.keys())
}

export const REPEAT_ONCE = 0
export const REPEAT_MINUTE = 1
export const REPEAT_HOUR = 2
export const REPEAT_DAY = 3
export const REPEAT_WEEK = 4
export const REPEAT_MONTH = 5
export const REPEAT_YEAR = 6
export const WEEK_MON = 1
export const WEEK_TUE = 2
export const WEEK_WED = 4
export const WEEK_THU = 8
export const WEEK_FRI = 16
export const WEEK_SAT = 32
export const WEEK_SUN = 64
