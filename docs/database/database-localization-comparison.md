# 数据库国产化迁移对比

> 目标：用于 MySQL、PostgreSQL、Oracle 等主流数据库向国产数据库迁移时做第一轮选型、兼容性评估和改造量预判。本文中的“高/中/低”是工程经验级别的迁移适配判断，不代表厂商承诺的百分比兼容率；最终必须以目标版本、兼容模式、迁移评估工具和业务 SQL 实测为准。

## 一眼看懂：源库到目标库

| 目标数据库 | MySQL 迁移 | PostgreSQL 迁移 | Oracle 迁移 | 最适合的典型场景 |
| --- | --- | --- | --- | --- |
| OceanBase | **高**：MySQL 模式兼容 5.7/8.0 大部分能力 | **中低**：需要向 MySQL/Oracle 语义转换 | **高**：企业版 Oracle 模式重点兼容 | 高并发 OLTP、分布式事务、MySQL/Oracle 国产化 |
| TiDB | **高**：协议和常用 SQL 高度兼容 | **低**：不是 PG 兼容路线 | **低**：通常需要较大 SQL/对象改造 | MySQL 水平扩展、HTAP、在线扩容 |
| KingbaseES | **高~中高**：提供 MySQL 兼容模式 | **高**：提供 PostgreSQL 兼容模式 | **高**：大量 Oracle 数据类型、SQL、PL/SQL 兼容 | 传统关系库替代、存储过程较多、政企国产化 |
| 达梦 DM8 | **中**：提供 MySQL 兼容参数，但语法差异仍需评估 | **中低**：提供部分 PostgreSQL 兼容 | **高**：Oracle 是重点迁移路径之一 | Oracle 国产替代、集中式核心业务、传统应用改造 |
| GaussDB | **高~中高**：提供 MySQL 兼容模式 | **中高**：存在 PG 兼容模式，但迁移工具链要按版本确认 | **高**：提供 Oracle 兼容模式 | 金融级分布式/集中式数据库、Oracle/MySQL 国产化 |
| openGauss | **中**：存在 B 类兼容行为，需逐项验证 | **高**：PG 协议/API 与 PG 迁移路径较自然 | **中高**：A 类兼容模式覆盖部分 Oracle 语法 | PostgreSQL 技术栈国产化、开源自主可控 |

### 推荐先按源库分类

**MySQL → 国产库**

1. 首先看 TiDB、OceanBase MySQL 模式：应用驱动、协议和 SQL 改造通常较少。
2. 如果组织已经统一 KingbaseES / GaussDB，也可以走其 MySQL 兼容模式，但要重点验证存储过程、触发器、字符集、JSON、隐式转换和执行计划差异。
3. DM8 可以迁移 MySQL，但官方文档也明确提示部分语法、系统包、函数和存储过程需要改写，因此不应只因为“有兼容模式”就判断为低改造。

**PostgreSQL → 国产库**

1. 首先看 openGauss、KingbaseES PostgreSQL 兼容模式。
2. GaussDB 具备 PG 兼容能力，但官方 UGO 的具体迁移链路可能并不直接迁移到 PG 模式，需要按产品形态和版本核实。
3. OceanBase / TiDB 不是 PostgreSQL 方言路线，迁移时应按异构数据库处理。

**Oracle → 国产库**

1. OceanBase Oracle 模式、KingbaseES、DM8、GaussDB 都属于重点候选。
2. 选型时不要只比较普通 SQL，要重点盘点：PL/SQL、Package、DBLink、同义词、物化视图、序列、触发器、自治事务、Oracle 系统视图、高级包和 Hint。
3. Oracle 项目真正的改造成本往往集中在数据库对象和过程化代码，而不是简单 CRUD。

## 核心架构差异

| 数据库 | 架构侧重点 | 迁移时最容易低估的问题 |
| --- | --- | --- |
| MySQL | 单机/主从、InnoDB 生态 | 分库分表逻辑、大小写、字符集、事务隔离、存储过程 |
| PostgreSQL | 标准 SQL、丰富类型与扩展、MVCC | Extension、数组/JSONB、函数、Operator、序列与 Schema 语义 |
| Oracle | 强企业能力、PL/SQL、复杂对象 | Package、Hint、DBLink、系统视图、NLS、空串=NULL 等行为 |
| OceanBase | 原生分布式、租户、MySQL/Oracle 双兼容模式 | 租户模式不可后改、分区/分布式执行、热点、全局/局部访问路径 |
| TiDB | TiDB + TiKV + PD，TiFlash 可做 MPP | 分布式事务成本、热点、主键设计、部分 MySQL 特性不支持 |
| KingbaseES | 多兼容模式、传统企业数据库能力 | 兼容模式差异、Oracle/MySQL 特性并非逐项完全等价 |
| DM8 | 集中式能力成熟，也提供多种部署形态 | COMPATIBLE_MODE 是行为开关但不是“完全变成源库” |
| GaussDB | 集中式/分布式产品形态、多个兼容模式 | 集中式与分布式语法/特性不同，分布键和数据倾斜 |
| openGauss | PG 协议生态、A/B/PG 等兼容行为、企业级增强 | 与 PostgreSQL 的版本/扩展差异、兼容模式和工具版本差异 |

## 迁移兼容性必须分 8 层看

不要只执行几十条 SQL 就下结论。至少拆成以下层次：

1. **连接协议与驱动**：JDBC/ODBC、连接串、连接池、SSL、认证方式。
2. **数据类型**：NUMBER/DECIMAL、DATE/TIMESTAMP、JSON、LOB、RAW/BYTEA、ENUM、数组。
3. **DDL**：表、索引、分区、约束、默认值、自增、生成列。
4. **DML/DQL**：分页、UPSERT、MERGE、多表 UPDATE/DELETE、递归查询、窗口函数。
5. **函数与表达式**：日期函数、字符串函数、NULL 语义、隐式类型转换、正则。
6. **过程对象**：Procedure、Function、Package、Trigger、Cursor、异常处理、动态 SQL。
7. **系统能力**：权限、系统视图、DBLink、同义词、物化视图、备份恢复、CDC。
8. **性能语义**：执行计划、统计信息、索引模型、分区裁剪、并行度、分布式数据移动。

## 国产化迁移项目的推荐流程

```text
资产盘点
  ↓
SQL / 对象采集
  ↓
兼容性评估
  ↓
目标兼容模式确定
  ↓
Schema / DDL 转换
  ↓
全量数据迁移
  ↓
增量同步 / CDC
  ↓
应用改造
  ↓
数据校验
  ↓
性能基线与调优
  ↓
双跑 / 灰度切换
  ↓
回切预案验证
```

### 资产盘点至少要输出

- 数据库版本、字符集、时区、排序规则；
- Schema / Table / View / Index / Sequence；
- Procedure / Function / Package / Trigger；
- DBLink / Synonym / Materialized View；
- Top SQL、慢 SQL、峰值 TPS/QPS、并发连接数；
- 最大表、日增量、LOB 占比；
- 依赖数据库特性的应用代码位置；
- 上下游同步、ETL、CDC、报表和备份链路。

## 数据校验不要只做 COUNT

建议至少做四层：

| 层级 | 校验方式 | 用途 |
| --- | --- | --- |
| 表级 | COUNT、MIN/MAX、SUM | 快速判断是否明显缺数 |
| 分桶 | 按日期/主键范围 GROUP BY | 定位缺失区间 |
| 行级 | 主键 + 规范化 Hash | 精确找差异 |
| 业务级 | 核心报表、余额、状态流转 | 防止“数据一致但业务语义不一致” |

跨数据库做 Hash 时必须先统一 NULL、日期格式、数值精度、字符编码和字段拼接方式，否则很容易产生伪差异。

## 性能迁移的基本原则

**不要照搬源库执行计划。** 同一条 SQL 在集中式、MPP、Shared-Nothing、分布式 KV 架构中的最优执行方式可能完全不同。

优先检查：

- 统计信息是否准确；
- 过滤条件是否可下推；
- 是否发生隐式类型转换；
- 索引是否适配新数据库；
- 分区是否有效裁剪；
- 分布键是否导致数据倾斜；
- 大表 Join 是否产生跨节点数据移动；
- 热点主键/热点分区是否集中到单节点；
- 内存不足是否导致排序/Hash 落盘；
- Hint 是否仍有必要，是否属于源数据库遗留。

## 迁移选型时最容易踩的坑

### “兼容 MySQL/Oracle” ≠ “就是 MySQL/Oracle”

兼容模式解决的是迁移成本，不意味着底层存储、锁、优化器、执行计划、系统表和运维方式完全一致。

### 把社区版与企业版能力混为一谈

例如 OceanBase 社区版只提供 MySQL 模式；Oracle 模式属于企业能力范围。部署前必须确认你实际采购/使用的版本。

### 忽略兼容模式不可随意修改

OceanBase 的租户兼容模式创建后不能修改；GaussDB、KingbaseES、DM8、openGauss 的兼容配置也会影响语义。兼容模式应该在 Schema 转换之前确定，而不是上线前再切。

### 只验证功能，不验证性能

迁移后 SQL 能跑通只是第一步。国产化验收至少要保留源库基线，比较 P95/P99 延迟、批处理窗口、CPU/IO、锁等待、临时空间和峰值并发。

## 本 Wiki 的数据库文档

- [OceanBase](./oceanbase)
- [TiDB](./tidb)
- [KingbaseES](./kingbasees)
- [达梦 DM8](./dm8)
- [GaussDB](./gaussdb)
- [openGauss](./opengauss)
- [TiDB / MySQL 数据校验](./tidb-mysql-validation)
- [Greenplum 元数据与权限](./greenplum)

## 官方资料

- OceanBase 兼容模式：https://www.oceanbase.com/docs/common-oceanbase-database-cn-1000000001429200
- TiDB MySQL 兼容性：https://docs.pingcap.com/tidb/stable/mysql-compatibility/
- KingbaseES 迁移概述：https://help.kingbase.com.cn/v9.4.12/development/application-develop-guide/data_migration/migration_overview.html
- 达梦 Oracle 迁移：https://eco.dameng.com/document/dm/zh-cn/start/oracle_dm
- GaussDB 兼容性：https://support.huaweicloud.com/intl/zh-cn/distributed-ref-v10-gaussdb/gaussdb-08-0505.html
- openGauss PostgreSQL 迁移：https://docs.opengauss.org/zh/docs/latest/datakit/datakit_postgresql_migration.html
