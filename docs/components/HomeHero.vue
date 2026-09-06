<script setup lang="ts">
import { withBase } from 'vitepress'

const entries = [
  { icon: '▦', title: '数据库', desc: 'OceanBase、Greenplum、TiDB、PostgreSQL、SQL 与数据校验。', link: '/database/' },
  { icon: '≋', title: '大数据', desc: 'Kafka、Hadoop、Spark、Hive 与数据平台运维。', link: '/bigdata/' },
  { icon: '>_', title: 'Linux 运维', desc: 'Shell、网络、磁盘、进程、systemd 与常用排障命令。', link: '/linux/' },
  { icon: '⌂', title: '自托管服务', desc: 'Docker、反向代理、网络服务、私有部署与家庭基础设施。', link: '/self-hosted/' },
  { icon: '{ }', title: '后端开发', desc: 'Python、FastAPI、uv、Go、接口与服务端工程。', link: '/backend/' },
  { icon: '◇', title: '前端开发', desc: 'Vue 3、TypeScript、Vite、组件与桌面端前端。', link: '/frontend/' },
  { icon: '◎', title: 'AI / Agent', desc: 'LLM、模型、Coding Agent、MCP、RAG 与本地推理。', link: '/ai-agent/' }
]
</script>

<template>
  <section class="wiki-hero">
    <span class="wiki-eyebrow">GitHub-native · 100% Static · Personal Wiki</span>
    <h1>My technical knowledge base.</h1>
    <p>把日常开发、数据库、大数据、Linux、自托管和 AI / Agent 中反复使用的知识沉淀成可搜索、可复制、可持续维护的个人技术手册。</p>
    <div class="wiki-actions">
      <a class="wiki-button primary" :href="withBase('/database/')">开始查阅</a>
      <a class="wiki-button secondary" :href="withBase('/ai-agent/')">AI / Agent</a>
    </div>
  </section>

  <section class="wiki-section">
    <div class="wiki-section-head">
      <div>
        <h2>知识分类</h2>
        <p>按照实际工作域组织，而不是按照教程章节组织。</p>
      </div>
    </div>
    <div class="wiki-grid">
      <a v-for="entry in entries" :key="entry.title" class="wiki-entry" :href="withBase(entry.link)">
        <div class="icon">{{ entry.icon }}</div>
        <h3>{{ entry.title }}</h3>
        <p>{{ entry.desc }}</p>
      </a>
    </div>
  </section>
</template>
