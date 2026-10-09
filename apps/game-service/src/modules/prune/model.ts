/* oxlint-disable new-cap -- TypeBox's builders are capitalized functions, not constructors. */
import { t } from 'elysia'

export const PruneModel = {
  // Retire this one World Version now, whatever its age; left out, only World Versions past the grace period go.
  prune: t.Object({ version: t.Optional(t.String({ format: 'uuid' })) }),
}
