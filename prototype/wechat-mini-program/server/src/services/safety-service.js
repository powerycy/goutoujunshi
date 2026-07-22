const RISK_RULES = [
  { type:'immediate_danger', urgent:true, words:['现在就要自杀','马上自杀','杀了他','杀了她','有刀','准备跳楼','不想活了'] },
  { type:'domestic_violence', urgent:true, words:['掐脖子','家暴','持刀威胁','限制人身自由','堵门不让我走','强迫发生关系'] },
  { type:'stalking_or_coercion', urgent:false, words:['跟踪她','跟踪他','定位他手机','定位她手机','偷拍','下药','怎么强迫','绕过拒绝','逼他复合','逼她复合'] },
  { type:'minor_sexual_content', urgent:false, words:['未成年裸照','未成年人性','儿童色情'] },
  { type:'fraud_or_extortion', urgent:false, words:['裸聊勒索','冒充账号骗','骗他转账','骗她转账','勒索'] }
]

function detect(text) {
  const normalized = String(text || '').toLowerCase()
  for (const rule of RISK_RULES) if (rule.words.some((word) => normalized.includes(word))) return { blocked:true, riskLevel:rule.urgent?'urgent':'high', category:rule.type, urgent:rule.urgent }
  return { blocked:false, riskLevel:'normal', category:'relationship' }
}

function redact(text) {
  return String(text || '')
    .replace(/1[3-9]\d{9}/g, '[手机号已去除]')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[邮箱已去除]')
    .replace(/(?:微信|wx|QQ|qq|账号|身份证)[：:\s]*[A-Za-z0-9_-]{5,}/g, '[账号已去除]')
    .replace(/\b\d{17}[\dXx]\b/g, '[身份证已去除]')
    .replace(/(?:住址|地址)[：:]?[^，。\n]{4,40}/g, '地址：[详细地址已去除]')
}

function crisisResult(risk) {
  const urgent = risk.urgent
  return {
    emotionalGrounding: urgent ? '先暂停分析关系输赢。你描述的内容可能涉及立即人身危险，现实安全比任何回复话术都优先。' : '这已经超出普通恋爱策略范围。先保护安全、边界与证据，不需要用继续关系换取对方停止威胁。',
    facts: urgent ? ['如果危险正在发生，先离开现场并联系可信的人。','在中国大陆，可立即联系 110；有医疗急症联系 120。'] : ['不要单独赴约、摊牌或为取证返回危险现场。','在不增加危险的前提下保存威胁、转账、定位或骚扰记录。'],
    inferences: [], unknowns: [], recommendation: '停止常规恋爱推进，转入现实安全支持。', reasons: [],
    nextAction: urgent ? '现在就联系身边可信的人，让对方陪同你联系 110/120 或前往安全地点。' : '把情况告诉一名可信的人，检查共享定位和账号登录，并通过当地警方、妇联、法律援助或专业机构核实可用支持。',
    messageDraft: '', observationWindow: '不等待对方“冷静后再说”；以现实安全是否恢复为准。',
    stopConditions: ['不单独见面或摊牌','不承诺为威胁保密','不继续付款或提供隐私材料','出现立即危险时直接联系紧急服务'],
    safetyNote: '一般安全信息，不构成个案法律、医疗或危机干预意见。现实紧急情况请联系当地紧急服务和合格专业人员。'
  }
}

function validateOutput(result) {
  const required = ['emotionalGrounding','facts','inferences','unknowns','recommendation','reasons','nextAction','observationWindow','stopConditions','safetyNote']
  if (!result || typeof result !== 'object' || required.some((key) => result[key] == null)) return { ok:false, code:'OUTPUT_CONTRACT_INVALID' }
  const dangerous = detect([result.recommendation,result.nextAction,result.messageDraft,...(result.stopConditions||[])].join(' '))
  if (dangerous.blocked && ['stalking_or_coercion','fraud_or_extortion','minor_sexual_content'].includes(dangerous.category)) return { ok:false, code:'UNSAFE_OUTPUT' }
  return { ok:true }
}

module.exports = { crisisResult, detect, redact, validateOutput }
