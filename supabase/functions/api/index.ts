/**
 * API do Simulador de piercings corporais +18.
 *
 * Roda como Supabase Edge Function (Deno).
 *
 *   npx supabase functions deploy api
 *
 * A lógica fica em handler.ts para que os testes possam exercitá-la chamando a
 * função direto, sem abrir porta.
 */
import { handler } from './handler.ts'

Deno.serve(handler)
