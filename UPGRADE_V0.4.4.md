# Averia V0.4.4 升级说明

V0.4.4 修复 MOODYZ 真实页面的作品封面/女优头像选择。

## 原因

第一次真实 `MDVR-434` canonical 审核发现，MOODYZ 页面的 `og:image` 指向站点 Logo，导致 `cover_url` 被错误填充。真实作品页同时存在 `/content/` 业务图片，女优页存在 `/actress_main/` 图片。

## 修复

- 新增 MOODYZ 图片候选解析与评分。
- 作品页优先 `/content/` 图片。
- 女优页优先 `/actress_main/` 图片。
- `site_design`、`logo_image`、明显 Logo 资源会被排除。
- `meta.json` 记录 `cover_source` / `profile_image_source`。
- Provider 仍只保存 URL，不下载图片。

## 升级后

旧的 `canonical.json` 中包含错误封面 URL，不应 Apply。升级后重新执行 MOODYZ Provider，再重新 Prepare / Report。
