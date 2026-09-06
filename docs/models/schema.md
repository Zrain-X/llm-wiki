# 模型数据规范

模型数据将保持结构化，并优先引用官方来源。

```yaml
id: model-id
name: Model Name
provider: Provider
release_date: 2026-01-01
status: active
context_window: null
capabilities:
  reasoning: true
  coding: true
  vision: false
  tool_calling: true
sources:
  - type: official
    url: https://example.com
last_verified: 2026-09-06
```

关键原则：**未知字段保持未知，不为了填满表格而猜测。**
