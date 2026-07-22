const Analysis = require('../../services/analysis-api')
const Copy = require('../../config/copy')
const Events = require('../../services/events')

Page({
  data: { analysisId: '', task: null, result: null, loading: true, aiDisclosure: Copy.aiDisclosure },
  onLoad(options) { this.setData({ analysisId: options.id || '' }); this.load() },
  async load() {
    try {
      const task = await Analysis.get(this.data.analysisId)
      this.setData({ task, result: task.result || null, loading: false })
      if (task.status === 'delivered') Events.track('trial_analysis_completed', { modelMode: task.modelMode || 'unknown' })
    } catch (error) { this.setData({ loading: false, error: error.message }) }
  },
  goHome() { wx.reLaunch({ url: '/pages/home/index' }) },
  goHistory() { wx.redirectTo({ url: '/pages/history/index' }) },
  newCase() { wx.reLaunch({ url: '/pages/home/index' }) }
})
