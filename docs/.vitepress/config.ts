import { defineConfig } from 'vitepress'

export default defineConfig({
  title: '技术 Wiki',
  description: '面向日常工程实践的个人技术知识库。',
  lang: 'zh-CN',
  base: process.env.BASE_PATH || '/',
  cleanUrls: true,
  markdown: {
    codeCopyButtonTitle: '复制代码',
    container: {
      tipLabel: '提示',
      infoLabel: '信息',
      warningLabel: '注意',
      dangerLabel: '警告',
      detailsLabel: '详细信息'
    }
  },
  head: [
    ['meta', { name: 'theme-color', content: '#6d5dfc' }],
    ['link', { rel: 'icon', href: `${process.env.BASE_PATH || '/'}logo.svg` }]
  ],
  themeConfig: {
    logo: '/logo.svg',
    siteTitle: '技术 Wiki',
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
          { text: 'DevSpace：连接 ChatGPT 与家用虚拟机', link: '/ai-agent/devspace-home-vm' },
          { text: 'RAG', link: '/ai-agent/rag' }
        ]}
      ]
    },
    outline: {
      label: '本页目录'
    },
    docFooter: {
      prev: '上一篇',
      next: '下一篇'
    },
    darkModeSwitchLabel: '外观',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式',
    sidebarMenuLabel: '目录',
    returnToTopLabel: '返回顶部',
    langMenuLabel: '切换语言',
    skipToContentLabel: '跳转到正文',
    notFound: {
      title: '页面不存在',
      quote: '你访问的页面可能已被移动、删除或尚未创建。',
      linkLabel: '返回首页',
      linkText: '返回首页'
    },
    search: {
      provider: 'local',
      options: {
        translations: {
          button: {
            buttonText: '搜索',
            buttonAriaLabel: '搜索文档'
          },
          modal: {
            displayDetails: '显示详细结果',
            resetButtonTitle: '清空搜索',
            backButtonTitle: '关闭搜索',
            noResultsText: '没有找到相关结果',
            footer: {
              selectText: '选择',
              selectKeyAriaLabel: '回车',
              navigateText: '切换',
              navigateUpKeyAriaLabel: '向上',
              navigateDownKeyAriaLabel: '向下',
              closeText: '关闭',
              closeKeyAriaLabel: 'Esc'
            }
          }
        }
      }
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/Zrain-X/llm-wiki', ariaLabel: 'GitHub 仓库' }
    ],
    footer: {
      message: '基于 VitePress 构建 · 使用 GitHub 维护',
      copyright: '个人技术知识库'
    }
  }
})
