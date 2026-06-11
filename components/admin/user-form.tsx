'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { createUser } from '@/app/actions/admin'

export function UserForm() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('employee')
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const result = await createUser(fullName, email, password, role)
      if (result?.error) throw new Error(result.error)
      
      toast({ title: "Usuario creado exitosamente" })
      setFullName('')
      setEmail('')
      setPassword('')
      setRole('employee')
    } catch (error: any) {
      toast({
        title: "Error al crear usuario",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Nombre Completo</Label>
        <Input 
          required 
          value={fullName} 
          onChange={e => setFullName(e.target.value)} 
          placeholder="Juan Pérez" 
        />
      </div>
      <div className="space-y-2">
        <Label>Correo (Login)</Label>
        <Input 
          required 
          type="email"
          value={email} 
          onChange={e => setEmail(e.target.value)} 
          placeholder="juan@empresa.com" 
        />
      </div>
      <div className="space-y-2">
        <Label>Contraseña Inicial</Label>
        <Input 
          required 
          type="text"
          value={password} 
          onChange={e => setPassword(e.target.value)} 
          placeholder="Secreta123" 
        />
      </div>
      <div className="space-y-2">
        <Label>Rol</Label>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="employee">Empleado</SelectItem>
            <SelectItem value="supervisor">Supervisor</SelectItem>
            <SelectItem value="admin">Administrador</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Guardando...' : 'Añadir Usuario'}
      </Button>
    </form>
  )
}
