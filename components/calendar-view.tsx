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
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

type WorkLog = {
  id: string
  date: string
  status: string
  employee_id: string
  calendario_profiles?: { full_name: string }
}

export function CalendarView({ initialLogs }: { initialLogs: WorkLog[] }) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month')
  const router = useRouter()

  const handlePrev = () => {
    setCurrentDate(prev => viewMode === 'month' ? subMonths(prev, 1) : subWeeks(prev, 1))
  }
  
  const handleNext = () => {
    setCurrentDate(prev => viewMode === 'month' ? addMonths(prev, 1) : addWeeks(prev, 1))
  }

  const handleDayClick = (day: Date, employeeId?: string) => {
    const formattedDate = format(day, 'yyyy-MM-dd')
    if (employeeId) {
      router.push(`/dashboard/calendar/${formattedDate}?employeeId=${employeeId}`)
    } else {
      router.push(`/dashboard/calendar/${formattedDate}`)
    }
  }

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
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="min-w-[700px] h-full flex flex-col">
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
                if (dayLogs.length === 0) handleDayClick(day)
                else if (dayLogs.length === 1) handleDayClick(day, dayLogs[0].employee_id)
              }}
              className={cn(
                "min-h-[120px] p-2 border-r border-b transition-colors flex flex-col",
                !isCurrentMonth && "bg-muted/20 text-muted-foreground",
                idx % 7 === 6 && "border-r-0",
                dayLogs.length <= 1 ? "cursor-pointer hover:bg-muted/50" : ""
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
                    onClick={(e) => {
                      if (dayLogs.length > 1) {
                        e.stopPropagation()
                        handleDayClick(day, log.employee_id)
                      }
                    }}
                    className={cn(
                      "text-[10px] px-1.5 py-1 rounded text-white font-medium truncate cursor-pointer hover:opacity-80 transition-opacity", 
                      getUserColor(log.employee_id)
                    )}
                    title={`${log.calendario_profiles?.full_name}: ${log.status}`}
                  >
                    {log.calendario_profiles?.full_name ? `${log.calendario_profiles.full_name.split(' ')[0]}: ` : ''}
                    {log.status}
                  </div>
                ))}
                {dayLogs.length === 0 && isCurrentMonth && day <= new Date() && (
                  <div className="text-xs text-muted-foreground italic px-1 cursor-pointer" onClick={() => handleDayClick(day)}>
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
    </div>
  )
}
