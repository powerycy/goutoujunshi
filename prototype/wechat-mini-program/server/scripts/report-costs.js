const path = require('node:path')
const { DatabaseSync } = require('node:sqlite')
const { createModelUsageLedger } = require('../src/services/model-usage-ledger')

const databaseUrl = process.env.DATABASE_URL || path.resolve(__dirname, '../data/dev.sqlite')
const db = new DatabaseSync(databaseUrl, { readOnly:true })

try {
  console.log(JSON.stringify(createModelUsageLedger(db).summary(), null, 2))
} finally {
  db.close()
}
