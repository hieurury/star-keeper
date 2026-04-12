import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL_PLACEHOLDER = 'https://your-project-id.supabase.co'
const SUPABASE_ANON_KEY_PLACEHOLDER = 'your-anon-key-here'

const supabaseUrl = ((import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '').trim()
const supabaseAnonKey = ((import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '').trim()

const configured =
  !!supabaseUrl &&
  supabaseUrl !== SUPABASE_URL_PLACEHOLDER &&
  !!supabaseAnonKey &&
  supabaseAnonKey !== SUPABASE_ANON_KEY_PLACEHOLDER

// Keep app startup safe in CI/release builds where VITE_SUPABASE_* may not be injected.
const safeSupabaseUrl = configured ? supabaseUrl : 'https://placeholder.supabase.co'
const safeSupabaseAnonKey = configured ? supabaseAnonKey : 'placeholder-anon-key'

if (!configured) {
  console.warn('[Supabase] VITE_SUPABASE_URL chưa được cấu hình. Supabase sync sẽ bị tắt.')
}

export const supabase = createClient(safeSupabaseUrl, safeSupabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

/** True nếu Supabase đã được cấu hình (có URL thật) */
export function isSupabaseConfigured(): boolean {
  return configured
}
