import { Elysia, t } from 'elysia'
import { jwt } from '@elysiajs/jwt'

const UNAUTHORIZED = 401
const FORBIDDEN = 403

const BEARER = 'Bearer '

// Required by name: jose checks `exp` only when a token carries it, and a token with none would never expire.
const VERIFY_OPTIONS = { audience: 'game-service', algorithms: ['HS256'], requiredClaims: ['exp', 'sub', 'world'] }

const StudentClaims = t.Object({ sub: t.String(), world: t.String() })

// `student: true` on a route under `/worlds/:world` resolves the Student a Platform vouched for (adr/0036).
// The return type stays inferred: it carries the macro and `studentId` into the routes that use it.
// oxlint-disable-next-line typescript/explicit-function-return-type, typescript/explicit-module-boundary-types
export function studentToken(jwtSecret: string) {
  return new Elysia({ name: 'student-token', seed: jwtSecret })
    .use(jwt({ name: 'studentJwt', secret: jwtSecret, schema: StudentClaims }))
    .macro({
      student: {
        async resolve({ headers: { authorization }, params, studentJwt, status }) {
          const claims = authorization?.startsWith(BEARER) && await studentJwt.verify(authorization.slice(BEARER.length), VERIFY_OPTIONS)
          if (!claims) {return status(UNAUTHORIZED, 'A valid Student token is required')}
          const { world } = params as { world?: string }
          if (claims.world !== world) {return status(FORBIDDEN, 'The token is for another World')}
          return { studentId: claims.sub }
        },
      },
    })
}
