const test = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const { createContext, createEncryptedWebProxyServer, createServer } = require('../src/app')
const { decryptPayload, encryptPayload } = require('../src/services/encrypted-web-proxy')

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

test('公网代理只接受加密信封并可安全转发 Web Demo 登录',async(t)=>{
  const key=crypto.randomBytes(32)
  const accessCode='proxy-demo-code-with-enough-entropy'
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
      webDemoAnalysisQuota:2,
      webProxyEnabled:true,
      webProxyKey:key.toString('base64')
    }
  })
  const apiServer=createServer(context)
  await new Promise((resolve)=>apiServer.listen(0,'127.0.0.1',resolve))
  t.after(()=>new Promise((resolve)=>apiServer.close(resolve)))
  const apiBaseUrl=`http://127.0.0.1:${apiServer.address().port}`
  const proxyServer=createEncryptedWebProxyServer(context,{upstreamBaseUrl:apiBaseUrl})
  await new Promise((resolve)=>proxyServer.listen(0,'127.0.0.1',resolve))
  t.after(()=>new Promise((resolve)=>proxyServer.close(resolve)))
  const proxyBaseUrl=`http://127.0.0.1:${proxyServer.address().port}`

  const direct=await fetch(`${proxyBaseUrl}/v1/auth/web-demo`,{method:'POST'})
  assert.equal(direct.status,404)

  const envelope=encryptPayload({
    issuedAt:Date.now(),
    method:'POST',
    path:'/v1/auth/web-demo',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({accessCode})
  },key)
  const response=await fetch(`${proxyBaseUrl}/v1/web-proxy`,{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify(envelope)
  })
  assert.equal(response.status,200)
  const decrypted=decryptPayload(await response.json(),key)
  assert.equal(decrypted.status,200)
  const session=JSON.parse(decrypted.body)
  assert.equal(session.user.role,'demo')
  assert.equal(context.auth.verify(session.token).id,session.user.id)

  const replay=await fetch(`${proxyBaseUrl}/v1/web-proxy`,{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify(envelope)
  })
  assert.equal(replay.status,401)
})
