const test = require('node:test')
const assert = require('node:assert/strict')
const { createContext, createServer } = require('../src/app')

function api(baseUrl, path, options = {}) {
  return fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET',
    headers: Object.assign({ 'content-type':'application/json' }, options.token ? { authorization:`Bearer ${options.token}` } : {}, options.idempotency ? { 'idempotency-key':options.idempotency } : {}),
    body: options.body ? JSON.stringify(options.body) : undefined
  }).then(async (response) => ({ status:response.status, body:await response.json() }))
}

test('产品建议进入加密服务端记录，注销后同一微信身份创建新账号',async(t)=>{
  const context=createContext({databaseUrl:':memory:',config:{nodeEnv:'development',allowDevAuth:true,devAnalysisQuota:0,sessionSecret:'test-session-secret-long-enough',dataEncryptionKey:'test-data-key-long-enough',modelMode:'mock',betaCampaignQuota:1000,betaInviteRequired:true}})
  const server=createServer(context)
  await new Promise((resolve)=>server.listen(0,'127.0.0.1',resolve))
  t.after(()=>new Promise((resolve)=>server.close(resolve)))
  const baseUrl=`http://127.0.0.1:${server.address().port}`
  const first=await api(baseUrl,'/v1/auth/wechat',{method:'POST',body:{devIdentity:'feedback_tester'}})
  assert.equal(first.status,200)
  const suggestion=await api(baseUrl,'/v1/suggestions',{method:'POST',token:first.body.token,idempotency:'suggestion-1',body:{content:'希望分析结论可以更直接一些'}})
  assert.equal(suggestion.status,201);assert.equal(suggestion.body.received,true)
  const stored=context.db.prepare('SELECT encrypted_content FROM product_suggestions WHERE user_id=?').get(first.body.user.id)
  assert.notEqual(stored.encrypted_content,'希望分析结论可以更直接一些')
  const removed=await api(baseUrl,'/v1/me',{method:'DELETE',token:first.body.token,idempotency:'delete-1'})
  assert.equal(removed.status,200)
  const second=await api(baseUrl,'/v1/auth/wechat',{method:'POST',body:{devIdentity:'feedback_tester'}})
  assert.equal(second.status,200);assert.notEqual(second.body.user.id,first.body.user.id)
})
