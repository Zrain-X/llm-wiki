# 数据库

数据库栏目重点围绕 **国产化迁移、跨库兼容、SQL 调优和日常排障** 维护。

当前最重要的主线是：MySQL、PostgreSQL、Oracle 等主流数据库向 OceanBase、TiDB、KingbaseES、达梦 DM8、GaussDB、openGauss 等国产数据库迁移。

## 国产化迁移

- [数据库国产化迁移对比](./database-localization-comparison)：从 MySQL / PostgreSQL / Oracle 出发，对比主要国产数据库的兼容方向、迁移改造量和适用场景。
- [OceanBase](./oceanbase)：MySQL / Oracle 双兼容模式、迁移注意点、特色语法与调优。
- [TiDB](./tidb)：MySQL 兼容、分布式架构、TiKV / TiFlash、热点与 SQL 调优。
- [KingbaseES](./kingbasees)：Oracle / MySQL / PostgreSQL 等兼容模式、过程对象迁移与调优。
- [达梦 DM8](./dm8)：Oracle / MySQL / PostgreSQL 兼容参数、DTS 迁移、SQL 与性能调优。
- [GaussDB](./gaussdb)：Oracle / MySQL / PG 兼容模式、集中式与分布式差异、SQL 调优。
- [openGauss](./opengauss)：PG 迁移、A/B/PG 兼容模式、执行计划与统计信息。

## 现有速查与排障

- [Greenplum 元数据与权限](./greenplum)：系统目录、表大小、ACL、外表与 WLM 排障。
- [TiDB / MySQL 数据校验](./tidb-mysql-validation)：Hash、NULL 归一化、日期/数值格式和分桶校验。

## 推荐阅读顺序

如果正在做国产化迁移：

1. 先看 [数据库国产化迁移对比](./database-localization-comparison) 确定目标库候选；
2. 再进入目标数据库文档看兼容模式和迁移差异；
3. 最后结合实际 Schema、SQL、过程对象和 Top SQL 做验证。

后续会继续沉淀 PostgreSQL、Oracle、DB2、Hive SQL、迁移校验脚本、DDL 转换和权限模型等内容。
