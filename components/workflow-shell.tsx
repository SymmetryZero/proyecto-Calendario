"use client"

import type { ReactNode } from "react"
import { MaterialIcon } from "@/components/ui/material-icon"
import { cn } from "@/utils/workflow"
import { type SectionKey, useWorkflowStore } from "@/store/workflow-store"

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
  { key: "drawing", label: "Planos técnicos", icon: "architecture" },
  { key: "evidence", label: "Evidencias", icon: "upload_file" },
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
  const tasks = useWorkflowStore((state) => state.tasks)
  const requirements = useWorkflowStore((state) => state.requirements)
  const evidence = useWorkflowStore((state) => state.evidence)
  const folders = useWorkflowStore((state) => state.folders)
  const assignments = useWorkflowStore((state) => state.assignments)
  const saves = useWorkflowStore((state) => state.saves)

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

  const activeTopSection = topTabs.some((tab) => tab.key === section) ? section : "dashboard"

  return (
    <div className="h-screen flex bg-background text-on-background overflow-hidden">
      <aside
        className={cn(
          "fixed left-0 top-0 h-screen w-72 bg-surface border-r border-outline-variant z-50 flex flex-col py-6 transition-transform duration-300",
          "md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="px-6 mb-8 flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold">
              GP
            </div>
            <div className="flex flex-col">
              <span className="font-title-sm text-title-sm font-bold text-primary">Gerente de proyecto</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                Sitio Alfa - Región 4
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col gap-2 scrollbar-thin">
          {sidebarItems.map((item) => {
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

        <div className="px-6 mt-auto">
          <button
            type="button"
            onClick={onOpenTaskModal}
            className="w-full flex justify-center items-center gap-2 bg-secondary text-on-secondary font-title-sm text-title-sm h-[48px] rounded-DEFAULT hover:opacity-90 transition-opacity"
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
          className="fixed inset-0 bg-primary/40 z-40 md:hidden"
        />
      ) : null}

      <div className="flex-1 md:ml-72 flex flex-col min-w-0 h-screen">
        <header className="bg-surface z-40 flex items-center justify-between gap-6 px-gutter h-20 w-full border-b border-outline-variant flex-shrink-0">
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
                {topTabs.map((tab) => {
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
              <button
                type="button"
                onClick={handleExport}
                className="px-4 h-[48px] font-title-sm text-title-sm text-primary border border-primary rounded-DEFAULT hover:bg-surface-container-low transition-colors hidden xl:block"
              >
                Exportar
              </button>
              <button
                type="button"
                onClick={onOpenSaveModal}
                className="px-6 h-[48px] font-title-sm text-title-sm bg-primary text-on-primary rounded-DEFAULT hover:opacity-90 transition-opacity"
              >
                Guardar progreso
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">{children}</div>
      </div>
    </div>
  )
}
