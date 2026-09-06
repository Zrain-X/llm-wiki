<script setup lang="ts">
import { withBase } from 'vitepress'

const entries = [
  { icon: '◫', title: 'Learn', desc: '从 Token、上下文到 Transformer，建立完整 LLM 基础。', link: '/learn/' },
  { icon: '◇', title: 'Models', desc: '浏览模型、厂商、能力与演进关系。', link: '/models/' },
  { icon: '◎', title: 'Agents', desc: '理解 Tool Calling、MCP 与 Agent 系统。', link: '/agents/' },
  { icon: '⌘', title: 'Build', desc: 'RAG、结构化输出、推理部署与工程实践。', link: '/engineering/' }
]
</script>

<template>
  <section class="wiki-hero">
    <span class="wiki-eyebrow">GitHub-native · 100% Static · Open Wiki</span>
    <h1>Understand the LLM world.</h1>
    <p>一个由 GitHub 维护的开放 LLM 知识库。理解概念、比较模型、学习 Agent，并把知识真正用于工程实践。</p>
    <div class="wiki-actions">
      <a class="wiki-button primary" :href="withBase('/models/')">探索模型</a>
      <a class="wiki-button secondary" :href="withBase('/learn/')">开始学习</a>
    </div>
  </section>

  <section class="wiki-section">
    <div class="wiki-grid">
      <a v-for="entry in entries" :key="entry.title" class="wiki-entry" :href="withBase(entry.link)">
        <div class="icon">{{ entry.icon }}</div>
        <h3>{{ entry.title }}</h3>
        <p>{{ entry.desc }}</p>
      </a>
    </div>
  </section>
</template>
