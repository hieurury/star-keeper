import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const session = ref<Session | null>(null)
  const isLoading = ref(false)
  const authError = ref<string | null>(null)
  let authStateSubscription: { unsubscribe: () => void } | null = null
  let cloudSyncInFlight: Promise<void> | null = null

  // System states for guest mode
  const isGuest = ref(localStorage.getItem('auth-mode-guest') === '1')
  const hasChosen = ref(localStorage.getItem('auth-mode-chosen') === '1')

  const isLoggedIn = computed(() => !!user.value)
  const userEmail = computed(() => user.value?.email ?? null)
  const userId = computed(() => user.value?.id ?? null)

  function ensureConfigured(actionLabel: string): boolean {
    if (isSupabaseConfigured()) return true
    authError.value = `Supabase chưa được cấu hình (${actionLabel}). Kiểm tra VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY trên Vercel.`
    return false
  }

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

  function clearLocalAuthState() {
    user.value = null
    session.value = null
    isLoading.value = false
    authError.value = null
    setGuestMode()
  }

  function clearPersistedSupabaseSession() {
    const storages: Storage[] = []
    if (typeof window !== 'undefined') {
      storages.push(window.localStorage, window.sessionStorage)
    }

    let projectRef: string | null = null
    try {
      const url = new URL(import.meta.env.VITE_SUPABASE_URL as string)
      projectRef = url.hostname.split('.')[0] ?? null
    } catch {
      projectRef = null
    }

    const knownKeys = new Set<string>(['supabase.auth.token'])
    if (projectRef) {
      const baseKey = `sb-${projectRef}-auth-token`
      knownKeys.add(baseKey)
      knownKeys.add(`${baseKey}-code-verifier`)
    }

    for (const storage of storages) {
      for (const key of Object.keys(storage)) {
        if (
          knownKeys.has(key)
          || (key.startsWith('sb-') && key.includes('-auth-token'))
          || (key.startsWith('sb-') && key.includes('code-verifier'))
        ) {
          storage.removeItem(key)
        }
      }
    }
  }

  async function runCloudSync(preferMerge: boolean): Promise<void> {
    if (cloudSyncInFlight) {
      await cloudSyncInFlight
      return
    }

    const task = (async () => {
      try {
        const { useGameStore } = await import('./gameStore')
        const game = useGameStore()
        if (preferMerge) {
          await game.syncOnAccountLink()
        } else {
          await game.pullFromSupabase()
        }
      } catch (err) {
        console.warn('[Auth] Không thể đồng bộ dữ liệu cloud:', err)
      }
    })()

    cloudSyncInFlight = task
    try {
      await task
    } finally {
      if (cloudSyncInFlight === task) {
        cloudSyncInFlight = null
      }
    }
  }

  // ─── Khôi phục phiên đăng nhập ────────────────────────────────────────────
  async function restoreSession(): Promise<void> {
    if (!isSupabaseConfigured()) return
    let wasGuestFromRestore = false
    try {
      const { data } = await supabase.auth.getSession()
      session.value = data.session
      user.value = data.session?.user ?? null

      // Automatically logic for old players (if they have save data but haven't chosen)
      if (!hasChosen.value && !user.value && localStorage.getItem('ban-may-bay-save')) {
        setGuestMode()
      } else if (user.value) {
        wasGuestFromRestore = isGuest.value
        setChosen()
        isGuest.value = false
        localStorage.removeItem('auth-mode-guest')
      } else if (hasChosen.value && !isGuest.value) {
        // Tránh trạng thái "không login nhưng cũng không guest" làm UI tài khoản trống.
        setGuestMode()
      }

    } catch (e) {
      console.warn('[Auth] Không thể khôi phục phiên:', e)
    }

    if (authStateSubscription) {
      authStateSubscription.unsubscribe()
      authStateSubscription = null
    }

    // Lắng nghe thay đổi trạng thái auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      session.value = newSession
      user.value = newSession?.user ?? null
      if (user.value) {
        authError.value = null
        const wasGuestBeforeEvent = isGuest.value
        // If INITIAL_SESSION, use the flag captured during restoreSession, otherwise use current isGuest value
        const wasGuest = event === 'INITIAL_SESSION' ? wasGuestFromRestore : wasGuestBeforeEvent
        isGuest.value = false
        localStorage.removeItem('auth-mode-guest')
        setChosen()

        // Nếu người chơi vốn là khách (Guest) và giờ vừa đăng nhập, hãy hợp nhất dữ liệu của họ với cloud
        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
          await runCloudSync(wasGuest)
        } else if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          await runCloudSync(false)
        }
      } else if (hasChosen.value) {
        // Token hết hạn hoặc sign-out ở tab khác.
        setGuestMode()
      }
    })
    authStateSubscription = subscription

    // Fallback: trong một số môi trường listener có thể không bắn event mong đợi ngay.
    if (user.value) {
      await runCloudSync(wasGuestFromRestore)
    }
  }

  // ─── Đăng nhập Google ─────────────────────────────────────────────────────
  async function loginWithGoogle(): Promise<void> {
    if (!ensureConfigured('Đăng nhập Google')) return
    isLoading.value = true
    authError.value = null
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // Redirect về route auth để tránh router đổi URL quá sớm trước khi đọc token.
          redirectTo: `${window.location.origin}/auth`,
        },
      })
      if (error) authError.value = error.message
    } finally {
      isLoading.value = false
    }
  }

  // ─── Đăng xuất ────────────────────────────────────────────────────────────
  async function logout(): Promise<void> {
    // Luôn thoát local ngay để UI phản hồi tức thì, kể cả khi mạng lỗi.
    clearLocalAuthState()
    clearPersistedSupabaseSession()

    if (!isSupabaseConfigured()) return

    try {
      // local scope đủ để xóa session trên thiết bị, tránh phụ thuộc request mạng.
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error) {
        console.warn('[Auth] signOut local thất bại:', error.message)
      }
    } catch (err) {
      console.warn('[Auth] signOut local lỗi:', err)
    } finally {
      // Bảo đảm storage sạch ngay cả khi signOut throw hoặc bị đóng app giữa chừng.
      clearPersistedSupabaseSession()
    }
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
    logout,
  }
})
