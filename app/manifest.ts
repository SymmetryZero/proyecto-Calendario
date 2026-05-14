import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Flujo Pro",
    short_name: "Flujo Pro",
    description: "PWA de gestión de flujos de trabajo con almacenamiento local.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f7faf9",
    theme_color: "#172839",
    icons: [
      {
        src: "/icons/workflow-pro.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any"
      }
    ]
  }
}
