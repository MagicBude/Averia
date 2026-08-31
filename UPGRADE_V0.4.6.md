# Averia V0.4.6 升级说明

## 修复内容

修复 `provider:moodyz` 命令行参数 `--actress-id` 无法传递给 MOODYZ URL 构造器的问题。

此前通用 `parseArgs()` 会保留参数名中的连字符，因此：

```text
--actress-id 855540
```

会得到 `args["actress-id"]`，而 MOODYZ URL 构造器使用的是 `actressId`。V0.4.6 在 CLI 边界显式完成映射，不修改全局参数解析规则，避免影响其它脚本。

## 回归测试

新增真实 CLI 级测试：

```text
provider-moodyz.mjs --file <女优fixture> --actress-id 855540
```

测试必须成功生成女优 `canonical.json`，并确认最终 URL 为：

```text
https://moodyz.com/actress/detail/855540
```

Provider 仍不会直接修改正式 CSV。
