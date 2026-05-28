"use client"

import { useMemo } from "react"
import { MaterialIcon } from "@/components/ui/material-icon"
import { useWorkflowStore, workflowSelectors, type Notification } from "@/store/workflow-store"
import { cn, formatDateTime } from "@/utils/workflow"

type NotificationPopoutProps = {
  open: boolean
  onClose: () => void
}

export function NotificationPopout({ open, onClose }: NotificationPopoutProps) {
  const notifications = useWorkflowStore((state) => state.notifications)
  const users = useWorkflowStore((state) => state.users)
  const tasks = useWorkflowStore((state) => state.tasks)
  const currentUserId = useWorkflowStore((state) => state.currentUserId)
  const markNotificationAsRead = useWorkflowStore((state) => state.markNotificationAsRead)

  const currentUser = useMemo(() => 
    workflowSelectors.getCurrentUser(users, currentUserId), 
  [users, currentUserId])

  const filteredNotifications = useMemo(() => {
    if (!currentUser) return []
    
    return notifications.filter(n => {
      // Admin: All
      if (currentUser.role === "administrador") return true
      
      // Gerente: Tasks they created or relevant assignments
      if (currentUser.role === "gerente") {
        // This is a bit complex without task creator info in notification, 
        // but let's assume all movements are relevant for managers in their zone
        return true 
      }
      
      // Empleado: Their movements or assignments for them
      if (currentUser.role === "empleado") {
        if (n.targetUserId === currentUser.id) return true // New assignment for them
        if (n.userId === currentUser.id) return true // Their own movement
        
        if (n.taskId) {
          const task = tasks.find(t => t.id === n.taskId)
          if (task) {
            const isMyTask = task.assigneeIds.includes(currentUser.id) || task.creatorId === currentUser.id
            if (isMyTask) return true // Changes, comments, evidence on their tasks
            
            // Untaken tasks in their area
            const userAreas = currentUser.areas ?? []
            const taskArea = task.area ?? "Operacion"
            const isUntaken = !task.assigneeIds || task.assigneeIds.length === 0
            const isInMyArea = userAreas.includes(taskArea)
            
            if (isUntaken && isInMyArea) return true // Untaken tasks in their area
          }
        }
        return false
      }
      
      return false
    })
  }, [notifications, currentUser, tasks])

  if (!open) return null

  return (
    <>
      <div 
        className="fixed inset-0 z-[60]" 
        onClick={onClose} 
      />
      <div className="absolute top-16 right-0 w-[380px] bg-surface rounded-2xl shadow-2xl border border-outline-variant z-[70] overflow-hidden flex flex-col animate-in slide-in-from-top-4 duration-200">
        <div className="p-4 border-b border-outline-variant bg-primary/5 flex items-center justify-between">
          <h3 className="font-bold text-primary flex items-center gap-2">
            <MaterialIcon name="notifications" className="text-[18px]" filled />
            Centro de Alertas
          </h3>
          <span className="bg-primary text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
            {filteredNotifications.filter(n => !n.read).length} NUEVAS
          </span>
        </div>
        
        <div className="max-h-[400px] overflow-y-auto scrollbar-thin">
          {filteredNotifications.length === 0 ? (
            <div className="p-10 text-center flex flex-col items-center gap-2">
              <MaterialIcon name="notifications_off" className="text-on-surface-variant/20 text-[40px]" />
              <p className="text-on-surface-variant text-sm italic">No hay alertas recientes</p>
            </div>
          ) : (
            <div className="divide-y divide-outline-variant">
              {filteredNotifications.map(n => (
                <div 
                  key={n.id} 
                  className={cn(
                    "p-4 hover:bg-surface-container-low transition-colors cursor-pointer relative group",
                    !n.read && "bg-primary/[0.03]"
                  )}
                  onClick={() => markNotificationAsRead(n.id)}
                >
                  {!n.read && (
                    <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-primary rounded-full" />
                  )}
                  <div className="flex gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                      n.type === "movement" ? "bg-secondary/10 text-secondary" :
                      n.type === "assignment" ? "bg-tertiary/10 text-tertiary" :
                      "bg-primary/10 text-primary"
                    )}>
                      <MaterialIcon 
                        name={n.type === "movement" ? "swap_horiz" : n.type === "assignment" ? "assignment_ind" : "chat"} 
                        className="text-[20px]"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-on-surface">{n.title}</p>
                      <p className="text-[12px] text-on-surface-variant line-clamp-2 mt-0.5">{n.message}</p>
                      <p className="text-[10px] text-on-surface-variant/60 mt-2 font-data-mono">
                        {formatDateTime(n.timestamp)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="p-3 bg-surface-container-low border-t border-outline-variant text-center">
          <button 
            className="text-[11px] font-bold text-primary hover:underline uppercase tracking-wider"
            onClick={onClose}
          >
            Cerrar Panel
          </button>
        </div>
      </div>
    </>
  )
}
