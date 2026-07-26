const path = require('node:path')

function bool(name, fallback) {
  if (process.env[name] == null) return fallback
  return process.env[name] === 'true'
}

function int(name, fallback) {
  const value = Number(process.env[name])
  return Number.isInteger(value) ? value : fallback
}

function loadConfig(overrides = {}) {
  const nodeEnv = overrides.nodeEnv || process.env.NODE_ENV || 'development'
  const webDemoCodeHashes = String(process.env.WEB_DEMO_CODE_HASHES || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
  const config = {
    nodeEnv,
    port: int('PORT', 3000),
    databaseUrl: process.env.DATABASE_URL || path.resolve(__dirname, '../data/dev.sqlite'),
    sessionSecret: process.env.SESSION_SECRET || (nodeEnv === 'development' ? 'dev-only-session-secret-change-before-deploy' : ''),
    wechatAppId: process.env.WECHAT_APP_ID || '',
    wechatAppSecret: process.env.WECHAT_APP_SECRET || '',
    stepfunApiKey: process.env.STEPFUN_API_KEY || '',
    stepfunModel: process.env.STEPFUN_MODEL || 'step-3.5-flash',
    stepfunBaseUrl: (process.env.STEPFUN_BASE_URL || 'https://api.stepfun.com/v1').replace(/\/$/, ''),
    modelMode: process.env.MODEL_MODE || 'mock',
    dataEncryptionKey: process.env.DATA_ENCRYPTION_KEY || (nodeEnv === 'development' ? 'dev-only-data-key-change-before-deploy' : ''),
    allowDevAuth: bool('ALLOW_DEV_AUTH', nodeEnv === 'development'),
    devAnalysisQuota: int('DEV_ANALYSIS_QUOTA', 20),
    webDemoEnabled: bool('WEB_DEMO_ENABLED', false),
    webDemoCodeHashes,
    webDemoAnalysisQuota: int('WEB_DEMO_ANALYSIS_QUOTA', 12),
    webDemoSessionSeconds: int('WEB_DEMO_SESSION_SECONDS', 14400),
    webProxyEnabled: bool('WEB_PROXY_ENABLED', false),
    webProxyKey: process.env.WEB_PROXY_KEY || '',
    webProxyPort: int('WEB_PROXY_PORT', 3001),
    betaCampaignQuota: int('BETA_CAMPAIGN_QUOTA', 1000),
    betaInviteRequired: bool('BETA_INVITE_REQUIRED', true),
    host: process.env.HOST || (nodeEnv === 'development' ? '127.0.0.1' : '0.0.0.0'),
    maxQuestionChars: 4000,
    maxWeightedTokens: 30000,
    maxDailyAnalysisAttempts: int('MAX_DAILY_ANALYSIS_ATTEMPTS', 10),
    modelTimeoutMs: 60000,
    repositoryRoot: path.resolve(__dirname, '../../../..')
  }
  Object.assign(config, overrides)
  if (!config.sessionSecret || !config.dataEncryptionKey) throw new Error('SESSION_SECRET and DATA_ENCRYPTION_KEY are required outside development')
  if (config.nodeEnv !== 'development' && config.allowDevAuth) throw new Error('ALLOW_DEV_AUTH must be false outside development')
  if (config.modelMode === 'stepfun' && !config.stepfunApiKey) throw new Error('STEPFUN_API_KEY is required when MODEL_MODE=stepfun')
  if (config.webDemoEnabled && !config.webDemoCodeHashes.length) throw new Error('WEB_DEMO_CODE_HASHES is required when WEB_DEMO_ENABLED=true')
  if (config.webDemoCodeHashes.some((value) => !/^[a-f0-9]{64}$/.test(value))) throw new Error('WEB_DEMO_CODE_HASHES must contain SHA-256 hex digests')
  if (config.webDemoAnalysisQuota < 1) throw new Error('WEB_DEMO_ANALYSIS_QUOTA must be at least 1')
  if (config.webProxyEnabled && Buffer.from(config.webProxyKey, 'base64').length !== 32) throw new Error('WEB_PROXY_KEY must be a base64-encoded 32-byte key')
  return config
}

module.exports = { loadConfig }
