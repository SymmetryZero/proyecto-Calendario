import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Demo",
    short_name: "Demo",
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
