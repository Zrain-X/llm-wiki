# Kafka 运维速查

常用目标：看 Topic、看积压、看消费组、看配置、查 ACL、判断为什么数据没被消费或没被清理。

以下命令假设 Kafka 自带 CLI 在 `bin/` 下，并用 `<bootstrap-server>` 代替真实地址。

## Topic 列表

```bash
bin/kafka-topics.sh \
  --bootstrap-server <bootstrap-server> \
  --list
```

## Topic 详情

```bash
bin/kafka-topics.sh \
  --bootstrap-server <bootstrap-server> \
  --describe \
  --topic <topic>
```

重点看：

- Partition 数；
- Leader；
- Replicas；
- ISR；
- 是否有 Under Replicated Partition。

## Consumer Group 列表

```bash
bin/kafka-consumer-groups.sh \
  --bootstrap-server <bootstrap-server> \
  --list
```

## 看消费积压

```bash
bin/kafka-consumer-groups.sh \
  --bootstrap-server <bootstrap-server> \
  --describe \
  --group <group-id>
```

常见字段：

- `CURRENT-OFFSET`：消费到哪里；
- `LOG-END-OFFSET`：Topic 最新位置；
- `LAG`：积压量。

`LAG` 大不一定就是消费者故障，还要看它是否持续增长、业务是否本来就是批量消费。

## 看 Topic 配置

```bash
bin/kafka-configs.sh \
  --bootstrap-server <bootstrap-server> \
  --entity-type topics \
  --entity-name <topic> \
  --describe
```

## Retention

常见配置：

```text
retention.ms
retention.bytes
segment.ms
segment.bytes
cleanup.policy
```

`retention.ms` 到时间不代表消息会在那个瞬间精确删除。Kafka 以 Segment 为单位清理，最终删除时间还受 Segment 滚动和后台清理周期影响。

## ACL 列表

```bash
bin/kafka-acls.sh \
  --bootstrap-server <bootstrap-server> \
  --list
```

如果启用了认证，CLI 通常还需要传 `--command-config <client.properties>`。

## 消费失败的排查顺序

1. Topic 是否存在；
2. Producer 是否真的写入；
3. Consumer Group 是否正确；
4. 是否有 LAG；
5. Consumer 实例是否在线；
6. ACL 是否允许 READ / GROUP；
7. `auto.offset.reset` 是否符合预期；
8. 是否因为反序列化异常反复失败；
9. 网络和认证配置是否一致。

## KRaft 环境

新环境优先围绕 `--bootstrap-server` 管理，不再把 ZooKeeper 当默认前提。遇到旧教程时，先确认它是不是针对旧架构写的。
