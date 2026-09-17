import { createClient } from '@supabase/supabase-js'
import { config } from '../config.js'

// Service role key: nunca exponha isso ao browser. Ele ignora RLS de proposito,
// por isso toda escrita passa obrigatoriamente por este backend.
export const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
