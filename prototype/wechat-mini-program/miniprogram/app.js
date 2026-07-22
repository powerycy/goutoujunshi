const Auth = require('./services/auth')

App({
  globalData: {
    appName: '狗头军师',
    apiMode: 'local-server',
    session: null,
    bootstrapPromise: null
  },

  onLaunch() {
    this.ready(false).catch(() => null)
  },

  ready(force) {
    if (!force && this.globalData.bootstrapPromise) return this.globalData.bootstrapPromise
    this.globalData.bootstrapPromise = Auth.ensureSession(Boolean(force))
      .then((session) => {
        this.globalData.session = session
        return session
      })
      .catch((error) => {
        console.warn('[bootstrap] local API unavailable', error && error.code)
        throw error
      })
    return this.globalData.bootstrapPromise
  }
})
