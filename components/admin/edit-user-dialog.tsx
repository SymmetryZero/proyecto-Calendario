'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { adminUpdateUser } from '@/app/actions/auth'

export function EditUserDialog({ 
  open, 
  onOpenChange, 
  user 
}: { 
  open: boolean, 
  onOpenChange: (open: boolean) => void,
  user: any
}) {
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '')
      setRole(user.role || 'employee')
      setPassword('')
    }
  }, [user])

  const handleSave = async () => {
    if (!user) return
    setIsLoading(true)
    try {
      await adminUpdateUser(user.id, fullName, role, password)
      onOpenChange(false)
    } catch (error: any) {
      alert(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Empleado</DialogTitle>
          <DialogDescription>Modifica los datos de {user.full_name}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-name">Nombre Completo</Label>
            <Input 
              id="edit-name" 
              value={fullName} 
              onChange={(e) => setFullName(e.target.value)} 
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-role">Rol en el sistema</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona el rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="employee">Empleado (Normal)</SelectItem>
                <SelectItem value="supervisor">Supervisor</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-password">Nueva Contraseña (opcional)</Label>
            <Input 
              id="edit-password" 
              type="password"
              placeholder="Deja en blanco para no cambiarla"
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isLoading || !fullName.trim() || !role}>
            {isLoading ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
