const crypto = require('node:crypto')

const CAMPAIGN = 'founding_beta_2026'
const BENEFIT_VERSION = 'founding_beta_3_analyses_v1'
const TRIAL_ANALYSIS_TOTAL = 3
const PACKAGES = {
  cny_1: { priceFen: 100, coins: 10 },
  cny_6: { priceFen: 600, coins: 30 },
  cny_12: { priceFen: 1200, coins: 75 }
}
function id(prefix) { return `${prefix}_${crypto.randomUUID().replaceAll('-', '')}` }
function normalizeInviteCode(value) { return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '') }
function hashInviteCode(value) { return crypto.createHash('sha256').update(normalizeInviteCode(value)).digest('hex') }

function createBetaService(db, config = {}) {
  function campaign() { return db.prepare('SELECT * FROM beta_campaigns WHERE campaign_key=?').get(CAMPAIGN) }
  function member(userId) { return db.prepare('SELECT * FROM beta_cohort_members WHERE user_id=?').get(userId) }
  function devAllowance(userId, role) {
    if (role !== 'dev' && role !== 'admin') return undefined
    const row = db.prepare('SELECT total,used,reserved FROM dev_allowances WHERE user_id=?').get(userId)
    return row ? Math.max(0, row.total - row.used - row.reserved) : 0
  }
  function getMine(user) {
    const active = campaign(); const joined = member(user.id)
    const purchaseRecords = db.prepare('SELECT package_id,displayed_price_fen,created_at FROM purchase_intents WHERE user_id=? ORDER BY created_at DESC LIMIT 20').all(user.id)
      .map((row) => ({ packageId:row.package_id, displayedPriceFen:row.displayed_price_fen, createdAt:row.created_at, status:'not_charged' }))
    const result = {
      eligible: Boolean(joined), cohort: joined ? joined.cohort : null,
      remainingSlots: Math.max(0, active.quota_total - active.claimed_count),
      freeAnalysisEligible: Boolean(joined && joined.trial_analysis_total > 0),
      trialAnalysisTotal: joined ? joined.trial_analysis_total : 0,
      trialAnalysisRemaining: joined ? Math.max(0, joined.trial_analysis_total - joined.trial_analysis_used - joined.trial_analysis_reserved) : 0,
      benefitVersion: joined ? joined.benefit_version : null,
      benefitStatus: joined ? joined.benefit_status : null,
      dogheadBalance: 0,
      launchBonusCoins: 0,
      launchBonusValidityDays: 0,
      launchMatchEligible: Boolean(joined),
      selectedPackage: joined ? joined.selected_package : null,
      purchaseRecords
    }
    const allowance = devAllowance(user.id, user.role)
    if (allowance !== undefined) { result.devOnly = true; result.devAnalysisRemaining = allowance }
    return result
  }
  function claim(user, input, sourceEventId) {
    if (!PACKAGES[input.packageId]) { const e=new Error('套餐不存在'); e.code='INVALID_PACKAGE'; e.statusCode=400; throw e }
    db.prepare('INSERT INTO purchase_intents(id,user_id,package_id,displayed_price_fen,copy_version,source,created_at) VALUES(?,?,?,?,?,?,?)')
      .run(id('pi'), user.id, input.packageId, PACKAGES[input.packageId].priceFen, input.copyVersion || 'professional_v3', input.source || 'pricing_page', new Date().toISOString())
    const existing = member(user.id)
    if (existing) return Object.assign({ isNewBeta:false, paymentInvoked:false }, getMine(user))
    const inviteCode = normalizeInviteCode(input.inviteCode)
    const inviteHash = inviteCode ? hashInviteCode(inviteCode) : ''
    let invite
    if (config.betaInviteRequired !== false) {
      if (!inviteHash) { const e=new Error('请输入内测邀请码'); e.code='INVITE_CODE_REQUIRED'; e.statusCode=403; throw e }
      invite = db.prepare("SELECT * FROM beta_invite_codes WHERE code_hash=? AND status='available'").get(inviteHash)
      if (!invite || (invite.expires_at && Date.parse(invite.expires_at) <= Date.now())) { const e=new Error('邀请码无效或已使用'); e.code='INVITE_CODE_INVALID'; e.statusCode=403; throw e }
    }
    let freeClaimed = false
    db.exec('BEGIN IMMEDIATE')
    try {
      const again = member(user.id)
      if (again) { db.exec('COMMIT'); return Object.assign({ isNewBeta:false, paymentInvoked:false }, getMine(user)) }
      if (inviteHash && config.betaInviteRequired !== false) {
        const reserved = db.prepare("UPDATE beta_invite_codes SET status='redeemed',redeemed_by=?,redeemed_at=? WHERE code_hash=? AND status='available'")
          .run(user.id,new Date().toISOString(),inviteHash)
        if (reserved.changes !== 1) { const e=new Error('邀请码无效或已使用'); e.code='INVITE_CODE_INVALID'; e.statusCode=403; throw e }
      }
      const updated = db.prepare('UPDATE beta_campaigns SET claimed_count=claimed_count+1 WHERE campaign_key=? AND claimed_count < quota_total').run(CAMPAIGN)
      freeClaimed = updated.changes === 1
      if (freeClaimed) {
        db.prepare(`INSERT INTO beta_cohort_members(user_id,cohort,joined_at,selected_package,trial_analysis_total,trial_analysis_used,trial_analysis_reserved,benefit_version,benefit_status,source_event_id,invite_code_hash)
          VALUES(?,?,?,?,?,0,0,?,'active',?,?)`).run(user.id,CAMPAIGN,new Date().toISOString(),input.packageId,TRIAL_ANALYSIS_TOTAL,BENEFIT_VERSION,sourceEventId,inviteHash||null)
        db.prepare(`INSERT OR IGNORE INTO product_events(event_id,user_id,event_name,safe_properties_json,occurred_at)
          VALUES(?,?,'beta_enrolled',?,?)`).run(`beta_${sourceEventId}`,user.id,JSON.stringify({giftAnalysisGranted:String(TRIAL_ANALYSIS_TOTAL),packageId:input.packageId,benefitVersion:BENEFIT_VERSION}),new Date().toISOString())
      } else if (inviteHash && config.betaInviteRequired !== false) {
        db.prepare("UPDATE beta_invite_codes SET status='available',redeemed_by=NULL,redeemed_at=NULL WHERE code_hash=? AND redeemed_by=?").run(inviteHash,user.id)
      }
      db.exec('COMMIT')
    } catch (error) { db.exec('ROLLBACK'); throw error }
    return Object.assign({ isNewBeta:freeClaimed, freeAnalysisGranted:freeClaimed, paymentInvoked:false }, getMine(user))
  }
  return { claim, getMine }
}

module.exports = { CAMPAIGN, BENEFIT_VERSION, TRIAL_ANALYSIS_TOTAL, hashInviteCode, normalizeInviteCode, createBetaService }
