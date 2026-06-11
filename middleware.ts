import { type NextRequest, NextResponse } from 'next/server'
import { getSession, updateSession } from '@/lib/auth/session'

export async function middleware(request: NextRequest) {
  // 1. Update session expiration
  const res = await updateSession(request)

  // 2. Auth checks
  const session = await getSession()
  const isAuthPage = request.nextUrl.pathname.startsWith('/login')

  if (!session && !isAuthPage && !request.nextUrl.pathname.startsWith('/auth')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (session && isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  if (request.nextUrl.pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = session ? '/dashboard' : '/login'
    return NextResponse.redirect(url)
  }

  return res || NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
