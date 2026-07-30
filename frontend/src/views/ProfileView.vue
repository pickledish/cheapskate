<script>
import AppLayout from '@/components/AppLayout.vue'
import PageHeader from '@/components/PageHeader.vue'
import ChangeFamilyModal from '@/components/modals/ChangeFamilyModal.vue'
import DeleteAccountModal from '@/components/modals/DeleteAccountModal.vue'
import { supabase } from '@/lib/supabase'
import { getProfile, listProfilesByFamily, updateProfile, updatePreferences } from '@/lib/data'
import { testConnection } from '@/lib/local-llm'
import { Listbox, ListboxButton, ListboxOptions, ListboxOption } from '@headlessui/vue'
import { ClipboardIcon } from '@heroicons/vue/24/outline'
import { ChevronUpDownIcon, CheckIcon } from '@heroicons/vue/20/solid'
import dayjs from 'dayjs'

export default {
  name: 'ProfileView',
  components: {
    AppLayout,
    PageHeader,
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
      userId: null,
      userEmail: null,
      userName: '',
      familyId: null,
      familyMembers: [],

      // Original values for change detection
      originalName: '',
      originalLlmProvider: 'disabled',
      originalLlmPort: '11434',

      // UI state
      loading: true,
      saving: false,
      error: null,
      familyIdRevealed: false,
      copyFeedback: false,

      // Modal state
      showChangeFamilyModal: false,
      showDeleteAccountModal: false,

      // Local LLM state
      testing: false,

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
    },
    hasProfileChanges() {
      return this.userName !== this.originalName
    },
    hasLlmChanges() {
      return this.localLlmProvider !== this.originalLlmProvider ||
        this.localLlmPort !== this.originalLlmPort
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

        this.userId = user.id
        this.userEmail = user.email
        this.familyId = user.user_metadata?.family_id

        // Load profile and family members in parallel
        const [profile, members] = await Promise.all([
          getProfile(user.id),
          listProfilesByFamily(this.familyId)
        ])

        // Set current values
        this.userName = profile?.name || ''
        this.familyMembers = members

        // Load local LLM preferences
        const llmConfig = profile?.preferences?.local_llm
        this.localLlmProvider = llmConfig?.api || 'disabled'
        this.localLlmPort = llmConfig?.port || '11434'

        // Store original values for change detection
        this.originalName = this.userName
        this.originalLlmProvider = this.localLlmProvider
        this.originalLlmPort = this.localLlmPort

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

    async saveProfile() {
      if (!this.hasProfileChanges) return

      this.saving = true
      this.error = null

      try {
        await updateProfile(this.userId, { name: this.userName })
        this.originalName = this.userName
      } catch (err) {
        this.error = err.message
      } finally {
        this.saving = false
      }
    },

    async saveLlmSettings() {
      if (!this.hasLlmChanges) return

      this.saving = true
      this.error = null

      try {
        await updatePreferences(this.userId, {
          local_llm: {
            api: this.localLlmProvider,
            port: this.localLlmPort
          }
        })
        this.originalLlmProvider = this.localLlmProvider
        this.originalLlmPort = this.localLlmPort
      } catch (err) {
        this.error = err.message
      } finally {
        this.saving = false
      }
    },

    async testLlmConnection() {
      if (this.localLlmProvider === 'disabled') return

      this.testing = true
      try {
        const result = await testConnection(this.localLlmProvider, this.localLlmPort)
        alert(result.message)
      } finally {
        this.testing = false
      }
    },

    // Modal handlers
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
      <PageHeader
        title="Profile & Settings"
        description="Manage account and family settings. Sign out or delete your account."
      />

      <!-- Error display -->
      <div v-if="error" class="p-4 bg-red-50 text-red-800 rounded-md">
        {{ error }}
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="text-muted-text">Loading...</div>

      <template v-if="!loading">
        <!-- Profile Section -->
        <section class="bg-surface rounded-lg shadow overflow-hidden">
          <div class="bg-header px-6 py-3">
            <h2 class="text-xs font-medium text-header-text uppercase tracking-wider">Profile</h2>
          </div>
          <div class="p-6 space-y-4">
            <!-- Name row -->
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p class="font-medium text-primary-text">Display Name</p>
                <p class="text-sm text-muted-text">How you appear to other family members</p>
              </div>
              <input
                v-model="userName"
                type="text"
                class="w-full sm:w-48 px-3 py-2 text-sm border border-strong-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 sm:shrink-0 sm:ml-4"
              />
            </div>

            <hr class="border-subtle-border" />

            <!-- Email row -->
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p class="font-medium text-primary-text">Email</p>
                <p class="text-sm text-muted-text">Your Google account email</p>
              </div>
              <input
                type="text"
                v-bind:value="userEmail"
                disabled
                class="w-full sm:w-64 px-3 py-2 text-sm border border-strong-border rounded-md bg-recessed-deep text-placeholder-text cursor-not-allowed sm:shrink-0 sm:ml-4"
              />
            </div>
          </div>
        </section>
        <div v-if="hasProfileChanges" class="flex justify-end">
          <button
            v-on:click="saveProfile"
            v-bind:disabled="saving"
            class="px-4 py-2 border border-blue-600 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 hover:border-blue-700 disabled:opacity-50 transition-colors"
          >
            {{ saving ? 'Saving...' : 'Save' }}
          </button>
        </div>

        <!-- Local LLM Section -->
        <section class="bg-surface rounded-lg shadow">
          <div class="bg-header px-6 py-3 rounded-t-lg">
            <h2 class="text-xs font-medium text-header-text uppercase tracking-wider">Local LLM</h2>
          </div>
          <div class="p-6 space-y-4">
            <!-- Provider row -->
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p class="font-medium text-primary-text">Provider</p>
                <p class="text-sm text-muted-text">Parse PDFs locally instead of using the cloud service</p>
              </div>
              <Listbox v-model="localLlmProvider" as="div" class="relative w-full sm:w-44 sm:shrink-0 sm:ml-4">
                <ListboxButton
                  class="relative w-full px-3 py-2 text-left text-sm border border-strong-border rounded-md bg-surface focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <span>{{ selectedLlmOption?.name }}</span>
                  <span class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                    <ChevronUpDownIcon class="w-4 h-4 text-placeholder-text" />
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
                    class="absolute left-0 right-0 sm:left-auto sm:right-0 z-10 mt-1 w-full sm:w-44 max-h-60 overflow-auto bg-surface border border-subtle-border rounded-md shadow-lg focus:outline-none"
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
                          active ? 'bg-recessed-deep' : '',
                          selected ? 'text-blue-600 font-medium' : 'text-secondary-text'
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

            <hr class="border-subtle-border" />

            <!-- Port row -->
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p class="font-medium text-primary-text" v-bind:class="{ 'text-placeholder-text': localLlmProvider === 'disabled' }">Port</p>
                <p class="text-sm text-muted-text" v-bind:class="{ 'text-placeholder-text': localLlmProvider === 'disabled' }">Local server port (default: 11434 for Ollama)</p>
              </div>
              <input
                v-model="localLlmPort"
                type="text"
                placeholder="11434"
                v-bind:disabled="localLlmProvider === 'disabled'"
                class="w-full sm:w-24 px-3 py-2 text-sm border border-strong-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-recessed-deep disabled:text-placeholder-text disabled:cursor-not-allowed sm:shrink-0 sm:ml-4"
              />
            </div>
          </div>
        </section>
        <div v-if="hasLlmChanges" class="flex justify-end gap-2">
          <button
            v-on:click="testLlmConnection"
            v-bind:disabled="testing || localLlmProvider === 'disabled'"
            class="px-4 py-2 border border-strong-border text-secondary-text rounded-md hover:bg-recessed text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {{ testing ? 'Testing...' : 'Test' }}
          </button>
          <button
            v-on:click="saveLlmSettings"
            v-bind:disabled="saving"
            class="px-4 py-2 border border-blue-600 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 hover:border-blue-700 disabled:opacity-50 transition-colors"
          >
            {{ saving ? 'Saving...' : 'Save' }}
          </button>
        </div>

        <!-- Family Section -->
        <section class="bg-surface rounded-lg shadow overflow-hidden">
          <div class="bg-header px-6 py-3">
            <h2 class="text-xs font-medium text-header-text uppercase tracking-wider">Family</h2>
          </div>
          <div class="p-6 space-y-4">
            <!-- Family ID row -->
            <div>
              <dt class="text-sm text-muted-text mb-1">Family Secret</dt>
              <div class="relative h-10">
                <!-- Input with family ID -->
                <input
                  type="text"
                  readonly
                  v-bind:value="familyId"
                  class="w-full h-full px-3 pr-16 border border-strong-border rounded-md font-mono text-sm text-primary-text bg-recessed focus:outline-none"
                />
                <!-- Click to reveal overlay -->
                <div
                  v-if="!familyIdRevealed"
                  v-on:click="toggleFamilyIdReveal"
                  class="absolute inset-0 bg-recessed-deep border border-strong-border rounded-md flex items-center justify-center cursor-pointer hover:brightness-95 transition"
                >
                  <span class="text-sm text-muted-text font-medium">Click to reveal</span>
                </div>
                <!-- Copy button inside textarea -->
                <button
                  v-if="familyIdRevealed"
                  v-on:click="copyFamilyId"
                  class="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 px-2 py-1 text-xs text-muted-text hover:text-primary-text bg-surface border border-strong-border rounded hover:bg-recessed"
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
              <dt class="text-sm text-muted-text mb-2">
                Members ({{ familyMembers.length }})
              </dt>
              <ul class="list-disc list-inside space-y-1">
                <li
                  v-for="member in familyMembers"
                  v-bind:key="member.id"
                  class="text-primary-text"
                >
                  {{ member.name }}
                  <span class="text-placeholder-text text-sm"> — joined {{ formatJoinDate(member.created_at) }}</span>
                </li>
              </ul>
              <p
                v-if="familyMembers.length === 1"
                class="text-sm text-muted-text mt-2 italic"
              >
                You are the only member of this family.
              </p>
            </div>

            <!-- Change Family -->
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2">
              <div>
                <p class="font-medium text-primary-text">Leave Family</p>
                <p class="text-sm text-muted-text">Create or join another (access to this family's data will be lost)</p>
              </div>
              <button
                v-on:click="openChangeFamilyModal"
                class="w-full sm:w-auto px-4 py-2 border border-strong-border text-secondary-text rounded-md hover:bg-recessed text-sm font-medium sm:shrink-0 sm:ml-4"
              >
                Leave Family
              </button>
            </div>
          </div>
        </section>

        <!-- Danger Zone -->
        <section class="bg-surface rounded-lg shadow overflow-hidden">
          <div class="bg-red-600 px-6 py-3">
            <h2 class="text-xs font-medium text-white uppercase tracking-wider">Danger Zone</h2>
          </div>
          <div class="p-6 space-y-4">
            <!-- Sign Out -->
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p class="font-medium text-primary-text">Sign Out</p>
                <p class="text-sm text-muted-text">Sign out of your account on this device</p>
              </div>
              <button
                v-on:click="signOut"
                class="w-full sm:w-auto px-4 py-2 border border-strong-border text-secondary-text rounded-md hover:bg-recessed text-sm font-medium sm:shrink-0 sm:ml-4"
              >
                Sign Out
              </button>
            </div>

            <hr class="border-subtle-border" />

            <!-- Delete Account -->
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p class="font-medium text-primary-text">Delete Account</p>
                <p class="text-sm text-muted-text">Permanently delete your account and data</p>
              </div>
              <button
                v-on:click="openDeleteAccountModal"
                class="w-full sm:w-auto px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium sm:shrink-0 sm:ml-4"
              >
                Delete Account
              </button>
            </div>
          </div>
        </section>

      </template>
    </div>

    <!-- Modals -->
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
