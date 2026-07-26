const http = require('node:http')
const crypto = require('node:crypto')
const { loadConfig } = require('./config')
const { createDatabase } = require('./db/database')
const { createCryptoService } = require('./services/crypto-service')
const { createAuthService } = require('./services/auth-service')
const { createBetaService } = require('./services/beta-service')
const { createSkillRouter } = require('./services/skill-router')
const { createStepfunGateway } = require('./services/stepfun-gateway')
const { createAnalysisService } = require('./services/analysis-service')
const { createModelUsageLedger } = require('./services/model-usage-ledger')
const { createEncryptedWebProxyServer } = require('./services/encrypted-web-proxy')

function json(response,status,body){response.writeHead(status,{'content-type':'application/json; charset=utf-8','access-control-allow-origin':'*'});response.end(JSON.stringify(body))}
function readBody(request){return new Promise((resolve,reject)=>{let body='';request.on('data',(chunk)=>{body+=chunk;if(body.length>1_000_000){reject(Object.assign(new Error('请求过大'),{statusCode:413,code:'PAYLOAD_TOO_LARGE'}));request.destroy()}});request.on('end',()=>{try{resolve(body?JSON.parse(body):{})}catch(_){reject(Object.assign(new Error('JSON 格式错误'),{statusCode:400,code:'INVALID_JSON'}))}});request.on('error',reject)})}
function safeProperties(properties){const result={};for(const [key,value] of Object.entries(properties||{})){if(/question|message|name|phone|address|content|text/i.test(key))continue;if(['string','number','boolean'].includes(typeof value))result[key]=String(value).slice(0,120)}return result}
function createRateLimiter({limit,windowMs}){
  const buckets=new Map()
  return function allow(key){
    const now=Date.now();const current=buckets.get(key)
    if(!current||current.resetAt<=now){buckets.set(key,{count:1,resetAt:now+windowMs});return true}
    current.count+=1
    return current.count<=limit
  }
}

function createContext(overrides={}){
  const config=loadConfig(overrides.config||{});const db=createDatabase(overrides.databaseUrl||config.databaseUrl,config)
  const cryptoService=createCryptoService(config.dataEncryptionKey);const auth=createAuthService(db,config);const beta=createBetaService(db,config)
  const costs=createModelUsageLedger(db);const skillRouter=createSkillRouter(config);const gateway=overrides.gateway||createStepfunGateway(config,costs)
  const analysis=createAnalysisService(db,config,cryptoService,skillRouter,gateway)
  analysis.recoverInterrupted()
  return{config,db,auth,beta,analysis,costs,cryptoService}
}

function createServer(context){
  const allowWebLogin=createRateLimiter({limit:20,windowMs:10*60*1000})
  return http.createServer(async(request,response)=>{
    try{
      if(request.method==='OPTIONS'){response.writeHead(204,{'access-control-allow-origin':'*','access-control-allow-headers':'authorization,content-type,idempotency-key','access-control-allow-methods':'GET,POST,DELETE,OPTIONS'});response.end();return}
      const url=new URL(request.url,'http://localhost');const path=url.pathname
      if(request.method==='GET'&&path==='/health'){json(response,200,{ok:true,modelMode:context.config.modelMode,devAuth:context.config.allowDevAuth,webDemo:context.config.webDemoEnabled});return}
      if(request.method==='POST'&&path==='/v1/auth/wechat'){json(response,200,await context.auth.login(await readBody(request)));return}
      if(request.method==='POST'&&path==='/v1/auth/web-demo'){
        const source=request.socket.remoteAddress||'unknown'
        if(!allowWebLogin(source)){json(response,429,{code:'WEB_DEMO_LOGIN_RATE_LIMIT',message:'尝试次数过多，请十分钟后再试'});return}
        json(response,200,context.auth.loginWebDemo(await readBody(request)));return
      }
      const token=(request.headers.authorization||'').replace(/^Bearer\s+/i,'');const user=context.auth.verify(token)
      if(!user){json(response,401,{code:'UNAUTHORIZED',message:'会话无效，请重新登录'});return}
      const body=['POST','DELETE'].includes(request.method)?await readBody(request):{}
      const isWrite=['POST','DELETE'].includes(request.method);const idem=request.headers['idempotency-key']
      if(isWrite&&!idem){json(response,400,{code:'IDEMPOTENCY_KEY_REQUIRED',message:'写请求必须携带 Idempotency-Key'});return}
      const routeKey=`${request.method}:${path}`
      if(isWrite){const cached=context.db.prepare('SELECT status_code,response_json FROM idempotency_records WHERE user_id=? AND route_key=? AND idempotency_key=?').get(user.id,routeKey,idem);if(cached){json(response,cached.status_code,JSON.parse(cached.response_json));return}}
      let status=200;let result
      if(request.method==='GET'&&path==='/v1/beta/me')result=context.beta.getMine(user)
      else if(request.method==='GET'&&path==='/v1/admin/costs/summary'){
        if(user.role!=='admin'){json(response,403,{code:'FORBIDDEN',message:'仅管理员可查看成本汇总'});return}
        result=context.costs.summary()
      }
      else if(request.method==='POST'&&path==='/v1/beta/purchase-intents'){result=context.beta.claim(user,body,idem);status=201}
      else if(request.method==='POST'&&path==='/v1/analyses'){result=context.analysis.create(user,body);status=202}
      else if(request.method==='GET'&&path==='/v1/analyses')result=context.analysis.list(user)
      else if(request.method==='GET'&&path.startsWith('/v1/analyses/'))result=context.analysis.get(user,path.split('/').pop())
      else if(request.method==='DELETE'&&path.startsWith('/v1/analyses/'))result=context.analysis.remove(user,path.split('/').pop())
      else if(request.method==='POST'&&path==='/v1/suggestions'){
        const content=String(body.content||'').trim()
        if(!content||content.length>1000){json(response,400,{code:'INVALID_SUGGESTION',message:'建议内容需为 1 到 1000 字'});return}
        context.db.prepare('INSERT INTO product_suggestions(id,user_id,encrypted_content,created_at) VALUES(?,?,?,?)')
          .run(`suggestion_${crypto.randomUUID().replaceAll('-','')}`,user.id,context.cryptoService.encrypt(content),new Date().toISOString())
        result={received:true};status=201
      }
      else if(request.method==='POST'&&path==='/v1/events/batch'){
        let accepted=0;for(const event of (body.events||[]).slice(0,50)){if(!event.eventId||!event.eventName)continue;context.db.prepare('INSERT OR IGNORE INTO product_events(event_id,user_id,event_name,safe_properties_json,occurred_at) VALUES(?,?,?,?,?)').run(event.eventId,user.id,String(event.eventName).slice(0,60),JSON.stringify(safeProperties(event.properties)),event.occurredAt||new Date().toISOString());accepted++}result={accepted};status=202
      }else if(request.method==='DELETE'&&path==='/v1/me'){
        context.db.exec('BEGIN IMMEDIATE');try{const deletedAt=new Date().toISOString();context.db.prepare("UPDATE analyses SET deleted_at=?,encrypted_question='deleted',encrypted_result=NULL WHERE user_id=?").run(deletedAt,user.id);context.db.prepare("UPDATE product_suggestions SET encrypted_content='deleted' WHERE user_id=?").run(user.id);context.db.prepare("UPDATE users SET openid_hash=?,status='deleted',deleted_at=? WHERE id=?").run(`deleted_${crypto.randomUUID().replaceAll('-','')}`,deletedAt,user.id);context.db.exec('COMMIT')}catch(e){context.db.exec('ROLLBACK');throw e}result={deleted:true}
      }else{json(response,404,{code:'NOT_FOUND',message:'接口不存在'});return}
      if(isWrite)context.db.prepare('INSERT INTO idempotency_records(user_id,route_key,idempotency_key,status_code,response_json,created_at) VALUES(?,?,?,?,?,?)').run(user.id,routeKey,idem,status,JSON.stringify(result),new Date().toISOString())
      json(response,status,result)
    }catch(error){const status=error.statusCode||500;if(status>=500)console.error('[server]',error.code||error.name);json(response,status,{code:error.code||'INTERNAL_ERROR',message:status>=500?'服务暂时不可用，未产生扣款或普通用户模型调用。':error.message})}
  })
}

if(require.main===module){
  const context=createContext();const server=createServer(context)
  server.listen(context.config.port,context.config.host,()=>console.log(`狗头军师 API：${context.config.host}:${context.config.port}（${context.config.modelMode}）`))
  if(context.config.webProxyEnabled){
    const proxy=createEncryptedWebProxyServer(context)
    proxy.listen(context.config.webProxyPort,context.config.host,()=>console.log(`加密 Web 代理：${context.config.host}:${context.config.webProxyPort}`))
  }
}

module.exports={createContext,createServer,createEncryptedWebProxyServer}
