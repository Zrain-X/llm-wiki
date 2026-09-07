# Linux 防火墙：从 Netfilter 到 nftables、iptables 与 firewalld

Linux 防火墙最容易让人困惑的地方，不是规则语法，而是工具太多：`iptables`、`nft`、`firewall-cmd`、`ufw` 看起来都在“开端口”，Docker 还会自己插规则。

要真正理解它，应该先把工具和内核机制分开：**真正决定数据包能不能通过的是 Linux 内核中的 Netfilter；iptables、nftables、firewalld、ufw 只是不同层次的规则管理方式。**

## 防火墙解决了什么问题

一台服务器可能监听很多端口：

```bash
ss -lntp
```

但“程序监听了端口”并不代表所有网络都应该访问它。

例如：

```text
SSH 22       只允许办公网
PostgreSQL   只允许应用服务器
Nginx 443    对公网开放
管理后台     只允许 VPN 网段
```

防火墙就是在数据包到达应用之前，根据源地址、目标地址、协议、端口、连接状态等条件决定：

```text
允许
拒绝
丢弃
转发
改写地址
```

## 先理解 Netfilter，而不是先背 iptables

Netfilter 是 Linux 内核中的网络过滤框架。网络包经过协议栈时，会穿过若干关键位置。

简化理解：

```text
外部数据包
    ↓
 PREROUTING
    ↓
是否发给本机？
 ┌───────┴────────┐
 是               否
 ↓                ↓
INPUT            FORWARD
 ↓                ↓
本机进程       继续转发
 ↓                ↓
OUTPUT          POSTROUTING
 ↓                ↓
发出数据包      发出数据包
```

因此当一个外部客户端访问本机 Web 服务时，最值得关注的是 INPUT 路径；如果 Linux 主机在做路由器、Docker 转发或 NAT，FORWARD 和 NAT 链就会变得重要。

## nftables 和 iptables 到底是什么关系

### iptables

iptables 是使用多年的传统用户态管理工具，围绕 table / chain / rule 组织规则。

例如：

```bash
iptables -L -n -v
```

可以查看过滤规则。

### nftables

nftables 是较新的 Netfilter 管理框架，目标之一就是替代 iptables、ip6tables、ebtables 等分散工具。

查看规则：

```bash
sudo nft list ruleset
```

现代发行版越来越多地以 nftables 为实际后端。

有些系统中你执行的是：

```bash
iptables
```

但它背后实际上通过兼容层操作 nftables。这就是常见的 `iptables-nft`。

因此排查时不要仅凭“我用了 iptables 命令”就认为系统底层一定还是传统 iptables 实现。

可以检查：

```bash
iptables --version
```

如果看到类似：

```text
iptables v1.8.x (nf_tables)
```

说明命令接口是 iptables，后端实际是 nftables。

## firewalld 和 ufw 又是什么

它们不是另一套内核防火墙，而是更高层的规则管理工具。

大致关系可以理解为：

```text
firewall-cmd ─┐
ufw          ├─ 高层管理工具
iptables     ┤
nft          ┘
       ↓
   Netfilter
       ↓
 Linux Kernel
```

### firewalld

常见于 RHEL、Rocky Linux、AlmaLinux、CentOS、Fedora 等系统。

它用 zone 表达网络信任级别，例如：

```bash
firewall-cmd --get-active-zones
```

查看当前 zone：

```bash
firewall-cmd --list-all
```

临时开放 8080：

```bash
sudo firewall-cmd --add-port=8080/tcp
```

永久开放：

```bash
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --reload
```

要注意 runtime 配置和 permanent 配置是两层。如果只加了 runtime，重启或 reload 后可能消失。

### ufw

Ubuntu 等系统常见：

```bash
sudo ufw status verbose
```

允许 SSH：

```bash
sudo ufw allow 22/tcp
```

限制来源网段：

```bash
sudo ufw allow from 192.168.1.0/24 to any port 22 proto tcp
```

UFW 的价值是把常见规则变得更容易表达，但复杂 NAT、容器转发等场景仍然需要理解底层规则。

## 最常见的误区：程序监听不等于网络可达

假设：

```bash
ss -lntp | grep ':8080'
```

看到：

```text
LISTEN 0 4096 0.0.0.0:8080
```

只能证明：

> 应用已经在本机 IPv4 所有地址上监听 TCP 8080。

它不能证明：

- 上游路由可达；
- 云安全组允许；
- 本机防火墙允许；
- Docker 转发规则正确；
- 客户端访问的是正确 IP。

因此“服务已经监听，但外部访问不到”应该沿完整链路排查。

## 外部端口访问失败的排查顺序

### 1. 确认应用真的监听

```bash
ss -lntp | grep ':8080'
```

注意监听地址：

```text
127.0.0.1:8080    只有本机可访问
0.0.0.0:8080      所有 IPv4 地址
[::]:8080          IPv6 / 可能双栈，取决于系统配置
```

如果应用只绑定 `127.0.0.1`，防火墙开放再多规则也无法让其他机器直接访问。

### 2. 本机访问测试

```bash
curl -v http://127.0.0.1:8080/
```

如果本机都失败，先查应用，不要先查防火墙。

### 3. 用服务器实际网卡地址测试

```bash
ip addr
curl -v http://192.168.1.10:8080/
```

这一步可以进一步确认绑定地址和本机网络路径。

### 4. 从远端只测试 TCP

```bash
nc -vz 192.168.1.10 8080
```

如果 TCP 都建立不了，再检查路由和防火墙。

### 5. 查看当前防火墙管理方式

先确认系统在使用什么：

```bash
systemctl is-active firewalld
systemctl is-active ufw
```

再按系统实际情况查看：

```bash
sudo nft list ruleset
```

或：

```bash
sudo iptables -L -n -v
```

不要一边用 firewalld 管理，一边手工插大量 nft/iptables 规则，却又不知道最终谁覆盖谁。

## nftables 的基本阅读方式

一个简单规则集可能类似：

```text
 table inet filter {
     chain input {
         type filter hook input priority 0;
         policy drop;

         iif "lo" accept
         ct state established,related accept
         tcp dport 22 accept
         tcp dport 443 accept
     }
 }
```

阅读时关注三件事：

1. 这条 chain 挂在哪个 hook；
2. 默认 policy 是 accept 还是 drop；
3. 数据包在命中 accept 前会不会已经被前面的 drop 拦截。

防火墙规则通常是有顺序的，因此“规则里明明有允许 8080”并不能自动证明 8080 一定能通过。

## 为什么要允许 established,related

状态防火墙会跟踪连接。

例如客户端主动访问服务器：

```text
client:53000 → server:443
```

服务器响应：

```text
server:443 → client:53000
```

响应流量属于已建立连接。如果采用默认拒绝策略，通常需要允许：

```text
ct state established,related accept
```

这样就不必为每一个客户端临时端口单独写返回规则。

iptables 中常见类似：

```bash
-m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
```

## DROP 和 REJECT 的区别

`DROP`：

```text
直接丢包，不回复
```

客户端通常会等待超时。

`REJECT`：

```text
明确告诉对方连接被拒绝
```

客户端通常能更快得到失败结果。

安全策略不一定必须全部 DROP。内部网络中明确 REJECT 有时反而更利于排障。

## Docker 为什么会让防火墙变复杂

Docker 发布端口：

```bash
docker run -p 8080:80 nginx
```

不是简单让容器进程直接监听宿主机 8080。Docker 会配置转发、NAT 和防火墙规则，把宿主机流量转到容器网络。

因此可能出现：

- `iptables -L INPUT` 看不出问题；
- 实际流量走了 FORWARD；
- Docker 自己维护的 chain 改变了规则顺序；
- UFW 看起来禁止了某端口，但 Docker 发布端口仍可能可访问。

排查容器端口时，需要把：

```text
宿主机监听/发布
NAT
FORWARD
Docker chain
容器内部监听
```

作为完整路径来看。

不要直接清空整个 iptables/nftables 规则集来“验证是不是防火墙”，尤其在远程服务器上，这可能同时破坏 Docker、VPN、NAT 和 SSH 访问。

## 修改远程服务器防火墙时的安全顺序

如果你正在通过 SSH 操作服务器，最危险的动作之一就是先启用默认 DROP，再忘记允许当前 SSH 来源。

更安全的顺序通常是：

```text
先加入 SSH 放行规则
        ↓
确认规则存在
        ↓
另开一个 SSH 会话验证
        ↓
再收紧默认策略
```

必要时还应准备云控制台、VNC、带外管理等回退入口。

## 高频场景：只允许内网访问数据库

目标：PostgreSQL 5432 只允许 `10.10.0.0/16`。

策略思想是：

```text
源地址属于 10.10.0.0/16
且目标 TCP 端口为 5432
→ accept

其他来源访问 5432
→ 不额外放行
```

除了防火墙，还应该同时确认数据库自身监听地址和 `pg_hba.conf`。安全边界最好不是只依赖一层。

## 高频场景：开放端口后仍然访问不到

这时不要继续重复执行“开放端口”命令，而是逐层验证：

```text
应用进程存在？
   ↓
监听正确地址和端口？
   ↓
本机 curl/nc 正常？
   ↓
本机路由正常？
   ↓
Netfilter 是否丢包？
   ↓
云安全组 / 上游防火墙是否允许？
   ↓
客户端路由是否正确？
```

必要时使用抓包判断包到底有没有到达服务器：

```bash
sudo tcpdump -ni any tcp port 8080
```

如果客户端发起连接时服务器完全抓不到 SYN，问题大概率在服务器之前；如果抓到 SYN 但没有正常响应，则继续检查本机防火墙、监听和返回路由。

## 最重要的理解方式

Linux 防火墙问题不要从“应该执行哪条开放端口命令”开始，而应该先确定：

```text
这个包从哪里来？
       ↓
应该走 INPUT 还是 FORWARD？
       ↓
系统实际由谁管理规则？
       ↓
它在哪条规则被 accept / drop？
```

只要把 Netfilter 当成数据包路径，而把 nftables、iptables、firewalld、ufw 当成不同的规则管理界面，Linux 防火墙就不会再显得像四套互相冲突的系统。
