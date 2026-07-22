const test=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const os=require('node:os')
const path=require('node:path')
const {Worker}=require('node:worker_threads')
const {createDatabase}=require('../src/db/database')
const {createBetaService}=require('../src/services/beta-service')

function addUser(db,id){db.prepare('INSERT INTO users(id,openid_hash,role,status,created_at) VALUES(?,?,\'user\',\'active\',?)').run(id,`hash_${id}`,new Date().toISOString())}
function runWorker(databaseUrl,userId,eventId){return new Promise((resolve,reject)=>{const worker=new Worker(path.join(__dirname,'helpers/quota-worker.js'),{workerData:{databaseUrl,userId,eventId}});worker.on('message',(message)=>message.ok?resolve(message.result):reject(new Error(message.error)));worker.on('error',reject)})}

test('第10000/10001名并发：只有一人获2次免费分析和正式版活动额度',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'goutou-quota-'));const file=path.join(dir,'quota.sqlite')
  const db=createDatabase(file,{betaCampaignQuota:10000});addUser(db,'u_10000');addUser(db,'u_10001')
  db.prepare("UPDATE beta_campaigns SET claimed_count=9999,quota_total=10000 WHERE campaign_key='founding_beta_2026'").run();db.close()
  const results=await Promise.all([runWorker(file,'u_10000','evt_10000'),runWorker(file,'u_10001','evt_10001')])
  const verify=createDatabase(file,{betaCampaignQuota:10000});const members=verify.prepare('SELECT user_id,trial_analysis_total,benefit_version FROM beta_cohort_members ORDER BY user_id').all();const campaign=verify.prepare("SELECT * FROM beta_campaigns WHERE campaign_key='founding_beta_2026'").get()
  assert.equal(campaign.claimed_count,10000);assert.equal(members.length,1);assert.equal(members[0].trial_analysis_total,2);assert.equal(members[0].benefit_version,'launch_credit_10_60d_v1');assert.deepEqual(results.map((row)=>row.freeAnalysisGranted).sort(),[false,true]);verify.close();fs.rmSync(dir,{recursive:true,force:true})
})

test('重复点击和同一稳定 user_id 不重复领券或占名额',()=>{
  const db=createDatabase(':memory:',{betaCampaignQuota:10000});addUser(db,'same_user');const beta=createBetaService(db);const user={id:'same_user',role:'user'}
  const first=beta.claim(user,{packageId:'cny_1'},'event_first');const second=beta.claim(user,{packageId:'cny_1'},'event_second')
  assert.equal(first.trialAnalysisTotal,2);assert.equal(second.trialAnalysisTotal,2);assert.equal(second.isNewBeta,false)
  assert.equal(db.prepare("SELECT claimed_count FROM beta_campaigns WHERE campaign_key='founding_beta_2026'").get().claimed_count,1);assert.equal(db.prepare('SELECT count(*) count FROM beta_cohort_members WHERE user_id=?').get(user.id).count,1);assert.equal(db.prepare('SELECT count(*) count FROM purchase_intents WHERE user_id=?').get(user.id).count,2)
})

test('内测名额已满时只记录新人方案点击，不登记权益',()=>{
  const db=createDatabase(':memory:',{betaCampaignQuota:0});addUser(db,'sold_out');const beta=createBetaService(db);const user={id:'sold_out',role:'user'}
  const result=beta.claim(user,{packageId:'cny_1'},'event_sold_out')
  assert.equal(result.eligible,false);assert.equal(result.trialAnalysisTotal,0);assert.equal(result.launchBonusCoins,0)
  assert.equal(db.prepare('SELECT count(*) count FROM beta_cohort_members WHERE user_id=?').get(user.id).count,0)
  assert.equal(db.prepare('SELECT count(*) count FROM purchase_intents WHERE user_id=?').get(user.id).count,1)
})

test('1元、6元、12元三档充值选择均可登记',()=>{
  const db=createDatabase(':memory:',{betaCampaignQuota:10000});const beta=createBetaService(db)
  for(const packageId of ['cny_1','cny_6','cny_12']){
    const user={id:`user_${packageId}`,role:'user'};addUser(db,user.id)
    const result=beta.claim(user,{packageId},`event_${packageId}`)
    assert.equal(result.trialAnalysisTotal,2);assert.equal(result.dogheadBalance,10)
  }
})
