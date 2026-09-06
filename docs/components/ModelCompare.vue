<script setup lang="ts">
import { computed, ref } from 'vue'
import models from '../data/models.json'

const leftId = ref(models[0].id)
const rightId = ref(models[1].id)
const left = computed(() => models.find(model => model.id === leftId.value)!)
const right = computed(() => models.find(model => model.id === rightId.value)!)
const rows = ['Reasoning', 'Coding', 'Vision', 'Tools']

const has = (model: typeof models[number], capability: string) => model.capabilities.includes(capability)
</script>

<template>
  <div class="compare-wrap">
    <div class="compare-selects">
      <select v-model="leftId">
        <option v-for="model in models" :key="model.id" :value="model.id">{{ model.provider }} · {{ model.name }}</option>
      </select>
      <select v-model="rightId">
        <option v-for="model in models" :key="model.id" :value="model.id">{{ model.provider }} · {{ model.name }}</option>
      </select>
    </div>
    <div class="compare-row">
      <div class="compare-label">厂商</div>
      <div class="compare-value">{{ left.provider }}</div>
      <div class="compare-value">{{ right.provider }}</div>
    </div>
    <div class="compare-row">
      <div class="compare-label">Context</div>
      <div class="compare-value">{{ left.context }}</div>
      <div class="compare-value">{{ right.context }}</div>
    </div>
    <div v-for="row in rows" :key="row" class="compare-row">
      <div class="compare-label">{{ row }}</div>
      <div class="compare-value">{{ has(left, row) ? '✓' : '—' }}</div>
      <div class="compare-value">{{ has(right, row) ? '✓' : '—' }}</div>
    </div>
  </div>
</template>
