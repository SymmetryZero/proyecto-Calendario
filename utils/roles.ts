export type NormalizedUserRole = "administrador" | "gerente" | "empleado"

export function normalizeUserRole(role: unknown): NormalizedUserRole {
  const normalized = String(role ?? "").trim().toLowerCase()
  if (normalized === "administrador" || normalized === "gerente" || normalized === "empleado") {
    return normalized
  }

  return "empleado"
}

export function isAdminRole(role: unknown) {
  return normalizeUserRole(role) === "administrador"
}

export function isManagerRole(role: unknown) {
  return normalizeUserRole(role) === "gerente"
}

export function isEmployeeRole(role: unknown) {
  return normalizeUserRole(role) === "empleado"
}

export function formatUserRole(role: unknown) {
  switch (normalizeUserRole(role)) {
    case "administrador":
      return "Administrador"
    case "gerente":
      return "Gerente"
    default:
      return "Empleado"
  }
}
