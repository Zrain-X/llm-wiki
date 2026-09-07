# CPU、内存、负载与进程排查

Linux 服务器“变慢”时，最常见的误判是：看到 `load average` 很高就认定 CPU 满了，看到 `free` 很少就认定内存不足，然后直接杀掉排名靠前的进程。

更可靠的做法是把系统资源拆开看：**CPU 在忙什么、内存是否真的紧张、进程是否等待 I/O、系统负载来自运行队列还是不可中断等待。**

## 先用 uptime 看整体，而不是直接找“凶手”

```bash
uptime
```

典型输出包含：

```text
load average: 1.20, 0.80, 0.50
```

分别代表过去约 1、5、15 分钟的 load average。

Linux load 不只是“CPU 使用率”。它主要反映正在运行或等待可运行资源的任务，以及部分处于不可中断睡眠的任务。

因此：

```text
load 高 ≠ CPU 一定 100%
```

一个 1 核机器 load 4 和一个 32 核机器 load 4，意义也完全不同。必须结合 CPU 数量：

```bash
nproc
```

一起判断。

## free 要看 available，不要只看 free

```bash
free -h
```

Linux 会积极把空闲内存用于 page cache，以提高文件访问性能。因此 `free` 列很小经常是正常现象。

日常更值得关注的是：

```text
available
```

它估算在不触发明显交换压力的情况下，还能提供给新应用的内存。

所以“used 很高”也不等于内存泄漏。

## 找高 CPU 进程

```bash
ps aux --sort=-%cpu | head
```

更适合排障的自定义视图：

```bash
ps -eo pid,ppid,user,stat,%cpu,%mem,rss,etime,cmd --sort=-%cpu | head -20
```

其中：

- `PID`：进程；
- `PPID`：父进程；
- `STAT`：进程状态；
- `%CPU`：CPU 使用；
- `RSS`：实际驻留物理内存；
- `ETIME`：已经运行多久。

看 PPID 很重要，因为一个高 CPU 子进程可能只是某个服务、容器或 Worker 池的一部分。

## 找高内存进程

```bash
ps aux --sort=-%mem | head
```

或者按 RSS：

```bash
ps -eo pid,ppid,user,%mem,rss,vsz,etime,cmd --sort=-rss | head -20
```

`VSZ` 很大不一定代表真实物理内存占用很大；排查实际内存压力时 RSS 通常更有参考意义。

但对 Java、数据库、共享内存、mmap 很重的程序，仅看单个 RSS 仍然可能不完整，需要结合应用自身监控。

## top 适合看动态变化

```bash
top
```

它的价值不是截图某一刻，而是观察：

- CPU 是否持续高；
- 某个进程是否周期性冲高；
- load 是否持续上涨；
- 内存和 swap 是否不断恶化；
- 是否存在大量僵尸进程。

一次 `ps` 是静态快照，`top` 是动态趋势。排障时两者视角互补。

## vmstat 可以快速判断“CPU 忙”还是“在等”

```bash
vmstat 1
```

常用观察点包括：

- `r`：可运行队列；
- `si/so`：swap in/out；
- `us/sy`：用户态 / 内核态 CPU；
- `id`：idle；
- `wa`：I/O wait。

如果 load 很高，但 CPU idle 仍然不少，同时 I/O wait 或不可中断任务明显，就不应该把问题简单归因于“CPU 不够”。

## 高 load 但 CPU 不高时，检查 D 状态

进程状态中的 `D` 通常表示不可中断睡眠，经常与 I/O、块设备、网络文件系统等等待有关。

查看：

```bash
ps -eo state,pid,ppid,wchan:32,cmd | awk '$1 ~ /^D/'
```

如果大量任务卡在 D 状态，应该继续检查磁盘、NFS、挂载或内核 I/O，而不是只增加 CPU。

## Swap 有使用不一定等于故障

```bash
free -h
swapon --show
```

系统曾经把冷页换出，之后即使内存压力解除，swap 仍可能保持一部分使用。

真正值得警惕的是**持续发生大量 swap in/out**，这通常意味着活跃工作集已经超过物理内存可承载范围。

可用：

```bash
vmstat 1
```

观察 `si` / `so` 是否持续出现。

## OOM 要去内核日志确认

进程突然消失、systemd 显示被 signal 杀死时，不要只看应用日志。

```bash
journalctl -k -b | grep -Ei 'out of memory|oom|killed process'
```

如果确实发生 OOM Killer，应继续回答：

- 是整个主机内存耗尽，还是 cgroup/container limit；
- 哪个进程触发压力；
- 是否存在泄漏；
- JVM/数据库缓存是否配置过大；
- 容器 limit 是否过小。

只把服务 `Restart=always` 会让它恢复，但不会解决持续 OOM 的根因。

## systemd 服务和容器还要看 cgroup 边界

现代 Linux 上，很多资源限制最终通过 cgroup 生效。

对于 systemd 服务：

```bash
systemctl status <service>
systemctl show <service> -p MemoryCurrent -p MemoryMax -p CPUQuotaPerSecUSec
```

对于容器：

```bash
docker stats
```

宿主机整体还有很多内存，但容器仍然 OOM，往往就是因为**局部资源限制**已经触顶。

## 进程不响应时不要把 kill -9 当第一选择

正常终止：

```bash
kill <PID>
```

默认发送 SIGTERM，给应用清理资源、关闭连接和刷盘的机会。

只有进程无法正常退出且明确需要强制结束时，才考虑：

```bash
kill -9 <PID>
```

如果进程由 systemd、Docker 或 Kubernetes 管理，优先通过上层管理器停止。否则它可能马上又被拉起。

## 三类常见问题的判断路径

### CPU 长时间 100%

1. `uptime` + `nproc` 看整体压力；
2. `ps --sort=-%cpu` 找进程；
3. `top` 观察是否持续；
4. 确认是单进程、线程池还是多个 Worker；
5. 再进入应用级 profiling、SQL、GC、死循环等分析。

### 内存不断上涨

1. `free -h` 看 available 和 swap；
2. `ps --sort=-rss` 找进程；
3. 观察一段时间，确认是持续增长而非缓存；
4. 查 cgroup/container limit；
5. 查 OOM 日志；
6. 再进入堆、缓存、连接池等应用内部分析。

### load 很高但 CPU 并不满

1. `vmstat 1` 看 `r`、`wa`、`si/so`；
2. 查 D 状态进程；
3. 检查磁盘、NFS、挂载、网络存储；
4. 再结合 I/O 工具继续下钻。

## 资源排障的目标是找到“等待什么”

系统变慢本质上通常只有两类：

- 某种资源已经饱和；
- 任务在等待某个外部条件。

CPU、内存、磁盘、网络只是不同资源。与其看到指标高就杀进程，不如先回答：**哪些任务在运行，哪些任务在等待，它们在等待什么。** 这个问题一旦回答清楚，后面的优化方向通常也就清楚了。