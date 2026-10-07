// Tests that need the real Postgres and bucket read where to find them here, and nowhere else.
// oxlint-disable-next-line node/no-process-env
const { DATABASE_URL: databaseUrl, CI: ci } = process.env

if (!databaseUrl && ci) {
  throw new Error('DATABASE_URL is not set: CI must start Postgres and SeaweedFS for the Game Service tests')
}
if (!databaseUrl) {
  console.warn(
    'Skipping the Game Service tests that need Postgres: DATABASE_URL is not set.\n'
      + 'Start the services with `docker compose -f compose.dev.yaml up -d --wait`, then run `bun --env-file=../../dev.env test ./test` in apps/game-service.',
  )
}

export const services = databaseUrl ? { databaseUrl } : undefined

export const skipWithoutServices = services ? false : 'DATABASE_URL is not set'
