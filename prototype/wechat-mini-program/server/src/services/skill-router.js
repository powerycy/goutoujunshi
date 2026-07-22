const fs = require('node:fs')
const path = require('node:path')

const ROUTES = [
  { scene:'crisis_safety', words:['家暴','威胁','跟踪','自杀','伤人','强迫','勒索','诈骗'], files:['references/knowledge/17-中国法律安全与危机转介.md'] },
  { scene:'breakup_betrayal', words:['分手','复合','出轨','背叛','前任'], files:['references/knowledge/15-分手背叛与关系修复.md'] },
  { scene:'conflict_repair', words:['吵架','冲突','冷战','道歉','沟通'], files:['references/knowledge/07-沟通冲突与修复.md'] },
  { scene:'investment_imbalance', words:['只有我主动','投入','忽冷忽热','回复慢','不主动'], files:['references/practical/关系投入失衡：互惠判断、降级投入与退出决策.md'] },
  { scene:'dating_progress', words:['暧昧','邀约','约会','表白','推进','认识'], files:['references/knowledge/06-吸引约会与关系启动.md'] },
  { scene:'multi_choice', words:['两个人','多人','选择谁','对象a','对象b'], files:['references/knowledge/16-多元关系与反刻板印象.md'] },
  { scene:'consent_boundary', words:['同意','边界','性','亲密','拒绝'], files:['references/knowledge/08-同意边界性与亲密.md'] },
  { scene:'digital_relationship', words:['网恋','已读','拉黑','社交媒体','微信'], files:['references/knowledge/09-在线约会与数字关系.md'] }
]

function createSkillRouter(config) {
  function route(question, profile) {
    const text = `${question} ${profile.relationshipStage || ''} ${profile.goal || ''}`.toLowerCase()
    const matched = ROUTES.find((item) => item.words.some((word) => text.includes(word))) || { scene:'relationship_quality', files:['references/knowledge/02-亲密关系心理学总论.md'] }
    const files = ['references/knowledge/01-证据分级与内容边界.md', ...matched.files].slice(0,3)
    return { scene: matched.scene, files }
  }
  function load(question, profile) {
    const selected = route(question, profile)
    const rootSkill = fs.readFileSync(path.join(config.repositoryRoot, 'SKILL.md'), 'utf8')
    const knowledge = selected.files.map((relativePath) => ({ relativePath, content: fs.readFileSync(path.join(config.repositoryRoot, relativePath), 'utf8') }))
    return { ...selected, rootSkill, knowledge }
  }
  return { load, route }
}

module.exports = { createSkillRouter }
