# awk：把文本看成“记录与字段”的流式处理语言

很多人第一次接触 `awk`，会把它记成“取第几列”的命令：

```bash
awk '{print $1}' access.log
```

这当然是 awk 最常见的用法，但如果只把它理解成列截取工具，就会错过它真正的价值。awk 更准确的定位是：**面向结构化文本流的小型编程语言。**

它特别适合处理“每一行是一条记录、每条记录里又有若干字段”的数据，例如日志、命令输出、空格分隔文件、简单 CSV、配置清单和运维统计结果。

## awk 在解决什么问题

Shell 管道擅长把多个工具连接起来，但当一条处理逻辑开始出现下面这些需求时，单纯拼 `cut | grep | sort | sed` 往往会越来越难读：

- 根据某一列判断是否保留当前行；
- 同时计算多列；
- 对某个字段求和、计数、平均值；
- 按条件分类统计；
- 输出重新组织后的文本；
- 处理第一行、最后一行或整份文件汇总结果。

awk 正好处于“单条命令”和“完整 Python 脚本”之间。

它的基本思想可以概括成：

```text
输入文本
   ↓
一行一行读取（Record）
   ↓
每行拆成字段（Field）
   ↓
匹配条件（Pattern）
   ↓
执行动作（Action）
```

最经典的形式是：

```bash
awk '条件 { 动作 }' file
```

## 先理解记录和字段

默认情况下，awk 把每一行看作一条记录。

例如：

```text
nginx  1234  2.1  128M
mysql  2345  8.4  2.3G
redis  3456  0.5  96M
```

awk 默认按连续空白字符拆字段：

```text
$1  nginx
$2  1234
$3  2.1
$4  128M
```

其中：

- `$0`：整行；
- `$1`：第一个字段；
- `$2`：第二个字段；
- `NF`：当前行字段数量；
- `NR`：当前处理到的总行号。

所以：

```bash
awk '{print $1, $3}' file
```

表达的是：

> 对每一行，都输出第一列和第三列。

## 分隔符决定 awk 如何理解文本

默认空白分隔已经能覆盖很多命令输出，但实际数据经常不是空格。

例如 `/etc/passwd` 使用冒号：

```bash
awk -F: '{print $1, $3, $7}' /etc/passwd
```

其中：

```text
-F:
```

表示输入字段分隔符为 `:`。

也可以写成：

```bash
awk 'BEGIN { FS=":" } { print $1, $7 }' /etc/passwd
```

输出字段的分隔方式由 `OFS` 控制：

```bash
awk 'BEGIN { FS=":"; OFS="\t" } { print $1, $3 }' /etc/passwd
```

于是输入是冒号分隔，输出改为 Tab 分隔。

这也是 awk 比 `cut` 更灵活的地方：输入结构和输出结构可以完全不同。

## Pattern：先决定哪些记录需要处理

只处理包含 ERROR 的行：

```bash
awk '/ERROR/ {print}' app.log
```

等价地可以省略动作：

```bash
awk '/ERROR/' app.log
```

按字段判断：

```bash
awk '$3 > 80 {print $1, $3}' metrics.txt
```

表示第三列大于 80 时才输出。

组合条件：

```bash
awk '$2 == "ERROR" && $4 >= 500 {print $0}' access.log
```

常用比较包括：

```text
==   相等
!=   不等
> < >= <=
~    匹配正则
!~   不匹配正则
```

例如：

```bash
awk '$1 ~ /^10\./ {print}' connections.txt
```

只处理第一列以 `10.` 开头的记录。

## BEGIN 和 END：处理数据之前与之后

awk 不只有“每行执行一次”的逻辑。

`BEGIN` 在读取第一行之前执行：

```bash
awk 'BEGIN {print "USER UID"} {print $1, $3}' /etc/passwd
```

`END` 在所有记录处理完成后执行：

```bash
awk '{sum += $2} END {print sum}' values.txt
```

这使 awk 很适合统计。

例如日志共有多少行：

```bash
awk 'END {print NR}' access.log
```

虽然 `wc -l` 更直接，但这能帮助理解 awk 的生命周期：

```text
BEGIN
  ↓
记录 1
记录 2
记录 3
...
  ↓
END
```

## awk 的核心能力：状态可以跨行保留

这是 awk 与很多简单文本命令真正拉开差距的地方。

例如统计不同 HTTP 状态码出现次数。假设状态码在第 9 列：

```bash
awk '{count[$9]++} END {for (code in count) print code, count[code]}' access.log
```

这里的：

```text
count[$9]++
```

表示用状态码作为数组键。

假设日志里依次出现：

```text
200
200
404
200
500
404
```

最后数组大致变成：

```text
count[200] = 3
count[404] = 2
count[500] = 1
```

这类“按字段分组计数”的能力，在日志分析里非常高频。

## 高频场景：统计 Nginx 访问最多的 IP

最常见的 Shell 管道写法是：

```bash
awk '{print $1}' access.log \
  | sort \
  | uniq -c \
  | sort -nr \
  | head
```

这里 awk 负责把原始日志转换成纯 IP 数据流。

也可以直接在 awk 内计数：

```bash
awk '{count[$1]++} END {for (ip in count) print count[ip], ip}' access.log \
  | sort -nr \
  | head
```

是否把所有逻辑都塞进 awk 并不是重点。更重要的是保持处理链易读。

如果 `awk + sort` 比一个几十行 awk 程序更清楚，就没有必要为了“少一个命令”牺牲可维护性。

## 高频场景：汇总磁盘或资源数据

假设有数据：

```text
app1  120
app2  300
app3  80
```

求总和：

```bash
awk '{sum += $2} END {print sum}' usage.txt
```

求平均值：

```bash
awk '{sum += $2} END {if (NR > 0) print sum / NR}' usage.txt
```

只统计第二列大于 100 的记录：

```bash
awk '$2 > 100 {sum += $2; count++} END {print count, sum}' usage.txt
```

这种“边读取边累计”的模式不需要把整个文件加载进内存，因此非常适合大文本文件。

## printf：让输出变得稳定可读

`print` 会自动按 `OFS` 连接字段。

需要固定格式时使用 `printf`：

```bash
awk '{printf "%-20s %8.2f\n", $1, $2}' data.txt
```

例如输出表格：

```bash
awk 'BEGIN {
  printf "%-16s %10s\n", "USER", "COUNT"
} {
  printf "%-16s %10d\n", $1, $2
}' data.txt
```

`printf` 不会自动换行，所以通常显式加 `\n`。

## 变量让复杂命令不必硬编码

Shell 变量不要直接拼进 awk 程序字符串中，优先使用 `-v`。

例如：

```bash
threshold=80
awk -v limit="$threshold" '$3 > limit {print $1, $3}' metrics.txt
```

这种写法比：

```bash
awk '$3 > '"$threshold"' {print ...}'
```

更容易维护，也能减少 Shell 引号嵌套带来的问题。

多个变量：

```bash
awk -v min=100 -v max=500 '$2 >= min && $2 <= max' data.txt
```

## 多文件处理时要认识 FNR

`NR` 是所有输入文件累计行号。

`FNR` 是当前文件内部的行号。

例如：

```bash
awk '{print FILENAME, FNR, NR, $0}' a.txt b.txt
```

如果两个文件各 3 行：

```text
FNR: 1 2 3 | 1 2 3
NR:  1 2 3 | 4 5 6
```

这在需要比较两个文件时非常有用。

一个经典技巧是：

```bash
awk 'NR==FNR {known[$1]=1; next} $1 in known' allowlist.txt data.txt
```

读取第一个文件时建立索引，读取第二个文件时再判断当前字段是否存在于索引中。

## 不要把“看起来像 CSV”就当普通 -F, 处理

下面的简单数据：

```text
alice,18,beijing
bob,20,shanghai
```

使用：

```bash
awk -F, '{print $1, $3}' file.csv
```

没有问题。

但标准 CSV 允许字段内部出现逗号和引号，例如：

```text
alice,"Beijing, China",18
```

这时简单 `-F,` 会拆错字段。

因此 awk 很适合“结构简单、规则明确的分隔文本”，但对于完整 CSV、JSON、XML 等格式，应优先使用真正理解该格式的解析器，例如 Python csv 模块或 `jq`。

## awk 与 grep、sed、cut 应该怎样分工

可以用一个简单判断：

```text
只判断整行是否匹配？
  → grep

主要做字符串替换和行级编辑？
  → sed

只是固定分隔符下抽取简单字段？
  → cut

需要字段条件、计算、汇总、跨行状态？
  → awk
```

工具并不是互相替代关系。

例如：

```bash
journalctl -u nginx --since today \
  | grep 'status=' \
  | awk '{count[$NF]++} END {for (k in count) print k, count[k]}'
```

每一层负责最擅长的事情，往往比把全部逻辑塞进一个工具更清晰。

## 写复杂 awk 时不要执着于“一行命令”

当 awk 逻辑开始变长：

```awk
BEGIN {
    FS = "|"
}

$3 == "ERROR" {
    count[$2]++
}

END {
    for (service in count) {
        print service, count[service]
    }
}
```

可以直接保存为：

```text
report.awk
```

然后：

```bash
awk -f report.awk app.log
```

这比维护一个几百字符、充满 Shell 引号的单行命令可靠得多。

## 排查 awk 结果不对时看哪几件事

先不要怀疑算法，通常应该先确认输入结构：

```bash
head -5 file
```

然后查看字段：

```bash
awk '{print NF, $0}' file | head
```

如果使用自定义分隔符：

```bash
awk -F'|' '{print NF, $1, $2, $3}' file | head
```

重点确认：

- 分隔符是否真的固定；
- 是否存在连续分隔符；
- 字段里是否可能包含分隔符；
- 数字列是否混入单位；
- 是否存在表头；
- 当前逻辑使用的是 `NR` 还是 `FNR`。

## 最重要的理解方式

awk 不应该被记成“`$1`、`$2` 的命令”。

看到一份文本时，先问：

```text
一条记录是什么？
     ↓
字段如何分隔？
     ↓
哪些记录需要处理？
     ↓
每条记录要做什么？
     ↓
是否需要跨行累计状态？
     ↓
最后要怎样汇总输出？
```

如果这个问题天然符合“记录—字段—条件—动作—汇总”的模型，awk 往往就是 Linux 命令行里最自然的工具。