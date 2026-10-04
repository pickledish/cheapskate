<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/vue';
import { InformationCircleIcon } from '@heroicons/vue/24/outline';

export default defineComponent({
  name: 'PageHeader',
  components: { Popover, PopoverButton, PopoverPanel, InformationCircleIcon },
  props: {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String as PropType<string | null>,
      default: null,
    },
    shortTitle: {
      type: String as PropType<string | null>,
      default: null,
    },
  },
});
</script>

<template>
  <div class="relative grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
    <div class="flex min-w-0 items-center gap-2">
      <h2 class="min-w-0 truncate text-2xl font-bold text-primary-text">
        <template v-if="shortTitle">
          <span class="sm:hidden">{{ shortTitle }}</span>
          <span class="hidden sm:inline">{{ title }}</span>
        </template>
        <template v-else>{{ title }}</template>
      </h2>
      <Popover v-if="description" class="shrink-0 sm:hidden">
        <PopoverButton
          class="-m-2 flex p-2 text-muted-text hover:text-secondary-text focus:outline-none"
          aria-label="About this page"
        >
          <InformationCircleIcon class="h-5 w-5" />
        </PopoverButton>
        <transition
          enter-active-class="transition duration-100 ease-out"
          enter-from-class="transform scale-95 opacity-0"
          enter-to-class="transform scale-100 opacity-100"
          leave-active-class="transition duration-75 ease-in"
          leave-from-class="transform scale-100 opacity-100"
          leave-to-class="transform scale-95 opacity-0"
        >
          <PopoverPanel
            class="absolute left-0 top-full z-20 mt-2 w-72 max-w-[85%] origin-top-left rounded-lg border border-surface-border bg-surface p-3 text-sm text-secondary-text shadow-lg focus:outline-none"
          >
            {{ description }}
          </PopoverPanel>
        </transition>
      </Popover>
    </div>
    <div class="shrink-0 self-center" v-bind:class="{ 'sm:row-span-2': description }">
      <slot name="actions" />
    </div>
    <p v-if="description" class="hidden text-sm text-muted-text sm:block">
      {{ description }}
    </p>
  </div>
</template>
