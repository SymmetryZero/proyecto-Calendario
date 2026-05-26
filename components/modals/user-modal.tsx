"use client"

import { useEffect, useState, useMemo, type FormEvent } from "react"
import { MaterialIcon } from "@/components/ui/material-icon"
import { cn, createAvatarDataUri, fileToDataUrl } from "@/utils/workflow"
import { AREA_OPTIONS, type UserRole, useWorkflowStore, type User, type Area } from "@/store/workflow-store"

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
  const isSelfEmployee = currentUser?.role === "empleado"

  const [name, setName] = useState("")
  const [birthDate, setBirthDate] = useState("")
  const [position, setPosition] = useState("")
  const [zone, setZone] = useState("")
  const [areas, setAreas] = useState<Area[]>([])
  const [role, setRole] = useState<UserRole>("empleado")
  const [avatar, setAvatar] = useState("")

  const existingZones = useMemo(() => {
    return Array.from(new Set(users.map((u) => u.zone).filter(Boolean)))
  }, [users])

  useEffect(() => {
    if (!open) return

    if (userToEdit) {
      setName(userToEdit.name)
      setBirthDate(userToEdit.birthDate)
      setPosition(userToEdit.position)
      setZone(userToEdit.zone)
      setAreas(userToEdit.areas ?? [])
      setRole(userToEdit.role)
      setAvatar(userToEdit.avatar)
    } else {
      setName("")
      setBirthDate("")
      setPosition("")
      setZone("")
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!name.trim()) return

    const userData = {
      name: name.trim(),
      avatar: avatar || createAvatarDataUri(name.trim()),
      birthDate,
      position: position.trim() || "Colaborador",
      zone: zone.trim() || "General",
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
        className="w-full max-w-xl rounded-xl border border-outline-variant bg-surface shadow-panel overflow-hidden"
      >
        <div className="flex items-center justify-between p-6 border-b border-outline-variant">
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

        <div className="p-6 grid gap-6">
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

          <div className="grid grid-cols-2 gap-4">
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

          <div className="grid grid-cols-2 gap-4">
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
                Lugar o Zona
              </label>
              <input
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                list="zones-list"
                disabled={isSelfEmployee}
                className="h-12 rounded-lg border border-outline-variant bg-surface px-4 outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-surface-container-low"
                placeholder="Ej: Zona Norte"
              />
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
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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

        <div className="p-6 border-t border-outline-variant bg-surface flex items-center justify-end gap-4">
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
