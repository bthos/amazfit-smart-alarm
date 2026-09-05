import { createWidget, widget, align, text_style, deleteWidget } from '@zos/ui'
import { push } from '@zos/router'
import { px } from '@zos/utils'
import { getAlarms } from '../utils/alarm-store'
import { COLOR, formatTime, daysSummary } from '../utils/constants'

const MAX_VISIBLE_ROWS = 5
const ROW_H = 72
const ROW_GAP = 10
const LIST_TOP = 92

Page({
  state: {
    widgets: [],
  },

  build() {
    this.render()
  },

  onShow() {
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

    this.track(
      createWidget(widget.TEXT, {
        x: px(20),
        y: px(16),
        w: px(260),
        h: px(56),
        text: 'Smart Alarm',
        text_size: px(36),
        color: COLOR.text,
        align_h: align.LEFT,
        align_v: align.CENTER_V,
        text_style: text_style.NONE,
      })
    )

    this.track(
      createWidget(widget.BUTTON, {
        x: px(336),
        y: px(14),
        w: px(76),
        h: px(58),
        radius: px(16),
        normal_color: COLOR.primary,
        press_color: COLOR.primaryDim,
        text: '+',
        text_size: px(40),
        click_func: () => {
          push({ url: 'page/edit.page', params: 'id=0' })
        },
      })
    )

    const alarms = getAlarms()
      .slice()
      .sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute))

    if (alarms.length === 0) {
      this.track(
        createWidget(widget.TEXT, {
          x: px(40),
          y: px(200),
          w: px(352),
          h: px(120),
          text: 'No alarms yet.\nTap + to add one.',
          text_size: px(28),
          color: COLOR.textDim,
          align_h: align.CENTER_H,
          align_v: align.CENTER_V,
          text_style: text_style.WRAP,
        })
      )
      return
    }

    alarms.slice(0, MAX_VISIBLE_ROWS).forEach((alarm, i) => {
      const y = LIST_TOP + i * (ROW_H + ROW_GAP)
      const subtitle = alarm.smart
        ? `${daysSummary(alarm.days)} · Smart`
        : daysSummary(alarm.days)

      this.track(
        createWidget(widget.BUTTON, {
          x: px(16),
          y: px(y),
          w: px(400),
          h: px(ROW_H),
          radius: px(16),
          normal_color: alarm.enabled ? COLOR.surfaceAlt : COLOR.surface,
          press_color: COLOR.border,
          text: `${formatTime(alarm.hour, alarm.minute)}   ${subtitle}${
            alarm.enabled ? '' : '  (off)'
          }`,
          text_size: px(26),
          click_func: () => {
            push({ url: 'page/edit.page', params: `id=${alarm.id}` })
          },
        })
      )
    })
  },

  onDestroy() {
    this.clear()
  },
})
