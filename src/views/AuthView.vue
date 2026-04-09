<template>
  <div class="auth-view">
    <div class="auth-card">
      <div v-if="!authStore.hasChosen" class="auth-header">
        <div class="game-logo">✦ STAR KEEPER ✦</div>
        <h1 class="auth-title">Chào Mừng Phi Công</h1>
        <p class="auth-subtitle">Chọn chế độ trải nghiệm của bạn</p>
      </div>
      <div v-else class="auth-header">
        <div class="game-logo">✦ STAR KEEPER ✦</div>
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
          <span>Bắt Đầu Chơi (Khách)</span>
        </button>
        <div class="divider"><span>HOẶC LƯU TRỮ ĐÁM MÂY</span></div>
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
      
      <!-- Nút Hủy liên kết (trở về form cài đặt nếu vào từ UI đã đăng nhập) -->
      <button v-if="authStore.hasChosen" class="btn-cancel" @click="$router.push('/')">
        Tiếp tục với tài khoản khách
      </button>

    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore'

const router = useRouter()
const authStore = useAuthStore()

function goAsGuest() {
  authStore.setGuestMode()
  router.push('/')
}
</script>

<style scoped>
@keyframes tech-pulse {
  0%, 100% { filter: drop-shadow(0 0 8px rgba(0, 212, 255, 0.4)); }
  50% { filter: drop-shadow(0 0 16px rgba(0, 212, 255, 0.8)); }
}

@keyframes scanline {
  0% { transform: translateY(-100%); }
  100% { transform: translateY(100vh); }
}

.auth-view {
  min-height: 100vh;
  width: 100%;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    linear-gradient(rgba(0, 160, 255, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 160, 255, 0.04) 1px, transparent 1px),
    radial-gradient(circle at 50% 50%, rgba(10, 20, 40, 0.2), rgba(2, 4, 10, 0.95) 80%),
    #050814;
  background-size: 40px 40px, 40px 40px, 100% 100%, 100% 100%;
  padding: 1rem;
}

.auth-view::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 4px;
  background: rgba(0, 212, 255, 0.5);
  box-shadow: 0 0 20px rgba(0, 212, 255, 0.8);
  filter: blur(2px);
  animation: scanline 6s linear infinite;
  pointer-events: none;
  z-index: 10;
}

.auth-card {
  position: relative;
  background: rgba(4, 10, 25, 0.6);
  width: 100%;
  max-width: 520px;
  padding: 3.5rem 3rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  border: 1px solid rgba(0, 212, 255, 0.15);
  box-shadow: 0 0 60px rgba(0, 0, 0, 0.8), inset 0 0 40px rgba(0, 160, 255, 0.08);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.auth-card::before, .auth-card::after {
  content: '';
  position: absolute;
  width: 40px;
  height: 40px;
  border-color: rgba(0, 212, 255, 0.8);
  border-style: solid;
  pointer-events: none;
}
.auth-card::before {
  top: -1px; left: -1px;
  border-width: 3px 0 0 3px;
  box-shadow: inset 2px 2px 8px rgba(0, 212, 255, 0.2);
}
.auth-card::after {
  bottom: -1px; right: -1px;
  border-width: 0 3px 3px 0;
  box-shadow: inset -2px -2px 8px rgba(0, 212, 255, 0.2);
}

.auth-header {
  text-align: center;
  margin-bottom: 3.5rem;
  width: 100%;
}

.game-logo {
  font-family: var(--font-pixel);
  font-size: 1.25rem;
  letter-spacing: 0.35em;
  color: #00e0ff;
  margin-bottom: 1rem;
  text-transform: uppercase;
  animation: tech-pulse 3s infinite;
}

.auth-title {
  font-family: var(--font-pixel);
  font-size: 2.2rem;
  font-weight: 800;
  margin: 0 0 1rem;
  color: #ffffff;
  text-shadow: 0 2px 8px rgba(0, 160, 255, 0.4);
}

.auth-subtitle {
  font-family: var(--font-pixel);
  font-size: 0.95rem;
  color: #6a9ac2;
  margin: 0;
  letter-spacing: 0.04em;
}

.auth-error {
  background: rgba(255, 60, 60, 0.1);
  border: 1px solid rgba(255, 60, 60, 0.4);
  padding: 0.75rem 1rem;
  font-size: 0.9rem;
  color: #ff7575;
  margin-bottom: 1.5rem;
  text-align: center;
  box-shadow: 0 0 12px rgba(255, 60, 60, 0.2);
}

.guest-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 1.5rem;
  width: 100%;
}

.guest-tip {
  font-family: var(--font-pixel);
  font-size: 0.85rem;
  color: #6a9ac2;
  margin-bottom: 1.25rem;
  text-align: center;
}

.btn-guest {
  font-family: var(--font-pixel);
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.85rem;
  padding: 1.15rem 1rem;
  border: 1px solid rgba(26, 120, 255, 0.6);
  background: rgba(15, 45, 90, 0.4);
  color: #9cd4ff;
  cursor: pointer;
  box-shadow: inset 0 0 12px rgba(26, 120, 255, 0.2), 0 4px 12px rgba(0, 0, 0, 0.4);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 1.1rem;
  font-weight: 500;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.btn-guest:hover {
  background: rgba(26, 120, 255, 0.25);
  border-color: #3aa0ff;
  color: #ffffff;
  box-shadow: inset 0 0 20px rgba(35, 150, 255, 0.4), 0 0 20px rgba(26, 120, 255, 0.4);
  transform: scale(1.02);
}

.btn-google {
  font-family: var(--font-pixel);
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 1.15rem 1rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.05);
  color: #dbe4ee;
  font-size: 1rem;
  letter-spacing: 0.05em;
  font-weight: 500;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: inset 0 0 10px rgba(255, 255, 255, 0.05), 0 4px 12px rgba(0, 0, 0, 0.4);
}

.btn-google:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.5);
  color: #ffffff;
  box-shadow: inset 0 0 15px rgba(255, 255, 255, 0.2), 0 0 15px rgba(255, 255, 255, 0.2);
  transform: scale(1.02);
}

.btn-google:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.divider {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  margin: 1.5rem 0;
  color: #3b5f85;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 2px;
}

.divider::before, .divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(59, 95, 133, 0.4);
}

.btn-cancel {
  font-family: var(--font-pixel);
  display: block;
  width: 100%;
  margin-top: 1.5rem;
  background: transparent;
  border: none;
  color: #5579a1;
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: color 0.2s, text-shadow 0.2s;
}

.btn-cancel:hover {
  color: #a3d5ff;
  text-shadow: 0 0 8px rgba(163, 213, 255, 0.6);
}
</style>
