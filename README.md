# LLM Wiki

一个完全由 GitHub 维护、自动构建并发布到 GitHub Pages 的纯静态个人技术 Wiki。

站点地址：`https://zrain-x.github.io/llm-wiki/`

## 技术栈

- VitePress
- Vue 3 + TypeScript
- Markdown / JSON
- GitHub Actions
- GitHub Pages

## 本地运行

```bash
npm install
npm run docs:dev
```

## 构建

```bash
npm run docs:build
```

## 内容结构

- `docs/cheatsheets/`：个人高频技术速查，覆盖数据库、大数据、Linux、自托管、Python 和 Agent
- `docs/learn/`：LLM 基础知识
- `docs/models/`：模型资料与比较
- `docs/agents/`：Agent / MCP
- `docs/engineering/`：LLM Engineering
- `docs/deploy/`：推理与本地部署
- `docs/tools/`：工具生态
- `docs/data/`：用于交互组件的静态结构化数据

## 内容原则

这是公开仓库，因此只记录可公开复用的知识，不保存真实内网地址、域名、账号、密码、Token、公司内部系统信息或其他环境秘密。

## 发布

推送到 `main` 后，GitHub Actions 会自动构建并发布到 GitHub Pages。
