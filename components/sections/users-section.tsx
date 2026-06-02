"use client"

import { useState, useMemo } from "react"
import { MaterialIcon } from "@/components/ui/material-icon"
import { useWorkflowStore, type User, workflowSelectors } from "@/store/workflow-store"
import { UserModal } from "@/components/modals/user-modal"
import { cn, formatNumericDate } from "@/utils/workflow"
import { normalizeUserRole } from "@/utils/roles"

export function UsersSection() {
  const users = useWorkflowStore((state) => state.users)
  const currentUserId = useWorkflowStore((state) => state.currentUserId)
  const deleteUser = useWorkflowStore((state) => state.deleteUser)
  
  const [searchQuery, setSearchQuery] = useState("")
  const [modalOpen, setModalOpen] = useState(false)
  const [userToEdit, setUserToEdit] = useState<User | null>(null)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")

  const currentUser = useMemo(() => users.find((u) => u.id === currentUserId), [users, currentUserId])
  const currentRole = normalizeUserRole(currentUser?.role)

  const filteredUsers = useMemo(() => {
    const usersToFilter = currentRole === "empleado"
      ? users.filter((u) => u.id === currentUserId)
      : users

    return usersToFilter.filter((u) => 
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
      workflowSelectors.getUserZones(u).join(" ").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.areas ?? []).join(" ").toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [users, searchQuery, currentRole, currentUserId])

  function handleEdit(user: User) {
    setUserToEdit(user)
    setModalOpen(true)
  }

  function handleAdd() {
    setUserToEdit(null)
    setModalOpen(true)
  }

  return (
    <main className="flex-1 p-gutter overflow-y-auto scrollbar-thin bg-surface-container-lowest">
      <div className="flex flex-col gap-8 max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="font-display-lg text-display-lg text-primary">
              {currentRole === "empleado" ? "Mi Perfil" : "Gestión de Usuarios"}
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              {currentRole === "empleado" 
                ? "Consulta y edita los datos de tu cuenta personal." 
                : "Administra el personal, roles y zonas de trabajo del sistema."}
            </p>
          </div>
          {/* Registrar usuario ocultado para todos los roles a petición */}
          {false && (
            <button
              onClick={handleAdd}
              className="h-[56px] px-8 bg-secondary text-on-secondary rounded-xl font-title-md text-title-md flex items-center gap-3 shadow-lg hover:shadow-xl transition-all active:scale-95"
            >
              <MaterialIcon name="person_add" filled />
              Registrar Usuario
            </button>
          )}
        </header>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-surface p-4 rounded-2xl border border-outline-variant shadow-sm">
          <div className="relative w-full md:max-w-md">
            <MaterialIcon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              type="text"
              placeholder="Buscar por nombre, puesto o zona..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-12 pl-12 pr-4 bg-surface-container-low border border-outline-variant rounded-xl focus:border-primary outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-2 bg-surface-container rounded-lg p-1">
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "p-2 rounded-md transition-colors",
                viewMode === "grid" ? "bg-surface text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
              )}
            >
              <MaterialIcon name="grid_view" filled={viewMode === "grid"} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "p-2 rounded-md transition-colors",
                viewMode === "list" ? "bg-surface text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
              )}
            >
              <MaterialIcon name="view_list" filled={viewMode === "list"} />
            </button>
          </div>
        </div>

        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredUsers.map((user) => {
              const userZones = workflowSelectors.getUserZones(user)
              return (
                <UserCard 
                  key={user.id} 
                  user={user} 
                  zones={userZones}
                  onEdit={() => handleEdit(user)} 
                  onDelete={() => deleteUser(user.id)} 
                  isEmployee={currentRole === "empleado"}
                />
              )
            })}
          </div>
        ) : (
          <div className="bg-surface rounded-2xl border border-outline-variant overflow-hidden shadow-sm overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-surface-container text-on-surface-variant font-label-md text-label-md uppercase tracking-wider">
                  <th className="p-4 pl-6">Usuario</th>
                  <th className="p-4">Puesto</th>
                  <th className="p-4">Zonas</th>
                  <th className="p-4">Areas</th>
                  <th className="p-4">Rol</th>
                  <th className="p-4 pr-6 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {filteredUsers.map((user) => {
                  const userZones = workflowSelectors.getUserZones(user)
                  return (
                  <tr key={user.id} className="hover:bg-surface-container-low transition-colors group">
                    <td className="p-4 pl-6">
                      <div className="flex items-center gap-4">
                        <img src={user.avatar} alt="" className="w-10 h-10 rounded-full border border-outline-variant shadow-sm" />
                        <div className="flex flex-col">
                          <span className="font-title-sm text-title-sm text-on-surface">{user.name}</span>
                          <span className="font-body-xs text-body-xs text-on-surface-variant italic">{formatNumericDate(user.birthDate)}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 font-body-sm text-body-sm text-on-surface-variant">{user.position}</td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {userZones.length > 0 ? (
                          userZones.map((zone) => (
                            <span key={zone} className="rounded-full bg-surface-container px-2 py-0.5 text-[10px] font-bold uppercase text-on-surface-variant">
                              {zone}
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] text-on-surface-variant">Sin zona</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {(user.areas ?? []).map((area) => (
                          <span key={area} className="rounded-full bg-surface-container px-2 py-0.5 text-[10px] font-bold uppercase text-on-surface-variant">
                            {area}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-4">
                      <RoleBadge role={user.role} />
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEdit(user)} className="p-2 text-primary hover:bg-primary-container rounded-lg transition-colors">
                          <MaterialIcon name="edit" className="text-[20px]" />
                        </button>
                        {currentRole !== "empleado" && (
                          <button onClick={() => deleteUser(user.id)} className="p-2 text-error hover:bg-error-container rounded-lg transition-colors">
                            <MaterialIcon name="delete" className="text-[20px]" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}

        {filteredUsers.length === 0 && (
          <div className="py-20 flex flex-col items-center justify-center text-center bg-surface rounded-3xl border-2 border-dashed border-outline-variant">
            <div className="w-20 h-20 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant mb-4">
              <MaterialIcon name="person_search" className="text-[40px]" />
            </div>
            <h3 className="font-headline-sm text-headline-sm text-on-surface">No se encontraron usuarios</h3>
            <p className="text-on-surface-variant mt-2">Intenta ajustar tu búsqueda o registra uno nuevo.</p>
          </div>
        )}
      </div>

      <UserModal open={modalOpen} onClose={() => setModalOpen(false)} userToEdit={userToEdit} />
    </main>
  )
}

function UserCard({ user, zones, onEdit, onDelete, isEmployee }: { user: User; zones: string[]; onEdit: () => void; onDelete: () => void; isEmployee?: boolean }) {
  const primaryZone = zones[0] || "Sin zona"
  const extraZones = zones.length > 1 ? zones.length - 1 : 0
  const zoneLabel = extraZones > 0 ? `${primaryZone} +${extraZones}` : primaryZone

  return (
    <article className="group bg-surface rounded-3xl border border-outline-variant p-6 shadow-sm hover:shadow-md hover:border-primary/30 transition-all overflow-hidden">
      <div className="w-full flex justify-end pb-2">
        <div className="flex items-center gap-1 rounded-full bg-surface/90 border border-outline-variant p-1 shadow-sm opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} className="w-8 h-8 flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-primary-container rounded-full transition-all">
            <MaterialIcon name="edit" className="text-[18px]" />
          </button>
          {!isEmployee && (
            <button onClick={onDelete} className="w-8 h-8 flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error-container rounded-full transition-all">
              <MaterialIcon name="delete" className="text-[18px]" />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center text-center gap-4 mt-2">
        <div className="relative">
          <img src={user.avatar} alt={user.name} className="w-24 h-24 rounded-full border-2 border-surface-container shadow-inner" />
          <div className="absolute -bottom-1 -right-1">
            <RoleBadge role={user.role} iconOnly />
          </div>
        </div>

        <div className="space-y-1">
          <h3 className="font-title-md text-title-md text-on-surface line-clamp-1">{user.name}</h3>
          <p className="font-body-sm text-body-sm text-primary font-medium">{user.position}</p>
          <div className="flex items-center justify-center gap-1.5 text-on-surface-variant">
            <MaterialIcon name="location_on" className="text-[14px]" />
            <span className="text-[12px]">{zoneLabel}</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {(user.areas ?? []).map((area) => (
              <span key={area} className="rounded-full bg-surface-container-low px-2 py-0.5 text-[10px] font-bold uppercase text-on-surface-variant">
                {area}
              </span>
            ))}
          </div>
        </div>

        <div className="w-full pt-4 border-t border-outline-variant flex items-center justify-between">
          <div className="flex flex-col items-start">
            <span className="text-[10px] font-bold uppercase text-on-surface-variant tracking-wider">Nacimiento</span>
            <span className="text-[12px] font-data-mono">{formatNumericDate(user.birthDate)}</span>
          </div>
          <RoleBadge role={user.role} />
        </div>
      </div>
    </article>
  )
}

function RoleBadge({ role, iconOnly = false }: { role: User["role"]; iconOnly?: boolean }) {
  const normalizedRole = normalizeUserRole(role)
  const config = {
    administrador: {
      color: "bg-primary-container text-on-primary-container border-primary/20",
      icon: "admin_panel_settings",
      label: "Administrador"
    },
    gerente: {
      color: "bg-tertiary-container text-on-tertiary-container border-tertiary/20",
      icon: "manage_accounts",
      label: "Gerente"
    },
    empleado: {
      color: "bg-surface-container-high text-on-surface-variant border-outline-variant",
      icon: "person",
      label: "Empleado"
    }
  }

  const { color, icon, label } = config[normalizedRole] ?? config.empleado

  if (iconOnly) {
    return (
      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shadow-sm border", color)}>
        <MaterialIcon name={icon} className="text-[16px]" filled />
      </div>
    )
  }

  return (
    <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide border", color)}>
      <MaterialIcon name={icon} className="text-[14px]" filled />
      {label}
    </div>
  )
}
