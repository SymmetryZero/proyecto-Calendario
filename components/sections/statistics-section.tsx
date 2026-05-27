"use client"

import { useMemo } from "react"
import { MaterialIcon } from "@/components/ui/material-icon"
import { useWorkflowStore, workflowSelectors } from "@/store/workflow-store"
import { cn, formatDuration } from "@/utils/workflow"
import { normalizeUserRole } from "@/utils/roles"

export function StatisticsSection() {
  const tasks = useWorkflowStore((state) => state.tasks)
  const users = useWorkflowStore((state) => state.users)
  const technicians = useMemo(() => users.filter((u) => {
    const role = normalizeUserRole(u.role)
    return role === "empleado" || role === "gerente"
  }), [users])

  const stats = useMemo(() => {
    // Tasks by status
    const statusCounts = {
      todo: tasks.filter(t => t.status === "todo").length,
      inProgress: tasks.filter(t => t.status === "inProgress").length,
      review: tasks.filter(t => t.status === "review").length,
      done: tasks.filter(t => t.status === "done").length
    }

    // Tasks by priority
    const priorityCounts = {
      high: tasks.filter(t => t.priority === "high").length,
      medium: tasks.filter(t => t.priority === "medium").length,
      low: tasks.filter(t => t.priority === "low").length
    }

    // Tasks by location (Zone)
    const zoneMap: Record<string, number> = {}
    tasks.forEach(t => {
      const zone = t.location || "Sin zona"
      zoneMap[zone] = (zoneMap[zone] || 0) + 1
    })
    const zoneStats = Object.entries(zoneMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    // Advanced Metrics
    let totalActualSeconds = 0
    let totalEstimatedSeconds = 0
    let completedCount = 0

    tasks.forEach(t => {
      const actual = workflowSelectors.getTaskTotalDuration(t)
      totalActualSeconds += actual
      totalEstimatedSeconds += (t.estimatedHours || 0) * 3600
      if (t.status === "done") completedCount++
    })

    const efficiencyIndex = totalEstimatedSeconds > 0 ? totalEstimatedSeconds / totalActualSeconds : 1
    const leadTimeAvg = completedCount > 0 ? totalActualSeconds / completedCount : 0

    // Performance per technician
    const techPerformance = technicians.map(tech => {
      const techTasks = tasks.filter(t => t.assigneeIds?.includes(tech.id))
      const actualSecs = techTasks.reduce((acc, t) => acc + workflowSelectors.getTaskTotalDuration(t), 0)
      const estimatedSecs = techTasks.reduce((acc, t) => acc + (t.estimatedHours || 0) * 3600, 0)
      
      return {
        id: tech.id,
        name: tech.name,
        role: tech.position,
        avatar: tech.avatar,
        taskCount: techTasks.length,
        completedCount: techTasks.filter(t => t.status === "done").length,
        actualSecs,
        efficiency: estimatedSecs > 0 ? (estimatedSecs / actualSecs) * 100 : 100
      }
    }).sort((a, b) => b.actualSecs - a.actualSecs)

    return {
      statusCounts,
      priorityCounts,
      zoneStats,
      techPerformance,
      totalTime: totalActualSeconds,
      avgTime: tasks.length > 0 ? totalActualSeconds / tasks.length : 0,
      efficiencyIndex,
      leadTimeAvg,
      priorityRatio: (priorityCounts.high / (tasks.length || 1)) * 100
    }
  }, [tasks, technicians])

  return (
    <main className="flex-1 p-gutter overflow-y-auto scrollbar-thin bg-surface-container-lowest">
      <div className="flex flex-col gap-8 max-w-7xl mx-auto">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="font-display-lg text-display-lg text-primary">Inteligencia Operativa</h2>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              Métricas avanzadas de eficiencia, tiempos de ciclo y performance del equipo.
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-primary/5 rounded-full border border-primary/20">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-[12px] font-bold text-primary uppercase">Datos en vivo</span>
          </div>
        </header>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            label="Tiempo de Ciclo Promedio"
            value={formatDuration(stats.leadTimeAvg)}
            icon="update"
            trend="Velocidad de entrega"
            color="bg-primary-container text-on-primary-container"
          />
          <StatCard
            label="Índice de Eficiencia"
            value={`${stats.efficiencyIndex.toFixed(2)}x`}
            icon="trending_up"
            trend={stats.efficiencyIndex >= 1 ? "Por encima del estimado" : "Bajo el estimado"}
            color="bg-secondary-container text-on-secondary-container"
          />
          <StatCard
            label="Tareas de Alto Impacto"
            value={stats.priorityCounts.high.toString()}
            icon="priority_high"
            trend={`${Math.round(stats.priorityRatio)}% del backlog total`}
            color="bg-error-container text-on-error-container"
          />
          <StatCard
            label="Productividad Global"
            value={`${Math.round((stats.statusCounts.done / (tasks.length || 1)) * 100)}%`}
            icon="bolt"
            trend="Proyectos finalizados"
            color="bg-tertiary-container text-on-tertiary-container"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Chart: Status distribution */}
          <section className="lg:col-span-2 bg-surface p-6 rounded-3xl border border-outline-variant shadow-sm flex flex-col">
            <h3 className="font-title-lg text-title-lg text-primary mb-6">Estado del Flujo (Pipeline)</h3>
            <div className="flex-1 flex items-end justify-between min-h-[260px] gap-2 md:gap-4 px-2 md:px-6 pb-4 bg-surface-container-low/30 rounded-2xl border border-outline-variant/50">
              <Bar label="Por hacer" value={stats.statusCounts.todo} total={tasks.length} color="bg-surface-variant" />
              <Bar label="En progreso" value={stats.statusCounts.inProgress} total={tasks.length} color="bg-secondary" />
              <Bar label="Revisión" value={stats.statusCounts.review} total={tasks.length} color="bg-tertiary" />
              <Bar label="Hecho" value={stats.statusCounts.done} total={tasks.length} color="bg-primary" />
            </div>
            <div className="pt-4 border-t border-outline-variant mt-4 grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <span className="text-[12px] text-on-surface-variant font-medium">Tareas cerradas con éxito</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-tertiary" />
                <span className="text-[12px] text-on-surface-variant font-medium">Tareas en ejecución activa</span>
              </div>
            </div>
          </section>

          {/* Chart: Priority Heatmap */}
          <section className="bg-surface p-6 rounded-3xl border border-outline-variant shadow-sm">
            <h3 className="font-title-lg text-title-lg text-primary mb-6">Foco de Atención</h3>
            <div className="space-y-6">
              <PriorityRow label="Alta Prioridad" count={stats.priorityCounts.high} total={tasks.length} color="bg-error" />
              <PriorityRow label="Prioridad Media" count={stats.priorityCounts.medium} total={tasks.length} color="bg-warning" />
              <PriorityRow label="Baja Prioridad" count={stats.priorityCounts.low} total={tasks.length} color="bg-info" />
              
              <div className="mt-8 p-4 bg-surface-container-low rounded-2xl border border-outline-variant">
                <div className="flex items-center gap-3 text-on-surface-variant">
                  <MaterialIcon name="lightbulb" className="text-secondary" />
                  <p className="text-[12px] leading-relaxed italic">
                    Tip: Si el tiempo en "Media" supera al de "Alta", podrías tener un problema de priorización.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* User Performance Table */}
        <section className="bg-surface rounded-3xl border border-outline-variant overflow-hidden shadow-sm">
          <div className="p-6 border-b border-outline-variant flex items-center justify-between">
            <div>
              <h3 className="font-title-lg text-title-lg text-primary">Ranking de Eficiencia</h3>
              <p className="text-[12px] text-on-surface-variant mt-1">Comparativa entre tiempo estimado vs tiempo real invertido.</p>
            </div>
            <MaterialIcon name="military_tech" className="text-secondary text-[32px]" filled />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-container-low text-on-surface-variant font-label-md uppercase tracking-wider">
                <tr>
                  <th className="p-4 pl-6">Técnico</th>
                  <th className="p-4">Carga de Trabajo</th>
                  <th className="p-4">Tiempo Real</th>
                  <th className="p-4">Eficiencia</th>
                  <th className="p-4 pr-6">Puntuación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {stats.techPerformance.map((perf) => (
                  <tr key={perf.id} className="hover:bg-surface-container-lowest transition-colors group">
                    <td className="p-4 pl-6">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <img src={perf.avatar} className="w-10 h-10 rounded-full border border-outline-variant" alt="" />
                          <div className={cn(
                            "absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-surface",
                            perf.efficiency >= 100 ? "bg-success" : "bg-warning"
                          )} />
                        </div>
                        <div>
                          <p className="font-title-sm text-title-sm text-on-surface">{perf.name}</p>
                          <p className="text-[11px] text-on-surface-variant uppercase font-bold">{perf.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="font-data-mono text-sm">{perf.taskCount} tareas</span>
                        <span className="text-[10px] text-on-surface-variant">{perf.completedCount} completadas</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-1 bg-surface-container-high text-on-surface rounded-md font-data-mono text-sm border border-outline-variant">
                        {formatDuration(perf.actualSecs)}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[10px] font-bold">
                          <span>{Math.round(perf.efficiency)}%</span>
                          <span className={perf.efficiency >= 100 ? "text-success" : "text-error"}>
                            {perf.efficiency >= 100 ? "Óptimo" : "Lento"}
                          </span>
                        </div>
                        <div className="w-24 h-1.5 bg-surface-container rounded-full overflow-hidden">
                          <div 
                            className={cn("h-full transition-all duration-1000", perf.efficiency >= 100 ? "bg-success" : "bg-warning")} 
                            style={{ width: `${Math.min(perf.efficiency, 100)}%` }} 
                          />
                        </div>
                      </div>
                    </td>
                    <td className="p-4 pr-6">
                      <div className="flex items-center gap-1.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <MaterialIcon 
                            key={s} 
                            name="star" 
                            className={cn(
                              "text-[16px]", 
                              s <= Math.ceil(perf.efficiency / 20) ? "text-secondary" : "text-outline-variant"
                            )} 
                            filled={s <= Math.ceil(perf.efficiency / 20)}
                          />
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  )
}

function StatCard({ label, value, icon, trend, color }: { label: string; value: string; icon: string; trend: string; color: string }) {
  return (
    <div className={cn("p-6 rounded-3xl border border-outline-variant flex flex-col gap-4 shadow-sm bg-surface")}>
      <div className="flex items-start justify-between">
        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", color)}>
          <MaterialIcon name={icon} filled />
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{label}</span>
          <span className="text-headline-md font-headline-md text-on-surface">{value}</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-[12px] text-on-surface-variant border-t border-outline-variant pt-4">
        <MaterialIcon name="auto_graph" className="text-[16px] text-primary" />
        {trend}
      </div>
    </div>
  )
}

function PriorityRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const percent = total > 0 ? (count / total) * 100 : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[12px] font-bold">
        <span className="text-on-surface-variant uppercase tracking-wider">{label}</span>
        <span className="text-on-surface">{count}</span>
      </div>
      <div className="h-3 w-full bg-surface-container rounded-full overflow-hidden shadow-inner">
        <div 
          className={cn("h-full transition-all duration-1000 shadow-sm", color)} 
          style={{ width: `${percent}%` }} 
        />
      </div>
    </div>
  )
}

function Bar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const height = (value / Math.max(total, 1)) * 100
  return (
    <div className="flex flex-col items-center gap-2 flex-1 group">
      <div className="relative w-full flex-1 flex flex-col justify-end">
        <div 
          className={cn("w-[60px] md:w-[80px] rounded-t-2xl transition-all duration-1000 group-hover:brightness-110 shadow-lg border-x border-t border-white/10", color)}
          style={{ height: `${Math.max(height, 5)}%` }}
        >
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-surface-container-high text-on-surface px-3 py-1.5 rounded-xl text-[11px] font-bold opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap shadow-xl border border-outline-variant">
            {value} {value === 1 ? "tarea" : "tareas"}
          </div>
        </div>
      </div>
      <span className="text-[11px] font-bold text-on-surface-variant uppercase text-center">{label}</span>
    </div>
  )
}
