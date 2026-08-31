# Averia V0.4.4 增量包清单

本补丁修复第一次真实 MOODYZ canonical 审核发现的图片字段污染问题：页面 `og:image` 可能是站点 Logo，而不是作品封面或女优头像。

## 修改文件

- `package.json`
- `scripts/providers/moodyz/lib.mjs`
- `tests/provider-moodyz.test.mjs`
- `tests/fixtures/moodyz/work-mdvr434.html`
- `tests/fixtures/moodyz/actress-855540.html`
- `README.md`
- `AGENTS.md`
- `DATA_STANDARD.md`
- `docs/MOODYZ_PROVIDER.md`

## 新增文件

- `UPGRADE_V0.4.4.md`

## 修复内容

- 作品页优先选择 URL 路径包含 `/content/` 的业务图片作为 `cover_url`。
- 女优页优先选择 `/actress_main/` 图片作为 `profile_image_url`。
- `site_design`、`logo_image` 等站点 Logo / UI 资源不会进入业务图片字段。
- 支持 `src`、`data-src`、`data-original`、`data-lazy-src` 与 `srcset` 图片候选。
- `meta.json` 新增 `cover_source` / `profile_image_source`，便于追踪图片选择位置。
- Provider 仍然只保存图片 URL，不下载图片。

## 不包含

- `data/` 正式数据
- `exports/`
- `var/`
- GitHub Pages 页面
- 代理地址或任何凭据

## 验证结果

- 13 个数据集校验通过，0 行正式数据
- 数据质量：0 error / 0 warning
- 自动测试：34 / 34 通过
- 新增真实结构回归：错误 `og:image` 为站点 Logo 时，仍能选择 `/content/` 作品图片和 `/actress_main/` 女优图片
