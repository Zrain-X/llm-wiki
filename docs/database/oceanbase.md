# OceanBase：国产化迁移与 SQL 调优

OceanBase 是原生分布式关系数据库。做国产化迁移时最重要的特征不是“兼容 MySQL”，而是 **同一套数据库同时提供 MySQL 与 Oracle 两类兼容租户**。兼容模式在租户创建时确定，之后不能修改；社区版仅提供 MySQL 模式。

## 适合从哪里迁移

| 源数据库 | 适配判断 | 说明 |
| --- | --- | --- |
| MySQL 5.7 / 8.0 | 高 | MySQL 模式兼容 5.7/8.0 的绝大部分常用功能与语法 |
| Oracle | 高 | 企业版 Oracle 模式覆盖大量 SQL、数据类型、PL 和系统能力 |
| PostgreSQL | 中低 | OMA 可做 PostgreSQL 源端评估，但目标仍是 MySQL/Oracle 兼容模式，属于异构转换 |
| TiDB | 中高 | MySQL 语义较近，仍需验证分布式特性和 TiDB 专有语法 |

## 先确认兼容模式

```sql
SHOW VARIABLES LIKE 'ob_compatibility_mode';
```

很多“函数不存在”“语法行为奇怪”的问题，本质上是把 MySQL 模式与 Oracle 模式的写法混用了。

OceanBase 官方说明：MySQL 模式兼容 MySQL 5.7/8.0 的绝大部分功能和语法；Oracle 模式支持绝大部分 Oracle SQL 和过程化语言能力。Oracle 模式仍存在不兼容项，例如部分老旧数据类型和高级特性，迁移前必须使用兼容性评估而不是凭经验判断。

## 架构上需要重新理解的概念

### 租户

OceanBase 用租户实现资源和数据隔离。应用迁移时需要先确定：

- 租户兼容模式；
- 资源单元与资源池；
- 副本数量与部署地域；
- 业务库和租户的映射关系。

传统 MySQL/Oracle 的“实例”经验不能直接照搬到 OceanBase。

### 分区与分布式执行

大表设计要同时考虑：

- 分区键是否符合主要访问路径；
- 是否容易产生热点；
- Join 是否能减少跨节点数据移动；
- 分区裁剪是否生效；
- 数据倾斜是否明显。

单机数据库里一个“还能接受”的全表扫描，在分布式环境里可能演变成高代价的数据读取和网络传输。

## MySQL → OceanBase

### 通常迁移较顺的部分

- MySQL 协议与常见客户端；
- 常规 DDL/DML；
- 常见函数与表达式；
- `AUTO_INCREMENT`、分页、常见 Join；
- `information_schema` 相关使用习惯。

### 重点核验

- MySQL 8.0 新语法与 JSON 函数；
- 存储过程、触发器和事件；
- 字符集、排序规则和大小写行为；
- `sql_mode` 依赖；
- 隐式类型转换；
- 分区表定义；
- 自增主键热点；
- 原有分库分表逻辑是否应该取消。

## Oracle → OceanBase

Oracle 模式是 OceanBase 国产化项目里很重要的一条路线。官方兼容范围覆盖数据类型、SQL、PL、系统视图、安全、备份恢复、优化器等多个层面，但并不是完整复制 Oracle。

迁移时重点盘点：

- `NUMBER` / `VARCHAR2` / `DATE` / LOB；
- `ROWNUM`、层次查询、`MINUS`；
- Sequence；
- Procedure / Function / Package；
- Trigger；
- DBLink；
- Synonym；
- Materialized View；
- Oracle Hint；
- `DBMS_*` 系统包；
- NLS 与空串/NULL 行为。

OceanBase 官方文档明确指出 `LONG`、`LONG RAW` 等老旧类型不在兼容计划内。此类对象应在迁移前主动整改。

## OMS / OMA

国产化迁移建议把 OceanBase 官方工具作为标准步骤：

- **OMA（OceanBase Migration Assessment）**：做兼容性评估、数据库画像、对象转换评估；
- **OMS（OceanBase Migration Service）**：做结构迁移、全量迁移、增量同步和校验。

OMA 当前可评估 MySQL、Oracle、PostgreSQL、TiDB、DB2 LUW、openGauss、SQL Server 等多类源数据库到 OceanBase 的兼容情况。

## 常用 SQL 速查

### 当前月第一天

MySQL 模式：

```sql
SELECT CAST(DATE_FORMAT(CURRENT_DATE, '%Y-%m-01') AS DATE);
```

Oracle 模式：

```sql
SELECT TRUNC(SYSDATE, 'MM') FROM dual;
```

### 整除

MySQL 模式：

```sql
SELECT 10 DIV 3;
```

如果业务语义明确是向下取整：

```sql
SELECT FLOOR(10 / 3);
```

涉及负数时注意“截断”和“向下取整”的差异。

### 常用日期计算

```sql
SELECT DATE_ADD(CURRENT_DATE, INTERVAL 1 DAY);
SELECT DATE_SUB(CURRENT_DATE, INTERVAL 1 MONTH);
SELECT DATEDIFF('2026-09-06', '2026-09-01');
```

### 生成排除字段后的列清单

MySQL 模式：

```sql
SELECT GROUP_CONCAT(
         CONCAT('`', COLUMN_NAME, '`')
         ORDER BY ORDINAL_POSITION
         SEPARATOR ', '
       ) AS column_list
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'your_database'
  AND TABLE_NAME = 'your_table'
  AND COLUMN_NAME NOT IN ('field_a', 'field_b');
```

### 查看表结构

```sql
DESC your_table;
SHOW CREATE TABLE your_table;
```

## 执行计划与优化

### 先看执行计划

```sql
EXPLAIN
SELECT ...;
```

不要只看是否“用了索引”，还要看：

- 估算行数是否合理；
- Join 顺序；
- 分区裁剪；
- 过滤条件是否下推；
- 是否产生大量数据重分布；
- 是否存在隐式类型转换；
- 并行度是否合理。

### 统计信息

统计信息过期会直接影响优化器的基数估算和执行计划。大批量装载或数据分布变化后应主动检查统计信息。

MySQL 模式常见写法：

```sql
ANALYZE TABLE your_table;
```

Oracle 模式可以使用 `DBMS_STATS` 体系。具体参数应以当前 OceanBase 版本为准。

### 并行查询

OceanBase 支持并行查询和并行 DML。大查询可以通过系统参数、Session 或 Hint 控制并行度，例如 Oracle 风格的 `PARALLEL` Hint。

并行度不是越高越好。优先判断：

1. 单条 SQL 是否真的属于大扫描/大聚合；
2. 是否存在热点分区；
3. CPU 与 IO 是否已经饱和；
4. 并行执行是否扩大跨节点数据交换。

### 索引与分区

迁移后不要机械照搬源库索引。建议重新验证：

- 高选择性过滤列；
- 联合索引列顺序；
- 覆盖索引收益；
- 分区键与索引的配合；
- 热点写入；
- 大表 Join 的访问路径。

## 常见迁移风险

### 兼容模式选错

这是最昂贵的前期错误之一。兼容模式一旦确定不能修改，因此必须在 DDL 转换之前完成选型和 PoC。

### 把 OceanBase 当成“更大的 MySQL”

协议兼容不意味着架构相同。分布式事务、分区、热点、租户资源、跨节点执行都会改变性能特征。

### 直接复制 Oracle Hint

Oracle 的 Hint 可能在 OceanBase 中被支持，但原执行计划目标未必还成立。迁移后应先让优化器基于新统计信息生成计划，再决定是否需要 Hint。

### 对象重建后权限丢失

涉及视图、存储过程和依赖对象时，要检查定义者/调用者语义、依赖对象和对象重建后的授权状态。

## 推荐迁移验证清单

- [ ] 确认 MySQL / Oracle 租户模式；
- [ ] 跑 OMA 兼容性评估；
- [ ] 导出不兼容对象清单；
- [ ] 验证字符集、时区、NULL 与日期语义；
- [ ] 校验全量 + 增量数据；
- [ ] 回归 Top SQL；
- [ ] 对大表重新设计分区；
- [ ] 检查热点主键；
- [ ] 对比源库 P95/P99；
- [ ] 验证备份、恢复、容灾和切回方案。

## 官方资料

- 兼容模式：https://www.oceanbase.com/docs/common-oceanbase-database-cn-1000000001429200
- Oracle 兼容性：https://www.oceanbase.com/docs/common-oceanbase-database-cn-1000000000507564
- MySQL 兼容性：https://www.oceanbase.com/docs/common-oceanbase-database-cn-1000000000818347
- OMA 兼容性评估：https://www.oceanbase.com/docs/enterprise-oma-doc-cn-1000000000343002
- 并行执行调优：https://www.oceanbase.com/docs/common-oceanbase-database-cn-1000000002013748
