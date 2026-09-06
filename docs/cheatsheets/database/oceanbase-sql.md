# OceanBase SQL 速查

主要用于快速回忆 OceanBase MySQL / Oracle 兼容模式下常见写法。遇到语法差异时，第一步先确认兼容模式。

## 先确认兼容模式

MySQL 模式常用：

```sql
SHOW VARIABLES LIKE 'ob_compatibility_mode';
```

很多“为什么这个函数不能用”的问题，本质上都是把 MySQL 模式和 Oracle 模式的语法混用了。

## 当前月第一天

### MySQL 模式

```sql
SELECT CAST(DATE_FORMAT(CURRENT_DATE, '%Y-%m-01') AS DATE);
```

如果只是用于字符串比较，也可以直接：

```sql
SELECT DATE_FORMAT(CURRENT_DATE, '%Y-%m-01');
```

### Oracle 模式

```sql
SELECT TRUNC(SYSDATE, 'MM') FROM dual;
```

## 整除

MySQL 模式可以直接使用 `DIV`：

```sql
SELECT 10 DIV 3;
-- 3
```

如果业务语义实际上是“向下取整”，也可以显式写：

```sql
SELECT FLOOR(10 / 3);
```

注意：负数场景下“截断”和“向下取整”不是同一概念，涉及负数时不要机械互换。

## 常用日期计算

### MySQL 模式

```sql
-- 加 1 天
SELECT DATE_ADD(CURRENT_DATE, INTERVAL 1 DAY);

-- 减 1 个月
SELECT DATE_SUB(CURRENT_DATE, INTERVAL 1 MONTH);

-- 两日期相差天数
SELECT DATEDIFF('2026-09-06', '2026-09-01');
```

### Oracle 模式

```sql
-- 加一个月
SELECT ADD_MONTHS(SYSDATE, 1) FROM dual;

-- 当月最后一天
SELECT LAST_DAY(SYSDATE) FROM dual;
```

## `SELECT *` 排除某几个字段

OceanBase 日常使用里不要依赖 `SELECT * EXCEPT (...)` 这类其他数据库方言。更稳妥的办法是从元数据生成字段清单。

MySQL 模式示例：

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

把结果复制到最终 SQL：

```sql
SELECT id, name, created_at
FROM your_table;
```

字段很多时注意 `GROUP_CONCAT` 长度限制。

## 查看表结构与建表语句

```sql
DESC your_table;
```

```sql
SHOW CREATE TABLE your_table;
```

## 执行计划

```sql
EXPLAIN
SELECT ...;
```

排查慢 SQL 时优先关注：

- 是否走了预期索引；
- 扫描行数是否异常；
- Join 顺序是否合理；
- 是否因为隐式类型转换导致索引失效；
- 过滤条件是否能尽早下推。

## 权限快速检查

MySQL 模式：

```sql
SHOW GRANTS FOR 'user_name';
```

如果涉及视图、存储过程或跨库访问，除了调用对象自身权限，还要检查其依赖对象、定义者/调用者语义以及对象重建后的授权状态。

## 常见排查顺序

当 SQL 在 MySQL 能跑、OceanBase 不能跑时：

1. 确认 OceanBase 兼容模式；
2. 确认 OceanBase 版本；
3. 检查函数名和参数类型；
4. 检查隐式类型转换；
5. 用最小 SQL 单独验证函数；
6. 再回到完整 SQL。
