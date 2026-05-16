"use client"

import { MaterialIcon } from "@/components/ui/material-icon"
import { cn } from "@/utils/workflow"

type HelpModalProps = {
  open: boolean
  onClose: () => void
}

export function HelpModal({ open, onClose }: HelpModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-primary/60 backdrop-blur-md px-4 py-6">
      <div className="relative w-full max-w-4xl max-h-full flex flex-col bg-surface rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="p-8 border-b border-outline-variant flex items-center justify-between bg-primary/5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
              <MaterialIcon name="help" filled />
            </div>
            <div>
              <h2 className="font-display-md text-display-md text-primary">Tutorial de Flujo Pro</h2>
              <p className="text-on-surface-variant font-body-md">Guía rápida de uso y reglas del sistema</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors"
          >
            <MaterialIcon name="close" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 scrollbar-thin">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {/* Reglas de Roles */}
            <section className="space-y-6">
              <h3 className="font-title-lg text-title-lg text-primary flex items-center gap-3">
                <MaterialIcon name="gavel" className="text-secondary" />
                Reglas y Permisos
              </h3>
              
              <div className="space-y-4">
                <RuleItem 
                  title="Administrador"
                  description="Control total. Puede mover tareas en cualquier dirección, crear usuarios y ver todas las zonas."
                  icon="admin_panel_settings"
                  color="text-primary"
                />
                <RuleItem 
                  title="Gerente"
                  description="Supervisa su zona. Puede crear tareas y moverlas libremente, pero no gestiona usuarios globales."
                  icon="manage_accounts"
                  color="text-tertiary"
                />
                <RuleItem 
                  title="Empleado"
                  description="Flujo Unidireccional. Solo puede avanzar tareas. Una vez finalizada (Hecho), no puede reabrirla."
                  icon="person"
                  color="text-secondary"
                />
              </div>

              <div className="p-4 bg-error-container/20 rounded-2xl border border-error/20 flex gap-3">
                <MaterialIcon name="warning" className="text-error" />
                <p className="text-[12px] text-error font-medium leading-relaxed">
                  IMPORTANTE: Los empleados tienen bloqueado el retroceso de estatus para garantizar la integridad del flujo de trabajo.
                </p>
              </div>
            </section>

            {/* Guía de Uso */}
            <section className="space-y-6">
              <h3 className="font-title-lg text-title-lg text-primary flex items-center gap-3">
                <MaterialIcon name="auto_stories" className="text-secondary" />
                Guía de Uso Rápido
              </h3>

              <div className="space-y-6">
                <StepItem 
                  step="1"
                  title="Gestión de Tiempos"
                  content="Los contadores corren automáticamente por cada estatus. Al mover una tarea, el tiempo se acumula en la fase anterior y comienza en la nueva."
                />
                <StepItem 
                  step="2"
                  title="Búsqueda Inteligente"
                  content="Usa la lupa para filtrar por nombre de tarea, descripción, código, zona o personal asignado."
                />
                <StepItem 
                  step="3"
                  title="Evidencia y Notas"
                  content="Dentro de cada tarea puedes subir fotos, videos o audio como evidencia, y dejar notas técnicas para el equipo."
                />
                <StepItem 
                  step="4"
                  title="Alertas en Vivo"
                  content="Recibe notificaciones inmediatas de cambios de estado, nuevas asignaciones o mensajes de otros usuarios."
                />
              </div>
            </section>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-outline-variant bg-surface-container-low flex justify-end">
          <button 
            onClick={onClose}
            className="h-12 px-8 bg-primary text-white rounded-xl font-bold hover:brightness-110 active:scale-95 transition-all shadow-lg"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}

function RuleItem({ title, description, icon, color }: { title: string; description: string; icon: string; color: string }) {
  return (
    <div className="flex gap-4 p-4 rounded-2xl border border-outline-variant hover:bg-surface-container-lowest transition-colors">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center bg-surface-container-high", color)}>
        <MaterialIcon name={icon} filled />
      </div>
      <div className="flex-1">
        <h4 className="font-bold text-on-surface text-sm">{title}</h4>
        <p className="text-[12px] text-on-surface-variant leading-relaxed mt-0.5">{description}</p>
      </div>
    </div>
  )
}

function StepItem({ step, title, content }: { step: string; title: string; content: string }) {
  return (
    <div className="flex gap-4">
      <div className="w-8 h-8 rounded-full bg-secondary text-white flex items-center justify-center font-bold text-sm shrink-0">
        {step}
      </div>
      <div>
        <h4 className="font-bold text-on-surface text-sm">{title}</h4>
        <p className="text-[12px] text-on-surface-variant leading-relaxed mt-1">{content}</p>
      </div>
    </div>
  )
}
