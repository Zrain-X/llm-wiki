# OceanBase SQL 速查

## 先确认兼容模式

```sql
SHOW VARIABLES LIKE 'ob_compatibility_mode';
```

很多函数和语法差异，本质上是 MySQL 模式与 Oracle 模式混用。

## 当前月第一天

MySQL 模式：

```sql
SELECT CAST(DATE_FORMAT(CURRENT_DATE, '%Y-%m-01') AS DATE);
```

Oracle 模式：

```sql
SELECT TRUNC(SYSDATE, 'MM') FROM dual;
```

## 整除

```sql
SELECT 10 DIV 3;
```

如果业务语义明确是向下取整：

```sql
SELECT FLOOR(10 / 3);
```

涉及负数时注意截断与向下取整的差异。

## 常用日期计算

```sql
SELECT DATE_ADD(CURRENT_DATE, INTERVAL 1 DAY);
SELECT DATE_SUB(CURRENT_DATE, INTERVAL 1 MONTH);
SELECT DATEDIFF('2026-09-06', '2026-09-01');
```

## `SELECT *` 排除少数字段

不依赖其他数据库方言，直接从元数据生成字段清单：

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

## 表结构与建表语句

```sql
DESC your_table;
SHOW CREATE TABLE your_table;
```

## 执行计划

```sql
EXPLAIN
SELECT ...;
```

优先看索引、扫描行数、Join 顺序、隐式类型转换和过滤条件下推。

## 权限

```sql
SHOW GRANTS FOR 'user_name';
```

涉及视图和存储过程时，还要检查依赖对象、定义者/调用者语义以及对象重建后的授权状态。

## 排查顺序

1. 兼容模式；
2. OceanBase 版本；
3. 函数及参数类型；
4. 隐式类型转换；
5. 最小 SQL 单独验证；
6. 再回完整 SQL。
