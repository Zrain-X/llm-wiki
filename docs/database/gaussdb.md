# GaussDB：兼容模式、国产化迁移与 SQL 调优

GaussDB 同时提供集中式和分布式产品形态，并提供 Oracle、MySQL、PostgreSQL 等兼容模式。做国产化迁移时必须先区分 **集中式 / 分布式版本**，因为兼容模式名称、语法、分布策略和调优重点可能不同。

## 适合从哪里迁移

| 源数据库 | 适配判断 | 说明 |
| --- | --- | --- |
| Oracle | **高** | Oracle 兼容模式是官方重点迁移方向，基本 SQL、数据类型、数据库对象和 PL/SQL 有较高兼容性 |
| MySQL | **中高~高** | 提供 MySQL / M-Compatibility 等兼容模式，M 模式强调语法、类型、元数据和协议兼容 |
| PostgreSQL | **中高** | 存在 PG 兼容模式，但 UGO 实际迁移链路和目标模式要按产品版本确认 |
| 其他数据库 | 中 | 可通过 UGO 等工具做异构转换，重点取决于对象与过程代码复杂度 |

## 兼容模式

GaussDB 不同产品形态下兼容模式名称存在差异。

### 集中式常见模式

```text
A  = Oracle 兼容
B  = MySQL B 兼容（后续不再重点演进）
C  = Teradata 兼容
PG = PostgreSQL 兼容
M  = MySQL M-Compatibility
```

### 分布式常见模式

官方新版本文档中可见：

```text
ORA   = Oracle 兼容
MYSQL = MySQL 兼容
PG    = PostgreSQL 兼容
M     = MySQL M-Compatibility
TD    = Teradata 兼容
```

不同版本命名会变化，建库前必须查目标版本文档。

## 创建 Oracle 兼容数据库

集中式：

```sql
CREATE DATABASE appdb DBCOMPATIBILITY = 'A';
```

分布式：

```sql
CREATE DATABASE appdb DBCOMPATIBILITY = 'ORA';
```

UGO 官方迁移指南明确建议非 MySQL/GoldenDB 源库迁移到 GaussDB 时，常按 Oracle 兼容模式进行转换。因此即使源库是 PostgreSQL，也不能想当然认为工具一定会把它迁到 PG 模式。

## Oracle → GaussDB

GaussDB 官方兼容性说明指出，其 Oracle 兼容模式在数据类型、SQL、数据库对象以及 PL/SQL 等基本能力上与 Oracle 基本兼容，但由于架构差异仍存在不兼容项。

迁移前重点盘点：

- `NUMBER` / `VARCHAR2` / `DATE` / LOB；
- Sequence；
- `ROWNUM`；
- Procedure / Function / Package；
- Trigger；
- DBLink；
- Synonym；
- Materialized View；
- Oracle Hint；
- 高级包；
- 系统视图；
- NLS；
- 自治事务；
- 动态 SQL。

### GUC 兼容参数

GaussDB Oracle 兼容模式还可通过部分 GUC 参数调整行为，例如显示格式等。迁移过程中这类参数应该纳入配置基线，避免测试环境和生产环境行为不一致。

## MySQL → GaussDB

GaussDB 当前 MySQL 迁移应重点关注 M-Compatibility。官方文档说明 M 模式在：

- SQL 语法；
- 数据类型；
- 元数据；
- 协议；

等方面对 MySQL 的兼容度较高。

B 模式因架构限制，官方说明后续不再重点演进，因此新迁移项目应优先确认 M 模式是否满足版本和工具链要求。

重点验证：

- MySQL 5.7/8.0 差异；
- 字符集和 Collation；
- `AUTO_INCREMENT`；
- JSON；
- `ON DUPLICATE KEY`；
- 多表 UPDATE/DELETE；
- `sql_mode`；
- `information_schema`；
- 正则和隐式类型转换；
- 存储过程、Trigger、Event。

## PostgreSQL → GaussDB

GaussDB 存在 PG 兼容模式，但迁移时必须把“数据库本身支持 PG 模式”和“迁移工具当前支持什么目标链路”分开看。

UGO 文档曾明确说明 PostgreSQL→GaussDB 的自动转换方案默认基于 Oracle 兼容模式，并提示 UGO 不支持直接迁到 GaussDB PG 兼容模式。这个限制可能随版本变化，因此每次迁移都要按当前 UGO 版本重新确认。

PostgreSQL 项目重点检查：

- Extension；
- `jsonb`；
- ARRAY；
- Function；
- Operator / Cast；
- Sequence；
- `RETURNING`；
- `ON CONFLICT`；
- 系统目录；
- FDW；
- 逻辑复制。

## 分布式版特别注意

### 分布键

分布式 GaussDB 的性能高度依赖数据分布。大表要重点设计：

- 分布键是否高基数；
- 是否能让常见 Join 共定位；
- 是否存在数据倾斜；
- 是否导致大量跨节点数据重分布。

如果把低基数字段作为分布键，容易造成某些节点数据量远高于其他节点。

### 数据倾斜

迁移前应对候选分布键做分布统计，例如：

```sql
SELECT dist_key, COUNT(*)
FROM your_table
GROUP BY dist_key
ORDER BY COUNT(*) DESC;
```

重点看 Top 值占比，而不是只看 distinct 数量。

## SQL 调优

GaussDB 官方 SQL 调优流程非常明确：

1. 先收集统计信息；
2. 查看执行计划；
3. 审视表定义；
4. 定位具体慢点；
5. 必要时重写 SQL。

### 更新统计信息

```sql
ANALYZE your_table;
```

大量 INSERT/DELETE 后应主动更新统计信息。对于多个列高度相关的查询，可评估多列统计信息。

### 执行计划

```sql
EXPLAIN
SELECT ...;
```

可以实际执行时优先：

```sql
EXPLAIN ANALYZE
SELECT ...;
```

部分 GaussDB 版本还支持：

```sql
EXPLAIN PERFORMANCE
SELECT ...;
```

重点关注：

- 估算行数 vs 实际行数；
- Seq Scan / Index Scan；
- Join 顺序与算法；
- 分区裁剪；
- 数据重分布；
- Node 间网络传输；
- Sort / Hash 内存；
- 并行度；
- 数据倾斜。

### 索引

迁移后重新验证：

- 高频过滤列；
- Join 键；
- 联合索引列顺序；
- 局部/分区索引；
- 是否存在冗余索引；
- 索引是否会放大分布式写入成本。

### SQL 改写

对于大表 Join 和复杂聚合，尽量：

- 先过滤再 Join；
- 避免函数包裹索引列；
- 减少隐式类型转换；
- 减少无意义排序；
- 避免过大的中间结果；
- 让 Join 条件尽可能与分布策略协同。

## 个性化语法与运维概念

### `DBCOMPATIBILITY`

这是迁移项目里最关键的建库属性之一：

```sql
CREATE DATABASE appdb DBCOMPATIBILITY = 'A';
```

兼容模式会直接影响 SQL、类型、函数和过程语言行为。

### GUC 参数

GaussDB 大量行为通过 GUC 参数控制。迁移项目需要保留一份明确的参数基线：

```text
参数名
测试环境值
生产环境值
是否动态生效
影响的兼容行为
修改理由
```

不要只在会话里临时 `SET` 成功就认为迁移完成。

## 常见迁移坑

### 忽略集中式与分布式差异

同一个“GaussDB”名字下，不同产品形态的 SQL、兼容模式、分布机制和性能特征并不完全一样。所有文档和测试必须标版本与产品形态。

### 选了 MySQL B 模式

官方已说明 B 模式兼容能力受架构限制且后续不再重点演进。新项目应优先核验 M-Compatibility。

### PG 源库直接假设迁 PG 模式

数据库支持 PG 模式，不等于当前迁移工具支持 PG→PG 模式自动转换。UGO 链路必须单独确认。

### 分布键只按“均匀”选择

好的分布键不仅要均匀，还要尽量减少常见 Join 的跨节点数据移动。

## 推荐迁移验证清单

- [ ] 确认集中式 / 分布式版本；
- [ ] 确认 `DBCOMPATIBILITY`；
- [ ] 确认 UGO 当前支持的源/目标链路；
- [ ] 输出 Oracle / MySQL / PostgreSQL 不兼容对象；
- [ ] 冻结 GUC 参数基线；
- [ ] 设计分布键并检查倾斜；
- [ ] 做全量、分桶和 Hash 校验；
- [ ] 更新统计信息后回归 Top SQL；
- [ ] 检查跨节点数据移动；
- [ ] 比较源库 P95/P99 和批处理窗口；
- [ ] 验证 HA、备份恢复和回切。

## 官方资料

- 产品兼容性说明：https://support.huaweicloud.com/productdesc-gaussdb/gaussdb_01_699.html
- 分布式兼容模式：https://support.huaweicloud.com/intl/zh-cn/distributed-ref-v10-gaussdb/gaussdb-08-0505.html
- MySQL M-Compatibility：https://support.huaweicloud.com/intl/zh-cn/distributed-ref-v10-gaussdb/gaussdb-08-0543.html
- UGO Oracle 兼容模式：https://support.huaweicloud.com/usermanual-ugo/ugo_conv_01_0002.html
- UGO 兼容类型 FAQ：https://support.huaweicloud.com/intl/zh-cn/ugo_faq/ugo_04_0037.html
- SQL 调优流程：https://support.huaweicloud.com/intl/zh-cn/centralized-tngg-v10-gaussdb/gaussdb-54-0054.html
- 统计信息：https://support.huaweicloud.com/distributed-tngg-v10-gaussdb/gaussdb-24-0058.html
