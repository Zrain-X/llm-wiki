# Python / uv / FastAPI 速查

## uv 初始化与虚拟环境

```bash
uv venv
```

激活：

```bash
source .venv/bin/activate
```

Windows PowerShell：

```powershell
.venv\Scripts\Activate.ps1
```

## 安装依赖

项目模式优先：

```bash
uv sync
```

临时安装：

```bash
uv pip install fastapi uvicorn
```

## 导出 requirements

如果项目使用 `uv.lock`：

```bash
uv export --format requirements-txt > requirements.txt
```

是否需要 `--no-hashes`、开发依赖等参数取决于下游环境。

## 离线依赖准备

思路：联网机器先下载 Wheel，离线机器只从本地目录安装。

```bash
python -m pip download -r requirements.txt -d wheels/
```

离线：

```bash
python -m pip install \
  --no-index \
  --find-links wheels/ \
  -r requirements.txt
```

跨机器打包时最重要的是 Python 版本、CPU 架构、glibc / manylinux 兼容性，不要在新系统随便下载 Wheel 后就假设老系统一定能用。

## FastAPI 推荐生命周期

优先使用 lifespan，而不是把初始化逻辑散在模块 import 阶段。

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 初始化：连接池、缓存、客户端等
    app.state.resource = object()
    yield
    # 清理资源

app = FastAPI(lifespan=lifespan)
```

这样更容易控制：

- 何时建立数据库连接池；
- 何时关闭；
- 测试时如何替换；
- 多 Worker 下资源是否重复初始化。

## Pydantic v2

配置推荐 `ConfigDict`：

```python
from pydantic import BaseModel, ConfigDict

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
```

不要继续把 Pydantic v1 的旧式 `class Config` 当默认写法。

## async 常见坑

### 不要在 async 路径里做长时间阻塞 IO

例如大量同步文件操作、同步 HTTP、CPU 重任务会阻塞事件循环。

### SQLAlchemy / SQLModel Session 生命周期

原则：请求级 Session，请求结束释放；不要把一个 Session 做成全局单例长期共享。

## 打包工具怎么选

- 只需要依赖管理：`uv`；
- 生成单文件可执行：PyInstaller / Nuitka；
- 想进一步编译 Python 模块：Cython / Nuitka；
- 老 Linux 环境：先把 glibc / 编译器兼容性当成第一约束。

遇到“本机能跑、目标机不能跑”，优先比较：

```bash
python --version
uname -m
ldd --version
```
