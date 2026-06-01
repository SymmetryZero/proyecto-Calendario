"use client"

import { useEffect, useState, useMemo, type FormEvent } from "react"
import { MaterialIcon } from "@/components/ui/material-icon"
import { cn, createAvatarDataUri, fileToDataUrl } from "@/utils/workflow"
import { AREA_OPTIONS, type UserRole, useWorkflowStore, type User, type Area, workflowSelectors } from "@/store/workflow-store"
import { normalizeUserRole } from "@/utils/roles"

type UserModalProps = {
  open: boolean
  onClose: () => void
  userToEdit?: User | null
}

const roleOptions: Array<{ value: UserRole; label: string }> = [
  { value: "administrador", label: "Administrador" },
  { value: "gerente", label: "Gerente" },
  { value: "empleado", label: "Empleado" }
]

export function UserModal({ open, onClose, userToEdit }: UserModalProps) {
  const users = useWorkflowStore((state) => state.users)
  const currentUserId = useWorkflowStore((state) => state.currentUserId)
  const addUser = useWorkflowStore((state) => state.addUser)
  const updateUser = useWorkflowStore((state) => state.updateUser)

  const currentUser = useMemo(() => users.find(u => u.id === currentUserId), [users, currentUserId])
  const isSelfEmployee = normalizeUserRole(currentUser?.role) === "empleado"

  const [name, setName] = useState("")
  const [birthDate, setBirthDate] = useState("")
  const [position, setPosition] = useState("")
  const [zones, setZones] = useState<string[]>([])
  const [zoneInput, setZoneInput] = useState("")
  const [areas, setAreas] = useState<Area[]>([])
  const [role, setRole] = useState<UserRole>("empleado")
  const [avatar, setAvatar] = useState("")

  const existingZones = useMemo(() => {
    const zoneSet = new Set<string>()
    users.forEach((u) => {
      workflowSelectors.getUserZones(u).forEach((zone) => zoneSet.add(zone))
    })
    return Array.from(zoneSet)
  }, [users])

  useEffect(() => {
    if (!open) return

    if (userToEdit) {
      setName(userToEdit.name)
      setBirthDate(userToEdit.birthDate)
      setPosition(userToEdit.position)
      setZones(workflowSelectors.getUserZones(userToEdit))
      setZoneInput("")
      setAreas(userToEdit.areas ?? [])
      setRole(normalizeUserRole(userToEdit.role))
      setAvatar(userToEdit.avatar)
    } else {
      setName("")
      setBirthDate("")
      setPosition("")
      setZones([])
      setZoneInput("")
      setAreas([])
      setRole("empleado")
      setAvatar("")
    }
  }, [open, userToEdit])

  if (!open) return null

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const dataUrl = await fileToDataUrl(file)
      setAvatar(dataUrl)
    } catch (err) {
      console.error(err)
    }
  }

  function handleAddZone() {
    if (isSelfEmployee) return
    const nextZone = zoneInput.trim()
    if (!nextZone) return
    setZones((current) => (current.includes(nextZone) ? current : [...current, nextZone]))
    setZoneInput("")
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!name.trim()) return

    const trimmedZones = zones.map((zone) => zone.trim()).filter(Boolean)
    const pendingZone = zoneInput.trim()
    if (pendingZone && !trimmedZones.includes(pendingZone)) {
      trimmedZones.push(pendingZone)
    }
    const finalZones = trimmedZones.length > 0 ? trimmedZones : ["General"]
    const primaryZone = finalZones[0]

    const userData = {
      name: name.trim(),
      avatar: avatar || createAvatarDataUri(name.trim()),
      birthDate,
      position: position.trim() || "Colaborador",
      zone: primaryZone,
      zones: finalZones,
      areas: areas.length > 0 ? areas : (["Operacion"] as Area[]),
      role
    }

    if (userToEdit) {
      updateUser(userToEdit.id, userData)
    } else {
      addUser(userData)
    }

    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-primary/60 backdrop-blur-[2px] px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xl rounded-xl border border-outline-variant bg-surface shadow-panel overflow-hidden flex flex-col max-h-[90vh] overflow-x-hidden"
      >
        <div className="flex items-center justify-between p-6 border-b border-outline-variant shrink-0">
          <div className="flex items-center gap-3 text-primary">
            <MaterialIcon name={userToEdit ? "edit" : "person_add"} filled />
            <h2 className="font-headline-md text-headline-md">
              {userToEdit ? "Editar usuario" : "Registrar usuario"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-on-surface-variant hover:bg-surface-container p-2 rounded-full transition-colors"
          >
            <MaterialIcon name="close" />
          </button>
        </div>

        <div className="p-6 grid gap-6 overflow-y-auto scrollbar-thin flex-1">
          {/* Photo Upload Section */}
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="relative group">
              <div className="w-28 h-28 rounded-full border-4 border-surface-container shadow-inner overflow-hidden bg-surface-container-low flex items-center justify-center">
                {avatar ? (
                  <img src={avatar} alt="Vista previa" className="w-full h-full object-cover" />
                ) : (
                  <MaterialIcon name="person" className="text-[48px] text-on-surface-variant" />
                )}
              </div>
              <label 
                className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                <div className="flex flex-col items-center">
                  <MaterialIcon name="photo_camera" />
                  <span className="text-[10px] font-bold uppercase mt-1">Cambiar</span>
                </div>
              </label>
              {avatar && (
                <button
                  type="button"
                  onClick={() => setAvatar("")}
                  className="absolute -top-1 -right-1 w-8 h-8 bg-error text-white rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-transform"
                  title="Eliminar foto"
                >
                  <MaterialIcon name="close" className="text-[16px]" />
                </button>
              )}
            </div>
            <p className="text-[11px] text-on-surface-variant text-center max-w-[200px]">
              Sube una foto cuadrada para mejores resultados (.jpg, .png)
            </p>
          </div>

          <div className="grid gap-2">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">
              Nombre completo
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-12 rounded-lg border border-outline-variant bg-surface px-4 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder="Ej: Juan Pérez"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <label className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">
                Fecha de nacimiento
              </label>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="h-12 rounded-lg border border-outline-variant bg-surface px-4 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                required
              />
            </div>
            <div className="grid gap-2">
              <label className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">
                Rol en el sistema
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                disabled={isSelfEmployee}
                className="h-12 rounded-lg border border-outline-variant bg-surface px-4 outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-surface-container-low"
              >
                {roleOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <label className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">
                Puesto / Cargo
              </label>
              <input
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                disabled={isSelfEmployee}
                className="h-12 rounded-lg border border-outline-variant bg-surface px-4 outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-surface-container-low"
                placeholder="Ej: Supervisor de Obra"
              />
            </div>
            <div className="grid gap-2">
              <label className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">
                Zonas de trabajo
              </label>
              <div className="grid gap-2">
                <input
                  value={zoneInput}
                  onChange={(e) => setZoneInput(e.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault()
                      handleAddZone()
                    }
                  }}
                  list="zones-list"
                  disabled={isSelfEmployee}
                  className="h-12 flex-1 rounded-lg border border-outline-variant bg-surface px-4 outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-surface-container-low"
                  placeholder="Ej: Zona Norte"
                />
                <button
                  type="button"
                  onClick={handleAddZone}
                  disabled={isSelfEmployee}
                  className="h-12 px-4 rounded-lg bg-primary text-on-primary text-xs font-bold uppercase tracking-wider disabled:opacity-60 disabled:cursor-not-allowed justify-self-start"
                >
                  Agregar
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {zones.length > 0 ? (
                  zones.map((zone) => (
                    <span key={zone} className="inline-flex items-center gap-1 rounded-full bg-surface-container-low px-3 py-1 text-[10px] font-bold uppercase text-on-surface-variant">
                      {zone}
                      {!isSelfEmployee && (
                        <button
                          type="button"
                          onClick={() => setZones((current) => current.filter((item) => item !== zone))}
                          className="ml-1 text-on-surface-variant hover:text-primary"
                          aria-label={`Quitar ${zone}`}
                        >
                          <MaterialIcon name="close" className="text-[12px]" />
                        </button>
                      )}
                    </span>
                  ))
                ) : (
                  <span className="text-[11px] text-on-surface-variant">Sin zonas asignadas.</span>
                )}
              </div>
              <p className="text-[11px] text-on-surface-variant">La primera zona es la principal.</p>
              <datalist id="zones-list">
                {existingZones.map((z) => (
                  <option key={z} value={z} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid gap-2">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">
              Areas de trabajo
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {AREA_OPTIONS.map((area) => {
                const isActive = areas.includes(area)
                return (
                  <button
                    key={area}
                    type="button"
                    disabled={isSelfEmployee}
                    onClick={() => {
                      setAreas((current) =>
                        current.includes(area)
                          ? current.filter((item) => item !== area)
                          : [...current, area]
                      )
                    }}
                    className={cn(
                      "px-3 py-2 rounded-lg border text-xs font-semibold uppercase tracking-wider transition-colors",
                      isActive
                        ? "bg-secondary-container text-on-secondary-container border-secondary-fixed"
                        : "bg-surface border-outline-variant text-on-surface-variant hover:bg-surface-container",
                      isSelfEmployee && "opacity-60 cursor-not-allowed"
                    )}
                    aria-pressed={isActive}
                  >
                    {area}
                  </button>
                )
              })}
            </div>
            <p className="text-[11px] text-on-surface-variant">
              Selecciona una o varias areas para asignar tareas.
            </p>
          </div>
        </div>

        <div className="p-6 border-t border-outline-variant bg-surface flex items-center justify-end gap-4 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-12 px-6 font-title-sm text-title-sm text-on-surface-variant hover:bg-surface-container-low rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className={cn(
              "h-12 px-8 font-title-sm text-title-sm rounded-lg transition-opacity flex items-center gap-2 shadow-sm bg-primary text-on-primary",
              name.trim() ? "hover:opacity-90" : "opacity-60 pointer-events-none"
            )}
          >
            <MaterialIcon name="check" filled />
            {userToEdit ? "Guardar cambios" : "Registrar usuario"}
          </button>
        </div>
      </form>
    </div>
  )
}
