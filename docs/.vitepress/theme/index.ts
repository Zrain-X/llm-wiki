import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import './custom.css'
import './localization.css'
import HomeHero from '../../components/HomeHero.vue'
import ModelExplorer from '../../components/ModelExplorer.vue'
import ModelCompare from '../../components/ModelCompare.vue'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('HomeHero', HomeHero)
    app.component('ModelExplorer', ModelExplorer)
    app.component('ModelCompare', ModelCompare)
  }
} satisfies Theme
