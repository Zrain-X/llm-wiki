import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Tech Wiki',
  description: 'A personal technical knowledge base for daily engineering work.',
  lang: 'zh-CN',
  base: process.env.BASE_PATH || '/',
  cleanUrls: true,
  head: [
    ['meta', { name: 'theme-color', content: '#6d5dfc' }],
    ['link', { rel: 'icon', href: `${process.env.BASE_PATH || '/'}logo.svg` }]
  ],
  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'Tech Wiki',
    nav: [
      { text: '数据库', link: '/database/' },
      { text: '大数据', link: '/bigdata/' },
      { text: 'Linux 运维', link: '/linux/' },
      { text: '自托管', link: '/self-hosted/' },
      { text: '后端', link: '/backend/' },
      { text: '前端', link: '/frontend/' },
      { text: 'AI / Agent', link: '/ai-agent/' }
    ],
    sidebar: {
      '/database/': [
        {
          text: '数据库',
          items: [
            { text: '数据库首页', link: '/database/' },
            { text: '国产化迁移总览', link: '/database/database-localization-comparison' }
          ]
        },
        {
          text: '国产数据库',
          collapsed: false,
          items: [
            { text: 'OceanBase', link: '/database/oceanbase' },
            { text: 'TiDB', link: '/database/tidb' },
            { text: 'KingbaseES', link: '/database/kingbasees' },
            { text: '达梦 DM8', link: '/database/dm8' },
            { text: 'GaussDB', link: '/database/gaussdb' },
            { text: 'openGauss', link: '/database/opengauss' }
          ]
        },
        {
          text: '速查与排障',
          items: [
            { text: 'Greenplum 元数据与权限', link: '/database/greenplum' },
            { text: 'TiDB / MySQL 数据校验', link: '/database/tidb-mysql-validation' }
          ]
        }
      ],
      '/bigdata/': [
        { text: '大数据', items: [
          { text: '大数据首页', link: '/bigdata/' },
          { text: 'Kafka 运维', link: '/bigdata/kafka' }
        ]}
      ],
      '/linux/': [
        { text: 'Linux 运维', items: [
          { text: 'Linux 运维首页', link: '/linux/' },
          { text: 'Linux / Shell 速查', link: '/linux/shell' }
        ]}
      ],
      '/self-hosted/': [
        { text: '自托管服务', items: [
          { text: '自托管首页', link: '/self-hosted/' },
          { text: 'Docker / systemd 排障', link: '/self-hosted/docker-systemd' },
          { text: 'Ollama', link: '/self-hosted/ollama' }
        ]}
      ],
      '/backend/': [
        { text: '后端开发', items: [
          { text: '后端首页', link: '/backend/' },
          { text: 'Python / uv / FastAPI', link: '/backend/python-uv-fastapi' }
        ]}
      ],
      '/frontend/': [
        { text: '前端开发', items: [
          { text: '前端首页', link: '/frontend/' },
          { text: 'Vue 3 / Vite / TypeScript', link: '/frontend/vue-vite-typescript' }
        ]}
      ],
      '/ai-agent/': [
        { text: 'AI / Agent', items: [
          { text: 'AI / Agent 首页', link: '/ai-agent/' },
          { text: 'LLM 基础速查', link: '/ai-agent/llm-basics' },
          { text: '模型中心', link: '/ai-agent/models' },
          { text: '模型比较', link: '/ai-agent/compare' },
          { text: 'Coding Agent / MCP', link: '/ai-agent/coding-agent-mcp' },
          { text: 'RAG', link: '/ai-agent/rag' }
        ]}
      ]
    },
    search: { provider: 'local' },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/Zrain-X/llm-wiki' }
    ],
    footer: {
      message: 'Built with VitePress · Maintained on GitHub',
      copyright: 'Personal Tech Wiki'
    }
  }
})
