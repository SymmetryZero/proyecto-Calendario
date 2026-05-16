"use client"

import { MaterialIcon } from "@/components/ui/material-icon"
import { useWorkflowStore } from "@/store/workflow-store"
import { cn } from "@/utils/workflow"

export function GlobalAlertModal() {
  const globalAlert = useWorkflowStore((state) => state.globalAlert)
  const setGlobalAlert = useWorkflowStore((state) => state.setGlobalAlert)

  if (!globalAlert) return null

  const icons = {
    error: { name: "error", class: "bg-error text-white" },
    warning: { name: "warning", class: "bg-warning text-on-warning" },
    info: { name: "info", class: "bg-info text-on-info" }
  }

  const config = icons[globalAlert.type]

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm px-6">
      <div className="w-full max-w-md bg-surface rounded-[24px] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-outline-variant">
        <div className="p-6 flex flex-col items-center text-center gap-4">
          <div className={cn("w-16 h-16 rounded-full flex items-center justify-center shadow-lg", config.class)}>
            <MaterialIcon name={config.name} className="text-[32px]" filled />
          </div>
          
          <div>
            <h3 className="font-headline-sm text-headline-sm text-on-surface">{globalAlert.title}</h3>
            <p className="mt-2 text-on-surface-variant leading-relaxed">
              {globalAlert.message}
            </p>
          </div>
        </div>
        
        <div className="p-4 bg-surface-container-low border-t border-outline-variant flex justify-center">
          <button 
            onClick={() => setGlobalAlert(null)}
            className="w-full h-12 bg-primary text-white rounded-xl font-bold hover:brightness-110 active:scale-95 transition-all shadow-md"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  )
}
