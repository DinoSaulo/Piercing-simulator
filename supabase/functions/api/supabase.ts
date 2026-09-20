import { createClient } from 'npm:@supabase/supabase-js@2'
import { config } from './config.ts'

// Service role: ignora RLS de propósito. Roda só aqui dentro da função e nunca
// chega ao browser, por isso toda escrita passa obrigatoriamente por esta API.
export const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
