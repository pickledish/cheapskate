import { createRouter, createWebHashHistory, loadRouteLocation } from 'vue-router';
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
    name: 'splash',
    component: () => import('@/views/SplashView.vue'),
    meta: { requiresAuth: false },
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

  // Splash is public even when logged in
  if (to.path === '/') {
    return next();
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

async function prefetchAllRoutes() {
  const currentName = router.currentRoute.value.name;
  for (const route of routes) {
    if (route.name === currentName) continue;
    const path = route.path.replace(/:[^/?*]+/g, '_');
    try {
      await loadRouteLocation(router.resolve(path));
    } catch (err) {
      console.warn(`Failed to prefetch route ${path}`, err);
    }
  }
}

// After the first screen paints, fetch the other route chunks sequentially so
// later tab clicks don't wait on the network.
// It runs once per full app boot (refresh or first visit), after the first route is ready.
// Clicking tabs is not a new load, so it does not run again until you reload the page.
// It downloads the JS chunks. It does not render every page.
// loadRouteLocation only calls each route’s () => import(...).
void router.isReady().then(() => {
  void prefetchAllRoutes();
});

export default router;
