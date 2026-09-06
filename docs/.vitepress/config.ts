import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'LLM Wiki',
  description: 'Understand, compare, build and deploy with large language models.',
  lang: 'zh-CN',
  base: process.env.BASE_PATH || '/',
  cleanUrls: true,
  head: [
    ['meta', { name: 'theme-color', content: '#6d5dfc' }],
    ['link', { rel: 'icon', href: `${process.env.BASE_PATH || '/'}logo.svg` }]
  ],
  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'LLM Wiki',
    nav: [
      { text: '学习', link: '/learn/' },
      { text: '模型', link: '/models/' },
      { text: 'Agent', link: '/agents/' },
      { text: '工程', link: '/engineering/' },
      { text: '部署', link: '/deploy/' },
      { text: '工具', link: '/tools/' }
    ],
    sidebar: {
      '/learn/': [
        { text: 'LLM 基础', items: [
          { text: '学习路线', link: '/learn/' },
          { text: 'Token', link: '/learn/token' },
          { text: 'Context Window', link: '/learn/context-window' }
        ]}
      ],
      '/models/': [
        { text: '模型', items: [
          { text: '模型中心', link: '/models/' },
          { text: '模型比较', link: '/models/compare' },
          { text: '数据规范', link: '/models/schema' }
        ]}
      ],
      '/agents/': [{ text: 'Agent', items: [
        { text: 'Agent 概览', link: '/agents/' },
        { text: 'MCP', link: '/agents/mcp' }
      ]}],
      '/engineering/': [{ text: 'LLM Engineering', items: [
        { text: '工程概览', link: '/engineering/' },
        { text: 'RAG', link: '/engineering/rag' }
      ]}],
      '/deploy/': [{ text: '部署', items: [
        { text: '部署概览', link: '/deploy/' },
        { text: 'Ollama', link: '/deploy/ollama' }
      ]}],
      '/tools/': [{ text: '工具', items: [
        { text: '工具生态', link: '/tools/' },
        { text: 'Coding Agent', link: '/tools/coding-agent' }
      ]}]
    },
    search: { provider: 'local' },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/Zrain-X/llm-wiki' }
    ],
    footer: {
      message: 'Built with VitePress · Maintained on GitHub',
      copyright: 'LLM Wiki'
    }
  }
})
