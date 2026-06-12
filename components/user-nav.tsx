'use client'

import { useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { LogOut, User as UserIcon } from 'lucide-react'
import { logoutAction } from '@/app/actions/auth'
import { EditProfileDialog } from './edit-profile-dialog'

export function UserNav({ profile }: { profile: any }) {
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false)

  const handleLogout = async () => {
    await logoutAction()
    window.location.href = '/login'
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0 flex items-center justify-center bg-primary/10 hover:bg-primary/20">
            <span className="font-bold text-primary">{profile.full_name.charAt(0).toUpperCase()}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{profile.full_name}</p>
              <p className="text-xs leading-none text-muted-foreground">
                {profile.email} ({profile.role})
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setIsEditProfileOpen(true)} className="cursor-pointer">
            <UserIcon className="mr-2 h-4 w-4" />
            <span>Editar Perfil</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600 focus:text-red-600">
            <LogOut className="mr-2 h-4 w-4" />
            <span>Cerrar sesión</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditProfileDialog 
        open={isEditProfileOpen} 
        onOpenChange={setIsEditProfileOpen}
        profile={profile}
      />
    </>
  )
}
