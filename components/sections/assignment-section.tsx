"use client"

import { useEffect, useMemo, useState } from "react"
import { Avatar } from "@/components/ui/avatar"
import { MaterialIcon } from "@/components/ui/material-icon"
import { cn, formatDateTime } from "@/utils/workflow"
import {
  type Requirement,
  type Technician,
  useWorkflowStore,
  workflowSelectors
} from "@/store/workflow-store"

type AssignmentSectionProps = {
  onCreateTask: () => void
  onOpenTaskDetails: (taskId: string) => void
  searchQuery?: string
}

const priorityStyles = {
  high: "text-error bg-error-container",
  medium: "text-secondary bg-secondary-fixed",
  low: "text-on-surface-variant bg-surface-variant"
} as const

const statusStyles = {
  todo: "bg-surface-container-high text-on-surface-variant",
  inProgress: "bg-secondary-container text-on-secondary-container",
  review: "bg-tertiary-container text-on-tertiary-container",
  done: "bg-primary text-white"
} as const

const statusLabels = {
  todo: "Por Hacer",
  inProgress: "En Progreso",
  review: "En Revisión",
  done: "Completada"
} as const

function scoreTechnician(requirement: Requirement, technician: Technician) {
  let score = 0

  // Todos los empleados son igualmente elegibles por defecto
  score += 30


  requirement.requiredSkills?.forEach((skill) => {
    if (technician.skills?.some((candidate) => candidate.toLowerCase().includes(skill.toLowerCase()))) {
      score += 20
    }
  })

  requirement.requiredClearances?.forEach((clearance) => {
    if (technician.clearances?.includes(clearance)) {
      score += 30
    }
  })

  if (/(lead|líder|lider|jefe)/i.test(technician.position)) {
    score += 10
  }

  return score
}

function technicianSearchableText(technician: Technician) {
  return [
    technician.name,
    technician.code || "",
    technician.position,
    ...(technician.skills || []),
    ...(technician.clearances || [])
  ]
    .join(" ")
    .toLowerCase()
}

export function AssignmentSection({ onCreateTask, onOpenTaskDetails, searchQuery = "" }: AssignmentSectionProps) {
  const requirements = useWorkflowStore((state) => state.requirements)
  const users = useWorkflowStore((state) => state.users)
  const technicians = useMemo(() => users.filter(u => u.role === "empleado" || u.role === "gerente"), [users])
  const tasks = useWorkflowStore((state) => state.tasks)
  const currentUserId = useWorkflowStore((state) => state.currentUserId)
  const assignments = useWorkflowStore((state) => state.assignments)
  const updateRequirement = useWorkflowStore((state) => state.updateRequirement)
  const assignRequirement = useWorkflowStore((state) => state.assignRequirement)

  const currentUser = useMemo(() =>
    workflowSelectors.getCurrentUser(users, currentUserId),
    [users, currentUserId])

  const zoneRequirements = useMemo(() => {
    const base = workflowSelectors.filterRequirementsByZone(requirements, currentUser)
    const query = searchQuery.trim().toLowerCase()
    if (!query) return base
    return base.filter(r => 
      r.title.toLowerCase().includes(query) || 
      r.description.toLowerCase().includes(query) ||
      r.code.toLowerCase().includes(query) ||
      r.location.toLowerCase().includes(query)
    )
  }, [requirements, currentUser, searchQuery])

  const zoneTasks = useMemo(() =>
    workflowSelectors.filterTasksByZone(tasks, currentUser),
    [tasks, currentUser])

  const [selectedRequirementId, setSelectedRequirementId] = useState<string | null>(null)
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [dispatchNotes, setDispatchNotes] = useState("")

  useEffect(() => {
    const currentSelection = workflowSelectors.getRequirementById(zoneRequirements, selectedRequirementId)

    if (zoneRequirements.length > 0 && (!selectedRequirementId || !currentSelection)) {
      setSelectedRequirementId(zoneRequirements[0].id)
    }
  }, [zoneRequirements, selectedRequirementId])

  const selectedRequirement = useMemo(() => {
    return workflowSelectors.getRequirementById(zoneRequirements, selectedRequirementId)
  }, [zoneRequirements, selectedRequirementId])

  useEffect(() => {
    if (!selectedRequirement) {
      return
    }

    setDispatchNotes(selectedRequirement.notes || "")

    const existingAssignment = workflowSelectors.getAssignmentForRequirement(
      assignments,
      selectedRequirement.id
    )

    const recommendedTechnician =
      technicians
        .slice()
        .sort((left, right) => scoreTechnician(selectedRequirement, right) - scoreTechnician(selectedRequirement, left))[0] ??
      null

    setSelectedTechnicianId(existingAssignment?.technicianId ?? selectedRequirement.selectedTechnicianId ?? recommendedTechnician?.id ?? null)
  }, [assignments, selectedRequirement, technicians])

  const matchedTechnicians = useMemo(() => {
    if (!selectedRequirement) {
      return []
    }

    const query = search.trim().toLowerCase()

    return technicians
      .filter((technician) => {
        if (!query) {
          return true
        }

        return technicianSearchableText(technician).includes(query)
      })
      .map((technician) => ({
        technician,
        score: scoreTechnician(selectedRequirement, technician)
      }))
      .sort((left, right) => right.score - left.score)
  }, [search, selectedRequirement, technicians])

  const selectedTechnician = workflowSelectors.getTechnicianById(technicians, selectedTechnicianId)
  const assignmentRecord = selectedRequirement
    ? workflowSelectors.getAssignmentForRequirement(assignments, selectedRequirement.id)
    : null

  function handleConfirmAssignment() {
    if (!selectedRequirement || !selectedTechnicianId) {
      return
    }

    assignRequirement(selectedRequirement.id, selectedTechnicianId, dispatchNotes)
  }

  if (!selectedRequirement) {
    return (
      <section className="flex-1 min-h-0 p-gutter">
        <div className="rounded-xl border border-outline-variant bg-surface p-6">
          <p className="text-on-surface-variant">No hay requerimientos disponibles.</p>
          <button
            type="button"
            onClick={onCreateTask}
            className="mt-4 inline-flex h-12 items-center gap-2 rounded-lg bg-secondary px-4 font-title-sm text-title-sm text-on-secondary hover:opacity-90"
          >
            <MaterialIcon name="add" />
            Nueva tarea
          </button>
        </div>
      </section>
    )
  }

  return (
    <main className="flex-1 min-h-0 p-gutter bg-surface-container-low flex flex-col lg:flex-row gap-gutter overflow-y-auto lg:overflow-hidden">
      <section className="w-full lg:w-1/3 shrink-0 flex flex-col bg-surface rounded-xl border border-outline-variant h-[500px] lg:h-[calc(100vh-8rem)] overflow-hidden shadow-sm">
        <div className="p-4 border-b border-outline-variant bg-surface-bright flex justify-between items-center">
          <div>
            <h2 className="font-title-sm text-title-sm text-tertiary-container">Asignaciones pendientes</h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
              {zoneRequirements.length} requerimientos por asignar
            </p>
          </div>
          <button
            type="button"
            className="p-2 text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors"
            title="Filtrar requerimientos"
          >
            <MaterialIcon name="filter_list" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {zoneRequirements.map((requirement) => {
            const isSelected = requirement.id === selectedRequirement.id
            const assignedTechnician = workflowSelectors.getTechnicianById(
              technicians,
              requirement.selectedTechnicianId
            )

            return (
              <button
                key={requirement.id}
                type="button"
                onClick={() => {
                  setSelectedRequirementId(requirement.id)
                }}
                className={cn(
                  "relative w-full text-left p-4 border-b border-outline-variant transition-colors group/item",
                  isSelected ? "bg-tertiary-fixed" : "bg-surface hover:bg-surface-container-lowest"
                )}
              >
                {isSelected ? <div className="absolute left-0 top-0 bottom-0 w-1 bg-tertiary-container" /> : null}
                <div className="flex justify-between items-start mb-2 gap-3">
                  <span className="font-data-mono text-data-mono text-tertiary-container bg-surface px-2 py-0.5 rounded border border-outline-variant uppercase">
                    {requirement.code}
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={cn(
                        "font-label-caps text-[9px] px-2 py-0.5 rounded-full",
                        priorityStyles[requirement.priority]
                      )}
                    >
                      {requirement.priority === "high" ? "ALTA" : requirement.priority === "medium" ? "MEDIA" : "BAJA"}
                    </span>
                    {(() => {
                      const t = tasks.find(x => x.requirementId === requirement.id)
                      if (!t) return null
                      return (
                        <span className={cn("font-label-caps text-[9px] px-2 py-0.5 rounded-full", statusStyles[t.status])}>
                          {statusLabels[t.status]}
                        </span>
                      )
                    })()}
                  </div>
                </div>
                <h3 className="font-title-sm text-title-sm text-on-surface mb-1 truncate">{requirement.title}</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">
                  {requirement.description}
                </p>
                <div className="mt-3 flex items-center gap-4 text-on-surface-variant flex-wrap">
                  <div className="flex items-center gap-1 font-body-sm text-body-sm">
                    <MaterialIcon name="location_on" className="text-[16px]" />
                    {requirement.location}
                  </div>
                  <div className="flex items-center gap-1 font-body-sm text-body-sm">
                    <MaterialIcon name="schedule" className="text-[16px]" />
                    Vence: {requirement.dueLabel && !isNaN(Date.parse(requirement.dueLabel))
                      ? formatDateTime(requirement.dueLabel)
                      : requirement.dueLabel}
                  </div>
                  {assignedTechnician ? (
                    <div className="flex items-center gap-1 font-body-sm text-body-sm text-tertiary-container">
                      <MaterialIcon name="badge" className="text-[16px]" />
                      {assignedTechnician.name}
                    </div>
                  ) : null}
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <section className="w-full lg:w-2/3 flex flex-col h-[calc(100vh-8rem)] min-h-0 gap-6">
        <div className="bg-surface rounded-xl border border-outline-variant p-6 shadow-sm flex-shrink-0">
          <div className="flex justify-between items-start mb-6 gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <span className="font-data-mono text-data-mono text-tertiary-container bg-surface-container-low px-2 py-1 rounded border border-outline-variant uppercase">
                  {selectedRequirement.code}
                </span>
                <span className={cn("font-label-caps text-label-caps px-3 py-1 rounded-full", priorityStyles[selectedRequirement.priority])}>
                  Prioridad {selectedRequirement.priority === "high" ? "Alta" : selectedRequirement.priority === "medium" ? "Media" : "Baja"}
                </span>
                {(() => {
                  const t = tasks.find(x => x.requirementId === selectedRequirement.id)
                  if (!t) return (
                    <span className="font-label-caps text-label-caps text-secondary bg-secondary-fixed px-3 py-1 rounded-full uppercase">
                      Sin asignar
                    </span>
                  )
                  return (
                    <span className={cn("font-label-caps text-label-caps px-3 py-1 rounded-full uppercase", statusStyles[t.status])}>
                      {statusLabels[t.status]}
                    </span>
                  )
                })()}
              </div>
              <h1 className="font-headline-md text-headline-md text-tertiary-container">
                {selectedRequirement.title}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {selectedRequirement.status === "assigned" && (
                <button
                  type="button"
                  onClick={() => {
                    const linkedTask = zoneTasks.find(t => t.requirementId === selectedRequirement.id)
                    if (linkedTask) onOpenTaskDetails(linkedTask.id)
                  }}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 font-title-sm text-title-sm text-on-primary hover:opacity-90 shadow-sm"
                >
                  <MaterialIcon name="visibility" filled />
                  Ver Actividad de Campo
                </button>
              )}
              <button
                type="button"
                className="text-on-surface-variant hover:text-primary transition-colors p-2 rounded-full hover:bg-surface-container"
                title="Más opciones"
              >
                <MaterialIcon name="more_vert" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h4 className="font-label-caps text-label-caps text-on-surface-variant mb-2 uppercase tracking-wider">
                Descripción
              </h4>
              <p className="font-body-md text-body-md text-on-surface leading-relaxed">
                {selectedRequirement.description}
              </p>
              {assignmentRecord ? (
                <div className="mt-4 rounded-lg border border-outline-variant bg-surface-container-low p-4">
                  <div className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider mb-2">
                    Registro de asignación
                  </div>
                  <p className="text-sm text-on-surface-variant">
                    Guardado el {new Date(assignmentRecord.createdAt).toLocaleString("es-MX")}.
                  </p>
                </div>
              ) : null}
            </div>
            <div className="bg-surface-container-low p-4 rounded-lg border border-outline-variant">
              <h4 className="font-label-caps text-label-caps text-on-surface-variant mb-3 uppercase tracking-wider">
                Parámetros
              </h4>
              <ul className="space-y-3">
                <li className="flex items-center justify-between border-b border-outline-variant pb-2 gap-4">
                  <span className="font-body-sm text-body-sm text-on-surface-variant">Ubicación</span>
                  <span className="font-data-mono text-data-mono text-on-surface text-right truncate max-w-[150px]">
                    {selectedRequirement.location}
                  </span>
                </li>
                <li className="flex items-center justify-between border-b border-outline-variant pb-2 gap-4">
                  <span className="font-body-sm text-body-sm text-on-surface-variant">Fecha límite</span>
                  <span className="font-data-mono text-data-mono text-error text-right">
                    {selectedRequirement.dueLabel && !isNaN(Date.parse(selectedRequirement.dueLabel))
                      ? formatDateTime(selectedRequirement.dueLabel)
                      : selectedRequirement.dueLabel}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-4">
                  <span className="font-body-sm text-body-sm text-on-surface-variant">Duración estimada</span>
                  <span className="font-data-mono text-data-mono text-on-surface text-right">
                    {selectedRequirement.estimatedHours} horas
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-xl border border-outline-variant flex-1 flex flex-col shadow-sm overflow-hidden min-h-0">
          <div className="p-6 border-b border-outline-variant bg-surface-bright">
            <h2 className="font-headline-md text-headline-md text-tertiary-container flex items-center gap-2">
              <MaterialIcon name="person_add" />
              Asignar personal
            </h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
              Selecciona un técnico disponible con las autorizaciones requeridas.
            </p>
          </div>

          <div className="p-6 flex-1 overflow-y-auto scrollbar-thin">
            <div className="mb-6 relative">
              <MaterialIcon
                name="search"
                className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-surface border border-outline-variant rounded-lg text-body-md font-body-md focus:border-tertiary-container focus:ring-1 focus:ring-tertiary-container outline-none transition-all h-[48px]"
                placeholder="Buscar por nombre, habilidad o ID..."
                type="text"
              />
            </div>

            <div className="space-y-3">
              {matchedTechnicians.map(({ technician, score }) => {
                const isSelected = technician.id === selectedTechnicianId
                const isAvailable = technician.availability === "available"
                const assignmentClass = isSelected
                  ? "border-2 border-tertiary-container bg-tertiary-fixed"
                  : "border border-outline-variant bg-surface hover:bg-surface-container-low"

                return (
                  <label
                    key={technician.id}
                    className={cn(
                      "flex items-center p-4 rounded-lg cursor-pointer transition-all relative overflow-hidden group",
                      assignmentClass,
                      isAvailable ? "" : "opacity-70"
                    )}
                  >
                    <input
                      checked={isSelected}
                      className="hidden"
                      name="technician"
                      type="radio"
                      onChange={() => setSelectedTechnicianId(technician.id)}
                    />
                    <Avatar
                      name={technician.name}
                      src={technician.avatar}
                      className="w-12 h-12"
                      badgeClassName={cn(
                        "mr-4 border",
                        isSelected ? "border-tertiary-container" : "border-outline-variant"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1 gap-4">
                        <h3 className="font-title-sm text-title-sm text-on-surface truncate">{technician.name}</h3>
                        <span className="font-data-mono text-[10px] text-on-surface-variant uppercase">
                          ID: {technician.code}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-label-caps text-[10px] text-on-surface-variant bg-surface px-2 py-0.5 rounded border border-outline-variant uppercase">
                          {technician.role}
                        </span>
                        <div className="flex items-center gap-1 font-body-sm text-[11px] text-primary">
                          <MaterialIcon
                            name={isAvailable ? "battery_charging_full" : technician.availability === "soon" ? "schedule" : "block"}
                            className="text-[14px]"
                          />
                          {technician.availabilityLabel}
                        </div>
                      </div>
                    </div>
                    {isSelected ? (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-tertiary-container">
                        <MaterialIcon name="check_circle" filled />
                      </div>
                    ) : null}
                  </label>
                )
              })}
            </div>

            <div className="mt-6">
              <label className="font-label-caps text-label-caps text-on-surface-variant mb-2 block uppercase tracking-wider">
                Instrucciones de asignación (opcional)
              </label>
              <textarea
                value={dispatchNotes}
                onChange={(event) => {
                  const nextValue = event.target.value
                  setDispatchNotes(nextValue)
                  updateRequirement(selectedRequirement.id, { notes: nextValue })
                }}
                className="w-full p-4 bg-surface border border-outline-variant rounded-lg text-body-md font-body-md focus:border-tertiary-container focus:ring-1 focus:ring-tertiary-container outline-none transition-all resize-none h-24"
                placeholder="Agrega notas específicas para el técnico..."
              />
            </div>
          </div>

          <div className="p-6 border-t border-outline-variant bg-surface-bright flex justify-end gap-4">
            <button
              type="button"
              onClick={handleConfirmAssignment}
              disabled={!selectedTechnicianId}
              className="px-6 h-[48px] bg-secondary text-on-secondary rounded-lg font-title-sm text-title-sm hover:bg-secondary-fixed-dim transition-colors shadow-sm flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <MaterialIcon name="send" />
              Confirmar asignación
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}
