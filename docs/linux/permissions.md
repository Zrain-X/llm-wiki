# Linux 权限体系：从 rwx 到 ACL，理解“为什么 Permission denied”

Linux 的权限管理看起来像是 `chmod 755`、`chown root:root` 这些命令，但真正排查权限问题时，关键不是记住数字，而是理解：**内核在访问一个文件时，到底依据什么身份、按什么顺序判断是否允许。**

一旦理解了这条判断链，`Permission denied` 就不再是一个模糊错误，而是可以逐层定位的问题。

## 权限系统解决了什么问题

Linux 是多用户系统。多个用户、服务进程和后台任务可能同时运行在同一台机器上，因此系统必须回答三个问题：

- 谁拥有这个文件；
- 哪些人可以读取、修改或执行它；
- 一个进程以谁的身份访问它。

Linux 最基础的模型是 **Owner / Group / Others**：文件拥有者、所属组、其他用户。每一类再分别拥有 `r`、`w`、`x` 权限。

```bash
ls -l /opt/app/config.yaml
```

可能看到：

```text
-rw-r----- 1 app app 1820 Sep  7 10:20 config.yaml
```

这里可以读成：

```text
- rw- r-- ---
  │   │   └─ 其他用户：无权限
  │   └───── 所属组：可读
  └───────── 文件拥有者：可读、可写
```

但这只是权限判断的一部分。真正访问文件时还涉及目录权限、进程 UID/GID、ACL、SELinux/AppArmor 等额外机制。

## 文件和目录的 rwx 含义并不一样

这是权限问题里最容易被忽略的一点。

对于普通文件：

- `r`：读取文件内容；
- `w`：修改文件内容；
- `x`：将文件作为程序执行。

对于目录：

- `r`：列出目录中的文件名；
- `w`：在目录中创建、删除、重命名文件；
- `x`：进入目录，并通过文件名访问其中的对象。

因此下面这种目录：

```text
drwx------ root root /opt/private
```

即使里面的文件是：

```text
-rw-r--r-- root root config.txt
```

普通用户仍然无法读取它，因为访问 `/opt/private/config.txt` 前必须先“穿过” `/opt/private`，目录缺少 `x` 权限就会被拦住。

排查路径权限时，一个很实用的命令是：

```bash
namei -l /opt/private/config.txt
```

它会把路径上的每一级目录权限都展开，比只看最终文件的 `ls -l` 更有效。

## chmod：修改“谁能做什么”

`chmod` 有两种常见写法。

符号方式更适合阅读和局部修改：

```bash
chmod u+x deploy.sh
chmod g+w /srv/shared
chmod o-r config.yaml
chmod u=rw,g=r,o= config.yaml
```

其中：

- `u`：owner；
- `g`：group；
- `o`：others；
- `a`：所有三类用户。

数字方式适合明确设置完整权限：

```bash
chmod 644 config.yaml
chmod 755 deploy.sh
chmod 750 /opt/app
```

数字本质上是：

```text
r = 4
w = 2
x = 1
```

所以：

```text
7 = rwx
6 = rw-
5 = r-x
4 = r--
```

`755` 不是某种固定模板，它只是在表达：owner=`rwx`，group=`r-x`，others=`r-x`。

### 不要遇到权限问题就 chmod 777

`777` 经常能“让问题消失”，但同时也把权限边界一起取消了。

更正确的思路是先确定：**真正需要访问这个文件的进程是谁。**

例如 Web 服务运行用户是 `www-data`：

```bash
ps -o user,group,pid,cmd -C nginx
```

如果它需要写 `/srv/upload`，更合理的方式可能是：

```bash
chown root:www-data /srv/upload
chmod 775 /srv/upload
```

而不是：

```bash
chmod 777 /srv/upload
```

## chown 与 chgrp：改变对象属于谁

修改 owner：

```bash
sudo chown app config.yaml
```

同时修改 owner 和 group：

```bash
sudo chown app:app config.yaml
```

递归修改目录：

```bash
sudo chown -R app:app /opt/app
```

递归操作需要格外谨慎。类似：

```bash
chown -R user:user /
```

这样的误操作可能直接破坏整个系统。

只修改 group：

```bash
chgrp developers /srv/project
```

对于多人协作目录，通常应该优先考虑合理的 group，而不是不断修改 owner。

## umask：新文件为什么不是 777

创建文件时，应用程序通常请求一个初始权限，然后由 `umask` 屏蔽掉部分权限。

查看当前值：

```bash
umask
```

常见输出：

```text
0022
```

通常：

- 普通文件基础权限按 `666` 计算；
- 目录基础权限按 `777` 计算。

因此 `umask 022` 下通常得到：

```text
文件：644
目录：755
```

如果多个用户需要共同写一个目录，常见设置会更接近：

```bash
umask 002
```

这样 group 默认也保留写权限。

## setgid 与 Sticky Bit：共享目录的两个关键能力

### setgid：让新文件继承目录的组

多人共享目录经常出现这样的问题：A 创建的文件属于 A 的默认组，B 创建的文件又属于另一个组。

可以给目录设置 setgid：

```bash
chmod g+s /srv/team
```

再把目录组设置为共同组：

```bash
chown root:developers /srv/team
```

之后目录中新建文件通常会继承 `developers` 组。

查看时会看到类似：

```text
drwxrwsr-x
```

### Sticky Bit：能写目录，但不能随便删别人的文件

典型例子是 `/tmp`：

```bash
ls -ld /tmp
```

常见权限：

```text
drwxrwxrwt
```

最后的 `t` 表示 Sticky Bit。所有人都可以在 `/tmp` 创建文件，但不能任意删除其他用户拥有的文件。

设置方式：

```bash
chmod +t /srv/dropbox
```

## ACL：三组 rwx 不够用时怎么办

Owner / Group / Others 模型很简单，但现实中经常出现：

> 文件属于 `app`，组属于 `developers`，但我只想额外允许 `backup` 用户读取。

如果为了一个用户新建 group 或修改文件所属组，可能会破坏原有权限模型。这时适合使用 ACL。

查看 ACL：

```bash
getfacl config.yaml
```

给指定用户增加只读权限：

```bash
setfacl -m u:backup:r config.yaml
```

给指定组增加读写权限：

```bash
setfacl -m g:ops:rw config.yaml
```

删除某条 ACL：

```bash
setfacl -x u:backup config.yaml
```

给目录设置默认 ACL，让以后新建文件自动继承：

```bash
setfacl -m d:g:developers:rwx /srv/project
```

ACL 特别适合共享目录、备份用户、服务账户等“只额外授权给少数主体”的场景。

## 服务进程的权限由谁决定

你在 Shell 中能读一个文件，不代表服务也能读。

例如你手工执行：

```bash
python app.py
```

是以当前用户运行；但 systemd 服务可能配置：

```ini
[Service]
User=app
Group=app
```

真正访问文件的是 `app` 用户。

因此排查服务权限问题时应先确认：

```bash
systemctl cat myapp
ps -ef | grep myapp
```

然后模拟服务用户访问：

```bash
sudo -u app cat /opt/app/config.yaml
```

这一步常常能直接复现真正的问题。

## Permission denied 的排查顺序

遇到权限错误，可以按下面的顺序判断：

```text
进程是谁？
   ↓
文件 owner/group 是谁？
   ↓
文件本身 rwx 是否允许？
   ↓
路径上的每一级目录是否有 x？
   ↓
是否存在 ACL？
   ↓
文件系统是否只读？
   ↓
SELinux / AppArmor 是否额外拦截？
```

常用命令组合：

```bash
id
ls -l /path/to/file
namei -l /path/to/file
getfacl /path/to/file
mount | grep ' /target '
```

如果传统权限全部正常，却仍然被拒绝，再检查安全模块。

SELinux 系统：

```bash
getenforce
ls -Z /path/to/file
```

AppArmor 系统：

```bash
aa-status
```

## 高频场景：建立一个多人可写但相对安全的目录

假设开发组 `developers` 需要共同维护 `/srv/project`：

```bash
sudo chown root:developers /srv/project
sudo chmod 2775 /srv/project
```

这里的 `2` 就是 setgid。

再配合默认 ACL：

```bash
sudo setfacl -m d:g:developers:rwx /srv/project
sudo setfacl -m d:o::rx /srv/project
```

这样比每隔一段时间执行一次 `chmod -R 777` 可控得多。

## 最重要的判断原则

权限管理的核心不是“怎样让命令执行成功”，而是：

> **让需要访问的人拥有刚好足够的权限，同时不扩大其他主体的权限。**

当遇到权限问题时，不要从 `chmod` 开始。先确认进程身份，再沿着文件、目录、组、ACL 和安全模块逐层判断，通常能更快找到真正原因。
