const test=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')

const root=path.resolve(__dirname,'../../miniprogram')
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap((entry)=>entry.isDirectory()?files(path.join(dir,entry.name)):[path.join(dir,entry.name)])}

test('app.json 中所有页面与四件套文件存在',()=>{
  const app=JSON.parse(fs.readFileSync(path.join(root,'app.json'),'utf8'))
  for(const page of app.pages) for(const ext of ['.js','.json','.wxml','.wxss']) assert.ok(fs.existsSync(path.join(root,`${page}${ext}`)),`${page}${ext} missing`)
})

test('小程序包不含阶跃 Key 或任何真实支付调用',()=>{
  const source=files(root).filter((file)=>/\.(js|json|wxml|wxss)$/.test(file)).map((file)=>fs.readFileSync(file,'utf8')).join('\n')
  assert.ok(!/STEPFUN_API_KEY|sk-[A-Za-z0-9]{16,}/.test(source))
  assert.ok(!/wx\.(requestPayment|requestVirtualPayment)/.test(source))
  assert.ok(!/payment_success|out_trade_no/.test(source))
})

test('充值假门使用当前专业版文案与三档价格',()=>{
  const source=files(root).filter((file)=>/\.(js|json|wxml|wxss)$/.test(file)).map((file)=>fs.readFileSync(file,'utf8')).join('\n')
  assert.match(source,/professional_v3/)
  assert.match(source,/cny_1/)
  assert.match(source,/cny_6/)
  assert.match(source,/cny_12/)
  assert.match(source,/coins:\s*30/)
  assert.match(source,/coins:\s*75/)
  assert.match(source,/首充限定/)
  assert.ok(!/coins:\s*60|coins:\s*120/.test(source))
  assert.ok(!/humor_v\d|double_coin_v1/.test(source))
})

test('WXML 不使用未注册的 HTML 标签',()=>{
  const forbidden=/<\/?(?:div|span|small|b|strong|p|h[1-6])(?:\s|>)/
  for(const file of files(root).filter((item)=>item.endsWith('.wxml'))) assert.ok(!forbidden.test(fs.readFileSync(file,'utf8')),file)
})
