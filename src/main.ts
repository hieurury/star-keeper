import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import './style.css'
import App from './App.vue'
import { registerSW } from 'virtual:pwa-register'
import { useUiStore } from './stores/uiStore'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

const ui = useUiStore(pinia)
const INITIAL_LOADING_TOKEN = ui.showLoading({
	title: 'Star Keeper',
	subtitle: 'Đang nạp hệ thống...',
})

router.beforeEach((to, _from, next) => {
	ui.showLoading({
		title: 'Star Keeper',
		subtitle: to.path === '/game' ? 'Đang nạp chiến trường...' : 'Đang chuyển màn hình...',
	})
	next()
})

router.afterEach((to) => {
	const delay = to.path === '/game' ? 950 : 420
	setTimeout(() => ui.hideLoading(), delay)
})

registerSW({ immediate: true })

router.isReady().then(() => {
	setTimeout(() => ui.hideLoading(INITIAL_LOADING_TOKEN), 600)
})

app.mount('#app')
