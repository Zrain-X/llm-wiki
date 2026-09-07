<script setup lang="ts">
import { withBase } from 'vitepress'

const entries = [
  { icon: '◉', title: '数据库', count: 9, desc: '国产化迁移、跨库兼容、SQL 调优与排障。', link: '/database/', tone: 'blue' },
  { icon: '▥', title: '大数据', count: 1, desc: 'Kafka、Hadoop、Spark、Hive 与数据平台。', link: '/bigdata/', tone: 'purple' },
  { icon: '>_', title: 'Linux 运维', count: 1, desc: 'Shell、网络、进程、磁盘与 systemd。', link: '/linux/', tone: 'green' },
  { icon: '⌂', title: '自托管', count: 2, desc: 'Docker、VPS、NAS、网络与本地服务。', link: '/self-hosted/', tone: 'orange' },
  { icon: '{ }', title: '后端开发', count: 1, desc: 'Python、FastAPI、Go 与服务端工程。', link: '/backend/', tone: 'pink' },
  { icon: '◇', title: '前端开发', count: 1, desc: 'Vue 3、TypeScript、Vite 与前端工程。', link: '/frontend/', tone: 'cyan' },
  { icon: '✦', title: 'AI / Agent', count: 6, desc: 'LLM、Coding Agent、MCP、RAG 与模型。', link: '/ai-agent/', tone: 'violet' }
]

const recent = [
  {
    title: 'DevSpace：让 ChatGPT 安全操作家用开发环境',
    desc: '通过 Workspace、文件工具、Shell 与 MCP，把 ChatGPT 接入自己控制的开发环境。',
    category: 'AI / Agent',
    link: '/ai-agent/devspace-home-vm'
  },
  {
    title: '数据库国产化迁移对比',
    desc: '从 MySQL、PostgreSQL、Oracle 出发，对比主要国产数据库的兼容方向与迁移改造量。',
    category: '数据库',
    link: '/database/database-localization-comparison'
  },
  {
    title: 'OceanBase',
    desc: 'MySQL / Oracle 双兼容模式、迁移注意点、特色语法与性能调优。',
    category: '数据库',
    link: '/database/oceanbase'
  },
  {
    title: 'Kafka 运维速查',
    desc: 'Kafka Topic、消费组、Retention、ACL、常用命令与典型异常排查。',
    category: '大数据',
    link: '/bigdata/kafka'
  }
]

const totalArticles = entries.reduce((sum, entry) => sum + entry.count, 0)
</script>

<template>
  <div class="wiki-home-shell">
    <section class="wiki-home-hero wiki-glass-panel">
      <div class="wiki-home-hero-copy">
        <span class="wiki-eyebrow">记录 · 整理 · 持续成长</span>
        <h1>技术 <span>Wiki</span></h1>
        <p class="wiki-home-subtitle">个人技术知识库 / Personal Engineering Wiki</p>
        <p class="wiki-home-description">
          专注于数据库、大数据、Linux 运维、自托管、后端开发、前端开发与 AI / Agent，
          把日常工程问题沉淀成可查阅、可复用、可持续维护的个人技术手册。
        </p>
        <div class="wiki-actions">
          <a class="wiki-button primary" :href="withBase('/database/')">开始浏览 →</a>
          <a class="wiki-button secondary" :href="withBase('/ai-agent/')">AI / Agent</a>
        </div>
      </div>

      <aside class="wiki-home-quote">
        <span class="quote-mark">“</span>
        <p>技术让生活更自由<br>知识使人走得更远</p>
        <small>Keep Learning · Keep Building</small>
      </aside>
    </section>

    <section class="wiki-home-section wiki-glass-panel">
      <div class="wiki-section-head">
        <div>
          <h2>知识领域</h2>
          <p>七大技术方向，当前共 {{ totalArticles }} 篇文章。</p>
        </div>
      </div>

      <div class="wiki-stats-grid">
        <a
          v-for="entry in entries"
          :key="entry.title"
          class="wiki-stat-card"
          :href="withBase(entry.link)"
        >
          <span class="wiki-stat-icon" :class="`tone-${entry.tone}`">{{ entry.icon }}</span>
          <h3>{{ entry.title }}</h3>
          <strong>{{ entry.count }}</strong>
          <small>篇文章</small>
          <p>{{ entry.desc }}</p>
        </a>
      </div>
    </section>

    <section class="wiki-home-section wiki-glass-panel">
      <div class="wiki-section-head">
        <div>
          <h2>最近更新</h2>
          <p>近期新增与重点整理的内容。</p>
        </div>
      </div>

      <div class="wiki-recent-list">
        <a v-for="item in recent" :key="item.link" class="wiki-recent-row" :href="withBase(item.link)">
          <span class="wiki-doc-icon">▤</span>
          <div class="wiki-recent-copy">
            <h3>{{ item.title }}</h3>
            <p>{{ item.desc }}</p>
          </div>
          <div class="wiki-recent-meta">
            <span class="wiki-tag">{{ item.category }}</span>
            <span>阅读文章 →</span>
          </div>
        </a>
      </div>
    </section>
  </div>
</template>
