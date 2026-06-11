'use server'

import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

export async function startWorkDay(date: string) {
  const session = await getSession()
  if (!session) throw new Error('No autorizado')

  const supabase = await createClient()

  const { error } = await supabase
    .from('calendario_work_logs')
    .insert({
      employee_id: session.userId,
      date: date,
      status: 'Trabajando',
      start_time: new Date().toLocaleTimeString('es-ES', { hour12: false })
    })

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/dashboard/calendar/${date}`)
  return { success: true }
}

export async function updateWorkStatus(logId: string, status: string) {
  const supabase = await createClient()
  
  const updates: any = { status }
  if (status === 'Finalizó actividades') {
    updates.end_time = new Date().toLocaleTimeString('es-ES', { hour12: false })
  }

  const { error } = await supabase
    .from('calendario_work_logs')
    .update(updates)
    .eq('id', logId)

  if (error) throw new Error(error.message)
  
  revalidatePath('/dashboard/calendar')
  return { success: true }
}

export async function savePlanning(logId: string, planned: string, objectives: string, priority: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('calendario_work_logs')
    .update({
      planned_activities: planned,
      objectives: objectives,
      priority: priority
    })
    .eq('id', logId)

  if (error) throw new Error(error.message)
  
  return { success: true }
}

export async function addProgressUpdate(logId: string, comment: string) {
  const session = await getSession()
  if (!session) throw new Error('No autorizado')

  const supabase = await createClient()

  const { error } = await supabase
    .from('calendario_work_updates')
    .insert({
      work_log_id: logId,
      author_id: session.userId,
      comment: comment
    })

  if (error) throw new Error(error.message)
  
  revalidatePath(`/dashboard/calendar`)
  return { success: true }
}
