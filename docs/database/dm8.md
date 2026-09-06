# 达梦 DM8：Oracle / MySQL 国产化迁移与调优

DM8 是国产关系数据库中常见的 Oracle 替代候选之一。迁移设计里最关键的概念是 `COMPATIBLE_MODE`：它可以让 DM 在部分语法与行为上兼容 Oracle、MySQL、PostgreSQL 等数据库，但它是**兼容行为开关，不是完整模拟器**。

## 适合从哪里迁移

| 源数据库 | 适配判断 | 说明 |
| --- | --- | --- |
| Oracle | **高** | 官方提供完整的 Oracle→DM 迁移资料，兼容参数、DTS、Oracle 风格对象是重点路线 |
| MySQL | **中** | 可设置 MySQL 兼容模式并使用 DTS，但官方明确提示不少语法/函数/过程对象仍需改写 |
| PostgreSQL | **中低** | `COMPATIBLE_MODE=7` 提供部分 PostgreSQL 兼容，需按异构迁移做完整验证 |
| SQL Server | 中 | 也存在对应兼容模式，具体支持度按版本确认 |

## `COMPATIBLE_MODE`

DM8 常见兼容值：

```text
0 = 不兼容其他数据库（默认）
1 = SQL92
2 = 部分兼容 Oracle
3 = 部分兼容 SQL Server
4 = 部分兼容 MySQL
5 = DM6
6 = 部分兼容 Teradata
7 = 部分兼容 PostgreSQL
8 = 部分兼容 DB2（部分版本文档中可见）
```

从 Oracle 迁移时常见建议：

```ini
COMPATIBLE_MODE=2
```

从 MySQL 迁移时：

```ini
COMPATIBLE_MODE=4
```

这是静态参数，修改后通常需要重启数据库。兼容参数会影响字符串、NULL、函数等行为，不要在业务上线后随意变更。

## Oracle → DM8

### 迁移时最先检查

- `NUMBER` / `VARCHAR2` / `DATE`；
- `BLOB` / `CLOB`；
- Sequence；
- `ROWNUM`；
- Procedure / Function；
- Package；
- Trigger；
- DBLink；
- Synonym；
- 物化视图；
- Oracle Hint；
- 系统包与系统视图；
- 空串与 NULL；
- NLS / 字符集；
- JDBC 驱动兼容行为。

DM 官方 Oracle 迁移文档特别提醒 `COMPATIBLE_MODE=2` 会影响空串和 NULL 等行为。源 Oracle 系统如果大量依赖 `'' IS NULL` 语义，这类测试必须纳入回归。

### JDBC 层兼容

DM JDBC 还提供连接级兼容参数，例如：

```text
jdbc:dm://host:5236?compatibleMode=oracle
```

驱动层兼容与 `dm.ini` 的 `COMPATIBLE_MODE` 不是同一个概念。一个控制客户端/结果行为，一个控制数据库服务器部分兼容语义，迁移时要区分。

## MySQL → DM8

官方文档明确说明：MySQL 到 DM 的语法兼容性并不意味着完全透明迁移。常见需要改造的内容包括：

- 表/视图/游标创建语法；
- MySQL 特有系统函数；
- 存储过程；
- 大小写与双引号行为；
- 字符串函数；
- 二进制数据；
- 数据合法性；
- 字符集与字段长度。

因此 MySQL→DM 项目应把 DTS 当迁移工具，而不是把它理解成“自动解决全部兼容性”。

## PostgreSQL → DM8

DM 提供部分 PostgreSQL 兼容，但以下对象需要单独核验：

- `jsonb`；
- ARRAY；
- 自定义类型；
- Extension；
- Operator；
- Function；
- `RETURNING`；
- Sequence；
- `ON CONFLICT`；
- 系统目录依赖。

如果 PostgreSQL 项目大量使用 Extension，通常改造量会显著高于普通 SQL 项目。

## DTS 迁移

DM 数据迁移工具 DTS 是常见迁移入口，可用于 Oracle/MySQL 等源库向 DM 搬迁对象和数据。

建议项目流程：

```text
源库资产盘点
  ↓
初始化 DM 参数
  ↓
DTS 结构迁移
  ↓
查看失败对象
  ↓
人工改造 SQL / PL
  ↓
全量数据迁移
  ↓
数据校验
  ↓
增量/停机窗口方案
  ↓
应用回归
  ↓
SQL 调优
```

## 个性化语法与工具习惯

### 查看执行计划

```sql
EXPLAIN
SELECT ...;
```

在 `disql` 中还可以使用 autotrace 获取真实执行统计。性能排查时重点关注：

- logical reads；
- physical reads；
- rows processed；
- sort(memory) / sort(disk)；
- exec time；
- 扫描方式与 Join 算法。

### `TOP`

DM 支持 `TOP` 风格限制结果集，在部分迁移项目中会看到：

```sql
SELECT TOP 10 *
FROM your_table;
```

如果源库是 Oracle/MySQL，建议统一应用分页层写法，而不是让业务长期混用多种方言。

## SQL 调优

DM 的查询优化器以 CBO 为核心，统计信息、表/索引/分区结构和 Hint 都会影响执行计划。

### 第一步：统计信息

统计信息是优化器估算成本的基础。大量数据变更后，如果统计信息陈旧，索引存在也可能不被选中。

可以使用 `DBMS_STATS` 体系收集表/索引统计信息，具体参数按版本和对象规模确定。

### 第二步：执行计划

```sql
EXPLAIN SELECT ...;
```

重点识别：

- `CSCN` 等全表扫描；
- 索引扫描；
- Nested Loop；
- Hash Join；
- 聚合方式；
- 估算行数是否异常；
- 排序/Hash 是否落盘。

### 第三步：索引

优化索引时优先考虑：

- 高选择性过滤列；
- Join 键；
- 联合索引列顺序；
- 覆盖查询；
- `GROUP BY` / `ORDER BY` 是否能受益；
- 大量 DML 后索引膨胀。

### 第四步：SQL 改写

DM 官方调优文档中常见建议包括：

- 能用 `UNION ALL` 时不要无意义使用 `UNION` 去重；
- 避免无必要的全表扫描；
- 对过滤条件进行合理下推；
- 关注聚合和排序的内存/落盘；
- `COUNT(*)` 与 `COUNT(column)` 要按语义和性能选择。

### 第五步：Hint

DM 支持优化器 Hint。当统计信息、索引和 SQL 已经合理但计划仍不理想时，可以用 Hint 干预。

不要把 Hint 当第一选择。官方文档也强调：统计信息缺失或陈旧时，Hint 只是掩盖根因。

## 初始化参数需要在迁移前冻结

Oracle→DM 项目除了 `COMPATIBLE_MODE`，还要重点确认：

- PAGE_SIZE；
- CHARSET；
- LENGTH_IN_CHAR；
- CASE_SENSITIVE；
- BLANK_PAD_MODE；
- FLOAT_MODE；
- 时区和日期格式相关配置。

部分初始化参数一旦建库后很难修改，因此 PoC 阶段就要按生产数据模型验证，不要用默认参数随便建一个库后直接上线。

## 常见迁移坑

### 把 `COMPATIBLE_MODE=2` 当成“完全 Oracle”

兼容参数只能减少改造量。Oracle 高级包、特殊类型、系统视图和边界语义仍要逐项验证。

### DM 字段长度和字符集规划不足

Oracle/MySQL 字符语义迁移后可能因为 UTF-8、多字节字符、页大小等因素出现长度差异。DDL 转换阶段要做真实数据抽样。

### 应用 SQL 在管理工具快、程序里慢

需要对比应用真实绑定变量、会话参数和缓存执行计划。不要只把 SQL 拷到客户端执行一次就判断数据库没问题。

### 索引建了但不走

优先检查统计信息、隐式类型转换和选择性，而不是继续叠加索引。

## 推荐迁移验证清单

- [ ] 确定 `COMPATIBLE_MODE`；
- [ ] 确定字符集、页大小和大小写行为；
- [ ] 盘点 Oracle Package / Trigger / DBLink / Synonym；
- [ ] 盘点 MySQL 特有函数和过程对象；
- [ ] 用 DTS 做对象迁移 PoC；
- [ ] 对失败对象分级改造；
- [ ] 做全量/分桶/Hash 校验；
- [ ] 回归空串、NULL、日期、数值精度；
- [ ] 更新统计信息后测试 Top SQL；
- [ ] 比较逻辑读、物理读、P95/P99；
- [ ] 验证备份恢复和回切。

## 官方资料

- Oracle→DM：https://eco.dameng.com/document/dm/zh-cn/start/oracle_dm
- Oracle 迁移 FAQ：https://eco.dameng.com/document/dm/zh-cn/faq/faq-oracle-dm8-migrate.html
- MySQL→DM：https://eco.dameng.com/document/dm/zh-cn/start/mysql_dm.html
- MySQL 迁移 FAQ：https://eco.dameng.com/document/dm/zh-cn/faq/faq-mysql-dm8-migrate.html
- 查询优化：https://eco.dameng.com/document/dm/zh-cn/pm/query-optimization.html
- SQL 调优：https://eco.dameng.com/document/dm/zh-cn/pm/sql-tuning.html
- 性能优化：https://eco.dameng.com/document/dm/zh-cn/ops/performance-optimization.html
