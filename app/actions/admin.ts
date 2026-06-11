'use server'

import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'

export async function createUser(fullName: string, email: string, password: string, role: string) {
  const session = await getSession()
  if (!session || (session.role !== 'admin' && session.role !== 'supervisor')) {
    return { error: 'No tienes permisos para realizar esta acción' }
  }

  const supabase = await createClient()

  // Verificar si existe
  const { data: existingUser } = await supabase
    .from('calendario_profiles')
    .select('id')
    .eq('email', email)
    .single()

  if (existingUser) {
    return { error: 'El correo ya está registrado' }
  }

  const password_hash = await bcrypt.hash(password, 10)

  const { error } = await supabase
    .from('calendario_profiles')
    .insert({
      full_name: fullName,
      email,
      password_hash,
      role
    })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/users')
  return { success: true }
}
