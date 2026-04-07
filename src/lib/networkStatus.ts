import { ref, watch } from 'vue'

/**
 * Theo dõi trạng thái kết nối mạng.
 * Phát sự kiện khi thiết bị kết nối lại mạng để trigger đồng bộ.
 */
const _isOnline = ref(typeof navigator !== 'undefined' ? navigator.onLine : true)

// Callbacks được gọi khi vừa có mạng trở lại
const _reconnectCallbacks: Array<() => void> = []

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    _isOnline.value = true
    _reconnectCallbacks.forEach(cb => {
      try { cb() } catch (e) { console.warn('[NetworkStatus] reconnect callback error', e) }
    })
  })
  window.addEventListener('offline', () => {
    _isOnline.value = false
  })
}

/** True nếu thiết bị đang có kết nối mạng */
export const isOnline = _isOnline

/**
 * Đăng ký callback được gọi khi mạng được khôi phục.
 * Trả về hàm để hủy đăng ký.
 */
export function onReconnect(cb: () => void): () => void {
  _reconnectCallbacks.push(cb)
  return () => {
    const idx = _reconnectCallbacks.indexOf(cb)
    if (idx !== -1) _reconnectCallbacks.splice(idx, 1)
  }
}

export { watch }
