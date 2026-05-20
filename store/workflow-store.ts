"use client"

import { create } from "zustand"
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware"
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
  taskId?: string
  userId?: string // Who triggered it
  targetUserId?: string // Who it's for (null for everyone/admin)
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
export type EvidenceType = "image" | "video" | "audio"
export type FolderMode = "existing" | "new"
export type TechnicianAvailability = "available" | "soon" | "offline"
export type UserRole = "administrador" | "gerente" | "empleado"

export interface User {
  id: string
  name: string
  avatar: string
  birthDate: string
  position: string
  zone: string
  role: UserRole
  createdAt: string
  showAllZones?: boolean
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
  drawingScene?: DrawingScene | null
  activities: TaskActivity[]
  requirementId?: string | null
  dueLabel?: string
  estimatedHours?: number
  creatorId: string
}

export interface Requirement {
  id: string
  code: string
  title: string
  description: string
  location: string
  dueLabel: string
  priority: Priority
  status: RequirementStatus
  requiredSkills: string[]
  requiredClearances: string[]
  estimatedHours: number
  selectedTechnicianId: string | null
  notes: string
  assignedAt: string | null
  creatorId: string
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
  dueLabel: string
  priority: Priority
  requiredSkills: string[]
  requiredClearances: string[]
  estimatedHours: number
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
}

export interface WorkflowStore extends WorkflowSeed {
  hasHydrated: boolean
  setHydrated: (value: boolean) => void
  addTask: (input: CreateTaskInput) => string
  updateTask: (taskId: string, patch: Partial<Task>) => void
  deleteTask: (taskId: string) => void
  moveTask: (taskId: string, status: TaskStatus) => void
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
      <text x="80" y="282" fill="#f7faf9" font-family="Inter, Arial, sans-serif" font-size="16" opacity=".8">Vista previa de evidencias de Workflow Pro</text>
    </svg>
  `)
}

function createSeedData(): WorkflowSeed {
  const now = Date.now()
  const createdAt = new Date(now).toISOString()
  const hourAgo = new Date(now - 60 * 60 * 1000).toISOString()
  const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000).toISOString()
  const threeHoursAgo = new Date(now - 3 * 60 * 60 * 1000).toISOString()
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString()

  const users: User[] = [
    {
      id: "user-1",
      name: "Admin User",
      avatar: createAvatarDataUri("Admin User", "#172839", "#ffffff"),
      birthDate: "1985-05-15",
      position: "Administrador de Sistemas",
      zone: "Oficina Central",
      role: "administrador",
      createdAt: hourAgo,
      showAllZones: true,
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
      role: "gerente",
      createdAt: hourAgo,
      showAllZones: false,
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
      role: "empleado",
      createdAt: hourAgo,
      showAllZones: false,
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
      role: "empleado",
      createdAt: hourAgo,
      showAllZones: false,
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
      role: "empleado",
      createdAt: hourAgo,
      showAllZones: false,
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
      role: "empleado",
      createdAt: hourAgo,
      showAllZones: false,
      skills: ["Auditoría", "Seguridad Industrial", "Normativa ISO"],
      clearances: ["Clase 2"],
      availability: "available",
      availabilityLabel: "Disponible",
      code: "TECH-004"
    },
    {
      id: "user-7",
      name: "Alex Thompson",
      avatar: createAvatarDataUri("Alex Thompson", "#004064", "#ffffff"),
      birthDate: "1991-09-15",
      position: "Especialista en Bombas",
      zone: "Zona Sur",
      role: "empleado",
      createdAt: hourAgo,
      showAllZones: false,
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
      role: "empleado",
      createdAt: hourAgo,
      showAllZones: false,
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
      zone: "Centro",
      role: "empleado",
      createdAt: hourAgo,
      showAllZones: false,
      skills: ["HVAC", "Balance de Carga", "Controles"],
      clearances: ["Clase 3"],
      availability: "available",
      availabilityLabel: "Disponible",
      code: "TECH-007"
    }
  ]

  const req1Id = makeId("req")
  const req2Id = makeId("req")
  const req3Id = makeId("req")
  const req4Id = makeId("req")
  const req5Id = makeId("req")

  const requirements: Requirement[] = [
    {
      id: req1Id,
      code: "REQ-001",
      title: "Mantenimiento Preventivo Transformador T-45",
      description: "Revisión anual y cambio de aceite dieléctrico.",
      priority: "high",
      status: "assigned",
      location: "Zona Norte",
      selectedTechnicianId: "user-4",
      notes: "Urgente antes de temporada de lluvias",
      createdAt: threeHoursAgo,
      assignedAt: twoHoursAgo,
      creatorId: "user-2"
    },
    {
      id: req2Id,
      code: "REQ-002",
      title: "Instalación de Luminarias LED - Almacén",
      description: "Sustitución de 20 campanas industriales por LED.",
      priority: "medium",
      status: "assigned",
      location: "Zona Sur",
      selectedTechnicianId: "user-5",
      notes: "Requiere plataforma elevadora",
      createdAt: dayAgo,
      assignedAt: hourAgo,
      creatorId: "user-2"
    },
    {
      id: req3Id,
      code: "REQ-003",
      title: "Reparación Falla Eléctrica Oficina 302",
      description: "Cortocircuito en tomas de corriente reguladas.",
      priority: "high",
      status: "assigned",
      location: "Centro",
      selectedTechnicianId: "user-4",
      notes: "Personal sin luz en área contable",
      createdAt: hourAgo,
      assignedAt: hourAgo,
      creatorId: "user-2"
    },
    {
      id: req4Id,
      code: "REQ-004",
      title: "Limpieza de Tableros de Control",
      description: "Remover polvo y reapriete de terminales.",
      priority: "low",
      status: "assigned",
      location: "Zona Norte",
      selectedTechnicianId: "user-3",
      notes: "Ruta de rutina",
      createdAt: dayAgo,
      assignedAt: dayAgo,
      creatorId: "user-2"
    },
    {
      id: req5Id,
      code: "REQ-005",
      title: "Auditoría de Seguridad Eléctrica",
      description: "Verificación de tierras físicas en planta.",
      priority: "medium",
      status: "assigned",
      location: "Zona Sur",
      selectedTechnicianId: "user-5",
      notes: "Preparación para certificación ISO",
      createdAt: twoHoursAgo,
      assignedAt: hourAgo,
      creatorId: "user-2"
    }
  ]

  const tasks: Task[] = [
    {
      id: makeId("task"),
      title: requirements[0].title,
      description: requirements[0].description,
      priority: "high",
      status: "inProgress",
      assigneeIds: ["user-4"],
      createdAt: threeHoursAgo,
      updatedAt: hourAgo,
      timerStartedAt: Date.now() - 7200000,
      statusDurations: { todo: 0, inProgress: 7200, review: 0, done: 0 },
      estimatedHours: 4,
      location: "Zona Norte",
      drawingScene: null,
      activities: [],
      requirementId: req1Id,
      creatorId: "user-1"
    },
    {
      id: makeId("task"),
      title: requirements[1].title,
      description: requirements[1].description,
      priority: "medium",
      status: "done",
      assigneeIds: ["user-5"],
      createdAt: dayAgo,
      updatedAt: hourAgo,
      timerStartedAt: null,
      statusDurations: { todo: 0, inProgress: 10800, review: 0, done: 0 },
      estimatedHours: 6,
      location: "Zona Sur",
      drawingScene: null,
      activities: [],
      requirementId: req2Id,
      creatorId: "user-2"
    },
    {
      id: makeId("task"),
      title: requirements[2].title,
      description: requirements[2].description,
      priority: "high",
      status: "todo",
      assigneeIds: ["user-4"],
      createdAt: hourAgo,
      updatedAt: hourAgo,
      timerStartedAt: Date.now(),
      statusDurations: { todo: 0, inProgress: 0, review: 0, done: 0 },
      estimatedHours: 2,
      location: "Centro",
      drawingScene: null,
      activities: [],
      requirementId: req3Id,
      creatorId: "user-1"
    },
    {
      id: makeId("task"),
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
      drawingScene: null,
      activities: [],
      requirementId: req4Id,
      creatorId: "user-2"
    },
    {
      id: makeId("task"),
      title: requirements[4].title,
      description: requirements[4].description,
      priority: "medium",
      status: "inProgress",
      assigneeIds: ["user-5"],
      createdAt: twoHoursAgo,
      updatedAt: hourAgo,
      timerStartedAt: Date.now() - 3600000,
      statusDurations: { todo: 0, inProgress: 3600, review: 0, done: 0 },
      estimatedHours: 3,
      location: "Zona Sur",
      drawingScene: null,
      activities: [],
      requirementId: req5Id,
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
    }
  ]

  const evidence: EvidenceFile[] = [
    {
      id: makeId("ev"),
      name: "transformador_antes.jpg",
      mediaType: "image",
      mimeType: "image/jpeg",
      folderId: "folder-2",
      createdAt: threeHoursAgo,
      previewBase64: buildThumbnail("Evidencia T-45", "#172839"),
      base64: "",
      caption: "Estado inicial del transformador",
      flagged: false,
      linkedTaskId: null,
      size: 1024 * 500
    },
    {
      id: makeId("ev"),
      name: "lectura_multimetro.png",
      mediaType: "image",
      mimeType: "image/png",
      folderId: "folder-2",
      createdAt: hourAgo,
      previewBase64: buildThumbnail("Voltaje 220V", "#004064"),
      base64: "",
      caption: "Lectura de voltaje fase 1",
      flagged: false,
      linkedTaskId: null,
      size: 1024 * 300
    }
  ]

  return {
    users,
    tasks,
    requirements,
    evidence,
    folders,
    assignments: tasks.map(t => ({
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
        timeLabel: formatTimeStamp(new Date(dayAgo)),
        counts: { tasks: 5, requirements: 5, assignments: 5, evidence: 2 }
      }
    ],
    drawingScene: null,
    currentUserId: "user-1" 
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
  const nextTasks = (state.tasks || []).map(t => ({
    ...t,
    statusDurations: t.statusDurations || { todo: 0, inProgress: t.accumulatedSeconds || 0, review: 0, done: 0 }
  }))

  return {
    ...state,
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
    requirements: patchItems(state.requirements, {
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

export const useWorkflowStore = create<WorkflowStore>()(
  persist(
    (set, get) => {
      const initial = createSeedData()

      return {
        ...initial,
        notifications: [],
        globalAlert: null,
        hasHydrated: false,
        setHydrated: (value) => {
          set({ hasHydrated: value })
        },
        addNotification: (notification) => {
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
        markNotificationAsRead: (notificationId) => {
          set((state) => ({
            notifications: state.notifications.map((n) =>
              n.id === notificationId ? { ...n, read: true } : n
            )
          }))
        },
        setGlobalAlert: (alert) => {
          set({ globalAlert: alert })
        },
        addTask: (input) => {
          const taskId = makeId("task")
          const requirementId = makeId("req")
          const now = new Date().toISOString()
          const status = input.status ?? "todo"
          const assigneeIds = input.assigneeIds ?? []
          
          const reqCode = `REQ-${Math.floor(1000 + Math.random() * 9000)}`
          
          const newRequirement: Requirement = {
            id: requirementId,
            code: reqCode,
            title: input.title,
            description: input.description,
            location: input.location ?? "",
            dueLabel: input.dueLabel ?? "",
            priority: input.priority,
            status: assigneeIds.length > 0 ? "assigned" : "unassigned",
            requiredSkills: [],
            requiredClearances: [],
            estimatedHours: input.estimatedHours ?? 1,
            selectedTechnicianId: assigneeIds[0] ?? null,
            notes: "",
            assignedAt: assigneeIds.length > 0 ? now : null
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
            location: input.location,
            dueLabel: input.dueLabel,
            drawingScene: null,
            activities: input.activities ?? [],
            requirementId,
            creatorId: get().currentUserId || "system"
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

          return taskId
        },
        updateTask: (taskId, patch) => {
          const previousTask = get().tasks.find(t => t.id === taskId)

          set((state) => {
            const nextTasks = state.tasks.map((t) => {
              if (t.id !== taskId) return t
              
              const currentUser = state.users.find(u => u.id === state.currentUserId)
              if (currentUser?.role === "empleado") {
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
                
                if (patch.status === "done") {
                  nextTimerStart = null
                } else if (t.timerStartedAt !== null) {
                  nextTimerStart = now
                }
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
                      dueLabel: patch.dueLabel ?? req.dueLabel
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

            if (logs.length > 0) {
              logs.forEach((msg) => get().addTaskLog(taskId, msg))
            }
          }
        },
        deleteTask: (taskId) => {
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
            
            if (!task || !currentUser) return state

            if (currentUser.role === "empleado") {
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
                  timerStartedAt: status === "done" ? null : (t.timerStartedAt !== null ? now : null),
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
          const requirement: Requirement = {
            id,
            code: input.code,
            title: input.title,
            description: input.description,
            location: input.location,
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
              accumulatedSeconds: 0,
              location: requirement.location,
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
                    selectedTechnicianId: technicianId,
                    notes,
                    status: "assigned",
                    assignedAt: now
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
                drawingScene: null,
                activities: [],
                requirementId: requirement.id,
                creatorId: get().currentUserId || "system"
              }
              nextTasks = [newTask, ...state.tasks]
            } else {
              nextTasks = state.tasks.map(t => 
                t.requirementId === requirementId 
                  ? { ...t, assigneeIds: Array.from(new Set([...t.assigneeIds, technicianId])), updatedAt: now }
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
          const newUser: User = {
            id,
            ...input,
            createdAt: now
          }

          set((state) => ({
            users: [newUser, ...state.users]
          }))

          return id
        },
        deleteUser: (userId) => {
          set((state) => ({
            users: state.users.filter((u) => u.id !== userId)
          }))
        },
        updateUser: (userId, patch) => {
          set((state) => ({
            users: state.users.map((u) => (u.id === userId ? { ...u, ...patch } : u))
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

          // Trigger notification for messages (notes)
          if (type === "note") {
            const task = get().tasks.find(t => t.id === taskId)
            if (task) {
              get().addNotification({
                title: "Nuevo Mensaje",
                message: `Nueva nota en "${task.title}": ${String(content).slice(0, 50)}${String(content).length > 50 ? "..." : ""}`,
                type: "message",
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
            ...createSeedData(),
            hasHydrated: true
          })
        }
      }
    },
    {
      name: "workflow-pro-storage",
      version: 8,
      storage: createJSONStorage(() => ({
        getItem: (name) => localStorage.getItem(name),
        setItem: (name, value) => {
          try {
            localStorage.setItem(name, value)
          } catch (e) {
            console.error("Storage quota exceeded, state not saved to localStorage", e)
          }
        },
        removeItem: (name) => localStorage.removeItem(name)
      })),
      partialize: (state) => ({
        // Limit persistent tasks to prevent quota issues
        tasks: state.tasks.map(t => ({
          ...t,
          // Prune large activity content in persistence
          activities: t.activities.map(a => ({
            ...a,
            content: (typeof a.content === 'string' && a.content.length > 50000) 
              ? "" // Don't persist large base64 in activities
              : a.content
          }))
        })),
        requirements: state.requirements,
        users: state.users,
        // Prune large base64 in evidence
        evidence: state.evidence.map(e => ({
          ...e,
          base64: (e.base64 && e.base64.length > 50000) ? "" : e.base64
        })),
        folders: state.folders,
        assignments: state.assignments,
        saves: state.saves,
        drawingScene: state.drawingScene,
        users: state.users
      }),
      migrate: (persistedState, version) => {
        if (version && version < 8) {
          return {
            ...createSeedData(),
            hasHydrated: true
          }
        }
        return translateLegacyWorkflowState(persistedState as Partial<WorkflowStore>)
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
  filterTasksByZone(tasks: Task[], user: User | null) {
    if (!user) return []
    if (user.role === "administrador" || user.showAllZones) return tasks
    
    // Si es empleado, solo ve sus tareas asignadas
    if (user.role === "empleado") {
      return tasks.filter((t) => t.assigneeIds.includes(user.id))
    }

    // Si es gerente (sin visualización global activa)
    if (user.role === "gerente") {
      return tasks.filter((t) => t.location === user.zone || t.creatorId === user.id)
    }

    return tasks.filter((task) => task.location === user.zone)
  },
  filterRequirementsByZone(requirements: Requirement[], user: User | null) {
    if (!user) return []
    if (user.role === "administrador" || user.showAllZones) return requirements

    // Empleados normalmente no ven Programación, pero por seguridad filtramos
    if (user.role === "empleado") {
      return [] // No deberían ver requerimientos sin asignar
    }

    // Gerentes ven requerimientos de su zona o creados por ellos
    if (user.role === "gerente") {
      return requirements.filter((req) => req.location === user.zone || req.creatorId === user.id)
    }

    return requirements.filter((req) => req.location === user.zone)
  }
}

export function createEvidencePreview(name: string, accent = "#172839") {
  return buildThumbnail(name, accent)
}
