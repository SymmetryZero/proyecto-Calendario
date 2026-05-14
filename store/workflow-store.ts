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

export type SectionKey = "dashboard" | "assignments" | "drawing" | "evidence" | "settings"
export type TaskStatus = "todo" | "inProgress" | "review" | "done"
export type Priority = "high" | "medium" | "low"
export type RequirementStatus = "unassigned" | "assigned"
export type EvidenceType = "image" | "video"
export type FolderMode = "existing" | "new"
export type TechnicianAvailability = "available" | "soon" | "offline"

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

export type TaskActivityType = "note" | "drawing" | "image" | "video"

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
  updateTask: (taskId: string, patch: Partial<Omit<Task, "id" | "createdAt">>) => void
  deleteTask: (taskId: string) => void
  moveTask: (taskId: string, status: TaskStatus) => void
  startTaskTimer: (taskId: string) => void
  pauseTaskTimer: (taskId: string) => void
  addEvidence: (input: CreateEvidenceInput) => string
  updateEvidence: (evidenceId: string, patch: Partial<Omit<EvidenceFile, "id" | "createdAt">>) => void
  deleteEvidence: (evidenceId: string) => void
  toggleEvidenceFlag: (evidenceId: string) => void
  addRequirement: (input: CreateRequirementInput) => string
  updateRequirement: (requirementId: string, patch: Partial<Omit<Requirement, "id" | "code">>) => void
  deleteRequirement: (requirementId: string) => void
  assignRequirement: (requirementId: string, technicianId: string, notes: string) => void
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
  const fourMinutesFifteen = now - 4 * 60 * 1000 - 15 * 1000
  const oneMinuteThirty = now - 90 * 1000

  const technicians: Technician[] = [
    {
      id: "tech-sarah",
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
      id: "tech-marcus",
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
      id: "tech-david",
      name: "David Lopez",
      code: "T-184",
      role: "Especialista HVAC",
      skills: ["HVAC", "Balance de carga", "Controles"],
      clearances: ["Clase 3"],
      availability: "offline",
      availabilityLabel: "Fuera de turno",
      avatar: createAvatarDataUri("David Lopez", "#4f6073", "#eef1f0")
    },
    {
      id: "tech-nina",
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

  const tasks: Task[] = [
    {
      id: "task-foundation",
      title: "Inspeccionar el vaciado de cimentación - Sector C",
      description:
        "Verifica la profundidad del colado de concreto y la posición del refuerzo antes de que cierre la ventana de curado de la losa.",
      priority: "high",
      status: "todo",
      assigneeIds: ["tech-sarah"],
      createdAt,
      updatedAt: createdAt,
      timerStartedAt: null,
      accumulatedSeconds: 0,
      location: "Sector C",
      activities: [
        {
          id: "act-1",
          type: "note",
          content: "Cimentación verificada. El concreto tiene la consistencia adecuada. Se procedió al colado del sector norte.",
          createdAt: new Date(Date.now() - 3600000).toISOString()
        },
        {
          id: "act-2",
          type: "image",
          content: "https://lh3.googleusercontent.com/aida-public/AB6AXuCxjUQtvfI1ulfZw4h_MmMzvk2YQdzFQLDATTd_pNCV-E5jzKmjqfMe1kOfkxh50qSO2WKES-Zl2tb3AK3D2KVmGeajHHL_I_zH-ypL2R-gqr7zZl16JFN-KJR1AXwlmq1ZiI5JFQUNbfMecaxzjGy_r8R4GN8S-LaGZLAUYRhCPgkMcyqaT5FBNwjZ-ejc1RXgo0mNJLsptHWhUhoSBcrjnIyWk16wor2fhiIbzjR8r0u-d5ox2QV3I8hpcEccxvlDCsZMfu3_sX7i",
          createdAt: new Date(Date.now() - 3000000).toISOString(),
          metadata: { fileName: "CIM_INSPECTION_01.jpg" }
        }
      ],
      requirementId: "req-8493"
    },
    {
      id: "task-hvac-routing",
      title: "Verificar los planos de ductos HVAC",
      description:
        "Contrasta los planos de recorrido y documenta cualquier interferencia con la estructura de acero.",
      priority: "medium",
      status: "inProgress",
      assigneeIds: ["tech-david"],
      createdAt: hourAgo,
      updatedAt: hourAgo,
      timerStartedAt: null,
      accumulatedSeconds: 0,
      location: "Azotea",
      activities: [
        {
          id: "act-3",
          type: "note",
          content: "Se detectó una interferencia en el ducto principal con la viga de acero del eje 4. Se requiere ajuste de trazo.",
          createdAt: new Date(Date.now() - 1800000).toISOString()
        },
        {
          id: "act-4",
          type: "drawing",
          content: "",
          createdAt: new Date(Date.now() - 900000).toISOString()
        },
        {
          id: "act-5",
          type: "video",
          content: "",
          createdAt: new Date(Date.now() - 500000).toISOString(),
          metadata: { fileName: "HVAC_ROUTING_TEST.mp4" }
        }
      ],
      requirementId: "req-8492"
    },
    {
      id: "task-pump-room",
      title: "Revisión de fugas en la sala de bombas",
      description:
        "Inspecciona la sala de bombas para detectar microfugas y verificar las lecturas de presión.",
      priority: "medium",
      status: "todo",
      assigneeIds: ["tech-marcus"],
      createdAt: twoHoursAgo,
      updatedAt: twoHoursAgo,
      timerStartedAt: null,
      accumulatedSeconds: 0,
      location: "B2"
    },
    {
      id: "task-structural-load",
      title: "Resolver discrepancia de carga estructural",
      description:
        "Revisa la tabla de cargas frente a las mediciones de campo y corrige la diferencia.",
      priority: "high",
      status: "inProgress",
      assigneeIds: ["tech-marcus"],
      createdAt: hourAgo,
      updatedAt: createdAt,
      timerStartedAt: fourMinutesFifteen,
      accumulatedSeconds: 0,
      location: "Marco A"
    },
    {
      id: "task-inventory",
      title: "Actualizar el registro de inventario de materiales",
      description:
        "Pon al día el tablero de inventario del sitio con el manifiesto de entregas.",
      priority: "low",
      status: "inProgress",
      assigneeIds: ["tech-nina"],
      createdAt: twoHoursAgo,
      updatedAt: createdAt,
      timerStartedAt: oneMinuteThirty,
      accumulatedSeconds: 0,
      location: "Almacén"
    },
    {
      id: "task-safety-audit",
      title: "Auditoría de cumplimiento de seguridad - Zona 2",
      description:
        "Valida la señalización, los registros de incidentes y la ubicación de dispositivos en todo el perímetro.",
      priority: "medium",
      status: "review",
      assigneeIds: ["tech-nina"],
      createdAt: hourAgo,
      updatedAt: createdAt,
      timerStartedAt: null,
      accumulatedSeconds: 405,
      location: "Zona 2"
    },
    {
      id: "task-generator",
      title: "Prueba del generador de emergencia",
      description:
        "Ejecuta el generador con carga y confirma el voltaje estable después de la conmutación.",
      priority: "high",
      status: "done",
      assigneeIds: ["tech-sarah"],
      createdAt: twoHoursAgo,
      updatedAt: createdAt,
      timerStartedAt: null,
      accumulatedSeconds: 130,
      location: "Sala eléctrica"
    },
    {
      id: "task-lift-calibration",
      title: "Revisión de calibración del elevador",
      description:
        "Revisa la calibración del corte de seguridad y documenta el tiempo de respuesta del elevador.",
      priority: "medium",
      status: "done",
      assigneeIds: ["tech-marcus"],
      createdAt: twoHoursAgo,
      updatedAt: createdAt,
      timerStartedAt: null,
      accumulatedSeconds: 245,
      location: "Hueco del elevador"
    },
    {
      id: "task-vent-audit",
      title: "Auditoría de ventilación de radiología",
      description:
        "Inspecciona el flujo de extracción y los calendarios de limpieza del ala de radiología.",
      priority: "low",
      status: "done",
      assigneeIds: ["tech-nina"],
      createdAt: twoHoursAgo,
      updatedAt: createdAt,
      timerStartedAt: null,
      accumulatedSeconds: 470,
      location: "Ala de radiología"
    },
    {
      id: "task-permit-archive",
      title: "Sincronización del archivo de permisos",
      description:
        "Sincroniza los permisos firmados con el archivo y verifica que los metadatos estén completos.",
      priority: "low",
      status: "done",
      assigneeIds: ["tech-david"],
      createdAt: twoHoursAgo,
      updatedAt: createdAt,
      timerStartedAt: null,
      accumulatedSeconds: 52,
      location: "Archivo"
    }
  ]

  const requirements: Requirement[] = [
    {
      id: "req-8492",
      code: "REQ-8492",
      title: "Calibración del sistema HVAC",
      description:
        "Realiza la calibración trimestral de las unidades de enfriamiento de la sala principal de servidores y registra las variaciones termostáticas. Requiere autorización Clase 3 y equipo de diagnóstico especializado (Kit A-4).",
      location: "Sector 4G",
      dueLabel: "Hoy, 17:00 HRS",
      priority: "high",
      status: "assigned",
      requiredSkills: ["HVAC", "Calibración"],
      requiredClearances: ["Clase 3"],
      estimatedHours: 2.5,
      selectedTechnicianId: "tech-sarah",
      notes: "Realizar la calibración trimestral de las unidades de enfriamiento.",
      assignedAt: hourAgo
    },
    {
      id: "req-8493",
      code: "REQ-8493",
      title: "Escaneo de integridad estructural",
      description:
        "Escaneo ultrasónico de los pilares de carga en el nivel B2 después de eventos de microtremor.",
      location: "Nivel B2",
      dueLabel: "Mañana",
      priority: "medium",
      status: "assigned",
      requiredSkills: ["Estructural", "Escaneo"],
      requiredClearances: ["Clase 2"],
      estimatedHours: 3,
      selectedTechnicianId: "tech-nina",
      notes: "",
      assignedAt: hourAgo
    },
    {
      id: "req-8495",
      code: "REQ-8495",
      title: "Revisión rutinaria de extintores",
      description:
        "Inspección visual y lectura del manómetro para todas las unidades en los pasillos del Ala Este.",
      location: "Ala Este",
      dueLabel: "14 oct",
      priority: "low",
      status: "unassigned",
      requiredSkills: ["Seguridad", "Inspecciones"],
      requiredClearances: ["Clase 2"],
      estimatedHours: 1,
      selectedTechnicianId: null,
      notes: "",
      assignedAt: null
    },
    {
      id: "req-8501",
      code: "REQ-8501",
      title: "Auditoría de carga eléctrica",
      description:
        "Mide la distribución de carga en la sala eléctrica principal y valida los umbrales de alerta.",
      location: "Núcleo eléctrico",
      dueLabel: "Viernes",
      priority: "medium",
      status: "unassigned",
      requiredSkills: ["Diagnóstico", "Cumplimiento"],
      requiredClearances: ["Clase 3"],
      estimatedHours: 2,
      selectedTechnicianId: null,
      notes: "",
      assignedAt: null
    }
  ]

  const folders: Folder[] = [
    {
      id: "folder-site-alpha",
      name: "Sitio Alfa",
      parentId: null,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: "folder-phase-2",
      name: "Fase 2",
      parentId: "folder-site-alpha",
      createdAt,
      updatedAt: createdAt
    },
    {
      id: "folder-foundations",
      name: "Cimientos",
      parentId: "folder-phase-2",
      createdAt,
      updatedAt: createdAt
    },
    {
      id: "folder-evidence",
      name: "Evidencias",
      parentId: "folder-site-alpha",
      createdAt,
      updatedAt: createdAt
    },
    {
      id: "folder-drawings",
      name: "Planos",
      parentId: "folder-site-alpha",
      createdAt,
      updatedAt: createdAt
    }
  ]

  const evidence: EvidenceFile[] = [
    {
      id: "evd-492",
      mediaType: "image",
      mimeType: "image/svg+xml",
      name: "armado-cimientos.jpg",
      base64: buildThumbnail("EVD-492", "#2d3e50", "#fea520"),
      previewBase64: buildThumbnail("EVD-492", "#2d3e50", "#fea520"),
      caption: "",
      flagged: false,
      createdAt,
      folderId: "folder-foundations",
      linkedTaskId: "task-foundation",
      size: 184_320
    },
    {
      id: "evd-493",
      mediaType: "video",
      mimeType: "video/mp4",
      name: "panel-principal.mp4",
      base64: `${"data:video/mp4;base64,"}${createBase64FromString("placeholder-video")}`,
      previewBase64: buildThumbnail("EVD-493", "#004064", "#92ccff"),
      caption: "Inspección del panel principal. El cableado cumple con el código.",
      flagged: false,
      createdAt,
      folderId: "folder-evidence",
      linkedTaskId: "task-inventory",
      size: 4_820_120
    },
    {
      id: "evd-494",
      mediaType: "image",
      mimeType: "image/svg+xml",
      name: "losa-agrietada.jpg",
      base64: buildThumbnail("EVD-494", "#93000a", "#ffdad6"),
      previewBase64: buildThumbnail("EVD-494", "#93000a", "#ffdad6"),
      caption:
        "Crítico: se detectó una fisura capilar en la plataforma del sector B. Requiere revisión estructural.",
      flagged: true,
      createdAt: twoHoursAgo,
      folderId: "folder-foundations",
      linkedTaskId: "task-structural-load",
      size: 226_000
    }
  ]

  const assignments: AssignmentRecord[] = [
    {
      id: "assign-req-8492",
      requirementId: "req-8492",
      technicianId: "tech-sarah",
      notes: "Coordina con el equipo de automatización del edificio antes de la calibración.",
      createdAt: hourAgo,
      status: "confirmed"
    }
  ]

  const saves: SaveRecord[] = [
    {
      id: "save-001",
      mode: "existing",
      folderId: "folder-foundations",
      folderName: "Cimientos",
      folderPath: "Sitio Alfa / Fase 2 / Cimientos",
      createdAt,
      dateLabel: formatDateStamp(new Date(createdAt)),
      timeLabel: formatClock(new Date(createdAt)),
      counts: {
        tasks: tasks.length,
        requirements: requirements.length,
        assignments: assignments.length,
        evidence: evidence.length
      }
    }
  ]

  return {
    tasks,
    requirements,
    technicians,
    evidence,
    folders,
    assignments,
    saves,
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
          const id = makeId("task")
          const now = new Date().toISOString()
          const status = input.status ?? "todo"

          set((state) => ({
            tasks: [
              {
                id,
                title: input.title,
                description: input.description,
                priority: input.priority,
                status,
                assigneeIds: input.assigneeIds ?? [],
                createdAt: now,
                updatedAt: now,
                timerStartedAt: status === "inProgress" ? Date.now() : null,
                accumulatedSeconds: 0,
                location: input.location,
                dueLabel: input.dueLabel,
                drawingScene: null,
                activities: input.activities ?? []
              },
              ...state.tasks
            ]
          }))

          return id
        },
        updateTask: (taskId, patch) => {
          set((state) => ({
            tasks: state.tasks.map((task) =>
              task.id === taskId ? { ...task, ...patch, updatedAt: new Date().toISOString() } : task
            )
          }))
        },
        deleteTask: (taskId) => {
          set((state) => ({
            tasks: state.tasks.filter((task) => task.id !== taskId)
          }))
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
                timerStartedAt: status === "inProgress" ? now : null,
                accumulatedSeconds: currentlyRunning ? totalSeconds : task.accumulatedSeconds,
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

          set((state) => ({
            requirements: [requirement, ...state.requirements]
          }))

          return id
        },
        updateRequirement: (requirementId, patch) => {
          set((state) => ({
            requirements: state.requirements.map((requirement) =>
              requirement.id === requirementId
                ? { ...requirement, ...patch } as Requirement
                : requirement
            )
          }))
        },
        deleteRequirement: (requirementId) => {
          set((state) => ({
            requirements: state.requirements.filter((requirement) => requirement.id !== requirementId),
            assignments: state.assignments.filter(
              (assignment) => assignment.requirementId !== requirementId
            )
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
      version: 3,
      storage: createJSONStorage(() =>
        typeof window === "undefined" ? memoryStorage : window.localStorage
      ),
      partialize: (state) => ({
        tasks: state.tasks,
        requirements: state.requirements,
        technicians: state.technicians,
        evidence: state.evidence,
        folders: state.folders,
        assignments: state.assignments,
        saves: state.saves,
        drawingScene: state.drawingScene
      }),
      migrate: (persistedState) =>
        translateLegacyWorkflowState(persistedState as Partial<WorkflowStore>),
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
