import type { Metadata, Viewport } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import type { ReactNode } from "react"
import "./globals.css"
import { ClerkProvider } from "@clerk/nextjs"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter"
})

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono"
})

export const metadata: Metadata = {
  title: "Demo",
  description: "PWA para gestionar flujos de trabajo con persistencia local."
}

export const viewport: Viewport = {
  themeColor: "#172839",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
}

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode
}>) {
  return (
    <ClerkProvider>
      <html
        lang="es-MX"
        className={`${inter.variable} ${jetBrainsMono.variable}`}
        suppressHydrationWarning
      >
        <head />
        <body className="bg-background text-on-background antialiased">
          {process.env.NODE_ENV !== "production" ? (
            <script
              dangerouslySetInnerHTML={{
                __html: `
                try {
                  if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.getRegistrations().then(function(registrations) {
                      registrations.forEach(function(registration) {
                        registration.unregister();
                      });
                    });
                  }

                  if ('caches' in window) {
                    caches.keys().then(function(keys) {
                      keys.forEach(function(key) {
                        caches.delete(key);
                      });
                    });
                  }
                } catch (error) {
                  console.warn('No se pudo limpiar la caché PWA en desarrollo.', error);
                }
              `
              }}
            />
          ) : null}
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
