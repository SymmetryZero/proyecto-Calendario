"use client"

import { useEffect } from "react"

export function PWARegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      if ("serviceWorker" in navigator) {
        void navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((registration) => {
            void registration.unregister()
          })
        })
      }

      if ("caches" in window) {
        void caches.keys().then((keys) => {
          keys.forEach((key) => {
            void caches.delete(key)
          })
        })
      }

      return
    }

    if (!("serviceWorker" in navigator)) {
      return
    }

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", {
          scope: "/"
        })
      } catch {
        // Fallback silencioso para navegadores que bloquean service workers en desarrollo.
      }
    }

    void register()
  }, [])

  return null
}
