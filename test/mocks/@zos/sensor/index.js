export const __mock = {
  heartRate: { last: 60, resting: 58 },
  vibrations: [],
  reset() {
    this.heartRate = { last: 60, resting: 58 }
    this.vibrations = []
  },
}

export class HeartRate {
  getLast() {
    return __mock.heartRate.last
  }

  getResting() {
    return __mock.heartRate.resting
  }
}

export class Vibrator {
  setMode(mode) {
    this._mode = mode
  }

  start() {
    __mock.vibrations.push({ mode: this._mode, action: 'start' })
  }

  stop() {
    __mock.vibrations.push({ mode: this._mode, action: 'stop' })
  }
}

export const VIBRATOR_SCENE_CALL = 'VIBRATOR_SCENE_CALL'
