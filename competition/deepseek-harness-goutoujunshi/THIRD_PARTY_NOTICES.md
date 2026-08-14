# 第三方软件与素材声明

本项目是 `goutoujunshi` 仓库中隔离的比赛实现。完整依赖版本见 `pnpm-lock.yaml`。

## DeepSeek Harness

- 项目：DeepSeek Harness
- 来源：<https://github.com/deepseek-ai/deepseek-harness>
- 使用版本：`@deepseek-ai/dsh@0.1.0-rc.6` 及同系列插件包
- 许可证：MIT
- 用途：Agent host、工具与插件系统、profile/bundle、Web runtime、布局、侧栏和会话底座

官方 DeepSeek Logo 由 Harness 自身提供的 `/favicon.svg` 在运行时展示；本项目不复制或修改该标识。

## Lucide

- 项目：Lucide / `lucide-react`
- 来源：<https://lucide.dev/>
- 许可证：ISC
- 用途：工作区界面图标

## React、esbuild 与 Cordis 生态依赖

React 用于 client plugin 渲染，esbuild 用于生成 Harness 可加载的浏览器模块；Cordis 与其他 DeepSeek 作用域包由 Harness 引入。各自许可证与版权信息以对应 npm 包及上游仓库声明为准。

## 狗头军师绿色狗头图

`packages/goutoujunshi-plugin/assets/goutoujunshi-dog-logo.png` 是为本比赛项目使用 OpenAI 内置图像生成工具新生成的原创品牌素材，不包含官方 DeepSeek Logo、真实人物或第三方聊天数据。
