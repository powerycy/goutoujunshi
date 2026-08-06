# 报名事实表

最后复核日期：2026-08-06（Asia/Shanghai）

## 基本事实

| 字段 | 已核验事实 | 证据 |
| --- | --- | --- |
| 项目名称 | 狗头军师 | 仓库 `README.md`、`SKILL.md` |
| 报名主标题 | 狗头军师——内置13万字符关系知识与决策体系，解决亲密关系难题 | 本目录全部材料 |
| 公开仓库 | https://github.com/powerycy/goutoujunshi | Git remote `origin` |
| 公网体验 | https://goutoujunshi-hackathon-2026.magicyi.chatgpt.site/ | 已匿名核验首页完整加载 |
| 在线手册 | https://goutoujunshi-hackathon-2026.magicyi.chatgpt.site/guide | 已匿名核验五节手册完整加载 |
| 官方提交 | 已提交；唯一参赛凭证 ID `6a742ad40021911c7b60`；2026-08-06 14:34（Asia/Shanghai） | 官方“我的提交”页面 |
| 报名通道 | 自助报名赛道 | 官方入口将该通道定义为“使用本地编程工具自部署的参赛作品” |
| 产品形态 | 无需登录的公网 Web/H5 评委版；原 Skill 保持不变 | `web/` 与根目录 `SKILL.md` |
| 核心实现 | TypeScript、React、Next.js/vinext、CSS；浏览器端可解释场景路由与决策规则 | `web/app/GoutouDemo.tsx` |
| 数据持久化 | 评委版不使用数据库、localStorage 或 sessionStorage；刷新/清除即消失 | 产品源码与自动测试 |
| 匿名数据 | 3 个内置匿名演示文本；没有真实聊天 | `web/app/GoutouDemo.tsx` |
| 关系判断框架 | 情绪落地 → 事实/推测/未知 → 互惠与风险 → 可执行下一步与停止条件 | `SKILL.md` 与 Web 体验 |
| 安全边界 | 反 PUA、持续同意、安全和隐私优先；高风险场景切换到安全处置 | `SKILL.md`、知识文件 05/08/09 与 Web 测试 |
| AI 辅助方式 | 使用 Codex 辅助代码实现、重构、测试、部署和材料整理；封面使用 OpenAI 图像生成。知识与产品判断来自公开仓库内容，报名不隐瞒 AI 参与。 | Git diff、封面资产、本事实表 |

## “13万字符”统计口径

标题使用的是**核心 Markdown 的 Unicode 字符总量**，不是“13万纯汉字”，也不是“13万字专业知识库”。

统计范围：

- `references/**/*.md`：43 个 Markdown 文件。
- 核心 Markdown：`SKILL.md` + `references/**/*.md` + `documentation/**/*.md`。
- 文件类型：只统计 `.md`。

口径说明：

- 字符总量：UTF-8 Markdown 解码后的 Unicode 字符数，等价于 UTF-8 locale 下 `wc -m`；包含中文、英文、数字、标点、空白、Markdown 标记、frontmatter、代码块与重复内容，不去重。
- 严格汉字量：只统计 `U+4E00–U+9FFF`；英文、数字、标点、空白和 Markdown 标记不计；不去重。汉字若出现在 frontmatter 或代码块中仍会计入，所以这里只作为补充口径。

主线程独立基准统计（材料准备阶段的独立工作树）：

| 范围 | Unicode 字符总量 | 严格汉字量 |
| --- | ---: | ---: |
| `references/` 43 个 Markdown | 122,505 | 75,540 |
| 核心 Markdown | 135,195 | 83,674 |

当前功能分支可复现统计（Web 评委版开发完成时）：

```text
$ python3 scripts/count_knowledge_chars.py
口径：UTF-8 Markdown 解码后的 Unicode 字符（等价于 UTF-8 locale 下 wc -m）
字符总量包含：中文、英文、数字、标点、空白、Markdown 标记、frontmatter、代码块与重复内容
严格汉字量仅统计 U+4E00–U+9FFF；英文、数字、标点、空白和 Markdown 标记不计；不去重
references: files=43 unicode_chars=122395 han_chars=75487
core: files=51 unicode_chars=135682 han_chars=84087
```

对应的 `wc -m` 复核命令：

```bash
LC_ALL=en_US.UTF-8 find references -type f -name '*.md' -print0 \
  | sort -z | xargs -0 wc -m | tail -1

LC_ALL=en_US.UTF-8 find references documentation -type f -name '*.md' -print0 \
  | sort -z | xargs -0 wc -m SKILL.md | tail -1
```

两个工作树的文件修订导致精确数字略有差异，但两套独立统计都超过 130,000 个核心 Markdown 字符。因此公开标题只使用向下取整的“13万字符”，不使用“13万字”。最终提交以合并后仓库运行脚本的结果为准。

## 比赛规则核验

2026-08-06 在官方页面核验到：

- 线上作品提交期为 2026-07-20 至 2026-08-09。
- 专业评审看创意、实用、完成度、技术难度。
- 有效作品必须提供评委可直接访问和体验的公网链接及完整使用手册。
- 不接受仅代码仓库、本地文件、安装包、私有内测地址或要求评委自行部署的作品。
- 自助报名通道面向使用本地编程工具自部署的作品。
- 需要实名认证，并在成功提交后取得唯一参赛凭证 ID。

官方入口：<https://hackathon2026.app.weavefox.cn/>

## 明确没有的事实

- 没有对外声称真实用户数、留存、转化率、收入、获奖、用户评价或临床效果。
- 没有声称 Web 版由扣子、秒哒、WeaveFox 等合作平台搭建。
- 没有声称系统能读取微信、诊断心理疾病、读心或保证挽回成功。
- 没有保存真实聊天，也没有使用真实聊天制作截图。
