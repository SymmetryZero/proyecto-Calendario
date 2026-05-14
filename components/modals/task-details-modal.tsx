"use client"

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import { MaterialIcon } from "@/components/ui/material-icon"
import { Avatar } from "@/components/ui/avatar"
import { fileToDataUrl, formatBytes, formatDateTime } from "@/utils/workflow"
import {
  createEvidencePreview,
  type DrawingScene,
  type EvidenceFile,
  useWorkflowStore,
  workflowSelectors
} from "@/store/workflow-store"
import { TaskDrawingCanvas } from "@/components/task-drawing-canvas"

type TaskDetailsModalProps = {
  open: boolean
  taskId: string | null
  onClose: () => void
}

export function TaskDetailsModal({ open, taskId, onClose }: TaskDetailsModalProps) {
  const task = useWorkflowStore((state) => workflowSelectors.getTaskById(state.tasks, taskId))
  const technicians = useWorkflowStore((state) => state.technicians)
  const evidence = useWorkflowStore((state) => state.evidence)
  const folders = useWorkflowStore((state) => state.folders)
  const addEvidence = useWorkflowStore((state) => state.addEvidence)
  const updateEvidence = useWorkflowStore((state) => state.updateEvidence)
  const deleteEvidence = useWorkflowStore((state) => state.deleteEvidence)
  const updateTask = useWorkflowStore((state) => state.updateTask)

  const [drawingScene, setDrawingScene] = useState<DrawingScene | null>(task?.drawingScene ?? null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    setDrawingScene(task?.drawingScene ?? null)
  }, [open, task?.drawingScene, taskId])

  const linkedEvidence = useMemo(
    () => evidence.filter((item) => item.linkedTaskId === taskId),
    [evidence, taskId]
  )

  const assignees = useMemo(() => {
    if (!task) {
      return []
    }

    return task.assigneeIds
      .map((id) => technicians.find((technician) => technician.id === id))
      .filter(Boolean) as typeof technicians
  }, [task, technicians])

  if (!open || !task) {
    return null
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files
    if (!files || files.length === 0 || !task) {
      return
    }

    setUploading(true)

    try {
      const targetFolder = folders.find((folder) => folder.id === "folder-evidence") ?? folders[0] ?? null
      const items = Array.from(files)

      for (const file of items) {
        const base64 = await fileToDataUrl(file)
        const mediaType = file.type.startsWith("video/") ? "video" : "image"

        addEvidence({
          mediaType,
          mimeType: file.type || (mediaType === "video" ? "video/mp4" : "image/png"),
          name: file.name,
          base64,
          previewBase64: mediaType === "video" ? createEvidencePreview(file.name, "#004064") : base64,
          caption: "",
          folderId: targetFolder?.id ?? null,
          linkedTaskId: task.id,
          size: file.size
        })
      }
    } finally {
      setUploading(false)
      event.target.value = ""
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/60 backdrop-blur-[2px] px-4">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-panel">
        <div className="flex items-start justify-between gap-4 border-b border-outline-variant bg-surface p-6">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="font-data-mono text-data-mono text-tertiary-container bg-surface-container-low px-2 py-1 rounded border border-outline-variant">
                {task.id.toUpperCase()}
              </span>
              <span className="rounded-full bg-secondary-fixed px-3 py-1 font-label-caps text-label-caps text-secondary">
                {task.priority === "high" ? "Prioridad alta" : task.priority === "medium" ? "Prioridad media" : "Prioridad baja"}
              </span>
              <span className="rounded-full bg-tertiary-fixed px-3 py-1 font-label-caps text-label-caps text-tertiary-container">
                {task.status === "todo"
                  ? "Por hacer"
                  : task.status === "inProgress"
                    ? "En progreso"
                    : task.status === "review"
                      ? "En revisión"
                      : "Hecho"}
              </span>
            </div>
            <h2 className="font-headline-md text-headline-md text-primary">{task.title}</h2>
            <p className="mt-1 text-on-surface-variant">{task.location ?? "Sin ubicación"}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container"
          >
            <MaterialIcon name="close" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto p-6 lg:grid-cols-[1fr_1.2fr]">
          <section className="flex min-h-0 flex-col gap-6">
            <div className="rounded-xl border border-outline-variant bg-surface p-5 shadow-sm">
              <h3 className="mb-3 font-title-sm text-title-sm text-primary">Descripción</h3>
              <p className="text-body-md text-on-surface leading-relaxed">{task.description}</p>
            </div>

            <div className="rounded-xl border border-outline-variant bg-surface p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-4">
                <h3 className="font-title-sm text-title-sm text-primary">Evidencias vinculadas</h3>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-secondary-container px-4 font-title-sm text-title-sm text-on-secondary-container hover:opacity-90"
                  disabled={uploading}
                >
                  <MaterialIcon name="cloud_upload" filled />
                  {uploading ? "Subiendo..." : "Añadir evidencia"}
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={handleUpload}
              />

              <div className="space-y-3">
                {linkedEvidence.length > 0 ? (
                  linkedEvidence.map((item) => (
                    <EvidenceRow
                      key={item.id}
                      item={item}
                      onUnlink={() => updateEvidence(item.id, { linkedTaskId: null })}
                      onDelete={() => deleteEvidence(item.id)}
                    />
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-outline-variant bg-surface-container-lowest p-4 text-sm text-on-surface-variant">
                    Aún no hay evidencias vinculadas a esta tarea.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-outline-variant bg-surface p-5 shadow-sm">
              <h3 className="mb-3 font-title-sm text-title-sm text-primary">Equipo asignado</h3>
              <div className="space-y-3">
                {assignees.length > 0 ? (
                  assignees.map((technician) => (
                    <div key={technician.id} className="flex items-center gap-3 rounded-lg border border-outline-variant bg-surface-container-low p-3">
                      <Avatar name={technician.name} src={technician.avatar} className="h-10 w-10" />
                      <div className="min-w-0">
                        <p className="font-title-sm text-title-sm text-on-surface">{technician.name}</p>
                        <p className="text-sm text-on-surface-variant">{technician.role}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-on-surface-variant">Sin personal asignado.</p>
                )}
              </div>
            </div>
          </section>

          <section className="min-h-0">
            <TaskDrawingCanvas
              key={drawingScene?.updatedAt ?? task.id}
              scene={drawingScene}
              title="Plano y trazos"
              description="Este croquis queda guardado dentro de la tarea actual."
              saveLabel="Guardar en tarea"
              resetLabel="Restablecer dibujo"
              className="h-full min-h-[640px]"
              onSave={(draft) => {
                const nextScene: DrawingScene = {
                  ...draft,
                  updatedAt: new Date().toISOString()
                }
                setDrawingScene(nextScene)
                updateTask(task.id, { drawingScene: nextScene })
              }}
            />
          </section>
        </div>
      </div>
    </div>
  )
}

type EvidenceRowProps = {
  item: EvidenceFile
  onUnlink: () => void
  onDelete: () => void
}

function EvidenceRow({ item, onUnlink, onDelete }: EvidenceRowProps) {
  return (
    <article className="flex gap-3 rounded-lg border border-outline-variant bg-surface-container-low p-3">
      <img
        src={item.previewBase64 ?? item.base64}
        alt={item.name}
        className="h-14 w-14 rounded-md object-cover border border-outline-variant"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-title-sm text-title-sm text-on-surface">{item.name}</p>
            <p className="text-xs text-on-surface-variant">{formatDateTime(item.createdAt)}</p>
          </div>
          <div className="flex flex-shrink-0 gap-2">
            <button
              type="button"
              onClick={onUnlink}
              className="rounded-full border border-outline-variant px-3 py-1 text-xs text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              Desvincular
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="rounded-full border border-error/40 px-3 py-1 text-xs text-error hover:bg-error-container transition-colors"
            >
              Eliminar
            </button>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-on-surface-variant">
          <span>{formatBytes(item.size)}</span>
          <span>·</span>
          <span>{item.mediaType === "video" ? "Video" : "Imagen"}</span>
        </div>
      </div>
    </article>
  )
}
