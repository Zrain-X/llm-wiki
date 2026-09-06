# Docker / systemd 排障速查

目标是快速回答三个问题：**谁启动的？现在跑在哪？为什么起不来？**

## Docker 容器概览

```bash
docker ps -a
```

只看名称、状态和端口：

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
```

## 容器日志

```bash
docker logs --tail 200 <container>
```

持续跟踪：

```bash
docker logs -f <container>
```

## 资源占用

```bash
docker stats
```

只取一次：

```bash
docker stats --no-stream
```

## 挂载路径

```bash
docker inspect <container> \
  --format '{{json .Mounts}}'
```

如果有 `jq`：

```bash
docker inspect <container> | jq '.[0].Mounts'
```

## 看启动参数

```bash
docker inspect <container> | jq '.[0].Config.Cmd, .[0].Config.Entrypoint'
```

## 看重启策略

```bash
docker inspect <container> \
  --format '{{.HostConfig.RestartPolicy.Name}}'
```

容器“自己又起来了”时重点检查这里，以及 Compose / systemd / 外部编排器是否在拉起它。

## Docker Compose

```bash
docker compose ps
```

```bash
docker compose logs --tail=200
```

```bash
docker compose config
```

最后一个很有用：它能把多份 Compose 配置、环境变量替换后的最终配置展开出来。

## systemd 服务来源

```bash
systemctl status <service> --no-pager
```

看完整 Unit：

```bash
systemctl cat <service>
```

看最终合并后的属性：

```bash
systemctl show <service>
```

## Docker 端口被占用

先看宿主机：

```bash
ss -lntp | grep ':80 '
```

如果看到 Docker / containerd 相关进程，再回查容器：

```bash
docker ps --format 'table {{.Names}}\t{{.Ports}}'
```

不要只凭 `ps` 里看到 `containerd-shim` 就直接杀进程，因为它通常只是容器运行时的一部分。

## 容器启动失败排查顺序

1. `docker ps -a` 看退出码；
2. `docker logs` 看应用错误；
3. `docker inspect` 看环境变量、挂载、命令；
4. 宿主机端口是否冲突；
5. 挂载目录是否存在、权限是否正确；
6. DNS / 网络是否正常；
7. 依赖服务是否已启动；
8. Compose 变量是否正确展开。

## systemd 启动失败排查顺序

```bash
systemctl status <service> --no-pager
journalctl -u <service> -b --no-pager
systemctl cat <service>
```

重点看：

- `ExecStart` 路径；
- WorkingDirectory；
- User / Group；
- Environment / EnvironmentFile；
- 权限；
- 依赖服务；
- Restart 策略。
