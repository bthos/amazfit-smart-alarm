// Runs the ACTUAL app source files (page/*.js, app.js, utils/*.js) under
// plain Node, against hand-written mocks of the @zos/* device APIs
// (node_modules/@zos/*) plus minimal Page/App/getApp globals. This is not a
// substitute for running on a real watch or the official simulator (neither
// is available in this environment - see README), but it does exercise the
// app's actual logic end to end: rendering, user interaction callbacks,
// native-timer scheduling, storage persistence, and the smart-wake decision
// path - and fails loudly (non-zero exit) if any of it throws or behaves
// unexpectedly.
//
// Run with: npm test   (needs the --import ./test/register.mjs loader hook
// for extensionless relative imports, see package.json)

import * as uiMock from '@zos/ui'
import * as routerMock from '@zos/router'
import * as alarmMock from '@zos/alarm'
import * as sensorMock from '@zos/sensor'
import { __resetAllMockStorage } from '@zos/storage'

let passCount = 0
function ok(cond, msg) {
  if (!cond) throw new Error(`FAILED: ${msg}`)
  passCount++
  console.log(`  ok - ${msg}`)
}

function resetAllMocks() {
  uiMock.__mock.reset()
  routerMock.__mock.reset()
  alarmMock.__mock.reset()
  sensorMock.__mock.reset()
  __resetAllMockStorage()
}

// --- global Page/App/getApp, matching the real Zepp OS device runtime ---
const registeredPages = []
let currentApp = null

globalThis.Page = (def) => {
  registeredPages.push(def)
  return def
}
globalThis.App = (def) => {
  currentApp = { _options: { globalData: def.globalData }, _def: def }
  return def
}
globalThis.getApp = () => currentApp

resetAllMocks()

// Import order defines registeredPages[0..2]. Must be dynamic (not static
// top-level import) so it runs *after* the globals above are installed.
await import('../app.js')
await import('../page/index.page.js')
await import('../page/edit.page.js')
await import('../page/ring.page.js')

const appDef = currentApp._def
const [indexPage, editPage, ringPage] = registeredPages

// Every alarm firing is a brand-new mini-program launch on a real watch, so
// page/ring.page.js's `state` object literal is re-evaluated fresh each
// time. This test process instead imports the page module once and reuses
// the same `def`, so each simulated "launch" must reset ring.page's state
// by hand to match that real-world fresh-process behavior.
function freshRingPageState() {
  ringPage.state = { alarm: null, wake: null, ringing: false, vibrator: null, widgets: [] }
}

const byText = (text) => uiMock.__mock.created.find((w) => w._opts.text === text)
const allByType = (type) => uiMock.__mock.created.filter((w) => w._type === type)
const singleLetterButtons = () =>
  uiMock.__mock.created.filter((w) => w._type === 'WIDGET_BUTTON' && typeof w._opts.text === 'string' && w._opts.text.length === 1)

console.log('\n1. utils/alarm-scheduler.js: computeNextTimestamp')
{
  const { computeNextTimestamp } = await import('../utils/alarm-scheduler.js')

  const wed = new Date(2026, 0, 7, 10, 0, 0) // Wed Jan 7 2026, 10:00
  ok(wed.getDay() === 3, 'sanity: Jan 7 2026 is a Wednesday')

  const laterToday = computeNextTimestamp(11, 0, 0, wed)
  ok(laterToday === Math.floor(new Date(2026, 0, 7, 11, 0, 0).getTime() / 1000), 'one-time alarm later today fires today')

  const earlierToday = computeNextTimestamp(9, 0, 0, wed)
  ok(earlierToday === Math.floor(new Date(2026, 0, 8, 9, 0, 0).getTime() / 1000), 'one-time alarm earlier today rolls to tomorrow')

  // bit0=Mon .. bit6=Sun. From Wed, "next Monday" should be +5 days.
  const nextMonday = computeNextTimestamp(8, 0, 0b0000001, wed)
  ok(nextMonday === Math.floor(new Date(2026, 0, 12, 8, 0, 0).getTime() / 1000), 'weekday bitmask finds next matching day (Mon from Wed)')

  // Same day, still in the future -> fires today, not next week.
  const laterTodayMasked = computeNextTimestamp(23, 0, 0b0000100, wed) // bit2 = Wed
  ok(laterTodayMasked === Math.floor(new Date(2026, 0, 7, 23, 0, 0).getTime() / 1000), 'weekday bitmask fires today when today matches and time is still ahead')
}

console.log('\n2. page/index.page.js: empty state')
{
  resetAllMocks()
  indexPage.build()
  ok(byText('No alarms yet.\nTap + to add one.') !== undefined, 'empty alarm list shows the empty-state message')
  ok(byText('+') !== undefined, 'add button is always rendered')
}

console.log('\n3. page/edit.page.js: create a new alarm end to end')
{
  resetAllMocks()
  editPage.onInit('id=0')
  ok(editPage.state.isNew === true, 'onInit with id=0 starts a new draft alarm')

  editPage.build()
  ok(byText('Save') !== undefined, 'settings screen renders a Save button')
  ok(byText('Del') === undefined, 'a new (unsaved) alarm has no Delete button')
  ok(singleLetterButtons().length === 7, 'seven weekday toggle buttons are rendered')
  ok(allByType('WIDGET_SLIDE_SWITCH').length === 2, 'native SLIDE_SWITCH widgets are used for Alarm-enabled and Smart-Wake')

  // Open the native time picker and complete a selection.
  const timeButton = uiMock.__mock.created.find((w) => /^\d\d:\d\d$/.test(w._opts.text))
  ok(timeButton !== undefined, 'time button shows the current HH:MM')
  timeButton._opts.click_func()
  const picker = allByType('WIDGET_WIDGET_TIME_PICKER')[0]
  ok(picker !== undefined, 'tapping the time button opens the native TIME_PICKER')
  picker.__testHour = 7
  picker.__testMinute = 30
  picker._opts.picker_cb(picker, 2) // 2 = complete
  ok(editPage.state.alarm.hour === 7 && editPage.state.alarm.minute === 30, 'completing the picker updates the alarm time')
  ok(byText('07:30') !== undefined, 'settings screen re-renders showing the new time')

  // Toggle Monday on.
  const mondayButton = singleLetterButtons()[0]
  mondayButton._opts.click_func()
  ok((editPage.state.alarm.days & 0b1) === 0b1, 'toggling the first weekday button sets bit 0 (Monday)')

  // Turn Smart Wake on via its native SLIDE_SWITCH.
  const smartSwitch = allByType('WIDGET_SLIDE_SWITCH')[1]
  smartSwitch._opts.checked_change_func(smartSwitch, true)
  ok(editPage.state.alarm.smart === true, 'flipping the Smart Wake switch sets alarm.smart')
  ok(byText('Wake window: 20 min before') !== undefined, 'enabling Smart Wake reveals the wake-window row')

  // Save.
  byText('Save')._opts.click_func()
  ok(routerMock.__mock.calls.some((c) => c.fn === 'back'), 'Save navigates back')
  ok(alarmMock.__mock.active.size === 2, 'saving a repeating Smart-Wake alarm arms exactly 2 native timers (final + check)')

  const { getAlarms } = await import('../utils/alarm-store.js')
  const saved = getAlarms()
  ok(saved.length === 1, 'exactly one alarm is persisted')
  ok(saved[0].hour === 7 && saved[0].minute === 30 && saved[0].smart === true, 'persisted alarm matches what was edited')
}

console.log('\n4. page/index.page.js: non-empty state')
{
  uiMock.__mock.reset()
  indexPage.build()
  ok(byText(undefined) === undefined, 'sanity no-op')
  const row = uiMock.__mock.created.find((w) => w._type === 'WIDGET_BUTTON' && String(w._opts.text).startsWith('07:30'))
  ok(row !== undefined, 'the saved alarm shows up as a row in the list')
}

console.log('\n5. page/ring.page.js: alarm fires at the exact time (mode "final")')
{
  const { getAlarms } = await import('../utils/alarm-store.js')
  const alarm = getAlarms()[0]
  const finalIdBefore = alarm.nativeIds.final

  uiMock.__mock.reset()
  routerMock.__mock.reset()
  sensorMock.__mock.reset()
  freshRingPageState()
  appDef.onCreate(JSON.stringify({ id: alarm.id, mode: 'final' }))
  ok(currentApp._options.globalData.wakeParams.mode === 'final', "app.js onCreate stashes the alarm's param on globalData")

  ringPage.onInit()
  ok(ringPage.state.ringing === true, 'a "final" wake always starts ringing')
  ok(currentApp._options.globalData.wakeParams === null, 'wakeParams is consumed (cleared) so it cannot be replayed')

  ringPage.build()
  ok(byText('Wake up!') !== undefined, 'ringing screen shows the plain wake-up message (not the smart-wake one)')
  ok(byText('Dismiss') !== undefined && byText('Snooze 9m') !== undefined, 'Dismiss and Snooze buttons are rendered')
  ok(sensorMock.__mock.vibrations.some((v) => v.action === 'start'), 'dismissing starts the vibration motor')

  byText('Dismiss')._opts.click_func()
  ok(sensorMock.__mock.vibrations.some((v) => v.action === 'stop'), 'Dismiss stops the vibration motor')
  ok(routerMock.__mock.calls.some((c) => c.fn === 'exit'), 'Dismiss exits the mini-program')

  const rearmed = getAlarms()[0]
  ok(rearmed.enabled === true, 'a repeating alarm stays enabled after ringing')
  ok(rearmed.nativeIds.final !== finalIdBefore, 'dismissing a repeating alarm re-arms a fresh native timer for its next occurrence')
}

console.log('\n6. page/ring.page.js: smart-wake check with no signal re-arms silently')
{
  const { getAlarms } = await import('../utils/alarm-store.js')
  const alarm = getAlarms()[0]
  sensorMock.__mock.heartRate = { last: 60, resting: 60 } // no rise -> no early wake

  uiMock.__mock.reset()
  routerMock.__mock.reset()
  alarmMock.__mock.reset()
  const finalTime = Math.floor(Date.now() / 1000) + 600
  freshRingPageState()
  appDef.onCreate(JSON.stringify({ id: alarm.id, mode: 'smart-check', checksRemaining: 3, finalTime }))
  ringPage.onInit()
  ok(ringPage.state.ringing === false, 'no heart-rate rise means this check does not start ringing')
  ok(alarmMock.__mock.active.size === 1, 'a follow-up check timer is armed for ~2 minutes later')
  ok(routerMock.__mock.calls.some((c) => c.fn === 'exit'), 'a silent check still exits so the screen does not stay on')

  ringPage.build()
  ok(uiMock.__mock.created.length === 0, 'a silent (non-ringing) check renders nothing to the screen')
}

console.log('\n7. page/ring.page.js: smart-wake check WITH a heart-rate rise wakes early')
{
  const { getAlarms } = await import('../utils/alarm-store.js')
  const alarm = getAlarms()[0]
  sensorMock.__mock.heartRate = { last: 78, resting: 60 } // +18 bpm -> above SMART_HR_DELTA

  uiMock.__mock.reset()
  routerMock.__mock.reset()
  sensorMock.__mock.reset()
  sensorMock.__mock.heartRate = { last: 78, resting: 60 }
  const finalTime = Math.floor(Date.now() / 1000) + 600
  freshRingPageState()
  appDef.onCreate(JSON.stringify({ id: alarm.id, mode: 'smart-check', checksRemaining: 2, finalTime }))
  ringPage.onInit()
  ok(ringPage.state.ringing === true, 'a heart-rate rise during the window triggers ringing early')

  ringPage.build()
  ok(byText('Light sleep detected\nRise and shine') !== undefined, 'the early-wake screen shows the smart-wake message')
  ok(sensorMock.__mock.vibrations.some((v) => v.action === 'start'), 'vibration starts for the early wake too')

  byText('Snooze 9m')._opts.click_func()
  ok(sensorMock.__mock.vibrations.some((v) => v.action === 'stop'), 'Snooze stops the vibration motor')
  ok(routerMock.__mock.calls.some((c) => c.fn === 'exit'), 'Snooze exits the mini-program')
}

console.log('\n8. delete flow')
{
  const { getAlarms } = await import('../utils/alarm-store.js')
  const alarm = getAlarms()[0]

  uiMock.__mock.reset()
  routerMock.__mock.reset()
  editPage.onInit(`id=${alarm.id}`)
  ok(editPage.state.isNew === false, 'onInit with an existing id loads it for editing')
  editPage.build()
  ok(byText('Del') !== undefined, 'editing an existing alarm shows a Delete button')
  byText('Del')._opts.click_func()
  ok(getAlarms().length === 0, 'Delete removes the alarm from storage')
  ok(alarmMock.__mock.active.size === 0, 'Delete cancels its native timers')
  ok(routerMock.__mock.calls.some((c) => c.fn === 'back'), 'Delete navigates back')
}

console.log(`\nALL ${passCount} CHECKS PASSED`)
