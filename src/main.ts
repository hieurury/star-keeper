import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import './style.css'
import App from './App.vue'
import { registerSW } from 'virtual:pwa-register'
import { Capacitor } from '@capacitor/core'
import { useUiStore } from './stores/uiStore'
import { audioManager } from './game/systems/audio'
import { useAuthStore } from './stores/authStore'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

const ui = useUiStore(pinia)

router.beforeEach((to, _from, next) => {
	const enteringGame = to.path === '/game'
	const backToMenu = _from.path === '/game' && to.path === '/'
	if (enteringGame || backToMenu) {
		ui.showLoading({
			title: 'Star Keeper',
			subtitle: enteringGame ? 'Đang nạp chiến trường...' : 'Đang trở về trạm chỉ huy...',
		})
	}
	next()
})

router.afterEach((to) => {
	const isGameRoute = to.path === '/game' || to.path === '/test'
	audioManager.setBossActive(false)
	audioManager.setScene(isGameRoute ? 'game' : 'lobby')

	const enteredGame = to.path === '/game'
	const delay = enteredGame ? 2200 : 1400
	setTimeout(() => ui.hideLoading(), delay)
})

if (!Capacitor.isNativePlatform()) {
	registerSW({ immediate: true })
}

app.mount('#app')

// Khôi phục phiên đăng nhập Supabase sau khi app mount
const authStore = useAuthStore(pinia)
void authStore.restoreSession()
