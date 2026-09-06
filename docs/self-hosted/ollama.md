# Ollama

Ollama 适合快速管理和运行本地模型，也是自托管 AI 服务里常用的入口。

## 常用命令

```bash
ollama list
ollama ps
ollama pull <model>
ollama run <model>
ollama rm <model>
```

## 服务状态

Linux 常见：

```bash
systemctl status ollama --no-pager
journalctl -u ollama -n 200 --no-pager
```

## 排障重点

- 模型是否已经下载完整；
- GPU / 驱动是否被识别；
- 显存是否足够；
- 并发和上下文大小是否造成额外显存压力；
- API 监听地址是否符合预期；
- 容器化时 GPU 设备是否正确透传。

涉及具体模型能力、量化和上下文限制时，以当前模型卡和 Ollama 实际版本为准。
