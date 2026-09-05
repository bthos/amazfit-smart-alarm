import { createWidget, widget, align, text_style, deleteWidget } from '@zos/ui'
import { exit } from '@zos/router'
import { px } from '@zos/utils'
import { Vibrator, VIBRATOR_SCENE_CALL, HeartRate } from '@zos/sensor'
import { getAlarmById } from '../utils/alarm-store'
import { scheduleNextCheck, rearmAfterRing, snooze } from '../utils/alarm-scheduler'
import { COLOR, SMART_HR_DELTA, SNOOZE_MINUTES, formatTime } from '../utils/constants'

function checkForWakeSignal() {
  try {
    const hr = new HeartRate()
    const last = hr.getLast()
    const resting = hr.getResting()
    if (last && resting && last - resting >= SMART_HR_DELTA) {
      return true
    }
  } catch (e) {
    // Sensor not available/ready - fall through and keep waiting for the
    // final alarm instead of failing the whole check.
  }
  return false
}

Page({
  state: {
    alarm: null,
    wake: null,
    ringing: false,
    vibrator: null,
    widgets: [],
  },

  onInit() {
    const globalData = getApp()._options.globalData
    const wake = globalData.wakeParams
    globalData.wakeParams = null // consume it so a later manual open doesn't reuse stale data
    this.state.wake = wake

    if (!wake || !wake.id) {
      exit()
      return
    }

    const alarm = getAlarmById(wake.id)
    this.state.alarm = alarm

    if (!alarm || !alarm.enabled) {
      exit()
      return
    }

    if (wake.mode === 'smart-check') {
      if (checkForWakeSignal()) {
        this.state.ringing = true
      } else {
        const remaining = (wake.checksRemaining || 1) - 1
        const nowSec = Math.floor(Date.now() / 1000)
        if (remaining > 0 && nowSec < wake.finalTime) {
          scheduleNextCheck(alarm, remaining, wake.finalTime)
        }
        exit()
      }
    } else {
      this.state.ringing = true
    }
  },

  build() {
    if (!this.state.ringing) return

    const alarm = this.state.alarm
    const early = this.state.wake.mode === 'smart-check'

    this.track(
      createWidget(widget.FILL_RECT, {
        x: px(0),
        y: px(0),
        w: px(432),
        h: px(514),
        color: COLOR.background,
      })
    )

    this.track(
      createWidget(widget.TEXT, {
        x: px(20),
        y: px(150),
        w: px(392),
        h: px(100),
        text: formatTime(alarm.hour, alarm.minute),
        text_size: px(80),
        color: COLOR.text,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
        text_style: text_style.NONE,
      })
    )

    this.track(
      createWidget(widget.TEXT, {
        x: px(20),
        y: px(260),
        w: px(392),
        h: px(60),
        text: early ? 'Light sleep detected\nRise and shine' : 'Wake up!',
        text_size: px(28),
        color: COLOR.primary,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
        text_style: text_style.WRAP,
      })
    )

    this.track(
      createWidget(widget.BUTTON, {
        x: px(40),
        y: px(370),
        w: px(160),
        h: px(90),
        radius: px(20),
        normal_color: COLOR.surfaceAlt,
        press_color: COLOR.border,
        text: `Snooze ${SNOOZE_MINUTES}m`,
        text_size: px(22),
        click_func: () => this.onSnooze(),
      })
    )

    this.track(
      createWidget(widget.BUTTON, {
        x: px(232),
        y: px(370),
        w: px(160),
        h: px(90),
        radius: px(20),
        normal_color: COLOR.primary,
        press_color: COLOR.primaryDim,
        text: 'Dismiss',
        text_size: px(26),
        click_func: () => this.onDismiss(),
      })
    )

    this.startVibration()
  },

  startVibration() {
    const vibrator = new Vibrator()
    vibrator.setMode(VIBRATOR_SCENE_CALL)
    vibrator.start()
    this.state.vibrator = vibrator
  },

  stopVibration() {
    if (this.state.vibrator) {
      this.state.vibrator.stop()
      this.state.vibrator = null
    }
  },

  onSnooze() {
    this.stopVibration()
    snooze(this.state.alarm, SNOOZE_MINUTES)
    exit()
  },

  onDismiss() {
    this.stopVibration()
    rearmAfterRing(this.state.alarm)
    exit()
  },

  track(w) {
    this.state.widgets.push(w)
    return w
  },

  onDestroy() {
    this.stopVibration()
    this.state.widgets.forEach((w) => deleteWidget(w))
    this.state.widgets = []
  },
})
