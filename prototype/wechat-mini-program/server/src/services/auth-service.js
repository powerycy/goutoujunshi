const crypto = require('node:crypto')

function id(prefix) { return `${prefix}_${crypto.randomUUID().replaceAll('-', '')}` }
function hash(value) { return crypto.createHash('sha256').update(value).digest('hex') }
function sign(body, secret) { return crypto.createHmac('sha256', secret).update(body).digest('base64url') }

function createAuthService(db, config) {
  function issue(user) {
    const payload = Buffer.from(JSON.stringify({ sub: user.id, role: user.role, exp: Date.now() + 86400000 })).toString('base64url')
    return { token: `${payload}.${sign(payload, config.sessionSecret)}`, expiresIn: 86400, user: { id: user.id, role: user.role, devOnly: user.role !== 'user' } }
  }
  function verify(token) {
    const [payload, signature] = String(token || '').split('.')
    if (!payload || !signature) return null
    const expected = sign(payload, config.sessionSecret)
    if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (parsed.exp < Date.now()) return null
    return db.prepare('SELECT id, role, status FROM users WHERE id=? AND deleted_at IS NULL').get(parsed.sub) || null
  }
  function upsertIdentity(identity, role) {
    const openidHash = hash(identity)
    let user = db.prepare('SELECT * FROM users WHERE openid_hash=?').get(openidHash)
    if (!user) {
      user = { id: id('usr'), openid_hash: openidHash, role, status: 'active', created_at: new Date().toISOString() }
      db.prepare('INSERT INTO users(id,openid_hash,role,status,created_at) VALUES(?,?,?,?,?)').run(user.id,user.openid_hash,user.role,user.status,user.created_at)
    }
    if ((user.role === 'dev' || user.role === 'admin') && config.devAnalysisQuota > 0) {
      db.prepare('INSERT INTO dev_allowances(user_id,total,used,reserved) VALUES(?,?,0,0) ON CONFLICT(user_id) DO NOTHING').run(user.id, config.devAnalysisQuota)
    }
    return issue(user)
  }
  async function login(body) {
    if (config.allowDevAuth && body.devIdentity) return upsertIdentity(`dev:${body.devIdentity}`, 'dev')
    if (!body.code || !config.wechatAppId || !config.wechatAppSecret) {
      const error = new Error('微信登录配置未完成，且开发身份已关闭')
      error.code = 'WECHAT_AUTH_UNAVAILABLE'; error.statusCode = 503; throw error
    }
    const url = new URL('https://api.weixin.qq.com/sns/jscode2session')
    url.search = new URLSearchParams({ appid: config.wechatAppId, secret: config.wechatAppSecret, js_code: body.code, grant_type: 'authorization_code' })
    const response = await fetch(url)
    const payload = await response.json()
    if (!response.ok || !payload.openid) { const error = new Error('微信登录失败'); error.code='WECHAT_AUTH_FAILED'; error.statusCode=401; throw error }
    return upsertIdentity(`wx:${payload.openid}`, 'user')
  }
  return { login, verify }
}

module.exports = { createAuthService }
