const test = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const { createContext, createServer } = require('../src/app')

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function api(baseUrl, path, body) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type':'application/json' },
    body: JSON.stringify(body)
  }).then(async (response) => ({ status:response.status, body:await response.json() }))
}

test('投资人访问码只以哈希配置并换取限时 demo 会话',async(t)=>{
  const accessCode='demo-test-code-with-enough-entropy'
  const context=createContext({
    databaseUrl:':memory:',
    config:{
      nodeEnv:'test',
      allowDevAuth:false,
      sessionSecret:'test-session-secret-long-enough',
      dataEncryptionKey:'test-data-key-long-enough',
      modelMode:'mock',
      betaCampaignQuota:1000,
      betaInviteRequired:true,
      webDemoEnabled:true,
      webDemoCodeHashes:[sha256(accessCode)],
      webDemoAnalysisQuota:4,
      webDemoSessionSeconds:3600
    }
  })
  const server=createServer(context)
  await new Promise((resolve)=>server.listen(0,'127.0.0.1',resolve))
  t.after(()=>new Promise((resolve)=>server.close(resolve)))
  const baseUrl=`http://127.0.0.1:${server.address().port}`

  const invalid=await api(baseUrl,'/v1/auth/web-demo',{accessCode:'wrong-access-code'})
  assert.equal(invalid.status,401)
  assert.equal(invalid.body.code,'WEB_DEMO_CODE_INVALID')

  const first=await api(baseUrl,'/v1/auth/web-demo',{accessCode})
  assert.equal(first.status,200)
  assert.equal(first.body.expiresIn,3600)
  assert.equal(first.body.user.role,'demo')
  assert.equal(first.body.user.demoOnly,true)
  assert.equal(first.body.user.devOnly,false)
  assert.equal(context.auth.verify(first.body.token).id,first.body.user.id)

  const second=await api(baseUrl,'/v1/auth/web-demo',{accessCode})
  assert.equal(second.status,200)
  assert.equal(second.body.user.id,first.body.user.id)
  const allowance=context.db.prepare('SELECT total,used,reserved FROM dev_allowances WHERE user_id=?').get(first.body.user.id)
  assert.deepEqual({...allowance},{total:4,used:0,reserved:0})
  assert.equal(context.db.prepare('SELECT COUNT(*) AS count FROM users WHERE role=?').get('demo').count,1)
})

test('未显式开启时 Web Demo 身份入口不可用',()=>{
  const context=createContext({
    databaseUrl:':memory:',
    config:{
      nodeEnv:'test',
      allowDevAuth:false,
      sessionSecret:'test-session-secret-long-enough',
      dataEncryptionKey:'test-data-key-long-enough',
      modelMode:'mock',
      betaCampaignQuota:1000,
      betaInviteRequired:true,
      webDemoEnabled:false
    }
  })
  assert.throws(()=>context.auth.loginWebDemo({accessCode:'any-long-enough-code'}),(error)=>{
    assert.equal(error.code,'WEB_DEMO_UNAVAILABLE')
    return true
  })
})
