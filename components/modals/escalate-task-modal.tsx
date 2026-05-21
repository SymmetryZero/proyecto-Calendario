"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
import { MaterialIcon } from "@/components/ui/material-icon"
import { cn } from "@/utils/workflow"
import { AREA_OPTIONS, type Area, type Task, useWorkflowStore } from "@/store/workflow-store"

type EscalateTaskModalProps = {
  open: boolean
  onClose: () => void
  taskId: string | null
}

export function EscalateTaskModal({ open, onClose, taskId }: EscalateTaskModalProps) {
  const users = useWorkflowStore((state) => state.users)
  const tasks = useWorkflowStore((state) => state.tasks)
  const escalateTask = useWorkflowStore((state) => state.escalateTask)

  const task = useMemo(() => {
    if (!taskId) return null
    return tasks.find((t) => t.id === taskId) ?? null
  }, [tasks, taskId])

  const [selectedArea, setSelectedArea] = useState<Area | "">("")
  const [assigneeId, setAssigneeId] = useState<string>("")
  const [note, setNote] = useState<string>("")

  // Get available areas (excluding the task's current area)
  const availableAreas = useMemo(() => {
    if (!task) return AREA_OPTIONS
    return AREA_OPTIONS.filter((area) => area !== task.area)
  }, [task])

  // Set default selected area when open
  useEffect(() => {
    if (open && availableAreas.length > 0) {
      setSelectedArea(availableAreas[0])
      setAssigneeId("")
      setNote("")
    }
  }, [open, availableAreas])

  // Get eligible users for the selected area
  const eligibleUsers = useMemo(() => {
    if (!selectedArea) return []
    return users.filter(
      (user) =>
        (user.areas ?? []).includes(selectedArea as Area) &&
        (user.role === "empleado" || user.role === "gerente")
    )
  }, [users, selectedArea])

  // Reset assignee when selected area changes
  useEffect(() => {
    setAssigneeId("")
  }, [selectedArea])

  if (!open || !task) {
    return null
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedArea || !task) return

    escalateTask(task.id, selectedArea as Area, assigneeId || null, note.trim())
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-primary/60 backdrop-blur-[4px] px-4 animate-in fade-in duration-200">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-outline-variant bg-surface-container-low">
          <div className="flex items-center gap-3 text-secondary">
            <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
              <MaterialIcon name="forward_to_inbox" className="text-[24px]" filled />
            </div>
            <div>
              <h2 className="font-bold text-headline-sm text-primary">Escalar Tarea</h2>
              <p className="text-xs text-on-surface-variant">Redirigir "{task.title}" a otra área</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-on-surface-variant hover:bg-surface-container p-2 rounded-full transition-colors active:scale-95"
          >
            <MaterialIcon name="close" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 grid gap-5">
          {/* Current Area Info */}
          <div className="flex items-center gap-2 p-3 bg-surface-container rounded-xl border border-outline-variant/30">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Área actual:</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface-variant text-on-surface-variant">
              {task.area || "Sin área asignada"}
            </span>
          </div>

          {/* Target Area Select */}
          <div className="grid gap-2">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider flex items-center gap-1">
              <MaterialIcon name="lan" className="text-[16px]" /> Área de Destino
            </label>
            <select
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value as Area)}
              className="h-12 w-full rounded-xl border border-outline-variant bg-surface px-3 outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
              required
            >
              {availableAreas.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </div>

          {/* New Assignee Select */}
          <div className="grid gap-2">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider flex items-center gap-1">
              <MaterialIcon name="person_add" className="text-[16px]" /> Asignado del Área Destino (Opcional)
            </label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="h-12 w-full rounded-xl border border-outline-variant bg-surface px-3 outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
            >
              <option value="">Queda sin asignar (cualquiera del área puede tomarla)</option>
              {eligibleUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.position})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-on-surface-variant/80 italic">
              * Si asignas a alguien, se agregará como co-responsable de la tarea junto contigo.
            </p>
          </div>

          {/* Note / Message */}
          <div className="grid gap-2">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider flex items-center gap-1">
              <MaterialIcon name="edit_note" className="text-[16px]" /> Mensaje / Motivo de Escalado
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-24 rounded-xl border border-outline-variant bg-surface p-4 outline-none focus:border-secondary focus:ring-1 focus:ring-secondary resize-none transition-all"
              placeholder="Explica qué evidencia se ha recopilado y por qué se escala a esta área..."
            />
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-outline-variant bg-surface-container-low flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-11 px-5 font-title-sm text-title-sm text-on-surface-variant hover:bg-surface-variant rounded-xl transition-colors active:scale-95"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!selectedArea}
            className={cn(
              "h-11 px-6 font-title-sm text-title-sm rounded-xl transition-all flex items-center gap-2 shadow-md active:scale-95 text-white",
              selectedArea
                ? "bg-secondary hover:bg-secondary/90"
                : "bg-surface-variant text-on-surface-variant/40 cursor-not-allowed shadow-none"
            )}
          >
            <MaterialIcon name="send" className="text-[18px]" />
            Escalar tarea
          </button>
        </div>
      </form>
    </div>
  )
}
