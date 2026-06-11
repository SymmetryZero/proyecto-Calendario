'use server'

import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

async function logAudit(action: string, entityType: string, entityId: string | null, details: any) {
  const session = await getSession()
  if (!session) return

  const supabase = await createClient()
  await supabase.from('calendario_audit_logs').insert({
    actor_id: session.userId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details
  })
}

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

  // Auditar
  const { data: insertedLog } = await supabase.from('calendario_work_logs').select('id').eq('employee_id', session.userId).eq('date', date).single()
  if (insertedLog) {
    await logAudit('CREADO', 'BITACORA', insertedLog.id, { date })
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
  
  await logAudit('ACTUALIZADO', 'ESTADO', logId, { status })
  
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
  
  await logAudit('ACTUALIZADO', 'PLANEACION', logId, { priority, has_planned: !!planned, has_objectives: !!objectives })
  
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
  
  await logAudit('CREADO', 'AVANCE', logId, { comment_length: comment.length })
  
  revalidatePath(`/dashboard/calendar`)
  return { success: true }
}

export async function deleteWorkLog(logId: string) {
  const session = await getSession()
  if (!session || session.role !== 'admin') throw new Error('No autorizado')

  const supabase = await createClient()
  const { data: log } = await supabase.from('calendario_work_logs').select('date, employee_id').eq('id', logId).single()
  
  const { error } = await supabase.from('calendario_work_logs').delete().eq('id', logId)
  if (error) throw new Error(error.message)

  await logAudit('ELIMINADO', 'BITACORA', logId, { date: log?.date, owner_id: log?.employee_id })
  
  revalidatePath('/dashboard/calendar')
  return { success: true }
}

export async function deleteProgressUpdate(updateId: string) {
  const session = await getSession()
  if (!session || session.role !== 'admin') throw new Error('No autorizado')

  const supabase = await createClient()
  
  const { data: update } = await supabase.from('calendario_work_updates').select('work_log_id, comment').eq('id', updateId).single()
  
  const { error } = await supabase.from('calendario_work_updates').delete().eq('id', updateId)
  if (error) throw new Error(error.message)

  await logAudit('ELIMINADO', 'AVANCE', updateId, { log_id: update?.work_log_id, comment_snippet: update?.comment?.substring(0, 20) })

  if (update?.work_log_id) {
    revalidatePath(`/dashboard/calendar`)
  }
  return { success: true }
}
