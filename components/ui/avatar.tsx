import { initialsFromName } from "@/utils/workflow"

type AvatarProps = {
  name: string
  src?: string | null
  className?: string
  badgeClassName?: string
  fallbackClassName?: string
}

export function Avatar({
  name,
  src,
  className = "h-10 w-10",
  badgeClassName = "",
  fallbackClassName = ""
}: AvatarProps) {
  const initials = initialsFromName(name)

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`rounded-full object-cover ${className} ${badgeClassName}`}
      />
    )
  }

  return (
    <div
      aria-label={name}
      className={`rounded-full flex items-center justify-center bg-primary-container text-on-primary-container font-title-sm text-title-sm ${className} ${badgeClassName} ${fallbackClassName}`}
    >
      {initials}
    </div>
  )
}
