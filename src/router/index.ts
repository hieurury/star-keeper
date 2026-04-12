import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import InfiniteGameView from '../views/InfiniteGameView.vue'
import TestGameView from '../views/TestGameView.vue'
import EnemyCodexView from '../views/EnemyCodexView.vue'
import AuthView from '../views/AuthView.vue'
import TechnologyView from '../views/TechnologyView.vue'
import SettingsView from '../views/SettingsView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/game',
      name: 'game',
      component: InfiniteGameView,
    },
    {
      path: '/technology',
      name: 'technology',
      component: TechnologyView,
    },
    {
      path: '/test',
      name: 'test',
      component: TestGameView,
    },
    {
      path: '/codex',
      name: 'codex',
      component: EnemyCodexView,
    },
    {
      path: '/auth',
      name: 'auth',
      component: AuthView,
    },
    {
      path: '/settings',
      name: 'settings',
      component: SettingsView,
    },
  ],
})

// Cấm truy cập nếu chưa chọn chế độ
router.beforeEach(async (to) => {
  if (to.path === '/auth') return true
  // Cần lazy import store để cấm vòng lặp nếu dùng trước app.use(pinia)
  const { useAuthStore } = await import('../stores/authStore')
  const authSettings = useAuthStore()
  if (!authSettings.hasChosen) {
    return '/auth'
  }
  return true
})

export default router
