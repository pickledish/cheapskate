<script>
import { relativeDate } from '@/lib/format';
import {
  DocumentTextIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  ArchiveBoxIcon,
} from '@heroicons/vue/24/outline';
import { TrashIcon } from '@heroicons/vue/24/solid';

const EVENT_TYPES = {
  statement: {
    title: 'Statement Upload',
    icon: DocumentTextIcon,
    iconClass: 'text-blue-500',
    borderClass: 'border-blue-500',
    undoTitle: 'Undo statement upload',
  },
  mark_as_closed: {
    title: 'Account Marked as Closed',
    icon: ArchiveBoxIcon,
    iconClass: 'text-placeholder-text',
    borderClass: 'border-surface-border-strong',
    undoTitle: 'Undo close',
  },
  manual_price: {
    title: 'Price Update',
    icon: CurrencyDollarIcon,
    iconClass: 'text-green-500',
    borderClass: 'border-green-500',
    undoTitle: 'Undo price update',
  },
  manual_holdings: {
    title: 'Shares Update',
    icon: ChartBarIcon,
    iconClass: 'text-purple-500',
    borderClass: 'border-purple-500',
    undoTitle: 'Undo shares update',
  },
};

export default {
  name: 'HistoryEventCard',
  components: { TrashIcon },
  props: {
    type: {
      type: String,
      required: true,
      validator: (value) => Object.keys(EVENT_TYPES).includes(value),
    },
    accountName: {
      type: String,
      default: null,
    },
    createdAt: {
      type: String,
      required: true,
    },
    creatorName: {
      type: String,
      default: null,
    },
  },
  emits: ['undo'],
  computed: {
    config() {
      return EVENT_TYPES[this.type];
    },
    relativeLabel() {
      return relativeDate(this.createdAt);
    },
  },
};
</script>

<template>
  <div class="bg-surface rounded-lg shadow p-4 border-l-4" v-bind:class="config.borderClass">
    <div>
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <component
            v-bind:is="config.icon"
            class="h-5 w-5 shrink-0"
            v-bind:class="config.iconClass"
          />
          <!-- prettier-ignore -->
          <span class="font-medium text-primary-text shrink-0 whitespace-nowrap">
            {{ config.title }}
          </span>
          <template v-if="accountName">
            <span class="text-placeholder-text shrink-0">-</span>
            <span class="font-medium text-primary-text truncate min-w-0">{{ accountName }}</span>
          </template>
        </div>
        <div class="hidden sm:flex items-center gap-2 shrink-0">
          <!-- prettier-ignore -->
          <span class="text-sm text-muted-text">{{ relativeLabel }}<template v-if="creatorName"> by {{ creatorName }}</template></span>
          <button
            class="w-8 h-8 -my-1 flex items-center justify-center text-placeholder-text hover:text-error-text hover:bg-error rounded cursor-pointer"
            v-bind:title="config.undoTitle"
            v-on:click="$emit('undo')"
          >
            <TrashIcon class="w-5 h-5" />
          </button>
        </div>
      </div>
      <div class="sm:hidden ml-7 text-sm text-muted-text">
        {{ relativeLabel }}<template v-if="creatorName"> by {{ creatorName }}</template>
      </div>
    </div>
    <hr class="my-3 border-surface-border" />
    <slot />
  </div>
</template>
