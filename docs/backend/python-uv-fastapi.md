# Python / uv / FastAPI

## uv

```bash
uv venv
source .venv/bin/activate
uv sync
```

临时安装：

```bash
uv pip install fastapi uvicorn
```

导出：

```bash
uv export --format requirements-txt > requirements.txt
```

## 离线依赖

```bash
python -m pip download -r requirements.txt -d wheels/
```

离线安装：

```bash
python -m pip install --no-index --find-links wheels/ -r requirements.txt
```

跨机器时优先确认 Python 版本、CPU 架构和 glibc / manylinux 兼容性。

## FastAPI lifespan

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.resource = object()
    yield

app = FastAPI(lifespan=lifespan)
```

连接池、缓存和客户端等资源放在生命周期中管理，比 import 阶段初始化更可控。

## Pydantic v2

```python
from pydantic import BaseModel, ConfigDict

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
```

## async 注意事项

不要在 async 路径里长时间执行同步 IO 或 CPU 重任务。数据库 Session 应按请求管理，不要全局共享一个 Session。

## 兼容性排查

```bash
python --version
uname -m
ldd --version
```
