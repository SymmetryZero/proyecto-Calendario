"use client"

import { useEffect, useMemo, useState } from "react"
import { MaterialIcon } from "@/components/ui/material-icon"
import { cn, formatDateStamp, formatTimeStamp } from "@/utils/workflow"
import { type FolderMode, useWorkflowStore, workflowSelectors } from "@/store/workflow-store"

type SaveProgressModalProps = {
  open: boolean
  onClose: () => void
}

export function SaveProgressModal({ open, onClose }: SaveProgressModalProps) {
  const folders = useWorkflowStore((state) => state.folders)
  const saveProgress = useWorkflowStore((state) => state.saveProgress)

  const [mode, setMode] = useState<FolderMode>("existing")
  const [existingFolderId, setExistingFolderId] = useState<string>("")
  const [newFolderName, setNewFolderName] = useState("")
  const [parentFolderId, setParentFolderId] = useState<string>("")

  const now = useMemo(() => new Date(), [open])
  const dateLabel = formatDateStamp(now)
  const timeLabel = formatTimeStamp(now)

  useEffect(() => {
    if (!open) {
      return
    }

    const defaultFolder = folders[0]
    setMode("existing")
    setExistingFolderId(defaultFolder?.id ?? "")
    setParentFolderId(defaultFolder?.id ?? "")
    setNewFolderName(`Guardado ${dateLabel.replaceAll("/", "-")} ${timeLabel.replaceAll(":", "-")}`)
  }, [dateLabel, folders, open, timeLabel])

  if (!open) {
    return null
  }

  const selectedFolder = workflowSelectors.getFolderById(folders, existingFolderId)
  const selectedFolderPath = workflowSelectors.getFolderPath(folders, existingFolderId)
  const parentFolderPath = workflowSelectors.getFolderPath(folders, parentFolderId || null)

  function handleSave() {
    saveProgress({
      mode,
      folderId: mode === "existing" ? existingFolderId || null : null,
      folderName: mode === "new" ? newFolderName : undefined,
      parentId: mode === "new" ? parentFolderId || null : null
    })

    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/60 backdrop-blur-[2px] px-4">
      <div className="bg-surface-container-lowest w-full max-w-2xl rounded-xl border border-outline-variant flex flex-col overflow-hidden shadow-panel">
        <div className="flex items-center justify-between p-6 border-b border-outline-variant bg-surface">
          <div className="flex items-center gap-3 text-tertiary">
            <MaterialIcon name="save" filled />
            <h2 className="font-headline-md text-headline-md">Guardar progreso</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-on-surface-variant hover:bg-surface-container p-2 rounded-full transition-colors"
          >
            <MaterialIcon name="close" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-start gap-4 p-4 bg-surface border border-outline-variant rounded-lg">
            <MaterialIcon name="schedule" className="text-secondary-container mt-0.5" />
            <div>
              <div className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider mb-1">
                Metadatos autogenerados
              </div>
              <div className="font-data-mono text-data-mono text-on-surface flex flex-wrap gap-3">
                <span className="bg-surface-container-high px-2 py-1 rounded border border-outline-variant">
                  {dateLabel}
                </span>
                <span className="bg-surface-container-high px-2 py-1 rounded border border-outline-variant">
                  {timeLabel}
                </span>
              </div>
            </div>
          </div>

          <fieldset className="space-y-3">
            <legend className="font-title-sm text-title-sm text-on-surface">Destino</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label
                className={cn(
                  "relative flex flex-col p-4 border-2 rounded-lg cursor-pointer transition-colors group",
                  mode === "existing"
                    ? "border-tertiary-container bg-surface-container-low"
                    : "border-outline-variant bg-surface-container-lowest hover:bg-surface"
                )}
              >
                <input
                  checked={mode === "existing"}
                  className="peer sr-only"
                  name="folder_dest"
                  type="radio"
                  value="existing"
                  onChange={() => setMode("existing")}
                />
                <div className="flex justify-between items-start mb-2">
                  <MaterialIcon name="folder_open" filled className="text-tertiary-container" />
                  <MaterialIcon
                    name="check_circle"
                    className={cn(
                      "text-tertiary-container",
                      mode === "existing" ? "opacity-100" : "opacity-0"
                    )}
                    filled={mode === "existing"}
                  />
                </div>
                <span className="font-title-sm text-title-sm text-on-surface">Seleccionar carpeta existente</span>
              </label>

              <label
                className={cn(
                  "relative flex flex-col p-4 border rounded-lg cursor-pointer transition-colors group",
                  mode === "new"
                    ? "border-tertiary-container bg-surface-container-low"
                    : "border-outline-variant bg-surface-container-lowest hover:bg-surface"
                )}
              >
                <input
                  checked={mode === "new"}
                  className="peer sr-only"
                  name="folder_dest"
                  type="radio"
                  value="new"
                  onChange={() => setMode("new")}
                />
                <div className="flex justify-between items-start mb-2">
                  <MaterialIcon name="create_new_folder" />
                  <MaterialIcon
                    name="radio_button_unchecked"
                    className={cn("text-outline transition-opacity", mode === "new" ? "opacity-0" : "opacity-50")}
                  />
                </div>
                <span className="font-title-sm text-title-sm text-on-surface">Guardar en carpeta nueva</span>
              </label>
            </div>
          </fieldset>

          {mode === "existing" ? (
            <div className="space-y-2">
              <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">
                Carpeta destino
              </label>
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <div className="relative">
                  <MaterialIcon
                    name="search"
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-outline"
                  />
                  <input
                    className="w-full h-touch-target-min pl-12 pr-4 bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:border-tertiary-container focus:ring-1 focus:ring-tertiary-container transition-all"
                    readOnly
                    type="text"
                    value={selectedFolderPath}
                  />
                </div>
                <select
                  value={existingFolderId}
                  onChange={(event) => setExistingFolderId(event.target.value)}
                  className="h-touch-target-min rounded-lg border border-outline-variant bg-surface px-4 text-body-md text-on-surface outline-none focus:border-tertiary-container focus:ring-1 focus:ring-tertiary-container"
                >
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {workflowSelectors.getFolderPath(folders, folder.id)}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-sm text-on-surface-variant">
                Carpeta seleccionada: {selectedFolder?.name ?? "Ninguna"}
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">
                  Nombre de la carpeta
                </label>
                <input
                  value={newFolderName}
                  onChange={(event) => setNewFolderName(event.target.value)}
                  className="w-full h-touch-target-min px-4 bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:border-tertiary-container focus:ring-1 focus:ring-tertiary-container transition-all"
                  placeholder="Nombre de carpeta nueva"
                />
              </div>

              <div className="grid gap-2">
                <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">
                  Carpeta principal
                </label>
                <select
                  value={parentFolderId}
                  onChange={(event) => setParentFolderId(event.target.value)}
                  className="w-full h-touch-target-min px-4 bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:border-tertiary-container focus:ring-1 focus:ring-tertiary-container transition-all"
                >
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {workflowSelectors.getFolderPath(folders, folder.id)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-lg border border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface-variant">
                Vista previa: {parentFolderPath} / {newFolderName || "Nueva carpeta"}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-outline-variant bg-surface flex items-center justify-end gap-4">
          <button
            type="button"
            onClick={onClose}
            className="h-touch-target-min px-6 font-title-sm text-title-sm text-on-surface-variant hover:bg-surface-variant rounded-lg transition-colors"
          >
            Descartar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="h-touch-target-min px-8 font-title-sm text-title-sm bg-secondary-container text-on-secondary-container rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 shadow-sm"
          >
            <MaterialIcon name="check" filled />
            Guardar progreso
          </button>
        </div>
      </div>
    </div>
  )
}
