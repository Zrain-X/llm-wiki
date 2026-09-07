# Linux 磁盘挂载与 LVM：从块设备到文件系统，再到可扩展存储

Linux 存储问题经常混在一起说：磁盘、分区、文件系统、挂载点、LVM、UUID、`fstab`。如果这些概念没有分层，就很容易出现“磁盘明明有 2TB，为什么 `/data` 还是 100GB”“重启后挂载没了”“扩容了云盘但文件系统大小没变化”这类问题。

最重要的第一步是建立一条完整链路：

```text
物理/虚拟磁盘
   ↓
块设备
   ↓
分区（可选）
   ↓
LVM PV → VG → LV（可选）
   ↓
文件系统
   ↓
挂载点
   ↓
用户实际看到的目录
```

并不是每台机器都会经过所有层，但排障时必须知道自己当前在哪一层。

## Linux 为什么需要“挂载”

Windows 常把不同磁盘表现为：

```text
C:\
D:\
E:\
```

Linux 则只有一棵统一目录树：

```text
/
├── etc
├── var
├── home
└── data
```

一个文件系统必须被挂载到目录树中的某个目录，才能通过正常路径访问。

例如：

```text
/dev/sdb1
   ↓ mount
/data
```

之后访问：

```text
/data/file.txt
```

实际读写的是 `/dev/sdb1` 中的文件系统。

因此“目录”和“磁盘”不是一回事。目录只是挂载入口。

## 先学会看清当前存储结构

### lsblk：看块设备关系

```bash
lsblk
```

更实用：

```bash
lsblk -f
```

可能看到：

```text
NAME        FSTYPE      UUID                                 MOUNTPOINTS
sda
├─sda1      vfat                                             /boot/efi
└─sda2      LVM2_member
  ├─vg-root ext4                                             /
  └─vg-var  xfs                                              /var
sdb
└─sdb1      ext4        1111-2222-3333-4444                 /data
```

这一张表已经能回答很多问题：

- 哪块盘有分区；
- 哪个分区属于 LVM；
- LV 上是什么文件系统；
- 最终挂载到了哪里。

### df：看已经挂载的文件系统

```bash
df -hT
```

它关心的是：

> 当前已经挂载的文件系统容量和使用率。

因此 `df` 看不到一个“存在但没有挂载”的新磁盘。

### blkid：看文件系统类型和 UUID

```bash
sudo blkid
```

在写 `/etc/fstab` 时非常常用。

## 新增一块数据盘的完整过程

假设系统新增 `/dev/sdb`。

第一步不是立刻格式化，而是确认盘：

```bash
lsblk -o NAME,SIZE,TYPE,FSTYPE,MOUNTPOINTS
```

确认没有重要数据后，再决定是否需要分区。

### 方式一：直接在分区上建文件系统

例如创建 `/dev/sdb1` 后：

```bash
sudo mkfs.ext4 /dev/sdb1
```

然后创建挂载点：

```bash
sudo mkdir -p /data
```

临时挂载：

```bash
sudo mount /dev/sdb1 /data
```

确认：

```bash
df -hT /data
```

这里“临时”指的是：重启后不会因为这条 `mount` 命令自动恢复。

## /etc/fstab：让挂载跨重启保持

`/etc/fstab` 描述系统启动时应该挂载哪些文件系统。

一个典型条目：

```text
UUID=1111-2222-3333-4444  /data  ext4  defaults  0  2
```

字段大致是：

```text
设备标识  挂载点  文件系统  挂载选项  dump  fsck顺序
```

### 为什么更推荐 UUID，而不是 /dev/sdb1

设备名可能随着磁盘探测顺序变化。

今天是：

```text
/dev/sdb1
```

以后增加磁盘、调整控制器或虚拟化环境后，它理论上可能变成别的设备名。

UUID 属于文件系统本身，通常更稳定。

查看：

```bash
blkid /dev/sdb1
```

## 修改 fstab 后不要直接重启测试

`fstab` 写错可能让系统启动进入 emergency mode。

更安全的流程是：

```bash
sudo mount -a
```

它会尝试按照 `fstab` 挂载尚未挂载的文件系统。

然后检查：

```bash
df -hT
findmnt /data
```

现代 systemd 系统还可以检查生成的 mount unit 和启动日志。

如果只是远程服务器，更不应该把“重启看看”作为第一次验证方式。

## mount 的几个高频选项

常见：

```text
defaults
ro
rw
noexec
nosuid
nodev
nofail
```

### nofail

对于非关键数据盘、USB、网络盘等，`nofail` 可以避免设备不存在时阻塞或破坏正常启动流程。

例如：

```text
UUID=... /backup ext4 defaults,nofail 0 2
```

### noexec

阻止从该文件系统直接执行二进制文件。

适合某些上传目录或纯数据目录，但不能把它理解为完整安全沙箱。

### nodev / nosuid

分别限制设备文件和 setuid/setgid 行为，经常用于加强非系统数据分区的安全边界。

## 一个非常危险的现象：挂载后“原目录文件消失了”

假设 `/data` 原本已经有文件：

```text
/data/a.txt
/data/b.txt
```

然后把新文件系统挂到 `/data`：

```bash
mount /dev/sdb1 /data
```

这时原文件看起来“消失”了。

它们通常并没有被删除，而是被新的挂载层遮住了：

```text
原根文件系统中的 /data
       ↓ 被覆盖
新文件系统挂载到 /data
```

卸载后：

```bash
umount /data
```

原目录内容会重新出现。

这也是为什么把新盘挂到已有业务目录之前，必须先确认目录中原本是否存在数据。

## umount 为什么提示 target is busy

```bash
sudo umount /data
```

如果看到：

```text
target is busy
```

说明仍有进程正在使用这个挂载点。

可以检查：

```bash
sudo lsof +f -- /data
```

或者：

```bash
sudo fuser -vm /data
```

甚至只是某个 Shell 当前目录停留在 `/data`，也可能让卸载失败。

不要第一反应就使用强制卸载。先找到谁在使用文件系统通常更安全。

## LVM 为什么存在

传统分区有一个明显问题：容量边界比较刚性。

例如：

```text
/dev/sda1  100G  /
/dev/sda2  200G  /var
```

如果 `/var` 快满了，而 `/` 还有大量空闲，调整分区会比较麻烦。

LVM 在物理块设备和文件系统之间增加了一层逻辑抽象：

```text
磁盘/分区
   ↓
PV（Physical Volume）
   ↓
VG（Volume Group）
   ↓
LV（Logical Volume）
   ↓
文件系统
```

可以把多个 PV 汇总成一个容量池 VG，再按需要创建和扩展 LV。

## PV、VG、LV 应该怎样理解

假设有两块盘：

```text
/dev/sdb  500G
/dev/sdc  500G
```

把它们初始化为 PV：

```bash
pvcreate /dev/sdb /dev/sdc
```

组成 VG：

```bash
vgcreate data-vg /dev/sdb /dev/sdc
```

逻辑上得到一个接近 1TB 的容量池：

```text
          data-vg
        /         \
   /dev/sdb     /dev/sdc
```

然后创建 LV：

```bash
lvcreate -L 300G -n app data-vg
lvcreate -L 500G -n backup data-vg
```

剩余空间以后可以继续分配。

查看：

```bash
pvs
vgs
lvs
```

需要更详细：

```bash
pvdisplay
vgdisplay
lvdisplay
```

## LVM 扩容为什么经常“扩了但 df 没变化”

这是 LVM 最核心的分层问题。

假设：

```text
LV 100G
 ↓
ext4 文件系统 100G
 ↓
/data
```

执行：

```bash
lvextend -L +50G /dev/data-vg/app
```

只是把 LV 变成 150G：

```text
LV 150G
 ↓
ext4 文件系统仍然 100G
```

因此：

```bash
df -h /data
```

可能仍然显示 100G。

还要扩文件系统。

ext4：

```bash
resize2fs /dev/data-vg/app
```

XFS：

```bash
xfs_growfs /data
```

XFS 通常按挂载点扩，而不是直接对块设备执行类似 `resize2fs` 的命令。

很多 LVM 工具支持自动连同文件系统一起扩展，例如：

```bash
lvextend -r -L +50G /dev/data-vg/app
```

`-r` 会尝试调用适合的文件系统 resize 工具。

生产环境执行扩容前仍然应该确认文件系统类型和备份方案。

## 云盘扩容也是同样的分层问题

云平台把磁盘从 100G 调到 200G 后，你只是完成了最外层：

```text
云磁盘 100G → 200G
```

内部可能仍然是：

```text
分区 100G
LVM PV 100G
LV 100G
文件系统 100G
```

所以可能依次需要：

```text
识别新块设备容量
   ↓
扩大分区
   ↓
pvresize
   ↓
lvextend
   ↓
扩文件系统
```

具体步骤取决于磁盘是否分区、是否使用 LVM、文件系统类型，不能看到“云盘已经 200G”就直接假设 `df` 也会自动变成 200G。

## findmnt：比 mount 输出更适合看挂载关系

查看所有挂载：

```bash
findmnt
```

查某个路径实际属于哪个文件系统：

```bash
findmnt -T /var/lib/docker
```

这对复杂目录尤其好用。

例如某个目录可能是：

- 根文件系统的一部分；
- 单独数据盘；
- bind mount；
- Docker overlay；
- NFS；
- tmpfs。

`findmnt -T` 可以迅速确认真正的挂载来源。

## bind mount：把一个目录映射到另一个位置

Linux 不只能挂载磁盘，也可以把目录重新挂到另一个目录：

```bash
mount --bind /srv/data /opt/app/data
```

逻辑上：

```text
/srv/data
    │
    └────> /opt/app/data
```

两条路径看到的是同一份内容。

这在容器、服务目录兼容、迁移旧路径时很常见。

持久化 bind mount 也可以写入 `fstab`。

## 高频场景：磁盘满了之后准备扩容

不要一上来就操作 LVM。先确认当前结构：

```bash
df -hT /data
findmnt -T /data
lsblk -f
```

如果使用 LVM：

```bash
pvs
vgs
lvs
```

然后回答：

```text
VG 还有空闲空间吗？
   ├─ 有 → 扩 LV + 文件系统
   └─ 没有
       ↓
是否有新磁盘/扩大的磁盘可加入 PV？
```

这样可以避免在不需要的情况下盲目做分区或新增文件系统。

## 高频场景：重启后数据盘没有挂载

先确认设备是否存在：

```bash
lsblk -f
```

再看 fstab：

```bash
cat /etc/fstab
```

测试：

```bash
sudo mount -a
```

如果失败，继续看：

```bash
journalctl -b | grep -iE 'mount|fsck|filesystem'
```

常见原因包括：

- UUID 写错；
- 文件系统类型写错；
- 设备还没准备好；
- 网络文件系统依赖网络；
- 文件系统损坏；
- 挂载点或选项配置错误。

## 操作存储时的安全原则

磁盘和文件系统命令里有很多不可逆操作。

尤其是：

```bash
mkfs
pvcreate
wipefs
fdisk / parted 修改分区
lvreduce
```

这些操作执行前必须先通过：

```bash
lsblk -f
blkid
findmnt
```

确认设备身份和当前用途。

不要只凭 `/dev/sdb` 这个名字猜测“这就是新盘”。

扩容通常相对安全，缩容风险显著更高。特别是 XFS 不支持直接缩小文件系统，因此 `lvreduce` 之前必须明确文件系统能力和数据迁移方案。

## 最重要的理解方式

遇到 Linux 存储问题，始终先问自己当前在哪一层：

```text
磁盘容量够吗？
   ↓
分区覆盖到新空间了吗？
   ↓
PV 识别到空间了吗？
   ↓
VG 有空闲吗？
   ↓
LV 扩了吗？
   ↓
文件系统扩了吗？
   ↓
挂载到正确目录了吗？
```

只要坚持按层定位，“磁盘有空间但目录没空间”“重启后挂载丢失”“LVM 扩容不生效”这些问题就会从一团混乱变成一条清晰的检查链。
