"use client"

import { useEffect, useState } from "react"
import { PWARegistration } from "@/components/pwa-registration"
import { WorkflowShell } from "@/components/workflow-shell"
import { DashboardSection } from "@/components/sections/dashboard-section"
import { AssignmentSection } from "@/components/sections/assignment-section"
import { EvidenceSection } from "@/components/sections/evidence-section"
import { DrawingSection } from "@/components/sections/drawing-section"
import { SettingsSection } from "@/components/sections/settings-section"
import { UsersSection } from "@/components/sections/users-section"
import { StatisticsSection } from "@/components/sections/statistics-section"
import { SaveProgressModal } from "@/components/modals/save-progress-modal"
import { TaskModal } from "@/components/modals/task-modal"
import { TaskDetailsModal } from "@/components/modals/task-details-modal"
import { type SectionKey, useWorkflowStore } from "@/store/workflow-store"
import { MaterialIcon } from "@/components/ui/material-icon"

export function WorkflowApp() {
  const hasHydrated = useWorkflowStore((state) => state.hasHydrated)
  const [section, setSection] = useState<SectionKey>("dashboard")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [taskDetailsTaskId, setTaskDetailsTaskId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    setSidebarOpen(false)
    setTaskDetailsTaskId(null)
  }, [section])

  function handleSectionChange(nextSection: SectionKey) {
    setSection(nextSection)
    setSidebarOpen(false)
  }

  return (
    <>
      <PWARegistration />
      {!hasHydrated ? (
        <div className="min-h-screen flex items-center justify-center bg-background px-6">
          <div className="max-w-md w-full rounded-xl border border-outline-variant bg-surface p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary flex items-center justify-center text-on-primary">
              <MaterialIcon name="dashboard" filled />
            </div>
            <h1 className="font-headline-md text-headline-md text-primary">Demo</h1>
            <p className="mt-2 text-on-surface-variant">Cargando los datos locales del flujo de trabajo...</p>
          </div>
        </div>
      ) : (
        <>
          <WorkflowShell
            section={section}
            onSectionChange={handleSectionChange}
            onOpenTaskModal={() => setTaskModalOpen(true)}
            onOpenSaveModal={() => setSaveModalOpen(true)}
            onToggleSidebar={() => setSidebarOpen((current) => !current)}
            sidebarOpen={sidebarOpen}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          >
            {section === "dashboard" ? (
              <DashboardSection
                onCreateTask={() => setTaskModalOpen(true)}
                onOpenTaskDetails={(taskId) => setTaskDetailsTaskId(taskId)}
                searchQuery={searchQuery}
              />
            ) : null}
            {section === "assignments" ? (
              <AssignmentSection 
                onCreateTask={() => setTaskModalOpen(true)} 
                onOpenTaskDetails={(taskId) => setTaskDetailsTaskId(taskId)}
                searchQuery={searchQuery}
              />
            ) : null}
            {section === "drawing" ? <DrawingSection /> : null}
            {section === "evidence" ? (
              <EvidenceSection onCreateTask={() => setTaskModalOpen(true)} />
            ) : null}
            {section === "users" ? <UsersSection /> : null}
            {section === "statistics" ? <StatisticsSection /> : null}
            {section === "settings" ? <SettingsSection /> : null}
          </WorkflowShell>

          <TaskModal open={taskModalOpen} onClose={() => setTaskModalOpen(false)} />
          <TaskDetailsModal
            open={taskDetailsTaskId !== null}
            taskId={taskDetailsTaskId}
            onClose={() => setTaskDetailsTaskId(null)}
          />
          <SaveProgressModal open={saveModalOpen} onClose={() => setSaveModalOpen(false)} />
        </>
      )}
    </>
  )
}
