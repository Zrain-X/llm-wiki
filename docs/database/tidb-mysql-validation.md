# TiDB / MySQL 数据校验

关键不是单纯“有没有 MD5”，而是两边是否把同一条记录序列化成完全一致的字符串。

## 基础 Hash

```sql
SELECT MD5('hello');
```

```sql
SELECT MD5(CONCAT_WS('|', col1, col2, col3))
FROM t;
```

## NULL 显式归一化

```sql
SELECT MD5(
  CONCAT_WS('|',
    COALESCE(CAST(col1 AS CHAR), '<NULL>'),
    COALESCE(CAST(col2 AS CHAR), '<NULL>')
  )
)
FROM t;
```

不要默认把空字符串和 `NULL` 视为同一个值。

## 防止拼接歧义

使用分隔符，严格场景再加长度前缀。

## 日期与数值

日期固定格式；DECIMAL 固定 scale；不要直接对浮点数显示文本做严格 Hash。

## 字符串需要确认

字符集、Collation、前后空格、`CHAR` 补空格、换行符和 Unicode 规范化。

## 大表分级校验

先分桶汇总定位差异，再逐行 Hash。`SUM(CRC32(...))` 可以用于快速定位，但不应视为严格证明。

推荐先定义统一序列化协议：

```text
NULL      -> <NULL>
DATE      -> YYYY-MM-DD
DATETIME  -> YYYY-MM-DD HH:mm:ss.SSSSSS
DECIMAL   -> 固定 scale
TEXT      -> 原文，不自动 trim
BOOLEAN   -> 0/1
```
