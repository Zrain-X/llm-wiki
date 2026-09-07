# Linux 日志体系：journald、传统日志与 logrotate

Linux 排障经常从一句“看日志”开始，但日志并不是一个单独的文件。现代 Linux 上至少同时存在几种常见路径：应用自己写文件、systemd-journald 收集服务输出、rsyslog 把消息转存到传统日志文件，以及 logrotate 对不断增长的日志进行轮转。

真正高效的做法，是先判断**日志由谁产生、被谁收集、最终存在哪里、由谁负责清理**。

## 日志体系解决了什么问题

运行中的程序会不断产生状态信息：

- 服务什么时候启动和停止；
- 请求为什么失败；
- 内核发现了什么硬件或网络异常；
- 哪个用户执行了什么认证操作；
- 应用内部发生了什么业务错误。

如果所有信息都只打印在启动服务的终端里，一旦终端关闭或服务器重启，现场就会消失。

因此日志系统需要解决四件事：

```text
产生日志
   ↓
收集日志
   ↓
保存 / 查询
   ↓
轮转 / 清理
```

## 现代 systemd 系统中的 journald

systemd 通常会启动 `systemd-journald`，负责收集多种日志来源，包括：

- systemd 服务的 stdout / stderr；
- 内核日志；
- syslog 接口消息；
- 部分审计信息。

因此一个 systemd 服务即使没有配置单独日志文件，只要程序正常输出日志，通常也可以通过：

```bash
journalctl -u nginx
```

查看。

这也是为什么排查 systemd 服务时，`journalctl` 往往比先去 `/var/log` 搜文件更直接。

## journalctl 最常用的查询思路

### 看某个服务

```bash
journalctl -u myapp
```

只看最近 200 行：

```bash
journalctl -u myapp -n 200 --no-pager
```

实时跟踪：

```bash
journalctl -u myapp -f
```

### 看某个时间段

```bash
journalctl --since '2026-09-07 10:00:00' --until '2026-09-07 11:00:00'
```

相对时间也很方便：

```bash
journalctl --since '30 min ago'
```

排障时建议尽量缩小时间窗口。一个运行几个月的服务直接 `journalctl -u xxx`，通常只会得到大量无关信息。

### 看本次启动

```bash
journalctl -b
```

上一次启动：

```bash
journalctl -b -1
```

这对“服务器重启前到底发生了什么”尤其有用。

### 看内核日志

```bash
journalctl -k
```

等价思路类似 `dmesg`，但 journald 可以提供更统一的时间和过滤能力。

例如磁盘、OOM、网卡异常等系统问题往往应该先检查这里。

## journal 不是简单文本文件

journald 通常使用结构化的二进制日志格式。除了日志正文，它还保存很多元数据，例如：

- `_SYSTEMD_UNIT`；
- `_PID`；
- `_UID`；
- `_COMM`；
- boot ID；
- priority。

因此可以做结构化过滤：

```bash
journalctl _PID=1234
```

或者：

```bash
journalctl _SYSTEMD_UNIT=nginx.service
```

这也是 journald 相比“所有程序往一个文本文件 append”更强的地方。

## 为什么有些机器重启后 journal 不见了

journald 可以使用两种主要存储方式：

```text
/run/log/journal    临时，通常位于内存文件系统
/var/log/journal    持久化
```

查看配置：

```bash
grep -E '^Storage=' /etc/systemd/journald.conf
```

`Storage=auto` 时，如果 `/var/log/journal` 存在，通常会使用持久化存储；否则可能只保存在 `/run`。

可以查看当前占用：

```bash
journalctl --disk-usage
```

清理旧日志：

```bash
journalctl --vacuum-time=14d
```

或者按空间限制：

```bash
journalctl --vacuum-size=1G
```

正式环境更推荐通过 `journald.conf` 设计长期策略，而不是磁盘满后手工清。

## `/var/log` 里的传统日志从哪里来

很多发行版仍然保留传统文本日志，例如：

```text
/var/log/syslog
/var/log/messages
/var/log/auth.log
/var/log/secure
/var/log/cron
```

不同发行版文件名并不完全一致。

这些日志通常与 rsyslog、syslog-ng 等日志守护程序有关。它们可以接收 syslog 消息，再根据 facility、priority 等规则写到不同文件或转发到远程日志服务器。

因此：

> `journalctl` 和 `/var/log/syslog` 并不一定是两套完全独立的日志源，它们可能是在不同组件中对同一部分系统消息进行收集和持久化。

## 应用自己写日志文件又是另一层

例如 Nginx 常见：

```text
/var/log/nginx/access.log
/var/log/nginx/error.log
```

数据库、中间件和业务程序也经常自己维护日志目录。

这时日志生命周期通常变成：

```text
应用
  ↓
/var/log/myapp/app.log
  ↓
logrotate
```

与 journald 不同，应用自己写文件时，systemd 并不知道这个文件应该保留多少天，也不会自动帮你轮转。

## logrotate 解决什么问题

一个不断运行的服务如果永远向同一个日志文件追加内容：

```text
app.log
```

文件最终可能达到几十 GB，甚至把磁盘写满。

logrotate 的目标是把日志生命周期自动化：

```text
app.log
   ↓ 达到时间/大小条件
app.log.1
app.log.2.gz
app.log.3.gz
...
   ↓
删除超出保留数量的旧文件
```

主配置通常是：

```text
/etc/logrotate.conf
```

应用规则通常放在：

```text
/etc/logrotate.d/
```

## 一个典型 logrotate 配置

例如：

```text
/var/log/myapp/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 app app
}
```

可以理解为：

- `daily`：每天判断一次轮转；
- `rotate 14`：保留 14 份旧日志；
- `compress`：压缩旧日志；
- `delaycompress`：延迟一代再压缩；
- `missingok`：文件不存在也不报错；
- `notifempty`：空文件不轮转；
- `create`：轮转后创建新的日志文件并设置权限。

如果希望按大小：

```text
size 100M
```

也可以组合时间和大小策略，但需要理解 `size`、`minsize`、`maxsize` 的触发差异，避免以为“写了 daily 就一定每天轮转”。

## 最容易误用的 copytruncate

有些应用打开日志文件后不会主动重新打开。如果直接把旧文件 rename 掉，程序可能继续向已经被重命名的文件描述符写入。

一种简单方案是：

```text
copytruncate
```

它大致会：

```text
复制当前日志 → 旧日志
截断原日志文件 → 0 字节
```

好处是不需要通知应用重新打开日志。

缺点是在复制和截断之间存在竞争窗口，高并发日志可能发生少量丢失或重复。

更理想的方式通常是：

1. rename 日志；
2. 向应用发送信号或执行 reload；
3. 让应用重新打开新的日志文件。

例如 logrotate 支持：

```text
postrotate
    systemctl reload myapp >/dev/null 2>&1 || true
endscript
```

前提是应用确实支持安全的日志 reopen/reload。

## “删除日志后磁盘为什么没释放”

这是非常典型的 Linux 问题。

如果进程已经打开一个文件：

```text
进程 ── fd ──> app.log
```

此时执行：

```bash
rm app.log
```

只是删除了目录中的文件名。只要进程仍持有文件描述符，底层数据块仍然存在。

于是会出现：

```bash
df -h
```

显示磁盘很满，但：

```bash
du -sh /var/log
```

却找不到对应空间。

可以检查：

```bash
sudo lsof +L1
```

或者：

```bash
sudo lsof | grep '(deleted)'
```

找到仍持有 deleted 文件的进程后，通常需要让程序重新打开日志或重启对应服务，而不是继续删除更多文件。

## 日志排障应该先问什么

遇到一个服务异常，推荐先回答：

```text
它由 systemd 启动吗？
   ├─ 是 → journalctl -u service
   └─ 否
       ↓
应用是否配置自己的日志文件？
   ├─ 是 → 找应用日志目录
   └─ 否 → 看启动终端 / 容器日志 / syslog
```

接着再缩小时间：

```bash
journalctl -u myapp --since '10 min ago'
```

如果是传统文件：

```bash
tail -n 200 /var/log/myapp/app.log
```

实时观察：

```bash
tail -F /var/log/myapp/app.log
```

`-F` 比简单的 `-f` 更适合会发生轮转的日志文件，因为文件被替换后它会尝试重新跟踪文件名。

## 高频场景：磁盘突然被日志打满

可以按照下面的顺序：

```bash
df -hT
```

确认是哪一个文件系统满了。

然后：

```bash
du -xhd1 /var | sort -h
```

继续定位大目录。

如果 `/var/log` 并没有对应大小，再检查 deleted 但仍打开的文件：

```bash
sudo lsof +L1
```

最后再确认轮转机制：

```bash
logrotate -d /etc/logrotate.conf
```

`-d` 用于调试，不实际执行轮转，非常适合先检查规则为什么没有生效。

强制测试某项配置时可以使用 `-f`，但生产环境执行前应确认影响范围。

## 最重要的理解方式

Linux 日志不是“去 `/var/log` 找文件”这么简单。更稳定的思路是顺着链路看：

```text
谁产生？
   ↓
stdout/stderr、syslog 还是应用文件？
   ↓
谁收集？journald / rsyslog / 应用自身？
   ↓
存在哪里？
   ↓
谁负责轮转与清理？
```

只要把这四层搞清楚，大多数“日志在哪”“为什么没日志”“为什么磁盘被日志写满”的问题都会变得很容易定位。
