export const __mock = {
  calls: [],
  reset() {
    this.calls = []
  },
}

export function push(opts) {
  __mock.calls.push({ fn: 'push', opts })
}

export function back() {
  __mock.calls.push({ fn: 'back' })
}

export function exit() {
  __mock.calls.push({ fn: 'exit' })
}

export function replace(opts) {
  __mock.calls.push({ fn: 'replace', opts })
}
