# Averia V0.6.2 升级说明

V0.6.2 是针对 DMM/FANZA 年龄确认真实重定向行为的安全兼容修复。

## 问题

V0.6.1 在用户显式传入 `--adult-confirmed` 后，会访问 DMM 页面提供的 `declared=yes` URL，并让 curl 跟随重定向。真实环境中该端点可能返回 `Location: http://www.dmm.co.jp/...`。Averia 的 curl 网络层只允许 HTTPS 重定向，因此会安全拒绝并报：

```text
curl: (1) Protocol "http" disabled (in redirect)
```

这不是代理、Parser 或年龄确认链接解析失败，而是安全策略正确阻止了明文 HTTP 跳转。

## 修复策略

V0.6.2 不会简单放开 HTTP。新流程是：

1. 首次请求目标 HTTPS Rental 详情页；
2. 检测到年龄确认页；
3. 用户显式提供 `--adult-confirmed` 后，请求 DMM 官方 `declared=yes` URL；
4. **该请求关闭重定向**，只接收 `Set-Cookie`；
5. 使用同一个临时 Cookie Jar，主动再次请求原始 HTTPS Rental 详情页；
6. 只有最终仍是目标详情页且不再是年龄确认页时才进入 Parser。

整个流程始终保持目标页面为 HTTPS，不接受或跟随明文 HTTP。

## 网络层变化

`fetchTextViaCurl()` / Node transport 新增 `followRedirects: false` 支持。关闭时：

- curl 不传 `--location`；
- 不传 `--max-redirs` / `--proto-redir`；
- 初始请求本身仍由 `--proto =https` 约束；
- Node fetch 使用 `redirect: manual`。

## 数据安全

- Cookie 仍只存在系统临时目录；
- Cookie 内容不写入 `meta.json`、CSV、日志或 Git；
- 不绕过验证码、登录、地区限制和付费访问控制；
- Provider 仍不直接修改正式 CSV。

## 验证

V0.6.2 在重建的 V0.6.1 代码基线上完成：

```text
13 个数据集校验通过
数据质量 0 error / 0 warning
64 / 64 自动测试通过
```

新增回归覆盖：

- curl 可关闭重定向，同时继续强制初始 HTTPS；
- DMM `declared=yes` 返回 302 时不跟随潜在 HTTP Location；
- 声明 Cookie 与最终 HTTPS 详情页请求使用同一个临时 Cookie Jar。

## 推荐验证命令

```bash
pnpm check

pnpm provider:dmm-rental -- \
  --cid 4ipzz698 \
  --code IPZZ-698 \
  --adult-confirmed
```
