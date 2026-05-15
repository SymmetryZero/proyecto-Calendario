export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ")
}

export function makeId(prefix = "item") {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

export function initialsFromName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

export function formatDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.round(totalSeconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

export function formatDateTime(value: string | number | Date, locale = "es-MX") {
  const date = new Date(value)
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date)
}

export function formatLongDateTime(value: string | number | Date, locale = "es-MX") {
  const date = new Date(value)
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(date)
}

export function formatShortDate(value: string | number | Date, locale = "es-MX") {
  const date = new Date(value)
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "2-digit",
    year: "numeric"
  }).format(date)
}

export function formatNumericDate(value: string | number | Date) {
  // Add time to avoid timezone issues with date-only strings
  const date = typeof value === "string" && !value.includes("T") ? new Date(`${value}T12:00:00`) : new Date(value)
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date)
}

export function formatClock(date = new Date()) {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date)
}

export function formatDateStamp(date = new Date()) {
  return new Intl.DateTimeFormat("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date)
}

export function formatTimeStamp(date = new Date()) {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date)
}

export function createBase64FromString(value: string) {
  if (typeof window === "undefined") {
    return Buffer.from(value, "utf8").toString("base64")
  }

  const bytes = new TextEncoder().encode(value)
  let binary = ""

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })

  return window.btoa(binary)
}

export function createSvgDataUri(svg: string) {
  return `data:image/svg+xml;base64,${createBase64FromString(svg)}`
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

export function createAvatarDataUri(name: string, background = "#172839", foreground = "#ffffff") {
  const initials = escapeXml(initialsFromName(name) || "WP")
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" aria-label="${escapeXml(
      name
    )}">
      <defs>
        <linearGradient id="bg" x1="12" y1="12" x2="84" y2="84" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="${background}" />
          <stop offset="1" stop-color="#2d3e50" />
        </linearGradient>
      </defs>
      <rect width="96" height="96" rx="48" fill="url(#bg)" />
      <circle cx="48" cy="38" r="16" fill="${foreground}" opacity="0.95" />
      <path d="M20 78c4.8-14.8 17.2-23 28-23s23.2 8.2 28 23" fill="${foreground}" opacity="0.95" />
    </svg>
  `

  return createSvgDataUri(svg)
}

export function buildFolderPath(names: string[]) {
  return names.filter(Boolean).join(" / ")
}

export function formatBytes(bytes: number) {
  if (!bytes) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / 1024 ** index
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`
}

export async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"))
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(file)
  })
}

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
