# Averia V0.6.3 Patch Manifest

本补丁只包含 DMM Rental Parser 作用域修复、真实噪声回归测试与对应文档，不包含 `data/`、`exports/`、`var/`。

## 文件

- `package.json`
- `scripts/providers/dmm-rental/lib.mjs`
- `tests/provider-dmm-rental.test.mjs`
- `tests/fixtures/dmm-rental/work-4ipzz698.html`
- `README.md`
- `AGENTS.md`
- `docs/DMM_RENTAL_PROVIDER.md`
- `UPGRADE_V0.6.3.md`
- `PATCH_MANIFEST.md`

## 核心变化

- Provider version：4
- 项目版本：0.6.3
- DMM 字段仅从有序作品详情字段簇解析
- 防止侧栏/导航/推荐项污染系列与 Genres
- 过滤 `一覧へ` 等导航实体
- 详情区品番必须与请求 CID 一致
- 新增真实页面噪声回归测试
