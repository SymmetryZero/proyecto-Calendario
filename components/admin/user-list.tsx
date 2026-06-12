'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EditUserDialog } from './edit-user-dialog'
import { adminDeleteUser } from '@/app/actions/auth'

type User = {
  id: string
  full_name: string
  email: string
  role: string
  created_at: string
}

export function UserList({ initialUsers }: { initialUsers: User[] }) {
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    // Escuchar cambios en la tabla de profiles en tiempo real
    const channel = supabase
      .channel('public:calendario_profiles')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calendario_profiles' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setUsers((prev) => [payload.new as User, ...prev])
          } else if (payload.eventType === 'DELETE') {
            setUsers((prev) => prev.filter(u => u.id !== payload.old.id))
          } else if (payload.eventType === 'UPDATE') {
            setUsers((prev) => prev.map(u => u.id === payload.new.id ? payload.new as User : u))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar al usuario ${name}? Esto borrará TODAS sus bitácoras, avances y chats. Esta acción NO se puede deshacer.`)) {
      try {
        await adminDeleteUser(id)
      } catch (error: any) {
        alert("Error al eliminar: " + error.message)
      }
    }
  }

  return (
    <>
      <div className="space-y-4">
      {users?.map(user => (
        <div key={user.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
              {user.full_name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div>
              <p className="font-medium">{user.full_name}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right flex flex-col items-end gap-1">
              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-muted uppercase tracking-wider">
                {user.role}
              </span>
              <span className="text-xs text-muted-foreground">
                {format(new Date(user.created_at), "d MMM yyyy", { locale: es })}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => { setSelectedUser(user); setIsEditDialogOpen(true); }} title="Editar usuario">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(user.id, user.full_name)} title="Eliminar usuario">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ))}
      {users.length === 0 && (
        <p className="text-center text-muted-foreground py-4">No hay usuarios registrados</p>
      )}
      </div>

      <EditUserDialog 
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        user={selectedUser}
      />
    </>
  )
}
