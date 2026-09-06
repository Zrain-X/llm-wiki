# Tech Wiki

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

- `docs/database/`：数据库
- `docs/bigdata/`：大数据
- `docs/linux/`：Linux 运维
- `docs/self-hosted/`：自托管服务
- `docs/backend/`：后端开发
- `docs/frontend/`：前端开发
- `docs/ai-agent/`：AI / Agent
- `docs/data/`：站点交互组件使用的静态结构化数据

## 内容原则

这是公开仓库，因此只记录可公开复用的知识，不保存真实内网地址、域名、账号、密码、Token、公司内部系统信息或其他环境秘密。

## 发布

推送到 `main` 后，GitHub Actions 会自动构建并发布到 GitHub Pages。
