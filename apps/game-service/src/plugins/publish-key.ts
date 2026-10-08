import { Elysia } from 'elysia'
import { timingSafeEqual } from 'node:crypto'

const UNAUTHORIZED = 401

const BEARER = 'Bearer '

function matches(given: string, expected: string): boolean {
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

// `publish: true` on a route admits only the shared Publish key (adr/0036), never a Student token.
// The return type stays inferred: it carries the macro into the routes that use it.
// oxlint-disable-next-line typescript/explicit-function-return-type, typescript/explicit-module-boundary-types
export function publishKey(key: string) {
  return new Elysia({ name: 'publish-key', seed: key })
    .macro({
      publish: {
        beforeHandle({ headers: { authorization }, status }) {
          if (!authorization?.startsWith(BEARER) || !matches(authorization.slice(BEARER.length), key)) {
            return status(UNAUTHORIZED, 'The Publish key is required')
          }
        },
      },
    })
}
