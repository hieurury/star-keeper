import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import InfiniteGameView from '../views/InfiniteGameView.vue'
import TestGameView from '../views/TestGameView.vue'

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
      path: '/test',
      name: 'test',
      component: TestGameView,
    },
  ],
})

export default router
