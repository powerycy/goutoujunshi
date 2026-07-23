function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)) }
function weightedUsage(usage) {
  if (!usage || !Number.isFinite(usage.prompt_tokens) || !Number.isFinite(usage.completion_tokens)) return null
  const cached = Number(usage.prompt_tokens_details && usage.prompt_tokens_details.cached_tokens) || 0
  if (cached < 0 || cached > usage.prompt_tokens) return null
  const uncached = usage.prompt_tokens - cached
  return { promptTokens:usage.prompt_tokens, cachedTokens:cached, completionTokens:usage.completion_tokens, weightedTokens:Math.ceil(uncached + cached*.2 + usage.completion_tokens*3) }
}

function mockResult(profile) {
  const target = profile.targetAlias || 'A'
  return {
    emotionalGrounding:'你现在难受的，可能不只是对方有没有回应，而是持续投入却得不到确定反馈。这个情绪合理，但它还不能替代对局势的判断。',
    facts:[`你把关系阶段描述为“${profile.relationshipStage || '未知'}”。`,`你当前的目标是“${profile.goal || '看清下一步'}”。`,'当前信息只包含你的叙述，尚未得到对方的直接说明。'],
    inferences:[`${target} 的行为可能代表投入不足，也可能受现实安排影响；仅凭一次互动不能定论。`],
    unknowns:[`${target} 是否愿意主动安排下一次具体互动？`,'当你提出明确需要时，对方是否理解、尊重并落实？'],
    recommendation:'先停止继续加码，用一次具体、可回答的行动验证互惠；之后按行为而不是想象决定是否继续。',
    reasons:['可获得比反复猜测更强的新信息。','行动可逆，情绪和机会成本较低。','把继续投入的条件交给双方共同完成。'],
    nextAction:'发出一次时间明确、内容具体的邀约或沟通请求，然后不连发补充解释。',
    messageDraft:`这周我想和你认真聊/见一次。周六下午或周日晚上你哪个方便？如果最近没有继续推进的打算，也可以直接告诉我。`,
    observationWindow:'发出后等待 48 小时；重点看是否给出明确回应、替代时间与后续兑现。',
    stopConditions:['连续两次拒绝且不提供替代时间','只接受你的投入但长期不主动','表达边界后被嘲讽、惩罚或继续越界'],
    safetyNote:'AI 生成的本地演示结果，仅供关系决策参考，不替代医疗、法律、警方或紧急服务。'
  }
}

function createStepfunGateway(config, usageLedger, dependencies = {}) {
  const fetchImpl = dependencies.fetchImpl || fetch
  const sleepImpl = dependencies.sleepImpl || sleep
  function recordCall(event) {
    if (!usageLedger || typeof usageLedger.record !== 'function') return
    try { usageLedger.record(event) }
    catch (error) { console.error('[usage-ledger]', error.code || error.name) }
  }
  async function requestCompletion(requestId, items, suffix='', deadline=Date.now()+config.modelTimeoutMs) {
    let lastError
    for (let attempt=0; attempt<3; attempt++) {
      const remaining=deadline-Date.now()
      if(remaining<=0) { const e=new Error('StepFun total timeout'); e.name='AbortError'; throw e }
      const controller = new AbortController(); const timeout=setTimeout(()=>controller.abort(),remaining)
      const startedAt=Date.now();let httpStatus=null;let providerRequestId=null;let usage=null;let recorded=false
      const phase=suffix==='-repair'?'repair':'initial'
      const finish=(outcome,error)=>{
        if(recorded)return
        recorded=true
        recordCall({analysisId:requestId,provider:'stepfun',model:config.stepfunModel,phase,attempt:attempt+1,outcome,
          providerRequestId,httpStatus,usage,durationMs:Date.now()-startedAt,errorCode:error&&(error.code||error.name)})
      }
      try {
        const response = await fetchImpl(`${config.stepfunBaseUrl}/chat/completions`, { method:'POST', signal:controller.signal,
          headers:{ Authorization:`Bearer ${config.stepfunApiKey}`,'Content-Type':'application/json','X-Request-ID':`${requestId}${suffix}` },
          body:JSON.stringify({ model:config.stepfunModel, messages:items, temperature:.35, max_tokens:2400, response_format:{type:'json_object'} }) })
        httpStatus=response.status
        const payload = await response.json(); clearTimeout(timeout)
        providerRequestId=payload.id||null;usage=weightedUsage(payload.usage)
        if (!response.ok) { const e=new Error(`StepFun ${response.status}`); e.code=`HTTP_${response.status}`;e.retryable=response.status===429||response.status>=500;finish('http_error',e);throw e }
        const content = payload.choices && payload.choices[0] && payload.choices[0].message && payload.choices[0].message.content
        finish('succeeded')
        return { content, usage, requestId:payload.id }
      } catch (error) {
        clearTimeout(timeout);lastError=error
        finish(error.name==='AbortError'?'timeout':httpStatus?'response_error':'network_error',error)
        if (attempt===2 || (!error.retryable && error.name!=='AbortError')) break
        await sleepImpl(300 * (2 ** attempt))
      }
    }
    throw lastError
  }
  function combineUsage(first, second) {
    if (!first || !second) return null
    return { promptTokens:first.promptTokens+second.promptTokens,cachedTokens:first.cachedTokens+second.cachedTokens,completionTokens:first.completionTokens+second.completionTokens,weightedTokens:first.weightedTokens+second.weightedTokens }
  }
  async function real(messages) {
    const deadline=Date.now()+config.modelTimeoutMs
    const first=await requestCompletion(messages.requestId,messages.items,'',deadline)
    try { return {result:JSON.parse(first.content),usage:first.usage,requestId:first.requestId,modelMode:'stepfun'} }
    catch (_) {
      const repairItems=[...messages.items,{role:'assistant',content:String(first.content||'').slice(0,12000)},{role:'user',content:'上一个回答不是合法 JSON。只修复 JSON 语法并保持规定字段，不添加解释或 Markdown。'}]
      const repaired=await requestCompletion(messages.requestId,repairItems,'-repair',deadline)
      return {result:JSON.parse(repaired.content),usage:combineUsage(first.usage,repaired.usage),requestId:repaired.requestId,modelMode:'stepfun'}
    }
  }
  async function analyze(input) {
    if (config.modelMode === 'mock') return { result:mockResult(input.profile), usage:{promptTokens:0,cachedTokens:0,completionTokens:0,weightedTokens:0}, requestId:`mock_${input.requestId}`, modelMode:'mock' }
    return real(input.messages)
  }
  return { analyze, weightedUsage }
}

module.exports = { createStepfunGateway, weightedUsage }
