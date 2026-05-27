"use client"

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import { MaterialIcon } from "@/components/ui/material-icon"
import { Avatar } from "@/components/ui/avatar"
import { cn, fileToDataUrl, formatBytes, formatDateTime, makeId } from "@/utils/workflow"
import { EscalateTaskModal } from "@/components/modals/escalate-task-modal"
import { supabase } from "@/utils/supabase"
import {
  type DrawingScene,
  type EvidenceFile,
  type Priority,
  type TaskActivity,
  type User,
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
  const users = useWorkflowStore((state) => state.users)
  const currentUserId = useWorkflowStore((state) => state.currentUserId)
  const updateTask = useWorkflowStore((state) => state.updateTask)
  const addTaskActivity = useWorkflowStore((state) => state.addTaskActivity)
  const updateTaskActivity = useWorkflowStore((state) => state.updateTaskActivity)
  const removeTaskActivity = useWorkflowStore((state) => state.removeTaskActivity)
  const globalEvidence = useWorkflowStore((state) => state.evidence)
  const updateEvidence = useWorkflowStore((state) => state.updateEvidence)
  const deleteEvidence = useWorkflowStore((state) => state.deleteEvidence)
  const addEvidence = useWorkflowStore((state) => state.addEvidence)
  const addTaskLog = useWorkflowStore((state) => state.addTaskLog)
  const claimTask = useWorkflowStore((state) => state.claimTask)

  const [activeView, setActiveView] = useState<"bento" | "drawing">("bento")
  const [drawingScene, setDrawingScene] = useState<DrawingScene | null>(task?.drawingScene ?? null)
  const [uploading, setUploading] = useState(false)
  const [showAddChoice, setShowAddChoice] = useState(false)
  const [noteText, setNoteText] = useState("")
  const [isAddingNote, setIsAddingNote] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [previewItem, setPreviewItem] = useState<TaskActivity | null>(null)
  const [escalateOpen, setEscalateOpen] = useState(false)
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  
  // Custom Modal States
  const [renamingItem, setRenamingItem] = useState<TaskActivity | null>(null)
  const [deletingItem, setDeletingItem] = useState<TaskActivity | null>(null)
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [editNameValue, setEditNameValue] = useState("")
  const [editDescriptionValue, setEditDescriptionValue] = useState("")
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [internalPrompt, setInternalPrompt] = useState<{
    type: "save_drawing" | "upload_media"
    title: string
    value: string
    data?: any
  } | null>(null)

  const [now, setNow] = useState(Date.now())

  const handleDownload = async (item: any) => {
    const content = item.content || item.base64
    if (!content) return

    const fileName = item.metadata?.fileName || item.name || `${item.type.toUpperCase()}_file`
    
    if (content.startsWith("http://") || content.startsWith("https://")) {
      try {
        const response = await fetch(content)
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      } catch (error) {
        console.error("Error downloading file directly:", error)
        const link = document.createElement("a")
        link.href = content
        link.target = "_blank"
        link.rel = "noopener noreferrer"
        link.click()
      }
    } else if (content.startsWith("data:")) {
      const link = document.createElement("a")
      link.href = content
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } else {
      const mime = item.metadata?.mimeType || item.mimeType || "application/octet-stream"
      const link = document.createElement("a")
      link.href = `data:${mime};base64,${content}`
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  useEffect(() => {
    if (!open || !task || task.timerStartedAt === null) return
    
    const interval = setInterval(() => {
      setNow(Date.now())
    }, 1000)
    
    return () => clearInterval(interval)
  }, [open, task?.timerStartedAt])

  useEffect(() => {
    if (!open) return
    setDrawingScene(task?.drawingScene ?? null)
    setActiveView("bento")
    setShowAddChoice(false)
    setIsAddingNote(false)
    setPreviewItem(null)
    setEditingActivityId(null)
  }, [open, task?.drawingScene, taskId])
  

  const assignees = useMemo(() => {
    if (!task) return []
    return task.assigneeIds
      .map((id) => users.find((u) => u.id === id))
      .filter((u): u is User => !!u)
  }, [task, users])

  const currentUser = useMemo(() => {
    return users.find((u) => u.id === currentUserId) ?? null
  }, [users, currentUserId])

  const canManageTask = workflowSelectors.canManageTask(task, currentUser)
  const canClaimTask = workflowSelectors.canClaimTask(task, currentUser)

  // Unify and de-duplicate evidence by filename
  const evidence = useMemo(() => {
    if (!task) return []
    const map = new Map<string, any>()
    const activities = task.activities || []

    // 1. Load internal media activities
    activities.forEach((a) => {
      if (a.type === "image" || a.type === "video" || a.type === "audio" || a.type === "drawing") {
        const name = a.metadata?.fileName || `${a.type.toUpperCase()}_${a.id.slice(-4)}`
        const key = name.toLowerCase().trim()
        map.set(key, {
          id: a.id,
          type: a.type,
          content: a.content,
          createdAt: a.createdAt,
          metadata: {
            fileName: name,
            mimeType: a.metadata?.mimeType || "",
            description: a.metadata?.description || ""
          },
          isGlobal: false,
          activityId: a.id
        })
      }
    })

    // 2. Load global evidence linked to this task
    globalEvidence.forEach((item) => {
      if (item.linkedTaskId === task.id) {
        const name = item.name
        const key = name.toLowerCase().trim()
        
        if (map.has(key)) {
          const existing = map.get(key)
          map.set(key, {
            ...existing,
            isGlobal: true,
            globalId: item.id
          })
        } else {
          map.set(key, {
            id: item.id,
            type: item.mediaType,
            content: item.mediaType === "drawing"
              ? (task.drawingScene || { elements: [], appState: {}, files: {}, updatedAt: item.createdAt, preview: item.previewBase64 || item.base64 })
              : (item.base64 || item.previewBase64 || ""),
            createdAt: item.createdAt,
            metadata: {
              fileName: item.name,
              mimeType: item.mimeType,
              description: item.caption || ""
            },
            isGlobal: true,
            globalId: item.id
          })
        }
      }
    })

    return Array.from(map.values())
  }, [task, globalEvidence])

  const canEscalateArea = !!task && !!currentUserId && canManageTask

  if (!open || !task) return null

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

  const handleAddNote = () => {
    if (!noteText.trim()) return
    addTaskActivity(task.id, "note", noteText.trim())
    setNoteText("")
    setIsAddingNote(false)
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      if (!task) return
      const file = files[0]
      setUploadingFileName(file.name)
      
      let fileUrl = ""
      try {
        // Clean file name to avoid spaces or special characters causing 400 errors in Supabase Storage
        const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, "_")
        const filePath = `${makeId("evidence")}-${cleanName}`

        const { error: uploadError } = await supabase.storage
          .from("servimeci-evidence")
          .upload(filePath, file)

        if (uploadError) {
          throw uploadError
        }

        const { data: urlData } = supabase.storage
          .from("servimeci-evidence")
          .getPublicUrl(filePath)

        fileUrl = urlData.publicUrl
      } catch (uploadError: any) {
        console.error("Storage upload failed, falling back to local base64:", uploadError)
        fileUrl = await fileToDataUrl(file)
      }

      let type: "image" | "video" | "audio" = "image"
      if (file.type.startsWith("video/")) type = "video"
      else if (file.type.startsWith("audio/")) type = "audio"
      
      setInternalPrompt({
        type: "upload_media",
        title: "Nombre y descripción de la evidencia",
        value: file.name,
        data: {
          base64: fileUrl, // Contains public URL or fallback base64
          type,
          fileName: file.name,
          mimeType: file.type
        }
      })
      setShowAddChoice(false)
    } finally {
      setUploading(false)
      setUploadingFileName(null)
      event.target.value = ""
    }
  }

  const handleFinishInternalPrompt = (value: string, description?: string) => {
    if (!internalPrompt || !task) return
    
    if (internalPrompt.type === "save_drawing") {
      const nextScene = internalPrompt.data.scene
      const fileName = value.trim() || internalPrompt.value
      const detail = description?.trim() || ""
      
      addTaskActivity(task.id, "drawing", nextScene, { 
        fileName,
        description: detail
      })
      addEvidence({
        mediaType: "drawing",
        mimeType: "application/json",
        name: fileName,
        base64: nextScene.preview || "",
        previewBase64: nextScene.preview || "",
        caption: detail,
        linkedTaskId: task.id,
        size: JSON.stringify(nextScene).length
      })
      addTaskLog(task.id, `Plano guardado: ${fileName}`, {
        fileName,
        mimeType: "application/json",
        description: detail
      })
      updateTask(task.id, { drawingScene: nextScene })
      setEditingActivityId(null)
      setActiveView("bento")
    } else if (internalPrompt.type === "upload_media") {
      const { base64, type, fileName, mimeType } = internalPrompt.data
      const finalName = value.trim() || internalPrompt.value || fileName
      const finalDescription = description?.trim() || ""
      addTaskActivity(task.id, type, base64, {
        fileName: finalName,
        mimeType,
        description: finalDescription
      })
      addEvidence({
        mediaType: type,
        mimeType: mimeType || "",
        name: finalName,
        base64: base64,
        caption: finalDescription,
        linkedTaskId: task.id,
        size: base64.length
      })
      addTaskLog(task.id, `Evidencia subida: ${finalName}`, {
        fileName: finalName,
        mimeType,
        description: finalDescription
      })
    }
    
    setInternalPrompt(null)
  }

  const activities = task.activities || []
  const notes = activities.filter(a => a.type === "note")
  const historyItems = activities.filter(a => a.type === "log")



  const activityMeta: Record<TaskActivity["type"], { icon: string; className: string; label: string }> = {
    note: { icon: "chat", className: "bg-surface-container-low border-secondary", label: "Mensaje" },
    log: { icon: "info", className: "bg-surface-container border-primary/30", label: "Cambio" },
    image: { icon: "photo_camera", className: "bg-surface-container-lowest border-tertiary/30", label: "Imagen" },
    video: { icon: "videocam", className: "bg-surface-container-lowest border-tertiary/30", label: "Video" },
    audio: { icon: "mic", className: "bg-surface-container-lowest border-tertiary/30", label: "Audio" },
    drawing: { icon: "draw", className: "bg-surface-container-lowest border-tertiary/30", label: "Plano" }
  }

  const getActivityText = (activity: TaskActivity) => {
    const fileName = activity.metadata?.fileName?.trim()
    const rawText = typeof activity.content === "string" ? activity.content : ""

    switch (activity.type) {
      case "note":
        return `"${rawText || "Mensaje registrado"}"`
      case "log":
        return rawText || "Cambio registrado"
      case "image":
        return `Imagen subida${fileName ? `: ${fileName}` : ""}`
      case "video":
        return `Video subido${fileName ? `: ${fileName}` : ""}`
      case "audio":
        return `Audio subido${fileName ? `: ${fileName}` : ""}`
      case "drawing":
        return `Plano guardado${fileName ? `: ${fileName}` : ""}`
      default:
        return rawText || "Actividad registrada"
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/80 backdrop-blur-md sm:px-6 sm:py-4">
      <div className={cn(
        "relative w-full h-full flex flex-col bg-surface shadow-2xl overflow-hidden border-white/20 animate-in fade-in zoom-in duration-300 transition-all duration-500",
        activeView === "drawing" ? "max-w-full h-screen sm:h-screen sm:rounded-none" : "sm:h-[90vh] sm:rounded-3xl max-w-7xl"
      )}>
        
        {activeView !== "drawing" && (
          <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4 border-b border-outline-variant bg-surface/95 backdrop-blur-sm px-4 sm:px-6 py-4 sm:py-5 shrink-0 animate-in fade-in duration-200">
             <div className="flex flex-col">
                <nav className="flex items-center gap-2 text-on-surface-variant mb-1 font-body-sm text-[12px]">
                  <button onClick={onClose} className="hover:text-primary flex items-center gap-1 transition-colors border-none bg-transparent cursor-pointer">
                    <MaterialIcon name="arrow_back" className="text-[14px]" />
                    <span>Regresar</span>
                  </button>
                  <MaterialIcon name="chevron_right" className="text-[14px]" />
                  <span className="hover:text-primary cursor-pointer hidden sm:inline">Tareas</span>
                  <MaterialIcon name="chevron_right" className="text-[14px] hidden sm:inline" />
                  <span className="text-primary font-semibold truncate max-w-[200px]">{task.title}</span>
                </nav>
                <div className="flex flex-wrap items-center gap-3">
                   <h2 className="font-display-lg text-xl sm:text-display-lg text-primary leading-tight truncate max-w-[280px] sm:max-w-none">{task.title}</h2>
                   
                   <span className={cn("px-2 py-0.5 font-label-caps text-label-caps rounded-DEFAULT flex-shrink-0", priorityMeta[task.priority].className)}>
                      {priorityMeta[task.priority].label}
                   </span>

                   {/* Status Selector */}
                   <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-full border border-outline-variant">
                      {(["todo", "inProgress", "review", "done"] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => updateTask(task.id, { status: s })}
                          className={cn(
                            "px-3 py-1 rounded-full font-label-caps text-[9px] uppercase tracking-wider transition-all border-none cursor-pointer",
                            task.status === s 
                              ? s === "todo" ? "bg-surface-container-high text-on-surface shadow-sm" :
                                s === "inProgress" ? "bg-secondary-container text-on-secondary-container shadow-sm" :
                                s === "review" ? "bg-tertiary-container text-on-tertiary-container shadow-sm" :
                                "bg-primary text-white shadow-sm"
                              : "text-on-surface-variant hover:bg-surface-container-high"
                          )}
                        >
                          {s === "todo" ? "Por Hacer" : s === "inProgress" ? "En Progreso" : s === "review" ? "Revisión" : "Hecho"}
                        </button>
                      ))}
                   </div>
                </div>
                <p className="font-data-mono text-[11px] text-on-surface-variant mt-1.5">REF: {task.id.toUpperCase()}</p>
             </div>
             
             <div className="flex items-center gap-3 self-end sm:self-center">
                <button onClick={onClose} className="h-10 w-10 flex items-center justify-center rounded-full bg-surface-container hover:bg-surface-container-high transition-colors shadow-sm border-none cursor-pointer">
                  <MaterialIcon name="close" />
                </button>
             </div>
          </header>
        )}

        {/* Workspace Layout */}
        <div className={cn("flex-1 min-h-0", activeView === "bento" ? "overflow-y-auto" : "overflow-hidden")}>
           {activeView === "bento" ? (
             <main className="p-6 grid grid-cols-12 gap-6 max-w-[1400px] mx-auto">
                
                {/* Left Column: Info & Notes */}
                <div className="col-span-12 lg:col-span-4 space-y-6">
                   
                   {/* Task Information Card */}
                   <section className="bg-white border border-outline-variant p-6 rounded-2xl shadow-sm overflow-hidden relative">
                      <div className={cn(
                        "absolute top-0 left-0 w-1 h-full",
                        task.priority === "high" ? "bg-error" : task.priority === "medium" ? "bg-warning" : "bg-success"
                      )} />
                      <h3 className="font-title-sm text-title-sm text-primary mb-5 flex items-center gap-2">
                         <MaterialIcon name="info" className="text-secondary" filled />
                         Información de Tarea
                      </h3>
                      
                      <div className="space-y-6">
                         <div>
                            <p className="font-label-caps text-[10px] text-on-surface-variant uppercase mb-2 tracking-widest">Instrucciones</p>
                            <p className="font-body-md text-body-md leading-relaxed text-on-surface">{task.description}</p>
                         </div>
                         
                         {task.creatorId && (
                           <div className="flex items-center gap-2 p-2 bg-primary/5 rounded-lg border border-primary/10">
                              <MaterialIcon name="person" className="text-primary text-[16px]" />
                              <span className="text-[11px] font-medium text-on-surface">
                                <span className="text-on-surface-variant">Asignado por: </span>
                                {users.find(u => u.id === task.creatorId)?.name || "Sistema"}
                              </span>
                           </div>
                         )}

                         {/* Area Selector — Redirigir a otro departamento */}
                          <div className="flex flex-col gap-1.5">
                            <p className="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-widest">Departamento / Área</p>
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="flex-1 min-w-[180px] h-10 pl-3 pr-3 rounded-xl border border-outline-variant bg-surface-container-low text-sm font-semibold text-on-surface flex items-center">
                                  {task.area ?? "Sin area"}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setEscalateOpen(true)}
                                  disabled={!canEscalateArea}
                                  className={cn(
                                    "h-10 px-3 rounded-xl text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all",
                                    canEscalateArea
                                      ? "bg-tertiary-fixed text-tertiary-container hover:bg-tertiary hover:text-white"
                                      : "bg-surface-variant text-on-surface-variant opacity-60 cursor-not-allowed"
                                  )}
                                >
                                  <MaterialIcon name="forward_to_inbox" className="text-[16px]" />
                                  Enviar a otra area
                                </button>
                              </div>
                            <p className="text-[10px] text-on-surface-variant">
                              {canEscalateArea
                                ? "Redirige esta tarea a otro departamento. Los asignados seguirán viéndola."
                                : "Disponible para asignado, creador o admin/gerente."}
                            </p>
                          </div>
                         
                         <div className="grid grid-cols-2 gap-4">
                            <div className="bg-surface-container-low p-3 rounded-xl border border-outline-variant/30">
                               <p className="font-label-caps text-[10px] text-on-surface-variant uppercase mb-1">Duración</p>
                               <div className="flex items-center gap-2 text-secondary">
                                  <MaterialIcon name="schedule" className="text-[18px]" />
                                  <span className="font-title-sm text-sm font-bold">2.5 Horas</span>
                               </div>
                            </div>
                            <div className="bg-surface-container-low p-3 rounded-xl border border-outline-variant/30">
                               <p className="font-label-caps text-[10px] text-on-surface-variant uppercase mb-1">Ubicación</p>
                               <div className="flex items-center gap-2 text-secondary">
                                  <MaterialIcon name="location_on" className="text-[18px]" />
                                  <span className="font-title-sm text-sm font-bold truncate">{task.location || "Sector 4G"}</span>
                               </div>
                            </div>
                            {task.dueLabel && (
                              <div className="bg-error-container/20 p-3 rounded-xl border border-error/10 col-span-2">
                                 <p className="font-label-caps text-[10px] text-error uppercase mb-1 font-bold">Vencimiento</p>
                                 <div className="flex items-center gap-2 text-error">
                                    <MaterialIcon name="event" className="text-[18px]" />
                                    <span className="font-title-sm text-sm font-bold">
                                       {task.dueLabel && !isNaN(Date.parse(task.dueLabel)) 
                                         ? formatDateTime(task.dueLabel) 
                                         : task.dueLabel}
                                    </span>
                                 </div>
                              </div>
                            )}
                         </div>

                          <div className="pt-6 border-t border-outline-variant">
                             <div className="flex items-center justify-between mb-4">
                                <p className="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-widest">Desglose de Tiempos</p>
                                <div className={cn(
                                  "px-2 py-0.5 rounded-full font-data-mono text-[10px]",
                                  task.timerStartedAt ? "bg-secondary text-white animate-pulse" : "bg-surface-container-highest text-on-surface-variant"
                                )}>
                                   {task.timerStartedAt ? "ACTIVO" : "PAUSADO"}
                                </div>
                             </div>
                             <div className="space-y-2">
                                {(["todo", "inProgress", "review", "done"] as const).map(s => {
                                  const isCurrentStatus = task.status === s
                                  const isActive = isCurrentStatus && task.timerStartedAt !== null
                                  const accumulatedForStatus = task.statusDurations?.[s] || 0
                                  const currentSessionTime = isActive ? Math.max(0, Math.floor((now - (task.timerStartedAt || 0)) / 1000)) : 0
                                  const duration = accumulatedForStatus + currentSessionTime
                                  
                                  return (
                                    <div key={s} className={cn(
                                      "flex items-center justify-between p-2.5 rounded-xl border transition-all",
                                      isCurrentStatus ? "bg-primary/5 border-primary/20 shadow-sm" : "bg-transparent border-transparent opacity-60"
                                    )}>
                                       <div className="flex items-center gap-2">
                                          <MaterialIcon 
                                            name={s === "todo" ? "schedule" : s === "inProgress" ? "pending" : s === "review" ? "done_all" : "check_circle"} 
                                            className={cn("text-[16px]", isCurrentStatus ? "text-primary" : "text-on-surface-variant")} 
                                            filled={isCurrentStatus}
                                          />
                                          <span className="text-[11px] font-bold text-on-surface">
                                            {s === "todo" ? "Por Hacer" : s === "inProgress" ? "En Progreso" : s === "review" ? "En Revisión" : "Finalizado"}
                                          </span>
                                       </div>
                                       <span className="font-data-mono text-[12px] font-bold text-primary">
                                         {Math.floor(duration / 3600)}h {Math.floor((duration % 3600) / 60)}m {duration % 60}s
                                       </span>
                                    </div>
                                  )
                                })}
                             </div>
                          </div>

                             <p className="font-label-caps text-[10px] text-on-surface-variant uppercase mb-3 tracking-widest">Asignado a</p>
                            {assignees.length === 0 ? (
                              <div className="flex flex-col gap-3 bg-surface-container-lowest p-4 rounded-xl border border-dashed border-outline-variant/60 text-center">
                                 <p className="text-xs text-on-surface-variant italic">Sin responsables asignados</p>
                                 {canClaimTask ? (
                                   <button
                                     type="button"
                                     onClick={() => claimTask(task.id)}
                                     className="w-full h-9 bg-secondary text-white font-bold text-[11px] uppercase tracking-wider rounded-lg shadow-sm hover:bg-secondary-container hover:text-on-secondary-container active:scale-95 transition-all flex items-center justify-center gap-1.5"
                                   >
                                      <MaterialIcon name="assignment_ind" className="text-[14px]" />
                                      Tomar Tarea
                                   </button>
                                 ) : null}
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {assignees.map(tech => (
                                  <div key={tech.id} className="flex items-center gap-3 bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/50 group hover:border-secondary transition-colors">
                                     <Avatar name={tech.name} src={tech.avatar} className="h-10 w-10 ring-2 ring-white" />
                                     <div className="min-w-0 flex-1">
                                        <p className="font-title-sm text-sm font-bold text-on-surface">{tech.name}</p>
                                        <p className="text-[11px] text-on-surface-variant">{tech.role}</p>
                                     </div>
                                     <button className="h-8 w-8 rounded-full flex items-center justify-center text-secondary hover:bg-secondary/10 opacity-0 group-hover:opacity-100 transition-all">
                                        <MaterialIcon name="mail" className="text-[18px]" />
                                     </button>
                                  </div>
                                ))}
                                {canClaimTask ? (
                                  <button
                                    type="button"
                                    onClick={() => claimTask(task.id)}
                                    className="w-full h-9 bg-secondary text-white font-bold text-[11px] uppercase tracking-wider rounded-lg shadow-sm hover:bg-secondary-container hover:text-on-secondary-container active:scale-95 transition-all flex items-center justify-center gap-1.5"
                                  >
                                     <MaterialIcon name="assignment_ind" className="text-[14px]" />
                                     Tomar Tarea
                                  </button>
                                ) : null}
                              </div>
                            )}
                      </div>
                   </section>

                   {/* Technical Notes Card */}
                   <section className="bg-white border border-outline-variant p-6 rounded-2xl shadow-sm">
                      <div className="flex items-center justify-between mb-5">
                         <h3 className="font-title-sm text-title-sm text-primary flex items-center gap-2">
                            <MaterialIcon name={showHistory ? "history" : "description"} className="text-secondary" filled />
                            {showHistory ? "Historial de Cambios" : "Notas Técnicas"}
                         </h3>
                         <div className="flex items-center gap-2">
                           <button 
                             onClick={() => setShowHistory(!showHistory)}
                             className="text-secondary font-label-caps text-[10px] uppercase hover:underline tracking-wider"
                           >
                             {showHistory ? "Ver Notas" : "Ver Historial"}
                           </button>
                         </div>
                      </div>
                      
                      <div className="space-y-4">
                         {(showHistory ? historyItems : notes).map((activity) => {
                           const meta = activityMeta[activity.type]
                           const description =
                             activity.type !== "note" && activity.type !== "log"
                               ? activity.metadata?.description?.trim()
                               : ""

                           return (
                             <div key={activity.id} className={cn("p-4 rounded-xl border-l-4 shadow-sm", meta.className)}>
                               <div className="flex items-start gap-2">
                                 <MaterialIcon name={meta.icon} className="text-[14px] text-primary" />
                                 <div className="flex-1">
                                   <p
                                     className={cn(
                                       "font-body-sm text-sm text-on-surface mb-2",
                                       activity.type === "note" && "italic"
                                     )}
                                   >
                                     {getActivityText(activity)}
                                   </p>
                                   {description ? (
                                     <p className="text-xs text-on-surface-variant">{description}</p>
                                   ) : null}
                                 </div>
                               </div>
                               <div className="flex justify-between items-center text-[10px] text-on-surface-variant/70 font-data-mono mt-2">
                                 <span>
                                   {activity.metadata?.authorName || "Sistema"} • {new Date(activity.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                 </span>
                                 <span className="uppercase">{meta.label}</span>
                               </div>
                             </div>
                           )
                         })}

                         {showHistory && historyItems.length === 0 ? (
                           <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface-variant">
                             Aun no hay cambios registrados en esta tarea.
                           </div>
                         ) : null}

                         {!showHistory && isAddingNote ? (
                           <div className="bg-surface-container-highest p-4 rounded-xl border-2 border-secondary/30 animate-in slide-in-from-top-2 duration-200">
                              <textarea 
                                autoFocus
                                value={noteText}
                                onChange={(e) => setNoteText(e.target.value)}
                                placeholder="Escribe tu observación técnica..."
                                className="w-full bg-transparent border-none focus:ring-0 text-sm text-on-surface resize-none h-24 mb-3 p-0"
                              />
                              <div className="flex justify-end gap-2">
                                 <button onClick={() => setIsAddingNote(false)} className="px-3 py-1.5 text-[11px] font-bold uppercase text-on-surface-variant hover:bg-surface-container-low rounded-lg transition-colors">Cancelar</button>
                                 <button onClick={handleAddNote} className="px-4 py-1.5 bg-secondary text-white text-[11px] font-bold uppercase rounded-lg shadow-sm hover:opacity-90 transition-all">Guardar Nota</button>
                              </div>
                           </div>
                         ) : !showHistory ? (
                           <button 
                             onClick={() => setIsAddingNote(true)}
                             className="w-full py-4 border-2 border-dashed border-outline-variant rounded-xl text-on-surface-variant font-title-sm text-sm flex items-center justify-center gap-2 hover:bg-secondary/5 hover:border-secondary/50 hover:text-secondary transition-all group"
                           >
                              <MaterialIcon name="add_comment" className="group-hover:scale-110 transition-transform" />
                              Agregar Observación
                           </button>
                         ) : null}
                      </div>
                   </section>
                </div>

                {/* Right Column: Evidence Grid */}
                <div className="col-span-12 lg:col-span-8">
                   <section className="bg-white border border-outline-variant p-6 rounded-2xl shadow-sm min-h-full">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
                         <div>
                            <h3 className="font-title-sm text-title-sm text-primary flex items-center gap-2">
                               <MaterialIcon name="photo_library" className="text-secondary" filled />
                               Evidencia de Sitio
                            </h3>
                            <p className="font-body-sm text-xs text-on-surface-variant mt-1">{evidence.length} elementos adjuntos</p>
                         </div>
                         <div className="flex gap-1 bg-surface-container-low p-1 rounded-xl border border-outline-variant/30">
                            <button 
                              onClick={() => setViewMode("grid")}
                              className={cn("p-2 rounded-lg transition-all", viewMode === "grid" ? "bg-white text-primary shadow-sm" : "text-on-surface-variant hover:bg-white/50")}
                            >
                               <MaterialIcon name="grid_view" className="text-[20px]" />
                            </button>
                            <button 
                              onClick={() => setViewMode("list")}
                              className={cn("p-2 rounded-lg transition-all", viewMode === "list" ? "bg-white text-primary shadow-sm" : "text-on-surface-variant hover:bg-white/50")}
                            >
                               <MaterialIcon name="list" className="text-[20px]" />
                            </button>
                         </div>
                      </div>

                      <div className={cn(
                         "grid gap-4 sm:gap-5",
                         viewMode === "grid" 
                           ? "grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4" 
                           : "grid-cols-1"
                       )}>
                         
                         {/* Add Evidence Choice / Dropzone */}
                         <div className={cn(
                            "relative rounded-2xl border-2 border-dashed border-secondary bg-secondary/5 overflow-hidden group transition-all",
                            viewMode === "grid" ? "aspect-square" : "h-32"
                          )}>
                            {!showAddChoice ? (
                               <button 
                                 onClick={() => setShowAddChoice(true)}
                                 className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center hover:bg-secondary/10 transition-colors"
                               >
                                  <div className="w-14 h-14 rounded-2xl bg-secondary-container text-on-secondary-container flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform">
                                     <MaterialIcon name="add_a_photo" className="text-[28px]" filled />
                                  </div>
                                  <span className="font-title-sm text-base text-secondary font-bold">Agregar Evidencia</span>
                                  <p className="font-body-sm text-[11px] text-on-surface-variant mt-2 leading-tight">Sube fotos, videos o crea un dibujo técnico</p>
                               </button>
                            ) : (
                               <div className="absolute inset-0 flex flex-col p-4 bg-white/95 backdrop-blur-sm animate-in fade-in duration-200">
                                  <div className="flex justify-between items-center mb-3">
                                     <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Seleccionar tipo</span>
                                     <button onClick={() => setShowAddChoice(false)} className="text-on-surface-variant hover:text-error"><MaterialIcon name="close" className="text-[18px]" /></button>
                                  </div>
                                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2 min-h-0 overflow-y-auto pr-1">
                                     <button 
                                       onClick={() => {
                                         setDrawingScene(null)
                                         setEditingActivityId(null)
                                         setActiveView("drawing")
                                       }}
                                       className="flex items-center gap-3 p-3 rounded-xl border border-outline-variant hover:border-secondary hover:bg-secondary/5 transition-all text-left group"
                                     >
                                        <div className="h-9 w-9 rounded-lg bg-surface-container flex items-center justify-center text-secondary group-hover:bg-secondary-container group-hover:text-on-secondary-container transition-colors">
                                           <MaterialIcon name="architecture" className="text-[20px]" />
                                        </div>
                                        <div className="min-w-0">
                                           <p className="text-[13px] font-bold text-on-surface leading-tight">Dibujo Técnico</p>
                                           <p className="text-[9px] text-on-surface-variant">Croquis y medidas</p>
                                        </div>
                                     </button>
                                     <button 
                                       onClick={() => fileInputRef.current?.click()}
                                       className="flex items-center gap-3 p-3 rounded-xl border border-outline-variant hover:border-secondary hover:bg-secondary/5 transition-all text-left group"
                                     >
                                        <div className="h-9 w-9 rounded-lg bg-surface-container flex items-center justify-center text-secondary group-hover:bg-secondary-container group-hover:text-on-secondary-container transition-colors">
                                           <MaterialIcon name="photo_camera" className="text-[20px]" />
                                        </div>
                                        <div className="min-w-0">
                                           <p className="text-[13px] font-bold text-on-surface leading-tight">Cámara / Archivo</p>
                                           <p className="text-[9px] text-on-surface-variant">Sube fotos, videos o audios</p>
                                        </div>
                                     </button>
                                  </div>
                               </div>
                            )}
                            <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*" capture="environment" multiple className="hidden" onChange={handleUpload} />
                         </div>

                         {/* Evidence Grid Items */}
                         {evidence.map(item => (
                            <div 
                              key={item.id} 
                              className={cn(
                                "group relative rounded-2xl overflow-hidden border border-outline-variant bg-surface-container-highest shadow-sm transition-all duration-300",
                                viewMode === "grid" ? "aspect-square" : "flex flex-col sm:flex-row min-h-[8rem] sm:h-32"
                              )}
                            >
                               <div className={cn(
                                 "relative bg-black/5 flex items-center justify-center overflow-hidden",
                                 viewMode === "grid" ? "w-full h-full" : "w-full sm:w-48 h-32 sm:h-full shrink-0"
                               )}>
                               {item.type === "image" && (
                                 <img src={item.content} alt="Evidencia" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                               )}
                               {item.type === "video" && (
                                 <div className="h-full w-full bg-primary/20 flex items-center justify-center relative overflow-hidden">
                                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors" />
                                    <MaterialIcon name="play_circle" className="text-[54px] text-white drop-shadow-xl z-10 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all" filled />
                                    <div className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-black/40 text-white rounded text-[9px] font-data-mono backdrop-blur-md">VIDEO</div>
                                 </div>
                               )}
                               {item.type === "audio" && (
                                 <div className="h-full w-full bg-secondary/10 flex flex-col items-center justify-center relative overflow-hidden">
                                    <MaterialIcon name="mic" className="text-[48px] text-secondary drop-shadow-sm group-hover:scale-110 transition-transform" filled />
                                    <div className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-secondary/40 text-white rounded text-[9px] font-data-mono backdrop-blur-md uppercase">AUDIO</div>
                                 </div>
                               )}
                               {item.type === "drawing" && (
                                 <div className="h-full w-full bg-surface-container-lowest flex flex-col items-center justify-center relative overflow-hidden">
                                        {item.content?.preview ? (
                                          <img src={item.content.preview} alt="Croquis" className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-500" />
                                        ) : (
                                      <>
                                        <MaterialIcon name="architecture" className="text-[42px] text-secondary/30 mb-2 group-hover:scale-110 transition-transform" />
                                        <span className="text-[11px] font-bold text-primary">CROQUIS TÉCNICO</span>
                                      </>
                                    )}
                                    <div className="absolute top-2 left-2 px-2 py-0.5 bg-secondary-container text-on-secondary-container rounded text-[9px] font-bold shadow-sm uppercase">Anotado</div>
                                 </div>
                               )}
                               </div>
                               
                               <div className={cn(
                                  "p-4 transition-all duration-300",
                                  viewMode === "grid" 
                                    ? "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent translate-y-2 group-hover:translate-y-0" 
                                    : "relative flex-1 bg-white flex flex-col justify-center min-w-0"
                                )}>
                                  <p className={cn(
                                     "font-data-mono truncate mb-0.5",
                                     viewMode === "grid" ? "text-[11px] text-white" : "text-sm text-primary font-bold"
                                   )}>
                                    {item.metadata?.fileName || `${item.type.toUpperCase()}_${item.id.slice(-4)}`}
                                  </p>
                                  {item.metadata?.description && (
                                    <p className={cn(
                                       "line-clamp-1 mb-1",
                                       viewMode === "grid" ? "text-[9px] text-white/80" : "text-xs text-on-surface-variant"
                                     )}>{item.metadata.description}</p>
                                  )}
                                  <p className={cn(
                                     "font-label-caps tracking-wider",
                                     viewMode === "grid" ? "text-[9px] text-white/60" : "text-[10px] text-on-surface-variant/60"
                                   )}>
                                    {new Date(item.createdAt).toLocaleDateString([], {month: 'short', day: 'numeric'})} • {new Date(item.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                  </p>
                               </div>

                               <div className={cn(
                                  "absolute flex gap-2 transition-all duration-300",
                                  viewMode === "grid" 
                                    ? "top-3 right-3 flex-col opacity-100 sm:opacity-0 sm:group-hover:opacity-100 translate-x-0 sm:translate-x-2 sm:group-hover:translate-x-0" 
                                    : "right-4 top-4 sm:top-1/2 sm:-translate-y-1/2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 translate-x-0 sm:translate-x-4 sm:group-hover:translate-x-0"
                                )}>
                                  <button 
                                    title="Visualizar"
                                    onClick={() => setPreviewItem(item)}
                                    className="h-9 w-9 bg-white/90 backdrop-blur-sm text-primary rounded-xl shadow-lg flex items-center justify-center hover:bg-white hover:scale-105 active:scale-95 transition-all border border-outline-variant/30"
                                  >
                                    <MaterialIcon name="visibility" className="text-[18px]" />
                                  </button>
                                  <button 
                                    title={item.type === "drawing" ? "Editar Metadatos" : "Renombrar"}
                                    onClick={() => {
                                      setRenamingItem(item)
                                      setEditNameValue(item.metadata?.fileName || "")
                                      setEditDescriptionValue(item.metadata?.description || "")
                                    }}
                                    className="h-9 w-9 bg-white/90 backdrop-blur-sm text-secondary rounded-xl shadow-lg flex items-center justify-center hover:bg-white hover:scale-105 active:scale-95 transition-all border border-outline-variant/30"
                                  >
                                    <MaterialIcon name="edit" className="text-[18px]" />
                                  </button>
                                  <button 
                                    title="Eliminar"
                                    onClick={() => {
                                      setDeletingItem(item)
                                    }}
                                    className="h-9 w-9 bg-white/90 backdrop-blur-sm text-error rounded-xl shadow-lg flex items-center justify-center hover:bg-white hover:scale-105 active:scale-95 transition-all border border-outline-variant/30"
                                  >
                                    <MaterialIcon name="delete" className="text-[18px]" />
                                  </button>
                               </div>
                            </div>
                         ))}

                      </div>

                      <div className="mt-10 pt-6 border-t border-outline-variant flex items-center justify-center">
                         <button className="px-8 py-3 border-2 border-outline-variant text-primary font-title-sm text-sm font-bold rounded-xl hover:bg-surface-container-low hover:border-primary/30 transition-all flex items-center gap-2">
                            <MaterialIcon name="expand_more" />
                            Cargar evidencias antiguas
                         </button>
                      </div>
                   </section>
                </div>
             </main>
           ) : (
             <div className="h-full bg-surface-container-lowest animate-in slide-in-from-right duration-300">
               <TaskDrawingCanvas
                 key={drawingScene?.updatedAt ?? task.id}
                 scene={drawingScene}
                 title="Pizarra Técnica"
                 description="El croquis se guardará como evidencia vinculada a esta tarea."
                 saveLabel="Finalizar Dibujo"
                 resetLabel="Limpiar Pizarra"
                 className="h-full"
                 onSave={(draft) => {
                    const nextScene: DrawingScene = { ...draft, updatedAt: new Date().toISOString() }
                    
                    if (editingActivityId) {
                      updateTaskActivity(task.id, editingActivityId, { content: nextScene })
                      const matchingItem = evidence.find(item => item.activityId === editingActivityId)
                      if (matchingItem?.globalId) {
                        updateEvidence(matchingItem.globalId, {
                          base64: nextScene.preview || "",
                          previewBase64: nextScene.preview || ""
                        })
                      }
                    } else {
                       const drawingCount = evidence.filter(e => e.type === "drawing").length + 1
                      const dateStr = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')
                      const defaultName = `CROQUIS_${String(drawingCount).padStart(2, '0')}_${dateStr}`
                      // Usar modal interno en lugar de prompt
                      setInternalPrompt({
                        type: "save_drawing",
                        title: "Nombre del Croquis",
                        value: defaultName,
                        data: { scene: nextScene }
                      })
                      return; // Detener flujo para esperar modal

                      
                    }
                    
                    updateTask(task.id, { drawingScene: nextScene })
                    setEditingActivityId(null)
                    setActiveView("bento")
                 }}
               />
                <button 
                   onClick={() => {
                     setActiveView("bento")
                     setEditingActivityId(null)
                     setDrawingScene(task.drawingScene ?? null) 
                   }}
                   className="absolute top-4 left-4 z-[100] h-12 w-12 flex items-center justify-center rounded-xl bg-white/95 border border-outline-variant shadow-lg text-on-surface-variant hover:text-primary active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                   aria-label="Regresar a detalles"
                 >
                    <MaterialIcon name="arrow_back" className="text-xl" />
                 </button>
             </div>
           )}
        </div>

        {/* Floating Action Button (Sticky Footer Style) */}
        {activeView === "bento" && (
           <div className="sticky bottom-8 left-0 right-0 flex justify-end items-center gap-4 px-8 pb-8 pointer-events-none">
              <button 
                onClick={onClose}
                className="h-14 px-8 bg-white text-primary border-2 border-outline-variant rounded-full font-title-sm text-sm font-bold shadow-xl flex items-center gap-2 hover:bg-surface-container transition-all pointer-events-auto ring-4 ring-white"
              >
                 <MaterialIcon name="arrow_back" />
                 Regresar
              </button>
              <button 
                onClick={() => setShowCompleteModal(true)}
                className="h-14 px-10 bg-primary text-white rounded-full font-title-sm text-sm font-bold shadow-2xl flex items-center gap-3 hover:scale-105 active:scale-95 transition-all pointer-events-auto ring-4 ring-white"
              >
                 <MaterialIcon name="check_circle" filled />
                 Completar Tarea
              </button>
           </div>
         )}
         
         {/* Rename Modal */}
         {renamingItem && (
           <div className="fixed inset-0 z-[110] flex items-center justify-center px-4 bg-primary/60 backdrop-blur-[2px] animate-in fade-in duration-200">
             <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden border border-outline-variant animate-in zoom-in-95 duration-200">
                <div className="px-8 pt-8 pb-4">
                  <div className="flex items-center gap-3 text-secondary mb-2">
                    <MaterialIcon name="edit" className="text-[28px]" />
                    <h2 className="font-headline-md text-[24px] font-bold text-primary">Editar Metadatos</h2>
                  </div>
                  <p className="font-body-md text-sm text-on-surface-variant leading-relaxed">
                    Actualice el nombre y la descripción técnica de la evidencia seleccionada.
                  </p>
                </div>
                
                <div className="px-8 py-6 space-y-6">
                   <div className="space-y-2">
                     <label className="font-label-caps text-[10px] font-bold text-on-surface-variant block uppercase tracking-widest">
                       {renamingItem.type === "drawing" ? "Título del Croquis" : "Nombre del archivo"}
                     </label>
                     <div className="relative group">
                       <input 
                         autoFocus
                         className="w-full h-12 px-4 bg-white border border-outline text-on-surface font-body-md rounded-lg focus:ring-2 focus:ring-secondary/20 focus:border-secondary outline-none transition-all duration-200"
                         type="text" 
                         value={editNameValue}
                         onChange={(e) => setEditNameValue(e.target.value)}
                       />
                       <div className="absolute inset-y-0 right-4 flex items-center text-on-surface-variant">
                         <MaterialIcon name="text_fields" />
                       </div>
                     </div>
                   </div>

                   <div className="space-y-2">
                     <label className="font-label-caps text-[10px] font-bold text-on-surface-variant block uppercase tracking-widest">
                       Descripción de Evidencia
                     </label>
                     <textarea 
                        className="w-full h-24 p-4 bg-white border border-outline text-on-surface font-body-md rounded-lg focus:ring-2 focus:ring-secondary/20 focus:border-secondary outline-none transition-all duration-200 resize-none"
                        value={editDescriptionValue}
                        onChange={(e) => setEditDescriptionValue(e.target.value)}
                        placeholder="Añada una nota técnica..."
                     />
                   </div>

                   {renamingItem.type === "drawing" && (
                      <button 
                        onClick={() => {
                           setEditingActivityId(renamingItem.id)
                           setDrawingScene(renamingItem.content)
                           setActiveView("drawing")
                           setRenamingItem(null)
                        }}
                        className="w-full py-4 bg-secondary/10 border-2 border-dashed border-secondary text-secondary rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-secondary/20 transition-all group"
                      >
                         <MaterialIcon name="architecture" className="group-hover:scale-110 transition-transform" />
                         EDITAR DIBUJO EN PIZARRA
                      </button>
                   )}
                   
                   <div className="flex items-center gap-4 p-4 bg-surface-container rounded-lg border border-outline-variant">
                     <div className="w-16 h-16 rounded overflow-hidden flex-shrink-0 bg-surface-container-highest">
                        {renamingItem.type === "image" ? (
                          <img src={renamingItem.content} className="w-full h-full object-cover" />
                        ) : renamingItem.type === "drawing" ? (
                          <img src={renamingItem.content.preview} className="w-full h-full object-contain" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-primary/10"><MaterialIcon name="movie" /></div>
                        )}
                     </div>
                     <div className="min-w-0">
                       <p className="font-data-mono text-[13px] text-on-surface truncate">{renamingItem.metadata?.fileName || "Archivo"}</p>
                       <p className="text-[11px] text-on-surface-variant">
                         {renamingItem.metadata?.mimeType?.split("/")[1]?.toUpperCase() || "FILE"} • {new Date(renamingItem.createdAt).toLocaleDateString()}
                       </p>
                     </div>
                   </div>
                 </div>

                 <div className="px-8 py-6 bg-surface-container-low flex flex-col sm:flex-row-reverse gap-3 border-t border-outline-variant">
                   <button 
                     onClick={() => {
                       const actId = (renamingItem as any).activityId;
                       const globId = (renamingItem as any).globalId;

                       if (actId) {
                         updateTaskActivity(task.id, actId, {
                           metadata: {
                             ...renamingItem.metadata,
                             fileName: editNameValue,
                             description: editDescriptionValue
                           }
                         });
                       }
                       
                       if (globId) {
                         updateEvidence(globId, {
                           name: editNameValue,
                           caption: editDescriptionValue
                         });
                       }

                       if (!actId && !globId) {
                         updateTaskActivity(task.id, renamingItem.id, {
                           metadata: {
                             ...renamingItem.metadata,
                             fileName: editNameValue,
                             description: editDescriptionValue
                           }
                         });
                       }
                       
                       setRenamingItem(null);
                     }}
                     className="flex-1 h-12 bg-secondary-container hover:bg-secondary text-on-secondary-container hover:text-white font-bold rounded-full transition-colors duration-200 flex items-center justify-center gap-2 shadow-sm"
                   >
                     <MaterialIcon name="check" />
                     Guardar cambios
                   </button>
                   <button 
                     onClick={() => setRenamingItem(null)}
                     className="flex-1 h-12 bg-transparent border border-outline text-on-surface hover:bg-surface-container-high font-semibold rounded-full transition-colors duration-200 flex items-center justify-center gap-2"
                   >
                     Descartar
                   </button>
                 </div>
             </div>
           </div>
         )}

         {/* Delete Confirmation Modal */}
         {deletingItem && (
           <div className="fixed inset-0 z-[110] flex items-center justify-center px-4 bg-primary/60 backdrop-blur-sm animate-in fade-in duration-200">
             <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden border border-outline-variant animate-in zoom-in-95 duration-200">
                <div className="p-8 flex items-start gap-4">
                  <div className="bg-error-container text-error rounded-full p-3 flex items-center justify-center flex-shrink-0">
                    <MaterialIcon name="delete_forever" className="text-[32px]" />
                  </div>
                  <div className="flex-1">
                    <h2 className="font-headline-md text-[24px] font-bold text-primary mb-2">Eliminar Evidencia</h2>
                    <p className="font-body-md text-sm text-on-surface-variant leading-relaxed">
                      Esta acción es irreversible. ¿Está seguro de que desea eliminar permanentemente el archivo <strong className="font-data-mono text-primary">{deletingItem.metadata?.fileName || "esta evidencia"}</strong> del registro de la tarea?
                    </p>
                  </div>
                </div>
                
                <div className="px-8 pb-8">
                  <div className="flex items-center gap-4 bg-surface-container-low p-3 rounded-lg border border-outline-variant">
                    <div className="w-16 h-16 rounded overflow-hidden flex-shrink-0 bg-surface-container-highest">
                       {deletingItem.type === "image" ? (
                         <img src={deletingItem.content} className="w-full h-full object-cover" />
                       ) : deletingItem.type === "drawing" ? (
                         <img src={deletingItem.content.preview} className="w-full h-full object-contain" />
                       ) : (
                         <div className="w-full h-full flex items-center justify-center bg-primary/10"><MaterialIcon name="movie" /></div>
                       )}
                    </div>
                    <div className="min-w-0 overflow-hidden">
                      <p className="font-title-sm text-sm text-primary truncate font-bold">{deletingItem.metadata?.fileName || "Archivo"}</p>
                      <p className="font-body-sm text-[11px] text-on-surface-variant">
                        Subido el {new Date(deletingItem.createdAt).toLocaleDateString()} • {deletingItem.metadata?.mimeType || "Evidence"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-surface-container p-4 flex flex-col sm:flex-row-reverse gap-3">
                  <button 
                    onClick={() => {
                      const actId = (deletingItem as any).activityId;
                      const globId = (deletingItem as any).globalId;
                      if (actId) removeTaskActivity(task.id, actId);
                      if (globId) deleteEvidence(globId);
                      if (!actId && !globId) removeTaskActivity(task.id, deletingItem.id);
                      setDeletingItem(null);
                    }}
                    className="flex-1 bg-error text-white h-12 px-6 rounded-lg font-title-sm text-sm font-bold flex items-center justify-center active:scale-95 transition-transform"
                  >
                    Eliminar
                  </button>
                  <button 
                    onClick={() => setDeletingItem(null)}
                    className="flex-1 bg-white border border-outline text-primary h-12 px-6 rounded-lg font-title-sm text-sm font-bold flex items-center justify-center hover:bg-surface-container-high active:scale-95 transition-transform"
                  >
                    Conservar archivo
                  </button>
                </div>
             </div>
           </div>
         )}

         {/* Complete Task Modal */}
         {showCompleteModal && (
           <div className="fixed inset-0 z-[110] flex items-center justify-center px-4 bg-primary/60 backdrop-blur-sm animate-in fade-in duration-200">
             <div className="relative w-full max-w-lg bg-surface border border-outline-variant shadow-2xl rounded-xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="bg-surface-container-low px-8 py-6 border-b border-outline-variant">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container">
                      <MaterialIcon name="task_alt" className="text-[24px]" />
                    </div>
                    <h3 className="font-headline-md text-[20px] font-bold text-primary">Confirmar Finalización</h3>
                  </div>
                </div>

                <div className="px-8 py-8">
                  <p className="font-body-md text-sm text-on-surface-variant leading-relaxed">
                    ¿Está seguro de que desea marcar la tarea <strong className="text-primary font-bold">'{task.title}'</strong> como completada? Esta acción notificará al supervisor y cerrará el registro de evidencias.
                  </p>
                  <div className="mt-6 p-4 bg-surface-container-high rounded-lg border border-outline-variant flex items-start gap-3">
                    <MaterialIcon name="info" className="text-secondary text-[20px]" />
                    <div className="font-body-sm text-[12px] text-on-surface">
                      <p className="font-bold mb-1">Nota operativa:</p>
                      <p>Una vez finalizada, solo un administrador de Nivel 5 podrá reabrir este registro.</p>
                    </div>
                  </div>
                </div>

                <div className="px-8 pb-8 flex flex-col gap-3">
                  <button 
                    onClick={() => {
                      updateTask(task.id, { status: "done" })
                      setShowCompleteModal(false)
                      onClose()
                    }}
                    className="w-full h-12 bg-secondary text-on-secondary rounded-lg font-title-sm text-sm font-bold shadow-md active:scale-95 transition-transform"
                  >
                    Confirmar y Finalizar
                  </button>
                  <button 
                    onClick={() => setShowCompleteModal(false)}
                    className="w-full h-12 border border-outline text-on-surface-variant rounded-lg font-title-sm text-sm hover:bg-surface-container-high transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
                
                <button 
                  onClick={() => setShowCompleteModal(false)}
                  className="absolute top-4 right-4 p-2 text-on-surface-variant hover:text-primary transition-colors"
                >
                  <MaterialIcon name="close" />
                </button>
             </div>
           </div>
         )}

         {/* Media Preview Lightbox */}
         {previewItem && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 sm:p-10 animate-in fade-in duration-300">
               <div className="absolute top-6 right-6 flex items-center gap-3">
                  <button 
                    onClick={() => handleDownload(previewItem)}
                    className="h-12 px-5 flex items-center gap-2 rounded-full bg-secondary text-white hover:bg-secondary-fixed-dim transition-all border border-secondary shadow-lg font-bold text-sm cursor-pointer border-none"
                    title="Descargar archivo"
                  >
                     <MaterialIcon name="download" className="text-[20px]" />
                     <span>Descargar</span>
                  </button>
                  <button onClick={() => setPreviewItem(null)} className="h-12 w-12 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-all border border-white/20 cursor-pointer">
                     <MaterialIcon name="close" className="text-[24px]" />
                  </button>
                </div>
               <div className="w-full max-w-5xl h-full flex flex-col items-center justify-center gap-6">
                  {previewItem.type === "image" && (
                    <img src={previewItem.content} alt="Preview" className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl ring-1 ring-white/20" />
                  )}
                  {previewItem.type === "video" && (
                    <div className="w-full max-w-4xl aspect-video bg-black rounded-lg overflow-hidden shadow-2xl flex items-center justify-center border border-white/10">
                       <video 
                          src={previewItem.content} 
                          controls 
                          autoPlay 
                          className="w-full h-full object-contain"
                       />
                    </div>
                  )}
                  {previewItem.type === "audio" && (
                    <div className="w-full max-w-md bg-surface-container rounded-2xl p-8 flex flex-col items-center gap-6 shadow-2xl border border-white/10">
                       <div className="w-24 h-24 rounded-full bg-secondary/20 flex items-center justify-center text-secondary animate-pulse">
                          <MaterialIcon name="mic" className="text-[48px]" filled />
                       </div>
                       <div className="w-full space-y-4">
                          <audio src={previewItem.content} controls className="w-full" />
                          <p className="text-center text-on-surface-variant font-data-mono text-[10px] uppercase tracking-widest">Control de audio técnico</p>
                       </div>
                    </div>
                  )}
                  {previewItem.type === "drawing" && (
                    <div className="w-full max-w-4xl aspect-video bg-white rounded-lg overflow-hidden shadow-2xl border border-white/10 flex items-center justify-center p-4">
                       <DrawingPreview scene={previewItem.content} className="w-full h-full" />
                    </div>
                  )}
                  <div className="text-center max-w-2xl px-6 bg-black/40 backdrop-blur-md p-6 rounded-2xl border border-white/10">
                     <p className="text-white font-headline-md text-xl mb-2">{previewItem.metadata?.fileName || "Archivo de evidencia"}</p>
                     {previewItem.metadata?.description && (
                       <p className="text-white/80 text-sm mb-4 leading-relaxed italic border-l-2 border-secondary pl-4 py-1">"{previewItem.metadata.description}"</p>
                     )}
                     <div className="flex items-center justify-center gap-3 text-white/40 text-[10px] font-data-mono uppercase tracking-[0.2em]">
                        <span>{formatDateTime(previewItem.createdAt)}</span>
                        <span>•</span>
                        <span>REF: {previewItem.id.slice(-8).toUpperCase()}</span>
                     </div>
                  </div>
               </div>
            </div>
         )}

         {uploading && (
            <div className="fixed inset-0 z-[190] flex items-center justify-center px-4 bg-primary/70 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="w-full max-w-sm rounded-2xl border border-outline-variant bg-surface p-6 text-center shadow-2xl">
                <div className="mx-auto mb-4 h-12 w-12 rounded-full border-4 border-secondary/20 border-t-secondary animate-spin" />
                <h3 className="font-title-sm text-title-sm text-primary">Subiendo evidencia</h3>
                <p className="mt-2 text-sm text-on-surface-variant">
                  No cierres esta ventana mientras se procesa {uploadingFileName ?? "el archivo"}.
                </p>
              </div>
            </div>
         )}

          {internalPrompt && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 bg-primary/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-outline-variant animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-outline-variant bg-surface-container-low">
                   <h3 className="font-bold text-primary flex items-center gap-2">
                     <MaterialIcon name={internalPrompt.type === "upload_media" ? "description" : "architecture"} className="text-secondary" />
                     {internalPrompt.title}
                   </h3>
                </div>
                
                <div className="p-6">
                  {internalPrompt.type === "upload_media" && (
                    <div className="space-y-5">
                      <div className="flex items-center gap-4 p-3 bg-surface-container rounded-xl border border-outline-variant">
                        <div className="w-20 h-20 rounded-lg overflow-hidden bg-black shrink-0">
                          {internalPrompt.data.type === "image" ? (
                            <img src={internalPrompt.data.base64} className="w-full h-full object-cover" />
                          ) : internalPrompt.data.type === "video" ? (
                            <div className="w-full h-full flex items-center justify-center text-white"><MaterialIcon name="movie" /></div>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-secondary bg-secondary/10"><MaterialIcon name="mic" /></div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Vista previa</p>
                          <p className="text-sm text-primary font-bold truncate">{internalPrompt.data.fileName}</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">
                          Nombre de la evidencia
                        </label>
                        <input
                          autoFocus
                          id="internal-media-name"
                          type="text"
                          defaultValue={internalPrompt.value}
                          className="w-full h-12 px-4 bg-surface-container-low border border-outline rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">
                          Descripción de la evidencia
                        </label>
                        <textarea
                          id="internal-media-textarea"
                          placeholder="Escriba aquí los detalles observados..."
                          className="w-full h-32 p-4 bg-surface-container-low border border-outline rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none text-sm"
                        />
                      </div>
                    </div>
                  )}

                  {internalPrompt.type === "save_drawing" ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">
                          Nombre del croquis
                        </label>
                        <input 
                          autoFocus
                          id="internal-modal-input"
                          type="text"
                          defaultValue={internalPrompt.value}
                          className="w-full h-12 px-4 bg-surface-container-low border border-outline rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const desc = (document.getElementById('internal-modal-textarea') as HTMLTextAreaElement)?.value
                              handleFinishInternalPrompt(e.currentTarget.value, desc)
                            }
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">
                          Descripción (Opcional)
                        </label>
                        <textarea 
                          id="internal-modal-textarea"
                          placeholder="Agregue contexto adicional..."
                          className="w-full h-24 p-4 bg-surface-container-low border border-outline rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none text-sm"
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">
                        Descripción de la evidencia
                      </label>
                      <textarea 
                        autoFocus
                        id="internal-modal-textarea"
                        placeholder="Escriba aquí los detalles observados..."
                        className="w-full h-32 p-4 bg-surface-container-low border border-outline rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none text-sm"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault()
                            handleFinishInternalPrompt(e.currentTarget.value)
                          }
                        }}
                      />
                    </>
                  )}
                  
                  <p className="mt-3 text-[10px] text-on-surface-variant italic">
                    {internalPrompt.type === "upload_media" 
                      ? "El nombre y la descripción se guardarán junto con la evidencia." 
                      : "Este nombre se usará para identificar el croquis en la lista."}
                  </p>
                </div>

                <div className="p-4 bg-surface-container flex flex-col sm:flex-row-reverse gap-2 border-t border-outline-variant">
                   <button 
                     onClick={() => {
                        if (internalPrompt.type === "upload_media") {
                          const name = (document.getElementById('internal-media-name') as HTMLInputElement)?.value || ""
                          const desc = (document.getElementById('internal-media-textarea') as HTMLTextAreaElement)?.value || ""
                          handleFinishInternalPrompt(name, desc)
                          return
                        }
                        const val = (document.getElementById('internal-modal-input') as HTMLInputElement)?.value || 
                                   (document.getElementById('internal-modal-textarea') as HTMLTextAreaElement)?.value
                        const desc = (document.getElementById('internal-modal-textarea') as HTMLTextAreaElement)?.value
                        handleFinishInternalPrompt(val || "", desc)
                     }}
                     className="flex-1 h-11 bg-primary text-white font-bold rounded-xl shadow-md hover:opacity-90 active:scale-95 transition-all"
                   >
                     Confirmar
                   </button>
                   <button 
                     onClick={() => setInternalPrompt(null)}
                     className="flex-1 h-11 bg-white border border-outline text-on-surface-variant font-bold rounded-xl hover:bg-surface-container-high transition-colors"
                   >
                     Cancelar
                   </button>
                </div>
              </div>
            </div>
          )}

      </div>

      <EscalateTaskModal
        open={escalateOpen}
        taskId={task.id}
        onClose={() => setEscalateOpen(false)}
      />
    </div>
  )
}

function ActivityItem({ activity, onPreview }: { activity: TaskActivity; onPreview?: (a: TaskActivity) => void }) {
  const isMedia = activity.type === "image" || activity.type === "video" || activity.type === "audio"
  const isDrawing = activity.type === "drawing"

  return (
    <div className="flex flex-col gap-2 group">
      <div className="flex items-center justify-between px-1">
         <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-surface-container-high flex items-center justify-center text-primary">
               <MaterialIcon name={activity.type === "note" ? "notes" : activity.type === "drawing" ? "architecture" : activity.type === "audio" ? "mic" : "photo"} className="text-[14px]" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/60">
               {activity.type === "note" ? "Nota Técnica" : activity.type === "drawing" ? "Dibujo técnico" : activity.type === "audio" ? "Evidencia de audio" : "Evidencia visual"}
            </span>
         </div>
         <span className="text-[10px] font-data-mono text-on-surface-variant/50">
            {formatDateTime(activity.createdAt)}
         </span>
      </div>

      <div className={cn("rounded-2xl border border-outline-variant shadow-sm overflow-hidden", 
        activity.type === "note" ? "bg-surface p-4" : "bg-surface-container-low")}>
        {activity.type === "note" && (
           <p className="text-body-md text-on-surface whitespace-pre-wrap">{activity.content}</p>
        )}

        {(isMedia || isDrawing) && (
           <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
              {activity.type === "image" && (
                <img src={activity.content} alt="Evidencia" className="h-full w-full object-contain" />
              )}
              {activity.type === "video" && (
                <div className="text-white flex flex-col items-center gap-2">
                   <MaterialIcon name="play_circle" className="text-[48px] opacity-70" />
                   <span className="text-xs font-data-mono">VIDEO: {activity.metadata?.fileName}</span>
                </div>
              )}
              {activity.type === "audio" && (
                <div className="text-secondary flex flex-col items-center gap-2">
                   <MaterialIcon name="mic" className="text-[48px] opacity-70" filled />
                   <span className="text-xs font-data-mono">AUDIO: {activity.metadata?.fileName}</span>
                </div>
              )}
              {activity.type === "drawing" && (
                 <div 
                   className="h-full w-full bg-white flex items-center justify-center p-4 cursor-pointer hover:bg-surface-container-lowest transition-colors"
                   onClick={() => onPreview?.(activity)}
                 >
                    <DrawingPreview scene={activity.content} className="w-full h-full" />
                 </div>
              )}
           </div>
        )}

        {activity.metadata?.description && (
           <div className="p-3 border-t border-outline-variant/30 bg-white/50 backdrop-blur-sm">
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                <span className="font-bold text-primary mr-1">Nota:</span>
                "{activity.metadata.description}"
              </p>
           </div>
        )}
      </div>
    </div>
  )
}
 
 function DrawingPreview({ scene, className }: { scene: any; className?: string }) {
   if (!scene) {
     return (
       <div className={cn("flex flex-col items-center justify-center gap-2 text-on-surface-variant/30", className)}>
         <MaterialIcon name="draw" className="text-[48px]" />
         <span className="text-xs italic">Dibujo vacío</span>
       </div>
     )
   }

   if ((!scene.elements || scene.elements.length === 0) && scene.preview) {
     return (
       <img 
         src={scene.preview} 
         alt="Croquis estático" 
         className={cn("w-full h-full object-contain p-2", className)} 
       />
     )
   }

   if (!scene.elements || scene.elements.length === 0) {
     return (
       <div className={cn("flex flex-col items-center justify-center gap-2 text-on-surface-variant/30", className)}>
         <MaterialIcon name="draw" className="text-[48px]" />
         <span className="text-xs italic">Dibujo vacío</span>
       </div>
     )
   }
 
   const SCALE = 2000 // Scale normalized 0-1 coords to a virtual space
   const elements = scene.elements
   let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
 
   // Transform and calculate bounds
   const transformedElements = elements.map((el: any) => {
     const transformed = { ...el }
     if (el.kind === "stroke" && el.points) {
       transformed.points = el.points.map((p: any) => ({ x: p.x * SCALE, y: p.y * SCALE }))
       transformed.points.forEach((p: any) => {
         minX = Math.min(minX, p.x); minY = Math.min(minY, p.y)
         maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y)
       })
     } else if (el.kind === "line") {
       transformed.from = { x: el.from.x * SCALE, y: el.from.y * SCALE }
       transformed.to = { x: el.to.x * SCALE, y: el.to.y * SCALE }
       minX = Math.min(minX, transformed.from.x, transformed.to.x); minY = Math.min(minY, transformed.from.y, transformed.to.y)
       maxX = Math.max(maxX, transformed.from.x, transformed.to.x); maxY = Math.max(maxY, transformed.from.y, transformed.to.y)
     } else if (el.kind === "text") {
       transformed.position = { x: el.position.x * SCALE, y: el.position.y * SCALE }
       minX = Math.min(minX, transformed.position.x); minY = Math.min(minY, transformed.position.y)
       maxX = Math.max(maxX, transformed.position.x + (el.text.length * el.fontSize)); maxY = Math.max(maxY, transformed.position.y + el.fontSize)
     }
     return transformed
   })
 
   if (minX === Infinity) {
     minX = 0; minY = 0; maxX = SCALE; maxY = SCALE
   } else {
     // Add padding
     const pad = 100
     minX -= pad; minY -= pad; maxX += pad; maxY += pad
   }
   
   const width = maxX - minX
   const height = maxY - minY
 
   return (
     <svg 
       viewBox={`${minX} ${minY} ${width} ${height}`}
       preserveAspectRatio="xMidYMid meet"
       className={className}
     >
       {transformedElements.map((el: any) => {
         if (el.kind === "stroke") {
           return (
             <path 
               key={el.id}
               d={el.points.map((p: any, j: number) => `${j === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')}
               stroke={el.stroke}
               strokeWidth={el.strokeWidth}
               fill="none"
               strokeLinecap="round"
               strokeLinejoin="round"
             />
           )
         }
         if (el.kind === "line") {
           return (
             <line 
               key={el.id}
               x1={el.from.x} y1={el.from.y}
               x2={el.to.x} y2={el.to.y}
               stroke={el.stroke}
               strokeWidth={el.strokeWidth}
               strokeLinecap="round"
             />
           )
         }
         if (el.kind === "text") {
           return (
             <text 
               key={el.id}
               x={el.position.x} y={el.position.y}
               fill={el.stroke}
               fontSize={el.fontSize}
               fontFamily="sans-serif"
               dominantBaseline="hanging"
             >
               {el.text}
             </text>
           )
         }
         return null
       })}
     </svg>
   )
 }
