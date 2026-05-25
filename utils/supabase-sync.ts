import { supabase } from "./supabase"
import type {
  User,
  Folder,
  Requirement,
  Task,
  TaskActivity,
  AssignmentRecord,
  EvidenceFile,
  Notification,
  WorkflowSeed
} from "@/store/workflow-store"

export async function pullFromSupabase(): Promise<WorkflowSeed | null> {
  try {
    // 1. Fetch from all 8 tables in parallel
    const [
      { data: dbUsers, error: uErr },
      { data: dbFolders, error: fErr },
      { data: dbRequirements, error: rErr },
      { data: dbTasks, error: tErr },
      { data: dbAssignments, error: aErr },
      { data: dbActivities, error: acErr },
      { data: dbEvidence, error: eErr },
      { data: dbNotifications, error: nErr }
    ] = await Promise.all([
      supabase.from("flow_servimeci_users").select("*"),
      supabase.from("flow_servimeci_folders").select("*"),
      supabase.from("flow_servimeci_requirements").select("*"),
      supabase.from("flow_servimeci_tasks").select("*"),
      supabase.from("flow_servimeci_assignments").select("*"),
      supabase.from("flow_servimeci_activities").select("*"),
      supabase.from("flow_servimeci_evidence").select("*"),
      supabase.from("flow_servimeci_notifications").select("*")
    ])

    if (uErr || fErr || rErr || tErr || aErr || acErr || eErr || nErr) {
      console.error("Error fetching data from Supabase:", { uErr, fErr, rErr, tErr, aErr, acErr, eErr, nErr })
      return null
    }

    // If there is no user data or folder data, we consider the DB is unseeded
    if (!dbUsers || dbUsers.length === 0) {
      console.log("Supabase database seems empty, seeding with default mock data...")
      return null
    }

    // 2. Map and reconstruct Zustand structures
    // Group activities by task_id for fast lookup
    const activitiesByTaskId: Record<string, TaskActivity[]> = {}
    dbActivities?.forEach((dbAct) => {
      let parsedContent = dbAct.content
      if (dbAct.type === "drawing") {
        try {
          parsedContent = JSON.parse(dbAct.content)
        } catch (e) {
          console.error("Error parsing drawing activity content:", e)
        }
      }
      const act: TaskActivity = {
        id: dbAct.id,
        type: dbAct.type,
        content: parsedContent,
        createdAt: dbAct.created_at || new Date().toISOString(),
        updatedAt: dbAct.updated_at || undefined,
        metadata: dbAct.metadata || undefined
      }
      if (!activitiesByTaskId[dbAct.task_id]) {
        activitiesByTaskId[dbAct.task_id] = []
      }
      activitiesByTaskId[dbAct.task_id].push(act)
    })

    const users: User[] = dbUsers.map((u) => ({
      id: u.id,
      name: u.name,
      avatar: u.avatar || "",
      birthDate: u.birth_date || "",
      position: u.position || "",
      zone: u.zone || "",
      role: u.role,
      skills: u.skills || [],
      clearances: u.clearances || [],
      availability: u.availability || "available",
      availabilityLabel: u.availability_label || "Disponible",
      code: u.code || undefined,
      createdAt: u.created_at || new Date().toISOString(),
      showAllZones: u.role === "administrador",
      areas: u.role === "administrador" || u.role === "gerente" ? ["Direccion", "Contabilidad", "Compras", "Proyectos", "RH", "Operacion"] : ["Operacion"]
    }))

    const folders: Folder[] = dbFolders.map((f) => ({
      id: f.id,
      name: f.name,
      parentId: f.parent_id || null,
      createdAt: f.created_at || new Date().toISOString(),
      updatedAt: f.updated_at || new Date().toISOString()
    }))

    const requirements: Requirement[] = dbRequirements.map((r) => ({
      id: r.id,
      code: r.code,
      title: r.title,
      description: r.description || "",
      location: r.location || "",
      area: r.area || null,
      dueLabel: r.due_label || "",
      priority: r.priority || "medium",
      status: r.status || "unassigned",
      requiredSkills: r.required_skills || [],
      requiredClearances: r.required_clearances || [],
      estimatedHours: r.estimated_hours ? Number(r.estimated_hours) : undefined,
      selectedTechnicianId: r.selected_technician_id || null,
      notes: r.notes || "",
      assignedAt: r.assigned_at || null,
      creatorId: r.creator_id || "user-1",
      createdAt: r.created_at || new Date().toISOString()
    }))

    const tasks: Task[] = dbTasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description || "",
      priority: t.priority || "medium",
      status: t.status || "todo",
      assigneeIds: t.assignee_ids || [],
      createdAt: t.created_at || new Date().toISOString(),
      updatedAt: t.updated_at || new Date().toISOString(),
      timerStartedAt: t.timer_started_at ? Number(t.timer_started_at) : null,
      statusDurations: t.status_durations || { todo: 0, inProgress: 0, review: 0, done: 0 },
      location: t.location || "",
      area: t.area || null,
      drawingScene: t.drawing_scene || null,
      requirementId: t.requirement_id || null,
      creatorId: t.creator_id || "user-1",
      escalation: t.escalation || null,
      activities: activitiesByTaskId[t.id] || []
    }))

    const assignments: AssignmentRecord[] = dbAssignments.map((a) => ({
      id: a.id,
      requirementId: a.requirement_id,
      technicianId: a.technician_id,
      notes: a.notes || "",
      createdAt: a.created_at || new Date().toISOString(),
      status: a.status || "confirmed"
    }))

    const evidence: EvidenceFile[] = dbEvidence.map((e) => ({
      id: e.id,
      mediaType: e.media_type,
      mimeType: e.mime_type,
      name: e.name,
      base64: e.url, // URL acts as the local base64 field to maintain rendering compatibility
      previewBase64: e.url,
      caption: e.caption || "",
      flagged: e.flagged || false,
      createdAt: e.created_at || new Date().toISOString(),
      folderId: e.folder_id || null,
      linkedTaskId: e.linked_task_id || null,
      size: e.size || 0
    }))

    const notifications: Notification[] = dbNotifications.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type,
      taskId: n.task_id || null,
      userId: n.user_id || undefined,
      targetUserId: n.target_user_id || null,
      read: n.read || false,
      timestamp: n.created_at || new Date().toISOString()
    }))

    return {
      users,
      tasks,
      requirements,
      evidence,
      folders,
      assignments,
      saves: [], // client-side saves are preserved or initialized empty
      drawingScene: null,
      currentUserId: null,
      notifications,
      globalAlert: null
    }
  } catch (error) {
    console.error("Failed to pull state from Supabase:", error)
    return null
  }
}

export async function pushToSupabase(state: any) {
  try {
    // 1. Prepare data structures for DB
    const dbUsers = state.users.map((u: any) => ({
      id: u.id,
      name: u.name,
      avatar: u.avatar || null,
      birth_date: u.birthDate || null,
      position: u.position || null,
      zone: u.zone || null,
      role: u.role,
      skills: u.skills || [],
      clearances: u.clearances || [],
      availability: u.availability || "available",
      availability_label: u.availabilityLabel || "Disponible",
      code: u.code || null,
      created_at: u.createdAt || new Date().toISOString()
    }))

    const dbFolders = state.folders.map((f: any) => ({
      id: f.id,
      name: f.name,
      parent_id: f.parentId || null,
      created_at: f.createdAt || new Date().toISOString(),
      updated_at: f.updatedAt || new Date().toISOString()
    }))

    const dbRequirements = state.requirements.map((r: any) => ({
      id: r.id,
      code: r.code,
      title: r.title,
      description: r.description || null,
      location: r.location || null,
      area: r.area || null,
      due_label: r.dueLabel || null,
      priority: r.priority || "medium",
      status: r.status || "unassigned",
      required_skills: r.requiredSkills || [],
      required_clearances: r.requiredClearances || [],
      estimated_hours: r.estimatedHours || 1.0,
      selected_technician_id: r.selectedTechnicianId || null,
      notes: r.notes || null,
      assigned_at: r.assignedAt || null,
      creator_id: r.creatorId || null,
      created_at: r.createdAt || new Date().toISOString()
    }))

    const dbTasks = state.tasks.map((t: any) => ({
      id: t.id,
      title: t.title,
      description: t.description || null,
      priority: t.priority || "medium",
      status: t.status || "todo",
      assignee_ids: t.assigneeIds || [],
      created_at: t.createdAt || new Date().toISOString(),
      updated_at: t.updatedAt || new Date().toISOString(),
      timer_started_at: t.timerStartedAt || null,
      status_durations: t.statusDurations || { todo: 0, inProgress: 0, review: 0, done: 0 },
      location: t.location || null,
      area: t.area || null,
      drawing_scene: t.drawingScene || null,
      requirement_id: t.requirementId || null,
      creator_id: t.creatorId || null,
      escalation: t.escalation || null
    }))

    const dbAssignments = state.assignments.map((a: any) => ({
      id: a.id,
      requirement_id: a.requirementId,
      technician_id: a.technicianId,
      notes: a.notes || null,
      created_at: a.createdAt || new Date().toISOString(),
      status: a.status || "confirmed"
    }))

    // Flatten nested activities
    const dbActivities: any[] = []
    state.tasks.forEach((t: any) => {
      t.activities?.forEach((act: any) => {
        dbActivities.push({
          id: act.id,
          task_id: t.id,
          type: act.type,
          content: act.type === "drawing" ? JSON.stringify(act.content) : String(act.content || ""),
          created_at: act.createdAt || new Date().toISOString(),
          updated_at: act.updatedAt || new Date().toISOString(),
          metadata: act.metadata || {}
        })
      })
    })

    const dbEvidence = state.evidence.map((e: any) => ({
      id: e.id,
      media_type: e.mediaType,
      mime_type: e.mimeType,
      name: e.name,
      url: e.base64,
      caption: e.caption || null,
      flagged: e.flagged || false,
      created_at: e.createdAt || new Date().toISOString(),
      folder_id: e.folderId || null,
      linked_task_id: e.linkedTaskId || null,
      size: e.size || 0
    }))

    const dbNotifications = state.notifications.map((n: any) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type,
      task_id: n.taskId || null,
      user_id: n.userId || null,
      target_user_id: n.targetUserId || null,
      read: n.read || false,
      created_at: n.timestamp || new Date().toISOString()
    }))

    // 2. RECONCILIACIÓN DE ELIMINACIONES
    const [
      { data: exUsers },
      { data: exFolders },
      { data: exRequirements },
      { data: exTasks },
      { data: exAssignments },
      { data: exActivities },
      { data: exEvidence },
      { data: exNotifications }
    ] = await Promise.all([
      supabase.from("flow_servimeci_users").select("id"),
      supabase.from("flow_servimeci_folders").select("id"),
      supabase.from("flow_servimeci_requirements").select("id"),
      supabase.from("flow_servimeci_tasks").select("id"),
      supabase.from("flow_servimeci_assignments").select("id"),
      supabase.from("flow_servimeci_activities").select("id"),
      supabase.from("flow_servimeci_evidence").select("id"),
      supabase.from("flow_servimeci_notifications").select("id")
    ])

    // Find orphans to delete
    const orphansUsers = (exUsers || []).map(x => x.id).filter(id => !state.users.some((x: any) => x.id === id))
    const orphansFolders = (exFolders || []).map(x => x.id).filter(id => !state.folders.some((x: any) => x.id === id))
    const orphansRequirements = (exRequirements || []).map(x => x.id).filter(id => !state.requirements.some((x: any) => x.id === id))
    const orphansTasks = (exTasks || []).map(x => x.id).filter(id => !state.tasks.some((x: any) => x.id === id))
    const orphansAssignments = (exAssignments || []).map(x => x.id).filter(id => !state.assignments.some((x: any) => x.id === id))
    const orphansActivities = (exActivities || []).map(x => x.id).filter(id => !dbActivities.some((x: any) => x.id === id))
    const orphansEvidence = (exEvidence || []).map(x => x.id).filter(id => !state.evidence.some((x: any) => x.id === id))
    const orphansNotifications = (exNotifications || []).map(x => x.id).filter(id => !state.notifications.some((x: any) => x.id === id))

    // Perform deletions (dependents first)
    await Promise.all([
      orphansNotifications.length ? supabase.from("flow_servimeci_notifications").delete().in("id", orphansNotifications) : Promise.resolve(),
      orphansEvidence.length ? supabase.from("flow_servimeci_evidence").delete().in("id", orphansEvidence) : Promise.resolve(),
      orphansActivities.length ? supabase.from("flow_servimeci_activities").delete().in("id", orphansActivities) : Promise.resolve(),
      orphansAssignments.length ? supabase.from("flow_servimeci_assignments").delete().in("id", orphansAssignments) : Promise.resolve()
    ])

    await Promise.all([
      orphansTasks.length ? supabase.from("flow_servimeci_tasks").delete().in("id", orphansTasks) : Promise.resolve(),
      orphansRequirements.length ? supabase.from("flow_servimeci_requirements").delete().in("id", orphansRequirements) : Promise.resolve()
    ])

    await Promise.all([
      orphansUsers.length ? supabase.from("flow_servimeci_users").delete().in("id", orphansUsers) : Promise.resolve(),
      orphansFolders.length ? supabase.from("flow_servimeci_folders").delete().in("id", orphansFolders) : Promise.resolve()
    ])

    // 3. UPSERTS ORDENADOS
    // Nivel 1: Usuarios y Carpetas
    if (dbUsers.length) await supabase.from("flow_servimeci_users").upsert(dbUsers)
    if (dbFolders.length) {
      // First upsert folders with null parent to bypass self-referential keys
      const foldersWithoutParent = dbFolders.map((f: any) => ({ ...f, parent_id: null }))
      await supabase.from("flow_servimeci_folders").upsert(foldersWithoutParent)
      await supabase.from("flow_servimeci_folders").upsert(dbFolders)
    }

    // Nivel 2: Requerimientos
    if (dbRequirements.length) await supabase.from("flow_servimeci_requirements").upsert(dbRequirements)

    // Nivel 3: Tareas y Asignaciones
    if (dbTasks.length) await supabase.from("flow_servimeci_tasks").upsert(dbTasks)
    if (dbAssignments.length) await supabase.from("flow_servimeci_assignments").upsert(dbAssignments)

    // Nivel 4: Actividades, Evidencias, Notificaciones
    if (dbActivities.length) await supabase.from("flow_servimeci_activities").upsert(dbActivities)
    if (dbEvidence.length) await supabase.from("flow_servimeci_evidence").upsert(dbEvidence)
    if (dbNotifications.length) await supabase.from("flow_servimeci_notifications").upsert(dbNotifications)

    console.log("Supabase relational sync successful!")
  } catch (error) {
    console.error("Failed to push state to Supabase:", error)
  }
}
