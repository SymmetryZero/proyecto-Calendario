'use server'

import { createClient } from '@/lib/supabase/server'
import { createSession, logout } from '@/lib/auth/session'
import bcrypt from 'bcryptjs'

export async function loginAction(email: string, password: string) {
  const supabase = await createClient()

  // Buscar el usuario por email
  const { data: user, error } = await supabase
    .from('calendario_profiles')
    .select('*')
    .eq('email', email)
    .single()

  if (error || !user) {
    return { error: 'Correo o contraseña incorrectos' }
  }

  // Verificar la contraseña
  const isValid = await bcrypt.compare(password, user.password_hash)

  if (!isValid) {
    return { error: 'Correo o contraseña incorrectos' }
  }

  // Crear sesión
  await createSession(user.id, user.role)
  return { success: true }
}

export async function registerAction(email: string, password: string, fullName: string) {
  const supabase = await createClient()

  // Verificar si ya existe
  const { data: existingUser } = await supabase
    .from('calendario_profiles')
    .select('id')
    .eq('email', email)
    .single()

  if (existingUser) {
    return { error: 'El correo ya está registrado' }
  }

  // Hashear contraseña
  const password_hash = await bcrypt.hash(password, 10)

  // Insertar usuario
  const { data: newUser, error } = await supabase
    .from('calendario_profiles')
    .insert({
      email,
      password_hash,
      full_name: fullName,
      role: 'employee'
    })
    .select()
    .single()

  if (error || !newUser) {
    return { error: 'Error al registrar usuario' }
  }

  // Crear sesión
  await createSession(newUser.id, newUser.role)
  return { success: true }
}

export async function logoutAction() {
  await logout()
}
