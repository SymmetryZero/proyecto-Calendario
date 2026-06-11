'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

type LiveLog = {
  id: string
  status: string
  updated_at: string
  planned_activities: string | null
  employee_id: string
  calendario_profiles?: { full_name: string }
}

export function LiveSupervision({ initialLogs }: { initialLogs: LiveLog[] }) {
  const [logs, setLogs] = useState<LiveLog[]>(initialLogs)
  const supabase = createClient()

  useEffect(() => {
    // Escuchar actualizaciones en la tabla de bitácoras (status updates)
    const channel = supabase
      .channel('public:calendario_work_logs')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'calendario_work_logs' },
        (payload) => {
          // Actualizamos el log correspondiente manteniendo el perfil anidado
          setLogs((prev) => prev.map(log => {
            if (log.id === payload.new.id) {
              return { ...log, ...payload.new } as LiveLog
            }
            return log
          }))
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'calendario_work_logs' },
        () => {
          // Si alguien inicia su día, recargar la página para traer el perfil con el server
          window.location.reload()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Trabajando': return 'bg-green-500'
      case 'En pausa': return 'bg-yellow-500'
      case 'En traslado': return 'bg-blue-500'
      case 'En reunión': return 'bg-purple-500'
      case 'Finalizó actividades': return 'bg-gray-500'
      default: return 'bg-gray-200'
    }
  }

  if (logs.length === 0) {
    return <p className="text-sm text-muted-foreground">Nadie ha iniciado su día laboral hoy.</p>
  }

  return (
    <div className="space-y-6">
      {logs.map(log => (
        <div key={log.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
          <div className="space-y-1">
            <p className="text-sm font-medium leading-none">{log.calendario_profiles?.full_name}</p>
            <p className="text-sm text-muted-foreground truncate max-w-[200px] md:max-w-[300px]">
              {log.planned_activities || 'Sin actividades planeadas registradas'}
            </p>
          </div>
          <div className="ml-auto flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <div className={`flex h-2 w-2 rounded-full ${getStatusColor(log.status)}`} />
              <span className="text-sm font-medium">{log.status}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              hace {formatDistanceToNow(new Date(log.updated_at), { locale: es })}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
