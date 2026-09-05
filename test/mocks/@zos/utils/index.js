// Identity scaling - designWidth-relative pixels aren't meaningful under Node.
export function px(v) {
  return v
}

export const log = {
  getLogger: () => ({
    log: () => {},
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  }),
}
