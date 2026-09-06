# Coding Agent / MCP

## Coding Agent 的核心闭环

```text
读取项目
  ↓
理解约束
  ↓
制定计划
  ↓
修改文件
  ↓
运行构建 / 测试
  ↓
读取结果
  ↓
继续修复
```

缺少执行工具和结果反馈，Agent 很容易退化成只会给建议的聊天模型。

## 最小项目操作能力

- 文件读取与搜索；
- 精确编辑；
- Git diff / status；
- Shell；
- Build / Test；
- 前端项目最好有浏览器 / Playwright 视觉验证。

## MCP

```text
LLM / Agent
    ↓
MCP Client
    ↓
MCP Server
    ↓
Files / Git / DB / Browser / API
```

MCP 标准化工具与资源暴露方式，但不会自动解决权限、安全和业务语义。

## 接工具先检查四件事

1. Agent 能不能发现工具；
2. 是否真的有权限；
3. Workspace / repo 等上下文能不能自然传递；
4. 失败后能否看到错误并继续修复。

## 多 Agent

适合拆独立 Issue、独立模块调研、实现/测试/文档并行。不适合多个 Agent 同时改同一文件或强依赖串行结果的任务。
