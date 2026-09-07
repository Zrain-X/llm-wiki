# SSH：从远程登录到密钥认证、跳板机与安全排障

SSH 是 Linux 服务器最常用的远程管理入口。很多人把它理解为 `ssh user@host`，但真正遇到“能 ping 通却 SSH 不上”“密钥明明存在却还要密码”“换了服务器后提示 host key changed”时，仅记住登录命令并不够。

SSH 实际上同时解决了三件事：**建立加密通道、确认服务器身份、确认客户端用户身份。**

理解这三层之后，大多数 SSH 问题都可以快速定位。

## SSH 在解决什么问题

如果远程终端直接通过明文 TCP 传输，那么账号、密码和执行命令都可能被网络中的第三方看到或篡改。

SSH 建立连接时会先协商加密算法和会话密钥，然后验证远端主机身份，再执行用户认证。

逻辑上可以理解为：

```text
客户端
  ↓ TCP 连接
服务器 22 端口
  ↓
协商加密通道
  ↓
客户端验证“这是不是我要连接的服务器”
  ↓
服务器验证“你是不是允许登录的用户”
  ↓
建立 Shell / 转发 / 文件传输会话
```

因此 SSH 失败时，应先判断失败发生在哪一层，而不是直接删除 `.ssh` 或重新生成密钥。

## 最基础的连接方式

```bash
ssh user@192.168.1.10
```

指定端口：

```bash
ssh -p 2222 user@example.com
```

指定私钥：

```bash
ssh -i ~/.ssh/id_ed25519 user@example.com
```

真正排障时最有价值的选项通常是：

```bash
ssh -vvv user@example.com
```

它会显示连接、算法协商、host key、尝试了哪些密钥、服务器拒绝了哪种认证方式等过程。

## host key：客户端为什么要记住服务器

第一次连接一台服务器时，经常看到类似提示：

```text
The authenticity of host 'example.com' can't be established.
```

确认后，服务器公钥指纹会被记录到：

```text
~/.ssh/known_hosts
```

以后再次连接时，如果服务器提供的 host key 与记录不一致，SSH 会警告：

```text
REMOTE HOST IDENTIFICATION HAS CHANGED!
```

这项机制是为了防止中间人攻击。

因此遇到 host key changed 时，不应该机械执行：

```bash
rm ~/.ssh/known_hosts
```

更合理的是先确认服务器为什么变了：

- 系统是否重装；
- IP 是否被重新分配；
- 域名是否切到新机器；
- 是否确实存在异常网络劫持。

确认服务器已经合法更换后，可以只删除对应记录：

```bash
ssh-keygen -R example.com
```

如果按 IP 连接：

```bash
ssh-keygen -R 192.168.1.10
```

## 密钥认证到底在验证什么

SSH 密钥认证使用一对密钥：

```text
私钥：保存在客户端，不能泄露
公钥：放到服务器用户的 authorized_keys
```

常见生成方式：

```bash
ssh-keygen -t ed25519
```

通常得到：

```text
~/.ssh/id_ed25519
~/.ssh/id_ed25519.pub
```

公钥可以复制到服务器：

```bash
ssh-copy-id user@example.com
```

最终通常写入服务器：

```text
/home/user/.ssh/authorized_keys
```

认证时，客户端并不会把私钥发给服务器。服务器利用公钥验证客户端确实持有对应私钥。

因此真正敏感的是**私钥**，而 `.pub` 公钥本来就是可以分发的。

## 密钥存在但仍然要求密码，先看权限

OpenSSH 对服务端 `.ssh` 权限非常严格，这是非常高频的问题。

一般应该确保：

```bash
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

并确认目录和文件属于正确用户：

```bash
chown -R user:user ~/.ssh
```

如果用户家目录、`.ssh` 或 `authorized_keys` 可以被不可信用户随意修改，sshd 可能拒绝使用其中的公钥，因为那意味着别人可以偷偷加入自己的登录密钥。

排查服务端日志也很关键：

Debian / Ubuntu 常见：

```bash
journalctl -u ssh --since '10 min ago'
```

部分系统服务名是：

```bash
journalctl -u sshd --since '10 min ago'
```

传统日志也可能在：

```text
/var/log/auth.log
/var/log/secure
```

## ssh-agent：为什么不用每次都指定私钥

如果有多个带密码保护的私钥，每次连接都输入 passphrase 会比较麻烦。

`ssh-agent` 可以在当前会话中缓存已经解锁的私钥。

查看当前加载的密钥：

```bash
ssh-add -l
```

加入密钥：

```bash
ssh-add ~/.ssh/id_ed25519
```

需要注意：agent 保存的是解锁后的密钥使用能力，因此不要把 agent 转发给不可信服务器。

## ~/.ssh/config：把复杂连接变成一个名字

频繁使用的主机不应该每次都写：

```bash
ssh -p 2222 -i ~/.ssh/id_prod admin@10.0.0.12
```

可以放入：

```text
~/.ssh/config
```

例如：

```text
Host prod
    HostName 10.0.0.12
    User admin
    Port 2222
    IdentityFile ~/.ssh/id_prod
```

以后只需要：

```bash
ssh prod
```

配置文件还能集中管理跳板机、转发、keepalive 等选项，是长期使用 SSH 时非常值得维护的文件。

## 跳板机：ProxyJump 比手工登录两次更合理

如果目标服务器只能从堡垒机访问：

```text
本机 → bastion → internal-server
```

可以直接：

```bash
ssh -J user@bastion user@internal-server
```

配置到 `~/.ssh/config`：

```text
Host bastion
    HostName bastion.example.com
    User ops

Host db-prod
    HostName 10.10.0.25
    User admin
    ProxyJump bastion
```

之后：

```bash
ssh db-prod
```

这种方式比先 SSH 到跳板机、再从跳板机手工登录目标机更适合自动化，也不需要把目标机私钥复制到跳板机。

## SSH 端口转发：加密通道不仅能跑 Shell

### 本地转发

假设数据库只监听服务器本地：

```text
server:127.0.0.1:5432
```

可以建立：

```bash
ssh -L 15432:127.0.0.1:5432 user@server
```

然后本机访问：

```text
127.0.0.1:15432
```

流量会通过 SSH 隧道送到服务器的 `127.0.0.1:5432`。

非常适合临时访问数据库、管理后台等不希望直接暴露公网的服务。

### 远程转发

```bash
ssh -R 8080:127.0.0.1:3000 user@server
```

可以把本地服务通过远端 SSH 服务器暴露出来。是否允许外部主机访问，还受到 `GatewayPorts` 等 sshd 配置影响。

### SOCKS 代理

```bash
ssh -D 1080 user@server
```

会在本地创建 SOCKS 代理，适合临时让支持 SOCKS 的程序通过远端服务器访问网络。

## sshd_config：服务端控制什么

SSH 服务端主要配置文件通常是：

```text
/etc/ssh/sshd_config
```

也可能支持：

```text
/etc/ssh/sshd_config.d/*.conf
```

修改前先看最终生效配置：

```bash
sshd -T
```

这比只 grep 某一行更可靠，因为配置可能被 include 文件覆盖。

常见关注项包括：

```text
Port
PermitRootLogin
PasswordAuthentication
PubkeyAuthentication
AllowUsers
AllowGroups
ListenAddress
```

修改后不要直接重启并关闭当前连接。更安全的流程是：

```bash
sudo sshd -t
```

确认语法无误，再 reload：

```bash
sudo systemctl reload ssh
```

或：

```bash
sudo systemctl reload sshd
```

并且**保留当前已登录会话，另开一个终端测试新连接成功后再退出旧会话。**

这能避免一次配置错误把自己锁在服务器外面。

## “SSH 不上”的排查顺序

推荐按网络层到认证层逐步判断：

```text
域名能解析吗？
   ↓
目标 IP 路由可达吗？
   ↓
TCP 22/自定义端口能连接吗？
   ↓
sshd 是否监听？
   ↓
host key 阶段是否通过？
   ↓
服务器允许哪种认证方式？
   ↓
客户端实际提供了哪个密钥？
   ↓
authorized_keys 与权限是否正确？
```

客户端先测试端口：

```bash
nc -vz server 22
```

然后：

```bash
ssh -vvv user@server
```

服务器本地检查：

```bash
ss -lntp | grep ':22'
systemctl status sshd --no-pager
journalctl -u sshd -n 100 --no-pager
```

如果端口根本连接不上，就先查监听、路由、防火墙，不要在密钥上浪费时间。

## 常见安全原则

长期暴露公网的 SSH 服务建议至少做到：

- 优先密钥认证；
- 不共享私钥；
- 私钥使用合理文件权限；
- 谨慎开放 root 直接登录；
- 不再需要密码认证时再关闭 `PasswordAuthentication`；
- 对公网入口配合防火墙、VPN、Fail2ban 或其他访问控制；
- 修改 sshd 配置时始终保留可回退的已登录会话。

修改 SSH 端口只能减少一部分自动扫描噪音，不应该被当成真正的身份认证安全措施。

## 最重要的理解方式

SSH 排障最好把问题拆成三层：

```text
网络连接是否建立？
       ↓
服务器身份是否可信？
       ↓
用户身份是否认证成功？
```

如果再加上 `ssh -vvv` 客户端日志和服务端 sshd 日志，绝大部分 SSH 问题都可以准确定位到具体阶段，而不需要反复重装服务或重新生成密钥。
