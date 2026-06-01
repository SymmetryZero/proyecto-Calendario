"use client"

import { create } from "zustand"
import { persist, type StateStorage } from "zustand/middleware"
import {
  buildFolderPath,
  createAvatarDataUri,
  createBase64FromString,
  createSvgDataUri,
  formatClock,
  formatDateStamp,
  formatTimeStamp,
  makeId
} from "@/utils/workflow"
import { isAdminRole, isEmployeeRole, isManagerRole, normalizeUserRole } from "@/utils/roles"
import { pullFromSupabase, pushToSupabase } from "@/utils/supabase-sync"



const statusLabels: Record<string, string> = {
  todo: "Por Hacer",
  inProgress: "En Progreso",
  review: "En Revisión",
  done: "Completada"
}

export type NotificationType = "movement" | "assignment" | "message" | "alert"

export interface Notification {
  id: string
  title: string
  message: string
  timestamp: string
  type: NotificationType
  taskId?: string | null
  userId?: string // Who triggered it
  targetUserId?: string | null // Who it's for (null for everyone/admin)
  read?: boolean
}

export interface GlobalAlert {
  title: string
  message: string
  type: "error" | "warning" | "info"
}

export type SectionKey = "dashboard" | "assignments" | "users" | "statistics" | "drawing" | "evidence" | "settings"
export type TaskStatus = "todo" | "inProgress" | "review" | "done"
export type Priority = "high" | "medium" | "low"
export type RequirementStatus = "unassigned" | "assigned"
export type EvidenceType = "image" | "video" | "audio" | "drawing"
export type FolderMode = "existing" | "new"
export type TechnicianAvailability = "available" | "soon" | "offline"
export type UserRole = "administrador" | "gerente" | "empleado"
export type Area = "General" | "Direccion" | "Contabilidad" | "Compras" | "Proyectos" | "RH" | "Operacion"

export const AREA_OPTIONS: Area[] = [
  "General",
  "Direccion",
  "Contabilidad",
  "Compras",
  "Proyectos",
  "RH",
  "Operacion"
]

const DEFAULT_AREA: Area = "Operacion"
const GLOBAL_AREA: Area = "General"
const ZONE_SEPARATOR = "|"

function parseZones(value?: string | null) {
  if (!value) return []
  return value
    .split(ZONE_SEPARATOR)
    .map((zone) => zone.trim())
    .filter(Boolean)
}

function normalizeZones(zones?: string[] | null, fallback?: string | null) {
  const normalized = (zones ?? [])
    .map((zone) => zone.trim())
    .filter(Boolean)
  if (normalized.length > 0) return normalized
  return parseZones(fallback)
}

function isGlobalArea(area?: Area | null) {
  return area === GLOBAL_AREA
}

function canCreateInGlobalArea(user: User | null | undefined) {
  if (!user) return false
  return isAdminRole(user.role) || isManagerRole(user.role)
}


export interface User {
  id: string
  name: string
  avatar: string
  birthDate: string
  position: string
  zone: string
  zones?: string[]
  role: UserRole
  createdAt: string
  showAllZones?: boolean
  areas?: Area[]
  // Technician-specific fields (Optional for non-technicians)
  skills?: string[]
  clearances?: string[]
  availability?: TechnicianAvailability
  availabilityLabel?: string
  code?: string
}

// Technician interface kept as a subset of User for compatibility if needed, 
// but we will primarily use User.
export type Technician = User

function resolveUserZones(user?: User | null) {
  return normalizeZones(user?.zones ?? null, user?.zone ?? null)
}

function isInUserZones(location: string | undefined | null, zones: string[]) {
  if (zones.length === 0) return true
  if (!location) return false
  return zones.includes(location)
}

export type TaskActivityType = "note" | "drawing" | "image" | "video" | "audio" | "log"

export interface TaskActivity {
  id: string
  type: TaskActivityType
  content: any // Text for notes, DrawingScene object for drawings, base64 for images/video
  createdAt: string
  updatedAt?: string
  metadata?: {
    authorName?: string
    authorRole?: string
    fileName?: string
    mimeType?: string
    description?: string
  }
}

export interface TaskEscalation {
  fromArea: Area
  toArea: Area
  escalatedBy: string
  escalatedAt: string
  originalAssigneeIds: string[]
  targetUserId?: string | null
}

export interface Task {
  id: string
  title: string
  description: string
  priority: Priority
  status: TaskStatus
  assigneeIds: string[]
  createdAt: string
  updatedAt: string
  timerStartedAt: number | null
  statusDurations: Record<TaskStatus, number>
  location?: string
  area?: Area | null
  drawingScene?: DrawingScene | null
  activities: TaskActivity[]
  requirementId?: string | null
  dueLabel?: string
  estimatedHours?: number
  creatorId: string
  escalation?: TaskEscalation | null
}

function getTaskScopeArea(task: Task | null | undefined) {
  return task?.escalation?.toArea ?? task?.area ?? DEFAULT_AREA
}

function isTaskCreator(user: User | null | undefined, task: Task | null | undefined) {
  return Boolean(user && task && task.creatorId === user.id)
}

function isTaskAssignee(user: User | null | undefined, task: Task | null | undefined) {
  return Boolean(user && task && task.assigneeIds.includes(user.id))
}

function getTaskAssigneeUsers(task: Task | null | undefined, users: User[]) {
  if (!task) return []
  const assigneeIds = new Set(task.assigneeIds)
  return users.filter((user) => assigneeIds.has(user.id))
}

function hasTaskAssigneeInArea(task: Task | null | undefined, users: User[], area: Area) {
  if (!task) return false
  if (!task.assigneeIds.length) return false
  if (task.escalation?.targetUserId) return true

  return getTaskAssigneeUsers(task, users).some((user) => {
    const userAreas = user.areas ?? []
    return userAreas.includes(area) || (isGlobalArea(area) && (isAdminRole(user.role) || isManagerRole(user.role)))
  })
}

type TaskClaimState = {
  canClaim: boolean
  reason: "already_assigned_to_you" | "already_taken_by_someone_else" | "no_permission" | null
}

function getTaskClaimState(
  user: User | null | undefined,
  task: Task | null | undefined,
  users: User[] = []
): TaskClaimState {
  if (!user || !task) {
    return { canClaim: false, reason: null }
  }

  if (isAdminRole(user.role) || isManagerRole(user.role)) {
    return { canClaim: true, reason: null }
  }

  if (isTaskAssignee(user, task)) {
    return { canClaim: false, reason: "already_assigned_to_you" }
  }

  if (isTaskCreator(user, task)) {
    if (!task.assigneeIds.length) {
      return { canClaim: true, reason: null }
    }
  }

  const userAreas = user.areas ?? []
  const taskArea = getTaskScopeArea(task)
  const canSeeTaskArea = userAreas.includes(taskArea) || isGlobalArea(taskArea)
  const taskTakenInArea = hasTaskAssigneeInArea(task, users, taskArea)

  if (task.escalation?.targetUserId === user.id) {
    return { canClaim: true, reason: null }
  }

  if (task.escalation) {
    if (!canSeeTaskArea) {
      return { canClaim: false, reason: "no_permission" }
    }

    if (taskTakenInArea) {
      return { canClaim: false, reason: "already_taken_by_someone_else" }
    }

    return { canClaim: true, reason: null }
  }

  if (task.assigneeIds.length > 0) {
    return { canClaim: false, reason: "already_taken_by_someone_else" }
  }

  if (isGlobalArea(taskArea) && !task.assigneeIds.length) {
    return { canClaim: true, reason: null }
  }

  if (!task.assigneeIds.length && canSeeTaskArea) {
    return { canClaim: true, reason: null }
  }

  return { canClaim: false, reason: "no_permission" }
}

function canUserManageTask(user: User | null | undefined, task: Task | null | undefined) {
  if (!user || !task) return false
  if (isAdminRole(user.role) || isManagerRole(user.role)) return true
  return isTaskCreator(user, task) || isTaskAssignee(user, task)
}

function canUserClaimTask(user: User | null | undefined, task: Task | null | undefined, users: User[] = []) {
  return getTaskClaimState(user, task, users).canClaim
}

export interface Requirement {
  id: string
  code: string
  title: string
  description: string
  location: string
  area?: Area | null
  dueLabel?: string
  priority: Priority
  status: RequirementStatus
  requiredSkills: string[]
  requiredClearances: string[]
  estimatedHours?: number
  selectedTechnicianId: string | null
  notes: string
  assignedAt: string | null
  creatorId: string
  createdAt?: string
}

export interface AssignmentRecord {
  id: string
  requirementId: string
  technicianId: string
  notes: string
  createdAt: string
  status: "draft" | "confirmed"
}

export interface EvidenceFile {
  id: string
  mediaType: EvidenceType
  mimeType: string
  name: string
  base64: string
  previewBase64?: string
  caption: string
  flagged: boolean
  createdAt: string
  folderId: string | null
  linkedTaskId: string | null
  size: number
}

export interface Folder {
  id: string
  name: string
  parentId: string | null
  createdAt: string
  updatedAt: string
}

export interface SaveRecord {
  id: string
  mode: FolderMode
  folderId: string
  folderName: string
  folderPath: string
  createdAt: string
  dateLabel: string
  timeLabel: string
  counts: {
    tasks: number
    requirements: number
    assignments: number
    evidence: number
  }
}

export interface DrawingScene {
  elements: any[]
  appState: Record<string, unknown>
  files: Record<string, any>
  updatedAt: string
  preview?: string
}

export interface CreateTaskInput {
  title: string
  description: string
  priority: Priority
  status?: TaskStatus
  assigneeIds?: string[]
  location?: string
  area?: Area
  activities?: TaskActivity[]
  dueLabel?: string
  estimatedHours?: number
}

export interface CreateEvidenceInput {
  mediaType: EvidenceType
  mimeType: string
  name: string
  base64: string
  previewBase64?: string
  caption?: string
  folderId?: string | null
  linkedTaskId?: string | null
  size: number
}

export interface CreateRequirementInput {
  code: string
  title: string
  description: string
  location: string
  area?: Area
  dueLabel?: string
  priority: Priority
  requiredSkills: string[]
  requiredClearances: string[]
  estimatedHours?: number
}

export interface CreateFolderInput {
  name: string
  parentId?: string | null
}

export interface SaveProgressInput {
  mode: FolderMode
  folderId?: string | null
  folderName?: string
  parentId?: string | null
}

export interface WorkflowSeed {
  users: User[]
  tasks: Task[]
  requirements: Requirement[]
  evidence: EvidenceFile[]
  folders: Folder[]
  assignments: AssignmentRecord[]
  saves: SaveRecord[]
  drawingScene: DrawingScene | null
  currentUserId: string | null
  notifications: Notification[]
  globalAlert: GlobalAlert | null
}

export interface WorkspaceStateRecord {
  id: string
  saves: SaveRecord[]
  drawingScene: DrawingScene | null
  updatedAt: string
}

export interface WorkflowStore extends WorkflowSeed {
  hasHydrated: boolean
  setHydrated: (value: boolean) => void
  addTask: (input: CreateTaskInput) => string
  updateTask: (taskId: string, patch: Partial<Task>) => void
  deleteTask: (taskId: string) => void
  moveTask: (taskId: string, status: TaskStatus) => void
  escalateTask: (taskId: string, toArea: Area, targetUserId?: string | null, note?: string) => void
  claimEscalatedTask: (taskId: string) => void
  claimTask: (taskId: string) => void
  startTaskTimer: (taskId: string) => void
  pauseTaskTimer: (taskId: string) => void
  addEvidence: (input: CreateEvidenceInput) => string
  updateEvidence: (evidenceId: string, patch: Partial<EvidenceFile>) => void
  deleteEvidence: (evidenceId: string) => void
  toggleEvidenceFlag: (evidenceId: string) => void
  addRequirement: (input: CreateRequirementInput) => string
  updateRequirement: (requirementId: string, patch: Partial<Requirement>) => void
  deleteRequirement: (requirementId: string) => void
  assignRequirement: (requirementId: string, userId: string, notes: string) => void
  addUser: (input: Omit<User, "id" | "createdAt">) => string
  deleteUser: (userId: string) => void
  updateUser: (userId: string, patch: Partial<User>) => void
  createFolder: (input: CreateFolderInput) => string
  renameFolder: (folderId: string, name: string) => void
  deleteFolder: (folderId: string) => void
  saveProgress: (input: SaveProgressInput) => SaveRecord
  setDrawingScene: (scene: Omit<DrawingScene, "updatedAt">) => void
  addTaskActivity: (taskId: string, type: TaskActivityType, content: any, metadata?: TaskActivity["metadata"]) => void
  updateTaskActivity: (taskId: string, activityId: string, patch: Partial<Omit<TaskActivity, "id" | "createdAt">>) => void
  removeTaskActivity: (taskId: string, activityId: string) => void
  setCurrentUser: (userId: string | null) => void
  resetDemoData: () => void
  addTaskLog: (taskId: string, content: string, metadata?: any) => void
  addNotification: (notification: Omit<Notification, "id" | "timestamp">) => void
  markNotificationAsRead: (notificationId: string) => void
  setGlobalAlert: (alert: GlobalAlert | null) => void
}

const memoryStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
}

function escapeLabel(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}

function buildThumbnail(label: string, accent = "#172839", fill = "#fea520") {
  const safe = escapeLabel(label)
  return createSvgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" role="img" aria-label="${safe}">
      <defs>
        <linearGradient id="bg" x1="40" y1="30" x2="600" y2="330" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="${accent}" />
          <stop offset="1" stop-color="#2d3e50" />
        </linearGradient>
      </defs>
      <rect width="640" height="360" rx="24" fill="url(#bg)" />
      <rect x="52" y="46" width="536" height="268" rx="20" fill="#ffffff" opacity="0.1" />
      <rect x="80" y="82" width="240" height="20" rx="10" fill="${fill}" />
      <rect x="80" y="122" width="320" height="14" rx="7" fill="#f7faf9" opacity="0.85" />
      <rect x="80" y="150" width="280" height="14" rx="7" fill="#f7faf9" opacity="0.65" />
      <circle cx="500" cy="176" r="54" fill="#f7faf9" opacity="0.14" />
      <path d="M476 176h48M500 152v48" stroke="#f7faf9" stroke-width="10" stroke-linecap="round" />
      <text x="80" y="246" fill="#f7faf9" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="700">${safe}</text>
      <text x="80" y="282" fill="#f7faf9" font-family="Inter, Arial, sans-serif" font-size="16" opacity=".8">Vista previa de evidencias de Servimeci App</text>
    </svg>
  `)
}
function createEmptyState(): WorkflowSeed {
  return {
    users: [],
    tasks: [],
    requirements: [],
    evidence: [],
    folders: [],
    assignments: [],
    saves: [],
    drawingScene: null,
    currentUserId: null,
    notifications: [],
    globalAlert: null
  }
}

function createSeedData(): WorkflowSeed {
  const now = Date.now()
  const createdAt = new Date(now).toISOString()
  const hourAgo = new Date(now - 60 * 60 * 1000).toISOString()
  const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000).toISOString()
  const threeHoursAgo = new Date(now - 3 * 60 * 60 * 1000).toISOString()
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString()
  const twoDaysAgo = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString()
  const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString()

  const users: User[] = [
    {
      id: "user-1",
      name: "Admin Principal",
      avatar: createAvatarDataUri("Admin Principal", "#172839", "#ffffff"),
      birthDate: "1985-05-15",
      position: "Administrador de Sistemas",
      zone: "Oficina Central",
      zones: ["Oficina Central"],
      role: "administrador",
      createdAt: threeDaysAgo,
      showAllZones: true,
      areas: AREA_OPTIONS,
      availability: "available",
      code: "ADM-001"
    },
    {
      id: "user-2",
      name: "Marta Gerente",
      avatar: createAvatarDataUri("Marta Gerente", "#865300", "#ffffff"),
      birthDate: "1990-10-20",
      position: "Gerente de Operaciones",
      zone: "Zona Norte",
      zones: ["Zona Norte"],
      role: "gerente",
      createdAt: threeDaysAgo,
      showAllZones: false,
      areas: AREA_OPTIONS,
      availability: "available",
      code: "GER-001"
    },
    {
      id: "user-3",
      name: "Juan Empleado",
      avatar: createAvatarDataUri("Juan Empleado", "#004064", "#ffffff"),
      birthDate: "1995-03-12",
      position: "Técnico Especialista",
      zone: "Zona Sur",
      zones: ["Zona Sur"],
      role: "empleado",
      createdAt: twoDaysAgo,
      showAllZones: false,
      areas: ["Operacion", "Proyectos"],
      skills: ["HVAC", "Electricidad", "Fontanería"],
      clearances: ["Altura", "Espacios Confinados"],
      availability: "available",
      availabilityLabel: "Disponible",
      code: "TECH-001"
    },
    {
      id: "user-4",
      name: "Sarah Jenkins",
      avatar: createAvatarDataUri("Sarah Jenkins", "#5d3fd3", "#ffffff"),
      birthDate: "1992-07-22",
      position: "Líder HVAC",
      zone: "Zona Norte",
      zones: ["Zona Norte"],
      role: "empleado",
      createdAt: twoDaysAgo,
      showAllZones: false,
      areas: ["Operacion", "Contabilidad"],
      skills: ["HVAC", "Termografía", "Sistemas de Control"],
      clearances: ["Alta Tensión", "Altura"],
      availability: "available",
      availabilityLabel: "Disponible",
      code: "TECH-002"
    },
    {
      id: "user-5",
      name: "Mike Rodriguez",
      avatar: createAvatarDataUri("Mike Rodriguez", "#228b22", "#ffffff"),
      birthDate: "1988-11-05",
      position: "Técnico Electricista",
      zone: "Zona Sur",
      zones: ["Zona Sur"],
      role: "empleado",
      createdAt: twoDaysAgo,
      showAllZones: false,
      areas: ["Operacion", "Compras", "RH", "Proyectos"],
      skills: ["Electricidad", "Motores", "PLC"],
      clearances: ["Arco Eléctrico"],
      availability: "soon",
      availabilityLabel: "Libre en 1h",
      code: "TECH-003"
    },
    {
      id: "user-6",
      name: "Nina Patel",
      avatar: createAvatarDataUri("Nina Patel", "#6750a4", "#ffffff"),
      birthDate: "1994-02-28",
      position: "Inspectora de Seguridad",
      zone: "Zona Norte",
      zones: ["Zona Norte"],
      role: "empleado",
      createdAt: twoDaysAgo,
      showAllZones: false,
      areas: ["RH", "Direccion"],
      skills: ["Auditoría", "Seguridad Industrial", "Normativa ISO"],
      clearances: ["Clase 2"],
      availability: "offline",
      availabilityLabel: "Fuera de servicio",
      code: "TECH-004"
    },
    {
      id: "user-7",
      name: "Alex Thompson",
      avatar: createAvatarDataUri("Alex Thompson", "#004064", "#ffffff"),
      birthDate: "1991-09-15",
      position: "Especialista en Bombas",
      zone: "Zona Sur",
      zones: ["Zona Sur"],
      role: "empleado",
      createdAt: twoDaysAgo,
      showAllZones: false,
      areas: ["Operacion"],
      skills: ["Mecánica", "Bombas Hidráulicas", "Fontanería"],
      clearances: ["Espacios Confinados"],
      availability: "available",
      availabilityLabel: "Disponible",
      code: "TECH-005"
    },
    {
      id: "user-8",
      name: "Marcus Chen",
      avatar: createAvatarDataUri("Marcus Chen", "#865300", "#ffffff"),
      birthDate: "1993-06-10",
      position: "Técnico General",
      zone: "Zona Norte",
      zones: ["Zona Norte"],
      role: "empleado",
      createdAt: twoDaysAgo,
      showAllZones: false,
      areas: ["Operacion", "Proyectos"],
      skills: ["Estructural", "Escaneo Láser", "Inspecciones"],
      clearances: ["Clase 2"],
      availability: "soon",
      availabilityLabel: "Disponible en 1h",
      code: "TECH-006"
    },
    {
      id: "user-9",
      name: "David Smith",
      avatar: createAvatarDataUri("David Smith", "#b3261e", "#ffffff"),
      birthDate: "1987-12-01",
      position: "Especialista HVAC",
      zone: "Oficina Central",
      zones: ["Oficina Central"],
      role: "empleado",
      createdAt: twoDaysAgo,
      showAllZones: false,
      areas: ["Operacion", "Contabilidad"],
      skills: ["HVAC", "Balance de Carga", "Controles"],
      clearances: ["Clase 3"],
      availability: "available",
      availabilityLabel: "Disponible",
      code: "TECH-007"
    }
  ]

  const req1Id = "req-1"
  const req2Id = "req-2"
  const req3Id = "req-3"
  const req4Id = "req-4"
  const req5Id = "req-5"
  const req6Id = "req-6"
  const req7Id = "req-7"
  const req8Id = "req-8"
  const req9Id = "req-9"
  const req10Id = "req-10"
  const req11Id = "req-11"

  const requirements: Requirement[] = [
    {
      id: req1Id,
      code: "REQ-001",
      title: "Mantenimiento Preventivo Transformador T-45",
      description: "Revisión anual y cambio de aceite dieléctrico en subestación principal.",
      priority: "high",
      status: "assigned",
      location: "Zona Norte",
      area: "Operacion",
      selectedTechnicianId: "user-4",
      notes: "Urgente realizar antes de la temporada alta de lluvias.",
      createdAt: threeHoursAgo,
      assignedAt: twoHoursAgo,
      creatorId: "user-2",
      requiredSkills: ["HVAC"],
      requiredClearances: ["Altura"]
    },
    {
      id: req2Id,
      code: "REQ-002",
      title: "Instalación de Luminarias LED - Almacén",
      description: "Sustitución de 20 campanas de halogenuro metálico por campanas industriales LED.",
      priority: "medium",
      status: "assigned",
      location: "Zona Sur",
      area: "Proyectos",
      selectedTechnicianId: "user-5",
      notes: "Se requiere el uso de plataforma de elevación articulada.",
      createdAt: dayAgo,
      assignedAt: hourAgo,
      creatorId: "user-2",
      requiredSkills: ["Electricidad"],
      requiredClearances: []
    },
    {
      id: req3Id,
      code: "REQ-003",
      title: "Reparación Falla Eléctrica Oficina 302",
      description: "Diagnóstico y corrección de cortocircuito en línea de contactos regulados.",
      priority: "high",
      status: "assigned",
      location: "Oficina Central",
      area: "Contabilidad",
      selectedTechnicianId: "user-4",
      notes: "El personal administrativo se encuentra sin energía eléctrica.",
      createdAt: hourAgo,
      assignedAt: hourAgo,
      creatorId: "user-2",
      requiredSkills: ["HVAC"],
      requiredClearances: ["Alta Tensión"]
    },
    {
      id: req4Id,
      code: "REQ-004",
      title: "Limpieza de Tableros de Control",
      description: "Limpieza con aire comprimido y reapriete de terminales en tableros secundarios.",
      priority: "low",
      status: "assigned",
      location: "Zona Norte",
      area: "Operacion",
      selectedTechnicianId: "user-3",
      notes: "Ruta de rutina mensual de mantenimiento preventivo.",
      createdAt: dayAgo,
      assignedAt: dayAgo,
      creatorId: "user-2",
      requiredSkills: ["Electricidad"],
      requiredClearances: []
    },
    {
      id: req5Id,
      code: "REQ-005",
      title: "Auditoría de Seguridad Eléctrica",
      description: "Inspección de tierras físicas y semáforos de advertencia en subestación R-3.",
      priority: "medium",
      status: "assigned",
      location: "Zona Sur",
      area: "RH",
      selectedTechnicianId: "user-5",
      notes: "Requerido como parte de la preparación de la auditoría de certificación ISO.",
      createdAt: twoHoursAgo,
      assignedAt: hourAgo,
      creatorId: "user-2",
      requiredSkills: ["Electricidad"],
      requiredClearances: ["Arco Eléctrico"]
    },
    {
      id: req6Id,
      code: "REQ-006",
      title: "Calibración de Sensores de Temperatura",
      description: "Calibrar los termopares del sistema de enfriamiento de la Cámara Fría 3.",
      priority: "high",
      status: "unassigned",
      location: "Zona Norte",
      area: "Operacion",
      selectedTechnicianId: null,
      notes: "El cliente reporta discrepancias en los registros automáticos de temperatura.",
      createdAt: hourAgo,
      assignedAt: null,
      creatorId: "user-2",
      requiredSkills: ["HVAC"],
      requiredClearances: ["Clase 3"]
    },
    {
      id: req7Id,
      code: "REQ-007",
      title: "Escaneo de Integridad Estructural - Muelle A",
      description: "Escaneo ultrasónico no destructivo en los soportes de carga de concreto.",
      priority: "medium",
      status: "unassigned",
      location: "Zona Sur",
      area: "Proyectos",
      selectedTechnicianId: null,
      notes: "Revisión rutinaria post-microtemor para descartar fisuras internas.",
      createdAt: twoHoursAgo,
      assignedAt: null,
      creatorId: "user-2",
      requiredSkills: ["Estructural"],
      requiredClearances: ["Clase 2"]
    },
    {
      id: req8Id,
      code: "REQ-008",
      title: "Inspección de Extintores - Ala Oeste",
      description: "Inspección visual de manómetros, sellos y fecha de vigencia de 15 extintores.",
      priority: "low",
      status: "unassigned",
      location: "Oficina Central",
      area: "RH",
      selectedTechnicianId: null,
      notes: "Inspección mensual reglamentaria de protección civil.",
      createdAt: threeHoursAgo,
      assignedAt: null,
      creatorId: "user-2",
      requiredSkills: ["Seguridad Industrial"],
      requiredClearances: []
    },
    {
      id: req9Id,
      code: "REQ-009",
      title: "Auditoría Interna de Consumo Eléctrico",
      description: "Instalar analizador de redes para medir fluctuaciones y armónicas en el tablero principal.",
      priority: "high",
      status: "unassigned",
      location: "Oficina Central",
      area: "Operacion",
      selectedTechnicianId: null,
      notes: "Se sospecha de picos de tensión dañando equipos electrónicos del ala norte.",
      createdAt: hourAgo,
      assignedAt: null,
      creatorId: "user-2",
      requiredSkills: ["Electricidad"],
      requiredClearances: []
    },
    {
      id: req10Id,
      code: "REQ-010",
      title: "Aprobación de Contrato de Mantenimiento Externo",
      description: "Revisión de términos jurídicos y firma de renovación del acuerdo anual del corporativo.",
      priority: "high",
      status: "unassigned",
      location: "Oficina Central",
      area: "Direccion",
      selectedTechnicianId: null,
      notes: "Clave para las garantías de los equipos enfriadores de agua (chillers).",
      createdAt: dayAgo,
      assignedAt: null,
      creatorId: "user-2",
      requiredSkills: ["Auditoría"],
      requiredClearances: []
    },
    {
      id: req11Id,
      code: "REQ-011",
      title: "Cotización de Aceite Dieléctrico de Alta Densidad",
      description: "Solicitar cotizaciones detalladas a tres proveedores certificados para la reposición del T-45.",
      priority: "medium",
      status: "assigned",
      location: "Oficina Central",
      area: "Compras",
      selectedTechnicianId: "user-5",
      notes: "Asegurar cumplimiento con norma internacional de rigidez dieléctrica.",
      createdAt: dayAgo,
      assignedAt: hourAgo,
      creatorId: "user-2",
      requiredSkills: ["PLC"],
      requiredClearances: []
    }
  ]

  const mockDrawingScene: DrawingScene = {
    elements: [
      { id: "el-1", type: "rectangle", x: 100, y: 100, width: 220, height: 140, strokeColor: "#172839", strokeWidth: 2, fillStyle: "solid" },
      { id: "el-2", type: "text", x: 120, y: 160, text: "ROUTING HVAC REVISADO", fontSize: 14, color: "#004064" },
      { id: "el-3", type: "arrow", x: 320, y: 170, points: [[0, 0], [80, 50]], strokeColor: "#865300", strokeWidth: 3 }
    ],
    appState: { viewBackgroundColor: "#ffffff" },
    files: {},
    updatedAt: new Date().toISOString(),
    preview: buildThumbnail("Ductos HVAC Modificado", "#172839")
  }

  const tasks: Task[] = [
    {
      id: "task-todo-1",
      title: requirements[1].title,
      description: requirements[1].description,
      priority: "medium",
      status: "todo",
      assigneeIds: [],
      createdAt: dayAgo,
      updatedAt: hourAgo,
      timerStartedAt: null,
      statusDurations: { todo: 0, inProgress: 0, review: 0, done: 0 },
      estimatedHours: 6,
      location: "Zona Sur",
      area: "Operacion",
      drawingScene: null,
      activities: [
        {
          id: "act-todo1-1",
          type: "log",
          content: "Tarea escalada desde RH a Operación por Nina Patel.",
          createdAt: hourAgo,
          metadata: { authorName: "Nina Patel", authorRole: "empleado" }
        }
      ],
      requirementId: req2Id,
      creatorId: "user-6",
      escalation: {
        fromArea: "RH",
        toArea: "Operacion",
        escalatedBy: "user-6",
        escalatedAt: hourAgo,
        originalAssigneeIds: ["user-6"],
        targetUserId: null
      }
    },
    {
      id: "task-todo-2",
      title: requirements[2].title,
      description: requirements[2].description,
      priority: "high",
      status: "todo",
      assigneeIds: ["user-4"],
      createdAt: hourAgo,
      updatedAt: hourAgo,
      timerStartedAt: null,
      statusDurations: { todo: 0, inProgress: 0, review: 0, done: 0 },
      estimatedHours: 2,
      location: "Oficina Central",
      area: "Contabilidad",
      dueLabel: "Hoy, 17:00 HRS",
      drawingScene: null,
      activities: [
        {
          id: "act-todo2-1",
          type: "note",
          content: "Marta Gerente: Por favor, revisen el calibre de los conductores en la caja de paso antes de intervenir.",
          createdAt: hourAgo,
          metadata: { authorName: "Marta Gerente", authorRole: "gerente" }
        },
        {
          id: "act-todo2-2",
          type: "log",
          content: "Requerimiento asignado a Sarah Jenkins",
          createdAt: hourAgo,
          metadata: { authorName: "Admin Principal", authorRole: "administrador" }
        }
      ],
      requirementId: req3Id,
      creatorId: "user-1"
    },
    {
      id: "task-todo-3",
      title: "Remplazo Rutinario de Extintores",
      description: "Llevar 5 unidades cargadas de CO2 y PQS al edificio administrativo.",
      priority: "low",
      status: "todo",
      assigneeIds: ["user-3"],
      createdAt: dayAgo,
      updatedAt: dayAgo,
      timerStartedAt: null,
      statusDurations: { todo: 0, inProgress: 0, review: 0, done: 0 },
      estimatedHours: 1.5,
      location: "Oficina Central",
      area: "RH",
      drawingScene: null,
      activities: [
        {
          id: "act-todo3-1",
          type: "log",
          content: "Tarea creada automáticamente tras el reporte de audio de gas.",
          createdAt: dayAgo,
          metadata: { authorName: "Sistema", authorRole: "sistema" }
        }
      ],
      requirementId: null,
      creatorId: "user-2"
    },
    {
      id: "task-comp-1",
      title: requirements[10].title,
      description: requirements[10].description,
      priority: "medium",
      status: "todo",
      assigneeIds: ["user-5"],
      createdAt: dayAgo,
      updatedAt: hourAgo,
      timerStartedAt: null,
      statusDurations: { todo: 0, inProgress: 0, review: 0, done: 0 },
      estimatedHours: 3,
      location: "Oficina Central",
      area: "Compras",
      drawingScene: null,
      activities: [],
      requirementId: req11Id,
      creatorId: "user-2"
    },
    {
      id: "task-ip-1",
      title: requirements[0].title,
      description: requirements[0].description,
      priority: "high",
      status: "inProgress",
      assigneeIds: ["user-4"],
      createdAt: threeHoursAgo,
      updatedAt: hourAgo,
      timerStartedAt: Date.now() - 7200000, // 2 horas corriendo
      statusDurations: { todo: 0, inProgress: 7200, review: 0, done: 0 },
      estimatedHours: 4,
      location: "Zona Norte",
      area: "Operacion",
      drawingScene: null,
      activities: [
        {
          id: "act-ip1-1",
          type: "note",
          content: "Iniciado el cambio de aceite dieléctrico. Esperando el drenado del filtro secundario.",
          createdAt: hourAgo,
          metadata: { authorName: "Sarah Jenkins", authorRole: "empleado" }
        },
        {
          id: "act-ip1-2",
          type: "log",
          content: "Estado cambiado a En progreso",
          createdAt: twoHoursAgo,
          metadata: { authorName: "Sarah Jenkins", authorRole: "empleado" }
        },
        {
          id: "act-ip1-3",
          type: "image",
          content: buildThumbnail("Lectura de Presión de Aceite", "#172839"),
          createdAt: hourAgo,
          metadata: { authorName: "Sarah Jenkins", authorRole: "empleado", fileName: "presion_aceite.jpg", mimeType: "image/jpeg", description: "Lectura del manómetro de presión de aceite dieléctrico." }
        }
      ],
      requirementId: req1Id,
      creatorId: "user-1"
    },
    {
      id: "task-ip-2",
      title: requirements[4].title,
      description: requirements[4].description,
      priority: "medium",
      status: "inProgress",
      assigneeIds: ["user-5"],
      createdAt: twoHoursAgo,
      updatedAt: hourAgo,
      timerStartedAt: null, // Pausado
      statusDurations: { todo: 0, inProgress: 3600, review: 0, done: 0 },
      estimatedHours: 3,
      location: "Zona Sur",
      area: "RH",
      drawingScene: null,
      activities: [
        {
          id: "act-ip2-1",
          type: "log",
          content: "Tarea creada y asignada a Mike Rodriguez",
          createdAt: twoHoursAgo,
          metadata: { authorName: "Marta Gerente", authorRole: "gerente" }
        },
        {
          id: "act-ip2-2",
          type: "log",
          content: "Estado cambiado a En progreso",
          createdAt: hourAgo,
          metadata: { authorName: "Mike Rodriguez", authorRole: "empleado" }
        }
      ],
      requirementId: req5Id,
      creatorId: "user-1"
    },
    {
      id: "task-ip-3",
      title: "Revisión de fugas en la sala de bombas B2",
      description: "Inspeccionar las bombas hidráulicas del sótano B2. Hay reportes de ruidos y goteos continuos.",
      priority: "high",
      status: "inProgress",
      assigneeIds: ["user-3", "user-7"], // Multi-asignee
      createdAt: dayAgo,
      updatedAt: hourAgo,
      timerStartedAt: null, // Pausado
      statusDurations: { todo: 0, inProgress: 54000, review: 0, done: 0 }, // 15 horas acumuladas
      estimatedHours: 18,
      location: "Zona Sur",
      area: "Operacion",
      drawingScene: null,
      activities: [
        {
          id: "act-ip3-1",
          type: "note",
          content: "Trabajando en conjunto para sellar la junta tórica de la bomba 2. Se percibe un chirrido constante.",
          createdAt: twoHoursAgo,
          metadata: { authorName: "Juan Empleado", authorRole: "empleado" }
        },
        {
          id: "act-ip3-2",
          type: "log",
          content: "Estado cambiado a En progreso",
          createdAt: dayAgo,
          metadata: { authorName: "Marta Gerente", authorRole: "gerente" }
        },
        {
          id: "act-ip3-3",
          type: "log",
          content: "Personal adicional asignado: Alex Thompson",
          createdAt: dayAgo,
          metadata: { authorName: "Marta Gerente", authorRole: "gerente" }
        },
        {
          id: "act-ip3-4",
          type: "video",
          content: buildThumbnail("Prueba de Goteo Bomba 2", "#b3261e"),
          createdAt: hourAgo,
          metadata: { authorName: "Alex Thompson", authorRole: "empleado", fileName: "goteo_bomba.mp4", mimeType: "video/mp4", description: "Grabación corta para documentar el goteo de sellos." }
        }
      ],
      requirementId: null,
      creatorId: "user-2"
    },
    {
      id: "task-cont-1",
      title: "Auditoría de Gastos de Caja Chica - Q2",
      description: "Conciliación de facturas de refacciones menores adquiridas de emergencia.",
      priority: "medium",
      status: "inProgress",
      assigneeIds: ["user-9"],
      createdAt: dayAgo,
      updatedAt: twoHoursAgo,
      timerStartedAt: null, // Pausado
      statusDurations: { todo: 0, inProgress: 7200, review: 0, done: 0 }, // 2 horas acumuladas
      estimatedHours: 4,
      location: "Oficina Central",
      area: "Contabilidad",
      drawingScene: null,
      activities: [
        {
          id: "act-cont1",
          type: "note",
          content: "Falta comprobante fiscal de la compra de fusibles del ala norte. Se solicitó copia al proveedor.",
          createdAt: twoHoursAgo,
          metadata: { authorName: "David Smith", authorRole: "empleado" }
        },
        {
          id: "act-cont2",
          type: "audio",
          content: buildThumbnail("Audio: Factura Perdida", "#b3261e"),
          createdAt: hourAgo,
          metadata: { authorName: "David Smith", authorRole: "empleado", fileName: "factura_perdida.mp3", mimeType: "audio/mp3", description: "Audio explicando la falta de comprobante de fusibles." }
        },
        {
          id: "act-cont3",
          type: "log",
          content: "Iniciado el proceso de auditoría y revisión de caja chica.",
          createdAt: twoHoursAgo,
          metadata: { authorName: "David Smith", authorRole: "empleado" }
        }
      ],
      requirementId: null,
      creatorId: "user-2"
    },
    {
      id: "task-rev-1",
      title: requirements[3].title,
      description: requirements[3].description,
      priority: "low",
      status: "review",
      assigneeIds: ["user-3"],
      createdAt: dayAgo,
      updatedAt: twoHoursAgo,
      timerStartedAt: null,
      statusDurations: { todo: 0, inProgress: 18000, review: 0, done: 0 },
      estimatedHours: 4,
      location: "Zona Norte",
      area: "Operacion",
      drawingScene: null,
      activities: [
        {
          id: "act-rev1-1",
          type: "note",
          content: "Se terminaron de limpiar todos los contactores. Se adjunta foto y video del tablero energizado nuevamente.",
          createdAt: twoHoursAgo,
          metadata: { authorName: "Juan Empleado", authorRole: "empleado" }
        },
        {
          id: "act-rev1-2",
          type: "image",
          content: buildThumbnail("Contactores Limpios", "#228b22"),
          createdAt: hourAgo,
          metadata: { authorName: "Juan Empleado", authorRole: "empleado", fileName: "contactores_limpios.jpg", mimeType: "image/jpeg", description: "Foto final del ensamble de contactores." }
        },
        {
          id: "act-rev1-3",
          type: "log",
          content: "Limpieza finalizada y contactores re-ensamblados.",
          createdAt: twoHoursAgo,
          metadata: { authorName: "Juan Empleado", authorRole: "empleado" }
        },
        {
          id: "act-rev1-4",
          type: "log",
          content: "Tarea enviada a En Revisión.",
          createdAt: twoHoursAgo,
          metadata: { authorName: "Juan Empleado", authorRole: "empleado" }
        }
      ],
      requirementId: req4Id,
      creatorId: "user-2"
    },
    {
      id: "task-rev-2",
      title: "Verificación de planos de ductos HVAC",
      description: "Contrasta los planos de recorrido y documenta cualquier interferencia con la estructura de acero.",
      priority: "high",
      status: "review",
      assigneeIds: ["user-4"],
      createdAt: dayAgo,
      updatedAt: hourAgo,
      timerStartedAt: null,
      statusDurations: { todo: 0, inProgress: 7200, review: 0, done: 0 },
      estimatedHours: 3,
      location: "Zona Norte",
      area: "Operacion",
      drawingScene: mockDrawingScene, // Croquis adjunto
      activities: [
        {
          id: "act-rev2-1",
          type: "note",
          content: "Planos modificados y subidos como croquis técnico. Se ajustó el codo a 45 grados.",
          createdAt: hourAgo,
          metadata: { authorName: "Sarah Jenkins", authorRole: "empleado" }
        },
        {
          id: "act-rev2-2",
          type: "drawing",
          content: mockDrawingScene,
          createdAt: hourAgo,
          metadata: { authorName: "Sarah Jenkins", authorRole: "empleado", fileName: "plano_rediseño_hvac.png", mimeType: "image/png", description: "Croquis de desvío de ducto técnico." }
        },
        {
          id: "act-rev2-3",
          type: "log",
          content: "Planos modificados y subidos como croquis técnico en la pizarra.",
          createdAt: hourAgo,
          metadata: { authorName: "Sarah Jenkins", authorRole: "empleado" }
        },
        {
          id: "act-rev2-4",
          type: "log",
          content: "Tarea movida a En Revisión.",
          createdAt: hourAgo,
          metadata: { authorName: "Sarah Jenkins", authorRole: "empleado" }
        }
      ],
      requirementId: null,
      creatorId: "user-1"
    },
    {
      id: "task-dir-1",
      title: "Revisión del Plan Maestro de Mantenimiento",
      description: "Evaluar y aprobar los objetivos anuales y el presupuesto asignado para la infraestructura de Servimeci.",
      priority: "high",
      status: "review",
      assigneeIds: ["user-1", "user-2"], // Multi-assignee (Admin y Gerente)
      createdAt: dayAgo,
      updatedAt: hourAgo,
      timerStartedAt: null,
      statusDurations: { todo: 0, inProgress: 14400, review: 3600, done: 0 },
      estimatedHours: 5,
      location: "Oficina Central",
      area: "Direccion",
      drawingScene: null,
      activities: [
        {
          id: "act-dir1-1",
          type: "note",
          content: "Plan maestro cargado. Se ajustaron los indicadores de respuesta de fallas críticas (SLA) a 15 minutos.",
          createdAt: hourAgo,
          metadata: { authorName: "Marta Gerente", authorRole: "gerente" }
        },
        {
          id: "act-dir1-2",
          type: "log",
          content: "Presupuesto anual y SLA cargado al sistema por Gerencia.",
          createdAt: hourAgo,
          metadata: { authorName: "Marta Gerente", authorRole: "gerente" }
        }
      ],
      requirementId: null,
      creatorId: "user-1"
    },
    {
      id: "task-done-1",
      title: "Inspeccionar el vaciado de cimentación - Sector C",
      description: "Verifica la profundidad del colado de concreto y la posición del refuerzo antes del fraguado final.",
      priority: "high",
      status: "done",
      assigneeIds: ["user-8"],
      createdAt: twoDaysAgo,
      updatedAt: hourAgo,
      timerStartedAt: null,
      statusDurations: { todo: 0, inProgress: 28800, review: 7200, done: 0 },
      estimatedHours: 8,
      location: "Zona Norte",
      area: "Proyectos",
      drawingScene: mockDrawingScene,
      activities: [
        {
          id: "act-d1-1",
          type: "note",
          content: "Verificación de varillas de refuerzo exitosa. El vaciado se realizó con mezcla F'c 250 kg/cm2.",
          createdAt: dayAgo,
          metadata: { authorName: "Marcus Chen", authorRole: "empleado" }
        },
        {
          id: "act-d1-2",
          type: "log",
          content: "Estado cambiado a En Revisión",
          createdAt: dayAgo,
          metadata: { authorName: "Marcus Chen", authorRole: "empleado" }
        },
        {
          id: "act-d1-3",
          type: "log",
          content: "Estado cambiado a Finalizado",
          createdAt: hourAgo,
          metadata: { authorName: "Marta Gerente", authorRole: "gerente" }
        },
        {
          id: "act-d1-4",
          type: "drawing",
          content: mockDrawingScene,
          createdAt: dayAgo,
          metadata: { authorName: "Marcus Chen", authorRole: "empleado", fileName: "cimentacion_sector_c.png", mimeType: "image/png", description: "Croquis de inspección de cimentación." }
        }
      ],
      requirementId: null,
      creatorId: "user-2"
    },
    {
      id: "task-done-2",
      title: "Reemplazo de Fusible en Planta de Fuerza",
      description: "Reemplazar fusible de 15A quemado en el módulo auxiliar 4.",
      priority: "low",
      status: "done",
      assigneeIds: ["user-9"],
      createdAt: dayAgo,
      updatedAt: twoHoursAgo,
      timerStartedAt: null,
      statusDurations: { todo: 0, inProgress: 1200, review: 300, done: 0 },
      estimatedHours: 0.5,
      location: "Oficina Central",
      area: "Operacion",
      drawingScene: null,
      activities: [],
      requirementId: null,
      creatorId: "user-1"
    }
  ]

  const folders: Folder[] = [
    {
      id: "folder-1",
      name: "Mantenimientos Preventivos",
      parentId: null,
      createdAt: dayAgo,
      updatedAt: dayAgo
    },
    {
      id: "folder-2",
      name: "Evidencia Fotográfica - Zona Norte",
      parentId: "folder-1",
      createdAt: hourAgo,
      updatedAt: hourAgo
    },
    {
      id: "folder-foundations",
      name: "Cimientos",
      parentId: "folder-2",
      createdAt: hourAgo,
      updatedAt: hourAgo
    },
    {
      id: "folder-evidence",
      name: "Evidencias Generales",
      parentId: null,
      createdAt: dayAgo,
      updatedAt: dayAgo
    },
    {
      id: "folder-drawings",
      name: "Planos e Inspecciones",
      parentId: null,
      createdAt: dayAgo,
      updatedAt: dayAgo
    }
  ]

  const evidence: EvidenceFile[] = [
    {
      id: "evd-1",
      name: "armado_cimientos.jpg",
      mediaType: "image",
      mimeType: "image/jpeg",
      folderId: "folder-foundations",
      createdAt: threeHoursAgo,
      previewBase64: buildThumbnail("Cimientos", "#172839"),
      base64: "",
      caption: "Cimientos armados en el Sector C listos para colado.",
      flagged: false,
      linkedTaskId: "task-done-1",
      size: 1024 * 450
    },
    {
      id: "evd-2",
      name: "lectura_voltaje.png",
      mediaType: "image",
      mimeType: "image/png",
      folderId: "folder-evidence",
      createdAt: twoHoursAgo,
      previewBase64: buildThumbnail("Voltaje 220V", "#004064"),
      base64: "",
      caption: "Medición en bornes principales estable a 220.4V.",
      flagged: false,
      linkedTaskId: "task-rev-1",
      size: 1024 * 280
    },
    {
      id: "evd-3",
      name: "alarma_chirrido_bomba.wav",
      mediaType: "audio",
      mimeType: "audio/wav",
      folderId: "folder-evidence",
      createdAt: hourAgo,
      previewBase64: buildThumbnail("Audio: Chirrido", "#865300", "#ff3b30"),
      base64: "",
      caption: "CRÍTICO: Chirrido metálico detectado en el rodamiento de la bomba secundaria. Requiere intervención inmediata.",
      flagged: true, // ALERTA CRÍTICA
      linkedTaskId: "task-ip-3",
      size: 1024 * 850
    },
    {
      id: "evd-4",
      name: "inspeccion_termografica.mp4",
      mediaType: "video",
      mimeType: "video/mp4",
      folderId: "folder-evidence",
      createdAt: hourAgo,
      previewBase64: buildThumbnail("Video: Termografía", "#228b22"),
      base64: "",
      caption: "Inspección termográfica del transformador T-45 mostrando calentamiento normal.",
      flagged: false,
      linkedTaskId: "task-ip-1",
      size: 1024 * 1200
    },
    {
      id: "evd-5",
      name: "plano_rediseño_hvac.png",
      mediaType: "drawing",
      mimeType: "image/png",
      folderId: "folder-drawings",
      createdAt: hourAgo,
      previewBase64: buildThumbnail("Plano HVAC", "#5d3fd3"),
      base64: "",
      caption: "Desvío de ducto para librar trabe de acero estructural.",
      flagged: false,
      linkedTaskId: "task-rev-2",
      size: 1024 * 600
    },
    {
      id: "evd-6",
      name: "losa_agrietada_soporte.jpg",
      mediaType: "image",
      mimeType: "image/jpeg",
      folderId: "folder-evidence",
      createdAt: dayAgo,
      previewBase64: buildThumbnail("CRÍTICO: Fisura Losa", "#b3261e", "#ff3b30"),
      base64: "",
      caption: "CRÍTICO: Grieta transversal de 4mm detectada en la losa de soporte en nivel B2.",
      flagged: true, // ALERTA CRÍTICA
      linkedTaskId: "task-ip-3",
      size: 1024 * 720
    },
    {
      id: "evd-7",
      name: "reporte_fuga_gas.mp3",
      mediaType: "audio",
      mimeType: "audio/mp3",
      folderId: "folder-evidence",
      createdAt: hourAgo,
      previewBase64: buildThumbnail("Audio: Reporte Gas", "#b3261e", "#ff3b30"),
      base64: "",
      caption: "CRÍTICO: Olor a gas detectado cerca del tanque estacionario principal en patio de maniobras.",
      flagged: true, // ALERTA CRÍTICA
      linkedTaskId: "task-todo-3",
      size: 1024 * 512
    },
    {
      id: "evd-8",
      name: "bloqueo_etiquetado.jpg",
      mediaType: "image",
      mimeType: "image/jpeg",
      folderId: "folder-evidence",
      createdAt: twoHoursAgo,
      previewBase64: buildThumbnail("LOTO Bloqueo", "#172839"),
      base64: "",
      caption: "Candado y etiqueta de seguridad colocados en el interruptor Q-11 para LOTO.",
      flagged: false,
      linkedTaskId: "task-ip-1",
      size: 1024 * 340
    }
  ]

  const notifications: Notification[] = [
    {
      id: "notif-1",
      title: "Alerta de Seguridad Crítica",
      message: "Se ha reportado una grieta transversal de 4mm en la losa de soporte en el Sector B2.",
      timestamp: hourAgo,
      type: "alert",
      taskId: "task-ip-3",
      read: false
    },
    {
      id: "notif-2",
      title: "Asignación de Requerimiento",
      message: "Marta Gerente te asignó el Requerimiento REQ-001 (Transformador T-45).",
      timestamp: twoHoursAgo,
      type: "assignment",
      taskId: "task-ip-1",
      userId: "user-2",
      targetUserId: "user-4",
      read: false
    },
    {
      id: "notif-3",
      title: "Nuevo Comentario Técnico",
      message: "Juan Empleado agregó una nota sobre el chirrido metálico en rodamiento de bomba.",
      timestamp: hourAgo,
      type: "message",
      taskId: "task-ip-3",
      userId: "user-3",
      read: true
    },
    {
      id: "notif-4",
      title: "Progreso de Tarea",
      message: "Sarah Jenkins movió 'Verificación de planos de ductos HVAC' a En Revisión.",
      timestamp: hourAgo,
      type: "movement",
      taskId: "task-rev-2",
      userId: "user-4",
      read: true
    }
  ]

  const globalAlert: GlobalAlert | null = null

  return {
    users,
    tasks,
    requirements,
    evidence,
    folders,
    assignments: tasks.filter(t => t.requirementId).map(t => ({
      id: makeId("assign"),
      requirementId: t.requirementId || "",
      technicianId: t.assigneeIds[0] || "",
      status: "confirmed" as const,
      createdAt: t.createdAt,
      notes: ""
    })),
    saves: [
      {
        id: makeId("save"),
        mode: "new",
        folderId: "folder-1",
        folderName: "Mantenimientos Preventivos",
        folderPath: "Mantenimientos Preventivos",
        createdAt: dayAgo,
        dateLabel: formatDateStamp(new Date(dayAgo)),
        timeLabel: formatClock(new Date(dayAgo)),
        counts: { tasks: 13, requirements: 11, assignments: 7, evidence: 8 }
      }
    ],
    drawingScene: null,
    currentUserId: "user-1",
    notifications,
    globalAlert,
  }
}

function resolveFolderPath(folders: Folder[], folderId: string) {
  const chain: Folder[] = []
  let cursor = folders.find((folder) => folder.id === folderId) ?? null

  while (cursor) {
    chain.unshift(cursor)
    cursor = cursor.parentId ? folders.find((folder) => folder.id === cursor?.parentId) ?? null : null
  }

  return buildFolderPath(chain.map((folder) => folder.name))
}

function countDescendants(folders: Folder[], folderId: string) {
  const ids = new Set<string>([folderId])
  let queue = [folderId]

  while (queue.length > 0) {
    const current = queue.shift()
    const children = folders.filter((folder) => folder.parentId === current)
    children.forEach((child) => {
      ids.add(child.id)
      queue.push(child.id)
    })
  }

  return ids
}

function sanitizeDrawingAppState(appState: Record<string, unknown> | undefined) {
  if (!appState) {
    return { viewBackgroundColor: "#ffffff" }
  }

  const { collaborators: _collaborators, ...rest } = appState as Record<string, unknown> & {
    collaborators?: unknown
  }

  return rest
}

function sanitizeDrawingScene(scene: Omit<DrawingScene, "updatedAt"> | DrawingScene | null) {
  if (!scene) {
    return null
  }

  return {
    elements: Array.isArray(scene.elements) ? scene.elements : [],
    appState: sanitizeDrawingAppState(scene.appState),
    files: scene.files ?? {}
  }
}

function patchItems<T extends { id: string }>(
  items: T[] | undefined,
  patches: Record<string, Partial<T>>
) {
  if (!items) {
    return items
  }

  return items.map((item) => (patches[item.id] ? ({ ...item, ...patches[item.id] } as T) : item))
}

function translateLegacyWorkflowState(state: Partial<WorkflowStore>) {
  const nextUsers = (state.users || []).map((u: any) => {
    const zones = normalizeZones(Array.isArray(u.zones) ? u.zones : null, u.zone)
    return {
      ...u,
      zone: zones[0] ?? u.zone ?? "",
      zones,
      areas: u.areas && u.areas.length > 0 ? u.areas : [DEFAULT_AREA]
    }
  })

  const nextTasks = (state.tasks || []).map((t: any) => ({
    ...t,
    area: t.area ?? DEFAULT_AREA,
    statusDurations: t.statusDurations || { todo: 0, inProgress: t.accumulatedSeconds || 0, review: 0, done: 0 }
  }))

  const nextRequirements = (state.requirements || []).map(r => ({
    ...r,
    area: r.area ?? DEFAULT_AREA
  }))

  return {
    ...state,
    users: nextUsers,
    tasks: patchItems(nextTasks, {
      "task-foundation": {
        title: "Inspeccionar el vaciado de cimentación - Sector C",
        description:
          "Verifica la profundidad del colado de concreto y la posición del refuerzo antes de que cierre la ventana de curado de la losa.",
        location: "Sector C"
      },
      "task-hvac-routing": {
        title: "Verificar los planos de ductos HVAC",
        description:
          "Contrasta los planos de recorrido y documenta cualquier interferencia con la estructura de acero.",
        location: "Azotea"
      },
      "task-pump-room": {
        title: "Revisión de fugas en la sala de bombas",
        description:
          "Inspecciona la sala de bombas para detectar microfugas y verificar las lecturas de presión.",
        location: "B2"
      },
      "task-structural-load": {
        title: "Resolver discrepancia de carga estructural",
        description:
          "Revisa la tabla de cargas frente a las mediciones de campo y corrige la diferencia.",
        location: "Marco A"
      },
      "task-inventory": {
        title: "Actualizar el registro de inventario de materiales",
        description:
          "Pon al día el tablero de inventario del sitio con el manifiesto de entregas.",
        location: "Almacén"
      },
      "task-safety-audit": {
        title: "Auditoría de cumplimiento de seguridad - Zona 2",
        description:
          "Valida la señalización, los registros de incidentes y la ubicación de dispositivos en todo el perímetro.",
        location: "Zona 2"
      },
      "task-generator": {
        title: "Prueba del generador de emergencia",
        description:
          "Ejecuta el generador con carga y confirma el voltaje estable después de la conmutación.",
        location: "Sala eléctrica"
      },
      "task-lift-calibration": {
        title: "Revisión de calibración del elevador",
        description:
          "Revisa la calibración del corte de seguridad y documenta el tiempo de respuesta del elevador.",
        location: "Hueco del elevador"
      },
      "task-vent-audit": {
        title: "Auditoría de ventilación de radiología",
        description:
          "Inspecciona el flujo de extracción y los calendarios de limpieza del ala de radiología.",
        location: "Ala de radiología"
      },
      "task-permit-archive": {
        title: "Sincronización del archivo de permisos",
        description:
          "Sincroniza los permisos firmados con el archivo y verifica que los metadatos estén completos.",
        location: "Archivo"
      }
    }),
    requirements: patchItems(nextRequirements, {
      "req-8492": {
        title: "Calibración del sistema HVAC",
        description:
          "Realiza la calibración trimestral de las unidades de enfriamiento de la sala principal de servidores y registra las variaciones termostáticas. Requiere autorización Clase 3 y equipo de diagnóstico especializado (Kit A-4).",
        location: "Sector 4G",
        dueLabel: "Hoy, 17:00 HRS",
        requiredSkills: ["HVAC", "Calibración"],
        requiredClearances: ["Clase 3"]
      },
      "req-8493": {
        title: "Escaneo de integridad estructural",
        description:
          "Escaneo ultrasónico de los pilares de carga en el nivel B2 después de eventos de microtremor.",
        location: "Nivel B2",
        dueLabel: "Mañana",
        requiredSkills: ["Estructural", "Escaneo"],
        requiredClearances: ["Clase 2"]
      },
      "req-8495": {
        title: "Revisión rutinaria de extintores",
        description:
          "Inspección visual y lectura del manómetro para todas las unidades en los pasillos del Ala Este.",
        location: "Ala Este",
        dueLabel: "14 oct",
        requiredSkills: ["Seguridad", "Inspecciones"],
        requiredClearances: ["Clase 2"]
      },
      "req-8501": {
        title: "Auditoría de carga eléctrica",
        description:
          "Mide la distribución de carga en la sala eléctrica principal y valida los umbrales de alerta.",
        location: "Núcleo eléctrico",
        dueLabel: "Viernes",
        requiredSkills: ["Diagnóstico", "Cumplimiento"],
        requiredClearances: ["Clase 3"]
      }
    }),
    folders: patchItems(state.folders, {
      "folder-site-alpha": { name: "Sitio Alfa" },
      "folder-phase-2": { name: "Fase 2" },
      "folder-foundations": { name: "Cimientos" },
      "folder-evidence": { name: "Evidencias" },
      "folder-drawings": { name: "Planos" }
    }),
    evidence: patchItems(state.evidence, {
      "evd-492": { name: "armado-cimientos.jpg" },
      "evd-493": {
        name: "panel-principal.mp4",
        caption: "Inspección del panel principal. El cableado cumple con el código."
      },
      "evd-494": {
        name: "losa-agrietada.jpg",
        caption:
          "Crítico: se detectó una fisura capilar en la plataforma del sector B. Requiere revisión estructural."
      }
    }),
    assignments: patchItems(state.assignments, {
      "assign-req-8492": {
        notes: "Coordina con el equipo de automatización del edificio antes de la calibración."
      }
    }),
    saves: patchItems(state.saves, {
      "save-001": {
        folderName: "Cimientos",
        folderPath: "Sitio Alfa / Fase 2 / Cimientos",
        dateLabel: formatDateStamp(new Date(state.saves?.find((save) => save.id === "save-001")?.createdAt ?? Date.now())),
        timeLabel: formatClock(new Date(state.saves?.find((save) => save.id === "save-001")?.createdAt ?? Date.now()))
      }
    }),
    drawingScene: sanitizeDrawingScene(state.drawingScene ?? null)
  }
}

function accumulateTaskTime(task: Task, now = Date.now()) {
  if (task.status === "done") return task.statusDurations?.["done"] || 0

  const runningSeconds =
    task.timerStartedAt === null ? 0 : Math.max(0, Math.floor((now - task.timerStartedAt) / 1000))

  return (task.statusDurations?.[task.status] || 0) + runningSeconds
}

function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: any
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

const debouncedPush = debounce(async (state: any) => {
  await pushToSupabase(state)
}, 1000)

export const useWorkflowStore = create<WorkflowStore>()(
  persist(
    (set, get) => {
      const initial = createEmptyState()

      return {
        ...initial,
        notifications: initial.notifications ?? [],
        globalAlert: initial.globalAlert ?? null,
        hasHydrated: false,
        setHydrated: (value) => {
          set({ hasHydrated: value })
        },
        addNotification: (notification: Omit<Notification, "id" | "timestamp">) => {
          set((state) => ({
            notifications: [
              {
                id: makeId("notif"),
                timestamp: new Date().toISOString(),
                read: false,
                ...notification
              },
              ...state.notifications
            ].slice(0, 50) // Keep last 50
          }))
        },
        markNotificationAsRead: (notificationId: string) => {
          set((state) => ({
            notifications: state.notifications.map((n) =>
               n.id === notificationId ? { ...n, read: true } : n
            )
          }))
        },
        setGlobalAlert: (alert: GlobalAlert | null) => {
          set({ globalAlert: alert })
        },
        addTask: (input) => {
          const taskId = makeId("task")
          const requirementId = makeId("req")
          const now = new Date().toISOString()
          const status = input.status ?? "todo"
          const assigneeIds = input.assigneeIds ?? []
          const area = input.area ?? DEFAULT_AREA
          const currentUser = get().users.find((user) => user.id === get().currentUserId)
          const resolvedLocation = input.location ?? currentUser?.zone ?? ""

          if (isGlobalArea(area) && !canCreateInGlobalArea(currentUser)) {
            get().setGlobalAlert({
              title: "Área no permitida",
              message: "Solo administradores o gerentes pueden crear tareas en el área General.",
              type: "warning"
            })
            return null
          }
          
          const reqCode = `REQ-${Math.floor(1000 + Math.random() * 9000)}`
          
          const newRequirement: Requirement = {
            id: requirementId,
            code: reqCode,
            title: input.title,
            description: input.description,
            location: resolvedLocation,
            area,
            dueLabel: input.dueLabel ?? "",
            priority: input.priority,
            status: assigneeIds.length > 0 ? "assigned" : "unassigned",
            requiredSkills: [],
            requiredClearances: [],
            estimatedHours: input.estimatedHours ?? 1,
            selectedTechnicianId: assigneeIds[0] ?? null,
            notes: "",
            assignedAt: assigneeIds.length > 0 ? now : null,
            creatorId: get().currentUserId || "system"
          }

          const newTask: Task = {
            id: taskId,
            title: input.title,
            description: input.description,
            priority: input.priority,
            status,
            assigneeIds,
            createdAt: now,
            updatedAt: now,
            timerStartedAt: status === "done" ? null : Date.now(),
            statusDurations: { todo: 0, inProgress: 0, review: 0, done: 0 },
            location: resolvedLocation || undefined,
            area,
            dueLabel: input.dueLabel,
            drawingScene: null,
            activities: input.activities ?? [],
            requirementId,
            creatorId: get().currentUserId || "system",
            escalation: null
          }

          set((state) => {
            const nextAssignments = [...state.assignments]
            if (assigneeIds.length > 0) {
              nextAssignments.unshift({
                id: makeId("assign"),
                requirementId,
                technicianId: assigneeIds[0],
                notes: "Asignado al crear tarea desde tablero",
                createdAt: now,
                status: "confirmed"
              })
            }

            return {
              tasks: [newTask, ...state.tasks],
              requirements: [newRequirement, ...state.requirements],
              assignments: nextAssignments
            }
          })

          get().addTaskLog(taskId, "Tarea creada")

          return taskId
        },
        updateTask: (taskId, patch) => {
          const previousTask = get().tasks.find(t => t.id === taskId)

          set((state) => {
            const nextTasks = state.tasks.map((t) => {
              if (t.id !== taskId) return t
              
              const currentUser = state.users.find(u => u.id === state.currentUserId)
              const hasFullControl = canUserManageTask(currentUser, t)
              if (currentUser?.role === "empleado" && !hasFullControl) {
                if (t.status === "done") {
                  get().setGlobalAlert({
                    title: "Acción no disponible",
                    message: "Esta tarea ya está finalizada y no admite cambios.",
                    type: "error"
                  })
                  return t
                }
                if (patch.status) {
                  const statusOrder: TaskStatus[] = ["todo", "inProgress", "review", "done"]
                  const currentIndex = statusOrder.indexOf(t.status)
                  const nextIndex = statusOrder.indexOf(patch.status)
                  if (nextIndex < currentIndex) {
                    get().setGlobalAlert({
                      title: "Movimiento no permitido",
                      message: "Este cambio no está permitido en esta etapa.",
                      type: "warning"
                    })
                    return t
                  }
                }
              }
              
              const now = Date.now()
              const updatedStatus = patch.status ?? t.status
              
              // If status changed, accumulate time for the old status
              let nextDurations = { ...t.statusDurations }
              let nextTimerStart = t.timerStartedAt
              
              if (patch.status && patch.status !== t.status) {
                const totalForOldStatus = accumulateTaskTime(t, now)
                nextDurations[t.status] = totalForOldStatus
                nextTimerStart = patch.status === "done" ? null : now
              }
              
              return { 
                ...t, 
                ...patch, 
                statusDurations: nextDurations,
                timerStartedAt: nextTimerStart,
                updatedAt: new Date(now).toISOString() 
              }
            })
            
            const updatedTask = nextTasks.find(t => t.id === taskId)
            const requirementId = updatedTask?.requirementId
            
            let nextRequirements = state.requirements
            if (requirementId) {
              nextRequirements = state.requirements.map(req => 
                req.id === requirementId 
                  ? { 
                      ...req, 
                      title: patch.title ?? req.title,
                      description: patch.description ?? req.description,
                      priority: patch.priority ?? req.priority,
                      location: patch.location ?? req.location,
                      dueLabel: patch.dueLabel ?? req.dueLabel,
                      area: patch.area !== undefined ? patch.area : req.area
                    } 
                  : req
              )
              }

              return {
                tasks: nextTasks,
                requirements: nextRequirements
            }
          })

          const updatedTask = get().tasks.find(t => t.id === taskId)
          if (previousTask && updatedTask) {
            const logs: string[] = []
            if (updatedTask.status !== previousTask.status) {
              const labels: Record<string, string> = {
                todo: "Por hacer",
                inProgress: "En progreso",
                review: "En revisión",
                done: "Hecho"
              }
              logs.push(`Estado cambiado a: ${labels[updatedTask.status] || updatedTask.status}`)
            }
            if (
              patch.assigneeIds &&
              JSON.stringify(updatedTask.assigneeIds) !== JSON.stringify(previousTask.assigneeIds)
            ) {
              logs.push("Personal asignado actualizado")
            }
            if (patch.area && previousTask.area !== updatedTask.area) {
              logs.push(`Área cambiada de ${previousTask.area || "Sin área"} a ${updatedTask.area}`)
            }

            if (logs.length > 0) {
              logs.forEach((msg) => get().addTaskLog(taskId, msg))
            }
          }
        },
        deleteTask: (taskId) => {
          const currentUser = get().users.find((u) => u.id === get().currentUserId)
          const taskToDelete = get().tasks.find((t) => t.id === taskId)
          if (taskToDelete && !canUserManageTask(currentUser, taskToDelete)) {
            get().setGlobalAlert({
              title: "Eliminación no permitida",
              message: "Solo quien creó o tomó la tarea puede eliminarla.",
              type: "warning"
            })
            return
          }

          set((state) => {
            const taskToDelete = state.tasks.find((t) => t.id === taskId)
            const requirementId = taskToDelete?.requirementId

            return {
              tasks: state.tasks.filter((task) => task.id !== taskId),
              requirements: requirementId
                ? state.requirements.filter((req) => req.id !== requirementId)
                : state.requirements,
              assignments: requirementId
                ? state.assignments.filter((assign) => assign.requirementId !== requirementId)
                : state.assignments
            }
          })
        },
        moveTask: (taskId, status) => {
          const now = Date.now()
          const previousTask = get().tasks.find((t) => t.id === taskId)

          set((state) => {
            const task = state.tasks.find(t => t.id === taskId)
            const currentUser = state.users.find(u => u.id === state.currentUserId)
            const hasFullControl = canUserManageTask(currentUser, task)
            
            if (!task || !currentUser) return state

            if (currentUser.role === "empleado" && !hasFullControl) {
              if (task.status === "done") {
                get().setGlobalAlert({
                  title: "Acción no disponible",
                  message: "Esta tarea ya está finalizada y no admite cambios.",
                  type: "error"
                })
                return state
              }
              const statusOrder: TaskStatus[] = ["todo", "inProgress", "review", "done"]
              const currentIndex = statusOrder.indexOf(task.status)
              const nextIndex = statusOrder.indexOf(status)
              if (nextIndex < currentIndex) {
                get().setGlobalAlert({
                  title: "Movimiento no permitido",
                  message: "Este cambio no está permitido en esta etapa.",
                  type: "warning"
                })
                return state
              }
            }

            return {
              tasks: state.tasks.map((t) => {
                if (t.id !== taskId) {
                  return t
                }

                const nextDurations = { ...t.statusDurations }
                nextDurations[t.status] = accumulateTaskTime(t, now)

                return {
                  ...t,
                  status,
                  timerStartedAt: status === "done" ? null : now,
                  statusDurations: nextDurations,
                  updatedAt: new Date(now).toISOString()
                }
              })
            }
          })

          const updatedTask = get().tasks.find((t) => t.id === taskId)
          if (updatedTask) {
            const labels: Record<string, string> = {
              todo: "Por hacer",
              inProgress: "En progreso",
              review: "En revisión",
              done: "Completada"
            }
            get().addNotification({
              title: "Movimiento de Tarea",
              message: `La tarea "${updatedTask.title}" cambió a: ${labels[status]}`,
              type: "movement",
              taskId,
              userId: get().currentUserId || "system",
              targetUserId: null
            })

            if (previousTask && updatedTask.status !== previousTask.status) {
              get().addTaskLog(taskId, `Estado cambiado a: ${labels[updatedTask.status] || updatedTask.status}`)
            }
          }
        },
        escalateTask: (taskId, toArea, targetUserId = null, note) => {
          const { tasks, users, currentUserId } = get()
          const task = tasks.find((item) => item.id === taskId)
          const currentUser = users.find((item) => item.id === currentUserId)

          if (!task || !currentUser) {
            return
          }

          if (!canUserManageTask(currentUser, task)) {
            get().setGlobalAlert({
              title: "Escalado no permitido",
              message: "Solo el asignado, creador o un administrador/gerente puede escalar esta tarea.",
              type: "warning"
            })
            return
          }

          if (isGlobalArea(toArea) && !canCreateInGlobalArea(currentUser)) {
            get().setGlobalAlert({
              title: "Área no permitida",
              message: "Solo administradores o gerentes pueden escalar tareas al área General.",
              type: "warning"
            })
            return
          }

          if (task.area === toArea) {
            get().setGlobalAlert({
              title: "Área inválida",
              message: "Selecciona un área distinta a la actual.",
              type: "info"
            })
            return
          }

          const now = new Date().toISOString()
          const fromArea = task.area ?? DEFAULT_AREA
          const originalAssigneeIds = [...task.assigneeIds]
          const nextAssigneeIds = targetUserId
            ? Array.from(new Set([...task.assigneeIds, targetUserId]))
            : task.assigneeIds

          const timeNow = Date.now()
          const nextDurations = { ...task.statusDurations }
          nextDurations[task.status] = accumulateTaskTime(task, timeNow)

          const formatDurationText = (seconds: number) => {
            const h = Math.floor(seconds / 3600)
            const m = Math.floor((seconds % 3600) / 60)
            const s = seconds % 60
            return `${h}h ${m}m ${s}s`
          }

          const todoTime = formatDurationText(nextDurations.todo)
          const inProgressTime = formatDurationText(nextDurations.inProgress)
          const reviewTime = formatDurationText(nextDurations.review)
          const doneTime = formatDurationText(nextDurations.done)
          const totalSeconds = nextDurations.todo + nextDurations.inProgress + nextDurations.review + nextDurations.done
          const totalTime = formatDurationText(totalSeconds)

          const assigneeNames = task.assigneeIds
            .map(id => users.find(u => u.id === id)?.name || "Desconocido")
            .join(", ") || "Sin asignados"

          let logMessage = `Tarea escalada de ${fromArea} a ${toArea}.\n`
          logMessage += `• Empleados: ${assigneeNames}\n`
          logMessage += `• Tiempos acumulados:\n`
          logMessage += `   - Por hacer: ${todoTime}\n`
          logMessage += `   - En progreso: ${inProgressTime}\n`
          logMessage += `   - En revisión: ${reviewTime}\n`
          logMessage += `   - Completada: ${doneTime}\n`
          logMessage += `• Tiempo total: ${totalTime}`
          
          if (note && note.trim()) {
            logMessage += `\n• Motivo del escalado: "${note.trim()}"`
          }

          set((state) => {
            const nextTasks = state.tasks.map((item) =>
              item.id === taskId
                ? {
                    ...item,
                    area: toArea,
                    status: "todo" as TaskStatus,
                    assigneeIds: nextAssigneeIds,
                    timerStartedAt: timeNow,
                    statusDurations: nextDurations,
                    escalation: {
                      fromArea,
                      toArea,
                      escalatedBy: currentUser.id,
                      escalatedAt: now,
                      originalAssigneeIds,
                      targetUserId: targetUserId ?? null
                    },
                    updatedAt: now
                  }
                : item
            )

            const requirementId = task.requirementId
            const nextRequirements = requirementId
              ? state.requirements.map((req) =>
                  req.id === requirementId 
                    ? { 
                        ...req, 
                        area: toArea,
                        status: nextAssigneeIds.length > 0 ? "assigned" as const : "unassigned" as const,
                        selectedTechnicianId: nextAssigneeIds[0] ?? null,
                        assignedAt: nextAssigneeIds.length > 0 ? now : null
                      } 
                    : req
                )
              : state.requirements

            return {
              tasks: nextTasks,
              requirements: nextRequirements
            }
          })

          const assignedUser = targetUserId
            ? users.find((item) => item.id === targetUserId)
            : null

          get().addTaskLog(taskId, logMessage)

          if (assignedUser) {
            get().addNotification({
              title: "Asignación por escalado",
              message: `${currentUser.name} te asignó una tarea escalada desde ${fromArea}.`,
              type: "assignment",
              taskId,
              userId: currentUser.id,
              targetUserId: assignedUser.id
            })
          } else {
            const areaUsers = users.filter((user) => (user.areas ?? []).includes(toArea))
            areaUsers.forEach((user) => {
              get().addNotification({
                title: "Tarea escalada sin asignar",
                message: `Nueva tarea llegó desde ${fromArea} para ${toArea} sin asignar.`,
                type: "movement",
                taskId,
                userId: currentUser.id,
                targetUserId: user.id
              })
            })
          }

          // Persist the escalation immediately so other profiles see the new assignees and area right away.
          void pushToSupabase(get())
        },
        claimEscalatedTask: (taskId) => {
          const { tasks, users, currentUserId } = get()
          const task = tasks.find((item) => item.id === taskId)
          const currentUser = users.find((item) => item.id === currentUserId)

          if (!task || !currentUser) {
            return
          }

          if (!task.escalation) {
            get().setGlobalAlert({
              title: "Asignacion no disponible",
              message: "Esta tarea no tiene una escalacion activa.",
              type: "info"
            })
            return
          }

          get().claimTask(taskId)
        },
        claimTask: (taskId) => {
          const { tasks, users, currentUserId } = get()
          const task = tasks.find((item) => item.id === taskId)
          const currentUser = users.find((item) => item.id === currentUserId)

          if (!task || !currentUser) {
            return
          }

          const claimState = getTaskClaimState(currentUser, task, users)
          if (!claimState.canClaim) {
            const alertConfig =
              claimState.reason === "already_assigned_to_you"
                ? {
                    title: "Asignación no necesaria",
                    message: "Ya estás asignado a esta tarea.",
                    type: "info" as const
                  }
                : claimState.reason === "already_taken_by_someone_else"
                  ? {
                      title: "Tarea ya tomada",
                      message: "Ya la tomó otra persona del área.",
                      type: "warning" as const
                    }
                  : {
                      title: "Asignación no permitida",
                      message: "No tienes permiso para tomar esta tarea.",
                      type: "warning" as const
                    }

            get().setGlobalAlert(alertConfig)
            return
          }

          const now = new Date().toISOString()
          set((state) => ({
            tasks: state.tasks.map((item) =>
              item.id === taskId
                ? {
                    ...item,
                    assigneeIds: Array.from(new Set([...item.assigneeIds, currentUser.id])),
                    escalation: item.escalation
                      ? { ...item.escalation, targetUserId: item.escalation.targetUserId ?? currentUser.id }
                      : item.escalation,
                  updatedAt: now
                }
                : item
            )
          }))

          const areaName = task.escalation ? task.escalation.toArea : (task.area ?? "su área")
          get().addTaskLog(
            taskId,
            `Auto-tomada en ${areaName}: ${currentUser.name} tomó la tarea.`
          )

          // Persist the claim immediately so another sync cannot briefly rehydrate the old assignee list.
          void pushToSupabase(get())
        },
        startTaskTimer: (taskId) => {
          const now = Date.now()
          set((state) => ({
            tasks: state.tasks.map((task) => {
              if (task.id !== taskId || task.timerStartedAt !== null || task.status === "done") {
                return task
              }
              
              return {
                ...task,
                timerStartedAt: now,
                updatedAt: new Date(now).toISOString()
              }
            })
          }))
        },
        pauseTaskTimer: (taskId) => {
          const now = Date.now()
          set((state) => ({
            tasks: state.tasks.map((task) => {
              if (task.id !== taskId || task.timerStartedAt === null) {
                return task
              }

              const nextDurations = { ...task.statusDurations }
              nextDurations[task.status] = accumulateTaskTime(task, now)

              return {
                ...task,
                statusDurations: nextDurations,
                timerStartedAt: null,
                updatedAt: new Date(now).toISOString()
              }
            })
          }))
        },
        addEvidence: (input) => {
          const id = makeId("evd")
          const now = new Date().toISOString()

          set((state) => ({
            evidence: [
              {
                id,
                mediaType: input.mediaType,
                mimeType: input.mimeType,
                name: input.name,
                base64: input.base64,
                previewBase64: input.previewBase64,
                caption: input.caption ?? "",
                flagged: false,
                createdAt: now,
                folderId: input.folderId ?? null,
                linkedTaskId: input.linkedTaskId ?? null,
                size: input.size
              },
              ...state.evidence
            ]
          }))

          return id
        },
        updateEvidence: (evidenceId, patch) => {
          set((state) => ({
            evidence: state.evidence.map((item) =>
              item.id === evidenceId ? { ...item, ...patch } : item
            )
          }))
        },
        deleteEvidence: (evidenceId) => {
          set((state) => ({
            evidence: state.evidence.filter((item) => item.id !== evidenceId)
          }))
        },
        toggleEvidenceFlag: (evidenceId) => {
          set((state) => ({
            evidence: state.evidence.map((item) =>
              item.id === evidenceId ? { ...item, flagged: !item.flagged } : item
            )
          }))
        },
        addRequirement: (input) => {
          const id = makeId("req")
          const area = input.area ?? DEFAULT_AREA
          const requirement: Requirement = {
            id,
            code: input.code,
            title: input.title,
            description: input.description,
            location: input.location,
            area,
            dueLabel: input.dueLabel,
            priority: input.priority,
            status: "unassigned",
            requiredSkills: input.requiredSkills,
            requiredClearances: input.requiredClearances,
            estimatedHours: input.estimatedHours,
            selectedTechnicianId: null,
            notes: "",
            assignedAt: null,
            creatorId: get().currentUserId || "system"
          }

          set((state) => {
            const taskId = makeId("task")
            const now = new Date().toISOString()
            const newTask: Task = {
              id: taskId,
              title: requirement.title,
              description: requirement.description,
              priority: requirement.priority,
              status: "todo",
              assigneeIds: [],
              createdAt: now,
              updatedAt: now,
              timerStartedAt: Date.now(),
              statusDurations: { todo: 0, inProgress: 0, review: 0, done: 0 },
              location: requirement.location,
              area,
              drawingScene: null,
              activities: [],
              requirementId: id,
              dueLabel: requirement.dueLabel,
              estimatedHours: requirement.estimatedHours,
              creatorId: get().currentUserId || "system"
            }

            return {
              requirements: [requirement, ...state.requirements],
              tasks: [newTask, ...state.tasks]
            }
          })

          const createdTask = get().tasks.find((task) => task.requirementId === id)
          if (createdTask) {
            get().addTaskLog(createdTask.id, "Tarea creada")
          }

          return id
        },
        updateRequirement: (requirementId, patch) => {
          set((state) => {
            const nextRequirements = state.requirements.map((requirement) =>
              requirement.id === requirementId
                ? ({ ...requirement, ...patch } as Requirement)
                : requirement
            )

            const nextTasks = state.tasks.map((task) =>
              task.requirementId === requirementId
                ? {
                    ...task,
                    title: patch.title ?? task.title,
                    description: patch.description ?? task.description,
                    priority: patch.priority ?? task.priority,
                    location: patch.location ?? task.location,
                    area: patch.area ?? task.area,
                    dueLabel: patch.dueLabel ?? task.dueLabel,
                    estimatedHours: patch.estimatedHours ?? task.estimatedHours,
                    updatedAt: new Date().toISOString()
                  }
                : task
            )

            return {
              requirements: nextRequirements,
              tasks: nextTasks
            }
          })
        },
        deleteRequirement: (requirementId) => {
          set((state) => ({
            requirements: state.requirements.filter((requirement) => requirement.id !== requirementId),
            assignments: state.assignments.filter(
              (assignment) => assignment.requirementId !== requirementId
            ),
            tasks: state.tasks.filter((task) => task.requirementId !== requirementId)
          }))
        },
        assignRequirement: (requirementId, userId, notes) => {
          const req = get().requirements.find((r) => r.id === requirementId)
          const user = get().users.find((u) => u.id === userId)
          if (!req || !user) return

          const now = new Date().toISOString()

          set((state) => {
            const requirement = state.requirements.find((item) => item.id === requirementId)
            if (!requirement) {
              return state
            }

            const existingAssignmentIndex = state.assignments.findIndex(
              (assignment) => assignment.requirementId === requirementId
            )

            const nextAssignment: AssignmentRecord = {
              id: existingAssignmentIndex >= 0 ? state.assignments[existingAssignmentIndex].id : makeId("assign"),
              requirementId,
              technicianId: userId,
              notes,
              createdAt: existingAssignmentIndex >= 0 ? state.assignments[existingAssignmentIndex].createdAt : now,
              status: "confirmed"
            }

            const nextRequirements = state.requirements.map((item) =>
              item.id === requirementId
                ? ({
                    ...item,
                    selectedTechnicianId: userId,
                    notes,
                    status: "assigned",
                    assignedAt: now,
                    area: item.area ?? DEFAULT_AREA
                  } satisfies Requirement)
                : item
            )

            const nextAssignments =
              existingAssignmentIndex >= 0
                ? state.assignments.map((assignment, index) =>
                    index === existingAssignmentIndex ? nextAssignment : assignment
                  )
                : [nextAssignment, ...state.assignments]

            // Check if a task already exists for this requirement
            const existingTask = state.tasks.find(t => t.requirementId === requirementId)
            let nextTasks = state.tasks
            
            if (!existingTask) {
              const taskId = makeId("task")
              const newTask: Task = {
                id: taskId,
                title: requirement.title,
                description: requirement.description,
                priority: requirement.priority,
                status: "todo",
                assigneeIds: [userId],
                createdAt: now,
                updatedAt: now,
                timerStartedAt: null,
                statusDurations: { todo: 0, inProgress: 0, review: 0, done: 0 },
                location: requirement.location,
                area: requirement.area ?? DEFAULT_AREA,
                drawingScene: null,
                activities: [],
                requirementId: requirement.id,
                creatorId: get().currentUserId || "system"
              }
              nextTasks = [newTask, ...state.tasks]
            } else {
              nextTasks = state.tasks.map(t => 
                t.requirementId === requirementId 
                  ? {
                      ...t,
                      area: requirement.area ?? t.area ?? DEFAULT_AREA,
                      assigneeIds: Array.from(new Set([...t.assigneeIds, userId])),
                      updatedAt: now
                    }
                  : t
              )
            }

            return {
              requirements: nextRequirements,
              assignments: nextAssignments,
              tasks: nextTasks
            }
          })

          // Trigger notification for new assignment
          if (req) {
             get().addNotification({
                title: "Nueva Asignación",
                message: `Se te ha asignado la tarea: ${req.title}`,
                type: "assignment",
                taskId: null,
                userId: get().currentUserId || "system",
                targetUserId: userId
              })
          }
        },
        addUser: (input) => {
          const id = makeId("user")
          const now = new Date().toISOString()
          const normalizedZones = normalizeZones(input.zones, input.zone)
          const primaryZone = normalizedZones[0] ?? input.zone ?? "General"
          const newUser: User = {
            id,
            ...input,
            role: normalizeUserRole(input.role) as UserRole,
            zone: primaryZone,
            zones: normalizedZones,
            createdAt: now
          }

          set((state) => ({
            users: [newUser, ...state.users]
          }))

          return id
        },
        deleteUser: (userId) => {
          set((state) => ({
            users: state.users.filter((u) => u.id !== userId),
            currentUserId: state.currentUserId === userId ? state.users.find((u) => u.id !== userId)?.id ?? null : state.currentUserId
          }))
        },
        updateUser: (userId, patch) => {
          set((state) => ({
            users: state.users.map((u) => {
              if (u.id !== userId) return u
              const nextRole = Object.prototype.hasOwnProperty.call(patch, "role")
                ? normalizeUserRole((patch as Partial<User>).role)
                : u.role
              const nextUser = { ...u, ...patch, role: nextRole }
              const normalizedZones = normalizeZones(nextUser.zones, nextUser.zone)
              const primaryZone = normalizedZones[0] ?? nextUser.zone ?? "General"
              return {
                ...nextUser,
                zone: primaryZone,
                zones: normalizedZones
              }
            })
          }))
        },
        createFolder: (input) => {
          const now = new Date().toISOString()
          const id = makeId("folder")
          set((state) => ({
            folders: [
              {
                id,
                name: input.name.trim() || "Nueva carpeta",
                parentId: input.parentId ?? null,
                createdAt: now,
                updatedAt: now
              },
              ...state.folders
            ]
          }))

          return id
        },
        renameFolder: (folderId, name) => {
          set((state) => ({
            folders: state.folders.map((folder) =>
              folder.id === folderId ? { ...folder, name: name.trim() || folder.name, updatedAt: new Date().toISOString() } : folder
            )
          }))
        },
        deleteFolder: (folderId) => {
          set((state) => {
            const idsToRemove = countDescendants(state.folders, folderId)
            return {
              folders: state.folders.filter((folder) => !idsToRemove.has(folder.id)),
              evidence: state.evidence.map((item) =>
                idsToRemove.has(item.folderId ?? "") ? { ...item, folderId: null } : item
              ),
              saves: state.saves.map((save) =>
                idsToRemove.has(save.folderId) ? { ...save, folderId: "", folderPath: save.folderPath } : save
              )
            }
          })
        },
        saveProgress: (input) => {
          const now = new Date()
          const dateLabel = formatDateStamp(now)
          const timeLabel = formatTimeStamp(now)

          let folderId = input.folderId ?? null
          let folderName = "Espacio de trabajo"
          let folderPath = "Espacio de trabajo"

          if (input.mode === "new") {
            const newName =
              input.folderName?.trim() ||
              `Guardado ${dateLabel.replaceAll("/", "-")} ${timeLabel.replaceAll(":", "-")}`
            const createdFolderId = get().createFolder({
              name: newName,
              parentId: input.parentId ?? null
            })
            folderId = createdFolderId
          }

          const folder = folderId ? get().folders.find((item) => item.id === folderId) ?? null : null

          if (folder) {
            folderName = folder.name
            folderPath = resolveFolderPath(get().folders, folder.id)
          } else if (input.mode === "new") {
            folderName =
              input.folderName?.trim() ||
              `Guardado ${dateLabel.replaceAll("/", "-")} ${timeLabel.replaceAll(":", "-")}`
            folderPath = folderName
          }

          const record: SaveRecord = {
            id: makeId("save"),
            mode: input.mode,
            folderId: folderId ?? "",
            folderName,
            folderPath,
            createdAt: now.toISOString(),
            dateLabel,
            timeLabel,
            counts: {
              tasks: get().tasks.length,
              requirements: get().requirements.length,
              assignments: get().assignments.length,
              evidence: get().evidence.length
            }
          }

          set((state) => ({
            saves: [record, ...state.saves]
          }))

          return record
        },
        setDrawingScene: (scene) => {
          set({
            drawingScene: {
              ...sanitizeDrawingScene(scene)!,
              updatedAt: new Date().toISOString()
            }
          })
        },
        addTaskActivity: (taskId, type, content, metadata) => {
          const { users, currentUserId } = get()
          const user = users.find(u => u.id === currentUserId)
          const now = new Date().toISOString()
          const activity: TaskActivity = {
            id: makeId("act"),
            type,
            content,
            createdAt: now,
            updatedAt: now,
            metadata: {
              authorName: user?.name || "Sistema",
              authorRole: user?.role || "sistema",
              ...metadata
            }
          }

          set((state) => ({
            tasks: state.tasks.map((task) =>
              task.id === taskId
                ? {
                    ...task,
                    activities: [activity, ...task.activities],
                    updatedAt: now
                  }
                : task
            )
          }))

          // Trigger notification for messages (notes) and evidence
          if (type === "note" || type === "image" || type === "video" || type === "audio" || type === "drawing") {
            const task = get().tasks.find(t => t.id === taskId)
            if (task) {
              const typeLabels: Record<string, string> = {
                note: "comentario",
                image: "imagen",
                video: "video",
                audio: "audio",
                drawing: "croquis"
              }
              const isNote = type === "note"
              const title = isNote ? "Nuevo Comentario" : "Nueva Evidencia"
              const message = isNote
                ? `Nueva nota en "${task.title}": ${String(content).slice(0, 50)}${String(content).length > 50 ? "..." : ""}`
                : `Se subió evidencia (${typeLabels[type] || type}) en "${task.title}"`

              get().addNotification({
                title,
                message,
                type: isNote ? "message" : "alert",
                taskId,
                userId: get().currentUserId || "system",
                targetUserId: null // Broadcast
              })
            }
          }
        },
        addTaskLog: (taskId, content, metadata) => {
          const user = get().users.find(u => u.id === get().currentUserId)
          const authorName = user?.name || "Sistema"
          const authorRole = user?.role || ""
          
          get().addTaskActivity(taskId, "log", content, {
            authorName,
            authorRole,
            ...metadata
          })
        },
        updateTaskActivity: (taskId, activityId, patch) => {
          const now = new Date().toISOString()
          set((state) => ({
            tasks: state.tasks.map((task) =>
              task.id === taskId
                ? {
                    ...task,
                    activities: task.activities.map((a) =>
                      a.id === activityId ? { ...a, ...patch, updatedAt: now } : a
                    ),
                    updatedAt: now
                  }
                : task
            )
          }))
        },
        removeTaskActivity: (taskId, activityId) => {
          set((state) => ({
            tasks: state.tasks.map((task) =>
              task.id === taskId
                ? {
                    ...task,
                    activities: task.activities.filter((a) => a.id !== activityId),
                    updatedAt: new Date().toISOString()
                  }
                : task
            )
          }))
        },
        setCurrentUser: (userId) => {
          set({ currentUserId: userId })
        },
        resetDemoData: () => {
          set({
            ...createEmptyState(),
            hasHydrated: true
          })
        }
      }
    },
    {
      name: "workflow-pro-storage",
      version: 9,
      storage: {
        getItem: async (name) => {
          try {
            console.log("Iniciando carga de datos desde Supabase...")
            const remoteState = await pullFromSupabase()
            if (!remoteState) {
              console.log("Base de datos de Supabase vacía. Iniciando vacía...")
              return { state: createEmptyState(), version: 9 }
            }
            console.log("Carga de Supabase exitosa.")
            const savedUserId = typeof window !== 'undefined' ? localStorage.getItem("flow_current_user_id") : null
            const finalState = {
              ...remoteState,
              currentUserId: savedUserId || remoteState.currentUserId
            }
            return { state: finalState as any, version: 9 }
          } catch (e) {
            console.error("Fallo al cargar desde Supabase, inicializando vacía", e)
            return { state: createEmptyState(), version: 9 }
          }
        },
        setItem: async (name, value: any) => {
          try {
            if (typeof window !== 'undefined' && value.state.currentUserId) {
              localStorage.setItem("flow_current_user_id", value.state.currentUserId)
            }
            // Limit task/evidence base64 to avoid performance issues (raised to 10MB of base64 chars for photos)
            const prunedState = {
              ...value.state,
              tasks: value.state.tasks.map((t: any) => ({
                ...t,
                activities: t.activities.map((a: any) => ({
                  ...a,
                  content: (typeof a.content === 'string' && a.content.length > 10000000) 
                    ? "" 
                    : a.content
                }))
              })),
              evidence: value.state.evidence.map((e: any) => ({
                ...e,
                base64: (e.base64 && e.base64.length > 10000000) ? "" : e.base64
              }))
            }
            debouncedPush(prunedState)
          } catch (e) {
            console.error("Error al procesar/sincronizar cambio a Supabase", e)
          }
        },
        removeItem: async (name) => {
          console.log("Removiendo estado")
        }
      },
      migrate: (persistedState, version) => {
        if (version && version < 9) {
          return {
            ...createSeedData(),
            hasHydrated: true
          }
        }
        return persistedState as any
      },
      onRehydrateStorage: () => (state, error) => {
        if (!error && state) {
          state.setHydrated(true)
        }
      }
    }
  )
)

export const workflowSelectors = {
  getTaskDuration(task: Task, now = Date.now()) {
    return accumulateTaskTime(task, now)
  },
  getTaskTotalDuration(task: Task, now = Date.now()) {
    const accumulated = Object.values(task.statusDurations || {}).reduce((a, b) => a + b, 0)
    const running = task.timerStartedAt === null ? 0 : Math.max(0, Math.floor((now - task.timerStartedAt) / 1000))
    return accumulated + running
  },
  getFolderPath(folders: Folder[], folderId: string | null) {
    if (!folderId) {
      return "Espacio de trabajo"
    }

    return resolveFolderPath(folders, folderId)
  },
  getFolderById(folders: Folder[], folderId: string | null) {
    return folderId ? folders.find((folder) => folder.id === folderId) ?? null : null
  },
  getAssignmentForRequirement(assignments: AssignmentRecord[], requirementId: string) {
    return assignments.find((assignment) => assignment.requirementId === requirementId) ?? null
  },
  getRequirementById(requirements: Requirement[], requirementId: string | null) {
    return requirementId ? requirements.find((requirement) => requirement.id === requirementId) ?? null : null
  },
  getTaskById(tasks: Task[], taskId: string | null) {
    return taskId ? tasks.find((task) => task.id === taskId) ?? null : null
  },
  getTechnicianById(users: User[], userId: string | null) {
    return userId ? users.find((u) => u.id === userId) ?? null : null
  },
  getTaskCountByStatus(tasks: Task[], status: TaskStatus) {
    return tasks.filter((task) => task.status === status).length
  },
  getCurrentUser(users: User[], currentUserId: string | null) {
    return currentUserId ? users.find(u => u.id === currentUserId) ?? null : null
  },
  getUserZones(user: User | null) {
    return resolveUserZones(user)
  },
  canManageTask(task: Task | null, user: User | null) {
    return canUserManageTask(user, task)
  },
  canClaimTask(task: Task | null, user: User | null, users: User[] = []) {
    return canUserClaimTask(user, task, users)
  },
  getTaskClaimState(task: Task | null, user: User | null, users: User[] = []) {
    return getTaskClaimState(user, task, users)
  },
  filterTasksByZone(tasks: Task[], user: User | null, users: User[] = []) {
    if (!user) return []
    if (isAdminRole(user.role) || user.showAllZones) return tasks

    // Si es empleado, ve lo asignado y lo disponible en sus areas
    if (isEmployeeRole(user.role)) {
      const userAreas = user.areas ?? []
      return tasks.filter((task) => {
        const taskArea = getTaskScopeArea(task)
        const canSeeTaskArea = userAreas.includes(taskArea) || isGlobalArea(taskArea)

        if (task.assigneeIds.includes(user.id)) return true
        if (task.creatorId === user.id) return true
        if (task.escalation?.targetUserId === user.id) return true

        if (!canSeeTaskArea) return false

        if (task.escalation) {
          return !hasTaskAssigneeInArea(task, users, taskArea)
        }

        if (task.assigneeIds.length > 0) return false
        if (isGlobalArea(taskArea)) return true
        if (userAreas.includes(taskArea)) return true
        return false
      })
    }

    // Si es gerente (sin visualización global activa)
    if (isManagerRole(user.role)) {
      const userAreas = user.areas ?? []
      const userZones = resolveUserZones(user)
      return tasks.filter((task) => {
        const taskArea = getTaskScopeArea(task)
        const canSeeTaskArea = userAreas.includes(taskArea) || isGlobalArea(taskArea)
        if (isGlobalArea(taskArea)) return true
        if (task.assigneeIds.includes(user.id)) return true
        if (task.creatorId === user.id) return true
        if (isInUserZones(task.location, userZones)) return true
        if (task.escalation?.targetUserId === user.id) return true

        if (!canSeeTaskArea && !isInUserZones(task.location, userZones)) return false

        if (task.escalation) {
          return !hasTaskAssigneeInArea(task, users, taskArea)
        }

        if ((!task.assigneeIds || task.assigneeIds.length === 0) && canSeeTaskArea) return true
        return false
      })
    }

    return tasks.filter((task) => task.location === user.zone)
  },
  filterRequirementsByZone(requirements: Requirement[], user: User | null) {
    if (!user) return []
    if (isAdminRole(user.role) || user.showAllZones) return requirements

    // Si es empleado, permitimos ver requerimientos de su zona y areas
    if (isEmployeeRole(user.role)) {
      const userAreas = user.areas ?? []
      const userZones = resolveUserZones(user)
      return requirements.filter((req) => {
        if (req.creatorId === user.id || req.selectedTechnicianId === user.id) return true
        const reqArea = req.area ?? DEFAULT_AREA
        if (isGlobalArea(reqArea)) return true
        if (!isInUserZones(req.location, userZones)) return false
        if (userAreas.length > 0 && !userAreas.includes(reqArea) && !isGlobalArea(reqArea)) return false
        return true
      })
    }

    // Gerentes ven requerimientos de su zona
    if (isManagerRole(user.role)) {
      const userZones = resolveUserZones(user)
      return requirements.filter((req) =>
        req.creatorId === user.id ||
        req.selectedTechnicianId === user.id ||
        isGlobalArea(req.area ?? DEFAULT_AREA) ||
        isInUserZones(req.location, userZones)
      )
    }

    return requirements.filter((req) => req.location === user.zone)
  }
}

export function createEvidencePreview(name: string, accent = "#172839") {
  return buildThumbnail(name, accent)
}
