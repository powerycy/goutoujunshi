const Analysis = require('../../services/analysis-api')
const Copy = require('../../config/copy')

Page({
  data: { analysisId: '', step: 0, steps: Copy.loadingSteps, status: 'queued', message: '', attempts: 0 },
  onLoad(options) { this.setData({ analysisId: options.id || '' }); this.start() },
  onUnload() { this.stopped = true; if (this.timer) clearTimeout(this.timer) },
  async start() {
    if (!this.data.analysisId) { this.setData({ message: '分析任务编号缺失，请返回重试。' }); return }
    await this.poll()
  },
  async poll() {
    if (this.stopped) return
    try {
      const task = await Analysis.get(this.data.analysisId)
      if (task.status === 'delivered' || task.status === 'blocked' || task.status === 'failed') {
        wx.redirectTo({ url: `/pages/analysis-result/index?id=${this.data.analysisId}` })
        return
      }
      const nextStep = Math.min(2, this.data.step + (task.status === 'running' ? 1 : 0))
      this.setData({ status: task.status, step: nextStep, attempts: this.data.attempts + 1 })
      this.timer = setTimeout(() => this.poll(), 1400)
    } catch (error) {
      if (this.data.attempts < 3) { this.setData({ attempts: this.data.attempts + 1 }); this.timer = setTimeout(() => this.poll(), 1600); return }
      this.setData({ message: '暂时连接不上分析服务。任务仍保存在服务端，可在历史分析中稍后查看。' })
    }
  },
  goHistory() { wx.redirectTo({ url: '/pages/history/index' }) },
  goHome() { wx.reLaunch({ url: '/pages/home/index' }) }
})
