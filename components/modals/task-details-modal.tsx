"use client"

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import { MaterialIcon } from "@/components/ui/material-icon"
import { Avatar } from "@/components/ui/avatar"
import { cn, fileToDataUrl, formatBytes, formatDateTime } from "@/utils/workflow"
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
  const updateTask = useWorkflowStore((state) => state.updateTask)
  const addTaskActivity = useWorkflowStore((state) => state.addTaskActivity)
  const removeTaskActivity = useWorkflowStore((state) => state.removeTaskActivity)

  const [activeView, setActiveView] = useState<"bento" | "drawing">("bento")
  const [drawingScene, setDrawingScene] = useState<DrawingScene | null>(task?.drawingScene ?? null)
  const [uploading, setUploading] = useState(false)
  const [showAddChoice, setShowAddChoice] = useState(false)
  const [noteText, setNoteText] = useState("")
  const [isAddingNote, setIsAddingNote] = useState(false)
  const [previewItem, setPreviewItem] = useState<TaskActivity | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) return
    setDrawingScene(task?.drawingScene ?? null)
    setActiveView("bento")
    setShowAddChoice(false)
    setIsAddingNote(false)
    setPreviewItem(null)
  }, [open, task?.drawingScene, taskId])
  
  // ... (rest of helper functions same as before)
  const assignees = useMemo(() => {
    if (!task) return []
    return task.assigneeIds
      .map((id) => technicians.find((t) => t.id === id))
      .filter(Boolean) as typeof technicians
  }, [task, technicians])

  if (!open || !task) return null

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
      for (const file of Array.from(files)) {
        const base64 = await fileToDataUrl(file)
        const type = file.type.startsWith("video/") ? "video" : "image"
        
        const fileName = prompt(`Nombre para el archivo (${file.name}):`, file.name) || file.name
        const description = prompt(`Descripción para "${fileName}":`, "") || ""

        addTaskActivity(task.id, type, base64, {
          fileName,
          mimeType: file.type,
          description
        })
      }
      setShowAddChoice(false)
    } finally {
      setUploading(false)
      event.target.value = ""
    }
  }

  const activities = task.activities || []
  const notes = activities.filter(a => a.type === "note")
  const evidence = activities.filter(a => a.type !== "note")

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/80 backdrop-blur-md px-2 sm:px-6 py-4 overflow-y-auto">
      <div className="relative w-full max-w-7xl min-h-[90vh] flex flex-col rounded-3xl bg-surface shadow-2xl overflow-hidden border border-white/20 animate-in fade-in zoom-in duration-300">
        
        {/* Header Section */}
        <header className="sticky top-0 z-20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-outline-variant bg-surface/95 backdrop-blur-sm px-6 py-5">
           <div className="flex flex-col">
              <nav className="flex items-center gap-2 text-on-surface-variant mb-1 font-body-sm text-[12px]">
                <button onClick={onClose} className="hover:text-primary flex items-center gap-1 transition-colors">
                  <MaterialIcon name="arrow_back" className="text-[14px]" />
                  <span>Regresar</span>
                </button>
                <MaterialIcon name="chevron_right" className="text-[14px]" />
                <span className="hover:text-primary cursor-pointer hidden sm:inline">Tareas</span>
                <MaterialIcon name="chevron_right" className="text-[14px] hidden sm:inline" />
                <span className="text-primary font-semibold truncate max-w-[200px]">{task.title}</span>
              </nav>
              <div className="flex items-center gap-3">
                 <h2 className="font-display-lg text-headline-md sm:text-display-lg text-primary leading-tight">{task.title}</h2>
                 <span className={cn("hidden sm:inline-block px-3 py-1 rounded-full font-label-caps text-[10px] uppercase tracking-wider shadow-sm", 
                   task.status === "inProgress" ? "bg-secondary-container text-on-secondary-container" : "bg-surface-container-high text-on-surface-variant")}>
                   {task.status === "inProgress" ? "En Progreso" : task.status === "todo" ? "Pendiente" : "Completada"}
                 </span>
              </div>
              <p className="font-data-mono text-[11px] text-on-surface-variant mt-0.5">REF: {task.id.toUpperCase()}</p>
           </div>
           
           <div className="flex items-center gap-3 self-end sm:self-center">
              <button onClick={onClose} className="h-10 w-10 flex items-center justify-center rounded-full bg-surface-container hover:bg-surface-container-high transition-colors shadow-sm">
                <MaterialIcon name="close" />
              </button>
           </div>
        </header>

        {/* Workspace Layout */}
        <div className="flex-1 min-h-0 overflow-y-auto">
           {activeView === "bento" ? (
             <main className="p-6 grid grid-cols-12 gap-6 max-w-[1400px] mx-auto">
                
                {/* Left Column: Info & Notes */}
                <div className="col-span-12 lg:col-span-4 space-y-6">
                   
                   {/* Task Information Card */}
                   <section className="bg-white border border-outline-variant p-6 rounded-2xl shadow-sm overflow-hidden relative">
                      <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                      <h3 className="font-title-sm text-title-sm text-primary mb-5 flex items-center gap-2">
                         <MaterialIcon name="info" className="text-secondary" filled />
                         Información de Tarea
                      </h3>
                      
                      <div className="space-y-6">
                         <div>
                            <p className="font-label-caps text-[10px] text-on-surface-variant uppercase mb-2 tracking-widest">Instrucciones</p>
                            <p className="font-body-md text-body-md leading-relaxed text-on-surface">{task.description}</p>
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
                         </div>

                         <div className="pt-4 border-t border-outline-variant">
                            <p className="font-label-caps text-[10px] text-on-surface-variant uppercase mb-3 tracking-widest">Asignado a</p>
                            {assignees.map(tech => (
                              <div key={tech.id} className="flex items-center gap-3 bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/50 mb-2 last:mb-0 group hover:border-secondary transition-colors">
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
                         </div>
                      </div>
                   </section>

                   {/* Technical Notes Card */}
                   <section className="bg-white border border-outline-variant p-6 rounded-2xl shadow-sm">
                      <div className="flex items-center justify-between mb-5">
                         <h3 className="font-title-sm text-title-sm text-primary flex items-center gap-2">
                            <MaterialIcon name="description" className="text-secondary" filled />
                            Notas Técnicas
                         </h3>
                         <button className="text-secondary font-label-caps text-[10px] uppercase hover:underline tracking-wider">Ver Historial</button>
                      </div>
                      
                      <div className="space-y-4">
                         {notes.map(note => (
                           <div key={note.id} className="p-4 bg-surface-container-low rounded-xl border-l-4 border-secondary shadow-sm">
                              <p className="font-body-sm text-sm text-on-surface italic mb-3">"{note.content}"</p>
                              <div className="flex justify-between items-center text-[10px] text-on-surface-variant/70 font-data-mono">
                                 <span>ADMIN • {new Date(note.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                 <MaterialIcon name="more_horiz" className="text-[18px]" />
                              </div>
                           </div>
                         ))}

                         {isAddingNote ? (
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
                         ) : (
                           <button 
                             onClick={() => setIsAddingNote(true)}
                             className="w-full py-4 border-2 border-dashed border-outline-variant rounded-xl text-on-surface-variant font-title-sm text-sm flex items-center justify-center gap-2 hover:bg-secondary/5 hover:border-secondary/50 hover:text-secondary transition-all group"
                           >
                              <MaterialIcon name="add_comment" className="group-hover:scale-110 transition-transform" />
                              Agregar Observación
                           </button>
                         )}
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
                            <button className="p-2 bg-white text-primary rounded-lg shadow-sm"><MaterialIcon name="grid_view" className="text-[20px]" /></button>
                            <button className="p-2 text-on-surface-variant hover:bg-white hover:text-primary rounded-lg transition-all"><MaterialIcon name="list" className="text-[20px]" /></button>
                         </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                         
                         {/* Add Evidence Choice / Dropzone */}
                         <div className="relative aspect-square rounded-2xl border-2 border-dashed border-secondary bg-secondary/5 overflow-hidden group">
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
                                       onClick={() => setActiveView("drawing")}
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
                                           <p className="text-[9px] text-on-surface-variant">Sube fotos o videos</p>
                                        </div>
                                     </button>
                                  </div>
                               </div>
                            )}
                            <input ref={fileInputRef} type="file" accept="image/*,video/*" capture="environment" multiple className="hidden" onChange={handleUpload} />
                         </div>

                         {/* Evidence Grid Items */}
                         {evidence.map(item => (
                            <div key={item.id} className="group relative aspect-square rounded-2xl overflow-hidden border border-outline-variant bg-surface-container-highest shadow-sm">
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
                               {item.type === "drawing" && (
                                 <div className="h-full w-full bg-surface-container-lowest flex flex-col items-center justify-center relative overflow-hidden">
                                    {item.content?.preview ? (
                                      <img src={item.content.preview} alt="Croquis" className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500" />
                                    ) : (
                                      <>
                                        <MaterialIcon name="architecture" className="text-[42px] text-secondary/30 mb-2 group-hover:scale-110 transition-transform" />
                                        <span className="text-[11px] font-bold text-primary">CROQUIS TÉCNICO</span>
                                      </>
                                    )}
                                    <div className="absolute top-2 left-2 px-2 py-0.5 bg-secondary-container text-on-secondary-container rounded text-[9px] font-bold shadow-sm uppercase">Anotado</div>
                                 </div>
                               )}
                               
                               <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                                  <p className="font-data-mono text-[11px] text-white truncate mb-0.5">
                                    {item.metadata?.fileName || `${item.type.toUpperCase()}_${item.id.slice(-4)}`}
                                  </p>
                                  {item.metadata?.description && (
                                    <p className="text-[9px] text-white/80 line-clamp-1 mb-1">{item.metadata.description}</p>
                                  )}
                                  <p className="font-label-caps text-[9px] text-white/60 tracking-wider">
                                    {new Date(item.createdAt).toLocaleDateString([], {month: 'short', day: 'numeric'})} • {new Date(item.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                  </p>
                               </div>

                               <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                                  <button 
                                    onClick={() => {
                                      if (item.type === "drawing" && typeof item.content === "object") {
                                         setDrawingScene(item.content)
                                         setActiveView("drawing")
                                      } else {
                                         setPreviewItem(item)
                                      }
                                    }}
                                    className="h-9 w-9 bg-white/90 backdrop-blur-sm text-primary rounded-xl shadow-lg flex items-center justify-center hover:bg-white hover:scale-105 active:scale-95 transition-all"
                                  >
                                    <MaterialIcon name="visibility" className="text-[18px]" />
                                  </button>
                                  <button 
                                    onClick={() => {
                                      if (confirm("¿Estás seguro de que quieres eliminar esta evidencia?")) {
                                        removeTaskActivity(task.id, item.id)
                                      }
                                    }}
                                    className="h-9 w-9 bg-white/90 backdrop-blur-sm text-error rounded-xl shadow-lg flex items-center justify-center hover:bg-white hover:scale-105 active:scale-95 transition-all"
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
                   const drawingCount = evidence.filter(e => e.type === "drawing").length + 1
                   const dateStr = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')
                   const defaultName = `CROQUIS_${String(drawingCount).padStart(2, '0')}_${dateStr}`
                   
                   const fileName = prompt("Nombre del croquis:", defaultName) || defaultName
                   
                   const nextScene: DrawingScene = { ...draft, updatedAt: new Date().toISOString() }
                   updateTask(task.id, { drawingScene: nextScene })
                   addTaskActivity(task.id, "drawing", nextScene, { fileName })
                   setActiveView("bento")
                 }}
               />
               <button 
                 onClick={() => {
                   setActiveView("bento")
                   setDrawingScene(task.drawingScene ?? null) // Reset to main scene if cancelled
                 }}
                 className="absolute top-4 left-4 z-[100] h-10 w-10 flex items-center justify-center rounded-xl bg-white/90 backdrop-blur-sm border border-outline-variant shadow-lg text-on-surface-variant hover:text-primary transition-all"
               >
                  <MaterialIcon name="arrow_back" />
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
                onClick={() => {
                  updateTask(task.id, { status: "done" })
                  onClose()
                }}
                className="h-14 px-10 bg-primary text-white rounded-full font-title-sm text-sm font-bold shadow-2xl flex items-center gap-3 hover:scale-105 active:scale-95 transition-all pointer-events-auto ring-4 ring-white"
              >
                 <MaterialIcon name="check_circle" filled />
                 Completar Tarea
              </button>
           </div>
        )}

        {/* Media Preview Lightbox */}
        {previewItem && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 sm:p-10 animate-in fade-in duration-300">
              <button onClick={() => setPreviewItem(null)} className="absolute top-6 right-6 h-12 w-12 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-all">
                 <MaterialIcon name="close" className="text-[24px]" />
              </button>
              <div className="w-full max-w-5xl h-full flex flex-col items-center justify-center gap-6">
                 {previewItem.type === "image" && (
                   <img src={previewItem.content} alt="Preview" className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl" />
                 )}
                 {previewItem.type === "video" && (
                   <div className="w-full aspect-video bg-black rounded-lg overflow-hidden shadow-2xl flex items-center justify-center">
                      <MaterialIcon name="play_circle" className="text-[64px] text-white opacity-50" />
                      <p className="absolute mt-24 text-white/50 font-data-mono text-sm">Reproductor de video no disponible en demo</p>
                   </div>
                 )}
                 <div className="text-center max-w-2xl px-6">
                    <p className="text-white font-title-sm text-lg mb-1">{previewItem.metadata?.fileName || "Archivo de evidencia"}</p>
                    {previewItem.metadata?.description && (
                      <p className="text-white/80 text-sm mb-4 leading-relaxed italic bg-white/5 p-3 rounded-lg border border-white/10">"{previewItem.metadata.description}"</p>
                    )}
                    <p className="text-white/50 text-xs font-data-mono uppercase tracking-widest">{formatDateTime(previewItem.createdAt)}</p>
                 </div>
              </div>
           </div>
        )}
      </div>
    </div>
  )
}

function ActivityItem({ activity }: { activity: TaskActivity }) {
  const isMedia = activity.type === "image" || activity.type === "video"
  const isDrawing = activity.type === "drawing"

  return (
    <div className="flex flex-col gap-2 group">
      <div className="flex items-center justify-between px-1">
         <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-surface-container-high flex items-center justify-center text-primary">
               <MaterialIcon name={activity.type === "note" ? "notes" : activity.type === "drawing" ? "architecture" : "photo"} className="text-[14px]" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/60">
               {activity.type === "note" ? "Nota de campo" : activity.type === "drawing" ? "Dibujo técnico" : "Evidencia visual"}
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
              {activity.type === "drawing" && (
                 <div className="h-full w-full bg-surface-container-lowest flex items-center justify-center text-on-surface-variant/30 italic text-sm p-4">
                    {/* Simplified drawing preview - in a real app we'd render a mini-svg here */}
                    <div className="flex flex-col items-center gap-2">
                       <MaterialIcon name="architecture" className="text-[32px]" />
                       <span>Croquis Técnico Guardado</span>
                       <span className="text-[10px] bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-full not-italic">Ver en Pizarra</span>
                    </div>
                 </div>
              )}
           </div>
        )}
      </div>
    </div>
  )
}
