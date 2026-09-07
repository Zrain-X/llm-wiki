<script setup lang="ts">
import { computed } from 'vue'
import { withBase } from 'vitepress'

type CategoryKey = 'database' | 'bigdata' | 'linux' | 'self-hosted' | 'backend' | 'frontend' | 'ai-agent'

type Article = {
  title: string
  desc: string
  link: string
  tag: string
}

type Category = {
  icon: string
  title: string
  desc: string
  articles: Article[]
}

const props = defineProps<{ category: CategoryKey }>()

const categoryData: Record<CategoryKey, Category> = {
  database: {
    icon: '◉',
    title: '数据库',
    desc: '数据库设计、国产化迁移、跨库兼容、SQL 调优与日常排障。',
    articles: [
      { title: '数据库国产化迁移对比', desc: '从 MySQL、PostgreSQL、Oracle 出发，对比主要国产数据库的兼容方向、迁移改造量和适用场景。', link: '/database/database-localization-comparison', tag: '国产化迁移' },
      { title: 'OceanBase', desc: 'MySQL / Oracle 双兼容模式、迁移注意点、特色语法、执行计划与性能调优。', link: '/database/oceanbase', tag: 'OceanBase' },
      { title: 'TiDB', desc: 'MySQL 兼容、分布式架构、TiKV / TiFlash、热点问题与 SQL 调优。', link: '/database/tidb', tag: 'TiDB' },
      { title: 'KingbaseES', desc: 'Oracle / MySQL / PostgreSQL 等兼容模式、过程对象迁移与性能调优。', link: '/database/kingbasees', tag: 'KingbaseES' },
      { title: '达梦 DM8', desc: 'Oracle / MySQL / PostgreSQL 兼容参数、DTS 迁移、SQL 差异与性能调优。', link: '/database/dm8', tag: 'DM8' },
      { title: 'GaussDB', desc: 'Oracle / MySQL / PostgreSQL 兼容模式、集中式与分布式差异、SQL 调优。', link: '/database/gaussdb', tag: 'GaussDB' },
      { title: 'openGauss', desc: 'PostgreSQL 迁移、兼容模式、执行计划、统计信息与常用优化手段。', link: '/database/opengauss', tag: 'openGauss' },
      { title: 'Greenplum 元数据与权限', desc: '系统目录、表大小采集、ACL、外表以及 WLM 相关问题的日常排障速查。', link: '/database/greenplum', tag: 'Greenplum' },
      { title: 'TiDB / MySQL 数据校验', desc: '围绕 Hash、NULL 归一化、日期与数值格式、分桶策略进行迁移后的数据一致性校验。', link: '/database/tidb-mysql-validation', tag: '数据校验' }
    ]
  },
  bigdata: {
    icon: '▥',
    title: '大数据',
    desc: 'Kafka、Hadoop、Spark、Hive、数据加工与大数据平台运维。',
    articles: [
      { title: 'Kafka 运维速查', desc: 'Kafka Topic、消费组、Retention、ACL、常用命令与典型异常排查。', link: '/bigdata/kafka', tag: 'Kafka' }
    ]
  },
  linux: {
    icon: '>_',
    title: 'Linux 运维',
    desc: 'Shell、网络、进程、磁盘、日志、systemd 与日常问题定位。',
    articles: [
      { title: 'Linux / Shell 速查', desc: '日常文件、进程、网络、文本处理与批量操作中高频使用的 Linux / Shell 命令。', link: '/linux/shell', tag: 'Shell' }
    ]
  },
  'self-hosted': {
    icon: '⌂',
    title: '自托管',
    desc: '家庭服务器、VPS、NAS、容器、反向代理、私有网络与本地服务。',
    articles: [
      { title: 'Docker / systemd 排障', desc: '容器进程、端口占用、服务托管以及 Docker 与 systemd 之间关系的排查方法。', link: '/self-hosted/docker-systemd', tag: 'Docker' },
      { title: 'Ollama', desc: '本地模型运行、服务部署、模型管理与常见使用配置。', link: '/self-hosted/ollama', tag: 'Ollama' }
    ]
  },
  backend: {
    icon: '{ }',
    title: '后端开发',
    desc: 'Python、FastAPI、Go、API、数据库访问、依赖管理与服务端工程。',
    articles: [
      { title: 'Python / uv / FastAPI', desc: 'Python 依赖管理、uv、FastAPI、服务生命周期与工程化实践速查。', link: '/backend/python-uv-fastapi', tag: 'Python' }
    ]
  },
  frontend: {
    icon: '◇',
    title: '前端开发',
    desc: 'Vue 3、TypeScript、Vite、组件库、ECharts、Electron 与前端工程。',
    articles: [
      { title: 'Vue 3 / Vite / TypeScript', desc: 'Vue 3 项目结构、TypeScript、Vite 构建以及常见前端工程问题。', link: '/frontend/vue-vite-typescript', tag: 'Vue 3' }
    ]
  },
  'ai-agent': {
    icon: '✦',
    title: 'AI / Agent',
    desc: 'LLM、模型选择、Coding Agent、MCP、RAG 与本地开发环境集成。',
    articles: [
      { title: 'DevSpace：让 ChatGPT 安全操作家用开发环境', desc: '通过 Workspace、文件工具、Shell 与 MCP，把 ChatGPT 接入自己控制的开发环境，并明确权限边界。', link: '/ai-agent/devspace-home-vm', tag: 'DevSpace · MCP' },
      { title: 'Coding Agent / MCP', desc: '梳理 Coding Agent、MCP Server、本地文件工具与开发环境之间的能力边界。', link: '/ai-agent/coding-agent-mcp', tag: 'MCP' },
      { title: 'LLM 基础速查', desc: '集中整理大语言模型常见概念、上下文、推理、采样和使用时需要关注的基础知识。', link: '/ai-agent/llm-basics', tag: 'LLM' },
      { title: '模型中心', desc: '通过结构化数据查看常用模型及其定位，作为个人模型选择入口。', link: '/ai-agent/models', tag: '模型' },
      { title: '模型比较', desc: '从编码、推理、上下文和使用场景等维度横向比较常用模型。', link: '/ai-agent/compare', tag: '模型比较' },
      { title: 'RAG', desc: '检索增强生成的核心概念、基本架构、适用场景与工程实践入口。', link: '/ai-agent/rag', tag: 'RAG' }
    ]
  }
}

const current = computed(() => categoryData[props.category])
const tagCount = computed(() => new Set(current.value.articles.map((article) => article.tag)).size)
</script>

<template>
  <main class="wiki-category-page">
    <section class="wiki-category-hero wiki-glass-panel">
      <div class="wiki-category-main">
        <div class="wiki-category-title-row">
          <span class="wiki-category-icon">{{ current.icon }}</span>
          <div>
            <h1>{{ current.title }}</h1>
            <p>{{ current.desc }}</p>
          </div>
        </div>

        <div class="wiki-category-stats">
          <div>
            <strong>{{ current.articles.length }}</strong>
            <span>篇文章</span>
          </div>
          <div>
            <strong>{{ tagCount }}</strong>
            <span>知识主题</span>
          </div>
          <div>
            <strong>持续</strong>
            <span>维护更新</span>
          </div>
        </div>
      </div>
      <div class="wiki-category-orb" aria-hidden="true">{{ current.icon }}</div>
    </section>

    <section class="wiki-article-list wiki-glass-panel">
      <div class="wiki-list-head">
        <div>
          <h2>全部文章</h2>
          <p>按文章标题与简介快速定位内容。</p>
        </div>
        <span>{{ current.articles.length }} 篇</span>
      </div>

      <a
        v-for="article in current.articles"
        :key="article.link"
        class="wiki-article-row"
        :href="withBase(article.link)"
      >
        <div class="wiki-article-copy">
          <h3>{{ article.title }}</h3>
          <p>{{ article.desc }}</p>
        </div>
        <div class="wiki-article-meta">
          <span class="wiki-tag">{{ article.tag }}</span>
          <span class="wiki-read-more">阅读文章 →</span>
        </div>
      </a>
    </section>
  </main>
</template>
