<script>
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { DocumentTextIcon, CurrencyDollarIcon, ChartBarIcon, ArchiveBoxIcon } from '@heroicons/vue/24/outline'
import { TrashIcon } from '@heroicons/vue/24/solid'

dayjs.extend(relativeTime)

const EVENT_TYPES = {
  statement: {
    title: 'Statement Upload',
    icon: DocumentTextIcon,
    iconClass: 'text-blue-500',
    borderClass: 'border-blue-500',
    undoTitle: 'Undo statement upload'
  },
  mark_as_closed: {
    title: 'Account Marked as Closed',
    icon: ArchiveBoxIcon,
    iconClass: 'text-gray-400',
    borderClass: 'border-gray-400',
    undoTitle: 'Undo close'
  },
  manual_price: {
    title: 'Price Update',
    icon: CurrencyDollarIcon,
    iconClass: 'text-green-500',
    borderClass: 'border-green-500',
    undoTitle: 'Undo price update'
  },
  manual_holdings: {
    title: 'Shares Update',
    icon: ChartBarIcon,
    iconClass: 'text-purple-500',
    borderClass: 'border-purple-500',
    undoTitle: 'Undo shares update'
  }
}

export default {
  name: 'HistoryEventCard',
  components: { TrashIcon },
  props: {
    type: {
      type: String,
      required: true,
      validator: (value) => Object.keys(EVENT_TYPES).includes(value)
    },
    accountName: {
      type: String,
      default: null
    },
    createdAt: {
      type: String,
      required: true
    },
    creatorName: {
      type: String,
      default: null
    }
  },
  emits: ['undo'],
  computed: {
    config() {
      return EVENT_TYPES[this.type]
    },
    relativeLabel() {
      return dayjs(this.createdAt).fromNow()
    }
  }
}
</script>

<template>
  <div class="bg-white rounded-lg shadow p-4 border-l-4" :class="config.borderClass">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <component :is="config.icon" class="h-5 w-5" :class="config.iconClass" />
        <span class="font-medium text-gray-900">{{ config.title }}</span>
        <template v-if="accountName">
          <span class="text-gray-400">-</span>
          <span class="font-medium text-gray-900">{{ accountName }}</span>
        </template>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-sm text-gray-500">{{ relativeLabel }}<template v-if="creatorName"> by {{ creatorName }}</template></span>
        <button
          v-on:click="$emit('undo')"
          class="w-8 h-8 -my-1 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer"
          :title="config.undoTitle"
        >
          <TrashIcon class="w-5 h-5" />
        </button>
      </div>
    </div>
    <hr class="my-3 border-gray-200" />
    <slot />
  </div>
</template>
