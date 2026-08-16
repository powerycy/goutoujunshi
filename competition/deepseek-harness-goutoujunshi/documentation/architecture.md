# Architecture

## Product overview

狗头军师是运行在官方 DeepSeek Harness 中的关系决策 Agent。Harness 提供 Agent、会话、插件、工具调用、模型提供方和 Web 工作区；仓库根目录既有狗头军师 Skill 是只读能力内核，新参赛目录仅通过适配层调用。

关键假设：用户保留最终行动权；关系建议必须能被观察与停止；证据图只解释历史记录；公开 Demo 不依赖真实聊天或 API Key。

## Stack and components

| Component | Responsibility | Trust boundary |
| --- | --- | --- |
| DeepSeek Harness `0.1.0-rc.6` | Agent host、profile、会话、模型、插件与 Web runtime | 上游运行时 |
| `goutoujunshi-bundle` | 把参赛插件组合进 Harness profile | 配置边界 |
| `goutoujunshi-plugin` host | 系统提示、参考路由、身份/证据、记忆工具 | Agent → tool |
| `goutoujunshi-plugin` client | 对象抽屉、普通对话、证据 K 线、模型连接入口 | Browser → local state |
| Read-only Skill | 领域路由、素材与既有记忆脚本 | Adapter → protected files |
| Browser local storage | 当前设备的对象精简状态 | Local device only |

## Session and model flow

用户启动项目私有 Harness profile；Harness Web runtime 创建会话并加载客户端插件。公开案例直接使用合成数据。配置模型时，API Key 进入 Harness 官方模型提供方设置，不由参赛插件读取或写入仓库。Agent 调用 host tools 时，只返回当前对象与当前问题所需的有限上下文。

## Known risks / assumptions

- Harness 为 release candidate；锁定版本与兼容范围记录在 `docs/UPSTREAM.md`。
- 浏览器本地状态不是加密保险箱；真实证据应保持最少化并由用户控制删除。
- 关系 K 线是可视编码，不是经过临床或统计验证的预测模型。
- 截图/文件/ChatLab/电脑只读入口在第一版仅定义授权与交互边界，未实现数据库解密或后台采集。

无定时任务，因此无 `cron.md`。无自动邮件，因此无 `emails.md`。无公开索引路由，因此无 `seo.md`。

## Related documents

- [`flows.md`](flows.md)
- [`permissions.md`](permissions.md)
- [`variables.md`](variables.md)
- [`tests.md`](tests.md)
- [`automation.md`](automation.md)
- [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md)
- [`../docs/DATA_AND_SAFETY.md`](../docs/DATA_AND_SAFETY.md)
