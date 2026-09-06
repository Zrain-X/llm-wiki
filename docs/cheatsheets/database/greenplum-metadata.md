# Greenplum 元数据与权限速查

Greenplum 基于 PostgreSQL，但多了 MPP、Segment、AO/AOCS 等机制。查系统表时要分清“PostgreSQL 通用目录”和“Greenplum 特有目录”。

## 常见系统 Schema

### `pg_catalog`

PostgreSQL / Greenplum 的核心系统目录，常见对象：

- `pg_class`：表、索引、视图等关系对象；
- `pg_namespace`：Schema；
- `pg_attribute`：字段；
- `pg_type`：类型；
- `pg_roles`：角色；
- `pg_proc`：函数；
- `pg_stat_activity`：会话与 SQL。

一般原则：**可以查，不要直接改系统表。**

### `information_schema`

标准化程度更高，适合查：

- 表；
- 字段；
- 视图；
- 权限。

例如：

```sql
SELECT table_schema, table_name, privilege_type, grantee
FROM information_schema.table_privileges
WHERE table_schema = 'public';
```

### `gp_toolkit`

Greenplum 提供的运维诊断视图集合，适合查分布、膨胀、倾斜、资源与系统状态。

### `pg_toast`

PostgreSQL 大字段 TOAST 存储相关对象。一般只用于诊断，不把它当业务表操作。

### `pg_aoseg`

Append-Optimized 表相关内部元数据。分析 AO/AOCS 存储问题时会用到，但不要手工修改。

## 查对象类型

```sql
SELECT
    c.oid,
    n.nspname AS schema_name,
    c.relname,
    c.relkind
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY 2, 3;
```

常见 `relkind` 需要结合具体 Greenplum / PostgreSQL 版本理解，不要只凭一个字母做危险操作。

## 表大小

常用函数：

```sql
SELECT
    pg_size_pretty(pg_relation_size('schema.table')) AS table_size,
    pg_size_pretty(pg_total_relation_size('schema.table')) AS total_size;
```

批量采集时不要对整个 `pg_class` 不加过滤地调用大小函数。建议至少限制业务 Schema 和真实表对象，避免无意义扫描系统对象。

示例：

```sql
SELECT
    n.nspname,
    c.relname,
    pg_total_relation_size(c.oid) AS bytes
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY bytes DESC;
```

Greenplum 是 MPP 数据库，最终容量含义还需要结合表类型、Segment 分布和版本实现确认。

## 看 ACL / 权限

系统目录中的 `relacl` 是底层 ACL 表示，适合诊断；日常查权限更推荐先用 `information_schema`。

```sql
SELECT grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'schema_name'
  AND table_name = 'table_name';
```

查看角色：

```sql
SELECT rolname, rolsuper, rolcreaterole, rolcreatedb
FROM pg_roles
ORDER BY rolname;
```

## 外表权限的一个常见坑

Greenplum 外表权限与普通表不完全一样。对于内置协议（例如常见的 `gpfdist` / `gpfdists`），不要想当然地照搬自定义协议的 `GRANT ... ON PROTOCOL` 写法。

排查外表创建权限时要同时看：

- Greenplum 版本；
- 协议类型；
- 角色是否具备外表创建相关权限；
- 外部数据源本身是否可达；
- OS / 网络 / 防火墙是否允许访问。

## 当前会话和正在执行的 SQL

```sql
SELECT
    pid,
    usename,
    datname,
    state,
    query_start,
    query
FROM pg_stat_activity
WHERE state <> 'idle'
ORDER BY query_start;
```

遇到 `canceling statement due to user request` 时，不要只理解成“有人手工取消”。在 Greenplum 环境还要继续检查资源队列/资源组、WLM 规则、超时配置以及外部调度器。

## 排查顺序

元数据采集异常时建议按这个顺序：

1. 确认对象类型；
2. 排除系统 Schema；
3. 缩小到单个对象验证函数；
4. 检查权限；
5. 检查资源/WLM 是否中止查询；
6. 再做批量采集。
