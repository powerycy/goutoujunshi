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
    betaCampaignQuota: int('BETA_CAMPAIGN_QUOTA', 10000),
    maxQuestionChars: 4000,
    maxWeightedTokens: 30000,
    modelTimeoutMs: 60000,
    repositoryRoot: path.resolve(__dirname, '../../../..')
  }
  Object.assign(config, overrides)
  if (!config.sessionSecret || !config.dataEncryptionKey) throw new Error('SESSION_SECRET and DATA_ENCRYPTION_KEY are required outside development')
  if (config.nodeEnv !== 'development' && config.allowDevAuth) throw new Error('ALLOW_DEV_AUTH must be false outside development')
  if (config.modelMode === 'stepfun' && !config.stepfunApiKey) throw new Error('STEPFUN_API_KEY is required when MODEL_MODE=stepfun')
  return config
}

module.exports = { loadConfig }
