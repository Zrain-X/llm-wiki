# Docker / systemd 排障

目标是快速回答：谁启动的、现在跑在哪、为什么起不来。

## 容器

```bash
docker ps -a
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
docker logs --tail 200 <container>
docker stats --no-stream
```

挂载：

```bash
docker inspect <container> --format '{{json .Mounts}}'
```

重启策略：

```bash
docker inspect <container> --format '{{.HostConfig.RestartPolicy.Name}}'
```

## Compose

```bash
docker compose ps
docker compose logs --tail=200
docker compose config
```

`docker compose config` 很适合检查环境变量替换后的最终配置。

## systemd

```bash
systemctl status <service> --no-pager
systemctl cat <service>
systemctl show <service>
```

## 端口冲突

```bash
ss -lntp | grep ':80 '
docker ps --format 'table {{.Names}}\t{{.Ports}}'
```

不要因为看到 `containerd-shim` 就直接杀进程。

## 容器启动失败

1. `docker ps -a` 看退出码；
2. `docker logs`；
3. `docker inspect` 看环境变量、挂载和命令；
4. 检查端口冲突；
5. 检查目录和权限；
6. 检查 DNS / 网络；
7. 检查依赖服务；
8. 检查 Compose 展开配置。
