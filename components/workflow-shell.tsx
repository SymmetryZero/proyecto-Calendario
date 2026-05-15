"use client"

import { useMemo, type ReactNode } from "react"
import { MaterialIcon } from "@/components/ui/material-icon"
import { cn } from "@/utils/workflow"
import { type SectionKey, useWorkflowStore, workflowSelectors } from "@/store/workflow-store"

type WorkflowShellProps = {
  section: SectionKey
  onSectionChange: (section: SectionKey) => void
  onOpenTaskModal: () => void
  onOpenSaveModal: () => void
  onToggleSidebar: () => void
  sidebarOpen: boolean
  searchQuery: string
  onSearchChange: (value: string) => void
  children: ReactNode
}

const sidebarItems: Array<{ key: SectionKey; label: string; icon: string }> = [
  { key: "dashboard", label: "Tablero", icon: "dashboard" },
  { key: "assignments", label: "Tareas", icon: "assignment" },
  { key: "users", label: "Usuarios", icon: "people" },
  { key: "statistics", label: "Estadísticas", icon: "bar_chart" },
  { key: "settings", label: "Configuración", icon: "settings" }
]

const topTabs: Array<{ key: SectionKey; label: string }> = [
  { key: "dashboard", label: "Resumen" },
  { key: "assignments", label: "Programación" },
  { key: "evidence", label: "Evidencias" }
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
  children
}: WorkflowShellProps) {
  const assignments = useWorkflowStore((state) => state.assignments)
  const saves = useWorkflowStore((state) => state.saves)
  const users = useWorkflowStore((state) => state.users)
  const currentUserId = useWorkflowStore((state) => state.currentUserId)

  const currentUser = useMemo(() => 
    workflowSelectors.getCurrentUser(users, currentUserId), 
  [users, currentUserId])

  const filteredSidebarItems = useMemo(() => {
    if (!currentUser) return sidebarItems
    if (currentUser.role === "administrador") return sidebarItems
    if (currentUser.role === "gerente") {
      return sidebarItems.filter(item => item.key !== "statistics")
    }
    // Empleado: Solo Tablero y Evidencias (que está en topTabs, pero aquí filtramos sidebar)
    return sidebarItems.filter(item => item.key === "dashboard")
  }, [currentUser])

  const filteredTopTabs = useMemo(() => {
    if (!currentUser) return topTabs
    if (currentUser.role === "administrador" || currentUser.role === "gerente") return topTabs
    // Empleado: No ve Programación (assignments)
    return topTabs.filter(tab => tab.key !== "assignments")
  }, [currentUser])

  function handleExport() {
    const snapshot = {
      tasks,
      requirements,
      evidence,
      folders,
      assignments,
      saves,
      exportedAt: new Date().toISOString()
    }

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

  const activeTopSection = filteredTopTabs.some((tab) => tab.key === section) ? section : "dashboard"

  return (
    <div className="h-screen flex bg-background text-on-background overflow-hidden flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden bg-surface border-b border-outline-variant h-16 flex items-center justify-between px-4 z-40 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-on-primary font-bold text-xs">GP</div>
          <h1 className="font-title-sm text-title-sm font-bold text-primary tracking-tight">Flujo Pro</h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 text-on-surface-variant"><MaterialIcon name="search" /></button>
          <button className="p-2 text-on-surface-variant"><MaterialIcon name="notifications" /></button>
        </div>
      </header>

      <aside
        className={cn(
          "fixed left-0 top-0 h-screen w-72 bg-surface border-r border-outline-variant z-50 flex flex-col py-6 transition-transform duration-300",
          "md:translate-x-0 md:static md:h-full",
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="px-6 mb-8 hidden md:flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full border border-outline-variant overflow-hidden shadow-sm">
               <img src={currentUser?.avatar} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-title-sm text-title-sm font-bold text-primary truncate">
                {currentUser?.name || "Usuario"}
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant truncate">
                {currentUser?.position || "Visitante"}
              </span>
              <div className="flex items-center gap-1 text-[10px] text-secondary font-bold uppercase tracking-tight mt-0.5">
                 <MaterialIcon name="location_on" className="text-[12px]" />
                 <span className="truncate">{currentUser?.zone || "Sin zona"}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col gap-2 scrollbar-thin">
          {filteredSidebarItems.map((item) => {
            const isActive = section === item.key
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onSectionChange(item.key)}
                className={cn(
                  "flex items-center gap-4 p-4 mx-2 rounded-xl transition-all duration-200 text-left",
                  isActive
                    ? "bg-secondary-container text-on-secondary-container opacity-90"
                    : "text-on-surface-variant hover:bg-surface-container-high"
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
        <header className="bg-surface z-40 hidden md:flex items-center justify-between gap-6 px-gutter h-20 w-full border-b border-outline-variant flex-shrink-0">
          <div className="flex items-center gap-4 lg:gap-8 min-w-0">
            <button
              type="button"
              onClick={onToggleSidebar}
              className="md:hidden w-12 h-12 flex items-center justify-center text-on-surface-variant hover:bg-surface-container rounded-DEFAULT transition-colors"
            >
              <MaterialIcon name="menu" />
            </button>

            <div className="flex items-center gap-8 min-w-0">
              <h1 className="font-headline-md text-headline-md font-bold text-primary tracking-tight">
                Flujo Pro
              </h1>

              <nav className="hidden lg:flex gap-6 mt-4">
                {filteredTopTabs.map((tab) => {
                  const isActive = activeTopSection === tab.key
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => onSectionChange(tab.key)}
                      className={cn(
                        "pb-4 transition-transform",
                        isActive
                          ? "text-secondary border-b-2 border-secondary font-bold scale-95"
                          : "text-on-surface-variant hover:text-primary"
                      )}
                    >
                      {tab.label}
                    </button>
                  )
                })}
              </nav>
            </div>
          </div>

          <div className="flex items-center gap-4 lg:gap-6">
            <div className="relative hidden md:block w-64 lg:w-72">
              <MaterialIcon
                name="search"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
              />
              <input
                className="w-full h-[48px] pl-10 pr-4 bg-surface-container-low border border-outline-variant rounded-DEFAULT focus:border-tertiary-container focus:ring-1 focus:ring-tertiary-container text-body-md font-body-md outline-none transition-colors"
                placeholder="Buscar flujos de trabajo..."
                type="text"
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="w-[48px] h-[48px] flex justify-center items-center text-on-surface-variant hover:bg-surface-container rounded-DEFAULT transition-colors"
              >
                <MaterialIcon name="notifications" />
              </button>
              <button
                type="button"
                className="w-[48px] h-[48px] flex justify-center items-center text-on-surface-variant hover:bg-surface-container rounded-DEFAULT transition-colors"
              >
                <MaterialIcon name="help_outline" />
              </button>
            </div>

            <div className="hidden xl:flex items-center gap-3">
              {/* Export button removed as requested */}
              {/* Save progress button hidden as requested */}
              <button
                type="button"
                onClick={onOpenSaveModal}
                className="hidden px-6 h-[48px] font-title-sm text-title-sm bg-primary text-on-primary rounded-DEFAULT hover:opacity-90 transition-opacity shadow-sm"
              >
                Guardar progreso
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">{children}</div>

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
    </div>
  )
}
