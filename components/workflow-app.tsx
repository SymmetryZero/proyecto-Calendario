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
import { useUser, SignInButton } from "@clerk/nextjs"

export function WorkflowApp() {
  const { isLoaded, isSignedIn, user } = useUser()
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

  // Estados locales para simulación visual del login industrial
  const [emailInput, setEmailInput] = useState("")
  const [passwordInput, setPasswordInput] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  // Sincronizar el usuario autenticado de Clerk con el almacén local de Zustand
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return

    const email = user.primaryEmailAddress?.emailAddress || ""
    const name = user.fullName || user.username || email.split("@")[0] || "Usuario"
    const avatar = user.imageUrl || ""

    // Buscar si ya existe un usuario local con el ID de Clerk (guardado en 'code')
    let localUser = users.find((u) => u.code === user.id)

    // Si no lo encuentra, buscar por correo o por una coincidencia similar
    if (!localUser && email) {
      localUser = users.find((u) => u.code === email)
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
      // Le asignamos rol de "administrador" por defecto para pruebas fluidas del panel
      const newId = addUser({
        name: name,
        avatar: avatar,
        birthDate: "1990-01-01",
        position: "Personal Técnico (Sincronizado)",
        zone: "Oficina Central",
        role: "administrador",
        showAllZones: true,
        areas: ["Operacion", "Proyectos", "Direccion"],
        skills: ["General", "Planificación"],
        clearances: [],
        availability: "available",
        availabilityLabel: "Disponible"
      })
      
      // Asociar su ID de Clerk para inicios de sesión futuros
      useWorkflowStore.getState().updateUser(newId, { code: user.id })
      setCurrentUser(newId)
    }
  }, [isLoaded, isSignedIn, user, users, currentUserId, setCurrentUser, addUser])

  const currentUser = useMemo(
    () => workflowSelectors.getCurrentUser(users, currentUserId),
    [users, currentUserId]
  )

  useEffect(() => {
    if (!currentUser) return
    if (currentUser.role === "administrador") {
      setZoneFilter("todas")
      setAreaFilter("todas")
      return
    }
    setZoneFilter(currentUser.zone || "todas")
    setAreaFilter("todas")
  }, [currentUserId, currentUser])

  useEffect(() => {
    setSidebarOpen(false)
    setTaskDetailsTaskId(null)
  }, [section])

  useEffect(() => {
    if (currentUser?.role === "empleado" && section !== "dashboard" && section !== "assignments") {
      setSection("dashboard")
    }
  }, [currentUser, section])

  function handleSectionChange(nextSection: SectionKey) {
    if (currentUser?.role === "empleado" && nextSection !== "dashboard" && nextSection !== "assignments") {
      return
    }
    setSection(nextSection)
    setSidebarOpen(false)
  }

  // 1. Cargando Zustand o datos de sesión de Clerk
  if (!hasHydrated || !isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="max-w-md w-full rounded-xl border border-outline-variant bg-surface p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary flex items-center justify-center text-on-primary">
            <MaterialIcon name="dashboard" filled />
          </div>
          <h1 className="font-headline-md text-headline-md text-primary">Servimeci</h1>
          <p className="mt-2 text-on-surface-variant font-body-sm">Cargando los datos seguros de tu cuenta...</p>
        </div>
      </div>
    )
  }

  // 2. Si no ha iniciado sesión, mostramos la pantalla de bienvenida industrial premium
  if (!isSignedIn) {
    return (
      <>
        <PWARegistration />
        <main className="min-h-screen flex bg-surface font-body-md text-on-surface antialiased overflow-hidden select-none w-full">
          {/* Panel Izquierdo: Branding Visual (Solo Desktop) */}
          <section className="hidden lg:flex lg:w-7/12 relative overflow-hidden bg-primary items-center justify-center h-screen">
            <div className="absolute inset-0 z-0">
              <img
                alt="Instalación Industrial"
                className="w-full h-full object-cover opacity-40 mix-blend-luminosity"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuD9TVbPDnkc3fp6u9FqkxYei2Rh4Z-a-vzd3sYLavwU482nfskI3T8Jsp_Gs82gFSQUA3oh5nwEtQupXejfD-jWUoGlheZmrFeXztN9o5F4IDaw1pXcG0zt9RBxSSYvyX-tY2Hdc7zbrS4uzesxtBEYxHTofZLkDSF1omJEvSGik3qYsBJo4N8umwHOgnT5-IAB3Jiif7k-Y0gfkiXWAR6e4yZSnE89_qv6UMJalpf607sRFEKmNR_DKXUrvHKKU8T41ppGCmsMByPu"
              />
            </div>
            {/* Superposición Atmosférica Sutil */}
            <div className="absolute inset-0 bg-gradient-to-tr from-primary via-transparent to-primary-container opacity-60 z-10"></div>
            
            {/* Contenido de Branding */}
            <div className="relative z-20 px-margin-edge text-left max-w-2xl">
              <div className="flex items-center gap-stack-sm mb-stack-lg">
                <span className="material-symbols-outlined text-secondary-container text-[48px]">factory</span>
                <h1 className="text-white font-display-lg text-display-lg tracking-tight uppercase">FLOW OPS</h1>
              </div>
              <h2 className="text-white font-headline-md text-headline-md mb-stack-md">Workflow Pro</h2>
              <p className="text-on-primary-container font-body-md text-body-md leading-relaxed mb-stack-lg">
                Sistemas de Flujo Industrial — Excelencia en la Operación. Optimice sus flujos de trabajo técnicos con nuestra robusta suite de gestión empresarial corporativa.
              </p>
              
              {/* Indicadores de Estado */}
              <div className="flex gap-stack-md mt-stack-lg">
                <div className="flex items-center gap-stack-sm bg-white/5 border border-white/10 px-4 py-2 rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-white font-label-caps text-label-caps">Sistema Seguro</span>
                </div>
                <div className="flex items-center gap-stack-sm bg-white/5 border border-white/10 px-4 py-2 rounded-lg">
                  <span className="material-symbols-outlined text-white/60 text-[18px]">shield</span>
                  <span className="text-white font-label-caps text-label-caps">Cifrado Extremo a Extremo</span>
                </div>
              </div>
            </div>
            
            {/* Elemento Decorativo */}
            <div className="absolute bottom-margin-edge left-margin-edge z-20">
              <p className="text-white/30 font-data-mono text-data-mono">NODE_TX_001.492 // VER 4.2.0</p>
            </div>
          </section>

          {/* Panel Derecho: Formulario de Login */}
          <section className="w-full lg:w-5/12 bg-surface-container-lowest flex items-center justify-center px-gutter py-stack-lg h-screen">
            <div className="w-full max-w-[440px]">
              {/* Encabezado */}
              <div className="mb-stack-lg">
                <div className="lg:hidden flex items-center gap-stack-sm mb-stack-md">
                  <span className="material-symbols-outlined text-primary text-[32px]">factory</span>
                  <span className="font-display-lg text-headline-md text-primary tracking-tight">FLOW OPS</span>
                </div>
                <h3 className="font-headline-md text-headline-md text-primary mb-2">Acceso Seguro</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">Por favor, identifíquese para acceder al panel operativo de Servimeci.</p>
              </div>

              {/* Formulario */}
              <form className="space-y-stack-md" onSubmit={(e) => e.preventDefault()}>
                {/* ID / Email */}
                <div className="space-y-2">
                  <label className="block font-label-caps text-label-caps text-on-surface-variant" htmlFor="employee-id">
                    Correo Electrónico o ID de Empleado
                  </label>
                  <div className="relative group">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">
                      person
                    </span>
                    <input
                      className="w-full h-touch-target-min pl-12 pr-4 bg-white border border-outline-variant rounded-lg focus:border-primary focus:ring-1 focus:ring-primary transition-all text-body-md placeholder:text-outline-variant outline-none"
                      id="employee-id"
                      name="employee-id"
                      placeholder="ej. jperez@servimeci.com o TECH-001"
                      type="text"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                    />
                  </div>
                </div>

                {/* Contraseña */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="block font-label-caps text-label-caps text-on-surface-variant" htmlFor="password">
                      Contraseña
                    </label>
                    <span className="text-label-caps font-label-caps text-primary hover:underline transition-all cursor-pointer opacity-70">
                      ¿Olvidó su contraseña?
                    </span>
                  </div>
                  <div className="relative group">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">
                      lock
                    </span>
                    <input
                      className="w-full h-touch-target-min pl-12 pr-12 bg-white border border-outline-variant rounded-lg focus:border-primary focus:ring-1 focus:ring-primary transition-all text-body-md outline-none"
                      id="password"
                      name="password"
                      placeholder="••••••••"
                      type={showPassword ? "text" : "password"}
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                    />
                    <button
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-primary"
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      <span className="material-symbols-outlined">
                        {showPassword ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Recordarme */}
                <div className="flex items-center gap-3 py-2">
                  <div className="relative flex items-center">
                    <input
                      className="w-5 h-5 rounded-sm border-outline-variant text-primary focus:ring-primary cursor-pointer"
                      id="remember"
                      name="remember"
                      type="checkbox"
                    />
                  </div>
                  <label className="font-body-sm text-body-sm text-on-surface-variant select-none cursor-pointer" htmlFor="remember">
                    Recordar este dispositivo por 30 días
                  </label>
                </div>

                {/* Botón de Submit envuelto en Clerk SignInButton */}
                <SignInButton mode="modal">
                  <button className="w-full h-touch-target-min bg-primary-container hover:bg-primary active:scale-[0.98] text-white font-label-caps text-label-caps tracking-widest rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 mt-stack-md cursor-pointer font-bold">
                    INICIAR SESIÓN CON CLERK
                    <span className="material-symbols-outlined text-[18px]">login</span>
                  </button>
                </SignInButton>
              </form>

              {/* Sección de Ayuda / Info */}
              <div className="mt-stack-lg pt-stack-lg border-t border-outline-variant">
                <div className="bg-surface-container-low p-4 rounded-lg flex items-start gap-4">
                  <span className="material-symbols-outlined text-secondary text-[20px] mt-0.5">info</span>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    ¿Es un nuevo contratista? Por favor póngase en contacto con su <span className="font-bold text-primary">Supervisor de Sitio</span> para aprovisionar sus credenciales digitales corporativas.
                  </p>
                </div>
              </div>

              {/* Footer de enlaces de seguridad */}
              <footer className="mt-stack-lg flex flex-wrap justify-center gap-x-stack-md gap-y-2">
                <span className="font-label-caps text-[10px] text-outline cursor-pointer hover:text-primary transition-colors">PROTOCOLO DE SEGURIDAD</span>
                <span className="text-outline-variant text-[10px]">•</span>
                <span className="font-label-caps text-[10px] text-outline cursor-pointer hover:text-primary transition-colors">POLÍTICA DE PRIVACIDAD</span>
                <span className="text-outline-variant text-[10px]">•</span>
                <span className="font-label-caps text-[10px] text-outline cursor-pointer hover:text-primary transition-colors">SOPORTE DEL SISTEMA</span>
              </footer>
            </div>
          </section>
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
