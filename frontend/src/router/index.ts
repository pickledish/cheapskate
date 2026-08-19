import { createRouter, createWebHashHistory } from 'vue-router';
import { supabase } from '@/lib/supabase';

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/setup',
    name: 'setup',
    component: () => import('@/views/SetupView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/',
    redirect: '/accounts',
  },
  {
    path: '/networth',
    name: 'networth',
    component: () => import('@/views/NetWorthView.vue'),
    meta: { requiresAuth: true, requiresOnboardingComplete: true },
  },
  {
    path: '/portfolio',
    name: 'portfolio',
    component: () => import('@/views/PortfolioView.vue'),
    meta: { requiresAuth: true, requiresOnboardingComplete: true },
  },
  {
    path: '/assets',
    name: 'assets',
    component: () => import('@/views/AssetsView.vue'),
    meta: { requiresAuth: true, requiresAccountsComplete: true },
  },
  {
    path: '/goals',
    name: 'goals',
    component: () => import('@/views/GoalsView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/accounts',
    name: 'accounts',
    component: () => import('@/views/AccountsView.vue'),
    meta: { requiresAuth: true, requiresGoalsComplete: true },
  },
  {
    path: '/accounts/:id',
    name: 'account-detail',
    component: () => import('@/views/AccountDetailView.vue'),
    meta: { requiresAuth: true, requiresGoalsComplete: true },
  },
  {
    path: '/history',
    name: 'history',
    component: () => import('@/views/HistoryView.vue'),
    meta: { requiresAuth: true, requiresOnboardingComplete: true },
  },
  {
    path: '/profile',
    name: 'profile',
    component: () => import('@/views/ProfileView.vue'),
    meta: { requiresAuth: true },
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

// Auth and onboarding guard
router.beforeEach(async (to, _from, next) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const isAuthenticated = !!session;
  const metadata = session?.user?.user_metadata || {};
  const familyId = metadata.family_id;
  const goalsCompleted = metadata.goals_completed ?? false;
  const accountsCompleted = metadata.accounts_completed ?? false;
  const assetsCompleted = metadata.assets_completed ?? false;

  // Not authenticated - redirect to login
  if (to.meta.requiresAuth && !isAuthenticated) {
    return next('/login');
  }

  // Already logged in at login page - redirect appropriately
  if (to.path === '/login' && isAuthenticated) {
    if (!familyId) return next('/setup');
    if (!assetsCompleted) return next('/goals');
    return next('/accounts');
  }

  // Setup page - always allow
  if (to.path === '/setup') {
    return next();
  }

  // No family yet - force setup
  if (isAuthenticated && !familyId) {
    return next('/setup');
  }

  // Onboarding guards
  if (to.meta.requiresGoalsComplete && !goalsCompleted) {
    return next('/goals');
  }

  if (to.meta.requiresAccountsComplete && !accountsCompleted) {
    if (!goalsCompleted) return next('/goals');
    return next('/accounts');
  }

  if (to.meta.requiresOnboardingComplete && !assetsCompleted) {
    if (!goalsCompleted) return next('/goals');
    if (!accountsCompleted) return next('/accounts');
    return next('/assets');
  }

  next();
});

export default router;
