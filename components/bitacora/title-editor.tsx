'use client'

import { useState } from 'react'
import { updateTaskTitle } from '@/app/actions/bitacora'
import { Pencil, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function TitleEditor({ logId, initialTitle }: { logId: string, initialTitle: string }) {
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(initialTitle || 'Nueva Tarea')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      await updateTaskTitle(logId, title)
      setIsEditing(false)
    } catch (e) {
      alert("Error al actualizar título")
    } finally {
      setSaving(false)
    }
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <Input 
          value={title} 
          onChange={e => setTitle(e.target.value)} 
          className="text-2xl md:text-3xl font-bold h-auto py-1 px-2 w-full max-w-sm"
          autoFocus
        />
        <Button size="icon" variant="ghost" onClick={handleSave} disabled={saving || !title.trim()}>
          <Check className="h-5 w-5 text-green-600" />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => { setIsEditing(false); setTitle(initialTitle) }} disabled={saving}>
          <X className="h-5 w-5 text-red-600" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 group">
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight capitalize leading-tight">
        {title}
      </h1>
      <Button 
        size="icon" 
        variant="ghost" 
        className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8" 
        onClick={() => setIsEditing(true)}
      >
        <Pencil className="h-4 w-4 text-muted-foreground" />
      </Button>
    </div>
  )
}
