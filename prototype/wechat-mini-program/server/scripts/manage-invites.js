const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { loadConfig } = require('../src/config')
const { createDatabase } = require('../src/db/database')
const { hashInviteCode } = require('../src/services/beta-service')

const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

function randomPart(length) {
  let result = ''
  for (let index = 0; index < length; index += 1) result += ALPHABET[crypto.randomInt(ALPHABET.length)]
  return result
}

function createCode() { return `GT-${randomPart(4)}-${randomPart(4)}-${randomPart(4)}` }

function fail(message) {
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
}

function main() {
  const [command, countValue, batch = 'batch-1', outputValue] = process.argv.slice(2)
  if (command !== 'generate') return fail('用法: node scripts/manage-invites.js generate <数量> <批次> <输出文件>')
  const count = Number(countValue)
  if (!Number.isInteger(count) || count < 1 || count > 1000) return fail('数量必须是 1 到 1000 的整数')
  if (!outputValue) return fail('必须指定邀请码输出文件，避免邀请码只出现在终端历史中')

  const config = loadConfig()
  const db = createDatabase(config.databaseUrl, config)
  const outputPath = path.resolve(outputValue)
  const codes = []
  const insert = db.prepare(`INSERT INTO beta_invite_codes(code_hash,code_hint,batch,status,created_at)
    VALUES(?,?,?,'available',?)`)
  db.exec('BEGIN IMMEDIATE')
  try {
    while (codes.length < count) {
      const code = createCode()
      try {
        insert.run(hashInviteCode(code), code.slice(-4), String(batch).slice(0, 60), new Date().toISOString())
        codes.push(code)
      } catch (error) {
        if (!String(error.message).includes('UNIQUE')) throw error
      }
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    db.close()
    throw error
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, `${codes.join('\n')}\n`, { mode: 0o600 })
  db.close()
  process.stdout.write(`已生成 ${codes.length} 个邀请码，批次 ${batch}。\n`)
}

main()
