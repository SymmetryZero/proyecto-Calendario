"use client"

import { useMemo, useRef, useState, type ChangeEvent } from "react"
import { MaterialIcon } from "@/components/ui/material-icon"
import { Avatar } from "@/components/ui/avatar"
import { cn, fileToDataUrl, formatDateTime, formatShortDate, formatBytes, makeId } from "@/utils/workflow"
import {
  createEvidencePreview,
  type EvidenceFile,
  useWorkflowStore
} from "@/store/workflow-store"
import { supabase } from "@/utils/supabase"

type EvidenceSectionProps = {
  onCreateTask: () => void
}

const filterOptions = [
  { key: "all", label: "Todos" },
  { key: "photos", label: "Fotos" },
  { key: "videos", label: "Videos" },
  { key: "flagged", label: "Marcadas" }
] as const

function matchesFilter(item: EvidenceFile, filter: (typeof filterOptions)[number]["key"]) {
  if (filter === "all") {
    return true
  }

  if (filter === "photos") {
    return item.mediaType === "image"
  }

  if (filter === "videos") {
    return item.mediaType === "video"
  }

  return item.flagged
}

export function EvidenceSection({ onCreateTask }: EvidenceSectionProps) {
  const evidence = useWorkflowStore((state) => state.evidence)
  const folders = useWorkflowStore((state) => state.folders)
  const addEvidence = useWorkflowStore((state) => state.addEvidence)
  const updateEvidence = useWorkflowStore((state) => state.updateEvidence)
  const deleteEvidence = useWorkflowStore((state) => state.deleteEvidence)
  const toggleEvidenceFlag = useWorkflowStore((state) => state.toggleEvidenceFlag)

  const [filter, setFilter] = useState<(typeof filterOptions)[number]["key"]>("all")
  const [uploading, setUploading] = useState(false)
  const [previewItem, setPreviewItem] = useState<EvidenceFile | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleDownload = (item: EvidenceFile) => {
    const content = item.base64
    if (!content) return

    const fileName = item.name || `EVIDENCIA_${item.id.slice(-4)}`
    
    if (content.startsWith("data:") || content.startsWith("http://") || content.startsWith("https://")) {
      const link = document.createElement("a")
      link.href = content
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } else {
      const mime = item.mimeType || "application/octet-stream"
      const link = document.createElement("a")
      link.href = `data:${mime};base64,${content}`
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const activeFolder = folders.find((folder) => folder.id === "folder-evidence") ?? folders[0] ?? null
  const visibleEvidence = useMemo(
    () => evidence.filter((item) => matchesFilter(item, filter)),
    [evidence, filter]
  )

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files
    if (!files || files.length === 0) {
      return
    }

    setUploading(true)

    try {
      const items = Array.from(files)

      for (const file of items) {
        const mediaType = file.type.startsWith("video/") ? "video" : "image"
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
          // Show alert in development so they can see the exact Supabase error (e.g. permission or RLS issues)
          alert(`Alerta de Supabase Storage:\n${uploadError?.message || "Error de red/conexión"}\n\nSe usará el respaldo local Base64.`)
          fileUrl = await fileToDataUrl(file)
        }

        const previewBase64 =
          mediaType === "video"
            ? createEvidencePreview(file.name, "#004064")
            : fileUrl

        addEvidence({
          mediaType,
          mimeType: file.type || (mediaType === "video" ? "video/mp4" : "image/png"),
          name: file.name,
          base64: fileUrl,
          previewBase64,
          caption: "",
          folderId: activeFolder?.id ?? null,
          linkedTaskId: null,
          size: file.size
        })
      }
    } finally {
      setUploading(false)
      event.target.value = ""
    }
  }

  return (
    <main className="flex-1 p-gutter max-w-[1600px] mx-auto w-full min-h-0 overflow-y-auto scrollbar-thin">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-stack-lg gap-4">
        <div>
          <h2 className="font-display-lg text-display-lg text-on-surface mb-1">Evidencias del sitio</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Gestiona y documenta el material de campo de la Región 4.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="h-[56px] px-8 bg-secondary-container text-on-secondary-container rounded-xl flex items-center gap-2 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 border border-secondary-fixed disabled:opacity-60"
          disabled={uploading}
        >
          <MaterialIcon name="cloud_upload" filled />
          <span className="font-title-sm text-title-sm">{uploading ? "Subiendo..." : "Subir material"}</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={handleUpload}
        />
      </div>

      <div className="flex flex-wrap gap-3 mb-stack-md">
        {filterOptions.map((option) => {
          const isActive = filter === option.key
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => setFilter(option.key)}
              className={cn(
                "h-10 px-4 rounded-full border font-data-mono text-data-mono flex items-center gap-2 transition-colors",
                isActive
                  ? "border-tertiary text-tertiary bg-tertiary-fixed"
                  : "border-outline-variant text-on-surface-variant bg-surface-container-lowest hover:bg-surface-container"
              )}
            >
              {isActive ? <MaterialIcon name="filter_list" className="text-[18px]" /> : null}
              {option.label}
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in duration-300">
        {visibleEvidence.map((item) => (
          <EvidenceCard
            key={item.id}
            item={item}
            onCaptionChange={(nextCaption) => updateEvidence(item.id, { caption: nextCaption })}
            onDelete={() => deleteEvidence(item.id)}
            onToggleFlag={() => toggleEvidenceFlag(item.id)}
            onPreview={() => setPreviewItem(item)}
          />
        ))}
      </div>

      <div className="mt-8 flex justify-center">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className="h-touch-target-min px-6 border border-outline-variant text-on-surface-variant rounded-lg font-title-sm text-title-sm hover:bg-surface-container transition-colors flex items-center gap-2 cursor-pointer border-none"
        >
          <MaterialIcon name="expand_more" />
          Cargar más evidencias
        </button>
      </div>

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
            {previewItem.mediaType === "image" && (
              <img src={previewItem.base64} alt="Preview" className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl ring-1 ring-white/20" />
            )}
            {previewItem.mediaType === "video" && (
              <div className="w-full max-w-4xl aspect-video bg-black rounded-lg overflow-hidden shadow-2xl flex items-center justify-center border border-white/10">
                 <video 
                    src={previewItem.base64} 
                    controls 
                    autoPlay 
                    className="w-full h-full object-contain"
                 />
              </div>
            )}
            <div className="text-center max-w-2xl px-6 bg-black/40 backdrop-blur-md p-6 rounded-2xl border border-white/10">
               <p className="text-white font-headline-md text-xl mb-2">{previewItem.name || "Archivo de evidencia"}</p>
               {previewItem.caption && (
                 <p className="text-white/80 text-sm mb-4 leading-relaxed italic border-l-2 border-secondary pl-4 py-1">"{previewItem.caption}"</p>
               )}
               <div className="flex items-center justify-center gap-3 text-white/40 text-[10px] font-data-mono uppercase tracking-[0.2em]">
                  <span>{formatDateTime(previewItem.createdAt)}</span>
                  <span>•</span>
                  <span>REF: {previewItem.id.toUpperCase()}</span>
               </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

type EvidenceCardProps = {
  item: EvidenceFile
  onCaptionChange: (caption: string) => void
  onDelete: () => void
  onToggleFlag: () => void
  onPreview: () => void
}

function EvidenceCard({ item, onCaptionChange, onDelete, onToggleFlag, onPreview }: EvidenceCardProps) {
  const isVideo = item.mediaType === "video"
  const badgeClass = item.flagged
    ? "text-error bg-error-container border-error/30"
    : isVideo
      ? "text-primary bg-surface/90 border-outline-variant"
      : "text-primary bg-surface/90 border-outline-variant"

  return (
    <article className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden flex flex-col group shadow-sm">
      <div 
        onClick={onPreview}
        className="relative aspect-video bg-surface-container-highest border-b border-outline-variant cursor-pointer group/card overflow-hidden"
      >
        <img
          alt={item.name}
          className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500"
          src={item.previewBase64 ?? item.base64}
        />

        {isVideo ? (
          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center group-hover/card:bg-primary/30 transition-colors">
            <MaterialIcon name="play_circle" className="text-[48px] text-on-primary drop-shadow-md" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/card:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
            <div className="w-12 h-12 rounded-full bg-white/20 border border-white/30 text-white flex items-center justify-center shadow-lg transform scale-90 group-hover/card:scale-100 transition-all duration-300">
              <MaterialIcon name="visibility" className="text-xl" />
            </div>
          </div>
        )}

        <div
          className={cn(
            "absolute top-3 left-3 backdrop-blur-sm px-2 py-1 rounded text-primary font-data-mono text-label-caps border shadow-sm flex items-center gap-1",
            badgeClass
          )}
        >
          <MaterialIcon name={isVideo ? "videocam" : "photo_camera"} className="text-[14px]" />
          {item.flagged ? "MARCADA" : isVideo ? "MP4" : "JPG"}
        </div>

        <div className="absolute top-3 right-3 opacity-100 lg:opacity-0 lg:group-hover/card:opacity-100 transition-opacity flex gap-2 z-10">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onToggleFlag()
            }}
            className="w-8 h-8 bg-surface text-on-surface rounded-full flex items-center justify-center shadow-sm hover:text-error transition-colors border-none cursor-pointer"
            title="Marcar o desmarcar"
          >
            <MaterialIcon name={item.flagged ? "flag" : "outlined_flag"} className="text-[18px]" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="w-8 h-8 bg-surface text-on-surface rounded-full flex items-center justify-center shadow-sm hover:text-error transition-colors border-none cursor-pointer"
            title="Eliminar"
          >
            <MaterialIcon name="delete" className="text-[18px]" />
          </button>
        </div>
      </div>

      <div className="p-4 flex-1 flex flex-col gap-3">
        <div className="flex justify-between items-start gap-3">
          <span className="font-data-mono text-data-mono text-on-surface-variant">ID: {item.id.toUpperCase()}</span>
          <span className="font-data-mono text-data-mono text-on-surface-variant">
            {formatDateTime(item.createdAt)}.
          </span>
        </div>

        <div className="relative mt-auto">
          <label className="sr-only" htmlFor={`caption-${item.id}`}>
            Notas para {item.name}
          </label>
          <textarea
            id={`caption-${item.id}`}
            className={cn(
              "w-full border rounded-lg p-3 font-body-sm text-body-sm text-on-surface focus:ring-1 resize-none transition-colors min-h-[48px]",
            item.flagged
              ? "bg-error-container/20 border-error/50 focus:border-error focus:ring-error placeholder:text-outline"
              : "bg-surface-container-lowest border-outline-variant focus:border-tertiary-container focus:ring-tertiary-container placeholder:text-outline"
          )}
            placeholder="Agrega notas técnicas u observaciones..."
            rows={2}
            value={item.caption}
            onChange={(event) => onCaptionChange(event.target.value)}
          />
          <button
            type="button"
            className={cn(
              "absolute bottom-2 right-2 transition-colors p-1",
              item.flagged ? "text-error hover:text-error-container" : "text-primary hover:text-tertiary-container"
            )}
            title="Guardar notas"
          >
            <MaterialIcon name="save" className="text-[18px]" />
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 text-xs text-on-surface-variant">
          <span>{formatShortDate(item.createdAt)}</span>
          <span>{formatBytes(item.size)}</span>
        </div>
      </div>
    </article>
  )
}
