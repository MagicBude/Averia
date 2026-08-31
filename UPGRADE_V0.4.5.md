# Averia V0.4.5 升级说明

## 背景

真实 MOODYZ Probe 曾在已经验证可访问的代理链路上偶发返回 `HTTP 502`。这类错误发生在 Parser 之前，通常属于代理、CDN 或上游网关的瞬时失败，不应与 DOM 解析错误混为一谈。

## 本次修改

- 网络层新增可重试 HTTP 状态：`408 / 429 / 500 / 502 / 503 / 504`。
- 默认最多进行 3 次网络尝试。
- 采用指数退避：默认约 `750ms → 1500ms`。
- `404` 等永久错误不重试。
- MOODYZ Provider 在终端输出实际网络尝试次数。
- `meta.json` 新增 `network_attempts`。
- 不改变代理发现优先级，不写死任何代理端口。
- 不改变 Parser、Prepare、Apply 和正式 CSV。

## 验证

新增测试覆盖：

- 第一次 502、第二次 200 可自动恢复；
- 持续 502 最多尝试 3 次；
- 404 只请求一次；
- MOODYZ Provider 能继承网络层重试结果。

升级后执行：

```bash
pnpm check
pnpm provider:moodyz -- --code MDVR-434
```
