# Averia V0.6.1 Patch Manifest

本补丁只包含代码、测试和文档，不包含 `data/`、`exports/` 或 `var/`，不会覆盖已经写入的真实资料。

## 主要变化

- `package.json`：版本升级到 `0.6.1`。
- `scripts/providers/dmm-rental/lib.mjs`：
  - 识别真实 `年齢認証 - FANZA` 页面；
  - 从页面中提取并校验 DMM 官方 `declared=yes` 链接；
  - 未显式确认年龄时停止，不替用户自动声明；
  - `--adult-confirmed` 时使用临时 curl Cookie Jar 跟随 DMM 官方重定向；
  - 声明后仍未回到原详情页则停止，不尝试其它绕过方式。
- `scripts/provider-dmm-rental.mjs`：
  - 新增 `--adult-confirmed`；
  - 成功经过年龄确认时保存 `age-gate.html`；
  - `meta.json` 只记录 `age_gate_detected / age_gate_declared` 布尔状态，不保存 Cookie。
- `scripts/lib/http-transport.mjs`：curl transport 支持调用方提供的临时 Cookie Jar。
- `tests/provider-dmm-rental.test.mjs`：新增年龄确认检测、官方链接校验、显式确认和 Node 模式边界测试。
- `tests/http-transport.test.mjs`：新增 curl Cookie Jar 回归测试。
- `tests/fixtures/dmm-rental/age-gate-4ipzz698.html`：基于第一次真实 DMM Probe 返回结构的最小年龄确认 Fixture。
- `docs/DMM_RENTAL_PROVIDER.md`：补充 V0.6.1 年龄确认会话说明。
- `AGENTS.md`：固定“年龄确认必须由用户显式声明”的项目规则。
- `README.md`：补充 `--adult-confirmed` 使用说明。
- `UPGRADE_V0.6.1.md`：本次升级说明。

## 安全边界

`--adult-confirmed` 只允许处理公开页面的普通年龄确认。验证码、登录、地区限制和付费访问控制仍不得绕过。
