<script setup lang="ts">
import { withBase } from 'vitepress'
</script>

<template>
  <div class="wiki-not-found">
    <section class="wiki-not-found-panel wiki-glass-panel">
      <span class="wiki-not-found-code">404</span>
      <p class="wiki-not-found-eyebrow">页面走丢了</p>
      <h1>页面不存在</h1>
      <p class="wiki-not-found-copy">你访问的页面可能已被移动、删除或尚未创建。</p>
      <a class="wiki-button primary" :href="withBase('/')">返回首页 →</a>
    </section>
  </div>
</template>

<style scoped>
.wiki-not-found {
  display: grid;
  place-items: center;
  min-height: calc(100vh - var(--vp-nav-height) - 90px);
  padding: 56px 24px 80px;
}

.wiki-not-found-panel {
  position: relative;
  width: min(100%, 620px);
  overflow: hidden;
  border-radius: 28px;
  padding: 54px 46px;
  text-align: center;
}

.wiki-not-found-panel::before {
  content: '';
  position: absolute;
  width: 250px;
  height: 250px;
  top: -125px;
  right: -95px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(79, 114, 255, .20), transparent 68%);
  pointer-events: none;
}

.wiki-not-found-code {
  display: inline-block;
  margin-bottom: 13px;
  color: var(--vp-c-brand-1);
  font-size: 68px;
  font-weight: 850;
  line-height: 1;
  letter-spacing: -.055em;
}

.wiki-not-found-eyebrow {
  margin: 0 0 8px;
  color: var(--vp-c-brand-1);
  font-size: 12px;
  font-weight: 750;
  letter-spacing: .12em;
}

.wiki-not-found-panel h1 {
  margin: 0;
  font-size: 32px;
  line-height: 1.2;
  letter-spacing: -.03em;
}

.wiki-not-found-copy {
  margin: 14px auto 24px;
  max-width: 420px;
  color: var(--vp-c-text-2);
  line-height: 1.7;
}

.wiki-not-found-panel .wiki-button {
  position: relative;
  z-index: 1;
}

@media (max-width: 640px) {
  .wiki-not-found {
    padding: 34px 12px 54px;
  }

  .wiki-not-found-panel {
    border-radius: 22px;
    padding: 42px 22px;
  }

  .wiki-not-found-code {
    font-size: 58px;
  }

  .wiki-not-found-panel h1 {
    font-size: 28px;
  }
}
</style>
