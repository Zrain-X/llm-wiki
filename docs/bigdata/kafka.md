# Kafka 运维速查

以下命令使用 `<bootstrap-server>` 代替真实地址。

## Topic

```bash
bin/kafka-topics.sh --bootstrap-server <bootstrap-server> --list
```

```bash
bin/kafka-topics.sh \
  --bootstrap-server <bootstrap-server> \
  --describe \
  --topic <topic>
```

重点看 Partition、Leader、Replicas、ISR 和 Under Replicated Partition。

## Consumer Group

```bash
bin/kafka-consumer-groups.sh --bootstrap-server <bootstrap-server> --list
```

```bash
bin/kafka-consumer-groups.sh \
  --bootstrap-server <bootstrap-server> \
  --describe \
  --group <group-id>
```

`CURRENT-OFFSET` 是消费位置，`LOG-END-OFFSET` 是最新位置，`LAG` 是积压。

## Topic 配置

```bash
bin/kafka-configs.sh \
  --bootstrap-server <bootstrap-server> \
  --entity-type topics \
  --entity-name <topic> \
  --describe
```

常见 retention 相关配置：`retention.ms`、`retention.bytes`、`segment.ms`、`segment.bytes`、`cleanup.policy`。

到 retention 时间不意味着消息在那个瞬间删除，Kafka 以 Segment 为单位后台清理。

## ACL

```bash
bin/kafka-acls.sh --bootstrap-server <bootstrap-server> --list
```

认证环境通常还要加 `--command-config <client.properties>`。

## 消费失败排查

1. Topic 是否存在；
2. Producer 是否有数据；
3. Group 是否正确；
4. LAG 是否持续增长；
5. Consumer 是否在线；
6. ACL 是否允许 READ / GROUP；
7. `auto.offset.reset`；
8. 反序列化异常；
9. 网络和认证。

KRaft 环境优先围绕 `--bootstrap-server` 管理，看到 ZooKeeper 教程先确认是否过时。
