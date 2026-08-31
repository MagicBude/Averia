# Averia V0.4.1 升级说明

## 背景

在 Windows + 本地 HTTP 代理环境下，MOODYZ 对系统 `curl` 返回 HTTP 200，但 Node 24 / Undici `fetch()` 在 TLS 建连前可能出现 `ECONNRESET`。这属于网络 Transport 兼容问题，不是 Parser、代理端口或正式数据问题。

## 本版修复

- 新增 `scripts/lib/http-transport.mjs`。
- MOODYZ Provider 支持 `auto / node / curl` 三种网络传输。
- Windows + 已启用代理时，`auto` 优先系统 `curl`，避免每次等待 Node TLS 失败。
- 其它环境默认 Node `fetch()`；遇到 `ECONNRESET`、连接超时、Undici socket 或 TLS 类错误时自动回退 `curl`。
- `curl` 显式使用当前动态解析出的代理地址，不写死任何端口。
- `meta.json` 新增 `network_transport`，必要时记录 `transport_fallback_from`。
- MOODYZ Provider 版本提升到 2。

## 使用

默认：

```bash
pnpm provider:moodyz -- --code MDVR-434
```

诊断时可强制：

```bash
pnpm provider:moodyz -- --code MDVR-434 --transport curl
pnpm provider:moodyz -- --code MDVR-434 --transport node
```

## 安全边界

本改动只改变公开 HTTPS 页面请求所使用的客户端，不绕过登录、验证码、付费墙或访问控制。Provider 仍然只生成 `raw.html / canonical.json / meta.json`，不直接修改正式 CSV。

## 回归

V0.4.1 新增 HTTP Transport 回归测试；正式数据集校验与所有既有 Provider/Pipeline 测试必须全部通过。
