const fs = require('node:fs')
const path = require('node:path')
const { DatabaseSync } = require('node:sqlite')

function createDatabase(filename, config) {
  if (filename !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true })
  const db = new DatabaseSync(filename)
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;')
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, openid_hash TEXT NOT NULL UNIQUE, role TEXT NOT NULL DEFAULT 'user',
      status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL, deleted_at TEXT
    );
    CREATE TABLE IF NOT EXISTS beta_campaigns (
      campaign_key TEXT PRIMARY KEY, quota_total INTEGER NOT NULL CHECK(quota_total >= 0),
      claimed_count INTEGER NOT NULL DEFAULT 0 CHECK(claimed_count >= 0 AND claimed_count <= quota_total), created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS beta_invite_codes (
      code_hash TEXT PRIMARY KEY, code_hint TEXT NOT NULL, batch TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'available', created_at TEXT NOT NULL, expires_at TEXT,
      redeemed_by TEXT REFERENCES users(id), redeemed_at TEXT,
      CHECK(status IN ('available','redeemed','revoked'))
    );
    CREATE TABLE IF NOT EXISTS beta_cohort_members (
      user_id TEXT PRIMARY KEY REFERENCES users(id), cohort TEXT NOT NULL, joined_at TEXT NOT NULL,
      selected_package TEXT NOT NULL, trial_analysis_total INTEGER NOT NULL DEFAULT 0,
      trial_analysis_used INTEGER NOT NULL DEFAULT 0, trial_analysis_reserved INTEGER NOT NULL DEFAULT 0,
      benefit_version TEXT NOT NULL, benefit_status TEXT NOT NULL, source_event_id TEXT NOT NULL UNIQUE
      ,CHECK(trial_analysis_used >= 0 AND trial_analysis_reserved >= 0 AND trial_analysis_used + trial_analysis_reserved <= trial_analysis_total)
    );
    CREATE TABLE IF NOT EXISTS purchase_intents (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), package_id TEXT NOT NULL,
      displayed_price_fen INTEGER NOT NULL, copy_version TEXT NOT NULL, source TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS dev_allowances (
      user_id TEXT PRIMARY KEY REFERENCES users(id), total INTEGER NOT NULL DEFAULT 0,
      used INTEGER NOT NULL DEFAULT 0, reserved INTEGER NOT NULL DEFAULT 0,
      CHECK(used >= 0 AND reserved >= 0 AND used + reserved <= total)
    );
    CREATE TABLE IF NOT EXISTS analyses (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), status TEXT NOT NULL,
      encrypted_question TEXT NOT NULL, encrypted_result TEXT, profile_json TEXT NOT NULL,
      risk_level TEXT, model TEXT, model_mode TEXT, prompt_version TEXT,
      prompt_tokens INTEGER, cached_tokens INTEGER, completion_tokens INTEGER, weighted_tokens INTEGER,
      access_grant_type TEXT NOT NULL, error_code TEXT, error_message TEXT,
      created_at TEXT NOT NULL, delivered_at TEXT, deleted_at TEXT
    );
    CREATE TABLE IF NOT EXISTS product_events (
      event_id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), event_name TEXT NOT NULL,
      safe_properties_json TEXT NOT NULL, occurred_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS product_suggestions (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
      encrypted_content TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS idempotency_records (
      user_id TEXT NOT NULL, route_key TEXT NOT NULL, idempotency_key TEXT NOT NULL,
      status_code INTEGER NOT NULL, response_json TEXT NOT NULL, created_at TEXT NOT NULL,
      PRIMARY KEY(user_id, route_key, idempotency_key)
    );
  `)
  const memberColumns = db.prepare('PRAGMA table_info(beta_cohort_members)').all().map((column) => column.name)
  if (!memberColumns.includes('invite_code_hash')) db.exec('ALTER TABLE beta_cohort_members ADD COLUMN invite_code_hash TEXT')
  const now = new Date().toISOString()
  db.prepare(`INSERT INTO beta_campaigns(campaign_key, quota_total, claimed_count, created_at)
    VALUES('founding_beta_2026', ?, 0, ?) ON CONFLICT(campaign_key) DO NOTHING`).run(config.betaCampaignQuota, now)
  db.prepare("UPDATE beta_campaigns SET quota_total=? WHERE campaign_key='founding_beta_2026' AND claimed_count=0").run(config.betaCampaignQuota)
  db.prepare("UPDATE beta_cohort_members SET benefit_version='founding_beta_3_analyses_v1' WHERE benefit_version IN ('double_coin_v1','launch_credit_10_60d_v1')").run()
  return db
}

module.exports = { createDatabase }
