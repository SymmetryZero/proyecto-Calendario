"use client"

import { useEffect, useMemo, useState } from "react"
import { Avatar } from "@/components/ui/avatar"
import { MaterialIcon } from "@/components/ui/material-icon"
import { EscalateTaskModal } from "@/components/modals/escalate-task-modal"
import {
  formatDuration,
  cn
} from "@/utils/workflow"
import { normalizeUserRole } from "@/utils/roles"
import {
  type EvidenceFile,
  type Priority,
  type Task,
  type TaskStatus,
  type User,
  useWorkflowStore,
  workflowSelectors
} from "@/store/workflow-store"

type Technician = User

type DashboardSectionProps = {
  onCreateTask: () => void
  onOpenTaskDetails: (taskId: string) => void
  searchQuery?: string
  zoneFilter?: string
  areaFilter?: string
}

const statusOrder: TaskStatus[] = ["todo", "inProgress", "review", "done"]

const statusMeta: Record<
  TaskStatus,
  { label: string; accent: string; columnClass: string; countClass: string; icon: string }
> = {
  todo: {
    label: "Por hacer",
    accent: "bg-error-container text-on-error-container",
    columnClass: "bg-transparent",
    countClass: "bg-surface-variant text-on-surface-variant",
    icon: "schedule"
  },
  inProgress: {
    label: "En progreso",
    accent: "bg-secondary-container text-on-secondary-container",
    columnClass: "bg-transparent",
    countClass: "bg-surface-variant text-on-surface-variant",
    icon: "pending"
  },
  review: {
    label: "En revisión",
    accent: "bg-tertiary-fixed text-tertiary-container",
    columnClass: "bg-transparent",
    countClass: "bg-surface-variant text-on-surface-variant",
    icon: "done_all"
  },
  done: {
    label: "Hecho",
    accent: "bg-surface-variant text-on-surface-variant",
    columnClass: "bg-transparent",
    countClass: "bg-surface-variant text-on-surface-variant",
    icon: "check_circle"
  }
}

const priorityMeta: Record<Priority, { label: string; className: string }> = {
  high: {
    label: "Alta",
    className: "bg-error-container text-on-error-container"
  },
  medium: {
    label: "Media",
    className: "bg-secondary-fixed text-on-secondary-fixed-variant"
  },
  low: {
    label: "Baja",
    className: "bg-surface-variant text-on-surface-variant"
  }
}

const prioritySignal: Record<Priority, { label: string; className: string }> = {
  high: { label: "Rojo", className: "bg-error" },
  medium: { label: "Amarillo", className: "bg-warning" },
  low: { label: "Verde", className: "bg-success" }
}

function useTicker(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now())
    }, intervalMs)

    return () => window.clearInterval(timer)
  }, [intervalMs])

  return now
}

function avatarByTechnicianIds(users: User[], assigneeIds: string[]) {
  return assigneeIds
    .map((id) => users.find((u) => u.id === id))
    .filter(Boolean) as User[]
}

function getSortedTasks(tasks: Task[], mode: "manual" | "recent") {
  if (mode === "recent") {
    return [...tasks].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  }

  return tasks
}

export function DashboardSection({
  onCreateTask,
  onOpenTaskDetails,
  searchQuery = "",
  zoneFilter,
  areaFilter
}: DashboardSectionProps) {
  const now = useTicker()
  const tasks = useWorkflowStore((state) => state.tasks)
  const users = useWorkflowStore((state) => state.users)
  const currentUserId = useWorkflowStore((state) => state.currentUserId)
  const evidence = useWorkflowStore((state) => state.evidence)
  const moveTask = useWorkflowStore((state) => state.moveTask)
  const deleteTask = useWorkflowStore((state) => state.deleteTask)
  const claimTask = useWorkflowStore((state) => state.claimTask)
  const pauseTaskTimer = useWorkflowStore((state) => state.pauseTaskTimer)
  const startTaskTimer = useWorkflowStore((state) => state.startTaskTimer)
  const setGlobalAlert = useWorkflowStore((state) => state.setGlobalAlert)
  
  const currentUser = useMemo(() => 
    workflowSelectors.getCurrentUser(users, currentUserId), 
  [users, currentUserId])
  const currentRole = normalizeUserRole(currentUser?.role)

  const zoneTasks = useMemo(() => 
    workflowSelectors.filterTasksByZone(tasks, currentUser, users),
  [tasks, currentUser, users])

  const scopedTasks = useMemo(() => {
    if (currentRole === "empleado") {
      return zoneTasks
    }

    const normalizedZone = zoneFilter && zoneFilter !== "todas" ? zoneFilter : null
    const normalizedArea = areaFilter && areaFilter !== "todas" ? areaFilter : null
    return zoneTasks.filter((task) => {
      if (currentUser?.id && task.creatorId === currentUser.id) return true
      if (normalizedZone && task.location !== normalizedZone) return false
      if (normalizedArea && task.area !== normalizedArea) return false
      return true
    })
  }, [zoneTasks, zoneFilter, areaFilter, currentRole, currentUser?.id])
  
  const [pendingAction, setPendingAction] = useState<{
    type: "move" | "delete"
    task: Task
    nextStatus?: TaskStatus
  } | null>(null)

  const [escalateTaskId, setEscalateTaskId] = useState<string | null>(null)

  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [filterMode, setFilterMode] = useState<"all" | "high">("all")
  const [sortMode, setSortMode] = useState<"manual" | "recent">("manual")

  const visibleTasks = useMemo(() => {
    const byStatus = new Map<TaskStatus, Task[]>()
    statusOrder.forEach((status) => byStatus.set(status, []))

    const query = searchQuery.trim().toLowerCase()

    scopedTasks
      .filter((task) => (filterMode === "high" ? task.priority === "high" : true))
      .filter((task) => {
        if (!query) {
          return true
        }

        const assigneeText = avatarByTechnicianIds(users, task.assigneeIds)
          .map((user) => `${user.name} ${user.role} ${user.code}`)
          .join(" ")

        return [task.title, task.description, task.location ?? "", assigneeText]
          .join(" ")
          .toLowerCase()
          .includes(query)
      })
      .forEach((task) => {
        byStatus.get(task.status)?.push(task)
      })

    return byStatus
  }, [searchQuery, scopedTasks, users, filterMode])

  function handleMove(task: Task, nextStatus: TaskStatus) {
    const hasFullControl = workflowSelectors.canManageTask(task, currentUser)

    // Role-based restrictions for employees without ownership over the task
    if (currentRole === "empleado" && !hasFullControl) {
      if (task.status === "done") {
        setGlobalAlert({
          title: "Acción no disponible",
          message: "Esta tarea ya está finalizada y no admite cambios.",
          type: "error"
        })
        return
      }
      const statusOrder: TaskStatus[] = ["todo", "inProgress", "review", "done"]
      const currentIndex = statusOrder.indexOf(task.status)
      const nextIndex = statusOrder.indexOf(nextStatus)
      if (nextIndex < currentIndex) {
        setGlobalAlert({
          title: "Movimiento no permitido",
          message: "Este cambio no está permitido en esta etapa.",
          type: "warning"
        })
        return
      }
    }

    if (nextStatus === "inProgress" && task.timerStartedAt === null) {
      startTaskTimer(task.id)
      if (task.status !== "inProgress") {
        moveTask(task.id, "inProgress")
      }
      return
    }

    if (task.status === "inProgress" && nextStatus !== "inProgress") {
      pauseTaskTimer(task.id)
    }

    moveTask(task.id, nextStatus)
  }

  function handleDrop(status: TaskStatus) {
    if (!draggedTaskId) {
      return
    }

    const task = tasks.find((item) => item.id === draggedTaskId)
    if (task && task.status !== status) {
      // Restriction: done status can only be set/changed via buttons, not drag-and-drop
      if (status === "done" || task.status === "done") {
        setGlobalAlert({
          title: "Movimiento no permitido",
          message: "Para mover desde o hacia 'Hecho', usa los botones de acción.",
          type: "info"
        })
        setDraggedTaskId(null)
        return
      }

      const nextStatus = status
      
      // Permission check for dragging
      const hasFullControl = workflowSelectors.canManageTask(task, currentUser)
      if (currentRole === "empleado" && !hasFullControl) {
        const statusOrder: TaskStatus[] = ["todo", "inProgress", "review", "done"]
        const currentIndex = statusOrder.indexOf(task.status)
        const nextIndex = statusOrder.indexOf(nextStatus)
        
        if (nextIndex < currentIndex) {
          setGlobalAlert({
            title: "Movimiento no permitido",
            message: "Este movimiento no está permitido.",
            type: "warning"
          })
          setDraggedTaskId(null)
          return
        }
      }

      setPendingAction({ type: "move", task, nextStatus })
    }

    setDraggedTaskId(null)
  }

  const confirmAction = () => {
    if (!pendingAction) return
    
    if (pendingAction.type === "move" && pendingAction.nextStatus) {
      handleMove(pendingAction.task, pendingAction.nextStatus)
    } else if (pendingAction.type === "delete") {
      deleteTask(pendingAction.task.id)
    }
    
    setPendingAction(null)
  }

  const [activeTab, setActiveTab] = useState<TaskStatus>("todo")

  return (
    <main className="flex-1 min-h-0 p-4 md:p-gutter overflow-hidden flex flex-col gap-4 md:gap-6 bg-[#f0f2f5]">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h2 className="font-display-lg text-headline-md md:text-display-lg text-primary leading-tight">Flujos de trabajo activos</h2>
          <p className="font-body-md text-xs md:text-body-md text-on-surface-variant mt-1">
            Gestiona y da seguimiento a las tareas operativas del Sitio Alfa.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFilterMode((current) => (current === "all" ? "high" : "all"))}
            className={cn(
              "flex-1 md:flex-none px-4 h-10 flex items-center justify-center gap-2 border rounded-xl font-label-caps text-[11px] transition-all duration-200",
              filterMode === "high"
                ? "bg-tertiary-fixed text-tertiary-container border-tertiary-container shadow-sm"
                : "bg-surface-container-low border-outline-variant text-on-surface hover:bg-surface-container"
            )}
          >
            <MaterialIcon name="filter_list" className="text-[18px]" />
            <span className="truncate">{filterMode === "high" ? "Prioridad alta" : "Filtrar"}</span>
          </button>
          <button
            type="button"
            onClick={() => setSortMode((current) => (current === "manual" ? "recent" : "manual"))}
            className={cn(
              "flex-1 md:flex-none px-4 h-10 flex items-center justify-center gap-2 border rounded-xl font-label-caps text-[11px] transition-all duration-200",
              sortMode === "recent"
                ? "bg-tertiary-fixed text-tertiary-container border-tertiary-container shadow-sm"
                : "bg-surface-container-low border-outline-variant text-on-surface hover:bg-surface-container"
            )}
          >
            <MaterialIcon name="sort" className="text-[18px]" />
            <span className="truncate">{sortMode === "recent" ? "Recientes" : "Ordenar"}</span>
          </button>
          <button
            type="button"
            onClick={onCreateTask}
            className="flex-1 md:flex-none px-4 h-10 flex items-center justify-center gap-2 bg-secondary text-on-secondary rounded-xl font-title-sm text-sm hover:opacity-90 transition-all shadow-md active:scale-95"
          >
            <MaterialIcon name="add" />
            <span className="truncate">Nueva tarea</span>
          </button>
        </div>
      </div>

      {/* Mobile Status Tabs */}
      <div className="md:hidden flex bg-surface-container-low p-1 rounded-2xl border border-outline-variant/30 overflow-x-auto scrollbar-none gap-1">
        {statusOrder.map((status) => {
           const meta = statusMeta[status]
           const isActive = activeTab === status
           const taskCount = visibleTasks.get(status)?.length || 0
           return (
             <button
               key={status}
               onClick={() => setActiveTab(status)}
               className={cn(
                 "flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl transition-all duration-300 min-w-max",
                 isActive ? "bg-white text-primary shadow-sm ring-1 ring-black/5" : "text-on-surface-variant hover:bg-white/50"
               )}
             >
                <MaterialIcon name={meta.icon} className={cn("text-[18px]", isActive ? "text-secondary" : "opacity-60")} filled={isActive} />
                <span className="text-[11px] font-bold uppercase tracking-wider">{meta.label}</span>
                <span className="text-[10px] bg-surface-variant px-1.5 py-0.5 rounded-full opacity-60">{taskCount}</span>
             </button>
           )
        })}
      </div>

      <div className="flex-1 min-h-0 overflow-x-auto md:overflow-visible pb-4">
        <div className={cn(
          "flex gap-4 md:gap-gutter h-full transition-all duration-500",
          "w-full md:w-max", // On mobile it's full width, on desktop it scrolls
        )}>
          {statusOrder.map((status) => {
            const tasksForColumn = getSortedTasks(visibleTasks.get(status) ?? [], sortMode)
            const isVisible = activeTab === status

            return (
              <div key={status} className={cn(
                "w-full md:w-80 flex-shrink-0 flex flex-col h-full",
                !isVisible ? "hidden md:flex" : "flex"
              )}>
                <KanbanColumn
                  status={status}
                  tasks={tasksForColumn}
                  users={users}
                  evidence={evidence}
                  draggedTaskId={draggedTaskId}
                  onDragTask={setDraggedTaskId}
                  onDropTask={handleDrop}
                  onMoveTask={(task, nextStatus) => setPendingAction({ type: "move", task, nextStatus })}
                  onDeleteTask={(taskId) => {
                    const task = tasks.find(t => t.id === taskId)
                    if (task) setPendingAction({ type: "delete", task })
                  }}
                  onOpenTaskDetails={onOpenTaskDetails}
                  onEscalateTask={(taskId) => setEscalateTaskId(taskId)}
                  onClaimTask={(taskId) => claimTask(taskId)}
                  now={now}
                  currentUser={currentUser}
                />
              </div>
            )
          })}
        </div>
      </div>

      <EscalateTaskModal
        open={escalateTaskId !== null}
        taskId={escalateTaskId}
        onClose={() => setEscalateTaskId(null)}
      />

      {/* Confirmation Modal */}
      {pendingAction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-primary/60 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden border border-outline-variant animate-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-outline-variant bg-surface-container-low flex items-center gap-3">
                 <div className={cn(
                   "w-10 h-10 rounded-full flex items-center justify-center",
                   pendingAction.type === "delete" ? "bg-error-container text-error" : "bg-secondary-container text-on-secondary-container"
                 )}>
                    <MaterialIcon name={pendingAction.type === "delete" ? "delete_forever" : "swap_horiz"} />
                 </div>
                 <h3 className="font-bold text-primary">Confirmar Acción</h3>
              </div>
              
              <div className="p-6">
                 <p className="text-sm text-on-surface-variant leading-relaxed">
                   {pendingAction.type === "delete" ? (
                     <>¿Está seguro de que desea eliminar la tarea <span className="font-bold text-primary">"{pendingAction.task.title}"</span>? Esta acción no se puede deshacer.</>
                   ) : (
                     <>¿Desea cambiar el estado de la tarea a <span className="font-bold text-primary">"{statusMeta[pendingAction.nextStatus!].label}"</span>?</>
                   )}
                 </p>
              </div>

              <div className="p-4 bg-surface-container flex flex-col sm:flex-row-reverse gap-2 border-t border-outline-variant">
                 <button 
                   onClick={confirmAction}
                   className={cn(
                     "flex-1 h-11 text-white font-bold rounded-xl shadow-md transition-all active:scale-95",
                     pendingAction.type === "delete" ? "bg-error" : "bg-primary"
                   )}
                 >
                   Confirmar
                 </button>
                 <button 
                   onClick={() => setPendingAction(null)}
                   className="flex-1 h-11 bg-white border border-outline text-on-surface-variant font-bold rounded-xl hover:bg-surface-container-high transition-colors"
                 >
                   Cancelar
                 </button>
              </div>
           </div>
        </div>
      )}
    </main>
  )
}

type KanbanColumnProps = {
  status: TaskStatus
  tasks: Task[]
  users: User[]
  evidence: EvidenceFile[]
  draggedTaskId: string | null
  onDragTask: (taskId: string | null) => void
  onDropTask: (status: TaskStatus) => void
  onMoveTask: (task: Task, nextStatus: TaskStatus) => void
  onDeleteTask: (taskId: string) => void
  onOpenTaskDetails: (taskId: string) => void
  onEscalateTask: (taskId: string) => void
  onClaimTask: (taskId: string) => void
  now: number
  currentUser: Technician | null
}

function KanbanColumn({
  status,
  tasks,
  users,
  evidence,
  draggedTaskId,
  onDragTask,
  onDropTask,
  onMoveTask,
  onDeleteTask,
  onOpenTaskDetails,
  onEscalateTask,
  onClaimTask,
  now,
  currentUser
}: KanbanColumnProps) {
  const meta = statusMeta[status]

  return (
    <section
      className={cn(
        "w-full flex-shrink-0 flex flex-col rounded-lg p-4 h-full min-h-0",
        meta.columnClass,
        draggedTaskId ? "ring-2 ring-secondary-container/40" : ""
      )}
      onDragOver={(event) => event.preventDefault()}
      onDrop={() => onDropTask(status)}
      onDragEnter={(event) => event.currentTarget.classList.add("ring-2", "ring-secondary-container/40")}
      onDragLeave={(event) => event.currentTarget.classList.remove("ring-2", "ring-secondary-container/40")}
    >
      <div className="flex justify-between items-center mb-4 px-1">
        <div className="flex items-center gap-2">
          {status !== "todo" && status !== "done" ? (
            <span className={cn("w-2 h-2 rounded-full", status === "inProgress" ? "bg-secondary-container" : "bg-tertiary-container")} />
          ) : null}
          <h3 className="font-title-sm text-title-sm text-primary">{meta.label}</h3>
        </div>
        <span className={cn("font-data-mono text-[12px] px-2 py-0.5 rounded-full", meta.countClass)}>
          {tasks.length}
        </span>
      </div>

      <div className="flex-1 min-h-0 flex flex-col gap-stack-md overflow-y-auto pr-2 pb-2 scrollbar-thin">
        {tasks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-outline-variant bg-surface-container-lowest p-4 text-sm text-on-surface-variant">
            No hay tareas en esta columna.
          </div>
        ) : null}

        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            users={users}
            evidence={evidence}
            isDragging={draggedTaskId === task.id}
            onDragStart={() => onDragTask(task.id)}
            onDragEnd={() => onDragTask(null)}
            onMoveTask={onMoveTask}
            onDeleteTask={onDeleteTask}
            onOpenTaskDetails={onOpenTaskDetails}
            onEscalateTask={onEscalateTask}
            onClaimTask={onClaimTask}
            now={now}
            currentUser={currentUser}
          />
        ))}
      </div>
    </section>
  )
}

type TaskCardProps = {
  task: Task
  users: User[]
  evidence: EvidenceFile[]
  isDragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onMoveTask: (task: Task, nextStatus: TaskStatus) => void
  onDeleteTask: (taskId: string) => void
  onOpenTaskDetails: (taskId: string) => void
  onEscalateTask: (taskId: string) => void
  onClaimTask: (taskId: string) => void
  now: number
  currentUser: Technician | null
}

function TaskCard({
  task,
  users,
  evidence,
  isDragging,
  onDragStart,
  onDragEnd,
  onMoveTask,
  onDeleteTask,
  onOpenTaskDetails,
  onEscalateTask,
  onClaimTask,
  now,
  currentUser
}: TaskCardProps) {
  const assignees = avatarByTechnicianIds(users, task.assigneeIds)
  const currentRole = normalizeUserRole(currentUser?.role)
  const canDelete = currentRole === "administrador" || currentRole === "gerente"
  const attachedEvidence = evidence.filter((item) => item.linkedTaskId === task.id)
  const duration = workflowSelectors.getTaskTotalDuration(task, now)
  const canManageTask = workflowSelectors.canManageTask(task, currentUser)
  const canEscalate = canManageTask
  const canClaimTask = workflowSelectors.canClaimTask(task, currentUser, users)
  const claimState = workflowSelectors.getTaskClaimState(task, currentUser, users)
  const isCreatedByCurrentUser = !!currentUser?.id && task.creatorId === currentUser.id
  
  const statusLabel =
    task.status === "todo"
      ? "Iniciar"
      : task.status === "inProgress"
        ? "Revisar"
        : task.status === "review"
          ? "Completar"
          : "Reabrir"

  const nextStatus: TaskStatus =
    task.status === "todo"
      ? "inProgress"
      : task.status === "inProgress"
        ? "review"
        : task.status === "review"
          ? "done"
          : "todo"

  // Dynamic progress percentage
  const progressPercentage =
    task.status === "done" ? 100 :
    task.status === "review" ? 80 :
    task.status === "inProgress" ? 40 : 0;

  const durationLabel = formatDuration(duration)

  // Dynamic due status label in Spanish
  let dynamicDueLabel = "Por iniciar";
  if (task.status === "done") {
    dynamicDueLabel = "Completada";
  } else if (task.status === "review") {
    dynamicDueLabel = "En revisión";
  } else if (task.dueLabel) {
    dynamicDueLabel = task.dueLabel;
  } else if (task.status === "inProgress") {
    dynamicDueLabel = "En progreso";
  }

  const notesCount = task.activities?.filter(a => a.type === "note").length || 0;
  const logsCount = task.activities?.filter(a => a.type === "log").length || 0;

  // Unify and de-duplicate attachments by filename to prevent double counting
  const attachmentNames = new Set<string>()
  task.activities?.forEach((a) => {
    if (a.type === "image" || a.type === "video" || a.type === "audio" || a.type === "drawing") {
      const name = a.metadata?.fileName || `${a.type.toUpperCase()}_${a.id.slice(-4)}`
      attachmentNames.add(name.toLowerCase().trim())
    }
  })
  attachedEvidence.forEach((item) => {
    const name = item.name
    attachmentNames.add(name.toLowerCase().trim())
  })
  const totalAttachments = attachmentNames.size;

  return (
    <article
      draggable={task.status !== "done"}
      onDragStart={(e) => {
        if (task.status === "done") {
          e.preventDefault()
          return
        }
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      onClick={() => onOpenTaskDetails(task.id)}
      className={cn(
        "bg-white rounded-xl border p-4 flex flex-col gap-3 shadow-sm relative group hover:ring-1 hover:ring-secondary-container transition-all cursor-pointer",
        task.status === "done" ? "opacity-90 grayscale-[0.2]" : "opacity-100",
        task.status === "inProgress"
          ? "border-tertiary-container ring-1 ring-tertiary-container/20"
          : "border-outline-variant/50",
        task.priority === "high"
          ? "border-l-4 border-l-error"
          : task.priority === "medium"
            ? "border-l-4 border-l-warning"
            : "border-l-4 border-l-success",
        isDragging ? "opacity-50 scale-[0.98]" : ""
      )}
    >
      <div className="flex justify-between items-start gap-2 w-full min-w-0">
        <span className="text-[10px] font-semibold text-on-surface-variant opacity-60 uppercase tracking-wider">
          {dynamicDueLabel}
        </span>
        
        <div className="flex items-center gap-1.5 flex-shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onOpenTaskDetails(task.id)
            }}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-secondary/70 hover:text-secondary hover:bg-secondary/10 transition-all flex-shrink-0"
            aria-label="Agregar evidencia"
            title="Agregar evidencia"
          >
            <MaterialIcon name="attach_file" className="text-[16px]" />
          </button>
          {canEscalate ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onEscalateTask(task.id)
              }}
              className="flex items-center justify-center w-7 h-7 rounded-lg text-tertiary/70 hover:text-tertiary hover:bg-tertiary-fixed transition-all flex-shrink-0"
              aria-label="Enviar a otra area"
              title="Enviar a otra area"
            >
              <MaterialIcon name="forward_to_inbox" className="text-[16px]" />
            </button>
          ) : null}
          {canClaimTask ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onClaimTask(task.id)
              }}
              className="flex items-center justify-center w-7 h-7 rounded-lg text-secondary/70 hover:text-secondary hover:bg-secondary-fixed transition-all flex-shrink-0"
              aria-label="Tomar tarea"
              title="Tomar tarea"
            >
              <MaterialIcon name="assignment_ind" className="text-[16px]" />
            </button>
          ) : null}
          {(() => {
            const isEmployee = normalizeUserRole(currentUser?.role) === "empleado"
            const isDone = task.status === "done"
            const canMove = canManageTask || !isEmployee || (!isDone && statusOrder.indexOf(nextStatus) >= statusOrder.indexOf(task.status))
            
            return (
              <button
                type="button"
                disabled={!canMove}
                onClick={(e) => {
                  e.stopPropagation()
                  onMoveTask(task, nextStatus)
                }}
                className={cn(
                  "flex items-center justify-center w-7 h-7 rounded-lg transition-all flex-shrink-0",
                  canMove 
                    ? "text-primary/70 hover:text-primary hover:bg-primary/10" 
                    : "text-on-surface-variant opacity-30 cursor-not-allowed"
                )}
                aria-label={`${statusLabel} tarea`}
                title={canMove ? statusLabel : "No permitido"}
              >
                <MaterialIcon name={task.status === "review" ? "check_circle" : "arrow_forward"} className="text-[16px]" />
              </button>
            )
          })()}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onDeleteTask(task.id)
            }}
            className={cn(
              "flex items-center justify-center w-7 h-7 rounded-lg text-error/70 hover:text-error hover:bg-error/10 transition-all flex-shrink-0",
              !canDelete && "hidden"
            )}
            aria-label="Eliminar tarea"
            title="Eliminar"
          >
            <MaterialIcon name="delete" className="text-[16px]" />
          </button>
        </div>
      </div>

      <h4 className="text-sm font-bold text-primary leading-snug">{task.title}</h4>

      <div className="flex items-center gap-2 mt-1 flex-wrap">
        <span className={cn(
          "px-2.5 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider",
          task.status === "done" ? "bg-green-100 text-green-700" :
          task.status === "review" ? "bg-tertiary-fixed text-on-tertiary-fixed-variant" :
          task.status === "inProgress" ? "bg-secondary-container/20 text-secondary" :
          "bg-surface-container-high text-on-surface-variant"
        )}>
          {task.status === "done" ? "Completado" :
           task.status === "review" ? "En revisión" :
           task.status === "inProgress" ? "En progreso" : "Por hacer"}
        </span>
        <span className={cn("px-2 py-0.5 text-[9px] font-bold rounded uppercase tracking-wider font-label-caps", priorityMeta[task.priority].className)}>
          {priorityMeta[task.priority].label}
        </span>
        {isCreatedByCurrentUser && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase text-primary font-label-caps">
            <MaterialIcon name="person" className="text-[10px]" />
            Mía
          </span>
        )}
        {task.escalation && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-tertiary-fixed px-2 py-0.5 text-[9px] font-bold uppercase text-tertiary-container font-label-caps">
            Escalada
          </span>
        )}
      </div>

      {/* Progress Section */}
      <div className="mt-2">
        <div className="flex justify-between items-center mb-1 text-[10px] font-medium text-on-surface-variant">
          <span>{progressPercentage}%</span>
          <span>{durationLabel}</span>
        </div>
        <div className="w-full bg-surface-container-high h-1 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full transition-all duration-500",
              task.status === "done" ? "bg-green-500" :
              task.priority === "high" ? "bg-error" :
              task.priority === "medium" ? "bg-secondary-container" : "bg-primary"
            )}
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Description */}
      <p className="font-body-sm text-xs text-on-surface-variant line-clamp-2 mt-1">{task.description}</p>

      {/* Footer / Avatars and stats */}
      <div className="flex justify-between items-center mt-3 pt-3 border-t border-outline-variant/20">
        <div className="flex items-center -space-x-1.5">
          {assignees.slice(0, 2).map((user) => (
            <img
              key={user.id}
              src={user.avatar}
              alt={user.name}
              className="w-6 h-6 rounded-full border-2 border-white object-cover"
              title={user.name}
            />
          ))}
          {assignees.length > 2 && (
            <div className="w-6 h-6 rounded-full bg-surface-variant border-2 border-white flex items-center justify-center text-[8px] font-bold text-on-surface-variant">
              +{assignees.length - 2}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 text-on-surface-variant/60">
          <div className="flex items-center gap-0.5" title="Notas de la tarea">
            <MaterialIcon name="chat_bubble" className="text-sm" />
            <span className="text-[10px] font-bold">{notesCount}</span>
          </div>
          <div className="flex items-center gap-0.5" title="Evidencias">
            <MaterialIcon name="attachment" className="text-sm" />
            <span className="text-[10px] font-bold">{totalAttachments}</span>
          </div>

          {task.priority === "high" && task.status !== "done" && (
            <div className="text-error flex items-center gap-0.5 ml-1 animate-pulse" title="Alta Prioridad">
              <MaterialIcon name="warning" className="text-sm" />
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
