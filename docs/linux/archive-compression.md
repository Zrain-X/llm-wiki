# Linux 压缩与归档：tar、gzip、xz、zstd 到底分别在做什么

Linux 运维中经常会看到：

```bash
tar -czf backup.tar.gz /etc/myapp
```

很多人把 `tar` 直接理解成“压缩命令”，但准确地说，tar 的核心工作是**归档**：把多个文件、目录、权限、时间戳等元数据组织成一个连续数据流。真正负责压缩的通常是 gzip、bzip2、xz、zstd 等压缩算法。

把“归档”和“压缩”分开理解之后，很多文件后缀和参数就不需要死记。

## 归档和压缩解决的是两个不同问题

假设有一个目录：

```text
app/
├── config.yaml
├── data.db
└── scripts/
    └── deploy.sh
```

归档解决的是：

> 如何把这一组文件连同目录结构和元数据放进一个对象中。

所以：

```text
app/ → app.tar
```

压缩解决的是：

> 如何让这一段数据占用更少空间。

于是：

```text
app.tar → app.tar.gz
```

可以理解为：

```text
多个文件
   ↓ tar
一个归档流
   ↓ gzip/xz/zstd
压缩归档
```

## tar 最基础的工作模型

创建归档：

```bash
tar -cf app.tar app/
```

其中：

```text
-c  create
-f  指定归档文件名
```

查看内容而不解包：

```bash
tar -tf app.tar
```

解包：

```bash
tar -xf app.tar
```

这里最重要的习惯是：**拿到未知 tar 包时，先 `tar -tf` 看结构，再决定解到哪里。**

如果归档内部没有顶层目录，直接解压到当前目录可能一下散出几百个文件。

## gzip、xz、zstd 是压缩层

gzip：

```bash
gzip file
```

得到：

```text
file.gz
```

解压：

```bash
gunzip file.gz
```

xz：

```bash
xz file
```

通常压缩率更高，但压缩速度可能更慢。

zstd：

```bash
zstd file
```

在现代系统中很常见，通常能在压缩速度、解压速度和压缩率之间取得很好的平衡。

它们都可以与 tar 配合。

## tar.gz 为什么这么常见

创建 gzip 压缩归档：

```bash
tar -czf app.tar.gz app/
```

等价思路是：

```text
tar app/
  ↓
gzip
  ↓
app.tar.gz
```

解压：

```bash
tar -xzf app.tar.gz
```

现代 tar 通常也可以自动根据压缩格式识别，因此不少情况下直接：

```bash
tar -xf app.tar.gz
```

也能工作。

但理解 `z` 的意义仍然很重要：它表示通过 gzip 压缩层处理 tar 数据。

## 常见后缀应该怎样读

```text
.tar        只有归档，没有压缩
.tar.gz     tar + gzip
.tgz        tar.gz 的短写
.tar.xz     tar + xz
.tar.zst    tar + zstd
.gz         单个数据流经过 gzip，不代表里面一定是 tar
```

所以看到：

```text
backup.gz
```

不能自动假设它是一个多文件归档。

可以先使用：

```bash
file backup.gz
```

判断文件类型。

## 解压到指定目录

不要为了避免污染当前目录而先 `cd` 来 `cd` 去。

可以：

```bash
mkdir -p /tmp/app-restore
```

然后：

```bash
tar -xf app.tar.gz -C /tmp/app-restore
```

`-C` 表示切换到指定目录后执行解包。

恢复备份时这是非常值得养成的习惯。

## 排除不应该归档的内容

备份项目目录时，经常不希望把缓存、临时文件或已经生成的大文件一起打包。

例如：

```bash
tar -czf app.tar.gz \
  --exclude='app/cache' \
  --exclude='app/*.log' \
  app/
```

更复杂时可以准备排除文件：

```bash
tar -czf app.tar.gz --exclude-from=exclude.txt app/
```

备份是否高效，很大程度上取决于你有没有先定义：

> 哪些数据是真正需要恢复的，哪些只是可以重新生成的缓存。

## 相对路径比绝对路径更适合大多数备份

直接：

```bash
tar -czf etc-backup.tar.gz /etc/myapp
```

tar 往往会提示移除前导 `/`。

这是有意的安全设计。归档中保存相对路径：

```text
etc/myapp/...
```

比保存绝对路径：

```text
/etc/myapp/...
```

更容易安全地恢复到测试目录，而不是一解包就覆盖系统真实 `/etc`。

因此备份常见写法是：

```bash
tar -C /etc -czf myapp.tar.gz myapp/
```

这样归档内部从 `myapp/` 开始。

## 权限、owner 和时间戳为什么重要

tar 不只保存文件内容，还可以保留多种元数据。

恢复普通个人文件时，owner 可能不重要；但恢复服务目录、配置目录和可执行脚本时，权限和属主可能直接决定服务能否运行。

查看归档详细信息：

```bash
tar -tvf app.tar.gz
```

可以看到：

```text
权限
owner/group
大小
时间
路径
```

使用 root 恢复系统级备份时要特别注意归档中的 owner 信息是否可信。

从不可信来源解包文件时，不应该让归档随意恢复高权限 owner、特殊权限位或覆盖系统路径。

## tar 通过 stdin/stdout 可以直接进入管道

tar 很适合 Unix 数据流模型。

例如把目录归档后直接通过 SSH 传到另一台机器：

```bash
tar -C /srv -cf - data/ | ssh backup@server 'cat > data.tar'
```

这里：

```text
-f -
```

表示归档写到 stdout。

也可以远端直接解包：

```bash
tar -C /srv -cf - data/ | ssh backup@server 'tar -C /backup -xf -'
```

逻辑上：

```text
本地目录
  ↓ tar 流
SSH 加密通道
  ↓
远端 tar 解包
```

不需要先在本地生成一个巨大的中间 `.tar` 文件。

## 为什么大文件压缩时 CPU 很高

压缩算法本身就是计算任务。

所以备份慢时要区分：

```text
磁盘读得慢？
网络传得慢？
CPU 压缩跟不上？
目标盘写得慢？
```

例如高压缩比 xz 可能明显占用 CPU；如果真正瓶颈是千兆网络，使用更快的 zstd 可能比追求极致压缩率更合理。

备份方案应该在：

```text
压缩率
CPU 消耗
压缩速度
解压速度
网络带宽
存储容量
```

之间做平衡，而不是默认“压得最小就是最好”。

## 多核压缩并不是所有工具默认都会使用

传统 gzip 单进程压缩通常不会自动吃满多核。

有些环境会使用：

```bash
pigz
```

作为并行 gzip。

zstd 本身也支持多线程参数。

但是否值得多线程取决于瓶颈。如果源磁盘已经只能读 100MB/s，再增加压缩线程可能没有任何收益。

## 高频场景：快速打包配置用于迁移

例如迁移一个服务，需要保留配置和 systemd 文件：

```bash
tar -C / -czf myapp-config.tar.gz \
  etc/myapp \
  etc/systemd/system/myapp.service
```

恢复前先看：

```bash
tar -tvf myapp-config.tar.gz
```

然后先解到临时目录检查：

```bash
mkdir /tmp/myapp-restore
sudo tar -xf myapp-config.tar.gz -C /tmp/myapp-restore
```

确认文件正确后再决定如何覆盖正式路径。

这比直接在 `/` 下解包安全得多。

## 高频场景：日志归档但不想压缩当前正在写的文件

应用正在写：

```text
app.log
```

直接把它压缩并删除原文件可能与应用持有的文件描述符冲突。

日志生命周期应该优先交给 logrotate 或应用自身日志机制：

```text
当前日志
  ↓ rotate/reopen
历史日志
  ↓ compress
```

`tar` 更适合备份已经稳定下来的文件集合，而不是替代日志轮转。

## 解包未知归档时最需要防什么

至少先检查路径：

```bash
tar -tf archive.tar.gz | head -100
```

关注：

- 是否有大量文件直接散在根层；
- 是否包含意外的 `../` 路径；
- 是否准备覆盖关键配置；
- 是否存在符号链接；
- 是否包含特殊权限文件。

对于不可信归档，最好在隔离目录甚至容器中检查，而不是直接以 root 解到系统目录。

## tar 命令记不住时不用背参数顺序

最常用的逻辑其实只有三个动作：

```text
创建：tar -cf
查看：tar -tf
解包：tar -xf
```

再根据压缩层增加：

```text
gzip → z
xz   → J
bzip2→ j
```

但现代 tar 对很多格式可以自动识别，所以比记住所有字母更重要的是先判断：

> 我现在是在归档、压缩，还是两件事一起做？

## 最重要的理解方式

看到一个压缩文件时，可以沿这条链判断：

```text
里面是一条数据流还是多个文件？
     ↓
是否先经过 tar 归档？
     ↓
外层用了什么压缩算法？
     ↓
恢复时要保留哪些权限和路径？
     ↓
应该先检查还是直接解到正式目录？
```

理解“tar 负责归档、压缩器负责压缩”以后，`.tar.gz`、`.tar.xz`、`.tar.zst` 只是同一模型下不同的压缩选择，而不再是一堆需要死记的命令。