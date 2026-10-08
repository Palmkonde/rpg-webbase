// Tests that need the real Postgres and bucket read where to find them here, and nowhere else.
// oxlint-disable-next-line node/no-process-env
const { DATABASE_URL: databaseUrl, CI: ci, S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_REGION } = process.env

if (!databaseUrl && ci) {
  throw new Error('DATABASE_URL is not set: CI must start Postgres and SeaweedFS for the Game Service tests')
}
if (!databaseUrl) {
  console.warn(
    'Skipping the Game Service tests that need Postgres: DATABASE_URL is not set.\n'
      + 'Start the services with `docker compose -f compose.dev.yaml up -d --wait`, then run `bun --env-file=../../dev.env test ./test` in apps/game-service.',
  )
}

if (databaseUrl && !(S3_ENDPOINT && S3_BUCKET && S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY && S3_REGION)) {
  throw new Error('S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY and S3_REGION are not all set: run the tests with `bun --env-file=../../dev.env test ./test`')
}

export const services = databaseUrl && S3_ENDPOINT && S3_BUCKET && S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY && S3_REGION
  ? { databaseUrl, s3: { endpoint: S3_ENDPOINT, bucket: S3_BUCKET, accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY, region: S3_REGION } }
  : undefined

export const skipWithoutServices = services ? false : 'DATABASE_URL is not set'
