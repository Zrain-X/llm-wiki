# 端口、Socket 与进程定位

“8080 端口被占用”“服务启动了但访问不到”“看到 containerd-shim 能不能杀”——这些问题本质上都在问同一件事：**某个网络 Socket 现在处于什么状态，它由谁创建，流量最终会到哪里。**

因此排查端口时，不应该只盯着端口号，还要同时看监听地址、协议、进程和容器/代理层。

## 端口不是进程，Socket 才是连接点

一个服务通常创建 TCP 或 UDP Socket，并把它绑定到某个地址和端口，例如：

```text
127.0.0.1:8080
0.0.0.0:8080
[::]:8080
```

它们的含义并不相同：

- `127.0.0.1:8080`：通常只有本机 IPv4 能访问；
- `0.0.0.0:8080`：监听本机所有 IPv4 地址；
- `[::]:8080`：监听 IPv6 通配地址，在不同系统配置下也可能同时接受 IPv4 映射连接。

所以“程序已经监听 8080”并不能自动推出“局域网其他机器能访问 8080”。监听地址必须一起看。

## `ss` 是查看 Socket 状态的第一入口

查看 TCP 监听：

```bash
sudo ss -lntp
```

常用选项可以拆开理解：

- `-l`：只看 listening；
- `-n`：不做名字解析，直接显示数字地址和端口；
- `-t`：TCP；
- `-u`：UDP；
- `-p`：显示关联进程。

UDP：

```bash
sudo ss -lnup
```

只查 8080：

```bash
sudo ss -lntp 'sport = :8080'
```

查看已经建立的 TCP 连接：

```bash
ss -ntp
```

这时要注意区分 `LISTEN`、`ESTAB`、`TIME-WAIT` 等状态。`TIME-WAIT` 很多通常意味着近期有大量短连接，并不等于“某个进程还占着监听端口”。

## `lsof` 适合从“端口”反查进程

```bash
sudo lsof -nP -iTCP:8080 -sTCP:LISTEN
```

这里 `-nP` 可以避免 DNS 和服务名解析，让结果更直接。

如果想看一个进程打开了哪些网络连接：

```bash
sudo lsof -nP -a -p <PID> -i
```

这与 `ss` 的视角不同：

- `ss` 更像从内核 Socket 表观察网络状态；
- `lsof` 更像从进程打开的文件描述符反查 Socket。

两者结果能互相印证。

## 端口冲突时不要直接 `kill -9`

假设应用报：

```text
address already in use
```

先查：

```bash
sudo ss -lntp 'sport = :8080'
```

再确认进程是什么：

```bash
ps -fp <PID>
```

如果由 systemd 管理：

```bash
systemctl status <service>
systemctl cat <service>
```

应该通过服务管理器停止或修改它：

```bash
sudo systemctl stop <service>
```

直接杀 PID 可能马上被 systemd 自动拉起，于是看起来像“进程杀不掉”。这其实是生命周期管理机制在生效。

## 看到 containerd-shim 时为什么不能直接杀

容器环境里，宿主机进程和实际业务容器之间多了一层运行时关系。

如果端口相关进程看起来属于 Docker/containerd，先查容器：

```bash
docker ps --format 'table {{.ID}}\t{{.Names}}\t{{.Ports}}'
```

继续检查：

```bash
docker inspect <container>
```

需要停止时使用：

```bash
docker stop <container>
```

`containerd-shim` 的职责与容器生命周期相关。直接杀 shim 可能破坏运行时对容器状态的管理，而没有解决“为什么这个容器会存在、为什么它映射这个端口”的根因。

正确思路始终是：**先从进程反查服务或容器，再由上层管理器处理生命周期。**

## 端口监听正常，不代表外部一定能访问

假设：

```bash
ss -lntp
```

显示：

```text
0.0.0.0:8080
```

但远端访问超时，下一层就不应该继续纠结“有没有进程”，而是检查：

- 本机防火墙；
- 云安全组；
- 路由；
- NAT/端口映射；
- Docker 网络；
- 反向代理配置；
- 远端到本机的真实链路。

从远端测试 TCP：

```bash
nc -vz host 8080
```

如果本机 `curl 127.0.0.1:8080` 正常、局域网访问失败，监听地址或防火墙就比应用代码更值得优先检查。

## `connection refused` 和 `timeout` 指向不同方向

### Connection refused

通常意味着网络包已经到达目标主机，但该地址/端口没有接受连接，或者防火墙主动 reject。

优先检查：

```bash
ss -lntp
```

以及服务状态。

### Timeout

更常见于包被静默丢弃、路由不通、防火墙 drop、安全组、NAT 或对端完全不可达。

这时继续看：[Linux 网络连通性排障](/linux/network-troubleshooting)。

## IPv4 与 IPv6 经常制造“本机正常，其他地方不正常”

检查某个服务到底绑定在哪一族地址：

```bash
ss -lntp
```

测试 IPv4 / IPv6：

```bash
curl -4 http://example.com:8080/
curl -6 http://example.com:8080/
```

如果域名同时有 A 和 AAAA，而 IPv6 路由坏掉，就可能表现为部分客户端很慢、部分客户端直接失败。

## 端口排查的一条完整链路

遇到“服务访问不到”时，可以按下面的顺序：

1. `systemctl status` / `docker ps`：服务或容器是否存在；
2. `ss -lntp`：是否真的创建监听 Socket；
3. 看绑定地址：127.0.0.1、0.0.0.0 还是 `::`；
4. `curl` 本机地址：应用协议是否能响应；
5. 从远端 `nc -vz`：TCP 是否能到达；
6. 再查防火墙、NAT、反向代理和路由；
7. 最后才考虑重启、杀进程或改端口。

只要把“进程 → Socket → 本机网络 → 外部网络”这条链路拆开，绝大多数端口问题都会从模糊的“访问不了”变成可以逐层验证的状态。