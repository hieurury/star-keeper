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
    id: 'update-2026-03-14-v1-1-0',
    version: 'v1.1.0',
    date: '2026-03-14',
    title: 'Bản vá 1.1.0 — Đồng bộ lõi và UI hướng dẫn',
    summary: 'Cập nhật logic hồi chiêu lõi, bổ sung lõi drone và làm mới hướng dẫn theo UI hiện tại.',
    sections: [
      {
        heading: 'Gameplay',
        bullets: [
          'Giảm hồi chiêu từ Phục Hồi Kỹ Năng nay ảnh hưởng cả kỹ năng phi cơ và các lõi có thời gian hồi.',
          'Thêm lõi Đồng Minh Hỗ Trợ, Bọc Thép và lõi tối thượng Drone Hủy Diệt.',
          'Sửa nhiều lỗi cân bằng: Pioneer không kẹt rìa, Star Shooter missile nhận hút máu, tối ưu hiển thị lõi trong menu dừng.',
        ],
      },
      {
        heading: 'Giao diện',
        bullets: [
          'Cập nhật nội dung hướng dẫn để khớp UI hiện tại và kỹ năng theo từng phi cơ.',
          'Mục thông báo chỉ giữ 3 bản gần nhất để dễ theo dõi.',
        ],
      },
    ],
    media: [
      {
        src: '/pwa/icon-192.svg',
        alt: 'Star Keeper phiên bản 1.1.0',
        caption: 'Phiên bản 1.1.0 tập trung vào đồng bộ cơ chế lõi và trải nghiệm chiến đấu.',
      },
    ],
  },
  {
    id: 'update-2026-03-14-v1-0-9',
    version: 'v1.0.9',
    date: '2026-03-14',
    title: 'Cân bằng địch và nâng cấp chiến cơ',
    summary: 'Tinh chỉnh nhịp độ địch, mở rộng nâng cấp tàu và cập nhật trung tâm thông báo.',
    sections: [
      {
        heading: 'Cân bằng chiến đấu',
        bullets: [
          'Giảm tốc độ tấn công của Bnox - Đại liên.',
          'Địch tanker được ưu tiên xuất hiện trước trong wave.',
          'Tăng khả năng thu EXP và tỉ lệ xuất hiện của Cnox - Tham lam.',
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
        alt: 'Tổng quan cập nhật cân bằng và nâng cấp',
        caption: 'Hệ nâng cấp tàu và cân bằng wave được tinh chỉnh để chơi ổn định hơn.',
      },
    ],
  },
  {
    id: 'update-2026-03-14-v1-0-8',
    version: 'v1.0.8',
    date: '2026-03-14',
    title: 'Nền tảng PWA và trải nghiệm tải game',
    summary: 'Hoàn thiện nền tảng cài đặt app và lớp loading/tip khi vào trận.',
    sections: [
      {
        heading: 'Hạ tầng',
        bullets: [
          'Hỗ trợ cài đặt game dạng PWA trên desktop và mobile.',
          'Thêm service worker và tài nguyên icon cho app cài đặt.',
        ],
      },
      {
        heading: 'Trải nghiệm',
        bullets: [
          'Màn hình tải có mục Mẹo và điều hướng mượt hơn khi vào/ra trận.',
          'Sửa vấn đề mất tiến trình cục bộ ở một số vòng đời PWA.',
        ],
      },
    ],
    media: [
      {
        src: '/pwa/icon-512.svg',
        alt: 'Biểu tượng PWA Star Keeper',
        caption: 'Bạn có thể thêm Star Keeper ra màn hình chính như một ứng dụng.',
      },
    ],
  },
]
