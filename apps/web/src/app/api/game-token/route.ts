import { SignJWT } from 'jose'
import { requireEnv } from '@/env'

const BAD_REQUEST = 400

// The Game Service refuses a token signed for any other audience (adr/0036).
const AUDIENCE = 'game-service'
const LIFETIME = '1h'

function readStudentId(body: unknown): string | undefined {
  const studentId = typeof body === 'object' && body !== null && 'studentId' in body ? body.studentId : undefined
  return typeof studentId === 'string' && studentId !== '' ? studentId : undefined
}

// Signs a World-scoped token for the Student the page names.
export async function POST(request: Request): Promise<Response> {
  const studentId = readStudentId(await request.json().catch(() => ({})))
  if (!studentId) {
    return Response.json({ error: 'studentId must be a non-empty string' }, { status: BAD_REQUEST })
  }

  // A real Platform checks its own session here, and that the signed-in Student may play this World, instead of trusting the body.
  const token = await new SignJWT({ world: requireEnv('WORLD_ID') })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(studentId)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(LIFETIME)
    .sign(new TextEncoder().encode(requireEnv('JWT_SECRET')))
  return Response.json({ token })
}
