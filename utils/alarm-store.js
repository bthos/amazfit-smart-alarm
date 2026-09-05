import { LocalStorage } from '@zos/storage'
import { STORAGE_KEY_ALARMS, STORAGE_KEY_NEXT_ID } from './constants'

const storage = new LocalStorage()

/**
 * @typedef {Object} Alarm
 * @property {number} id
 * @property {number} hour
 * @property {number} minute
 * @property {number} days - bitmask, bit 0 = Monday .. bit 6 = Sunday, 0 = one-time
 * @property {boolean} enabled
 * @property {boolean} smart
 * @property {number} smartWindow - minutes
 * @property {{ final: number, check: number }} nativeIds - ids returned by @zos/alarm set(), 0 = none
 */

export function getAlarms() {
  return storage.getItem(STORAGE_KEY_ALARMS, [])
}

export function saveAlarms(alarms) {
  storage.setItem(STORAGE_KEY_ALARMS, alarms)
}

export function getAlarmById(id) {
  return getAlarms().find((a) => a.id === id)
}

export function upsertAlarm(alarm) {
  const alarms = getAlarms()
  const index = alarms.findIndex((a) => a.id === alarm.id)
  if (index >= 0) {
    alarms[index] = alarm
  } else {
    alarms.push(alarm)
  }
  saveAlarms(alarms)
  return alarm
}

export function removeAlarm(id) {
  saveAlarms(getAlarms().filter((a) => a.id !== id))
}

export function nextAlarmId() {
  const id = storage.getItem(STORAGE_KEY_NEXT_ID, 1)
  storage.setItem(STORAGE_KEY_NEXT_ID, id + 1)
  return id
}

export function createDraftAlarm() {
  const now = new Date()
  return {
    id: 0, // 0 = unsaved draft
    hour: now.getHours(),
    minute: now.getMinutes(),
    days: 0,
    enabled: true,
    smart: false,
    smartWindow: 20,
    nativeIds: { final: 0, check: 0 },
  }
}
