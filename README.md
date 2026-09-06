# LLM Wiki

一个完全由 GitHub 维护、自动构建并发布到 GitHub Pages 的纯静态 LLM Wiki。

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

- `docs/learn/`：LLM 基础知识
- `docs/models/`：模型资料与比较
- `docs/agents/`：Agent / MCP
- `docs/engineering/`：LLM Engineering
- `docs/deploy/`：推理与本地部署
- `docs/tools/`：工具生态
- `docs/data/`：用于交互组件的静态结构化数据

## 发布

推送到 `main` 后，GitHub Actions 会自动构建并发布到 GitHub Pages。
