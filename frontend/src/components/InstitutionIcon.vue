<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import { institutionIconUrl } from '@/lib/institutions';

export default defineComponent({
  name: 'InstitutionIcon',
  props: {
    name: {
      type: String as PropType<string | null>,
      default: null,
    },
  },
  computed: {
    src(): string | null {
      return institutionIconUrl(this.name);
    },
  },
});
</script>

<template>
  <img
    v-if="src"
    v-bind:src="src"
    v-bind:alt="name || ''"
    class="h-4 w-4 shrink-0 object-contain rounded-xs"
  />
</template>
