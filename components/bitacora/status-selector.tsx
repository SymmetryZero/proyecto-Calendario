'use client'

import { useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { updateWorkStatus } from '@/app/actions/bitacora'
import { useToast } from '@/hooks/use-toast'

const STATUSES = ['Trabajando', 'En pausa', 'En traslado', 'En reunión', 'Finalizó actividades']

export function StatusSelector({ logId, initialStatus }: { logId: string, initialStatus: string }) {
  const [status, setStatus] = useState(initialStatus)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleChange = async (newStatus: string) => {
    setStatus(newStatus)
    setLoading(true)
    try {
      await updateWorkStatus(logId, newStatus)
      toast({
        title: "Estado actualizado",
        description: `Tu estado ahora es: ${newStatus}`,
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado.",
        variant: "destructive"
      })
      setStatus(initialStatus) // revert
    } finally {
      setLoading(false)
    }
  }

  return (
    <Select value={status} onValueChange={handleChange} disabled={loading || initialStatus === 'Finalizó actividades'}>
      <SelectTrigger className="w-[200px] border-primary/20 bg-primary/5 font-medium text-primary">
        <SelectValue placeholder="Selecciona un estado" />
      </SelectTrigger>
      <SelectContent>
        {STATUSES.map(s => (
          <SelectItem key={s} value={s}>{s}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
