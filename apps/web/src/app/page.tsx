import { Game } from '@/game/game'
import worldConfig from '@/fixtures/world-config.json'

function requireEnv(name: string): string {
  // The one place the Platform reads its configuration.
  // oxlint-disable-next-line node/no-process-env
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is not set: copy apps/web/.env.example to apps/web/.env`)
  }
  return value
}

export default function Home(): React.ReactElement {
  return <Game serviceUrl={requireEnv('GAME_SERVICE_URL')} worldConfig={worldConfig} worldId={requireEnv('WORLD_ID')} />
}
