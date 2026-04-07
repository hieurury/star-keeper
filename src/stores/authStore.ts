import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const session = ref<Session | null>(null)
  const isLoading = ref(false)
  const authError = ref<string | null>(null)

  // System states for guest mode
  const isGuest = ref(localStorage.getItem('auth-mode-guest') === '1')
  const hasChosen = ref(localStorage.getItem('auth-mode-chosen') === '1')

  const isLoggedIn = computed(() => !!user.value)
  const userEmail = computed(() => user.value?.email ?? null)
  const userId = computed(() => user.value?.id ?? null)

  function setGuestMode() {
    isGuest.value = true
    hasChosen.value = true
    localStorage.setItem('auth-mode-guest', '1')
    localStorage.setItem('auth-mode-chosen', '1')
  }

  function setChosen() {
    hasChosen.value = true
    localStorage.setItem('auth-mode-chosen', '1')
  }

  // ─── Khôi phục phiên đăng nhập ────────────────────────────────────────────
  async function restoreSession(): Promise<void> {
    if (!isSupabaseConfigured()) return
    try {
      const { data } = await supabase.auth.getSession()
      session.value = data.session
      user.value = data.session?.user ?? null

      // Automatically logic for old players (if they have save data but haven't chosen)
      if (!hasChosen.value && !user.value && localStorage.getItem('ban-may-bay-save')) {
        setGuestMode()
      } else if (user.value) {
        setChosen()
        isGuest.value = false
        localStorage.removeItem('auth-mode-guest')
      }

    } catch (e) {
      console.warn('[Auth] Không thể khôi phục phiên:', e)
    }

    // Lắng nghe thay đổi trạng thái auth
    supabase.auth.onAuthStateChange(async (_event, newSession) => {
      session.value = newSession
      user.value = newSession?.user ?? null
      if (user.value) {
        const wasGuest = isGuest.value
        isGuest.value = false
        localStorage.removeItem('auth-mode-guest')
        setChosen()

        // Nếu người chơi vốn là khách (Guest) và giờ vừa đăng nhập, hãy đẩy dữ liệu của họ lên cloud
        if (wasGuest) {
          try {
            const { useGameStore } = await import('./gameStore')
            const game = useGameStore()
            await game.pushToSupabase()
          } catch (err) {
            console.warn('[Auth] Không thể sync data sau khi liên kết tài khoản', err)
          }
        }
      }
    })
  }

  // ─── Đăng nhập Google ─────────────────────────────────────────────────────
  async function loginWithGoogle(): Promise<void> {
    if (!isSupabaseConfigured()) return
    isLoading.value = true
    authError.value = null
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      })
      if (error) authError.value = error.message
    } finally {
      isLoading.value = false
    }
  }

  // ─── Đăng nhập Email ───────────────────────────────────────────────────────
  async function loginWithEmail(email: string, password: string): Promise<boolean> {
    if (!isSupabaseConfigured()) return false
    isLoading.value = true
    authError.value = null
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        authError.value = error.message
        return false
      }
      session.value = data.session
      user.value = data.user
      return true
    } finally {
      isLoading.value = false
    }
  }

  // ─── Đăng ký Email ─────────────────────────────────────────────────────────
  async function registerWithEmail(email: string, password: string): Promise<boolean> {
    if (!isSupabaseConfigured()) return false
    isLoading.value = true
    authError.value = null
    try {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        authError.value = error.message
        return false
      }
      session.value = data.session
      user.value = data.user
      return true
    } finally {
      isLoading.value = false
    }
  }

  // ─── Đăng xuất ────────────────────────────────────────────────────────────
  async function logout(): Promise<void> {
    if (!isSupabaseConfigured()) return
    await supabase.auth.signOut()
    user.value = null
    session.value = null
    setGuestMode() // Khi đăng xuất, trở lại làm khách (dữ liệu local vẫn giữ)
  }

  return {
    user,
    session,
    isLoading,
    authError,
    isLoggedIn,
    userEmail,
    userId,
    isGuest,
    hasChosen,
    setGuestMode,
    setChosen,
    restoreSession,
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    logout,
  }
})
