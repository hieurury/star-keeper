import type { EnemyKind } from '../game/types'

export type EnemyCodexTab = 'minion' | 'boss'

export interface EnemyCodexPhase {
  title: string
  desc: string
  art: string
}

export interface EnemyCodexEntry {
  kind: EnemyKind
  tab: EnemyCodexTab
  name: string
  icon: string
  info: string
  attackPattern: string
  counters: string
  expDrop: string
  tips: string[]
  stats: {
    hp: number
    speed: number
    damage: number
    threat: number
  }
  phases: EnemyCodexPhase[]
}

export const ENEMY_CODEX: EnemyCodexEntry[] = [
  {
    kind: 'pioneer',
    tab: 'minion',
    name: 'Pioneer',
    icon: 'PhAirplaneTilt',
    info: 'Đơn vị trinh sát cơ bản, thường xuất hiện theo đội hình và đổi hướng liên tục.',
    attackPattern: 'Lao xuống theo cụm, giữ cự ly rồi đảo đội hình để ép góc di chuyển của phi cơ.',
    counters: 'Không có cơ chế đặc biệt; nguy hiểm khi đi theo đàn đông.',
    expDrop: '2-3 orb trắng (~20-30 EXP).',
    tips: [
      'Giữ vị trí trung tâm để tránh bị ép vào biên.',
      'Dọn bớt từng cánh đội hình trước để mở khoảng trống.',
    ],
    stats: { hp: 28, speed: 80, damage: 42, threat: 38 },
    phases: [
      { title: 'Tiến vào', desc: 'Bay vào khu vực chiến đấu theo điểm tập kết.', art: 'pioneer_enter' },
      { title: 'Patrol', desc: 'Dao động nhỏ để duy trì áp lực đường đạn.', art: 'pioneer_patrol' },
      { title: 'Ép đội hình', desc: 'Đồng bộ với cả đàn để thu hẹp góc né.', art: 'pioneer_press' },
    ],
  },
  {
    kind: 'kamikaze',
    tab: 'minion',
    name: 'Kamikaze',
    icon: 'PhRocketLaunch',
    info: 'Đơn vị cảm tử với nhịp khóa mục tiêu rồi tăng tốc đột biến.',
    attackPattern: 'Ngắm mục tiêu, kẻ cảnh báo, sau đó lao thẳng vào vị trí đã khóa.',
    counters: 'Sát thương va chạm cao, dễ gây chết bất ngờ nếu bị dồn.',
    expDrop: '2-3 orb trắng/xanh (~20-35 EXP).',
    tips: [
      'Đổi hướng ngay khi thấy vạch khóa.',
      'Không đứng yên gần mép dưới màn hình.',
    ],
    stats: { hp: 30, speed: 68, damage: 42, threat: 82 },
    phases: [
      { title: 'Khóa mục tiêu', desc: 'Hiện cảnh báo trước khi nạp lao.', art: 'kamikaze_lock' },
      { title: 'Charge', desc: 'Tăng tốc cực nhanh theo quỹ đạo đã ngắm.', art: 'kamikaze_charge' },
      { title: 'Tiền nổ', desc: 'Có thể phát nổ khi tiếp cận quá gần.', art: 'kamikaze_prexplode' },
    ],
  },
  {
    kind: 'sniper',
    tab: 'minion',
    name: 'Sniper',
    icon: 'PhTarget',
    info: 'Xạ thủ tầm xa, bắn chính xác và thường đổi vị trí để giữ khoảng cách.',
    attackPattern: 'Canh góc bắn, nổ phát đạn mạnh theo nhịp rồi lùi/né.',
    counters: 'Đạn sát thương cao, khó chịu khi đứng cùng bảo kê tuyến trước.',
    expDrop: '2-4 orb trắng/tím (~20-50 EXP).',
    tips: [
      'Ưu tiên hạ Sniper trước khi xử lý đám đông.',
      'Di chuyển zig-zag để phá đường ngắm.',
    ],
    stats: { hp: 12, speed: 22, damage: 42, threat: 68 },
    phases: [
      { title: 'Ngắm bắn', desc: 'Neo vị trí và khóa trục tấn công.', art: 'sniper_aim' },
      { title: 'Bắn tỉa', desc: 'Bắn đạn mạnh từng nhịp với độ chính xác cao.', art: 'sniper_shot' },
    ],
  },
  {
    kind: 'dai_lien',
    tab: 'minion',
    name: 'Đại Liên',
    icon: 'PhLightning',
    info: 'Đơn vị hoả lực liên thanh tạo vùng đạn dày ở trung tâm màn hình.',
    attackPattern: 'Xả chùm đạn tốc độ cao theo nhịp burst ngắn.',
    counters: 'Mật độ đạn lớn khiến không gian né bị bóp nghẹt.',
    expDrop: '3-4 orb xanh/tím (~50-90 EXP).',
    tips: [
      'Né sang hai cánh khi chúng bắt đầu burst.',
      'Dùng sát thương diện rộng để cắt cụm Đại Liên nhanh.',
    ],
    stats: { hp: 32, speed: 92, damage: 42, threat: 70 },
    phases: [
      { title: 'Giữ đội hình', desc: 'Giữ cự ly để chuẩn bị xả liên thanh.', art: 'dailien_hold' },
      { title: 'Burst', desc: 'Phun đạn theo chùm ngắn nhưng dày.', art: 'dailien_burst' },
    ],
  },
  {
    kind: 'thu_ho',
    tab: 'minion',
    name: 'Thủ Hộ',
    icon: 'PhShieldPlus',
    info: 'Đơn vị phòng thủ có trạng thái phản đòn theo chu kỳ nhóm.',
    attackPattern: 'Vừa bám đội hình vừa phản xạ sát thương trong cửa sổ kích hoạt.',
    counters: 'Phản đòn đồng bộ khi đủ số lượng cùng xuất hiện.',
    expDrop: '3-4 orb trắng/xanh (~40-70 EXP).',
    tips: [
      'Quan sát hiệu ứng sáng trước khi dồn sát thương.',
      'Tách đàn Thủ Hộ để giảm phản xạ diện rộng.',
    ],
    stats: { hp: 64, speed: 32, damage: 42, threat: 42 },
    phases: [
      { title: 'Canh phòng', desc: 'Bay chậm, giữ tuyến trước cho đồng đội.', art: 'thuho_guard' },
      { title: 'Phản đòn', desc: 'Bật trạng thái phản xạ theo nhịp đội hình.', art: 'thuho_reflect' },
    ],
  },
  {
    kind: 'thuat_si',
    tab: 'minion',
    name: 'Thuật Sĩ',
    icon: 'PhMagicWand',
    info: 'Hỗ trợ hồi máu cho đồng minh và có thể hóa thiên thạch khi bị hạ.',
    attackPattern: 'Khóa mục tiêu đồng minh để hồi máu theo tia nối.',
    counters: 'Khi chết có thể chuyển pha rơi thiên thạch lao vào người chơi.',
    expDrop: '2-4 orb trắng/xanh/tím (~30-70 EXP).',
    tips: [
      'Ưu tiên hạ Thuật Sĩ trước khi xử lý tanker.',
      'Né ngang khi nó chuyển sang dạng thiên thạch.',
    ],
    stats: { hp: 28, speed: 60, damage: 42, threat: 52 },
    phases: [
      { title: 'Hồi phục tia', desc: 'Kênh tia hồi máu lên mục tiêu gần nhất.', art: 'thuatsi_heal' },
      { title: 'Thiên thạch', desc: 'Bị hạ sẽ hóa đá rơi, gây va chạm mạnh.', art: 'thuatsi_meteor' },
    ],
  },
  {
    kind: 'cnox_greedy',
    tab: 'minion',
    name: 'Cnox Greedy',
    icon: 'PhMagnet',
    info: 'Đơn vị tham lam hấp thu EXP rơi để tự tăng sức mạnh theo thời gian.',
    attackPattern: 'Di chuyển hút orb và tăng chỉ số theo lượng EXP đã nuốt.',
    counters: 'Càng để lâu càng trâu và gây sát thương mạnh hơn.',
    expDrop: '2-3 orb + hoàn trả phần EXP đã cướp (nếu có).',
    tips: [
      'Tập trung hạ sớm trước khi nó tích nhiều EXP.',
      'Giữ khu vực orb sạch để hạn chế tăng trưởng.',
    ],
    stats: { hp: 22, speed: 60, damage: 42, threat: 58 },
    phases: [
      { title: 'Hút EXP', desc: 'Thu orb quanh khu vực để tích trữ năng lượng.', art: 'greedy_absorb' },
      { title: 'Tiến hóa', desc: 'Tăng kích cỡ, HP và sức tấn công.', art: 'greedy_evolve' },
    ],
  },
  {
    kind: 'cnox_shield',
    tab: 'minion',
    name: 'Cnox Shield',
    icon: 'PhShieldPlus',
    info: 'Đơn vị khiên với đội hình hàng ngang dày, gây cản trở góc bắn.',
    attackPattern: 'Giữ hàng và đẩy tường chắn, ép người chơi đổi lane liên tục.',
    counters: 'Độ bền tốt ở tuyến trước, dễ che chắn cho đơn vị sau.',
    expDrop: '2-3 orb trắng/xanh (~20-40 EXP).',
    tips: [
      'Dùng kỹ năng xuyên hoặc sát thương lan để phá hàng.',
      'Không đứng quá lâu cùng một lane khi hàng khiên áp xuống.',
    ],
    stats: { hp: 60, speed: 0, damage: 62, threat: 52 },
    phases: [
      { title: 'Lập hàng', desc: 'Xếp đội hình và khóa trục tiến quân.', art: 'shield_form' },
      { title: 'Đẩy lane', desc: 'Tiến chậm nhưng tạo áp lực không gian lớn.', art: 'shield_push' },
    ],
  },
  {
    kind: 'cnox_spark',
    tab: 'minion',
    name: 'Cnox Spark',
    icon: 'PhLightning',
    info: 'Đơn vị laser có các trạng thái cảnh báo, quét tia và liên kết đồng đội.',
    attackPattern: 'Đổi giữa tia quét cá nhân và laser liên kết nhiều điểm.',
    counters: 'Tia liên kết có thể cắt ngang khu vực di chuyển rộng.',
    expDrop: '2-4 orb trắng/xanh/tím (~30-80 EXP).',
    tips: [
      'Quan sát giai đoạn warning để đổi vị trí sớm.',
      'Không đứng giữa 2 Spark đang chuẩn bị link beam.',
    ],
    stats: { hp: 34, speed: 32, damage: 71, threat: 80 },
    phases: [
      { title: 'Warning', desc: 'Vẽ cone/ray cảnh báo trước khi bắn.', art: 'spark_warning' },
      { title: 'Firing', desc: 'Bắn tia quét hoặc liên kết theo cặp.', art: 'spark_fire' },
      { title: 'Cooldown', desc: 'Nghỉ ngắn rồi chuyển trạng thái tiếp theo.', art: 'spark_cd' },
    ],
  },
  {
    kind: 'boss_stardestroyer',
    tab: 'boss',
    name: 'Boss Star Destroyer',
    icon: 'PhRocketLaunch',
    info: 'Boss phá hủy hạng nặng với pháo chính, laser khóa và mưa tên lửa.',
    attackPattern: 'Luân phiên bắn pháo nặng, khóa tia và phóng salvo tên lửa.',
    counters: 'Áp lực dồn theo nhịp combo; sai nhịp né sẽ mất nhiều máu.',
    expDrop: '10 vàng + 6 tím + 4 xanh (~720 EXP).',
    tips: [
      'Giữ khoảng trống để né tên lửa nhiều đợt.',
      'Ưu tiên né laser khóa trước khi dồn DPS.',
    ],
    stats: { hp: 1600, speed: 0, damage: 100, threat: 95 },
    phases: [
      { title: 'Pha 1', desc: 'Pháo chính + đạn nền.', art: 'sd_phase1' },
      { title: 'Pha 2', desc: 'Khóa laser và ép góc né.', art: 'sd_phase2' },
      { title: 'Pha 3', desc: 'Salvo tên lửa áp lực cao.', art: 'sd_phase3' },
    ],
  },
  {
    kind: 'boss_invader',
    tab: 'boss',
    name: 'Boss Invader',
    icon: 'PhAtom',
    info: 'Boss tàu mẹ có tháp pháo phụ, kỹ năng khu vực và áp lực nhiều nguồn.',
    attackPattern: 'Tháp pháo bắn độc lập, xen kẽ đạn diện rộng và đòn ép vị trí.',
    counters: 'Nhiều hitbox tấn công cùng lúc khiến việc đứng yên rất nguy hiểm.',
    expDrop: '12 vàng + 8 tím + 5 xanh (~890 EXP).',
    tips: [
      'Hạ các tháp pháo gây khó chịu sớm nếu có cơ hội.',
      'Đừng đứng giữa boss và mép dưới quá lâu.',
    ],
    stats: { hp: 2000, speed: 0, damage: 100, threat: 96 },
    phases: [
      { title: 'Tháp pháo', desc: 'Nhiều ụ súng hoạt động song song.', art: 'inv_turret' },
      { title: 'Ép vùng', desc: 'AOE và mưa đạn buộc đổi lane.', art: 'inv_zone' },
      { title: 'Dồn nhịp', desc: 'Tăng tần suất tấn công cuối pha.', art: 'inv_pressure' },
    ],
  },
  {
    kind: 'boss_tinhvan',
    tab: 'boss',
    name: 'Boss Tinh Vân',
    icon: 'PhSpiral',
    info: 'Boss không gian điều khiển hố đen, cổng triệu hồi và áp lực vùng.',
    attackPattern: 'Tạo vùng hút, triệu hồi cổng và bắn từ nhiều mấu súng quỹ đạo.',
    counters: 'Hố đen làm lệch quỹ đạo né, đặc biệt nguy hiểm khi trùng nhịp đạn.',
    expDrop: '12 vàng + 7 tím + 4 xanh (~830 EXP).',
    tips: [
      'Tránh đứng gần tâm hố đen khi đang có đạn dày.',
      'Canh thời điểm cổng triệu hồi để dọn lính sớm.',
    ],
    stats: { hp: 2200, speed: 0, damage: 100, threat: 95 },
    phases: [
      { title: 'Quỹ đạo súng', desc: 'Nhiều mấu súng bắn burst theo vòng quay.', art: 'tv_orbit' },
      { title: 'Hố đen', desc: 'Tạo vùng kéo, phá nhịp điều khiển người chơi.', art: 'tv_blackhole' },
      { title: 'Triệu hồi', desc: 'Mở cổng gọi thêm áp lực bản đồ.', art: 'tv_summon' },
    ],
  },
  {
    kind: 'boss_trumso',
    tab: 'boss',
    name: 'Boss Trùm Số',
    icon: 'PhCrown',
    info: 'Boss cơ giới đa chế độ: súng máy, tên lửa, lao thẳng lane và laser pha 2.',
    attackPattern: 'Đổi mode liên tục giữa burst súng máy, missile, charge và sweep laser.',
    counters: 'Khó đoán nhịp nếu không nhận diện mode hiện tại.',
    expDrop: '8 vàng + 5 tím + 3 xanh (~555 EXP).',
    tips: [
      'Quan sát hiệu ứng warning để biết mode chuẩn bị kích hoạt.',
      'Khi charge lane, né ngang sớm thay vì né muộn.',
    ],
    stats: { hp: 2800, speed: 0, damage: 100, threat: 96 },
    phases: [
      { title: 'Machinegun', desc: 'Xả đạn nhanh theo cụm ngắn.', art: 'trum_machinegun' },
      { title: 'Missile', desc: 'Phóng tên lửa truy đuổi theo nhịp.', art: 'trum_missile' },
      { title: 'Charge/Laser', desc: 'Lao lane và kích hoạt laser pha cao.', art: 'trum_charge_laser' },
    ],
  },
  {
    kind: 'boss_cnox_sun',
    tab: 'boss',
    name: 'Boss Cnox Sun',
    icon: 'PhStar',
    info: 'Boss thiên thể với sao vũ khí quỹ đạo, tinh thể hồi máu và core laser quét.',
    attackPattern: 'Kích hoạt sao tấn công theo mẫu hình, dựng tinh thể hồi máu, quét core laser.',
    counters: 'Có hồi phục theo số tinh thể còn sống; bỏ qua tinh thể sẽ kéo dài trận.',
    expDrop: '14 vàng + 8 tím + 6 xanh (~1020 EXP).',
    tips: [
      'Ưu tiên phá tinh thể để chặn hồi máu boss.',
      'Trong pha core laser, giữ di chuyển đều theo hướng quét.',
    ],
    stats: { hp: 3400, speed: 0, damage: 100, threat: 96 },
    phases: [
      { title: 'Vũ khí sao', desc: '4 sao quanh boss thay phiên pattern tấn công.', art: 'sun_stars' },
      { title: 'Tinh thể năng lượng', desc: 'Spawn tinh thể, hồi HP theo số lượng còn lại.', art: 'sun_crystal' },
      { title: 'Core laser', desc: 'Cảnh báo rồi quét laser diện rộng.', art: 'sun_core_laser' },
    ],
  },
]
