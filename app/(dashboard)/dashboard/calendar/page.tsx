import { createClient } from '@/lib/supabase/server'
import { CalendarView } from '@/components/calendar-view'
import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { startOfMonth, endOfMonth, format } from 'date-fns'

export default async function CalendarPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const supabase = await createClient()

  // Por ahora traemos los últimos 2 meses o el mes actual, para simplificar.
  // En un caso real el CalendarView llamaría a una API según el mes que se está viendo.
  // Pero para Next 15 Server Components, pasaremos los logs del mes actual inicialmente.
  // Para hacerlo dinámico, `CalendarView` podría usar un Server Action o Route Handler si cambia de mes, 
  // pero lo simplificaremos trayendo un rango amplio por ahora (ej. todo el año actual).
  
  const currentYear = new Date().getFullYear()
  const startYearDate = `${currentYear}-01-01`
  const endYearDate = `${currentYear}-12-31`

  let query = supabase
    .from('calendario_work_logs')
    .select('id, date, title, status, employee_id, calendario_profiles(full_name)')
    .gte('date', startYearDate)
    .lte('date', endYearDate)

  // Todos pueden ver todas las bitácoras para colaborar
  // La consulta trae las bitácoras de todos los usuarios

  const { data: logs } = await query

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col min-w-0">
      <h1 className="text-3xl font-bold tracking-tight mb-6">Mi Calendario</h1>
      <CalendarView 
        initialLogs={logs as any || []} 
        currentUserRole={session.role}
        currentUserId={session.userId}
      />
    </div>
  )
}
