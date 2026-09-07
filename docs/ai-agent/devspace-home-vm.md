# 使用 DevSpace 打通 ChatGPT 与家用虚拟机

DevSpace 是一个自托管 MCP Server，可以把 ChatGPT 与自己控制的开发环境连接起来。它适合部署在家用虚拟机、开发机或专用服务器上，让 ChatGPT 在明确授权的工作区中读取文件、修改代码、执行测试和构建命令，而不需要把整个项目手工上传到对话中。

本文以 **Linux 家用虚拟机 + DevSpace + Cloudflare Tunnel + ChatGPT** 为主线，给出一套从零开始、可以实际落地的配置流程。

> [!IMPORTANT]
> DevSpace 本质上是在向远程 AI 客户端开放本机开发能力。尤其是 Shell 工具会以 DevSpace 运行用户的系统权限执行命令，因此不要把 DevSpace 当成普通的只读文件共享服务。推荐使用专用虚拟机或专用低权限 Linux 用户运行，并严格控制这个用户能够访问的目录和系统资源。

## 适用场景

这套方案适合以下需求：

- 在手机、平板或任意浏览器中的 ChatGPT 直接操作家里的开发项目。
- 让 ChatGPT 阅读完整代码仓库，而不是逐个上传文件。
- 让 ChatGPT 修改代码、执行测试、构建项目和查看 Git 差异。
- 远程维护自托管服务的配置仓库、脚本和文档。
- 在项目已经安装 Playwright 等工具时，让 Agent 启动前端、执行浏览器测试或辅助做视觉检查。
- 使用 `AGENTS.md`、`CLAUDE.md` 或 Agent Skills 给 ChatGPT 补充项目级操作规范。
- 使用 Git worktree 为不同会话创建隔离的代码工作区。

不建议直接把 DevSpace 部署到存放大量私人文件、SSH 私钥、密码库或生产凭据的日常主机账户中。

## 整体架构

典型连接链路如下：

```text
┌──────────────────────┐
│       ChatGPT        │
│  Web / App / Agent   │
└──────────┬───────────┘
           │ HTTPS + MCP
           ▼
┌──────────────────────┐
│  公网 HTTPS 接入层   │
│ Cloudflare Tunnel 等 │
└──────────┬───────────┘
           │ http://127.0.0.1:7676
           ▼
┌──────────────────────┐
│       DevSpace       │
│ MCP / OAuth / Tools  │
└──────────┬───────────┘
           │ 本机权限
           ▼
┌──────────────────────┐
│      家用虚拟机      │
│ /srv/devspace/...    │
│ Git / Node / Python  │
│ Docker / Playwright  │
└──────────────────────┘
```

核心思路是：

1. DevSpace 只监听虚拟机本地地址，例如 `127.0.0.1:7676`。
2. Cloudflare Tunnel 等隧道从虚拟机主动连接公网，因此家庭网络通常不需要端口映射。
3. ChatGPT 连接公开的 HTTPS MCP 地址，例如 `https://devspace.example.com/mcp`。
4. DevSpace 使用 OAuth 和 Owner Password 对客户端授权。
5. ChatGPT 通过 DevSpace MCP Tools 打开允许的项目目录并执行操作。

## DevSpace 能做什么

连接完成后，DevSpace 可以向 ChatGPT 提供类似 Coding Agent 的本地操作能力，包括：

- 打开指定工作区。
- 读取文件。
- 创建、覆盖或精确修改文件。
- 搜索代码和目录。
- 执行测试、构建、Git、包管理器等 Shell 命令。
- 查看修改差异。
- 使用 Git worktree 隔离不同任务。
- 读取项目中的 Agent 说明文件和 Skills。

DevSpace 不等于完整的远程桌面。它主要解决的是“让模型安全、结构化地访问项目文件与开发工具”这个问题。

## 部署前准备

下面以 Debian / Ubuntu 类 Linux 虚拟机为例。

### 1. 建议准备专用 Linux 用户

不要直接用 `root` 运行 DevSpace。可以创建一个专用用户：

```bash
sudo useradd --create-home --shell /bin/bash devspace
sudo mkdir -p /srv/devspace/workspace
sudo chown -R devspace:devspace /srv/devspace
```

后续需要让 ChatGPT 操作的项目，可以放到：

```text
/srv/devspace/workspace
```

例如：

```text
/srv/devspace/workspace/project-a
/srv/devspace/workspace/project-b
/srv/devspace/workspace/wiki
```

如果已有项目目录，也可以直接授权已有路径，但要确保 `devspace` 用户确实拥有完成任务所需的读写权限。

### 2. 检查基础依赖

DevSpace 当前需要：

- Node.js `>=22.19 <27`
- npm
- Git
- Bash

检查版本：

```bash
node -v
npm -v
git --version
bash --version
```

建议使用 Node.js 22 LTS 或满足 DevSpace 当前要求的更新版本。

> [!TIP]
> 如果系统仓库中的 Node.js 版本过旧，可以先通过 Node.js 官方推荐方式、NodeSource、nvm 等方式升级。长期使用 systemd 服务时，系统级 Node.js 安装通常比只存在于交互式 Shell 中的 nvm 环境更省事。

## 安装 DevSpace

安装 CLI：

```bash
sudo npm install -g @waishnav/devspace
```

确认安装：

```bash
devspace --help
```

然后切换到专用用户：

```bash
sudo -iu devspace
```

## 初始化 DevSpace

运行：

```bash
devspace init
```

初始化过程会逐项询问配置。

### 使用模式

如果主要目标是让 ChatGPT 操作家用虚拟机，选择包含 **ChatGPT** 的模式。

如果同时还要让本地 Coding Agent 使用 DevSpace，可以选择同时启用 ChatGPT 和 Coding Agents。

### Allowed Roots

这里填写 ChatGPT 可以通过 DevSpace 打开的根目录。

推荐：

```text
/srv/devspace/workspace
```

也可以配置多个较窄的根目录，例如：

```text
/srv/devspace/projects,/srv/devspace/docs
```

不要为了省事设置为：

```text
/
/home
~
```

Allowed Roots 越窄，越容易控制风险和理解 Agent 实际可以访问哪些项目。

### DevSpace 监听地址

默认本地 MCP 服务通常为：

```text
http://127.0.0.1:7676/mcp
```

对于“Cloudflare Tunnel 和 DevSpace 在同一台虚拟机”的部署方式，建议继续绑定 `127.0.0.1`，不要直接把 7676 端口暴露到局域网或公网。

### Public Base URL

初始化时需要填写一个公网 HTTPS Origin，例如：

```text
https://devspace.example.com
```

这里 **不要添加 `/mcp`**。

正确：

```text
https://devspace.example.com
```

错误：

```text
https://devspace.example.com/mcp
```

稍后在 ChatGPT 中配置 MCP Endpoint 时才使用：

```text
https://devspace.example.com/mcp
```

### Owner Password

初始化会生成 Owner Password，并保存到 DevSpace 的认证配置中。

这个密码只应该在实际授权自己的 ChatGPT 客户端时使用。

本文档、Git 仓库、Shell 历史、截图、Issue 和聊天记录中都不应该出现真实 Owner Password。

不要把以下文件内容提交到代码仓库：

```text
~/.devspace/auth.json
```

## 检查 DevSpace 配置

默认配置文件位置通常为：

```text
~/.devspace/config.jsonc
~/.devspace/auth.json
```

可以执行：

```bash
devspace doctor
```

它会检查 Node、Git、Bash、公开 URL、工作区和本地依赖等状态。

一个经过脱敏的配置结构大致如下：

```jsonc
{
  "configVersion": 1,
  "server": {
    "host": "127.0.0.1",
    "port": 7676,
    "publicBaseUrl": "https://devspace.example.com",
    "allowedHosts": [],
    "trustProxy": false
  },
  "workspaces": {
    "allowedRoots": [
      "/srv/devspace/workspace"
    ],
    "worktreeRoot": "~/.devspace/worktrees"
  },
  "tools": {
    "mode": "codex"
  },
  "logging": {
    "level": "info",
    "requests": true,
    "toolCalls": true,
    "shellCommands": false
  }
}
```

这只是结构示例，不要直接覆盖初始化生成的配置，也不要把认证文件混入 Wiki。

## 首次启动 DevSpace

运行：

```bash
devspace serve
```

另开一个终端检查本地服务：

```bash
curl -sS -o /dev/null -w '%{http_code}\\n' http://127.0.0.1:7676/
```

如果本地服务已经正常响应，再继续配置公网隧道。

## 使用 Cloudflare Tunnel 暴露 MCP 服务

DevSpace 本身不会创建公网隧道。对于家庭宽带、动态公网 IP、CGNAT 或不希望做路由器端口映射的环境，Cloudflare Tunnel 是比较方便的选择。

下面给出两种方式。任选一种即可。

### 方式 A：Cloudflare Dashboard 创建 Tunnel

这是日常使用更省事的方式。

1. 登录 Cloudflare Dashboard。
2. 进入 Networking / Tunnels。
3. 创建一个新的 Cloudflare Tunnel。
4. 选择虚拟机对应的 Linux 平台。
5. Cloudflare 会给出一条安装并注册 Connector 的命令。
6. 在家用虚拟机上执行 Dashboard 给出的命令。
7. 为 Tunnel 添加一个 Public Hostname，例如 `devspace.example.com`。
8. Origin Service 配置为：

```text
http://127.0.0.1:7676
```

Dashboard 给出的 Connector 命令通常包含 Tunnel Token。这个 Token 属于凭据，不要复制到 Wiki、Git、截图或聊天记录中。

### 方式 B：使用 cloudflared CLI 创建本地管理的 Tunnel

先安装 `cloudflared`。Debian / Ubuntu 可以按照 Cloudflare 官方 APT 仓库方式安装。

安装完成后确认：

```bash
cloudflared --version
```

登录：

```bash
cloudflared tunnel login
```

创建 Tunnel：

```bash
cloudflared tunnel create chatgpt-devspace
```

查看 Tunnel：

```bash
cloudflared tunnel list
```

然后创建 `~/.cloudflared/config.yml`。下面所有 UUID 和路径都必须替换成自己的实际值：

```yaml
tunnel: <TUNNEL-UUID>
credentials-file: /home/<USER>/.cloudflared/<TUNNEL-UUID>.json

ingress:
  - hostname: devspace.example.com
    service: http://127.0.0.1:7676
  - service: http_status:404
```

创建 DNS 路由：

```bash
cloudflared tunnel route dns chatgpt-devspace devspace.example.com
```

先前台验证：

```bash
cloudflared tunnel run chatgpt-devspace
```

确认公网域名可以访问后，再配置为系统服务。

> [!WARNING]
> `<TUNNEL-UUID>.json`、Tunnel Token、Cloudflare API Token 都属于凭据。它们不应该出现在 Wiki 或代码仓库中。

## 将 DevSpace 配置为 systemd 服务

手工执行 `devspace serve` 只适合验证。长期运行建议交给 systemd。

先确认 DevSpace 的绝对路径：

```bash
command -v devspace
```

假设输出为：

```text
/usr/local/bin/devspace
```

创建：

```text
/etc/systemd/system/devspace.service
```

内容示例：

```ini
[Unit]
Description=DevSpace MCP Server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=devspace
Group=devspace
Environment=HOME=/home/devspace
WorkingDirectory=/srv/devspace/workspace
ExecStart=/usr/local/bin/devspace serve
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

如果 `command -v devspace` 输出的路径不同，需要同步修改 `ExecStart`。

加载并启动：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now devspace
```

检查状态：

```bash
sudo systemctl status devspace
```

查看日志：

```bash
journalctl -u devspace -f
```

> [!NOTE]
> `NoNewPrivileges=true` 可以减少服务启动新提权程序的能力，但它不能把 Shell 工具变成沙箱。DevSpace 执行 Shell 命令时，仍然拥有 `devspace` Linux 用户本身拥有的权限。

## 将 Cloudflare Tunnel 配置为服务

如果使用 Dashboard 创建的 remotely-managed Tunnel，按照 Cloudflare 提供的 Connector 服务安装命令即可。

如果使用本地 `config.yml`，可以使用：

```bash
sudo cloudflared --config /home/<USER>/.cloudflared/config.yml service install
```

然后：

```bash
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared
```

此时理想状态应该是两个服务都开机自启：

```bash
systemctl is-active devspace
systemctl is-active cloudflared
```

都应该返回：

```text
active
```

## 在 ChatGPT 中连接 DevSpace

ChatGPT 中相关入口可能随着版本和账号类型变化而显示为 **Plugins、Apps、自定义 MCP 应用或 Developer Mode**，但连接参数本身是一致的。

### 1. 创建或导入 MCP 连接

在 ChatGPT 的插件 / Apps / 自定义 MCP 配置入口中新建连接。

MCP Server URL 填写：

```text
https://devspace.example.com/mcp
```

注意这里和 DevSpace `publicBaseUrl` 不同：

| 配置位置 | 示例 |
| --- | --- |
| DevSpace `publicBaseUrl` | `https://devspace.example.com` |
| ChatGPT MCP Server URL | `https://devspace.example.com/mcp` |

### 2. 完成 OAuth / Owner Password 授权

ChatGPT 第一次连接时，DevSpace 会进入授权流程并显示 Owner Password Approval 页面。

此时从虚拟机本地安全地获取初始化生成的 Owner Password，并只在授权页面中输入。

不要把 Owner Password 发到 ChatGPT 对话正文中。

### 3. 扫描并确认 Tools

连接完成后，确认 ChatGPT 可以看到 DevSpace 提供的工具，例如：

- `open_workspace`
- `read`
- 文件编辑工具
- Shell / Command 工具
- `show_changes`

具体工具名称会随 DevSpace `tools.mode` 和版本略有变化。

## 让 ChatGPT 更自然地定位工作目录

仅仅在 DevSpace 中配置 `allowedRoots`，解决的是服务端“允许访问哪些目录”的问题；它不一定能让 ChatGPT 在每个新会话里自动知道你的项目都放在哪里。

如果使用的 ChatGPT 插件 / MCP 配置支持填写描述，建议在描述中明确写出**非敏感的工作区路径和使用方式**。

例如：

```text
该 DevSpace 服务连接到一台专用开发虚拟机。
允许的项目根目录为 /srv/devspace/workspace。
需要操作项目时，应先使用 open_workspace 打开该目录下对应项目，
再使用 read / edit / command 等工具完成操作。
不要尝试访问工作区之外的私人目录。
```

这样做有两个好处：

1. ChatGPT 在会话开始时就知道项目根目录，不需要反复询问“可操作目录在哪里”。
2. `open_workspace` 可以更自然地直接定位到具体项目。

需要注意：插件描述只是给模型看的操作提示，**不是安全边界**。真正的访问控制仍然由 DevSpace 配置和 Linux 用户权限决定。

插件描述中不要写入：

- Owner Password
- OAuth Token
- Tunnel Token
- API Key
- SSH 密钥
- Linux 密码
- Cloudflare 凭据

## 第一次端到端验证

连接完成后，不要立刻让 ChatGPT 修改重要项目。建议按下面顺序验证。

### 1. 验证工作区打开

在 ChatGPT 中请求：

```text
使用 DevSpace 打开 /srv/devspace/workspace 下的测试项目，并告诉我项目根目录。
```

预期：ChatGPT 调用 `open_workspace` 并返回一个 Workspace ID。

### 2. 验证只读能力

请求：

```text
读取 README.md，概括这个项目的用途，不要修改任何文件。
```

### 3. 验证 Shell

请求：

```text
运行 git status，并告诉我当前工作区是否存在未提交修改。
```

### 4. 验证写入

在专门准备的测试项目中请求：

```text
创建一个 DEVSPACE_TEST.md，只写一行 DevSpace connection test，然后展示修改差异。
```

确认文件已经真实写入虚拟机。

### 5. 验证构建或测试

根据项目类型请求：

```text
运行现有测试，但不要自动修改失败的代码。
```

或者：

```text
运行项目的 build 命令并解释结果。
```

只有这五步都正常，再开始把 DevSpace 用于真实项目。

## 前端视觉分析场景

DevSpace 本身负责“把 ChatGPT 接入本地项目与 Shell”，它并不替代浏览器自动化工具。

如果虚拟机中的项目已经安装 Playwright，可以形成下面的工作流：

```text
ChatGPT
  ↓
DevSpace open_workspace
  ↓
读取前端源码
  ↓
启动开发服务器
  ↓
Playwright 打开页面 / 截图 / 检查 DOM
  ↓
ChatGPT 分析视觉问题
  ↓
修改代码
  ↓
再次运行 Playwright 验证
```

这特别适合：

- 检查布局、间距、溢出和响应式问题。
- 对比修改前后的页面效果。
- 检查 Console Error 和网络请求。
- 自动验证交互流程。
- 把“视觉分析 → 修改 → 再验证”做成 Agent 闭环。

为了让 Agent 稳定执行这类流程，可以在项目的 `AGENTS.md` 或 Skill 中补充：

- 如何启动开发服务器。
- 默认监听地址和端口。
- Playwright 测试入口。
- 页面视觉检查规则。
- 修改前后都需要截图或执行验证的要求。

## 安全边界

这是整套方案最重要的部分。

### Allowed Roots 不是完整 Shell 沙箱

DevSpace 的文件工具会限制在允许的 Workspace 中，但 Shell 命令是本机命令。

Shell 最终能做什么，取决于运行 DevSpace 的 Linux 用户本身能做什么。

因此建议：

- 使用独立 `devspace` 用户。
- 不给该用户配置免密 `sudo`。
- 不把个人 `~/.ssh`、密码库、浏览器数据目录等交给该用户。
- 不把 `/`、整个 `/home` 之类的目录配置为 Allowed Roots。
- 生产环境密钥与 DevSpace 工作区分离。
- 能用测试环境解决的问题，不让 Agent 直接连生产环境。

### 不直接暴露 7676 端口

推荐：

```text
DevSpace -> 127.0.0.1:7676
Cloudflare Tunnel -> 127.0.0.1:7676
```

而不是：

```text
DevSpace -> 0.0.0.0:7676 -> 路由器端口映射 -> Internet
```

### 保管 Owner Password

认证文件：

```text
~/.devspace/auth.json
```

建议权限至少保持为当前用户私有：

```bash
chmod 700 ~/.devspace
chmod 600 ~/.devspace/auth.json
```

不要把这个文件加入任何 Git 仓库。

### 谨慎记录 Shell 命令日志

如果 Shell 命令可能出现数据库密码、Token、带签名 URL 等内容，不建议开启完整 Shell 命令日志。

即使 Agent 本身没有主动泄露密钥，过度详细的命令日志也可能形成新的泄露面。

## 常见问题

### ChatGPT 能连接，但打不开项目

首先检查 `workspaces.allowedRoots`。

然后确认请求的项目路径确实位于某个 Allowed Root 下面。

再检查 Linux 文件权限：

```bash
namei -l /srv/devspace/workspace/example-project
```

DevSpace 用户需要能够遍历父目录并访问项目本身。

### 每次都要告诉 ChatGPT 项目根目录

在 DevSpace 配置 `allowedRoots` 之外，再把非敏感的根目录信息写入插件 / MCP 连接描述。

这会显著改善新会话中的自动定位能力。

### 本地 7676 正常，但公网 `/mcp` 不通

按顺序检查：

```bash
systemctl status devspace
systemctl status cloudflared
```

然后检查 Tunnel 是否指向：

```text
http://127.0.0.1:7676
```

再检查 `publicBaseUrl` 是否和实际公网 Origin 完全一致。

### OAuth 能打开，但认证后失败

重点检查：

- `publicBaseUrl` 是否只包含 Origin，没有 `/mcp`。
- ChatGPT 中 MCP URL 是否包含 `/mcp`。
- 公网域名是否被额外反向代理改写路径。
- Host Header 是否和 DevSpace 预期一致。
- Tunnel 是否把整个 DevSpace HTTP 服务转发过去，而不是只把 `/mcp` 路径挂载到本地。

DevSpace 除了 `/mcp` 之外还需要暴露 OAuth discovery 和授权相关路由，因此只转发单独的 `/mcp` 路径容易导致认证异常。

### ChatGPT 看不到写入或 Shell 工具

可能原因包括：

- DevSpace 当前 `tools.mode` 与预期不同。
- ChatGPT 当前账号或工作区对完整 MCP / 写入动作有限制。
- 自定义 MCP 应用没有完成工具扫描或没有重新连接。
- DevSpace 或 ChatGPT 侧版本发生变化。

先执行：

```bash
devspace doctor
```

再重新启动 DevSpace，并在 ChatGPT 侧重新扫描或重新连接 MCP。

### 更新 DevSpace 后行为发生变化

查看当前安装版本：

```bash
npm list -g @waishnav/devspace --depth=0
```

升级：

```bash
sudo npm install -g @waishnav/devspace@latest
```

升级后建议依次执行：

```bash
devspace doctor
sudo systemctl restart devspace
sudo systemctl status devspace
```

然后重新做一次“打开工作区 → 读取 → Shell → 写入 → 构建”的快速验证。

对于长期使用环境，不建议在无人验证的情况下自动升级 DevSpace。

## 推荐的日常使用方式

一个稳定的日常工作流可以是：

1. 家用虚拟机开机。
2. `devspace.service` 自动启动。
3. `cloudflared.service` 自动启动。
4. ChatGPT 保持 DevSpace 插件 / MCP App 已连接状态。
5. 新任务开始时，ChatGPT 根据插件描述知道允许的项目根目录。
6. 先 `open_workspace`，再进行读取、分析和修改。
7. 修改后运行测试、构建或 Playwright 验证。
8. 最后查看 Git diff，再决定是否提交。

对于重要仓库，可以要求 Agent 默认使用 worktree，避免直接修改正在使用的 Checkout。

## 部署完成检查表

完成以下检查后，才认为整套链路配置完成：

- [ ] Node.js 版本满足 DevSpace 要求。
- [ ] DevSpace 不以 root 运行。
- [ ] Allowed Roots 只包含真正需要操作的项目目录。
- [ ] `devspace doctor` 无关键错误。
- [ ] DevSpace 只监听 `127.0.0.1`。
- [ ] Cloudflare Tunnel 正确转发到 `127.0.0.1:7676`。
- [ ] `publicBaseUrl` 不包含 `/mcp`。
- [ ] ChatGPT MCP URL 包含 `/mcp`。
- [ ] Owner Password 没有进入 Wiki、Git 或聊天正文。
- [ ] `auth.json` 权限已收紧且未被 Git 跟踪。
- [ ] ChatGPT 可以成功 `open_workspace`。
- [ ] 文件读取正常。
- [ ] Shell 测试正常。
- [ ] 测试项目写入正常。
- [ ] 构建 / 测试命令正常。
- [ ] 插件描述中已经写明非敏感的允许根目录。
- [ ] systemd 服务可以在虚拟机重启后自动恢复。

## 进一步强化

如果后续要把这套能力长期用于家庭实验室或更多自动化任务，可以继续增加：

- 为 DevSpace 单独创建 LXC / VM，进一步隔离家庭主机。
- 使用只包含代码与配置副本的工作区，不直接挂载私人目录。
- 为高风险项目默认使用 Git worktree。
- 使用 `AGENTS.md` 固化项目规则。
- 使用 Agent Skills 固化测试、部署和视觉检查流程。
- 为 DevSpace 和 Tunnel 增加健康检查与告警。
- 定期检查全局 npm 包版本和 DevSpace Release Notes。
- 对重要仓库增加自动备份和 Git 远端同步。

## 参考资料

- DevSpace：<https://github.com/Waishnav/devspace>
- DevSpace Setup Guide：<https://github.com/Waishnav/devspace/blob/main/docs/setup.md>
- DevSpace Configuration Reference：<https://github.com/Waishnav/devspace/blob/main/docs/configuration.md>
- DevSpace Security Model：<https://github.com/Waishnav/devspace/blob/main/docs/security.md>
- Cloudflare Tunnel：<https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/>
- OpenAI Apps / MCP：<https://help.openai.com/en/articles/12584461-developer-mode-apps-and-full-mcp-connectors-in-chatgpt-beta>

> [!NOTE]
> DevSpace、ChatGPT 自定义 MCP、Cloudflare Tunnel 都属于持续更新的组件。长期维护这篇 Wiki 时，优先以项目官方 README、Setup Guide 和当前 ChatGPT 产品文档为准，并在升级后重新验证完整链路。