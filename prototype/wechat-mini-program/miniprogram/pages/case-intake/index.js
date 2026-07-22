const Beta = require('../../services/beta-api')
const Analysis = require('../../services/analysis-api')
const Events = require('../../services/events')
const Copy = require('../../config/copy')

Page({
  data: {
    benefit: null,
    question: '', targetAlias: 'A', relationshipStage: '暧昧', goal: '判断是否继续推进',
    emotionIntensity: 5, stages: ['刚认识', '暧昧', '约会中', '恋爱中', '婚姻/共同生活', '分手后', '其他'],
    goals: ['判断是否继续推进', '准备一次沟通', '修复冲突', '降低投入', '判断是否复合', '比较选择', '安全退出'],
    agreed: false, adultConfirmed: false, submitting: false, privacyShort: Copy.privacyShort
  },
  async onLoad() {
    try { await getApp().ready(); this.setData({ benefit: await Beta.getMine() }) } catch (_) {}
  },
  updateField(event) { this.setData({ [event.currentTarget.dataset.field]: event.detail.value }) },
  chooseStage(event) { this.setData({ relationshipStage: this.data.stages[Number(event.detail.value)] }) },
  chooseGoal(event) { this.setData({ goal: this.data.goals[Number(event.detail.value)] }) },
  changeEmotion(event) { this.setData({ emotionIntensity: Number(event.detail.value) }) },
  toggleAgreement() { this.setData({ agreed: !this.data.agreed }) },
  toggleAdult() { this.setData({ adultConfirmed: !this.data.adultConfirmed }) },
  goPricing() { wx.navigateTo({ url: '/pages/pricing/index' }) },
  async submitCase() {
    const question = this.data.question.trim()
    if (!this.data.benefit || this.data.benefit.trialAnalysisRemaining < 1) { this.goPricing(); return }
    if (!this.data.adultConfirmed || !this.data.agreed) { wx.showToast({ title: '请先确认成年与隐私告知', icon: 'none' }); return }
    if (question.length < 20) { wx.showToast({ title: '案情再多交代两句（至少20字）', icon: 'none' }); return }
    if (question.length > 4000) { wx.showToast({ title: '问题内容请控制在4000字内', icon: 'none' }); return }
    this.setData({ submitting: true })
    try {
      const created = await Analysis.create({
        question,
        profile: { selfAlias: '我', targetAlias: this.data.targetAlias.trim() || 'A', relationshipStage: this.data.relationshipStage, goal: this.data.goal, emotionIntensity: this.data.emotionIntensity },
        useTrialCredit: true,
        consent: { adultConfirmed: true, sensitiveDataProcessing: true }
      })
      Events.track('trial_analysis_started', { relationshipStage: this.data.relationshipStage, goal: this.data.goal })
      wx.redirectTo({ url: `/pages/analysis-loading/index?id=${created.analysisId}` })
    } catch (error) {
      wx.showModal({ title: '问题暂时未能提交', content: error.message || '请稍后重试，免费分析次数不会核销。', showCancel: false })
      this.setData({ submitting: false })
    }
  }
})
