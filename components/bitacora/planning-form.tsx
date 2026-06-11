'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { savePlanning } from '@/app/actions/bitacora'
import { useToast } from '@/hooks/use-toast'

export function PlanningForm({ 
  logId, 
  initialPlanned, 
  initialObjectives, 
  initialPriority,
  isFinished
}: { 
  logId: string, 
  initialPlanned: string, 
  initialObjectives: string, 
  initialPriority: string,
  isFinished: boolean
}) {
  const [planned, setPlanned] = useState(initialPlanned || '')
  const [objectives, setObjectives] = useState(initialObjectives || '')
  const [priority, setPriority] = useState(initialPriority || 'Media')
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const handleSave = async () => {
    setSaving(true)
    try {
      await savePlanning(logId, planned, objectives, priority)
      toast({ title: "Planeación guardada", description: "Se actualizaron los datos del día." })
    } catch (e) {
      toast({ title: "Error", description: "No se pudo guardar la planeación.", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label>Actividades Planeadas</Label>
        <Textarea 
          placeholder="Ej: Visitar a 3 clientes, reparar equipo X..." 
          value={planned}
          onChange={(e) => setPlanned(e.target.value)}
          disabled={isFinished}
          className="resize-none"
        />
      </div>
      <div className="grid gap-2">
        <Label>Objetivos Principales</Label>
        <Textarea 
          placeholder="Ej: Cerrar 2 ventas, terminar instalación." 
          value={objectives}
          onChange={(e) => setObjectives(e.target.value)}
          disabled={isFinished}
          className="resize-none"
        />
      </div>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mt-4">
        <div className="grid gap-2 w-full sm:w-[200px]">
          <Label>Prioridad del Día</Label>
          <Select value={priority} onValueChange={setPriority} disabled={isFinished}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Baja">Baja</SelectItem>
              <SelectItem value="Media">Media</SelectItem>
              <SelectItem value="Alta">Alta</SelectItem>
              <SelectItem value="Urgente">Urgente</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleSave} disabled={saving || isFinished} className="w-full sm:w-auto">
          {saving ? 'Guardando...' : 'Guardar Planeación'}
        </Button>
      </div>
    </div>
  )
}
