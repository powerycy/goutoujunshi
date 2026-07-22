const Beta = require('../../services/beta-api')
const Events = require('../../services/events')

Page({
  data: {
    packages: [
      { id: 'cny_1', coins: 10, price: 1, label: '首充限定' },
      { id: 'cny_6', coins: 30, price: 6, label: '单题补给' },
      { id: 'cny_12', coins: 75, price: 12, label: '持续跟进' }
    ],
    benefit: null,
    selectedPackage: 'cny_6',
    selectedPrice: 6,
    giftSummary: '无',
    recordsOpen: false,
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
      this.setData({ benefit, giftSummary: gifts.length ? gifts.join(' · ') : '无', error: '' })
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

  toggleRecords() { this.setData({ recordsOpen: !this.data.recordsOpen }) },

  async submitRecharge() {
    if (this.data.submitting) return
    const selectedPackage = this.data.selectedPackage
    Events.track('package_clicked', {
      selectedPackage,
      displayedPrice: this.data.selectedPrice
    })
    this.setData({ submitting: true })
    try {
      const result = await Beta.enroll(selectedPackage)
      wx.setStorageSync('goutoujunshi_last_beta_reward_v2', Object.assign({}, result, { selectedPackage }))
      wx.navigateTo({ url: '/pages/beta-reward/index' })
    } catch (error) {
      this.setData({ error: error.message, submitting: false })
    }
  },
  goMe() { wx.navigateBack({ delta: 1 }) }
})
