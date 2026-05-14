type MaterialIconProps = {
  name: string
  filled?: boolean
  className?: string
}

export function MaterialIcon({ name, filled = false, className = "" }: MaterialIconProps) {
  return (
    <span className={`material-symbols-outlined ${filled ? "icon-fill" : ""} ${className}`}>
      {name}
    </span>
  )
}
