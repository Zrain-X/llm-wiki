# Linux 用户、用户组与 sudo：理解“进程到底以谁的身份运行”

Linux 权限问题的根源往往不在 `chmod`，而在身份。一个文件能不能访问、一个端口能不能绑定、一个服务能不能读取配置，本质上都取决于：**执行操作的进程当前拥有哪个 UID、哪些 GID，以及是否经过了额外的授权机制。**

因此用户管理不应该被理解成“创建账号的几条命令”，而应该放进完整的身份与权限模型中理解。

## Linux 为什么需要用户和用户组

Linux 是多用户系统，但这里的“用户”不只指真实的人。

系统中常见三类身份：

- 真实登录用户，例如 `alice`、`admin`；
- 系统服务用户，例如 `www-data`、`postgres`、`nginx`；
- 临时或自动化账户，例如备份账号、部署账号、CI Runner。

这些身份的作用是把权限隔离开。

例如 Nginx 即使被入侵，如果工作进程只以 `www-data` 运行，它理论上也不应该自动拥有 PostgreSQL 数据目录、root SSH 密钥或系统配置文件的访问权。

这就是最小权限原则在 Linux 中最基础的落地方式。

## 用户名只是方便人看的标签，内核真正识别 UID

查看当前用户：

```bash
whoami
```

查看完整身份：

```bash
id
```

可能输出：

```text
uid=1000(alice) gid=1000(alice) groups=1000(alice),27(sudo),1001(developers)
```

真正参与权限判断的是数字 UID/GID。

用户名只是 `/etc/passwd` 等身份数据库提供的人类可读映射。

因此在 NFS、容器挂载、恢复旧磁盘等场景中，可能出现“用户名一样但权限不对”，根因就是两边 UID 并不一致。

## /etc/passwd、/etc/shadow 和 /etc/group 分别保存什么

查看用户数据库：

```bash
getent passwd alice
```

典型格式：

```text
alice:x:1000:1000:Alice:/home/alice:/bin/bash
```

主要字段包括：

```text
用户名
密码占位符
UID
主组 GID
说明
Home 目录
登录 Shell
```

密码哈希通常不直接放在 `/etc/passwd`，而保存在权限更严格的：

```text
/etc/shadow
```

用户组信息则主要来自：

```text
/etc/group
```

现代环境中用户也可能来自 LDAP、SSSD、Active Directory 等外部身份源，所以排查时优先使用：

```bash
getent passwd username
getent group groupname
```

而不是只 `grep /etc/passwd`。

`getent` 会走系统实际配置的 NSS 身份解析链路。

## 主组与附加组有什么区别

每个用户有一个 primary group，同时还可以加入多个 supplementary groups。

查看：

```bash
id alice
```

创建文件时，文件默认属于当前用户和某个有效组。

在普通目录中通常会使用用户的主组；如果目录设置了 setgid，则新文件往往继承目录组。

这就是多人共享目录常见的设计：

```text
用户 alice ─┐
用户 bob   ─┼─> developers 组
用户 carol ─┘
                ↓
          /srv/project
```

然后：

```bash
chown root:developers /srv/project
chmod 2775 /srv/project
```

这样比不断给文件改 owner 更容易长期维护。

## 创建用户时先确定它是什么类型

创建普通用户：

```bash
sudo useradd -m -s /bin/bash alice
```

不同发行版上，也经常使用更友好的：

```bash
sudo adduser alice
```

服务账号则通常不需要正常登录 Shell：

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin myapp
```

核心不是命令参数本身，而是先问：

```text
这个账号需要交互登录吗？
需要 Home 目录吗？
需要密码吗？
需要加入哪些组？
只运行一个服务还是代表真实人员？
```

不要为了启动一个服务就默认给它 `/bin/bash`、Home 目录和 sudo 权限。

## usermod：现有用户最常见的调整工具

把用户加入附加组：

```bash
sudo usermod -aG developers alice
```

这里最容易犯的错误是漏掉 `-a`。

```bash
usermod -G developers alice
```

会把附加组列表替换成新的集合，可能导致用户意外失去原有组权限。

`-aG` 可以理解为：

> append to supplementary groups。

修改登录 Shell：

```bash
sudo usermod -s /bin/bash alice
```

锁定账号：

```bash
sudo usermod -L alice
```

解锁：

```bash
sudo usermod -U alice
```

但“锁密码”和“完全禁止所有登录方式”不是一回事。一个账号即使密码被锁定，也可能仍然通过 SSH 公钥、sudo 或其他认证机制使用，因此安全停用账号时应检查完整认证路径。

## 为什么加入新组后当前 Shell 里还不生效

执行：

```bash
sudo usermod -aG docker alice
```

之后当前终端执行：

```bash
id
```

可能仍看不到新组。

原因是 Shell 进程启动时已经继承了当时的 group 列表。修改用户数据库不会自动修改正在运行进程的凭据。

常见做法是重新登录。

临时启动一个带新组环境的 Shell 也可以：

```bash
newgrp docker
```

因此“组已经加了但权限还是 denied”时，先确认当前进程身份，而不是重复执行 `usermod`。

## sudo 不是“切换成 root 的快捷键”

sudo 的核心价值是：

> 允许某个身份在满足策略的情况下，以另一个身份执行特定命令，并保留审计记录。

最常见：

```bash
sudo command
```

默认以 root 执行。

也可以指定用户：

```bash
sudo -u postgres psql
```

或者：

```bash
sudo -u www-data cat /srv/app/config.yaml
```

后者是排查服务权限问题非常好用的方式，因为它可以模拟服务用户实际访问文件。

## sudoers 应该通过 visudo 修改

sudo 的核心策略来自：

```text
/etc/sudoers
/etc/sudoers.d/*
```

不要直接用普通编辑器冒险修改 `/etc/sudoers`。

更推荐：

```bash
sudo visudo
```

或者编辑独立文件：

```bash
sudo visudo -f /etc/sudoers.d/deploy
```

`visudo` 会在保存前检查语法，避免一个拼写错误导致所有 sudo 操作都失效。

## sudoers 的权限规则如何阅读

一个简单规则：

```text
alice ALL=(ALL:ALL) ALL
```

可以粗略理解为：

```text
alice
  在所有主机上
  可以作为所有用户/组
  执行所有命令
```

这其实权限非常大。

对于自动化账号，更合理的方向通常是只授权真正需要的命令。

例如部署账号只允许重启某个服务：

```text
deploy ALL=(root) /usr/bin/systemctl restart myapp.service
```

这样即使 deploy 凭据泄露，也比直接给完整 root 权限更容易控制风险。

但限制 sudo 命令时要考虑参数和被调用程序本身是否能逃逸到 Shell。例如允许用户任意执行某些编辑器、脚本解释器或可加载外部配置的程序，可能等价于间接给 root Shell。

## NOPASSWD 应该理解为认证策略，不是“更方便”

例如：

```text
deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart myapp.service
```

这适合无人值守自动化，但意味着一旦 deploy 账号被控制，攻击者无需再次输入密码就能调用授权命令。

所以 `NOPASSWD` 是否合理取决于：

- 账号本身如何认证；
- 可执行命令范围；
- 是否为自动化场景；
- 是否有日志与审计；
- 该命令是否能间接获得更多权限。

## `su` 与 `sudo` 的区别

切换用户：

```bash
su - postgres
```

`su` 更接近“获得另一个用户的登录 Shell”。

sudo 更适合：

```bash
sudo -u postgres psql
```

即只执行所需动作。

日常运维中，优先使用精确的 sudo 操作通常比长时间保持 root Shell 更容易审计，也降低误操作范围。

如果确实需要 root 登录环境：

```bash
sudo -i
```

完成后应尽快退出，不要把 root Shell 当作默认工作环境。

## 高频场景：服务能启动，但读不到配置

先看 systemd 定义：

```bash
systemctl cat myapp
```

找到：

```ini
User=myapp
Group=myapp
```

然后：

```bash
id myapp
namei -l /etc/myapp/config.yaml
sudo -u myapp cat /etc/myapp/config.yaml
```

这三步分别确认：

1. 服务身份；
2. 路径每一级目录权限；
3. 真实服务用户能否读取文件。

比直接 `chmod 777` 更容易找到根因。

## 高频场景：给 Docker 使用权限到底意味着什么

很多系统会建议：

```bash
sudo usermod -aG docker alice
```

这样用户可以直接访问 Docker daemon socket。

但默认 Docker daemon 通常具有非常高的宿主机权限。能够控制 Docker daemon 的用户，在很多配置下实际上可以通过挂载宿主机文件系统、运行特权容器等方式获得接近 root 的能力。

因此 `docker` 组不应该被理解成普通业务组。

给用户加入这类高权限组之前，应明确它的安全含义。

## 高频场景：离职或停用账号

不要只删除 Home 目录。

更稳妥的顺序通常是：

```text
禁止新的认证
   ↓
确认是否存在 SSH key / token / cron / systemd user service
   ↓
确认该用户拥有的业务文件和进程
   ↓
转移需要保留的数据
   ↓
再决定锁定还是删除账号
```

查看用户进程：

```bash
ps -u alice -f
```

查用户拥有的文件需要控制扫描范围，例如：

```bash
find /srv -xdev -user alice -print
```

比直接对整个 `/` 扫描更可控。

## 删除用户时数据不会自动理解业务含义

删除账号：

```bash
sudo userdel alice
```

连同 Home：

```bash
sudo userdel -r alice
```

但系统其他位置仍可能存在属于该 UID 的文件。

删除用户后，这些文件可能直接显示数字 UID。

因此在生产环境中，用户删除通常应该放在“身份停用和资产交接”的最后，而不是第一步。

## 排查身份与权限问题的推荐顺序

```text
操作是谁发起的？
   ↓
id / ps 确认进程 UID/GID
   ↓
用户来自本地还是 NSS/LDAP/SSSD？
   ↓
用户属于哪些组？
   ↓
文件 owner/group/ACL 是否匹配？
   ↓
sudo 是否改变了执行身份？
   ↓
SELinux/AppArmor 是否还有额外限制？
```

高频命令组合：

```bash
id username
getent passwd username
getent group groupname
ps -o user,group,pid,cmd -p PID
namei -l /path/to/file
sudo -u username command
sudo -l -U username
```

## 最重要的理解方式

用户管理的核心不是 `/etc/passwd`，而是 Linux 对进程身份和授权边界的管理。

遇到问题时始终先问：

```text
这个进程到底是谁？
      ↓
它拥有哪些组和附加权限？
      ↓
它应该访问哪些资源？
      ↓
当前权限是否刚好足够？
```

当身份模型清楚之后，`chmod`、`chown`、ACL、sudo 和 systemd 的 `User=` 就会自然地串成同一套权限体系。