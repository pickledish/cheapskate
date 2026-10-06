<script lang="ts">
import { defineComponent, type ComponentPublicInstance, type PropType } from 'vue';
import { Menu as HeadlessMenu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue';
import type { RouteLocationRaw } from 'vue-router';

export type ActionMenuItem = {
  label: string;
  destructive?: boolean;
  to?: RouteLocationRaw;
  onClick?: () => void;
};

export default defineComponent({
  name: 'ActionsMenu',
  components: { HeadlessMenu, MenuButton, MenuItems, MenuItem },
  props: {
    items: {
      type: Array as PropType<ActionMenuItem[]>,
      required: true,
    },
  },
  data() {
    return {
      anchor: null as HTMLElement | null,
    };
  },
  created() {
    if (!this.$slots.button) {
      throw new Error('ActionsMenu requires a button slot');
    }
  },
  methods: {
    setAnchor(el: Element | ComponentPublicInstance | null) {
      this.anchor = el instanceof HTMLElement ? el : null;
    },

    // Menus inside overflow-x-auto tables get clipped, so the panel is portaled
    // and pinned to the trigger with a fixed position.
    dropdownStyle(): Record<string, string> {
      if (!this.anchor) return {};
      const rect = this.anchor.getBoundingClientRect();
      return {
        top: `${rect.bottom + 4}px`,
        right: `${document.documentElement.clientWidth - rect.right}px`,
      };
    },

    itemClass(active: boolean, item: ActionMenuItem): string {
      const tone =
        item.destructive && active
          ? 'bg-error text-error-text'
          : active
            ? 'bg-surface-recessed-deep text-primary-text'
            : 'text-secondary-text';
      return `block w-full whitespace-nowrap text-left px-4 py-2 text-sm cursor-pointer ${tone}`;
    },
  },
});
</script>

<template>
  <HeadlessMenu v-slot:default="{ open }" as="div" class="inline-block text-left">
    <div v-bind:ref="setAnchor" class="inline-block">
      <MenuButton as="template">
        <slot name="button" />
      </MenuButton>
    </div>
    <Teleport to="body">
      <MenuItems
        v-bind:style="open ? dropdownStyle() : undefined"
        class="fixed z-50 min-w-32 w-max bg-surface border border-surface-border rounded-md shadow-lg focus:outline-none py-1 flex flex-col"
      >
        <MenuItem v-for="item in items" v-bind:key="item.label" v-slot:default="{ active }">
          <router-link v-if="item.to" v-bind:to="item.to" v-bind:class="itemClass(active, item)">
            {{ item.label }}
          </router-link>
          <button
            v-else
            type="button"
            v-bind:class="itemClass(active, item)"
            v-on:click="item.onClick"
          >
            {{ item.label }}
          </button>
        </MenuItem>
      </MenuItems>
    </Teleport>
  </HeadlessMenu>
</template>
