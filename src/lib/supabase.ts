import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || supabaseUrl === 'https://your-project-id.supabase.co') {
  console.warn('[Supabase] VITE_SUPABASE_URL chưa được cấu hình. Supabase sync sẽ bị tắt.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

/** True nếu Supabase đã được cấu hình (có URL thật) */
export function isSupabaseConfigured(): boolean {
  return (
    !!supabaseUrl &&
    supabaseUrl !== 'https://your-project-id.supabase.co' &&
    !!supabaseAnonKey &&
    supabaseAnonKey !== 'your-anon-key-here'
  )
}
