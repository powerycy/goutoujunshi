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

test('第三人电话、邮箱、账号与地址在模型调用前去标识化',()=>{
  const clean=Safety.redact('A电话13812345678，邮箱a@example.com，微信 abcdef88，地址：上海市某区某路88号。')
  assert.ok(!clean.includes('13812345678'));assert.ok(!clean.includes('a@example.com'));assert.ok(!clean.includes('abcdef88'));assert.ok(!clean.includes('某路88号'))
})

test('阶跃 usage 按未缓存 + 缓存×0.2 + 输出×3折算',()=>{
  const usage=weightedUsage({prompt_tokens:6000,prompt_tokens_details:{cached_tokens:1000},completion_tokens:1000})
  assert.deepEqual(usage,{promptTokens:6000,cachedTokens:1000,completionTokens:1000,weightedTokens:8200})
  assert.equal(weightedUsage({prompt_tokens:100,prompt_tokens_details:{cached_tokens:200},completion_tokens:10}),null)
})
