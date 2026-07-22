const crypto = require('node:crypto')

const CAMPAIGN = 'founding_beta_2026'
const BENEFIT_VERSION = 'launch_credit_10_60d_v1'
const LAUNCH_BONUS_COINS = 10
const LAUNCH_BONUS_VALIDITY_DAYS = 60
const PACKAGES = { cny_1: 100, cny_6: 600, cny_12: 1200 }
function id(prefix) { return `${prefix}_${crypto.randomUUID().replaceAll('-', '')}` }

function createBetaService(db) {
  function campaign() { return db.prepare('SELECT * FROM beta_campaigns WHERE campaign_key=?').get(CAMPAIGN) }
  function member(userId) { return db.prepare('SELECT * FROM beta_cohort_members WHERE user_id=?').get(userId) }
  function devAllowance(userId, role) {
    if (role !== 'dev' && role !== 'admin') return undefined
    const row = db.prepare('SELECT total,used,reserved FROM dev_allowances WHERE user_id=?').get(userId)
    return row ? Math.max(0, row.total - row.used - row.reserved) : 0
  }
  function getMine(user) {
    const active = campaign(); const joined = member(user.id)
    const result = {
      eligible: Boolean(joined), cohort: joined ? joined.cohort : null,
      remainingSlots: Math.max(0, active.quota_total - active.claimed_count),
      freeAnalysisEligible: Boolean(joined && joined.trial_analysis_total > 0),
      trialAnalysisTotal: joined ? joined.trial_analysis_total : 0,
      trialAnalysisRemaining: joined ? Math.max(0, joined.trial_analysis_total - joined.trial_analysis_used - joined.trial_analysis_reserved) : 0,
      benefitVersion: joined ? joined.benefit_version : null,
      benefitStatus: joined ? joined.benefit_status : null,
      dogheadBalance: joined ? LAUNCH_BONUS_COINS : 0,
      launchBonusCoins: joined ? LAUNCH_BONUS_COINS : 0,
      launchBonusValidityDays: joined ? LAUNCH_BONUS_VALIDITY_DAYS : 0
    }
    const allowance = devAllowance(user.id, user.role)
    if (allowance !== undefined) { result.devOnly = true; result.devAnalysisRemaining = allowance }
    return result
  }
  function claim(user, input, sourceEventId) {
    if (!PACKAGES[input.packageId]) { const e=new Error('套餐不存在'); e.code='INVALID_PACKAGE'; e.statusCode=400; throw e }
    db.prepare('INSERT INTO purchase_intents(id,user_id,package_id,displayed_price_fen,copy_version,source,created_at) VALUES(?,?,?,?,?,?,?)')
      .run(id('pi'), user.id, input.packageId, PACKAGES[input.packageId], input.copyVersion || 'professional_v3', input.source || 'pricing_page', new Date().toISOString())
    const existing = member(user.id)
    if (existing) return Object.assign({ isNewBeta:false, paymentInvoked:false }, getMine(user))
    let freeClaimed = false
    db.exec('BEGIN IMMEDIATE')
    try {
      const again = member(user.id)
      if (again) { db.exec('COMMIT'); return Object.assign({ isNewBeta:false, paymentInvoked:false }, getMine(user)) }
      const updated = db.prepare('UPDATE beta_campaigns SET claimed_count=claimed_count+1 WHERE campaign_key=? AND claimed_count < quota_total').run(CAMPAIGN)
      freeClaimed = updated.changes === 1
      if (freeClaimed) {
        db.prepare(`INSERT INTO beta_cohort_members(user_id,cohort,joined_at,selected_package,trial_analysis_total,trial_analysis_used,trial_analysis_reserved,benefit_version,benefit_status,source_event_id)
          VALUES(?,?,?,?,2,0,0,?,'reserved',?)`).run(user.id,CAMPAIGN,new Date().toISOString(),input.packageId,BENEFIT_VERSION,sourceEventId)
        db.prepare(`INSERT OR IGNORE INTO product_events(event_id,user_id,event_name,safe_properties_json,occurred_at)
          VALUES(?,?,'beta_enrolled',?,?)`).run(`beta_${sourceEventId}`,user.id,JSON.stringify({freeAnalysisGranted:'true',packageId:input.packageId,benefitVersion:BENEFIT_VERSION}),new Date().toISOString())
      }
      db.exec('COMMIT')
    } catch (error) { db.exec('ROLLBACK'); throw error }
    return Object.assign({ isNewBeta:freeClaimed, freeAnalysisGranted:freeClaimed, paymentInvoked:false }, getMine(user))
  }
  return { claim, getMine }
}

module.exports = { CAMPAIGN, BENEFIT_VERSION, LAUNCH_BONUS_COINS, LAUNCH_BONUS_VALIDITY_DAYS, createBetaService }
