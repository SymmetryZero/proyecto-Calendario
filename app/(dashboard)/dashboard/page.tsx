import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity, Users, CheckCircle2 } from 'lucide-react'
import { LiveSupervision } from '@/components/admin/live-supervision'
import { format } from 'date-fns'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  // Obtener fecha de hoy en formato YYYY-MM-DD
  const todayStr = format(new Date(), 'yyyy-MM-dd')

  // Obtener conteo de empleados
  const { count: employeesCount } = await supabase
    .from('calendario_profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'employee')

  // Obtener logs de hoy
  const { data: todayLogs } = await supabase
    .from('calendario_work_logs')
    .select('id, status, updated_at, planned_activities, employee_id, calendario_profiles(full_name)')
    .eq('date', todayStr)
    .order('updated_at', { ascending: false })

  const activeLogs = todayLogs?.filter(log => log.status !== 'Finalizó actividades') || []
  const finishedLogs = todayLogs?.filter(log => log.status === 'Finalizó actividades') || []
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard General</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Empleados Totales
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employeesCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              Registrados en el sistema
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Actividades en curso
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeLogs.length}</div>
            <p className="text-xs text-muted-foreground">
              Empleados activos hoy
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Actividades Finalizadas
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{finishedLogs.length}</div>
            <p className="text-xs text-muted-foreground">
              Empleados que ya terminaron hoy
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Supervisión en Tiempo Real</CardTitle>
            <CardDescription>
              Estado actual de los empleados hoy.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LiveSupervision initialLogs={todayLogs as any || []} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
