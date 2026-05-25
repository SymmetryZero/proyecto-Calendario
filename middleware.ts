import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

export const config = {
  matcher: [
    // Evitar que corra en archivos estáticos o internos de Next.js
    '/((?!_next|[^?]*\\.[\\w]+$|_next/image|favicon.ico|manifest.json).*)',
    // Correr siempre en rutas de API
    '/(api|trpc)(.*)',
  ],
};
