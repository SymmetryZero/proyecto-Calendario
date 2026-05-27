"use client"

import { TaskDrawingCanvas } from "@/components/task-drawing-canvas"
import { useWorkflowStore } from "@/store/workflow-store"

export function DrawingSection() {
  const setDrawingScene = useWorkflowStore((state) => state.setDrawingScene)
  const scene = useWorkflowStore((state) => state.drawingScene)

  return (
    <main className="flex-1 min-h-0 p-gutter flex flex-col overflow-hidden">
      <TaskDrawingCanvas
        key={scene?.updatedAt ?? "canvas-inicial"}
        scene={scene}
        title="Pizarra tecnica"
        description="Traza croquis, lineas y mediciones. Guarda el plano directamente en tu espacio de trabajo."
        saveLabel="Guardar plano"
        resetLabel="Restablecer lienzo"
        className="flex-1 min-h-0"
        onSave={(draft) => {
          setDrawingScene(draft)
        }}
      />
    </main>
  )
}
