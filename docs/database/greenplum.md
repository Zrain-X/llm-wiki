# Greenplum 元数据与权限速查

## 常见系统 Schema

- `pg_catalog`：核心系统目录；
- `information_schema`：标准化表、字段、权限视图；
- `gp_toolkit`：Greenplum 运维诊断；
- `pg_toast`：大字段 TOAST 存储；
- `pg_aoseg`：AO/AOCS 内部元数据。

一般原则：系统目录可以查，不要直接修改。

## 查对象

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

## 表大小

```sql
SELECT
    pg_size_pretty(pg_relation_size('schema.table')) AS table_size,
    pg_size_pretty(pg_total_relation_size('schema.table')) AS total_size;
```

批量采集时至少限制业务 Schema 和真实表对象，不要对整个 `pg_class` 无差别调用大小函数。

## 权限

```sql
SELECT grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'schema_name'
  AND table_name = 'table_name';
```

角色：

```sql
SELECT rolname, rolsuper, rolcreaterole, rolcreatedb
FROM pg_roles
ORDER BY rolname;
```

## 当前执行 SQL

```sql
SELECT pid, usename, datname, state, query_start, query
FROM pg_stat_activity
WHERE state <> 'idle'
ORDER BY query_start;
```

遇到 `canceling statement due to user request`，除了人工取消，还要检查资源组/资源队列、WLM、超时与外部调度器。

## 外表

外表权限不要机械照搬普通表或自定义协议的授权方式。排查时同时看 Greenplum 版本、协议类型、角色权限、外部服务可达性和网络策略。
