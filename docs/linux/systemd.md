# systemd：Linux 服务的生命周期管理

在现代 Linux 发行版里，`systemd` 往往是系统启动后最早运行、并长期存在的用户态进程之一。日常看到的 `systemctl start`、`systemctl status` 只是它最表层的入口。

理解 systemd 的关键，不是背命令，而是弄清它解决了什么问题：**谁来启动服务、按什么顺序启动、服务退出后怎么办、日志去哪里、开机时是否自动恢复，以及这些行为如何被统一描述和管理。**

## 为什么需要 systemd

早期 Linux 大量依赖 SysV init 脚本。每个服务都有一段 Shell 脚本，系统按运行级别和编号顺序执行。它能工作，但随着服务器上的服务越来越多，几个问题会变得明显：

- 服务之间存在依赖关系，仅靠启动顺序很难准确表达；
- 启动脚本写法不统一，状态检测和重启逻辑经常各自实现；
- 后台进程 fork、PID 文件、日志路径都需要脚本自己处理；
- 服务异常退出后，自动恢复通常还要借助额外工具；
- 系统启动过程很难并行化。

systemd 把这些问题抽象成 **Unit**。服务、定时任务、挂载点、Socket、设备等都可以用声明式配置描述，再由 systemd 统一计算依赖关系和生命周期。

因此，`systemd` 不只是“开机启动工具”，更像 Linux 用户态服务的**调度器和监督器**。

## Unit 是理解 systemd 的核心

最常见的是 `.service`，但 systemd 管理的不只有服务：

- `xxx.service`：长时间运行或一次性执行的服务；
- `xxx.timer`：定时触发某个 service，可替代很多 cron 场景；
- `xxx.socket`：通过 Socket 激活服务；
- `xxx.mount`：文件系统挂载；
- `xxx.target`：一组 Unit 的逻辑集合，常用于表达系统所处阶段。

日常最容易混淆的是两个概念：

- **active / inactive**：服务现在是否正在运行；
- **enabled / disabled**：系统进入某个 target 时，是否会自动拉起它。

因此一个服务完全可能“现在正在运行，但没有设置开机自启”，也可能“已经 enabled，但当前被手工 stop”。

```bash
systemctl is-active nginx
systemctl is-enabled nginx
```

## 服务定义放在哪里

常见路径包括：

```text
/etc/systemd/system/
/run/systemd/system/
/usr/lib/systemd/system/    # 部分发行版
/lib/systemd/system/        # Debian/Ubuntu 常见
```

运维时最重要的原则是：**不要直接修改软件包安装的 Unit 文件。**

发行版升级或软件包更新可能覆盖 `/usr/lib/systemd/system`、`/lib/systemd/system` 下的内容。管理员自己的 Unit 和覆盖配置应该放在 `/etc/systemd/system`。

查看 systemd 最终使用的配置，比直接猜文件位置更可靠：

```bash
systemctl cat nginx.service
```

如果只想覆盖某几个参数，优先使用：

```bash
sudo systemctl edit nginx.service
```

它会创建 drop-in 配置，而不是复制整份 Unit。这样上游 Unit 更新后，自己只维护差异部分。

## 从零创建一个服务

假设有一个长期运行的 Python 服务：

```text
/opt/myapp/app.py
```

准备专用用户后，可以创建：

```ini
# /etc/systemd/system/myapp.service
[Unit]
Description=My Application
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=myapp
Group=myapp
WorkingDirectory=/opt/myapp
EnvironmentFile=-/etc/myapp/myapp.env
ExecStart=/usr/bin/python3 /opt/myapp/app.py
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

这份配置可以分成三层理解。

### [Unit]：描述关系，而不是启动命令

`After=network-online.target` 表示启动顺序：当前服务应排在该 target 后面。

`Wants=network-online.target` 表示希望同时拉起这个依赖。需要注意：**`After=` 本身不会自动启动对方。** 这也是很多 Unit 看起来写了依赖、实际却没有生效的原因。

### [Service]：真正定义进程如何运行

`ExecStart` 是 systemd 要监督的主进程。`Type=simple` 下，systemd 会认为 `ExecStart` 启动的进程就是服务主体。

`User` / `Group` 决定服务以什么权限运行。没有必要使用 root 的服务，最好使用专用低权限账户。

`WorkingDirectory` 很重要。交互式 Shell 里程序可以正常启动，但 systemd 下失败，经常只是因为程序假设当前目录是项目目录。

`EnvironmentFile` 适合放非敏感环境配置；前面的 `-` 表示文件不存在时也不让 Unit 直接失败。

`Restart=on-failure` 表示异常退出时自动恢复，而正常退出不重启。对于常驻后台服务，这通常比无条件 `always` 更容易控制。

### [Install]：定义 enable 时挂到哪里

`WantedBy=multi-user.target` 决定执行 `systemctl enable` 后，会把服务挂到常见多用户启动目标中。

它并不是“立即启动”的意思。

## 新建或修改 Unit 后必须 daemon-reload

systemd 会缓存 Unit 配置。创建或修改文件后，需要通知 manager 重新读取：

```bash
sudo systemctl daemon-reload
```

然后可以立即启动并设置开机自启：

```bash
sudo systemctl enable --now myapp.service
```

日常管理：

```bash
sudo systemctl start myapp
sudo systemctl stop myapp
sudo systemctl restart myapp
sudo systemctl reload myapp
sudo systemctl disable myapp
```

`reload` 和 `restart` 不是一回事。只有服务本身定义并支持 reload 时，`systemctl reload` 才有意义；否则应使用 restart。

## status 只是入口，journal 才是主要证据

```bash
systemctl status myapp --no-pager
```

适合快速查看：

- 当前 active 状态；
- 主进程 PID；
- 最近几条日志；
- Unit 文件位置；
- 最近一次退出码。

真正排障时通常继续进入 journal：

```bash
journalctl -u myapp -n 200 --no-pager
journalctl -u myapp -f
journalctl -u myapp --since '30 min ago'
journalctl -u myapp -b
```

`-b` 很适合处理“服务器重启之后服务为什么没起来”，因为它只看本次启动周期。

如果进程被 OOM Killer 杀掉，服务自身日志可能什么都没有，需要继续看内核日志：

```bash
journalctl -k -b
```

## systemd 下最常见的“交互式能跑，服务里不能跑”

这种问题往往不是 systemd 神秘，而是**服务环境比登录 Shell 干净得多**。

### PATH 不一样

不要依赖：

```ini
ExecStart=python app.py
```

更稳妥的是使用绝对路径：

```ini
ExecStart=/usr/bin/python3 /opt/myapp/app.py
```

使用 venv 时也直接写 venv 中的解释器路径。

### ExecStart 不是 Shell 命令行

下面这种写法经常与预期不同：

```ini
ExecStart=/opt/app/start > /var/log/app.log 2>&1
```

systemd 默认不会像 Bash 一样解释 `>`、`|`、`&&` 等 Shell 语法。需要 Shell 特性时可以显式调用 `/bin/bash -lc`，但长期服务更推荐把逻辑放进程序或脚本，并使用 journal 收集 stdout/stderr。

### 权限和目录不同

检查：

```bash
systemctl show myapp -p User -p Group -p WorkingDirectory -p Environment
```

再用相同用户手工执行程序，往往很快就能复现权限问题。

## 不要复制整份 Unit，优先使用 override

例如只想改变一个服务的重启策略：

```bash
sudo systemctl edit myapp
```

写入：

```ini
[Service]
Restart=always
RestartSec=10s
```

然后：

```bash
sudo systemctl daemon-reload
sudo systemctl restart myapp
```

查看最终合并结果：

```bash
systemctl cat myapp
```

这种方式比直接修改软件包 Unit 更适合长期维护。

## Timer：把“定时运行”也纳入服务模型

如果任务本身已经写成 `backup.service`，可以再创建一个 `backup.timer`：

```ini
[Unit]
Description=Run backup every 3 hours

[Timer]
OnBootSec=10min
OnUnitActiveSec=3h
Persistent=true

[Install]
WantedBy=timers.target
```

然后：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now backup.timer
systemctl list-timers
```

相比把完整命令塞进 cron，Timer 的优势是：任务本身仍由 service 管理，权限、日志、失败状态和手工重跑方式都保持一致。

## 一套稳定的 systemd 排障顺序

服务异常时，不建议第一反应就是反复 restart。更有效的顺序是：

1. `systemctl status <service>`：确认状态、退出码和主 PID；
2. `systemctl cat <service>`：确认真正生效的 Unit 和 override；
3. `journalctl -u <service> -b`：看本次启动周期内的完整日志；
4. 核对 `User`、`WorkingDirectory`、环境变量和绝对路径；
5. 检查依赖的端口、文件、网络和挂载是否已经准备好；
6. 修改配置后 `daemon-reload`，再重启验证；
7. 如果持续自动重启，先找到原始退出原因，不要只提高 Restart 频率。

systemd 最有价值的地方，正是把“一个后台进程应该如何存在”变成可以被检查、复现和版本化维护的配置。