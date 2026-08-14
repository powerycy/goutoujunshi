# 浏览器与设计 QA

检查日期：2026-08-14。浏览器：Codex 内置浏览器。测试数据：公开合成案例。

## 覆盖状态

| 视口 / 状态 | 结果 | 证据 |
| --- | --- | --- |
| 1280 × 720，临时无记忆入口 | 通过 | `artifacts/screenshots/08-temporary-light-desktop.png` |
| 1280 × 720，普通 Agent 对话 | 通过 | `artifacts/screenshots/09-normal-agent-chat-desktop.png` |
| 1280 × 720，K 线绿色悬停 | 通过 | `artifacts/screenshots/10-kline-desktop.png` |
| 1280 × 720，官方模型 / API Key | 通过 | `artifacts/screenshots/11-model-settings.png` |
| 1280 × 720，归档确认 | 通过 | `artifacts/screenshots/12-archive-dialog.png` |
| 390 × 844，普通 Agent 对话 | 通过 | `artifacts/screenshots/13-mobile-chat.png` |
| 390 × 844，关系 K 线 | 通过 | `artifacts/screenshots/14-mobile-kline.png` |

## 设计检查

- 保留官方 DeepSeek favicon/Logo、侧栏、会话和设置；狗头军师注册在官方 workspace 插槽内，并使用旧版绿色狗头 Logo。
- 品牌色恢复为旧版 `#ff168f` 死亡芭比粉、`#ff3ca6` 热粉、`#3a061f` 深莓色；不改变 Harness 的信息结构。
- 桌面左侧抽屉能直接识别对象、证据量和当前选择；移动端自动收成图标轨道。
- 对话恢复为普通 Agent 气泡和自然追问，不再用结构化分析卡堆叠；关系 K 线仍是对象级次要入口。
- 红/绿/灰不仅依靠颜色：图例、时间线摘要、方向标签与悬停文本提供冗余解释。
- 核心按钮、选项卡、对象切换、改名、归档/恢复、输入、确认与证据冲突路径可操作；焦点状态和语义角色可被浏览器可访问性树识别。
- 移动端提示条已下移到视图切换器下方；标题与 K 线可滚动区域复测通过。
- 关系图在窄屏允许横向滚动以保留全部日期和蜡烛，而不是压缩到不可读尺寸。
- `prefers-reduced-motion` 下禁用非必要平滑动画与过渡。

## 参考对照

旧 K 线参考与新 Harness 集成界面在同一张 1280 × 720 对照图中检查：`artifacts/qa/old-vs-new-kline.png`。新实现保留暗色工作台、实体 K 线、红涨绿退、证据量柱和右侧说明面板；差异仅来自必须保留的官方 Harness 侧栏/标题栏，以及公开案例只有 5 个证据事件。

迭代中修复的高优先级问题：

1. 首版是粉色趋势图和复杂卡片，不符合旧 K 线与正常 Agent 对话；已替换为实体 K 线和普通聊天。
2. 首次重构曾覆盖官方侧栏，导致模型连接入口消失；已改为注册 `sidebar.workspaces`，复测“设置 → 模型”通过。
3. 移动端提示条覆盖视图切换器；已调整到标题栏下方。

## 已知非阻塞限制

- 公开 Demo 的截图/文件、ChatLab 与电脑只读入口用于展示授权与身份确认流程；它们不会读取用户的真实文件或聊天平台。
- 未配置模型提供方时使用确定性的公开案例分析；配置后才由 Harness Agent loop 调用 host tools。
