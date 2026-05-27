"use client"

import { useEffect, useMemo, useState } from "react"
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
import { type SectionKey, useWorkflowStore, workflowSelectors } from "@/store/workflow-store"
import { MaterialIcon } from "@/components/ui/material-icon"
import { useUser, SignIn } from "@clerk/nextjs"
import { normalizeUserRole } from "@/utils/roles"

export function WorkflowApp() {
  const { isLoaded: isUserLoaded, isSignedIn, user } = useUser()

  const hasHydrated = useWorkflowStore((state) => state.hasHydrated)
  const users = useWorkflowStore((state) => state.users)
  const currentUserId = useWorkflowStore((state) => state.currentUserId)
  const addUser = useWorkflowStore((state) => state.addUser)
  const setCurrentUser = useWorkflowStore((state) => state.setCurrentUser)

  const [section, setSection] = useState<SectionKey>("dashboard")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [taskDetailsTaskId, setTaskDetailsTaskId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [zoneFilter, setZoneFilter] = useState("todas")
  const [areaFilter, setAreaFilter] = useState("todas")



  // Sincronizar el usuario autenticado de Clerk con el almacén local de Zustand
  useEffect(() => {
    if (!isUserLoaded || !isSignedIn || !user) return

    const email = user.primaryEmailAddress?.emailAddress || ""
    const name = user.fullName || user.username || email.split("@")[0] || "Usuario"
    const avatar = user.imageUrl || ""
    const normalizeLookup = (value: string) =>
      value
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")

    // Buscar solo por el ID exacto de Clerk guardado en 'code'
    let localUser = users.find((u) => u.code === user.id)

    if (!localUser) {
      const normalizedName = normalizeLookup(name)
      if (normalizedName && normalizedName !== "usuario") {
        const exactNameMatches = users.filter((u) => normalizeLookup(u.name) === normalizedName)
        if (exactNameMatches.length === 1) {
          localUser = exactNameMatches[0]
        } else if (exactNameMatches.length > 1) {
          localUser =
            exactNameMatches.find((u) => normalizeUserRole(u.role) !== "empleado") ??
            exactNameMatches[0]
        }
      }
    }

    if (localUser) {
      // Si el código, avatar o nombre cambiaron en Clerk, los actualizamos dinámicamente
      const isOutdated =
        localUser.code !== user.id ||
        localUser.avatar !== avatar ||
        localUser.name !== name

      if (isOutdated) {
        useWorkflowStore.getState().updateUser(localUser.id, {
          code: user.id,
          avatar: avatar,
          name: name
        })
      }
      if (currentUserId !== localUser.id) {
        setCurrentUser(localUser.id)
      }
    } else {
      // Registrar automáticamente al usuario de Clerk en el Zustand local
      // Por defecto todos los usuarios nuevos son empleados, salvo que un admin/gerente los cambie después
      const newId = addUser({
        name: name,
        avatar: avatar,
        birthDate: "1990-01-01",
        position: "Personal Técnico (Sincronizado)",
        zone: "Oficina Central",
        zones: ["Oficina Central"],
        role: "empleado",
        showAllZones: false,
        areas: ["Operacion"],
        skills: ["General"],
        clearances: [],
        availability: "available",
        availabilityLabel: "Disponible",
        code: user.id
      })
      setCurrentUser(newId)
    }
  }, [isUserLoaded, isSignedIn, user, users, currentUserId, setCurrentUser, addUser])

  const currentUser = useMemo(
    () => workflowSelectors.getCurrentUser(users, currentUserId),
    [users, currentUserId]
  )
  const currentRole = normalizeUserRole(currentUser?.role)

  useEffect(() => {
    if (!currentUser) return
    if (currentRole === "administrador") {
      setZoneFilter("todas")
      setAreaFilter("todas")
      return
    }
    const userZones = workflowSelectors.getUserZones(currentUser)
    const defaultZone = userZones.length > 1 ? "todas" : (userZones[0] || currentUser.zone || "todas")
    setZoneFilter(defaultZone)
    setAreaFilter("todas")
  }, [currentUserId, currentUser, currentRole])

  useEffect(() => {
    setSidebarOpen(false)
    setTaskDetailsTaskId(null)
  }, [section])

  useEffect(() => {
    if (currentRole === "empleado" && section !== "dashboard" && section !== "assignments") {
      setSection("dashboard")
    }
  }, [currentRole, section])

  function handleSectionChange(nextSection: SectionKey) {
    if (currentRole === "empleado" && nextSection !== "dashboard" && nextSection !== "assignments") {
      return
    }
    setSection(nextSection)
    setSidebarOpen(false)
  }

  // 1. Cargando Zustand o datos de sesión de Clerk
  if (!hasHydrated || !isUserLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="max-w-md w-full rounded-xl border border-outline-variant bg-surface p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary flex items-center justify-center text-on-primary">
            <MaterialIcon name="dashboard" filled />
          </div>
          <h1 className="font-headline-md text-headline-md text-primary">Servimeci</h1>
          <p className="mt-2 text-on-surface-variant font-body-sm">Cargando...</p>
        </div>
      </div>
    )
  }

  // 2. Si no ha iniciado sesión, mostramos Clerk directamente
  if (!isSignedIn) {
    return (
      <>
        <PWARegistration />
        <main className="min-h-screen flex items-center justify-center bg-background px-6">
          <div className="flex flex-col items-center gap-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-on-primary shadow-lg">
                <MaterialIcon name="factory" filled />
              </div>
              <h1 className="font-headline-md text-headline-md text-primary font-bold">Servimeci App</h1>
            </div>
            <SignIn routing="hash" />
          </div>
        </main>
      </>
    )
  }

  // 3. Si está autenticado, mostramos la aplicación normalmente
  return (
    <>
      <PWARegistration />
      <WorkflowShell
        section={section}
        onSectionChange={handleSectionChange}
        onOpenTaskModal={() => setTaskModalOpen(true)}
        onOpenSaveModal={() => setSaveModalOpen(true)}
        onToggleSidebar={() => setSidebarOpen((current) => !current)}
        sidebarOpen={sidebarOpen}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        zoneFilter={zoneFilter}
        areaFilter={areaFilter}
        onZoneFilterChange={setZoneFilter}
        onAreaFilterChange={setAreaFilter}
      >
        {section === "dashboard" ? (
          <DashboardSection
            onCreateTask={() => setTaskModalOpen(true)}
            onOpenTaskDetails={(taskId) => setTaskDetailsTaskId(taskId)}
            searchQuery={searchQuery}
            zoneFilter={zoneFilter}
            areaFilter={areaFilter}
          />
        ) : null}
        {section === "assignments" ? (
          <AssignmentSection
            onCreateTask={() => setTaskModalOpen(true)}
            onOpenTaskDetails={(taskId) => setTaskDetailsTaskId(taskId)}
            searchQuery={searchQuery}
            zoneFilter={zoneFilter}
            areaFilter={areaFilter}
          />
        ) : null}
        {section === "drawing" ? <DrawingSection /> : null}
        {section === "evidence" ? (
          <EvidenceSection onCreateTask={() => setTaskModalOpen(true)} />
        ) : null}
        {section === "users" ? <UsersSection /> : null}
        {section === "statistics" ? <StatisticsSection /> : null}
        {section === "settings" ? (
          <SettingsSection onSwitchUser={() => handleSectionChange("dashboard")} />
        ) : null}
      </WorkflowShell>

      <TaskModal open={taskModalOpen} onClose={() => setTaskModalOpen(false)} />
      <TaskDetailsModal
        open={taskDetailsTaskId !== null}
        taskId={taskDetailsTaskId}
        onClose={() => setTaskDetailsTaskId(null)}
      />
      <SaveProgressModal open={saveModalOpen} onClose={() => setSaveModalOpen(false)} />
    </>
  )
}
