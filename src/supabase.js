// Supabase 클라이언트 (팀 모드 전용)
// SUPABASE_ENABLED 가 false 면 null 이므로, 사용처에서 항상 가드할 것.
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_ENABLED } from './config'

export const supabase = SUPABASE_ENABLED ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null
