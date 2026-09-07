# Linux 定时任务：cron、systemd Timer 与“为什么脚本手工能跑，定时却失败”

定时任务看起来很简单：到了某个时间执行一条命令。但真正进入生产环境后，问题往往不在时间表达式，而在运行环境、并发、失败处理、日志和补跑机制。

Linux 上最常见的两套方案是 cron 与 systemd Timer。前者历史悠久、简单直接；后者与现代服务管理体系结合得更紧密。

理解它们时，不应该只问“怎么写每 5 分钟执行一次”，而应该先明确：**谁执行、在什么环境执行、失败后谁知道、错过执行窗口怎么办、上一次还没结束怎么办。**

## cron 在解决什么问题

cron 适合表达周期性任务，例如：

```text
每天 2:00 做备份
每 5 分钟采集一次指标
每周日清理旧文件
每月 1 日生成报表
```

用户级任务通常通过：

```bash
crontab -e
```

查看：

```bash
crontab -l
```

基本格式：

```text
分 时 日 月 周 命令
```

例如每天凌晨 2:30：

```text
30 2 * * * /opt/scripts/backup.sh
```

每 5 分钟：

```text
*/5 * * * * /opt/scripts/collect.sh
```

## cron 最重要的坑：它不是你的交互 Shell

很多脚本手工执行完全正常，放进 cron 就失败。

最常见原因是环境不同。

你登录 Shell 里可能有：

```text
PATH
JAVA_HOME
PYTHONPATH
代理变量
虚拟环境
用户自定义 alias/function
```

而 cron 默认环境通常非常精简。

因此这条：

```text
*/5 * * * * python app.py
```

可能找不到正确的 Python。

更稳妥：

```text
*/5 * * * * /usr/bin/python3 /opt/app/app.py
```

如果依赖虚拟环境：

```text
*/5 * * * * /opt/app/.venv/bin/python /opt/app/job.py
```

对于 Java、Node、数据库客户端等也是一样：尽量使用明确的绝对路径和显式环境变量。

## 工作目录也经常被忽略

脚本里写：

```bash
cat ./config.yaml
```

你手工执行时当前目录可能正好是 `/opt/app`，但 cron 的工作目录未必如此。

因此脚本应该自己切换目录：

```bash
cd /opt/app || exit 1
```

或者尽量使用绝对路径：

```bash
cat /opt/app/config.yaml
```

生产脚本不应该依赖“执行者刚好站在哪个目录”。

## cron 输出去哪了

cron 执行命令时没有普通终端。

如果 stdout/stderr 没有明确处理，某些系统会尝试通过本地邮件发送，也有系统因为没有 MTA 而让这些信息几乎不可见。

所以建议显式记录日志：

```text
*/5 * * * * /opt/scripts/job.sh >> /var/log/myjob.log 2>&1
```

但日志写文件之后，还要考虑轮转，否则定时任务本身可能最终把磁盘写满。

如果机器已经使用 systemd，Timer + journald 通常可以让日志管理更统一。

## 系统级 cron 和用户 crontab 不是完全同一种格式

用户执行：

```bash
crontab -e
```

没有“用户”字段。

但：

```text
/etc/crontab
/etc/cron.d/*
```

通常会额外包含执行用户。

例如：

```text
*/10 * * * * backup /usr/local/bin/backup-job
```

这里 `backup` 表示任务身份。

排查 cron 时一定要先确认任务到底来自哪里：

```text
用户 crontab？
/etc/crontab？
/etc/cron.d？
发行版提供的 cron.daily？
应用自己的定时器？
```

## 如何确认 cron 到底有没有执行

不同发行版日志位置不同。

systemd 系统可以先看：

```bash
journalctl -u cron
```

或者：

```bash
journalctl -u crond
```

传统日志可能在：

```text
/var/log/syslog
/var/log/cron
```

排查时应区分两件事：

```text
cron 没有触发
```

和：

```text
cron 触发了，但脚本执行失败
```

前者看调度器日志，后者看任务自身 stdout/stderr 和退出码。

## 定时任务最容易制造的生产事故：重叠执行

假设任务每 5 分钟执行一次：

```text
*/5 * * * * /opt/scripts/sync.sh
```

但某次同步耗时 12 分钟。

这意味着：

```text
00 分：任务 A 开始
05 分：任务 B 开始
10 分：任务 C 开始
12 分：任务 A 才结束
```

如果脚本会写同一批文件、更新同一张表或清理同一目录，就可能造成并发冲突。

一个简单控制方式是 `flock`：

```text
*/5 * * * * flock -n /run/sync-job.lock /opt/scripts/sync.sh
```

`-n` 表示锁已经被占用时立即失败，而不是继续等待。

也可以在脚本里自己实现锁，但不要只用“判断某个 PID 文件是否存在”而不处理进程异常退出后的陈旧锁。

## cron 错过执行时间通常不会自动补跑

如果每天 2:00 的 cron 任务执行时服务器正好关机：

```text
2:00 服务器关机
3:00 服务器启动
```

传统 cron 通常不会因为“刚才错过了”就在 3:00 自动补一次。

如果任务要求“机器恢复后也必须执行一次”，可以考虑：

- `anacron`；
- systemd Timer 的 `Persistent=true`；
- 应用自身调度器。

这也是现代系统上 Timer 很有价值的一点。

## systemd Timer 的基本模型

systemd Timer 不是直接执行命令，而是触发另一个 Unit，通常是 `.service`。

例如：

```text
backup.timer
    ↓
backup.service
    ↓
/usr/local/bin/backup.sh
```

这样定时任务和普通 systemd 服务共享同一套：

- 用户身份；
- 环境变量；
- 日志；
- 资源限制；
- 依赖关系；
- 失败状态。

## 一个完整 Timer 示例

服务：

```ini
# /etc/systemd/system/backup.service
[Unit]
Description=Run backup job

[Service]
Type=oneshot
User=backup
ExecStart=/usr/local/bin/backup.sh
```

定时器：

```ini
# /etc/systemd/system/backup.timer
[Unit]
Description=Run backup every day

[Timer]
OnCalendar=*-*-* 02:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

加载并启用：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now backup.timer
```

查看：

```bash
systemctl list-timers --all
```

查看下一次触发时间：

```bash
systemctl status backup.timer
```

## Timer 为什么更适合复杂任务

执行日志直接进入 journal：

```bash
journalctl -u backup.service
```

手工测试实际执行单元：

```bash
sudo systemctl start backup.service
```

查看结果：

```bash
systemctl status backup.service
```

这比 cron 中“等到下一个时间点再看有没有跑”更容易调试。

## Persistent=true 解决什么问题

Timer 配置：

```ini
Persistent=true
```

意味着如果系统关机期间错过了日历型定时任务，systemd 会记录最近执行状态，并在系统恢复后尽快补触发。

它非常适合：

```text
每天必须做一次备份
每天必须清理一次数据
每周必须生成一次汇总
```

但不适合所有任务。

例如“每 5 分钟采集实时指标”，服务器关机 2 小时后没有必要把错过的 24 次全部补回来。

调度语义应该根据业务目标决定，而不是机械打开某个选项。

## 随机延迟可以避免大量机器同时执行

如果 500 台服务器全部配置：

```text
每天 02:00 拉取更新
```

可能在 02:00 瞬间把仓库、数据库或备份服务压满。

systemd Timer 可以加入：

```ini
RandomizedDelaySec=30m
```

让任务分散在一个时间窗口内执行。

这类“打散调度”在大规模服务器环境中特别有价值。

## cron 和 Timer 应该怎么选

简单地说：

```text
很短、很简单、系统兼容要求高
  → cron 很合适

任务属于一个正式系统服务
需要统一日志、身份、资源控制
需要补跑、依赖或更丰富调度
  → systemd Timer 更自然
```

不要为了“现代化”把所有 cron 都改成 Timer；也不要因为 cron 写起来短，就把复杂生产任务永远塞在一行 crontab 中。

## 高频场景：脚本手工能跑，cron 失败

按这个顺序排查：

```text
cron 是否真的触发？
   ↓
任务以哪个用户运行？
   ↓
PATH / HOME / 环境变量是否一致？
   ↓
工作目录是否一致？
   ↓
命令是否使用绝对路径？
   ↓
stdout/stderr 在哪里？
```

可以在任务中临时记录环境：

```bash
env
pwd
id
```

再与交互 Shell 比较。

很多所谓“cron 玄学问题”，最终只是环境不同。

## 高频场景：备份任务偶尔重复、目录被清错

第一步检查任务是否重叠：

```bash
pgrep -af backup.sh
```

然后检查调度频率与实际耗时。

如果任务不能并发运行，应显式加锁；如果任务执行时间经常接近调度间隔，说明调度设计本身就需要重新评估，而不仅是补一个 `flock`。

## 定时任务上线前应该验证什么

至少确认：

```text
手工以目标用户执行是否成功？
退出码是否正确？
日志是否可追踪？
是否可能重复执行？
失败后是否有重试或告警？
机器关机错过后是否需要补跑？
脚本是否依赖交互环境？
```

定时任务真正危险的地方是“平时没人盯着它”。因此可观测性和失败语义往往比时间表达式更重要。

## 最重要的理解方式

无论 cron 还是 systemd Timer，本质上都只是调度器。

真正需要设计的是完整任务生命周期：

```text
什么时候触发？
     ↓
以谁的身份执行？
     ↓
环境和工作目录是什么？
     ↓
上一次没结束怎么办？
     ↓
失败如何记录和发现？
     ↓
错过执行窗口要不要补？
```

当这些问题都明确以后，选择 cron 还是 Timer 反而只是实现细节。