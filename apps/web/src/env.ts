// Server-side only: the one place the Platform reads its configuration.
export function requireEnv(name: 'GAME_SERVICE_URL' | 'WORLD_ID' | 'JWT_SECRET'): string {
  // oxlint-disable-next-line node/no-process-env
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is not set: run \`bun run dev\` from the repo root, or copy apps/web/.env.example to apps/web/.env`)
  }
  return value
}
