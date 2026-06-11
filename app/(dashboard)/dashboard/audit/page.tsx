import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'

export default async function AuditPage() {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    redirect('/dashboard')
  }

  const supabase = await createClient()

  // Traer los últimos 100 logs de auditoría
  const { data: logs } = await supabase
    .from('calendario_audit_logs')
    .select(`
      *,
      calendario_profiles (full_name, email)
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREADO': return 'bg-green-100 text-green-800'
      case 'ACTUALIZADO': return 'bg-blue-100 text-blue-800'
      case 'ELIMINADO': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Registro de Auditoría</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Últimos Movimientos</CardTitle>
          <CardDescription>Historial de las acciones más recientes realizadas en el sistema.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Módulo</TableHead>
                  <TableHead>Detalles</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs && logs.length > 0 ? (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(log.created_at), "d MMM, HH:mm", { locale: es })}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{log.calendario_profiles?.full_name || 'Sistema'}</div>
                        <div className="text-xs text-muted-foreground">{log.calendario_profiles?.email}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getActionColor(log.action)}>
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell>{log.entity_type}</TableCell>
                      <TableCell className="max-w-[300px] truncate text-xs text-muted-foreground">
                        {JSON.stringify(log.details)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No hay registros de auditoría disponibles.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
