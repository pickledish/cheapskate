<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'AppFooter',
  data() {
    return {
      commitHash: __COMMIT_HASH__,
      commitUrl: __COMMIT_URL__,
      buildDate: new Date(__BUILD_TIME__).toLocaleDateString(),
      workflowRunUrl: __WORKFLOW_RUN_URL__,
      env: import.meta.env.DEV ? 'Development' : 'Production',
    };
  },
});
</script>

<template>
  <footer class="py-4 text-center text-xs text-placeholder-text">
    <span class="hidden sm:inline">Cheapskate</span>
    <span class="hidden sm:inline mx-2">·</span>
    <span>{{ env }}</span>
    <span class="mx-2">·</span>
    <span>
      Commit
      <a
        v-if="commitUrl"
        v-bind:href="commitUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="cursor-pointer hover:underline"
        >{{ commitHash }}</a
      >
      <template v-else>{{ commitHash }}</template>
    </span>
    <span class="mx-2">·</span>
    <span>
      Generated
      <a
        v-if="workflowRunUrl"
        v-bind:href="workflowRunUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="cursor-pointer hover:underline"
        >{{ buildDate }}</a
      >
      <template v-else>{{ buildDate }}</template>
    </span>
  </footer>
</template>
