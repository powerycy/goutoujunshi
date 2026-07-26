import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("服务端渲染投资人真实 Demo 首屏", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>狗头军师｜关系问题分析<\/title>/i);
  assert.match(html, /狗头军师，解决你的情感问题/);
  assert.match(html, /你们是什么关系、发生了什么、你现在想判断什么/);
  assert.match(html, /打开我的/);
  assert.doesNotMatch(html, /投资人访问码|真实阶跃模型|AI 生成|至少 30 字|我已满 18 岁/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("代理只允许投资人 Demo 所需接口", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/api/backend/v1/admin/costs/summary"),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(response.status, 404);
});

test("前端不包含服务端密钥或固定管理员凭证", async () => {
  const source = await readFile(new URL("../app/DemoApp.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /STEPFUN_API_KEY|WECHAT_APP_SECRET|SESSION_SECRET/);
  assert.doesNotMatch(source, /Bearer\s+[A-Za-z0-9._-]{20,}/);
  assert.match(source, /event\.key !== "Enter"/);
  assert.match(source, /event\.preventDefault\(\)/);
  assert.doesNotMatch(source, /accessCode|至少 30 字|请用 A\/B|我已满 18 岁/);
});
