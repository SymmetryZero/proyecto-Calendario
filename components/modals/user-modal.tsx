"use client"

import { useEffect, useState, useMemo, type FormEvent } from "react"
import { MaterialIcon } from "@/components/ui/material-icon"
import { cn, createAvatarDataUri } from "@/utils/workflow"
import { type UserRole, useWorkflowStore, type User } from "@/store/workflow-store"

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
  const addUser = useWorkflowStore((state) => state.addUser)
  const updateUser = useWorkflowStore((state) => state.updateUser)

  const [name, setName] = useState("")
  const [birthDate, setBirthDate] = useState("")
  const [position, setPosition] = useState("")
  const [zone, setZone] = useState("")
  const [role, setRole] = useState<UserRole>("empleado")

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
      setRole(userToEdit.role)
    } else {
      setName("")
      setBirthDate("")
      setPosition("")
      setZone("")
      setRole("empleado")
    }
  }, [open, userToEdit])

  if (!open) return null

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!name.trim()) return

    const userData = {
      name: name.trim(),
      avatar: createAvatarDataUri(name.trim()),
      birthDate,
      position: position.trim() || "Colaborador",
      zone: zone.trim() || "General",
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

        <div className="p-6 grid gap-5">
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
                className="h-12 rounded-lg border border-outline-variant bg-surface px-4 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
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
                className="h-12 rounded-lg border border-outline-variant bg-surface px-4 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
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
                className="h-12 rounded-lg border border-outline-variant bg-surface px-4 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="Ej: Zona Norte"
              />
              <datalist id="zones-list">
                {existingZones.map((z) => (
                  <option key={z} value={z} />
                ))}
              </datalist>
            </div>
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
