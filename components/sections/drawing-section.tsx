"use client"

import { useState } from "react"
import { TaskDrawingCanvas } from "@/components/task-drawing-canvas"
import { type DrawingScene, useWorkflowStore } from "@/store/workflow-store"

export function DrawingSection() {
  const resetDemoData = useWorkflowStore((state) => state.resetDemoData)
  const setDrawingScene = useWorkflowStore((state) => state.setDrawingScene)
  const [scene, setScene] = useState<DrawingScene | null>(() => useWorkflowStore.getState().drawingScene)

  return (
    <main className="flex-1 min-h-0 p-gutter flex flex-col overflow-hidden">
      <TaskDrawingCanvas
        key={scene?.updatedAt ?? "canvas-inicial"}
        scene={scene}
        title="Pizarra técnica"
        description="Traza croquis, líneas y mediciones. Guarda el plano localmente cuando lo necesites."
        saveLabel="Guardar plano"
        resetLabel="Restablecer lienzo"
        className="flex-1 min-h-0"
        onSave={(draft) => {
          setDrawingScene(draft)
          setScene({ ...draft, updatedAt: new Date().toISOString() })
        }}

      />
    </main>
  )
}
