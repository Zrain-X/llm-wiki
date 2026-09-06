# KingbaseES：多兼容模式与国产化迁移

KingbaseES 的核心迁移价值是 **面向多种主流数据库提供兼容模式**。官方文档中明确列出 Oracle、MySQL、PostgreSQL、SQL Server 等兼容方向，因此它很适合传统政企应用在不大规模重写数据库层代码的前提下做国产化替代。

## 适合从哪里迁移

| 源数据库 | 适配判断 | 重点 |
| --- | --- | --- |
| Oracle | **高** | 数据类型、SQL、PL/SQL、Package、系统视图等是重点兼容方向 |
| PostgreSQL | **高** | PostgreSQL 兼容模式与生态习惯较接近 |
| MySQL | **中高~高** | 提供 MySQL 兼容模式，常见数据类型、函数、DML/PL 能力有适配 |
| SQL Server | 中高 | 提供 SQL Server 兼容模式，仍需针对业务对象逐项评估 |

## 兼容模式是迁移设计的一部分

KingbaseES 不同兼容模式会影响 SQL 接口、数据类型、对象和过程语言行为。迁移项目必须先根据源库确定目标兼容模式，再做 Schema 转换和应用改造。

不要把“兼容 Oracle/MySQL/PostgreSQL”理解成“底层就是这些数据库”。系统目录、优化器、锁、存储和运维仍按 KingbaseES 自身机制工作。

## Oracle → KingbaseES

KingbaseES 官方迁移手册对 Oracle 兼容覆盖很广，常见能力包括：

- `NUMBER`、`VARCHAR2`、`DATE`、`INTERVAL`、`ROWID` 等数据类型；
- `ROWNUM`、层次查询、`DUAL`；
- `MERGE`；
- Sequence；
- DBLink；
- 物化视图；
- 多类 Oracle 内置函数；
- PL/SQL 控制语句；
- `%TYPE` / `%ROWTYPE`；
- REF CURSOR；
- `EXECUTE IMMEDIATE`；
- `BULK COLLECT` / `FORALL`；
- Package；
- Trigger；
- 自治事务等。

这使 Oracle 应用的改造量通常比迁移到纯 MySQL/PG 方言数据库更低，但仍需要做对象级兼容性评估。

### Oracle 迁移重点检查

- Oracle 高级包是否有等价实现；
- Hint 是否仍有效；
- DBLink 对远程库的依赖；
- Synonym；
- NLS 与字符集；
- 空串/NULL 语义；
- 分区与全局索引；
- 物化视图刷新；
- OCI / Pro*C 等客户端接口；
- Oracle 系统视图依赖。

## MySQL → KingbaseES

KingbaseES MySQL 模式官方说明覆盖：

- 常见数据类型；
- 常见表达式和函数；
- `REPLACE`；
- `INSERT ... ON DUPLICATE KEY`；
- `INSERT IGNORE`；
- `UPDATE/DELETE ... LIMIT`；
- `CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`；
- MySQL 用户变量；
- 存储过程、函数、触发器、游标等过程能力。

迁移时仍要重点验证：

- 反引号标识符；
- 大小写与排序规则；
- `sql_mode`；
- JSON；
- `AUTO_INCREMENT`；
- unsigned 类型；
- MySQL 特有函数；
- 多表 UPDATE/DELETE；
- `information_schema` 依赖。

## PostgreSQL → KingbaseES

如果源库是 PostgreSQL，建议按以下顺序盘点：

1. 基础 SQL、Schema、Sequence；
2. 数据类型；
3. `json/jsonb`、数组、UUID；
4. Function / Procedure；
5. Extension；
6. Operator / Cast；
7. 系统目录依赖；
8. 逻辑复制或 CDC；
9. `VACUUM/ANALYZE` 等运维逻辑。

真正容易拉高改造量的通常不是普通 SQL，而是 PostgreSQL Extension 和自定义类型/Operator。

## 迁移工具

KingbaseES 提供 KDTS 等异构迁移工具和 Oracle/MySQL 迁移指南。项目中建议至少拆成：

```text
兼容模式确定
  ↓
对象采集
  ↓
DDL 转换
  ↓
对象编译
  ↓
全量数据迁移
  ↓
增量同步
  ↓
应用回归
  ↓
性能调优
```

对于 Oracle 项目，Package/Function/Trigger 最好单独输出“自动转换 / 需人工改造 / 不支持”三类清单。

## 个性化语法与使用习惯

### Oracle 风格能力

Oracle 兼容模式下可以继续使用大量 Oracle 风格语法，例如：

```sql
SELECT ROWNUM, t.*
FROM your_table t;
```

```sql
SELECT SYSDATE;
```

以及 `NUMBER`、`VARCHAR2`、Sequence、Package 等对象。

具体支持度要以目标版本的《KingbaseES 与 Oracle 的兼容性说明》为准。

### MySQL 风格能力

MySQL 兼容模式支持很多迁移常见写法，例如：

```sql
INSERT INTO t(id, val)
VALUES (1, 'a')
ON DUPLICATE KEY UPDATE val = VALUES(val);
```

对于这种“看起来熟悉”的语法，仍要验证边界行为和异常语义。

## SQL 调优

KingbaseES 的调优思路与 PostgreSQL/Oracle DBA 都比较容易衔接：**统计信息 → 执行计划 → 索引/表定义 → SQL 改写 → Hint**。

### 查看执行计划

```sql
EXPLAIN
SELECT ...;
```

需要实际执行信息时：

```sql
EXPLAIN ANALYZE
SELECT ...;
```

重点比较：

- 估算行数与实际行数；
- Seq Scan / Index Scan；
- Join 顺序；
- Nested Loop / Hash Join / Merge Join；
- Sort 是否落盘；
- 分区裁剪；
- Planning Time / Execution Time。

### 统计信息

```sql
ANALYZE your_table;
```

如果估算行数明显偏离实际值，先更新统计信息再判断索引或 Hint。官方调优文档也将统计信息准确性列为执行计划质量的关键因素。

### 索引

KingbaseES 支持多种索引类型。迁移后重点重新审视：

- 联合索引；
- 表达式索引；
- 局部/部分索引；
- GIN/GiST 等扩展索引场景；
- 冗余索引；
- 大量 DML 后索引膨胀。

### Hint

当统计信息已经准确、SQL 和索引也合理，但优化器仍选择次优计划时，再考虑 Hint。不要把 Oracle 原有 Hint 全量复制后长期保留。

## 常见迁移坑

### 兼容模式和数据库对象混用

不同模式支持的对象和语义不同，例如 Package 等能力与 Oracle 兼容模式强相关。迁移前应先冻结兼容模式。

### PostgreSQL Extension 被忽略

普通表和 SQL 迁移很顺，不代表 Extension 也能迁移。`postgis`、自定义插件、FDW 等必须单列评估。

### Oracle Package 只“编译成功”但语义不同

编译通过只是第一步，还要对异常处理、事务控制、动态 SQL、NLS 和系统包调用做业务回归。

### 直接照搬源库参数

Oracle/MySQL/PostgreSQL 参数体系与 KingbaseES 并不一一对应。应根据 KingbaseES 自身资源模型重新做参数基线。

## 推荐迁移验证清单

- [ ] 确定兼容模式；
- [ ] 输出所有数据库对象清单；
- [ ] 标记 Oracle Package / Trigger / DBLink / Synonym；
- [ ] 标记 PostgreSQL Extension / Operator / 自定义类型；
- [ ] 标记 MySQL 存储过程、事件、JSON 和大小写依赖；
- [ ] 使用迁移工具做 PoC；
- [ ] 做表级、分桶和行级数据校验；
- [ ] 更新统计信息后回归 Top SQL；
- [ ] 比较 P95/P99 延迟；
- [ ] 验证备份恢复、HA 和回切。

## 官方资料

- 迁移概述：https://help.kingbase.com.cn/v9.4.12/development/application-develop-guide/data_migration/migration_overview.html
- Oracle 迁移概述：https://help.kingbase.com.cn/v9/development/develop-transfer/transplant-oracle/transplant-oracle-1.html
- MySQL 兼容性：https://help.kingbase.com.cn/v8/development/develop-transfer/kes-vs-mysql/overview.html
- 应用开发及迁移指南：https://help.kingbase.com.cn/v8/development/develop-transfer/index.html
- SQL 调优指南：https://help.kingbase.com.cn/v9.4.12/perfor/sql-optimization/sql-optimization-03.html
