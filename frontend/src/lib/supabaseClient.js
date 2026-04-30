import { createClient } from '@supabase/supabase-js'
import { safeLocalStorageGet } from './safeStorage'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const SESSION_TOKEN_KEY = 'smvec_session_token'

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

const baseClientOptions = {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, baseClientOptions)
  : null

export function getSupabaseWithSession() {
  if (!isSupabaseConfigured) return null

  const sessionToken = safeLocalStorageGet(SESSION_TOKEN_KEY)
  if (!sessionToken) return null
  const headers = sessionToken ? { 'x-session-token': sessionToken } : {}

  return createClient(supabaseUrl, supabaseAnonKey, {
    ...baseClientOptions,
    global: {
      headers,
    },
  })
}
