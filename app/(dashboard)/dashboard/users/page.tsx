import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { UserForm } from '@/components/admin/user-form'
import { UserList } from '@/components/admin/user-list'

export default async function UsersPage() {
  const session = await getSession()
  if (!session || (session.role !== 'admin' && session.role !== 'supervisor')) {
    redirect('/dashboard')
  }

  const supabase = await createClient()

  const { data: users } = await supabase
    .from('calendario_profiles')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Directorio de Empleados</h1>
        <p className="text-muted-foreground">
          Administra las cuentas de usuario y sus roles.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Añadir Nuevo Usuario</CardTitle>
            <CardDescription>
              Crea una nueva cuenta manualmente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UserForm />
          </CardContent>
        </Card>
        
        <Card className="col-span-1 md:col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle>Usuarios Registrados</CardTitle>
          </CardHeader>
          <CardContent>
            <UserList initialUsers={users || []} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
