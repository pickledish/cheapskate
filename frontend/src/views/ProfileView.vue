<script>
import AppLayout from '@/components/AppLayout.vue'
import EditNameModal from '@/components/modals/EditNameModal.vue'
import ChangeFamilyModal from '@/components/modals/ChangeFamilyModal.vue'
import DeleteAccountModal from '@/components/modals/DeleteAccountModal.vue'
import { supabase } from '@/lib/supabase'
import { getProfile, listProfilesByFamily } from '@/lib/data'
import { Listbox, ListboxButton, ListboxOptions, ListboxOption } from '@headlessui/vue'
import { ClipboardIcon } from '@heroicons/vue/24/outline'
import { ChevronUpDownIcon, CheckIcon } from '@heroicons/vue/20/solid'
import dayjs from 'dayjs'

export default {
  name: 'ProfileView',
  components: {
    AppLayout,
    EditNameModal,
    ChangeFamilyModal,
    DeleteAccountModal,
    ClipboardIcon,
    Listbox,
    ListboxButton,
    ListboxOptions,
    ListboxOption,
    ChevronUpDownIcon,
    CheckIcon
  },
  data() {
    return {
      // User data
      userEmail: null,
      userName: null,
      familyId: null,
      familyMembers: [],

      // UI state
      loading: true,
      error: null,
      familyIdRevealed: false,
      copyFeedback: false,

      // Modal state
      showEditNameModal: false,
      showChangeFamilyModal: false,
      showDeleteAccountModal: false,

      // Local LLM config
      localLlmOptions: [
        { id: 'disabled', name: 'Disabled' },
        { id: 'ollama', name: 'Ollama' },
        { id: 'openai', name: 'OpenAI Compatible' }
      ],
      localLlmProvider: 'disabled',
      localLlmPort: '11434'
    }
  },
  computed: {
    selectedLlmOption() {
      return this.localLlmOptions.find(o => o.id === this.localLlmProvider)
    }
  },
  async mounted() {
    await this.loadData()
  },
  methods: {
    async loadData() {
      this.loading = true
      this.error = null

      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        this.userEmail = user.email
        this.familyId = user.user_metadata?.family_id

        // Load profile and family members in parallel
        const [profile, members] = await Promise.all([
          getProfile(user.id),
          listProfilesByFamily(this.familyId)
        ])

        this.userName = profile?.name || 'Unknown'
        this.familyMembers = members

      } catch (err) {
        this.error = err.message
      } finally {
        this.loading = false
      }
    },

    toggleFamilyIdReveal() {
      this.familyIdRevealed = !this.familyIdRevealed
    },

    async copyFamilyId() {
      try {
        await navigator.clipboard.writeText(this.familyId)
        this.copyFeedback = true
        setTimeout(() => {
          this.copyFeedback = false
        }, 2000)
      } catch (err) {
        // Fallback: select the text
        this.error = 'Failed to copy. Please select and copy manually.'
      }
    },

    async signOut() {
      await supabase.auth.signOut()
      this.$router.push('/login')
    },

    // Modal handlers
    openEditNameModal() {
      this.showEditNameModal = true
    },

    closeEditNameModal() {
      this.showEditNameModal = false
    },

    async onNameUpdated() {
      this.closeEditNameModal()
      await this.loadData()
    },

    openChangeFamilyModal() {
      this.showChangeFamilyModal = true
    },

    closeChangeFamilyModal() {
      this.showChangeFamilyModal = false
    },

    async onFamilyChanged() {
      this.closeChangeFamilyModal()
      await this.loadData()
    },

    openDeleteAccountModal() {
      this.showDeleteAccountModal = true
    },

    closeDeleteAccountModal() {
      this.showDeleteAccountModal = false
    },

    formatJoinDate(dateStr) {
      return dayjs(dateStr).format('MMM YYYY')
    }
  }
}
</script>

<template>
  <AppLayout>
    <div class="max-w-2xl mx-auto space-y-6">
      <!-- Page Header -->
      <div>
        <h2 class="text-2xl font-bold text-gray-900">Profile & Settings</h2>
        <p class="text-sm text-gray-600 mt-1">Manage account and family settings. Sign out or delete your account.</p>
      </div>

      <!-- Error display -->
      <div v-if="error" class="p-4 bg-red-50 text-red-800 rounded-md">
        {{ error }}
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="text-gray-500">Loading...</div>

      <template v-if="!loading">
        <!-- Profile Section -->
        <section class="bg-white rounded-lg shadow overflow-hidden">
          <div class="bg-gray-600 px-6 py-3">
            <h2 class="text-xs font-medium text-gray-100 uppercase tracking-wider">Profile</h2>
          </div>
          <div class="p-6 space-y-4">
            <!-- Name row -->
            <div class="flex items-center justify-between">
              <div>
                <dt class="text-sm text-gray-500">Display Name</dt>
                <dd class="text-gray-900">{{ userName }}</dd>
              </div>
              <button
                v-on:click="openEditNameModal"
                class="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Edit
              </button>
            </div>
            <!-- Email row -->
            <div>
              <dt class="text-sm text-gray-500">Email</dt>
              <dd class="text-gray-900">{{ userEmail }}</dd>
            </div>
          </div>
        </section>

        <!-- Family Section -->
        <section class="bg-white rounded-lg shadow overflow-hidden">
          <div class="bg-gray-600 px-6 py-3">
            <h2 class="text-xs font-medium text-gray-100 uppercase tracking-wider">Family</h2>
          </div>
          <div class="p-6 space-y-4">
            <!-- Family ID row -->
            <div>
              <dt class="text-sm text-gray-500 mb-1">Family Secret</dt>
              <div class="relative h-10">
                <!-- Input with family ID -->
                <input
                  type="text"
                  readonly
                  v-bind:value="familyId"
                  class="w-full h-full px-3 pr-16 border border-gray-300 rounded-md font-mono text-sm text-gray-900 bg-gray-50 focus:outline-none"
                />
                <!-- Click to reveal overlay -->
                <div
                  v-if="!familyIdRevealed"
                  v-on:click="toggleFamilyIdReveal"
                  class="absolute inset-0 bg-gray-100 border border-gray-300 rounded-md flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors"
                >
                  <span class="text-sm text-gray-600 font-medium">Click to reveal</span>
                </div>
                <!-- Copy button inside textarea -->
                <button
                  v-if="familyIdRevealed"
                  v-on:click="copyFamilyId"
                  class="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-900 bg-white border border-gray-300 rounded hover:bg-gray-50"
                >
                  <ClipboardIcon class="w-3.5 h-3.5" />
                  {{ copyFeedback ? 'Copied!' : 'Copy' }}
                </button>
              </div>
              <p
                v-if="familyIdRevealed"
                class="text-amber-600 text-sm mt-2 flex items-start gap-1"
              >
                <span class="shrink-0">&#9888;</span>
                <span>Be careful - anyone with this value can view and edit your family's data.</span>
              </p>
            </div>

            <!-- Family Members -->
            <div>
              <dt class="text-sm text-gray-500 mb-2">
                Members ({{ familyMembers.length }})
              </dt>
              <ul class="list-disc list-inside space-y-1">
                <li
                  v-for="member in familyMembers"
                  v-bind:key="member.id"
                  class="text-gray-900"
                >
                  {{ member.name }}
                  <span class="text-gray-400 text-sm"> — joined {{ formatJoinDate(member.created_at) }}</span>
                </li>
              </ul>
              <p
                v-if="familyMembers.length === 1"
                class="text-sm text-gray-500 mt-2 italic"
              >
                You are the only member of this family.
              </p>
            </div>

            <!-- Change Family -->
            <div class="flex items-center justify-between pt-2">
              <div>
                <p class="font-medium text-gray-900">Leave Family</p>
                <p class="text-sm text-gray-500">Create or join another (access to this family's data will be lost)</p>
              </div>
              <button
                v-on:click="openChangeFamilyModal"
                class="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium shrink-0 ml-4"
              >
                Leave Family
              </button>
            </div>
          </div>
        </section>

        <!-- Local LLM Section -->
        <section class="bg-white rounded-lg shadow">
          <div class="bg-gray-600 px-6 py-3 rounded-t-lg">
            <h2 class="text-xs font-medium text-gray-100 uppercase tracking-wider">Local LLM</h2>
          </div>
          <div class="p-6 space-y-4">
            <!-- Provider row -->
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium text-gray-900">Provider</p>
                <p class="text-sm text-gray-500">Parse PDFs locally instead of using the cloud service</p>
              </div>
              <Listbox v-model="localLlmProvider" as="div" class="relative shrink-0 ml-4">
                <ListboxButton
                  class="relative w-44 px-3 py-2 text-left text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <span>{{ selectedLlmOption?.name }}</span>
                  <span class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                    <ChevronUpDownIcon class="w-4 h-4 text-gray-400" />
                  </span>
                </ListboxButton>
                <transition
                  enter-active-class="transition duration-100 ease-out"
                  enter-from-class="transform scale-95 opacity-0"
                  enter-to-class="transform scale-100 opacity-100"
                  leave-active-class="transition duration-75 ease-in"
                  leave-from-class="transform scale-100 opacity-100"
                  leave-to-class="transform scale-95 opacity-0"
                >
                  <ListboxOptions
                    class="absolute right-0 z-10 mt-1 w-44 max-h-60 overflow-auto bg-white border border-gray-200 rounded-md shadow-lg focus:outline-none"
                  >
                    <ListboxOption
                      v-for="option in localLlmOptions"
                      v-bind:key="option.id"
                      v-bind:value="option.id"
                      v-slot="{ active, selected }"
                    >
                      <div
                        v-bind:class="[
                          'flex items-center justify-between px-3 py-2 text-sm cursor-pointer',
                          active ? 'bg-gray-100' : '',
                          selected ? 'text-blue-600 font-medium' : 'text-gray-700'
                        ]"
                      >
                        {{ option.name }}
                        <CheckIcon v-if="selected" class="w-4 h-4" />
                      </div>
                    </ListboxOption>
                  </ListboxOptions>
                </transition>
              </Listbox>
            </div>

            <hr class="border-gray-200" />

            <!-- Port row -->
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium text-gray-900" v-bind:class="{ 'text-gray-400': localLlmProvider === 'disabled' }">Port</p>
                <p class="text-sm text-gray-500" v-bind:class="{ 'text-gray-400': localLlmProvider === 'disabled' }">Local server port (default: 11434 for Ollama)</p>
              </div>
              <input
                v-model="localLlmPort"
                type="text"
                placeholder="11434"
                v-bind:disabled="localLlmProvider === 'disabled'"
                class="w-24 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed shrink-0 ml-4"
              />
            </div>
          </div>
        </section>

        <!-- Danger Zone -->
        <section class="bg-white rounded-lg shadow overflow-hidden">
          <div class="bg-red-600 px-6 py-3">
            <h2 class="text-xs font-medium text-white uppercase tracking-wider">Danger Zone</h2>
          </div>
          <div class="p-6 space-y-4">
            <!-- Sign Out -->
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium text-gray-900">Sign Out</p>
                <p class="text-sm text-gray-500">Sign out of your account on this device</p>
              </div>
              <button
                v-on:click="signOut"
                class="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium"
              >
                Sign Out
              </button>
            </div>

            <hr class="border-gray-200" />

            <!-- Delete Account -->
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium text-gray-900">Delete Account</p>
                <p class="text-sm text-gray-500">Permanently delete your account and data</p>
              </div>
              <button
                v-on:click="openDeleteAccountModal"
                class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium"
              >
                Delete Account
              </button>
            </div>
          </div>
        </section>
      </template>
    </div>

    <!-- Modals -->
    <EditNameModal
      v-if="showEditNameModal"
      v-bind:current-name="userName"
      v-on:close="closeEditNameModal"
      v-on:updated="onNameUpdated"
    />

    <ChangeFamilyModal
      v-if="showChangeFamilyModal"
      v-on:close="closeChangeFamilyModal"
      v-on:changed="onFamilyChanged"
    />

    <DeleteAccountModal
      v-if="showDeleteAccountModal"
      v-on:close="closeDeleteAccountModal"
    />
  </AppLayout>
</template>
