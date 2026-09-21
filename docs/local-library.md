# 本地收藏格式

收藏、私有标签和备注首期只保存在浏览器本地，不进入公共数据库或分享 URL。

建议导出结构：

```json
{
  "format": "averia-local-library",
  "version": 1,
  "exportedAt": "2026-09-21T00:00:00.000Z",
  "items": [
    {
      "entityType": "person",
      "entityId": "稳定公开 ID",
      "favorite": true,
      "tags": ["稍后查看"],
      "note": "仅本地可见"
    }
  ]
}
```

导入必须先校验格式和版本，并展示新增、覆盖、缺失实体的预览。未来账号同步也不能静默上传既有本地数据。
