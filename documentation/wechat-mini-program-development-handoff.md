# 狗头军师微信小程序：开发交接文档

> 交接日期：2026-07-21。目标是让新开发任务无需重新调研即可直接实现。本文区分“今天可完成的开发者工具/体验版”与“需主体、资质和审核的正式收费上线”。

## 1. 今日交付目标

今天的 P0 目标：完成一个可在微信开发者工具运行、具备真实阶跃分析能力和假门付费闭环的免费封闭内测版。

必须完成：

- 微信原生小程序前端，可导入、编译、浏览主要页面。
- 首页、建档/问题输入、分析中、结果、价格假门、内测权益和我的页面。
- 服务端阶跃 `step-3.5-flash` 调用；API Key 只在服务端。
- 读取当前仓库 `SKILL.md`，按场景选择必要知识库，不把整套资料塞进上下文。
- 基础输入/输出安全与危机场景拒答。
- 假门购买意愿记录；不调用任何真实支付接口。
- 新人限定假门点击的前 10,000 名去重服务端用户每人获得 2 次免费完整分析；第 10,001 名以后只记录价格点击。只有成功交付才核销。
- `founding_beta_2026` 内测用户预留正式版 10 个活动狗头，实际发放后 60 天有效，权益版本为 `launch_credit_10_60d_v1`。
- 最小服务端用户、内测资格、分析任务和事件存储；跨设备不丢失。
- 可运行说明、环境变量模板、验证命令和已知限制。

今天不应承诺：

- 正式收费上线、微信代码审核通过或公开发布。
- 真实虚拟支付、退款、提现和发票。
- 在没有 AppID、体验成员权限、备案域名/CloudBase 环境时上传体验版。
- 在没有阶跃 API Key 时产生真实模型回答。

如果外部条件缺失，今日完成标准降级为：本地服务端＋微信开发者工具全链路可运行，接口有明确的 mock/真实模式切换；不得把 mock 回答描述成已经上线。

## 2. 开发前先读

按以下顺序读取，禁止重新发明产品规则：

1. [产品定位](product.md)
2. [关键流程](flows.md)
3. [商业化与定价](commercialization-and-pricing.md)
4. [假门付费内测规格](fake-door-beta.md)
5. [微信上线与支付调研](wechat-mini-program-launch-and-payment.md)
6. 项目根目录 [SKILL.md](../SKILL.md)
7. `references/knowledge/01-证据分级与内容边界.md`
8. `references/knowledge/17-中国法律安全与危机转介.md`

现有原型位于 `prototype/wechat-mini-program/`。保留已完成的价格页、假门弹层、分析券状态机和幽默文案，在此基础上扩展，不另建重复项目。

## 3. 视觉方向

### 3.1 采用的方向

使用用户指定的 `personal-homepage-skill` 视觉原则，选择其 **Magazine Portfolio＋Clean Developer Homepage** 的交集，适配为“暖色编辑部案卷桌”。

视觉关键词：

```text
编辑感 / 案卷 / 纸张 / 证据标签 / 克制幽默 / 温暖但不幼稚
```

为什么不使用 3D、暗黑赛博或通用 AI 渐变：

- 用户面对的是敏感关系问题，首要是可读、可信和低压力。
- 3D 与粒子不帮助理解案情，还增加小程序包体和低端机风险。
- 产品必须是关系决策工具，不能通过拟人化形象营造陪伴依赖。

### 3.2 视觉 Token

```css
--paper: #FFF8EB;          /* 页面底色 */
--paper-raised: #FFFCF6;   /* 表单、结果正文 */
--ink: #251D17;            /* 主文字 */
--ink-soft: #6F6259;       /* 次文字 */
--orange: #F4A340;         /* 主按钮 */
--terracotta: #C2602C;     /* 标签、强调 */
--gold-paper: #FFF0C7;     /* 内测权益 */
--sage: #EDF6EC;           /* 安全、完成 */
--danger: #9F3D32;         /* 危机提示 */
--line: #EADFD0;           /* 分隔、输入边框 */
```

禁止通用紫蓝渐变、随机发光球、廉价全局玻璃态、所有卡片同尺寸和多层浓阴影。

### 3.3 中文排版

- 标题：优先 `STSong, Songti SC, Noto Serif CJK SC, serif`；若 Android 字形不稳定，降级为加粗中文无衬线，不请求不可访问的网络字体。
- 正文：`PingFang SC, Noto Sans CJK SC, Microsoft YaHei, sans-serif`。
- 数字与 Token 元数据：系统等宽字体，仅用于小标签，不能让正文变成技术面板。
- 主要标题 48–60rpx，页面标题 38–44rpx，正文 28rpx，说明 22–24rpx，行高 1.55–1.75。
- 长结果正文单行控制在约 22–30 个汉字的视觉宽度，段落间距明显。

### 3.4 布局语法

首屏不是普通“左文右图”：

- 左上是小型案卷编号和 `关系问题分析与决策软件` 标签。
- 主标题分三行：`把关系问题 / 拆清楚 / 再行动`。
- 右下/标题后方是抽象“案卷纸＋证据便签＋爪印章”组合，不使用会眨眼、说想你的狗头角色。
- 主按钮：`开始问题分析`。
- 次入口：`查看分析方法`。
- 右上角显示免费分析剩余次数/内测身份，不堆多个 SaaS 数据卡。

主要页面保持一张连续纸面：通过纸张纹理、细线、编号、印章和便签串联，不用每屏更换不相关背景色。

圆角只设三个层级：输入/小控件 12rpx，卡片 20rpx，底部弹层 32rpx。避免所有元素都变成药丸。

### 3.5 动效

唯一主要动效系统是“案卷展开”：

- 首次进入：标题和案卷层以 `opacity + translateY` 在 220–320ms 内完成。
- 页面切换/结果出现：像翻开新纸页，位移不超过 20rpx。
- 按钮按下：缩放最低 0.98，120ms；不做磁吸或粒子爆炸。
- 分析中使用三步状态文案，不展示假进度百分比。
- 低端机、系统减少动态效果或页面后台时取消非必要动画。

### 3.6 视觉检查

交付前必须检查：

- iPhone 小屏和常见 Android 宽度无横向溢出。
- 中文标题换行有意图，不出现单字悬挂。
- 首页只有一个视觉焦点和一个主 CTA。
- 重要按钮触控区域至少约 88rpx 高。
- 文字与纸面背景对比充足；危险提示不能只靠颜色。
- 无不可访问图片、假头像、假背书或虚构数据。
- 动效不延迟用户阅读和提交。

设计审查结论模板：

```text
Design review: PASS / NEEDS REVISION
Strongest part:
Main risk:
Changes made:
Skipped verification:
```

## 4. 信息架构与页面

### P0 页面

| 页面 | 目标 | 关键组件 |
| --- | --- | --- |
| `home` | 让用户立即提交具体问题，不营造 AI 陪伴 | 问题分析 Hero、主 CTA、结构化方法、权益入口 |
| `case-intake` | 收集最小必要问题 | 问题正文、对象代号、关系阶段、目标、情绪强度 |
| `analysis-loading` | 表达系统正在处理 | 三步状态、取消/返回、隐私提示 |
| `analysis-result` | 给出可执行关系建议 | 情绪确认、事实/推测/未知、判断、行动、停止条件、安全提示 |
| `pricing` | 新人限定免费内测入口 | ¥1/10 新人限定、未接支付说明、价值与计费说明 |
| `beta-reward` | 即时揭示未扣款并授予权益 | 回执、创始内测官、2 次免费分析、正式版 10 狗头/60天权益 |
| `history` | 查看自己的分析 | 标题、时间、对象代号、状态、删除 |
| `me` | 管理权益与数据 | 内测身份、免费分析次数、正式版 10 狗头活动额度、隐私、删除/注销 |

### 后置页面

- 真实充值、余额批次、退款与发票。
- 多人关系档案深度管理。
- 管理后台、投诉、安全事件和对账。

## 5. 核心用户流程

### 5.1 免费分析

```text
首页
→ 递交案卷
→ 填写问题与最小档案
→ 输入安全检查
→ 创建 analysis task
→ Skill 路由与阶跃调用
→ 输出安全检查
→ 成功交付结果
→ 服务端在事务中把一次预留免费分析转为已使用
```

创建任务时先原子预留一次，防止双设备超发。失败、超时、被安全层拦截或没有产生可用结果时释放预留、不核销。

### 5.2 假门测试

严格执行 [fake-door-beta.md](fake-door-beta.md)：

```text
查看价格
→ 点击新人限定 ¥1/10
→ 记录 package_clicked
→ 不调用支付 SDK
→ 立即说明没有扣款
→ 事务争抢前 10,000 名
→ 命中者幂等登记 founding_beta_2026，发 2 次免费分析
→ 同时登记 launch_credit_10_60d_v1，正式版一次性发 10 个活动狗头，到账后 60 天有效
→ 名额外只记录价格点击
→ 有资格时进入关系问题提交页；名额外返回首页
```

禁止出现 `payment_success`、虚构微信订单号或仿造微信支付弹窗。

### 5.3 结果结构

每次结果按以下顺序渲染：

1. `先稳一下`：一句情绪确认，不表达 AI 对用户的依恋。
2. `案情拆解`：已知事实、合理推测、关键未知。
3. `核心判断`：明确首选建议和核心理由。
4. `下一步`：一件小行动，可选沟通话术。
5. `观察窗口`：多久、看什么信号。
6. `停止条件`：什么情况下停止投入、求助或退出。
7. `AI 提示`：AI 生成，不替代专业医疗、法律或紧急服务。

## 6. 技术架构

### 6.1 P0 路线

```text
微信原生小程序（WXML/WXSS/JavaScript）
        │ HTTPS
Node.js API 服务
  ├─ 微信登录适配器 / 开发模式匿名身份
  ├─ Beta entitlement 服务
  ├─ Analysis orchestrator
  ├─ Skill router + 知识库读取
  ├─ StepFun gateway
  └─ Safety service
        │
SQLite（仅本地开发）/ PostgreSQL 或 CloudBase 数据库（真实跨设备内测）
```

不要把阶跃 API Key、系统提示词或完整知识库放进小程序包。

### 6.2 推荐目录

```text
prototype/wechat-mini-program/
  project.config.json
  miniprogram/
    app.js
    app.json
    app.wxss
    config/
      copy.js
      theme.js
    components/
      case-file-hero/
      evidence-section/
      beta-badge/
      analysis-state/
    pages/
      home/
      case-intake/
      analysis-result/
      pricing/
      history/
      me/
    services/
      api.js
      auth.js
      beta.js
      analysis.js
    utils/
      request.js
      idempotency.js
  server/
    src/
      app.js
      config.js
      routes/
      services/
        beta-service.js
        analysis-service.js
        stepfun-gateway.js
        skill-router.js
        safety-service.js
      repositories/
      db/
    tests/
    .env.example
```

可调整语言或框架，但不要为了今天上线引入不必要的 React、3D、状态库或微服务。

## 7. 服务端接口

所有写接口接受 `Idempotency-Key`；用户身份只能由服务端会话确定，不能相信前端传来的 user_id。

### 7.1 登录

`POST /v1/auth/wechat`

```json
{
  "code": "wx.login 返回的临时代码"
}
```

返回服务端 session token。开发模式可用明确标识为 `dev_only` 的匿名会话，但不能部署成公开环境默认值。

### 7.2 查询我的内测权益

`GET /v1/beta/me`

```json
{
  "eligible": true,
  "cohort": "founding_beta_2026",
  "freeAnalysisEligible": true,
  "remainingSlots": 9999,
  "trialAnalysisTotal": 2,
  "trialAnalysisRemaining": 2,
  "benefitVersion": "launch_credit_10_60d_v1",
  "launchBonusCoins": 10,
  "launchBonusValidityDays": 60,
  "benefitStatus": "reserved"
}
```

### 7.3 记录假门购买意愿

`POST /v1/beta/purchase-intents`

```json
{
  "packageId": "cny_1",
  "copyVersion": "professional_v3",
  "source": "pricing_page"
}
```

首次调用在事务中争抢 10,000 个内测名额；命中者创建内测身份，获得 2 次免费完整分析和 `launch_credit_10_60d_v1`。名额外只记录点击。重复调用记录点击但不追加次数或占用名额。返回：

```json
{
  "isNewBeta": true,
  "eligible": true,
  "freeAnalysisGranted": true,
  "paymentInvoked": false,
  "remainingSlots": 9999,
  "trialAnalysisTotal": 2,
  "trialAnalysisRemaining": 2,
  "benefitVersion": "launch_credit_10_60d_v1",
  "launchBonusCoins": 10,
  "launchBonusValidityDays": 60
}
```

### 7.4 创建分析任务

`POST /v1/analyses`

```json
{
  "question": "用户问题",
  "profile": {
    "selfAlias": "我",
    "targetAlias": "A",
    "relationshipStage": "暧昧",
    "goal": "判断是否继续推进",
    "emotionIntensity": 7
  },
  "useTrialCredit": true
}
```

返回 `202`：

```json
{
  "analysisId": "ana_...",
  "status": "queued"
}
```

服务端创建任务时条件增加 `trial_analysis_reserved`；完成输入审核、模型调用、输出审核和结果存储后才将状态更新为 `delivered`，并在同一数据库事务中把预留转为 `trial_analysis_used`。失败、超时和安全拦截释放预留。

### 7.5 查询分析

`GET /v1/analyses/{analysisId}`

状态：`queued`、`running`、`delivered`、`blocked`、`failed`。仅 `delivered` 含完整结果并核销一次免费分析。

### 7.6 删除分析

`DELETE /v1/analyses/{analysisId}`

只允许删除当前用户记录；删除问题正文不删除依法必须保留的最小财务/安全审计信息。免费 P0 没有财务记录。

### 7.7 事件

`POST /v1/events/batch`

允许批量提交非敏感产品事件。不得把问题正文、真实姓名或第三人联系方式作为埋点属性。

## 8. 数据表

### `users`

```text
id, openid_hash, status, created_at, deleted_at
```

### `beta_cohort_members`

```text
user_id UNIQUE
cohort
joined_at
selected_package
trial_analysis_total
trial_analysis_used
trial_analysis_reserved
benefit_version
benefit_status
source_event_id UNIQUE
```

### `beta_campaigns`

```text
campaign_key PRIMARY KEY = founding_beta_2026
quota_total = 10000
claimed_count
```

`claimed_count` 只统计获得 2 次免费分析和正式版活动狗头的去重用户；第 10,001 名以后不写入 `beta_cohort_members`。

### `purchase_intents`

```text
id, user_id, package_id, displayed_price_fen, copy_version, source, created_at
```

### `analyses`

```text
id, user_id, status, encrypted_question, encrypted_result
profile_json, risk_level, model, prompt_version
prompt_tokens, cached_tokens, completion_tokens, folded_tokens
access_grant_type, error_code, created_at, delivered_at, deleted_at
```

### `product_events`

```text
event_id UNIQUE, user_id, event_name, safe_properties_json, occurred_at
```

任何免费资格占位、预留、核销都用条件更新或事务锁，禁止先读余额再无条件写回。第 10,000/10,001 名必须用两个独立数据库连接做并发边界测试。

## 9. 模型与 Skill 接入

模型：`step-3.5-flash`。使用阶跃 Chat Completions，服务端读取 usage。

### 9.1 路由

1. 固定读取根 `SKILL.md` 的行为规则。
2. 输入先分类：约会推进、沟通冲突、投入失衡、分手背叛、多人选择、危机安全等。
3. 只加载当前场景最相关的 1–3 份知识文件。
4. 安全场景强制加入 `references/knowledge/17-中国法律安全与危机转介.md`。
5. 对象用代号；模型调用前去除电话、地址、账号等第三人识别信息。

### 9.2 输出契约

优先要求模型返回结构化 JSON，再由前端渲染：

```json
{
  "emotionalGrounding": "",
  "facts": [],
  "inferences": [],
  "unknowns": [],
  "recommendation": "",
  "reasons": [],
  "nextAction": "",
  "messageDraft": "",
  "observationWindow": "",
  "stopConditions": [],
  "safetyNote": ""
}
```

JSON 解析失败时允许一次修复重试；仍失败则标记 `failed`，释放预留且不核销免费分析。

### 9.3 超时与重试

- API 总超时建议 60 秒。
- 网络/429/5xx 最多两次指数退避重试，复用业务 request_id。
- 不在客户端直接重试创建新任务。
- usage 缺失或自相矛盾时记录异常；免费体验仍可交付，但不能生成虚构用量。

## 10. 内容安全

输入和输出至少覆盖：

- 自伤自杀、伤人或紧急危险。
- 家暴、性胁迫、跟踪和隐私威胁。
- 未成年人性内容。
- 诈骗、勒索、冒充和财务操控。
- 绕过同意、PUA、控制和报复。
- 医疗/心理诊断、法律结论和紧急救援越界。

命中紧急风险时：停止常规恋爱策略，优先现实安全、可信联系人和当地紧急/专业服务。不要用幽默稀释危机提示。

所有普通结果持续标识 `AI 生成，仅供关系决策参考`。

## 11. 配置与秘密

服务端 `.env.example`：

```text
NODE_ENV=development
PORT=3000
DATABASE_URL=
SESSION_SECRET=
WECHAT_APP_ID=
WECHAT_APP_SECRET=
STEPFUN_API_KEY=
STEPFUN_MODEL=step-3.5-flash
STEPFUN_BASE_URL=
DATA_ENCRYPTION_KEY=
ALLOW_DEV_AUTH=true
```

规则：

- `.env` 不提交仓库。
- `ALLOW_DEV_AUTH` 在任何公开环境必须为 `false`。
- 日志不输出密钥、session、完整输入/输出和第三人信息。
- 小程序只配置 API 基础地址和公开版本号。

## 12. 今日实施顺序

### 第 1 段：跑通骨架

- 重构现有 prototype 为上述页面结构。
- 集中视觉 Token 和文案。
- 首页→建档→分析→结果→价格→假门→我的可导航。

### 第 2 段：服务端

- 建 Node API、数据库迁移和开发模式登录。
- 实现 beta、analysis、event 接口和幂等。
- 前端本地存储降级保留，但真实模式优先服务端。

### 第 3 段：模型

- 接阶跃、Skill 路由、知识文件白名单和结构化输出。
- 加超时、重试、usage 和失败不核销。

### 第 4 段：安全与验证

- 加最小输入/输出审核和危机拒答。
- 运行单测、接口测试和前端脚本/JSON 校验。
- 在微信开发者工具检查首页、价格弹层、小屏和分析长文。

### 第 5 段：体验版（仅外部条件齐备）

- 替换真实 AppID、关闭开发模式身份和域名校验豁免。
- 配置合法 HTTPS 域名或 CloudBase 环境。
- 添加体验成员，上传体验版并用真机走一次完整流程。

## 13. 验收标准

### 功能

- 新用户能完整走完首页→问题→分析→结果。
- 前 10,000 名去重用户每人 2 次免费分析，并预留正式版 10 个活动狗头、到账后 60 天有效；第 10,001 名以后只记录价格点击。
- 重复点击、双击和换设备不重复占名额或增加次数；第 10,000/10,001 名并发时只一人获得免费资格。
- 分析失败、拦截、超时不核销。
- 假门不调用 `wx.requestPayment` 或 `wx.requestVirtualPayment`。
- 只展示并记录新人限定 ¥1/10；本次实收永远为 0。
- 跨设备登录同一用户时权益一致；开发模式例外须明确标记。

### 模型

- API Key 不在小程序包和日志。
- 每次只读取必要知识文件。
- 结果区分事实、推测和未知，并有下一步和停止条件。
- 高风险问题进入安全流程。

### 视觉

- 暖色编辑案卷视觉统一，无通用 AI 紫色渐变。
- 首页有明确记忆点和单一主 CTA。
- 结果长文可读，卡片不全部同形同尺寸。
- iPhone 小屏/常见 Android 无横向溢出。
- 动效只服务案卷展开，低动态模式可降级。

### 工程

- README 含启动、测试、环境变量和体验版说明。
- 新增代码有测试或可复现验证命令。
- 不覆盖本仓库既有未提交文件。
- 最终说明真实完成、未完成和被外部条件阻断的事项。

## 14. 开发任务首条指令

新任务应直接执行：

> 在仓库根目录继续开发 `prototype/wechat-mini-program`。先完整阅读 `documentation/wechat-mini-program-development-handoff.md` 及其中列出的源文档，再检查工作区和现有原型。产品必须包装为“关系问题分析与行动决策软件”，不是聊天机器人或 AI 陪伴；界面围绕提交问题、结构化分析报告、核心判断、行动计划、观察窗口和停止条件。严格采用交接文档中已选定的“暖色编辑部案卷桌”方向。内测只展示新人限定 ¥1/10，当前不接支付；前 10,000 名获得 2 次免费完整分析，并预留正式版 10 个活动狗头、发放后 60 天有效。正式套餐为 ¥1/10、¥6/30、¥12/75。不得接真实支付；没有 AppID、API Key、云环境或审核条件时，诚实完成本地/开发者工具版本并列出阻断，不得声称正式上线。保留用户已有未提交改动。
