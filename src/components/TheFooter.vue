<script setup lang="ts">
function openExternalLink(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <nav mt-6 inline-flex gap-2 text-xl>
    <button icon-btn @click="toggleDark()">
      <div i-carbon-sun dark:i-carbon-moon />
    </button>

    <button
      i-carbon-logo-github icon-btn
      rel="noreferrer"
      target="_blank"
      title="GitHub"
      @click="openExternalLink('https://github.com/DaniilKimlb/bastyon-miniapp-vue-template')"
    />
  </nav>
</template>
