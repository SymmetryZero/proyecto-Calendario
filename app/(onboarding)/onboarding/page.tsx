'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { completeOnboarding } from '@/app/actions/user'

export default function OnboardingPage() {
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  
  const router = useRouter()
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) return

    setLoading(true)
    
    try {
      await completeOnboarding(fullName)
      router.push('/dashboard')
      router.refresh()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Ocurrió un error al guardar tu perfil.",
        variant: "destructive",
      })
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Completa tu perfil</CardTitle>
          <CardDescription>
            Antes de continuar, necesitamos que ingreses tu nombre completo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="fullName">Nombre Completo</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Ej. Juan Pérez"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !fullName.trim()}>
                {loading ? 'Guardando...' : 'Continuar'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
