import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface LoadingShowOptions {
  title?: string
  subtitle?: string
  tip?: string
}

const DEFAULT_TIPS = [
  'Kết hợp nâng cấp để mở nâng cấp mạnh hơn.',
  'Vàng có thể dùng để mua phi cơ và cổ vật.',
  'Các tên lửa có thể đuổi theo bạn.',
  'Kẻ địch thông minh hơn bạn nghĩ.',
  'Không thể dùng phi cơ có độ bền quá thấp.',
  'Thử tổ hợp thẻ Tấn công và Hỗ trợ để mở khóa thẻ Tối thượng.',
  'Nên giữ vị trí giữa màn hình để dễ né đạn hơn.',
  'Đánh boss đúng lúc giúp vượt stage an toàn hơn.',
  'Cánh Tản Nhiệt tăng tốc độ bay của phi cơ, không tăng tốc đạn.',
  'Phục Hồi Kỹ Năng giảm hồi chiêu kỹ năng phi cơ và cả các lõi có thời gian hồi.',
  'Nhớ thu gom EXP sớm để không bỏ lỡ cấp độ quan trọng.',
  'Lá chắn năng lượng có thể cứu bạn ở tình huống nguy hiểm.',
  'Hãy để ý độ bền phi cơ trước khi vào trận mới.',
]

export const useUiStore = defineStore('ui', () => {
  const loadingVisible = ref(true)
  const loadingTitle = ref('Star Keeper')
  const loadingSubtitle = ref('Khởi động hệ thống phi hành...')
  const loadingTip = ref(DEFAULT_TIPS[0]!)
  const loadingTips = ref<string[]>([...DEFAULT_TIPS])
  const loadingToken = ref(0)

  function nextLoadingTip() {
    const tips = loadingTips.value
    if (tips.length === 0) return
    if (tips.length === 1) {
      loadingTip.value = tips[0]!
      return
    }
    let next = loadingTip.value
    for (let i = 0; i < 5; i++) {
      const cand = tips[Math.floor(Math.random() * tips.length)]!
      if (cand !== loadingTip.value) {
        next = cand
        break
      }
    }
    loadingTip.value = next
  }

  function showLoading(opts: LoadingShowOptions = {}): number {
    loadingToken.value += 1
    loadingVisible.value = true
    if (opts.title) loadingTitle.value = opts.title
    if (opts.subtitle) loadingSubtitle.value = opts.subtitle
    if (opts.tip) loadingTip.value = opts.tip
    else nextLoadingTip()
    return loadingToken.value
  }

  function hideLoading(token?: number) {
    if (token !== undefined && token !== loadingToken.value) return
    loadingVisible.value = false
  }

  return {
    loadingVisible,
    loadingTitle,
    loadingSubtitle,
    loadingTip,
    loadingTips,
    showLoading,
    hideLoading,
    nextLoadingTip,
  }
})
