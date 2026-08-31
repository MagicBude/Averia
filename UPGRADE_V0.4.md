# Averia V0.4 升级说明

## 主题

**第一个日文厂商官方 Provider：MOODYZ**

## 新增命令

```bash
pnpm provider:moodyz -- --code MDVR-434
pnpm provider:moodyz -- --actress-id 855540
```

## 主要变化

- 新增 MOODYZ 官方作品页 Parser。
- 新增 MOODYZ 官方女优页 Parser。
- canonical source 标记为 `language: ja`、`role: authoritative`。
- 作品日文标题同时写入 `title` 与 `title_ja`，避免英文聚合源成为默认主标题。
- 解析官方品番、発売日、时长、Label、Series、Genre 和女优关系。
- 女优页解析日文名、罗马字名、身高、三围、Cup。
- 复用 V0.3.2 自动代理网络层。
- 保留单页抓取限制，不自动递归。
- DMM/FANZA API 路线保留，但因注册需要日本国内收款账户而延期，不使用不合规方式绕过。

## 验证

```bash
pnpm check
```

然后第一次真实 Probe：

```bash
pnpm provider:moodyz -- --code MDVR-434
```

成功后只执行命令行输出的 `import:prepare` 与 `import:report`，先不要 Apply。
