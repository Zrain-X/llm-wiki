# Linux / Shell 速查

## 清 DNS 缓存

### systemd-resolved

```bash
sudo resolvectl flush-caches
```

旧系统也可能使用：

```bash
sudo systemd-resolve --flush-caches
```

如果机器实际运行的是 `nscd` / `dnsmasq`，需要重启对应服务：

```bash
sudo systemctl restart nscd
sudo systemctl restart dnsmasq
```

先看谁在提供 DNS：

```bash
systemctl status systemd-resolved nscd dnsmasq --no-pager
```

## 查端口监听

```bash
ss -lntp
```

查指定端口：

```bash
ss -lntp | grep ':8080 '
```

UDP：

```bash
ss -lnup
```

## 查端口是谁占的

```bash
sudo lsof -i :8080
```

或者：

```bash
sudo fuser -v 8080/tcp
```

看到 `containerd-shim` 时，不要直接杀 shim，继续反查它属于哪个容器/Pod。

## 查磁盘

文件系统：

```bash
df -hT
```

当前目录一级占用：

```bash
du -h --max-depth=1 . | sort -h
```

找大文件：

```bash
find /path -type f -size +1G -printf '%s %p\n' 2>/dev/null | sort -n
```

## 批量替换 `.strm` 文件内容

先预览：

```bash
grep -R --include='*.strm' -nF 'old-string' /path/to/media
```

确认后替换（GNU sed）：

```bash
find /path/to/media -type f -name '*.strm' -print0 \
  | xargs -0 sed -i 's#old-string#new-string#g'
```

路径中常有 `/`，所以这里故意用 `#` 当分隔符。

危险操作建议先做备份或先对一个小目录验证。

## systemd 服务

状态：

```bash
systemctl status <service> --no-pager
```

最近日志：

```bash
journalctl -u <service> -n 200 --no-pager
```

持续跟踪：

```bash
journalctl -u <service> -f
```

看启动命令：

```bash
systemctl cat <service>
```

## 快速看机器资源

```bash
free -h
uptime
lsblk -f
```

进程：

```bash
ps aux --sort=-%cpu | head
ps aux --sort=-%mem | head
```

如果装了：

```bash
htop
```

## 网络连通

```bash
curl -v https://example.com/
```

TCP：

```bash
nc -vz host 443
```

DNS：

```bash
dig example.com
```

路由：

```bash
ip route
ip -6 route
```
