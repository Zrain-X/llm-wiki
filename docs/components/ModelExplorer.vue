<script setup lang="ts">
import { computed, ref } from 'vue'
import models from '../data/models.json'

const query = ref('')
const provider = ref('全部')
const providers = ['全部', ...new Set(models.map(model => model.provider))]

const capabilityLabels: Record<string, string> = {
  Reasoning: '推理',
  Coding: '编程',
  Vision: '视觉',
  Tools: '工具调用'
}

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return models.filter(model => {
    const providerMatched = provider.value === '全部' || model.provider === provider.value
    const capabilityTexts = model.capabilities.flatMap(capability => [capability, capabilityLabels[capability] || capability])
    const haystack = [model.name, model.provider, ...capabilityTexts].join(' ').toLowerCase()
    return providerMatched && (!q || haystack.includes(q))
  })
})
</script>

<template>
  <div class="explorer-tools">
    <input
      v-model="query"
      class="explorer-search"
      placeholder="搜索模型、厂商或能力，例如：编程"
      aria-label="搜索模型、厂商或能力"
    />
  </div>
  <div class="explorer-tools" aria-label="按厂商筛选">
    <button
      v-for="item in providers"
      :key="item"
      class="filter-chip"
      :class="{ active: provider === item }"
      @click="provider = item"
    >{{ item }}</button>
  </div>

  <div class="model-grid">
    <article v-for="model in filtered" :key="model.id" class="model-card">
      <div class="model-provider">{{ model.provider }}</div>
      <h3>{{ model.name }}</h3>
      <div class="model-meta">{{ model.status }} · 上下文：{{ model.context }}</div>
      <div class="badges">
        <span v-for="capability in model.capabilities" :key="capability" class="badge">
          {{ capabilityLabels[capability] || capability }}
        </span>
      </div>
    </article>
  </div>

  <p class="wiki-note">当前为界面 MVP 示例数据；精确模型版本、价格和上下文将在引用官方来源后逐项核验。</p>
</template>
