# DevSpace：让 ChatGPT 安全操作家用开发环境

DevSpace 是一个自托管 MCP Server，用来把 ChatGPT 或其他 MCP Client 接入自己控制的开发环境。它把“打开项目、读取与修改文件、执行 Shell、查看差异、使用工作区和 worktree”等能力封装为 MCP Tools，使远程 Agent 可以在明确授权的目录中直接完成开发任务。

本文不是单纯的安装记录，而是围绕 **DevSpace 的定位、架构、权限边界、配置方式、部署模型和实际工作流** 进行整理，并给出一套适合家用虚拟机长期运行的参考实现。

> [!IMPORTANT]
> 一句话理解：**DevSpace = Workspace 管理 + 文件操作 + Shell 执行 + MCP 接口。**
>
> 它不是远程桌面，不负责创建公网隧道，也不能把本机 Shell 自动变成安全沙箱。

## 1. DevSpace 解决什么问题

普通 ChatGPT 会话天然看不到家里虚拟机上的完整项目。传统做法通常是手工上传文件、复制代码片段，或者另外通过 SSH / IDE 操作主机。

DevSpace 解决的是中间这一层：

```text
ChatGPT
   │
   │ MCP Tool Calls
   ▼
DevSpace
   │
   ├─ 打开 Workspace
   ├─ 读取 / 修改文件
   ├─ 执行 Shell
   ├─ 查看 Git 差异
   ├─ 管理 Worktree
   └─ 发现 Skills / Agent 配置
   │
   ▼
本地开发环境
```

因此它特别适合：

- 让 ChatGPT 直接阅读完整代码仓库，而不是反复上传文件。
- 修改代码后直接运行测试、构建、Lint 和 Git 命令。
- 在手机或其他不具备完整 IDE 的设备上继续处理家中项目。
- 维护自托管服务的配置、脚本和基础设施仓库。
- 为不同 Agent 会话创建独立 Git worktree，减少相互干扰。
- 配合 Playwright 等浏览器自动化工具形成“视觉分析 → 修改 → 再验证”的闭环。
- 通过 `AGENTS.md`、Agent Skills 和项目规则，让 Agent 理解项目自己的操作规范。

不适合把它理解成：

- NAS 文件共享。
- 完整远程桌面。
- SSH 的安全替代品。
- 容器或虚拟机级别的安全沙箱。

## 2. 整体架构与组件职责

家用虚拟机的推荐链路如下：

```text
┌────────────────────────┐
│        ChatGPT         │
│   MCP Client / Agent   │
└───────────┬────────────┘
            │ HTTPS + OAuth + MCP
            ▼
┌────────────────────────┐
│      公网接入层        │
│ Tunnel / HTTPS Proxy   │
└───────────┬────────────┘
            │ http://127.0.0.1:7676
            ▼
┌────────────────────────┐
│        DevSpace        │
│ Workspace / Tools / UI │
└───────────┬────────────┘
            │ 本机用户权限
            ▼
┌────────────────────────┐
│      专用 Linux VM     │
│ Git / Node / Python    │
│ Docker / Playwright... │
└────────────────────────┘
```

各组件职责要分清：

| 组件 | 负责什么 | 不负责什么 |
| --- | --- | --- |
| ChatGPT | 理解任务、调用 MCP Tools、分析结果 | 不直接挂载本地目录 |
| DevSpace | Workspace、文件、Shell、差异、Skills 等本机开发能力 | 不创建公网 Tunnel，不提供完整主机沙箱 |
| Tunnel / HTTPS Proxy | 给 ChatGPT 提供可访问的公网 HTTPS Origin | 不决定 DevSpace 能访问哪些文件 |
| Linux 用户 / VM / Container | 真正的操作系统权限和隔离边界 | 不理解 MCP Workspace 语义 |
| Git worktree | 为不同任务隔离代码 Checkout | 不是安全边界 |
| Playwright | 浏览器访问、DOM、截图、交互验证 | 不代替 DevSpace 的文件与 Shell 能力 |

这里最重要的设计原则是：**公网接入、MCP 权限和操作系统权限是三层不同的问题，不应该混为一谈。**

## 3. DevSpace 的核心概念

### Workspace

DevSpace 不是让 Agent 任意浏览整台机器，而是先通过 `open_workspace` 打开一个项目目录，随后文件操作围绕这个 Workspace 进行。

典型流程：

```text
允许根目录
/srv/devspace/workspace
        │
        ├─ project-a
        ├─ project-b
        └─ llm-wiki
             │
             ▼
      open_workspace
             │
             ▼
        Workspace ID
             │
       ┌─────┴─────┐
       ▼           ▼
     read       edit / shell
```

### Allowed Roots

`workspaces.allowedRoots` 定义 MCP Workspace 可以从哪些根目录打开项目。

推荐：

```jsonc
"allowedRoots": [
  "/srv/devspace/workspace"
]
```

不建议为了省事配置为：

```text
/
/home
~
```

Allowed Roots 越窄，越容易判断 ChatGPT 可以通过 DevSpace 文件工具接触哪些项目。

> [!WARNING]
> `allowedRoots` 是 **DevSpace 文件 / Workspace 层面的边界**，不是 Shell 沙箱。Shell 命令最终能访问什么，仍取决于运行 DevSpace 的 Linux 用户权限。

### Tool Mode

当前 DevSpace 的 `tools.mode` 主要有两种工具面：

| 模式 | 主要工具 |
| --- | --- |
| `codex` | `open_workspace`、`read`、`apply_patch`、`exec_command`、`write_stdin`、`show_changes` |
| `claude` | `open_workspace`、`read`、`write`、`edit`、`bash`、`show_changes` |

这两种模式主要是为了适配不同 Coding Agent 的工具调用习惯，并不代表两套不同的权限模型。

### Worktree

DevSpace 可以把 Git worktree 用作任务级工作区隔离。

它适合解决：

```text
主 Checkout 正在运行
        │
        ├─ 会话 A → worktree A
        ├─ 会话 B → worktree B
        └─ 人工修改 → 主 Checkout
```

这样可以减少多个 Agent 或人工操作同时修改同一工作区带来的冲突。

但需要注意：**worktree 是工作流隔离，不是安全隔离。**

### Skills 与 Subagents

DevSpace 可以发现标准 Agent Skills，并支持配置可调用的子 Agent Provider。

Skills 适合固化：

- 项目启动方式。
- 测试命令。
- 构建与发布规范。
- 数据库迁移要求。
- 前端视觉检查流程。
- 修改前后必须执行的验证步骤。

对于长期维护的项目，与其每次在聊天中重复说明，不如把规则沉淀在项目自身的 `AGENTS.md`、`.agents/skills` 或 DevSpace Skills 中。

## 4. 最重要的安全模型

DevSpace 暴露的是远程开发能力，因此应当按“远程访问开发机”而不是“普通 Web 服务”来设计。

### 两层权限边界

最容易误解的是 `allowedRoots` 与 Shell 的关系：

```text
MCP 文件操作
    │
    ▼
Workspace / Allowed Roots
    │
    └─ 控制 DevSpace 文件工具可以打开哪些项目

Shell 命令
    │
    ▼
Linux User / Container / VM
    │
    └─ 决定命令在操作系统中真正能做什么
```

因此：

```text
真正的主机安全边界
=
Linux User / Container / VM
```

而不是：

```text
allowedRoots
```

### 推荐安全基线

| 风险 | 实际控制点 | 建议 |
| --- | --- | --- |
| Workspace 打开过宽 | `allowedRoots` | 只允许专用项目目录 |
| Shell 越权 | Linux 用户 | 使用独立低权限用户，不给免密 sudo |
| 私钥 / 密码泄露 | 文件系统权限 | 不让 DevSpace 用户读取私人 `~/.ssh`、密码库等 |
| 生产 Secret 暴露 | Workspace / env | 开发环境与生产凭据分离 |
| MCP 公网暴露 | OAuth + Tunnel | DevSpace 仅监听 `127.0.0.1` |
| Host Header 攻击 | `allowedHosts` / `publicBaseUrl` | 不随意设置 `*` |
| Shell 日志泄密 | `logging.shellCommands` | 默认关闭完整 Shell 命令记录 |
| 主 Checkout 被破坏 | Git worktree | 高风险任务使用独立 worktree |

### Owner Password 与认证文件

初始化后认证信息保存在：

```text
~/.devspace/auth.json
```

Owner Password 只应该在你主动批准 MCP Client 时使用。

不要把以下内容放入 Wiki、Git、Issue、截图或聊天正文：

- Owner Password。
- `auth.json` 内容。
- OAuth Token。
- Tunnel Token。
- Cloudflare API Token。
- SSH 私钥。
- Linux 密码。

建议至少限制认证文件权限：

```bash
chmod 700 ~/.devspace
chmod 600 ~/.devspace/auth.json
```

## 5. 部署模式怎么选

DevSpace 本身不负责创建公网隧道。ChatGPT 要访问家中 DevSpace 时，需要额外提供一个公网 HTTPS Origin。

常见方式：

| 接入方式 | 特点 | 适合场景 |
| --- | --- | --- |
| Cloudflare Tunnel | 无需家庭端口映射，配置成熟 | 家庭宽带长期运行，推荐 |
| Tailscale Funnel | 与 Tailscale 体系结合方便 | 已大量使用 Tailscale |
| ngrok / Pinggy | 上手快 | 临时验证 |
| 自建 HTTPS Reverse Proxy | 自由度最高 | 已有公网入口和证书体系 |
| 直接暴露 7676 | 风险高 | 不推荐 |

本文采用的长期部署模型是：

```text
ChatGPT
   │
Cloudflare Tunnel
   │
127.0.0.1:7676
   │
DevSpace
   │
专用 Linux 用户
   │
/srv/devspace/workspace
```

Cloudflare Tunnel 只是其中一种接入方式，不是 DevSpace 的必要组成部分。

## 6. 家用虚拟机参考部署

以下示例以 Debian / Ubuntu 类 Linux 为例。

### 创建专用用户与工作区

```bash
sudo useradd --create-home --shell /bin/bash devspace
sudo mkdir -p /srv/devspace/workspace
sudo chown -R devspace:devspace /srv/devspace
```

推荐的项目组织方式：

```text
/srv/devspace/workspace/
├── project-a/
├── project-b/
├── llm-wiki/
└── infra/
```

如果已有项目位于其他目录，也可以授权已有路径，但应先确认 `devspace` 用户的真实文件权限。

### 基础依赖

当前 DevSpace 要求：

- Node.js `>=22.19 <27`
- npm
- Git
- Bash

检查：

```bash
node -v
npm -v
git --version
bash --version
```

### 安装与初始化

官方文档可以直接使用：

```bash
npx @waishnav/devspace init
```

如果准备长期作为 systemd 服务运行，也可以安装全局 CLI：

```bash
sudo npm install -g @waishnav/devspace
```

然后使用专用用户初始化：

```bash
sudo -iu devspace
devspace init
```

初始化 ChatGPT 场景时重点关注三个值：

1. 允许打开的 Project Roots。
2. 公网 `publicBaseUrl`。
3. Owner Password。

## 7. 关键配置速查

默认持久配置与认证文件分开保存：

```text
~/.devspace/config.jsonc
~/.devspace/auth.json
```

一个适合家用虚拟机的脱敏示例：

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/Waishnav/devspace/main/schema/v1/devspace.schema.json",
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

  "ui": {
    "enabled": true
  },

  "artifacts": {
    "enabled": false,
    "maxFileBytes": 104857600
  },

  "skills": {
    "enabled": true,
    "paths": [],
    "agentDir": "~/.codex"
  },

  "logging": {
    "level": "info",
    "format": "json",
    "requests": true,
    "assets": false,
    "toolCalls": true,
    "shellCommands": false
  }
}
```

关键字段：

| 配置 | 作用 | 家用环境建议 |
| --- | --- | --- |
| `server.host` | 本地监听地址 | `127.0.0.1` |
| `server.port` | DevSpace HTTP/MCP 端口 | 默认 `7676` |
| `server.publicBaseUrl` | OAuth 与 MCP discovery 使用的公网 Origin | 只写 Origin，不加 `/mcp` |
| `server.allowedHosts` | Host Header 白名单 | 保持严格，不使用 `*` 做长期配置 |
| `server.trustProxy` | 是否信任代理头 | 仅在明确理解代理链时开启 |
| `workspaces.allowedRoots` | MCP 可打开的项目根目录 | 显式配置窄范围目录 |
| `workspaces.worktreeRoot` | DevSpace 管理的 worktree 位置 | 与主项目目录分开 |
| `tools.mode` | MCP 工具调用风格 | ChatGPT / Codex 场景通常使用 `codex` |
| `ui.enabled` | 是否附加 Apps UI 元数据 | 一般保持开启 |
| `skills.enabled` | 是否发现 Agent Skills | 长期项目建议开启 |
| `logging.shellCommands` | 是否记录 Shell 命令预览 | 有 Secret 风险时保持 `false` |

> [!NOTE]
> 官方配置中空的 `workspaces.allowedRoots` 会使用当前工作目录。长期服务不建议依赖这种隐式行为，最好明确写出允许的根目录。

修改公网地址时可以使用：

```bash
devspace config set publicBaseUrl https://devspace.example.com
```

完整检查：

```bash
devspace doctor
```

## 8. 公网接入与 ChatGPT 连接

### URL 的两个概念不要混淆

这是最常见的配置错误之一。

DevSpace 配置：

```text
server.publicBaseUrl
=
https://devspace.example.com
```

ChatGPT MCP Endpoint：

```text
https://devspace.example.com/mcp
```

也就是：

| 配置位置 | 正确示例 |
| --- | --- |
| DevSpace `publicBaseUrl` | `https://devspace.example.com` |
| ChatGPT MCP URL | `https://devspace.example.com/mcp` |

`publicBaseUrl` 是 Origin，所以不能带 `/mcp`。

### Tunnel 必须转发整个 DevSpace HTTP 服务

Tunnel / Reverse Proxy 应该指向：

```text
http://127.0.0.1:7676
```

不要只把公网 `/mcp` 路径映射到本地服务，因为 DevSpace 除了 MCP Endpoint 之外，还需要 OAuth discovery 和授权相关路由。

### Cloudflare Tunnel 的最小配置

如果使用 Dashboard 创建 Tunnel，只需要保证：

```text
Public Hostname
devspace.example.com

Origin Service
http://127.0.0.1:7676
```

不需要把 Cloudflare Tunnel 的完整安装过程复制进这篇 DevSpace Wiki；Tunnel 本身应作为独立的基础设施主题维护。

### Tailscale Funnel

官方文档也支持把整个本地服务暴露给 Funnel：

```bash
tailscale funnel --bg 7676
```

同样不要只挂载 `/mcp` 子路径。

### 让 ChatGPT 自动知道项目根目录

`allowedRoots` 只解决“服务端允许访问哪里”，并不会天然保证 ChatGPT 每个新会话都知道项目放在哪里。

如果 ChatGPT 的插件 / MCP 配置支持描述信息，建议加入非敏感的工作区说明，例如：

```text
该 DevSpace 连接到专用开发虚拟机。
允许的项目根目录为 /srv/devspace/workspace。
操作项目时先使用 open_workspace 打开对应目录，
再使用读取、编辑和命令工具完成任务。
```

这可以显著减少新会话反复询问“项目目录在哪里”的情况。

但需要再次强调：**插件描述只是给模型看的上下文，不是权限控制。**

## 9. 作为 systemd 服务长期运行

手工运行 `devspace serve` 适合测试，长期使用建议交给 systemd。

先确认 CLI 路径：

```bash
command -v devspace
```

示例服务：

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

启用：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now devspace
```

检查：

```bash
systemctl status devspace
journalctl -u devspace -f
```

`NoNewPrivileges=true` 可以减少部分提权路径，但不会改变 DevSpace Shell 继承 Linux 用户权限这一事实。

## 10. 推荐的日常工作流

DevSpace 真正好用的地方不是“能打开文件”，而是把一次完整开发任务串起来。

推荐流程：

```text
1. open_workspace
        ↓
2. 读取 README / AGENTS.md / Skills
        ↓
3. git status，确认初始状态
        ↓
4. 分析代码与问题
        ↓
5. 修改文件
        ↓
6. 运行 test / lint / build
        ↓
7. show_changes / git diff
        ↓
8. 人工确认或提交
```

对于重要项目，再增加一层：

```text
新任务
  ↓
创建独立 worktree
  ↓
Agent 修改与验证
  ↓
Review Diff
  ↓
Merge / Cherry-pick
```

这样 DevSpace 才从“远程文件工具”真正变成一个可重复的 Agent 工作环境。

## 11. Playwright 与前端视觉分析

DevSpace 负责项目文件和 Shell；Playwright 负责浏览器。

两者组合后的职责链路是：

```text
ChatGPT
   │
   ├─ DevSpace：读取源码
   ├─ DevSpace：启动 Dev Server
   │
   ├─ Playwright：打开页面
   ├─ Playwright：检查 DOM / Console / Screenshot
   │
   ├─ ChatGPT：分析视觉问题
   │
   ├─ DevSpace：修改源码
   │
   └─ Playwright：重新验证
```

如果 Playwright 已安装在项目中，DevSpace 的 Shell 可以直接运行项目已有的 Playwright CLI / Test 命令。

如果另外部署独立的 Playwright MCP，则它与 DevSpace 是两个互补工具：

```text
DevSpace MCP
→ Filesystem / Shell / Git

Playwright MCP
→ Browser / DOM / Screenshot / Interaction
```

前端视觉闭环中特别需要注意网络位置：**浏览器运行在哪里，开发服务器就必须从那里可达。**

例如 Playwright 与项目都运行在同一台 VM 时，通常可以直接访问：

```text
http://127.0.0.1:<DEV_PORT>
```

如果浏览器运行在另一台主机或云环境，则需要另外解决 Dev Server 的网络可达性，不能把 DevSpace 的 MCP Tunnel 当成前端页面代理。

项目的 `AGENTS.md` / Skill 中建议明确写出：

- Dev Server 启动命令。
- 默认监听地址和端口。
- Playwright 测试入口。
- 需要检查的页面路径。
- 视觉检查标准。
- 修改后必须执行的回归验证。

## 12. DevSpace 与常见方案的定位区别

| 方案 | 文件操作 | Shell | Browser | Workspace | MCP | 主要定位 |
| --- | --- | --- | --- | --- | --- | --- |
| DevSpace | ✓ | ✓ | 间接 | ✓ | ✓ | 远程 Coding Workspace |
| Filesystem MCP | ✓ | × | × | 基础 | ✓ | 文件读写 |
| Playwright MCP | × | × | ✓ | × | ✓ | 浏览器自动化 |
| SSH | ✓ | ✓ | × | × | × | 主机远程管理 |
| 本地 Coding Agent | ✓ | ✓ | 可扩展 | 本地项目 | 不一定 | 本机自动编程 |

因此 DevSpace 最有价值的场景不是替代 SSH，而是：

> **把本地 Coding Agent 常见的“文件 + Shell + 项目上下文”能力，以结构化 MCP 的方式安全地提供给 ChatGPT。**

## 13. 故障诊断

遇到问题时，不要从 ChatGPT 一端盲目重连，可以按链路逐层排查。

```text
ChatGPT 无法使用 DevSpace
│
├─ 1. 公网地址不可达
│    ├─ Tunnel 是否在线
│    ├─ DNS 是否正确
│    └─ Origin 是否指向 127.0.0.1:7676
│
├─ 2. OAuth / MCP 连接失败
│    ├─ publicBaseUrl 是否只包含 Origin
│    ├─ ChatGPT URL 是否包含 /mcp
│    ├─ 是否错误地只代理 /mcp
│    └─ Host Header / allowedHosts 是否匹配
│
├─ 3. 能连接但打不开项目
│    ├─ allowedRoots 是否包含目标项目
│    └─ Linux 用户是否有目录遍历与读写权限
│
├─ 4. 能读文件但 Shell 失败
│    ├─ Bash / Git / Node 是否存在
│    ├─ systemd PATH 是否和交互 Shell 不同
│    └─ devspace 用户是否拥有执行权限
│
└─ 5. 工具缺失或行为异常
     ├─ tools.mode 是否正确
     ├─ MCP Client 是否重新扫描工具
     ├─ DevSpace 版本是否变化
     └─ devspace doctor 是否报告异常
```

### 本地先验证 DevSpace

```bash
devspace doctor
systemctl status devspace
```

### 再验证公网入口

Tunnel 应指向：

```text
http://127.0.0.1:7676
```

### 项目权限问题

可以检查完整目录权限链：

```bash
namei -l /srv/devspace/workspace/example-project
```

### 更新后行为异常

查看版本：

```bash
npm list -g @waishnav/devspace --depth=0
```

升级：

```bash
sudo npm install -g @waishnav/devspace@latest
```

升级后不要直接认为环境正常，至少重新执行：

```bash
devspace doctor
sudo systemctl restart devspace
```

然后完成一次最小回归：

```text
open_workspace
→ read
→ shell
→ write / patch
→ test / build
→ show_changes
```

## 14. 部署验收标准

完成下面这些验证，才算真正部署完成：

- [ ] DevSpace 使用独立低权限 Linux 用户运行。
- [ ] `allowedRoots` 只包含需要给 Agent 使用的目录。
- [ ] DevSpace 只监听 `127.0.0.1`。
- [ ] 公网 HTTPS 接入正常，没有直接暴露 7676。
- [ ] `publicBaseUrl` 是 Origin，不包含 `/mcp`。
- [ ] ChatGPT MCP Endpoint 包含 `/mcp`。
- [ ] Owner Password 和 `auth.json` 没有进入 Git / Wiki / 聊天记录。
- [ ] `open_workspace` 能正确打开目标项目。
- [ ] 文件读取与修改正常。
- [ ] Shell 可以执行 Git、测试和构建命令。
- [ ] 修改后可以查看差异。
- [ ] 插件描述中已经提供非敏感的项目根目录信息。
- [ ] systemd 可以在 VM 重启后自动恢复服务。
- [ ] 高风险项目已经明确是否使用 worktree。

## 15. 长期维护建议

这套环境稳定运行后，可以继续强化：

- DevSpace 独占一个 VM / LXC，进一步缩小主机权限边界。
- Agent Workspace 只存代码与测试配置，不直接挂载私人数据目录。
- 为重要仓库默认启用 worktree 工作流。
- 用 `AGENTS.md` 和 Skills 固化项目操作规则。
- 将 Cloudflare Tunnel、Tailscale 等网络接入单独沉淀为基础设施 Wiki，避免本文膨胀。
- 为 DevSpace / Tunnel 增加健康检查和告警。
- 升级 DevSpace 后固定执行最小 MCP 回归测试。
- 定期审查 `allowedRoots`、Linux 用户权限和历史遗留 Secret。

## 参考资料

- DevSpace：<https://github.com/Waishnav/devspace>
- Setup Guide：<https://github.com/Waishnav/devspace/blob/main/docs/setup.md>
- Configuration Reference：<https://github.com/Waishnav/devspace/blob/main/docs/configuration.md>
- Security Model：<https://github.com/Waishnav/devspace/blob/main/docs/security.md>
- Cloudflare Tunnel：<https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/>
- OpenAI Apps / MCP：<https://help.openai.com/en/articles/12584461-developer-mode-apps-and-full-mcp-connectors-in-chatgpt-beta>

> [!NOTE]
> DevSpace、ChatGPT MCP、Tunnel 和相关 Agent 能力都在持续变化。长期维护本文时，应优先保留“架构、权限边界、工作流”这些稳定知识，把具体版本参数和 UI 操作路径以官方最新文档为准。