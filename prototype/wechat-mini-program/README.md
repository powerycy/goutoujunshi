# 狗头军师微信小程序｜免费封闭内测版

微信原生小程序 + Node.js API + SQLite 的本地/微信开发者工具版本。产品定位为“关系问题分析与行动决策软件”，不是聊天机器人或 AI 陪伴。视觉采用克制的苹果风绿色界面，分析直接在首页对话流中返回。

这不是正式上线版本。当前没有真实支付，默认模型模式是明确标识的本地 mock；只有配置阶跃 Key 并切换模式后才会调用 `step-3.5-flash`。

## 已实现

- 首页直接输入与结构化回答、价格意向页、权益回执、历史判断、个人中心与注销。
- 稳定服务端身份：开发环境使用明确标识的 `dev` 会话；生产适配微信 `jscode2session`。
- 封闭内测入口不调用任何支付 SDK：用户选择 ¥1/¥6/¥12 套餐并点击充值后，明确提示本次无需支付。
- 总计 1,000 个一次性邀请码；邀请码绑定稳定微信用户，每位内测用户领取 3 次完整分析。
- 内测用户记录所选套餐，并保留正式上线后首次充值“充多少送多少”的资格标识。
- 资格领取与邀请码兑换使用事务原子占位；任务创建原子预留次数；只有 `delivered` 核销。失败、超时、安全拦截会释放预留。
- 根 `SKILL.md` 固定加载，知识库按场景只读取 1–3 份；危机场景强制安全文档。
- 输入去除电话、邮箱、账号、身份证和详细地址；输入/输出基础安全；危机问题切换现实安全流程。
- 阶跃 `step-3.5-flash` 网关、60 秒超时、429/5xx 重试、结构化 JSON、usage 折算和单次 3 狗头（30,000 成本折算 Token）硬上限。
- 阶跃每次实际调用单独写入成本流水，成功、失败、重试和 JSON 修复均保留；按调用发生时的输入、缓存输入和输出单价计算历史成本。
- SQLite 加密保存问题和结果；事件埋点过滤正文/姓名/电话/地址等字段。

## 环境要求

- 微信开发者工具（可用测试号/游客 AppID 导入）
- Node.js 22.5+（使用内置 `node:sqlite`；当前会显示 experimental warning，不影响本地运行）

Codex 桌面环境可使用工作区依赖中提供的 Node.js 运行时；其他环境请确保 `node --version` 满足上述版本要求。

## 1. 启动本地服务端

```bash
cd prototype/wechat-mini-program/server
cp .env.example .env
node --env-file=.env src/app.js
```

默认监听 `http://127.0.0.1:3000`，SQLite 写入 `server/data/dev.sqlite`。健康检查：

```bash
curl http://127.0.0.1:3000/health
```

默认 `.env.example` 使用 `MODEL_MODE=mock`。结果页会标为“本地演示”，不得描述为真实阶跃回答。

### 启用真实阶跃（仅本地/封闭测试）

在未提交的 `.env` 中设置：

```text
MODEL_MODE=stepfun
STEPFUN_API_KEY=你的服务端Key
STEPFUN_MODEL=step-3.5-flash
STEPFUN_BASE_URL=https://api.stepfun.com/v1
```

重启服务端。Key 只在服务端环境变量中，不进入小程序包、SQLite 或日志。若 API 返回的 usage 缺失/矛盾、结构化输出无效或折算量超过 30,000 Token，任务标记失败且不核销免费次数。

成本流水不保存提示词或回答正文，只关联匿名用户 ID、分析任务 ID、模型、调用阶段、状态、Token、计价版本和估算金额。管理员可读取 `GET /v1/admin/costs/summary`，结果包含总计、按天和按匿名用户汇总；服务器也可运行以下只读汇总：

```bash
cd prototype/wechat-mini-program/server
DATABASE_URL=/path/to/database.sqlite npm run costs
```

## 2. 在微信开发者工具运行

1. 选择“导入项目”。
2. 项目目录选择 `<仓库根目录>/prototype/wechat-mini-program`。
3. 没有正式 AppID 时使用测试号；`project.config.json` 当前为 `touristappid`。
4. 确认“详情 → 本地设置 → 不校验合法域名”已启用。配置文件中的 `urlCheck` 已为 `false`。
5. 确认服务端仍运行，再编译小程序。
6. 先使用 `npm run invites -- generate <数量> <批次> <输出文件>` 生成本地邀请码，再从价格页完成一次领取。

API 地址集中在 `miniprogram/config/index.js`。真机不能使用 `127.0.0.1` 指向电脑；真机/体验版必须替换为已备案、已配置小程序 request 合法域名的 HTTPS 服务。

## 3. 测试

```bash
cd prototype/wechat-mini-program/server
node --test --test-concurrency=1 tests/*.test.js
```

测试覆盖：

- 两个独立 SQLite 连接并发争抢第 1,000/1,001 名：只有一人获得 3 次内测分析资格。
- 重复点击/同一稳定用户不重复占名额。
- 一次性邀请码只能绑定一个稳定用户。
- 三次分析并发预留后，第四次无法超发。
- `delivered` 才核销；安全拦截与模型失败不核销。
- Skill 路由最多加载 3 份知识文件；危机强制安全文档。
- 第三人电话、邮箱、账号和地址去标识化。

快速做 JavaScript/JSON 静态检查：

```bash
find miniprogram server/src server/tests -name '*.js' -print0 | xargs -0 -n1 node --check
find miniprogram -name '*.json' -print0 | xargs -0 -n1 node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))"
```

## 数据与安全说明

- 开发身份仅在 `ALLOW_DEV_AUTH=true` 且 `NODE_ENV=development` 时启用；任何其他环境启用会直接拒绝启动。
- `SESSION_SECRET`、`DATA_ENCRYPTION_KEY` 和阶跃 Key 必须在部署前替换；`.env` 和 SQLite 数据库被 `.gitignore` 排除。
- 日志不记录 session、Key、问题正文或第三人信息。
- 当前规则安全是基础防线，不等于生产级内容审核。公开服务还需接入平台/供应商审核、申诉、人工处置和安全事件流程。
- 账号注销会软删除用户并清除可识别案卷正文/结果；生产环境还需完善备份删除、数据导出与依法保留策略。

## 尚未完成、受外部条件阻断

- 没有正式微信 AppID/AppSecret、体验成员权限，无法上传体验版或验证同一微信账号跨设备登录。
- 没有已备案 HTTPS 域名/CloudBase 环境，无法真机连接本地 API。
- 没有 `STEPFUN_API_KEY`，只能验证明确标识的 mock 模式，不能声称已产生真实模型回答。
- 没有经营主体、微信深度合成类目/算法合作材料、小程序备案、监管适用性结论和审核条件，不能正式公开上线。
- 按要求未接入 `wx.requestVirtualPayment`、`wx.requestPayment` 或任何真实收款；真实收费、退款、账本和对账均不在本版本中。

正式收费前的主体、ICP/拟人化适用性、阶跃商业授权、微信类目、算法材料、隐私与支付要求见 [`documentation/wechat-mini-program-launch-and-payment.md`](../../documentation/wechat-mini-program-launch-and-payment.md)。

## 视觉审查记录

```text
Design review: PASS（代码与静态规则）；微信开发者工具真机视觉检查待外部工具/设备
Strongest part: 首页保持单一输入框与对话式回答，绿色品牌标识和账户入口克制统一。
Main risk: 尚未在正式 AppID 的真实 iPhone 与 Android 设备上完成全流程检查。
Changes made: 统一白灰背景、绿色品牌色、字号层级、输入区安全间距与个人中心信息密度。
Skipped verification: 正式微信登录、HTTPS API、真实模型和不同真机字体渲染。
```
