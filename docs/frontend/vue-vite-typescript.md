# Vue 3 / Vite / TypeScript 速查

## 新项目基础结构

推荐组合：Vue 3 + TypeScript + Vite。状态复杂时再加入 Pinia，不要为了“以后可能会用”提前堆依赖。

## Composition API

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'

const count = ref(0)
const doubled = computed(() => count.value * 2)
</script>
```

`ref` 在脚本中需要 `.value`，模板中会自动解包。

## Props

```vue
<script setup lang="ts">
interface Props {
  title: string
  count?: number
}

const props = withDefaults(defineProps<Props>(), {
  count: 0
})
</script>
```

## Emits

```ts
const emit = defineEmits<{
  save: [id: string]
}>()
```

## Vite 环境变量

浏览器端可访问的变量必须使用 `VITE_` 前缀：

```env
VITE_API_BASE=/api
```

```ts
const base = import.meta.env.VITE_API_BASE
```

不要把密钥放进 Vite 环境变量；打包后的前端代码对用户可见。

## 开发代理

```ts
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true
    }
  }
}
```

## 常见排查顺序

1. 浏览器 Console；
2. Network 请求与响应；
3. Vite dev server 输出；
4. 环境变量是否正确加载；
5. 路由 base / history；
6. 构建后静态资源路径；
7. TypeScript 类型与运行时数据是否一致。

前端视觉问题应实际打开页面检查，不能只看代码判断结果。
