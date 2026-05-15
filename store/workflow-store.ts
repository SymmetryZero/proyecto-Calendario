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
}

export interface Technician {
  id: string
  name: string
  code: string
  role: string
  skills: string[]
  clearances: string[]
  availability: TechnicianAvailability
  availabilityLabel: string
  avatar: string
}

export type TaskActivityType = "note" | "drawing" | "image" | "video" | "audio"

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
  accumulatedSeconds: number
  location?: string
  drawingScene?: DrawingScene | null
  activities: TaskActivity[]
  requirementId?: string | null
  dueLabel?: string
  estimatedHours?: number
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
  tasks: Task[]
  requirements: Requirement[]
  technicians: Technician[]
  users: User[]
  evidence: EvidenceFile[]
  folders: Folder[]
  assignments: AssignmentRecord[]
  saves: SaveRecord[]
  drawingScene: DrawingScene | null
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
  assignRequirement: (requirementId: string, technicianId: string, notes: string) => void
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
  resetDemoData: () => void
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

  const technicians: Technician[] = [
    {
      id: "tech-1",
      name: "Sarah Jenkins",
      code: "T-402",
      role: "Líder HVAC",
      skills: ["HVAC", "Calibración", "Diagnóstico"],
      clearances: ["Clase 3"],
      availability: "available",
      availabilityLabel: "Disponible ahora",
      avatar: createAvatarDataUri("Sarah Jenkins", "#172839", "#f7faf9")
    },
    {
      id: "tech-2",
      name: "Marcus Chen",
      code: "T-319",
      role: "Técnico general",
      skills: ["Estructural", "Escaneo", "Inspecciones"],
      clearances: ["Clase 2"],
      availability: "soon",
      availabilityLabel: "Disponible en 1 h",
      avatar: createAvatarDataUri("Marcus Chen", "#865300", "#fff8ef")
    },
    {
      id: "tech-3",
      name: "Nina Patel",
      code: "T-221",
      role: "Inspectora de seguridad",
      skills: ["Seguridad", "Auditoría", "Cumplimiento"],
      clearances: ["Clase 2"],
      availability: "available",
      availabilityLabel: "Disponible ahora",
      avatar: createAvatarDataUri("Nina Patel", "#004064", "#cce5ff")
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
      selectedTechnicianId: "tech-1",
      notes: "Urgente antes de temporada de lluvias",
      createdAt: threeHoursAgo,
      assignedAt: twoHoursAgo
    },
    {
      id: req2Id,
      code: "REQ-002",
      title: "Instalación de Luminarias LED - Almacén",
      description: "Sustitución de 20 campanas industriales por LED.",
      priority: "medium",
      status: "assigned",
      location: "Zona Sur",
      selectedTechnicianId: "tech-2",
      notes: "Requiere plataforma elevadora",
      createdAt: dayAgo,
      assignedAt: hourAgo
    },
    {
      id: req3Id,
      code: "REQ-003",
      title: "Reparación Falla Eléctrica Oficina 302",
      description: "Cortocircuito en tomas de corriente reguladas.",
      priority: "high",
      status: "assigned",
      location: "Centro",
      selectedTechnicianId: "tech-1",
      notes: "Personal sin luz en área contable",
      createdAt: hourAgo,
      assignedAt: hourAgo
    },
    {
      id: req4Id,
      code: "REQ-004",
      title: "Limpieza de Tableros de Control",
      description: "Remover polvo y reapriete de terminales.",
      priority: "low",
      status: "assigned",
      location: "Zona Norte",
      selectedTechnicianId: "tech-3",
      notes: "Ruta de rutina",
      createdAt: dayAgo,
      assignedAt: dayAgo
    },
    {
      id: req5Id,
      code: "REQ-005",
      title: "Auditoría de Seguridad Eléctrica",
      description: "Verificación de tierras físicas en planta.",
      priority: "medium",
      status: "assigned",
      location: "Zona Sur",
      selectedTechnicianId: "tech-2",
      notes: "Preparación para certificación ISO",
      createdAt: twoHoursAgo,
      assignedAt: hourAgo
    }
  ]

  const tasks: Task[] = [
    {
      id: makeId("task"),
      title: requirements[0].title,
      description: requirements[0].description,
      priority: "high",
      status: "inProgress",
      assigneeIds: ["tech-1"],
      createdAt: threeHoursAgo,
      updatedAt: hourAgo,
      timerStartedAt: Date.now() - 7200000,
      accumulatedSeconds: 7200,
      estimatedHours: 4,
      location: "Zona Norte",
      drawingScene: null,
      activities: [],
      requirementId: req1Id
    },
    {
      id: makeId("task"),
      title: requirements[1].title,
      description: requirements[1].description,
      priority: "medium",
      status: "done",
      assigneeIds: ["tech-2"],
      createdAt: dayAgo,
      updatedAt: hourAgo,
      timerStartedAt: null,
      accumulatedSeconds: 10800,
      estimatedHours: 6,
      location: "Zona Sur",
      drawingScene: null,
      activities: [],
      requirementId: req2Id
    },
    {
      id: makeId("task"),
      title: requirements[2].title,
      description: requirements[2].description,
      priority: "high",
      status: "todo",
      assigneeIds: ["tech-1"],
      createdAt: hourAgo,
      updatedAt: hourAgo,
      timerStartedAt: Date.now(),
      accumulatedSeconds: 0,
      estimatedHours: 2,
      location: "Centro",
      drawingScene: null,
      activities: [],
      requirementId: req3Id
    },
    {
      id: makeId("task"),
      title: requirements[3].title,
      description: requirements[3].description,
      priority: "low",
      status: "review",
      assigneeIds: ["tech-3"],
      createdAt: dayAgo,
      updatedAt: twoHoursAgo,
      timerStartedAt: null,
      accumulatedSeconds: 18000,
      estimatedHours: 4,
      location: "Zona Norte",
      drawingScene: null,
      activities: [],
      requirementId: req4Id
    },
    {
      id: makeId("task"),
      title: requirements[4].title,
      description: requirements[4].description,
      priority: "medium",
      status: "inProgress",
      assigneeIds: ["tech-2"],
      createdAt: twoHoursAgo,
      updatedAt: hourAgo,
      timerStartedAt: Date.now() - 3600000,
      accumulatedSeconds: 3600,
      estimatedHours: 3,
      location: "Zona Sur",
      drawingScene: null,
      activities: [],
      requirementId: req5Id
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
    tasks,
    requirements,
    technicians,
    users: [
      {
        id: "user-1",
        name: "Admin User",
        avatar: createAvatarDataUri("Admin User", "#172839", "#ffffff"),
        birthDate: "1985-05-15",
        position: "Administrador de Sistemas",
        zone: "Oficina Central",
        role: "administrador",
        createdAt: hourAgo
      },
      {
        id: "user-2",
        name: "Marta Gerente",
        avatar: createAvatarDataUri("Marta Gerente", "#865300", "#ffffff"),
        birthDate: "1990-10-20",
        position: "Gerente de Operaciones",
        zone: "Zona Norte",
        role: "gerente",
        createdAt: hourAgo
      },
      {
        id: "user-3",
        name: "Juan Empleado",
        avatar: createAvatarDataUri("Juan Empleado", "#004064", "#ffffff"),
        birthDate: "1995-03-12",
        position: "Técnico de Campo",
        zone: "Zona Sur",
        role: "empleado",
        createdAt: hourAgo
      }
    ],
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
    drawingScene: null
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
  return {
    ...state,
    technicians: patchItems(state.technicians, {
      "tech-sarah": {
        role: "Líder HVAC",
        skills: ["HVAC", "Calibración", "Diagnóstico"],
        clearances: ["Clase 3"],
        availabilityLabel: "Disponible ahora"
      },
      "tech-marcus": {
        role: "Técnico general",
        skills: ["Estructural", "Escaneo", "Inspecciones"],
        clearances: ["Clase 2"],
        availabilityLabel: "Disponible en 1 h"
      },
      "tech-david": {
        role: "Especialista HVAC",
        skills: ["HVAC", "Balance de carga", "Controles"],
        clearances: ["Clase 3"],
        availabilityLabel: "Fuera de turno"
      },
      "tech-nina": {
        role: "Inspectora de seguridad",
        skills: ["Seguridad", "Auditoría", "Cumplimiento"],
        clearances: ["Clase 2"],
        availabilityLabel: "Disponible ahora"
      }
    }),
    tasks: patchItems(state.tasks, {
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
  const runningSeconds =
    task.timerStartedAt === null ? 0 : Math.max(0, Math.floor((now - task.timerStartedAt) / 1000))

  return task.accumulatedSeconds + runningSeconds
}

export const useWorkflowStore = create<WorkflowStore>()(
  persist(
    (set, get) => {
      const initial = createSeedData()

      return {
        ...initial,
        hasHydrated: false,
        setHydrated: (value) => {
          set({ hasHydrated: value })
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
            timerStartedAt: Date.now(),
            accumulatedSeconds: 0,
            location: input.location,
            dueLabel: input.dueLabel,
            drawingScene: null,
            activities: input.activities ?? [],
            requirementId
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
          set((state) => {
            const nextTasks = state.tasks.map((task) =>
              task.id === taskId ? { ...task, ...patch, updatedAt: new Date().toISOString() } : task
            )
            
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

          set((state) => ({
            tasks: state.tasks.map((task) => {
              if (task.id !== taskId) {
                return task
              }

              const currentlyRunning = task.timerStartedAt !== null
              const totalSeconds = accumulateTaskTime(task, now)

              return {
                ...task,
                status,
                timerStartedAt: status === "done" ? null : (task.timerStartedAt ?? now),
                accumulatedSeconds: status === "done" ? totalSeconds : task.accumulatedSeconds,
                updatedAt: new Date(now).toISOString()
              }
            })
          }))
        },
        startTaskTimer: (taskId) => {
          const now = Date.now()
          set((state) => ({
            tasks: state.tasks.map((task) =>
              task.id === taskId && task.timerStartedAt === null
                ? {
                    ...task,
                    status: "inProgress",
                    timerStartedAt: now,
                    updatedAt: new Date(now).toISOString()
                  }
                : task
            )
          }))
        },
        pauseTaskTimer: (taskId) => {
          const now = Date.now()
          set((state) => ({
            tasks: state.tasks.map((task) => {
              if (task.id !== taskId || task.timerStartedAt === null) {
                return task
              }

              return {
                ...task,
                accumulatedSeconds: accumulateTaskTime(task, now),
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
            assignedAt: null
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
              estimatedHours: requirement.estimatedHours
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
        assignRequirement: (requirementId, technicianId, notes) => {
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
              technicianId,
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
                assigneeIds: [technicianId],
                createdAt: now,
                updatedAt: now,
                timerStartedAt: null,
                accumulatedSeconds: 0,
                location: requirement.location,
                drawingScene: null,
                activities: [],
                requirementId: requirement.id
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
          const now = new Date().toISOString()
          const activity: TaskActivity = {
            id: makeId("act"),
            type,
            content,
            createdAt: now,
            updatedAt: now,
            metadata
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
        technicians: state.technicians,
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
  getTechnicianById(technicians: Technician[], technicianId: string | null) {
    return technicianId ? technicians.find((tech) => tech.id === technicianId) ?? null : null
  },
  getTaskCountByStatus(tasks: Task[], status: TaskStatus) {
    return tasks.filter((task) => task.status === status).length
  }
}

export function createEvidencePreview(name: string, accent = "#172839") {
  return buildThumbnail(name, accent)
}
