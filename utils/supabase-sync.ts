import { supabase } from "./supabase"
import { isAdminRole, isManagerRole, normalizeUserRole } from "@/utils/roles"
import type {
  User,
  Folder,
  Requirement,
  Task,
  TaskEscalation,
  TaskActivity,
  AssignmentRecord,
  EvidenceFile,
  Notification,
  SaveRecord,
  WorkflowSeed,
  WorkspaceStateRecord
} from "@/store/workflow-store"

const ZONE_SEPARATOR = "|"
const WORKSPACE_STATE_ID = "workspace"
const WORKSPACE_STATE_SYNC_ENABLED = process.env.NEXT_PUBLIC_ENABLE_WORKSPACE_STATE_SYNC === "true"

function parseZones(value?: string | null) {
  if (!value) return []
  return value
    .split(ZONE_SEPARATOR)
    .map((zone) => zone.trim())
    .filter(Boolean)
}

function serializeZones(zones: string[]) {
  return zones
    .map((zone) => zone.trim())
    .filter(Boolean)
    .join(` ${ZONE_SEPARATOR} `)
}

function isMissingRelationError(error: any) {
  const message = String(error?.message || "")
  return Boolean(
    error &&
      (error.code === "42P01" ||
        error.code === "PGRST205" ||
        /relation .* does not exist/i.test(message) ||
        /could not find the table .* in the schema cache/i.test(message) ||
        /does not exist/i.test(message))
  )
}

function toTimestamp(value?: string | null) {
  if (!value) return 0
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

function collectStringIds(...values: unknown[]) {
  const ids: string[] = []

  values.forEach((value) => {
    if (!value) return

    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (typeof item === "string" && item.trim()) {
          ids.push(item)
        }
      })
      return
    }

    if (typeof value === "string" && value.trim()) {
      ids.push(value)
    }
  })

  return Array.from(new Set(ids))
}

function collectTaskAssigneeIds(
  assigneeIds: unknown,
  escalation?: TaskEscalation | null,
  existingAssigneeIds?: unknown
) {
  return collectStringIds(
    existingAssigneeIds,
    assigneeIds,
    escalation?.originalAssigneeIds,
    escalation?.targetUserId
  )
}

export function mergeTaskSnapshots(localTask: Task, remoteTask: Task) {
  const localUpdatedAt = toTimestamp(localTask.updatedAt)
  const remoteUpdatedAt = toTimestamp(remoteTask.updatedAt)
  const preferredTask = remoteUpdatedAt > localUpdatedAt ? remoteTask : localTask

  return {
    ...preferredTask,
    assigneeIds: collectStringIds(
      localTask.assigneeIds,
      remoteTask.assigneeIds,
      preferredTask.escalation?.originalAssigneeIds,
      preferredTask.escalation?.targetUserId
    )
  }
}

export function mergeTaskLists(localTasks: Task[], remoteTasks: Task[]) {
  const localTaskById = new Map(localTasks.map((task) => [task.id, task]))
  const remoteIds = new Set(remoteTasks.map((task) => task.id))

  const merged = remoteTasks.map((remoteTask) => {
    const localTask = localTaskById.get(remoteTask.id)
    return localTask ? mergeTaskSnapshots(localTask, remoteTask) : remoteTask
  })

  localTasks.forEach((task) => {
    if (!remoteIds.has(task.id)) {
      merged.push(task)
    }
  })

  return merged
}

export async function pullFromSupabase(): Promise<WorkflowSeed | null> {
  try {
    // 1. Fetch relational tables; workspace state is optional because some deployments do not create it yet.
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

    // If there is no user data, it is a clean database state, which is supported perfectly!
    if (!dbUsers || dbUsers.length === 0) {
      console.log("La base de datos de Supabase está limpia y lista para operar.")
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

    const users: User[] = dbUsers.map((u) => {
      const zones = parseZones(u.zone)
      const primaryZone = zones[0] ?? u.zone ?? ""
      const normalizedRole = normalizeUserRole(u.role)
      const fallbackAreas = isAdminRole(normalizedRole) || isManagerRole(normalizedRole)
        ? ["Direccion", "Contabilidad", "Compras", "Proyectos", "RH", "Operacion"]
        : ["Operacion"]
      const resolvedAreas = Array.isArray(u.areas) && u.areas.length > 0 ? u.areas : fallbackAreas
      return {
      id: u.id,
      name: u.name,
      avatar: u.avatar || "",
      birthDate: u.birth_date || "",
      position: u.position || "",
      zone: primaryZone,
      zones,
      role: normalizedRole,
      skills: u.skills || [],
      clearances: u.clearances || [],
      availability: u.availability || "available",
      availabilityLabel: u.availability_label || "Disponible",
      code: u.code || undefined,
      createdAt: u.created_at || new Date().toISOString(),
      showAllZones: isAdminRole(normalizedRole),
        areas: resolvedAreas
      }
    })

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
      assigneeIds: collectTaskAssigneeIds(t.assignee_ids, t.escalation || null),
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

    let workspaceState: WorkspaceStateRecord | null = null
    if (WORKSPACE_STATE_SYNC_ENABLED) {
      const { data: dbWorkspaceState, error: wErr } = await supabase
        .from("flow_servimeci_workspace_state")
        .select("*")
        .eq("id", WORKSPACE_STATE_ID)
        .maybeSingle()

      if (wErr && !isMissingRelationError(wErr)) {
        console.error("Error loading workspace state from Supabase:", wErr)
        return null
      }

      workspaceState = dbWorkspaceState
        ? {
            id: dbWorkspaceState.id,
            saves: Array.isArray(dbWorkspaceState.saves) ? (dbWorkspaceState.saves as SaveRecord[]) : [],
            drawingScene: dbWorkspaceState.drawing_scene || null,
            updatedAt: dbWorkspaceState.updated_at || new Date().toISOString()
          }
        : null
    }

    return {
      users,
      tasks,
      requirements,
      evidence,
      folders,
      assignments,
      saves: workspaceState?.saves ?? [],
      drawingScene: workspaceState?.drawingScene ?? null,
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
    const dbUsers = state.users.map((u: any) => {
      const zones = Array.isArray(u.zones) && u.zones.length > 0 ? u.zones : (u.zone ? [u.zone] : [])
      return {
      id: u.id,
      name: u.name,
      avatar: u.avatar || null,
      birth_date: u.birthDate || null,
      position: u.position || null,
      zone: serializeZones(zones) || null,
        areas: u.areas || [],
      role: normalizeUserRole(u.role),
      skills: u.skills || [],
      clearances: u.clearances || [],
      availability: u.availability || "available",
      availability_label: u.availabilityLabel || "Disponible",
      code: u.code || null,
      created_at: u.createdAt || new Date().toISOString()
      }
    })

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
      assignee_ids: collectTaskAssigneeIds(t.assigneeIds, t.escalation || null),
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

    const dbWorkspaceState = {
      id: WORKSPACE_STATE_ID,
      saves: state.saves || [],
      drawing_scene: state.drawingScene || null,
      updated_at: new Date().toISOString()
    }

    // 2. RECONCILIACIÓN DE ELIMINACIONES
    const [
      { data: exFolders },
      { data: exRequirements },
      { data: exTasks },
      { data: exAssignments },
      { data: exActivities },
      { data: exEvidence },
      { data: exNotifications }
    ] = await Promise.all([
      supabase.from("flow_servimeci_folders").select("id"),
      supabase.from("flow_servimeci_requirements").select("id"),
      supabase.from("flow_servimeci_tasks").select("id, assignee_ids, escalation"),
      supabase.from("flow_servimeci_assignments").select("id"),
      supabase.from("flow_servimeci_activities").select("id"),
      supabase.from("flow_servimeci_evidence").select("id"),
      supabase.from("flow_servimeci_notifications").select("id")
    ])

    // Find orphans to delete
    const orphansFolders = (exFolders || []).map(x => x.id).filter(id => !state.folders.some((x: any) => x.id === id))
    const orphansRequirements = (exRequirements || []).map(x => x.id).filter(id => !state.requirements.some((x: any) => x.id === id))
    const orphansTasks = (exTasks || []).map(x => x.id).filter(id => !state.tasks.some((x: any) => x.id === id))
    const orphansAssignments = (exAssignments || []).map(x => x.id).filter(id => !state.assignments.some((x: any) => x.id === id))
    const orphansActivities = (exActivities || []).map(x => x.id).filter(id => !dbActivities.some((x: any) => x.id === id))
    const orphansEvidence = (exEvidence || []).map(x => x.id).filter(id => !state.evidence.some((x: any) => x.id === id))
    const orphansNotifications = (exNotifications || []).map(x => x.id).filter(id => !state.notifications.some((x: any) => x.id === id))
    const exTasksById = new Map((exTasks || []).map((task: any) => [task.id, task]))

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
      orphansFolders.length ? supabase.from("flow_servimeci_folders").delete().in("id", orphansFolders) : Promise.resolve()
    ])

    // 3. UPSERTS ORDENADOS
    // Nivel 1: Usuarios y Carpetas
    if (dbUsers.length) await supabase.from("flow_servimeci_users").upsert(dbUsers, { onConflict: "id" })
    if (dbFolders.length) {
      // First upsert folders with null parent to bypass self-referential keys
      const foldersWithoutParent = dbFolders.map((f: any) => ({ ...f, parent_id: null }))
      await supabase.from("flow_servimeci_folders").upsert(foldersWithoutParent, { onConflict: "id" })
      await supabase.from("flow_servimeci_folders").upsert(dbFolders, { onConflict: "id" })
    }

    // Nivel 2: Requerimientos
    if (dbRequirements.length) await supabase.from("flow_servimeci_requirements").upsert(dbRequirements, { onConflict: "id" })

    // Nivel 3: Tareas y Asignaciones
    if (dbTasks.length) {
      const dbTasksWithMergedAssignees = dbTasks.map((task: any) => {
        const existingTask = exTasksById.get(task.id)

        return {
          ...task,
          assignee_ids: collectTaskAssigneeIds(
            task.assignee_ids,
            task.escalation || null,
            existingTask?.assignee_ids
          )
        }
      })

      await supabase.from("flow_servimeci_tasks").upsert(dbTasksWithMergedAssignees, { onConflict: "id" })
    }
    if (dbAssignments.length) await supabase.from("flow_servimeci_assignments").upsert(dbAssignments, { onConflict: "id" })

    // Nivel 4: Actividades, Evidencias, Notificaciones
    if (dbActivities.length) await supabase.from("flow_servimeci_activities").upsert(dbActivities, { onConflict: "id" })
    if (dbEvidence.length) await supabase.from("flow_servimeci_evidence").upsert(dbEvidence, { onConflict: "id" })
    if (dbNotifications.length) await supabase.from("flow_servimeci_notifications").upsert(dbNotifications, { onConflict: "id" })
    if (WORKSPACE_STATE_SYNC_ENABLED) {
      const workspaceStateResult = await supabase
        .from("flow_servimeci_workspace_state")
        .upsert(dbWorkspaceState, { onConflict: "id" })

      if (workspaceStateResult.error && !isMissingRelationError(workspaceStateResult.error)) {
        throw workspaceStateResult.error
      }
    }

    console.log("Supabase relational sync successful!")
  } catch (error) {
    console.error("Failed to push state to Supabase:", error)
  }
}
