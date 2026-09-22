# 本地收藏格式

收藏、私有标签和备注首期只保存在浏览器本地，不进入公共数据库或分享 URL。

当前原型使用 `averia:local-library:v1` 保存人物和作品的稳定 ID，已经支持收藏、取消收藏、刷新恢复和“只看收藏”。存储对象带 `version: 1`；私有标签、备注以及下述面向用户的导出格式尚未实现。

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
