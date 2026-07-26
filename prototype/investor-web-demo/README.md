# 狗头军师｜投资人真实 Demo 网站

手机优先的真实产品体验页。界面复用微信小程序首页视觉，所有问答通过服务端代理调用狗头军师 API，不包含 mock 回退。

## 体验链路

1. 投资人输入演示访问码。
2. 网站服务端将访问码转发到 `/v1/auth/web-demo`，换取 4 小时限时会话。
3. 浏览器仅在 `sessionStorage` 保存会话 Token，不保存访问码。
4. 提交问题时生成唯一 `Idempotency-Key`，轮询任务直到交付、失败或安全拦截。
5. 结果页明确展示模型模式、AI 生成提示和成本折算 Token。

## 本地运行

Node.js 需要 `>=22.13.0`。

```bash
cp .env.example .env.local
pnpm install
pnpm dev
pnpm test
```

`BACKEND_API_URL` 必须指向稳定的狗头军师 API 根地址。它仅由 Sites 服务端代理读取，不打包进客户端。没有域名时，生产环境同时配置 `BACKEND_PROXY_KEY`，Sites 与腾讯云固定 IP 之间使用 AES-256-GCM 加密信封传输；明文 HTTP 后端在缺少该密钥时会被拒绝。

## 安全边界

- 代理只允许 Web Demo 登录、额度查询和分析相关接口，不开放管理员成本接口。
- 访问码明文不进入仓库；后端只配置 SHA-256 摘要。
- 分析仍受服务端共享额度、每日尝试上限、幂等、单次 Token 硬上限和内容安全规则约束。
- 问题与结果由现有 API 加密保存；网页提示用户使用 A/B 代称并避免提交身份信息。
- 前端没有 StepFun Key、微信 AppSecret、Session Secret 或永久管理员凭证。
