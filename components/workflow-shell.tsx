"use client"

import { useState, useMemo, type ReactNode } from "react"
import { MaterialIcon } from "@/components/ui/material-icon"
import { cn } from "@/utils/workflow"
import { AREA_OPTIONS, type SectionKey, useWorkflowStore, workflowSelectors } from "@/store/workflow-store"
import { HelpModal } from "@/components/modals/help-modal"
import { NotificationPopout } from "@/components/notification-popout"
import { GlobalAlertModal } from "@/components/modals/global-alert-modal"
import { UserButton } from "@clerk/nextjs"
import { PWAInstallModal, usePWAInstall } from "@/components/pwa-install"

type WorkflowShellProps = {
  section: SectionKey
  onSectionChange: (section: SectionKey) => void
  onOpenTaskModal: () => void
  onOpenSaveModal: () => void
  onToggleSidebar: () => void
  sidebarOpen: boolean
  searchQuery: string
  onSearchChange: (value: string) => void
  zoneFilter: string
  areaFilter: string
  onZoneFilterChange: (value: string) => void
  onAreaFilterChange: (value: string) => void
  children: ReactNode
}

const sidebarItems: Array<{ key: SectionKey; label: string; icon: string }> = [
  { key: "dashboard", label: "Tablero", icon: "dashboard" },
  { key: "assignments", label: "Tareas", icon: "assignment" },
  { key: "drawing", label: "Planos Técnicos", icon: "architecture" },
  { key: "evidence", label: "Evidencia", icon: "upload_file" },
  { key: "users", label: "Usuarios", icon: "people" },
  { key: "statistics", label: "Estadísticas", icon: "bar_chart" },
  { key: "settings", label: "Configuración", icon: "settings" }
]

const topTabs: Array<{ key: SectionKey; label: string }> = [
  { key: "dashboard", label: "Resumen" },
  { key: "assignments", label: "Programación" }
]

export function WorkflowShell({
  section,
  onSectionChange,
  onOpenTaskModal,
  onOpenSaveModal,
  onToggleSidebar,
  sidebarOpen,
  searchQuery,
  onSearchChange,
  zoneFilter,
  areaFilter,
  onZoneFilterChange,
  onAreaFilterChange,
  children
}: WorkflowShellProps) {
  const [helpOpen, setHelpOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [pwaModalOpen, setPwaModalOpen] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const { isStandalone, isInstallable, platform, deviceType } = usePWAInstall()
  const showInstallButton = !isStandalone && (isInstallable || platform === "ios")

  const tasks = useWorkflowStore((state) => state.tasks)
  const requirements = useWorkflowStore((state) => state.requirements)
  const assignments = useWorkflowStore((state) => state.assignments)
  const saves = useWorkflowStore((state) => state.saves)
  const users = useWorkflowStore((state) => state.users)
  const notifications = useWorkflowStore((state) => state.notifications)
  const currentUserId = useWorkflowStore((state) => state.currentUserId)
  const evidence = useWorkflowStore((state) => state.evidence)
  const folders = useWorkflowStore((state) => state.folders)

  const currentUser = useMemo(() =>
    workflowSelectors.getCurrentUser(users, currentUserId),
    [users, currentUserId])

  const currentUserZones = useMemo(() => workflowSelectors.getUserZones(currentUser), [currentUser])
  const primaryZoneLabel = currentUserZones[0] ?? currentUser?.zone ?? ""
  const zoneSummary = primaryZoneLabel
    ? `${primaryZoneLabel}${currentUserZones.length > 1 ? ` +${currentUserZones.length - 1}` : ""}`
    : ""

  const currentUserInitials = useMemo(() => {
    if (!currentUser?.name) return "US"
    const parts = currentUser.name.split(" ")
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return currentUser.name.slice(0, 2).toUpperCase()
  }, [currentUser])

  const unreadCount = useMemo(() => {
    if (!currentUser) return 0
    return notifications.filter(n => {
      if (!n.read) {
        if (currentUser.role === "administrador") return true
        if (currentUser.role === "gerente") return true
        if (currentUser.role === "empleado") {
          return n.targetUserId === currentUser.id || n.userId === currentUser.id
        }
      }
      return false
    }).length
  }, [notifications, currentUser])

  const filteredSidebarItems = useMemo(() => {
    if (!currentUser) return sidebarItems
    if (currentUser.role === "administrador" || currentUser.role === "gerente") {
      return sidebarItems
    }
    // Empleado: Solamente Tablero y Tareas
    return sidebarItems.filter(item =>
      item.key === "dashboard" ||
      item.key === "assignments"
    )
  }, [currentUser])

  const filteredTopTabs = useMemo(() => {
    if (!currentUser) return topTabs
    if (currentUser.role === "administrador" || currentUser.role === "gerente") return topTabs
    // Empleado: Ve Resumen y Programación
    return topTabs
  }, [currentUser])

  const zoneOptions = useMemo(() => {
    const zones = new Set<string>()
    tasks.forEach((task) => task.location && zones.add(task.location))
    requirements.forEach((req) => req.location && zones.add(req.location))
    users.forEach((user) => {
      workflowSelectors.getUserZones(user).forEach((zone) => zones.add(zone))
    })
    return Array.from(zones).sort()
  }, [tasks, requirements, users])

  const showFilters = currentUser?.role === "administrador" || currentUser?.role === "gerente"
  const zoneLocked = currentUser?.role !== "administrador"

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

  const activeTopSection = filteredTopTabs.some((tab) => tab.key === section) ? section : "dashboard"

  return (
    <div className="h-screen flex bg-background text-on-background overflow-hidden flex-col md:flex-row">
      {/* Mobile Header - Search or Profile Mode */}
      {mobileSearchOpen ? (
        <header className="md:hidden bg-surface border-b border-outline-variant h-16 flex items-center gap-3 px-4 z-40 shrink-0 animate-in fade-in duration-200">
          <button 
            onClick={() => {
              setMobileSearchOpen(false)
              onSearchChange("")
            }}
            className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full active:scale-95 transition-all cursor-pointer flex items-center justify-center"
            aria-label="Cerrar búsqueda"
          >
            <MaterialIcon name="arrow_back" />
          </button>
          <input
            className="flex-1 h-10 px-3 bg-surface-container-low border border-outline-variant rounded-xl text-sm outline-none focus:border-primary transition-all font-body-md"
            placeholder="Buscar tareas, planos..."
            type="text"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            autoFocus
          />
          {searchQuery && (
            <button 
              onClick={() => onSearchChange("")}
              className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full active:scale-95 transition-all cursor-pointer flex items-center justify-center"
              aria-label="Limpiar búsqueda"
            >
              <MaterialIcon name="close" className="text-sm" />
            </button>
          )}
        </header>
      ) : (
        <header className="md:hidden bg-surface border-b border-outline-variant h-16 flex items-center justify-between px-4 z-40 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={onToggleSidebar}
              className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center text-on-primary font-bold text-sm active:scale-95 transition-all cursor-pointer shadow-sm border-none"
              aria-label="Abrir menú"
            >
              {currentUserInitials}
            </button>
            <span 
              onClick={onToggleSidebar}
              className="font-title-sm text-title-sm font-bold text-primary tracking-tight cursor-pointer active:opacity-80 transition-all select-none"
            >
              Servimeci App
            </span>
          </div>
          <div className="flex items-center gap-2">
            {showInstallButton && (
              <button
                onClick={() => setPwaModalOpen(true)}
                className="p-1 px-2.5 bg-secondary/15 hover:bg-secondary/20 text-secondary border border-secondary/20 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 animate-pulse"
                title="Instalar App"
              >
                <MaterialIcon name="install_mobile" className="text-xs" />
                <span>Instalar</span>
              </button>
            )}
            <button 
              onClick={() => setMobileSearchOpen(true)}
              className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full active:scale-95 transition-all cursor-pointer flex items-center justify-center"
              aria-label="Buscar"
            >
              <MaterialIcon name="search" />
            </button>
            <button className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full"><MaterialIcon name="notifications" /></button>
          </div>
        </header>
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 h-screen w-72 bg-surface border-r border-outline-variant z-50 flex flex-col py-6 transition-transform duration-300",
          "md:translate-x-0 md:static md:h-full md:flex-shrink-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="px-6 mb-8 flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: "w-12 h-12 border-2 border-outline-variant rounded-full" } }} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-title-sm text-title-sm font-bold text-primary truncate">
                {currentUser?.name || "Usuario"}
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant truncate">
                {currentUser?.position || "Visitante"}
              </span>
              {zoneSummary && (
                <span className="font-body-sm text-body-sm text-on-surface-variant truncate">
                  Site Alfa - {zoneSummary}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col gap-2 scrollbar-thin">
          {filteredSidebarItems.filter(item => item.key !== "settings").map((item) => {
            const isActive = section === item.key
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onSectionChange(item.key)}
                className={cn(
                  "flex items-center gap-4 p-4 mx-2 rounded-xl transition-all duration-200 text-left",
                  isActive
                    ? "bg-secondary-container text-on-secondary-container opacity-90 shadow-sm"
                    : "text-on-surface-variant hover:bg-surface-container-high"
                )}
              >
                <MaterialIcon name={item.icon} filled={isActive} />
                <span>{item.label}</span>
              </button>
            )
          })}

          {showInstallButton && (
            <button
              type="button"
              onClick={() => setPwaModalOpen(true)}
              className="flex items-center gap-4 p-4 mx-2 rounded-xl text-secondary hover:bg-secondary/5 transition-all duration-200 text-left mt-auto mb-2 border border-dashed border-secondary/30"
            >
              <MaterialIcon 
                name={deviceType === "mobile" ? "phone_android" : deviceType === "tablet" ? "tablet_mac" : "laptop"} 
                className="text-secondary animate-pulse" 
              />
              <span className="font-semibold text-secondary">
                {deviceType === "mobile" 
                  ? "Instalar en Celular" 
                  : deviceType === "tablet" 
                    ? "Instalar en Tablet" 
                    : "Instalar en PC"}
              </span>
            </button>
          )}

          {filteredSidebarItems.filter(item => item.key === "settings").map((item) => {
            const isActive = section === item.key
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onSectionChange(item.key)}
                className={cn(
                  "flex items-center gap-4 p-4 mx-2 rounded-xl transition-all duration-200 text-left",
                  isActive
                    ? "bg-secondary-container text-on-secondary-container opacity-90 shadow-sm"
                    : "text-on-surface-variant hover:bg-surface-container-high",
                  !isStandalone ? "mb-4" : "mt-auto mb-4"
                )}
              >
                <MaterialIcon name={item.icon} filled={isActive} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>

        <div className="px-6 mt-auto hidden md:block">
          <button
            type="button"
            onClick={onOpenTaskModal}
            className="w-full flex justify-center items-center gap-2 bg-secondary text-on-secondary font-title-sm text-title-sm h-[48px] rounded-DEFAULT hover:opacity-90 transition-opacity shadow-lg"
          >
            <MaterialIcon name="add" />
            Nueva tarea
          </button>
        </div>
      </aside>

      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={onToggleSidebar}
          className="fixed inset-0 bg-primary/40 z-40 md:hidden backdrop-blur-sm"
        />
      ) : null}

      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        <header className="bg-surface z-40 hidden md:flex flex-col w-full border-b border-outline-variant flex-shrink-0">
          {/* Top Header Row */}
          <div className="flex justify-between items-center px-gutter h-16 border-b border-outline-variant/30 w-full">
            <div className="flex items-center gap-8 min-w-0">
              <button
                type="button"
                onClick={onToggleSidebar}
                className="md:hidden w-10 h-10 flex items-center justify-center text-on-surface-variant hover:bg-surface-container rounded-full transition-colors"
              >
                <MaterialIcon name="menu" />
              </button>

              <h1 className="font-headline-md text-headline-md font-bold text-primary tracking-tight shrink-0">
                Tareas
              </h1>

              <div className="relative hidden md:block w-80">
                <MaterialIcon
                  name="search"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm pointer-events-none"
                />
                <input
                  className="w-full h-9 pl-9 pr-4 bg-surface-container-low border border-outline-variant rounded-lg text-sm outline-none focus:border-tertiary-container focus:ring-1 focus:ring-tertiary-container transition-all"
                  placeholder="Buscar tareas, planos y evidencias..."
                  type="text"
                  value={searchQuery}
                  onChange={(event) => onSearchChange(event.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* + Agregar Task Button */}
              <button
                type="button"
                onClick={onOpenTaskModal}
                className="flex items-center gap-2 px-3 h-9 bg-primary text-on-primary rounded-full cursor-pointer hover:opacity-90 transition-opacity flex-shrink-0"
              >
                <MaterialIcon name="add" className="text-lg" />
                <span className="text-xs font-bold">Agregar Tarea</span>
              </button>

              <div className="flex items-center gap-4 ml-4 flex-shrink-0">
                <span className="text-sm font-medium text-on-surface hidden lg:inline">
                  {currentUser?.name || "Usuario"}
                </span>

                <div className="flex-shrink-0">
                  <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: "w-8 h-8 border border-outline-variant/40 rounded-full" } }} />
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setNotificationsOpen(!notificationsOpen)}
                    className={cn(
                      "relative w-9 h-9 flex justify-center items-center text-on-surface-variant hover:bg-surface-container rounded-full transition-colors",
                      notificationsOpen && "bg-primary/10 text-primary"
                    )}
                  >
                    <MaterialIcon name="notifications" filled={notificationsOpen} />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 w-4 h-4 bg-error text-white text-[10px] flex items-center justify-center rounded-full font-bold">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                  <NotificationPopout
                    open={notificationsOpen}
                    onClose={() => setNotificationsOpen(false)}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setHelpOpen(true)}
                  className="w-9 h-9 flex justify-center items-center text-on-surface-variant hover:bg-surface-container rounded-full transition-colors"
                  title="Ayuda"
                >
                  <MaterialIcon name="help_outline" />
                </button>
              </div>
            </div>
          </div>

          {/* Sub-Header Row */}
          <div className="flex justify-between items-center px-gutter h-14 w-full">
            {/* Left: Interactive Dropdown Filters */}
            <div className="flex gap-6 items-center">
              {showFilters ? (
                <>
                  <div className="relative flex items-center group">
                    <select
                      value={zoneFilter}
                      onChange={(event) => onZoneFilterChange(event.target.value)}
                      disabled={zoneLocked}
                      className="appearance-none bg-transparent pr-6 pl-1 py-1 text-sm font-semibold text-on-surface outline-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Filtro de zona"
                    >
                      <option value="todas">Todas las Zonas</option>
                      {zoneOptions.map((zone) => (
                        <option key={zone} value={zone}>
                          {zone}
                        </option>
                      ))}
                    </select>
                    <MaterialIcon name="expand_more" className="absolute right-0 text-sm text-on-surface-variant pointer-events-none" />
                  </div>

                  <div className="relative flex items-center group">
                    <select
                      value={areaFilter}
                      onChange={(event) => onAreaFilterChange(event.target.value)}
                      className="appearance-none bg-transparent pr-6 pl-1 py-1 text-sm font-semibold text-on-surface outline-none cursor-pointer"
                      aria-label="Filtro de area"
                    >
                      <option value="todas">Todas las Áreas</option>
                      {AREA_OPTIONS.map((area) => (
                        <option key={area} value={area}>
                          {area}
                        </option>
                      ))}
                    </select>
                    <MaterialIcon name="expand_more" className="absolute right-0 text-sm text-on-surface-variant pointer-events-none" />
                  </div>
                </>
              ) : (
                <div className="text-xs font-bold uppercase tracking-wider text-on-surface-variant/70 flex items-center gap-1.5">
                  <MaterialIcon name="verified_user" className="text-sm text-secondary" />
                  Región {zoneSummary || "Alfa"}
                </div>
              )}
            </div>

            {/* Middle: Tab Navigation */}
            <nav className="flex gap-10">
              {filteredTopTabs.map((tab) => {
                const isActive = activeTopSection === tab.key
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => onSectionChange(tab.key)}
                    className={cn(
                      "text-sm py-4 border-b-2 transition-all",
                      isActive
                        ? "font-bold text-secondary border-b-2 border-secondary scale-95"
                        : "text-on-surface-variant hover:text-primary border-transparent"
                    )}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </nav>

            {/* Right: Export progress button */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleExport}
                className="px-4 h-9 flex items-center gap-2 bg-[#107c41] text-white rounded-lg text-xs font-bold hover:bg-[#0c5f31] transition-colors shadow-sm cursor-pointer select-none active:scale-[0.98]"
                title="Exportar a Excel (CSV)"
              >
                <MaterialIcon name="table_view" className="text-[16px] text-white" />
                <span>Exportar Excel</span>
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">{children}</div>

        {/* Bottom Stats Footer (Desktop only) */}
        <footer className="hidden md:flex h-10 bg-white border-t border-outline-variant items-center px-gutter justify-between text-[11px] text-on-surface-variant flex-shrink-0">
          <div className="flex gap-4 items-center">
            <span>Mostrando {tasks.length} de {tasks.length} Tarea(s).</span>
            <div className="flex gap-2">
              <button onClick={() => onSectionChange("dashboard")} className="font-bold underline">Ver Todo</button>
              <span>|</span>
              <span className="text-secondary font-bold flex items-center gap-0.5">
                Activos <MaterialIcon name="expand_more" className="text-[14px]" />
              </span>
            </div>
          </div>
          <div className="italic opacity-70">
            "Tanto si piensas que puedes, como si piensas que no puedes, estás en lo cierto." — Henry Ford
          </div>
        </footer>

        {/* Bottom Navigation for Mobile */}
        <nav className="md:hidden bg-surface border-t border-outline-variant h-20 flex items-center justify-around z-40 shrink-0 pb-safe shadow-[0_-4px_12px_rgba(0,0,0,0.05)] px-2">
          {filteredSidebarItems.slice(0, 2).map((item) => {
            const isActive = section === item.key
            return (
              <button
                key={item.key}
                onClick={() => onSectionChange(item.key)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 transition-all duration-300 flex-1",
                  isActive ? "text-primary" : "text-on-surface-variant"
                )}
              >
                <div className={cn(
                  "w-12 h-8 rounded-full flex items-center justify-center transition-colors mb-0.5",
                  isActive ? "bg-secondary-container" : "bg-transparent"
                )}>
                  <MaterialIcon name={item.icon} filled={isActive} className="text-[20px]" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
              </button>
            )
          })}

          <div className="flex-1 flex justify-center -translate-y-6">
            <button
              onClick={onOpenTaskModal}
              className="flex flex-col items-center justify-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-secondary text-on-secondary shadow-xl flex items-center justify-center ring-8 ring-background">
                <MaterialIcon name="add" className="text-[28px]" />
              </div>
            </button>
          </div>

          {filteredSidebarItems.slice(2, 4).map((item) => {
            const isActive = section === item.key
            return (
              <button
                key={item.key}
                onClick={() => onSectionChange(item.key)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 transition-all duration-300 flex-1",
                  isActive ? "text-primary" : "text-on-surface-variant"
                )}
              >
                <div className={cn(
                  "w-12 h-8 rounded-full flex items-center justify-center transition-colors mb-0.5",
                  isActive ? "bg-secondary-container" : "bg-transparent"
                )}>
                  <MaterialIcon name={item.icon} filled={isActive} className="text-[20px]" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
              </button>
            )
          })}
        </nav>
      </div>
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <GlobalAlertModal />
      <PWAInstallModal isOpen={pwaModalOpen} onClose={() => setPwaModalOpen(false)} />
    </div>
  )
}
