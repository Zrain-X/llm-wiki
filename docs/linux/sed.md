# sed：面向文本流的编辑器

`sed` 的全名通常解释为 **stream editor**。理解这个名字，比背 `s/old/new/g` 更重要：它擅长的不是“打开文件后交互式编辑”，而是**让文本逐行流过一套规则，并自动完成替换、筛选、删除或变换**。

这使 sed 非常适合配置文件批量修改、日志文本清洗、脚本中的小型转换，以及与 `find`、`grep`、`xargs` 组合完成批处理。

## sed 解决的核心问题

假设要把几百个文件里的旧域名统一替换成新域名。手工打开编辑器显然不现实，写 Python 又显得太重。

sed 正好位于两者之间：

```bash
sed 's#old.example.com#new.example.com#g' file
```

它默认把处理后的内容输出到 stdout，**不会修改原文件**。这点非常适合先预览结果。

从思维上，可以把最常见的 sed 工作过程理解为：

```text
读取一行 → 判断这一行是否需要处理 → 执行动作 → 输出 → 读取下一行
```

所以它天然适合“按行”的文本任务。

## 最常用的替换语法

```bash
sed 's/old/new/' file
```

这里：

- `s` 表示 substitute；
- 第一段是匹配模式；
- 第二段是替换内容；
- 默认每一行只替换第一个匹配。

替换一行内全部匹配：

```bash
sed 's/old/new/g' file
```

只替换第二次出现：

```bash
sed 's/old/new/2' file
```

## `/` 只是分隔符，不是固定语法

替换路径时，如果继续使用 `/`，会出现大量转义：

```bash
sed 's/\/old\/media\/path/\/new\/media\/path/g'
```

更好的写法是换分隔符：

```bash
sed 's#/old/media/path#/new/media/path#g'
```

也可以用 `|`：

```bash
sed 's|https://old.example.com|https://new.example.com|g'
```

选择一个不会频繁出现在文本中的字符，通常能让规则清晰很多。

## 先限定“哪些行”，再决定“做什么”

sed 的强项不仅是替换，还能给命令加地址范围。

只处理包含 `server` 的行：

```bash
sed '/server/s/old/new/g' nginx.conf
```

只处理第 10 到 20 行：

```bash
sed '10,20s/old/new/g' file
```

只打印包含 ERROR 的行：

```bash
sed -n '/ERROR/p' app.log
```

这里 `-n` 关闭默认输出，`p` 再把命中的行打印出来。

这种“地址 + 动作”的理解，比把每种写法当成独立命令更容易迁移到新场景。

## 删除、打印和插入只是同一模型的不同动作

删除空行：

```bash
sed '/^[[:space:]]*$/d' file
```

打印 20 到 40 行：

```bash
sed -n '20,40p' file
```

在匹配行后追加内容：

```bash
sed '/^\[server\]/a\enabled=true' config.ini
```

实际运维中，替换和打印最常用。对于复杂插入、跨多行结构编辑，不要为了“只用 sed”而强行使用它。

## 基础正则与扩展正则

GNU sed 默认使用基础正则表达式。需要 `+`、`?`、`|` 这类更自然的扩展正则时，通常使用：

```bash
sed -E 's/(foo|bar)+/X/g' file
```

例如把连续空白压缩成一个空格：

```bash
sed -E 's/[[:space:]]+/ /g' file
```

脚本中尽量明确使用 `-E`，而不是依赖不同平台上的历史选项差异。

## 捕获组让替换不必写死全部内容

例如把：

```text
port=8080
```

变成：

```text
port=9090
```

可以直接替换。如果希望保留键名，只替换值：

```bash
sed -E 's/^(port=)[0-9]+$/\19090/' config
```

`\1` 代表第一个捕获组。

替换内容中的 `&` 也有特殊含义，它代表“整个匹配到的文本”：

```bash
echo 'error' | sed 's/error/[&]/'
```

结果是：

```text
[error]
```

因此真实替换字符串中如果本身包含 `&`，需要额外转义。这是自动拼接 sed 命令时常见的坑。

## `-i` 很方便，但应该最后使用

GNU/Linux 上常见：

```bash
sed -i 's/old/new/g' file
```

带备份：

```bash
sed -i.bak 's/old/new/g' file
```

更稳妥的工作流是：

```bash
sed 's/old/new/g' file
```

先看输出，再：

```bash
sed -i.bak 's/old/new/g' file
```

确认修改后再清理备份。

### GNU sed 与 macOS/BSD sed 的差异

macOS 上原地修改通常写成：

```bash
sed -i '' 's/old/new/g' file
```

而 GNU sed 常见写法是：

```bash
sed -i 's/old/new/g' file
```

因此要在 Linux 和 macOS 之间复用脚本时，`-i` 是首先需要处理的兼容点之一。

## 配置文件中最常见的几类场景

### 修改一个 key=value

```bash
sed -E 's/^timeout=.*/timeout=30/' app.conf
```

前面的 `^` 很重要，它避免误改注释或其他位置出现的 `timeout=`。

### 取消一项注释

```bash
sed -E 's/^[[:space:]]*#([[:space:]]*PermitRootLogin)/\1/' sshd_config
```

但像 SSH 配置这样的关键文件，修改后还应运行对应的语法检查，而不是只确认 sed 执行成功。

### 批量修改文件里的旧地址

先找：

```bash
grep -R --include='*.strm' -nF 'old-string' /path/to/media
```

再改：

```bash
find /path/to/media -type f -name '*.strm' -print0 \
  | xargs -0 sed -i 's#old-string#new-string#g'
```

这里 `-print0` / `-0` 不是装饰，它们用于正确处理文件名中的空格和特殊字符。

## Shell 变量与引号经常比 sed 本身更容易出错

单引号不会展开 Shell 变量：

```bash
old='foo'
new='bar'
sed 's/$old/$new/g' file
```

上面匹配的是字面量 `$old`，不是 `foo`。

需要变量时常见写法是：

```bash
sed "s#$old#$new#g" file
```

但此时变量内容中的正则字符、`&`、反斜杠、分隔符都可能继续影响 sed 语义。

因此如果替换内容完全来自用户输入、URL、密码、JSON 等不可控文本，不要简单把变量直接拼进 sed 表达式。复杂转义场景用 Python、Perl 或专用配置工具通常更可靠。

## 什么情况下不该使用 sed

sed 很强，但它最适合**行式、弱结构化文本**。

以下场景通常有更好的工具：

- JSON：使用 `jq`；
- YAML：使用 `yq`；
- XML：使用 XML 工具；
- 复杂 CSV：使用支持 CSV 语义的工具；
- 跨多行、嵌套结构、需要上下文状态的转换：Python/Perl 往往更清晰。

一个很实用的判断标准是：**如果你已经花大量时间在逃逸字符和跨行技巧上，sed 很可能不再是最合适的工具。**

## 一套安全的批量替换流程

生产环境批量改文件时，建议固定成下面的习惯：

1. 用 `grep -nF` 或 `rg -n -F` 确认命中范围；
2. 先对单个文件运行不带 `-i` 的 sed；
3. 确认正则不会误匹配；
4. 批量处理时用 `find -print0` 与 `xargs -0`；
5. 关键文件使用备份后缀或 Git 管理；
6. 修改后再次 grep，并运行配置对应的语法检查；
7. 最后才 reload/restart 服务。

sed 的价值不在于一行命令看起来有多“巧”，而在于让**可预览、可重复、可验证的文本变换**变得足够轻量。