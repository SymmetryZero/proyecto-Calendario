"use client"

import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import { MaterialIcon } from "@/components/ui/material-icon"
import { cn } from "@/utils/workflow"
import { type Priority, type TaskStatus, useWorkflowStore } from "@/store/workflow-store"

type TaskModalProps = {
  open: boolean
  onClose: () => void
}

const priorityOptions: Array<{ value: Priority; label: string }> = [
  { value: "high", label: "Alta" },
  { value: "medium", label: "Media" },
  { value: "low", label: "Baja" }
]

const statusOptions: Array<{ value: TaskStatus; label: string }> = [
  { value: "todo", label: "Por hacer" },
  { value: "inProgress", label: "En progreso" },
  { value: "review", label: "En revisión" },
  { value: "done", label: "Hecho" }
]

export function TaskModal({ open, onClose }: TaskModalProps) {
  const technicians = useWorkflowStore((state) => state.technicians)
  const addTask = useWorkflowStore((state) => state.addTask)

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [location, setLocation] = useState("")
  const [priority, setPriority] = useState<Priority>("medium")
  const [status, setStatus] = useState<TaskStatus>("todo")
  const [assigneeId, setAssigneeId] = useState<string>("")
  const [dueLabel, setDueLabel] = useState("")

  useEffect(() => {
    if (!open) {
      return
    }

    setTitle("")
    setDescription("")
    setLocation("")
    setPriority("medium")
    setStatus("todo")
    setAssigneeId(technicians[0]?.id ?? "")
    setDueLabel("")
  }, [open, technicians])

  if (!open) {
    return null
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!title.trim()) {
      return
    }

    addTask({
      title: title.trim(),
      description: description.trim() || "No se proporcionó descripción.",
      location: location.trim() || undefined,
      priority,
      status,
      assigneeIds: assigneeId ? [assigneeId] : [],
      dueLabel: dueLabel.trim() || undefined
    })

    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/60 backdrop-blur-[2px] px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl rounded-xl border border-outline-variant bg-surface-container-lowest shadow-panel overflow-hidden"
      >
        <div className="flex items-center justify-between p-6 border-b border-outline-variant bg-surface">
          <div className="flex items-center gap-3 text-tertiary">
            <MaterialIcon name="add_task" filled />
            <h2 className="font-headline-md text-headline-md">Nueva tarea</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-on-surface-variant hover:bg-surface-container p-2 rounded-full transition-colors"
          >
            <MaterialIcon name="close" />
          </button>
        </div>

        <div className="p-6 grid gap-5">
          <div className="grid gap-2">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">
              Título
            </label>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="h-12 rounded-lg border border-outline-variant bg-surface px-4 outline-none focus:border-tertiary-container focus:ring-1 focus:ring-tertiary-container"
              placeholder="Escribe un título para la tarea"
            />
          </div>

          <div className="grid gap-2">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">
              Descripción
            </label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-28 rounded-lg border border-outline-variant bg-surface p-4 outline-none focus:border-tertiary-container focus:ring-1 focus:ring-tertiary-container resize-none"
              placeholder="Agrega una breve descripción"
            />
          </div>

          <div className="grid gap-2">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">
              Ubicación
            </label>
            <input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              className="h-12 rounded-lg border border-outline-variant bg-surface px-4 outline-none focus:border-tertiary-container focus:ring-1 focus:ring-tertiary-container"
              placeholder="Ubicación opcional"
            />
          </div>

          <div className="grid gap-2">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">
              Fecha de vencimiento
            </label>
            <div className="relative">
              <MaterialIcon name="event" className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                value={dueLabel}
                onChange={(event) => setDueLabel(event.target.value)}
                className="w-full h-12 rounded-lg border border-outline-variant bg-surface pl-12 pr-4 outline-none focus:border-tertiary-container focus:ring-1 focus:ring-tertiary-container"
                placeholder="Ej: Hoy 17:00 HRS, Mañana, 15 Oct..."
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <FieldGroup label="Prioridad">
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as Priority)}
                className="h-12 w-full rounded-lg border border-outline-variant bg-surface px-3 outline-none focus:border-tertiary-container focus:ring-1 focus:ring-tertiary-container"
              >
                {priorityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FieldGroup>

            <FieldGroup label="Estado">
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as TaskStatus)}
                className="h-12 w-full rounded-lg border border-outline-variant bg-surface px-3 outline-none focus:border-tertiary-container focus:ring-1 focus:ring-tertiary-container"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FieldGroup>

            <FieldGroup label="Asignado a">
              <select
                value={assigneeId}
                onChange={(event) => setAssigneeId(event.target.value)}
                className="h-12 w-full rounded-lg border border-outline-variant bg-surface px-3 outline-none focus:border-tertiary-container focus:ring-1 focus:ring-tertiary-container"
              >
                <option value="">Sin asignar</option>
                {technicians.map((technician) => (
                  <option key={technician.id} value={technician.id}>
                    {technician.name}
                  </option>
                ))}
              </select>
            </FieldGroup>
          </div>
        </div>

        <div className="p-6 border-t border-outline-variant bg-surface flex items-center justify-end gap-4">
          <button
            type="button"
            onClick={onClose}
            className="h-touch-target-min px-6 font-title-sm text-title-sm text-on-surface-variant hover:bg-surface-variant rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className={cn(
              "h-touch-target-min px-8 font-title-sm text-title-sm rounded-lg transition-opacity flex items-center gap-2 shadow-sm",
              title.trim()
                ? "bg-secondary-container text-on-secondary-container hover:opacity-90"
                : "bg-secondary-container text-on-secondary-container opacity-60"
            )}
          >
            <MaterialIcon name="check" filled />
            Crear tarea
          </button>
        </div>
      </form>
    </div>
  )
}

type FieldGroupProps = {
  label: string
  children: ReactNode
}

function FieldGroup({ label, children }: FieldGroupProps) {
  return (
    <label className="grid gap-2">
      <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">
        {label}
      </span>
      {children}
    </label>
  )
}
