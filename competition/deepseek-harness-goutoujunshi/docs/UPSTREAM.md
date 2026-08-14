# 官方 DeepSeek Harness 上游锁定

检查日期：2026-08-14（Asia/Shanghai）。

| 项目 | 锁定值 |
| --- | --- |
| 官方仓库 | <https://github.com/deepseek-ai/deepseek-harness> |
| 检查的源码提交 | `47f943859bef60e4160492346772ded9b24f765a` |
| npm 主包 | `@deepseek-ai/dsh@0.1.0-rc.6` |
| 许可证 | MIT |
| 上游默认分支 | `master` |

项目在 `package.json` 与 `pnpm-lock.yaml` 中精确锁定 rc.6，不从移动分支或未固定 Git URL 安装运行依赖。源码提交用于记录本次架构、AGENTS.md、插件约定、Web UI 结构和许可检查的基线；npm rc.6 是实际执行版本。

## 采用的官方扩展点

- profile 的 `dsh.profile.bundles` 组合；
- bundle 的 `dsh.bundle.patch`；
- Cordis 配置插入自定义插件；
- host 侧 `systemPrompt.section` 与 `tools.register`；
- client 包的 `dsh.client`、`./client`、`./package.json` 导出；
- 官方 `ui-layout` 的 `sidebar` 与 `conversation` slots；
- 官方 Web runtime、module loader、plugin host 与设置入口。

DeepSeek Harness 当前仍属于 release candidate / development preview。上游若调整 profile、bundle 或 client slot 契约，应先更新本文件中的源码提交与 npm 版本，再运行全套测试和浏览器 QA。
