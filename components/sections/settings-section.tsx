"use client"

import { useMemo } from "react"
import { MaterialIcon } from "@/components/ui/material-icon"
import { formatLongDateTime, formatBytes } from "@/utils/workflow"
import { useWorkflowStore } from "@/store/workflow-store"

export function SettingsSection() {
  const tasks = useWorkflowStore((state) => state.tasks)
  const requirements = useWorkflowStore((state) => state.requirements)
  const evidence = useWorkflowStore((state) => state.evidence)
  const folders = useWorkflowStore((state) => state.folders)
  const assignments = useWorkflowStore((state) => state.assignments)
  const saves = useWorkflowStore((state) => state.saves)
  const resetDemoData = useWorkflowStore((state) => state.resetDemoData)

  const snapshot = useMemo(
    () => ({
      tasks,
      requirements,
      evidence,
      folders,
      assignments,
      saves
    }),
    [assignments, evidence, folders, requirements, saves, tasks]
  )

  const serializedSize = JSON.stringify(snapshot).length
  const lastSave = saves[0] ?? null

  function handleExport() {
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: "application/json"
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `flujo-pro-export-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="flex-1 p-gutter overflow-y-auto scrollbar-thin">
      <div className="flex flex-col gap-6 max-w-6xl">
        <div>
          <h2 className="font-display-lg text-display-lg text-primary">Configuración</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Administra el almacenamiento local, las exportaciones y los datos de demostración sin salir del navegador.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-xl border border-outline-variant bg-surface p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-title-sm text-title-sm text-primary">Almacenamiento local</h3>
              <MaterialIcon name="database" className="text-on-surface-variant" />
            </div>
            <div className="space-y-3 text-sm text-on-surface-variant">
              <div className="flex items-center justify-between">
                <span>Tamaño serializado</span>
                <span className="font-data-mono text-data-mono text-on-surface">
                  {formatBytes(serializedSize)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Tareas</span>
                <span className="font-data-mono text-data-mono text-on-surface">{tasks.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Evidencias</span>
                <span className="font-data-mono text-data-mono text-on-surface">{evidence.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Carpetas</span>
                <span className="font-data-mono text-data-mono text-on-surface">{folders.length}</span>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-outline-variant bg-surface p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-title-sm text-title-sm text-primary">Último guardado</h3>
              <MaterialIcon name="schedule" className="text-on-surface-variant" />
            </div>
            {lastSave ? (
              <div className="space-y-3 text-sm text-on-surface-variant">
                <p className="font-body-sm text-body-sm text-on-surface">{lastSave.folderPath}</p>
                <div className="flex items-center justify-between">
                  <span>Guardado</span>
                  <span className="font-data-mono text-data-mono text-on-surface">
                    {formatLongDateTime(lastSave.createdAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Asignaciones</span>
                  <span className="font-data-mono text-data-mono text-on-surface">
                    {lastSave.counts.assignments}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-on-surface-variant">Aún no hay historial de guardados.</p>
            )}
          </section>

          <section className="rounded-xl border border-outline-variant bg-surface p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-title-sm text-title-sm text-primary">Acciones</h3>
              <MaterialIcon name="settings" className="text-on-surface-variant" />
            </div>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleExport}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary px-4 py-3 font-title-sm text-title-sm text-primary hover:bg-surface-container-low transition-colors"
              >
                <MaterialIcon name="download" />
                Exportar JSON
              </button>
              <button
                type="button"
                onClick={() => resetDemoData()}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-secondary px-4 py-3 font-title-sm text-title-sm text-on-secondary hover:opacity-90 transition-opacity"
              >
                <MaterialIcon name="restart_alt" />
                Restaurar datos de demostración
              </button>
            </div>
          </section>
        </div>

        <section className="rounded-xl border border-outline-variant bg-surface p-6 shadow-sm">
          <h3 className="font-title-sm text-title-sm text-primary mb-4">Guardados recientes</h3>
          <div className="space-y-3">
            {saves.map((save) => (
              <article
                key={save.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-outline-variant bg-surface-container-low p-4"
              >
                <div>
                  <p className="font-title-sm text-title-sm text-on-surface">{save.folderPath}</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    {save.mode === "new" ? "Carpeta nueva" : "Carpeta existente"} · {save.dateLabel} {save.timeLabel}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 font-data-mono text-[12px] text-on-surface-variant">
                  <span className="rounded-full bg-surface px-2 py-1">Tareas {save.counts.tasks}</span>
                  <span className="rounded-full bg-surface px-2 py-1">
                    Requerimientos {save.counts.requirements}
                  </span>
                  <span className="rounded-full bg-surface px-2 py-1">Evidencias {save.counts.evidence}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
