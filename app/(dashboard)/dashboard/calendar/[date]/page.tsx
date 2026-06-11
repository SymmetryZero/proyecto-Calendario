import { createClient } from '@/lib/supabase/server'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { startWorkDay } from '@/app/actions/bitacora'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { StatusSelector } from '@/components/bitacora/status-selector'
import { PlanningForm } from '@/components/bitacora/planning-form'
import { UpdatesList } from '@/components/bitacora/updates-list'
import { Chat } from '@/components/bitacora/chat'
import { getSession } from '@/lib/auth/session'

export default async function DailyLogPage({ 
  params,
  searchParams
}: { 
  params: Promise<{ date: string }>,
  searchParams: Promise<{ employeeId?: string }>
}) {
  const { date: dateStr } = await params
  const { employeeId } = await searchParams
  
  // Validar formato YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    redirect('/dashboard/calendar')
  }

  const session = await getSession()
  if (!session) redirect('/login')

  const supabase = await createClient()

  const targetUserId = (session.role !== 'employee' && employeeId) ? employeeId : session.userId

  const { data: log } = await supabase
    .from('calendario_work_logs')
    .select(`
      *,
      calendario_profiles (full_name)
    `)
    .eq('employee_id', targetUserId)
    .eq('date', dateStr)
    .single()

  const { data: updates } = await supabase
    .from('calendario_work_updates')
    .select(`
      id,
      comment,
      created_at,
      calendario_profiles (full_name)
    `)
    .eq('work_log_id', log?.id)
    .order('created_at', { ascending: true })

  const formattedDate = format(parseISO(dateStr), "EEEE, d 'de' MMMM yyyy", { locale: es })

  if (!log) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/calendar">
            <Button variant="outline" size="icon"><ChevronLeft className="h-4 w-4" /></Button>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight capitalize">{formattedDate}</h1>
        </div>
        
        <Card className="mt-8 border-dashed bg-muted/50">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center space-y-4">
            <div className="rounded-full bg-primary/10 p-4">
              <svg className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold">No hay registro para este día</h3>
              <p className="text-muted-foreground max-w-sm mt-1">
                Para comenzar a reportar tus actividades, evidencias y estado, inicia tu día de trabajo.
              </p>
            </div>
            {session.role === 'employee' ? (
              <form action={async () => {
                'use server'
                await startWorkDay(dateStr)
              }}>
                <Button size="lg" className="mt-4">Comenzar Día Laboral</Button>
              </form>
            ) : (
              <div className="mt-4 text-sm text-muted-foreground">
                El empleado seleccionado no registró actividades este día.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/calendar">
            <Button variant="outline" size="icon"><ChevronLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight capitalize">{formattedDate}</h1>
            <p className="text-muted-foreground">
              {log.calendario_profiles.full_name} • Inicio: {log.start_time || '--:--'}
            </p>
          </div>
        </div>
        <div>
          <StatusSelector logId={log.id} initialStatus={log.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        {/* Columna Izquierda: Planeación y Tareas */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Planeación del Día</CardTitle>
              <CardDescription>Define tus objetivos y actividades principales.</CardDescription>
            </CardHeader>
            <CardContent>
              <PlanningForm 
                logId={log.id}
                initialPlanned={log.planned_activities}
                initialObjectives={log.objectives}
                initialPriority={log.priority}
                isFinished={log.status === 'Finalizó actividades'}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actualizaciones de Progreso</CardTitle>
              <CardDescription>Registra tus avances durante el día.</CardDescription>
            </CardHeader>
            <CardContent>
              <UpdatesList 
                logId={log.id} 
                initialUpdates={updates as any || []} 
                isFinished={log.status === 'Finalizó actividades'}
              />
            </CardContent>
          </Card>
        </div>

        {/* Columna Derecha: Chat y Evidencias */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Chat / Comentarios</CardTitle>
              <CardDescription>Comunícate con el administrador u otros supervisores.</CardDescription>
            </CardHeader>
            <CardContent>
              <Chat logId={log.id} currentUserId={session.userId} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Evidencias</CardTitle>
              <CardDescription>Fotos y documentos de tu trabajo.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">Subida de archivos (En desarrollo)</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
