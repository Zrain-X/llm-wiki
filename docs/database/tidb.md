# TiDB：MySQL 国产化迁移与分布式调优

TiDB 是面向 MySQL 生态的分布式关系数据库。迁移时最大的优势是 **MySQL 协议和常用 SQL 高度兼容**，最大的变化则是底层从单机 InnoDB 变成分布式计算与存储，因此“SQL 能跑”不等于“性能无需重新设计”。

## 核心架构

典型 TiDB 集群包括：

- **TiDB Server**：无状态 SQL 层，负责协议、解析、优化和执行；
- **PD**：集群元数据和调度中心；
- **TiKV**：分布式事务型 KV 存储；
- **TiFlash**：列式副本，可承载分析查询和 MPP；
- **TiCDC / DM**：增量同步与 MySQL/MariaDB 迁移工具链。

这意味着应用仍然可以“像连 MySQL 一样连接 TiDB”，但事务、热点、执行计划和数据分布已经是分布式数据库问题。

## 适合从哪里迁移

| 源数据库 | 适配判断 | 说明 |
| --- | --- | --- |
| MySQL 5.7 / 8.0 | **高** | 协议和常用 SQL 高度兼容，是最自然的迁移路径 |
| MariaDB | 高 | 可通过 DM 等工具迁移，仍需核验 MariaDB 专有功能 |
| PostgreSQL | 低 | 方言与生态不同，按异构迁移处理 |
| Oracle | 低 | 过程对象与 Oracle 特性需要大量转换 |

## MySQL 兼容性要怎么理解

TiDB 官方明确说明：TiDB 高度兼容 MySQL 协议以及 MySQL 5.7/8.0 的常用功能和语法，MySQL 客户端和大量生态工具可以直接使用。

但部分 MySQL 能力没有实现，原因包括分布式架构差异、需求较低或 TiDB 已有替代机制。因此迁移前必须针对业务使用的特性做清单式核验。

重点检查：

- 存储过程/函数等服务端过程能力；
- Trigger / Event 等数据库侧逻辑；
- MySQL replication protocol 依赖；
- 外键及约束行为；
- `sql_mode`；
- 字符集与排序规则；
- 自增主键写热点；
- 分区表；
- JSON / GIS / 全文检索等扩展能力；
- `information_schema` / `performance_schema` 依赖。

## MySQL → TiDB 推荐迁移路径

### DM：TiDB Data Migration

适合 MySQL / MariaDB → TiDB 的全量 + 增量迁移。迁移项目里通常会拆成：

1. Schema 检查与转换；
2. 全量导入；
3. Binlog 增量同步；
4. 数据校验；
5. 应用切流。

如果业务原来有多个 MySQL 分库分表，TiDB 常见目标是把逻辑重新收敛到一个分布式逻辑库中，而不是机械保留所有分片。

## TiDB 个性化语法与能力

### `AUTO_RANDOM`

如果业务使用单调递增整数主键并出现写热点，可以评估 `AUTO_RANDOM`，让主键高位包含随机位，降低连续主键集中写入单 Region 的风险。

示意：

```sql
CREATE TABLE orders (
  id BIGINT PRIMARY KEY AUTO_RANDOM,
  user_id BIGINT,
  created_at DATETIME
);
```

注意：`AUTO_RANDOM` 会改变 ID 的连续性和可预测性，依赖“自增值连续”的业务不能直接切换。

### 聚簇主键

TiDB 支持聚簇主键概念。主键设计会直接影响底层 Key 编码、数据局部性和热点，因此迁移时不要只从 MySQL B+Tree 角度理解主键。

### TiFlash / MPP

分析型查询可以通过 TiFlash 列存副本执行，复杂聚合和大表 Join 可进入 MPP 模式。适合 HTAP，但不能因为“有 TiFlash”就忽略数据同步延迟、资源隔离和查询路由。

## SQL 调优

### 从 `EXPLAIN ANALYZE` 开始

```sql
EXPLAIN ANALYZE
SELECT ...;
```

TiDB 的 `EXPLAIN ANALYZE` 会实际执行 SQL，并提供：

- `estRows`：优化器估算行数；
- `actRows`：实际行数；
- `execution info`：实际时间与 loops；
- `memory`：算子内存；
- `disk`：落盘情况。

如果 `estRows` 和 `actRows` 差距非常大，第一反应应是检查统计信息和数据倾斜，而不是马上强制 Hint。

### 统计信息

```sql
ANALYZE TABLE your_table;
```

TiDB 支持针对表、索引和部分列收集统计信息。超宽表可以关注 Predicate Columns，避免为大量从未参与过滤/Join/排序的列无意义地收集高成本统计。

### 索引

迁移后重点重新检查：

- 联合索引列顺序；
- 覆盖索引；
- 选择性很低的索引；
- 冗余索引；
- 是否能用 Index Advisor 辅助分析；
- DML 成本是否因为索引过多而显著增加。

### 热点

TiDB 特别需要关注“单机 MySQL 时代不明显”的热点问题：

- 连续自增主键；
- 时间戳作为首列；
- 所有写入集中到最新分区；
- 单个账户/租户成为超热点 Key；
- 小范围 Region 被高并发反复更新。

出现热点时，应结合主键编码、分区、业务 Key 设计和 PD 调度共同分析。

### TiKV 与 TiFlash 选择

- 高频点查、小范围事务：通常以 TiKV 为主；
- 大扫描、聚合、复杂分析：评估 TiFlash；
- 混合负载：注意 OLTP 与分析任务的资源竞争。

## 分布式事务需要重新评估

在 MySQL 中成本很低的事务，迁移到 TiDB 后如果跨多个 Region、包含大量行或长期持锁，成本会明显放大。

重点避免：

- 超大事务；
- 一次更新几十万/几百万行；
- 长事务长时间不提交；
- 事务中混入大量外部 RPC；
- 热点行高并发更新。

批量作业应采用合理 batch 拆分。

## 常见迁移坑

### 把 TiDB 当 MySQL 主从替代

TiDB 不是简单的 MySQL Server + 多副本 InnoDB。它的复制、调度、事务和存储模型都不同。

### 继续保留应用层分库分表

有些系统迁移后依旧保留 ShardingSphere/MyCat 等分片逻辑，导致“应用层分片 + TiDB 分布式”双重复杂度。除非有明确原因，应评估是否可以简化。

### 只看平均延迟

分布式系统更应看 P95/P99、跨 Region 访问、热点、Backoff、RPC 时间和存储层延迟。

### 忽略统计信息

TiDB 优化器高度依赖统计信息。估算失真会进一步影响 Join 顺序、访问路径和 TiFlash/TiKV 选择。

## 推荐迁移验证清单

- [ ] 扫描 MySQL 不兼容特性；
- [ ] 确认字符集、排序规则、`sql_mode`；
- [ ] 评估自增主键热点；
- [ ] 确认是否取消原分库分表；
- [ ] 使用 DM 做全量/增量迁移 PoC；
- [ ] 执行行数/分桶/Hash 数据校验；
- [ ] 回归 Top SQL 并比较 `estRows` / `actRows`；
- [ ] 检查大事务和长事务；
- [ ] 检查热点 Region / Hot Key；
- [ ] 对分析 SQL 评估 TiFlash / MPP；
- [ ] 验证备份恢复、TiCDC 和回切链路。

## 官方资料

- MySQL 兼容性：https://docs.pingcap.com/tidb/stable/mysql-compatibility/
- SQL 性能调优：https://docs.pingcap.com/zh/tidb/stable/sql-tuning-overview/
- EXPLAIN ANALYZE：https://docs.pingcap.com/zh/tidb/stable/sql-statement-explain-analyze/
- 统计信息：https://docs.pingcap.com/zh/tidb/stable/statistics/
- MPP 执行计划：https://docs.pingcap.com/zh/tidb/stable/explain-mpp/
