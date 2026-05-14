"use client"

import React, { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { MaterialIcon } from "@/components/ui/material-icon"
import { cn, makeId } from "@/utils/workflow"
import { type DrawingScene } from "@/store/workflow-store"

type CanvasTool = "select" | "pen" | "line" | "text" | "eraser"

type CanvasSize = {
  width: number
  height: number
}

type CanvasPoint = {
  x: number
  y: number
}

type StrokeShape = {
  id: string
  kind: "stroke"
  tool: "pen"
  points: CanvasPoint[]
  stroke: string
  strokeWidth: number
  createdAt: number
  updatedAt: number
}

type LineShape = {
  id: string
  kind: "line"
  tool: "line"
  from: CanvasPoint
  to: CanvasPoint
  stroke: string
  strokeWidth: number
  createdAt: number
  updatedAt: number
}

type TextShape = {
  id: string
  kind: "text"
  tool: "text"
  position: CanvasPoint
  text: string
  fontSize: number
  stroke: string
  strokeWidth: number
  fill: string
  background: string
  createdAt: number
  updatedAt: number
}

type CanvasShape = StrokeShape | LineShape | TextShape

type TaskDrawingCanvasProps = {
  scene: DrawingScene | null
  onSave: (scene: Omit<DrawingScene, "updatedAt">) => void
  title: string
  description?: string
  saveLabel?: string
  resetLabel?: string
  className?: string
  extraActions?: React.ReactNode
}

type InteractionState =
  | {
      kind: "pen"
      shapeId: string
    }
  | {
      kind: "line"
      shapeId: string
      start: CanvasPoint
    }
  | {
      kind: "drag"
      shapeId: string
      anchor: CanvasPoint
      source: CanvasShape
      moved: boolean
    }
  | {
      kind: "erase"
      lastTargetId: string | null
    }

const CANVAS_KIND = "flujo-pro-canvas"
const CANVAS_VERSION = 1
const DEFAULT_CANVAS_SIZE: CanvasSize = { width: 1200, height: 820 }

const TOOL_SHORTCUT_HINTS: Record<CanvasTool, string> = {
  select: "Selecciona y arrastra elementos.",
  pen: "Dibuja trazos libres con el mouse o el dedo.",
  line: "Haz clic y arrastra para trazar una línea recta.",
  text: "Haz clic para colocar una nota. Doble clic para editarla.",
  eraser: "Pasa por encima de un elemento para borrarlo."
}

const SHAPE_COLORS = {
  pen: "#172839",
  line: "#004064",
  text: "#865300",
  textFill: "#172839",
  textBackground: "#ffffff"
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}

function clampPoint(point: CanvasPoint): CanvasPoint {
  return {
    x: clamp(point.x),
    y: clamp(point.y)
  }
}

function isTool(value: unknown): value is CanvasTool {
  return value === "select" || value === "pen" || value === "line" || value === "text" || value === "eraser"
}

function isPoint(value: unknown): value is CanvasPoint {
  return (
    isPlainObject(value) &&
    typeof value.x === "number" &&
    Number.isFinite(value.x) &&
    typeof value.y === "number" &&
    Number.isFinite(value.y)
  )
}

function clonePoint(point: CanvasPoint): CanvasPoint {
  return { x: point.x, y: point.y }
}

function cloneShape(shape: CanvasShape): CanvasShape {
  return JSON.parse(JSON.stringify(shape)) as CanvasShape
}

function cloneShapes(shapes: CanvasShape[]): CanvasShape[] {
  return JSON.parse(JSON.stringify(shapes)) as CanvasShape[]
}

function serializeShapes(shapes: CanvasShape[]) {
  return JSON.stringify(shapes)
}

function distanceBetweenPoints(a: CanvasPoint, b: CanvasPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function distancePointToSegment(point: CanvasPoint, start: CanvasPoint, end: CanvasPoint) {
  const lengthSquared = (end.x - start.x) ** 2 + (end.y - start.y) ** 2

  if (lengthSquared === 0) {
    return distanceBetweenPoints(point, start)
  }

  const projection = ((point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y)) / lengthSquared
  const clampedProjection = clamp(projection, 0, 1)

  return distanceBetweenPoints(
    point,
    {
      x: start.x + clampedProjection * (end.x - start.x),
      y: start.y + clampedProjection * (end.y - start.y)
    }
  )
}

function measureTextWidth(text: string, fontSize: number, context: CanvasRenderingContext2D | null) {
  if (context) {
    context.font = `${fontSize}px Inter, sans-serif`
    return context.measureText(text).width
  }

  return text.length * fontSize * 0.62
}

function toAbsolute(point: CanvasPoint, canvasSize: CanvasSize) {
  return {
    x: point.x * canvasSize.width,
    y: point.y * canvasSize.height
  }
}

function toPoint(event: ReactPointerEvent<SVGSVGElement>): CanvasPoint {
  const rect = event.currentTarget.getBoundingClientRect()

  if (rect.width <= 0 || rect.height <= 0) {
    return { x: 0, y: 0 }
  }

  return clampPoint({
    x: (event.clientX - rect.left) / rect.width,
    y: (event.clientY - rect.top) / rect.height
  })
}

function translatePoint(point: CanvasPoint, delta: CanvasPoint): CanvasPoint {
  return clampPoint({
    x: point.x + delta.x,
    y: point.y + delta.y
  })
}

function translateShape(shape: CanvasShape, delta: CanvasPoint): CanvasShape {
  if (shape.kind === "stroke") {
    return {
      ...shape,
      points: shape.points.map((point) => translatePoint(point, delta)),
      updatedAt: Date.now()
    }
  }

  if (shape.kind === "line") {
    return {
      ...shape,
      from: translatePoint(shape.from, delta),
      to: translatePoint(shape.to, delta),
      updatedAt: Date.now()
    }
  }

  return {
    ...shape,
    position: translatePoint(shape.position, delta),
    updatedAt: Date.now()
  }
}

function getShapeBounds(
  shape: CanvasShape,
  canvasSize: CanvasSize,
  context: CanvasRenderingContext2D | null
) {
  if (shape.kind === "text") {
    const absPosition = toAbsolute(shape.position, canvasSize)
    const width = measureTextWidth(shape.text, shape.fontSize, context)
    const height = shape.fontSize * 1.35

    return {
      left: absPosition.x - 8,
      top: absPosition.y - 6,
      right: absPosition.x + width + 8,
      bottom: absPosition.y + height + 8
    }
  }

  const points =
    shape.kind === "stroke"
      ? shape.points
      : [shape.from, shape.to]

  let left = Number.POSITIVE_INFINITY
  let top = Number.POSITIVE_INFINITY
  let right = Number.NEGATIVE_INFINITY
  let bottom = Number.NEGATIVE_INFINITY

  points.forEach((point) => {
    const abs = toAbsolute(point, canvasSize)
    left = Math.min(left, abs.x)
    top = Math.min(top, abs.y)
    right = Math.max(right, abs.x)
    bottom = Math.max(bottom, abs.y)
  })

  const padding = Math.max(8, shape.strokeWidth * 2.5)

  return {
    left: left - padding,
    top: top - padding,
    right: right + padding,
    bottom: bottom + padding
  }
}

function isPointInsideBounds(point: CanvasPoint, bounds: { left: number; top: number; right: number; bottom: number }) {
  return point.x >= bounds.left && point.x <= bounds.right && point.y >= bounds.top && point.y <= bounds.bottom
}

function hitTestShape(
  point: CanvasPoint,
  shapes: CanvasShape[],
  canvasSize: CanvasSize,
  context: CanvasRenderingContext2D | null
) {
  for (let index = shapes.length - 1; index >= 0; index -= 1) {
    const shape = shapes[index]

    if (shape.kind === "text") {
      const bounds = getShapeBounds(shape, canvasSize, context)
      if (isPointInsideBounds(toAbsolute(point, canvasSize), bounds)) {
        return shape.id
      }
      continue
    }

    if (shape.kind === "stroke") {
      if (shape.points.length === 1) {
        const absPoint = toAbsolute(shape.points[0], canvasSize)
        const distance = distanceBetweenPoints(toAbsolute(point, canvasSize), absPoint)
        if (distance <= Math.max(12, shape.strokeWidth * 2.5)) {
          return shape.id
        }
        continue
      }

      const threshold = Math.max(10, shape.strokeWidth * 2.75)
      const absolutePoint = toAbsolute(point, canvasSize)

      for (let pointIndex = 1; pointIndex < shape.points.length; pointIndex += 1) {
        const start = toAbsolute(shape.points[pointIndex - 1], canvasSize)
        const end = toAbsolute(shape.points[pointIndex], canvasSize)

        if (distancePointToSegment(absolutePoint, start, end) <= threshold) {
          return shape.id
        }
      }
      continue
    }

    const start = toAbsolute(shape.from, canvasSize)
    const end = toAbsolute(shape.to, canvasSize)
    const threshold = Math.max(10, shape.strokeWidth * 2.75)

    if (distancePointToSegment(toAbsolute(point, canvasSize), start, end) <= threshold) {
      return shape.id
    }
  }

  return null
}

function pathFromStroke(points: CanvasPoint[], canvasSize: CanvasSize) {
  if (points.length === 0) {
    return ""
  }

  const [first, ...rest] = points
  const start = toAbsolute(first, canvasSize)

  return [
    `M ${start.x.toFixed(2)} ${start.y.toFixed(2)}`,
    ...rest.map((point) => {
      const abs = toAbsolute(point, canvasSize)
      return `L ${abs.x.toFixed(2)} ${abs.y.toFixed(2)}`
    })
  ].join(" ")
}

function parseShape(value: unknown): CanvasShape | null {
  if (!isPlainObject(value) || typeof value.kind !== "string") {
    return null
  }

  if (value.kind === "stroke") {
    if (
      typeof value.id !== "string" ||
      !Array.isArray(value.points) ||
      !value.points.every(isPoint)
    ) {
      return null
    }

    return {
      id: value.id,
      kind: "stroke",
      tool: "pen",
      points: value.points.map(clonePoint),
      stroke: typeof value.stroke === "string" ? value.stroke : SHAPE_COLORS.pen,
      strokeWidth: typeof value.strokeWidth === "number" ? value.strokeWidth : 2.5,
      createdAt: typeof value.createdAt === "number" ? value.createdAt : Date.now(),
      updatedAt: typeof value.updatedAt === "number" ? value.updatedAt : Date.now()
    }
  }

  if (value.kind === "line") {
    if (
      typeof value.id !== "string" ||
      !isPoint(value.from) ||
      !isPoint(value.to)
    ) {
      return null
    }

    return {
      id: value.id,
      kind: "line",
      tool: "line",
      from: clonePoint(value.from),
      to: clonePoint(value.to),
      stroke: typeof value.stroke === "string" ? value.stroke : SHAPE_COLORS.line,
      strokeWidth: typeof value.strokeWidth === "number" ? value.strokeWidth : 2,
      createdAt: typeof value.createdAt === "number" ? value.createdAt : Date.now(),
      updatedAt: typeof value.updatedAt === "number" ? value.updatedAt : Date.now()
    }
  }

  if (value.kind === "text") {
    if (
      typeof value.id !== "string" ||
      !isPoint(value.position) ||
      typeof value.text !== "string"
    ) {
      return null
    }

    return {
      id: value.id,
      kind: "text",
      tool: "text",
      position: clonePoint(value.position),
      text: value.text,
      fontSize: typeof value.fontSize === "number" ? value.fontSize : 18,
      stroke: typeof value.stroke === "string" ? value.stroke : SHAPE_COLORS.text,
      strokeWidth: typeof value.strokeWidth === "number" ? value.strokeWidth : 1.5,
      fill: typeof value.fill === "string" ? value.fill : SHAPE_COLORS.textFill,
      background: typeof value.background === "string" ? value.background : SHAPE_COLORS.textBackground,
      createdAt: typeof value.createdAt === "number" ? value.createdAt : Date.now(),
      updatedAt: typeof value.updatedAt === "number" ? value.updatedAt : Date.now()
    }
  }

  return null
}

function parseInitialScene(scene: DrawingScene | null) {
  const appState = isPlainObject(scene?.appState) ? scene.appState : null
  const isNativeCanvas = appState?.canvasKind === CANVAS_KIND && appState?.canvasVersion === CANVAS_VERSION
  const shapes = Array.isArray(scene?.elements) ? scene?.elements.map(parseShape).filter(Boolean) as CanvasShape[] : []
  const tool = isNativeCanvas && isTool(appState?.activeTool) ? appState.activeTool : "pen"

  return {
    shapes: isNativeCanvas ? shapes : [],
    tool
  }
}

function buildPersistedScene(shapes: CanvasShape[], tool: CanvasTool, canvasSize: CanvasSize): Omit<DrawingScene, "updatedAt"> {
  return {
    elements: cloneShapes(shapes) as any[],
    appState: {
      canvasKind: CANVAS_KIND,
      canvasVersion: CANVAS_VERSION,
      activeTool: tool,
      canvasWidth: canvasSize.width,
      canvasHeight: canvasSize.height,
      viewBackgroundColor: "#ffffff"
    },
    files: {}
  }
}

function ToolButton({
  icon,
  label,
  active = false,
  onClick
}: {
  icon: string
  label: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex h-11 w-11 items-center justify-center rounded-lg transition-colors",
        active ? "bg-secondary-container text-on-secondary-container shadow-sm" : "text-on-surface-variant hover:bg-surface-container-high"
      )}
    >
      <MaterialIcon name={icon} filled={active} />
      <span className="sr-only">{label}</span>
    </button>
  )
}

function renderBackgroundBlueprint(canvasSize: CanvasSize) {
  const sx = (value: number) => value * canvasSize.width
  const sy = (value: number) => value * canvasSize.height

  return (
    <g className="pointer-events-none opacity-80">
      <path
        d={`M ${sx(0.18)} ${sy(0.2)} L ${sx(0.48)} ${sy(0.2)} L ${sx(0.48)} ${sy(0.36)} L ${sx(0.62)} ${sy(0.36)} L ${sx(0.62)} ${sy(0.58)} L ${sx(0.18)} ${sy(0.58)} Z`}
        fill="none"
        stroke="#172839"
        strokeLinejoin="round"
        strokeWidth="3"
      />
      <circle cx={sx(0.29)} cy={sy(0.35)} r={Math.max(24, Math.min(canvasSize.width, canvasSize.height) * 0.05)} fill="none" stroke="#172839" strokeDasharray="8,4" strokeWidth="2" />
      <line x1={sx(0.22)} x2={sx(0.36)} y1={sy(0.35)} y2={sy(0.35)} stroke="#74777d" strokeDasharray="10,5,2,5" strokeWidth="1" />
      <line x1={sx(0.29)} x2={sx(0.29)} y1={sy(0.27)} y2={sy(0.43)} stroke="#74777d" strokeDasharray="10,5,2,5" strokeWidth="1" />
      <line x1={sx(0.18)} x2={sx(0.18)} y1={sy(0.17)} y2={sy(0.12)} stroke="#74777d" strokeWidth="1" />
      <line x1={sx(0.48)} x2={sx(0.48)} y1={sy(0.17)} y2={sy(0.12)} stroke="#74777d" strokeWidth="1" />
      <line x1={sx(0.18)} x2={sx(0.48)} y1={sy(0.145)} y2={sy(0.145)} stroke="#74777d" strokeWidth="1" markerStart="url(#canvas-arrow)" markerEnd="url(#canvas-arrow)" />
      <rect x={sx(0.29)} y={sy(0.127)} width={Math.max(72, canvasSize.width * 0.08)} height={Math.max(22, canvasSize.height * 0.03)} rx="4" fill="#ffffff" />
      <text x={sx(0.33)} y={sy(0.146)} fill="#2d3e50" fontFamily="JetBrains Mono, monospace" fontSize="14" fontWeight="500" textAnchor="middle">
        300 mm
      </text>
      <path
        d={`M ${sx(0.68)} ${sy(0.24)} Q ${sx(0.7)} ${sy(0.2)}, ${sx(0.72)} ${sy(0.26)} T ${sx(0.76)} ${sy(0.23)} T ${sx(0.8)} ${sy(0.29)}`}
        fill="none"
        stroke="#fea520"
        strokeLinecap="round"
        strokeWidth="2"
      />
      <text x={sx(0.81)} y={sy(0.31)} fill="#fea520" fontFamily="Inter, sans-serif" fontSize="12">
        Revisar tolerancia aquí
      </text>
    </g>
  )
}

export function TaskDrawingCanvas({
  scene,
  onSave,
  title,
  description,
  saveLabel = "Guardar dibujo",
  resetLabel = "Restablecer",
  className,
  extraActions
}: TaskDrawingCanvasProps) {
  const initial = parseInitialScene(scene)
  const [tool, setTool] = useState<CanvasTool>(initial.tool)
  const [shapes, setShapes] = useState<CanvasShape[]>(() => cloneShapes(initial.shapes))
  const [draftShape, setDraftShape] = useState<CanvasShape | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [canvasSize, setCanvasSize] = useState<CanvasSize>(DEFAULT_CANVAS_SIZE)

  const boardRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const measureContextRef = useRef<CanvasRenderingContext2D | null>(null)
  const shapesRef = useRef<CanvasShape[]>(cloneShapes(initial.shapes))
  const draftRef = useRef<CanvasShape | null>(null)
  const historyRef = useRef<CanvasShape[][]>([])
  const redoRef = useRef<CanvasShape[][]>([])
  const savedSignatureRef = useRef(serializeShapes(initial.shapes))
  const initialShapesRef = useRef<CanvasShape[]>(cloneShapes(initial.shapes))
  const initialToolRef = useRef<CanvasTool>(initial.tool)
  const sceneRevisionRef = useRef(scene?.updatedAt ?? "__sin-escena__")
  const interactionRef = useRef<InteractionState | null>(null)

  const measureWidth = useCallback((text: string, fontSize: number) => {
    return measureTextWidth(text, fontSize, measureContextRef.current)
  }, [])

  const syncDraft = useCallback((shape: CanvasShape | null) => {
    draftRef.current = shape
    setDraftShape(shape ? cloneShape(shape) : null)
  }, [])

  const applyShapes = useCallback(
    (nextShapes: CanvasShape[], options?: { selectedId?: string | null; pushHistory?: boolean }) => {
      const currentShapes = shapesRef.current
      const currentSignature = serializeShapes(currentShapes)
      const nextCloned = cloneShapes(nextShapes)
      const nextSignature = serializeShapes(nextCloned)

      if (options?.pushHistory !== false && currentSignature !== nextSignature) {
        historyRef.current = [...historyRef.current, cloneShapes(currentShapes)]
        redoRef.current = []
      }

      shapesRef.current = nextCloned
      setShapes(nextCloned)
      syncDraft(null)

      if (options?.selectedId !== undefined) {
        setSelectedId(options.selectedId)
      }

      setHasChanges(nextSignature !== savedSignatureRef.current)
    },
    [syncDraft]
  )

  useEffect(() => {
    measureContextRef.current = document.createElement("canvas").getContext("2d")
    return () => {
      measureContextRef.current = null
    }
  }, [])

  useEffect(() => {
    const element = boardRef.current

    if (!element) {
      return
    }

    const updateSize = () => {
      const rect = element.getBoundingClientRect()
      const width = Math.max(1, Math.round(rect.width))
      const height = Math.max(1, Math.round(rect.height))

      setCanvasSize((current) =>
        current.width === width && current.height === height ? current : { width, height }
      )
    }

    updateSize()

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateSize)
      return () => {
        window.removeEventListener("resize", updateSize)
      }
    }

    const observer = new ResizeObserver(() => {
      window.requestAnimationFrame(updateSize)
    })

    observer.observe(element)
    window.addEventListener("resize", updateSize)

    return () => {
      observer.disconnect()
      window.removeEventListener("resize", updateSize)
    }
  }, [])

  useEffect(() => {
    const revision = scene?.updatedAt ?? "__sin-escena__"

    if (sceneRevisionRef.current === revision) {
      return
    }

    sceneRevisionRef.current = revision

    const nextInitial = parseInitialScene(scene)
    const nextShapes = cloneShapes(nextInitial.shapes)

    shapesRef.current = nextShapes
    setShapes(nextShapes)
    syncDraft(null)
    setSelectedId(null)
    setTool(nextInitial.tool)
    historyRef.current = []
    redoRef.current = []
    savedSignatureRef.current = serializeShapes(nextShapes)
    initialShapesRef.current = cloneShapes(nextShapes)
    initialToolRef.current = nextInitial.tool
    setHasChanges(false)
  }, [scene, syncDraft])

  const handleDeleteSelected = useCallback(() => {
    if (!selectedId) {
      return
    }

    const exists = shapesRef.current.some((shape) => shape.id === selectedId)
    if (!exists) {
      setSelectedId(null)
      return
    }

    const nextShapes = shapesRef.current.filter((shape) => shape.id !== selectedId)
    applyShapes(nextShapes, { selectedId: null })
  }, [applyShapes, selectedId])

  const handleUndo = useCallback(() => {
    const previous = historyRef.current.pop()
    if (!previous) {
      return
    }

    redoRef.current = [...redoRef.current, cloneShapes(shapesRef.current)]
    const cloned = cloneShapes(previous)
    shapesRef.current = cloned
    setShapes(cloned)
    syncDraft(null)
    setSelectedId(null)
    setHasChanges(serializeShapes(cloned) !== savedSignatureRef.current)
  }, [syncDraft])

  const handleRedo = useCallback(() => {
    const next = redoRef.current.pop()
    if (!next) {
      return
    }

    historyRef.current = [...historyRef.current, cloneShapes(shapesRef.current)]
    const cloned = cloneShapes(next)
    shapesRef.current = cloned
    setShapes(cloned)
    syncDraft(null)
    setSelectedId(null)
    setHasChanges(serializeShapes(cloned) !== savedSignatureRef.current)
  }, [syncDraft])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        return
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault()
        if (event.shiftKey) {
          handleRedo()
        } else {
          handleUndo()
        }
        return
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault()
        handleRedo()
        return
      }

      if ((event.key === "Delete" || event.key === "Backspace") && selectedId) {
        event.preventDefault()
        handleDeleteSelected()
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [handleDeleteSelected, handleRedo, handleUndo, selectedId])

  const handleSave = useCallback(() => {
    onSave(buildPersistedScene(shapesRef.current, tool, canvasSize))
    savedSignatureRef.current = serializeShapes(shapesRef.current)
    setHasChanges(false)
  }, [canvasSize, onSave, tool])

  const handleReset = useCallback(() => {
    const nextShapes = cloneShapes(initialShapesRef.current)

    historyRef.current = [...historyRef.current, cloneShapes(shapesRef.current)]
    redoRef.current = []
    shapesRef.current = nextShapes
    setShapes(nextShapes)
    syncDraft(null)
    setSelectedId(null)
    setTool(initialToolRef.current)
    setHasChanges(serializeShapes(nextShapes) !== savedSignatureRef.current)
  }, [syncDraft])

  const handleToolChange = useCallback((nextTool: CanvasTool) => {
    setTool(nextTool)
  }, [])

  const createStrokeShape = useCallback(
    (point: CanvasPoint): StrokeShape => ({
      id: makeId("stroke"),
      kind: "stroke",
      tool: "pen",
      points: [point],
      stroke: SHAPE_COLORS.pen,
      strokeWidth: 2.5,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }),
    []
  )

  const createLineShape = useCallback(
    (point: CanvasPoint): LineShape => ({
      id: makeId("line"),
      kind: "line",
      tool: "line",
      from: point,
      to: point,
      stroke: SHAPE_COLORS.line,
      strokeWidth: 2,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }),
    []
  )

  const createTextShape = useCallback(
    (point: CanvasPoint, text: string): TextShape => ({
      id: makeId("text"),
      kind: "text",
      tool: "text",
      position: point,
      text,
      fontSize: 18,
      stroke: SHAPE_COLORS.text,
      strokeWidth: 1.5,
      fill: SHAPE_COLORS.textFill,
      background: SHAPE_COLORS.textBackground,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }),
    []
  )

  const handleInsertText = useCallback(
    (point: CanvasPoint) => {
      const value = window.prompt("Escribe el texto de la anotación", "Nueva nota")
      if (value === null) {
        return
      }

      const text = value.trim()
      if (!text) {
        return
      }

      const estimatedWidth = measureWidth(text, 18)
      const marginX = estimatedWidth / Math.max(1, canvasSize.width) + 0.04
      const marginY = (18 * 1.4) / Math.max(1, canvasSize.height) + 0.04
      const position = clampPoint({
        x: clamp(point.x, 0.04, Math.max(0.04, 1 - marginX)),
        y: clamp(point.y, 0.04, Math.max(0.04, 1 - marginY))
      })

      const shape = createTextShape(position, text)
      applyShapes([...shapesRef.current, shape], { selectedId: shape.id })
    },
    [applyShapes, canvasSize.height, canvasSize.width, createTextShape, measureWidth]
  )

  const appendStrokePoint = useCallback((shape: StrokeShape, point: CanvasPoint) => {
    const last = shape.points[shape.points.length - 1]
    if (last && distanceBetweenPoints(last, point) < 0.0025) {
      return shape
    }

    return {
      ...shape,
      points: [...shape.points, point],
      updatedAt: Date.now()
    }
  }, [])

  const eventToCanvasPoint = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => toPoint(event),
    []
  )

  const selectShapeAtPoint = useCallback(
    (point: CanvasPoint) => hitTestShape(point, shapesRef.current, canvasSize, measureContextRef.current),
    [canvasSize]
  )

  const beginPointerCapture = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Sin captura explícita, el board sigue funcionando.
    }
  }, [])

  const releasePointerCapture = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // Ignorar.
    }
  }, [])

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      if (event.button !== 0) {
        return
      }

      event.preventDefault()
      const point = eventToCanvasPoint(event)
      const targetId = selectShapeAtPoint(point)

      if (tool === "text") {
        handleInsertText(point)
        return
      }

      if (tool === "eraser") {
        interactionRef.current = { kind: "erase", lastTargetId: null }
        beginPointerCapture(event)
        if (targetId) {
          const nextShapes = shapesRef.current.filter((shape) => shape.id !== targetId)
          applyShapes(nextShapes, { selectedId: null })
          interactionRef.current = { kind: "erase", lastTargetId: targetId }
        }
        return
      }

      if (tool === "pen") {
        const shape = createStrokeShape(point)
        interactionRef.current = { kind: "pen", shapeId: shape.id }
        syncDraft(shape)
        setSelectedId(shape.id)
        beginPointerCapture(event)
        return
      }

      if (tool === "line") {
        const shape = createLineShape(point)
        interactionRef.current = { kind: "line", shapeId: shape.id, start: point }
        syncDraft(shape)
        setSelectedId(shape.id)
        beginPointerCapture(event)
        return
      }

      if (!targetId) {
        interactionRef.current = null
        syncDraft(null)
        setSelectedId(null)
        return
      }

      const source = shapesRef.current.find((shape) => shape.id === targetId)
      if (!source) {
        return
      }

      interactionRef.current = {
        kind: "drag",
        shapeId: source.id,
        anchor: point,
        source: cloneShape(source),
        moved: false
      }
      syncDraft(cloneShape(source))
      setSelectedId(source.id)
      beginPointerCapture(event)
    },
    [
      applyShapes,
      beginPointerCapture,
      createLineShape,
      createStrokeShape,
      eventToCanvasPoint,
      handleInsertText,
      selectShapeAtPoint,
      syncDraft,
      tool
    ]
  )

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      const interaction = interactionRef.current
      if (!interaction) {
        return
      }

      const point = eventToCanvasPoint(event)

      if (interaction.kind === "pen") {
        const currentDraft = draftRef.current
        if (!currentDraft || currentDraft.kind !== "stroke") {
          return
        }

        const nextShape = appendStrokePoint(currentDraft, point)
        if (nextShape !== currentDraft) {
          syncDraft(nextShape)
        }
        return
      }

      if (interaction.kind === "line") {
        const currentDraft = draftRef.current
        if (!currentDraft || currentDraft.kind !== "line") {
          return
        }

        const nextShape: LineShape = {
          ...currentDraft,
          to: point,
          updatedAt: Date.now()
        }
        syncDraft(nextShape)
        return
      }

      if (interaction.kind === "drag") {
        const delta = {
          x: point.x - interaction.anchor.x,
          y: point.y - interaction.anchor.y
        }

        if (Math.abs(delta.x) > 0.0005 || Math.abs(delta.y) > 0.0005) {
          interaction.moved = true
        }

        const nextShape = translateShape(interaction.source, delta)
        syncDraft(nextShape)
        return
      }

      if (interaction.kind === "erase") {
        const targetId = selectShapeAtPoint(point)
        if (!targetId || targetId === interaction.lastTargetId) {
          return
        }

        const nextShapes = shapesRef.current.filter((shape) => shape.id !== targetId)
        applyShapes(nextShapes, { selectedId: targetId === selectedId ? null : selectedId })
        interaction.lastTargetId = targetId
      }
    },
    [appendStrokePoint, applyShapes, eventToCanvasPoint, selectedId, selectShapeAtPoint, syncDraft]
  )

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      const interaction = interactionRef.current
      if (!interaction) {
        return
      }

      if (interaction.kind === "pen") {
        const currentDraft = draftRef.current
        if (currentDraft && currentDraft.kind === "stroke") {
          applyShapes([...shapesRef.current, currentDraft], { selectedId: currentDraft.id })
        }
      }

      if (interaction.kind === "line") {
        const currentDraft = draftRef.current
        if (currentDraft && currentDraft.kind === "line") {
          applyShapes([...shapesRef.current, currentDraft], { selectedId: currentDraft.id })
        }
      }

      if (interaction.kind === "drag") {
        const currentDraft = draftRef.current
        if (currentDraft && interaction.moved) {
          const nextShapes = shapesRef.current.map((shape) =>
            shape.id === interaction.shapeId ? currentDraft : shape
          )
          applyShapes(nextShapes, { selectedId: currentDraft.id })
        } else {
          syncDraft(null)
          setSelectedId(interaction.shapeId)
        }
      }

      if (interaction.kind === "erase") {
        syncDraft(null)
      }

      interactionRef.current = null
      syncDraft(null)
      releasePointerCapture(event)
    },
    [applyShapes, releasePointerCapture, syncDraft]
  )

  const handlePointerCancel = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      interactionRef.current = null
      syncDraft(null)
      releasePointerCapture(event)
    },
    [releasePointerCapture, syncDraft]
  )

  const handleDoubleClick = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      const point = eventToCanvasPoint(event)
      const targetId = selectShapeAtPoint(point)
      if (!targetId) {
        return
      }

      const target = shapesRef.current.find((shape) => shape.id === targetId)
      if (!target || target.kind !== "text") {
        return
      }

      const edited = window.prompt("Editar texto", target.text)
      if (edited === null) {
        return
      }

      const nextText = edited.trim()
      if (!nextText) {
        return
      }

      const nextShapes = shapesRef.current.map((shape) =>
        shape.id === target.id
          ? {
              ...shape,
              text: nextText,
              updatedAt: Date.now()
            }
          : shape
      )

      applyShapes(nextShapes, { selectedId: target.id })
    },
    [applyShapes, eventToCanvasPoint, selectShapeAtPoint]
  )

  const selectedShape = selectedId
    ? draftShape && draftShape.id === selectedId
      ? draftShape
      : shapes.find((shape) => shape.id === selectedId) ?? null
    : null
  const selectionBounds =
    selectedShape ? getShapeBounds(selectedShape, canvasSize, measureContextRef.current) : null
  const draggingShapeId = interactionRef.current?.kind === "drag" ? interactionRef.current.shapeId : null

  const helperMessage = TOOL_SHORTCUT_HINTS[tool]

  return (
    <div
      className={cn("flex min-h-0 flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface shadow-sm", className)}
    >
      <div className="flex flex-col gap-4 border-b border-outline-variant bg-surface p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="font-title-sm text-title-sm text-primary">{title}</h3>
          {description ? <p className="mt-1 text-sm text-on-surface-variant">{description}</p> : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-outline-variant bg-surface-container-low px-3 py-1 font-data-mono text-[12px] text-on-surface-variant">
            {hasChanges ? "Cambios sin guardar" : "Guardado"}
          </span>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-outline-variant px-4 font-title-sm text-title-sm text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            <MaterialIcon name="restart_alt" />
            {resetLabel}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-secondary px-4 font-title-sm text-title-sm text-on-secondary hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            <MaterialIcon name="save" filled />
            {saveLabel}
          </button>
        </div>
      </div>

      {extraActions ? (
        <div className="flex justify-end border-b border-outline-variant bg-surface px-4 py-2">
          {extraActions}
        </div>
      ) : null}

      <div ref={boardRef} className="canvas-grid relative flex-1 min-h-0 overflow-hidden">
        <svg
          ref={svgRef}
          className="absolute inset-0 h-full w-full select-none touch-none"
          viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
          role="img"
          aria-label={title}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onDoubleClick={handleDoubleClick}
        >
          <defs>
            <marker id="canvas-arrow" markerHeight="6" markerWidth="6" orient="auto-start-reverse" refX="5" refY="5" viewBox="0 0 10 10">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#74777d" />
            </marker>
          </defs>

          {renderBackgroundBlueprint(canvasSize)}

          {shapes
            .filter((shape) => shape.id !== draggingShapeId)
            .map((shape) => {
              const isSelected = selectedId === shape.id

              if (shape.kind === "stroke") {
                if (shape.points.length === 1) {
                  const abs = toAbsolute(shape.points[0], canvasSize)
                  return (
                    <g key={shape.id}>
                      <circle
                        cx={abs.x}
                        cy={abs.y}
                        r={Math.max(3, shape.strokeWidth * 1.35)}
                        fill={shape.stroke}
                        opacity={0.95}
                      />
                      {isSelected ? (
                        <circle
                          cx={abs.x}
                          cy={abs.y}
                          r={Math.max(10, shape.strokeWidth * 3)}
                          fill="none"
                          stroke="#004064"
                          strokeDasharray="8 6"
                          strokeWidth="2"
                        />
                      ) : null}
                    </g>
                  )
                }

                const path = pathFromStroke(shape.points, canvasSize)
                return (
                  <g key={shape.id}>
                    <path
                      d={path}
                      fill="none"
                      stroke={shape.stroke}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={shape.strokeWidth}
                    />
                    {isSelected ? (
                      <path
                        d={path}
                        fill="none"
                        stroke="#004064"
                        strokeDasharray="8 6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={shape.strokeWidth + 4}
                        opacity={0.6}
                      />
                    ) : null}
                  </g>
                )
              }

              if (shape.kind === "line") {
                const from = toAbsolute(shape.from, canvasSize)
                const to = toAbsolute(shape.to, canvasSize)

                return (
                  <g key={shape.id}>
                    <line
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke={shape.stroke}
                      strokeLinecap="round"
                      strokeWidth={shape.strokeWidth}
                    />
                    {isSelected ? (
                      <line
                        x1={from.x}
                        y1={from.y}
                        x2={to.x}
                        y2={to.y}
                        stroke="#004064"
                        strokeDasharray="8 6"
                        strokeLinecap="round"
                        strokeWidth={shape.strokeWidth + 4}
                        opacity={0.6}
                      />
                    ) : null}
                  </g>
                )
              }

              const absPosition = toAbsolute(shape.position, canvasSize)
              const width = measureWidth(shape.text, shape.fontSize)
              const height = shape.fontSize * 1.35

              return (
                <g key={shape.id}>
                  <rect
                    x={absPosition.x - 8}
                    y={absPosition.y - 5}
                    width={width + 16}
                    height={height + 10}
                    rx="8"
                    fill={shape.background}
                    fillOpacity="0.92"
                    stroke={shape.stroke}
                    strokeOpacity="0.12"
                  />
                  <text
                    x={absPosition.x}
                    y={absPosition.y + shape.fontSize}
                    fill={shape.fill}
                    fontFamily="Inter, sans-serif"
                    fontSize={shape.fontSize}
                    fontWeight="600"
                  >
                    {shape.text}
                  </text>
                  {isSelected ? (
                    <rect
                      x={absPosition.x - 10}
                      y={absPosition.y - 7}
                      width={width + 20}
                      height={height + 14}
                      rx="10"
                      fill="none"
                      stroke="#004064"
                      strokeDasharray="8 6"
                      strokeWidth="2"
                    />
                  ) : null}
                </g>
              )
            })}

          {draftShape ? (
            <g opacity="0.75">
              {draftShape.kind === "stroke" ? (
                draftShape.points.length === 1 ? (
                  (() => {
                    const abs = toAbsolute(draftShape.points[0], canvasSize)
                    return (
                      <circle
                        cx={abs.x}
                        cy={abs.y}
                        r={Math.max(3, draftShape.strokeWidth * 1.35)}
                        fill={draftShape.stroke}
                      />
                    )
                  })()
                ) : (
                  <path
                    d={pathFromStroke(draftShape.points, canvasSize)}
                    fill="none"
                    stroke={draftShape.stroke}
                    strokeDasharray="8 6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={draftShape.strokeWidth}
                  />
                )
              ) : null}

              {draftShape.kind === "line" ? (
                <line
                  x1={toAbsolute(draftShape.from, canvasSize).x}
                  y1={toAbsolute(draftShape.from, canvasSize).y}
                  x2={toAbsolute(draftShape.to, canvasSize).x}
                  y2={toAbsolute(draftShape.to, canvasSize).y}
                  stroke={draftShape.stroke}
                  strokeDasharray="8 6"
                  strokeLinecap="round"
                  strokeWidth={draftShape.strokeWidth}
                />
              ) : null}

              {draftShape.kind === "text" ? (
                <g>
                  <rect
                    x={toAbsolute(draftShape.position, canvasSize).x - 8}
                    y={toAbsolute(draftShape.position, canvasSize).y - 5}
                    width={measureWidth(draftShape.text, draftShape.fontSize) + 16}
                    height={draftShape.fontSize * 1.35 + 10}
                    rx="8"
                    fill={draftShape.background}
                    fillOpacity="0.92"
                    stroke={draftShape.stroke}
                    strokeOpacity="0.12"
                  />
                  <text
                    x={toAbsolute(draftShape.position, canvasSize).x}
                    y={toAbsolute(draftShape.position, canvasSize).y + draftShape.fontSize}
                    fill={draftShape.fill}
                    fontFamily="Inter, sans-serif"
                    fontSize={draftShape.fontSize}
                    fontWeight="600"
                  >
                    {draftShape.text}
                  </text>
                </g>
              ) : null}
            </g>
          ) : null}

          {selectionBounds ? (
            <rect
              x={selectionBounds.left}
              y={selectionBounds.top}
              width={Math.max(0, selectionBounds.right - selectionBounds.left)}
              height={Math.max(0, selectionBounds.bottom - selectionBounds.top)}
              fill="none"
              stroke="#004064"
              strokeDasharray="8 6"
              strokeWidth="2"
              pointerEvents="none"
            />
          ) : null}
        </svg>

        <div className="absolute left-4 top-4 z-20 flex flex-col gap-2 rounded-xl border border-outline-variant bg-surface/95 p-2 shadow-soft backdrop-blur-sm">
          <ToolButton icon="ads_click" label="Seleccionar" active={tool === "select"} onClick={() => handleToolChange("select")} />
          <ToolButton icon="draw" label="Trazo libre" active={tool === "pen"} onClick={() => handleToolChange("pen")} />
          <ToolButton icon="timeline" label="Línea" active={tool === "line"} onClick={() => handleToolChange("line")} />
          <ToolButton icon="square_foot" label="Texto / Medición" active={tool === "text"} onClick={() => handleToolChange("text")} />
          <div className="mx-auto my-1 h-px w-8 bg-outline-variant" />
          <ToolButton icon="ink_eraser" label="Borrador" active={tool === "eraser"} onClick={() => handleToolChange("eraser")} />
          <div className="mt-2 flex flex-col gap-1">
            <ToolButton icon="undo" label="Deshacer" onClick={handleUndo} />
            <ToolButton icon="redo" label="Rehacer" onClick={handleRedo} />
          </div>
        </div>

        <div className="absolute right-4 top-4 z-20 flex items-center gap-3 rounded-full border border-outline-variant bg-surface/95 px-4 py-2 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-full bg-primary border border-outline" />
            <span className="font-data-mono text-data-mono text-on-surface-variant">Trazo: 2 px</span>
          </div>
          <div className="h-4 w-px bg-outline-variant" />
          <div className="flex items-center gap-2">
            <MaterialIcon name="layers" className="text-[18px] text-on-surface-variant" />
            <span className="font-data-mono text-data-mono text-on-surface-variant">{shapes.length} elementos</span>
          </div>
        </div>

        <div className="absolute bottom-4 left-4 z-20 max-w-[90%] rounded-full border border-outline-variant bg-surface/95 px-4 py-2 text-sm text-on-surface-variant shadow-sm backdrop-blur-sm">
          {helperMessage}
        </div>
      </div>
    </div>
  )
}
