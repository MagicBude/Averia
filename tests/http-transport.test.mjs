import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { fetchTextViaCurl, fetchTextWithFallback, networkErrorCode, shouldFallbackToCurl } from "../scripts/lib/http-transport.mjs";

function okResult(transport, text = "ok") {
  return { text, finalUrl: "https://moodyz.com/works/detail/MDVR434", status: 200, contentType: "text/html; charset=UTF-8", transport };
}

test("网络错误可以从嵌套 cause 中提取 ECONNRESET", () => {
  const error = new TypeError("fetch failed", { cause: Object.assign(new Error("reset"), { code: "ECONNRESET" }) });
  assert.equal(networkErrorCode(error), "ECONNRESET");
  assert.equal(shouldFallbackToCurl(error), true);
});

test("auto 模式下 Node fetch 成功时不调用 curl", async () => {
  let curlCalled = 0;
  const result = await fetchTextWithFallback("https://moodyz.com/works/detail/MDVR434", {
    nodeImpl: async () => okResult("node-fetch"),
    curlImpl: async () => { curlCalled += 1; return okResult("curl"); },
  });
  assert.equal(result.transport, "node-fetch");
  assert.equal(curlCalled, 0);
});

test("auto 模式遇到 ECONNRESET 会自动回退 curl", async () => {
  const reset = Object.assign(new Error("reset"), { code: "ECONNRESET" });
  const result = await fetchTextWithFallback("https://moodyz.com/works/detail/MDVR434", {
    nodeImpl: async () => { throw new TypeError("fetch failed", { cause: reset }); },
    curlImpl: async () => okResult("curl", "MOODYZ"),
  });
  assert.equal(result.transport, "curl");
  assert.equal(result.text, "MOODYZ");
  assert.equal(result.fallbackFrom, "node-fetch:ECONNRESET");
});

test("Windows + 代理兼容模式可以优先 curl，避免等待 Node TLS 失败", async () => {
  let nodeCalled = 0;
  const result = await fetchTextWithFallback("https://moodyz.com/works/detail/MDVR434", {
    preferCurl: true,
    nodeImpl: async () => { nodeCalled += 1; return okResult("node-fetch"); },
    curlImpl: async () => okResult("curl"),
  });
  assert.equal(result.transport, "curl");
  assert.equal(nodeCalled, 0);
});

test("显式 node 模式不会自动调用 curl", async () => {
  let curlCalled = 0;
  await assert.rejects(
    fetchTextWithFallback("https://moodyz.com/works/detail/MDVR434", {
      transport: "node",
      nodeImpl: async () => { throw Object.assign(new Error("reset"), { code: "ECONNRESET" }); },
      curlImpl: async () => { curlCalled += 1; return okResult("curl"); },
    }),
    /reset/,
  );
  assert.equal(curlCalled, 0);
});


test("curl transport 会显式传入动态代理并读取响应正文", () => {
  let capturedArgs = [];
  const result = fetchTextViaCurl("https://moodyz.com/works/detail/MDVR434", {
    proxyUrl: "http://127.0.0.1:7790/",
    platform: "win32",
    spawn: (command, args) => {
      assert.equal(command, "curl.exe");
      capturedArgs = args;
      const outputIndex = args.indexOf("--output");
      fs.writeFileSync(args[outputIndex + 1], "<html>MOODYZ</html>", "utf8");
      return { status: 0, stdout: "200\nhttps://moodyz.com/works/detail/MDVR434\ntext/html; charset=UTF-8\n", stderr: "" };
    },
  });
  assert.equal(result.status, 200);
  assert.equal(result.transport, "curl");
  assert.equal(result.text, "<html>MOODYZ</html>");
  assert.deepEqual(capturedArgs.slice(capturedArgs.indexOf("--proxy"), capturedArgs.indexOf("--proxy") + 2), ["--proxy", "http://127.0.0.1:7790/"]);
});
