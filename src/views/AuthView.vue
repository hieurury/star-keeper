<template>
  <div class="auth-view">
    <div class="auth-card">
      <div v-if="!authStore.hasChosen" class="auth-header">
        <div class="game-logo">✦ BẮN MÁY BAY ✦</div>
        <h1 class="auth-title">Chào Mừng Phi Công</h1>
        <p class="auth-subtitle">Chọn chế độ trải nghiệm của bạn</p>
      </div>
      <div v-else class="auth-header">
        <div class="game-logo">✦ BẮN MÁY BAY ✦</div>
        <h1 class="auth-title">Xác Thực</h1>
        <p class="auth-subtitle">Tham gia Liên Minh để bảo vệ thiên hà!</p>
      </div>

      <div v-if="authStore.authError" class="auth-error">
        ⚠ {{ authStore.authError }}
      </div>

      <!-- Khối Guest (Chơi Khách) - Nổi bật nếu chưa vào game -->
      <div v-if="!authStore.hasChosen" class="guest-section">
        <div class="guest-tip">Lưu dữ liệu cục bộ trên máy. Có thể thêm tài khoản sau.</div>
        <button class="btn-guest" @click="goAsGuest">
          <svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216ZM128,80a32,32,0,1,0,32,32A32,32,0,0,0,128,80Zm0,48a16,16,0,1,1,16-16A16,16,0,0,1,128,128Zm64,64a8,8,0,0,1-16,0,48,48,0,0,0-96,0,8,8,0,0,1-16,0,64.07,64.07,0,0,1,128,0Z"></path></svg>
          <span style="font-size: 1.1rem; font-weight: bold; margin-left:8px;">Bắt Đầu Chơi (Khách)</span>
        </button>
        <div class="divider"><span>HOẶC LƯU TRỮ ĐÁM MÂY</span></div>
      </div>

      <!-- Auth Khối -->
      <div class="auth-tabs">
        <button :class="['tab-btn', { active: mode === 'login' }]" @click="mode = 'login'">Đăng nhập</button>
        <button :class="['tab-btn', { active: mode === 'register' }]" @click="mode = 'register'">Đăng ký mới</button>
      </div>

      <button class="btn-google" :disabled="authStore.isLoading" @click="authStore.loginWithGoogle()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Tiếp tục với Google
      </button>

      <div class="divider"><span>hoặc Email</span></div>

      <form class="auth-form" @submit.prevent="handleEmailSubmit">
        <div class="form-group">
          <label for="auth-email">Email</label>
          <input id="auth-email" v-model="email" type="email" placeholder="phi-cong@email.com" autocomplete="email" required />
        </div>
        <div class="form-group">
          <label for="auth-password">Mật khẩu</label>
          <input id="auth-password" v-model="password" type="password" placeholder="••••••••" autocomplete="current-password" required minlength="6" />
        </div>
        <button type="submit" class="btn-primary" :disabled="authStore.isLoading">
          <span v-if="authStore.isLoading">⏳ Đang xử lý...</span>
          <span v-else>{{ mode === 'login' ? '→ Đăng nhập' : '→ Tạo tài khoản' }}</span>
        </button>
      </form>
      
      <!-- Nút Hủy liên kết (trở về form cài đặt nếu vào từ UI đã đăng nhập) -->
      <button v-if="authStore.hasChosen" class="btn-cancel" @click="$router.push('/')">
        Thoát Cài Đặt Auth
      </button>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore'

const router = useRouter()
const authStore = useAuthStore()

const mode = ref<'login' | 'register'>('login')
const email = ref('')
const password = ref('')

async function handleEmailSubmit() {
  let ok = false
  if (mode.value === 'login') {
    ok = await authStore.loginWithEmail(email.value, password.value)
  } else {
    ok = await authStore.registerWithEmail(email.value, password.value)
  }
  if (ok) router.push('/')
}

function goAsGuest() {
  authStore.setGuestMode()
  router.push('/')
}
</script>

<style scoped>
.auth-view {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(ellipse at 50% 30%, #0d1b3e 0%, #060b1a 70%);
  padding: 1rem;
}

.auth-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  padding: 2.5rem 2rem;
  width: 100%;
  max-width: 440px;
  backdrop-filter: blur(20px);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.auth-header { text-align: center; margin-bottom: 2rem; }

.game-logo {
  font-size: 0.75rem;
  letter-spacing: 0.2em;
  color: #f0b429;
  margin-bottom: 0.75rem;
  text-transform: uppercase;
}

.auth-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: #fff;
  margin: 0 0 0.4rem;
}

.auth-subtitle { font-size: 0.9rem; color: rgba(255,255,255,0.5); margin: 0; }

.auth-error {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.35);
  border-radius: 8px;
  padding: 0.65rem 1rem;
  font-size: 0.85rem;
  color: #fca5a5;
  margin-bottom: 1rem;
}

.guest-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 1rem;
}

.guest-tip {
  font-size: 0.8rem;
  color: rgba(255,255,255,0.4);
  margin-bottom: 0.5rem;
  text-align: center;
}

.btn-guest {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.8rem;
  border: none;
  border-radius: 10px;
  background: linear-gradient(to right, #445588, #2a3a5a);
  color: #fff;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(0,0,0,0.3);
  transition: all 0.2s;
}

.btn-guest:hover { filter: brightness(1.1); transform: translateY(-1px); }

.auth-tabs {
  display: flex;
  background: rgba(255,255,255,0.06);
  border-radius: 10px;
  padding: 4px;
  margin-bottom: 1.25rem;
}

.tab-btn {
  flex: 1;
  padding: 0.5rem;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: rgba(255,255,255,0.5);
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn.active {
  background: rgba(99, 179, 237, 0.2);
  color: #90cdf4;
}

.btn-google {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 0.75rem 1rem;
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 10px;
  background: rgba(255,255,255,0.06);
  color: #fff;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-google:hover:not(:disabled) {
  background: rgba(255,255,255,0.12);
  border-color: rgba(255,255,255,0.25);
}

.divider {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin: 1.25rem 0;
  color: rgba(255,255,255,0.25);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 1px;
}

.divider::before, .divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(255,255,255,0.1);
}

.auth-form { display: flex; flex-direction: column; gap: 1rem; }

.form-group { display: flex; flex-direction: column; gap: 0.4rem; }

.form-group label { font-size: 0.85rem; color: rgba(255,255,255,0.65); }

.form-group input {
  padding: 0.7rem 0.9rem;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 10px;
  background: rgba(255,255,255,0.06);
  color: #fff;
  font-size: 0.95rem;
  outline: none;
  transition: border-color 0.2s;
}

.form-group input:focus {
  border-color: rgba(99, 179, 237, 0.5);
  background: rgba(255,255,255,0.09);
}

.btn-primary {
  width: 100%;
  padding: 0.75rem;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #3b82f6, #6366f1);
  color: #fff;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 0.25rem;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
}

.btn-primary:disabled, .btn-google:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-cancel {
  display: block;
  width: 100%;
  margin-top: 1rem;
  background: transparent;
  border: none;
  color: rgba(255,255,255,0.4);
  font-size: 0.85rem;
  cursor: pointer;
}
.btn-cancel:hover { color: #fff; }
</style>
