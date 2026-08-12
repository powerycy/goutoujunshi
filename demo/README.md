# 狗头军师 · 关系决策实验室（GOAI 2026）

这是狗头军师在 GOAI 2026「无界应用」赛道的可运行演示。它把 Relationship Candlestick Lab 的关系趋势证据层，与狗头军师的关系决策层组合成一个可验证 Agent 闭环。

## 评委 90 秒体验

```bash
python start.py
```

打开 `http://127.0.0.1:7000`，点击「载入合成示例」：

1. 查看 38 条公开合成消息形成的日线趋势和关键转折。
2. 核对事实、推断、未知与四类关系信号。
3. 选择推进、确认、修复或退出目标。
4. 生成包含理由、观察窗口和停止条件的可逆方案。
5. 由用户人工确认；系统不会替用户发送消息。

该路径不需要 API Key、不上传文件、不调用外部模型，适合离线复现。真实聊天可使用本地 Skills 模式；API 模式仍保留给自主选择在线模型的用户。

## Agent 闭环

```text
合成/本地聊天证据
  → 消息级相对变化评分
  → 多周期 OHLC 趋势与关键事件归因
  → 事实 / 推断 / 未知分层
  → 用户选择目标与风险偏好
  → 方案、话术、观察窗口、停止条件
  → 人工确认
  → 下一轮反馈与复盘
```

## 验证

```bash
python -m pytest -q
```

测试覆盖解析、消息级评分聚合、K 线、指标，以及 GOAI 合成 Demo 的无密钥启动、四目标方案、追溯链和人工确认门禁。

## 数据与安全

详见 [DATA_AND_SAFETY.md](DATA_AND_SAFETY.md)。演示数据均为公开合成测试数据；产品不声称读取对方内心，不把趋势当作关系结果预测，不进行医疗或心理诊断，不自动发送或执行线下行动。

## 许可与来源

比赛分支整体遵循仓库根目录的 PolyForm Noncommercial 1.0.0 非商用许可。Relationship Candlestick Lab 原始代码为 MIT License；原许可副本保存在 `THIRD_PARTY_LICENSE.relationship-candlestick-lab`，详细贡献边界见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
