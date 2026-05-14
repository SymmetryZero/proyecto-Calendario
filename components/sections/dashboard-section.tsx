"use client"

import { useEffect, useMemo, useState } from "react"
import { Avatar } from "@/components/ui/avatar"
import { MaterialIcon } from "@/components/ui/material-icon"
import {
  formatDuration,
  cn
} from "@/utils/workflow"
import {
  type EvidenceFile,
  type Priority,
  type Task,
  type TaskStatus,
  type Technician,
  useWorkflowStore,
  workflowSelectors
} from "@/store/workflow-store"

type DashboardSectionProps = {
  onCreateTask: () => void
  onOpenTaskDetails: (taskId: string) => void
  searchQuery?: string
}

const statusOrder: TaskStatus[] = ["todo", "inProgress", "review", "done"]

const statusMeta: Record<
  TaskStatus,
  { label: string; accent: string; columnClass: string; countClass: string; icon: string }
> = {
  todo: {
    label: "Por hacer",
    accent: "bg-error-container text-on-error-container",
    columnClass: "bg-surface-container-low",
    countClass: "bg-surface-variant text-on-surface-variant",
    icon: "schedule"
  },
  inProgress: {
    label: "En progreso",
    accent: "bg-secondary-container text-on-secondary-container",
    columnClass: "bg-surface-container-low",
    countClass: "bg-surface-variant text-on-surface-variant",
    icon: "pending"
  },
  review: {
    label: "En revisión",
    accent: "bg-tertiary-fixed text-tertiary-container",
    columnClass: "bg-surface-container-low",
    countClass: "bg-surface-variant text-on-surface-variant",
    icon: "done_all"
  },
  done: {
    label: "Hecho",
    accent: "bg-surface-variant text-on-surface-variant",
    columnClass: "bg-surface-container-low/50",
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

function avatarByTechnicianIds(technicians: Technician[], assigneeIds: string[]) {
  return assigneeIds
    .map((id) => technicians.find((tech) => tech.id === id))
    .filter(Boolean) as Technician[]
}

function getSortedTasks(tasks: Task[], mode: "manual" | "recent") {
  if (mode === "recent") {
    return [...tasks].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  }

  return tasks
}

export function DashboardSection({ onCreateTask, onOpenTaskDetails, searchQuery = "" }: DashboardSectionProps) {
  const now = useTicker()
  const tasks = useWorkflowStore((state) => state.tasks)
  const technicians = useWorkflowStore((state) => state.technicians)
  const evidence = useWorkflowStore((state) => state.evidence)
  const moveTask = useWorkflowStore((state) => state.moveTask)
  const deleteTask = useWorkflowStore((state) => state.deleteTask)
  const pauseTaskTimer = useWorkflowStore((state) => state.pauseTaskTimer)
  const startTaskTimer = useWorkflowStore((state) => state.startTaskTimer)

  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [filterMode, setFilterMode] = useState<"all" | "high">("all")
  const [sortMode, setSortMode] = useState<"manual" | "recent">("manual")

  const visibleTasks = useMemo(() => {
    const byStatus = new Map<TaskStatus, Task[]>()
    statusOrder.forEach((status) => byStatus.set(status, []))

    const query = searchQuery.trim().toLowerCase()

    tasks
      .filter((task) => (filterMode === "high" ? task.priority === "high" : true))
      .filter((task) => {
        if (!query) {
          return true
        }

        const assigneeText = avatarByTechnicianIds(technicians, task.assigneeIds)
          .map((technician) => `${technician.name} ${technician.role} ${technician.code}`)
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
  }, [searchQuery, tasks, technicians, filterMode])

  function handleMove(task: Task, nextStatus: TaskStatus) {
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
    if (task) {
      handleMove(task, status)
    }

    setDraggedTaskId(null)
  }

  return (
    <main className="flex-1 min-h-0 p-gutter overflow-hidden flex flex-col gap-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h2 className="font-display-lg text-display-lg text-primary">Flujos de trabajo activos</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Gestiona y da seguimiento a las tareas operativas del Sitio Alfa.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFilterMode((current) => (current === "all" ? "high" : "all"))}
            className={cn(
              "px-4 h-10 flex items-center gap-2 border rounded-DEFAULT font-label-caps text-label-caps transition-colors",
              filterMode === "high"
                ? "bg-tertiary-fixed text-tertiary-container border-tertiary-container"
                : "bg-surface-container-low border-outline-variant text-on-surface hover:bg-surface-container"
            )}
          >
            <MaterialIcon name="filter_list" className="text-[18px]" />
            {filterMode === "high" ? "Prioridad alta" : "Filtrar"}
          </button>
          <button
            type="button"
            onClick={() => setSortMode((current) => (current === "manual" ? "recent" : "manual"))}
            className={cn(
              "px-4 h-10 flex items-center gap-2 border rounded-DEFAULT font-label-caps text-label-caps transition-colors",
              sortMode === "recent"
                ? "bg-tertiary-fixed text-tertiary-container border-tertiary-container"
                : "bg-surface-container-low border-outline-variant text-on-surface hover:bg-surface-container"
            )}
          >
            <MaterialIcon name="sort" className="text-[18px]" />
            {sortMode === "recent" ? "Recientes" : "Ordenar"}
          </button>
          <button
            type="button"
            onClick={onCreateTask}
            className="px-4 h-10 flex items-center gap-2 bg-secondary text-on-secondary rounded-DEFAULT font-title-sm text-title-sm hover:opacity-90 transition-opacity"
          >
            <MaterialIcon name="add" />
            Nueva tarea
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-x-auto pb-4">
        <div className="flex gap-gutter min-h-full w-max">
          {statusOrder.map((status) => {
            const tasksForColumn = getSortedTasks(visibleTasks.get(status) ?? [], sortMode)

            return (
              <KanbanColumn
                key={status}
                status={status}
                tasks={tasksForColumn}
                technicians={technicians}
                evidence={evidence}
                draggedTaskId={draggedTaskId}
                onDragTask={setDraggedTaskId}
                onDropTask={handleDrop}
                onMoveTask={handleMove}
                onDeleteTask={deleteTask}
                onOpenTaskDetails={onOpenTaskDetails}
                now={now}
              />
            )
          })}
        </div>
      </div>
    </main>
  )
}

type KanbanColumnProps = {
  status: TaskStatus
  tasks: Task[]
  technicians: Technician[]
  evidence: EvidenceFile[]
  draggedTaskId: string | null
  onDragTask: (taskId: string | null) => void
  onDropTask: (status: TaskStatus) => void
  onMoveTask: (task: Task, nextStatus: TaskStatus) => void
  onDeleteTask: (taskId: string) => void
  onOpenTaskDetails: (taskId: string) => void
  now: number
}

function KanbanColumn({
  status,
  tasks,
  technicians,
  evidence,
  draggedTaskId,
  onDragTask,
  onDropTask,
  onMoveTask,
  onDeleteTask,
  onOpenTaskDetails,
  now
}: KanbanColumnProps) {
  const meta = statusMeta[status]

  return (
    <section
      className={cn(
        "w-80 flex-shrink-0 flex flex-col rounded-lg p-4 border border-outline-variant/50",
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

      <div className="flex flex-col gap-stack-md overflow-y-auto pr-2 pb-2 scrollbar-thin">
        {tasks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-outline-variant bg-surface-container-lowest p-4 text-sm text-on-surface-variant">
            No hay tareas en esta columna.
          </div>
        ) : null}

        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            technicians={technicians}
            evidence={evidence}
            isDragging={draggedTaskId === task.id}
            onDragStart={() => onDragTask(task.id)}
            onDragEnd={() => onDragTask(null)}
            onMoveTask={onMoveTask}
            onDeleteTask={onDeleteTask}
            onOpenTaskDetails={onOpenTaskDetails}
            now={now}
          />
        ))}
      </div>
    </section>
  )
}

type TaskCardProps = {
  task: Task
  technicians: Technician[]
  evidence: EvidenceFile[]
  isDragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onMoveTask: (task: Task, nextStatus: TaskStatus) => void
  onDeleteTask: (taskId: string) => void
  onOpenTaskDetails: (taskId: string) => void
  now: number
}

function TaskCard({
  task,
  technicians,
  evidence,
  isDragging,
  onDragStart,
  onDragEnd,
  onMoveTask,
  onDeleteTask,
  onOpenTaskDetails,
  now
}: TaskCardProps) {
  const assignees = avatarByTechnicianIds(technicians, task.assigneeIds)
  const attachedEvidence = evidence.filter((item) => item.linkedTaskId === task.id)
  const duration = workflowSelectors.getTaskDuration(task, now)
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

  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "bg-surface-container-lowest rounded-DEFAULT border p-4 flex flex-col gap-stack-sm shadow-sm hover:shadow-md transition-all cursor-grab relative group",
        task.status === "inProgress"
          ? "border-tertiary-container ring-1 ring-tertiary-container/20"
          : "border-outline-variant",
        isDragging ? "opacity-50 scale-[0.98]" : ""
      )}
    >
      <div className="flex justify-between items-start gap-2">
        <span className={cn("px-2 py-0.5 font-label-caps text-label-caps rounded-DEFAULT", priorityMeta[task.priority].className)}>
          {priorityMeta[task.priority].label}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onOpenTaskDetails(task.id)}
            className="transition-opacity text-on-surface-variant hover:text-primary opacity-100 md:opacity-0 md:group-hover:opacity-100"
            aria-label="Abrir detalles y adjuntos de la tarea"
            title="Abrir adjuntos"
          >
            <MaterialIcon name="attach_file" className="text-[20px]" />
          </button>
          <button
            type="button"
            onClick={() => onMoveTask(task, nextStatus)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-on-surface-variant hover:text-primary"
            aria-label={`${statusLabel} tarea`}
            title={statusLabel}
          >
            <MaterialIcon name={task.status === "review" ? "check_circle" : "arrow_forward"} className="text-[20px]" />
          </button>
          <button
            type="button"
            onClick={() => onDeleteTask(task.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-on-surface-variant hover:text-error"
            aria-label="Eliminar tarea"
          >
            <MaterialIcon name="delete" className="text-[20px]" />
          </button>
        </div>
      </div>

      <h4 className="font-title-sm text-title-sm text-primary leading-tight">{task.title}</h4>
      <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">{task.description}</p>

      <div className="flex justify-between items-end mt-2 gap-3">
        <div className="flex items-center -space-x-2">
          {assignees.slice(0, 2).map((technician) => (
            <Avatar
              key={technician.id}
              name={technician.name}
              src={technician.avatar}
              className="h-8 w-8"
              badgeClassName="border-2 border-surface-container-lowest"
            />
          ))}
          {assignees.length > 2 ? (
            <div className="w-8 h-8 rounded-full bg-surface-variant border-2 border-surface-container-lowest flex items-center justify-center font-title-sm text-[10px] text-on-surface-variant">
              +{assignees.length - 2}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col items-end gap-2">
          <div
            className={cn(
              "flex items-center gap-1 font-data-mono text-[12px] bg-surface-container py-1 px-2 rounded-DEFAULT border border-outline-variant/30",
              task.status === "inProgress"
                ? "text-tertiary-container bg-tertiary-fixed border-tertiary-fixed-dim/50"
                : "text-on-surface-variant"
            )}
          >
            <MaterialIcon name={task.status === "done" ? "check_circle" : task.status === "review" ? "done_all" : task.status === "inProgress" ? "pending" : "schedule"} className="text-[16px]" />
            <span>{formatDuration(duration)}</span>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {attachedEvidence.length > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-tertiary-fixed px-2 py-1 font-data-mono text-[12px] text-tertiary-container">
                <MaterialIcon name="attachment" className="text-[14px]" />
                {attachedEvidence.length} evidencias
              </span>
            ) : null}
            {task.drawingScene ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary-fixed px-2 py-1 font-data-mono text-[12px] text-secondary">
                <MaterialIcon name="architecture" className="text-[14px]" />
                Plano
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  )
}
