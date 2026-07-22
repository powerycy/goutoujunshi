const Beta = require('../../services/beta-api')
const Api = require('../../services/api')
const Auth = require('../../services/auth')

Page({
  data: {
    benefit: null,
    error: '',
    loggedIn: false,
    dogheadCount: 0,
    displayName: '微信用户',
    avatarUrl: '',
    profileHint: '微信账号已登录',
    giftSummary: '无',
    moreOpen: false
  },

  onShow() { this.load() },

  async load(retried) {
    try {
      const session = await getApp().ready()
      const benefit = await Beta.getMine()
      const profile = wx.getStorageSync('goutoujunshi_wechat_profile_v1') || {}
      const loggedIn = Boolean(session && session.token)
      const gifts = []
      if (benefit.freeAnalysisEligible && benefit.trialAnalysisTotal) gifts.push(`${benefit.trialAnalysisTotal} 次券`)
      if (benefit.launchBonusCoins) gifts.push(`${benefit.launchBonusCoins} 个狗头`)
      this.setData({
        benefit,
        loggedIn,
        dogheadCount: benefit.dogheadBalance || 0,
        displayName: profile.nickName || '微信用户',
        avatarUrl: profile.avatarUrl || '',
        profileHint: profile.nickName ? '微信账号已登录' : (loggedIn ? '点击同步微信昵称' : '点击微信登录'),
        giftSummary: gifts.length ? gifts.join(' · ') : '无',
        error: ''
      })
    } catch (error) {
      if (!retried && error && error.statusCode === 401) {
        await getApp().ready(true).catch(() => null)
        return this.load(true)
      }
      this.setData({ loggedIn: false, profileHint: '点击微信登录', error: '' })
    }
  },

  async syncProfile() {
    try {
      await getApp().ready(true)
      if (!wx.getUserProfile) {
        await this.load()
        return
      }
      wx.getUserProfile({
        desc: '用于在个人中心显示头像和昵称',
        success: ({ userInfo }) => {
          const profile = { nickName: userInfo.nickName || '微信用户', avatarUrl: userInfo.avatarUrl || '' }
          wx.setStorageSync('goutoujunshi_wechat_profile_v1', profile)
          this.setData({
            loggedIn: true,
            displayName: profile.nickName,
            avatarUrl: profile.avatarUrl,
            profileHint: '微信账号已登录'
          })
        },
        fail: () => this.load()
      })
    } catch (error) {
      this.setData({ error: '' })
    }
  },

  toggleMore() { this.setData({ moreOpen: !this.data.moreOpen }) },
  suggestProduct() {
    wx.showModal({
      title: '产品建议',
      editable: true,
      placeholderText: '告诉我们哪里可以做得更好',
      confirmText: '提交',
      confirmColor: '#18c463',
      success: (result) => {
        const content = String(result.content || '').trim()
        if (!result.confirm || !content) return
        const suggestions = wx.getStorageSync('goutoujunshi_suggestions_v1') || []
        suggestions.unshift({ content, createdAt: Date.now() })
        wx.setStorageSync('goutoujunshi_suggestions_v1', suggestions.slice(0, 20))
        wx.showToast({ title: '已收到，谢谢', icon: 'success' })
      }
    })
  },
  contactSupport() {
    wx.showModal({
      title: '反馈与客服',
      content: '正式上线后接入微信客服。当前可以先通过“产品建议”提交反馈。',
      showCancel: false,
      confirmText: '知道了',
      confirmColor: '#18c463'
    })
  },
  goPricing() { wx.navigateTo({ url: '/pages/pricing/index' }) },
  goRecords() { wx.navigateTo({ url: '/pages/pricing/index?section=records' }) },
  goHistory() { wx.navigateTo({ url: '/pages/history/index' }) },
  goCase() { wx.navigateTo({ url: '/pages/home/index' }) },

  deleteAccount() {
    wx.showModal({
      title: '删除账号与历史？',
      content: '这会删除可识别的历史内容，并清除当前登录状态。已使用权益不可恢复。',
      confirmColor: '#18c463',
      success: async (result) => {
        if (!result.confirm) return
        try {
          await Api.delete('/v1/me', 'account_delete')
          Auth.clearSession()
          wx.clearStorageSync()
          wx.reLaunch({ url: '/pages/home/index' })
        } catch (error) {
          wx.showToast({ title: error.message, icon: 'none' })
        }
      }
    })
  }
})
