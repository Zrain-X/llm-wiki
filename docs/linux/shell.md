# Linux 运维速查：从现象快速进入专题

这页不是完整的 Linux 命令手册，而是一张**故障现场导航图**：先用少量高频命令判断问题大致落在哪一层，再进入对应专题理解原理和继续排查。

真正高效的 Linux 运维并不是记住更多命令，而是建立“**现象 → 层次 → 证据 → 下一步**”的判断习惯。

## 服务启动失败或反复重启

先确认 systemd 看到的服务状态和最近日志：

```bash
systemctl status <service> --no-pager
journalctl -u <service> -n 200 --no-pager
systemctl cat <service>
```

如果要自己创建服务、修改启动参数、设置自动重启或定时任务，进入：[systemd：Linux 服务的生命周期管理](/linux/systemd)。

## CPU、内存或系统负载异常

先判断是整机资源紧张，还是某个进程异常：

```bash
uptime
free -h
ps aux --sort=-%cpu | head
ps aux --sort=-%mem | head
```

不要看到 `load average` 高就直接等同于 CPU 满载，也不要看到 `free` 很小就判断内存不足。进入：[CPU、内存、负载与进程排查](/linux/process-resource)。

## 磁盘空间不足

先区分“哪个文件系统满了”和“哪个目录占得多”：

```bash
df -hT
lsblk -f
du -xhd1 /path | sort -h
```

查找大文件：

```bash
find /path -xdev -type f -size +1G -printf '%s %p\n' 2>/dev/null | sort -n
```

如果 `df` 很满但 `du` 找不到空间、inode 用尽或删除文件后空间不释放，进入：[磁盘、文件系统与空间排查](/linux/disk-filesystem)。

## 端口被占用或服务明明启动却访问不到

先确认端口是否真的监听，以及监听者是谁：

```bash
ss -lntp
ss -lnup
sudo lsof -nP -iTCP:8080 -sTCP:LISTEN
```

看到 `containerd-shim`、Docker Proxy 或容器相关进程时，不要直接杀进程，应继续反查容器和端口映射。进入：[端口、Socket 与进程定位](/linux/ports-processes)。

## 域名解析异常

先分别观察“系统实际解析结果”和“DNS 服务器直接返回结果”：

```bash
getent hosts example.com
resolvectl query example.com
dig example.com
```

清理 `systemd-resolved` 缓存：

```bash
sudo resolvectl flush-caches
```

如果使用 `nscd` / `dnsmasq`，缓存可能在其他层。进入：[DNS 解析链路与缓存排障](/linux/dns-troubleshooting)。

## 网络不通、超时或 HTTPS 异常

不要只用 `ping` 判断网络。沿着路由、TCP、TLS/HTTP 逐层检查：

```bash
ip route
ip route get 1.1.1.1
nc -vz host 443
curl -v https://example.com/
```

IPv6 相关问题再检查：

```bash
ip -6 route
curl -4 https://example.com/
curl -6 https://example.com/
```

进入：[Linux 网络连通性排障](/linux/network-troubleshooting)。

## 文本替换或批量修改配置

单文件替换先理解 `sed`：

```bash
sed 's#old-string#new-string#g' file
```

确认输出正确后再考虑原地修改。进入：[sed：面向文本流的编辑器](/linux/sed)。

如果任务是“先找出一批文件，再筛内容，再批量执行命令”，进入：[grep、find 与 xargs：Linux 批处理三件套](/linux/grep-find-xargs)。

例如批量替换 `.strm` 文件时，建议先预览：

```bash
grep -R --include='*.strm' -nF 'old-string' /path/to/media
```

再执行：

```bash
find /path/to/media -type f -name '*.strm' -print0 \
  | xargs -0 sed -i 's#old-string#new-string#g'
```

> macOS/BSD `sed` 的 `-i` 参数与 GNU sed 不完全相同，跨平台脚本不要直接照搬。具体差异见 sed 专题。

## 一套通用排障顺序

遇到陌生故障时，可以先按下面的顺序收窄范围：

1. **确认现象**：失败的是进程、端口、DNS、网络、磁盘还是资源。
2. **确认状态**：用 `systemctl`、`ss`、`df`、`free`、`ip` 等读取当前状态，而不是先修改系统。
3. **找直接证据**：日志、监听 Socket、路由、解析结果、进程资源占用。
4. **建立因果链**：例如“服务退出 → systemd 重启 → 端口短暂消失”，而不是把三个现象当成三个独立问题。
5. **最后再修改**：先验证判断，再重启、清缓存、删文件或改配置。

这也是本分类各专题文章共同采用的思路。