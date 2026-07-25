const Beta = require('../../services/beta-api')
const Analysis = require('../../services/analysis-api')
const Events = require('../../services/events')
const Copy = require('../../config/copy')
const Auth = require('../../services/auth')

function getNavigationMetrics() {
  let statusBarHeight = 20
  let navContentHeight = 44
  try {
    const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    statusBarHeight = windowInfo.statusBarHeight || statusBarHeight
    if (wx.getMenuButtonBoundingClientRect) {
      const menuButton = wx.getMenuButtonBoundingClientRect()
      if (menuButton && menuButton.top && menuButton.height) {
        navContentHeight = Math.max(
          navContentHeight,
          (menuButton.top - statusBarHeight) * 2 + menuButton.height
        )
      }
    }
  } catch (error) {
    // Use stable WeChat defaults when device metrics are unavailable.
  }
  return {
    statusBarHeight,
    navContentHeight,
    navTotalHeight: statusBarHeight + navContentHeight
  }
}

function countMeaningfulChars(value) {
  return Array.from(String(value || '').replace(/\s/g, '')).length
}

const navigationMetrics = getNavigationMetrics()

Page({
  data: {
    statusBarHeight: navigationMetrics.statusBarHeight,
    navContentHeight: navigationMetrics.navContentHeight,
    navTotalHeight: navigationMetrics.navTotalHeight,
    benefit: null,
    apiError: false,
    question: '',
    submittedQuestion: '',
    charCount: 0,
    canSubmit: false,
    status: 'idle',
    result: null,
    error: '',
    analysisId: '',
    pollAttempts: 0,
    scrollTop: 0,
    consentConfirmed: false,
    inputPlaceholder: '你们是什么关系、发生了什么、你现在想判断什么...\n描述越详细，分析越准确哦～',
    aiDisclosure: Copy.aiDisclosure
  },

  onLoad() { this.load() },
  onShow() { if (this.data.benefit) this.load() },
  onUnload() { this.stopped = true; if (this.timer) clearTimeout(this.timer) },

  async load() {
    try {
      await getApp().ready()
      let benefit
      try {
        benefit = await Beta.getMine()
      } catch (error) {
        if (error && error.statusCode === 401) {
          Auth.clearSession()
          await getApp().ready(true)
          benefit = await Beta.getMine()
        } else {
          throw error
        }
      }
      this.setData({ benefit, apiError: false })
      Events.track('home_viewed')
    } catch (error) {
      this.setData({ apiError: true })
    }
  },

  updateQuestion(event) {
    const question = event.detail.value
    const charCount = countMeaningfulChars(question)
    this.setData({ question, charCount, canSubmit: charCount >= 30 })
  },

  confirmConsent() {
    if (this.data.consentConfirmed) return Promise.resolve(true)
    return new Promise((resolve) => {
      wx.showModal({
        title: '开始分析',
        content: '继续表示你已满 18 岁，并同意将本次关系信息发送至服务端和 AI 模型用于生成分析。请使用代号描述他人。',
        confirmText: '同意并发送',
        confirmColor: '#18c463',
        success: (result) => {
          if (result.confirm) this.setData({ consentConfirmed: true })
          resolve(Boolean(result.confirm))
        },
        fail: () => resolve(false)
      })
    })
  },

  async submit() {
    if (this.data.status === 'running') return
    const question = this.data.question.trim()
    if (countMeaningfulChars(question) < 30) {
      wx.showToast({ title: '再多说一点，至少 30 字', icon: 'none' })
      return
    }
    if (!this.data.benefit || this.data.benefit.trialAnalysisRemaining < 1) {
      wx.navigateTo({ url: '/pages/pricing/index' })
      return
    }
    const agreed = await this.confirmConsent()
    if (!agreed) return

    this.setData({
      submittedQuestion: question,
      question: '',
      charCount: 0,
      canSubmit: false,
      status: 'running',
      result: null,
      error: '',
      analysisId: '',
      pollAttempts: 0,
      scrollTop: Date.now()
    })

    try {
      const created = await Analysis.create({
        question,
        profile: {
          selfAlias: '我',
          targetAlias: 'A',
          relationshipStage: '其他',
          goal: '关系判断',
          emotionIntensity: 5
        },
        useTrialCredit: true,
        consent: { adultConfirmed: true, sensitiveDataProcessing: true }
      })
      Events.track('analysis_started_from_home')
      this.setData({ analysisId: created.analysisId })
      this.poll()
    } catch (error) {
      this.setData({ status: 'failed', error: error.message || '问题暂时未能提交。' })
    }
  },

  async poll() {
    if (this.stopped || !this.data.analysisId) return
    try {
      const task = await Analysis.get(this.data.analysisId)
      if (task.status === 'delivered' || task.status === 'blocked') {
        this.setData({ status: task.status, result: task.result, pollAttempts: 0, scrollTop: Date.now() })
        Events.track('analysis_completed_inline', { status: task.status, modelMode: task.modelMode || 'unknown' })
        this.load()
        return
      }
      if (task.status === 'failed') {
        this.setData({ status: 'failed', error: task.errorMessage || '分析没有成功，请稍后再试。', scrollTop: Date.now() })
        return
      }
      this.setData({ pollAttempts: this.data.pollAttempts + 1 })
      this.timer = setTimeout(() => this.poll(), 1400)
    } catch (error) {
      if (this.data.pollAttempts < 3) {
        this.setData({ pollAttempts: this.data.pollAttempts + 1 })
        this.timer = setTimeout(() => this.poll(), 1600)
        return
      }
      this.setData({ status: 'failed', error: '暂时连接不上分析服务。可稍后在历史判断中查看。' })
    }
  },

  goPricing() { wx.navigateTo({ url: '/pages/pricing/index' }) },
  goHistory() { wx.navigateTo({ url: '/pages/history/index' }) },
  goMe() { wx.navigateTo({ url: '/pages/me/index' }) },
  retry() { getApp().ready(true).then(() => this.load()).catch(() => this.setData({ apiError: true })) },
  stopPropagation() {}
})
