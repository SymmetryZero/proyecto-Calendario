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

  // Obtener todos los administradores (excluyendo al actor actual si es admin)
  const { data: admins } = await supabase
    .from('calendario_profiles')
    .select('id')
    .eq('role', 'admin')
    .neq('id', session.userId)

  if (admins && admins.length > 0) {
    const { data: myProfile } = await supabase.from('calendario_profiles').select('full_name').eq('id', session.userId).single()
    const actorName = myProfile?.full_name || 'Alguien'
    
    // Crear una notificación para cada administrador
    const notifications = admins.map(admin => ({
      user_id: admin.id,
      title: `Auditoría: ${action} ${entityType}`,
      message: `${actorName} ha realizado una acción: ${action} en ${entityType}.`,
      type: 'AUDIT',
      read: false
    }))
    
    await supabase.from('calendario_notifications').insert(notifications)
  }
}

export async function createTask(date: string, formData: FormData) {
  const session = await getSession()
  if (!session) throw new Error('No autorizado')

  const title = formData.get('title') as string
  if (!title || !title.trim()) throw new Error('El título es requerido')

  if (session.role === 'employee') {
    const todayStr = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD
    if (date < todayStr) {
      throw new Error('No puedes crear tareas en días pasados.')
    }
  }

  const supabase = await createClient()

  const { data: insertedLog, error } = await supabase
    .from('calendario_work_logs')
    .insert({
      employee_id: session.userId,
      date: date,
      title: title.trim(),
      status: 'Trabajando',
      start_time: new Date().toLocaleTimeString('es-ES', { hour12: false })
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  // Auditar
  if (insertedLog) {
    await logAudit('CREADO', 'BITACORA', insertedLog.id, { date, title })
  }

  revalidatePath(`/dashboard/calendar/${date}`)
  return { success: true, logId: insertedLog?.id }
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

  // Buscar dueño
  const { data: log } = await supabase.from('calendario_work_logs').select('employee_id, title, calendario_profiles(full_name)').eq('id', logId).single()

  const { error } = await supabase
    .from('calendario_work_updates')
    .insert({
      work_log_id: logId,
      author_id: session.userId,
      comment: comment
    })

  if (error) throw new Error(error.message)
  
  await logAudit('CREADO', 'AVANCE', logId, { comment_length: comment.length })
  
  // Notificar al dueño si no es el mismo que escribe
  if (log && log.employee_id !== session.userId) {
    const { data: myProfile } = await supabase.from('calendario_profiles').select('full_name').eq('id', session.userId).single()
    await supabase.from('calendario_notifications').insert({
      user_id: log.employee_id,
      title: 'Nuevo Avance',
      message: `${myProfile?.full_name} añadió un avance a tu tarea "${log.title || 'Sin Título'}".`,
      type: 'AVANCE'
    })
  }
  
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

export async function sendChatMessage(logId: string, content: string) {
  const session = await getSession()
  if (!session) throw new Error('No autorizado')

  const supabase = await createClient()

  // Buscar dueño y datos de la bitácora
  const { data: log } = await supabase.from('calendario_work_logs').select('employee_id, title').eq('id', logId).single()

  const { error } = await supabase.from('calendario_chat_messages').insert({
    work_log_id: logId,
    sender_id: session.userId,
    content: content
  })

  if (error) throw new Error(error.message)

  // Notificar al dueño si no es el mismo que escribe
  if (log && log.employee_id !== session.userId) {
    const { data: myProfile } = await supabase.from('calendario_profiles').select('full_name').eq('id', session.userId).single()
    const { error: notifError } = await supabase.from('calendario_notifications').insert({
      user_id: log.employee_id,
      title: 'Nuevo Mensaje',
      message: `${myProfile?.full_name} comentó en tu tarea "${log.title || 'Nueva Tarea'}".`,
      type: 'CHAT',
      read: false
    })
    if (notifError) {
      console.error("Error inserting notification:", notifError)
    }
  }

  return { success: true }
}

export async function updateTaskTitle(logId: string, title: string) {
  const session = await getSession()
  if (!session || session.role !== 'admin') throw new Error('No autorizado')

  const supabase = await createClient()
  const { error } = await supabase
    .from('calendario_work_logs')
    .update({ title })
    .eq('id', logId)

  if (error) throw new Error(error.message)
  
  await logAudit('ACTUALIZADO', 'TITULO', logId, { title })
  
  revalidatePath('/dashboard/calendar')
  return { success: true }
}
