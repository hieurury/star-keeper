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
	const enteredGame = to.path === '/game'
	const delay = enteredGame ? 950 : 420
	setTimeout(() => ui.hideLoading(), delay)
})

registerSW({ immediate: true })

app.mount('#app')
