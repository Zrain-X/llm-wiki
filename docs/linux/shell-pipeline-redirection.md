# Shell 管道、重定向与退出码：理解 Linux 命令为什么能“拼起来”

Linux 命令行真正强大的地方，不是某一个命令功能有多复杂，而是大量小工具可以通过标准输入、标准输出和退出状态组合起来。

`grep`、`awk`、`sed`、`sort`、`xargs` 之所以能形成复杂的数据处理链，本质上依赖一套很简单的约定：**程序从哪里读数据、把结果写到哪里，以及如何告诉调用者自己是否成功。**

理解这套约定之后，很多 Shell 写法就不需要死记。

## 三条默认的数据通道

Linux 进程启动后通常会拥有三个标准文件描述符：

```text
0  stdin   标准输入
1  stdout  标准输出
2  stderr  标准错误
```

默认情况下：

- stdin 来自终端键盘；
- stdout 输出到终端；
- stderr 也输出到终端。

例如：

```bash
cat /etc/hostname
```

`cat` 从文件读取内容，再把内容写到 stdout，因此你会在终端看到结果。

如果文件不存在：

```bash
cat /not-exist
```

错误信息走的不是 stdout，而是 stderr。

这一区别非常重要，因为 Shell 可以分别处理两条输出通道。

## 重定向：改变数据流向

### `>`：把 stdout 写入文件

```bash
ip addr > network.txt
```

如果文件已存在，会被覆盖。

### `>>`：追加写入

```bash
date >> run.log
```

适合持续记录脚本运行结果。

### `<`：把文件作为 stdin

```bash
wc -l < access.log
```

这里 `wc` 并不知道文件名，它只是从 stdin 读取数据。

### `2>`：只重定向错误输出

```bash
find / -name '*.log' 2>errors.log
```

搜索结果仍输出到屏幕，无权限访问目录之类的错误会进入 `errors.log`。

丢弃错误输出：

```bash
find / -name '*.log' 2>/dev/null
```

`/dev/null` 可以理解为一个“黑洞设备”，写进去的数据会被直接丢弃。

### 同时保存 stdout 和 stderr

```bash
command >run.log 2>&1
```

`2>&1` 的含义不是“把 2 写进 1”，而是：

> 让文件描述符 2 指向文件描述符 1 当前指向的位置。

因此顺序很重要。

下面两种写法并不完全等价：

```bash
command >run.log 2>&1
command 2>&1 >run.log
```

第一种把 stdout 和 stderr 都写进文件；第二种先让 stderr 指向当前终端，再把 stdout 改到文件，所以 stderr 仍可能显示在终端。

Bash 中也可以写：

```bash
command &>run.log
```

但在需要兼容 POSIX Shell 的脚本中，`>file 2>&1` 更通用。

## 管道 `|`：把一个程序的 stdout 接到另一个程序的 stdin

最典型的例子：

```bash
ps aux | grep nginx
```

逻辑上相当于：

```text
ps aux
  stdout
     │
     ▼
grep nginx
  stdin
```

Shell 不需要理解 `ps` 输出了什么，也不需要理解 `grep` 怎么搜索。它只负责连接两端的数据流。

这就是 Unix 工具可以高度组合的原因。

常见组合：

```bash
journalctl -u nginx | grep -i error
```

```bash
du -h --max-depth=1 /var | sort -h
```

```bash
ss -lntp | grep ':8080'
```

## 管道不是“先执行左边，再执行右边”

管道中的进程通常会同时运行。

例如：

```bash
producer | consumer
```

`producer` 一边产生数据，`consumer` 就可以一边处理，而不是必须等待左侧全部执行完成。

这对处理大文件非常重要，因为很多场景根本不需要先产生一个巨大的中间文件。

例如：

```bash
gzip -dc huge.log.gz | grep ERROR
```

数据解压后直接进入 `grep`，不需要先把完整日志解压到磁盘。

## `tee`：既想看，又想保存

普通重定向：

```bash
command >output.log
```

执行后终端不再显示 stdout。

如果希望同时显示并保存：

```bash
command | tee output.log
```

追加模式：

```bash
command | tee -a output.log
```

`tee` 在运维中非常常见，例如：

```bash
ping 192.168.1.1 | tee network-test.log
```

还可以与 `sudo` 配合解决一个常见误区。

下面通常不会按预期工作：

```bash
sudo echo 'value' > /etc/app.conf
```

因为 `sudo` 只提升了 `echo`，真正执行 `>` 的仍然是当前 Shell。

可以改成：

```bash
echo 'value' | sudo tee /etc/app.conf
```

## 退出码：命令如何告诉 Shell“成功还是失败”

Linux 命令执行结束后会返回一个整数状态码。

约定上：

```text
0      成功
非 0   失败或其他状态
```

查看上一条命令退出码：

```bash
command
printf '%s\n' "$?"
```

例如：

```bash
grep root /etc/passwd
```

找到内容时一般返回 `0`。

```bash
grep definitely-not-exist /etc/passwd
```

没有匹配内容时 `grep` 通常返回 `1`。

因此退出码比“屏幕上有没有输出”更适合脚本判断。

## `&&` 和 `||`：根据退出码决定是否继续

成功后才执行下一步：

```bash
npm run build && systemctl restart myapp
```

只有构建成功，才会重启服务。

失败后才执行：

```bash
curl -f http://127.0.0.1:8080/health || echo 'health check failed'
```

两者可以组合：

```bash
command && echo success || echo failed
```

但复杂逻辑更推荐写成明确的 `if`，避免读者误解运算结合关系。

## 管道中最容易忽略的退出码问题

假设：

```bash
false | true
```

默认 Bash 通常把**最后一个命令**的退出码作为整条管道的退出码，因此结果可能仍是 `0`。

对于运维脚本，这很危险：前面的命令明明失败了，脚本却认为整个管道成功。

Bash 可以启用：

```bash
set -o pipefail
```

之后，只要管道中有命令失败，整条管道就不会简单地被最后一个成功命令掩盖。

生产脚本中常见：

```bash
set -euo pipefail
```

三项分别大致表示：

- `-e`：未处理的失败尽量终止脚本；
- `-u`：引用未定义变量时报错；
- `pipefail`：不要忽略管道前部失败。

但 `set -e` 有不少语义细节，并不是“任何非零退出码都立刻退出”。复杂脚本仍应对关键步骤显式判断。

## stderr 为什么应该和 stdout 分开

如果一个命令既输出业务数据，又输出错误信息，混到一起就会污染后续处理。

例如一个脚本要产生 JSON：

```bash
./collect.sh >result.json
```

如果调试信息也写 stdout：

```text
connecting database...
{"status":"ok"}
```

那 `result.json` 就不再是合法 JSON。

更合理的做法是：

```bash
echo 'connecting database...' >&2
printf '{"status":"ok"}\n'
```

这样 stdout 保持机器可处理的数据，stderr 用于诊断信息。

这是编写 CLI 工具时非常重要的设计习惯。

## 后台运行、nohup 与日志重定向

简单后台执行：

```bash
command &
```

但退出 SSH 会话后，进程是否继续运行还取决于 Shell、信号和程序行为。

临时任务经常使用：

```bash
nohup command >app.log 2>&1 &
```

不过对于长期服务，不应该把 `nohup ... &` 当成正式服务管理方案。更推荐交给 systemd：

- 自动启动；
- 崩溃重启；
- 日志管理；
- 运行用户；
- 资源和依赖管理。

`nohup` 更适合临时跑一次长任务，而不是长期守护进程。

## 高频场景：一条可靠的日志分析链

例如想统计 Nginx 日志中出现最多的客户端 IP：

```bash
awk '{print $1}' access.log \
  | sort \
  | uniq -c \
  | sort -nr \
  | head
```

每一层只做一件事：

```text
access.log
   ↓ awk       提取 IP
IP 列表
   ↓ sort      排序
   ↓ uniq -c   聚合计数
   ↓ sort -nr  按数量倒序
   ↓ head      只看前几名
```

这就是 Shell 数据流思想的典型体现。

## 高频场景：执行操作并完整保留现场日志

```bash
./deploy.sh 2>&1 | tee deploy-$(date +%F-%H%M%S).log
```

如果脚本依赖管道退出码，应配合：

```bash
set -o pipefail
./deploy.sh 2>&1 | tee deploy.log
```

否则 `tee` 成功可能掩盖 `deploy.sh` 失败。

## 最重要的理解方式

看到复杂 Shell 命令时，不要先逐字符记语法，可以先画出三件事：

```text
数据从哪里来？
      ↓
经过哪些程序处理？
      ↓
stdout / stderr 最终去了哪里？
      ↓
Shell 最终依据哪个退出码判断成功？
```

掌握数据流和退出码之后，管道与重定向就会从“特殊符号集合”变成一套非常直观的程序组合机制。
