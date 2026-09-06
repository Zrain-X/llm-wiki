# openGauss：PostgreSQL 国产化迁移与 SQL 调优

openGauss 是面向企业场景的开源关系数据库。对已有 PostgreSQL 技术栈而言，它通常比 MySQL 方言数据库更容易衔接：官方提供 PostgreSQL 客户端/API 兼容能力和 PostgreSQL→openGauss 迁移工具链，同时数据库还提供 A、B、PG 等兼容行为。

## 适合从哪里迁移

| 源数据库 | 适配判断 | 说明 |
| --- | --- | --- |
| PostgreSQL | **高** | PG 客户端/API 兼容，DataKit 提供 PostgreSQL 迁移路径 |
| Oracle | **中高** | A 类兼容模式覆盖较多 Oracle 风格语法，但复杂 PL/SQL 和高级包需评估 |
| MySQL | **中** | B 类兼容行为存在，但不应等同于 MySQL 协议/生态完整兼容 |
| 其他数据库 | 中低 | 需要异构转换工具或人工改造 |

## 兼容模式

openGauss 文档中 `sql_compatibility` 可见典型值：

```text
A  = Oracle 兼容
B  = MySQL 兼容
C  = Teradata 兼容
PG = PostgreSQL 兼容
```

创建 PostgreSQL 兼容数据库的典型写法：

```sql
CREATE DATABASE target_db
WITH DBCOMPATIBILITY = 'PG';
```

兼容模式会影响 SQL 语法、数据类型、函数和行为。迁移前应固定目标模式并以目标版本文档为准。

## PostgreSQL → openGauss

这是最自然的国产化迁移路线之一。

### 通常较容易迁移

- PostgreSQL 客户端协议/API；
- 常规 Schema / Table / View；
- Sequence；
- 标准 SQL；
- 常见索引；
- 大量 PostgreSQL 风格函数和类型。

### 重点核验

- PostgreSQL 版本差异；
- Extension；
- `jsonb`；
- ARRAY；
- 自定义 Type；
- Operator / Cast；
- Function / Procedure；
- FDW；
- Logical Replication；
- `pg_catalog` 系统表依赖；
- Vacuum / Autovacuum 运维习惯；
- `RETURNING` / `ON CONFLICT` 等业务用法。

openGauss DataKit 的 PostgreSQL 迁移文档要求目标库使用 PG 兼容模式，并对源 PostgreSQL 版本、用户权限和连通性做前置检查。

## Oracle → openGauss

A 类兼容模式用于提供 Oracle 风格兼容能力。迁移时重点关注：

- `NUMBER` / `VARCHAR2` / `DATE`；
- `ROWNUM`；
- Sequence；
- Procedure / Function；
- Trigger；
- Package；
- DBLink；
- Synonym；
- 系统包；
- Oracle Hint；
- 空串/NULL；
- NLS。

普通 SQL 的兼容不代表复杂 PL/SQL 可以无损迁移。Oracle 项目仍需要把过程对象单独做兼容性评估和回归测试。

## MySQL → openGauss

B 类兼容模式可以降低部分 MySQL 方言改造量，但以下内容必须单独验证：

- MySQL 协议与驱动；
- `AUTO_INCREMENT`；
- `ON DUPLICATE KEY`；
- JSON；
- `sql_mode`；
- unsigned；
- 字符集和排序规则；
- 多表 UPDATE/DELETE；
- Trigger / Event；
- MySQL 系统表和元数据接口。

如果源系统深度绑定 MySQL 生态，TiDB 或 OceanBase MySQL 模式通常是更直接的迁移候选；如果组织目标是统一 PG/openGauss 技术栈，则可以接受更高 SQL 改造量。

## 个性化能力

### `DBCOMPATIBILITY`

```sql
CREATE DATABASE appdb
WITH DBCOMPATIBILITY = 'PG';
```

这个属性应在迁移设计阶段确定，而不是等 Schema 全部导入后再调整。

### 行存与列存

openGauss 在企业场景中支持多种存储组织能力。OLTP 表通常优先行存；大扫描、聚合分析场景可以评估列存相关能力。不要仅因为“列存快”就把所有表改为列存，更新模式、事务特征和查询类型必须一起考虑。

### Plan Hint

openGauss 提供 Plan Hint 等方式控制执行计划。Hint 适合作为优化器在特殊场景下的补充，而不是统计信息失真时的默认补丁。

## SQL 调优

openGauss 官方调优流程与 GaussDB 类似：

1. 更新统计信息；
2. 查看执行计划；
3. 审视表定义；
4. 定位扫描、Join、排序、内存等瓶颈；
5. SQL 改写；
6. 必要时使用 Hint。

## 统计信息

```sql
ANALYZE your_table;
```

官方文档强调：统计信息是优化器生成计划的源数据。大批量 INSERT/DELETE 后、临时/中间表生成后都应关注统计信息。

对于多个条件列高度相关的场景，可评估多列统计信息，以降低基数估算偏差。

## 执行计划

```sql
EXPLAIN
SELECT ...;
```

需要实际执行信息时：

```sql
EXPLAIN ANALYZE
SELECT ...;
```

部分版本可使用：

```sql
EXPLAIN PERFORMANCE
SELECT ...;
```

重点检查：

- Seq Scan / Index Scan；
- 估算行数 vs 实际行数；
- Nested Loop / Hash Join / Merge Join；
- Sort / Hash 是否落盘；
- 分区裁剪；
- 内存使用；
- 并行度；
- 数据倾斜。

## 索引与表设计

迁移 PostgreSQL 时不要机械复制全部索引。建议重新确认：

- 过滤条件选择性；
- 联合索引顺序；
- 部分索引；
- 表达式索引；
- GIN/GiST 等索引是否被目标版本支持且行为一致；
- 索引膨胀；
- 频繁 DML 表上的索引数量。

## PostgreSQL 迁移中特别容易忽略的对象

### Extension

这是 PG 国产化迁移最常见的隐藏成本之一。例如：

- PostGIS；
- pgcrypto；
- uuid-ossp；
- 自定义 C 扩展；
- FDW；
- 时序/向量等第三方扩展。

每个 Extension 都要判断：

```text
openGauss 原生支持？
有兼容插件？
可以 SQL 重写？
必须应用层替代？
完全无法迁移？
```

### 系统目录

如果应用直接查询 `pg_catalog`、OID、内部统计视图，要逐条验证。协议兼容不代表所有内部目录结构完全一致。

### Vacuum 习惯

PostgreSQL DBA 常把 VACUUM/Autovacuum 经验直接带过去。openGauss 有自身维护机制和参数，应按照 openGauss 文档重新建立维护基线。

## 常见迁移坑

### 把 PG 协议兼容理解成版本完全一致

客户端能连通只是第一层。函数、Extension、优化器、系统视图和行为仍可能不同。

### A/B 模式功能看起来“像 Oracle/MySQL”就跳过测试

兼容模式只覆盖一部分行为，尤其复杂过程代码和边界语义仍需实测。

### 统计信息没更新就开始改 SQL

如果 `EXPLAIN ANALYZE` 中估算行数严重失真，先 `ANALYZE`，再判断索引和 SQL 是否真的有问题。

### 忽略 PG Extension

迁移失败项目中，Extension 往往比普通 SQL 更容易造成大规模改造。

## 推荐迁移验证清单

- [ ] 确认 `DBCOMPATIBILITY`；
- [ ] 确认源 PostgreSQL 版本；
- [ ] 导出全部 Extension；
- [ ] 盘点自定义类型 / Operator / Cast；
- [ ] 盘点 Function / Procedure / Trigger；
- [ ] 盘点 `pg_catalog` 依赖；
- [ ] 使用 DataKit 做迁移 PoC；
- [ ] 做全量、分桶和 Hash 校验；
- [ ] 更新统计信息后回归 Top SQL；
- [ ] 比较 P95/P99 与批处理窗口；
- [ ] 重新建立维护、备份和 HA 基线。

## 官方资料

- PostgreSQL API 兼容：https://docs.opengauss.org/en/docs/latest/characteristic_description/postgresql_api_compatibility.html
- PostgreSQL 数据迁移：https://docs.opengauss.org/zh/docs/latest/datakit/datakit_postgresql_migration.html
- 兼容模式说明：https://docs.opengauss.org/en/docs/latest/database_reference/platform_and_client_compatibility.html
- SQL 调优：https://docs.opengauss.org/zh/docs/latest/performance_tuning_guide/sql_optimization.html
- 调优流程：https://docs.opengauss.org/zh/docs/latest/performance_tuning_guide/tuning_process.html
- 更新统计信息：https://docs.opengauss.org/zh/docs/latest/performance_tuning_guide/update_statistics.html
