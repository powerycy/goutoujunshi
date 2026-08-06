import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("judge demo exposes the complete decision flow", async () => {
  const source = await readFile(new URL("app/GoutouDemo.tsx", root), "utf8");
  for (const phrase of ["先接住情绪", "事实", "合理推测", "关键未知", "互惠雷达", "边界与风险检查", "什么时候停", "清除全部"]) {
    assert.match(source, new RegExp(phrase));
  }
});

test("privacy design avoids persistence and remote submission", async () => {
  const source = await readFile(new URL("app/GoutouDemo.tsx", root), "utf8");
  assert.doesNotMatch(source, /localStorage|sessionStorage|fetch\(|XMLHttpRequest|WebSocket/);
  assert.match(source, /不上传服务器/);
});

test("high-risk route prioritizes safety", async () => {
  const source = await readFile(new URL("app/GoutouDemo.tsx", root), "utf8");
  for (const phrase of ["暂停关系博弈", "保留证据", "当地紧急服务", "控制不是边界", "同意边界"]) {
    assert.match(source, new RegExp(phrase));
  }
});

test("public guide documents evaluator access and limits", async () => {
  const guide = await readFile(new URL("app/guide/page.tsx", root), "utf8");
  assert.match(guide, /不要求登录/);
  assert.match(guide, /产品限制/);
  assert.match(guide, /不替代心理、医疗或法律专业服务/);
});
