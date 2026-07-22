const Config = require('../config/index')

function request(options) {
  const token = wx.getStorageSync('goutoujunshi_session_token_v1')
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${Config.apiBaseUrl}${options.path}`,
      method: options.method || 'GET',
      data: options.data,
      timeout: options.timeout || Config.requestTimeoutMs,
      header: Object.assign({
        'content-type': 'application/json',
        'X-Client-Version': Config.clientVersion
      }, token ? { Authorization: `Bearer ${token}` } : {}, options.headers || {}),
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data)
          return
        }
        const error = new Error((response.data && response.data.message) || '请求失败')
        error.code = (response.data && response.data.code) || `HTTP_${response.statusCode}`
        error.statusCode = response.statusCode
        error.details = response.data
        reject(error)
      },
      fail(error) {
        const wrapped = new Error('本地服务端未连接')
        wrapped.code = 'API_UNAVAILABLE'
        wrapped.cause = error
        reject(wrapped)
      }
    })
  })
}

module.exports = request
