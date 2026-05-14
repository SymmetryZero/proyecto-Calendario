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
        extraActions={
          <button
            type="button"
            onClick={() => {
              resetDemoData()
              setScene(null)
            }}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-outline-variant bg-surface px-4 font-title-sm text-title-sm text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">restart_alt</span>
            Restaurar demo
          </button>
        }
      />
    </main>
  )
}
