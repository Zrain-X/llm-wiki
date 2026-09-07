# grep、find 与 xargs：Linux 批处理三件套

Linux 日常运维里有一类任务反复出现：

> 找到满足条件的一批文件或内容，然后对它们执行某个操作。

`grep`、`find`、`xargs` 经常同时出现，是因为它们解决的是三个不同层次的问题：

```text
find：哪些文件/目录是目标？
grep：哪些文本内容是目标？
xargs：把前面得到的对象交给后续命令。
```

理解这种分工之后，很多看似不同的批处理任务都会变成同一套模型。

## grep：回答“哪些行包含我要的内容”

最普通的搜索：

```bash
grep 'ERROR' app.log
```

运维中更常使用这些选项：

```bash
grep -n 'ERROR' app.log
```

显示行号。

```bash
grep -i 'error' app.log
```

忽略大小写。

```bash
grep -R 'old.example.com' /etc/myapp
```

递归搜索目录。

```bash
grep -R --include='*.conf' -nF 'old.example.com' /etc/myapp
```

只处理特定后缀，并使用固定字符串匹配。

### 不需要正则时优先 `-F`

如果搜索的是 URL、路径、IP、配置值等字面量：

```bash
grep -F 'https://example.com?a=1' file
```

往往比默认正则更符合意图，也可以避免 `.`、`[`、`*` 等字符被当成正则语法。

### 什么时候使用 `-E`

确实需要扩展正则时：

```bash
grep -E 'ERROR|WARN|FATAL' app.log
```

运维脚本里最好让“固定字符串搜索”和“正则搜索”意图明确，而不是所有内容都默认当正则。

## find：回答“哪些文件对象满足条件”

`find` 的能力远不止文件名搜索。它实际上是在遍历目录树，并对每个对象应用条件。

找所有 `.log` 文件：

```bash
find /var/log/myapp -type f -name '*.log'
```

找 7 天前修改过的日志：

```bash
find /var/log/myapp -type f -mtime +7
```

找超过 1 GiB 的文件：

```bash
find /data -type f -size +1G
```

只在当前文件系统内搜索：

```bash
find / -xdev -type f -size +1G
```

`-xdev` 对排查根分区空间非常有价值，可以避免 find 顺着挂载点跑进 NAS、NFS 或其他数据盘。

## `find` 的条件是可以组合的

例如查找 7 天前的 `.log`：

```bash
find /var/log/myapp -type f -name '*.log' -mtime +7
```

进一步排除压缩文件：

```bash
find /var/log/myapp -type f -name '*.log' ! -name '*.gz' -mtime +7
```

先把 find 当作“查询文件系统对象的表达式”，比把每种组合当成新命令更容易理解。

## 不要用 `ls | grep` 代替 find

例如：

```bash
ls -l | grep '.log'
```

只适合人临时看结果，不适合严肃脚本。原因包括：

- `ls` 输出是给人看的，不是稳定的数据接口；
- 文件名可能包含空格、换行等字符；
- 递归、时间、大小、类型等条件表达能力很弱。

需要按文件属性选择对象时，用 `find` 更自然。

## xargs：把标准输入转换成命令参数

管道传递的是文本流，但很多命令需要的是“命令行参数”。`xargs` 就负责转换。

例如：

```bash
printf '%s\n' a.log b.log | xargs ls -l
```

等价于把输入整理后交给：

```bash
ls -l a.log b.log
```

这使它非常适合承接 find/grep 的结果。

## 文件名安全：`-print0` 与 `-0` 应该成对出现

下面的写法看起来合理：

```bash
find /data -type f -name '*.strm' | xargs sed -i 's/old/new/g'
```

但文件名里存在空格、引号或换行时可能被错误拆分。

更稳妥的是：

```bash
find /data -type f -name '*.strm' -print0 \
  | xargs -0 sed -i 's#old#new#g'
```

`find -print0` 使用 NUL 字符分隔文件名，`xargs -0` 按相同方式读取，因此不会把空格误当分隔符。

## 很多时候 `find -exec` 比 xargs 更直接

例如：

```bash
find /data -type f -name '*.conf' -exec grep -nH 'timeout' {} +
```

`{} +` 会尽量把多个文件合并成一次命令调用，既不需要自己处理 xargs，也避免逐文件启动进程的性能问题。

简单判断：

- 只需要把 find 的结果交给一个命令：优先考虑 `-exec ... {} +`；
- 需要控制批大小、并行度或承接其他文本流：xargs 更灵活。

## xargs 的批量与并行能力

每次处理 20 个对象：

```bash
xargs -n 20 command
```

并行 4 个任务：

```bash
xargs -P 4 command
```

例如对大量独立 URL 做探测时可能有用。

但不要把 `-P` 当成“免费加速按钮”。后端数据库、磁盘、API 或远端服务都可能因为并发过高而被压垮。并行度应该根据下游承载能力控制。

## 高频场景：先找文件，再找内容

```bash
find /etc/myapp -type f -name '*.conf' -exec grep -nH -F 'old.example.com' {} +
```

这里：

1. find 负责限定配置文件；
2. grep 负责限定文本内容；
3. `-nH` 显示文件名和行号，便于后续确认。

这比直接对整个目录做盲目替换安全得多。

## 高频场景：找出大文件

```bash
find /var -xdev -type f -size +1G -printf '%s %p\n' 2>/dev/null \
  | sort -n
```

如果只是为了找磁盘问题，还应该结合 `df` 和 `du`，因为“最大文件”不一定是空间问题的真实原因。详见：[磁盘、文件系统与空间排查](/linux/disk-filesystem)。

## 高频场景：批量替换前先做预览

第一步，只看哪些地方会命中：

```bash
grep -R --include='*.strm' -nF 'old-string' /media
```

第二步，选择一个文件验证 sed 输出：

```bash
sed 's#old-string#new-string#g' /media/example.strm
```

第三步，再批量：

```bash
find /media -type f -name '*.strm' -print0 \
  | xargs -0 sed -i.bak 's#old-string#new-string#g'
```

第四步，再次搜索旧值：

```bash
grep -R --include='*.strm' -nF 'old-string' /media
```

这套“**找 → 看 → 改 → 验证**”比追求一条命令完成所有事情可靠得多。

## 高频场景：清理旧文件时把删除放在最后

先只打印：

```bash
find /var/log/myapp -type f -name '*.log' -mtime +30 -print
```

确认范围正确后，再执行对应的归档或删除操作。

尤其不要在第一次编写 find 表达式时就直接追加 `-delete`。路径写错、括号逻辑写错或条件漏掉，都可能造成不可逆结果。

## grep、find、xargs 的真正价值

这三个工具组合起来，形成的是一种 Unix 风格的数据流：

```text
缩小对象范围 → 缩小内容范围 → 把结果交给下一步
```

日常批处理的效率，更多来自这种**逐层过滤、每一步都可观察**的思维，而不是来自把命令压缩成难以维护的一行。