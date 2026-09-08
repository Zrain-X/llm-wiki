import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import './custom.css'
import './localization.css'
import './polish.css'
import './outline.css'
import HomeHero from '../../components/HomeHero.vue'
import CategoryIndex from '../../components/CategoryIndex.vue'
import ModelExplorer from '../../components/ModelExplorer.vue'
import ModelCompare from '../../components/ModelCompare.vue'
// Keep final visual corrections last so they override theme and component defaults.
import './layout-fixes.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('HomeHero', HomeHero)
    app.component('CategoryIndex', CategoryIndex)
    app.component('ModelExplorer', ModelExplorer)
    app.component('ModelCompare', ModelCompare)
  }
} satisfies Theme
