<script setup lang="ts">
const commitHash = __COMMIT_HASH__
const buildDate = new Date(__BUILD_TIME__).toLocaleDateString()
const env = import.meta.env.DEV ? 'Development' : 'Production'
</script>

<template>
  <footer class="py-4 text-center text-xs text-gray-400">
    <span>Cheapskate</span>
    <span class="mx-2">·</span>
    <span>{{ env }} Build</span>
    <span class="mx-2">·</span>
    <span>Commit {{ commitHash }}</span>
    <span class="mx-2">·</span>
    <span>Generated {{ buildDate }}</span>
  </footer>
</template>
