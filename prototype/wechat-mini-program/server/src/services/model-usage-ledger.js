const crypto = require('node:crypto')

const STEPFUN_PRICING = Object.freeze({
  version: 'stepfun-2026-07',
  uncachedInputNanoYuan: 700,
  cachedInputNanoYuan: 140,
  outputNanoYuan: 2100
})

function nonnegativeInteger(value) {
  return Number.isInteger(value) && value >= 0 ? value : null
}

function normalizeUsage(usage) {
  if (!usage) return null
  const promptTokens = nonnegativeInteger(usage.promptTokens)
  const cachedTokens = nonnegativeInteger(usage.cachedTokens)
  const completionTokens = nonnegativeInteger(usage.completionTokens)
  const weightedTokens = nonnegativeInteger(usage.weightedTokens)
  if ([promptTokens, cachedTokens, completionTokens, weightedTokens].includes(null) || cachedTokens > promptTokens) return null
  return { promptTokens, cachedTokens, completionTokens, weightedTokens }
}

function calculateCostNanoYuan(usage, pricing = STEPFUN_PRICING) {
  const normalized = normalizeUsage(usage)
  if (!normalized) return 0
  const uncachedTokens = normalized.promptTokens - normalized.cachedTokens
  return uncachedTokens * pricing.uncachedInputNanoYuan
    + normalized.cachedTokens * pricing.cachedInputNanoYuan
    + normalized.completionTokens * pricing.outputNanoYuan
}

function yuanFromNano(value) {
  return Number((Number(value || 0) / 1_000_000_000).toFixed(6))
}

function createModelUsageLedger(db, options = {}) {
  const pricing = options.pricing || STEPFUN_PRICING

  function record(event) {
    const usage = normalizeUsage(event.usage)
    const user = db.prepare('SELECT user_id FROM analyses WHERE id=?').get(event.analysisId)
    if (!user) return { recorded:false, reason:'analysis_not_found' }
    const estimatedCostNanoYuan = calculateCostNanoYuan(usage, pricing)
    db.prepare(`INSERT INTO model_usage_ledger(
      id,analysis_id,user_id,provider,model,phase,attempt,outcome,provider_request_id,http_status,
      prompt_tokens,cached_tokens,completion_tokens,weighted_tokens,pricing_version,
      uncached_input_price_nano_yuan,cached_input_price_nano_yuan,output_price_nano_yuan,
      estimated_cost_nano_yuan,duration_ms,error_code,created_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      `usage_${crypto.randomUUID().replaceAll('-', '')}`,
      event.analysisId,
      user.user_id,
      event.provider || 'stepfun',
      event.model,
      event.phase || 'initial',
      event.attempt || 1,
      event.outcome,
      event.providerRequestId || null,
      nonnegativeInteger(event.httpStatus),
      usage && usage.promptTokens,
      usage && usage.cachedTokens,
      usage && usage.completionTokens,
      usage && usage.weightedTokens,
      pricing.version,
      pricing.uncachedInputNanoYuan,
      pricing.cachedInputNanoYuan,
      pricing.outputNanoYuan,
      estimatedCostNanoYuan,
      nonnegativeInteger(event.durationMs),
      event.errorCode ? String(event.errorCode).slice(0, 80) : null,
      event.createdAt || new Date().toISOString()
    )
    return { recorded:true, estimatedCostNanoYuan }
  }

  function summary() {
    const rawTotals = db.prepare(`SELECT
      COUNT(*) AS provider_calls,
      COUNT(DISTINCT analysis_id) AS analyses,
      COUNT(DISTINCT user_id) AS users,
      SUM(CASE WHEN outcome='succeeded' THEN 1 ELSE 0 END) AS successful_calls,
      SUM(CASE WHEN outcome<>'succeeded' THEN 1 ELSE 0 END) AS failed_calls,
      SUM(COALESCE(prompt_tokens,0)) AS prompt_tokens,
      SUM(COALESCE(cached_tokens,0)) AS cached_tokens,
      SUM(COALESCE(completion_tokens,0)) AS completion_tokens,
      SUM(COALESCE(weighted_tokens,0)) AS weighted_tokens,
      SUM(estimated_cost_nano_yuan) AS estimated_cost_nano_yuan
      FROM model_usage_ledger`).get()
    const totalFields = ['provider_calls','analyses','users','successful_calls','failed_calls','prompt_tokens','cached_tokens','completion_tokens','weighted_tokens','estimated_cost_nano_yuan']
    const totals = Object.fromEntries(totalFields.map((field) => [field, Number(rawTotals[field] || 0)]))
    const byDay = db.prepare(`SELECT
      substr(created_at,1,10) AS date,
      COUNT(*) AS provider_calls,
      COUNT(DISTINCT analysis_id) AS analyses,
      COUNT(DISTINCT user_id) AS users,
      SUM(estimated_cost_nano_yuan) AS estimated_cost_nano_yuan
      FROM model_usage_ledger
      GROUP BY substr(created_at,1,10)
      ORDER BY date DESC
      LIMIT 90`).all().map((row) => ({
        ...row,
        estimated_cost_yuan: yuanFromNano(row.estimated_cost_nano_yuan)
      }))
    const byUser = db.prepare(`SELECT
      user_id,
      COUNT(*) AS provider_calls,
      COUNT(DISTINCT analysis_id) AS analyses,
      SUM(CASE WHEN outcome='succeeded' THEN 1 ELSE 0 END) AS successful_calls,
      SUM(CASE WHEN outcome<>'succeeded' THEN 1 ELSE 0 END) AS failed_calls,
      SUM(COALESCE(prompt_tokens,0)) AS prompt_tokens,
      SUM(COALESCE(cached_tokens,0)) AS cached_tokens,
      SUM(COALESCE(completion_tokens,0)) AS completion_tokens,
      SUM(estimated_cost_nano_yuan) AS estimated_cost_nano_yuan
      FROM model_usage_ledger
      GROUP BY user_id
      ORDER BY estimated_cost_nano_yuan DESC
      LIMIT 1000`).all().map((row) => ({
        ...row,
        estimated_cost_yuan: yuanFromNano(row.estimated_cost_nano_yuan)
      }))
    return {
      pricing,
      totals: {
        ...totals,
        estimated_cost_yuan: yuanFromNano(totals.estimated_cost_nano_yuan)
      },
      by_day: byDay,
      by_user: byUser
    }
  }

  return { record, summary }
}

module.exports = { STEPFUN_PRICING, calculateCostNanoYuan, createModelUsageLedger, normalizeUsage, yuanFromNano }
