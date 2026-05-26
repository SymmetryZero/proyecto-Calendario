"use client"

import { useEffect, useMemo, useState } from "react"
import { MaterialIcon } from "@/components/ui/material-icon"
import { formatLongDateTime, formatBytes, cn } from "@/utils/workflow"
import { useWorkflowStore } from "@/store/workflow-store"
import { PWAInstallModal, usePWAInstall } from "@/components/pwa-install"

type SettingsSectionProps = {
  onSwitchUser?: () => void
}

export function SettingsSection({ onSwitchUser }: SettingsSectionProps) {
  const tasks = useWorkflowStore((state) => state.tasks)
  const requirements = useWorkflowStore((state) => state.requirements)
  const evidence = useWorkflowStore((state) => state.evidence)
  const folders = useWorkflowStore((state) => state.folders)
  const assignments = useWorkflowStore((state) => state.assignments)
  const saves = useWorkflowStore((state) => state.saves)
  const users = useWorkflowStore((state) => state.users)
  const currentUserId = useWorkflowStore((state) => state.currentUserId)
  const setCurrentUser = useWorkflowStore((state) => state.setCurrentUser)
  const updateUser = useWorkflowStore((state) => state.updateUser)
  const resetDemoData = useWorkflowStore((state) => state.resetDemoData)
  const [switchNotice, setSwitchNotice] = useState<string | null>(null)
  const [pwaModalOpen, setPwaModalOpen] = useState(false)
  const { isStandalone, deviceType } = usePWAInstall()

  const deviceLabel = deviceType === "mobile" 
    ? "Celular" 
    : deviceType === "tablet" 
      ? "Tablet" 
      : "PC"

  const currentUser = useMemo(() => 
    users.find(u => u.id === currentUserId) ?? null,
  [users, currentUserId])

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

  useEffect(() => {
    if (!switchNotice) return
    const timer = window.setTimeout(() => setSwitchNotice(null), 2500)
    return () => window.clearTimeout(timer)
  }, [switchNotice])

  function handleSwitchUser(userId: string) {
    const nextUser = users.find((user) => user.id === userId)
    setCurrentUser(userId)
    setSwitchNotice(nextUser?.name ?? "Perfil actualizado")
    onSwitchUser?.()
  }

  function handleExport() {
    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return ""
      let str = String(val)
      str = str.replace(/"/g, '""')
      if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
        return `"${str}"`
      }
      return str
    }

    const headers = [
      "ID Tarea",
      "Título",
      "Descripción",
      "Prioridad",
      "Estado",
      "Ubicación",
      "Área",
      "Creado Por",
      "Técnicos Asignados",
      "Horas Estimadas",
      "Fecha Creación",
      "Fecha Vencimiento",
      "Evidencias Adjuntas"
    ]

    const rows = [headers.map(escapeCSV).join(",")]

    tasks.forEach((task) => {
      const creator = users.find(u => u.id === task.creatorId)?.name || task.creatorId || ""
      const assignees = (task.assigneeIds || [])
        .map((id: string) => users.find((u: any) => u.id === id)?.name || id)
        .join(", ")
      const taskEvidenceCount = (evidence || []).filter((e: any) => e.taskId === task.id).length

      const row = [
        task.id,
        task.title,
        task.description,
        task.priority,
        task.status,
        task.location || "",
        task.area || "",
        creator,
        assignees,
        task.estimatedHours !== undefined ? task.estimatedHours : "",
        task.createdAt ? new Date(task.createdAt).toLocaleString("es-MX") : "",
        task.dueLabel || "",
        taskEvidenceCount
      ]

      rows.push(row.map(escapeCSV).join(","))
    })

    const csvContent = "\uFEFF" + rows.join("\r\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `tareas-export-${new Date().toISOString().slice(0, 10)}.csv`
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
        {switchNotice ? (
          <div className="rounded-xl border border-secondary/30 bg-secondary/10 px-4 py-3 text-sm text-secondary flex items-center gap-2">
            <MaterialIcon name="swap_horiz" />
            Perfil activo actualizado: <span className="font-bold">{switchNotice}</span>
          </div>
        ) : null}

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
              {!isStandalone && (
                <button
                  type="button"
                  onClick={() => setPwaModalOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-secondary-container px-4 py-3 font-title-sm text-title-sm text-on-secondary-container hover:opacity-90 transition-opacity border border-secondary/20"
                >
                  <MaterialIcon name="install_mobile" className="animate-pulse text-secondary" />
                  Instalar en tu {deviceLabel}
                </button>
              )}
              <button
                type="button"
                onClick={handleExport}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary px-4 py-3 font-title-sm text-title-sm text-primary hover:bg-surface-container-low transition-colors"
              >
                <MaterialIcon name="download" />
                Exportar a Excel (CSV)
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

        <section className="rounded-xl border border-outline-variant bg-surface p-6 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 mb-6">
             <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center">
                <MaterialIcon name="admin_panel_settings" filled />
             </div>
             <div>
                <h3 className="font-title-sm text-title-sm text-primary uppercase tracking-wider">Perfil de Usuario y Permisos</h3>
                <p className="text-xs text-on-surface-variant">Configure su identidad y el alcance de visualización de datos.</p>
             </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
             {/* Active Profile Info */}
             <div className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/30 flex items-center gap-6">
                <div className="relative">
                   <img src={currentUser?.avatar} alt="" className="w-20 h-20 rounded-full border-2 border-white shadow-md" />
                   <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-success border-2 border-white" title="Activo" />
                </div>
                <div className="flex-1 min-w-0">
                   <h4 className="font-display-lg text-lg font-bold text-primary truncate">{currentUser?.name}</h4>
                   <p className="text-sm font-medium text-on-surface-variant uppercase tracking-wide">{currentUser?.position}</p>
                   <div className="flex items-center gap-2 mt-2">
                      <span className="px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container text-[10px] font-bold uppercase">{currentUser?.role}</span>
                      <div className="flex items-center gap-1 text-[10px] text-on-surface-variant bg-surface px-2 py-0.5 rounded border border-outline-variant">
                         <MaterialIcon name="location_on" className="text-[12px]" />
                         {currentUser?.zone}
                      </div>
                   </div>
                </div>
             </div>

             {/* Permissions Toggle */}
             <div className="flex flex-col justify-center gap-4">
                {currentUser?.role === "gerente" && (
                   <div className="flex items-center justify-between p-4 bg-surface rounded-xl border border-outline-variant">
                      <div className="flex items-center gap-4">
                         <div className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
                            currentUser?.showAllZones ? "bg-tertiary-container text-on-tertiary-container" : "bg-surface-container-high text-on-surface-variant"
                         )}>
                            <MaterialIcon name="public" filled={currentUser?.showAllZones} />
                         </div>
                         <div>
                            <p className="font-title-sm text-title-sm text-on-surface">Visualización Global</p>
                            <p className="text-xs text-on-surface-variant">Como Gerente, puede activar ver todas las zonas.</p>
                         </div>
                      </div>
                      <button 
                        onClick={() => currentUser && updateUser(currentUser.id, { showAllZones: !currentUser.showAllZones })}
                        className={cn(
                          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                          currentUser?.showAllZones ? "bg-primary" : "bg-outline"
                        )}
                      >
                         <span className={cn(
                           "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                           currentUser?.showAllZones ? "translate-x-5" : "translate-x-0"
                         )} />
                      </button>
                   </div>
                )}
                {currentUser?.role === "administrador" && (
                   <div className="flex items-center gap-4 p-4 bg-primary/5 rounded-xl border border-primary/20">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                         <MaterialIcon name="verified_user" filled />
                      </div>
                      <div>
                         <p className="font-title-sm text-title-sm text-primary">Acceso Total de Administrador</p>
                         <p className="text-xs text-on-surface-variant">Usted tiene visibilidad global permanente de todas las regiones.</p>
                      </div>
                   </div>
                )}
                <div className="flex items-center gap-2 text-[11px] text-on-surface-variant/70 italic px-2">
                   <MaterialIcon name="info" className="text-[14px]" />
                   Los permisos se aplican instantáneamente a las vistas de Tablero y Asignaciones.
                </div>
             </div>
          </div>

          <div className="mt-8 border-t border-outline-variant pt-6">
             <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-4">Cambiar perfil (Modo Desarrollo)</p>
             <div className="flex flex-wrap gap-4">
                {users.map(user => (
                   <button
                     key={user.id}
                     onClick={() => handleSwitchUser(user.id)}
                     className={cn(
                       "flex items-center gap-3 p-3 rounded-xl border transition-all",
                       currentUserId === user.id 
                         ? "bg-primary/5 border-primary shadow-sm" 
                         : "bg-surface border-outline-variant hover:border-primary/50"
                     )}
                   >
                      <img src={user.avatar} alt="" className="w-8 h-8 rounded-full" />
                      <div className="text-left">
                         <p className={cn("text-xs font-bold", currentUserId === user.id ? "text-primary" : "text-on-surface")}>{user.name}</p>
                         <p className="text-[10px] text-on-surface-variant uppercase">{user.role}</p>
                      </div>
                   </button>
                ))}
             </div>
          </div>
        </section>
      </div>
      <PWAInstallModal isOpen={pwaModalOpen} onClose={() => setPwaModalOpen(false)} />
    </main>
  )
}
