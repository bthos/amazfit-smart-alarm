import { createWidget, widget, align, text_style, prop, deleteWidget } from '@zos/ui'
import { back } from '@zos/router'
import { px } from '@zos/utils'
import {
  getAlarmById,
  createDraftAlarm,
  removeAlarm,
  nextAlarmId,
  upsertAlarm,
} from '../utils/alarm-store'
import { scheduleAlarm, cancelNative } from '../utils/alarm-scheduler'
import { COLOR, WEEKDAYS, SMART_WINDOWS, formatTime } from '../utils/constants'

function parseParams(paramsStr) {
  const out = {}
  ;(paramsStr || '').split('&').forEach((pair) => {
    const [k, v] = pair.split('=')
    if (k) out[k] = v
  })
  return out
}

Page({
  state: {
    alarm: null,
    isNew: true,
    mode: 'settings', // 'settings' | 'time'
    widgets: [],
  },

  onInit(paramsStr) {
    const { id } = parseParams(paramsStr)
    const numId = Number(id) || 0

    if (numId) {
      const existing = getAlarmById(numId)
      this.state.alarm = existing || createDraftAlarm()
      this.state.isNew = !existing
    } else {
      this.state.alarm = createDraftAlarm()
      this.state.isNew = true
    }
  },

  build() {
    this.render()
  },

  clear() {
    this.state.widgets.forEach((w) => deleteWidget(w))
    this.state.widgets = []
  },

  track(w) {
    this.state.widgets.push(w)
    return w
  },

  render() {
    this.clear()
    if (this.state.mode === 'time') {
      this.renderTimePicker()
    } else {
      this.renderSettings()
    }
  },

  renderTimePicker() {
    const alarm = this.state.alarm
    this.track(
      createWidget(widget.WIDGET_TIME_PICKER, {
        type: 0,
        style: 1,
        title: 'Alarm time',
        font_size: px(32),
        select_font_size: px(46),
        initHour: alarm.hour,
        initMin: alarm.minute,
        picker_cb: (pickerWidget, eventType) => {
          if (eventType === 2) {
            alarm.hour = pickerWidget.getProperty(prop.HOUR)
            alarm.minute = pickerWidget.getProperty(prop.MINUTE)
          }
          if (eventType === 0 || eventType === 2) {
            this.state.mode = 'settings'
            this.render()
          }
        },
      })
    )
  },

  setEnabled(checked) {
    this.state.alarm.enabled = checked
  },

  toggleDay(bitIndex) {
    this.state.alarm.days ^= 1 << bitIndex
    this.render()
  },

  setSmart(checked) {
    this.state.alarm.smart = checked
    this.render()
  },

  /** A label + native SLIDE_SWITCH row. Returns the row height used. */
  renderSwitchRow(y, labelText, checked, onChange) {
    const h = 56
    this.track(
      createWidget(widget.TEXT, {
        x: px(16),
        y: px(y),
        w: px(280),
        h: px(h),
        text: labelText,
        text_size: px(28),
        color: COLOR.text,
        align_h: align.LEFT,
        align_v: align.CENTER_V,
        text_style: text_style.NONE,
      })
    )
    this.track(
      createWidget(widget.SLIDE_SWITCH, {
        x: px(320),
        y: px(y),
        w: px(96),
        h: px(56),
        select_bg: 'switch_on.png',
        un_select_bg: 'switch_off.png',
        slide_src: 'switch_knob.png',
        slide_select_x: px(44),
        slide_un_select_x: px(4),
        slide_y: px(4),
        checked,
        checked_change_func: (_widget, isChecked) => onChange(isChecked),
      })
    )
    return h
  },

  cycleSmartWindow() {
    const alarm = this.state.alarm
    const idx = SMART_WINDOWS.indexOf(alarm.smartWindow)
    alarm.smartWindow = SMART_WINDOWS[(idx + 1) % SMART_WINDOWS.length]
    this.render()
  },

  saveAndExit() {
    const alarm = this.state.alarm
    if (this.state.isNew) {
      alarm.id = nextAlarmId()
    }
    if (alarm.enabled) {
      scheduleAlarm(alarm)
    } else {
      cancelNative(alarm)
      upsertAlarm(alarm)
    }
    back()
  },

  deleteAndExit() {
    const alarm = this.state.alarm
    cancelNative(alarm)
    removeAlarm(alarm.id)
    back()
  },

  renderSettings() {
    const alarm = this.state.alarm

    this.track(
      createWidget(widget.BUTTON, {
        x: px(10),
        y: px(10),
        w: px(80),
        h: px(50),
        radius: px(14),
        normal_color: COLOR.surface,
        press_color: COLOR.border,
        text: 'Back',
        text_size: px(24),
        click_func: () => back(),
      })
    )

    if (!this.state.isNew) {
      this.track(
        createWidget(widget.BUTTON, {
          x: px(342),
          y: px(10),
          w: px(80),
          h: px(50),
          radius: px(14),
          normal_color: COLOR.surface,
          press_color: COLOR.danger,
          text: 'Del',
          text_size: px(24),
          click_func: () => this.deleteAndExit(),
        })
      )
    }

    let y = 70

    this.track(
      createWidget(widget.BUTTON, {
        x: px(16),
        y: px(y),
        w: px(400),
        h: px(90),
        radius: px(20),
        normal_color: COLOR.surfaceAlt,
        press_color: COLOR.border,
        text: formatTime(alarm.hour, alarm.minute),
        text_size: px(56),
        click_func: () => {
          this.state.mode = 'time'
          this.render()
        },
      })
    )
    y += 90 + 10

    y += this.renderSwitchRow(y, 'Alarm enabled', alarm.enabled, (checked) =>
      this.setEnabled(checked)
    )
    y += 12

    const dayW = 52
    const dayGap = 6
    WEEKDAYS.forEach((day, i) => {
      const active = (alarm.days & (1 << i)) !== 0
      this.track(
        createWidget(widget.BUTTON, {
          x: px(16 + i * (dayW + dayGap)),
          y: px(y),
          w: px(dayW),
          h: px(52),
          radius: px(12),
          normal_color: active ? COLOR.primary : COLOR.surface,
          press_color: COLOR.primaryDim,
          text: day.label,
          text_size: px(24),
          click_func: () => this.toggleDay(i),
        })
      )
    })
    y += 52 + 12

    y += this.renderSwitchRow(y, 'Smart Wake', alarm.smart, (checked) =>
      this.setSmart(checked)
    )
    y += 10

    if (alarm.smart) {
      this.track(
        createWidget(widget.BUTTON, {
          x: px(16),
          y: px(y),
          w: px(400),
          h: px(48),
          radius: px(14),
          normal_color: COLOR.surface,
          press_color: COLOR.border,
          text: `Wake window: ${alarm.smartWindow} min before`,
          text_size: px(22),
          click_func: () => this.cycleSmartWindow(),
        })
      )
      y += 48 + 10
    }

    this.track(
      createWidget(widget.BUTTON, {
        x: px(16),
        y: px(y),
        w: px(400),
        h: px(60),
        radius: px(18),
        normal_color: COLOR.primary,
        press_color: COLOR.primaryDim,
        text: 'Save',
        text_size: px(30),
        click_func: () => this.saveAndExit(),
      })
    )
  },

  onDestroy() {
    this.clear()
  },
})
