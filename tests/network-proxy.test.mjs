import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProxyBootstrapEnv,
  nodeSupportsEnvProxy,
  parseWindowsProxyServer,
  resolveProxyConfig,
} from "../scripts/lib/network-proxy.mjs";

test("Windows 单地址系统代理可同时用于 HTTP/HTTPS", () => {
  assert.deepEqual(parseWindowsProxyServer("127.0.0.1:7790"), {
    httpProxy: "http://127.0.0.1:7790/",
    httpsProxy: "http://127.0.0.1:7790/",
  });
});

test("Windows 分协议代理可以分别解析", () => {
  assert.deepEqual(parseWindowsProxyServer("http=127.0.0.1:7890;https=127.0.0.1:7891"), {
    httpProxy: "http://127.0.0.1:7890/",
    httpsProxy: "http://127.0.0.1:7891/",
  });
});

test("代理优先级为命令行 > 环境变量 > Windows 系统代理 > 直连", () => {
  const systemProxyReader = () => ({ httpProxy: "http://127.0.0.1:7000/", httpsProxy: "http://127.0.0.1:7000/" });
  assert.equal(resolveProxyConfig({ explicitProxy: "127.0.0.1:7100", env: { HTTPS_PROXY: "http://127.0.0.1:7200" }, platform: "win32", systemProxyReader }).mode, "cli-proxy");
  assert.equal(resolveProxyConfig({ env: { HTTPS_PROXY: "http://127.0.0.1:7200" }, platform: "win32", systemProxyReader }).mode, "env-proxy");
  assert.equal(resolveProxyConfig({ env: {}, platform: "win32", systemProxyReader }).mode, "system-proxy");
  assert.equal(resolveProxyConfig({ env: {}, platform: "linux", systemProxyReader }).mode, "direct");
});

test("自动代理重启环境不会把代理端口写死", () => {
  const env = buildProxyBootstrapEnv({ mode: "system-proxy", httpProxy: "http://127.0.0.1:7790/", httpsProxy: "http://127.0.0.1:7790/" }, { PATH: "x" });
  assert.equal(env.HTTP_PROXY, "http://127.0.0.1:7790/");
  assert.equal(env.HTTPS_PROXY, "http://127.0.0.1:7790/");
  assert.equal(env.NODE_USE_ENV_PROXY, "1");
  assert.equal(env.AVERIA_PROXY_MODE, "system-proxy");
});

test("Node 环境代理支持版本判断覆盖 24.x 与 22.21+", () => {
  assert.equal(nodeSupportsEnvProxy("24.12.0"), true);
  assert.equal(nodeSupportsEnvProxy("22.21.0"), true);
  assert.equal(nodeSupportsEnvProxy("22.20.0"), false);
  assert.equal(nodeSupportsEnvProxy("20.19.0"), false);
});
