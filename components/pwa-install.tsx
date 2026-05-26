"use client"

import { useState, useEffect } from "react"
import { MaterialIcon } from "@/components/ui/material-icon"
import { cn } from "@/utils/workflow"

export function usePWAInstall() {
  const [isInstallable, setIsInstallable] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [platform, setPlatform] = useState<"ios" | "android" | "other">("other")
  const [deviceType, setDeviceType] = useState<"mobile" | "tablet" | "desktop">("desktop")

  useEffect(() => {
    if (typeof window === "undefined") return

    // Detect standalone display mode
    const checkStandalone = () => {
      setIsStandalone(
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true
      )
    }
    checkStandalone()

    // Detect Device Type and Platform
    const userAgent = window.navigator.userAgent.toLowerCase()
    
    // Platform
    if (/iphone|ipad|ipod/.test(userAgent)) {
      setPlatform("ios")
    } else if (/android/.test(userAgent)) {
      setPlatform("android")
    } else {
      setPlatform("other")
    }

    // Device Type
    const isTabletDevice = /(ipad|tablet|playbook|silk)|(android(?!.*mobile))/.test(userAgent) || 
      (window.navigator.maxTouchPoints > 0 && /macintosh/.test(userAgent))
    
    const isMobileDevice = /iphone|ipod|android|blackberry|iemobile|opera mini|mobile/.test(userAgent) && !isTabletDevice

    if (isTabletDevice) {
      setDeviceType("tablet")
    } else if (isMobileDevice) {
      setDeviceType("mobile")
    } else {
      setDeviceType("desktop")
    }

    const handleBeforeInstall = (e: any) => {
      e.preventDefault()
      // Store event globally on window
      ;(window as any).deferredPrompt = e
      setIsInstallable(true)
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstall)

    // Listen for successful installation
    window.addEventListener("appinstalled", () => {
      setIsInstallable(false)
      checkStandalone()
      ;(window as any).deferredPrompt = null
    })

    // If deferredPrompt is already set on window (due to multiple mounts)
    if ((window as any).deferredPrompt) {
      setIsInstallable(true)
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall)
    }
  }, [])

  const install = async (): Promise<boolean> => {
    const promptEvent = (window as any).deferredPrompt
    if (!promptEvent) return false

    try {
      promptEvent.prompt()
      const { outcome } = await promptEvent.userChoice
      console.log(`PWA install prompt outcome: ${outcome}`)
      if (outcome === "accepted") {
        ;(window as any).deferredPrompt = null
        setIsInstallable(false)
        return true
      }
    } catch (err) {
      console.error("Error triggering PWA prompt", err)
    }
    return false
  }

  return { 
    isInstallable, 
    isStandalone, 
    platform, 
    deviceType, 
    isMobileOrTablet: deviceType !== "desktop", 
    install 
  }
}

interface PWAInstallModalProps {
  isOpen: boolean
  onClose: () => void
}

export function PWAInstallModal({ isOpen, onClose }: PWAInstallModalProps) {
  const { isInstallable, isStandalone, platform, deviceType, install } = usePWAInstall()
  const [installSuccess, setInstallSuccess] = useState(false)

  // Auto close success alert after 3.5s
  useEffect(() => {
    if (installSuccess) {
      const timer = setTimeout(() => {
        setInstallSuccess(false)
        onClose()
      }, 3500)
      return () => clearTimeout(timer)
    }
  }, [installSuccess, onClose])

  if (!isOpen) return null

  const handleInstallClick = async () => {
    const success = await install()
    if (success) {
      setInstallSuccess(true)
    }
  }

  // Visual labels for device type
  const deviceLabel = deviceType === "mobile" 
    ? "celular" 
    : deviceType === "tablet" 
      ? "tablet" 
      : "computadora"

  const deviceIcon = deviceType === "mobile" 
    ? "phone_android" 
    : deviceType === "tablet" 
      ? "tablet_mac" 
      : "laptop"

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-primary/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
      {/* Outer Click to close (only if not showing success) */}
      {!installSuccess && (
        <button
          onClick={onClose}
          className="absolute inset-0 cursor-default"
          aria-label="Cerrar modal"
        />
      )}

      <div className="relative w-full max-w-md bg-surface border border-outline-variant/60 rounded-3xl shadow-2xl overflow-hidden flex flex-col p-6 animate-in zoom-in-95 duration-300">
        
        {/* Decorative background gradients */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-secondary via-tertiary to-primary" />
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-secondary/5 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none" />

        {/* Close Button */}
        {!installSuccess && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 h-9 w-9 flex items-center justify-center rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant transition-colors"
          >
            <MaterialIcon name="close" className="text-[20px]" />
          </button>
        )}

        {installSuccess ? (
          /* SUCCESS VIEW */
          <div className="flex flex-col items-center justify-center text-center py-8 px-2 animate-in fade-in duration-300">
            <div className="w-16 h-16 rounded-full bg-success/15 text-success flex items-center justify-center mb-5 animate-bounce">
              <MaterialIcon name="check_circle" className="text-[44px]" filled />
            </div>
            <h3 className="font-display-lg text-lg font-bold text-primary mb-2">¡Instalación Iniciada!</h3>
            <p className="font-body-md text-sm text-on-surface-variant leading-relaxed">
              La aplicación se está agregando a tu {deviceLabel}. ¡Pronto la verás disponible en tu pantalla de inicio!
            </p>
          </div>
        ) : isStandalone ? (
          /* ALREADY STANDALONE VIEW */
          <div className="flex flex-col items-center justify-center text-center py-6 px-2">
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-on-primary font-bold text-xl mb-5 shadow-lg shadow-primary/20">
              GP
            </div>
            <h3 className="font-display-lg text-lg font-bold text-primary mb-2">Ya estás usando la App</h3>
            <p className="font-body-md text-sm text-on-surface-variant leading-relaxed mb-6">
              ¡Excelente! Ya tienes instalada la versión completa de **Workflow Pro** en tu {deviceLabel}.
            </p>
            <button
              onClick={onClose}
              className="w-full h-11 bg-primary text-on-primary rounded-xl font-bold text-sm hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <span>Entendido</span>
            </button>
          </div>
        ) : (
          /* CHOOSE FLOW BASED ON COMPATIBILITY */
          <div className="flex flex-col">
            <div className="flex items-center gap-3.5 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center shadow-inner">
                <MaterialIcon name={deviceIcon} className="text-[26px]" filled />
              </div>
              <div>
                <h3 className="font-display-lg text-lg font-bold text-primary leading-tight">Instalar en tu {deviceLabel === "celular" ? "Celular" : deviceLabel === "tablet" ? "Tablet" : "PC"}</h3>
                <p className="text-xs text-on-surface-variant mt-0.5">Lleva tu tablero operativo a todas partes</p>
              </div>
            </div>

            {/* Direct Installer available (Android / Chrome) */}
            {isInstallable ? (
              <div className="flex flex-col">
                <p className="font-body-md text-sm text-on-surface-variant leading-relaxed mb-6">
                  Descarga la aplicación en tu **{deviceLabel}** para tener acceso directo instantáneo, notificaciones rápidas en tiempo real y una mejor experiencia táctil optimizada.
                </p>

                <button
                  onClick={handleInstallClick}
                  className="w-full h-12 bg-secondary text-white rounded-xl font-bold text-sm hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-lg shadow-secondary/15 animate-pulse"
                >
                  <MaterialIcon name="download" className="text-[20px]" />
                  <span>Descargar e Instalar</span>
                </button>
              </div>
            ) : platform === "ios" ? (
              /* IOS SAFARI WALKTHROUGH */
              <div className="flex flex-col">
                <p className="font-body-md text-sm text-on-surface-variant leading-relaxed mb-4">
                  Apple no permite la instalación directa con un botón. Sigue estos 3 sencillos pasos para instalarla en tu **{deviceType === "tablet" ? "iPad" : "iPhone"}**:
                </p>

                <div className="space-y-3.5 mb-6">
                  <div className="flex gap-3 bg-surface-container-low p-3 rounded-2xl border border-outline-variant/30">
                    <span className="w-6 h-6 rounded-full bg-secondary text-white font-bold text-xs flex items-center justify-center shrink-0">1</span>
                    <p className="text-xs text-on-surface leading-normal flex flex-wrap items-center gap-1">
                      Toca el botón de <strong>Compartir</strong>
                      <span className="inline-flex items-center justify-center p-1 bg-white border border-outline-variant rounded-md text-primary mx-0.5"><MaterialIcon name="ios_share" className="text-[14px]" /></span>
                      en la barra inferior de Safari.
                    </p>
                  </div>

                  <div className="flex gap-3 bg-surface-container-low p-3 rounded-2xl border border-outline-variant/30">
                    <span className="w-6 h-6 rounded-full bg-secondary text-white font-bold text-xs flex items-center justify-center shrink-0">2</span>
                    <p className="text-xs text-on-surface leading-normal">
                      Desplázate hacia abajo en el menú de opciones y selecciona <strong>"Agregar a inicio"</strong>
                      <span className="inline-flex items-center justify-center p-1 bg-white border border-outline-variant rounded-md text-primary mx-1"><MaterialIcon name="add_box" className="text-[14px]" /></span>.
                    </p>
                  </div>

                  <div className="flex gap-3 bg-surface-container-low p-3 rounded-2xl border border-outline-variant/30">
                    <span className="w-6 h-6 rounded-full bg-secondary text-white font-bold text-xs flex items-center justify-center shrink-0">3</span>
                    <p className="text-xs text-on-surface leading-normal">
                      Confirma tocando <strong>"Agregar"</strong> en la esquina superior derecha de tu **{deviceLabel}**.
                    </p>
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="w-full h-11 bg-primary text-on-primary rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
                >
                  ¡Listo, entendido!
                </button>
              </div>
            ) : (
              /* NO ACTIVE PROMPT (fallback browser instructions) */
              <div className="flex flex-col">
                <p className="font-body-md text-sm text-on-surface-variant leading-relaxed mb-4">
                  Para guardar esta app en tu pantalla de inicio en cualquier otro navegador de tu **{deviceLabel}**:
                </p>

                <div className="space-y-3.5 mb-6">
                  <div className="flex gap-3 bg-surface-container-low p-3 rounded-2xl border border-outline-variant/30">
                    <span className="w-6 h-6 rounded-full bg-secondary text-white font-bold text-xs flex items-center justify-center shrink-0">1</span>
                    <p className="text-xs text-on-surface leading-normal flex flex-wrap items-center gap-1">
                      Abre el menú de opciones de tu navegador (usualmente tres puntos
                      <span className="inline-flex items-center justify-center p-0.5 bg-white border border-outline-variant rounded-md text-primary mx-0.5"><MaterialIcon name="more_vert" className="text-[14px]" /></span>
                      en la esquina superior).
                    </p>
                  </div>

                  <div className="flex gap-3 bg-surface-container-low p-3 rounded-2xl border border-outline-variant/30">
                    <span className="w-6 h-6 rounded-full bg-secondary text-white font-bold text-xs flex items-center justify-center shrink-0">2</span>
                    <p className="text-xs text-on-surface leading-normal">
                      Busca la opción que dice <strong>"Instalar aplicación"</strong> o <strong>"Agregar a la pantalla principal"</strong>.
                    </p>
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="w-full h-11 bg-primary text-on-primary rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
                >
                  Entendido
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
