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
    ['meta', { name: 'theme-color', content: '#4f72ff' }],
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
      { text: '后端开发', link: '/backend/' },
      { text: '前端开发', link: '/frontend/' },
      { text: 'AI / Agent', link: '/ai-agent/' }
    ],
    outline: {
      level: [2, 3],
      label: '文章目录'
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
