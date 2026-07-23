const Beta = require('../../services/beta-api')
const Events = require('../../services/events')

Page({
  data: {
    packages: [
      { id: 'cny_1', coins: 10, price: 1, label: '首充限定', isIntro: true },
      { id: 'cny_6', coins: 30, price: 6, label: '单题补给' },
      { id: 'cny_12', coins: 75, price: 12, label: '持续跟进' }
    ],
    benefit: { dogheadBalance: 0 },
    selectedPackage: 'cny_1',
    selectedPrice: 1,
    giftSummary: '无',
    inviteCode: '',
    recordsOpen: false,
    purchaseRecords: [],
    submitting: false,
    error: ''
  },

  async onLoad(options) {
    Events.track('pricing_viewed', { copyVersion: 'professional_v3' })
    if (options && options.section === 'records') this.setData({ recordsOpen: true })
  },

  async onShow() {
    this.setData({ submitting: false })
    await getApp().ready(true).catch(() => null)
    this.refreshBenefit()
  },

  async refreshBenefit(retried) {
    try {
      const benefit = await Beta.getMine()
      const gifts = []
      if (benefit.freeAnalysisEligible && benefit.trialAnalysisTotal) gifts.push(`${benefit.trialAnalysisTotal} 次券`)
      if (benefit.launchBonusCoins) gifts.push(`${benefit.launchBonusCoins} 个狗头`)
      const purchaseRecords = (benefit.purchaseRecords || []).map((record) => ({
        packageId: record.packageId,
        price: (record.displayedPriceFen / 100).toFixed(record.displayedPriceFen % 100 ? 2 : 0),
        date: String(record.createdAt || '').slice(0, 10),
        status: '未扣款'
      }))
      this.setData({ benefit, purchaseRecords, giftSummary: gifts.length ? gifts.join(' · ') : '无', error: '' })
    }
    catch (error) {
      if (!retried && error && error.statusCode === 401) {
        await getApp().ready(true).catch(() => null)
        return this.refreshBenefit(true)
      }
      this.setData({ error: '' })
    }
  },

  choosePackage(event) {
    const selectedPackage = event.currentTarget.dataset.packageId
    const selected = this.data.packages.find((item) => item.id === selectedPackage)
    if (!selected) return
    this.setData({ selectedPackage, selectedPrice: selected.price })
  },

  updateInviteCode(event) { this.setData({ inviteCode: String(event.detail.value || '').toUpperCase() }) },

  toggleRecords() { this.setData({ recordsOpen: !this.data.recordsOpen }) },

  async submitRecharge() {
    if (this.data.submitting) return
    if (this.data.benefit && this.data.benefit.eligible) return
    if (!String(this.data.inviteCode || '').trim()) {
      wx.showToast({ title: '请输入内测邀请码', icon: 'none' })
      return
    }
    const selectedPackage = this.data.selectedPackage
    Events.track('package_clicked', {
      selectedPackage,
      displayedPrice: this.data.selectedPrice
    })
    wx.showModal({
      title: '本次无需支付',
      content: '当前为封闭内测，不会扣款。确认后赠送 3 次完整分析。',
      confirmText: '确认领取',
      confirmColor: '#18c463',
      success: async (modal) => {
        if (!modal.confirm) return
        this.setData({ submitting: true })
        try {
          const result = await Beta.enroll(selectedPackage, this.data.inviteCode)
          wx.setStorageSync('goutoujunshi_last_beta_reward_v2', Object.assign({}, result, { selectedPackage }))
          wx.navigateTo({ url: '/pages/beta-reward/index' })
        } catch (error) {
          this.setData({ error: error.message, submitting: false })
        }
      }
    })
  },
  goMe() { wx.navigateBack({ delta: 1 }) }
})
