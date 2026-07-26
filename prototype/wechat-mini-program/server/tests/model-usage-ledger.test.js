const test = require('node:test')
const assert = require('node:assert/strict')
const { createDatabase } = require('../src/db/database')
const { createModelUsageLedger, calculateCostNanoYuan } = require('../src/services/model-usage-ledger')
const { createStepfunGateway } = require('../src/services/stepfun-gateway')
const { createContext, createServer } = require('../src/app')

function seedAnalysis(db, analysisId='ana_cost', userId='usr_cost') {
  db.prepare('INSERT INTO users(id,openid_hash,role,status,created_at) VALUES(?,?,?,?,?)')
    .run(userId,`hash_${userId}`,'user','active',new Date().toISOString())
  db.prepare(`INSERT INTO analyses(id,user_id,status,encrypted_question,profile_json,access_grant_type,created_at)
    VALUES(?,?,?,?,?,?,?)`).run(analysisId,userId,'running','encrypted','{}','trial_credit',new Date().toISOString())
}

function response(content, usage, id) {
  return {
    ok:true,
    status:200,
    json:async()=>({id,choices:[{message:{content}}],usage})
  }
}

function errorResponse(status, usage, id) {
  return {
    ok:false,
    status,
    json:async()=>({id,usage})
  }
}

test('每次阶跃调用分别记录初次与 JSON 修复成本',async()=>{
  const config={betaCampaignQuota:1000,stepfunBaseUrl:'https://api.stepfun.com/v1',stepfunApiKey:'test',stepfunModel:'step-3.5-flash',modelTimeoutMs:60000}
  const db=createDatabase(':memory:',config);seedAnalysis(db)
  const ledger=createModelUsageLedger(db)
  const replies=[
    response('not-json',{prompt_tokens:100,prompt_tokens_details:{cached_tokens:20},completion_tokens:10},'req_initial'),
    response('{"ok":true}',{prompt_tokens:200,prompt_tokens_details:{cached_tokens:0},completion_tokens:20},'req_repair')
  ]
  const requestBodies=[]
  const gateway=createStepfunGateway(config,ledger,{fetchImpl:async(_url,options)=>{
    requestBodies.push(JSON.parse(options.body))
    return replies.shift()
  },sleepImpl:async()=>{}})
  const result=await gateway.analyze({messages:{requestId:'ana_cost',items:[{role:'user',content:'test'}]}})
  assert.deepEqual(result.result,{ok:true})
  assert.deepEqual(requestBodies.map((body)=>body.max_tokens),[3600,3600])
  const rows=db.prepare("SELECT phase,outcome,provider_request_id,estimated_cost_nano_yuan FROM model_usage_ledger ORDER BY CASE phase WHEN 'initial' THEN 0 ELSE 1 END").all()
  assert.equal(rows.length,2)
  assert.deepEqual(rows.map((row)=>row.phase),['initial','repair'])
  assert.deepEqual(rows.map((row)=>row.outcome),['succeeded','succeeded'])
  assert.equal(rows[0].estimated_cost_nano_yuan,79800)
  assert.equal(rows[1].estimated_cost_nano_yuan,182000)
  assert.equal(ledger.summary().totals.estimated_cost_nano_yuan,261800)
  assert.equal(ledger.summary().by_user.length,1)
  assert.equal(ledger.summary().by_user[0].user_id,'usr_cost')
})

test('模型最终解析失败时，已经产生的两次调用仍保留成本',async()=>{
  const config={betaCampaignQuota:1000,stepfunBaseUrl:'https://api.stepfun.com/v1',stepfunApiKey:'test',stepfunModel:'step-3.5-flash',modelTimeoutMs:60000}
  const db=createDatabase(':memory:',config);seedAnalysis(db)
  const ledger=createModelUsageLedger(db)
  const replies=[
    response('bad',{prompt_tokens:50,prompt_tokens_details:{cached_tokens:0},completion_tokens:5},'req_bad_1'),
    response('still-bad',{prompt_tokens:60,prompt_tokens_details:{cached_tokens:0},completion_tokens:6},'req_bad_2')
  ]
  const gateway=createStepfunGateway(config,ledger,{fetchImpl:async()=>replies.shift(),sleepImpl:async()=>{}})
  await assert.rejects(()=>gateway.analyze({messages:{requestId:'ana_cost',items:[]}}),SyntaxError)
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM model_usage_ledger').get().count,2)
  assert.ok(ledger.summary().totals.estimated_cost_nano_yuan>0)
})

test('429/5xx 重试的每一次供应商调用都单独记账',async()=>{
  const config={betaCampaignQuota:1000,stepfunBaseUrl:'https://api.stepfun.com/v1',stepfunApiKey:'test',stepfunModel:'step-3.5-flash',modelTimeoutMs:60000}
  const db=createDatabase(':memory:',config);seedAnalysis(db)
  const ledger=createModelUsageLedger(db)
  const replies=[
    errorResponse(500,{prompt_tokens:10,prompt_tokens_details:{cached_tokens:0},completion_tokens:0},'req_retry_1'),
    response('{"ok":true}',{prompt_tokens:20,prompt_tokens_details:{cached_tokens:0},completion_tokens:2},'req_retry_2')
  ]
  const gateway=createStepfunGateway(config,ledger,{fetchImpl:async()=>replies.shift(),sleepImpl:async()=>{}})
  await gateway.analyze({messages:{requestId:'ana_cost',items:[]}})
  const rows=db.prepare('SELECT attempt,outcome,http_status FROM model_usage_ledger ORDER BY attempt').all().map((row)=>({...row}))
  assert.deepEqual(rows,[
    {attempt:1,outcome:'http_error',http_status:500},
    {attempt:2,outcome:'succeeded',http_status:200}
  ])
})

test('成本公式与官方 step-3.5-flash 单价一致',()=>{
  assert.equal(calculateCostNanoYuan({promptTokens:1000,cachedTokens:200,completionTokens:100,weightedTokens:1140}),798000)
})

test('成本汇总接口仅管理员可读取',async(t)=>{
  const context=createContext({databaseUrl:':memory:',config:{nodeEnv:'development',allowDevAuth:true,devAnalysisQuota:0,sessionSecret:'test-session-secret-long-enough',dataEncryptionKey:'test-data-key-long-enough',modelMode:'mock',betaCampaignQuota:1000,betaInviteRequired:true}})
  const server=createServer(context);await new Promise((resolve)=>server.listen(0,'127.0.0.1',resolve))
  t.after(()=>new Promise((resolve)=>server.close(resolve)))
  const baseUrl=`http://127.0.0.1:${server.address().port}`
  const login=await fetch(`${baseUrl}/v1/auth/wechat`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({devIdentity:'cost_admin'})}).then((res)=>res.json())
  const denied=await fetch(`${baseUrl}/v1/admin/costs/summary`,{headers:{authorization:`Bearer ${login.token}`}})
  assert.equal(denied.status,403)
  context.db.prepare("UPDATE users SET role='admin' WHERE id=?").run(login.user.id)
  const allowed=await fetch(`${baseUrl}/v1/admin/costs/summary`,{headers:{authorization:`Bearer ${login.token}`}})
  assert.equal(allowed.status,200)
  const body=await allowed.json();assert.equal(body.totals.provider_calls,0);assert.equal(body.totals.prompt_tokens,0);assert.equal(body.totals.estimated_cost_yuan,0);assert.deepEqual(body.by_user,[])
})
