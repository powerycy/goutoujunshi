const Config = require('../config/index')
const request = require('../utils/request')

function getDevIdentity() {
  let identity = wx.getStorageSync(Config.devAuthStorageKey)
  if (!identity) {
    identity = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    wx.setStorageSync(Config.devAuthStorageKey, identity)
  }
  return identity
}

function wechatLogin() {
  return new Promise((resolve) => {
    wx.login({
      success: (result) => resolve(result.code || ''),
      fail: () => resolve('')
    })
  })
}

async function ensureSession(force) {
  const stored = wx.getStorageSync('goutoujunshi_session_v1')
  if (!force && stored && stored.token && stored.expiresAt > Date.now() + 60000) {
    wx.setStorageSync('goutoujunshi_session_token_v1', stored.token)
    return stored
  }

  const code = await wechatLogin()
  const session = await request({
    path: '/v1/auth/wechat',
    method: 'POST',
    data: { code, devIdentity: getDevIdentity() }
  })
  const normalized = Object.assign({}, session, {
    expiresAt: Date.now() + (session.expiresIn || 86400) * 1000
  })
  wx.setStorageSync('goutoujunshi_session_v1', normalized)
  wx.setStorageSync('goutoujunshi_session_token_v1', normalized.token)
  return normalized
}

function clearSession() {
  wx.removeStorageSync('goutoujunshi_session_v1')
  wx.removeStorageSync('goutoujunshi_session_token_v1')
}

module.exports = { clearSession, ensureSession }
