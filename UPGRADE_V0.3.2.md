# Averia V0.3.2 升级说明

## 本次修复/改进

- JAVDatabase Provider 自动发现 Windows 系统代理，不再写死本机端口。
- 支持 `--proxy`、`HTTP_PROXY` / `HTTPS_PROXY`、Windows 系统代理、直连四级网络策略。
- 使用代理时会在必要时自动重启一次 Node 子进程，让 Node 内置 `fetch()` 从进程启动阶段启用环境代理。
- `meta.json` 仅记录 `network_mode` 与 `proxy_used`，不会保存代理 URL、端口账号或密码。
- JAVDatabase 明确标记为 `language=en`、`role=supplemental`。
- 新增 `docs/SOURCE_STRATEGY.md`，将 FANZA / DMM Web API 定为下一阶段的日文结构化主源。

## 使用

升级后一般无需再手工 export：

```bash
pnpm provider:javdatabase -- --code SDAM-179
```

Windows 已开启系统代理时，Provider 会自动读取当前代理。因此代理软件端口改变后，下次运行会重新读取，不需要修改代码。

仍可显式覆盖：

```bash
pnpm provider:javdatabase -- --code SDAM-179 --proxy http://127.0.0.1:7790
```

## Node 版本

自动环境代理依赖 Node 内置代理能力。推荐 Node 24；Node 22 至少需要 22.21。
