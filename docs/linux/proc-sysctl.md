# /proc 与 sysctl：从“观察内核状态”到“调整运行参数”

Linux 上很多看起来像普通文件的内容，其实并不真正存放在磁盘里。例如：

```bash
cat /proc/meminfo
cat /proc/cpuinfo
cat /proc/1234/status
```

这些内容来自一个特殊的虚拟文件系统 `/proc`。它把内核和进程的运行状态以文件形式暴露出来，让普通工具也能通过 `cat`、`grep`、`awk` 等方式读取。

而 `sysctl` 则提供了一套更适合管理内核运行参数的接口。理解这两者，关键不是背参数名，而是分清：**哪些内容是在观察状态，哪些内容是在修改内核行为，哪些修改只在当前启动周期有效，哪些应该持久化。**

## /proc 是什么

查看挂载：

```bash
findmnt /proc
```

通常会看到类型：

```text
proc
```

它不是传统磁盘文件系统。

例如：

```bash
ls -lh /proc/meminfo
```

看到的文件大小和时间戳没有普通文件那么直接的含义，因为内容是读取时由内核动态生成的。

可以把 `/proc` 理解为：

```text
Linux Kernel
   ↓
把部分运行状态暴露为文件接口
   ↓
/proc
   ↓
用户态工具读取
```

很多日常命令本身也会读取 `/proc`。

## /proc 下最重要的两类内容

第一类是系统级状态，例如：

```text
/proc/cpuinfo
/proc/meminfo
/proc/loadavg
/proc/mounts
/proc/net/
```

第二类是每个进程自己的目录：

```text
/proc/PID/
```

例如 PID 1234：

```bash
ls /proc/1234
```

这里可以看到该进程的：

- 命令行；
- 环境变量；
- 打开的文件描述符；
- 内存映射；
- 当前工作目录；
- 根目录；
- 运行状态；
- namespace 等。

因此 `/proc/PID` 是很多进程排障工具背后的基础数据来源。

## /proc/PID/cmdline：进程到底是怎么启动的

查看：

```bash
tr '\0' ' ' < /proc/1234/cmdline
```

因为参数之间使用 NUL 字符分隔，直接 `cat` 看起来可能会粘在一起。

它可以帮助确认：

- 实际执行的是哪个二进制；
- 启动参数是什么；
- 配置文件路径是什么；
- 是否经过了 wrapper 脚本或不同版本程序。

相比只看截断后的 `ps` 输出，`/proc/PID/cmdline` 往往更直接。

## /proc/PID/fd：进程当前打开了什么

查看文件描述符：

```bash
ls -l /proc/1234/fd
```

可能看到：

```text
0 -> /dev/null
1 -> /var/log/app.log
2 -> /var/log/app.log
5 -> socket:[123456]
8 -> /data/database.db
```

这对很多问题非常关键。

例如：

> 日志文件已经 `rm` 了，为什么磁盘空间还没释放？

可以检查：

```bash
ls -l /proc/1234/fd | grep deleted
```

如果进程仍然持有已经删除文件的 fd，磁盘块就不会真正释放。

`lsof` 本质上也是在帮助你更友好地查看类似信息。

## cwd、exe 和 root 可以快速确认进程上下文

当前工作目录：

```bash
readlink /proc/1234/cwd
```

真正运行的二进制：

```bash
readlink /proc/1234/exe
```

进程看到的根目录：

```bash
readlink /proc/1234/root
```

这在容器、chroot、程序多版本共存时尤其有用。

例如 `ps` 显示进程叫 `python`，但你想知道实际使用的是：

```text
/usr/bin/python3
/opt/app/.venv/bin/python
```

直接看：

```bash
readlink /proc/PID/exe
```

通常比猜测 PATH 更可靠。

## /proc/PID/status：快速看进程状态

例如：

```bash
cat /proc/1234/status
```

常见字段包括：

```text
Name
State
Pid
PPid
Uid
Gid
VmSize
VmRSS
Threads
voluntary_ctxt_switches
```

这可以快速回答：

```text
进程是谁启动的？
实际 UID/GID 是什么？
内存大致占多少？
线程数量是多少？
当前状态是运行、睡眠还是僵尸？
```

## /proc/meminfo 比 free 更接近原始数据

```bash
cat /proc/meminfo
```

会看到：

```text
MemTotal
MemFree
MemAvailable
Buffers
Cached
SwapTotal
SwapFree
...
```

`free`、监控 Agent 等工具会基于这些数据进行整理。

当不同监控工具给出的“内存使用率”不一致时，问题往往不是内核有多份内存数据，而是各工具对“可回收缓存、available、used”的计算口径不同。

这时回到 `/proc/meminfo` 更容易理解原始状态。

## /proc/loadavg：load average 的原始入口之一

```bash
cat /proc/loadavg
```

典型：

```text
0.35 0.42 0.50 2/812 12345
```

前三个数字对应近似的：

```text
1 分钟
5 分钟
15 分钟
```

平均负载。

但 load 并不等同于 CPU 使用率。Linux load 还会受到不可中断睡眠任务等影响，因此看到 load 高时仍然应该继续分析 CPU、I/O wait、进程状态，而不是简单得出“CPU 满了”。

## /proc/sys：内核可调参数的文件接口

例如：

```bash
cat /proc/sys/net/ipv4/ip_forward
```

可能输出：

```text
0
```

表示 IPv4 转发关闭。

将它设置为 1：

```bash
sudo sh -c 'echo 1 > /proc/sys/net/ipv4/ip_forward'
```

可以修改当前运行内核参数。

但更推荐通过：

```bash
sudo sysctl -w net.ipv4.ip_forward=1
```

因为 `sysctl` 语义更清晰，也不需要自己处理 `/proc/sys` 路径转换。

两者本质上操作的是同一套内核参数接口。

## sysctl 参数名与 /proc/sys 路径是什么关系

例如：

```text
net.ipv4.ip_forward
```

对应：

```text
/proc/sys/net/ipv4/ip_forward
```

大致就是把：

```text
.
```

换成：

```text
/
```

所以：

```bash
sysctl net.ipv4.ip_forward
```

与读取对应 `/proc/sys` 文件观察的是同一个参数。

## 临时修改和持久化必须分开理解

执行：

```bash
sudo sysctl -w net.ipv4.ip_forward=1
```

会立即修改运行中的内核。

但机器重启后是否还保持，要看持久化配置。

常见配置位置包括：

```text
/etc/sysctl.conf
/etc/sysctl.d/*.conf
/usr/lib/sysctl.d/*.conf
```

建议自定义配置放在独立文件，例如：

```text
/etc/sysctl.d/90-myapp.conf
```

内容：

```text
net.ipv4.ip_forward = 1
```

然后加载：

```bash
sudo sysctl --system
```

这样比把所有自定义参数不断追加到一个巨大 `/etc/sysctl.conf` 更容易管理。

## 不要把 sysctl 当成“Linux 性能优化开关大全”

网上经常能看到几十行所谓：

```text
Linux 高性能 sysctl 参数
```

直接复制到服务器。

这是非常危险的习惯。

内核参数通常与：

- 内核版本；
- 网络模型；
- 内存规模；
- 连接数量；
- 应用行为；
- 容器和 namespace；
- 发行版默认值；

相关。

一个参数在高并发反向代理上合理，不代表数据库服务器、开发机或 NAT 网关也应该使用相同值。

真正的调优顺序应该是：

```text
先观察瓶颈
   ↓
确定对应内核机制
   ↓
理解参数含义和默认值
   ↓
小范围修改
   ↓
验证指标变化
   ↓
再决定是否持久化
```

而不是“先套模板，再看有没有变快”。

## 高频场景：打开路由转发

Linux 主机作为路由器、VPN 网关或容器网络节点时，可能需要：

```bash
sysctl net.ipv4.ip_forward
```

如果为 0：

```bash
sudo sysctl -w net.ipv4.ip_forward=1
```

但这只是允许内核进行 IPv4 转发。

完整网络路径还涉及：

```text
路由表
防火墙 FORWARD 链
NAT
返回路由
```

所以“ip_forward 已经是 1”并不代表网络一定能转发成功。

## 高频场景：端口不够用、连接很多，应该先看什么

看到大量短连接或端口问题时，不要第一步就修改：

```text
net.ipv4.ip_local_port_range
net.ipv4.tcp_fin_timeout
```

先确认真实现象：

```bash
ss -s
ss -ant | awk '{count[$1]++} END {for (k in count) print k, count[k]}'
```

再查看相关当前参数：

```bash
sysctl net.ipv4.ip_local_port_range
```

如果确实存在本地临时端口耗尽，再评估连接复用、连接池、应用行为和参数调整。

很多“TCP 参数优化”其实是在掩盖应用错误地创建过多短连接。

## 高频场景：进程打开文件太多

先看进程实际 fd：

```bash
ls /proc/PID/fd | wc -l
```

查看进程限制：

```bash
cat /proc/PID/limits
```

这里会看到：

```text
Max open files
Max processes
...
```

这类资源限制不一定由 sysctl 决定。

它还可能来自：

- PAM limits；
- systemd `LimitNOFILE=`；
- Shell `ulimit`；
- 容器运行时。

因此碰到 `Too many open files` 时，不要只搜索一个 sysctl 参数。

先确认当前进程真正继承到的 limit 才是关键。

## 高频场景：修改 sysctl 后应用行为没变化

先确认参数实际值：

```bash
sysctl parameter.name
```

再检查：

```text
参数是否属于当前 network namespace？
应用是否运行在容器里？
修改的是宿主机还是容器内部？
参数是否在应用启动时读取后缓存？
是否有其他 sysctl.d 文件随后覆盖？
```

现代容器环境里，“我在宿主机改了 sysctl”不一定等于所有 namespace 都看到完全相同的设置。

## sysctl --system 为什么可能出现“前面设置了，后面又变了”

系统会加载多个 sysctl 配置目录和文件。

如果不同文件都定义：

```text
net.some.parameter
```

最终值可能由加载顺序决定。

排查时可以搜索：

```bash
grep -R 'net.some.parameter' /etc/sysctl.conf /etc/sysctl.d /usr/lib/sysctl.d 2>/dev/null
```

不要只看 `/etc/sysctl.conf` 就认为没有其他配置来源。

## /proc 中有些内容非常敏感

例如：

```text
/proc/PID/environ
/proc/PID/fd
/proc/PID/mem
```

可能暴露：

- 环境变量中的 token；
- 数据库密码；
- 打开的敏感文件；
- 进程运行上下文。

系统会通过权限、ptrace 策略、hidepid 等机制限制访问。

因此在共享服务器上，不应该把“能读 `/proc`”理解成完全无风险的观察行为。

## 排查进程问题时可以怎样利用 /proc

一个非常实用的检查链：

```bash
PID=1234
```

先确认二进制：

```bash
readlink /proc/$PID/exe
```

确认工作目录：

```bash
readlink /proc/$PID/cwd
```

查看启动参数：

```bash
tr '\0' ' ' < /proc/$PID/cmdline
```

看身份和状态：

```bash
grep -E '^(Name|State|Pid|PPid|Uid|Gid|Threads|VmRSS):' /proc/$PID/status
```

看打开文件：

```bash
ls -l /proc/$PID/fd
```

很多“程序到底跑的哪个版本、为什么还占用这个文件、为什么读到旧配置”的问题，在这里就能得到答案。

## sysctl 修改前的安全原则

尤其是网络、内存和内核安全参数，建议始终遵循：

```text
记录修改前值
   ↓
明确参数含义
   ↓
先临时修改
   ↓
验证业务与系统指标
   ↓
确认无副作用
   ↓
最后再写入 sysctl.d 持久化
```

例如先：

```bash
sysctl net.ipv4.ip_forward
```

再：

```bash
sudo sysctl -w net.ipv4.ip_forward=1
```

而不是直接修改持久化文件并重启服务器验证。

## 最重要的理解方式

`/proc` 和 `sysctl` 可以放在同一条思路中理解：

```text
Linux 内核正在做什么？
       ↓
/proc 暴露状态和进程视图
       ↓
哪些行为可以调整？
       ↓
/proc/sys 与 sysctl 暴露可调参数
       ↓
临时修改是否有效？
       ↓
是否值得持久化？
```

真正高效的内核参数管理，永远是“先观察，再解释，再调整”，而不是从一份所谓的万能 sysctl 模板开始。