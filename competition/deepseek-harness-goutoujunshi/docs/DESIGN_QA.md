# 浏览器与设计 QA

检查日期：2026-08-14。浏览器：Codex 内置浏览器。测试数据：公开合成案例。

## 覆盖状态

| 视口 / 状态 | 结果 | 证据 |
| --- | --- | --- |
| 1440 × 900，空工作区 | 通过 | `artifacts/screenshots/01-empty-desktop.png` |
| 1440 × 900，结构化军师对话 | 通过 | `artifacts/screenshots/02-chat-desktop.png` |
| 1440 × 900，关系进展与证据台账 | 通过 | `artifacts/screenshots/03-progress-desktop.png` |
| 1440 × 900，绿色证据悬停说明 | 通过 | `artifacts/screenshots/04-progress-tooltip-desktop.png` |
| 1440 × 900，身份冲突停止 | 通过 | `artifacts/screenshots/05-identity-conflict.png` |
| 390 × 844，军师对话 | 通过 | `artifacts/screenshots/06-mobile-chat.png` |
| 390 × 844，关系进展 | 通过 | `artifacts/screenshots/07-mobile-progress.png` |

## 设计检查

- 保留官方 DeepSeek favicon/Logo 与信息结构，并并列放置狗头军师文字和绿色狗头品牌图。
- 主题只替换为芭比粉、深莓色和证据绿色，不改变 Harness 的工作区心智模型。
- 桌面左侧抽屉能直接识别对象、证据量和当前选择；移动端自动收成图标轨道。
- 对话仍是核心视图，关系证据图为对象级次要入口。
- 红/绿/灰不仅依靠颜色：图例、时间线摘要、方向标签与悬停文本提供冗余解释。
- 核心按钮、选项卡、对象切换、改名、输入、确认、记忆控制与证据冲突路径可操作；焦点状态和语义角色可被浏览器可访问性树识别。
- 移动端首次检查发现视图切换器覆盖内容，已改为标题栏的独立第二行并复测。
- 关系图在窄屏允许横向滚动以保留全部日期和蜡烛，而不是压缩到不可读尺寸。
- `prefers-reduced-motion` 下禁用非必要平滑动画与过渡。

## 已知非阻塞限制

- 公开 Demo 的截图/文件、ChatLab 与电脑只读入口用于展示授权与身份确认流程；它们不会读取用户的真实文件或聊天平台。
- 未配置模型提供方时使用确定性的公开案例分析；配置后才由 Harness Agent loop 调用 host tools。
