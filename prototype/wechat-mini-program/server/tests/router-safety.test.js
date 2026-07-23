const test=require('node:test')
const assert=require('node:assert/strict')
const path=require('node:path')
const {createSkillRouter}=require('../src/services/skill-router')
const Safety=require('../src/services/safety-service')
const {weightedUsage}=require('../src/services/stepfun-gateway')

test('Skill 路由只选 1–3 个知识文件，危机场景强制安全文档',()=>{
  const router=createSkillRouter({repositoryRoot:path.resolve(__dirname,'../../../..')})
  const normal=router.route('最近总是我主动，他忽冷忽热',{});assert.ok(normal.files.length>=1&&normal.files.length<=3);assert.ok(normal.files.some((file)=>file.includes('关系投入失衡')))
  const crisis=router.route('他家暴并拿刀威胁我',{});assert.ok(crisis.files.some((file)=>file.includes('17-中国法律安全与危机转介')))
})

test('最新版 Skill 的话术、社交体系与主动约会指南可按需路由',()=>{
  const router=createSkillRouter({repositoryRoot:path.resolve(__dirname,'../../../..')})
  const reply=router.route('她发来这段聊天记录，我应该怎么回？',{})
  assert.equal(reply.scene,'tactical_reply')
  assert.ok(reply.files.some((file)=>file.includes('实战话术编排器')))
  assert.ok(reply.files.some((file)=>file.includes('在线约会与数字关系')))

  const classic=router.route('帮我把冷读和自然流用得真实一点',{})
  assert.equal(classic.scene,'classic_social_framework')
  assert.ok(classic.files.some((file)=>file.includes('20-经典社交体系')))
  assert.ok(classic.files.some((file)=>file.includes('自然流、内在状态')))

  const dating=router.route('第一次见面，怎样主动表达又尊重边界？',{})
  assert.equal(dating.scene,'active_dating')
  assert.ok(dating.files.some((file)=>file.includes('主动表达、第一次见面')))
})

test('第三人电话、邮箱、账号与地址在模型调用前去标识化',()=>{
  const clean=Safety.redact('A电话13812345678，邮箱a@example.com，微信 abcdef88，地址：上海市某区某路88号。')
  assert.ok(!clean.includes('13812345678'));assert.ok(!clean.includes('a@example.com'));assert.ok(!clean.includes('abcdef88'));assert.ok(!clean.includes('某路88号'))
})

test('阶跃 usage 按未缓存 + 缓存×0.2 + 输出×3折算',()=>{
  const usage=weightedUsage({prompt_tokens:6000,prompt_tokens_details:{cached_tokens:1000},completion_tokens:1000})
  assert.deepEqual(usage,{promptTokens:6000,cachedTokens:1000,completionTokens:1000,weightedTokens:8200})
  assert.equal(weightedUsage({prompt_tokens:100,prompt_tokens_details:{cached_tokens:200},completion_tokens:10}),null)
})
