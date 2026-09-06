# TiDB / MySQL 数据校验速查

用于跨库迁移、ETL 对账、全字段 Hash 校验。重点不是“有没有 MD5”，而是**同一条记录在两边是否被规范化成完全相同的字节序列**。

## 单字段 MD5

```sql
SELECT MD5('hello');
```

TiDB 大体兼容 MySQL，但具体函数支持仍应以当前 TiDB 版本为准。

## 多字段拼接校验

最简单：

```sql
SELECT MD5(CONCAT_WS('|', col1, col2, col3))
FROM t;
```

问题是 `NULL`、分隔符和数据类型格式都可能让结果不稳定。

## NULL 一定要显式归一化

```sql
SELECT MD5(
  CONCAT_WS('|',
    COALESCE(CAST(col1 AS CHAR), '<NULL>'),
    COALESCE(CAST(col2 AS CHAR), '<NULL>'),
    COALESCE(CAST(col3 AS CHAR), '<NULL>')
  )
)
FROM t;
```

不要把空字符串 `''` 和 `NULL` 归成同一个值，除非业务上确认它们等价。

## 防止拼接歧义

下面两组数据：

```text
('ab', 'c')
('a', 'bc')
```

如果直接拼接都会变成 `abc`。

更稳妥的是分隔符 + 长度前缀：

```sql
SELECT MD5(CONCAT(
  LENGTH(COALESCE(CAST(col1 AS CHAR), '<NULL>')), ':', COALESCE(CAST(col1 AS CHAR), '<NULL>'), '|',
  LENGTH(COALESCE(CAST(col2 AS CHAR), '<NULL>')), ':', COALESCE(CAST(col2 AS CHAR), '<NULL>')
))
FROM t;
```

## 日期、时间必须固定格式

```sql
DATE_FORMAT(dt_col, '%Y-%m-%d %H:%i:%s')
```

如果包含微秒，则两边都要统一微秒精度。

## DECIMAL / 浮点数

跨数据库最容易出问题的是：

- 尾部 0；
- 科学计数法；
- 浮点误差；
- 精度/Scale 不一致。

金额类优先统一为 `DECIMAL` 后再转字符，不要直接对 `FLOAT/DOUBLE` 的显示文本做 Hash。

## 字符串

需要确认：

- 字符集；
- Collation；
- 前后空格是否保留；
- `CHAR` 补空格行为；
- 换行符 `\n` / `\r\n`；
- Unicode 规范化。

## 两级校验思路

大量数据不要一上来逐行拉回客户端。

先做分桶汇总：

```sql
SELECT
  MOD(id, 100) AS bucket_id,
  COUNT(*) AS cnt,
  SUM(CRC32(row_string)) AS checksum
FROM ...
GROUP BY MOD(id, 100);
```

发现不一致的桶，再进入逐行 MD5 比较。

注意：`SUM(CRC32(...))` 只适合快速定位差异，不应视为严格密码学证明。

## 推荐模板

真正做跨库校验前，先为每种字段类型写一套统一序列化规则：

```text
NULL      -> <NULL>
DATE      -> YYYY-MM-DD
DATETIME  -> YYYY-MM-DD HH:mm:ss.SSSSSS
DECIMAL   -> 固定 scale
TEXT      -> 原文，不自动 trim
BOOLEAN   -> 0/1
```

只要“序列化协议”固定下来，MD5/SHA 本身反而是最简单的一步。
