import { createRouter, createWebHashHistory } from 'vue-router'
import { supabase } from '@/lib/supabase'

import LoginView from '@/views/LoginView.vue'
import SetupView from '@/views/SetupView.vue'
import DashboardView from '@/views/DashboardView.vue'
import CompositionView from '@/views/CompositionView.vue'
import AccountsView from '@/views/AccountsView.vue'
import AssetsView from '@/views/AssetsView.vue'
import GoalsView from '@/views/GoalsView.vue'
import HistoryView from '@/views/HistoryView.vue'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: LoginView,
    meta: { requiresAuth: false }
  },
  {
    path: '/setup',
    name: 'setup',
    component: SetupView,
    meta: { requiresAuth: true }
  },
  {
    path: '/',
    name: 'dashboard',
    component: DashboardView,
    meta: { requiresAuth: true }
  },
  {
    path: '/composition',
    name: 'composition',
    component: CompositionView,
    meta: { requiresAuth: true }
  },
  {
    path: '/assets',
    name: 'assets',
    component: AssetsView,
    meta: { requiresAuth: true }
  },
  {
    path: '/goals',
    name: 'goals',
    component: GoalsView,
    meta: { requiresAuth: true }
  },
  {
    path: '/accounts',
    name: 'accounts',
    component: AccountsView,
    meta: { requiresAuth: true }
  },
  {
    path: '/history',
    name: 'history',
    component: HistoryView,
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// Auth guard
router.beforeEach(async (to, _from, next) => {
  const { data: { session } } = await supabase.auth.getSession()
  const isAuthenticated = !!session
  const familyId = session?.user?.user_metadata?.family_id

  if (to.meta.requiresAuth && !isAuthenticated) {
    next('/login')
  } else if (to.path === '/login' && isAuthenticated) {
    next(familyId ? '/' : '/setup')
  } else if (to.path === '/setup') {
    next()
  } else if (isAuthenticated && !familyId) {
    next('/setup')
  } else {
    next()
  }
})

export default router
