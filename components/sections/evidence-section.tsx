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
  const fileInputRef = useRef<HTMLInputElement | null>(null)

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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {visibleEvidence.map((item) => (
          <EvidenceCard
            key={item.id}
            item={item}
            onCaptionChange={(nextCaption) => updateEvidence(item.id, { caption: nextCaption })}
            onDelete={() => deleteEvidence(item.id)}
            onToggleFlag={() => toggleEvidenceFlag(item.id)}
          />
        ))}
      </div>

      <div className="mt-8 flex justify-center">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className="h-touch-target-min px-6 border border-outline-variant text-on-surface-variant rounded-lg font-title-sm text-title-sm hover:bg-surface-container transition-colors flex items-center gap-2"
        >
          <MaterialIcon name="expand_more" />
          Cargar más evidencias
        </button>
      </div>

      <div className="mt-6 rounded-xl border border-outline-variant bg-surface p-4 text-sm text-on-surface-variant">
        Consejo: las fotos y videos subidos se guardan de forma segura en Supabase Storage, permitiendo que todos los técnicos las visualicen y optimizando el rendimiento.
      </div>
    </main>
  )
}

type EvidenceCardProps = {
  item: EvidenceFile
  onCaptionChange: (caption: string) => void
  onDelete: () => void
  onToggleFlag: () => void
}

function EvidenceCard({ item, onCaptionChange, onDelete, onToggleFlag }: EvidenceCardProps) {
  const isVideo = item.mediaType === "video"
  const badgeClass = item.flagged
    ? "text-error bg-error-container border-error/30"
    : isVideo
      ? "text-primary bg-surface/90 border-outline-variant"
      : "text-primary bg-surface/90 border-outline-variant"

  return (
    <article className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden flex flex-col group shadow-sm">
      <div className="relative aspect-video bg-surface-container-highest border-b border-outline-variant">
        <img
          alt={item.name}
          className="w-full h-full object-cover"
          src={item.previewBase64 ?? item.base64}
        />

        {isVideo ? (
          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-colors cursor-pointer">
            <MaterialIcon name="play_circle" className="text-[48px] text-on-primary drop-shadow-md" />
          </div>
        ) : null}

        <div
          className={cn(
            "absolute top-3 left-3 backdrop-blur-sm px-2 py-1 rounded text-primary font-data-mono text-label-caps border shadow-sm flex items-center gap-1",
            badgeClass
          )}
        >
          <MaterialIcon name={isVideo ? "videocam" : "photo_camera"} className="text-[14px]" />
          {item.flagged ? "MARCADA" : isVideo ? "MP4" : "JPG"}
        </div>

        <div className="absolute top-3 right-3 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity flex gap-2">
          <button
            type="button"
            onClick={onToggleFlag}
            className="w-8 h-8 bg-surface text-on-surface rounded-full flex items-center justify-center shadow-sm hover:text-error transition-colors"
            title="Marcar o desmarcar"
          >
            <MaterialIcon name={item.flagged ? "flag" : "outlined_flag"} className="text-[18px]" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="w-8 h-8 bg-surface text-on-surface rounded-full flex items-center justify-center shadow-sm hover:text-error transition-colors"
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
