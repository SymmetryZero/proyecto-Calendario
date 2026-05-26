"use client"

import React, { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { MaterialIcon } from "@/components/ui/material-icon"
import { cn, makeId } from "@/utils/workflow"
import { type DrawingScene } from "@/store/workflow-store"

type CanvasTool = "select" | "pen" | "line" | "text" | "number" | "eraser"

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
  tool: "text" | "number"
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
const VIRTUAL_CANVAS: CanvasSize = { width: 3200, height: 2000 }

const TOOL_SHORTCUT_HINTS: Record<CanvasTool, string> = {
  select: "Selecciona y arrastra elementos.",
  pen: "Dibuja trazos libres con el mouse o el dedo.",
  line: "Haz clic y arrastra para trazar una línea recta.",
  text: "Haz clic para colocar una nota. Doble clic para editarla.",
  number: "Haz clic para colocar una medición (ej: 300 mm, 45.5 cm).",
  eraser: "Pasa por encima de un elemento para borrarlo."
}

const SHAPE_COLORS = {
  pen: "#172839",
  line: "#004064",
  text: "#865300",
  textFill: "#172839",
  textBackground: "#ffffff",
  numberFill: "#ffffff",
  numberBackground: "#004064",
  numberStroke: "#004064"
}

const STROKE_PALETTE = [
  { color: "#172839", label: "Negro" },
  { color: "#004064", label: "Azul" },
  { color: "#b3261e", label: "Rojo" },
  { color: "#1e6b34", label: "Verde" },
  { color: "#865300", label: "Naranja" },
  { color: "#6750a4", label: "Morado" }
]

const STROKE_WIDTHS = [
  { width: 1.5, label: "Fino" },
  { width: 3, label: "Normal" },
  { width: 5, label: "Grueso" }
]

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}

function clampPoint(point: CanvasPoint): CanvasPoint {
  return {
    x: point.x,
    y: point.y
  }
}

function isTool(value: unknown): value is CanvasTool {
  return value === "select" || value === "pen" || value === "line" || value === "text" || value === "number" || value === "eraser"
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
  const svg = event.currentTarget
  const ctm = svg.getScreenCTM()

  if (ctm) {
    const pt = svg.createSVGPoint()
    pt.x = event.clientX
    pt.y = event.clientY
    const svgPt = pt.matrixTransform(ctm.inverse())
    return {
      x: svgPt.x / VIRTUAL_CANVAS.width,
      y: svgPt.y / VIRTUAL_CANVAS.height
    }
  }

  const rect = svg.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) {
    return { x: 0, y: 0 }
  }

  const clientX = "clientX" in event ? event.clientX : (event as any).touches[0].clientX
  const clientY = "clientY" in event ? event.clientY : (event as any).touches[0].clientY

  return {
    x: (clientX - rect.left) / rect.width,
    y: (clientY - rect.top) / rect.height
  }
}

function translatePoint(point: CanvasPoint, delta: CanvasPoint): CanvasPoint {
  return {
    x: point.x + delta.x,
    y: point.y + delta.y
  }
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
        "flex items-center justify-center rounded-lg transition-colors",
        "h-9 w-9 sm:h-11 sm:w-11",
        active ? "bg-secondary-container text-on-secondary-container shadow-sm" : "text-on-surface-variant hover:bg-surface-container-high"
      )}
    >
      <MaterialIcon name={icon} filled={active} className="text-[20px] sm:text-[24px]" />
      <span className="sr-only">{label}</span>
    </button>
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
  const [strokeColor, setStrokeColor] = useState(SHAPE_COLORS.pen)
  const [strokeWidth, setStrokeWidth] = useState(10)
  const [showStyleMenu, setShowStyleMenu] = useState(false)
  const [internalPrompt, setInternalPrompt] = useState<{
    type: "text" | "number" | "edit"
    title: string
    value: string
    point?: CanvasPoint
    targetId?: string
  } | null>(null)
  const canvasSize = VIRTUAL_CANVAS

  const boardRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLDivElement | null>(null)
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

  // Virtual canvas: coordinates are always in VIRTUAL_CANVAS space.
  // The SVG scales to fit the container via preserveAspectRatio.

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

  const handleSave = useCallback(async () => {
    let previewDataUrl = ""
    if (svgRef.current) {
      try {
        const svgData = new XMLSerializer().serializeToString(svgRef.current)
        const canvas = document.createElement("canvas")
        canvas.width = VIRTUAL_CANVAS.width
        canvas.height = VIRTUAL_CANVAS.height
        const ctx = canvas.getContext("2d")
        const img = new Image()
        img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)))
        await new Promise((resolve) => (img.onload = resolve))
        if (ctx) {
          ctx.fillStyle = "white"
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(img, 0, 0)
        }
        previewDataUrl = canvas.toDataURL("image/png")
      } catch (err) {
        console.error("Failed to generate preview", err)
      }
    }

    onSave({ 
      ...buildPersistedScene(shapesRef.current, tool, canvasSize),
      preview: previewDataUrl 
    } as DrawingScene)
    
    savedSignatureRef.current = serializeShapes(shapesRef.current)
    setHasChanges(false)
  }, [onSave, tool, canvasSize])

  const handleReset = useCallback(() => {
    const nextShapes: CanvasShape[] = []

    historyRef.current = [...historyRef.current, cloneShapes(shapesRef.current)]
    redoRef.current = []
    shapesRef.current = nextShapes
    setShapes(nextShapes)
    syncDraft(null)
    setSelectedId(null)
    setHasChanges(serializeShapes(nextShapes) !== savedSignatureRef.current)
  }, [syncDraft])

  const handleToolChange = useCallback((next: CanvasTool) => {
    setTool(next)
    setSelectedId(null)
    if (next === "pen" || next === "line") {
      setShowStyleMenu(true)
    }
  }, [])

  const createStrokeShape = useCallback(
    (point: CanvasPoint): StrokeShape => ({
      id: makeId("stroke"),
      kind: "stroke",
      tool: "pen",
      points: [point],
      stroke: strokeColor,
      strokeWidth: strokeWidth,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }),
    [strokeColor, strokeWidth]
  )

  const createLineShape = useCallback(
    (point: CanvasPoint): LineShape => ({
      id: makeId("line"),
      kind: "line",
      tool: "line",
      from: point,
      to: point,
      stroke: strokeColor,
      strokeWidth: strokeWidth,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }),
    [strokeColor, strokeWidth]
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
      setInternalPrompt({
        type: "text",
        title: "Nueva anotación",
        value: "Nueva nota",
        point
      })
    },
    []
  )

  const createNumberShape = useCallback(
    (point: CanvasPoint, text: string): TextShape => ({
      id: makeId("num"),
      kind: "text",
      tool: "number",
      position: point,
      text,
      fontSize: 20,
      stroke: SHAPE_COLORS.numberStroke,
      strokeWidth: 0,
      fill: SHAPE_COLORS.numberFill,
      background: SHAPE_COLORS.numberBackground,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }),
    []
  )

  const handleFinishPrompt = useCallback(
    (value: string) => {
      if (!internalPrompt) return
      const text = value.trim()
      if (!text) {
        setInternalPrompt(null)
        return
      }

      if (internalPrompt.type === "text" && internalPrompt.point) {
        const point = internalPrompt.point
        const estimatedWidth = measureWidth(text, 18)
        const marginX = estimatedWidth / Math.max(1, VIRTUAL_CANVAS.width) + 0.04
        const marginY = (18 * 1.4) / Math.max(1, VIRTUAL_CANVAS.height) + 0.04
        const position = clampPoint({
          x: clamp(point.x, 0.04, Math.max(0.04, 1 - marginX)),
          y: clamp(point.y, 0.04, Math.max(0.04, 1 - marginY))
        })

        const shape = createTextShape(position, text)
        applyShapes([...shapesRef.current, shape], { selectedId: shape.id })
      } else if (internalPrompt.type === "number" && internalPrompt.point) {
        const point = internalPrompt.point
        const estimatedWidth = measureWidth(text, 20)
        const marginX = (estimatedWidth + 24) / Math.max(1, VIRTUAL_CANVAS.width) + 0.04
        const marginY = (20 * 1.6) / Math.max(1, VIRTUAL_CANVAS.height) + 0.04
        const position = clampPoint({
          x: clamp(point.x, 0.04, Math.max(0.04, 1 - marginX)),
          y: clamp(point.y, 0.04, Math.max(0.04, 1 - marginY))
        })

        const shape = createNumberShape(position, text)
        applyShapes([...shapesRef.current, shape], { selectedId: shape.id })
      } else if (internalPrompt.type === "edit" && internalPrompt.targetId) {
        const targetId = internalPrompt.targetId
        const nextShapes = shapesRef.current.map((shape) =>
          shape.id === targetId
            ? {
                ...shape,
                text: text,
                updatedAt: Date.now()
              }
            : shape
        )
        applyShapes(nextShapes, { selectedId: targetId })
      }

      setInternalPrompt(null)
    },
    [applyShapes, createNumberShape, createTextShape, internalPrompt, measureWidth]
  )

  const handleInsertNumber = useCallback(
    (point: CanvasPoint) => {
      setInternalPrompt({
        type: "number",
        title: "Nueva medición",
        value: "300 mm",
        point
      })
    },
    []
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
    [] // canvasSize is a constant (VIRTUAL_CANVAS)
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

      if (tool === "number") {
        handleInsertNumber(point)
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

      setInternalPrompt({
        type: "edit",
        title: "Editar texto",
        value: target.text,
        targetId: target.id
      })
    },
    [eventToCanvasPoint, selectShapeAtPoint]
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
      className={cn("flex flex-col h-full bg-surface-container-lowest select-none overflow-hidden", className)}
    >
      <div className="hidden sm:flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 gap-4 border-b border-outline-variant bg-white/80 backdrop-blur-md sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-secondary-container flex items-center justify-center text-on-secondary-container shadow-sm">
             <MaterialIcon name="architecture" className="text-[28px]" />
          </div>
          <div>
            <h3 className="font-display-lg text-lg sm:text-xl font-bold text-primary">{title}</h3>
            {description ? <p className="mt-0.5 text-xs text-on-surface-variant leading-tight max-w-md">{description}</p> : null}
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-center">
          <div className="flex items-center gap-2 mr-2 px-3 py-1.5 bg-surface-container-low rounded-full border border-outline-variant/30">
            <div className={cn("w-2 h-2 rounded-full", hasChanges ? "bg-amber-500 animate-pulse" : "bg-emerald-500")} />
            <span className="font-data-mono text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">
              {hasChanges ? "Editando" : "Sincronizado"}
            </span>
          </div>
          
          <button
            type="button"
            onClick={handleReset}
            className="h-11 px-5 rounded-full border border-outline text-primary font-bold text-sm hover:bg-surface-container transition-all flex items-center gap-2 active:scale-95 cursor-pointer border-none bg-transparent"
          >
            <MaterialIcon name="restart_alt" />
            <span className="hidden sm:inline">{resetLabel}</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges}
            className="h-11 px-6 rounded-full bg-primary text-white font-bold text-sm shadow-lg hover:opacity-90 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-30 disabled:grayscale disabled:scale-100 cursor-pointer border-none"
          >
            <MaterialIcon name="check_circle" filled />
            <span className="hidden sm:inline">{saveLabel}</span>
          </button>
        </div>
      </div>

      {extraActions ? (
        <div className="flex justify-end border-b border-outline-variant bg-surface px-3 sm:px-4 py-1.5 sm:py-2">
          {extraActions}
        </div>
      ) : null}

      {/* Drawing Area */}
      <div className="flex-1 relative overflow-hidden bg-white p-0 flex items-stretch justify-stretch min-h-0">
        <div 
          className="canvas-grid relative w-full h-full overflow-hidden"
          ref={canvasRef}
        >
          <svg
            ref={svgRef}
            className="absolute inset-0 h-full w-full select-none touch-none cursor-crosshair"
            viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label={title}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onDoubleClick={handleDoubleClick}
          >
          <defs>
            <marker id="canvas-arrow" markerHeight="6" markerWidth="6" orient="auto-start-reverse" refX="5" refY="5" viewBox="0 0 10 10">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#74777d" />
            </marker>
          </defs>

          {/* Background Blueprint Removed as requested */}

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
              const isNumber = shape.tool === "number"
              const fontSize = shape.fontSize
              const width = measureWidth(shape.text, fontSize)
              const height = fontSize * 1.35
              const paddingX = isNumber ? 14 : 8
              const paddingY = isNumber ? 8 : 5
              const cornerRadius = isNumber ? height / 2 + paddingY : 8

              return (
                <g key={shape.id}>
                  <rect
                    x={absPosition.x - paddingX}
                    y={absPosition.y - paddingY}
                    width={width + paddingX * 2}
                    height={height + paddingY * 2}
                    rx={cornerRadius}
                    fill={shape.background}
                    fillOpacity={isNumber ? 1 : 0.92}
                    stroke={isNumber ? shape.stroke : shape.stroke}
                    strokeWidth={isNumber ? 2 : 1}
                    strokeOpacity={isNumber ? 0.9 : 0.12}
                  />
                  <text
                    x={absPosition.x}
                    y={absPosition.y + fontSize}
                    fill={shape.fill}
                    fontFamily={isNumber ? "'Roboto Mono', 'SF Mono', 'Cascadia Code', monospace" : "Inter, sans-serif"}
                    fontSize={fontSize}
                    fontWeight={isNumber ? "700" : "600"}
                    letterSpacing={isNumber ? "0.5" : undefined}
                  >
                    {shape.text}
                  </text>
                  {isSelected ? (
                    <rect
                      x={absPosition.x - paddingX - 2}
                      y={absPosition.y - paddingY - 2}
                      width={width + paddingX * 2 + 4}
                      height={height + paddingY * 2 + 4}
                      rx={cornerRadius + 2}
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
        </div>

        {/* Toolbar - floating premium vertical bar */}
        <div className="absolute z-20 left-4 top-6 hidden sm:flex flex-col items-center gap-2 rounded-2xl border border-outline-variant bg-white/90 p-2 shadow-2xl backdrop-blur-md animate-in slide-in-from-left duration-500 max-h-[calc(100%-48px)] overflow-y-auto scrollbar-thin">
          <ToolButton icon="ads_click" label="Seleccionar" active={tool === "select"} onClick={() => handleToolChange("select")} />
          <div className="w-8 h-px bg-outline-variant/30 my-1" />
          <ToolButton icon="draw" label="Trazo libre" active={tool === "pen"} onClick={() => handleToolChange("pen")} />
          <ToolButton icon="timeline" label="Línea" active={tool === "line"} onClick={() => handleToolChange("line")} />
          <ToolButton icon="text_fields" label="Texto / Nota" active={tool === "text"} onClick={() => handleToolChange("text")} />
          <ToolButton icon="straighten" label="Medición" active={tool === "number"} onClick={() => handleToolChange("number")} />
          <div className="w-8 h-px bg-outline-variant/30 my-1" />
          <ToolButton icon="ink_eraser" label="Borrador" active={tool === "eraser"} onClick={() => handleToolChange("eraser")} />
          <div className="w-8 h-px bg-outline-variant/30 my-1" />
          <ToolButton icon="undo" label="Deshacer" onClick={handleUndo} />
          <ToolButton icon="redo" label="Rehacer" onClick={handleRedo} />
        </div>

        {/* Mobile Toolbar - Bottom bar */}
        <div className="absolute z-20 bottom-6 left-1/2 -translate-x-1/2 flex sm:hidden items-center gap-1 rounded-full border border-outline-variant bg-white/95 p-1.5 shadow-2xl backdrop-blur-md">
          <ToolButton icon="ads_click" label="Seleccionar" active={tool === "select"} onClick={() => handleToolChange("select")} />
          <ToolButton icon="draw" label="Trazo libre" active={tool === "pen"} onClick={() => handleToolChange("pen")} />
          <ToolButton icon="timeline" label="Línea" active={tool === "line"} onClick={() => handleToolChange("line")} />
          <ToolButton icon="text_fields" label="Texto / Nota" active={tool === "text"} onClick={() => handleToolChange("text")} />
          <ToolButton icon="straighten" label="Medición" active={tool === "number"} onClick={() => handleToolChange("number")} />
          <ToolButton icon="ink_eraser" label="Borrador" active={tool === "eraser"} onClick={() => handleToolChange("eraser")} />
          <div className="w-px h-6 bg-outline-variant mx-1" />
          <ToolButton icon="undo" label="Deshacer" onClick={handleUndo} />
        </div>

        {/* Color palette and Stroke Width - desktop: left side, mobile: above toolbar */}
        <div 
          className={cn(
            "absolute z-20 bottom-[56px] left-1/2 -translate-x-1/2 sm:bottom-auto sm:left-[72px] sm:top-4 sm:translate-x-0 flex flex-col items-center gap-3 rounded-2xl sm:rounded-xl border border-outline-variant bg-surface/95 p-2 sm:p-2 shadow-soft backdrop-blur-sm transition-all duration-300 origin-bottom sm:origin-left",
            showStyleMenu ? "scale-100 opacity-100 pointer-events-auto" : "scale-90 opacity-0 pointer-events-none translate-y-4 sm:translate-y-0 sm:-translate-x-4"
          )}
        >
          <div className="flex w-full items-center justify-between mb-1 sm:hidden">
             <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70 ml-1">Estilos</span>
             <button onClick={() => setShowStyleMenu(false)} className="h-5 w-5 flex items-center justify-center rounded-full hover:bg-surface-container">
                <MaterialIcon name="close" className="text-[14px]" />
             </button>
          </div>

          {/* Colors */}
          <div className="flex flex-row sm:flex-col items-center gap-1.5">
            {STROKE_PALETTE.map((entry) => (
              <button
                key={entry.color}
                type="button"
                title={entry.label}
                onClick={() => setStrokeColor(entry.color)}
                className={cn(
                  "rounded-full transition-all flex-shrink-0",
                  "h-5 w-5 sm:h-6 sm:w-6",
                  strokeColor === entry.color
                    ? "ring-2 ring-offset-1 ring-primary scale-110"
                    : "hover:scale-110 opacity-75 hover:opacity-100"
                )}
                style={{ backgroundColor: entry.color }}
              >
                <span className="sr-only">{entry.label}</span>
              </button>
            ))}
          </div>

          <div className="h-px w-full bg-outline-variant hidden sm:block" />
          <div className="w-px h-4 bg-outline-variant sm:hidden" />

          {/* Widths - Estilo de slider de volumen premium */}
          <div className="flex flex-row sm:flex-col items-center gap-3 p-3 bg-surface-container rounded-2xl w-full sm:w-auto shadow-inner">
            <MaterialIcon name="line_weight" className="text-[20px] text-primary hidden sm:block mb-1" />
            
            {/* Desktop vertical slider */}
            <div className="relative h-40 w-10 hidden sm:flex items-center justify-center bg-surface-container-highest/50 rounded-full py-4">
               <input
                 type="range"
                 min="1"
                 max="20"
                 step="0.5"
                 value={strokeWidth}
                 onChange={(e) => setStrokeWidth(parseFloat(e.target.value))}
                 className="absolute w-32 h-2 rounded-lg appearance-none cursor-pointer -rotate-90 origin-center bg-transparent z-10"
                 style={{ 
                   WebkitAppearance: "none",
                 }}
               />
               {/* Custom track visualization */}
               <div className="absolute w-1.5 h-32 bg-outline-variant/30 rounded-full overflow-hidden flex flex-col-reverse">
                  <div 
                    className="w-full bg-primary shadow-[0_0_10px_rgba(0,64,100,0.3)] transition-all duration-150" 
                    style={{ height: `${(strokeWidth / 20) * 100}%` }} 
                  />
               </div>
            </div>
            
            {/* Mobile horizontal slider */}
            <div className="flex sm:hidden items-center gap-4 w-full px-1">
               <MaterialIcon name="line_weight" className="text-[18px] text-primary" />
               <div className="relative flex-1 h-8 flex items-center">
                 <input
                   type="range"
                   min="1"
                   max="20"
                   step="0.5"
                   value={strokeWidth}
                   onChange={(e) => setStrokeWidth(parseFloat(e.target.value))}
                   className="absolute w-full h-2 rounded-lg appearance-none cursor-pointer bg-transparent z-10"
                   style={{ 
                     WebkitAppearance: "none",
                   }}
                 />
                 {/* Custom track visualization */}
                 <div className="absolute w-full h-2 bg-outline-variant/30 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary shadow-[0_0_10px_rgba(0,64,100,0.3)] transition-all duration-150" 
                      style={{ width: `${(strokeWidth / 20) * 100}%` }} 
                    />
                 </div>
               </div>
               <span className="font-data-mono text-xs font-bold text-primary min-w-[36px] text-right">{strokeWidth}px</span>
            </div>

            <style jsx>{`
              input[type='range']::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 20px;
                height: 20px;
                background: white;
                border: 3px solid #004064;
                border-radius: 50%;
                cursor: pointer;
                box-shadow: 0 3px 6px rgba(0,0,0,0.16);
                transition: transform 0.1s ease;
              }
              input[type='range']::-webkit-slider-thumb:hover {
                transform: scale(1.15);
              }
              input[type='range']::-moz-range-thumb {
                width: 16px;
                height: 16px;
                background: white;
                border: 3px solid #004064;
                border-radius: 50%;
                cursor: pointer;
                box-shadow: 0 3px 6px rgba(0,0,0,0.16);
              }
            `}</style>
          </div>
          
          <button 
            onClick={() => setShowStyleMenu(false)} 
            className="hidden sm:flex h-8 w-full items-center justify-center rounded-xl hover:bg-surface-container mt-2 text-on-surface-variant transition-colors"
            title="Cerrar men\u00fa de estilos"
          >
            <MaterialIcon name="expand_more" className="text-[20px]" />
          </button>
        </div>

        {/* Floating Actions on Mobile (Top Right) */}
        <div className="absolute z-20 top-3 right-3 flex sm:hidden items-center gap-1.5 bg-white/95 p-1 rounded-full border border-outline-variant shadow-lg backdrop-blur-md">
          {/* Style indicator / toggle */}
          <button
            type="button"
            onClick={() => setShowStyleMenu(!showStyleMenu)}
            className="h-9 px-3 rounded-full flex items-center gap-1 text-[11px] font-bold text-on-surface-variant hover:bg-surface-container active:scale-95 transition-all cursor-pointer border-none bg-transparent"
          >
            <div className="h-3.5 w-3.5 rounded-full border border-outline flex-shrink-0" style={{ backgroundColor: strokeColor }} />
            <span className="font-data-mono text-on-surface-variant">{strokeWidth}px</span>
          </button>
          
          <div className="w-px h-5 bg-outline-variant/60" />

          {/* Reset button */}
          <button
            type="button"
            onClick={handleReset}
            className="h-9 w-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container active:scale-95 transition-all cursor-pointer border-none bg-transparent"
            title={resetLabel}
          >
            <MaterialIcon name="restart_alt" className="text-[20px]" />
          </button>

          {/* Save button */}
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges}
            className={cn(
              "h-9 px-4 rounded-full font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 border-none cursor-pointer",
              hasChanges 
                ? "bg-secondary text-white shadow-md animate-pulse" 
                : "bg-surface-container text-on-surface-variant/40 cursor-not-allowed"
            )}
            title={saveLabel}
          >
            <MaterialIcon name="check_circle" className="text-[16px]" filled={hasChanges} />
            <span>Listo</span>
          </button>
        </div>

        {/* Info pill - compact on Desktop only */}
        <div 
          onClick={() => setShowStyleMenu(!showStyleMenu)}
          className="absolute hidden sm:flex right-4 top-4 z-20 items-center gap-3 rounded-full border border-outline-variant bg-surface/95 px-4 py-2 shadow-sm backdrop-blur-sm cursor-pointer hover:bg-surface-container transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-full border border-outline" style={{ backgroundColor: strokeColor }} />
            <span className="font-data-mono text-data-mono text-on-surface-variant">Trazo: {strokeWidth}px</span>
          </div>
          <div className="h-4 w-px bg-outline-variant" />
          <div className="flex items-center gap-2">
            <MaterialIcon name="layers" className="text-[18px] text-on-surface-variant" />
            <span className="font-data-mono text-data-mono text-on-surface-variant text-[12px]">{shapes.length} elem.</span>
          </div>
        </div>



        {/* Internal Prompt Modal */}
        {internalPrompt && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200">
            <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden border border-outline-variant animate-in zoom-in-95 duration-200 p-6">
              <h4 className="font-bold text-primary mb-4 flex items-center gap-2">
                <MaterialIcon name={internalPrompt.type === "number" ? "straighten" : "text_fields"} className="text-secondary" />
                {internalPrompt.title}
              </h4>
              <input
                autoFocus
                type="text"
                defaultValue={internalPrompt.value}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleFinishPrompt(e.currentTarget.value)
                  if (e.key === "Escape") setInternalPrompt(null)
                }}
                className="w-full h-12 px-4 bg-surface-container-low border border-outline rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all mb-4"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setInternalPrompt(null)}
                  className="px-4 py-2 text-sm font-bold text-on-surface-variant hover:bg-surface-container rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    const input = document.querySelector<HTMLInputElement>('input[type="text"]')
                    if (input) handleFinishPrompt(input.value)
                  }}
                  className="px-6 py-2 bg-primary text-white text-sm font-bold rounded-lg shadow-sm hover:opacity-90"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
