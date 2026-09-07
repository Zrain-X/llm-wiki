# DNS 解析链路与缓存排障

DNS 故障最容易出现一种误判：`dig` 能解析，于是认为 DNS 没问题；或者清了一次缓存，问题暂时消失，于是认为已经找到根因。

实际上 Linux 上“一个应用把域名解析成 IP”可能经过多层组件。真正有效的排障方式，是先理解**应用到底走哪条解析链路**。

## 一次域名解析可能经过哪些层

一个普通应用调用系统解析接口时，大致可能经过：

```text
应用
  ↓
getaddrinfo / libc
  ↓
/etc/nsswitch.conf
  ├─ /etc/hosts
  ├─ DNS
  ├─ mDNS / systemd-resolved 等
  ↓
本地 stub resolver / 缓存服务
  ↓
上游 DNS 服务器
  ↓
权威 DNS
```

不同发行版、容器、VPN 和网络管理工具会改变中间层，因此不要假设 `/etc/resolv.conf` 就代表全部真相。

## 先看系统真正使用的解析入口

```bash
cat /etc/nsswitch.conf
```

重点看：

```text
hosts: ...
```

它决定系统查询主机名时会按什么顺序尝试 `files`、`dns`、`resolve` 等来源。

再看：

```bash
ls -l /etc/resolv.conf
cat /etc/resolv.conf
```

很多使用 systemd-resolved 的系统中，`/etc/resolv.conf` 可能只是指向本地 stub 配置的符号链接，并不直接列出真实上游 DNS。

这时更应该看：

```bash
resolvectl status
```

它可以显示每个网络接口实际使用的 DNS 服务器、搜索域以及路由域。

## `getent hosts` 与应用行为更接近

```bash
getent hosts example.com
```

`getent` 会走系统 NSS 机制，因此它能受到 `/etc/hosts`、`nsswitch.conf` 和系统 resolver 配置影响。

如果：

```bash
dig example.com
```

结果正常，但：

```bash
getent hosts example.com
```

结果异常，就说明“DNS 服务器是否能返回记录”并不是唯一问题，应该继续看本机解析链路。

这也是为什么只用 dig 很容易漏掉 `/etc/hosts` 或 NSS 层问题。

## `dig` 更适合直接验证 DNS 服务器

普通查询：

```bash
dig example.com
```

指定 DNS：

```bash
dig @1.1.1.1 example.com
```

只看 A：

```bash
dig A example.com
```

只看 AAAA：

```bash
dig AAAA example.com
```

查看短结果：

```bash
dig +short example.com
```

指定服务器查询非常重要。例如系统 DNS 返回旧记录，但公共 DNS 返回新记录，就可以继续判断是本地缓存、企业 DNS、分流 DNS 还是权威记录传播问题。

## systemd-resolved 下优先使用 resolvectl

查询：

```bash
resolvectl query example.com
```

状态：

```bash
resolvectl status
```

统计：

```bash
resolvectl statistics
```

清缓存：

```bash
sudo resolvectl flush-caches
```

清缓存只是排障动作，不应该代替定位。

如果每次都必须 flush 才恢复，应继续查：

- DNS TTL 是否异常；
- 上游 DNS 是否返回不一致；
- VPN/网络切换后接口 DNS 是否残留；
- 本机是否还有其他缓存层。

## 不同系统可能还有其他 DNS 缓存层

例如：

```bash
sudo systemctl restart nscd
sudo systemctl restart dnsmasq
```

但不要因为网上有这两条命令就直接执行。先确认机器上是否真的运行对应服务：

```bash
systemctl status nscd
systemctl status dnsmasq
```

浏览器、Java 应用、容器运行时、代理软件也可能有自己的缓存。

所以“系统已经清 DNS 缓存”不代表所有进程都忘记了旧结果。

## `/etc/hosts` 是最容易被忽略的覆盖层

```bash
grep -n 'example.com' /etc/hosts
```

如果 `nsswitch.conf` 的 `hosts:` 中 `files` 在 DNS 之前，那么 `/etc/hosts` 的结果会优先出现。

这能解释一个典型现象：

```text
dig example.com        → 新 IP
curl example.com       → 仍然访问旧 IP
```

因为 dig 直接问 DNS，而 curl 通常走系统解析路径。

## 容器里的 DNS 是另一套视角

Docker 容器里：

```bash
cat /etc/resolv.conf
getent hosts example.com
```

结果可能与宿主机不同。

因此“宿主机能解析”并不能证明“容器里的应用能解析”。排查容器服务时，命令应该在**故障发生的网络命名空间内**执行。

这是很多容器 DNS 问题的关键分界线。

## VPN、Tailscale 和企业网络会引入 Split DNS

现代系统经常不是“所有域名都去同一个 DNS”。例如：

```text
corp.example.com → 企业 DNS
其他域名          → 公共 DNS
```

systemd-resolved 可以基于接口和路由域决定查询发到哪里。

因此遇到“只有某个内网域名解析失败”，不要只看全局 `/etc/resolv.conf`，应看：

```bash
resolvectl status
```

确认目标域对应的 DNS 路由是否落在正确接口。

## A 记录正常但访问仍然慢，要检查 AAAA

```bash
dig A example.com
dig AAAA example.com
```

如果域名存在 IPv6 地址，但客户端 IPv6 路由实际不可用，就可能出现连接延迟或失败。

继续验证：

```bash
curl -4 https://example.com/
curl -6 https://example.com/
```

这时问题已经从“DNS 有没有记录”进入“解析结果对应的网络路径是否可用”，应转到：[Linux 网络连通性排障](/linux/network-troubleshooting)。

## 一套 DNS 排障顺序

遇到域名解析异常时：

1. `getent hosts domain`：观察应用级系统解析结果；
2. 检查 `/etc/hosts` 和 `nsswitch.conf`；
3. `resolvectl status`：确认真实 DNS、接口和路由域；
4. `dig domain`：看默认 DNS 返回；
5. `dig @指定DNS domain`：比较不同服务器结果；
6. 分别检查 A / AAAA；
7. 如果是容器，在容器内部重复验证；
8. 最后才考虑 flush cache 或重启 resolver。

DNS 排障的关键不是“换一个 DNS 试试”，而是找出**哪一层把一个域名变成了现在这个地址**。