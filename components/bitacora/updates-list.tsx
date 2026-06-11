'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { addProgressUpdate } from '@/app/actions/bitacora'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'

type Update = {
  id: string
  comment: string
  created_at: string
  calendario_profiles: { full_name: string }
}

export function UpdatesList({ 
  logId, 
  initialUpdates,
  isFinished
}: { 
  logId: string, 
  initialUpdates: Update[],
  isFinished: boolean
}) {
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const handleAdd = async () => {
    if (!comment.trim()) return
    setSaving(true)
    try {
      await addProgressUpdate(logId, comment)
      setComment('')
      toast({ title: "Actualización agregada" })
      // Next.js revalidatePath will refresh the list automatically
    } catch (e) {
      toast({ title: "Error", description: "No se pudo agregar la actualización.", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
        {initialUpdates.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No hay actualizaciones aún.</p>
        ) : (
          initialUpdates.map(u => (
            <div key={u.id} className="bg-muted/50 p-3 rounded-lg text-sm border">
              <p>{u.comment}</p>
              <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                <span>{u.calendario_profiles?.full_name}</span>
                <span>{format(new Date(u.created_at), 'HH:mm')}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {!isFinished && (
        <div className="flex gap-2 items-start mt-4 border-t pt-4">
          <Textarea 
            placeholder="Escribe un avance (ej: Instalación al 50%)..." 
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="resize-none min-h-[60px]"
          />
          <Button onClick={handleAdd} disabled={saving || !comment.trim()}>
            {saving ? '...' : 'Añadir'}
          </Button>
        </div>
      )}
    </div>
  )
}
