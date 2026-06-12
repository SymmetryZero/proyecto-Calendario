'use client'

import { useState } from 'react'
import {
  format,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  startOfWeek,
  endOfWeek,
  isSameDay
} from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

type WorkLog = {
  id: string
  date: string
  title?: string
  status: string
  employee_id: string
  calendario_profiles?: { full_name: string }
}

export function CalendarView({ 
  initialLogs,
  currentUserRole = 'employee',
  currentUserId = ''
}: { 
  initialLogs: WorkLog[],
  currentUserRole?: string,
  currentUserId?: string
}) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month')
  const [selectedDayLogs, setSelectedDayLogs] = useState<{ day: Date, logs: WorkLog[] } | null>(null)
  const router = useRouter()

  const handlePrev = () => {
    setCurrentDate(prev => viewMode === 'month' ? subMonths(prev, 1) : subWeeks(prev, 1))
  }
  
  const handleNext = () => {
    setCurrentDate(prev => viewMode === 'month' ? addMonths(prev, 1) : addWeeks(prev, 1))
  }

  // Ya no usamos handleDayClick directamente, usamos el modal
  // Calcular el rango de días a mostrar según el modo
  let startDate: Date
  let endDate: Date

  if (viewMode === 'month') {
    startDate = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 })
    endDate = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 })
  } else {
    startDate = startOfWeek(currentDate, { weekStartsOn: 1 })
    endDate = endOfWeek(currentDate, { weekStartsOn: 1 })
  }

  const days = eachDayOfInterval({ start: startDate, end: endDate })
  const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

  const getUserColor = (employeeId: string) => {
    const colors = [
      'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500', 
      'bg-orange-500', 'bg-teal-500', 'bg-pink-500', 'bg-indigo-500',
      'bg-rose-500', 'bg-cyan-500'
    ]
    let hash = 0
    for (let i = 0; i < employeeId.length; i++) {
      hash = employeeId.charCodeAt(i) + ((hash << 5) - hash)
    }
    const index = Math.abs(hash) % colors.length
    return colors[index]
  }

  return (
    <div className="flex flex-col h-full bg-background rounded-lg border shadow-sm w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b gap-4">
        <h2 className="text-xl font-semibold capitalize">
          {viewMode === 'month' 
            ? format(currentDate, 'MMMM yyyy', { locale: es })
            : `Semana del ${format(startDate, 'd MMM', { locale: es })}`}
        </h2>
        <div className="flex items-center gap-2">
          <div className="flex bg-muted rounded-md p-1 mr-2">
            <Button 
              variant={viewMode === 'week' ? 'secondary' : 'ghost'} 
              size="sm" 
              onClick={() => setViewMode('week')}
              className="text-xs h-7"
            >
              Semana
            </Button>
            <Button 
              variant={viewMode === 'month' ? 'secondary' : 'ghost'} 
              size="sm" 
              onClick={() => setViewMode('month')}
              className="text-xs h-7"
            >
              Mes
            </Button>
          </div>
          <Button variant="outline" size="icon" onClick={handlePrev} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())} className="h-8">
            Hoy
          </Button>
          <Button variant="outline" size="icon" onClick={handleNext} className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-x-hidden overflow-y-auto">
        <div className="min-w-full h-full flex flex-col">
          <div className="grid grid-cols-7 border-b bg-muted/50">
            {weekDays.map((day) => (
              <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 flex-1 auto-rows-fr">
        {days.map((day, idx) => {
          const formattedDayStr = format(day, 'yyyy-MM-dd')
          const dayLogs = initialLogs.filter((l) => l.date === formattedDayStr)
          const isCurrentMonth = isSameMonth(day, currentDate)

          return (
            <div
              key={day.toISOString()}
              onClick={() => {
                setSelectedDayLogs({ day, logs: dayLogs })
              }}
              className={cn(
                "min-h-[120px] p-2 border-r border-b transition-colors flex flex-col cursor-pointer hover:bg-muted/50",
                !isCurrentMonth && "bg-muted/20 text-muted-foreground",
                idx % 7 === 6 && "border-r-0"
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn(
                  "text-sm font-medium h-7 w-7 flex items-center justify-center rounded-full",
                  isToday(day) && "bg-primary text-primary-foreground"
                )}>
                  {format(day, 'd')}
                </span>
              </div>
              <div className="mt-2 flex-1 flex flex-col gap-1 overflow-y-auto">
                {dayLogs.map(log => (
                  <div 
                    key={log.id} 
                    className={cn(
                      "text-[10px] px-1.5 py-1 rounded text-white font-medium truncate", 
                      getUserColor(log.employee_id)
                    )}
                    title={`${log.title ? log.title + ' - ' : ''}${log.calendario_profiles?.full_name}: ${log.status}`}
                  >
                    {log.title ? <span className="font-bold">{log.title}</span> : ''}
                    {log.title ? ' - ' : ''}
                    {log.calendario_profiles?.full_name ? `${log.calendario_profiles.full_name.split(' ')[0]} - ` : ''}
                    {log.status}
                  </div>
                ))}
                {dayLogs.length === 0 && isCurrentMonth && day <= new Date() && (
                  <div className="text-xs text-muted-foreground italic px-1">
                    Sin registro
                  </div>
                )}
              </div>
            </div>
          )
        })}
          </div>
        </div>
      </div>

      <Dialog open={!!selectedDayLogs} onOpenChange={(open) => !open && setSelectedDayLogs(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Actividades del {selectedDayLogs ? format(selectedDayLogs.day, "d 'de' MMMM", { locale: es }) : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-4 max-h-[60vh] overflow-y-auto pr-2">
            {selectedDayLogs?.logs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nadie ha registrado actividades este día.</p>
            ) : (
              selectedDayLogs?.logs.map(log => (
                <div key={log.id} className="flex items-center justify-between p-3 rounded-lg border bg-card shadow-sm">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={cn("w-3 h-3 rounded-full flex-shrink-0", getUserColor(log.employee_id))} />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{log.title || 'Sin Título'}</p>
                      <p className="text-xs text-muted-foreground truncate">{log.calendario_profiles?.full_name} • {log.status}</p>
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => router.push(`/dashboard/calendar/${format(selectedDayLogs.day, 'yyyy-MM-dd')}?logId=${log.id}`)}>
                    Ver
                  </Button>
                </div>
              ))
            )}
            
            {(() => {
              if (!selectedDayLogs || !currentUserId) return null
              const formattedDayStr = format(selectedDayLogs.day, 'yyyy-MM-dd')
              const isPastDate = formattedDayStr < new Date().toLocaleDateString('en-CA')
              
              // Empleados no pueden crear en el pasado. Admins sí.
              if (currentUserRole === 'employee' && isPastDate) return null
              
              return (
                <div className="mt-4 pt-4 border-t flex justify-end">
                  <Button onClick={() => router.push(`/dashboard/calendar/${formattedDayStr}`)}>
                    Añadir registro
                  </Button>
                </div>
              )
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
