'use server'

import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'

export async function completeOnboarding(fullName: string) {
  const session = await getSession()
  if (!session) throw new Error('No autorizado')

  const supabase = await createClient()

  const { error } = await supabase
    .from('calendario_profiles')
    .update({ full_name: fullName.trim() })
    .eq('id', session.userId)

  if (error) throw new Error(error.message)
  
  return { success: true }
}
