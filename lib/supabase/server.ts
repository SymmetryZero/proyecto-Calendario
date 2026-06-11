import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Usamos la llave SERVICE_ROLE para saltarnos el RLS (ya que implementamos auth manual)
export async function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, // fallback en caso de que no haya service role, aunque es inseguro.
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}
