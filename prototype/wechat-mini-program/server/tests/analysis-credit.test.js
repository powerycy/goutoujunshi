const test=require('node:test')
const assert=require('node:assert/strict')
const {createContext}=require('../src/app')

function user(context,id='trial_user'){context.db.prepare('INSERT INTO users(id,openid_hash,role,status,created_at) VALUES(?,?,\'user\',\'active\',?)').run(id,`hash_${id}`,new Date().toISOString());context.beta.claim({id,role:'user'},{packageId:'cny_1'},`event_${id}`);return{id,role:'user'}}
function payload(question){return{question,profile:{targetAlias:'A',relationshipStage:'暧昧',goal:'判断是否继续',emotionIntensity:6},useTrialCredit:true,consent:{adultConfirmed:true,sensitiveDataProcessing:true}}}

test('只有 delivered 才核销，创建任务先原子预留防并发超发',async()=>{
  const context=createContext({databaseUrl:':memory:',config:{nodeEnv:'test',allowDevAuth:false,sessionSecret:'test-session-secret-long-enough',dataEncryptionKey:'test-data-key-long-enough',modelMode:'mock',betaCampaignQuota:1000,betaInviteRequired:false}});const current=user(context)
  const one=context.analysis.create(current,payload('我们认识两个月，最近总是我主动约见面，我想判断是否还值得继续投入。'))
  const two=context.analysis.create(current,payload('最近一次见面还不错，但对方从不主动安排下一次，我应该怎样验证互惠。'))
  const three=context.analysis.create(current,payload('这是第三份足够长的测试案卷，用于验证三次内测赠品均可被原子预留。'))
  assert.throws(()=>context.analysis.create(current,payload('这是第四份足够长的测试案卷，因为前三份正在处理，应当不能继续超额预留。')),/没有可用/)
  await context.analysis.process(one.analysisId);await context.analysis.process(two.analysisId);await context.analysis.process(three.analysisId)
  const row=context.db.prepare('SELECT trial_analysis_total,trial_analysis_used,trial_analysis_reserved FROM beta_cohort_members WHERE user_id=?').get(current.id)
  assert.deepEqual({...row},{trial_analysis_total:3,trial_analysis_used:3,trial_analysis_reserved:0})
})

test('安全拦截不核销内测分析券',async()=>{
  const context=createContext({databaseUrl:':memory:',config:{nodeEnv:'test',allowDevAuth:false,sessionSecret:'test-session-secret-long-enough',dataEncryptionKey:'test-data-key-long-enough',modelMode:'mock',betaCampaignQuota:1000,betaInviteRequired:false}});const current=user(context,'safety_user')
  const created=context.analysis.create(current,payload('对方正在家暴并且拿刀威胁我，我现在被堵门不让我走，应该怎么办。'))
  await context.analysis.process(created.analysisId);const task=context.analysis.get(current,created.analysisId);assert.equal(task.status,'blocked')
  const row=context.db.prepare('SELECT trial_analysis_used,trial_analysis_reserved FROM beta_cohort_members WHERE user_id=?').get(current.id);assert.deepEqual({...row},{trial_analysis_used:0,trial_analysis_reserved:0})
})

test('模型失败不核销内测分析券',async()=>{
  const gateway={analyze:async()=>{throw new Error('synthetic model failure')}}
  const context=createContext({databaseUrl:':memory:',gateway,config:{nodeEnv:'test',allowDevAuth:false,sessionSecret:'test-session-secret-long-enough',dataEncryptionKey:'test-data-key-long-enough',modelMode:'mock',betaCampaignQuota:1000,betaInviteRequired:false}});const current=user(context,'failure_user')
  const created=context.analysis.create(current,payload('这是一份用于验证模型失败不会核销免费额度的合成关系问题，内容足够长。'))
  await context.analysis.process(created.analysisId);assert.equal(context.analysis.get(current,created.analysisId).status,'failed')
  const row=context.db.prepare('SELECT trial_analysis_used,trial_analysis_reserved FROM beta_cohort_members WHERE user_id=?').get(current.id);assert.deepEqual({...row},{trial_analysis_used:0,trial_analysis_reserved:0})
})

test('单用户每日尝试上限阻止失败任务无限消耗模型成本',async()=>{
  const gateway={analyze:async()=>{throw new Error('synthetic model failure')}}
  const context=createContext({databaseUrl:':memory:',gateway,config:{nodeEnv:'test',allowDevAuth:false,sessionSecret:'test-session-secret-long-enough',dataEncryptionKey:'test-data-key-long-enough',modelMode:'mock',betaCampaignQuota:1000,betaInviteRequired:false,maxDailyAnalysisAttempts:2}})
  const current=user(context,'daily_limit_user')
  const first=context.analysis.create(current,payload('这是第一份用于验证每日失败尝试上限的合成关系问题，内容长度足够。'))
  await context.analysis.process(first.analysisId)
  const second=context.analysis.create(current,payload('这是第二份用于验证每日失败尝试上限的合成关系问题，内容长度也足够。'))
  await context.analysis.process(second.analysisId)
  assert.throws(()=>context.analysis.create(current,payload('这是第三份合成关系问题，应当在调用模型以前触发每日尝试次数上限。')),/今日分析尝试次数已达上限/)
  assert.equal(context.beta.getMine(current).trialAnalysisRemaining,3)
})

test('服务重启会释放排队任务预留的内测额度',()=>{
  const context=createContext({databaseUrl:':memory:',config:{nodeEnv:'test',allowDevAuth:false,sessionSecret:'test-session-secret-long-enough',dataEncryptionKey:'test-data-key-long-enough',modelMode:'mock',betaCampaignQuota:1000,betaInviteRequired:false}})
  const current=user(context,'restart_recovery_user')
  const created=context.analysis.create(current,payload('这是一份模拟服务重启中断的合成关系问题，内容长度足够用于创建任务。'))
  assert.equal(context.beta.getMine(current).trialAnalysisRemaining,2)
  assert.equal(context.analysis.recoverInterrupted(),1)
  const task=context.analysis.get(current,created.analysisId)
  assert.equal(task.status,'failed')
  assert.equal(task.errorCode,'PROCESS_RESTARTED')
  assert.equal(context.beta.getMine(current).trialAnalysisRemaining,3)
})

test('超过单次3狗头硬上限不交付且不核销',async()=>{
  const baseResult={emotionalGrounding:'先稳一下',facts:[],inferences:[],unknowns:[],recommendation:'暂停加码',reasons:[],nextAction:'等待',messageDraft:'',observationWindow:'48小时',stopConditions:['停止投入'],safetyNote:'AI生成'}
  const gateway={analyze:async()=>({result:baseResult,usage:{promptTokens:20000,cachedTokens:0,completionTokens:4000,weightedTokens:32000},modelMode:'synthetic'})}
  const context=createContext({databaseUrl:':memory:',gateway,config:{nodeEnv:'test',allowDevAuth:false,sessionSecret:'test-session-secret-long-enough',dataEncryptionKey:'test-data-key-long-enough',modelMode:'mock',betaCampaignQuota:1000,betaInviteRequired:false,maxWeightedTokens:30000}});const current=user(context,'limit_user')
  const created=context.analysis.create(current,payload('这是一份验证单次三狗头硬上限的合成关系问题，必须在超过上限时失败并恢复免费次数。'))
  await context.analysis.process(created.analysisId);assert.equal(context.analysis.get(current,created.analysisId).errorCode,'USAGE_INVALID_OR_OVER_LIMIT')
  assert.equal(context.beta.getMine(current).trialAnalysisRemaining,3)
})

test('内测名额外用户没有分析券或正式版首充资格',()=>{
  const context=createContext({databaseUrl:':memory:',config:{nodeEnv:'test',allowDevAuth:false,sessionSecret:'test-session-secret-long-enough',dataEncryptionKey:'test-data-key-long-enough',modelMode:'mock',betaCampaignQuota:0,betaInviteRequired:false}})
  const current=user(context,'sold_out_user');const benefit=context.beta.getMine(current)
  assert.equal(benefit.eligible,false);assert.equal(benefit.freeAnalysisEligible,false);assert.equal(benefit.trialAnalysisTotal,0);assert.equal(benefit.benefitVersion,null);assert.equal(benefit.launchBonusCoins,0)
  assert.throws(()=>context.analysis.create(current,payload('这是一份名额外普通用户不应在封测阶段调用模型的合成关系问题，长度足够。')),/没有可用的分析券/)
})
