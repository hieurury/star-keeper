import { supabase, isSupabaseConfigured } from './supabase'
import { isOnline } from './networkStatus'

const TABLE = 'game_saves'

export interface RemoteSave {
  save_version: number
  payload: Record<string, unknown>
  client_updated_at: string
}

export interface PushSaveResult {
  ok: boolean
  code?: string
  message?: string
}

export interface ProfileEnsureResult {
  ok: boolean
  code?: string
  message?: string
}

function isUpsertConflictConstraintError(error: { code?: string | null, message?: string | null } | null): boolean {
  if (!error) return false
  if (error.code === '42P10') return true
  const msg = (error.message ?? '').toLowerCase()
  return msg.includes('on conflict') && msg.includes('constraint')
}

/**
 * Đẩy dữ liệu save lên Supabase (upsert vào bảng game_saves).
 * No-op nếu: chưa cấu hình Supabase, chưa đăng nhập, hoặc offline.
 */
export async function pushSave(
  userId: string,
  saveVersion: number,
  payload: Record<string, unknown>,
  clientUpdatedAt?: string,
): Promise<PushSaveResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, code: 'SUPABASE_NOT_CONFIGURED', message: 'Supabase chưa được cấu hình' }
  }
  if (!isOnline.value) {
    return { ok: false, code: 'OFFLINE', message: 'Thiết bị đang offline' }
  }

  const resolvedUpdatedAt = clientUpdatedAt ?? new Date().toISOString()
  const row = {
    user_id: userId,
    save_version: saveVersion,
    payload,
    client_updated_at: resolvedUpdatedAt,
  }

  const { error } = await supabase.from(TABLE).upsert(row, { onConflict: 'user_id' })
  if (!error) return { ok: true }

  if (!isUpsertConflictConstraintError(error)) {
    console.warn('[SyncService] pushSave thất bại:', error.code ?? 'UNKNOWN', error.message)
    return { ok: false, code: error.code ?? 'UNKNOWN', message: error.message ?? 'pushSave thất bại' }
  }

  // Fallback for schemas where user_id is not declared UNIQUE (upsert cannot target conflict).
  const { data: existing, error: selectErr } = await supabase
    .from(TABLE)
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (selectErr) {
    console.warn('[SyncService] pushSave fallback/select thất bại:', selectErr.code ?? 'UNKNOWN', selectErr.message)
    return { ok: false, code: selectErr.code ?? 'UNKNOWN', message: selectErr.message ?? 'fallback select thất bại' }
  }

  if (existing) {
    const { error: updateErr } = await supabase.from(TABLE).update(row).eq('user_id', userId)
    if (updateErr) {
      console.warn('[SyncService] pushSave fallback/update thất bại:', updateErr.code ?? 'UNKNOWN', updateErr.message)
      return { ok: false, code: updateErr.code ?? 'UNKNOWN', message: updateErr.message ?? 'fallback update thất bại' }
    }
    return { ok: true }
  }

  const { error: insertErr } = await supabase.from(TABLE).insert(row)
  if (insertErr) {
    console.warn('[SyncService] pushSave fallback/insert thất bại:', insertErr.code ?? 'UNKNOWN', insertErr.message)
    return { ok: false, code: insertErr.code ?? 'UNKNOWN', message: insertErr.message ?? 'fallback insert thất bại' }
  }

  return { ok: true }
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
export async function ensureProfile(userId: string, username: string, avatarId: number): Promise<ProfileEnsureResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, code: 'SUPABASE_NOT_CONFIGURED', message: 'Supabase chưa được cấu hình' }
  }
  if (!isOnline.value) {
    return { ok: false, code: 'OFFLINE', message: 'Thiết bị đang offline' }
  }

  const { error } = await supabase.from('profiles').upsert(
    {
      id: userId,
      username,
      avatar_id: avatarId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id', ignoreDuplicates: false },
  )

  if (error) {
    console.warn('[SyncService] ensureProfile thất bại:', error.code ?? 'UNKNOWN', error.message)
    return { ok: false, code: error.code ?? 'UNKNOWN', message: error.message ?? 'ensureProfile thất bại' }
  }

  return { ok: true }
}
