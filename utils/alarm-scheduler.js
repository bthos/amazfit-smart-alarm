import { set, cancel } from '@zos/alarm'
import { SMART_CHECK_INTERVAL_SEC } from './constants'
import { upsertAlarm } from './alarm-store'

const RING_URL = 'page/ring.page'

/**
 * Next UTC timestamp (seconds) at which `hour:minute` occurs, respecting the
 * `days` weekday bitmask (bit 0 = Monday .. bit 6 = Sunday). `days === 0`
 * means "next time this clock time occurs" (today or tomorrow).
 */
export function computeNextTimestamp(hour, minute, days, from = new Date()) {
  const base = new Date(from)
  base.setSeconds(0, 0)

  if (!days) {
    const candidate = new Date(base)
    candidate.setHours(hour, minute, 0, 0)
    if (candidate.getTime() <= from.getTime()) {
      candidate.setDate(candidate.getDate() + 1)
    }
    return Math.floor(candidate.getTime() / 1000)
  }

  for (let offset = 0; offset < 8; offset++) {
    const candidate = new Date(base)
    candidate.setDate(candidate.getDate() + offset)
    candidate.setHours(hour, minute, 0, 0)

    // JS getDay(): 0 = Sunday .. 6 = Saturday. Our bitmask bit index: 0 = Monday .. 6 = Sunday.
    const jsDay = candidate.getDay()
    const bitIndex = jsDay === 0 ? 6 : jsDay - 1
    const matchesDay = (days & (1 << bitIndex)) !== 0
    const isInFuture = candidate.getTime() > from.getTime()

    if (matchesDay && isInFuture) {
      return Math.floor(candidate.getTime() / 1000)
    }
  }

  // Unreachable in practice (a full week is scanned above).
  return Math.floor(base.getTime() / 1000)
}

function cancelIfSet(id) {
  if (id) cancel(id)
}

export function cancelNative(alarm) {
  cancelIfSet(alarm.nativeIds && alarm.nativeIds.final)
  cancelIfSet(alarm.nativeIds && alarm.nativeIds.check)
  alarm.nativeIds = { final: 0, check: 0 }
}

/**
 * Arms (or re-arms) the native OS timers for an alarm: the exact-time "final"
 * alarm, and, if smart-wake is on, an earlier "check" alarm that starts
 * polling heart rate at the start of the wake window.
 */
export function scheduleAlarm(alarm) {
  cancelNative(alarm)

  const targetTime = computeNextTimestamp(alarm.hour, alarm.minute, alarm.days)

  alarm.nativeIds.final = set({
    url: RING_URL,
    time: targetTime,
    store: true,
    param: JSON.stringify({ id: alarm.id, mode: 'final' }),
  })

  if (alarm.smart) {
    const windowStart = targetTime - alarm.smartWindow * 60
    const checksAvailable = Math.max(
      1,
      Math.floor((alarm.smartWindow * 60) / SMART_CHECK_INTERVAL_SEC)
    )
    const firstCheckTime = Math.max(windowStart, Math.floor(Date.now() / 1000) + 5)

    alarm.nativeIds.check = set({
      url: RING_URL,
      time: firstCheckTime,
      store: true,
      param: JSON.stringify({
        id: alarm.id,
        mode: 'smart-check',
        checksRemaining: checksAvailable,
        finalTime: targetTime,
      }),
    })
  }

  upsertAlarm(alarm)
  return alarm
}

/** Schedules the next periodic heart-rate check within a wake window. */
export function scheduleNextCheck(alarm, checksRemaining, finalTime) {
  cancelIfSet(alarm.nativeIds.check)

  alarm.nativeIds.check = set({
    url: RING_URL,
    delay: SMART_CHECK_INTERVAL_SEC,
    store: true,
    param: JSON.stringify({
      id: alarm.id,
      mode: 'smart-check',
      checksRemaining,
      finalTime,
    }),
  })

  upsertAlarm(alarm)
}

/** Called once the ring screen has been dismissed (or snoozed-and-later-fired). */
export function rearmAfterRing(alarm) {
  cancelNative(alarm)

  if (alarm.days) {
    // Repeating alarm: arm the next occurrence.
    scheduleAlarm(alarm)
  } else {
    // One-shot alarm: it has done its job.
    alarm.enabled = false
    upsertAlarm(alarm)
  }
}

export function snooze(alarm, minutes) {
  cancelNative(alarm)
  alarm.nativeIds.final = set({
    url: RING_URL,
    delay: minutes * 60,
    store: true,
    param: JSON.stringify({ id: alarm.id, mode: 'final' }),
  })
  upsertAlarm(alarm)
}
