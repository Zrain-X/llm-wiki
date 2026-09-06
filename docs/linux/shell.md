# Linux / Shell 速查

## 清 DNS 缓存

```bash
sudo resolvectl flush-caches
```

如果实际使用 `nscd` / `dnsmasq`：

```bash
sudo systemctl restart nscd
sudo systemctl restart dnsmasq
```

## 端口

```bash
ss -lntp
ss -lnup
sudo lsof -i :8080
```

看到 `containerd-shim` 时不要直接杀进程，继续反查容器。

## 磁盘

```bash
df -hT
du -h --max-depth=1 . | sort -h
```

找大文件：

```bash
find /path -type f -size +1G -printf '%s %p\n' 2>/dev/null | sort -n
```

## 批量替换 `.strm`

先预览：

```bash
grep -R --include='*.strm' -nF 'old-string' /path/to/media
```

再替换：

```bash
find /path/to/media -type f -name '*.strm' -print0 \
  | xargs -0 sed -i 's#old-string#new-string#g'
```

## systemd

```bash
systemctl status <service> --no-pager
journalctl -u <service> -n 200 --no-pager
journalctl -u <service> -f
systemctl cat <service>
```

## 资源

```bash
free -h
uptime
lsblk -f
ps aux --sort=-%cpu | head
ps aux --sort=-%mem | head
```

## 网络

```bash
curl -v https://example.com/
nc -vz host 443
dig example.com
ip route
ip -6 route
```
