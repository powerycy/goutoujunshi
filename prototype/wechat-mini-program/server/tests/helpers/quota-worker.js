const { parentPort, workerData } = require('node:worker_threads')
const { DatabaseSync } = require('node:sqlite')
const { createBetaService } = require('../../src/services/beta-service')

try {
  const db=new DatabaseSync(workerData.databaseUrl)
  db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=10000;')
  const beta=createBetaService(db,{betaInviteRequired:false})
  const user=db.prepare('SELECT id,role FROM users WHERE id=?').get(workerData.userId)
  const result=beta.claim(user,{packageId:'cny_1',copyVersion:'test',source:'quota_test'},workerData.eventId)
  db.close()
  parentPort.postMessage({ok:true,result})
} catch(error) { parentPort.postMessage({ok:false,error:error.message}) }
