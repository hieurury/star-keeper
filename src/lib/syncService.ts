import { supabase, isSupabaseConfigured } from './supabase'
import { isOnline } from './networkStatus'

const TABLE = 'game_saves'

export interface RemoteSave {
  save_version: number
  payload: Record<string, unknown>
  client_updated_at: string
}

/**
 * Đẩy dữ liệu save lên Supabase (upsert vào bảng game_saves).
 * No-op nếu: chưa cấu hình Supabase, chưa đăng nhập, hoặc offline.
 */
export async function pushSave(
  userId: string,
  saveVersion: number,
  payload: Record<string, unknown>,
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false
  if (!isOnline.value) return false

  const clientUpdatedAt = new Date().toISOString()
  const { error } = await supabase.from(TABLE).upsert(
    {
      user_id: userId,
      save_version: saveVersion,
      payload,
      client_updated_at: clientUpdatedAt,
    },
    { onConflict: 'user_id' },
  )

  if (error) {
    console.warn('[SyncService] pushSave thất bại:', error.message)
    return false
  }
  return true
}

/**
 * Kéo dữ liệu save từ Supabase.
 * Trả về null nếu không có dữ liệu hoặc lỗi.
 */
export async function pullSave(userId: string): Promise<RemoteSave | null> {
  if (!isSupabaseConfigured()) return null
  if (!isOnline.value) return null

  const { data, error } = await supabase
    .from(TABLE)
    .select('save_version, payload, client_updated_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.warn('[SyncService] pullSave thất bại:', error.message)
    return null
  }
  return data as RemoteSave | null
}

/**
 * So sánh timestamp local vs remote để quyết định bản nào mới hơn.
 * Trả về 'local' | 'remote' | 'equal'.
 */
export function resolveConflict(
  localUpdatedAt: string | null,
  localVersion: number,
  remote: RemoteSave,
): 'local' | 'remote' | 'equal' {
  // Version cao hơn luôn thắng
  if (remote.save_version > localVersion) return 'remote'
  if (localVersion > remote.save_version) return 'local'

  // Cùng version → so timestamp
  if (!localUpdatedAt) return 'remote'
  const localTime = new Date(localUpdatedAt).getTime()
  const remoteTime = new Date(remote.client_updated_at).getTime()

  if (remoteTime > localTime) return 'remote'
  if (localTime > remoteTime) return 'local'
  return 'equal'
}

/**
 * Đảm bảo profile người dùng tồn tại trong bảng profiles.
 */
export async function ensureProfile(userId: string, username: string, avatarId: number): Promise<void> {
  if (!isSupabaseConfigured()) return
  if (!isOnline.value) return

  await supabase.from('profiles').upsert(
    {
      id: userId,
      username,
      avatar_id: avatarId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id', ignoreDuplicates: false },
  )
}
