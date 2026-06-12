import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import Link from 'next/link'
import { Calendar, LayoutDashboard, LogOut, CheckSquare, Users, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { logoutAction } from '@/app/actions/auth'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import { UserNav } from '@/components/user-nav'
import { NotificationBell } from '@/components/notification-bell'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('calendario_profiles')
    .select('*')
    .eq('id', session.userId)
    .single()

  if (!profile) {
    redirect('/login')
  }

  // Si no tiene nombre completo (posible si solo se insertó el correo de alguna forma, aunque ahora es obligatorio)
  if (!profile.full_name) {
    redirect('/onboarding')
  }

  const isAdmin = profile.role === 'admin'
  const isSupervisor = profile.role === 'supervisor'
  const canManage = isAdmin || isSupervisor

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 shadow-sm">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="shrink-0 md:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex flex-col">
            <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
            <nav className="grid gap-2 text-lg font-medium mt-6">
              <Link href="/dashboard" className="flex items-center gap-2 text-lg font-semibold mb-4">
                <LayoutDashboard className="h-6 w-6 text-primary" />
                <span>Calendario Tierra Firme</span>
              </Link>
              <Link href="/dashboard" className="hover:text-foreground text-muted-foreground py-2">
                Inicio
              </Link>
              <Link href="/dashboard/calendar" className="hover:text-foreground text-muted-foreground py-2">
                Calendario
              </Link>
              {canManage && (
                <Link href="/dashboard/users" className="hover:text-foreground text-muted-foreground py-2">
                  Empleados
                </Link>
              )}
              {isAdmin && (
                <Link href="/dashboard/audit" className="hover:text-foreground text-muted-foreground py-2">
                  Auditoría
                </Link>
              )}
            </nav>
          </SheetContent>
        </Sheet>
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
          <LayoutDashboard className="h-6 w-6 text-primary" />
          <span className="hidden sm:inline-block">Calendario Tierra Firme</span>
        </Link>
        <nav className="hidden md:flex gap-6 ml-6 text-sm font-medium">
          <Link href="/dashboard" className="transition-colors hover:text-foreground/80 text-foreground">
            Inicio
          </Link>
        </nav>
        <div className="flex w-full items-center gap-4 md:ml-auto md:gap-2 lg:gap-4 justify-end">
          <NotificationBell userId={session.userId} />
          <UserNav profile={profile} />
        </div>
      </header>
      <div className="flex flex-1">
        <aside className="hidden w-64 flex-col border-r bg-background md:flex">
          <nav className="grid gap-2 p-4 text-sm font-medium">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-primary bg-primary/10 transition-all hover:text-primary"
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>
            <Link
              href="/dashboard/calendar"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
            >
              <Calendar className="h-4 w-4" />
              Calendario
            </Link>
            {canManage && (
              <>
                <div className="mt-4 mb-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Administración
                </div>
                <Link
                  href="/dashboard/users"
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
                >
                  <Users className="h-4 w-4" />
                  Directorio
                </Link>
              </>
            )}
            {isAdmin && (
              <Link
                href="/dashboard/audit"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
              >
                <CheckSquare className="h-4 w-4" />
                Auditoría
              </Link>
            )}
          </nav>
        </aside>
        <main className="flex-1 p-4 md:p-6 w-full overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}
