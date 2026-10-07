import { FlagsModel, parsePatch } from './model.ts'
import { LIMITS_MESSAGE, mergeFlags, readFlags } from './service.ts'
import type { Database } from '../../database.ts'
import { Elysia } from 'elysia'
import { studentToken } from '../../plugins/student-token.ts'

const NO_CONTENT = 204
const PAYLOAD_TOO_LARGE = 413

// The return type stays inferred: it carries the routes Eden types its calls from (adr/0037).
// oxlint-disable-next-line typescript/explicit-function-return-type, typescript/explicit-module-boundary-types
export function flagsModule({ db, jwtSecret }: { db: Database; jwtSecret: string }) {
  return new Elysia({ name: 'flags', prefix: '/worlds/:world/flags' })
    .use(studentToken(jwtSecret))
    .get('/', ({ params: { world }, studentId }) => readFlags(db, { worldId: world, studentId }), { student: true })
    .patch('/', async ({ params: { world }, studentId, body, status }) => {
      if (await mergeFlags(db, { worldId: world, studentId }, body) === 'overLimit') {
        return status(PAYLOAD_TOO_LARGE, LIMITS_MESSAGE)
      }
      return status(NO_CONTENT)
    }, { student: true, parse: parsePatch, body: FlagsModel.patch })
}
