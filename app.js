App({
  globalData: {
    // Populated below when the app is woken by a @zos/alarm timer. The
    // alarm's `param` string is only ever delivered here, to app.js
    // onCreate - never to the target page's own onInit - so page/ring.page
    // reads it back out of globalData instead.
    wakeParams: null,
  },

  onCreate(params) {
    if (!params) return
    try {
      this.globalData.wakeParams = JSON.parse(params)
    } catch (e) {
      this.globalData.wakeParams = null
    }
  },

  onDestroy() {},
})
