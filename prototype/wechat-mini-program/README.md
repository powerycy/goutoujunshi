# 狗头军师微信小程序｜免费封闭内测版

微信原生小程序 + Node.js API + SQLite 的本地/微信开发者工具版本。产品定位为“关系问题分析与行动决策软件”，不是聊天机器人或 AI 陪伴。视觉采用“暖色编辑部案卷桌”：纸张、案卷编号、证据标签、克制幽默。

这不是正式上线版本。当前没有真实支付，默认模型模式是明确标识的本地 mock；只有配置阶跃 Key 并切换模式后才会调用 `step-3.5-flash`。

## 已实现

- 首页、案卷输入、三步分析中、结构化结果、价格假门、权益回执、历史案卷、我的权益与注销。
- 稳定服务端身份：开发环境使用明确标识的 `dev` 会话；生产适配微信 `jscode2session`。
- 新人限定入口不调用任何支付 SDK：点击 ¥1/10 后明确显示实收 ¥0。
- 前 10,000 名去重服务端用户登记 `founding_beta_2026`，每人 2 次免费完整分析，并预留 `launch_credit_10_60d_v1`：正式版 10 个活动狗头，发放后 60 天有效。
- 第 10,001 名以后只记录价格点击，不登记内测权益。
- 免费资格事务原子占位；任务创建原子预留次数；只有 `delivered` 核销。失败、超时、安全拦截会释放预留。
- 根 `SKILL.md` 固定加载，知识库按场景只读取 1–3 份；危机场景强制安全文档。
- 输入去除电话、邮箱、账号、身份证和详细地址；输入/输出基础安全；危机问题切换现实安全流程。
- 阶跃 `step-3.5-flash` 网关、60 秒超时、429/5xx 重试、结构化 JSON、usage 折算和单次 3 狗头（30,000 成本折算 Token）硬上限。
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

## 2. 在微信开发者工具运行

1. 选择“导入项目”。
2. 项目目录选择 `<仓库根目录>/prototype/wechat-mini-program`。
3. 没有正式 AppID 时使用测试号；`project.config.json` 当前为 `touristappid`。
4. 确认“详情 → 本地设置 → 不校验合法域名”已启用。配置文件中的 `urlCheck` 已为 `false`。
5. 确认服务端仍运行，再编译小程序。
6. 从首页进入价格页，点击任一套餐；看到“未扣款”回执后递交案卷。

API 地址集中在 `miniprogram/config/index.js`。真机不能使用 `127.0.0.1` 指向电脑；真机/体验版必须替换为已备案、已配置小程序 request 合法域名的 HTTPS 服务。

## 3. 测试

```bash
cd prototype/wechat-mini-program/server
node --test --test-concurrency=1 tests/*.test.js
```

测试覆盖：

- 两个独立 SQLite 连接并发争抢第 10,000/10,001 名：只有一人获得 2 次免费分析和 `launch_credit_10_60d_v1`。
- 重复点击/同一稳定用户不重复占名额。
- 两次免费分析并发预留后，第三次无法超发。
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
Strongest part: 首页案卷纸、证据便签和爪印章形成单一记忆点，结果页用不同纸张层级承载事实/推测/未知。
Main risk: 尚未在真实 iPhone 小屏与 Android 字体渲染中人工检查。
Changes made: 统一暖纸色 Token、宋体标题/中文无衬线正文、12/20/32rpx 圆角层级、案卷展开动效与长文宽度。
Skipped verification: 微信开发者工具截图、真机触控和系统“减少动态效果”能力检测。
```
