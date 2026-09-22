# Averia 文档入口

建议按以下顺序阅读：

1. [产品定义](product/overview.md)
2. [现状审计与重构决定](product/audit-2026-09-21.md)
3. [Grilling 决策台账](product/decision-ledger.md)
4. [版本路线](product/roadmap.md)
5. [UI 设计系统](product/ui-system.md)
6. [目标架构](architecture/overview.md)
7. [架构决策记录](architecture/adr/README.md)
8. [数据与检索模型](data/model.md)
9. [本地资料库格式](data/local-library.md)
10. [审核与发布流程](data/editorial-workflow.md)
11. [内容安全、权利与隐私](safety/content-and-rights.md)
12. [本地开发手册](operations/local-development.md)
13. [部署策略](operations/deployment.md)

这些文档以 2026-09-21 的产品访谈为基线。实现与文档冲突时，应先暂停并更新对应 ADR，而不是静默改变产品边界。

## 分类规则

- `product/` 只记录用户价值、交互规范、路线和产品审计。
- `architecture/` 记录系统边界与不可轻易逆转的技术决策。
- `data/` 记录领域模型、采集审核流程和本地数据交换格式。
- `safety/` 记录内容安全、权利、隐私与下架规则。
- `operations/` 记录部署、环境和运行维护。
