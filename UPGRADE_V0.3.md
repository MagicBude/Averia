# Averia V0.3 增量升级说明

V0.3 在 V0.2 的安全导入边界上增加第一个真实数据源 **JAVDatabase Provider**。

## 升级内容

- 新增 JAVDatabase 单页 Provider；
- 支持按作品番号构造作品页 URL；
- 支持按女优 slug 构造资料页 URL；
- 自动保存 `raw.html`、`canonical.json`、`meta.json`；
- 作品页自动映射 Maker / Series / Genres / Cast；
- Content ID 作为附加作品番号进入 Stage；
- 女优页支持基本资料和别名解析；
- 增加离线 HTML Parser 模式；
- 增加 Provider Fixture 和自动测试；
- 保持 Provider 不直接写正式 CSV。

## 覆盖升级

将增量包解压到 Averia 仓库根目录并允许覆盖同名文件，然后执行：

```bash
pnpm install
pnpm check
pnpm data:export
```

## 第一次真实 Probe

推荐先：

```bash
pnpm provider:javdatabase -- --code SDAM-179
```

Provider 成功后会打印对应 `canonical.json` 路径以及下一步 Prepare 命令。

先执行 Prepare 和 Report，审核通过后再决定是否 Apply。
