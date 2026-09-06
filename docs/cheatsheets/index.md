# 个人技术速查

这一部分不是系统教程，而是面向日常工作的**快速检索页**：尽量先给可以直接使用的 SQL、命令和判断方法，再补充必要的原理与坑点。

> 本仓库是公开仓库。这里仅记录可公开复用的技术知识，不保存真实内网地址、域名、账号、密码、Token、公司内部系统信息或其他环境秘密。

## 数据库

- [OceanBase SQL 速查](./database/oceanbase-sql)：日期、整除、元数据、动态字段列表、执行计划。
- [Greenplum 元数据与权限](./database/greenplum-metadata)：`pg_catalog`、`gp_toolkit`、表大小、ACL、外表权限。
- [TiDB / MySQL 数据校验](./database/tidb-mysql-validation)：MD5、NULL、跨库字段归一化和校验套路。

## 大数据

- [Kafka 运维速查](./bigdata/kafka-ops)：Topic、Consumer Group、ACL、Retention、积压判断。

## Linux 与自托管

- [Linux / Shell 速查](./system/linux-shell)：DNS、端口、磁盘、日志、批量替换。
- [Docker / systemd 排障](./system/docker-systemd)：服务来源、容器占用、日志、资源、挂载与开机启动。

## 开发

- [Python / uv / FastAPI](./dev/python-uv-fastapi)：虚拟环境、离线依赖、FastAPI 生命周期、Pydantic v2。

## AI / Agent

- [Coding Agent / MCP](./ai/coding-agent-mcp)：Agent 工作流、工具边界、MCP 接入和项目操作规范。

## 使用原则

1. **先搜结论**：页面标题和小节尽量用问题本身命名。
2. **命令可复制**：示例使用占位符，不写真实环境信息。
3. **区分模式与版本**：尤其 OceanBase、Greenplum、TiDB，遇到兼容性问题先确认数据库模式和版本。
4. **危险操作显式标注**：删除、覆盖、批量替换等操作先预览再执行。
