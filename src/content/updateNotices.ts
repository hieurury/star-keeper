export interface UpdateNoticeMedia {
  src: string
  alt: string
  caption?: string
}

export interface UpdateNotice {
  id: string
  version: string
  date: string
  title: string
  summary: string
  sections: Array<{
    heading: string
    bullets: string[]
  }>
  media?: UpdateNoticeMedia[]
}

export const UPDATE_NOTICES: UpdateNotice[] = [
  {
    id: 'update-2026-03-14-pwa-loading',
    version: 'v0.2.0',
    date: '2026-03-14',
    title: 'Cập nhật PWA và màn hình tải',
    summary: 'Game đã có thể cài đặt như ứng dụng và bổ sung màn hình tải kèm Mẹo.',
    sections: [
      {
        heading: 'Điểm mới',
        bullets: [
          'Hỗ trợ cài đặt game dạng PWA trên desktop và mobile.',
          'Màn hình tải mới có hiệu ứng và mục Mẹo khi vào trận.',
          'Tối ưu trải nghiệm chuyển màn và khởi động game.',
        ],
      },
      {
        heading: 'Lưu ý',
        bullets: [
          'Nếu chưa đọc thông báo, cửa sổ thông báo sẽ tự hiện khi vào game.',
          'Bạn luôn có thể mở lại thông báo bằng nút chuông.',
        ],
      },
    ],
    media: [
      {
        src: '/pwa/icon-512.svg',
        alt: 'Biểu tượng Star Keeper PWA',
        caption: 'Biểu tượng ứng dụng Star Keeper trên màn hình chính.',
      },
    ],
  },
  {
    id: 'update-2026-03-14-balance-ships',
    version: 'v0.2.1',
    date: '2026-03-14',
    title: 'Cân bằng địch và nâng cấp chiến cơ',
    summary: 'Giảm nhịp bắn Đại liên, chỉnh thứ tự tanker và mở hệ nâng cấp chiến cơ.',
    sections: [
      {
        heading: 'Cân bằng chiến đấu',
        bullets: [
          'Giảm tốc độ tấn công của Bnox - Đại liên.',
          'Địch tanker được ưu tiên xuất hiện trước trong wave.',
        ],
      },
      {
        heading: 'Nâng cấp chiến cơ',
        bullets: [
          'Mở panel nâng cấp khi bấm vào hình chiến cơ ở trang chủ.',
          'Có thể nâng cấp HP, Tốc bắn, Sát thương (mỗi loại tối đa 5 cấp).',
          'Giá nâng cấp tăng theo cấp và theo giá mở khóa phi cơ.',
        ],
      },
    ],
    media: [
      {
        src: '/pwa/icon-192.svg',
        alt: 'Tổng quan cập nhật chiến cơ',
        caption: 'Theo dõi thông báo để không bỏ lỡ thay đổi quan trọng.',
      },
    ],
  },
]
