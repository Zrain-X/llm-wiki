# Linux 网络连通性排障

网络故障最常见的问题不是命令不够，而是排查层次混在一起：`ping` 不通就认为服务器挂了，`curl` 超时就认为 DNS 有问题，TLS 报错又去重启网卡。

更稳定的方式是把一次访问拆成几层：

```text
本机接口 → 路由 → DNS → TCP/UDP → TLS → HTTP/应用
```

每一层都用对应证据验证，问题就会快速缩小。

## 第一层：本机有没有正确的地址和接口

```bash
ip addr
ip link
```

重点不是把全部输出读完，而是确认：

- 目标网卡是否 `UP`；
- 是否拿到了预期 IPv4/IPv6 地址；
- 地址是否在正确网段；
- 是否出现意外 VPN/Tunnel 接口改变流量路径。

只看 `ifconfig` 的时代已经过去，现代 Linux 运维更推荐 `ip` 工具族。

## 第二层：系统准备把包发到哪里

查看路由表：

```bash
ip route
ip -6 route
```

比整张路由表更有用的是直接问内核：

```bash
ip route get 1.1.1.1
```

它会告诉你到目标地址时准备使用的网关、接口和源地址。

如果服务器有多张网卡、策略路由、VPN、Tailscale 或容器网络，这一步尤其重要。

“机器有默认路由”不等于“这个目标一定走默认路由”。

## ping 只能证明 ICMP 的一部分，不代表应用端口

```bash
ping host
```

它适合快速观察：

- 是否有基础 IP 连通；
- RTT 是否异常；
- 是否有明显丢包。

但很多防火墙会禁止 ICMP，而 TCP 443 仍然完全正常。因此：

```text
ping 不通 ≠ HTTPS 不通
ping 通    ≠ 业务端口正常
```

不要把 ping 当成网络诊断的最终结论。

## 第三层：域名是否解析到预期地址

```bash
getent hosts example.com
```

需要进一步检查时：

```bash
resolvectl query example.com
dig example.com
```

DNS 本身是一条独立链路，详见：[DNS 解析链路与缓存排障](/linux/dns-troubleshooting)。

一个很实用的验证方式是绕过 DNS，直接测试 IP，以区分“解析失败”和“网络失败”。

## 第四层：TCP 端口到底能不能建立连接

```bash
nc -vz host 443
```

典型结果可以粗略理解为：

### succeeded

TCP 三次握手成功。接下来如果应用仍失败，应继续查 TLS、HTTP 或应用协议。

### connection refused

目标通常可达，但该端口没有服务接受连接，或中间设备主动 reject。

优先去目标服务器看：

```bash
ss -lntp
```

### timeout

更像流量被静默丢弃，常见方向包括防火墙、安全组、路由、NAT、链路黑洞。

不同报错对应不同层次，不应该都归类成“网络不通”。

## 第五层：用 curl 直接观察 HTTP/TLS 过程

```bash
curl -v https://example.com/
```

`-v` 会展示很多关键阶段：

- 解析到了哪个地址；
- 正在连接哪个 IP/端口；
- TCP 是否成功；
- TLS 握手；
- 证书信息；
- HTTP 请求和响应头。

只看响应头：

```bash
curl -I https://example.com/
```

测试 IPv4：

```bash
curl -4 -v https://example.com/
```

测试 IPv6：

```bash
curl -6 -v https://example.com/
```

如果 `-4` 正常、`-6` 失败，就应该重点看 AAAA 记录和 IPv6 路由，而不是继续重启 Web 服务。

## TLS 错误说明 TCP 往往已经走得更远

如果 curl 已经报证书不匹配、CA 不受信、TLS alert 等错误，通常说明：

- DNS 很可能已经完成；
- TCP 连接也已经建立到某个端点；
- 当前问题位于 TLS 或反向代理层。

进一步可以用：

```bash
openssl s_client -connect example.com:443 -servername example.com
```

这里 `-servername` 会发送 SNI。对于一台服务器承载多个 HTTPS 域名的场景，没有正确 SNI 可能拿到另一张证书。

## Connection reset 与 timeout 不是一回事

### Reset

通常意味着某一端或中间设备主动发送 RST，明确终止连接。

可能方向：

- 服务主动拒绝；
- 代理/防火墙策略；
- TLS/协议不符合预期；
- 中间网络设备重置连接。

### Timeout

意味着在等待时间内没有得到预期响应，更偏向丢包、路由、防火墙 drop 或对端无响应。

区分这两种现象，对排查 CDN、反向代理、跨境网络或企业安全设备非常重要。

## 本机代理环境变量也可能改变真实路径

```bash
env | grep -iE '^(http|https|all|no)_proxy='
```

很多 CLI 会自动读取：

```text
HTTP_PROXY
HTTPS_PROXY
ALL_PROXY
NO_PROXY
```

因此“curl 访问某地址失败”不一定走的是你以为的直连路径。

调试时可以观察 `curl -v` 是否显示连接代理服务器，必要时临时使用：

```bash
curl --noproxy '*' https://example.com/
```

来验证直连差异。

## 本机服务先从 localhost 开始验证

如果你正在排查自己服务器上的服务：

```bash
curl -v http://127.0.0.1:8080/
```

本机正常，再测试本机实际 IP：

```bash
curl -v http://192.168.1.10:8080/
```

再从远端测试。

这样可以逐步区分：

```text
应用本身 → 监听地址 → 主机防火墙 → 局域网/公网链路
```

端口和监听进程详见：[端口、Socket 与进程定位](/linux/ports-processes)。

## traceroute / mtr 适合看路径，但不要过度解读

```bash
traceroute host
```

或：

```bash
mtr host
```

可以辅助观察跨多跳链路。

但中间路由器可能限速或直接不响应 ICMP，因此某一跳丢包并不自动代表业务流量也在那里丢失。最终仍应结合终点的 TCP/HTTP 结果判断。

## 一套从底到上的网络排障顺序

面对“访问不了”时，可以固定成：

1. `ip addr`：本机地址是否正确；
2. `ip route get <目标IP>`：包准备从哪里走；
3. `getent hosts <域名>`：解析结果是否正确；
4. `nc -vz host port`：TCP 能否建立；
5. `curl -v`：TLS/HTTP 到哪一步失败；
6. 服务端 `ss -lntp`：是否监听正确地址；
7. 再查防火墙、安全组、NAT、反代和容器网络；
8. IPv4/IPv6 分开验证。

网络排障真正需要建立的是“每一个错误发生在哪一层”的映射。这样即使换了发行版、云厂商或代理工具，判断逻辑仍然成立。