# Averia V0.6.2 Patch Manifest

本补丁只修复 DMM/FANZA 年龄确认重定向兼容问题，不包含 `data/`、`exports/` 或 `var/`。

## 修改文件

- `package.json` — 版本更新到 `0.6.2`
- `scripts/lib/http-transport.mjs` — 新增可关闭重定向的安全传输选项
- `scripts/providers/dmm-rental/lib.mjs` — 年龄声明改为“只收 Cookie，再主动 HTTPS 请求详情页”
- `scripts/provider-dmm-rental.mjs` — CLI 版本信息更新
- `tests/http-transport.test.mjs` — 增加 no-follow HTTPS 安全回归
- `tests/provider-dmm-rental.test.mjs` — 模拟真实 DMM 302 年龄声明流程
- `docs/DMM_RENTAL_PROVIDER.md` — 更新真实年龄确认行为说明
- `README.md` — 更新 V0.6.2 年龄确认策略
- `AGENTS.md` — 固化禁止跟随明文年龄确认重定向的工程规则
- `UPGRADE_V0.6.2.md` — 升级与验证说明

## 不包含

- `data/`
- `exports/`
- `var/`
- Provider 抓取产物
- Cookie / 登录信息 / 代理凭据
