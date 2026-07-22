const Events = require('../../services/events')

Page({
  data: { reward: null, title: '', giftItems: [] },
  onLoad() {
    const reward = wx.getStorageSync('goutoujunshi_last_beta_reward_v2') || {}
    let title = '本次没有发生支付'
    if (reward.isNewBeta && reward.freeAnalysisGranted) title = '赠品已到账'
    else if (!reward.eligible) title = '本轮内测名额已满'
    const giftItems = []
    if (reward.freeAnalysisEligible && reward.trialAnalysisTotal) giftItems.push(`${reward.trialAnalysisTotal} 次券`)
    if (reward.launchBonusCoins) giftItems.push(`${reward.launchBonusCoins} 个狗头`)
    this.setData({ reward, title, giftItems })
    Events.track('beta_reward_viewed', { freeAnalysisEligible: Boolean(reward.freeAnalysisEligible), selectedPackage: reward.selectedPackage || '' })
  },
  goMe() { Events.track('modal_secondary_clicked'); wx.redirectTo({ url: '/pages/me/index' }) }
})
