import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

const secretKey = process.env.JWT_SECRET || 'super-secret-key-change-in-production'
const key = new TextEncoder().encode(secretKey)

export async function encrypt(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1d')
    .sign(key)
}

export async function decrypt(input: string): Promise<any> {
  const { payload } = await jwtVerify(input, key, {
    algorithms: ['HS256'],
  })
  return payload
}

export async function createSession(userId: string, role: string) {
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const session = await encrypt({ userId, role, expires })
  const cookieStore = await cookies()

  cookieStore.set('session', session, {
    expires,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  })
}

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.set('session', '', {
    expires: new Date(0),
    path: '/',
  })
}

export async function getSession() {
  const cookieStore = await cookies()
  const session = cookieStore.get('session')?.value
  if (!session) return null
  
  try {
    return await decrypt(session)
  } catch (error) {
    return null
  }
}

export async function updateSession(request: NextRequest) {
  const session = request.cookies.get('session')?.value
  if (!session) return NextResponse.next()

  try {
    const parsed = await decrypt(session)
    const res = NextResponse.next()
    
    // Refresh expiration
    parsed.expires = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const newSession = await encrypt(parsed)
    res.cookies.set({
      name: 'session',
      value: newSession,
      httpOnly: true,
      expires: parsed.expires,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    })
    return res
  } catch (error) {
    return NextResponse.next()
  }
}
