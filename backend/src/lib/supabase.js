import { createClient } from '@supabase/supabase-js'
import { config } from '../config.js'

// Chave secreta (sb_secret_...): ignora RLS de proposito e nunca pode chegar ao
// browser. Por isso toda escrita passa obrigatoriamente por este backend.
export const supabase = createClient(config.supabaseUrl, config.supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
