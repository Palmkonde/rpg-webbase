import { ParseError, t } from 'elysia'

export const FlagsModel = {
  // Shape only, never the World Version's declarations: a session on an older one writes the same document (adr/0038).
  // oxlint-disable-next-line new-cap -- TypeBox's builders are capitalized functions, not constructors.
  patch: t.Record(t.String(), t.Union([t.Boolean(), t.String()])),
}

export type Flags = typeof FlagsModel.patch.static

// Elysia merges a body into its schema's `{}` default before checking it, which would pass `null` as `{}` and `[true]` as `{"0":true}`.
export async function parsePatch({ request }: { request: Request }): Promise<unknown> {
  const body: unknown = await request.json().catch((error: unknown) => { throw new ParseError(error as Error) })
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {throw new ParseError()}
  return body
}
